"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, LogOut } from "lucide-react";
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
        const res = await fetchWithAuth("/plan/setting", {
          method: "POST",
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

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:px-6"
      role="dialog"
      aria-modal="true"
      aria-label="프로필 수정"
    >
      <div className="flex h-full w-full max-w-[500px] flex-col overflow-y-auto bg-[#FFF5F2] px-6">
        {/* 헤더: 닫기 */}
        <div className="flex w-full items-center justify-end pt-6 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-200/60 hover:text-stone-900"
            aria-label="닫기"
          >
            <X className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>

        <div className="w-full pt-2 pb-8">
          <h1 className="text-xl font-semibold text-stone-900">프로필 수정</h1>

          <div className="mt-6 flex w-full flex-col gap-5">
            {/* 이름 */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-name" className="text-sm font-medium text-stone-600">
                이름
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="이름 또는 닉네임 (최대 5글자)"
                maxLength={5}
                className={`w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-[#FFAAB8] focus:outline-none ${nameShake ? "animate-shake" : ""}`}
              />
            </div>

            {/* 결혼식 날짜 */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-date" className="text-sm font-medium text-stone-600">
                결혼식 날짜
              </label>
              <input
                id="profile-date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base text-stone-900 focus:border-[#FFAAB8] focus:outline-none"
              />
            </div>

            {/* 보유 예산 */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-budget" className="text-sm font-medium text-stone-600">
                보유 예산 (만 원)
              </label>
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
    </div>
  );
}
