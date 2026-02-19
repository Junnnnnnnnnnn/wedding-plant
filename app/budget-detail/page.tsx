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
  const { fetchWithAuth } = useApi();
  const { weddingData } = useWedding();
  const isGuest = !getToken();
  const guestBlurClass = isGuest ? "blur-sm opacity-60" : "";
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);

  const [detailData, setDetailData] = useState<AmountDetailData | null>(null);
  const [categoryList, setCategoryList] = useState<CategoryChartItem[]>([]);
  const [scheduleList, setScheduleList] = useState<ScheduleListItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const scheduleFetchingRef = useRef(false);
  const isFirstFilterRun = useRef(true);

  const [activeTab, setActiveTab] = useState<"예정" | "사용">("예정");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Guide State
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenBudgetGuide");
    if (!hasSeen) {
      const timer = setTimeout(() => setShowGuide(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCloseGuide = () => {
    setShowGuide(false);
    localStorage.setItem("hasSeenBudgetGuide", "true");
  };

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
    scheduleFetchingRef.current = true;
    setScheduleLoading(true);
    try {
      const params = buildScheduleParams(1, activeTab, selectedCategory);
      const url = roomId
        ? `/plan/schedule/room/${encodeURIComponent(roomId)}/list?${params.toString()}`
        : `/plan/schedule/list?${params.toString()}`;
      const res = await fetchWithAuth(url);
      const json = (await res.json()) as {
        result?: boolean;
        data?: { list?: ScheduleListItem[] } & Record<string, unknown>;
      };
      if (res.ok && json.result === true && json.data) {
        const list = json.data.list ?? [];
        setScheduleList(list);
      } else {
        setScheduleList([]);
      }
    } finally {
      setScheduleLoading(false);
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
      for (const item of guestList) {
        const key = item.categoryName || "Others";
        const prev = byCategory.get(key) ?? { total: 0, used: 0 };
        const amt = item.amount ?? 0;
        prev.total += amt;
        if (item.status === "COMPLETED") prev.used += amt;
        byCategory.set(key, prev);
      }

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
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const scheduleParams = buildScheduleParams(1, "예정", null);

      // roomId: URL 쿼리 우선, 없으면 /plan/user 응답의 roomId 사용
      const userRes = await fetchWithAuth("/plan/user");
      const userJson = (await userRes.json().catch(() => null)) as {
        result?: boolean;
        data?: { roomId?: number | null };
      } | null;

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
        fetchWithAuth(amountDetailUrl),
        fetchWithAuth(categoryChartUrl),
        fetchWithAuth(scheduleUrl),
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
      if (chartRes.ok && chartJson?.result && chartJson.data?.list) {
        setCategoryList(chartJson.data.list);
      } else {
        setCategoryList([]);
      }
      if (scheduleRes.ok && scheduleJson?.result && scheduleJson.data) {
        const list = scheduleJson.data.list ?? [];
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
      setLoading(false);
    }
  }, [fetchWithAuth, buildScheduleParams, roomIdFromUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 탭 또는 카테고리 변경 시 count=10000으로 전체 다시 로드 */
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    if (!detailData) return;
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
          {loading ? (
            <div className="px-4 py-6 flex flex-col items-center justify-center min-h-[200px]">
              <div
                className="w-10 h-10 border-2 border-[#ee2b8c] border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
              <p className="mt-4 text-gray-500 font-medium">불러오는 중...</p>
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
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === tab
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

        <BottomTabBar showLoginButton={false} />
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
