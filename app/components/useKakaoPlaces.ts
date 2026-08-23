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

  const reset = useCallback(() => {
    seqRef.current += 1;
    setResults([]);
    setSearching(false);
  }, []);

  return { ready, failed, results, searching, search, reset };
}
