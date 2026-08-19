"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getKstToday } from "@/lib/utils";

type DatePickerWheelProps = {
  initialDate?: { year: number; month: number; day: number };
  onDateChange?: (date: { year: number; month: number; day: number }) => void;
};

function getDefaultDate() {
  return getKstToday();
}

export default function DatePickerWheel({
  initialDate,
  onDateChange,
}: DatePickerWheelProps) {
  const currentYear = getKstToday().year;
  const defaultDate = initialDate ?? getDefaultDate();
  const minYear = currentYear;
  const initialYear = Math.max(defaultDate.year, minYear);

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultDate.month);
  const [selectedDay, setSelectedDay] = useState(defaultDate.day);

  const yearRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);

  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;

  // 스크롤/클릭 시점에 항상 최신 값 보장 (React 배칭으로 인한 stale closure 방지)
  const selectedRef = useRef({
    year: initialYear,
    month: defaultDate.month,
    day: defaultDate.day,
  });

  const setYearAndRef = useCallback((v: number) => {
    if (selectedRef.current.year === v) return;
    selectedRef.current.year = v;
    setSelectedYear(v);
  }, []);
  const setMonthAndRef = useCallback((v: number) => {
    if (selectedRef.current.month === v) return;
    selectedRef.current.month = v;
    setSelectedMonth(v);
  }, []);
  const setDayAndRef = useCallback((v: number) => {
    if (selectedRef.current.day === v) return;
    selectedRef.current.day = v;
    setSelectedDay(v);
  }, []);

  // 드래그 상태 관리
  const dragStateRef = useRef<{
    isDragging: boolean;
    startY: number;
    startScrollTop: number;
    containerRef: React.RefObject<HTMLDivElement | null> | null;
  }>({
    isDragging: false,
    startY: 0,
    startScrollTop: 0,
    containerRef: null,
  });

  /** 프로그램 스크롤 직후 발생하는 scroll 이벤트로 handleScroll이 재실행되어 스냅이 덮어씌워지는 것 방지 */
  const programmaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 언마운트 시 pending 스크롤 타이머 정리 (setState on unmounted 방지)
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, []);

  const years = Array.from({ length: 100 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };
  const days = Array.from(
    { length: getDaysInMonth(selectedYear, selectedMonth) },
    (_, i) => i + 1,
  );
  // 순환 휠용: 월 3번 반복 [1..12, 1..12, 1..12], 일도 3번 반복
  const monthsTriple = useMemo(
    () => [...months, ...months, ...months],
    [months],
  );
  const daysTriple = useMemo(() => [...days, ...days, ...days], [days]);
  const MONTH_BLOCK = 12;

  // 월/년 변경 시 선택일이 해당 월 일수 초과면 마지막 날로 보정
  const maxDay = getDaysInMonth(selectedYear, selectedMonth);
  useEffect(() => {
    if (selectedDay > maxDay) {
      setDayAndRef(maxDay);
    }
  }, [selectedMonth, selectedYear, selectedDay, maxDay, setDayAndRef]);

  // 연도 하한(올해)만 있고 월·일 하한이 없어, 올해의 지난 날짜를 그대로
  // 고를 수 있었다. 결혼일이 과거가 되면 D-day 가 음수가 된다.
  // 휠 자체는 건드리지 않고(순환 스크롤 인덱스 계산이 얽혀 있다)
  // 선택이 과거면 오늘로 되돌린다.
  useEffect(() => {
    const t = getKstToday();
    const selected = selectedYear * 10000 + selectedMonth * 100 + selectedDay;
    const todayNum = t.year * 10000 + t.month * 100 + t.day;
    if (selected >= todayNum) return;
    setSelectedYear(t.year);
    setSelectedMonth(t.month);
    setDayAndRef(t.day);
  }, [selectedYear, selectedMonth, selectedDay, setDayAndRef]);

  useEffect(() => {
    const cb = onDateChangeRef.current;
    if (cb) {
      cb({
        year: selectedYear,
        month: selectedMonth,
        day: selectedDay,
      });
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  const itemHeight = 48; // h-12 = 48px

  const getTopPadding = (container: HTMLDivElement): number => {
    const c0 = container.firstElementChild as HTMLElement;
    return c0 ? Math.round(c0.offsetHeight) : 0;
  };

  const getIndexFromScroll = (
    container: HTMLDivElement,
    roundUpThreshold?: number,
  ): number => {
    const topPadding = getTopPadding(container);
    const centerY = container.scrollTop + container.clientHeight / 2;
    const exact = (centerY - topPadding - itemHeight / 2) / itemHeight;
    if (roundUpThreshold != null) {
      const frac = exact - Math.floor(exact);
      return frac >= roundUpThreshold ? Math.ceil(exact) : Math.floor(exact);
    }
    return Math.round(exact);
  };

  const scrollToValue = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    index: number,
    immediate: boolean = false,
  ) => {
    if (containerRef.current) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      programmaticScrollRef.current = true;
      const container = containerRef.current;
      const topPadding = getTopPadding(container);
      const targetScroll =
        topPadding + (index + 0.5) * itemHeight - container.clientHeight / 2;
      const topRounded = Math.max(0, Math.round(targetScroll));
      container.scrollTo({
        top: topRounded,
        behavior: immediate ? "auto" : "smooth",
      });
      const guardMs = immediate ? 150 : 350;
      scrollTimeoutRef.current = setTimeout(() => {
        programmaticScrollRef.current = false;
        scrollTimeoutRef.current = null;
      }, guardMs);
    }
  };

  const handleScroll = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    items: number[],
    setValue: (value: number) => void,
    options?: { wrapTriple: number },
  ) => {
    if (programmaticScrollRef.current) return;
    if (containerRef.current && !dragStateRef.current.isDragging) {
      const container = containerRef.current;
      const blockSize = options?.wrapTriple ?? 0;
      const roundUp = blockSize > 0 ? 0.4 : undefined;
      let index = getIndexFromScroll(container, roundUp);

      if (blockSize > 0 && items.length === blockSize * 3) {
        index = Math.max(0, Math.min(index, items.length - 1));
        if (index < blockSize) {
          setValue(items[index]);
          scrollToValue(containerRef, index + blockSize, true);
          return;
        }
        if (index >= blockSize * 2) {
          setValue(items[index - blockSize * 2]);
          scrollToValue(containerRef, index - blockSize, true);
          return;
        }
        setValue(items[index - blockSize]);
        const topPaddingInner = getTopPadding(container);
        const targetScrollInner =
          topPaddingInner +
          (index + 0.5) * itemHeight -
          container.clientHeight / 2;
        if (Math.abs(container.scrollTop - targetScrollInner) > 2) {
          scrollToValue(containerRef, index, true);
        }
        return;
      }

      index = Math.max(0, Math.min(index, items.length - 1));
      setValue(items[index]);
      scrollToValue(containerRef, index, false);
    }
  };

  const handleDragStart = (
    e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
    containerRef: React.RefObject<HTMLDivElement | null>,
  ) => {
    if (!containerRef.current) return;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    programmaticScrollRef.current = false;

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const container = containerRef.current;
    dragStateRef.current = {
      isDragging: true,
      startY: clientY,
      startScrollTop: container.scrollTop,
      containerRef,
    };

    container.style.cursor = "grabbing";
    container.style.userSelect = "none";
  };

  const handleDragMove = (
    e: TouchEvent | MouseEvent,
    items: number[],
    setValue: (value: number) => void,
    options?: { wrapTriple: number },
  ) => {
    if (
      !dragStateRef.current.isDragging ||
      !dragStateRef.current.containerRef?.current
    )
      return;

    const container = dragStateRef.current.containerRef.current;
    const blockSize = options?.wrapTriple ?? 0;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStateRef.current.startY - clientY;
    const newScrollTop = dragStateRef.current.startScrollTop + deltaY;

    const maxScroll = container.scrollHeight - container.clientHeight;
    const clampedScrollTop = Math.max(0, Math.min(newScrollTop, maxScroll));
    container.scrollTop = clampedScrollTop;

    const roundUp = blockSize > 0 ? 0.4 : undefined;
    let index = getIndexFromScroll(container, roundUp);

    if (blockSize > 0 && items.length === blockSize * 3) {
      index = Math.max(0, Math.min(index, items.length - 1));
      const val =
        index < blockSize
          ? items[index]
          : index >= blockSize * 2
            ? items[index - blockSize * 2]
            : items[index - blockSize];
      setValue(val);
    } else {
      index = Math.max(0, Math.min(index, items.length - 1));
      setValue(items[index]);
    }
  };

  const handleDragEnd = (
    items: number[],
    setValue: (value: number) => void,
    options?: { wrapTriple: number },
  ) => {
    if (
      !dragStateRef.current.isDragging ||
      !dragStateRef.current.containerRef?.current
    )
      return;

    const container = dragStateRef.current.containerRef.current;
    const blockSize = options?.wrapTriple ?? 0;
    container.style.cursor = "grab";
    container.style.userSelect = "";

    const roundUp = blockSize > 0 ? 0.4 : undefined;
    const index = getIndexFromScroll(container, roundUp);

    const containerRefForJump = dragStateRef.current.containerRef;
    const resolvedIndex = Math.max(0, Math.min(index, items.length - 1));

    if (blockSize > 0 && items.length === blockSize * 3) {
      if (resolvedIndex < blockSize) {
        setValue(items[resolvedIndex]);
        if (containerRefForJump) {
          scrollToValue(containerRefForJump, resolvedIndex + blockSize, true);
        }
      } else if (resolvedIndex >= blockSize * 2) {
        setValue(items[resolvedIndex - blockSize * 2]);
        if (containerRefForJump) {
          scrollToValue(containerRefForJump, resolvedIndex - blockSize, true);
        }
      } else {
        setValue(items[resolvedIndex - blockSize]);
        if (containerRefForJump) {
          scrollToValue(containerRefForJump, resolvedIndex, true);
        }
      }
    } else {
      setValue(items[resolvedIndex]);
      scrollToValue(containerRefForJump, resolvedIndex, false);
    }

    dragStateRef.current = {
      isDragging: false,
      startY: 0,
      startScrollTop: 0,
      containerRef: null,
    };
  };

  const dataRef = useRef({
    years,
    monthsTriple,
    days,
    daysTriple,
    daysLength: days.length,
  });

  useEffect(() => {
    dataRef.current = {
      years,
      monthsTriple,
      days,
      daysTriple,
      daysLength: days.length,
    };
  }, [years, monthsTriple, days, daysTriple]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (
        !dragStateRef.current.isDragging ||
        !dragStateRef.current.containerRef
      )
        return;

      const { containerRef } = dragStateRef.current;
      const {
        years: y,
        monthsTriple: mt,
        daysTriple: dt,
        daysLength: dl,
      } = dataRef.current;

      if (containerRef === yearRef) {
        handleDragMove(e, y, setYearAndRef);
      } else if (containerRef === monthRef) {
        handleDragMove(e, mt, setMonthAndRef, {
          wrapTriple: MONTH_BLOCK,
        });
      } else if (containerRef === dayRef) {
        handleDragMove(e, dt, setDayAndRef, {
          wrapTriple: dl,
        });
      }
    };

    const handleMouseUp = () => {
      if (
        !dragStateRef.current.isDragging ||
        !dragStateRef.current.containerRef
      )
        return;

      const { containerRef } = dragStateRef.current;
      const {
        years: y,
        monthsTriple: mt,
        daysTriple: dt,
        daysLength: dl,
      } = dataRef.current;

      if (containerRef === yearRef) {
        handleDragEnd(y, setYearAndRef);
      } else if (containerRef === monthRef) {
        handleDragEnd(mt, setMonthAndRef, {
          wrapTriple: MONTH_BLOCK,
        });
      } else if (containerRef === dayRef) {
        handleDragEnd(dt, setDayAndRef, {
          wrapTriple: dl,
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (
        !dragStateRef.current.isDragging ||
        !dragStateRef.current.containerRef
      )
        return;
      e.preventDefault();

      const { containerRef } = dragStateRef.current;
      const {
        years: y,
        monthsTriple: mt,
        daysTriple: dt,
        daysLength: dl,
      } = dataRef.current;

      if (containerRef === yearRef) {
        handleDragMove(e, y, setYearAndRef);
      } else if (containerRef === monthRef) {
        handleDragMove(e, mt, setMonthAndRef, {
          wrapTriple: MONTH_BLOCK,
        });
      } else if (containerRef === dayRef) {
        handleDragMove(e, dt, setDayAndRef, {
          wrapTriple: dl,
        });
      }
    };

    const handleTouchEnd = () => {
      if (
        !dragStateRef.current.isDragging ||
        !dragStateRef.current.containerRef
      )
        return;

      const { containerRef } = dragStateRef.current;
      const {
        years: y,
        monthsTriple: mt,
        daysTriple: dt,
        daysLength: dl,
      } = dataRef.current;

      if (containerRef === yearRef) {
        handleDragEnd(y, setYearAndRef);
      } else if (containerRef === monthRef) {
        handleDragEnd(mt, setMonthAndRef, {
          wrapTriple: MONTH_BLOCK,
        });
      } else if (containerRef === dayRef) {
        handleDragEnd(dt, setDayAndRef, {
          wrapTriple: dl,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setYearAndRef, setMonthAndRef, setDayAndRef]);

  // 상태 변화 시 스크롤 위치 동기화 (프로그램 스크롤 가드 확인)
  useEffect(() => {
    if (programmaticScrollRef.current) return;

    if (yearRef.current) {
      const yearIndex = years.indexOf(selectedYear);
      if (yearIndex !== -1) {
        scrollToValue(yearRef, yearIndex, true);
      }
    }
    if (monthRef.current) {
      const monthIndex = months.indexOf(selectedMonth);
      if (monthIndex !== -1) {
        scrollToValue(monthRef, MONTH_BLOCK + monthIndex, true);
      }
    }
    if (dayRef.current) {
      const dayIndex = days.indexOf(selectedDay);
      if (dayIndex !== -1) {
        scrollToValue(dayRef, days.length + dayIndex, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, selectedDay, years, months, days]);

  const handleYearClick = (direction: "up" | "down") => {
    const currentIndex = years.indexOf(selectedYear);
    const newIndex =
      direction === "up"
        ? Math.max(0, currentIndex - 1)
        : Math.min(years.length - 1, currentIndex + 1);
    setYearAndRef(years[newIndex]);
  };

  const handleMonthClick = (direction: "up" | "down") => {
    const currentIndex = months.indexOf(selectedMonth);
    let newIndex: number;
    if (direction === "up") {
      newIndex = (currentIndex - 1 + 12) % 12;
    } else {
      newIndex = (currentIndex + 1) % 12;
    }
    setMonthAndRef(months[newIndex]);
  };

  const handleDayClick = (direction: "up" | "down") => {
    const currentIndex = days.indexOf(selectedDay);
    let newIndex: number;
    if (direction === "up") {
      newIndex = (currentIndex - 1 + days.length) % days.length;
    } else {
      newIndex = (currentIndex + 1) % days.length;
    }
    setDayAndRef(days[newIndex]);
  };

  const arrowClass =
    "flex items-center justify-center w-full h-8 text-stone-400 hover:text-[#ee2b8c] active:scale-90 transition-all";

  return (
    <div className="flex flex-col items-center mt-8">
      <div className="flex items-start justify-center gap-4">
        {/* 년도 선택 */}
        <div className="flex flex-col items-center w-20">
          <div className="text-sm font-medium text-stone-600 mb-2">년</div>
          <button
            type="button"
            onClick={() => handleYearClick("up")}
            className={arrowClass}
          >
            <ChevronUp className="w-6 h-6" />
          </button>
          <div className="relative w-full h-40 overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-stone-100/50 border-y-2 border-stone-300 pointer-events-none z-10" />
            <div
              ref={yearRef}
              className="h-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory cursor-grab active:cursor-grabbing"
              role="listbox"
              tabIndex={0}
              onScroll={() => handleScroll(yearRef, years, setYearAndRef)}
              onTouchStart={(e) => handleDragStart(e, yearRef)}
              onMouseDown={(e) => handleDragStart(e, yearRef)}
              style={{ scrollSnapType: "y mandatory" }}
            >
              <div className="h-[calc(50%-24px)]" />
              {years.map((year) => (
                <div
                  key={year}
                  className="h-12 flex items-center justify-center snap-center text-lg font-semibold text-stone-900"
                >
                  {year}
                </div>
              ))}
              <div className="h-[calc(50%-24px)]" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleYearClick("down")}
            className={arrowClass}
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* 월 선택 */}
        <div className="flex flex-col items-center w-16">
          <div className="text-sm font-medium text-stone-600 mb-2">월</div>
          <button
            type="button"
            onClick={() => handleMonthClick("up")}
            className={arrowClass}
          >
            <ChevronUp className="w-6 h-6" />
          </button>
          <div className="relative w-full h-40 overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-stone-100/50 border-y-2 border-stone-300 pointer-events-none z-10" />
            <div
              ref={monthRef}
              className="h-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory cursor-grab active:cursor-grabbing"
              role="listbox"
              tabIndex={0}
              onScroll={() =>
                handleScroll(monthRef, monthsTriple, setMonthAndRef, {
                  wrapTriple: MONTH_BLOCK,
                })
              }
              onTouchStart={(e) => handleDragStart(e, monthRef)}
              onMouseDown={(e) => handleDragStart(e, monthRef)}
              style={{ scrollSnapType: "y mandatory" }}
            >
              <div className="h-[calc(50%-24px)]" />
              {monthsTriple.map((month, i) => (
                <div
                  key={`month-${Math.floor(i / MONTH_BLOCK)}-${month}`}
                  className="h-12 flex items-center justify-center snap-center text-lg font-semibold text-stone-900"
                >
                  {month}
                </div>
              ))}
              <div className="h-[calc(50%-24px)]" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleMonthClick("down")}
            className={arrowClass}
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* 일 선택 */}
        <div className="flex flex-col items-center w-16">
          <div className="text-sm font-medium text-stone-600 mb-2">일</div>
          <button
            type="button"
            onClick={() => handleDayClick("up")}
            className={arrowClass}
          >
            <ChevronUp className="w-6 h-6" />
          </button>
          <div className="relative w-full h-40 overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-stone-100/50 border-y-2 border-stone-300 pointer-events-none z-10" />
            <div
              ref={dayRef}
              className="h-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory cursor-grab active:cursor-grabbing"
              role="listbox"
              tabIndex={0}
              onScroll={() =>
                handleScroll(dayRef, daysTriple, setDayAndRef, {
                  wrapTriple: days.length,
                })
              }
              onTouchStart={(e) => handleDragStart(e, dayRef)}
              onMouseDown={(e) => handleDragStart(e, dayRef)}
              style={{ scrollSnapType: "y mandatory" }}
            >
              <div className="h-[calc(50%-24px)]" />
              {daysTriple.map((day, i) => (
                <div
                  key={`day-${Math.floor(i / days.length)}-${day}`}
                  className="h-12 flex items-center justify-center snap-center text-lg font-semibold text-stone-900"
                >
                  {day}
                </div>
              ))}
              <div className="h-[calc(50%-24px)]" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDayClick("down")}
            className={arrowClass}
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
