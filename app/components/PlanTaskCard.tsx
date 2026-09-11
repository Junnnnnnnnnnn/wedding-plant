"use client";

import { Check } from "lucide-react";
import { formatKoreanTime, parseLocalDate } from "@/lib/utils";
import { PAYMENT_MISMATCH_LABEL, paymentMismatch } from "@/lib/schedulePaid";

export interface PlanTaskItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  /** 시작 시각 "HH:mm". 안 정했으면 비어 있다 */
  startTime?: string | null;
  status?: string | null;
  /**
   * 돈이 나갔는지. **`status` 와 다른 축이다** — 계약금을 미리 낸 일정은
   * 예정이어도 이미 쓴 돈이다. 없으면 완료 여부를 따라간다
   * (`lib/schedulePaid.ts`).
   */
  isPaid?: boolean | null;
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
  /**
   * 남의 플랜을 **보기만** 할 때 (자랑하기 상세 모달).
   *
   * `onToggle` 을 안 넘기는 것과는 다르다 — 그러면 체크가 `disabled` 라
   * 흐려지고, 앱의 카드와 모양이 달라진다. 여기서는 **모양은 똑같이 두되
   * 아예 버튼이 아니게** 만든다. 커서도 안 바뀌고 탭 순서에도 안 들어간다.
   */
  readOnly?: boolean;
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
  readOnly = false,
}: PlanTaskCardBodyProps) {
  const done = item.status === "COMPLETED";
  const mismatch = paymentMismatch(item);
  const boxClass = `mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[7px] border-2 ${
    done ? "border-[#ffaab8] bg-[#ffaab8]" : "border-[#e6dbe2] bg-white"
  }`;
  const check = (
    <Check
      className={`h-[11px] w-[11px] text-white ${done ? "opacity-100" : "opacity-0"}`}
      strokeWidth={4}
    />
  );

  return (
    <>
      <div className="flex items-start gap-2.5">
        {readOnly ? (
          <span
            role="img"
            aria-label={done ? "완료" : "예정"}
            className={boxClass}
          >
            {check}
          </span>
        ) : (
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
              done
                ? "border-[#ffaab8] bg-[#ffaab8]"
                : "border-[#e6dbe2] bg-white"
            }`}
          >
            {check}
          </button>
        )}
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
        <span>
          {formatTaskDay(item.startDate)}
          {formatKoreanTime(item.startTime) ? (
            <>
              <span className="mx-1 opacity-50">·</span>
              {formatKoreanTime(item.startTime)}
            </>
          ) : null}
        </span>
        {item.amount ? (
          <span
            className={`font-bold tracking-tight ${done ? "text-[#a79ba3]" : "text-[#1b0d14]"}`}
          >
            {item.amount.toLocaleString("ko-KR")}만 원
          </span>
        ) : null}
        {/*
          **어긋날 때만 붙인다.** 예정+미결제, 완료+결제는 예전과 같은
          모습이라 아무 말도 하지 않는다 — 대부분의 일정이 거기다.
          미리 낸 계약금(예정인데 결제함)과 아직 정산 안 한 것(완료인데
          미결제)만 눈에 띄면 된다.
        */}
        {mismatch && (
          <span
            className={`rounded px-1.5 py-px text-[11px] font-bold ${
              mismatch === "PAID_AHEAD"
                ? "bg-[#eef6f2] text-[#079171]"
                : "bg-[#fff3e8] text-[#b06a1f]"
            }`}
          >
            {PAYMENT_MISMATCH_LABEL[mismatch]}
          </span>
        )}
        {trailing}
      </div>
    </>
  );
}
