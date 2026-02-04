"use client";

import {
  Calendar,
  Check,
  CircleDollarSign,
  CirclePlus,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import CountUp from "@/components/CountUp";
import BottomTabBar from "../components/BottomTabBar";
import KakaoLoginAlert from "../components/KakaoLoginAlert";
import ProfileEditModal from "../components/ProfileEditModal";
import LoginRequiredModal from "../components/LoginRequiredModal";
import GuestPlanLimitModal from "../components/GuestPlanLimitModal";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import { getToken, clearAllStoredData } from "@/lib/api";
import { useScrollDirection } from "../hooks/useScrollDirection";

/** API weddingDate "YYYY-MM-DD" → { year, month, day } */
function parseWeddingDate(
  weddingDate?: string,
): { year: number; month: number; day: number } | undefined {
  if (!weddingDate || typeof weddingDate !== "string") return undefined;
  const [y, m, d] = weddingDate.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return undefined;
  return { year: y, month: m, day: d };
}

// 결혼식 날짜 포맷 (YYYY년 MM월 DD일 (요일))
function formatWeddingDate(date?: {
  year: number;
  month: number;
  day: number;
}) {
  if (!date) return null;
  const d = new Date(date.year, date.month - 1, date.day);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[d.getDay()];
  return `${date.year}년 ${date.month}월 ${date.day}일 (${weekday})`;
}

// 결혼식 날짜로부터 오늘까지의 D-day 계산 (일 단위)
function getDDay(weddingDate?: { year: number; month: number; day: number }) {
  if (!weddingDate) return null;
  const wedding = new Date(
    weddingDate.year,
    weddingDate.month - 1,
    weddingDate.day,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  wedding.setHours(0, 0, 0, 0);
  const diffMs = wedding.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

interface PlanUserData {
  id: string;
  weddingDate: string;
  budget: number;
  name: string;
}

/** GET /plan/schedule/list 응답 항목 */
interface ScheduleListItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  /** COMPLETED 일 때 체크박스·취소선·회색 표시 */
  status?: string | null;
}

const SCHEDULE_PAGE_SIZE = 10;
const SCHEDULE_SORT = "DESC";
const SCHEDULE_SORT_COLUMN = "createDate";

/** 카테고리명으로 파스텔 색상 반환 (동일 이름 = 동일 색상) */
function getCategoryColor(categoryName: string): string {
  const colors = [
    "#FFE4E9",
    "#E8DDF5",
    "#D5F0E5",
    "#FFF0D6",
    "#D4EBF7",
    "#FFE5D9",
  ];
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = (hash << 5) - hash + categoryName.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

/** startDate와 오늘의 거리에 따라 점 색상: 가까울수록 진한 분홍, 멀수록 회색. null이면 미정(회색) */
function getDotColorByDate(startDate: string | null): string {
  if (!startDate?.trim()) return "#9ca3af"; // 미정: 회색
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "#9ca3af";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diffMs = start.getTime() - today.getTime();
  const daysUntil = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "#bbf7d0"; // 지난 일정: 연한 녹색
  if (daysUntil <= 7) return "#ff8fa3"; // 1주 이내: 찐한 분홍
  if (daysUntil <= 30) return "#ffaab8"; // 1개월 이내: 분홍
  if (daysUntil <= 90) return "#ffd0d9"; // 3개월 이내: 연한 분홍
  return "#bbf7d0"; // 그 이상: 연한 녹색
}

function MainPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { weddingData, resetData } = useWedding();
  const { fetchWithAuth } = useApi();
  const [apiPlanData, setApiPlanData] = useState<PlanUserData | null | "none">(
    null,
  );
  const [totalAmountManwon, setTotalAmountManwon] = useState<number | null>(
    null,
  );
  const [tokenChecked, setTokenChecked] = useState(false);
  const cancelledRef = useRef(false);
  const fetchPlanUser = useCallback(
    async (onApiError: (status?: number) => void) => {
      if (!getToken()) {
        setApiPlanData("none");
        return;
      }
      try {
        const res = await fetchWithAuth("/plan/user");
        if (cancelledRef.current) return;
        const json = (await res.json()) as {
          result?: boolean;
          data?: PlanUserData;
        };
        if (cancelledRef.current) return;
        if (json.result === true && json.data) {
          setApiPlanData(json.data);
        } else {
          setApiPlanData("none");
          if (!res.ok) onApiError(res.status);
        }
      } catch {
        if (!cancelledRef.current) onApiError();
      }
    },
    [fetchWithAuth],
  );

  const fetchTotalAmount = useCallback(
    async (onApiError: (status?: number) => void) => {
      if (!getToken()) {
        setTotalAmountManwon(0);
        return;
      }
      try {
        const res = await fetchWithAuth("/plan/user/total-amount");
        if (cancelledRef.current) return;
        const json = (await res.json()) as {
          result?: boolean;
          data?: { totalAmount?: number };
        };
        if (cancelledRef.current) return;
        if (json.result === true && json.data?.totalAmount != null) {
          // API totalAmount는 만원 단위 (예: 240149 → 24억 1백49만원)
          setTotalAmountManwon(json.data.totalAmount);
        } else {
          setTotalAmountManwon(0);
          if (!res.ok) onApiError(res.status);
        }
      } catch {
        if (!cancelledRef.current) {
          setTotalAmountManwon(0);
          onApiError();
        }
      }
    },
    [fetchWithAuth],
  );

  /** 401이면 모달 없이 / 로만 이동, 그 외에는 api_error=1 로 ApiErrorModal 표시 */
  const handleApiError = useCallback(
    (status?: number) => {
      clearAllStoredData();
      resetData();
      if (status === 401) {
        router.replace("/");
      } else {
        router.replace("/?api_error=1");
      }
    },
    [resetData, router],
  );

  // /main 접속 시 JWT가 존재하면 GET /plan/user, GET /plan/user/total-amount 호출
  useEffect(() => {
    const token = getToken();
    setTokenChecked(true);
    if (!token) {
      setApiPlanData("none");
      setTotalAmountManwon(0);
      return;
    }
    cancelledRef.current = false;
    fetchPlanUser(handleApiError);
    fetchTotalAmount(handleApiError);
    // eslint-disable-next-line consistent-return -- useEffect cleanup is valid
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchPlanUser, fetchTotalAmount, handleApiError]);

  // JWT 있으면 GET /plan/user 결과(apiPlanData) 사용, 없으면 세션 스토리지(weddingData) 데이터 적용
  const displayData = useMemo(() => {
    if (apiPlanData && apiPlanData !== "none") {
      const date = parseWeddingDate(apiPlanData.weddingDate);
      return {
        name: apiPlanData.name ?? "",
        budget: String(apiPlanData.budget ?? 1000),
        date,
      };
    }
    // JWT 없음 → 세션 스토리지에 있는 이름·날짜·예산 적용
    return {
      name: weddingData.name ?? "",
      budget: weddingData.budget ?? "1000",
      date: weddingData.date,
    };
  }, [apiPlanData, weddingData]);

  const isPlanLoading = Boolean(
    !tokenChecked || (getToken() && apiPlanData === null),
  );

  const dDay = useMemo(() => getDDay(displayData.date), [displayData.date]);
  const dDayLabel = (() => {
    if (dDay === null) return "날짜 설정";
    if (dDay > 0) return `D-${dDay}`;
    if (dDay === 0) return "D-Day";
    return `D+${Math.abs(dDay)}`;
  })();
  const weddingDateText = formatWeddingDate(displayData.date);

  // 예산 관리 변수 (지출 예정 = GET /plan/user/total-amount)
  const initialBudget = Number(displayData.budget) || 1000; // 초기 예산 (만원)
  const usedBudget = totalAmountManwon ?? 0; // 지출 예정 총액 (만원)
  const remainingBudget = initialBudget - usedBudget; // 남은 예산 실시간 계산

  // 예산 사용률 계산
  const budgetUsagePercentage = Math.round((usedBudget / initialBudget) * 100);

  // 예산 사용률에 따른 그라데이션 색상 계산
  const getGradientColors = (percentage: number) => {
    // 0% = 현재 색상(기본), 100% = 진한 색상
    const t = percentage / 100; // 0 ~ 1

    // 기본 색상 (0%일 때 - 현재 색상)
    const baseStart = { h: 351, s: 100, l: 83 }; // #ffaab8
    const baseEnd = { h: 347, s: 100, l: 92 }; // #ffd8df

    // 진한 색상 (100%일 때)
    const darkStart = { h: 351, s: 100, l: 65 };
    const darkEnd = { h: 347, s: 100, l: 78 };

    // 0%에서 100%로 갈수록 명도(lightness)를 줄여서 진하게 만듦
    const startColor = `hsl(${baseStart.h}, ${baseStart.s}%, ${baseStart.l - (baseStart.l - darkStart.l) * t}%)`;
    const endColor = `hsl(${baseEnd.h}, ${baseEnd.s}%, ${baseEnd.l - (baseEnd.l - darkEnd.l) * t}%)`;

    return `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`;
  };

  const budgetGradient = getGradientColors(budgetUsagePercentage);

  // 날짜 포맷팅 함수 (YYYY년 MM월 DD일 + 요일)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = [
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일",
    ];
    const weekday = weekdays[date.getDay()];
    return {
      dateText: `${year}년 ${month}월 ${day}일`,
      weekday,
    };
  };

  // 스케줄 목록 API
  const [scheduleList, setScheduleList] = useState<ScheduleListItem[]>([]);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleInitialFetched, setScheduleInitialFetched] = useState(false);
  const scheduleLoadMoreRef = useRef<HTMLLIElement>(null);
  const scheduleFetchingRef = useRef(false);

  const fetchScheduleList = useCallback(
    async (page: number, append: boolean) => {
      if (scheduleFetchingRef.current) return;
      const token = getToken();
      if (!token) {
        setScheduleInitialFetched(true);
        return;
      }
      scheduleFetchingRef.current = true;
      setScheduleLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          count: String(SCHEDULE_PAGE_SIZE),
          sort: SCHEDULE_SORT,
          sortColumn: SCHEDULE_SORT_COLUMN,
        });
        const res = await fetchWithAuth(
          `/plan/schedule/list?${params.toString()}`,
        );
        const json = (await res.json()) as {
          result?: boolean;
          data?: { total: number; list: ScheduleListItem[] };
        };
        if (json.result === true && json.data) {
          const { total, list } = json.data;
          setScheduleTotal(total);
          if (append) {
            setScheduleList((prev) => [...prev, ...list]);
          } else {
            setScheduleList(list);
          }
        }
      } catch {
        if (!append) setScheduleList([]);
      } finally {
        setScheduleLoading(false);
        setScheduleInitialFetched(true);
        scheduleFetchingRef.current = false;
      }
    },
    [fetchWithAuth],
  );

  // 최초 로드: 토큰 있으면 1페이지 요청
  useEffect(() => {
    if (!getToken()) {
      setScheduleInitialFetched(true);
      setScheduleList([]);
      return;
    }
    fetchScheduleList(1, false);
  }, [fetchScheduleList]);

  // 무한 스크롤: 하단 감지 시 다음 페이지 (로드할 다음 페이지 = loadedPages + 1)
  const nextPageToLoad =
    scheduleList.length === 0
      ? 1
      : Math.floor(scheduleList.length / SCHEDULE_PAGE_SIZE) + 1;

  useEffect(() => {
    const sentinel = scheduleLoadMoreRef.current;
    const root = mainScrollRef.current;
    if (!sentinel || !root || !getToken()) return;
    const hasMore = scheduleList.length < scheduleTotal && scheduleTotal > 0;
    if (!hasMore || scheduleLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || scheduleFetchingRef.current) return;
        fetchScheduleList(nextPageToLoad, true);
      },
      { root, rootMargin: "100px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    scheduleList.length,
    scheduleTotal,
    scheduleLoading,
    nextPageToLoad,
    fetchScheduleList,
  ]);

  const scheduleHasMore =
    scheduleList.length < scheduleTotal && scheduleTotal > 0;

  // 각 계획의 체크 상태 관리
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [showGuestPlanLimitModal, setShowGuestPlanLimitModal] = useState(false);
  const mainScrollRef = useRef<HTMLElement>(null);
  const scrollDirection = useScrollDirection(mainScrollRef);

  // 체크박스 토글 핸들러
  const handleToggleCheck = (id: number) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleOpenScheduleDetail = (id: number) => {
    if (!getToken()) {
      setShowLoginRequiredModal(true);
      return;
    }
    router.push(`/schedule-detail?id=${id}`);
  };

  // 프로필 버튼 클릭 핸들러
  const handleUserClick = () => {
    if (getToken()) {
      setShowProfileEditModal(true);
    } else {
      setShowLoginRequiredModal(true);
    }
  };

  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <KakaoLoginAlert
        show={searchParams.get("kakao_login") === "1"}
        onSuccessFromMain={() => {
          fetchPlanUser(handleApiError);
          fetchTotalAmount(handleApiError);
          fetchScheduleList(1, false);
        }}
      />
      <main
        ref={mainScrollRef}
        className="flex h-full w-full max-w-[500px] flex-col items-center overflow-y-auto bg-[#FFF5F2] px-6"
      >
        <div className="w-full pt-8">
          {/* 상단 영역 */}
          <div className="w-full flex items-center justify-between">
            {/* 이름 + D-day 영역 (로딩 시 스켈레톤) */}
            <div className="flex flex-col items-start justify-start">
              {isPlanLoading ? (
                <>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span
                      className="skeleton-shimmer h-[42px] w-[120px] rounded-lg"
                      aria-hidden
                    />
                    <span
                      className="skeleton-shimmer h-8 w-[98px] shrink-0 rounded-full"
                      aria-hidden
                    />
                  </div>
                  <span
                    className="skeleton-shimmer mt-1.5 block h-4 w-[152px] rounded"
                    aria-hidden
                  />
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-[42px] font-semibold text-[#000000] leading-none">
                      {displayData.name || "이름"}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-4 py-1.5 text-[18px] font-semibold leading-none shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #ffaab8 0%, #ffd8df 100%)",
                        color: "#fff",
                        boxShadow: "0 2px 8px rgba(255, 170, 184, 0.35)",
                      }}
                    >
                      {dDayLabel}
                    </span>
                  </div>
                  {weddingDateText && (
                    <span className="mt-1.5 text-[13px] font-normal leading-tight text-gray-500">
                      결혼식: {weddingDateText}
                    </span>
                  )}
                </>
              )}
            </div>
            {/* 프로필 이미지 영역 (로딩 시 스켈레톤 시머) */}
            {isPlanLoading ? (
              <span
                className="skeleton-shimmer h-12 w-12 shrink-0 rounded-full"
                aria-hidden
              />
            ) : (
              <button
                type="button"
                onClick={handleUserClick}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  background:
                    "linear-gradient(135deg, #ffaab8 0%, #ffd8df 100%)",
                }}
              >
                <User className="h-6 w-6 text-white" strokeWidth={2} />
              </button>
            )}
          </div>
          {/* TodayFocus - 로딩 시 요소별 스켈레톤 */}
          <div className="mt-4 w-full">
            {isPlanLoading ? (
              <div className="flex w-full flex-col rounded-[24px] border-2 border-stone-200/50 bg-white/50 p-6">
                <div className="flex items-start gap-3">
                  <span
                    className="skeleton-shimmer h-10 w-10 shrink-0 rounded-full"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <span
                      className="skeleton-shimmer block h-5 w-20 rounded"
                      aria-hidden
                    />
                    <span
                      className="skeleton-shimmer block h-[42px] w-28 rounded"
                      aria-hidden
                    />
                  </div>
                </div>
                <span
                  className="skeleton-shimmer mt-4 block h-6 w-48 rounded"
                  aria-hidden
                />
                <div className="mt-4 flex items-center gap-2">
                  <span
                    className="skeleton-shimmer h-2 flex-1 rounded-full"
                    aria-hidden
                  />
                  <span
                    className="skeleton-shimmer h-4 w-8 shrink-0 rounded"
                    aria-hidden
                  />
                </div>
              </div>
            ) : (
              <div
                className="flex w-full flex-col rounded-[24px] p-6"
                style={{
                  background: budgetGradient,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/30">
                    <CircleDollarSign
                      className="h-5 w-5 text-white"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-5 text-white">
                      남은 예산
                    </p>
                    <p
                      className={
                        Math.abs(remainingBudget) >= 1000
                          ? "my-3 text-[32px] max-[350px]:text-[28px] font-semibold leading-7 text-white"
                          : "my-3 text-[42px] max-[350px]:text-[37px] font-semibold leading-7 text-white"
                      }
                    >
                      <span className="whitespace-nowrap">
                        <CountUp
                          to={remainingBudget}
                          separator=","
                          duration={0.1}
                          className="inline"
                        />
                        만 원
                      </span>
                    </p>
                  </div>
                </div>
                <p className="mt-1 pl-[52px] py-2 text-xl max-[350px]:text-[15px] font-semibold leading-none text-white">
                  예산 중{" "}
                  <CountUp
                    to={usedBudget}
                    separator=","
                    duration={0.1}
                    className="inline"
                  />
                  만 원 지출 예정
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/30">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${budgetUsagePercentage}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-sm font-normal leading-5 text-white">
                    {budgetUsagePercentage}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="w-full mt-8 pb-24">
          {/* 하단 영역 */}
          <div className="flex justify-between">
            <div className="flex flex-col items-start justify-start">
              <span className="text-lg font-semibold">플랜 가이드</span>
              {isPlanLoading ? (
                <span
                  className="skeleton-shimmer mt-0.5 block h-5 w-32 rounded"
                  aria-hidden
                />
              ) : (
                <span className="text-lg text-gray-500">
                  {scheduleTotal > 0
                    ? `${scheduleTotal}개의 플랜이 있어요`
                    : scheduleList.length > 0
                      ? `${scheduleList.length}개의 플랜이 있어요`
                      : "플랜을 추가해볼까요?"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (getToken()) {
                  router.push("/add-plen");
                } else {
                  setShowGuestPlanLimitModal(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-3 text-white rounded-lg font-semibold text-lg transition-colors shadow-md hover:opacity-90 active:opacity-80"
              style={{ backgroundColor: "#FFAAB8" }}
            >
              플랜 추가
              <CirclePlus className="h-5 w-5 text-white" strokeWidth={2.5} />
            </button>
          </div>
          <ul className="mt-4 w-full flex flex-col gap-3 min-h-[200px] relative">
            {scheduleLoading && scheduleList.length === 0 ? (
              ["a", "b", "c", "d", "e"].map((id) => (
                <li
                  key={`skeleton-plan-${id}`}
                  className="flex items-center gap-4 rounded-[20px] bg-white p-4"
                >
                  <span
                    className="skeleton-shimmer h-6 w-6 shrink-0 rounded-full"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <span
                      className="skeleton-shimmer block h-[22px] max-w-[200px] rounded"
                      style={{ width: "75%" }}
                      aria-hidden
                    />
                    <span
                      className="skeleton-shimmer block h-4 w-32 rounded"
                      aria-hidden
                    />
                  </div>
                  <span
                    className="skeleton-shimmer h-5 w-16 shrink-0 rounded"
                    aria-hidden
                  />
                </li>
              ))
            ) : scheduleInitialFetched && scheduleList.length === 0 ? (
              <li className="flex flex-1 flex-col items-center justify-center py-16">
                <p className="text-4xl font-semibold text-stone-400">텅~</p>
              </li>
            ) : (
              <>
                {scheduleList.map((plan) => {
                  const isChecked =
                    checkedItems.has(plan.id) || plan.status === "COMPLETED";
                  const amount = plan.amount ?? 0;
                  const categoryColor = getCategoryColor(plan.categoryName);
                  const detailHref = `/schedule-detail?id=${plan.id}`;
                  return (
                    <li
                      key={plan.id}
                      className="flex items-center gap-4 rounded-[20px] bg-white p-4"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCheck(plan.id);
                        }}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all hover:opacity-80 ${
                          isChecked
                            ? "bg-[#ffaab8] border-[#ffaab8]"
                            : "bg-white border-[#ffaab8]"
                        }`}
                      >
                        {isChecked && (
                          <Check
                            className="h-3 w-3 text-white"
                            strokeWidth={3}
                          />
                        )}
                      </button>
                      <Link
                        href={getToken() ? detailHref : "#"}
                        onClick={(e) => {
                          if (!getToken()) {
                            e.preventDefault();
                            setShowLoginRequiredModal(true);
                          }
                        }}
                        className="flex min-w-0 flex-1 items-stretch gap-4 rounded-2xl px-1 py-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FFAAB8] focus-visible:ring-offset-2"
                        aria-label={`플랜 상세 보기: ${plan.title}`}
                      >
                        <div className="flex min-w-0 flex-1 flex-col rounded-2xl px-1 py-0">
                          <span
                            className="-ml-1 inline-flex w-fit h-[22.5px] items-center rounded-xl px-2 py-0 text-[11px] max-[350px]:text-[9px] font-semibold leading-none text-stone-700"
                            style={{ backgroundColor: categoryColor }}
                          >
                            {plan.categoryName}
                          </span>
                          <p
                            className={`mt-1 text-[15px] max-[350px]:text-[10px] max-[350px]:leading-[15px] font-semibold leading-[22.5px] ${
                              isChecked ? "line-through" : ""
                            }`}
                            style={{
                              color: isChecked ? "#99a1af" : "#2D5016",
                            }}
                          >
                            {plan.title}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#6a7282]" />
                            {plan.startDate?.trim() ? (
                              (() => {
                                const { dateText, weekday } = formatDate(
                                  plan.startDate as string,
                                );
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[13px] max-[350px]:text-[8px] max-[350px]:leading-[12px] font-normal leading-[19.5px] text-[#6a7282]">
                                      {dateText}
                                    </span>
                                    <span className="text-[13px] max-[350px]:text-[8px] max-[350px]:leading-[12px] font-normal leading-[19.5px] text-[#99a1af]">
                                      ({weekday})
                                    </span>
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-[13px] max-[350px]:text-[8px] max-[350px]:leading-[12px] font-normal leading-[19.5px] text-[#6a7282]">
                                미정
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex min-w-[90px] shrink-0 items-center justify-end gap-2">
                          {amount > 0 ? (
                            <span className="text-[15px] max-[350px]:text-[10px] max-[350px]:leading-[15px] font-semibold leading-[22.5px] text-black whitespace-nowrap">
                              {amount.toLocaleString()}만 원
                            </span>
                          ) : (
                            <span className="text-[15px] max-[350px]:text-[10px] max-[350px]:leading-[15px] font-normal leading-[22.5px] text-[#99a1af] whitespace-nowrap">
                              미정
                            </span>
                          )}
                          <div
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: getDotColorByDate(
                                plan.startDate,
                              ),
                            }}
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
                {scheduleHasMore && (
                  <li ref={scheduleLoadMoreRef} className="h-4 w-full" />
                )}
                {scheduleLoading && scheduleList.length > 0 && (
                  <li className="flex justify-center py-3">
                    <span className="text-sm text-stone-400">
                      불러오는 중...
                    </span>
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      </main>
      {/* 하단 탭바 - Sticky로 최상단에 고정 */}
      <BottomTabBar
        activeTab="home"
        showLoginButton={
          !getToken() && !showGuestPlanLimitModal && !showLoginRequiredModal
        }
        onLoginClick={() => setShowLoginRequiredModal(true)}
        scrollDirection={scrollDirection}
        onTabClick={(tab) => {
          if (tab === "home") {
            // 이미 /main 페이지에 있으면 새로고침, 아니면 이동
            if (window.location.pathname === "/main") {
              router.refresh();
            } else {
              router.push("/main");
            }
          }
          // TODO: 나머지 탭들은 나중에 처리
        }}
      />
      <LoginRequiredModal
        show={showLoginRequiredModal}
        onClose={() => setShowLoginRequiredModal(false)}
      />
      <GuestPlanLimitModal
        show={showGuestPlanLimitModal}
        onClose={() => setShowGuestPlanLimitModal(false)}
        onConfirm={() => router.push("/add-plen")}
      />
      <ProfileEditModal
        show={showProfileEditModal}
        onClose={() => setShowProfileEditModal(false)}
        displayData={{
          name: displayData.name,
          date: displayData.date,
          budget: displayData.budget,
        }}
        onSaved={() => fetchPlanUser(handleApiError)}
      />
    </div>
  );
}

export default function MainPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-[#FFF5F2]" />
      }
    >
      <MainPageContent />
    </Suspense>
  );
}
