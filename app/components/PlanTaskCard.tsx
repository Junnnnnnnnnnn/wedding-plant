"use client";

import { Check } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";

export interface PlanTaskItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  status?: string | null;
  /** 일정 장소. 홈의 "다가오는 일정"에서 쓴다 */
  location?: string | null;
}

export function formatTaskDay(startDate: string | null): string {
  const d = startDate ? parseLocalDate(startDate) : null;
  if (!d) return "날짜 미정";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

interface PlanTaskCardBodyProps {
  item: PlanTaskItem;
  /** 완료 토글. 없으면 체크박스가 비활성으로 보인다 */
  onToggle?: () => void;
  toggleDisabled?: boolean;
  /** 카드 오른쪽에 붙는 것 (담당자 아바타 등) */
  trailing?: React.ReactNode;
}

/**
 * 플랜 카드의 속 내용. 홈의 "이번 달 할 일" 스트립과 플랜 보드가 함께 쓴다.
 *
 * 바깥 껍데기는 각자 다르다 — 보드는 드래그·선택 상태를 얹은 div 를,
 * 홈 스트립은 누르면 상세로 가는 button 을 쓴다. 그래서 껍데기는 넘기지 않고
 * 속만 공유한다.
 */
export default function PlanTaskCardBody({
  item,
  onToggle,
  toggleDisabled = false,
  trailing,
}: PlanTaskCardBodyProps) {
  const done = item.status === "COMPLETED";

  return (
    <>
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? "완료 해제" : "완료로 표시"}
          disabled={toggleDisabled || !onToggle}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className={`mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[7px] border-2 transition-colors disabled:opacity-50 ${
            done ? "border-[#ffaab8] bg-[#ffaab8]" : "border-[#e6dbe2] bg-white"
          }`}
        >
          <Check
            className={`h-[11px] w-[11px] text-white ${done ? "opacity-100" : "opacity-0"}`}
            strokeWidth={4}
          />
        </button>
        <span
          className={`text-[14.5px] font-bold leading-snug tracking-tight break-keep ${
            done
              ? "text-[#a79ba3] line-through decoration-[#d9cdd4]"
              : "text-[#1b0d14]"
          }`}
        >
          {item.title}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[29px] text-[12px] text-[#7a6c74]">
        {item.categoryName && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              done
                ? "bg-[#f2eef0] text-[#a79ba3]"
                : "bg-[#fff2f6] text-[#ee2b8c]"
            }`}
          >
            {item.categoryName}
          </span>
        )}
        <span>{formatTaskDay(item.startDate)}</span>
        {item.amount ? (
          <span
            className={`font-bold tracking-tight ${done ? "text-[#a79ba3]" : "text-[#1b0d14]"}`}
          >
            {item.amount.toLocaleString("ko-KR")}만 원
          </span>
        ) : null}
        {trailing}
      </div>
    </>
  );
}
