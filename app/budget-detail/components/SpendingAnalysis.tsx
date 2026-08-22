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
 * 좁을 때는 열이 접히고 `사용 / 예산` 한 줄로 돌아간다. 표를 가로로
 * 스크롤시키지 않는 이유는 폰에서 남음 열이 화면 밖에 숨기 때문이다.
 * 기준은 뷰포트가 아니라 이 카드의 폭이다 — 오른쪽에 목록이 붙으면
 * 뷰포트가 그대로여도 이 카드는 좁아진다.
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
    <div className="@container rounded-[28px] border border-[#ee2b8c0f] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[#1b0d14]">
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

      {/* 좁을 때는 열이 갈라지지 않으므로 이름 대신 한 줄 힌트만 낸다 */}
      <p className="pb-1 text-right text-[12px] text-gray-300 @[560px]:hidden">
        사용 / 예산
      </p>
      <div className="hidden grid-cols-[minmax(0,1.4fr)_64px_64px_64px_minmax(110px,1fr)] items-center gap-x-4 pb-2 text-[12px] text-gray-400 @[560px]:grid">
        <span>카테고리</span>
        <span className="text-right">예산</span>
        <span className="text-right">사용</span>
        <span className="text-right">남음</span>
        <span />
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
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-[#f4eff2] px-2 py-3 text-left transition-colors first:border-t-0 hover:bg-[#fcfbfc] @[560px]:grid-cols-[minmax(0,1.4fr)_64px_64px_64px_minmax(110px,1fr)] ${
                  isActive ? "bg-[#fff7fa] hover:bg-[#fff7fa]" : ""
                }`}
              >
                <span
                  className={`truncate text-[13.5px] font-bold ${
                    isActive
                      ? "text-[#ee2b8c]"
                      : empty
                        ? "text-gray-400"
                        : "text-[#1b0d14]"
                  }`}
                >
                  {data.category}
                </span>

                {/* 좁을 때: 한 덩어리 */}
                <span className="font-user-content text-right text-[12.5px] text-[#7a6c74] @[560px]:hidden">
                  {empty ? (
                    <span className="text-gray-400">아직 없음</span>
                  ) : (
                    <>
                      <b className="font-bold text-[#1b0d14]">
                        {won(data.used)}
                      </b>
                      {" / "}
                      {won(data.planned)}만원
                    </>
                  )}
                </span>

                {/* 넓을 때: 예산 · 사용 · 남음 */}
                <span
                  className={`font-user-content hidden text-right text-[13px] font-bold tracking-[-0.02em] @[560px]:block ${empty ? "text-gray-300" : "text-[#1b0d14]"}`}
                >
                  {won(data.planned)}
                </span>
                <span
                  className={`font-user-content hidden text-right text-[13px] font-bold tracking-[-0.02em] @[560px]:block ${empty ? "text-gray-300" : "text-[#1b0d14]"}`}
                >
                  {won(data.used)}
                </span>
                <span
                  className={`font-user-content hidden text-right text-[13px] font-bold tracking-[-0.02em] @[560px]:block ${
                    empty
                      ? "text-gray-300"
                      : left < 0
                        ? "text-[#e5484d]"
                        : "text-[#7a6c74]"
                  }`}
                >
                  {won(left)}
                </span>

                <span className="col-span-2 @[560px]:col-span-1">
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
