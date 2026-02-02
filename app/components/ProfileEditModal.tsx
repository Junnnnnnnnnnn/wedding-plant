"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, LogOut } from "lucide-react";
import DatePickerModal from "./DatePickerModal";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import { getToken, clearAllStoredData } from "@/lib/api";

export type ProfileDisplayData = {
  name: string;
  date?: { year: number; month: number; day: number };
  budget: string;
};

type ProfileEditModalProps = {
  show: boolean;
  onClose: () => void;
  displayData: ProfileDisplayData;
  onSaved?: () => void;
};

function toDateString(d: { year: number; month: number; day: number }) {
  const m = String(d.month).padStart(2, "0");
  const day = String(d.day).padStart(2, "0");
  return `${d.year}-${m}-${day}`;
}

function parseDateString(s: string): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!s || s.length < 10) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { year: y, month: m, day: d };
}

function dateToDisplayStr(d: { year: number; month: number; day: number }) {
  const m = String(d.month).padStart(2, "0");
  const day = String(d.day).padStart(2, "0");
  return `${d.year}-${m}-${day}`;
}

export default function ProfileEditModal({
  show,
  onClose,
  displayData,
  onSaved,
}: ProfileEditModalProps) {
  const router = useRouter();
  const { setBudget, setName, setDate, resetData } = useWedding();
  const { fetchWithAuth } = useApi();

  const [name, setNameLocal] = useState(displayData.name);
  const [dateStr, setDateStr] = useState("");
  const [budget, setBudgetLocal] = useState(displayData.budget);
  const [saving, setSaving] = useState(false);
  const [nameShake, setNameShake] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Sync form when modal opens or displayData changes
  useEffect(() => {
    if (!show) return;
    setNameLocal(displayData.name ?? "");
    setBudgetLocal(displayData.budget ?? "1000");
    if (displayData.date) {
      setDateStr(toDateString(displayData.date));
    } else {
      const today = new Date();
      setDateStr(
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
      );
    }
  }, [show, displayData.name, displayData.budget, displayData.date]);

  const handleSave = async () => {
    const date = parseDateString(dateStr);
    if (!date) return;
    const nameTrim = name.trim();
    if (!nameTrim) return;

    setSaving(true);
    try {
      setName(nameTrim);
      setDate(date);
      setBudget(budget);

      if (getToken()) {
        const weddingDate = toDateString(date);
        const res = await fetchWithAuth("/plan/user", {
          method: "PATCH",
          body: JSON.stringify({
            weddingDate,
            budget: Number(budget) || 0,
            name: nameTrim,
          }),
        });
        if (!res.ok) {
          await res.json().catch(() => ({}));
        }
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearAllStoredData();
    resetData();
    onClose();
    router.replace("/?api_error=0");
  };

  const handleNameChange = (value: string) => {
    if (value.length > 5) {
      setNameShake(true);
      setTimeout(() => setNameShake(false), 400);
      setNameLocal(value.slice(0, 5));
    } else {
      setNameLocal(value);
    }
  };

  const date = parseDateString(dateStr);
  const canSave =
    name.trim().length > 0 &&
    date !== null &&
    budget.trim().length > 0 &&
    !saving;

  const selectedDateAsDate = useMemo(() => {
    if (date) return new Date(date.year, date.month - 1, date.day);
    return new Date();
  }, [date]);

  const handleDateChangeFromPicker = (newDate: Date) => {
    setDateStr(
      `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`,
    );
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6"
      role="dialog"
      aria-modal="true"
      aria-label="프로필 수정"
    >
      <div className="flex h-full w-full max-w-[500px] flex-col overflow-y-auto bg-[#FFF5F2] px-6">
        {/* 헤더: 사용자 정보 / 우측 닫기 */}
        <div className="w-full pt-8">
          <div className="w-full flex items-center justify-between">
            <div className="flex flex-col items-start justify-start min-w-0 flex-1">
              <span className="text-[42px] font-semibold text-[#000000] leading-none">
                사용자 정보
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full cursor-pointer bg-stone-200/60 text-stone-600 transition-opacity hover:opacity-90 hover:text-stone-900"
              aria-label="닫기"
            >
              <X className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="w-full pt-6 pb-8">
          <div className="mt-6 flex w-full flex-col gap-5">
            {/* 이름 */}
            <div className="flex flex-col gap-1.5">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-600">
                이름
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="이름 또는 닉네임 (최대 5글자)"
                  maxLength={5}
                  className={`w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-[#FFAAB8] focus:outline-none ${nameShake ? "animate-shake" : ""}`}
                />
              </label>
            </div>

            {/* 결혼식 날짜 - add-plen 일자 영역 레이아웃 + DatePickerModal */}
            <div className="flex flex-col gap-1.5">
              {/* Custom date trigger; label associated via id on trigger */}
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className="text-sm font-medium text-stone-600">
                결혼식 날짜
              </label>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  id="profile-date"
                  className="flex-1 min-w-0 px-4 py-3.5 text-base font-semibold rounded-xl border-2 border-stone-200 bg-white text-stone-900 cursor-pointer hover:border-[#FFAAB8] transition-colors"
                  onClick={() => setIsDatePickerOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsDatePickerOpen(true);
                    }
                  }}
                >
                  {date ? dateToDisplayStr(date) : "날짜 선택"}
                </div>
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(true)}
                  className="px-4 py-3.5 rounded-xl border-2 border-stone-200 hover:border-[#FFAAB8] transition-colors flex-shrink-0 flex items-center justify-center"
                  aria-label="날짜 선택"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#FF8FA3"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* 보유 예산 */}
            <div className="flex flex-col gap-1.5">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-600">
                보유 예산 (만 원)
                <input
                  id="profile-budget"
                  type="number"
                  inputMode="numeric"
                  value={budget}
                  onChange={(e) => setBudgetLocal(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-[#FFAAB8] focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* 저장 버튼 */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="mt-8 w-full rounded-full bg-[#FFAAB8] py-3 text-base font-semibold text-white transition-colors hover:bg-[#FF9AA8] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:hover:bg-stone-300"
          >
            {saving ? "저장 중…" : "저장"}
          </button>

          {/* 로그아웃 - 하단 고정 느낌 */}
          <div className="mt-10 border-t border-stone-200 pt-6">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-stone-300 py-3 text-base font-semibold text-stone-600 transition-colors hover:border-stone-400 hover:bg-stone-100 hover:text-stone-800"
            >
              <LogOut className="h-5 w-5" strokeWidth={2} />
              로그아웃
            </button>
          </div>
        </div>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        selectedDate={selectedDateAsDate}
        onDateChange={handleDateChangeFromPicker}
        onClose={() => setIsDatePickerOpen(false)}
      />
    </div>
  );
}
