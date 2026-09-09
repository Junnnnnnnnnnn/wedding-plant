import React from "react";
import { Expense, ExpenseStatus } from "../types";
import { CATEGORY_ICONS } from "../constants";

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  [ExpenseStatus.PAID]: "결제완료",
  [ExpenseStatus.PENDING]: "대기",
  [ExpenseStatus.DEPOSIT_PAID]: "계약금 결제",
  [ExpenseStatus.PLANNED]: "예정",
};

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  [ExpenseStatus.PAID]: "bg-[#fff2f6] text-[#ee2b8c]",
  [ExpenseStatus.PENDING]: "bg-[#fff2f6] text-[#ee2b8c]",
  [ExpenseStatus.DEPOSIT_PAID]: "bg-green-50 text-green-600",
  [ExpenseStatus.PLANNED]: "bg-[#f4eff2] text-[#7a6c74]",
};

const StatusBadge: React.FC<{ status: ExpenseStatus }> = ({ status }) => (
  <span
    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);

interface ExpenseListProps {
  expenses: Expense[];
}

/**
 * 항목 목록.
 *
 * 도넛·표와 같은 카드 언어로 맞춘다 — 흰 줄 + `#f4eff2` 테두리, 금액은
 * TmoneyRound(`font-user-content`). 예전에는 줄마다 그림자가 붙은 3xl 카드라
 * 목록이 길어지면 화면이 울퉁불퉁했다.
 */
const ExpenseList: React.FC<ExpenseListProps> = ({ expenses }) => {
  if (expenses.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[13px] text-gray-400">
        이 카테고리에 항목이 없습니다.
      </div>
    );
  }

  return (
    /*
      항목이 20개를 넘는 화면이라 카드 여백이 그대로 스크롤 길이가 된다.
      SEED ListItem 처럼 **구분선으로만** 나눈다 — 배경도 테두리도 그림자도
      쓰지 않는다.
    */
    <div>
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className="flex items-center gap-3 border-b border-[#0000000c] px-4 py-3.5 transition-colors hover:bg-[#f7f8f9] md:px-1 md:py-3"
        >
          {/*
            아이콘 타일은 넓은 화면에만 둔다(시안 C안 05). 폰에서는 줄마다
            같은 분홍 타일이 반복돼, 정작 다른 값인 제목보다 먼저 읽혔다.
          */}
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee2b8c0f] text-[#ee2b8c] md:flex">
            {CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.Others}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="truncate text-[14px] font-medium text-[#1a1c20] md:font-bold md:text-[#1b0d14]">
              {expense.title}
            </h4>
            <p className="mt-0.5 truncate text-[12px] text-[#868b94] md:mt-0 md:text-gray-400">
              {expense.description}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {/* 폰은 시안대로 금액 한 줄. 상태는 예정/사용 세그먼트가 이미 말한다 */}
            <div className="text-[13px] text-[#868b94] md:hidden">
              {expense.plannedAmount > 0
                ? `${expense.plannedAmount.toLocaleString("ko-KR")}만 원`
                : "미정"}
            </div>
            <div className="hidden md:block">
              <div className="font-user-content text-[15px] font-bold tracking-[-0.02em] text-[#1b0d14]">
                {expense.plannedAmount.toLocaleString("ko-KR")}만원
              </div>
              <div className="mt-1">
                <StatusBadge status={expense.status} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExpenseList;
