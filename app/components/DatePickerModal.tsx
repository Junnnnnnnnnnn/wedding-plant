"use client";

import React, { useState } from "react";

type DatePickerModalProps = {
  isOpen: boolean;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onClose: () => void;
};

export default function DatePickerModal({
  isOpen,
  selectedDate,
  onDateChange,
  onClose,
}: DatePickerModalProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate);

  // 캘린더 관련 함수들
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    setCurrentDate(newDate);
    onDateChange(newDate);
    onClose();
  };

  const handleMonthChange = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(year);
    setCurrentDate(newDate);
  };

  const handleMonthSelect = (month: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month);
    setCurrentDate(newDate);
  };

  // 모달이 열릴 때 selectedDate로 초기화
  React.useEffect(() => {
    if (isOpen) {
      setCurrentDate(selectedDate);
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="bg-white rounded-2xl w-full max-w-sm h-[520px] flex flex-col p-6"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-modal="true"
        aria-label="날짜 선택"
      >
        {/* 헤더 - 년/월 선택 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleMonthChange(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
            aria-label="이전 월"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            <select
              value={currentDate.getFullYear()}
              onChange={(e) => handleYearSelect(Number(e.target.value))}
              className="text-lg font-semibold text-stone-900 bg-transparent border-none outline-none cursor-pointer"
              aria-label="년도 선택"
            >
              {Array.from({ length: 100 }, (_, i) => {
                const year = new Date().getFullYear() - 50 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
            <select
              value={currentDate.getMonth()}
              onChange={(e) => handleMonthSelect(Number(e.target.value))}
              className="text-lg font-semibold text-stone-900 bg-transparent border-none outline-none cursor-pointer"
              aria-label="월 선택"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}월
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => handleMonthChange(1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
            aria-label="다음 월"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>

        {/* 달력 그리드 */}
        <div className="flex-1 flex flex-col min-h-0 mb-4">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-2 flex-shrink-0">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-semibold text-stone-600 py-1.5"
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 - 항상 6주(42일) 표시 */}
          <div className="grid grid-cols-7 gap-1 flex-1">
            {Array.from({ length: 42 }, (_, i) => {
              const firstDay = getFirstDayOfMonth(
                currentDate.getFullYear(),
                currentDate.getMonth(),
              );
              const daysInMonth = getDaysInMonth(
                currentDate.getFullYear(),
                currentDate.getMonth(),
              );
              const day = i - firstDay + 1;
              const isCurrentMonth = day > 0 && day <= daysInMonth;
              const isPrevMonth = day <= 0;
              const isNextMonth = day > daysInMonth;

              // 이전/다음 달 날짜 계산
              let displayDay = day;

              if (isPrevMonth) {
                const prevMonth = new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth() - 1,
                );
                const prevDaysInMonth = getDaysInMonth(
                  prevMonth.getFullYear(),
                  prevMonth.getMonth(),
                );
                displayDay = prevDaysInMonth + day;
              } else if (isNextMonth) {
                displayDay = day - daysInMonth;
              }

              const today = new Date();
              const isToday =
                isCurrentMonth &&
                day === today.getDate() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getFullYear() === today.getFullYear();
              const isSelected =
                isCurrentMonth &&
                day === selectedDate.getDate() &&
                currentDate.getMonth() === selectedDate.getMonth() &&
                currentDate.getFullYear() === selectedDate.getFullYear();

              let className =
                "rounded-lg text-sm font-semibold transition-colors flex items-center justify-center ";
              if (isSelected) {
                className += "bg-[#FFAAB8] text-white";
              } else if (isToday) {
                className +=
                  "bg-[#FFF5F2] text-[#FFAAB8] border-2 border-[#FFAAB8]";
              } else if (isCurrentMonth) {
                className += "text-stone-700 hover:bg-stone-100";
              } else {
                className += "text-stone-300";
              }

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (isCurrentMonth) {
                      handleDateSelect(day);
                    }
                  }}
                  disabled={!isCurrentMonth}
                  className={className}
                >
                  {isCurrentMonth ? day : displayDay}
                </button>
              );
            })}
          </div>
        </div>

        {/* 닫기 버튼 */}
        <div className="flex justify-end flex-shrink-0 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#FFAAB8] text-white font-semibold rounded-xl hover:bg-[#FF8FA3] transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
