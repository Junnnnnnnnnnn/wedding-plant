"use client";

import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin, X } from "lucide-react";
import { BragPlanItem } from "@/types";

/**
 * 자랑하기 상세 안에서 플랜 한 줄을 눌렀을 때 뜨는 **보기 전용** 시트.
 *
 * **바꿀 수 있는 것이 하나도 없다.** 남의 플랜이라 완료 토글도, 수정도,
 * 담기도 없다 — 안내 모달이 "다른 사람은 보기와 좋아요만" 이라고 약속했다.
 *
 * ── 왜 만들었나 ─────────────────────────────────────────────
 * M5-C 는 "앱의 플랜 카드를 그대로 쓴다" 가 전제라, 카드가 앱에서 늘 눌리던
 * 그 모양이다. 시안에 "앱과 모양이 같을수록 눌러 보게 된다" 고 적어 뒀는데
 * 실제로 그렇게 됐다 — 배포 뒤 첫 피드백이 "이거 누르면 상세가 보여야 한다"
 * 였다. 눌러도 아무 일이 없는 것보다 보기 전용으로 열어 주는 편이 낫다.
 *
 * ── 보여 주는 것 ────────────────────────────────────────────
 * 카드가 이미 다섯 값을 보여 주므로(제목·카테고리·날짜·금액·완료), 그대로
 * 옮기면 같은 것을 두 번 보여 주는 빈 시트가 된다. 그래서 한 겹씩 더한다 —
 * 날짜를 요일까지 펴고, 이 한 줄이 카테고리에서 차지하는 몫을 내고,
 * **장소가 있으면 지도**를 놓는다.
 *
 * 시각·메모는 **일부러 없다.** 공개 범위 밖이라 서버가 아예 안 내려 준다
 * (`docs/BRAG_API.md`). 새 값을 붙이려면 안내 모달의 `OPEN_FIELDS` 를
 * 먼저 고쳐야 한다.
 */

/** 지도를 그리는 자리. 한 번에 하나만 열리므로 id 하나로 충분하다 */
const MAP_ID = "brag-plan-map";

/**
 * 카카오 지도가 타일을 가진 범위 — **대한민국뿐이다.**
 *
 * 밖의 좌표를 주면 지도가 뜨긴 뜨는데 타일이 전부 `white.png`(데이터 없음)라
 * **빈 흰 상자**가 된다. 신혼여행처럼 해외 장소가 흔한 카테고리에서 실제로
 * 그렇게 보였다 — 푸꾸옥(베트남) 호텔이 백지로 떴다.
 *
 * 백령도(124.6)·마라도(33.06)·독도(131.87)를 감싸는 넉넉한 사각형이다.
 * 정확한 국경이 아니라 **"지도가 나올 만한 곳인가"** 를 가르는 선이라,
 * 조금 넓게 잡아도 빈 지도만 안 나오면 된다.
 */
const KOREA_BOUNDS = {
  minLat: 33.0,
  maxLat: 38.7,
  minLng: 124.5,
  maxLng: 132.0,
};

function isMappable(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  return (
    lat >= KOREA_BOUNDS.minLat &&
    lat <= KOREA_BOUNDS.maxLat &&
    lng >= KOREA_BOUNDS.minLng &&
    lng <= KOREA_BOUNDS.maxLng
  );
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2027년 1월 10일 일요일". 카드의 "1월 10일" 보다 한 겹 자세하다 */
function longDate(startDate: string | null): string {
  if (!startDate) return "날짜 미정";
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) return "날짜 미정";
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 ${w}요일`;
}

interface BragPlanSheetProps {
  item: BragPlanItem;
  /** 이 항목이 속한 카테고리의 소계 (지출 + 예정) */
  categorySubtotal: number;
  /** 그 카테고리에 든 플랜 수. 하나뿐이면 몫을 말해 봐야 늘 100% 다 */
  categoryItemCount: number;
  /** 묶음 머리와 같은 색. 어느 묶음에서 열렸는지가 색으로 이어진다 */
  categoryColor: string;
  onClose: () => void;
}

export default function BragPlanSheet({
  item,
  categorySubtotal,
  categoryItemCount,
  categoryColor,
  onClose,
}: BragPlanSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const lat = typeof item.lat === "number" ? item.lat : null;
  const lng = typeof item.lng === "number" ? item.lng : null;
  /** 좌표가 있어도 국외면 빈 흰 상자가 된다. 그러면 지도를 아예 안 낸다 */
  const hasMap = isMappable(lat, lng);
  const overseas = lat !== null && lng !== null && !hasMap;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /* 카카오 SDK. 이미 떠 있으면 다시 안 받는다 (등록 화면과 같은 처리) */
  useEffect(() => {
    if (!hasMap) return undefined;
    if (window.kakao?.maps?.LatLng) {
      setSdkReady(true);
      return undefined;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao?.maps?.load(() => setSdkReady(true));
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, [hasMap]);

  /*
    지도를 그린다. **끌거나 확대하지 못하게 잠근다** — 남의 플랜을 보는
    자리라 지도가 조작 대상이 되면 시선이 거기 묶인다. 더 보고 싶은 사람은
    아래 카카오맵 링크로 나간다.
  */
  useEffect(() => {
    if (!hasMap || !sdkReady) return undefined;
    const timer = setTimeout(() => {
      const container = document.getElementById(MAP_ID);
      if (!container || !window.kakao?.maps?.LatLng) return;
      try {
        const coords = new window.kakao.maps.LatLng(lat, lng);
        const map = new window.kakao.maps.Map(container, {
          center: coords,
          level: 4,
          draggable: false,
          scrollwheel: false,
          disableDoubleClick: true,
          disableDoubleClickZoom: true,
        });
        // eslint-disable-next-line no-new
        new window.kakao.maps.Marker({ map, position: coords });
      } catch {
        // 지도가 안 떠도 시트의 나머지는 그대로 보인다
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [hasMap, sdkReady, lat, lng]);

  const done = item.status === "COMPLETED";
  const amount = item.amount ?? 0;
  const place = item.location?.trim() || null;
  const share =
    categorySubtotal > 0 && amount > 0
      ? Math.round((amount / categorySubtotal) * 100)
      : null;

  return (
    /*
      모달(z-200) 위에 얹힌다. ESC 는 이 시트가 먼저 먹는다 — 부모가
      `planItem` 이 열려 있으면 모달을 닫지 않는다.
    */
    <div
      className="fixed inset-0 z-[210] grid place-items-center bg-[#1a1c20]/35 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${item.title} 자세히`}
        /* 지도가 붙으면 세로가 길어진다. 375x553 에서도 넘치지 않게 */
        className="no-scrollbar relative max-h-[86dvh] w-full max-w-[360px] overflow-y-auto rounded-[24px] bg-white px-6 pb-6 pt-7 shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white text-[#7a6c74] transition-colors hover:bg-stone-100 hover:text-[#1b0d14]"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
        </button>

        <div className="flex items-center gap-2">
          <i
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: categoryColor }}
          />
          <span className="text-[12.5px] font-bold text-[#7a6c74]">
            {item.categoryName}
          </span>
        </div>

        <h3 className="mt-2 pr-8 text-[20px] font-bold leading-snug tracking-[-0.02em] text-[#1b0d14] break-keep">
          {item.title}
        </h3>

        {/* 상태는 색·취소선이 아니라 말로 적는다. 시트는 훑는 자리가 아니다 */}
        <span
          className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[12px] font-bold ${
            done ? "bg-[#f2eef0] text-[#7a6c74]" : "bg-[#fff2f6] text-[#ee2b8c]"
          }`}
        >
          {done ? "완료했어요" : "아직 예정이에요"}
        </span>

        <dl className="mt-5 grid gap-3 border-t border-stone-100 pt-5 text-[13.5px]">
          <div className="flex items-baseline gap-4">
            <dt className="w-14 shrink-0 text-[#7a6c74]">날짜</dt>
            <dd className="min-w-0 font-bold text-[#1b0d14]">
              {longDate(item.startDate)}
            </dd>
          </div>
          <div className="flex items-baseline gap-4">
            <dt className="w-14 shrink-0 text-[#7a6c74]">금액</dt>
            <dd className="min-w-0">
              {item.amount == null ? (
                <span className="text-[#7a6c74]">정하지 않았어요</span>
              ) : (
                <span className="font-user-content text-[19px] font-bold tracking-[-0.02em] text-[#1b0d14] tabular-nums">
                  {amount.toLocaleString("ko-KR")}만 원
                </span>
              )}
            </dd>
          </div>
          {/*
            장소 줄은 **항상 낸다.** 피드의 목록 카드는 없으면 줄을 지우지만
            (금액을 세로로 훑는 설계라 빈 줄이 늘면 그게 깨진다), 여기는 한
            장을 자세히 보는 자리라 **"없다" 는 것도 정보다.** 줄이 사라지면
            보는 사람은 "안 적었나" 와 "화면이 안 그렸나" 를 구별하지 못한다.
          */}
          <div className="flex items-baseline gap-4">
            <dt className="w-14 shrink-0 text-[#7a6c74]">장소</dt>
            <dd className="min-w-0 break-keep">
              {place ? (
                <span className="font-bold text-[#1b0d14]">{place}</span>
              ) : (
                <span className="text-[#7a6c74]">등록하지 않았어요</span>
              )}
            </dd>
          </div>
        </dl>

        {hasMap ? (
          <div className="mt-4">
            <div
              id={MAP_ID}
              className="h-[168px] w-full overflow-hidden rounded-[14px] bg-[#f4eff2]"
              role="img"
              aria-label={`${place ?? item.title} 위치`}
            />
            <a
              href={`https://map.kakao.com/link/map/${encodeURIComponent(
                place ?? item.title,
              )},${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#ee2b8c] transition-opacity hover:opacity-70"
            >
              <MapPin className="h-3.5 w-3.5" strokeWidth={2.2} />
              카카오맵에서 보기
              <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
            </a>
          </div>
        ) : (
          /*
            지도 자리를 비워 두지 않는다. 빈칸이면 "지도가 안 떴나" 로
            읽히는데, 실제로는 **그 일정에 장소가 없는 것**이다.

            지도를 못 내는 이유는 셋이다 — 장소를 아예 안 적었거나, 적긴
            했지만 카카오에서 고르지 않아 좌표가 안 붙었거나, **좌표는 있는데
            국외라 카카오에 타일이 없거나.** 셋을 갈라 적는다.
            높이는 지도(168px)보다 낮게 잡는다 — 없는 것을 지도만큼 크게
            그리면 그게 더 눈에 띈다.
          */
          <div className="mt-4 grid h-[96px] w-full place-items-center gap-1.5 rounded-[14px] border border-dashed border-stone-200 bg-[#faf7f9] px-4 text-center">
            <MapPin
              className="h-4 w-4 text-[#c9bfc5]"
              strokeWidth={2}
              aria-hidden
            />
            <span className="text-[12.5px] leading-relaxed text-[#7a6c74] break-keep">
              {overseas
                ? "해외라서 지도를 보여 줄 수 없어요"
                : place
                  ? "지도에 표시할 수 없는 장소예요"
                  : "장소를 등록하지 않은 일정이에요"}
            </span>
          </div>
        )}

        {/*
          카드에는 없던 값. 이미 받은 데이터로만 만든다.

          **카테고리에 이 하나뿐이면 몫을 말하지 않는다** — 늘 100% 라
          "180만 원 가운데 100%" 처럼 같은 말을 두 번 하는 문장이 된다
          (실제로 그렇게 보였다). 그때는 하나뿐이라는 사실을 적는다.
        */}
        <p className="mt-4 rounded-[14px] bg-[#faf7f9] px-4 py-3 text-[12.5px] leading-relaxed text-[#7a6c74] break-keep">
          {categoryItemCount <= 1 ? (
            <>
              {item.categoryName} 카테고리에는 이 플랜{" "}
              <b className="font-bold text-[#1b0d14]">하나뿐</b>이에요.
            </>
          ) : share != null ? (
            <>
              {item.categoryName} 카테고리 총{" "}
              <b className="font-bold text-[#1b0d14]">
                {categorySubtotal.toLocaleString("ko-KR")}만 원
              </b>{" "}
              중 <b className="font-bold text-[#ee2b8c]">{share}%</b>를
              차지해요.
            </>
          ) : (
            <>
              {item.categoryName} 카테고리에 든 플랜{" "}
              <b className="font-bold text-[#1b0d14]">{categoryItemCount}장</b>{" "}
              가운데 하나예요.
            </>
          )}
        </p>

        <p className="mt-4 text-[12px] leading-relaxed text-gray-400">
          남의 플랜이라 보기만 할 수 있어요.
        </p>
      </div>
    </div>
  );
}
