"use client";

import React, { useState, useMemo } from "react";
import { X, Calendar, Wallet, LogOut, Check, MapPin } from "lucide-react";
import { applyDigitInput, parseLocalDate, getDaysUntil } from "@/lib/utils";
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
  /** 오른쪽 끝 안내 문구 ("눌러서 바꾸기"). 넓은 화면에만 낸다 */
  suffix?: string;
  /** 값 옆에 붙는 단위 ("만 원"). 폭과 무관하게 상자 안 오른쪽 끝이다 */
  unit?: string;
  children: React.ReactNode;
}> = ({ label, labelHint, suffix, unit, children }) => (
  /*
    SEED 채움 필드 — 테두리 대신 회색 바탕(layer-fill)으로 입력 칸임을 알린다.
    라벨은 어느 폭에서도 항상 띄운다(placeholder 만 있으면 값을 넣는 순간
    무슨 칸인지 사라진다 — 화면에 `4200`, `2026-11-14` 만 남았다).

    다만 **자리가 다르다.** 폰(시안 C안 09)은 라벨을 상자 **밖 위**로 올리고
    상자에는 값만 둔다. 넓은 화면은 예전처럼 라벨을 상자 안에 넣는다 —
    거기서는 폼이 오른쪽 열에 들어가 세로가 아까운 자리다.
  */
  <div className="md:rounded-2xl md:border md:border-transparent md:bg-[#f7f8f9] md:px-4 md:py-2.5 md:transition-all md:focus-within:border-[#ffc9e0] md:focus-within:bg-white">
    <div className="flex items-baseline justify-between gap-3">
      <label className="text-[13px] font-bold text-[#555d6d] md:text-[11.5px] md:font-normal md:text-gray-400">
        {label}
        {labelHint && <span className="ml-1 text-gray-300">{labelHint}</span>}
      </label>
      {suffix && (
        <span className="hidden shrink-0 text-[11.5px] text-gray-400 md:inline">
          {suffix}
        </span>
      )}
    </div>
    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-[#f7f8f9] px-4 py-3 md:mt-0 md:rounded-none md:bg-transparent md:p-0">
      <div className="min-w-0 flex-1">{children}</div>
      {unit && (
        <span className="shrink-0 text-[14px] text-[#555d6d] md:hidden">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const INPUT_CLASS =
  "w-full bg-transparent text-[16px] font-medium tracking-[-0.01em] text-[#1a1c20] outline-none placeholder:font-normal placeholder:text-[#b0b4bb] md:text-[15px] md:font-bold md:text-[#1b0d14] md:placeholder:text-[#c8bfc4]";

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
        className={`flex shrink-0 items-center justify-center rounded-full border-2 border-white/50 bg-white/20 font-black text-white md:border-[#ee2b8c22] md:bg-gradient-to-br md:from-[#ee2b8c] md:to-[#ff7eb3] ${
          size === "lg" ? "h-[68px] w-[68px] text-[26px]" : "h-11 w-11 text-lg"
        }`}
        aria-hidden
      >
        {formData.name?.trim().charAt(0)?.toUpperCase() || "?"}
      </div>
    );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#fcfbfc]">
      {/*
        폰은 **분홍 머리 면**, ≥768 은 예전의 흰 머리글 띠 그대로다.
        C안은 모바일 리디자인이고, 넓은 화면은 대시보드 카드 언어를 쓰기로
        이미 정해 둔 자리라 섞지 않는다.

        닫기(X)는 폰에서 내지 않는다 — 이 화면은 탭 목적지라 "닫으면" 갈 곳이
        정해져 있지 않고, 나가는 길은 하단 탭바가 이미 넷 다 갖고 있다.
        D-day 는 여전히 **여기 한 곳에만** 둔다(옆 미리보기 카드에 또 넣으면
        넓은 화면에서 같은 값이 두 번 보인다).
      */}

      {/*
        @container: 2열 분기를 뷰포트가 아니라 이 영역이 실제로 차지한 폭으로
        정한다. 셸의 레일이 768/1024 에서 폭을 크게 바꾼다 (budget-detail 과
        같은 이유).
      */}
      <div className="@container no-scrollbar flex-1 overflow-y-auto">
        {/*
        머리 면은 **스크롤 영역 안**에 있다 — 폰에서는 내용과 함께 위로
        올라간다. 고정해 두면 375x553(사파리 상하단 바가 다 나온 아이폰 SE)
        에서 보이는 목록이 그만큼 줄어든다. 넓은 화면은 흰 머리글 띠라
        `md:sticky` 로 자리를 지킨다.
      */}
        <header
          data-mobile-head
          className="md:sticky md:top-0 md:z-20 flex shrink-0 items-center justify-between gap-4 rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-6 py-5 md:rounded-none md:border-b md:border-stone-100 md:bg-white md:bg-none md:px-8 md:py-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            {avatar("sm")}
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold leading-tight tracking-[-0.02em] text-white md:text-[22px] md:text-[#1b0d14]">
                {formData.name?.trim() || "프로필"}
              </h2>
              <p className="mt-1 text-[12.5px] text-white/80 md:text-[#7a6c74]">
                결혼식까지 {ddayLabel.replace("D-", "")}
                {ddayLabel.startsWith("D-") ? "일" : ""}
                {/* 폰은 여기까지다(시안 C안 09). 바로 아래 "정보 수정" 이
                    같은 말을 하고 있어 두 번 적을 자리가 아니다 */}
                <span className="hidden md:inline">
                  {" "}
                  · 결혼 정보를 관리해요
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-[#fff2f6] px-3 py-1 text-[12.5px] font-bold text-[#ee2b8c] md:inline">
              {ddayLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="hidden h-10 w-10 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600 md:flex"
              aria-label="닫기"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </header>
        <div className="pb-tabbar px-4 py-4 md:mx-auto md:w-full md:max-w-[1100px] md:px-8 md:pt-6 md:pb-10">
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
              <div className="border-t border-[#0000000c] pt-5 md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-5 md:pt-5 md:shadow-sm">
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
            <div className="order-1 md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-6 md:shadow-sm @[860px]:order-2">
              {/* 시안은 섹션 제목이다 — 카드가 없으니 제목이 묶음을 만든다 */}
              <p className="mb-4 text-[18px] font-bold tracking-[-0.02em] text-[#1a1c20] md:text-[12.5px] md:font-normal md:text-gray-400">
                정보 수정
              </p>

              <div className="grid gap-4 md:gap-3">
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
                    className="flex w-full items-center gap-2 text-left text-[16px] font-medium tracking-[-0.01em] text-[#1a1c20] md:text-[15px] md:font-bold md:text-[#1b0d14]"
                  >
                    {/* 아이콘은 넓은 화면에만. 폰은 라벨이 이미 밖에 있어
                      무슨 칸인지 두 번 말할 필요가 없다 */}
                    <Calendar className="hidden h-4 w-4 shrink-0 text-[#ee2b8c] md:block" />
                    {formatKoreanDate(formData.weddingDate) || "날짜 선택"}
                  </button>
                </Field>

                {/*
                예식장 이름. 비워 둘 수 있다 — 아직 안 정한 사람이 대부분이고,
                넣어 두면 홈 상단에 결혼식 날짜와 나란히 붙는다.
              */}
                <Field label="예식장" labelHint="(선택)">
                  <div className="flex items-center gap-2">
                    <MapPin className="hidden h-4 w-4 shrink-0 text-gray-300 md:block" />
                    <input
                      type="text"
                      placeholder="아직 안 정했어요"
                      value={formData.weddingVenue ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          weddingVenue: e.target.value,
                        })
                      }
                      className={INPUT_CLASS}
                    />
                  </div>
                </Field>

                <Field label="예산" suffix="만원" unit="만 원">
                  <div className="flex items-center gap-2">
                    <Wallet className="hidden h-4 w-4 shrink-0 text-gray-300 md:block" />
                    {/*
                      값이 0 이면 칸을 **비우고** placeholder 로 회색 0 만 둔다.
                      검은 "0" 이 박혀 있으면 3 을 치는 순간 "03" 이 되고,
                      지우려면 0 까지 한 번 더 지워야 했다.

                      `type="text"` + `inputMode="numeric"` 인 이유: `type="number"`
                      는 잘못된 입력에서 `value` 를 빈 문자열로 돌려주고 캐럿
                      위치도 읽을 수 없어, 아래 선행 0 제거를 할 수 없다.
                      폰에서는 inputMode 가 숫자 키패드를 그대로 띄운다.
                    */}
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={
                        formData.budget === 0 ? "" : String(formData.budget)
                      }
                      onChange={(e) => {
                        const next = applyDigitInput(e.currentTarget);
                        setFormData({
                          ...formData,
                          // 다 지우면 0 — 0 도 유효한 예산이다.
                          budget: next === "" ? 0 : Number(next),
                        });
                      }}
                      className={`font-user-content ${INPUT_CLASS}`}
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

              {/*
              예전에 여기 있던 "공지 사항 및 소개" 는 눌리지도 않는 문구였다.
              방침 링크는 실제로 갈 곳이 있고, 스토어 심사도 앱 안에서 방침에
              닿을 수 있기를 본다.
            */}
              <a
                href="/privacy"
                className="mt-4 block rounded text-center text-[12px] text-gray-400 underline underline-offset-2 transition-colors hover:text-[#ee2b8c]"
              >
                개인정보처리방침
              </a>
            </div>
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
