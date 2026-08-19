"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { ArrowLeft, Sparkles, CircleHelp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import GuideOverlay, { GuideStep } from "../components/GuideOverlay";

import { useApi } from "../contexts/ApiContext";
import { getToken } from "@/lib/api";
import { getGuestScheduleList } from "@/lib/guestSchedule";
import { useWedding } from "../contexts/WeddingContext";
import LoginRequiredModal from "../components/LoginRequiredModal";
import { Expense, ExpenseStatus, BudgetStats, Category } from "./types";
import StatCard from "./components/StatCard";
import SpendingAnalysis from "./components/SpendingAnalysis";
import ExpenseList from "./components/ExpenseList";
import BottomTabBar from "../components/BottomTabBar";
import { useNotification } from "../contexts/NotificationContext";

const SCHEDULE_FETCH_COUNT = 10000;
const SCHEDULE_SORT = "DESC";
const SCHEDULE_SORT_COLUMN = "startDate";

/** GET /plan/user/amount/detail 응답 */
interface AmountDetailData {
  initialCapital: number;
  totalPlannedAndUsedAmount: number;
  plannedUseAmount: number;
  usedAmount: number;
}

/** GET /plan/user/amount/category-chart 리스트 항목 */
interface CategoryChartItem {
  categoryName: string;
  totalAmount: number;
  usedAmount: number;
}

/** GET /plan/schedule/list 리스트 항목 */
interface ScheduleListItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  status?: string | null;
}

const AI_PREP_TITLE = "AI 서비스 준비중이예요!";
const AI_PREP_SUBTITLE = "조금만 기다려 주세요 🙇‍♂️";

function AIInsightsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  const baseBtnClass =
    "w-full rounded-full text-sm font-semibold h-11 flex items-center justify-center transition-transform hover:scale-[1.01] active:scale-[0.99]";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-modal="true"
        aria-label={AI_PREP_TITLE}
      >
        <h2 className="text-center text-lg font-semibold text-stone-900">
          {AI_PREP_TITLE}
        </h2>
        <p className="mt-3 text-center text-[15px] font-normal leading-relaxed text-stone-700">
          {AI_PREP_SUBTITLE}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`${baseBtnClass} border-2 border-stone-300 bg-white text-stone-700`}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function mapCategoryListToExpenses(list: CategoryChartItem[]): Expense[] {
  return list.map((item, index) => ({
    id: String(index + 1),
    title: item.categoryName,
    description: item.categoryName,
    amount: item.usedAmount,
    plannedAmount: item.totalAmount,
    status: item.usedAmount > 0 ? ExpenseStatus.PAID : ExpenseStatus.PLANNED,
    category: item.categoryName,
  }));
}

function mapScheduleListToExpenses(list: ScheduleListItem[]): Expense[] {
  return list.map((item) => ({
    id: String(item.id),
    title: item.title,
    description: item.categoryName,
    amount: item.status === "COMPLETED" ? (item.amount ?? 0) : 0,
    plannedAmount: item.amount ?? 0,
    status:
      item.status === "COMPLETED" ? ExpenseStatus.PAID : ExpenseStatus.PLANNED,
    category: item.categoryName,
  }));
}

function BudgetDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomIdFromUrl = searchParams.get("roomId")?.trim() || null;
  const { fetchWithAuth, setLoading } = useApi();
  const { subscribeToChatRooms, unreadCount } = useNotification();
  const { weddingData } = useWedding();
  const isGuest = !getToken();
  const guestBlurClass = isGuest ? "blur-sm opacity-60" : "";
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);

  const [detailData, setDetailData] = useState<AmountDetailData | null>(null);
  const [categoryList, setCategoryList] = useState<CategoryChartItem[]>([]);
  const [scheduleList, setScheduleList] = useState<ScheduleListItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const scheduleFetchingRef = useRef(false);
  /**
   * 마지막으로 조회한 필터. 탭·카테고리가 실제로 바뀌었을 때만 다시 받는다.
   *
   * 예전에는 필터 effect 의 의존성에 detailData 와 (fetchScheduleAll 을 통해)
   * roomId 가 물려 있어서, 진입 시 loadData 가 이 둘을 세팅하는 순간
   * effect 가 다시 돌아 count=10000 목록을 한 번 더 받아 왔다.
   */
  const lastFilterKeyRef = useRef<string | null>(null);
  /** 필터 조합별 목록 캐시. 탭을 오갈 때마다 전량을 다시 받지 않는다. */
  const scheduleCacheRef = useRef(new Map<string, ScheduleListItem[]>());

  const [activeTab, setActiveTab] = useState<"예정" | "사용">("예정");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Guide State. 로그인 시: GET /plan/user 응답으로만 설정·참조( localStorage 미참조 )
  const [hasSeenBudgetGuide, setHasSeenBudgetGuide] = useState<boolean | null>(
    null,
  );
  const [showGuide, setShowGuide] = useState(false);

  // 가이드 표시: 로그인 시 GET /plan/user 응답만 사용( localStorage 참조 금지 ), 비로그인 시에만 localStorage
  useEffect(() => {
    if (getToken()) {
      // 로그인: API 응답(hasSeenBudgetGuide)으로만 판단
      if (hasSeenBudgetGuide !== false) return;
    } else {
      if (typeof window === "undefined") return;
      if (localStorage.getItem("hasSeenBudgetGuide") === "true") return;
    }
    const timer = setTimeout(() => setShowGuide(true), 1000);
    return () => clearTimeout(timer);
  }, [hasSeenBudgetGuide]);

  const handleCloseGuide = useCallback(async () => {
    setShowGuide(false);
    setHasSeenBudgetGuide(true);
    if (getToken()) {
      try {
        await fetchWithAuth("/plan/user/has-seen-budget-guide", {
          method: "POST",
          skipLoading: true,
        });
      } catch {
        // 무시
      }
    } else if (typeof window !== "undefined")
      localStorage.setItem("hasSeenBudgetGuide", "true");
  }, [fetchWithAuth]);

  const guideSteps: GuideStep[] = [
    {
      id: "budget-stat-grid",
      title: "예산 현황",
      description: "초기 자본과 지출 예정/사용 금액을 한눈에 비교해보세요.",
    },
    {
      id: "budget-ai-insight",
      title: "AI 조언",
      description: "현재 예산 사용 패턴을 분석해 AI가 조언해드립니다.",
    },
    {
      id: "budget-analysis",
      title: "지출 분석",
      description: "카테고리별 예산 비중과 지출 현황을 그래프로 확인하세요.",
    },
    {
      id: "budget-tab",
      title: "상태별 필터",
      description: "지출 예정인 항목과 실제 사용한 항목을 나누어 볼 수 있어요.",
    },
  ];

  /** 스케줄 목록 API 쿼리: 그래프 클릭 시 categoryName 전달 */
  const buildScheduleParams = useCallback(
    (
      page: number,
      statusFilter: "예정" | "사용",
      category: Category | null,
    ) => {
      const params = new URLSearchParams({
        page: String(page),
        count: String(SCHEDULE_FETCH_COUNT),
        sort: SCHEDULE_SORT,
        sortColumn: SCHEDULE_SORT_COLUMN,
      });
      if (statusFilter === "예정") params.set("status", "NORMAL");
      else params.set("status", "COMPLETED");
      if (category) params.set("categoryName", category);
      return params;
    },
    [],
  );

  /** 스케줄 목록 count=10000으로 전체 요청 (탭/카테고리 변경 시 사용) */
  const fetchScheduleAll = useCallback(async () => {
    if (!getToken() || scheduleFetchingRef.current) return;
    const cacheKey = `${roomId ?? ""}|${activeTab}|${selectedCategory ?? ""}`;
    const cached = scheduleCacheRef.current.get(cacheKey);
    if (cached) {
      setScheduleList(cached);
      return;
    }
    scheduleFetchingRef.current = true;
    try {
      const params = buildScheduleParams(1, activeTab, selectedCategory);
      const url = roomId
        ? `/plan/schedule/room/${encodeURIComponent(roomId)}/list?${params.toString()}`
        : `/plan/schedule/list?${params.toString()}`;
      const res = await fetchWithAuth(url, { skipLoading: true });
      const json = (await res.json()) as {
        result?: boolean;
        data?: { list?: ScheduleListItem[] } & Record<string, unknown>;
      };
      if (res.ok && json.result === true && json.data) {
        const list = json.data.list ?? [];
        scheduleCacheRef.current.set(cacheKey, list);
        setScheduleList(list);
      } else {
        setScheduleList([]);
      }
    } finally {
      scheduleFetchingRef.current = false;
    }
  }, [fetchWithAuth, buildScheduleParams, activeTab, selectedCategory, roomId]);

  const loadData = useCallback(async () => {
    if (!getToken()) {
      const guestList = getGuestScheduleList().map((p) => ({
        id: p.id,
        categoryName: p.categoryName,
        title: p.title,
        amount: p.amount ?? 0,
        startDate: p.startDate,
        status: p.status ?? "NORMAL",
      })) as ScheduleListItem[];

      const initialCapital = Number(weddingData.budget) || 1000;
      const plannedUseAmount = guestList
        .filter((x) => x.status !== "COMPLETED")
        .reduce((sum, x) => sum + (x.amount ?? 0), 0);
      const usedAmount = guestList
        .filter((x) => x.status === "COMPLETED")
        .reduce((sum, x) => sum + (x.amount ?? 0), 0);

      const byCategory = new Map<string, { total: number; used: number }>();

      guestList.forEach((item) => {
        const key = item.categoryName || "Others";
        const prev = byCategory.get(key) ?? { total: 0, used: 0 };
        const amt = item.amount ?? 0;
        prev.total += amt;

        if (item.status === "COMPLETED") prev.used += amt;
        byCategory.set(key, prev);
      });

      setDetailData({
        initialCapital,
        totalPlannedAndUsedAmount: plannedUseAmount + usedAmount,
        plannedUseAmount,
        usedAmount,
      });
      setCategoryList(
        Array.from(byCategory.entries()).map(([categoryName, v]) => ({
          categoryName,
          totalAmount: v.total,
          usedAmount: v.used,
        })),
      );
      setScheduleList(guestList);
      setDetailLoading(false);
      setError(null);
      return;
    }
    setDetailLoading(true);
    setError(null);
    try {
      const scheduleParams = buildScheduleParams(1, "예정", null);
      // 새로 불러오는 것이므로 이전 캐시는 버린다
      scheduleCacheRef.current.clear();

      // 비로그인에서 가이드 본 뒤 로그인: POST has-seen 두 개 먼저 호출 후 GET /plan/user
      const seenMain =
        typeof window !== "undefined" &&
        localStorage.getItem("hasSeenMainGuide") === "true";
      const seenBudget =
        typeof window !== "undefined" &&
        localStorage.getItem("hasSeenBudgetGuide") === "true";
      if (seenMain || seenBudget) {
        try {
          await fetchWithAuth("/plan/user/has-seen-main-guide", {
            method: "POST",
            skipLoading: true,
          });
          await fetchWithAuth("/plan/user/has-seen-budget-guide", {
            method: "POST",
            skipLoading: true,
          });
          if (typeof window !== "undefined") {
            localStorage.removeItem("hasSeenMainGuide");
            localStorage.removeItem("hasSeenBudgetGuide");
            sessionStorage.removeItem("hasSeenMainGuide");
            sessionStorage.removeItem("hasSeenBudgetGuide");
          }
        } catch {
          // 무시
        }
      }

      // roomId: URL 쿼리 우선, 없으면 /plan/user 응답의 roomId 사용
      const userRes = await fetchWithAuth("/plan/user", { skipLoading: true });
      const userJson = (await userRes.json().catch(() => null)) as {
        result?: boolean;
        data?: {
          roomId?: number | null;
          hasSeenBudgetGuide?: boolean;
          chatRooms?: { id: number }[];
        };
      } | null;

      setHasSeenBudgetGuide(
        userJson?.result && userJson.data
          ? (userJson.data.hasSeenBudgetGuide ?? true)
          : true,
      );

      const currentRoomId =
        roomIdFromUrl ??
        (userJson?.result && userJson.data?.roomId
          ? String(userJson.data.roomId)
          : null);
      setRoomId(currentRoomId);

      const scheduleUrl = currentRoomId
        ? `/plan/schedule/room/${encodeURIComponent(currentRoomId)}/list?${scheduleParams.toString()}`
        : `/plan/schedule/list?${scheduleParams.toString()}`;

      const amountDetailUrl = currentRoomId
        ? `/plan/room/amount/detail/${encodeURIComponent(currentRoomId)}`
        : "/plan/user/amount/detail";
      const categoryChartUrl = currentRoomId
        ? `/plan/room/amount/category-chart/${encodeURIComponent(currentRoomId)}`
        : "/plan/user/amount/category-chart";

      const [detailRes, chartRes, scheduleRes] = await Promise.all([
        fetchWithAuth(amountDetailUrl, { skipLoading: true }),
        fetchWithAuth(categoryChartUrl, { skipLoading: true }),
        fetchWithAuth(scheduleUrl, { skipLoading: true }),
      ]);
      const detailJson = (await detailRes.json().catch(() => null)) as {
        result?: boolean;
        data?: AmountDetailData;
      } | null;
      const chartJson = (await chartRes.json().catch(() => null)) as {
        result?: boolean;
        data?: { list?: CategoryChartItem[] };
      } | null;
      const scheduleJson = (await scheduleRes.json().catch(() => null)) as {
        result?: boolean;
        data?: { list?: ScheduleListItem[] } & Record<string, unknown>;
      } | null;

      if (detailRes.ok && detailJson?.result && detailJson.data) {
        setDetailData(detailJson.data);
      } else {
        setDetailData(null);
      }

      // SSE Subscription for the user's chat rooms
      if (
        userJson?.result &&
        userJson.data?.chatRooms &&
        userJson.data.chatRooms.length > 0
      ) {
        const roomIds = userJson.data.chatRooms.map(
          (r: { id: number }) => r.id,
        );
        subscribeToChatRooms(roomIds);
      }

      if (chartRes.ok && chartJson?.result && chartJson.data?.list) {
        setCategoryList(chartJson.data.list);
      } else {
        setCategoryList([]);
      }
      if (scheduleRes.ok && scheduleJson?.result && scheduleJson.data) {
        const list = scheduleJson.data.list ?? [];
        // 이 응답은 "예정 / 전체 카테고리" 조합이다. 그 키로 캐시해 두면
        // 다른 탭에 갔다가 돌아올 때 다시 받지 않는다.
        scheduleCacheRef.current.set(`${currentRoomId ?? ""}|예정|`, list);
        setScheduleList(list);
      } else {
        setScheduleList([]);
      }
    } catch {
      setError("데이터를 불러오지 못했습니다.");
      setDetailData(null);
      setCategoryList([]);
      setScheduleList([]);
    } finally {
      setDetailLoading(false);
    }
  }, [
    fetchWithAuth,
    buildScheduleParams,
    roomIdFromUrl,
    weddingData.budget,
    subscribeToChatRooms,
  ]);

  useEffect(() => {
    // Disable global loading modal for budget-detail to show skeleton instead
    setLoading(false);
    loadData();
  }, [loadData, setLoading]);

  /** 탭 또는 카테고리 변경 시 count=10000으로 전체 다시 로드 */
  useEffect(() => {
    if (!detailData) return;
    const filterKey = `${activeTab}|${selectedCategory ?? ""}`;
    if (lastFilterKeyRef.current === null) {
      // 최초 진입분은 loadData 가 이미 받아 왔다
      lastFilterKeyRef.current = filterKey;
      return;
    }
    if (lastFilterKeyRef.current === filterKey) return;
    lastFilterKeyRef.current = filterKey;
    if (!getToken()) {
      const guestList = getGuestScheduleList().map((p) => ({
        id: p.id,
        categoryName: p.categoryName,
        title: p.title,
        amount: p.amount ?? 0,
        startDate: p.startDate,
        status: p.status ?? "NORMAL",
      })) as ScheduleListItem[];
      const filtered = guestList.filter((x) => {
        if (activeTab === "예정" && x.status === "COMPLETED") return false;
        if (activeTab === "사용" && x.status !== "COMPLETED") return false;
        if (selectedCategory && x.categoryName !== selectedCategory)
          return false;
        return true;
      });
      setScheduleList(filtered);
      return;
    }
    fetchScheduleAll();
  }, [activeTab, selectedCategory, fetchScheduleAll, detailData]);

  const expensesForAnalysis: Expense[] = useMemo(
    () => mapCategoryListToExpenses(categoryList),
    [categoryList],
  );
  const listExpenses: Expense[] = useMemo(
    () => mapScheduleListToExpenses(scheduleList),
    [scheduleList],
  );

  const stats: BudgetStats | null = useMemo(() => {
    if (!detailData) return null;
    return {
      initialCapital: detailData.initialCapital,
      plannedTotal: detailData.plannedUseAmount,
      usedTotal: detailData.usedAmount,
    };
  }, [detailData]);

  /* API가 status, categoryName으로 필터링하므로 클라이언트 필터 제거 */

  const remainingAmount = stats
    ? stats.initialCapital - (stats.plannedTotal + stats.usedTotal)
    : undefined;

  const handleCategoryToggle = (category: Category) => {
    setSelectedCategory((prev) => (prev === category ? null : category));
  };

  return (
    <div className="h-[100dvh] bg-[#fcfbfc] overflow-hidden">
      <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />
      <div className="h-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col grid-bg z-10">
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-smooth min-h-0">
          <div className="flex justify-between items-center px-6 py-3 shrink-0">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-[#ee2b8c] hover:bg-[#ee2b8c11] px-3 py-1.5 rounded-full transition-colors w-fit backdrop-blur-sm bg-white/30 shadow-sm"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-bold">뒤로가기</span>
            </button>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="flex h-10 w-10 items-center justify-center text-stone-400 hover:text-stone-600 transition-colors backdrop-blur-sm bg-white/30 rounded-full"
              aria-label="가이드 보기"
            >
              <CircleHelp className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>
          <div className="pt-0 pb-32">
            {detailLoading ? (
              <div className="px-4 py-4 space-y-6 animate-pulse">
                {/* Stats Skeleton */}
                <div className="space-y-3">
                  <div className="w-full h-32 bg-stone-50 rounded-[24px]" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-24 bg-stone-50 rounded-[20px]" />
                    <div className="h-24 bg-stone-50 rounded-[20px]" />
                  </div>
                </div>

                {/* AI Button Skeleton */}
                <div className="h-14 bg-stone-50 rounded-2xl" />

                {/* Analysis Skeleton */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="w-24 h-6 bg-stone-50 rounded" />
                  </div>
                  <div className="h-48 bg-stone-50 rounded-3xl" />
                </div>

                {/* Tabs Skeleton */}
                <div className="flex border-b border-gray-100">
                  <div className="flex-1 h-12 bg-stone-50/50" />
                  <div className="flex-1 h-12 bg-stone-50/50" />
                </div>

                {/* List Skeleton */}
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-20 bg-stone-50 rounded-2xl mx-2"
                    />
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[#ee2b8c] font-semibold">{error}</p>
                <button
                  type="button"
                  onClick={() => loadData()}
                  className="mt-4 px-4 py-2 bg-[#ee2b8c] text-white rounded-xl font-bold text-sm"
                >
                  다시 시도
                </button>
              </div>
            ) : stats ? (
              <>
                {/* Prominent Stats Grid */}
                <div id="budget-stat-grid" className="px-4 py-4 space-y-3">
                  <div className="w-full">
                    <StatCard
                      label="초기 자본"
                      value={stats.initialCapital}
                      variant="white"
                      size="large"
                      remainingAmount={remainingAmount}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      label="예정"
                      value={stats.plannedTotal}
                      variant="pink-light"
                    />
                    <StatCard
                      label="사용"
                      value={stats.usedTotal}
                      variant="pink-solid"
                    />
                  </div>
                </div>

                {/* AI Insight Trigger */}
                <div id="budget-ai-insight" className="px-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAIModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-purple-500 to-[#ee2b8c] text-white rounded-2xl font-bold shadow-lg shadow-[#ee2b8c22] hover:opacity-95 transition-all transform active:scale-[0.98]"
                  >
                    <Sparkles className="w-5 h-5" />
                    AI에게 예산 조언 받기
                  </button>
                </div>

                {/* Spending Analysis Section */}
                <div className="relative">
                  <div
                    className={
                      isGuest
                        ? `pointer-events-none select-none ${guestBlurClass}`
                        : ""
                    }
                  >
                    {/* Spending Analysis Section */}
                    <div id="budget-analysis" className="px-4 mt-8">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-[#1b0d14]">
                          지출 분석
                        </h2>
                        {selectedCategory && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategory(null)}
                            className="text-[10px] font-extrabold text-[#ee2b8c] uppercase tracking-widest bg-[#ee2b8c11] px-3 py-1 rounded-full"
                          >
                            필터 해제
                          </button>
                        )}
                      </div>
                      <SpendingAnalysis
                        stats={stats}
                        expenses={expensesForAnalysis}
                        selectedCategory={selectedCategory}
                        onCategorySelect={handleCategoryToggle}
                      />
                    </div>

                    {/* Tabs */}
                    <div id="budget-tab" className="px-4 mt-8">
                      <div className="flex border-b border-gray-100">
                        {(["예정", "사용"] as const).map((tab) => (
                          <button
                            type="button"
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${
                              activeTab === tab
                                ? "text-[#ee2b8c] border-[#ee2b8c]"
                                : "text-gray-400 border-transparent hover:text-gray-600"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Expense List: count=10000으로 전체 한 번에 로드 */}
                    <div id="budget-list" className="mt-4">
                      <ExpenseList expenses={listExpenses} />
                    </div>
                  </div>

                  {isGuest && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setShowLoginRequiredModal(true)}
                        className="rounded-2xl bg-white/70 px-6 py-3 text-sm font-bold text-stone-700 shadow-sm backdrop-blur transition-transform hover:scale-[1.01] active:scale-[0.99]"
                      >
                        로그인이 필요한 서비스 입니다
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-gray-500 font-medium">데이터가 없습니다.</p>
              </div>
            )}
          </div>
        </main>

        <AIInsightsModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
        />
        <LoginRequiredModal
          show={showLoginRequiredModal}
          onClose={() => setShowLoginRequiredModal(false)}
        />

        <BottomTabBar showLoginButton={false} unreadCount={unreadCount} />
        <GuideOverlay
          isOpen={showGuide}
          onClose={handleCloseGuide}
          steps={guideSteps}
        />
      </div>
    </div>
  );
}

export default function BudgetDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fcfbfc]" />
      }
    >
      <BudgetDetailsPage />
    </Suspense>
  );
}
