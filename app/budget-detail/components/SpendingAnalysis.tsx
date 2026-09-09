import React, { useMemo } from "react";
import { Expense, Category } from "../types";

interface SpendingAnalysisProps {
  expenses: Expense[];
  selectedCategory: Category | null;
  onCategorySelect: (category: Category) => void;
  /** 고른 카테고리 풀기. 제목 줄에 함께 두어야 무엇이 걸렸는지 보인다 */
  onClearFilter: () => void;
}

/**
 * 카테고리별 예산 표.
 *
 * 비율은 옆의 도넛이 맡고 여기는 **정확한 값**을 맡는다 — 예산·사용·남음을
 * 열로 세워야 서로 빼서 비교가 된다. 예전에는 `사용 / 예산` 한 덩어리라
 * "얼마 남았나"를 사람이 암산해야 했다.
 *
 * **폰에서도 세 열을 세운다**(시안 C안 05). 예전에는 좁으면 `사용 / 예산`
 * 한 덩어리로 접혔는데, 그러면 폰에서만 다시 암산을 해야 했다. 58px 짜리
 * 숫자 열 셋은 375px 에서도 들어간다(이름 칸에 131px 이 남는다).
 *
 * 대신 **막대는 넓을 때만** 낸다. 기준은 뷰포트가 아니라 이 카드의 폭이다 —
 * 오른쪽에 목록이 붙으면 뷰포트가 그대로여도 이 카드는 좁아진다.
 */
const SpendingAnalysis: React.FC<SpendingAnalysisProps> = ({
  expenses,
  selectedCategory,
  onCategorySelect,
  onClearFilter,
}) => {
  const categoryData = useMemo(() => {
    const groups: Record<Category, { used: number; planned: number }> = {};

    expenses.forEach((e) => {
      if (!groups[e.category]) groups[e.category] = { used: 0, planned: 0 };
      groups[e.category].planned += e.plannedAmount;
      groups[e.category].used += e.amount;
    });

    return Object.entries(groups)
      .map(([category, values]) => ({
        category: category as Category,
        ...values,
      }))
      .sort((a, b) => b.used - a.used); // 많이 쓴 순
  }, [expenses]);

  const won = (v: number) => v.toLocaleString("ko-KR");

  return (
    <div className="@container md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-6 md:shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3 px-4 md:mb-4 md:px-0">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#1b0d14] md:text-[17px]">
          카테고리별
        </h2>
        {selectedCategory && (
          <button
            type="button"
            onClick={onClearFilter}
            className="shrink-0 rounded-full bg-[#fff2f6] px-3 py-1 text-[12px] font-bold text-[#ee2b8c] transition-colors hover:bg-[#ffe2ee]"
          >
            필터 해제
          </button>
        )}
      </div>

      {/* 머리 줄. 시안은 12px 굵은 회색이다 */}
      <div className="grid grid-cols-[minmax(0,1fr)_58px_58px_58px] items-center gap-x-3 px-4 py-3 text-[12px] font-bold text-[#868b94] md:gap-x-4 md:px-0 md:pb-2 md:pt-0 md:font-normal md:text-gray-400 @[560px]:grid-cols-[minmax(0,1.4fr)_64px_64px_64px_minmax(110px,1fr)]">
        <span>카테고리</span>
        <span className="text-right">예산</span>
        <span className="text-right">사용</span>
        <span className="text-right">남음</span>
        <span className="hidden @[560px]:block" />
      </div>

      {categoryData.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-gray-400">
          카테고리 데이터가 없습니다.
        </p>
      ) : (
        <div>
          {categoryData.map((data) => {
            const percentage =
              data.planned > 0
                ? (data.used / data.planned) * 100
                : data.used > 0
                  ? 100
                  : 0;
            const progress = Math.min(100, percentage);
            const left = data.planned - data.used;
            const isActive = selectedCategory === data.category;
            const empty = data.planned === 0 && data.used === 0;

            return (
              <button
                type="button"
                key={data.category}
                onClick={() => onCategorySelect(data.category)}
                aria-pressed={isActive}
                className={`grid w-full grid-cols-[minmax(0,1fr)_58px_58px_58px] items-center gap-x-3 gap-y-2 border-t border-[#0000000c] px-4 py-3 text-left transition-colors hover:bg-[#f7f8f9] md:gap-x-4 md:border-[#f4eff2] md:px-2 md:first:border-t-0 md:hover:bg-[#fcfbfc] @[560px]:grid-cols-[minmax(0,1.4fr)_64px_64px_64px_minmax(110px,1fr)] ${
                  isActive ? "bg-[#fff7fa] hover:bg-[#fff7fa]" : ""
                }`}
              >
                <span
                  className={`truncate text-[14px] font-medium md:text-[13.5px] md:font-bold ${
                    isActive
                      ? "text-[#ee2b8c]"
                      : empty
                        ? "text-gray-400"
                        : "text-[#1b0d14]"
                  }`}
                >
                  {data.category}
                </span>

                {/* 예산 · 사용 · 남음. 남음만 굵게 — 이 화면에서 찾는 값이다 */}
                <span
                  className={`font-user-content text-right text-[13px] tracking-[-0.02em] md:font-bold ${empty ? "text-gray-300" : "text-[#1b0d14]"}`}
                >
                  {won(data.planned)}
                </span>
                <span
                  className={`font-user-content text-right text-[13px] tracking-[-0.02em] md:font-bold ${empty ? "text-gray-300" : "text-[#1b0d14]"}`}
                >
                  {won(data.used)}
                </span>
                <span
                  className={`font-user-content text-right text-[13px] font-bold tracking-[-0.02em] ${
                    empty
                      ? "text-gray-300"
                      : left < 0
                        ? "text-[#e5484d]"
                        : "text-[#1b0d14] md:text-[#7a6c74]"
                  }`}
                >
                  {won(left)}
                </span>

                {/* 막대는 넓을 때만. 폰에서는 세 숫자가 이미 그 말을 한다 */}
                <span className="col-span-4 hidden @[560px]:col-span-1 @[560px]:block">
                  <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#f4eff2]">
                    <i
                      className={`block h-full transition-all duration-700 ease-out ${
                        left < 0
                          ? "bg-[#e5484d]"
                          : "bg-gradient-to-r from-[#ff7ab5] to-[#ee2b8c]"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SpendingAnalysis;
