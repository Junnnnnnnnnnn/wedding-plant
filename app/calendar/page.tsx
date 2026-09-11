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
import { isPaid } from "@/lib/schedulePaid";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import CustomAlertModal from "../components/CustomAlertModal";
import AddPlanView from "../add-plen/AddPlanView";
import ScheduleDetailView from "../schedule-detail/ScheduleDetailView";
import PlanBoard, { BoardItem } from "./PlanBoard";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import { useIsDesktop, useIsTabletUp } from "../hooks/useMediaQuery";
import { useOwnRoomId } from "../hooks/useOwnRoomId";
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
  /**
   * 일정을 **저장할** 방. 읽기는 위의 `roomId`(주소창) 그대로 두고
   * 쓰기에만 내 방을 채운다 — `/main` 의 `handleAddPlan` 과 같은 규칙이다.
   *
   * 예전에는 여기가 주소창만 봐서, 내 플랜을 보는 중(`?roomId=` 없음)에
   * 보드·달력에서 추가한 일정이 방에 안 붙었다. 만든 사람 눈에는 보드에
   * 보이는데 홈 대시보드 합계에서 빠지고 배우자는 403 을 받았다.
   */
  const ownRoomId = useOwnRoomId();
  const addRoomId = roomId?.trim() ? Number(roomId.trim()) : ownRoomId;
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
  /**
   * 폰의 달력 ↔ 목록 (시안 C안 02).
   *
   * ≥768 의 보드↔캘린더와는 다른 축이다 — 보드는 넓은 화면 전용 뷰이고,
   * 여기 "목록"은 달력 격자 대신 **다가오는 순 한 줄 목록**이다.
   */
  const [mobileView, setMobileView] = useState<"calendar" | "list">("calendar");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateLabel, setSelectedDateLabel] = useState("");
  const [selectedDayPlans, setSelectedDayPlans] = useState<ScheduleListItem[]>(
    [],
  );
  /** 처음부터 오늘이 골라져 있어야 달력 아래 목록이 비지 않는다 */
  const [selectedDateParams, setSelectedDateParams] = useState(() => {
    const t = getKstDate();
    return { day: t.getDate(), month: t.getMonth(), year: t.getFullYear() };
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
    /*
      폰에서는 **달력 아래 목록**이 그날을 바로 보여 준다(시안 C안 02) —
      바텀 시트를 한 겹 더 띄우면 달력이 가려져 다른 날로 옮기기가 어렵다.
      ≥768 은 예전처럼 시트를 연다(보드·인스펙터와 함께 쓰는 화면이라
      아래로 길게 늘일 자리가 없다).

      `useMediaQuery` 대신 `matchMedia` 를 직접 읽는다 — 훅은 서버 스냅샷이
      false 라 하이드레이션 직후 한 번 뒤집힌다.
    */
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      setIsModalOpen(true);
    }
  };

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  /** 그날 목록 제목. 시안처럼 연도 없이 "9월 12일 (토)" */
  const selectedDayLabelShort = (() => {
    const { year: y, month: m, day } = selectedDateParams;
    if (!day) return "";
    const d = new Date(y, m, day);
    return `${m + 1}월 ${day}일 (${weekdays[d.getDay()]})`;
  })();

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
    let count = 0;
    Object.entries(calendarData).forEach(([day, list]) => {
      if (!day.startsWith(prefix)) return;
      list.forEach((item) => {
        const amount = item.amount ?? 0;
        count += 1;
        /*
          **돈은 결제 기준, 개수는 완료 기준이다.** "이번 달 지출" 은 통장에서
          빠져나간 돈이라 미리 낸 계약금도 들어가고, "완료 N" 은 일정이 몇 개
          끝났는지라 결제와 무관하다 — 두 줄이 서로 다른 것을 센다.
        */
        if (isPaid(item)) spent += amount;
        else planned += amount;
        if (item.status === "COMPLETED") doneCount += 1;
      });
    });
    return { spent, planned, doneCount, count };
  }, [calendarData, year, month]);

  /** 목록 뷰에 쓰는 다가오는 순 정렬. 날짜 없는 것은 맨 뒤 */
  const upcomingList = useMemo(() => {
    const time = (d?: string | null) => {
      if (!d?.trim()) return null;
      const parsed = parseLocalDate(d);
      return parsed ? parsed.getTime() : null;
    };
    return [...boardItems].sort((a, b) => {
      const at = time(a.startDate);
      const bt = time(b.startDate);
      if (at === null && bt === null) return a.id - b.id;
      if (at === null) return 1;
      if (bt === null) return -1;
      return at - bt;
    });
  }, [boardItems]);

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

  /*
    보드(≥768)와 **폰의 목록 뷰**가 같은 데이터를 쓴다
    (`/plan/schedule/list?count=10000`). 캘린더 응답은 그 달만 주는데,
    목록은 달 경계를 넘어 다가오는 순으로 이어져야 한다.
  */
  useEffect(() => {
    if (!isTabletUp && mobileView !== "list") return;
    fetchBoardItems();
  }, [isTabletUp, mobileView, fetchBoardItems]);

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
    if (addRoomId != null) params.set("roomId", String(addRoomId));
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
      // 상세도 등록 폼도 읽고 쓸 게 많다. 한 가지 폭으로 통일한다 —
      // 318px 은 지도·금액·메모를 담기에 답답했다.
      detailWidthClassName="w-[392px] xl:w-[424px] 2xl:w-[480px]"
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
            roomId={addRoomId}
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
          className={`pb-tabbar flex w-full flex-col scrollbar-hide md:pb-0 ${
            showBoard
              ? "min-h-0 flex-1 overflow-hidden"
              : "flex-1 overflow-y-auto"
          }`}
        >
          {/*
            폰(캘린더 뷰)은 **분홍 머리 면**. 달을 넘길 때마다 그 달의 규모가
            먼저 눈에 들어와야 해서, 아래 작은 회색 줄이던 합계를 면 안으로
            올린다(합계 마크업은 `md:` 쪽에 그대로 남는다).

            보드는 넓은 화면 전용이라 면을 달지 않는다 — 가로 폭이 곧 기능이다.
          */}
          {/*
            시안(C안 02)의 머리 면이다. 좌측에 `‹ 달 ›`, 우측에 닫기.
            추가(+)는 여기 두지 않는다 — **그날 목록의 "추가"** 가 맡는다.
            날짜를 고른 뒤 누르게 되므로 어느 날에 넣을지가 이미 정해진다.

            보드(≥768)는 넓은 화면 전용이라 면을 달지 않는다.
          */}
          <header
            /*
              위/아래 여백을 **기본 클래스에 두지 않는다.** `pt-8` 과 `pt-4` 가
              한 문자열에 같이 있으면 클래스 나열 순서가 아니라 생성된 CSS
              순서가 승자를 정해, 분기 값이 무시된다(실제로 그래서 머리 면이
              시안보다 32px 높았다). 분기마다 제 값을 갖게 한다.
            */
            className={`flex items-center justify-between gap-2 px-6 md:px-8 ${
              showBoard
                ? "pb-4 pt-8 md:pt-6"
                : "bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] pb-0 pt-4 md:bg-none md:pb-4 md:pt-6"
            }`}
          >
            <div className="flex min-w-0 items-center gap-1">
              {!showBoard && (
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/20 md:hover:bg-gray-100"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="h-5 w-5 text-white md:text-gray-600" />
                </button>
              )}
              <h1
                className={`truncate text-[20px] font-bold tracking-[-0.02em] md:text-2xl md:font-black ${
                  showBoard ? "text-[#1b0d14]" : "text-white md:text-[#1b0d14]"
                }`}
              >
                {showBoard ? "플랜 보드" : `${year}년 ${month + 1}월`}
              </h1>
              {!showBoard && (
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/20 md:hover:bg-gray-100"
                  aria-label="다음 달"
                >
                  <ChevronRight className="h-5 w-5 text-white md:text-gray-600" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
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
              <button
                type="button"
                onClick={() =>
                  router.push(roomId ? `/main?roomId=${roomId}` : "/main")
                }
                className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/20 md:hover:bg-gray-100"
                aria-label="닫기"
              >
                <X className="h-5 w-5 text-white md:text-gray-400" />
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
              {/*
                시안(C안 02)의 면 안쪽 — **얇은 상자 + 세그먼트**.
                예전에는 합계가 작은 회색 줄이었고 세그먼트가 없었다.
                폰에서는 값이 없어도 이 블록이 면의 아래 끝을 맡는다
                (조건부로 빼면 머리글과 달력 사이에 각진 이음매가 생긴다).
                ≥768 은 예전처럼 값이 있을 때만 한 줄로 보인다.
              */}
              <div
                data-mobile-head
                className={`rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-6 pb-5 pt-3 md:rounded-none md:bg-none md:px-8 md:pb-3 md:pt-0 ${
                  monthTotals.spent > 0 || monthTotals.planned > 0
                    ? ""
                    : "md:hidden"
                }`}
              >
                <div className="rounded-xl bg-white/20 px-4 py-3 md:bg-transparent md:p-0">
                  <p className="text-[14px] font-bold text-white md:text-[13.5px] md:text-[#1b0d14]">
                    이번 달 예정 {monthTotals.planned.toLocaleString("ko-KR")}만
                    원
                  </p>
                  <p className="mt-0.5 text-[12px] text-white/75 md:text-[12.5px] md:text-[#7a6c74]">
                    지출 {monthTotals.spent.toLocaleString("ko-KR")}만 원 · 일정{" "}
                    {monthTotals.count}개
                  </p>
                </div>

                {/* 달력 ↔ 목록 — 폰 전용. ≥768 은 위의 보드↔캘린더가 맡는다 */}
                <div
                  className="mt-4 grid grid-cols-2 gap-0.5 rounded-[10px] bg-white/20 p-[3px] md:hidden"
                  role="tablist"
                >
                  {(["calendar", "list"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={mobileView === v}
                      onClick={() => setMobileView(v)}
                      className={`rounded-lg py-1.5 text-[13px] transition-colors ${
                        mobileView === v
                          ? "bg-white font-bold text-[#ee2b8c]"
                          : "font-medium text-white/80"
                      }`}
                    >
                      {v === "calendar" ? "달력" : "목록"}
                    </button>
                  ))}
                </div>
              </div>

              {/*
                시안(C안 02)의 달력이다. **격자 선을 전부 걷어냈다** — 셀마다
                테두리를 두르면 날짜보다 선이 먼저 읽히고, 일정 칩이 갇힌
                것처럼 보인다. 구분은 여백이 한다.
              */}
              <div
                className={`grid-cols-7 content-start px-2 md:grid md:px-8 ${
                  mobileView === "list" ? "hidden" : "grid"
                }`}
              >
                {/* Weekdays */}
                {weekdays.map((d, i) => (
                  <div
                    key={d}
                    className={`py-2 text-center text-[12px] font-bold ${
                      i === 0
                        ? "text-[#fa342c]"
                        : i === 6
                          ? "text-[#217cf9]"
                          : "text-[#868b94]"
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
                      className={`flex min-h-[68px] cursor-pointer flex-col gap-1 rounded-lg p-1 transition-colors hover:bg-[#f7f8f9] md:min-h-[118px] md:p-1.5 ${!dateObj.isCurrentMonth ? "opacity-40" : ""}`}
                    >
                      <div className="mb-0.5 flex items-center justify-center">
                        <span
                          className={`text-[13px] font-medium tabular-nums ${
                            !dateObj.isCurrentMonth
                              ? "text-[#d1d3d8]"
                              : isToday
                                ? "flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#ee2b8c] font-bold text-white"
                                : idx % 7 === 0
                                  ? "text-[#fa342c]"
                                  : idx % 7 === 6
                                    ? "text-[#217cf9]"
                                    : "text-[#1a1c20]"
                          }`}
                        >
                          {dateObj.day}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {daySchedules.slice(0, visibleEventCount).map((s) => (
                          <div
                            key={s.id}
                            className={`font-user-content flex items-baseline gap-1 rounded px-1 py-px text-[9.5px] leading-[1.3] transition-colors md:px-1.5 md:py-1 md:text-[11px] ${
                              s.status === "COMPLETED"
                                ? "bg-[#f3f4f5] text-[#868b94]"
                                : "bg-[#fff1f7] text-[#cc1873]"
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

              {/*
                시안(C안 02)의 그날 목록. 폰에서는 시트 대신 **달력 바로 아래**
                에 붙어, 날짜를 옮겨 가며 볼 수 있다. ≥768 은 시트가 맡으므로
                내지 않는다.
              */}
              <section
                className={`px-4 pb-6 pt-5 md:hidden ${
                  mobileView === "list" ? "hidden" : ""
                }`}
              >
                <div className="flex items-baseline gap-2 px-1">
                  <h3 className="text-[16px] font-bold tracking-[-0.01em] text-[#1a1c20]">
                    {selectedDayLabelShort}
                  </h3>
                  <span className="text-[13px] tabular-nums text-[#868b94]">
                    {selectedDayPlans.length}
                  </span>
                  <span className="flex-1" />
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => openAddPlan(toDateStr(selectedDateParams))}
                      className="text-[13px] font-bold text-[#ee2b8c] transition-colors hover:text-[#cc1873]"
                    >
                      추가
                    </button>
                  )}
                </div>

                {selectedDayPlans.length === 0 ? (
                  <p className="px-1 pt-6 text-center text-[14px] text-[#868b94]">
                    이 날은 비어 있어요
                  </p>
                ) : (
                  <ul className="mt-3 grid gap-2">
                    {selectedDayPlans.map((plan) => (
                      <li key={plan.id}>
                        <button
                          type="button"
                          onClick={() => openSchedule(plan.id)}
                          className="flex w-full items-start gap-3 rounded-2xl bg-[#f7f8f9] p-4 text-left transition-colors active:bg-[#eeeff1]"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="font-user-content block truncate text-[16px] font-bold tracking-[-0.01em] text-[#1a1c20]">
                              {plan.title}
                            </span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#555d6d]">
                              <span className="rounded bg-[#fff1f7] px-1.5 py-px text-[11px] font-bold text-[#cc1873]">
                                {plan.categoryName}
                              </span>
                              {formatKoreanTime(plan.startTime) ? (
                                <span>{formatKoreanTime(plan.startTime)}</span>
                              ) : null}
                              <span
                                className={`ml-auto shrink-0 tabular-nums ${
                                  (plan.amount ?? 0) > 0
                                    ? "text-[14px] font-bold text-[#1a1c20]"
                                    : "text-[13px] font-medium text-[#868b94]"
                                }`}
                              >
                                {(plan.amount ?? 0) > 0
                                  ? `${(plan.amount ?? 0).toLocaleString("ko-KR")}만 원`
                                  : "미정"}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/*
                목록 뷰 — 달력 격자 대신 **다가오는 순 한 줄 목록**.
                달 경계를 넘어 이어지므로 `boardItems`(전체 목록)를 쓴다.
                달력 응답은 그 달만 주기 때문이다.
              */}
              {mobileView === "list" && (
                <section className="px-4 pb-6 pt-4 md:hidden">
                  {upcomingList.length === 0 ? (
                    <p className="pt-10 text-center text-[14px] text-[#868b94]">
                      아직 일정이 없어요
                    </p>
                  ) : (
                    <ul>
                      {upcomingList.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => openSchedule(item.id)}
                            className="flex w-full items-center gap-3 border-b border-[#0000000c] px-1 py-3.5 text-left transition-colors active:bg-[#f7f8f9]"
                          >
                            <span className="min-w-0 flex-1">
                              <span
                                className={`font-user-content block truncate text-[15px] font-medium ${
                                  item.status === "COMPLETED"
                                    ? "text-[#868b94] line-through"
                                    : "text-[#1a1c20]"
                                }`}
                              >
                                {item.title}
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-[#868b94]">
                                {item.categoryName}
                              </span>
                            </span>
                            <span className="shrink-0 text-[13px] tabular-nums text-[#868b94]">
                              {item.startDate?.trim()
                                ? (() => {
                                    const d = parseLocalDate(item.startDate);
                                    return d
                                      ? `${d.getMonth() + 1}월 ${d.getDate()}일`
                                      : "날짜 미정";
                                  })()
                                : "날짜 미정"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/*
          떠 있던 분홍 FAB 는 없앴다. 오른쪽 아래에 앉아 **마지막 주를 가렸고**,
          날짜를 안 정한 채로 추가를 시작하게 만들었다. 추가는 두 자리에 있다 —
          머리 면의 `+`(날짜 미정으로 시작), 그리고 날짜를 누르면 나오는
          그날 목록의 "플랜 추가하기"(그 날짜로 시작).
          보드에는 컬럼마다 "+ 플랜 추가"가 이미 있다.
        */}
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
                                {isPaid(plan) ? " 씀" : ""}
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
