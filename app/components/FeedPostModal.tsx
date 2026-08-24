"use client";

import React, { useEffect, useState } from "react";
import { MapPin, Search, Star, X } from "lucide-react";
import { useApi } from "../contexts/ApiContext";
import { PickedPlace, toPickedPlace, useKakaoPlaces } from "./useKakaoPlaces";

import { track } from "@/lib/analytics";

export interface FeedPostTarget {
  scheduleId: number;
  categoryName: string;
  title: string;
  amount: number | null;
  /** 일정에 적힌 장소. 카카오에서 고른 경우 주소가 아니라 **업체명**이다 */
  location: string | null;
  /** 일정에 저장된 좌표. 있으면 장소를 자동으로 잡는다 */
  locationLat?: number | null;
  locationLng?: number | null;
}

interface FeedPostModalProps {
  /** null 이면 닫힘 */
  target: FeedPostTarget | null;
  onClose: () => void;
  /** 올리기 성공. 부모가 목록을 다시 받는다 */
  onPosted?: () => void;
}

const ROLES = [
  { value: "BRIDE", label: "신부" },
  { value: "GROOM", label: "신랑" },
  { value: "UNKNOWN", label: "밝히지 않음" },
] as const;

/**
 * 후기 올리기.
 *
 * **글을 새로 쓰게 하지 않는다.** 카테고리·업체명·금액·지역은 이미 완료한
 * 일정에 다 있어서 서버가 그 값을 읽어 간다 — 사용자는 별점과 한 줄,
 * 공개 범위만 고른다. 콘텐츠 제작 비용이 낮아야 피드가 채워진다.
 *
 * 금액은 화면에 보여 주되 **여기서 고칠 수 없다.** 서버도 클라이언트가 보낸
 * 금액을 무시하고 일정 값을 쓴다 — 아무 숫자나 시세로 올릴 수 있으면 이
 * 피드의 유일한 값어치가 무너진다.
 */
const FeedPostModal: React.FC<FeedPostModalProps> = ({
  target,
  onClose,
  onPosted,
}) => {
  const { fetchWithAuth } = useApi();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [isAmountPublic, setIsAmountPublic] = useState(true);
  const [authorRole, setAuthorRole] =
    useState<(typeof ROLES)[number]["value"]>("BRIDE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    업체(카카오 장소).

    일정 제목은 자기가 보려고 적은 메모라 "본식 촬영" 같은 값이 많고, 일정의
    location 은 카카오에서 고르면 주소가 아니라 업체명이다. 그래서 여기서
    한 번 더 고르게 한다 — place id 가 있어야 나중에 같은 업체 후기를 묶고,
    도로명 주소가 있어야 지역이 생긴다.

    **필수는 아니다.** 청첩장·예물·신혼여행처럼 지도에 없는 게 정상인
    카테고리가 있고, 막으면 공급이 죽는다.
  */
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [keyword, setKeyword] = useState("");
  /** 좌표로 장소를 자동 판정하는 중 */
  const [detecting, setDetecting] = useState(false);
  const kakao = useKakaoPlaces();

  // 다른 일정으로 다시 열면 앞선 입력이 남아 있으면 안 된다
  useEffect(() => {
    if (!target) return;
    setRating(5);
    setBody("");
    setIsAmountPublic(true);
    setError(null);
    setPlace(null);
    // 일정에 적힌 장소명을 검색어로 깔아 둔다. 한 번만 누르면 고를 수 있다
    setKeyword(target.location?.trim() || target.title.trim());
    kakao.reset();
    // kakao 는 매 렌더 새 객체라 넣으면 무한 루프다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  /**
   * 일정에 이미 있는 장소를 자동으로 잡는다.
   *
   * 일정을 만들 때 카카오에서 고른 이름과 좌표가 그대로 있는데, 후기에서
   * 또 찾게 하면 사람들이 그냥 건너뛴다. 그러면 주소도 place id 도 못 얻고
   * 지역 필터가 빈 채로 남는다 — 실제로 그래서 "장소가 안 잡힌다" 는 말을
   * 들었다.
   *
   * 이름 + 좌표로 같은 곳을 찾으면 place id 까지 얻고, 못 찾으면 좌표를
   * 주소로 바꿔 **지역만이라도** 살린다.
   */
  useEffect(() => {
    if (!target || !kakao.ready) return;
    const lat = target.locationLat;
    const lng = target.locationLng;
    if (!lat || !lng) return;

    let alive = true;
    setDetecting(true);
    (async () => {
      const name = target.location?.trim() || target.title.trim();
      const found = await kakao.findNear(name, lat, lng);
      if (!alive) return;

      if (found) {
        const picked = toPickedPlace(found);
        if (picked) {
          setPlace(picked);
          setDetecting(false);
          return;
        }
      }

      const address = await kakao.addressOf(lat, lng);
      if (!alive) return;
      if (address) {
        // place id 는 없다. 업체 묶기는 안 되지만 지역·주소는 살아난다
        setPlace({ placeId: "", placeName: name, address, lat, lng });
      }
      setDetecting(false);
    })();

    return () => {
      alive = false;
      setDetecting(false);
    };
    // kakao 는 매 렌더 새 객체다. ready 만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, kakao.ready]);

  useEffect(() => {
    if (!target) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/plan/feed", {
        method: "POST",
        body: JSON.stringify({
          scheduleId: target.scheduleId,
          rating,
          body: body.trim() || undefined,
          isAmountPublic,
          authorRole,
          ...(place
            ? {
                // 좌표로만 찾은 경우 place id 가 없다. 빈 문자열을 보내면
                // 그게 하나의 "업체" 가 되어 서로 다른 곳이 묶인다
                ...(place.placeId ? { placeId: place.placeId } : {}),
                placeName: place.placeName,
                address: place.address,
                lat: place.lat,
                lng: place.lng,
              }
            : {}),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        result?: boolean;
      } | null;
      if (!res.ok || json?.result !== true) {
        setError("올리지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      track("feed_post");
      onPosted?.();
      onClose();
    } catch {
      setError("올리지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 px-4 py-6 md:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="후기 올리기"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#1b0d14]">
              후기 올리기
            </h2>
            <p className="mt-1 text-[12.5px] text-[#7a6c74]">
              익명으로 올라가요. 이름은 보이지 않습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 올라갈 값. 여기서 고치지 못한다 */}
        <div className="rounded-2xl border border-[#f4eff2] bg-[#fcfbfc] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[14.5px] font-bold text-[#1b0d14]">
              {target.title}
            </span>
            <span className="font-user-content shrink-0 text-[16px] font-bold tracking-[-0.02em]">
              {target.amount === null
                ? "-"
                : `${target.amount.toLocaleString("ko-KR")}만원`}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-gray-400">
            {target.categoryName}
          </p>
        </div>

        {/*
          업체 고르기.

          고르면 업체명이 이 이름으로 올라가고(일정 제목은 개인 메모인 경우가
          많다), 주소에서 시/구를 잘라 지역이 만들어지고, place id 로 나중에
          같은 업체 후기가 묶인다. 건너뛰어도 올라간다.
        */}
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] text-gray-400">
            업체 <span className="text-gray-300">(선택)</span>
          </p>

          {detecting && !place ? (
            <div className="rounded-2xl border border-[#f4eff2] bg-[#fcfbfc] p-3.5 text-[12.5px] text-gray-400">
              일정에 저장된 장소를 찾는 중...
            </div>
          ) : place ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#ee2b8c33] bg-[#fff7fa] p-3.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#ee2b8c]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-[#1b0d14]">
                  {place.placeName}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-[#7a6c74]">
                  {place.address}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPlace(null)}
                className="shrink-0 text-[12px] font-bold text-[#7a6c74] underline decoration-[#d6ccd2] underline-offset-2"
              >
                다시 고르기
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    kakao.search(keyword);
                  }}
                  placeholder="업체 이름으로 검색"
                  className="min-w-0 flex-1 rounded-2xl border border-[#efe7eb] bg-white px-4 py-3 text-[14px] text-[#1b0d14] outline-none transition-all placeholder:text-[#c8bfc4] focus:border-[#ee2b8c] focus:ring-4 focus:ring-[#ee2b8c14]"
                />
                <button
                  type="button"
                  onClick={() => kakao.search(keyword)}
                  disabled={!kakao.ready || !keyword.trim()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff2f6] text-[#ee2b8c] transition-colors hover:bg-[#ffe2ee] disabled:opacity-50"
                  aria-label="장소 검색"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>

              {kakao.failed && (
                <p className="mt-2 text-[12px] text-[#c0203c]">
                  지도를 불러오지 못했어요. 업체 없이 올려도 됩니다.
                </p>
              )}
              {kakao.searching && (
                <p className="mt-2 text-[12px] text-gray-400">찾는 중...</p>
              )}
              {!kakao.searching && kakao.results.length > 0 && (
                <div className="mt-2 max-h-[180px] space-y-1 overflow-y-auto">
                  {kakao.results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const picked = toPickedPlace(item);
                        if (picked) setPlace(picked);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-xl border border-[#f4eff2] bg-white p-3 text-left transition-colors hover:border-[#ee2b8c33]"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold text-[#1b0d14]">
                          {item.place_name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-gray-400">
                          {item.road_address_name || item.address_name}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <p className="mt-2 text-[12px] leading-relaxed text-gray-400">
                고르면 <b className="font-bold text-[#7a6c74]">업체명</b>이 이
                이름으로 올라가고 지역이 표시돼요. 온라인 주문처럼 장소가 없으면
                건너뛰어도 됩니다.
              </p>
            </>
          )}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[12.5px] text-gray-400">만족도</p>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n}점`}
                aria-pressed={rating === n}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  className={`h-7 w-7 ${
                    n <= rating
                      ? "fill-[#ffb020] text-[#ffb020]"
                      : "text-[#e9e1e5]"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[12.5px] text-gray-400">
            한 줄 후기 <span className="text-gray-300">(선택)</span>
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="다음 사람이 알면 좋을 것 하나만 적어 주세요"
            className="w-full resize-none rounded-2xl border border-[#efe7eb] bg-white px-4 py-3 text-[14px] leading-relaxed text-[#1b0d14] outline-none transition-all placeholder:text-[#c8bfc4] focus:border-[#ee2b8c] focus:ring-4 focus:ring-[#ee2b8c14]"
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[12.5px] text-gray-400">나는</p>
          <div className="inline-flex gap-0.5 rounded-full bg-[#f4eff2] p-[3px]">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setAuthorRole(role.value)}
                aria-pressed={authorRole === role.value}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                  authorRole === role.value
                    ? "bg-white text-[#1b0d14] shadow-sm"
                    : "text-[#7a6c74] hover:text-[#1b0d14]"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[#f4eff2] bg-[#fcfbfc] p-3.5">
          <input
            type="checkbox"
            checked={isAmountPublic}
            onChange={(e) => setIsAmountPublic(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#ee2b8c]"
          />
          <span className="text-[12.5px] leading-relaxed text-[#7a6c74]">
            <b className="font-bold text-[#1b0d14]">금액을 공개합니다.</b> 끄면
            업체와 후기만 올라가고 금액은 아무에게도 보이지 않습니다.
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-[#c0203c11] px-4 py-3 text-center text-[13px] font-bold text-[#c0203c]"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="mt-5 h-14 w-full rounded-2xl bg-[#ee2b8c] text-[15px] font-bold text-white transition-all hover:bg-[#d4237b] active:scale-[0.99] disabled:opacity-70"
        >
          {saving ? "올리는 중..." : "올리기"}
        </button>
      </div>
    </div>
  );
};

export default FeedPostModal;
