"use client";

import React, { useState, useMemo } from "react";
import { X, Calendar, Wallet, LogOut, Check, MapPin } from "lucide-react";
import { parseLocalDate, getDaysUntil } from "@/lib/utils";
import DatePickerModal from "./DatePickerModal";

interface SettingsPageProps {
  user: {
    name: string;
    weddingDate: string;
    weddingVenue?: string | null;
    budget: number;
    profileImageUrl?: string | null;
    requiredAgreementDate?: string | null;
    adAgreementDate?: string | null;
  };
  /** 저장 성공 여부를 반환한다. 성공했을 때만 완료 표시를 띄운다. */
  onSave: (user: {
    name: string;
    weddingDate: string;
    weddingVenue?: string | null;
    budget: number;
    requiredAgreementDate?: string | null;
    adAgreementDate?: string | null;
  }) => Promise<boolean> | boolean | void;
  onClose: () => void;
  onSignOut?: () => void;
  /**
   * 회원 탈퇴. 성공 여부를 반환한다.
   *
   * 게스트에게는 지울 계정이 없으므로 넘기지 않는다 — 없으면 탈퇴 줄 자체를
   * 내지 않는다.
   */
  onWithdraw?: () => Promise<boolean>;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-12-31" → "2026년 12월 31일 (목)". 못 읽으면 원문 그대로 */
function formatKoreanDate(value: string): string {
  const d = parseLocalDate(value);
  if (!d) return value || "";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${
    WEEKDAYS[d.getDay()]
  })`;
}

/** 라벨을 항상 띄우는 입력 상자.
 *
 * 예전에는 placeholder 만 있어서 값을 넣는 순간 무슨 칸인지 사라졌다 —
 * 화면에 `4200`, `2026-11-14` 만 남고 그게 예산인지 날짜인지 알 길이 없었다.
 */
const Field: React.FC<{
  label: string;
  /** 라벨 옆 회색 보조 문구 ("(선택)" 등) */
  labelHint?: string;
  /** 오른쪽 끝 단위·안내 ("만원", "눌러서 바꾸기") */
  suffix?: string;
  children: React.ReactNode;
}> = ({ label, labelHint, suffix, children }) => (
  <div className="rounded-2xl border border-[#efe7eb] bg-white px-4 py-2.5 transition-all focus-within:border-[#ee2b8c] focus-within:ring-4 focus-within:ring-[#ee2b8c14]">
    <div className="flex items-baseline justify-between gap-3">
      <label className="text-[11.5px] text-gray-400">
        {label}
        {labelHint && <span className="ml-1 text-gray-300">{labelHint}</span>}
      </label>
      {suffix && (
        <span className="shrink-0 text-[11.5px] text-gray-400">{suffix}</span>
      )}
    </div>
    {children}
  </div>
);

const INPUT_CLASS =
  "w-full bg-transparent text-[15px] font-bold tracking-[-0.01em] text-[#1b0d14] outline-none placeholder:font-normal placeholder:text-[#c8bfc4]";

const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  onSave,
  onClose,
  onSignOut,
  onWithdraw,
}) => {
  const [formData, setFormData] = useState(user);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
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

  const avatar = (size: "sm" | "lg") =>
    user.profileImageUrl ? (
      <img
        src={user.profileImageUrl}
        alt="프로필"
        className={`shrink-0 rounded-full border-2 border-[#ee2b8c22] object-cover ${
          size === "lg" ? "h-[68px] w-[68px]" : "h-11 w-11"
        }`}
      />
    ) : (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border-2 border-[#ee2b8c22] bg-gradient-to-br from-[#ee2b8c] to-[#ff7eb3] font-black text-white ${
          size === "lg" ? "h-[68px] w-[68px] text-[26px]" : "h-11 w-11 text-lg"
        }`}
        aria-hidden
      >
        {formData.name?.trim().charAt(0)?.toUpperCase() || "?"}
      </div>
    );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#fcfbfc]">
      {/* 다른 화면과 같은 머리글 띠 */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-100 bg-white px-6 py-4 md:px-8 md:py-5">
        <div className="flex min-w-0 items-center gap-3">
          {avatar("sm")}
          <div className="min-w-0">
            <h2 className="truncate text-[20px] font-bold leading-tight tracking-[-0.02em] text-[#1b0d14] md:text-[22px]">
              프로필
            </h2>
            <p className="mt-1 text-[12.5px] text-[#7a6c74]">
              결혼 정보를 관리해요
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* D-day 는 여기 한 곳에만 둔다. 옆 미리보기 카드에도 넣으면
              넓은 화면에서 같은 값이 두 번 보인다 */}
          <span className="rounded-full bg-[#fff2f6] px-3 py-1 text-[12.5px] font-bold text-[#ee2b8c]">
            {ddayLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600"
            aria-label="닫기"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/*
        @container: 2열 분기를 뷰포트가 아니라 이 영역이 실제로 차지한 폭으로
        정한다. 셸의 레일이 768/1024 에서 폭을 크게 바꾼다 (budget-detail 과
        같은 이유).
      */}
      <div className="@container no-scrollbar flex-1 overflow-y-auto px-4 py-4 pb-32 md:mx-auto md:w-full md:max-w-[1100px] md:px-8 md:pt-6 md:pb-10">
        <div className="grid gap-4 @[860px]:grid-cols-[320px_minmax(0,1fr)] @[860px]:items-start @[860px]:gap-5">
          {/*
            왼쪽 열. 좁으면 폼 아래로 내려간다(order) — 미리보기는 넓은 화면의
            덤이고, 폰에서 위에 두면 정작 고치러 온 폼이 화면 밖으로 밀린다.
            로그아웃도 폰에서는 맨 끝이 제자리다.
          */}
          <div className="order-2 grid gap-4 @[860px]:order-1">
            {/*
              "저장하면 이렇게 보인다" 미리보기. formData 를 그대로 읽으므로
              오른쪽에서 고치는 대로 같이 바뀐다 — 저장 전에 결과를 확인하는
              게 이 카드의 존재 이유라 user 가 아니라 formData 를 쓴다.
              좁을 때는 바로 위 폼과 같은 값을 두 번 보여줄 뿐이라 감춘다.
            */}
            <div className="hidden rounded-[28px] border border-[#ee2b8c0f] bg-white p-6 text-center shadow-sm @[860px]:block">
              <div className="mx-auto mt-1 mb-4 w-fit">{avatar("lg")}</div>
              <p className="truncate text-[19px] font-bold tracking-[-0.02em] text-[#1b0d14]">
                {formData.name.trim() || "이름을 입력해 주세요"}
              </p>

              <dl className="mt-4 text-left text-[12.5px]">
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="shrink-0 text-gray-400">결혼식</dt>
                  <dd className="truncate font-bold text-[#1b0d14]">
                    {formatKoreanDate(formData.weddingDate) || "미정"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-[#f4eff2] py-2.5">
                  <dt className="shrink-0 text-gray-400">예식장</dt>
                  <dd
                    className={`truncate ${
                      formData.weddingVenue?.trim()
                        ? "font-bold text-[#1b0d14]"
                        : "text-gray-400"
                    }`}
                  >
                    {formData.weddingVenue?.trim() || "미정"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-[#f4eff2] py-2.5">
                  <dt className="shrink-0 text-gray-400">예산</dt>
                  <dd className="font-user-content text-[15px] font-bold tracking-[-0.02em] text-[#1b0d14]">
                    {formData.budget.toLocaleString("ko-KR")}만원
                  </dd>
                </div>
              </dl>
            </div>

            {/*
              로그아웃과 탈퇴가 한 카드에 산다. 탈퇴를 위해 카드를 하나 더
              만들면 일 년에 한 번 쓸까 말까 한 동작이 매번 화면 한 칸을
              차지한다. 대신 구분선 아래 조용한 줄로 둔다 — 위험한 동작일수록
              눈에 덜 띄어야 실수로 눌리지 않는다.

              한 번에 하나만 묻는다. 로그아웃을 확인하는 중에는 탈퇴 줄이,
              탈퇴를 확인하는 중에는 로그아웃 버튼이 사라진다.
            */}
            <div className="rounded-[28px] border border-[#ee2b8c0f] bg-white p-5 shadow-sm">
              {confirmWithdraw ? (
                /*
                  탈퇴는 되돌릴 수 없다. "정말요?" 만 묻는 확인은 사용자가
                  답을 모르는 질문이라, 무엇이 사라지고 무엇이 남는지 먼저
                  적는다. 후기가 남는 것도 여기서 밝힌다 — 나중에 알게 되면
                  속았다고 느낀다.
                */
                <div className="space-y-3">
                  <p className="text-[13px] font-bold text-[#1b0d14]">
                    정말 탈퇴하시겠어요?
                  </p>
                  <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-gray-500">
                    <li>일정과 예산이 사라지고 되돌릴 수 없습니다.</li>
                    <li>함께 준비하던 사람의 방에서 나가집니다.</li>
                    <li>올린 견적 후기는 작성자 없이 남습니다.</li>
                  </ul>
                  {withdrawError && (
                    <p className="text-[12.5px] leading-relaxed text-[#c0203c]">
                      {withdrawError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isWithdrawing}
                      onClick={() => {
                        setConfirmWithdraw(false);
                        setWithdrawError(null);
                      }}
                      className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-[13px] font-bold text-[#1b0d14] transition-colors hover:bg-stone-50 disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={isWithdrawing}
                      onClick={async () => {
                        if (!onWithdraw) return;
                        setIsWithdrawing(true);
                        setWithdrawError(null);
                        const ok = await onWithdraw();
                        // 성공하면 화면이 통째로 바뀌므로 상태를 되돌릴
                        // 필요가 없다. 실패했을 때만 다시 누를 수 있게 푼다.
                        if (!ok) {
                          setIsWithdrawing(false);
                          setWithdrawError(
                            "탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.",
                          );
                        }
                      }}
                      className="h-11 flex-1 rounded-xl bg-[#c0203c] text-[13px] font-bold text-white transition-colors hover:bg-[#a51b33] disabled:opacity-60"
                    >
                      {isWithdrawing ? "탈퇴 중..." : "탈퇴하기"}
                    </button>
                  </div>
                </div>
              ) : confirmSignOut ? (
                // 로그아웃은 저장된 플랜 데이터까지 지우므로 한 번 더 확인받는다
                <div className="space-y-3">
                  <p className="text-[12.5px] leading-relaxed text-[#8a3236]">
                    로그아웃하면 이 기기에 저장된 플랜 정보가 지워집니다.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmSignOut(false)}
                      className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-[13px] font-bold text-[#1b0d14] transition-colors hover:bg-stone-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="h-11 flex-1 rounded-xl bg-[#c0203c] text-[13px] font-bold text-white transition-colors hover:bg-[#a51b33]"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmSignOut(true)}
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#e5484d33] bg-white text-[13px] font-bold text-[#c0203c] transition-colors hover:bg-[#fffafa]"
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </button>
                  {onWithdraw && (
                    <div className="mt-3 border-t border-[#f4eff2] pt-3 text-center">
                      <button
                        type="button"
                        onClick={() => setConfirmWithdraw(true)}
                        className="rounded text-[12px] text-gray-400 underline underline-offset-2 transition-colors hover:text-[#c0203c] focus-visible:text-[#c0203c]"
                      >
                        회원 탈퇴
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {/* 편집 폼 — 폰에서는 이게 첫 카드다 */}
          <div className="order-1 rounded-[28px] border border-[#ee2b8c0f] bg-white p-6 shadow-sm @[860px]:order-2">
            <p className="mb-4 text-[12.5px] text-gray-400">정보 수정</p>

            <div className="grid gap-3">
              <Field label="이름">
                <input
                  type="text"
                  placeholder="이름을 입력해 주세요"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </Field>

              {/*
                날짜는 DatePickerModal 로만 고친다 (add-plen 과 같다).
                예전에는 칸 옆에 보라색 달력 버튼이 따로 있었는데, 칸 자체가
                이미 눌리므로 하는 일이 같았고 앱에 없는 색이었다.
              */}
              <Field label="결혼식 날짜" suffix="눌러서 바꾸기">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(true)}
                  className="flex w-full items-center gap-2 text-left text-[15px] font-bold tracking-[-0.01em] text-[#1b0d14]"
                >
                  <Calendar className="h-4 w-4 shrink-0 text-[#ee2b8c]" />
                  {formatKoreanDate(formData.weddingDate) || "날짜 선택"}
                </button>
              </Field>

              {/*
                예식장 이름. 비워 둘 수 있다 — 아직 안 정한 사람이 대부분이고,
                넣어 두면 홈 상단에 결혼식 날짜와 나란히 붙는다.
              */}
              <Field label="예식장" labelHint="(선택)">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-gray-300" />
                  <input
                    type="text"
                    placeholder="아직 안 정했어요"
                    value={formData.weddingVenue ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, weddingVenue: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </Field>

              <Field label="예산" suffix="만원">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-gray-300" />
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
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
                    className={`input-no-spinner font-user-content ${INPUT_CLASS}`}
                  />
                </div>
              </Field>
            </div>

            {saveError && (
              <p
                role="alert"
                className="mt-4 rounded-2xl bg-[#c0203c11] px-4 py-3 text-center text-[13px] font-bold text-[#c0203c]"
              >
                {saveError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaved || isSaving}
              className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition-all active:scale-[0.99] disabled:cursor-not-allowed ${
                isSaved
                  ? "bg-green-500"
                  : "bg-[#ee2b8c] hover:bg-[#d4237b] disabled:opacity-70"
              }`}
            >
              {isSaved && <Check className="h-5 w-5" />}
              {isSaved ? "저장되었어요" : isSaving ? "저장 중..." : "저장"}
            </button>
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
