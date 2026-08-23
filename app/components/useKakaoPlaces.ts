"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

/** 카카오 키워드 검색 결과 중 우리가 쓰는 것만 */
export interface KakaoPlace {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name?: string;
  /** 경도 (문자열로 온다) */
  x: string;
  /** 위도 (문자열로 온다) */
  y: string;
}

/** 후기에 저장할 형태로 추린 장소 */
export interface PickedPlace {
  placeId: string;
  placeName: string;
  /** 도로명이 있으면 도로명, 없으면 지번 */
  address: string;
  lat: number;
  lng: number;
}

export function toPickedPlace(place: KakaoPlace): PickedPlace | null {
  const lat = Number(place.y);
  const lng = Number(place.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    placeId: String(place.id),
    placeName: place.place_name.trim(),
    address: (place.road_address_name || place.address_name || "").trim(),
    lat,
    lng,
  };
}

/**
 * 카카오 장소 검색.
 *
 * `AddPlanView` 가 하던 SDK 로드 + keywordSearch 를 훅으로 뺐다. 후기 모달도
 * 같은 검색이 필요한데, 거기서 다시 구현하면 SDK 로드 조건(`autoload=false`
 * 라 `maps.load()` 콜백 전까지 services 가 undefined)을 또 틀리기 쉽다.
 *
 * `AddPlanView` 는 지도 렌더까지 얽혀 있어 아직 옮기지 않았다. 그쪽을 손볼
 * 일이 생기면 이 훅으로 합치는 게 맞다.
 */
export function useKakaoPlaces() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  /** 늦게 온 응답이 최신 결과를 덮어쓰지 않게 한다 */
  const seqRef = useRef(0);

  useEffect(() => {
    if (window.kakao?.maps?.services) {
      setReady(true);
      return undefined;
    }
    // 이미 다른 화면이 붙여 둔 스크립트가 있으면 로드만 기다린다
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="dapi.kakao.com/v2/maps/sdk.js"]',
    );
    const onLoad = () => {
      window.kakao?.maps?.load(() => setReady(true));
    };
    if (existing) {
      if (window.kakao?.maps) onLoad();
      else existing.addEventListener("load", onLoad);
      return () => existing.removeEventListener("load", onLoad);
    }

    const apiKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = onLoad;
    // 키 미설정·도메인 미등록·네트워크 차단. 무한 대기 대신 여기서 끝낸다
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
    return undefined;
  }, []);

  const search = useCallback(
    (keyword: string) => {
      const q = keyword.trim();
      if (!q || !ready) return;

      const seq = seqRef.current + 1;
      seqRef.current = seq;
      setSearching(true);

      const places = new window.kakao.maps.services.Places();
      places.keywordSearch(
        q,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data: any, status: any) => {
          if (seqRef.current !== seq) return;
          setSearching(false);
          const okStatus = window.kakao.maps.services.Status.OK;
          setResults(
            status === okStatus && Array.isArray(data) ? data.slice(0, 8) : [],
          );
        },
        { size: 8 },
      );
    },
    [ready],
  );

  /**
   * 좌표 근처에서 이름으로 찾아 **한 곳을 특정**한다.
   *
   * 일정에는 이미 카카오에서 고른 장소의 이름과 좌표가 들어 있다. 후기를
   * 올릴 때 그걸 또 찾게 하면 사람들이 그냥 건너뛰고, 그러면 주소도 place id
   * 도 영영 못 얻는다. 좌표를 중심으로 다시 찾아 같은 곳이면 자동으로 잡는다.
   *
   * 목록 검색과 달리 `results` 를 건드리지 않는다 — 자동 판정은 화면에
   * 후보를 늘어놓는 일이 아니다.
   */
  const findNear = useCallback(
    (keyword: string, lat: number, lng: number): Promise<KakaoPlace | null> => {
      const q = keyword.trim();
      if (!q || !ready) return Promise.resolve(null);

      return new Promise((resolve) => {
        const places = new window.kakao.maps.services.Places();
        const done = setTimeout(() => resolve(null), 6000);
        places.keywordSearch(
          q,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data: any, status: any) => {
            clearTimeout(done);
            if (
              status !== window.kakao.maps.services.Status.OK ||
              !Array.isArray(data) ||
              data.length === 0
            ) {
              resolve(null);
              return;
            }
            // 반경을 200m 로 걸어 두었으니 가장 가까운 것을 고른다.
            // 같은 이름의 다른 지점이 끼어드는 걸 막는 게 목적이다.
            const near = data.find((item: KakaoPlace) => {
              const dy = Math.abs(Number(item.y) - lat);
              const dx = Math.abs(Number(item.x) - lng);
              // 위도 0.002 ≈ 220m. 좌표가 이 안이면 같은 곳으로 본다
              return dy < 0.002 && dx < 0.002;
            });
            resolve(near ?? null);
          },
          {
            size: 5,
            location: new window.kakao.maps.LatLng(lat, lng),
            radius: 200,
          },
        );
      });
    },
    [ready],
  );

  /**
   * 좌표 → 주소. 이름으로 못 찾았을 때의 마지막 수단이다.
   *
   * place id 는 못 얻지만 **지역만이라도 살린다.** 지역이 비면 필터가
   * 통째로 죽는다.
   */
  const addressOf = useCallback(
    (lat: number, lng: number): Promise<string | null> => {
      if (!ready) return Promise.resolve(null);
      return new Promise((resolve) => {
        const geocoder = new window.kakao.maps.services.Geocoder();
        const done = setTimeout(() => resolve(null), 6000);
        geocoder.coord2Address(
          lng,
          lat,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data: any, status: any) => {
            clearTimeout(done);
            if (
              status !== window.kakao.maps.services.Status.OK ||
              !Array.isArray(data) ||
              data.length === 0
            ) {
              resolve(null);
              return;
            }
            const road = data[0].road_address?.address_name;
            const jibun = data[0].address?.address_name;
            resolve(road || jibun || null);
          },
        );
      });
    },
    [ready],
  );

  const reset = useCallback(() => {
    seqRef.current += 1;
    setResults([]);
    setSearching(false);
  }, []);

  return {
    ready,
    failed,
    results,
    searching,
    search,
    findNear,
    addressOf,
    reset,
  };
}
