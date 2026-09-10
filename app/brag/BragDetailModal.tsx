"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Heart, X } from "lucide-react";
import { BragDetail, BragPlanItem } from "@/types";
import PlanTaskCardBody from "../components/PlanTaskCard";
import { PLANNED_COLOR, STACK_COLORS } from "../components/HomeDashboard";

/**
 * 자랑하기 상세 — 시안 M5-C「카테고리로 묶는다」
 * (`docs/concepts/brag-modal-m5-4.html` 의 세 번째).
 *
 * **앱의 대시보드 패널과 실제 플랜 카드를 그대로 쓴다.** 이 화면의 값어치가
 * "남의 대시보드를 그대로 들여다본다" 는 데 있어서, 자랑하기용으로 새로
 * 그리는 순간 그 값어치가 사라진다. 그래서 색은 `HomeDashboard` 의
 * `STACK_COLORS` 를 import 해서 쓰고, 카드는 `PlanTaskCardBody` 를 쓴다.
 *
 * C안이 다른 안과 갈리는 곳은 **오른쪽**이다 — 카드가 카테고리로 묶이고
 * 묶음마다 개수와 소계가 붙는다. 묶음 머리의 색 사각이 **왼쪽 막대·범례와
 * 같은 색**이라, "이 1,240만원이 이 두 장이다" 가 눈으로 붙는다. 색이
 * 어긋나면 왼쪽 패널이 장식이 된다.
 */

/** 묶음에 색이 없는 카테고리(상위 4개 밖). 무채색으로 둔다 */
const REST_COLOR = "#e6dbe2";

interface BragGroup {
  categoryName: string;
  items: BragPlanItem[];
  /** 소계 — **지출과 예정을 함께** 센다 (완료 185 + 예정 35 = 220) */
  subtotal: number;
  /** 순서용. 범례가 지출 큰 순이라 묶음도 같은 기준을 써야 색이 맞는다 */
  used: number;
}

function toGroups(items: BragPlanItem[]): BragGroup[] {
  const map = new Map<string, BragGroup>();
  items.forEach((item) => {
    const key = item.categoryName || "기타";
    const g = map.get(key) ?? {
      categoryName: key,
      items: [],
      subtotal: 0,
      used: 0,
    };
    g.items.push(item);
    g.subtotal += item.amount ?? 0;
    if (item.status === "COMPLETED") g.used += item.amount ?? 0;
    map.set(key, g);
  });
  return [...map.values()].sort(
    (a, b) => b.used - a.used || b.subtotal - a.subtotal,
  );
}

function ddayLabel(dday: number | null): string {
  if (dday == null) return "";
  if (dday === 0) return "D-DAY";
  return dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026년 10월 3일 토요일" — 넓은 화면. 폰은 "(토)" 로 줄인다 */
function weddingLabel(date: string | null, short: boolean): string {
  if (!date) return "결혼식 날짜 미정";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "결혼식 날짜 미정";
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return short
    ? `${y}년 ${m}월 ${d}일 (${w})`
    : `${y}년 ${m}월 ${d}일 ${w}요일`;
}

/** 완료 개수 눈금. 숫자보다 먼저 읽힌다 */
function Ticks({
  done,
  total,
  onFill,
}: {
  done: number;
  total: number;
  onFill?: boolean;
}) {
  // 플랜이 아주 많으면 눈금이 실선이 된다. 그때는 개수만 적는다
  if (total === 0 || total > 40) return null;
  return (
    <span className="mt-2 flex gap-[2px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={`h-[7px] min-w-0 flex-1 rounded-[2px] ${
            i < done
              ? onFill
                ? "bg-white"
                : "bg-[#ee2b8c]"
              : onFill
                ? "bg-white/20"
                : "bg-[#f4eff2]"
          }`}
        />
      ))}
    </span>
  );
}

interface BragDetailModalProps {
  detail: BragDetail | null;
  loading: boolean;
  onClose: () => void;
  onToggleLike: () => void;
  likePending?: boolean;
}

export default function BragDetailModal({
  detail,
  loading,
  onClose,
  onToggleLike,
  likePending = false,
}: BragDetailModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups = useMemo(() => toGroups(detail?.items ?? []), [detail?.items]);

  /** 범례 색. 상위 4개만 색이 붙고 나머지는 무채색 — 묶음 머리와 같은 규칙 */
  const colorOf = useMemo(() => {
    const top = (detail?.categoryChart ?? []).slice(0, STACK_COLORS.length);
    const m = new Map<string, string>();
    top.forEach((c, i) => m.set(c.categoryName, STACK_COLORS[i]));
    return (name: string) => m.get(name) ?? REST_COLOR;
  }, [detail?.categoryChart]);

  const totalBudget = detail?.totalBudget ?? 0;
  const pct = (v: number) => (totalBudget > 0 ? (v / totalBudget) * 100 : 0);
  const remaining =
    totalBudget - (detail?.usedAmount ?? 0) - (detail?.plannedAmount ?? 0);

  /* 예산 패널 — 홈의 것 그대로. 28px 라운드, 36px 숫자, h-3 막대, 9px 스와치 */
  const budgetPanel = (compact: boolean) => (
    <section
      className={`border border-[#ee2b8c0f] bg-white shadow-sm ${
        compact ? "rounded-[22px] p-5" : "rounded-[28px] p-[26px]"
      }`}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-bold tracking-tight text-[#1b0d14]">
          예산
        </h3>
        <span className="shrink-0 rounded-full bg-[#fff2f6] px-3 py-1 text-[12px] font-bold text-[#ee2b8c]">
          총 {totalBudget.toLocaleString("ko-KR")}만원
        </span>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div
            className={`font-user-content font-bold leading-none tracking-[-0.045em] text-[#1b0d14] ${
              compact ? "text-[30px]" : "text-[36px]"
            }`}
          >
            {remaining.toLocaleString("ko-KR")}만원
          </div>
          <div className="mt-2 text-[13px] text-gray-400">
            {totalBudget.toLocaleString("ko-KR")}만원 중 남음
          </div>
        </div>
        {!compact && (
          <div className="shrink-0 text-right text-[13px] text-gray-400">
            지출
            <br />
            <b className="font-user-content text-[16px] font-bold tracking-tight text-[#1b0d14]">
              {(detail?.usedAmount ?? 0).toLocaleString("ko-KR")}만원
            </b>
          </div>
        )}
      </div>

      <div
        className="my-[18px] flex h-3 overflow-hidden rounded-full bg-[#f4eff2]"
        role="img"
        aria-label="카테고리별 지출과 사용 예상 비중"
      >
        {(detail?.categoryChart ?? []).map((c, i) => (
          <i
            key={c.categoryName}
            className="block h-full shrink-0"
            style={{
              width: `${pct(c.usedAmount)}%`,
              minWidth: c.usedAmount > 0 ? 4 : 0,
              background: STACK_COLORS[i % STACK_COLORS.length],
            }}
          />
        ))}
        {(detail?.plannedAmount ?? 0) > 0 && (
          <i
            className="block h-full shrink-0"
            style={{
              width: `${pct(detail?.plannedAmount ?? 0)}%`,
              minWidth: 4,
              background: PLANNED_COLOR,
            }}
          />
        )}
      </div>

      <div className="grid gap-[11px]">
        {(detail?.categoryChart ?? []).map((c, i) => (
          <div
            key={c.categoryName}
            className="flex items-center gap-2.5 text-[13px]"
          >
            <span
              className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ background: STACK_COLORS[i % STACK_COLORS.length] }}
            />
            <span className="min-w-0 truncate text-[#4a3f45]">
              {c.categoryName}
            </span>
            <span className="ml-auto font-user-content font-bold tracking-tight text-[#1b0d14]">
              {c.usedAmount.toLocaleString("ko-KR")}만원
            </span>
          </div>
        ))}
        {(detail?.plannedAmount ?? 0) > 0 && (
          <div className="flex items-center gap-2.5 text-[13px]">
            <span
              className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ background: PLANNED_COLOR }}
            />
            <span className="min-w-0 truncate text-[#7a6c74]">사용 예상</span>
            <span className="ml-auto font-user-content font-bold tracking-tight text-[#7a6c74]">
              {(detail?.plannedAmount ?? 0).toLocaleString("ko-KR")}만원
            </span>
          </div>
        )}
      </div>
    </section>
  );

  /* 카테고리 묶음 — C안이 다른 안과 갈리는 곳 */
  const groupList = (cols: 1 | 2) => (
    <div className="grid gap-5">
      {groups.map((g) => (
        <section key={g.categoryName}>
          <div className="mb-2.5 flex items-center gap-2.5 border-b border-stone-100 pb-2">
            <i
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: colorOf(g.categoryName) }}
            />
            <span className="text-[14px] font-bold tracking-tight text-[#1b0d14]">
              {g.categoryName}
            </span>
            <span className="text-[12px] text-gray-400">
              {g.items.length}장
            </span>
            <span className="ml-auto font-user-content text-[14px] font-bold tracking-tight text-[#1b0d14]">
              {g.subtotal.toLocaleString("ko-KR")}만 원
            </span>
          </div>
          <div
            className={`grid gap-3 ${cols === 2 ? "grid-cols-1 @[720px]:grid-cols-2" : "grid-cols-1"}`}
          >
            {g.items.map((item) => (
              <div
                key={item.id}
                className="rounded-[18px] border border-[#ee2b8c0f] bg-white px-4 py-3.5 shadow-sm"
              >
                {/*
                  `readOnly` 다. 남의 플랜이라 상태를 바꿀 수 없는데 모양이
                  같으면 눌러 보게 된다 — 그래서 체크는 그림으로만 두고
                  커서도 바뀌지 않는다. 안내 모달의 "보기와 좋아요만" 이라는
                  약속이 여기서 지켜진다.
                */}
                <PlanTaskCardBody item={item} readOnly />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  const likeButton = (onFill: boolean) => {
    if (!detail || detail.isMine) return null;
    return (
      <button
        type="button"
        onClick={onToggleLike}
        disabled={likePending}
        aria-pressed={detail.liked}
        className={
          onFill
            ? /*
                분홍 면 위에서는 **두 상태를 서로 뒤집는다.** 반투명 흰 면에
                흰 글씨(`bg-white/25 text-white`)로 두면 2.6:1 밖에 안 나와
                14px 글자가 읽히지 않는다. 흰 면 ↔ 진한 분홍 면으로 뒤집으면
                양쪽 다 5.3:1 이고, 어느 쪽이 켜진 상태인지도 더 분명하다.
                (`#cc1873` 은 폰 홈에서 이미 쓰는 진한 분홍이다.)
              */
              `inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2 text-[14px] font-bold tabular-nums transition-colors ${
                detail.liked
                  ? "bg-[#cc1873] text-white"
                  : "bg-white text-[#cc1873] hover:bg-[#fff2f6]"
              }`
            : `flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold tabular-nums transition-colors ${
                detail.liked
                  ? "bg-[#fff2f6] text-[#ee2b8c]"
                  : "bg-[#ee2b8c] text-white"
              }`
        }
      >
        <Heart
          className="h-4 w-4"
          strokeWidth={2}
          fill={detail.liked ? "currentColor" : "none"}
        />
        좋아요 {detail.likeCount.toLocaleString("ko-KR")}
      </button>
    );
  };

  const title = detail?.nickname ?? "";
  const dday = ddayLabel(detail?.dday ?? null);

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#1a1c20]/35"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/*
        크기 규칙(시안): **최대 1520x680, 남는 자리를 여백으로 쓰되 한 변
        200px 을 넘지 않는다.** 1920x1080 에서 정확히 각 변 200px 이 남고,
        화면이 작아지면 여백이 16px 까지 줄었다가 그 아래로는 꽉 찬다.
        Tailwind 로는 쓸 수 없는 식이라 inline style 로 둔다.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} 의 플랜`}
        className="absolute flex flex-col overflow-hidden rounded-[24px] bg-[#fcfbfc] shadow-2xl"
        style={{
          inset:
            "clamp(16px, calc((100dvh - 680px) / 2), 200px) clamp(16px, calc((100vw - 1520px) / 2), 200px)",
        }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/35"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
        </button>

        {/* 분홍 띠. 폰은 여기에 진행 눈금까지 들어간다 */}
        <header className="shrink-0 bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-5 pb-5 pt-6 text-white md:flex md:items-center md:gap-4 md:px-8 md:py-5 md:pr-16">
          <div className="min-w-0">
            <p className="truncate text-[20px] font-bold tracking-[-0.02em] md:text-[19px]">
              {title || " "}
            </p>
            <p className="mt-0.5 text-[13px] text-white/75">
              <span className="md:hidden">
                {weddingLabel(detail?.weddingDate ?? null, true)}
              </span>
              <span className="hidden md:inline">
                {weddingLabel(detail?.weddingDate ?? null, false)}
              </span>
              {dday && <> · {dday}</>}
            </p>
          </div>
          {detail && (
            <div className="md:hidden">
              <p className="mt-4 flex items-baseline gap-2 text-[12px] text-white/70">
                플랜{" "}
                <b className="text-[13px] font-bold text-white tabular-nums">
                  {detail.planCount}개
                </b>{" "}
                · 완료{" "}
                <b className="text-[13px] font-bold text-white tabular-nums">
                  {detail.doneCount}개
                </b>
              </p>
              <Ticks done={detail.doneCount} total={detail.planCount} onFill />
            </div>
          )}
          <div className="ml-auto hidden md:block">{likeButton(true)}</div>
        </header>

        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center text-[13.5px] text-[#7a6c74]">
            {loading ? "불러오는 중" : "플랜을 찾지 못했어요"}
          </div>
        ) : (
          <>
            {/* ≥768 — 왼쪽 대시보드 460px, 오른쪽 카테고리 묶음 */}
            <div className="hidden min-h-0 flex-1 gap-5 p-8 pt-6 md:grid md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:grid-cols-[460px_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
                {budgetPanel(false)}
                <section className="rounded-[28px] border border-[#ee2b8c0f] bg-white px-[26px] py-[22px] shadow-sm">
                  <h3 className="text-[15px] font-bold tracking-tight text-[#1b0d14]">
                    진행
                  </h3>
                  <p className="mt-4 flex items-baseline gap-2 text-[12px] text-gray-400">
                    플랜{" "}
                    <b className="text-[13px] font-bold tabular-nums text-[#1b0d14]">
                      {detail.planCount}개
                    </b>{" "}
                    · 완료{" "}
                    <b className="text-[13px] font-bold tabular-nums text-[#1b0d14]">
                      {detail.doneCount}개
                    </b>
                  </p>
                  <Ticks done={detail.doneCount} total={detail.planCount} />
                </section>
              </div>

              <div className="@container flex min-h-0 flex-col gap-4">
                <h3 className="flex items-baseline gap-2 text-[17px] font-bold tracking-[-0.02em] text-[#1b0d14]">
                  카테고리별
                  <span className="text-[13px] font-normal text-gray-400">
                    {groups.length}개 · 플랜 {detail.planCount}장
                  </span>
                </h3>
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
                  {groupList(2)}
                </div>
              </div>
            </div>

            {/* 폰 — 예산 패널 다음에 묶음이 세로로 쌓인다 */}
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:hidden">
              <div className="grid gap-4">
                {budgetPanel(true)}
                {groupList(1)}
              </div>
            </div>
            {!detail.isMine && (
              <div className="shrink-0 border-t border-stone-100 bg-white px-5 pb-4 pt-3 md:hidden">
                {likeButton(false)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
