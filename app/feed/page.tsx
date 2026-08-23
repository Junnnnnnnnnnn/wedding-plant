"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ThumbsUp } from "lucide-react";
import { FeedMyStatus, FeedPost, FeedVote, PostableSchedule } from "@/types";
import { getToken } from "@/lib/api";
import AppShell from "../components/AppShell";
import LoginRequiredModal from "../components/LoginRequiredModal";
import FeedPostModal, { FeedPostTarget } from "../components/FeedPostModal";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import FeedCard from "./FeedCard";

const ALL = "전체";
const PAGE_COUNT = 20;

type SortKey = "RECENT" | "HELPFUL" | "AMOUNT_ASC";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "RECENT", label: "최신순" },
  { key: "HELPFUL", label: "도움순" },
  { key: "AMOUNT_ASC", label: "낮은 금액순" },
];

const FeedPageContent: React.FC = () => {
  const router = useRouter();
  const { fetchWithAuth } = useApi();
  const { unreadCount } = useNotification();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>("RECENT");
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [votePendingId, setVotePendingId] = useState<number | null>(null);

  const [myStatus, setMyStatus] = useState<FeedMyStatus | null>(null);
  const [postables, setPostables] = useState<PostableSchedule[] | null>(null);
  /** 목록을 못 불러온 경우. "없음" 과 구별해야 한다 */
  const [postableError, setPostableError] = useState(false);
  const [postTarget, setPostTarget] = useState<FeedPostTarget | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  /** 카테고리 칩. 마스터 목록을 그대로 쓴다 (add-plen 과 같은 소스) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchWithAuth("/plan/category/list", {
          skipLoading: true,
        });
        const json = (await res.json()) as {
          result?: boolean;
          data?: { list?: Array<{ name?: string; categoryName?: string }> };
        };
        if (!alive || json.result !== true) return;
        const names = (json.data?.list ?? [])
          .map((item) => item.name ?? item.categoryName ?? "")
          .filter(Boolean);
        setCategories([...new Set(names)]);
      } catch {
        // 칩이 없어도 목록은 보인다. 조용히 넘어간다
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchWithAuth]);

  const fetchPosts = useCallback(
    async (nextPage: number, replace: boolean) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        count: String(PAGE_COUNT),
        sort,
      });
      if (category !== ALL) params.set("category", category);

      const res = await fetchWithAuth(`/plan/feed/list?${params}`, {
        skipLoading: true,
      });
      const json = (await res.json()) as {
        result?: boolean;
        data?: { list?: FeedPost[]; total?: number };
      };
      if (json.result !== true) return;

      const list = json.data?.list ?? [];
      setTotal(json.data?.total ?? list.length);
      setPosts((prev) => (replace ? list : [...prev, ...list]));
    },
    [fetchWithAuth, category, sort],
  );

  const reload = useCallback(async () => {
    setListLoading(true);
    setPage(1);
    try {
      await fetchPosts(1, true);
    } catch {
      setPosts([]);
    } finally {
      setListLoading(false);
    }
  }, [fetchPosts]);

  const fetchSide = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/plan/feed/my/status", {
        skipLoading: true,
      });
      const json = (await res.json()) as {
        result?: boolean;
        data?: FeedMyStatus;
      };
      if (json.result === true && json.data) setMyStatus(json.data);
    } catch {
      // 사이드는 부가 정보다. 실패해도 목록은 그대로 본다
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (!getToken()) {
      setShowLoginModal(true);
      setListLoading(false);
      return;
    }
    reload();
  }, [reload]);

  useEffect(() => {
    if (!getToken()) return;
    fetchSide();
  }, [fetchSide]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      await fetchPosts(next, false);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * 평가. 응답이 오기 전에 화면을 먼저 바꾸고(낙관적) 실패하면 되돌린다.
   * 즉시 반응하지 않으면 사람들이 두 번 누른다.
   *
   * 같은 값을 다시 누르면 취소다. "안 돼요" 수는 내려오지 않으므로 화면에서
   * 미리 계산할 것도 없다 — 도움이 돼요 수만 손대면 된다.
   */
  const handleVote = async (post: FeedPost, value: FeedVote) => {
    if (votePendingId !== null) return;
    setVotePendingId(post.id);

    const before = { myVote: post.myVote, helpfulCount: post.helpfulCount };
    const nextVote = post.myVote === value ? null : value;
    const helpfulDelta =
      (nextVote === "HELPFUL" ? 1 : 0) - (post.myVote === "HELPFUL" ? 1 : 0);

    const apply = (myVote: FeedVote | null, helpfulCount: number) =>
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, myVote, helpfulCount } : p,
        ),
      );

    apply(nextVote, Math.max(0, post.helpfulCount + helpfulDelta));

    try {
      const res = await fetchWithAuth(
        `/plan/feed/${post.id}/vote`,
        nextVote === null
          ? { method: "DELETE", skipLoading: true }
          : {
              method: "POST",
              body: JSON.stringify({ value }),
              skipLoading: true,
            },
      );
      const json = (await res.json()) as {
        result?: boolean;
        data?: { myVote: FeedVote | null; helpfulCount: number };
      };
      if (json.result === true && json.data) {
        // 서버 값이 최종이다. 동시에 누른 사람이 있으면 개수가 다를 수 있다
        apply(json.data.myVote, json.data.helpfulCount);
      } else {
        apply(before.myVote, before.helpfulCount);
      }
    } catch {
      apply(before.myVote, before.helpfulCount);
    } finally {
      setVotePendingId(null);
      fetchSide();
    }
  };

  /**
   * 피드에서 코어로 돌려보내는 길.
   * 후기 값을 그대로 채운 등록 화면으로 보낸다 — 사용자는 날짜만 정하면 된다.
   */
  const handleAddToPlan = (post: FeedPost) => {
    const params = new URLSearchParams({
      title: post.title,
      category: post.categoryName,
      from: "feed",
    });
    if (post.amount !== undefined) params.set("amount", String(post.amount));
    /*
      장소 칸에는 **업체명**을 넣는다. add-plen 의 location 은 주소가 아니라
      카카오 검색 결과의 place_name 이 들어가는 자리라, 지역("서울 강남구")을
      넣으면 그대로 저장돼 엉뚱한 값이 된다. 업체명을 넣어 두면 한 번
      검색해서 고르는 것으로 좌표까지 붙는다.
    */
    params.set("location", post.title);
    router.push(`/add-plen?${params}`);
  };

  /**
   * 올릴 수 있는 일정 열기.
   *
   * **실패를 빈 목록으로 바꾸지 않는다.** 예전에는 404 든 500 이든 조용히
   * 삼키고 "올릴 수 있는 일정이 없어요" 를 띄웠는데, 완료한 일정이 있는
   * 사람에게 그건 거짓말이다 (실제로 백엔드 배포 전에 이 화면을 보고
   * 기준이 잘못된 줄 알았다).
   */
  const openPostable = async () => {
    setPostableError(false);
    try {
      const res = await fetchWithAuth("/plan/feed/postable", {
        skipLoading: true,
      });
      const json = (await res.json().catch(() => null)) as {
        result?: boolean;
        data?: { list?: PostableSchedule[] };
      } | null;
      if (!res.ok || json?.result !== true) {
        setPostables([]);
        setPostableError(true);
        return;
      }
      setPostables(json.data?.list ?? []);
    } catch {
      setPostables([]);
      setPostableError(true);
    }
  };

  const chips = [ALL, ...categories];
  const hasMore = posts.length < total;

  const sidePanel = (
    <div className="space-y-3">
      {/*
        공급이 이 기능의 생사다. "나도 올려야지" 를 계속 상기시키는 자리다.
        좁을 때는 이 카드 대신 목록 위 한 줄 띠가 같은 일을 한다 — 카드를
        그대로 위에 얹으면 보러 온 후기가 한 화면 아래로 밀린다.
      */}
      <div className="hidden rounded-[24px] border border-[#ee2b8c0f] bg-white p-5 shadow-sm @[900px]:block">
        <p className="text-[12.5px] text-gray-400">내 후기</p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="font-user-content text-[22px] font-bold leading-none tracking-[-0.03em] text-[#1b0d14]">
            {myStatus?.postCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 text-[12.5px] text-[#7a6c74]">
            <ThumbsUp className="h-3.5 w-3.5 fill-[#ee2b8c] text-[#ee2b8c]" />
            도움이 됐어요 {myStatus?.receivedHelpfulCount ?? 0}
          </span>
        </div>

        {(myStatus?.postableScheduleCount ?? 0) > 0 ? (
          <>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#7a6c74]">
              완료한 일정 중{" "}
              <b className="font-bold text-[#1b0d14]">
                {myStatus?.postableScheduleCount}개
              </b>
              를 아직 안 올렸어요.
            </p>
            <button
              type="button"
              onClick={openPostable}
              className="mt-3 h-11 w-full rounded-xl bg-[#ee2b8c] text-[13px] font-bold text-white transition-colors hover:bg-[#d4237b]"
            >
              올릴 수 있는 일정 보기
            </button>
          </>
        ) : (
          <p className="mt-3 text-[12.5px] leading-relaxed text-gray-400">
            일정을 완료하면 여기서 후기로 올릴 수 있어요.
          </p>
        )}
      </div>

      {categories.length > 0 && (
        <div className="hidden rounded-[24px] border border-[#ee2b8c0f] bg-white p-5 shadow-sm @[900px]:block">
          <p className="mb-3 text-[12.5px] text-gray-400">카테고리</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.slice(0, 10).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  category === name
                    ? "bg-[#ee2b8c] text-white"
                    : "bg-[#fff2f6] text-[#ee2b8c] hover:bg-[#ffe2ee]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AppShell activeTab="feed" activeRailView="feed" unreadCount={unreadCount}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-white px-6 py-4 md:px-8 md:py-5">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold leading-tight tracking-[-0.02em] text-[#1b0d14] md:text-[22px]">
            피드
          </h1>
          <p className="mt-1 text-[12.5px] text-[#7a6c74]">
            다른 커플은 얼마 썼을까
          </p>
        </div>
        <button
          type="button"
          onClick={openPostable}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ee2b8c33] bg-white px-4 py-2 text-[12.5px] font-bold text-[#ee2b8c] transition-colors hover:bg-[#fff2f6]"
        >
          <Plus className="h-4 w-4" />내 후기 올리기
        </button>
      </header>

      <div className="@container no-scrollbar flex-1 overflow-y-auto px-4 pt-4 pb-28 md:mx-auto md:w-full md:max-w-[1400px] md:px-8 md:pt-5 md:pb-10">
        {/* 카테고리 · 정렬 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="no-scrollbar -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-0.5">
            {chips.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                  category === name
                    ? "border-[#ee2b8c] bg-[#ee2b8c] text-white"
                    : "border-[#efe7eb] bg-white text-[#7a6c74] hover:border-[#ee2b8c33]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="ml-auto inline-flex shrink-0 gap-0.5 rounded-full bg-[#f4eff2] p-[3px]">
            {SORTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSort(item.key)}
                aria-pressed={sort === item.key}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-all ${
                  sort === item.key
                    ? "bg-white text-[#1b0d14] shadow-sm"
                    : "text-[#7a6c74] hover:text-[#1b0d14]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/*
          넓어지면 목록 | 사이드 2열. 기준을 뷰포트가 아니라 이 영역의 폭으로
          잡는 이유는 셸의 레일이 768/1024 에서 폭을 크게 바꾸기 때문이다.
        */}
        {/*
          좁을 때의 공급 유도. 사이드 카드를 그대로 위에 얹으면 정작 보러 온
          후기가 한 화면 아래로 밀린다 — 한 줄로 줄이고 나머지는 목록 아래
          사이드에 둔다.
        */}
        {(myStatus?.postableScheduleCount ?? 0) > 0 && (
          <button
            type="button"
            onClick={openPostable}
            className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-[#ee2b8c22] bg-[#fff7fa] px-4 py-3 text-left @[900px]:hidden"
          >
            <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-[#7a6c74]">
              완료한 일정{" "}
              <b className="font-bold text-[#1b0d14]">
                {myStatus?.postableScheduleCount}개
              </b>
              를 아직 안 올렸어요
            </span>
            <span className="shrink-0 rounded-full bg-[#ee2b8c] px-3 py-1.5 text-[12px] font-bold text-white">
              올리기
            </span>
          </button>
        )}

        <div className="grid gap-4 @[900px]:grid-cols-[minmax(0,1fr)_300px] @[900px]:items-start @[900px]:gap-5">
          <div>
            {listLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-[120px] animate-pulse rounded-[24px] bg-white/70"
                  />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-[24px] border border-[#ee2b8c0f] bg-white p-10 text-center shadow-sm">
                <p className="text-[14px] font-bold text-[#1b0d14]">
                  아직 후기가 없어요
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[#7a6c74]">
                  완료한 일정을 올리면 다른 커플이 견적을 가늠할 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={openPostable}
                  className="mt-4 h-11 rounded-xl bg-[#ee2b8c] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#d4237b]"
                >
                  올릴 수 있는 일정 보기
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  {posts.map((post) => (
                    <FeedCard
                      key={post.id}
                      post={post}
                      onVote={handleVote}
                      onAddToPlan={handleAddToPlan}
                      votePending={votePendingId === post.id}
                    />
                  ))}
                </div>
                {hasMore && (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="mt-4 h-12 w-full rounded-2xl border border-[#efe7eb] bg-white text-[13px] font-bold text-[#7a6c74] transition-colors hover:border-[#ee2b8c33] hover:text-[#ee2b8c] disabled:opacity-60"
                  >
                    {loadingMore ? "불러오는 중..." : "더 보기"}
                  </button>
                )}
              </>
            )}
          </div>

          <div>{sidePanel}</div>
        </div>
      </div>

      {/* 올릴 수 있는 일정 고르기 */}
      {postables !== null && (
        <div
          className="fixed inset-0 z-[115] flex items-end justify-center bg-black/40 px-4 py-6 md:items-center"
          onClick={() => setPostables(null)}
          role="presentation"
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="올릴 수 있는 일정"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#1b0d14]">
              올릴 수 있는 일정
            </h2>
            <p className="mt-1 text-[12.5px] text-[#7a6c74]">
              완료했는데 아직 후기로 안 올린 일정이에요.
            </p>

            {postableError ? (
              <div className="py-10 text-center">
                <p className="text-[13px] font-bold text-[#c0203c]">
                  목록을 불러오지 못했어요
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[#7a6c74]">
                  잠시 후 다시 시도해 주세요.
                </p>
                <button
                  type="button"
                  onClick={openPostable}
                  className="mt-4 h-10 rounded-xl border border-[#efe7eb] bg-white px-4 text-[12.5px] font-bold text-[#7a6c74] transition-colors hover:border-[#ee2b8c33] hover:text-[#ee2b8c]"
                >
                  다시 시도
                </button>
              </div>
            ) : postables.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-gray-400">
                  올릴 수 있는 일정이 없어요.
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-gray-400">
                  <b className="font-bold text-[#7a6c74]">완료</b> 처리한 일정만
                  후기로 올릴 수 있어요.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {postables.map((item) => (
                  <button
                    key={item.scheduleId}
                    type="button"
                    onClick={() => {
                      setPostTarget(item);
                      setPostables(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#f4eff2] bg-white p-3.5 text-left transition-colors hover:border-[#ee2b8c33]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-[#1b0d14]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-gray-400">
                        {item.categoryName}
                      </span>
                    </span>
                    <span className="font-user-content shrink-0 text-[14px] font-bold tracking-[-0.02em]">
                      {item.amount === null
                        ? "-"
                        : `${item.amount.toLocaleString("ko-KR")}만원`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <FeedPostModal
        target={postTarget}
        onClose={() => setPostTarget(null)}
        onPosted={() => {
          reload();
          fetchSide();
        }}
      />

      <LoginRequiredModal
        show={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          router.replace("/");
        }}
        title="피드를 보려면 로그인이 필요합니다."
      />
    </AppShell>
  );
};

const FeedPage: React.FC = () => (
  <Suspense fallback={<div className="h-[100dvh] bg-[#fcfbfc]" />}>
    <FeedPageContent />
  </Suspense>
);

export default FeedPage;
