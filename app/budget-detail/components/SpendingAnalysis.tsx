import React, { useMemo, useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { BudgetStats, Expense, Category } from "../types";

const SAVINGS_TOOLTIP =
  "초기 자본에서 이미 '사용'한 금액만 뺀 값이에요. 위 카드의 '남은 금액'은 여기에 '예정' 금액까지 뺀 값이라 더 작습니다.";

interface SpendingAnalysisProps {
  stats: BudgetStats;
  expenses: Expense[];
  selectedCategory: Category | null;
  onCategorySelect: (category: Category) => void;
}

const SpendingAnalysis: React.FC<SpendingAnalysisProps> = ({
  stats,
  expenses,
  selectedCategory,
  onCategorySelect,
}) => {
  const [showSavingsTooltip, setShowSavingsTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 전체 초기 자본 중 usedAmount 사용율 (%)
  const usedPercentage =
    stats.initialCapital > 0
      ? Math.round((stats.usedTotal / stats.initialCapital) * 100)
      : 0;
  // 초기 자본에서 usedAmount만 뺀 값.
  // 위 StatCard 의 "남은 금액"(초기 자본 - 예정 - 사용)과는 다른 수치다.
  // 라벨 없이 숫자만 두었더니 같은 화면에 "남은 금액"이 두 값으로 보였다.
  const savings = stats.initialCapital - stats.usedTotal;

  useEffect(() => {
    if (!showSavingsTooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setShowSavingsTooltip(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSavingsTooltip]);

  // Group expenses by category for the analysis chart
  const categoryData = useMemo(() => {
    const groups: Record<Category, { used: number; planned: number }> =
      {} as any;

    expenses.forEach((e) => {
      // In the user's project, category is user defined string.
      if (!groups[e.category]) {
        groups[e.category] = { used: 0, planned: 0 };
      }
      groups[e.category].planned += e.plannedAmount;
      groups[e.category].used += e.amount;
    });

    return Object.entries(groups)
      .map(([category, values]) => ({
        category: category as Category,
        ...values,
      }))
      .sort((a, b) => b.used - a.used); // usedAmount 큰 순 내림차순
  }, [expenses]);

  return (
    <div className="bg-white rounded-[32px] p-6 border border-[#ee2b8c0a] shadow-sm">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-[#ee2b8c88] text-[10px] font-extrabold uppercase tracking-widest mb-1">
            전체 사용률
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-[#1b0d14] tracking-tighter">
              {usedPercentage}%
            </span>
            <span className="text-gray-400 font-bold text-sm">사용</span>
          </div>
        </div>
        <div className="relative" ref={tooltipRef}>
          <div
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold tracking-tight ${savings >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
          >
            <span className="opacity-70 font-bold">사용 후 잔액</span>
            <span>
              {savings >= 0 ? "+" : "-"}
              {Math.abs(savings).toLocaleString("ko-KR")}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSavingsTooltip((prev) => !prev);
              }}
              className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 transition-colors -mr-0.5 ${savings >= 0 ? "text-green-600 hover:bg-green-100" : "text-red-600 hover:bg-red-100"}`}
              aria-label="이 숫자의 의미 보기"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          {showSavingsTooltip && (
            <div
              className="absolute right-0 top-full mt-2 z-10 w-64 rounded-xl bg-[#1b0d14] text-white text-xs leading-relaxed p-3 shadow-xl"
              role="tooltip"
            >
              {SAVINGS_TOOLTIP}
              <span className="absolute -top-1.5 right-6 w-3 h-3 bg-[#1b0d14] rotate-45" />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {categoryData.map((data) => {
          // If no plan but spent money, show 100%. If no plan and no spend, 0%.
          const percentage =
            data.planned > 0
              ? (data.used / data.planned) * 100
              : data.used > 0
                ? 100
                : 0;
          const progress = Math.min(100, percentage);

          const isDimmed =
            selectedCategory !== null && selectedCategory !== data.category;
          const isActive = selectedCategory === data.category;

          return (
            <div
              key={data.category}
              onClick={() => onCategorySelect(data.category)}
              className={`space-y-2 cursor-pointer transition-all duration-300 transform ${isDimmed ? "opacity-30 grayscale scale-[0.98]" : "scale-100"} ${isActive ? "translate-x-1" : ""}`}
            >
              <div className="font-user-content flex justify-between text-[11px] font-extrabold">
                <span
                  className={`uppercase tracking-tight transition-colors ${isActive ? "text-[#ee2b8c]" : "text-[#1b0d14] opacity-70"}`}
                >
                  {data.category}
                </span>
                <span className="text-[#ee2b8c] font-bold">
                  {data.used.toLocaleString("ko-KR")} /{" "}
                  {data.planned.toLocaleString("ko-KR")}
                  <span className="text-[10px] font-semibold text-gray-500 ml-0.5">
                    만원
                  </span>
                </span>
              </div>
              <div className="h-3 w-full bg-[#ee2b8c0a] rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${isActive ? "bg-[#ee2b8c] shadow-[0_0_12px_rgba(238,43,140,0.4)]" : "bg-[#ee2b8c]"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {categoryData.length === 0 && (
        <p className="text-center text-gray-400 py-4 text-sm font-medium italic">
          카테고리 데이터가 없습니다.
        </p>
      )}
    </div>
  );
};

export default SpendingAnalysis;
