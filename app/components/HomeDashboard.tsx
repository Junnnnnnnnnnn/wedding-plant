"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { getKstDate, parseLocalDate } from "@/lib/utils";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import ActivityPanel from "./ActivityPanel";
import PlanTaskCardBody, { PlanTaskItem } from "./PlanTaskCard";

/** GET /plan/user/amount/category-chart 항목 */
interface CategoryChartItem {
  categoryName: string;
  totalAmount: number;
  usedAmount: number;
}

interface HomeDashboardProps {
  coupleName: string;
  /** "2026년 11월 14일 (토)". 날짜 미설정이면 null 이 온다 */
  weddingDateText: string | null;
  /**
   * 플랜 정보를 아직 못 받은 상태.
   *
   * 이름·날짜는 서버 렌더 시점과 클라이언트 첫 렌더 시점의 값이 다르다
   * (WeddingContext 가 sessionStorage 를 클라이언트에서만 읽는다). 그대로
   * 그리면 하이드레이션 불일치가 난다. 모바일 헤더와 같이 로딩 중에는
   * 스켈레톤을 그려 텍스트를 내보내지 않는다.
   */
  planLoading: boolean;
  dDayLabel: string;
  /** 만원 단위 */
  totalBudget: number;
  usedBudget: number;
  remainingBudget: number;
  budgetUsagePercentage: number;
  schedules: PlanTaskItem[];
  scheduleLoading: boolean;
  chatRooms: { id: number; name: string }[];
  /** 참여 방. 예산·활동 조회 범위를 정한다 */
  roomId: string | null;
  /** READ 권한이면 추가·완료를 막는다 */
  canEdit: boolean;
  onAddPlan: () => void;
  /** 완료 토글. 현재 상태를 보고 알아서 뒤집는다 */
  onToggle: (id: number) => void;
  onOpenSchedule: (id: number) => void;
  onOpenBudgetDetail: () => void;
  onOpenBoard: () => void;
}

/** 스택바에 쓰는 색. 진한 것부터 옅은 것 순으로 큰 항목에 붙인다 */
const STACK_COLORS = ["#ee2b8c", "#ff7ab5", "#ffa8cd", "#ffd0e3"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 넓은 화면(≥768)의 홈. 모바일의 스냅 두 섹션을 대신한다.
 *
 * 위에서부터 상단 바 → 이번 달 할 일 → (예산 · 다가오는 일정 · 활동/대화).
 * 예산은 넓은 패널, 일정은 타임라인, 활동·대화는 좁은 사이드로 성격을 다르게
 * 둔다 — 같은 크기 카드 세 장을 늘어놓으면 무엇이 중요한지 안 보인다.
 */
export default function HomeDashboard({
  coupleName,
  weddingDateText,
  planLoading,
  dDayLabel,
  totalBudget,
  usedBudget,
  remainingBudget,
  budgetUsagePercentage,
  schedules,
  scheduleLoading,
  chatRooms,
  roomId,
  canEdit,
  onAddPlan,
  onToggle,
  onOpenSchedule,
  onOpenBudgetDetail,
  onOpenBoard,
}: HomeDashboardProps) {
  const router = useRouter();
  const { fetchWithAuth } = useApi();
  const { getRoomUnreadCount } = useNotification();
  const [categories, setCategories] = useState<CategoryChartItem[]>([]);

  const fetchCategoryChart = useCallback(async () => {
    if (!getToken()) return;
    try {
      const url = roomId?.trim()
        ? `/plan/room/amount/category-chart/${encodeURIComponent(roomId.trim())}`
        : "/plan/user/amount/category-chart";
      const res = await fetchWithAuth(url, { skipLoading: true });
      const json = (await res.json().catch(() => null)) as {
        result?: boolean;
        data?: { list?: CategoryChartItem[] };
      } | null;
      if (json?.result === true && json.data?.list)
        setCategories(json.data.list);
    } catch {
      // 예산 패널의 부가 정보라 실패해도 화면에 오류를 띄우지 않는다
    }
  }, [fetchWithAuth, roomId]);

  useEffect(() => {
    fetchCategoryChart();
  }, [fetchCategoryChart]);

  // 렌더마다 새 Date 를 만들면 아래 useMemo 들이 매번 다시 계산된다
  const today = useMemo(() => getKstDate(), []);
  const thisMonth = monthKey(today);

  /** 이번 달 할 일 — 보드의 이번 달 컬럼과 같은 데이터다 */
  const thisMonthTasks = useMemo(
    () =>
      schedules
        .filter((s) => {
          const d = s.startDate ? parseLocalDate(s.startDate) : null;
          return d ? monthKey(d) === thisMonth : false;
        })
        .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? "")),
    [schedules, thisMonth],
  );

  /** 다가오는 일정 — 오늘 이후, 완료되지 않은 것 */
  const upcoming = useMemo(
    () =>
      schedules
        .filter((s) => {
          if (s.status === "COMPLETED") return false;
          const d = s.startDate ? parseLocalDate(s.startDate) : null;
          return d ? d.getTime() >= today.getTime() : false;
        })
        .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))
        .slice(0, 5),
    [schedules, today],
  );

  const topCategories = useMemo(
    () =>
      [...categories]
        .filter((c) => c.usedAmount > 0)
        .sort((a, b) => b.usedAmount - a.usedAmount)
        .slice(0, 4),
    [categories],
  );

  const pct = (v: number) => (totalBudget > 0 ? (v / totalBudget) * 100 : 0);

  return (
    <div className="hidden min-h-0 flex-1 flex-col bg-[#fcfbfc] md:flex">
      {/* 상단 바 */}
      <header className="flex shrink-0 items-center gap-5 border-b border-stone-100 bg-white px-8 py-5">
        {planLoading ? (
          <>
            <div className="min-w-0">
              <span
                className="skeleton-shimmer block h-[30px] w-[180px] rounded-lg"
                aria-hidden
              />
              <span
                className="skeleton-shimmer mt-2 block h-3.5 w-[152px] rounded"
                aria-hidden
              />
            </div>
            <span
              className="skeleton-shimmer ml-5 h-9 w-[92px] shrink-0 rounded-lg"
              aria-hidden
            />
          </>
        ) : (
          <>
            <div className="min-w-0">
              <h1 className="font-user-content truncate text-[26px] font-semibold leading-tight tracking-tight text-[#1b0d14]">
                {coupleName || "이름"}
              </h1>
              <p className="mt-1.5 text-[13px] text-[#7a6c74]">
                {weddingDateText ?? "결혼식 날짜를 설정해 주세요"}
              </p>
            </div>
            <div className="flex shrink-0 items-baseline gap-1.5 border-l border-stone-100 pl-5">
              <b className="font-user-content text-[36px] font-bold leading-none tracking-[-0.05em] text-[#ee2b8c]">
                {dDayLabel}
              </b>
            </div>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenBoard}
            className="h-10 rounded-[13px] border border-[#f0e3ea] bg-white px-3.5 text-[13px] text-[#6b6570] transition-colors hover:border-[#ee2b8c55] hover:text-[#ee2b8c]"
          >
            플랜 보드
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={onAddPlan}
              className="flex h-10 items-center gap-1.5 rounded-[13px] bg-[#ee2b8c] px-4 text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(238,43,140,0.75)] transition-transform hover:-translate-y-px active:scale-95"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              플랜 추가
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-6">
        {/* 이번 달 할 일 — 보드의 이번 달 컬럼을 잘라 온 자리 */}
        {(scheduleLoading || thisMonthTasks.length > 0) && (
          <section className="mb-6">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold tracking-tight text-[#1b0d14]">
                이번 달 할 일 · {today.getMonth() + 1}월
              </h2>
              <button
                type="button"
                onClick={onOpenBoard}
                className="text-[12.5px] text-[#ee2b8c] hover:underline"
              >
                보드에서 전체 보기
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {scheduleLoading
                ? [0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="skeleton-shimmer h-[92px] w-[232px] shrink-0 rounded-[20px]"
                      aria-hidden
                    />
                  ))
                : thisMonthTasks.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenSchedule(item.id)}
                      className={`w-[232px] shrink-0 rounded-[20px] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#ee2b8c22] ${
                        item.status === "COMPLETED"
                          ? "border-[#ee2b8c14] bg-[#faf8f9]"
                          : "border-[#ee2b8c14] bg-white"
                      }`}
                    >
                      <PlanTaskCardBody
                        item={item}
                        toggleDisabled={!canEdit}
                        onToggle={canEdit ? () => onToggle(item.id) : undefined}
                      />
                    </button>
                  ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1.05fr)_minmax(0,0.95fr)] [&>*]:min-w-0">
          {/* 예산 — 가장 넓고 무겁게 */}
          <section className="rounded-[28px] border border-[#ee2b8c0f] bg-white p-[26px] shadow-sm lg:row-span-2 xl:row-auto">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold tracking-tight text-[#1b0d14]">
                예산
              </h2>
              <button
                type="button"
                onClick={onOpenBudgetDetail}
                className="text-[12.5px] text-[#ee2b8c] hover:underline"
              >
                상세 분석
              </button>
            </div>

            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="font-user-content text-[36px] font-bold leading-none tracking-[-0.045em] text-[#1b0d14]">
                  {remainingBudget.toLocaleString("ko-KR")}만원
                </div>
                <div className="mt-2 text-[13px] text-gray-400">
                  {totalBudget.toLocaleString("ko-KR")}만원 중 남음
                </div>
              </div>
              <div className="shrink-0 text-right text-[13px] text-gray-400">
                지출/예정
                <br />
                <b className="font-user-content text-[16px] font-bold tracking-tight text-[#1b0d14]">
                  {usedBudget.toLocaleString("ko-KR")}만원
                </b>
              </div>
            </div>

            <div
              className="my-[18px] flex h-3 overflow-hidden rounded-full bg-[#f4eff2]"
              role="img"
              aria-label="카테고리별 지출 비중"
            >
              {topCategories.length > 0 ? (
                topCategories.map((c, i) => (
                  <i
                    key={c.categoryName}
                    className="block h-full"
                    style={{
                      width: `${pct(c.usedAmount)}%`,
                      background: STACK_COLORS[i % STACK_COLORS.length],
                    }}
                  />
                ))
              ) : (
                <i
                  className="block h-full rounded-full bg-gradient-to-r from-[#ff7ab5] to-[#ee2b8c]"
                  style={{ width: `${Math.min(100, budgetUsagePercentage)}%` }}
                />
              )}
            </div>

            {topCategories.length > 0 ? (
              <div className="grid gap-[11px]">
                {topCategories.map((c, i) => (
                  <div
                    key={c.categoryName}
                    className="flex items-center gap-2.5 text-[13px]"
                  >
                    <span
                      className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                      style={{
                        background: STACK_COLORS[i % STACK_COLORS.length],
                      }}
                    />
                    <span className="min-w-0 truncate text-[#4a3f45]">
                      {c.categoryName}
                    </span>
                    <span className="ml-auto font-user-content font-bold tracking-tight text-[#1b0d14]">
                      {c.usedAmount.toLocaleString("ko-KR")}만원
                    </span>
                    <span className="w-10 text-right text-[12px] text-gray-400">
                      {pct(c.usedAmount).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-[#7a6c74]">
                아직 지출로 잡힌 항목이 없어요.
              </p>
            )}

            <div className="mt-5 flex items-center gap-3 border-t border-dashed border-[#f2eaee] pt-[18px]">
              <p className="m-0 flex-1 text-[12.5px] leading-relaxed text-[#7a6c74] break-keep">
                전체 예산의{" "}
                <b className="text-[#1b0d14]">{budgetUsagePercentage}%</b>를
                쓰고 있어요.
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={onAddPlan}
                  className="h-9 shrink-0 rounded-xl border border-[#f0e3ea] bg-white px-3.5 text-[12.5px] text-[#6b6570] transition-colors hover:border-[#ee2b8c55] hover:text-[#ee2b8c]"
                >
                  지출 추가
                </button>
              )}
            </div>
          </section>

          {/* 다가오는 일정 — 카드가 아니라 선 위의 마커 */}
          <section className="rounded-[28px] border border-[#ee2b8c0f] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold tracking-tight text-[#1b0d14]">
                다가오는 일정
              </h2>
              <button
                type="button"
                onClick={onOpenBoard}
                className="text-[12.5px] text-[#ee2b8c] hover:underline"
              >
                캘린더
              </button>
            </div>

            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-gray-400">
                예정된 일정이 없어요.
              </p>
            ) : (
              <div className="relative pl-[26px] before:absolute before:bottom-2.5 before:left-[5px] before:top-1.5 before:w-0.5 before:bg-gradient-to-b before:from-[#ffd0e3] before:to-[#f4eff2] before:content-['']">
                {upcoming.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenSchedule(item.id)}
                    className={`relative block w-full text-left ${i === upcoming.length - 1 ? "pb-0" : "pb-[22px]"}`}
                  >
                    <span
                      className={`absolute left-[-25px] top-1.5 h-3 w-3 rounded-full border-[2.5px] bg-white ${
                        i === 0
                          ? "border-[#ee2b8c] shadow-[0_0_0_4px_#ee2b8c1f]"
                          : "border-[#ffc4dd]"
                      }`}
                      aria-hidden
                    />
                    <span
                      className={`block text-[11.5px] ${i === 0 ? "font-bold text-[#ee2b8c]" : "text-gray-400"}`}
                    >
                      {item.startDate
                        ? (() => {
                            const d = parseLocalDate(item.startDate);
                            return d
                              ? `${d.getMonth() + 1}월 ${d.getDate()}일`
                              : "";
                          })()
                        : ""}
                    </span>
                    <span className="mt-0.5 block text-[15px] font-bold tracking-tight text-[#1b0d14]">
                      {item.title}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#7a6c74]">
                      {item.categoryName && (
                        <span className="rounded-full bg-[#fff2f6] px-2 py-0.5 text-[11px] text-[#ee2b8c]">
                          {item.categoryName}
                        </span>
                      )}
                      {item.amount ? (
                        <span className="font-user-content font-bold tracking-tight text-[#1b0d14]">
                          {item.amount.toLocaleString("ko-KR")}만원
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 사이드 — 활동 + 대화 */}
          <div className="grid content-start gap-[22px] [&>*]:min-w-0">
            <ActivityPanel roomId={roomId} inDashboard />

            {chatRooms.length > 0 && (
              <section className="rounded-[28px] border border-[#ee2b8c0f] bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-bold tracking-tight text-[#1b0d14]">
                    대화
                  </h2>
                  <button
                    type="button"
                    onClick={() => router.push("/plan-list")}
                    className="text-[12.5px] text-[#ee2b8c] hover:underline"
                  >
                    전체
                  </button>
                </div>
                <div className="grid gap-1 [&>*]:min-w-0">
                  {chatRooms.map((room) => {
                    const unread = getRoomUnreadCount(room.id);
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() =>
                          router.push(`/plan-list?chat=${room.id}`)
                        }
                        className="flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[#faf7f9]"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ee2b8c0a] text-[#ee2b8c]">
                          <MessageCircle className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold tracking-tight text-[#1b0d14]">
                          {room.name}
                        </span>
                        {unread > 0 && (
                          <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#ee2b8c] px-1 text-[10px] font-bold leading-none text-white">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
