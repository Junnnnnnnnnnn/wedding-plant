"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Calendar,
  User,
  Wallet,
  LogOut,
  Check,
  Heart,
  Sparkles,
} from "lucide-react";
import { parseLocalDate, getDaysUntil } from "@/lib/utils";
import DatePickerModal from "./DatePickerModal";

interface SettingsPageProps {
  user: {
    name: string;
    weddingDate: string;
    budget: number;
    profileImageUrl?: string | null;
    requiredAgreementDate?: string | null;
    adAgreementDate?: string | null;
  };
  /** 저장 성공 여부를 반환한다. 성공했을 때만 완료 표시를 띄운다. */
  onSave: (user: {
    name: string;
    weddingDate: string;
    budget: number;
    requiredAgreementDate?: string | null;
    adAgreementDate?: string | null;
  }) => Promise<boolean> | boolean | void;
  onClose: () => void;
  onSignOut?: () => void;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  onSave,
  onClose,
  onSignOut,
}) => {
  const [formData, setFormData] = useState(user);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const selectedDate = useMemo(() => {
    if (!formData.weddingDate) return new Date();
    const d = parseLocalDate(formData.weddingDate);
    return d ?? new Date();
  }, [formData.weddingDate]);

  const nameError =
    formData.name.trim() === "" ? "이름을 입력해 주세요." : null;

  const handleSave = async () => {
    if (isSaving) return;
    if (nameError) {
      setSaveError(nameError);
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      // 저장 결과를 기다린 뒤에만 완료 표시를 띄운다.
      const ok = await onSave({ ...formData, name: formData.name.trim() });
      if (ok === false) {
        setSaveError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      setSaveError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (date: Date) => {
    setFormData({ ...formData, weddingDate: formatDate(date) });
  };

  // 결혼식까지 남은 일수 (KST 기준, 지난 날짜는 음수)
  const daysRemaining = (() => {
    const d = parseLocalDate(formData.weddingDate);
    if (!d) return 0;
    return getDaysUntil({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    });
  })();

  /** 미래는 D-N, 당일은 D-Day, 지난 날짜는 D+N */
  const ddayLabel =
    daysRemaining > 0
      ? `D-${daysRemaining}`
      : daysRemaining === 0
        ? "D-Day"
        : `D+${Math.abs(daysRemaining)}`;

  return (
    <div className="flex-1 flex flex-col bg-[#fcfbfc] animate-in slide-in-from-right duration-300 relative overflow-hidden">
      {/* Decorative background elements matching the main theme */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-[#ee2b8c0a] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#ee2b8c05] rounded-full blur-3xl pointer-events-none" />

      {/* 헤더 + 닫기 버튼 */}
      <header className="px-6 pt-12 pb-6 flex justify-between items-center relative z-10 w-full md:mx-auto md:max-w-[640px] md:px-8 md:pt-10">
        <div className="flex items-center gap-4">
          {/* 프로필 사진: 있으면 이미지, 없으면 이름 첫 글자 원형 */}
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt="프로필"
              className="w-14 h-14 rounded-full object-cover border-2 border-[#ee2b8c22] shadow-sm flex-shrink-0"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ee2b8c] to-[#ff7eb3] flex items-center justify-center text-white text-xl font-black flex-shrink-0 shadow-sm border-2 border-[#ee2b8c22]"
              aria-hidden
            >
              {user.name?.trim().charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          <div>
            <h2 className="text-3xl font-black text-[#1b0d14] tracking-tight">
              프로필
            </h2>
            <p className="text-xs font-bold text-[#ee2b8c88] uppercase tracking-widest mt-1">
              결혼 정보를 관리해요
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm hover:bg-gray-50 transition-all border border-[#ee2b8c11] active:scale-90"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>
      </header>

      <div className="flex-1 px-6 space-y-8 overflow-y-auto no-scrollbar pb-40 relative z-10 w-full md:mx-auto md:max-w-[640px] md:px-8 md:pb-16">
        {/* 결혼식 D-day 카드 */}
        <div className="bg-gradient-to-br from-[#ee2b8c] to-[#ff7eb3] p-6 rounded-[32px] text-white shadow-xl shadow-[#ee2b8c22] relative overflow-hidden">
          <Heart className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[10px] font-extrabold uppercase tracking-widest mb-1">
                결혼식 날짜
              </p>
              <h3 className="text-2xl font-bold">{formData.name}님</h3>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
              <span className="text-xl font-black">{ddayLabel}</span>
            </div>
          </div>
        </div>

        {/* 폼 섹션 */}
        <div className="space-y-6">
          <section className="space-y-4">
            <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
              <User className="w-3 h-3" /> 기본 정보
            </h4>

            {/* Name Input */}
            <div className="group space-y-2">
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#ee2b8c] transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="이름"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full h-16 pl-14 pr-6 bg-white border border-[#ee2b8c0a] rounded-3xl shadow-sm outline-none focus:ring-4 focus:ring-[#ee2b8c0a] focus:border-[#ee2b8c44] font-bold text-lg text-[#1b0d14] transition-all"
                />
              </div>
            </div>

            {/* 결혼식 날짜 - DatePickerModal 사용 (add-plen과 동일) */}
            <div className="group space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#ee2b8c] transition-colors pointer-events-none">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div
                    onClick={() => setIsDatePickerOpen(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIsDatePickerOpen(true);
                      }
                    }}
                    className="w-full h-16 pl-14 pr-6 bg-white border border-[#ee2b8c0a] rounded-3xl shadow-sm outline-none focus:ring-4 focus:ring-[#ee2b8c0a] focus:border-[#ee2b8c44] font-bold text-lg text-[#1b0d14] transition-all flex items-center cursor-pointer hover:border-[#ee2b8c44]"
                  >
                    {formData.weddingDate || "날짜 선택"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(true)}
                  className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center hover:from-purple-100 hover:to-purple-200 transition-all shadow-sm"
                  aria-label="날짜 선택"
                >
                  <Calendar className="w-6 h-6 text-purple-600" />
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
              <Wallet className="w-3 h-3" /> 예산 설정
            </h4>

            {/* Budget Input */}
            <div className="group space-y-2">
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#ee2b8c] transition-colors">
                  <Wallet className="w-5 h-5" />
                </div>
                <input
                  type="number"
                  min={0}
                  placeholder="보유 예산 (만 원)"
                  value={formData.budget}
                  onChange={(e) => {
                    // 빈 값은 0으로, 음수는 0으로 막는다 (0은 유효한 예산)
                    const raw = e.target.value;
                    const n = raw === "" ? 0 : Number(raw);
                    setFormData({
                      ...formData,
                      budget: Number.isFinite(n) ? Math.max(0, n) : 0,
                    });
                  }}
                  className="input-font-theme input-no-spinner w-full h-16 pl-14 pr-6 bg-white border border-[#ee2b8c0a] rounded-3xl shadow-sm outline-none focus:ring-4 focus:ring-[#ee2b8c0a] focus:border-[#ee2b8c44] font-bold text-lg text-[#1b0d14] transition-all"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">
                  만원
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 pt-4">
          {saveError && (
            <p
              role="alert"
              className="text-center text-sm font-bold text-[#c0203c] bg-[#c0203c11] rounded-2xl py-3 px-4"
            >
              {saveError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaved || isSaving}
            className={`w-full h-16 rounded-[24px] font-black text-lg transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-3 disabled:cursor-not-allowed ${
              isSaved
                ? "bg-green-500 text-white shadow-green-100"
                : "bg-[#1b0d14] text-white hover:bg-[#3a1c2b] shadow-[#1b0d1422] disabled:opacity-70"
            }`}
          >
            {isSaved ? (
              <Check className="w-6 h-6 animate-bounce" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#ee2b8c]" />
            )}
            {isSaved ? "저장되었어요" : isSaving ? "저장 중..." : "프로필 수정"}
          </button>

          <div className="pt-8">
            {confirmSignOut ? (
              // 로그아웃은 저장된 플랜 데이터까지 지우므로 한 번 더 확인받는다
              <div className="space-y-3 rounded-[20px] border border-[#ee2b8c22] bg-[#ee2b8c08] p-4">
                <p className="text-center text-sm font-bold text-[#1b0d14]">
                  로그아웃하면 이 기기에 저장된 플랜 정보가 지워집니다.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmSignOut(false)}
                    className="flex-1 h-12 rounded-2xl border border-gray-200 bg-white font-bold text-sm text-[#1b0d14] hover:bg-gray-50 transition-all"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex-1 h-12 rounded-2xl bg-[#ee2b8c] font-bold text-sm text-white hover:bg-[#d4237b] transition-all"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="w-full h-14 bg-[#ee2b8c08] border border-[#ee2b8c11] rounded-[20px] font-bold text-[#ee2b8cbb] hover:text-[#ee2b8c] hover:bg-[#ee2b8c11] transition-all flex items-center justify-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            )}
            <p className="text-center text-[10px] text-gray-300 font-bold uppercase tracking-widest mt-6">
              공지 사항 및 소개
            </p>
          </div>
        </div>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onClose={() => setIsDatePickerOpen(false)}
      />
    </div>
  );
};

export default SettingsPage;
