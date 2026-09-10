"use client";

import React from "react";
import { Heart } from "lucide-react";
import { BragPost } from "@/types";

/**
 * 자랑하기 목록의 카드 — 시안 A안 (`docs/concepts/brag-list.html`).
 *
 * 카드가 **커플과 날짜로 시작한다.** 앱 안에서 이미 읽는 순서가
 * "누구의 · 언제 → 얼마 → 무엇을" 이라 새로 배울 것이 없다.
 *
 * 배치는 **핀터레스트식 벽돌**(`column-count`)이다. 카테고리 칩이 한 줄이냐
 * 두 줄이냐, 플랜이 몇 개냐로 카드 높이가 갈리는데 격자로 두면 그 차이만큼
 * 아래가 톱니처럼 남는다. CSS 다단은 **JS 없이 되는 유일한 방법**이다 —
 * Grid 의 `masonry` 는 아직 사파리에만 있고, 라이브러리로 하면 카드가 붙을
 * 때마다 좌표를 다시 계산하느라 목록이 출렁인다.
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dateLabel(date: string | null, dday: number | null): string {
  const parts: string[] = [];
  if (date) {
    const [y, m, d] = date.split("-").map(Number);
    if (y && m && d) {
      const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
      parts.push(`${y}년 ${m}월 ${d}일 (${w})`);
    }
  }
  if (dday != null) {
    if (dday === 0) parts.push("D-DAY");
    else parts.push(dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`);
  }
  return parts.join(" · ") || "결혼식 날짜 미정";
}

interface BragCardProps {
  post: BragPost;
  onOpen: () => void;
  onToggleLike: () => void;
  onUnpublish?: () => void;
  likePending?: boolean;
}

export default function BragCard({
  post,
  onOpen,
  onToggleLike,
  onUnpublish,
  likePending = false,
}: BragCardProps) {
  const remaining = post.totalBudget - post.usedAmount - post.plannedAmount;
  const pct = (v: number) =>
    post.totalBudget > 0
      ? `${Math.min(100, (v / post.totalBudget) * 100)}%`
      : "0%";
  /* 눈금이 실선이 되면 뜻이 없다. 아주 많으면 숫자만 적는다 */
  const showTicks = post.planCount > 0 && post.planCount <= 32;

  return (
    <div
      /*
        `break-inside: avoid` 로 카드가 단 경계에서 반으로 잘리지 않게 한다.
        `mb-*` 가 단 안의 세로 간격이다 (`gap` 은 다단에 안 먹는다).
      */
      className="mb-5 block w-full break-inside-avoid"
    >
      <div className="rounded-[20px] border border-stone-100 bg-white p-5 transition-shadow hover:border-[#ffd0e3] hover:shadow-md">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left"
          aria-label={`${post.nickname} 의 플랜 보기`}
        >
          <span className="block truncate text-[17px] font-bold tracking-[-0.02em] text-[#1b0d14]">
            {post.nickname}
          </span>
          <span className="mt-1 block text-[13px] text-[#7a6c74]">
            {dateLabel(post.weddingDate, post.dday)}
          </span>

          <span className="mt-4 block font-user-content text-[30px] font-bold leading-none tracking-[-0.04em] text-[#1b0d14] tabular-nums">
            {remaining.toLocaleString("ko-KR")}
            <small className="text-[15px] font-bold">만 원</small>
          </span>
          <span className="mt-1.5 block text-[13px] text-[#7a6c74]">
            {post.totalBudget.toLocaleString("ko-KR")}만 원 중 남음
          </span>

          {/* 분홍 = 실제 지출, 회색 = 아직 안 쓴 예정. 홈 막대와 뜻이 같다 */}
          <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-[#f4eff2]">
            <span className="flex h-full">
              <i
                className="block h-full bg-[#ee2b8c]"
                style={{ width: pct(post.usedAmount) }}
              />
              <i
                className="block h-full bg-[#cdbfc7]"
                style={{ width: pct(post.plannedAmount) }}
              />
            </span>
          </span>
          <span className="mt-2 block text-[12px] text-gray-400">
            사용 {post.usedAmount.toLocaleString("ko-KR")} · 예정{" "}
            {post.plannedAmount.toLocaleString("ko-KR")}
          </span>

          {post.categories.length > 0 && (
            <span className="mt-4 flex flex-wrap gap-1.5">
              {post.categories.map((name) => (
                <i
                  key={name}
                  className="rounded-md bg-[#f7f5f6] px-[7px] py-0.5 text-[12px] not-italic text-[#7a6c74]"
                >
                  {name}
                </i>
              ))}
            </span>
          )}

          {/* 금액 다음으로 궁금한 값 — "얼마나 했나" */}
          <span className="mt-4 block">
            <span className="flex items-baseline gap-2 text-[12px] text-gray-400">
              플랜{" "}
              <b className="text-[13px] font-bold tabular-nums text-[#1b0d14]">
                {post.planCount}개
              </b>{" "}
              · 완료{" "}
              <b className="text-[13px] font-bold tabular-nums text-[#1b0d14]">
                {post.doneCount}개
              </b>
            </span>
            {showTicks && (
              <span className="mt-2 flex gap-[2px]" aria-hidden>
                {Array.from({ length: post.planCount }, (_, i) => (
                  <i
                    key={i}
                    className={`h-[7px] min-w-0 flex-1 rounded-[2px] ${
                      i < post.doneCount ? "bg-[#ee2b8c]" : "bg-[#f4eff2]"
                    }`}
                  />
                ))}
              </span>
            )}
          </span>
        </button>

        <div className="mt-4 flex items-center border-t border-stone-100 pt-3 text-[12px] text-gray-400">
          {post.isMine ? (
            <>
              <span className="font-bold text-[#ee2b8c]">내 플랜</span>
              <span className="ml-2 inline-flex items-center gap-1 tabular-nums">
                <Heart
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                  strokeWidth={0}
                />
                {post.likeCount.toLocaleString("ko-KR")}
              </span>
              {onUnpublish && (
                /*
                  내리는 길을 목록에도 둔다. 대시보드까지 돌아가게 하면
                  "언제든 내릴 수 있다" 는 안내 모달의 약속이 흐려진다.
                */
                <button
                  type="button"
                  onClick={onUnpublish}
                  className="ml-auto rounded-full px-2.5 py-1 text-[12px] font-bold text-[#7a6c74] transition-colors hover:bg-stone-50 hover:text-[#1b0d14]"
                >
                  내려두기
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleLike}
              disabled={likePending}
              aria-pressed={post.liked}
              aria-label={post.liked ? "좋아요 취소" : "좋아요"}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold tabular-nums transition-colors ${
                post.liked
                  ? "bg-[#fff2f6] text-[#ee2b8c]"
                  : "bg-[#f7f5f6] text-[#7a6c74] hover:bg-[#fff2f6] hover:text-[#ee2b8c]"
              }`}
            >
              <Heart
                className="h-3.5 w-3.5"
                strokeWidth={2}
                fill={post.liked ? "currentColor" : "none"}
              />
              {post.likeCount.toLocaleString("ko-KR")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
