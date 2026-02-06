"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type DatePickerWheelProps = {
  initialDate?: { year: number; month: number; day: number };
  onDateChange?: (date: { year: number; month: number; day: number }) => void;
  onNext?: () => void;
};

function getDefaultDate() {
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
}

export default function DatePickerWheel({
  initialDate,
  onDateChange,
  onNext,
}: DatePickerWheelProps) {
  const currentYear = new Date().getFullYear();
  const defaultDate = initialDate ?? getDefaultDate();

  const [selectedYear, setSelectedYear] = useState(defaultDate.year);
  const [selectedMonth, setSelectedMonth] = useState(defaultDate.month);
  const [selectedDay, setSelectedDay] = useState(defaultDate.day);

  const yearRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);

  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;

  // 스크롤/클릭 시점에 항상 최신 값 보장 (React 배칭으로 인한 stale closure 방지)
  const selectedRef = useRef({
    year: defaultDate.year,
    month: defaultDate.month,
    day: defaultDate.day,
  });
  const setYearAndRef = useCallback((v: number) => {
    selectedRef.current.year = v;
    setSelectedYear(v);
  }, []);
  const setMonthAndRef = useCallback((v: number) => {
    selectedRef.current.month = v;
    setSelectedMonth(v);
  }, []);
  const setDayAndRef = useCallback((v: number) => {
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

  const years = Array.from({ length: 100 }, (_, i) => currentYear - 50 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  // month: 1-12 (Jan=1, Dec=12). new Date(y, m, 0) = last day of (m-1) in 0-indexed.
  // For 1-indexed month M: last day = new Date(year, M, 0).getDate()
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };
  const days = Array.from(
    { length: getDaysInMonth(selectedYear, selectedMonth) },
    (_, i) => i + 1,
  );
  // 순환 휠용: 월 3번 반복 [1..12, 1..12, 1..12], 일도 3번 반복
  const monthsTriple = [...months, ...months, ...months];
  const daysTriple = [...days, ...days, ...days];
  const MONTH_BLOCK = 12;

  // 월/년 변경 시 선택일이 해당 월 일수 초과면 마지막 날로 보정
  const maxDay = getDaysInMonth(selectedYear, selectedMonth);
  useEffect(() => {
    if (selectedDay > maxDay) {
      setDayAndRef(maxDay);
    }
  }, [selectedMonth, selectedYear, selectedDay, maxDay, setDayAndRef]);

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

  /**
   * 뷰포트 중앙에 오는 아이템 인덱스 계산 (하이라이트가 가운데이므로).
   * roundUpThreshold(0~1): 경계에서 다음 아이템으로 스냅하기 쉬우면 0.4 등 지정 (예: 28→1 전환 시 1에 안착).
   */
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

  /** 인덱스 아이템이 뷰포트 중앙에 오도록 스크롤. targetScroll는 정수로 맞춰 읽기/쓰기 일치시킴. */
  const scrollToValue = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    index: number,
    immediate: boolean = false,
  ) => {
    if (containerRef.current) {
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
      const guardMs = immediate ? 180 : 380;
      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, guardMs);
    }
  };

  // wrapTriple: 블록 크기(월 12, 일은 days.length). 리스트는 해당 블록 3번 반복
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

  // 드래그 시작 핸들러
  const handleDragStart = (
    e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
    containerRef: React.RefObject<HTMLDivElement | null>,
  ) => {
    if (!containerRef.current) return;

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

  // 드래그 중: triple 리스트일 때도 값만 논리값으로 표시 (점프는 드래그 끝에)
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
      if (index < blockSize) {
        setValue(items[index]);
      } else if (index >= blockSize * 2) {
        setValue(items[index - blockSize * 2]);
      } else {
        setValue(items[index - blockSize]);
      }
    } else {
      index = Math.max(0, Math.min(index, items.length - 1));
      setValue(items[index]);
    }
  };

  // 드래그 종료: triple이면 중간 블록으로 점프 후 스냅
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
    const resolvedIndex =
      blockSize > 0 && items.length === blockSize * 3
        ? Math.max(0, Math.min(index, items.length - 1))
        : Math.max(0, Math.min(index, items.length - 1));

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

  // 전역 이벤트 리스너 설정
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (
        !dragStateRef.current.isDragging ||
        !dragStateRef.current.containerRef
      )
        return;

      const { containerRef } = dragStateRef.current;
      if (containerRef === yearRef) {
        handleDragMove(e, years, setYearAndRef);
      } else if (containerRef === monthRef) {
        handleDragMove(e, monthsTriple, setMonthAndRef, {
          wrapTriple: MONTH_BLOCK,
        });
      } else if (containerRef === dayRef) {
        handleDragMove(e, daysTriple, setDayAndRef, {
          wrapTriple: days.length,
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
      if (containerRef === yearRef) {
        handleDragEnd(years, setYearAndRef);
      } else if (containerRef === monthRef) {
        handleDragEnd(monthsTriple, setMonthAndRef, {
          wrapTriple: MONTH_BLOCK,
        });
      } else if (containerRef === dayRef) {
        handleDragEnd(daysTriple, setDayAndRef, {
          wrapTriple: days.length,
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
      if (containerRef === yearRef) {
        handleDragMove(e, years, setYearAndRef);
      } else if (containerRef === monthRef) {
        handleDragMove(e, monthsTriple, setMonthAndRef, {
          wrapTriple: MONTH_BLOCK,
        });
      } else if (containerRef === dayRef) {
        handleDragMove(e, daysTriple, setDayAndRef, {
          wrapTriple: days.length,
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
      if (containerRef === yearRef) {
        handleDragEnd(years, setYearAndRef);
      } else if (containerRef === monthRef) {
        handleDragEnd(monthsTriple, setMonthAndRef, {
          wrapTriple: MONTH_BLOCK,
        });
      } else if (containerRef === dayRef) {
        handleDragEnd(daysTriple, setDayAndRef, {
          wrapTriple: days.length,
        });
      }
    };

    // 항상 이벤트 리스너 등록 (dragStateRef를 통해 상태 확인)
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
  }, []);

  // 초기 스크롤 (월/일은 중간 블록 인덱스 사용)
  useEffect(() => {
    const setInitialScroll = () => {
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
    };

    // requestAnimationFrame을 사용하여 DOM이 완전히 렌더링된 후 실행
    const rafId = requestAnimationFrame(() => {
      setInitialScroll();
      // 추가로 약간의 지연 후 다시 확인 (레이아웃이 완전히 계산된 후)
      setTimeout(setInitialScroll, 100);
      setTimeout(setInitialScroll, 300);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 날짜 변경 시 스크롤 업데이트 (월/일은 중간 블록 인덱스)
  useEffect(() => {
    if (monthRef.current) {
      const monthIndex = months.indexOf(selectedMonth);
      if (monthIndex !== -1) {
        scrollToValue(monthRef, MONTH_BLOCK + monthIndex, false);
      }
    }
    if (dayRef.current) {
      const dayIndex = days.indexOf(selectedDay);
      if (dayIndex !== -1) {
        scrollToValue(dayRef, days.length + dayIndex, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, selectedDay]);

  return (
    <div className="flex flex-col items-center mt-8">
      <div className="flex items-center justify-center gap-4 mb-16">
        {/* 년도 선택 */}
        <div className="relative">
          <div className="text-sm font-medium text-stone-600 mb-2 text-center">
            년
          </div>
          <div className="relative w-20 h-40 overflow-hidden rounded-lg bg-white shadow-sm">
            {/* 선택 영역 하이라이트 */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-stone-100/50 border-y-2 border-stone-300 pointer-events-none z-10" />

            <div
              ref={yearRef}
              className="h-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory cursor-grab active:cursor-grabbing"
              role="listbox"
              tabIndex={0}
              onScroll={() => handleScroll(yearRef, years, setYearAndRef)}
              onTouchStart={(e) => handleDragStart(e, yearRef)}
              onMouseDown={(e) => handleDragStart(e, yearRef)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const currentIndex = years.indexOf(selectedYear);
                  const newIndex =
                    e.key === "ArrowUp"
                      ? Math.max(0, currentIndex - 1)
                      : Math.min(years.length - 1, currentIndex + 1);
                  setYearAndRef(years[newIndex]);
                  scrollToValue(yearRef, newIndex);
                }
              }}
              style={{
                scrollSnapType: "y mandatory",
              }}
            >
              {/* 상단 패딩 */}
              <div className="h-[calc(50%-24px)]" />

              {years.map((year) => (
                <div
                  key={year}
                  className="h-12 flex items-center justify-center snap-center text-lg font-semibold text-stone-900"
                >
                  {year}
                </div>
              ))}

              {/* 하단 패딩 */}
              <div className="h-[calc(50%-24px)]" />
            </div>
          </div>
        </div>

        {/* 월 선택 (순환: 12 아래 1, 1 위 12) */}
        <div className="relative">
          <div className="text-sm font-medium text-stone-600 mb-2 text-center">
            월
          </div>
          <div className="relative w-16 h-40 overflow-hidden rounded-lg bg-white shadow-sm">
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
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const currentIndex = months.indexOf(selectedMonth);
                  let newIndex: number;
                  if (e.key === "ArrowUp") {
                    newIndex =
                      currentIndex <= 0 ? months.length - 1 : currentIndex - 1;
                  } else {
                    newIndex =
                      currentIndex >= months.length - 1 ? 0 : currentIndex + 1;
                  }
                  setMonthAndRef(months[newIndex]);
                  scrollToValue(monthRef, MONTH_BLOCK + newIndex, false);
                }
              }}
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
        </div>

        {/* 일 선택 (순환: 마지막일 아래 1, 1 위 마지막일) */}
        <div className="relative">
          <div className="text-sm font-medium text-stone-600 mb-2 text-center">
            일
          </div>
          <div className="relative w-16 h-40 overflow-hidden rounded-lg bg-white shadow-sm">
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
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const currentIndex = days.indexOf(selectedDay);
                  let newIndex: number;
                  if (e.key === "ArrowUp") {
                    newIndex =
                      currentIndex <= 0 ? days.length - 1 : currentIndex - 1;
                  } else {
                    newIndex =
                      currentIndex >= days.length - 1 ? 0 : currentIndex + 1;
                  }
                  setDayAndRef(days[newIndex]);
                  scrollToValue(dayRef, days.length + newIndex, false);
                }
              }}
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
        </div>
      </div>

      {/* 다음 버튼 - 클릭 시 최종 선택 날짜를 명시적으로 저장 후 전환 */}
      <button
        type="button"
        onClick={() => {
          const cb = onDateChangeRef.current;
          if (cb) {
            cb({
              year: selectedRef.current.year,
              month: selectedRef.current.month,
              day: selectedRef.current.day,
            });
          }
          if (onNext) {
            onNext();
          }
        }}
        className="px-8 py-3 text-white rounded-lg font-semibold text-lg transition-colors shadow-md hover:opacity-90 active:opacity-80"
        style={{ backgroundColor: "#FFAAB8" }}
      >
        다음
      </button>
    </div>
  );
}
