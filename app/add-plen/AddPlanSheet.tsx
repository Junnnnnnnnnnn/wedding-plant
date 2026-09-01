"use client";

import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useApi } from "../contexts/ApiContext";
import { getToken } from "@/lib/api";

/**
 * 넓은 화면(≥768)의 플랜 추가·수정 화면 — 시안 A1 "시트 한 장".
 *
 * `/main` 이 `HomeDashboard` 를 쓰는 방식과 같다. 폰 트리를 CSS 로
 * 재배치하지 않고 **아예 다른 트리를 렌더**한다. 그래야 폰이 픽셀 그대로
 * 남는다 (`AddPlanView` 의 카드 스택은 한 줄도 건드리지 않았다).
 *
 * 상세보기(`ScheduleDetailView`)는 여기에 들어오지 않는다. 다른 화면이고,
 * 거기 있는 완료 토글·삭제·후기 올리기는 이 폼에 없다.
 *
 * 폼 상태는 전부 `AddPlanView` 가 들고 있고 여기로 내려온다. 저장·검색·
 * 카테고리 로직을 복제하지 않는다 — 두 벌이 되면 한쪽만 고쳐진다.
 */

export type PaymentType = "현금" | "카드" | "기타";

export interface SheetCategory {
  id?: number;
  color: string;
  label: string;
  type?: "SYSTEM" | "USER" | "ROOM";
}

export interface SheetLocationResult {
  place_name: string;
  address_name: string;
  /** 도로명이 없는 곳이 있다. 없으면 지번(address_name)으로 떨어진다 */
  road_address_name?: string;
  x: string;
  y: string;
}

export interface AddPlanSheetProps {
  editId: number | null;
  roomId: number | null;
  isLoadingDetail: boolean;
  isSaving: boolean;

  title: string;
  onTitleChange: (value: string) => void;

  categories: SheetCategory[];
  userAddedLabels: Set<string>;
  selectedCategory: { color: string; label: string } | null;
  onSelectCategory: (category: { color: string; label: string }) => void;
  onAddCategory: (name: string) => void;

  paymentType: PaymentType | null;
  onPaymentTypeChange: (value: PaymentType) => void;

  amount: string;
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  dateLabel: string;
  isDateUndecided: boolean;
  onOpenDatePicker: () => void;
  onToggleDateUndecided: () => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;

  location: string;
  onLocationChange: (value: string) => void;
  onSearchLocation: () => void;
  hasSearched: boolean;
  locationResults: SheetLocationResult[];
  onSelectLocation: (result: SheetLocationResult) => void;
  onUseRawLocation: () => void;
  showMap: boolean;
  onResetMap: () => void;

  memo: string;
  onMemoChange: (value: string) => void;

  spouseName: string | null;
  onSave: () => void;
  onClose?: () => void;
}

/** 라벨 열 폭. 값이 같은 x 에서 시작해야 표처럼 읽힌다 */
const ROW = "grid grid-cols-[132px_minmax(0,1fr)] items-center gap-4 px-6 py-3";
const LABEL = "text-[13.5px] font-bold text-[#7a6c74]";
/**
 * 칸은 평소 테두리가 없고, 손이 닿을 때만 면이 뜬다.
 * **폭은 여기서 정하지 않는다** — `w-full` 을 넣어 뒀더니 금액·일자처럼
 * 고정 폭을 주는 칸에서 그게 이겨 행이 두 줄로 접혔다.
 */
const FIELD =
  "rounded-[10px] border border-transparent bg-transparent px-3 py-[11px] text-[15px] font-bold text-[#1b0d14] transition-colors placeholder:text-[#a99ba3] hover:bg-[#fafaf9] focus:border-[#ee2b8c] focus:bg-white focus:outline-none";
const PILL =
  "rounded-full border border-[#e7e5e4] bg-white px-[13px] py-[7px] text-[13.5px] text-[#a99ba3] transition-colors hover:border-[#a99ba3] hover:text-[#7a6c74]";
const PILL_ON_CAT =
  "rounded-full border border-[#ee2b8c26] bg-[#fff2f6] px-[13px] py-[7px] text-[13.5px] font-extrabold text-[#ee2b8c]";
const PILL_ON_PAY =
  "rounded-full border border-[#1b0d14] bg-[#1b0d14] px-[13px] py-[7px] text-[13.5px] text-white";

/** 예산 패널이 읽는 값. 홈 대시보드와 같은 뜻이다 */
interface AmountDetail {
  initialCapital: number;
  plannedUseAmount: number;
  usedAmount: number;
}

export default function AddPlanSheet({
  editId,
  roomId,
  isLoadingDetail,
  isSaving,
  title,
  onTitleChange,
  categories,
  userAddedLabels,
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  paymentType,
  onPaymentTypeChange,
  amount,
  onAmountChange,
  dateLabel,
  isDateUndecided,
  onOpenDatePicker,
  onToggleDateUndecided,
  startTime,
  onStartTimeChange,
  location,
  onLocationChange,
  onSearchLocation,
  hasSearched,
  locationResults,
  onSelectLocation,
  onUseRawLocation,
  showMap,
  onResetMap,
  memo,
  onMemoChange,
  spouseName,
  onSave,
  onClose,
}: AddPlanSheetProps) {
  const { fetchWithAuth } = useApi();

  /** "+ 추가" 를 누르면 그 줄에서 이름 칸이 열린다. 모달로 보내지 않는다 */
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  /**
   * 오른쪽 예산 패널. `usedAmount` 는 **실제로 쓴 돈**이다.
   * `/plan/user/total-amount` 의 같은 이름 필드는 예정까지 합친 값이라
   * 그걸로 그리면 아무것도 안 썼는데 분홍이 찬다 (홈 대시보드에서 겪었다).
   */
  const [detail, setDetail] = useState<AmountDetail | null>(null);
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const url = roomId
          ? `/plan/room/amount/detail/${roomId}`
          : "/plan/user/amount/detail";
        const res = await fetchWithAuth(url, { skipLoading: true });
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as {
          result?: boolean;
          data?: Partial<AmountDetail>;
        } | null;
        if (cancelled || json?.result !== true || !json.data) return;
        setDetail({
          initialCapital: Number(json.data.initialCapital ?? 0),
          plannedUseAmount: Number(json.data.plannedUseAmount ?? 0),
          usedAmount: Number(json.data.usedAmount ?? 0),
        });
      } catch {
        // 못 받으면 예산 패널만 접는다. 폼은 그대로 쓴다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, roomId]);

  const amountNumber = Number(amount.replace(/,/g, "")) || 0;
  const capital = detail?.initialCapital ?? 0;
  const pct = (v: number) => (capital > 0 ? (v / capital) * 100 : 0);
  const remainingNow = detail
    ? detail.initialCapital - detail.plannedUseAmount - detail.usedAmount
    : null;
  const remainingAfter =
    remainingNow != null ? remainingNow - amountNumber : null;

  const commitCategory = () => {
    const name = newName.trim();
    if (!name) return;
    onAddCategory(name);
    setNewName("");
    setIsAdding(false);
  };

  const canSave = !!title.trim() && !!selectedCategory && !!paymentType;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#fcfbfc]">
      {/* 머리글 띠 — 대시보드·예산 상세와 같은 자리 */}
      <header className="flex shrink-0 items-center gap-4 border-b border-[#f2eaee] bg-white px-8 py-5">
        <div className="min-w-0">
          <p className="text-[13.5px] text-[#a99ba3]">
            {roomId ? "참여 플랜" : "내 플랜"}
            {editId ? " · 플랜 수정" : " · 플랜 추가"}
          </p>
          <h1 className="truncate text-[22px] font-extrabold tracking-tight text-[#1b0d14]">
            {editId ? "수정하기" : "계획을 추가해보세요"}
          </h1>
        </div>
        <div className="flex-1" />
        {/*
          시안에서 "← 보드로" 알약은 뺐다. 다만 단독 라우트에 나가는 길이
          아예 없으면 갇히므로, 인스펙터·pane 과 같은 X 를 머리글에 둔다.
        */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-start gap-8 p-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          {/* ── 왼쪽: 시트 한 장 ── */}
          <form
            onSubmit={(e) => e.preventDefault()}
            className="overflow-hidden rounded-[28px] border border-[#f2eaee] bg-white pt-3 shadow-sm"
          >
            {isLoadingDetail ? (
              <div className="animate-pulse space-y-3 p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-stone-50" />
                ))}
              </div>
            ) : (
              <>
                <div className={ROW}>
                  <label className={LABEL} htmlFor="sheet-title">
                    제목 <span className="text-[#ee2b8c]">*</span>
                  </label>
                  <input
                    id="sheet-title"
                    type="text"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="어떤 지출인가요?"
                    className={`${FIELD} w-full text-[18px]`}
                  />
                </div>

                <div className={`${ROW} border-t border-[#f2eaee]`}>
                  <span className={LABEL}>
                    카테고리 <span className="text-[#ee2b8c]">*</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {categories.map((c) => {
                      const on = selectedCategory?.label === c.label;
                      return (
                        <button
                          key={c.label}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            onSelectCategory({ color: c.color, label: c.label })
                          }
                          className={`inline-flex items-center gap-[5px] ${on ? PILL_ON_CAT : PILL}`}
                        >
                          {c.label}
                          {userAddedLabels.has(c.label) && (
                            <span
                              aria-label="내가 추가한 카테고리"
                              className="rounded-full bg-[#ee2b8c] px-[5px] py-px text-[10px] font-extrabold leading-[1.4] text-white"
                            >
                              my
                            </span>
                          )}
                          {c.type === "ROOM" && (
                            <span
                              aria-label="공유 카테고리"
                              className="rounded-full bg-[#57534e] px-[5px] py-px text-[10px] font-extrabold leading-[1.4] text-white"
                            >
                              room
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {isAdding ? (
                      <span className="inline-flex items-center gap-2">
                        <input
                          autoFocus
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitCategory();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setIsAdding(false);
                              setNewName("");
                            }
                          }}
                          placeholder="새 카테고리 이름"
                          aria-label="새 카테고리 이름"
                          className="w-[168px] rounded-full border border-[#ee2b8c] bg-white px-[13px] py-[7px] text-[13.5px] font-bold outline-none focus:shadow-[0_0_0_3px_#ee2b8c26]"
                        />
                        <button
                          type="button"
                          disabled={!newName.trim()}
                          onClick={commitCategory}
                          className="rounded-full bg-[#ee2b8c] px-[13px] py-[7px] text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          확인
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAdding(false);
                            setNewName("");
                          }}
                          className="px-[9px] py-[7px] text-[13.5px] text-[#a99ba3] hover:text-[#7a6c74]"
                        >
                          취소
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className={PILL}
                      >
                        + 추가
                      </button>
                    )}
                  </div>
                </div>

                <div className={`${ROW} border-t border-[#f2eaee]`}>
                  <span className={LABEL}>
                    금액 · 결제 <span className="text-[#ee2b8c]">*</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={amount}
                      onChange={onAmountChange}
                      inputMode="numeric"
                      aria-label="금액(만원)"
                      placeholder="0"
                      className={`${FIELD} w-[104px] text-[18px] tabular-nums`}
                    />
                    <span className="text-[13.5px] font-semibold text-[#7a6c74]">
                      만원
                    </span>
                    <span className="w-3" />
                    {(["현금", "카드", "기타"] as PaymentType[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={paymentType === p}
                        onClick={() => onPaymentTypeChange(p)}
                        className={paymentType === p ? PILL_ON_PAY : PILL}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`${ROW} border-t border-[#f2eaee]`}>
                  <span className={LABEL}>일자</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenDatePicker}
                      className={`${FIELD} w-[150px] text-left ${isDateUndecided ? "text-[#a99ba3]" : ""}`}
                    >
                      {isDateUndecided ? "미정" : dateLabel}
                    </button>
                    {/* 시각은 선택이다. 날짜가 미정이면 뜻이 없어 감춘다 */}
                    {!isDateUndecided && (
                      <span className="inline-flex items-center gap-1.5">
                        {/*
                          앞에 시계 아이콘을 하나 더 두지 않는다. time 입력이
                          자기 시계를 그려서 한 줄에 시계가 둘이 되고, 그만큼
                          넓어져 "미정" 이 다음 줄로 밀렸다.
                        */}
                        <input
                          type="time"
                          step={300}
                          value={startTime}
                          onChange={(e) => onStartTimeChange(e.target.value)}
                          aria-label="시작 시각"
                          className={`${FIELD} w-[152px]`}
                        />
                        {startTime && (
                          <button
                            type="button"
                            onClick={() => onStartTimeChange("")}
                            className="px-2 text-[13.5px] text-[#a99ba3] hover:text-[#7a6c74]"
                          >
                            지우기
                          </button>
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={onToggleDateUndecided}
                      aria-pressed={isDateUndecided}
                      className={isDateUndecided ? PILL_ON_PAY : PILL}
                    >
                      미정
                    </button>
                  </div>
                </div>

                <div className={`${ROW} items-start border-t border-[#f2eaee]`}>
                  <label className={`${LABEL} pt-[11px]`} htmlFor="sheet-loc">
                    위치
                  </label>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <input
                        id="sheet-loc"
                        type="text"
                        value={location}
                        onChange={(e) => onLocationChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (location.trim()) onSearchLocation();
                          }
                        }}
                        placeholder="예식장, 스튜디오 등"
                        autoComplete="off"
                        className={`${FIELD} min-w-0 flex-1`}
                      />
                      <button
                        type="button"
                        onClick={onSearchLocation}
                        disabled={!location.trim()}
                        aria-label="장소 검색"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[#e7e5e4] bg-[#fafaf9] text-[#a99ba3] transition-colors enabled:hover:border-[#a99ba3] enabled:hover:text-[#7a6c74] disabled:opacity-50"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                    </div>

                    {/*
                      결과는 떠 있는 드롭다운이 아니라 이 행이 아래로 자라는
                      방식이다. 시트 한 장이라는 전제를 지키려면 레이어를
                      하나 더 띄우면 안 된다. 지도는 오른쪽 패널에 있다.
                    */}
                    {hasSearched && !showMap && locationResults.length > 0 && (
                      <div
                        role="listbox"
                        aria-label="장소 검색 결과"
                        className="mt-2"
                      >
                        {locationResults.slice(0, 5).map((r) => (
                          <button
                            key={`${r.x}-${r.y}-${r.place_name}`}
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => onSelectLocation(r)}
                            className="block w-full rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-[#fafaf9]"
                          >
                            <b className="block text-[15px] font-extrabold text-[#1b0d14]">
                              {r.place_name}
                            </b>
                            <span className="mt-0.5 block text-[12px] text-[#a99ba3]">
                              {r.road_address_name || r.address_name}
                            </span>
                          </button>
                        ))}
                        <p className="mt-2 border-t border-dashed border-[#f2eaee] p-3 text-[12px] leading-relaxed text-[#a99ba3]">
                          고르면 오른쪽 지도에 찍히고, 같은 업체의 후기가 함께
                          묶입니다.
                          {/*
                            장소는 필수가 아니다 — 청첩장·예물처럼 지도에 없는
                            게 정상인 항목이 있다. 이 길을 막으면 갇힌다.
                          */}
                          <button
                            type="button"
                            onClick={onUseRawLocation}
                            className="mt-1.5 block text-[13.5px] font-bold text-[#ee2b8c] underline underline-offset-[3px]"
                          >
                            지도에 없는 곳 — “{location.trim()}” 그대로 쓰기
                          </button>
                        </p>
                      </div>
                    )}

                    {hasSearched && locationResults.length === 0 && (
                      <p className="mt-2 rounded-[10px] bg-[#fafaf9] px-3 py-3 text-[13.5px] text-[#7a6c74]">
                        검색 결과가 없습니다.{" "}
                        <button
                          type="button"
                          onClick={onUseRawLocation}
                          className="font-bold text-[#ee2b8c] underline underline-offset-[3px]"
                        >
                          그대로 쓰기
                        </button>
                      </p>
                    )}

                    {showMap && locationResults.length > 0 && (
                      <button
                        type="button"
                        onClick={onResetMap}
                        className="mt-2 text-[13.5px] text-[#7a6c74] underline underline-offset-[3px] hover:text-[#ee2b8c]"
                      >
                        다른 장소 선택하기 ({locationResults.length}개)
                      </button>
                    )}
                  </div>
                </div>

                <div className={`${ROW} items-start border-t border-[#f2eaee]`}>
                  <label className={`${LABEL} pt-[11px]`} htmlFor="sheet-memo">
                    메모
                  </label>
                  <div className="min-w-0">
                    <textarea
                      id="sheet-memo"
                      value={memo}
                      maxLength={500}
                      onChange={(e) =>
                        onMemoChange(e.target.value.slice(0, 500))
                      }
                      placeholder="메모 남기기"
                      className={`${FIELD} min-h-[70px] w-full resize-y font-normal`}
                    />
                    <p className="mt-1 text-right text-[12px] text-[#a99ba3]">
                      {memo.length}/500
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 border-t border-[#f2eaee] bg-[#fcfbfc] px-6 py-5">
                  <p className="min-w-[200px] flex-1 text-[13.5px] text-[#7a6c74]">
                    {spouseName ? (
                      <>
                        배우자 <b className="text-[#1b0d14]">{spouseName}</b>
                        님에게도 바로 보입니다.
                      </>
                    ) : (
                      "저장하면 플랜 보드와 홈에 바로 올라갑니다."
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={!canSave || isSaving}
                    onClick={onSave}
                    className="rounded-[22px] bg-[#ee2b8c] px-8 py-[15px] text-[15px] font-extrabold text-white shadow-[0_10px_30px_-14px_#ee2b8c66] transition-transform hover:-translate-y-px active:translate-y-0 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving
                      ? editId
                        ? "수정 중..."
                        : "저장 중..."
                      : editId
                        ? "수정하기"
                        : "플랜 저장하기"}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* ── 오른쪽: 지금 넣는 값이 어디에 어떻게 나타나는지 ── */}
          <aside
            aria-label="미리보기"
            className="grid gap-4 xl:sticky xl:top-8"
          >
            <section className="rounded-[28px] border border-[#f2eaee] bg-white p-5 shadow-sm">
              <p className="mb-3 text-[12px] text-[#a99ba3]">
                보드에는 이렇게 놓입니다
              </p>
              <div className="rounded-[16px] border border-[#f2eaee] p-4">
                <p className="font-extrabold text-[#1b0d14]">
                  {title.trim() || "제목 없음"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {selectedCategory && (
                    <span className="rounded-full bg-[#fff2f6] px-2.5 py-0.5 text-[11.5px] font-bold text-[#ee2b8c]">
                      {selectedCategory.label}
                    </span>
                  )}
                  <span className="text-[12px] text-[#7a6c74]">
                    {isDateUndecided ? "날짜 미정" : dateLabel}
                    {!isDateUndecided && startTime ? ` · ${startTime}` : ""}
                  </span>
                </div>
                <p className="mt-3 text-[22px] font-extrabold tracking-[-0.03em] text-[#1b0d14]">
                  {amountNumber.toLocaleString("ko-KR")}만 원
                </p>
              </div>
            </section>

            {/*
              자본을 못 받았으면(0) 패널을 내지 않는다. 예전에는
              "0만원 → -185만원이 됩니다" 라고 적혔다.
            */}
            {detail && detail.initialCapital > 0 && (
              <section className="rounded-[28px] border border-[#f2eaee] bg-white p-5 shadow-sm">
                <p className="mb-3 text-[12px] text-[#a99ba3]">
                  예산에 미치는 영향
                </p>
                {/*
                  분홍 = 실제 지출, 회색 = 아직 안 쓴 예정, 빗금 = 이번 건.
                  홈 대시보드 막대와 색의 뜻이 같다.
                */}
                <div
                  role="img"
                  aria-label="예산 중 지출·예정·이번 건 비중"
                  className="my-3 flex h-3 overflow-hidden rounded-full bg-[#f4eff2]"
                >
                  <i
                    className="block h-full shrink-0 bg-gradient-to-r from-[#ff7ab5] to-[#ee2b8c]"
                    style={{
                      width: `${Math.min(100, pct(detail.usedAmount))}%`,
                    }}
                  />
                  <i
                    className="block h-full shrink-0 bg-[#cdbfc7]"
                    style={{
                      width: `${Math.min(100, pct(detail.plannedUseAmount))}%`,
                    }}
                  />
                  <i
                    className="block h-full shrink-0 bg-[repeating-linear-gradient(45deg,#ee2b8c_0_5px,#ff7ab5_5px_10px)]"
                    style={{ width: `${Math.min(100, pct(amountNumber))}%` }}
                  />
                </div>
                <div className="grid gap-[7px] text-[12px] text-[#7a6c74]">
                  <div className="flex items-center gap-2">
                    <span className="h-[9px] w-[9px] rounded-[3px] bg-[#cdbfc7]" />
                    이미 예정
                    <b className="ml-auto tabular-nums text-[#1b0d14]">
                      {detail.plannedUseAmount.toLocaleString("ko-KR")}만원
                    </b>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-[9px] w-[9px] rounded-[3px] bg-[#ee2b8c]" />
                    이번 건
                    <b className="ml-auto tabular-nums text-[#1b0d14]">
                      {amountNumber.toLocaleString("ko-KR")}만원
                    </b>
                  </div>
                </div>
                {remainingNow != null && remainingAfter != null && (
                  <p className="mt-4 border-t border-dashed border-[#f2eaee] pt-4 text-[13.5px] leading-relaxed text-[#7a6c74]">
                    저장하면 남은 예산이{" "}
                    <b className="text-[#1b0d14]">
                      {remainingNow.toLocaleString("ko-KR")}만원 →{" "}
                      {remainingAfter.toLocaleString("ko-KR")}만원
                    </b>
                    이 됩니다.
                  </p>
                )}
              </section>
            )}

            {/*
              지도는 여기 한 곳에만 둔다. `#map` 은 문서에 하나뿐이어야 해서
              폰 트리와 시트를 CSS 로 함께 띄우지 않고 아예 갈라 렌더한다.
            */}
            {showMap && (
              <section className="rounded-[28px] border border-[#f2eaee] bg-white p-5 shadow-sm">
                <p className="mb-3 text-[12px] text-[#a99ba3]">위치</p>
                <div
                  id="map"
                  className="h-[220px] w-full overflow-hidden rounded-[16px] border border-[#f2eaee]"
                  style={{ pointerEvents: "auto" }}
                />
                <p className="mt-2 text-[12px] text-[#a99ba3]">
                  {location.trim()}
                </p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
