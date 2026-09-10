"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BragDetail, BragPost } from "@/types";
import AppShell from "../components/AppShell";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import BragCard from "./BragCard";
import BragDetailModal from "./BragDetailModal";

/**
 * 자랑하기 목록 (`/brag`).
 *
 * 시안 A안 — 핀터레스트식 벽돌 배치, 카드가 커플과 날짜로 시작한다
 * (`docs/concepts/brag-list.html`). 카드를 누르면 페이지를 옮기지 않고
 * **거의 꽉 찬 모달**이 뜬다 (`BragDetailModal`, 시안 M5-C).
 *
 * API 계약은 `docs/BRAG_API.md`.
 */

const PAGE_COUNT = 20;

type SortKey = "RECENT" | "LIKED";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "RECENT", label: "최신순" },
  { key: "LIKED", label: "좋아요순" },
];

export default function BragPage() {
  const { fetchWithAuth } = useApi();
  const { unreadCount } = useNotification();

  const [posts, setPosts] = useState<BragPost[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<SortKey>("RECENT");
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [likePendingId, setLikePendingId] = useState<number | null>(null);

  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BragDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        count: String(PAGE_COUNT),
        sort,
      });
      const res = await fetchWithAuth(`/plan/brag/list?${params}`, {
        skipLoading: true,
      });
      const json = (await res.json()) as {
        result?: boolean;
        data?: { list?: BragPost[]; total?: number };
      };
      if (json.result !== true) return;
      const list = json.data?.list ?? [];
      setTotal(json.data?.total ?? list.length);
      setPosts((prev) => (replace ? list : [...prev, ...list]));
    },
    [fetchWithAuth, sort],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setListLoading(true);
      setPage(1);
      try {
        await fetchPage(1, true);
      } catch {
        if (alive) setPosts([]);
      } finally {
        if (alive) setListLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      await fetchPage(next, false);
      setPage(next);
    } catch {
      // 더 못 받아도 이미 받은 목록은 그대로 둔다
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * 좋아요는 **낙관적으로** 그린다. 요청 전에 숫자를 먼저 바꾸고 응답이 오면
   * 서버 값으로 맞춘다 — 즉시 반응하지 않으면 사람들이 두 번 누른다
   * (피드의 투표와 같은 규칙).
   */
  const toggleLike = async (post: BragPost) => {
    if (post.isMine || likePendingId === post.bragId) return;
    const next = !post.liked;
    const apply = (liked: boolean, count: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.bragId === post.bragId ? { ...p, liked, likeCount: count } : p,
        ),
      );
      setDetail((prev) =>
        prev && prev.bragId === post.bragId
          ? { ...prev, liked, likeCount: count }
          : prev,
      );
    };

    apply(next, post.likeCount + (next ? 1 : -1));
    setLikePendingId(post.bragId);
    try {
      const res = await fetchWithAuth(`/plan/brag/like/${post.bragId}`, {
        method: next ? "POST" : "DELETE",
        skipLoading: true,
      });
      const json = (await res.json()) as {
        result?: boolean;
        data?: { likeCount?: number; liked?: boolean };
      };
      if (json.result !== true) throw new Error("좋아요 실패");
      apply(json.data?.liked ?? next, json.data?.likeCount ?? post.likeCount);
    } catch {
      apply(post.liked, post.likeCount);
    } finally {
      setLikePendingId(null);
    }
  };

  const openDetail = async (post: BragPost) => {
    setOpenId(post.bragId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetchWithAuth(`/plan/brag/${post.bragId}`, {
        skipLoading: true,
      });
      const json = (await res.json()) as {
        result?: boolean;
        data?: BragDetail;
      };
      setDetail(json.result === true ? (json.data ?? null) : null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const unpublish = async (post: BragPost) => {
    try {
      const res = await fetchWithAuth("/plan/brag", { method: "DELETE" });
      const json = (await res.json()) as { result?: boolean };
      if (json.result !== true) return;
      setPosts((prev) => prev.filter((p) => p.bragId !== post.bragId));
      setTotal((t) => Math.max(0, t - 1));
      if (openId === post.bragId) setOpenId(null);
    } catch {
      // 실패하면 카드가 그대로 남는다 — 잘못 사라지는 것보다 낫다
    }
  };

  const hasMore = posts.length < total;

  return (
    <AppShell activeRailView="brag" unreadCount={unreadCount}>
      <div className="@container no-scrollbar flex-1 overflow-y-auto">
        {/*
          머리 면은 **스크롤 영역 안**에 있다 — 폰에서는 내용과 함께 위로
          올라간다 (`docs` 의 "모바일 뷰포트" 절). 넓은 화면은 흰 머리글
          띠라 `md:sticky` 로 자리를 지킨다.
        */}
        <header
          data-mobile-head
          className="md:sticky md:top-0 md:z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-6 py-5 md:rounded-none md:border-b md:border-stone-100 md:bg-white md:bg-none md:px-8 md:py-5"
        >
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-bold leading-tight tracking-[-0.02em] text-white md:text-[22px] md:text-[#1b0d14]">
              자랑하기
            </h1>
            <p className="mt-1 text-[12.5px] text-white/80 md:text-[#7a6c74]">
              다른 커플은 어떻게 준비했을까
            </p>
          </div>
        </header>

        <div className="pb-tabbar px-4 pt-4 md:mx-auto md:w-full md:max-w-[1600px] md:px-8 md:pb-10 md:pt-5">
          <div className="mb-4 flex items-center gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                  sort === s.key
                    ? "bg-[#1b0d14] font-bold text-white"
                    : "bg-[#f7f5f6] text-[#7a6c74] hover:bg-stone-100"
                }`}
              >
                {s.label}
              </button>
            ))}
            <span className="ml-auto text-[12.5px] text-gray-400 tabular-nums">
              {total.toLocaleString("ko-KR")}장
            </span>
          </div>

          {listLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="skeleton-shimmer h-[260px] rounded-[20px]"
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-stone-200 px-6 py-14 text-center">
              <p className="text-[15px] font-bold text-[#1b0d14]">
                아직 올라온 플랜이 없어요
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#7a6c74]">
                홈의 예산 패널에서 <b>자랑하기</b>를 켜면
                <br />
                우리 플랜이 여기 첫 장으로 올라갑니다.
              </p>
            </div>
          ) : (
            <>
              {/*
                벽돌 배치. 다단은 **위에서 아래로** 채운 뒤 다음 단으로
                넘어가므로 읽는 순서가 지그재그가 아니라 세로다 — 최신순
                목록에서는 오히려 맞다.
                기준은 뷰포트가 아니라 **이 영역의 폭**이다(`@container`).
                레일이 768/1024 에서 76px↔236px 로 뛰어서 뷰포트 기준으로는
                늘 어긋난다.
              */}
              <div className="gap-5 [column-gap:1.25rem] @[560px]:columns-2 @[980px]:columns-3 @[1360px]:columns-4">
                {posts.map((post) => (
                  <BragCard
                    key={post.bragId}
                    post={post}
                    onOpen={() => openDetail(post)}
                    onToggleLike={() => toggleLike(post)}
                    onUnpublish={
                      post.isMine ? () => unpublish(post) : undefined
                    }
                    likePending={likePendingId === post.bragId}
                  />
                ))}
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mx-auto mt-2 block rounded-full border border-stone-200 px-5 py-2.5 text-[13.5px] font-bold text-[#7a6c74] transition-colors hover:bg-stone-50 disabled:opacity-50"
                >
                  {loadingMore ? "불러오는 중" : "더 보기"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {openId != null && (
        <BragDetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => setOpenId(null)}
          likePending={likePendingId === openId}
          onToggleLike={() => {
            const post = posts.find((p) => p.bragId === openId);
            if (post) toggleLike(post);
          }}
        />
      )}
    </AppShell>
  );
}
