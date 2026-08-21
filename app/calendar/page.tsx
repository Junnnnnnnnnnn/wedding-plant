"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { ChevronLeft, ChevronRight, Plus, Check, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import CustomAlertModal from "../components/CustomAlertModal";
import AddPlanView from "../add-plen/AddPlanView";
import ScheduleDetailView from "../schedule-detail/ScheduleDetailView";
import PlanBoard, { BoardItem } from "./PlanBoard";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import { useIsDesktop, useIsTabletUp } from "../hooks/useMediaQuery";
import { getToken, getPlanUserIdFromToken } from "@/lib/api";
import { formatKoreanTime, parseLocalDate, getKstDate } from "@/lib/utils";
import { getGuestScheduleList } from "@/lib/guestSchedule";

interface ScheduleListItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  startTime?: string | null;
  status?: string | null;
}

/**
 * GET /plan/schedule/calendar 응답의 day별 list 항목.
 * status·categoryName·amount 까지 내려온다 — 완료한 일정이 언제 얼마짜리였는지
 * 달력에서 바로 보여야 하기 때문이다. 구버전 응답도 견디도록 선택 필드로 둔다.
 */
interface CalendarPlanItem {
  id: number;
  title: string;
  categoryName?: string | null;
  amount?: number | null;
  startTime?: string | null;
  status?: string | null;
}

function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");
  const { fetchWithAuth } = useApi();
  const { unreadCount } = useNotification();
  const [currentDate, setCurrentDate] = useState(getKstDate());
  /**
   * roomId 모드에서 내 권한. READ 면 플랜 추가 버튼을 감춘다.
   * /main 은 이미 같은 판단을 하는데 캘린더에만 빠져 있어서, 읽기 전용
   * 참여자에게도 "+" 가 보이고 눌러야만 실패를 알 수 있었다.
   */
  const [myRoomPermission, setMyRoomPermission] = useState<string | null>(null);
  /** API /plan/schedule/calendar 응답: day(YYYY-MM-DD) → 플랜 목록 */
  const [calendarData, setCalendarData] = useState<
    Record<string, CalendarPlanItem[]>
  >({});
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateLabel, setSelectedDateLabel] = useState("");
  const [selectedDayPlans, setSelectedDayPlans] = useState<ScheduleListItem[]>(
    [],
  );
  const [selectedDateParams, setSelectedDateParams] = useState({
    day: 0,
    month: 0,
    year: 0,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  /** 늦게 도착한 이전 달 응답이 최신 화면을 덮어쓰지 않도록 요청 순번을 센다 */
  const fetchSeqRef = useRef(0);

  const fetchSchedules = useCallback(async () => {
    const seq = fetchSeqRef.current + 1;
    fetchSeqRef.current = seq;

    const token = getToken();
    if (!token) {
      const guestList = getGuestScheduleList();
      const byDay: Record<string, CalendarPlanItem[]> = {};
      guestList.forEach((s) => {
        if (!s.startDate) return;
        const d = parseLocalDate(s.startDate);
        if (!d) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!byDay[key]) byDay[key] = [];
        // status를 버리면 완료 표시가 절대 뜨지 않는다. 그대로 실어 보낸다.
        byDay[key].push({
          id: s.id,
          title: s.title,
          categoryName: s.categoryName,
          amount: s.amount,
          startTime: s.startTime ?? null,
          status: s.status,
        });
      });
      setCalendarData(byDay);
      return;
    }

    // 달력 격자는 42칸이라 앞뒤 달의 날짜도 함께 보여준다.
    // 현재 달만 요청하면 그 칸들이 항상 비어 보이므로 앞뒤 달까지 받아 병합한다.
    const targets = [
      { y: year, m: month - 1 },
      { y: year, m: month },
      { y: year, m: month + 1 },
    ].map(({ y, m }) => {
      const d = new Date(y, m, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

    try {
      const responses = await Promise.all(
        targets.map(async (t) => {
          const params = new URLSearchParams({
            month: String(t.month + 1),
            year: String(t.year),
          });
          if (roomId?.trim()) params.set("roomId", roomId.trim());
          try {
            const res = await fetchWithAuth(
              `/plan/schedule/calendar?${params.toString()}`,
              { skipLoading: true },
            );
            return await res.json();
          } catch {
            return null;
          }
        }),
      );

      if (fetchSeqRef.current !== seq) return; // 더 최신 요청이 있으면 버린다

      const byDay: Record<string, CalendarPlanItem[]> = {};
      responses.forEach((json) => {
        if (!json || json.result !== true || !json.data?.list) return;
        (
          json.data.list as {
            day: string;
            list: CalendarPlanItem[];
          }[]
        ).forEach((item) => {
          if (item?.day && Array.isArray(item.list)) {
            byDay[item.day] = item.list;
          }
        });
      });
      setCalendarData(byDay);
    } catch (error) {
      if (fetchSeqRef.current !== seq) return;
      console.error("Failed to fetch schedules:", error);
      setCalendarData({});
    }
  }, [fetchWithAuth, roomId, year, month]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    const room = roomId?.trim();
    if (!room || !getToken()) {
      setMyRoomPermission(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(
          `/plan/room/${encodeURIComponent(room)}`,
          { skipLoading: true },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          result?: boolean;
          data?: { members?: { planUserId?: string; permission?: string }[] };
        };
        if (cancelled || json.result !== true) return;
        const myId = String(getPlanUserIdFromToken() ?? "").trim();
        const me = json.data?.members?.find(
          (m) => String(m.planUserId ?? "").trim() === myId,
        );
        setMyRoomPermission(
          me?.permission ? me.permission.toUpperCase() : null,
        );
      } catch {
        // 권한 조회 실패 시엔 기존처럼 버튼을 보여 준다(서버가 최종 판단)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, roomId]);

  const daysInMonth = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    const days = [];
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i -= 1) {
      days.push({
        day: prevMonthLastDay - i,
        month: month - 1,
        year,
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let i = 1; i <= lastDay; i += 1) {
      days.push({
        day: i,
        month,
        year,
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i += 1) {
      days.push({
        day: i,
        month: month + 1,
        year,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  const getSchedulesForDay = (
    day: number,
    m: number,
    y: number,
  ): ScheduleListItem[] => {
    let targetYear = y;
    let targetMonth = m;
    if (m === -1) {
      targetMonth = 11;
      targetYear -= 1;
    } else if (m === 12) {
      targetMonth = 0;
      targetYear += 1;
    }
    const key = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const items = calendarData[key] ?? [];
    // status를 undefined로 덮어쓰면 완료 스타일 분기가 절대 참이 되지 않는다.
    // 응답에 있는 값을 그대로 넘긴다.
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      categoryName: item.categoryName ?? "",
      amount: item.amount ?? null,
      startDate: key,
      startTime: item.startTime ?? null,
      status: item.status ?? undefined,
    }));
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (dateObj: {
    day: number;
    month: number;
    year: number;
  }) => {
    const dayPlans = getSchedulesForDay(
      dateObj.day,
      dateObj.month,
      dateObj.year,
    );

    let targetYear = dateObj.year;
    let targetMonth = dateObj.month;
    if (dateObj.month === -1) {
      targetMonth = 11;
      targetYear -= 1;
    } else if (dateObj.month === 12) {
      targetMonth = 0;
      targetYear += 1;
    }

    setSelectedDateLabel(
      `${targetYear}년 ${targetMonth + 1}월 ${dateObj.day}일`,
    );
    setSelectedDayPlans(dayPlans);
    setSelectedDateParams({
      day: dateObj.day,
      month: targetMonth,
      year: targetYear,
    });
    setIsModalOpen(true);
  };

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  const isReadOnly = myRoomPermission === "READ";

  // ── 보드 뷰 (≥768) ─────────────────────────────────────────────
  //
  // 캘린더는 /plan/schedule/calendar 로 "그 달의 day 별 목록"을 받는다.
  // 보드는 달 경계를 넘나들며 끌어야 해서 그 달만 받는 응답으로는 모자라다.
  // /main 과 같은 /plan/schedule/list 를 한 번에 받아 startDate 로 달을 나눈다.
  const [boardView, setBoardView] = useState<"board" | "calendar">("board");
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(
    null,
  );
  /**
   * 넓은 화면에서 우측에 여는 플랜 등록 pane. 인스펙터와 같은 자리를
   * 나눠 쓰므로 둘 중 하나만 열린다.
   */
  const [isAddPaneOpen, setIsAddPaneOpen] = useState(false);
  /** 등록 pane 에 미리 채울 날짜 "YYYY-MM-DD" */
  const [addPaneDate, setAddPaneDate] = useState<string | null>(null);
  const isTabletUp = useIsTabletUp();
  const isDesktop = useIsDesktop();

  /**
   * 보고 있는 달의 합계. calendarData 는 앞뒤 달까지 합쳐 들고 있으므로
   * 이 달의 날짜 키만 골라 센다. 완료를 따로 세는 게 핵심이다 —
   * 캘린더를 지나간 달로 넘기면 그 달에 실제로 쓴 돈이 남아 있어야 한다.
   */
  const monthTotals = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    let spent = 0;
    let planned = 0;
    let doneCount = 0;
    Object.entries(calendarData).forEach(([day, list]) => {
      if (!day.startsWith(prefix)) return;
      list.forEach((item) => {
        const amount = item.amount ?? 0;
        if (item.status === "COMPLETED") {
          spent += amount;
          doneCount += 1;
        } else {
          planned += amount;
        }
      });
    });
    return { spent, planned, doneCount };
  }, [calendarData, year, month]);

  /** 셀이 커지는 ≥768 에서는 일정 미리보기를 한 줄 더 보여준다 */
  const visibleEventCount = isTabletUp ? 3 : 2;

  const fetchBoardItems = useCallback(async () => {
    if (!getToken()) {
      setBoardItems(getGuestScheduleList() as BoardItem[]);
      return;
    }
    setBoardLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        count: "10000",
        sort: "ASC",
        sortColumn: "startDate",
      });
      const url = roomId?.trim()
        ? `/plan/schedule/room/${encodeURIComponent(roomId.trim())}/list?${params.toString()}`
        : `/plan/schedule/list?${params.toString()}`;
      const res = await fetchWithAuth(url, { skipLoading: true });
      const json = (await res.json()) as {
        result?: boolean;
        data?: { list?: BoardItem[] };
      };
      setBoardItems(
        json.result === true && json.data?.list ? json.data.list : [],
      );
    } catch {
      setBoardItems([]);
      setBoardError("플랜을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBoardLoading(false);
    }
  }, [fetchWithAuth, roomId]);

  useEffect(() => {
    if (!isTabletUp) return;
    fetchBoardItems();
  }, [isTabletUp, fetchBoardItems]);

  /**
   * 플랜 등록. ≥1024 는 우측 pane 에서 바로 쓰고, 그보다 좁으면 지금처럼
   * /add-plen 으로 간다 — 인스펙터가 열리는 기준과 같다. 폭이 그보다
   * 좁으면 보드와 폼을 나란히 두기에 양쪽 다 답답해진다.
   */
  const openAddPlan = (dateStr: string | null) => {
    if (isDesktop) {
      setSelectedScheduleId(null);
      setIsModalOpen(false);
      setAddPaneDate(dateStr);
      setIsAddPaneOpen(true);
      return;
    }
    const params = new URLSearchParams();
    if (roomId?.trim()) params.set("roomId", roomId.trim());
    params.set("from", "calendar");
    if (dateStr) params.set("date", dateStr);
    router.push(`/add-plen?${params.toString()}`);
  };

  /** 달력 셀·모달이 넘겨 주는 {year, month, day} 를 "YYYY-MM-DD" 로 */
  const toDateStr = (date?: { day: number; month: number; year: number }) =>
    date
      ? `${date.year}-${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`
      : null;

  const showBoard = isTabletUp && boardView === "board";

  /** 넓은 화면은 옆 인스펙터에서 열고, 좁은 화면은 지금처럼 상세 라우트로 간다 */
  const openSchedule = (id: number) => {
    if (isDesktop) {
      setIsAddPaneOpen(false);
      setSelectedScheduleId(id);
      setIsModalOpen(false);
      return;
    }
    router.push(
      `/schedule-detail?id=${id}&from=calendar${roomId ? `&roomId=${roomId}` : ""}`,
    );
  };

  return (
    <AppShell
      activeTab="home"
      activeRailView="board"
      unreadCount={unreadCount}
      masterWidthClassName="lg:flex-1"
      // 등록 폼은 입력칸이 많아 인스펙터보다 넉넉해야 한다
      detailWidthClassName={
        isAddPaneOpen ? "w-[392px] 2xl:w-[428px]" : "w-[318px] 2xl:w-[364px]"
      }
      /*
        고른 게 없으면 pane 자체를 접는다(null 이 아니라 undefined).
        보드는 가로 폭이 전부인 화면이라, 안내문만 띄운 320~360px 을
        늘 물고 있으면 넓은 화면에서도 월 컬럼이 잘린다.
      */
      detail={
        isDesktop && isAddPaneOpen ? (
          <AddPlanView
            /* 날짜를 바꿔 다시 열면 폼을 새로 잡아야 한다 */
            key={addPaneDate ?? "new"}
            variant="pane"
            roomId={roomId?.trim() ? Number(roomId.trim()) : null}
            initialDate={addPaneDate}
            from="calendar"
            onClose={() => setIsAddPaneOpen(false)}
            onSaved={() => {
              fetchBoardItems();
              fetchSchedules();
            }}
          />
        ) : isTabletUp && selectedScheduleId ? (
          <ScheduleDetailView
            key={selectedScheduleId}
            scheduleId={selectedScheduleId}
            roomId={roomId}
            from="calendar"
            variant="inspector"
            onClose={() => setSelectedScheduleId(null)}
            onDeleted={() => {
              setSelectedScheduleId(null);
              fetchBoardItems();
              fetchSchedules();
            }}
          />
        ) : undefined
      }
      bottomBarSlot={
        <BottomTabBar
          activeTab="home"
          onTabClick={(tab) => {
            if (tab === "home") {
              if (roomId) router.push(`/main?roomId=${roomId}`);
              else router.push("/main");
            } else if (tab === "rooms") router.push("/plan-list");
            else if (tab === "settings") router.push("/user");
          }}
          unreadCount={unreadCount}
        />
      }
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        {/* Main Content Scroll Area */}
        <div
          className={`flex w-full flex-col pb-24 scrollbar-hide md:pb-0 ${
            showBoard
              ? "min-h-0 flex-1 overflow-hidden"
              : "flex-1 overflow-y-auto"
          }`}
        >
          {/* Header */}
          <header className="px-6 pt-8 pb-4 flex items-center justify-between md:px-8 md:pt-6">
            <h1 className="text-2xl font-black text-[#1b0d14]">
              {showBoard ? "플랜 보드" : `${year}년 ${month + 1}월`}
            </h1>
            <div className="flex items-center gap-1">
              {/* 보드 ↔ 캘린더 — 넓은 화면 전용 */}
              {isTabletUp && (
                <div className="mr-2 flex gap-0.5 rounded-xl bg-[#f6f2f5] p-[3px]">
                  {(["board", "calendar"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={boardView === v}
                      onClick={() => setBoardView(v)}
                      className={`rounded-[9px] px-3.5 py-1.5 text-[12.5px] transition-colors ${
                        boardView === v
                          ? "bg-white font-bold text-[#1b0d14] shadow-sm"
                          : "text-[#7a6c74]"
                      }`}
                    >
                      {v === "board" ? "보드" : "캘린더"}
                    </button>
                  ))}
                </div>
              )}
              {!showBoard && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-600" />
                  </button>
                </>
              )}
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button
                type="button"
                onClick={() =>
                  router.push(roomId ? `/main?roomId=${roomId}` : "/main")
                }
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="닫기"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
          </header>

          {showBoard ? (
            <PlanBoard
              items={boardItems}
              loading={boardLoading}
              canEdit={!isReadOnly}
              selectedId={selectedScheduleId}
              onSelect={openSchedule}
              onItemsChange={setBoardItems}
              onAdd={(monthKey) =>
                openAddPlan(monthKey ? `${monthKey}-01` : null)
              }
              onError={setBoardError}
            />
          ) : (
            <>
              {(monthTotals.spent > 0 || monthTotals.planned > 0) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 md:px-8">
                  {monthTotals.spent > 0 && (
                    <span className="inline-flex items-baseline gap-1.5 text-[12.5px] text-[#7a6c74]">
                      <Check
                        className="w-3 h-3 self-center text-[#a79ba3]"
                        strokeWidth={3}
                      />
                      이번 달 지출
                      <b className="text-[13.5px] font-bold tracking-tight text-[#1b0d14]">
                        {monthTotals.spent.toLocaleString("ko-KR")}만 원
                      </b>
                    </span>
                  )}
                  {monthTotals.planned > 0 && (
                    <span className="inline-flex items-baseline gap-1.5 text-[12.5px] text-[#7a6c74]">
                      예정
                      <b className="text-[13.5px] font-bold tracking-tight text-[#ee2b8c]">
                        {monthTotals.planned.toLocaleString("ko-KR")}만 원
                      </b>
                    </span>
                  )}
                </div>
              )}
              {/* Calendar Grid Container */}
              <div className="grid grid-cols-7 px-4 content-start border-l border-t border-gray-50 md:px-8">
                {/* Weekdays */}
                {weekdays.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center py-4 text-xs font-bold border-b border-r border-gray-50 ${
                      i === 0
                        ? "text-red-400"
                        : i === 6
                          ? "text-blue-400"
                          : "text-gray-400"
                    }`}
                  >
                    {d}
                  </div>
                ))}

                {/* Days */}
                {daysInMonth.map((dateObj, idx) => {
                  const daySchedules = getSchedulesForDay(
                    dateObj.day,
                    dateObj.month,
                    dateObj.year,
                  );
                  const isToday =
                    getKstDate().getDate() === dateObj.day &&
                    getKstDate().getMonth() === dateObj.month &&
                    getKstDate().getFullYear() === dateObj.year;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDayClick(dateObj)}
                      className={`min-h-[100px] border-b border-r border-gray-50 p-1 flex flex-col gap-1 cursor-pointer hover:bg-gray-50/50 transition-colors md:min-h-[118px] md:p-1.5 ${!dateObj.isCurrentMonth ? "bg-gray-50/50" : ""}`}
                    >
                      <div className="flex justify-center items-center mb-1">
                        <span
                          className={`text-xs font-bold ${
                            !dateObj.isCurrentMonth
                              ? "text-gray-300"
                              : isToday
                                ? "bg-[#ee2b8c] text-white w-5 h-5 flex items-center justify-center rounded-full"
                                : idx % 7 === 0
                                  ? "text-red-400"
                                  : idx % 7 === 6
                                    ? "text-blue-400"
                                    : "text-gray-700"
                          }`}
                        >
                          {dateObj.day}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {daySchedules.slice(0, visibleEventCount).map((s) => (
                          <div
                            key={s.id}
                            className={`font-user-content flex items-baseline gap-1 text-[8px] p-1 rounded-md transition-colors md:text-[11px] md:px-1.5 md:py-1 ${
                              s.status === "COMPLETED"
                                ? "bg-gray-100 text-gray-400"
                                : "bg-[#ee2b8c10] text-[#ee2b8c]"
                            }`}
                          >
                            <span
                              className={`truncate ${s.status === "COMPLETED" ? "line-through" : ""}`}
                            >
                              {s.title}
                            </span>
                            {/*
                              쓴 돈은 셀에서 바로 보여야 달을 넘겨 가며
                              "언제 얼마를 썼는지"를 훑을 수 있다. 좁은 폰에서는
                              제목이 먼저라 감춘다.
                            */}
                            {s.amount ? (
                              <span className="ml-auto hidden shrink-0 font-bold tabular-nums md:inline">
                                {s.amount.toLocaleString("ko-KR")}
                              </span>
                            ) : null}
                          </div>
                        ))}
                        {daySchedules.length > visibleEventCount && (
                          <div className="flex justify-center mt-0.5">
                            <div className="text-[10px] font-black text-[#ee2b8c] bg-[#ee2b8c0a] px-2 py-0.5 rounded-full border border-[#ee2b8c15] shadow-sm shadow-[#ee2b8c05]">
                              +{daySchedules.length - visibleEventCount}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 보드에는 컬럼마다 "+ 플랜 추가"가 있어 떠 있는 버튼이 필요 없다 */}
        {!isReadOnly && !showBoard && (
          <button
            type="button"
            onClick={() => openAddPlan(null)}
            className="absolute bottom-28 right-6 w-14 h-14 bg-[#ee2b8c] text-white rounded-full flex items-center justify-center shadow-xl shadow-[#ee2b8c44] active:scale-95 transition-transform z-50 md:bottom-8"
          >
            <Plus className="w-8 h-8" strokeWidth={3} />
          </button>
        )}
      </div>

      {/* Day Detail Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ translateY: "100%" }}
              animate={{ translateY: "0%" }}
              exit={{ translateY: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-[32px] p-6 pb-10 flex flex-col gap-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[#1b0d14]">
                  {selectedDateLabel}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] scrollbar-hide">
                {selectedDayPlans.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                    <p className="text-sm font-bold">등록된 플랜이 없어요</p>
                  </div>
                ) : (
                  selectedDayPlans.map((plan) => (
                    <button
                      type="button"
                      key={plan.id}
                      onClick={() => openSchedule(plan.id)}
                      className="font-user-content flex items-center gap-4 bg-gray-50 p-4 rounded-2xl hover:bg-gray-100 transition-colors text-left"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${plan.status === "COMPLETED" ? "bg-gray-200" : "bg-[#ee2b8c10]"}`}
                      >
                        {plan.status === "COMPLETED" ? (
                          <Check
                            className="w-5 h-5 text-gray-400"
                            strokeWidth={3}
                          />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#ee2b8c]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/*
                          text-[#1b0d14] 와 text-gray-400 을 같이 얹으면
                          어느 쪽이 이길지 클래스 순서가 아니라 생성된 CSS
                          순서가 정한다. 완료 표시가 사라지므로 하나만 낸다.
                        */}
                        <p
                          className={`font-bold truncate ${plan.status === "COMPLETED" ? "line-through text-gray-400" : "text-[#1b0d14]"}`}
                        >
                          {plan.title}
                        </p>
                        <p className="text-xs text-gray-400 font-bold">
                          {plan.categoryName}
                          {formatKoreanTime(plan.startTime) ? (
                            <>
                              {plan.categoryName ? " · " : ""}
                              {formatKoreanTime(plan.startTime)}
                            </>
                          ) : null}
                          {plan.amount ? (
                            <>
                              {plan.categoryName ||
                              formatKoreanTime(plan.startTime)
                                ? " · "
                                : ""}
                              <span
                                className={
                                  plan.status === "COMPLETED"
                                    ? "text-[#7a6c74]"
                                    : "text-[#ee2b8c]"
                                }
                              >
                                {plan.amount.toLocaleString("ko-KR")}만 원
                                {plan.status === "COMPLETED" ? " 씀" : ""}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </button>
                  ))
                )}

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => openAddPlan(toDateStr(selectedDateParams))}
                    className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-[#ee2b8c] hover:border-[#ee2b8c33] hover:bg-[#ee2b8c05] transition-all font-bold text-sm mt-2"
                  >
                    <Plus className="w-4 h-4" strokeWidth={3} />
                    플랜 추가하기
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-4 bg-[#1b0d14] text-white rounded-2xl font-black text-lg shadow-xl active:scale-[0.98] transition-all"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CustomAlertModal
        isOpen={boardError !== null}
        message={boardError ?? ""}
        type="error"
        onClose={() => setBoardError(null)}
      />
    </AppShell>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] bg-[#fcfbfc] flex items-center justify-center">
          <div className="animate-pulse text-gray-400 font-bold">
            로딩 중...
          </div>
        </div>
      }
    >
      <CalendarPageContent />
    </Suspense>
  );
}
