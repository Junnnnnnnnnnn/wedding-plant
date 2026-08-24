import React from "react";
import { BudgetStats } from "../types";

const RING = 100; // pathLength 를 100 으로 맞춰 값을 그대로 % 로 쓴다

interface Seg {
  key: string;
  from: number;
  len: number;
  color: string;
}

interface BudgetDonutProps {
  stats: BudgetStats;
}

/**
 * 예산 구성 도넛.
 *
 * **자본을 넘긴 경우가 이 화면의 어려운 부분이다.** 원은 100% 를 넘길 수 없어
 * 그냥 그리면 124% 도 "꽉 참"으로만 보인다. 그래서 분모를 자본이 아니라
 * `max(자본, 사용+예정)` 으로 두고, 자본 위치에 눈금을 찍는다. 눈금을 넘어간
 * 만큼이 빨간 초과 구간이다 — 홈 대시보드의 막대를 원으로 만 것과 같다.
 *
 * 색의 뜻도 같다 — 분홍=실제로 나간 돈, 회색=아직 안 쓴 예정, 트랙=여유.
 */
const BudgetDonut: React.FC<BudgetDonutProps> = ({ stats }) => {
  const capital = stats.initialCapital;
  const used = stats.usedTotal;
  const planned = stats.plannedTotal;

  // 초기 자본에서 예정까지 뺀 값. 위 요약과 도넛 가운데가 같은 숫자여야 한다
  const remaining = capital - planned - used;
  const usedPercent = capital > 0 ? Math.round((used / capital) * 100) : 0;
  const overAmount = Math.max(0, used + planned - capital);

  const total = Math.max(capital, used + planned);
  const pct = (v: number) => (total > 0 ? (v / total) * RING : 0);

  const withinCapital = Math.min(used, capital);
  const overUsed = Math.max(0, used - capital);

  const segs: Seg[] = [];
  let cursor = 0;
  const push = (key: string, value: number, color: string) => {
    const len = pct(value);
    if (len <= 0) return;
    segs.push({ key, from: cursor, len, color });
    cursor += len;
  };
  push("used", withinCapital, "#ee2b8c");
  push("over", overUsed, "#e5484d");
  push("planned", planned, "#cdbfc7");

  // 자본 눈금 — 넘겼을 때만 의미가 있다
  const capitalMark = overAmount > 0 ? pct(capital) : null;

  return (
    <div className="rounded-[28px] border border-[#ee2b8c0f] bg-white p-6 shadow-sm">
      <p className="text-[12.5px] text-gray-400">예산 구성</p>

      <div className="relative mx-auto mt-4 h-[190px] w-[190px]">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke="#f4eff2"
            strokeWidth="6"
            pathLength={RING}
          />
          {segs.map((s) => (
            <circle
              key={s.key}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={s.color}
              strokeWidth="6"
              pathLength={RING}
              strokeDasharray={`${s.len} ${RING - s.len}`}
              strokeDashoffset={-s.from}
            />
          ))}
          {/*
            자본 눈금. 흰 틈을 먼저 내고 그 위에 검은 선을 얹는다 —
            선만 그리면 색 경계에 묻혀 렌더링 티처럼 보인다.
            사용이 자본을 안 넘고 예정 때문에만 넘는 경우에는 빨간 구간이
            없어서 이 눈금이 유일한 표시다.
          */}
          {capitalMark !== null && (
            <>
              <circle
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke="#ffffff"
                strokeWidth="6"
                pathLength={RING}
                strokeDasharray={`2 ${RING - 2}`}
                strokeDashoffset={-(capitalMark - 1)}
              />
              <circle
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke="#1b0d14"
                strokeWidth="6"
                pathLength={RING}
                strokeDasharray={`0.8 ${RING - 0.8}`}
                strokeDashoffset={-(capitalMark - 0.4)}
              />
            </>
          )}
        </svg>
        <div className="absolute inset-[30px] flex flex-col items-center justify-center rounded-full text-center">
          <span className="text-[12px] text-gray-400">남은 금액</span>
          <span
            className={`font-user-content mt-0.5 text-[26px] font-bold leading-none tracking-[-0.03em] ${
              remaining < 0 ? "text-[#e5484d]" : "text-[#1b0d14]"
            }`}
          >
            {remaining.toLocaleString("ko-KR")}
          </span>
          <span className="mt-0.5 text-[11.5px] text-gray-400">만원</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[12.5px] text-[#7a6c74]">
        {/*
          넘긴 경우 분홍 구간은 "사용 전체"가 아니라 자본까지다. 그냥
          "사용"이라 쓰면 옆 표의 합과 어긋나 보여서 이름을 나눈다.
        */}
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-[3px] bg-[#ee2b8c]" />
          {used > capital ? "자본 내 사용" : "사용"}{" "}
          {Math.min(used, capital).toLocaleString("ko-KR")}
        </span>
        {used > capital && (
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-[3px] bg-[#e5484d]" />
            자본 초과 {(used - capital).toLocaleString("ko-KR")}
          </span>
        )}
        {capitalMark !== null && (
          <span className="inline-flex items-center gap-1.5">
            <i className="h-3 w-[3px] rounded-[1px] bg-[#1b0d14]" />
            초기 자본
          </span>
        )}
        {planned > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-[3px] bg-[#cdbfc7]" />
            예정 {planned.toLocaleString("ko-KR")}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-2.5 border-t border-[#f4eff2] pt-4 text-[12.5px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">초기 자본</span>
          <span className="font-user-content text-[14px] font-bold tracking-[-0.02em]">
            {capital.toLocaleString("ko-KR")}만원
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">사용률</span>
          <span
            className={`font-user-content text-[14px] font-bold tracking-[-0.02em] ${
              usedPercent > 100 ? "text-[#e5484d]" : "text-[#1b0d14]"
            }`}
          >
            {usedPercent}%
          </span>
        </div>
      </div>

      {/*
        예산을 넘겼을 때만 문장으로 한 번 더 말한다. 예전에는 카드의
        "남은 금액"과 분석의 "사용 후 잔액"이 서로 다른 값이라 물음표
        툴팁으로 해명해야 했다. 지금은 둘 다 이 도넛의 구간이다.
      */}
      {remaining < 0 && (
        <p className="mt-4 rounded-2xl border border-[#e5484d22] bg-[#fff5f5] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#8a3236]">
          자본보다{" "}
          <b className="font-bold">
            {Math.abs(remaining).toLocaleString("ko-KR")}만원
          </b>
          이 모자랍니다
          {used > capital && (
            <>
              {" "}
              — 이미{" "}
              <b className="font-bold">
                {(used - capital).toLocaleString("ko-KR")}만원
              </b>
              을 더 썼고, 예정 {planned.toLocaleString("ko-KR")}만원이 남아
              있습니다
            </>
          )}
          .
        </p>
      )}
    </div>
  );
};

export default BudgetDonut;
