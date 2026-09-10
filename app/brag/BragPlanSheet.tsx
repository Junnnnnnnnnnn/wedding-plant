"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { BragPlanItem } from "@/types";

/**
 * 자랑하기 상세 안에서 플랜 한 줄을 눌렀을 때 뜨는 **보기 전용** 시트.
 *
 * **바꿀 수 있는 것이 하나도 없다.** 남의 플랜이라 완료 토글도, 수정도,
 * 담기도 없다 — 안내 모달이 "다른 사람은 보기와 좋아요만" 이라고 약속했다.
 *
 * ── 왜 만들었나 ─────────────────────────────────────────────
 * M5-C 는 "앱의 플랜 카드를 그대로 쓴다" 가 전제라, 카드가 앱에서 늘 눌리던
 * 그 모양이다. 시안에 "앱과 모양이 같을수록 눌러 보게 된다" 고 적어 뒀는데
 * 실제로 그렇게 됐다 — 배포 뒤 첫 피드백이 "이거 누르면 상세가 보여야 한다"
 * 였다. 눌러도 아무 일이 없는 것보다 **보기 전용으로 열어 주는 편**이 낫다.
 *
 * ── 보여 줄 수 있는 것 ───────────────────────────────────────
 * 카드가 이미 다섯 값을 다 보여 주고 있어서(제목·카테고리·날짜·금액·완료),
 * 그대로 옮기면 같은 것을 두 번 보여 주는 빈 시트가 된다. 그래서
 *
 *  · 날짜를 **긴 형식**으로 편다 (카드는 "1월 10일", 여기는 요일까지)
 *  · 이 한 줄이 **그 카테고리에서 차지하는 몫**을 낸다. 카드에는 없던
 *    값이고, 이미 받은 데이터로 만들 수 있다 — "신혼여행 400만 원 중 142"
 *
 * 시각·장소·메모는 **일부러 없다.** 공개 범위 밖이라 서버가 아예 안 내려
 * 준다 (`docs/BRAG_API.md`). 여기에 새 값을 붙이려면 안내 모달의
 * `OPEN_FIELDS` 를 먼저 고쳐야 한다.
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2027년 1월 10일 일요일". 카드의 "1월 10일" 보다 한 겹 자세하다 */
function longDate(startDate: string | null): string {
  if (!startDate) return "날짜 미정";
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) return "날짜 미정";
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 ${w}요일`;
}

interface BragPlanSheetProps {
  item: BragPlanItem;
  /** 이 항목이 속한 카테고리의 소계 (지출 + 예정). 몫을 내는 데 쓴다 */
  categorySubtotal: number;
  /** 묶음 머리와 같은 색. 어느 묶음에서 열렸는지가 색으로 이어진다 */
  categoryColor: string;
  onClose: () => void;
}

export default function BragPlanSheet({
  item,
  categorySubtotal,
  categoryColor,
  onClose,
}: BragPlanSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const done = item.status === "COMPLETED";
  const amount = item.amount ?? 0;
  const share =
    categorySubtotal > 0 && amount > 0
      ? Math.round((amount / categorySubtotal) * 100)
      : null;

  return (
    /*
      모달(z-200) 위에 얹힌다. ESC 는 이 시트가 먼저 먹는다 — 부모가
      `planItem` 이 열려 있으면 모달을 닫지 않는다.
    */
    <div
      className="fixed inset-0 z-[210] grid place-items-center bg-[#1a1c20]/35 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${item.title} 자세히`}
        className="relative w-full max-w-[360px] rounded-[24px] bg-white px-6 pb-6 pt-7 shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#7a6c74] transition-colors hover:bg-stone-100 hover:text-[#1b0d14]"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
        </button>

        <div className="flex items-center gap-2">
          <i
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: categoryColor }}
          />
          <span className="text-[12.5px] font-bold text-[#7a6c74]">
            {item.categoryName}
          </span>
        </div>

        <h3 className="mt-2 pr-8 text-[20px] font-bold leading-snug tracking-[-0.02em] text-[#1b0d14] break-keep">
          {item.title}
        </h3>

        {/* 상태는 색·취소선이 아니라 말로 적는다. 시트는 훑는 자리가 아니다 */}
        <span
          className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[12px] font-bold ${
            done ? "bg-[#f2eef0] text-[#7a6c74]" : "bg-[#fff2f6] text-[#ee2b8c]"
          }`}
        >
          {done ? "완료했어요" : "아직 예정이에요"}
        </span>

        <dl className="mt-5 grid gap-3 border-t border-stone-100 pt-5 text-[13.5px]">
          <div className="flex items-baseline gap-4">
            <dt className="w-14 shrink-0 text-[#7a6c74]">날짜</dt>
            <dd className="min-w-0 font-bold text-[#1b0d14]">
              {longDate(item.startDate)}
            </dd>
          </div>
          <div className="flex items-baseline gap-4">
            <dt className="w-14 shrink-0 text-[#7a6c74]">금액</dt>
            <dd className="min-w-0">
              {item.amount == null ? (
                <span className="text-[#7a6c74]">정하지 않았어요</span>
              ) : (
                <span className="font-user-content text-[19px] font-bold tracking-[-0.02em] text-[#1b0d14] tabular-nums">
                  {amount.toLocaleString("ko-KR")}만 원
                </span>
              )}
            </dd>
          </div>
        </dl>

        {/*
          카드에는 없던 값. 이미 받은 데이터로만 만든다 — 이 시트를 여는
          이유가 여기 하나뿐이라, 몫을 못 내는 경우에는 줄 자체를 안 낸다.
        */}
        {share != null && (
          <p className="mt-4 rounded-[14px] bg-[#faf7f9] px-4 py-3 text-[12.5px] leading-relaxed text-[#7a6c74]">
            {item.categoryName}에 쓴{" "}
            <b className="font-bold text-[#1b0d14]">
              {categorySubtotal.toLocaleString("ko-KR")}만 원
            </b>{" "}
            가운데 <b className="font-bold text-[#ee2b8c]">{share}%</b>예요.
          </p>
        )}

        <p className="mt-4 text-[12px] leading-relaxed text-gray-400">
          남의 플랜이라 보기만 할 수 있어요.
        </p>
      </div>
    </div>
  );
}
