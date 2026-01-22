"use client";

import { useState, useEffect, useRef } from "react";

type DatePickerWheelProps = {
  onDateChange?: (date: { year: number; month: number; day: number }) => void;
  onNext?: () => void;
};

export function DatePickerWheel({ onDateChange, onNext }: DatePickerWheelProps) {
  const currentYear = new Date().getFullYear();
  
  // sessionStorage에서 저장된 날짜 불러오기
  const getStoredDate = () => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("weddingDate");
      if (stored) {
        try {
          const date = JSON.parse(stored);
          return {
            year: date.year || 1995,
            month: date.month || 1,
            day: date.day || 5,
          };
        } catch {
          // 파싱 실패 시 기본값 반환
        }
      }
    }
    return { year: 1995, month: 1, day: 5 };
  };

  const storedDate = getStoredDate();
  const [selectedYear, setSelectedYear] = useState(storedDate.year);
  const [selectedMonth, setSelectedMonth] = useState(storedDate.month);
  const [selectedDay, setSelectedDay] = useState(storedDate.day);

  const yearRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);

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

  const years = Array.from({ length: 100 }, (_, i) => currentYear - 50 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };
  const days = Array.from(
    { length: getDaysInMonth(selectedYear, selectedMonth) },
    (_, i) => i + 1
  );

  useEffect(() => {
    if (onDateChange) {
      onDateChange({ year: selectedYear, month: selectedMonth, day: selectedDay });
    }
  }, [selectedYear, selectedMonth, selectedDay, onDateChange]);

  const itemHeight = 48; // h-12 = 48px

  // 상단 패딩 높이 계산 헬퍼 함수
  const getTopPadding = (container: HTMLDivElement): number => {
    const firstChild = container.firstElementChild as HTMLElement;
    return firstChild ? firstChild.offsetHeight : 0;
  };

  const scrollToValue = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    value: number,
    immediate: boolean = false
  ) => {
    if (containerRef.current) {
      const container = containerRef.current;
      const topPadding = getTopPadding(container);
      // 스크롤 위치 = 상단 패딩 + (인덱스 * 아이템 높이)
      const scrollPosition = topPadding + (value * itemHeight);
      
      container.scrollTo({
        top: scrollPosition,
        behavior: immediate ? "auto" : "smooth",
      });
    }
  };

  const handleScroll = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    items: number[],
    setValue: (value: number) => void
  ) => {
    if (containerRef.current && !dragStateRef.current.isDragging) {
      const container = containerRef.current;
      const topPadding = getTopPadding(container);
      const scrollTop = container.scrollTop;
      const adjustedScrollTop = scrollTop - topPadding;
      const index = Math.round(adjustedScrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
      const newValue = items[clampedIndex];
      setValue(newValue);

      // 스냅 효과
      const snapPosition = topPadding + (clampedIndex * itemHeight);
      container.scrollTo({
        top: snapPosition,
        behavior: "smooth",
      });
    }
  };

  // 드래그 시작 핸들러
  const handleDragStart = (
    e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
    containerRef: React.RefObject<HTMLDivElement | null>
  ) => {
    if (!containerRef.current) return;
    
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStateRef.current = {
      isDragging: true,
      startY: clientY,
      startScrollTop: containerRef.current.scrollTop,
      containerRef,
    };
    
    containerRef.current.style.cursor = "grabbing";
    containerRef.current.style.userSelect = "none";
  };

  // 드래그 중 핸들러
  const handleDragMove = (
    e: TouchEvent | MouseEvent,
    items: number[],
    setValue: (value: number) => void
  ) => {
    if (!dragStateRef.current.isDragging || !dragStateRef.current.containerRef?.current) return;

    const container = dragStateRef.current.containerRef.current;
    const topPadding = getTopPadding(container);
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStateRef.current.startY - clientY;
    const newScrollTop = dragStateRef.current.startScrollTop + deltaY;
    
    // 스크롤 범위 제한 (상단 패딩 고려)
    const maxScroll = topPadding + ((items.length - 1) * itemHeight);
    const clampedScrollTop = Math.max(topPadding, Math.min(newScrollTop, maxScroll));
    container.scrollTop = clampedScrollTop;

    // 실시간 값 업데이트
    const adjustedScrollTop = clampedScrollTop - topPadding;
    const index = Math.round(adjustedScrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    const newValue = items[clampedIndex];
    setValue(newValue);
  };

  // 드래그 종료 핸들러
  const handleDragEnd = (
    items: number[],
    setValue: (value: number) => void
  ) => {
    if (!dragStateRef.current.isDragging || !dragStateRef.current.containerRef?.current) return;

    const container = dragStateRef.current.containerRef.current;
    const topPadding = getTopPadding(container);
    container.style.cursor = "grab";
    container.style.userSelect = "";

    // 스냅 효과
    const scrollTop = container.scrollTop;
    const adjustedScrollTop = scrollTop - topPadding;
    const index = Math.round(adjustedScrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    const snapPosition = topPadding + (clampedIndex * itemHeight);
    
    container.scrollTo({
      top: snapPosition,
      behavior: "smooth",
    });

    const newValue = items[clampedIndex];
    setValue(newValue);

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
      if (!dragStateRef.current.isDragging || !dragStateRef.current.containerRef) return;
      
      const containerRef = dragStateRef.current.containerRef;
      if (containerRef === yearRef) {
        handleDragMove(e, years, setSelectedYear);
      } else if (containerRef === monthRef) {
        handleDragMove(e, months, setSelectedMonth);
      } else if (containerRef === dayRef) {
        handleDragMove(e, days, setSelectedDay);
      }
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current.isDragging || !dragStateRef.current.containerRef) return;
      
      const containerRef = dragStateRef.current.containerRef;
      if (containerRef === yearRef) {
        handleDragEnd(years, setSelectedYear);
      } else if (containerRef === monthRef) {
        handleDragEnd(months, setSelectedMonth);
      } else if (containerRef === dayRef) {
        handleDragEnd(days, setSelectedDay);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.isDragging || !dragStateRef.current.containerRef) return;
      e.preventDefault();
      
      const containerRef = dragStateRef.current.containerRef;
      if (containerRef === yearRef) {
        handleDragMove(e, years, setSelectedYear);
      } else if (containerRef === monthRef) {
        handleDragMove(e, months, setSelectedMonth);
      } else if (containerRef === dayRef) {
        handleDragMove(e, days, setSelectedDay);
      }
    };

    const handleTouchEnd = () => {
      if (!dragStateRef.current.isDragging || !dragStateRef.current.containerRef) return;
      
      const containerRef = dragStateRef.current.containerRef;
      if (containerRef === yearRef) {
        handleDragEnd(years, setSelectedYear);
      } else if (containerRef === monthRef) {
        handleDragEnd(months, setSelectedMonth);
      } else if (containerRef === dayRef) {
        handleDragEnd(days, setSelectedDay);
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

  // 초기 스크롤 위치 설정
  useEffect(() => {
    // 즉시 스크롤 위치 설정 (애니메이션 없이)
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
          scrollToValue(monthRef, monthIndex, true);
        }
      }
      if (dayRef.current) {
        const dayIndex = days.indexOf(selectedDay);
        if (dayIndex !== -1) {
          scrollToValue(dayRef, dayIndex, true);
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

  // 날짜 변경 시 스크롤 업데이트
  useEffect(() => {
    if (dayRef.current) {
      const dayIndex = days.indexOf(selectedDay);
      if (dayIndex !== -1) {
        scrollToValue(dayRef, dayIndex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, selectedDay]);

  return (
    <div className="flex flex-col items-center mt-8">
      <div className="flex items-center justify-center gap-4 mb-16">
        {/* 년도 선택 */}
        <div className="relative">
          <div className="text-sm font-medium text-stone-600 mb-2 text-center">년</div>
          <div className="relative w-20 h-40 overflow-hidden rounded-lg bg-white shadow-sm">
            {/* 선택 영역 하이라이트 */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-stone-100/50 border-y-2 border-stone-300 pointer-events-none z-10" />
            
            <div
              ref={yearRef}
              className="h-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory cursor-grab active:cursor-grabbing"
              onScroll={() => handleScroll(yearRef, years, setSelectedYear)}
              onTouchStart={(e) => handleDragStart(e, yearRef)}
              onMouseDown={(e) => handleDragStart(e, yearRef)}
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

        {/* 월 선택 */}
        <div className="relative">
          <div className="text-sm font-medium text-stone-600 mb-2 text-center">월</div>
          <div className="relative w-16 h-40 overflow-hidden rounded-lg bg-white shadow-sm">
            {/* 선택 영역 하이라이트 */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-stone-100/50 border-y-2 border-stone-300 pointer-events-none z-10" />
            
            <div
              ref={monthRef}
              className="h-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory cursor-grab active:cursor-grabbing"
              onScroll={() => handleScroll(monthRef, months, setSelectedMonth)}
              onTouchStart={(e) => handleDragStart(e, monthRef)}
              onMouseDown={(e) => handleDragStart(e, monthRef)}
              style={{
                scrollSnapType: "y mandatory",
              }}
            >
              {/* 상단 패딩 */}
              <div className="h-[calc(50%-24px)]" />
              
              {months.map((month) => (
                <div
                  key={month}
                  className="h-12 flex items-center justify-center snap-center text-lg font-semibold text-stone-900"
                >
                  {month}
                </div>
              ))}
              
              {/* 하단 패딩 */}
              <div className="h-[calc(50%-24px)]" />
            </div>
          </div>
        </div>

        {/* 일 선택 */}
        <div className="relative">
          <div className="text-sm font-medium text-stone-600 mb-2 text-center">일</div>
          <div className="relative w-16 h-40 overflow-hidden rounded-lg bg-white shadow-sm">
            {/* 선택 영역 하이라이트 */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-stone-100/50 border-y-2 border-stone-300 pointer-events-none z-10" />
            
            <div
              ref={dayRef}
              className="h-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory cursor-grab active:cursor-grabbing"
              onScroll={() => handleScroll(dayRef, days, setSelectedDay)}
              onTouchStart={(e) => handleDragStart(e, dayRef)}
              onMouseDown={(e) => handleDragStart(e, dayRef)}
              style={{
                scrollSnapType: "y mandatory",
              }}
            >
              {/* 상단 패딩 */}
              <div className="h-[calc(50%-24px)]" />
              
              {days.map((day) => (
                <div
                  key={day}
                  className="h-12 flex items-center justify-center snap-center text-lg font-semibold text-stone-900"
                >
                  {day}
                </div>
              ))}
              
              {/* 하단 패딩 */}
              <div className="h-[calc(50%-24px)]" />
            </div>
          </div>
        </div>
      </div>

      {/* 다음 버튼 */}
      <button
        onClick={() => {
          // sessionStorage에 날짜 저장
          if (typeof window !== "undefined") {
            sessionStorage.setItem(
              "weddingDate",
              JSON.stringify({
                year: selectedYear,
                month: selectedMonth,
                day: selectedDay,
              })
            );
          }
          // 기존 onNext 콜백 호출
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
