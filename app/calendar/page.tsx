"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { ChevronLeft, ChevronRight, Plus, Check, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import BottomTabBar from "../components/BottomTabBar";
import { useApi } from "../contexts/ApiContext";
import { getToken } from "@/lib/api";
import { parseLocalDate, getKstDate } from "@/lib/utils";
import { getGuestScheduleList } from "@/lib/guestSchedule";

interface ScheduleListItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  status?: string | null;
}

/** GET /plan/schedule/calendar 응답의 day별 list 항목 */
interface CalendarPlanItem {
  id: number;
  title: string;
}

function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");
  const { fetchWithAuth } = useApi();
  const [currentDate, setCurrentDate] = useState(getKstDate());
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

  const fetchSchedules = useCallback(async () => {
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
        byDay[key].push({ id: s.id, title: s.title });
      });
      setCalendarData(byDay);
      return;
    }

    try {
      const params = new URLSearchParams({
        month: String(month + 1),
        year: String(year),
      });
      if (roomId?.trim()) params.set("roomId", roomId.trim());
      const res = await fetchWithAuth(
        `/plan/schedule/calendar?${params.toString()}`,
      );
      const json = await res.json();
      if (json.result === true && json.data?.list) {
        const byDay: Record<string, CalendarPlanItem[]> = {};
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
        setCalendarData(byDay);
      } else {
        setCalendarData({});
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
      setCalendarData({});
    }
  }, [fetchWithAuth, roomId, year, month]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

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
    return items.map(({ id, title }) => ({
      id,
      title,
      categoryName: "",
      amount: null,
      startDate: key,
      status: undefined,
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

  const getAddPlanPath = (date?: {
    day: number;
    month: number;
    year: number;
  }) => {
    const params = new URLSearchParams();
    if (roomId?.trim()) params.set("roomId", roomId.trim());
    params.set("from", "calendar");
    if (date) {
      params.set(
        "date",
        `${date.year}-${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
      );
    }
    return `/add-plen?${params.toString()}`;
  };

  return (
    <div className="h-[100dvh] bg-[#fcfbfc] overflow-hidden">
      {/* Desktop Letterbox Background */}
      <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />

      <div className="h-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col z-10">
        {/* Main Content Scroll Area */}
        <div className="flex-1 overflow-y-auto w-full flex flex-col pb-24 scrollbar-hide">
          {/* Header */}
          <header className="px-6 pt-8 pb-4 flex items-center justify-between">
            <h1 className="text-2xl font-black text-[#1b0d14]">
              {year}년 {month + 1}월
            </h1>
            <div className="flex items-center gap-2">
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
            </div>
          </header>

          {/* Weekdays */}
          <div className="grid grid-cols-7 px-4 border-b border-gray-100 mb-2">
            {weekdays.map((d, i) => (
              <div
                key={d}
                className={`text-center py-2 text-xs font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 grid grid-cols-7 px-4 content-start">
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
                  className={`min-h-[100px] border-b border-r border-gray-50 p-1 flex flex-col gap-1 cursor-pointer hover:bg-gray-50/50 transition-colors ${
                    idx % 7 === 0 ? "border-l" : ""
                  } ${idx < 7 ? "border-t" : ""} ${!dateObj.isCurrentMonth ? "bg-gray-50/50" : ""}`}
                >
                  <div className="flex justify-between items-center">
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
                    {daySchedules.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className={`font-user-content text-[8px] p-1 rounded-md truncate transition-colors ${
                          s.status === "COMPLETED"
                            ? "bg-gray-100 text-gray-400 line-through"
                            : "bg-[#ee2b8c10] text-[#ee2b8c]"
                        }`}
                      >
                        {s.title}
                      </div>
                    ))}
                    {daySchedules.length > 2 && (
                      <div className="flex justify-center mt-0.5">
                        <div className="text-[10px] font-black text-[#ee2b8c] bg-[#ee2b8c0a] px-2 py-0.5 rounded-full border border-[#ee2b8c15] shadow-sm shadow-[#ee2b8c05]">
                          +{daySchedules.length - 2}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push(getAddPlanPath())}
          className="absolute bottom-28 right-6 w-14 h-14 bg-[#ee2b8c] text-white rounded-full flex items-center justify-center shadow-xl shadow-[#ee2b8c44] active:scale-95 transition-transform z-50"
        >
          <Plus className="w-8 h-8" strokeWidth={3} />
        </button>

        <BottomTabBar
          activeTab="home"
          onTabClick={(tab) => {
            if (tab === "home") {
              if (roomId) router.push(`/main?roomId=${roomId}`);
              else router.push("/main");
            } else if (tab === "rooms") router.push("/plan-list");
            else if (tab === "settings") router.push("/user");
          }}
          unreadCount={5}
        />
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
                      onClick={() =>
                        router.push(
                          `/schedule-detail?id=${plan.id}&from=calendar${roomId ? `&roomId=${roomId}` : ""}`,
                        )
                      }
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
                        <p
                          className={`font-bold text-[#1b0d14] truncate ${plan.status === "COMPLETED" ? "line-through text-gray-400" : ""}`}
                        >
                          {plan.title}
                        </p>
                        <p className="text-xs text-gray-400 font-bold">
                          {plan.categoryName}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </button>
                  ))
                )}

                <button
                  type="button"
                  onClick={() =>
                    router.push(getAddPlanPath(selectedDateParams))
                  }
                  className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-[#ee2b8c] hover:border-[#ee2b8c33] hover:bg-[#ee2b8c05] transition-all font-bold text-sm mt-2"
                >
                  <Plus className="w-4 h-4" strokeWidth={3} />
                  플랜 추가하기
                </button>
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
    </div>
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
