"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import { useApi } from "@/app/contexts/ApiContext";
import { takeFeedDetail } from "@/lib/feedDetail";
import type { FeedPost, FeedVote } from "@/types";
import { describeAuthor, describeWhen } from "./FeedCard";

/**
 * 후기 상세 (시안 A2 — `docs/concepts/feed-detail-a2.html`).
 *
 * 짜임은 **지도 머리 → 머리글 → 회색 금액 카드 → 본문 → 바닥 버튼** 이다.
 * 업체 상세(A안)의 생김새를 쓰되 주어는 **후기 한 건**이다 — 업체별 후기
 * 목록도, 업체 단위 통계도 부르지 않는다.
 *
 * **장소가 없으면 지도 블록을 통째로 내지 않는다.** 카테고리 아이콘 면으로
 * 채워 봤다가 걷어냈다 — 정보가 하나도 없는데 168px 을 먹는다. 지도는
 * "이 후기가 어디서 있었나" 에 답하는 자리이고, 장소가 없으면 그 질문 자체가
 * 없다. 목록 카드도 같은 이유로 장소 줄 자체를 내지 않는다("미확인" 이라고
 * 크게 적지 않는다).
 *
 * 금액 카드 아래에는 **같은 카테고리 안에서의 자리**를 눈금으로 찍는다
 * (`GET /plan/feed/stats`). 표본이 적은 카테고리는 **서버가 아예 안 내려
 * 주므로** 화면에서 다시 세지 않는다 — 세 건으로 시세를 말하지 않는 규칙은
 * 서버가 지킨다.
 */

type FeedDetailViewProps = {
  postId: number;
};

/** GET /plan/feed/stats 항목. 표본이 적은 카테고리는 서버가 먼저 걸러 낸다 */
type CategoryStats = {
  categoryName: string;
  total: number;
  median: number;
  p25: number;
  p75: number;
};

const KAKAO_SDK_ID = "kakao-maps-sdk";

/** 카카오맵으로 넘어가는 링크. 좌표가 있어야 열린다 (FeedCard 와 같은 형식) */
function kakaoMapLink(post: FeedPost): string | null {
  if (post.lat === null || post.lng === null) return null;
  if (post.lat === 0 && post.lng === 0) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(post.title)},${
    post.lat
  },${post.lng}`;
}

/**
 * 지도를 그릴 수 있는 좌표인가. `0,0` 은 "좌표 없음" 으로 다룬다.
 *
 * 타입 가드로 쓰지 않는다 — 쓰면 `!showMap` 쪽에서 post 가 never 로 좁혀져
 * 주소 줄을 못 읽는다.
 */
function hasCoords(post: FeedPost | null): boolean {
  if (!post) return false;
  if (post.lat === null || post.lng === null) return false;
  return !(post.lat === 0 && post.lng === 0);
}

/** 만원 단위를 "245만" 으로 */
function formatMan(man: number): string {
  return `${man.toLocaleString("ko-KR")}만`;
}

/**
 * 금액을 자 위의 % 로 바꾼다.
 *
 * 자의 양 끝은 p25·p75 가 아니라 **그 바깥까지 넉넉히** 잡는다. 가운데 절반만
 * 그리면 그 밖에 있는 후기가 자 밖으로 나가 눈금을 못 찍는다.
 * 끝에 닿아도 6~94% 안에 머물게 눌러 둔다 — 라벨이 잘리지 않는다.
 */
function scalePct(value: number, stats: CategoryStats): number {
  const spread = Math.max(stats.p75 - stats.p25, 1);
  const min = stats.p25 - spread;
  const max = stats.p75 + spread;
  const pct = ((value - min) / Math.max(max - min, 1)) * 100;
  return Math.min(94, Math.max(6, pct));
}

export default function FeedDetailView({ postId }: FeedDetailViewProps) {
  const router = useRouter();
  const { fetchWithAuth } = useApi();

  /* 목록에서 누른 경우 이미 받아 둔 항목이 있다 — 그러면 요청이 0 개다 */
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [votePending, setVotePending] = useState(false);
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapDrawnRef = useRef(false);

  useEffect(() => {
    const handed = takeFeedDetail(postId);
    if (handed) {
      setPost(handed);
      setLoading(false);
      return;
    }

    /*
      직접 주소를 열었거나 새로고침한 경우. 백엔드에 단건 조회가 없어
      목록을 한 번 부르고 같은 id 를 찾는다. 첫 장에 없으면 거기서 멈춘다 —
      페이지를 끝까지 뒤지면 요청이 몇 번이고 나간다.
    */
    let alive = true;
    fetchWithAuth(`/plan/feed/list?page=1&count=100&sort=RECENT`, {
      skipLoading: true,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!alive) return;
        const list = json?.data?.list as FeedPost[] | undefined;
        const found = list?.find((p) => p.id === postId) ?? null;
        if (found) setPost(found);
        else setNotFound(true);
      })
      .catch(() => {
        if (alive) setNotFound(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [postId, fetchWithAuth]);

  /*
    이 카테고리의 시세. 표본이 적은 카테고리는 **서버가 아예 안 내려 주므로**
    (`MIN_STATS_SAMPLE`) 받은 것만 그리면 된다 — 화면에서 다시 세지 않는다.

    금액이 비공개면 비교할 값이 없어 부르지 않는다.
  */
  useEffect(() => {
    if (!post || typeof post.amount !== "number") return;

    let alive = true;
    fetchWithAuth("/plan/feed/stats", { skipLoading: true })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!alive) return;
        const list = json?.data?.list as CategoryStats[] | undefined;
        setStats(
          list?.find((s) => s.categoryName === post.categoryName) ?? null,
        );
      })
      .catch(() => {
        // 못 받으면 막대를 안 그린다. 상세의 나머지는 그대로 보인다
      });

    return () => {
      alive = false;
    };
  }, [post, fetchWithAuth]);

  /*
    지도는 **좌표가 있을 때만** 그린다. 주소만 있고 좌표가 없는 후기에
    지오코딩을 부르지 않는다 — 후기마다 호출이 한 번씩 더 나간다.

    개발 중에는 `localhost` 에서만 뜬다. 카카오 JS 키가 도메인에 묶여 있어
    LAN 주소로 열면 지도만 빈 채로 남는다 — 화면이 깨진 게 아니다.
  */
  useEffect(() => {
    if (!post || !hasCoords(post)) return;
    if (mapDrawnRef.current) return;

    const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    if (!key) return;

    const { lat, lng } = post;

    const draw = () => {
      const { kakao } = window as unknown as { kakao?: any };
      if (!kakao?.maps || !mapRef.current || mapDrawnRef.current) return;
      mapDrawnRef.current = true;
      kakao.maps.load(() => {
        if (!mapRef.current) return;
        const center = new kakao.maps.LatLng(lat, lng);
        /*
          머리에 얹는 작은 지도라 **끌거나 확대하지 않는다.** 세로로 긴 화면에서
          지도가 스크롤을 먹으면 본문으로 못 내려간다. 자세히 볼 사람은
          "카카오맵에서 열기" 로 넘어간다.
        */
        const map = new kakao.maps.Map(mapRef.current, {
          center,
          level: 4,
          draggable: false,
          zoomable: false,
        });
        const marker = new kakao.maps.Marker({ position: center });
        marker.setMap(map);
      });
    };

    const existing = document.getElementById(KAKAO_SDK_ID);
    if (existing) {
      draw();
      return;
    }
    const script = document.createElement("script");
    script.id = KAKAO_SDK_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.onload = draw;
    document.head.appendChild(script);
  }, [post]);

  /** 투표. 목록과 같은 규칙 — 같은 값을 다시 누르면 취소, 낙관적으로 그린다 */
  const handleVote = useCallback(
    async (next: FeedVote) => {
      if (!post || votePending) return;
      const isCancel = post.myVote === next;
      const before = post;

      setVotePending(true);
      setPost({
        ...post,
        myVote: isCancel ? null : next,
        helpfulCount:
          post.helpfulCount +
          (next === "HELPFUL" ? (isCancel ? -1 : 1) : 0) +
          (before.myVote === "HELPFUL" && !isCancel && next !== "HELPFUL"
            ? -1
            : 0),
      });

      try {
        const res = await fetchWithAuth(`/plan/feed/${post.id}/vote`, {
          method: isCancel ? "DELETE" : "POST",
          skipLoading: true,
          ...(isCancel ? {} : { body: JSON.stringify({ vote: next }) }),
        });
        const json = await res.json().catch(() => null);
        const count = json?.data?.helpfulCount;
        if (typeof count === "number") {
          setPost((cur) => (cur ? { ...cur, helpfulCount: count } : cur));
        }
      } catch {
        setPost(before);
      } finally {
        setVotePending(false);
      }
    },
    [post, votePending, fetchWithAuth],
  );

  /** 담기 — 목록과 같은 프리필로 등록 화면을 연다 */
  const handleAddToPlan = useCallback(() => {
    if (!post) return;
    const params = new URLSearchParams();
    params.set("category", post.categoryName);
    params.set("title", post.title);
    if (typeof post.amount === "number") {
      params.set("amount", String(post.amount));
    }
    if (post.region) params.set("region", post.region);
    router.push(`/add-plen?${params.toString()}`);
  }, [post, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ee2b8c] border-t-transparent" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
        <p className="text-[15px] font-bold text-[#1b0d14]">
          이 후기를 찾지 못했어요
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#7a6c74]">
          지워졌거나, 목록에서 한참 뒤에 있는 후기일 수 있어요.
        </p>
        <button
          type="button"
          onClick={() => router.push("/feed")}
          className="mt-5 rounded-full bg-[#ee2b8c] px-5 py-2.5 text-[13px] font-bold text-white"
        >
          피드로 가기
        </button>
      </div>
    );
  }

  const mapLink = kakaoMapLink(post);
  const showMap = hasCoords(post);

  return (
    <div className="relative min-h-[100dvh] bg-white pb-[92px]">
      {/* 뒤로가기 — 지도 위에 떠야 해서 머리 면 바깥에 둔다 */}
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="뒤로"
        className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1b0d14] shadow-sm backdrop-blur transition-colors hover:bg-white"
      >
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
      </button>

      {/*
        지도. 좌표가 있을 때만 그린다 — 없으면 이 블록이 통째로 빠지고
        아래 머리글이 그만큼 위로 올라온다.
      */}
      {showMap && (
        <div className="relative h-[168px] w-full overflow-hidden bg-[#eaf0e6]">
          <div ref={mapRef} className="h-full w-full" />
          {mapLink && (
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-4 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#1b0d14] shadow-sm"
            >
              카카오맵에서 열기
            </a>
          )}
        </div>
      )}

      <div
        className={`px-5 pb-4 ${showMap ? "pt-5" : "pt-16"} md:mx-auto md:max-w-[560px]`}
      >
        <p className="text-[12px] font-bold text-[#ee2b8c]">
          {post.categoryName}
        </p>
        <h1 className="mt-2 break-keep text-[24px] font-bold leading-[1.25] tracking-[-0.03em] text-[#1a1c20]">
          {post.title}
        </h1>
        {/* 주소 줄도 지도와 함께 사라진다 — 없는 것은 없는 대로 둔다 */}
        {post.address && (
          <p className="mt-2 text-[13px] text-[#7a6c74]">{post.address}</p>
        )}
      </div>

      {/* 금액 카드 — A안이 업체 중앙값을 두던 자리 */}
      <div className="px-5 md:mx-auto md:max-w-[560px]">
        <div className="rounded-[20px] bg-[#f7f8f9] p-5">
          <p className="text-[12px] text-[#9c9299]">이 후기의 지출</p>
          {post.amount === undefined ? (
            <p className="mt-1.5 text-[18px] font-bold tracking-[-0.02em] text-[#9c9299]">
              금액 비공개
            </p>
          ) : (
            <p className="font-user-content mt-1.5 text-[34px] font-bold leading-none tracking-[-0.045em] text-[#1a1c20] [font-variant-numeric:tabular-nums]">
              {(post.amount * 10000).toLocaleString("ko-KR")}원
            </p>
          )}
          <p className="mt-2 text-[12px] text-[#9c9299]">
            {describeWhen(post.createDate)}
            {post.authorDDay !== null && post.authorDDay > 0 && (
              <> · 결혼식 {post.authorDDay}일 전</>
            )}
          </p>
          {/*
            같은 카테고리 안에서 이 금액이 어디쯤인지.

            **자를 p25~p75 로 잡지 않는다.** 가운데 절반만 그리면 그 밖의
            후기(이 화면이 바로 그럴 수 있다)가 자 밖으로 나간다. 표본의
            최솟값·최댓값을 모르므로 **p25·p75 를 안쪽 눈금으로 두고 양옆에
            여유를 준 자**를 쓴다.
          */}
          {stats && typeof post.amount === "number" && (
            <div className="mt-5 border-t border-[#0000000c] pt-4">
              <p className="text-[12px] text-[#9c9299]">
                {post.categoryName} 후기 {stats.total}건 안에서
              </p>
              <div className="relative mt-6 h-1.5 rounded-full bg-[#f0eef1]">
                {/* 가운데 절반 */}
                <span
                  className="absolute inset-y-0 rounded-full bg-[#e4dfe3]"
                  style={{
                    left: `${scalePct(stats.p25, stats)}%`,
                    right: `${100 - scalePct(stats.p75, stats)}%`,
                  }}
                />
                {/* 이 후기 */}
                <span
                  className="absolute -top-[18px] -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-[#ee2b8c]"
                  style={{ left: `${scalePct(post.amount, stats)}%` }}
                >
                  이 후기
                  <i className="absolute left-1/2 top-[14px] block h-3 w-[3px] -translate-x-1/2 rounded-sm bg-[#ee2b8c]" />
                </span>
              </div>
              <div className="mt-4 flex justify-between text-[10px] text-[#b0a8ae] [font-variant-numeric:tabular-nums]">
                <span>{formatMan(stats.p25)}</span>
                <span>중앙값 {formatMan(stats.median)}</span>
                <span>{formatMan(stats.p75)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="mt-7 px-5 md:mx-auto md:max-w-[560px]">
        <p className="text-[15px] font-bold tracking-[-0.01em] text-[#1a1c20]">
          후기
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span
            className="flex items-center gap-px"
            aria-label={`만족도 ${post.rating}점`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <svg
                key={n}
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill={n <= post.rating ? "#f5a623" : "none"}
                stroke={n <= post.rating ? "#f5a623" : "#dcd6da"}
                strokeWidth="2"
              >
                <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
              </svg>
            ))}
          </span>
          <span className="text-[13px] text-[#9c9299]">
            {post.rating.toFixed(1)}
          </span>
        </div>

        {post.body?.trim() && (
          <p className="mt-4 break-keep text-[14px] leading-[1.75] text-[#3d3138]">
            {post.body}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3 border-t border-[#0000000c] pt-4">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#fff1f7] text-[11px] font-bold text-[#cc1873]">
            {post.authorRole === "BRIDE"
              ? "신부"
              : post.authorRole === "GROOM"
                ? "신랑"
                : "부부"}
          </span>
          <span className="min-w-0">
            <p className="text-[13px] font-bold text-[#1a1c20]">
              {describeAuthor(post)}
            </p>
            {post.region && (
              <p className="mt-0.5 text-[12px] text-[#9c9299]">{post.region}</p>
            )}
          </span>
        </div>
      </div>

      {/* 투표 — 목록과 같은 알약 */}
      <div className="mt-5 flex items-center gap-2 px-5 md:mx-auto md:max-w-[560px]">
        <button
          type="button"
          onClick={() => handleVote("HELPFUL")}
          disabled={votePending}
          aria-pressed={post.myVote === "HELPFUL"}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-colors disabled:opacity-60 ${
            post.myVote === "HELPFUL"
              ? "bg-[#fff1f7] text-[#cc1873]"
              : "bg-[#f7f8f9] text-[#7a6c74] hover:bg-[#f0eef1]"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          도움이 돼요 {post.helpfulCount}
        </button>
        {/*
          "안 돼요" 수는 화면에 절대 내지 않는다. 정직하게 올린 후기에
          숫자가 박히면 다음 사람이 안 올린다 — 공급이 이 기능의 생사다.
        */}
        <button
          type="button"
          onClick={() => handleVote("NOT_HELPFUL")}
          disabled={votePending}
          aria-pressed={post.myVote === "NOT_HELPFUL"}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-colors disabled:opacity-60 ${
            post.myVote === "NOT_HELPFUL"
              ? "bg-[#fff1f7] text-[#cc1873]"
              : "bg-[#f7f8f9] text-[#7a6c74] hover:bg-[#f0eef1]"
          }`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          도움이 안 돼요
        </button>
      </div>

      {/* 바닥 버튼 — 피드의 리텐션 축(코어로 되돌리기) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[#0000000c] bg-white px-5 pb-5 pt-3">
        <div className="md:mx-auto md:max-w-[560px]">
          <button
            type="button"
            onClick={handleAddToPlan}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#ee2b8c] text-[15px] font-bold text-white transition-transform active:scale-[0.99]"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />내 플랜에
            담기
          </button>
        </div>
      </div>

      {/* 좌표가 없어도 주소가 있으면 카카오맵으로 갈 길은 남긴다 */}
      {!showMap && post.address && (
        <div className="mt-6 px-5 md:mx-auto md:max-w-[560px]">
          <p className="flex items-center gap-1.5 text-[13px] text-[#7a6c74]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b0a8ae]" />
            {post.address}
          </p>
        </div>
      )}
    </div>
  );
}
