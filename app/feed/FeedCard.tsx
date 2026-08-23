"use client";

import React from "react";
import { MapPin, Plus, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { FeedPost, FeedVote } from "@/types";

/**
 * 후기 카드 (시안 D — 한 줄 카드).
 *
 * 왼쪽에 금액 하나만 크게 두고 오른쪽에 나머지를 싣는다. 이 화면에서 사람이
 * 실제로 하는 일이 "금액을 위아래로 훑는 것"이라, 금액이 같은 x 좌표에
 * 세로로 줄지어야 비교가 된다.
 */

/**
 * "D-131 신부" 문장을 여기서 만든다.
 *
 * 서버는 남은 일수와 역할만 준다 — 완성된 문구를 내려보내면 문구를 고칠
 * 때마다 백엔드 배포에 묶인다 (`ActivityPanel.describe()` 와 같은 규칙).
 */
export function describeAuthor(post: FeedPost): string {
  const role =
    post.authorRole === "BRIDE"
      ? "신부"
      : post.authorRole === "GROOM"
        ? "신랑"
        : "예비부부";

  if (post.authorDDay === null) return role;
  if (post.authorDDay > 0) return `D-${post.authorDDay} ${role}`;
  if (post.authorDDay === 0) return `D-Day ${role}`;
  return `결혼식 ${Math.abs(post.authorDDay)}일 뒤 ${role}`;
}

/** "3일 전" 같은 상대 시각. 한 달이 넘으면 날짜로 적는다 */
export function describeWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;

  const d = new Date(then);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/**
 * 카카오맵 링크. 좌표가 있어야 열린다.
 *
 * `ScheduleDetailView` 가 쓰는 것과 같은 형식이다. 앱을 따로 만들지 않아도
 * 지도가 필요한 사람은 여기서 넘어간다 — 목록에 지도 이미지를 깔면
 * 금액을 세로로 훑는 흐름이 깨져서, 지도는 한 단계 밖에 둔다.
 */
function kakaoMapLink(post: FeedPost): string | null {
  if (post.lat === null || post.lng === null) return null;
  if (post.lat === 0 && post.lng === 0) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(post.title)},${
    post.lat
  },${post.lng}`;
}

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span
    className="flex shrink-0 items-center gap-px"
    aria-label={`만족도 ${rating}점`}
  >
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`h-3 w-3 ${
          n <= rating ? "fill-[#ffb020] text-[#ffb020]" : "text-[#e9e1e5]"
        }`}
        strokeWidth={2}
      />
    ))}
  </span>
);

interface FeedCardProps {
  post: FeedPost;
  /** 같은 값을 다시 누르면 취소다 (부모가 처리) */
  onVote: (post: FeedPost, value: FeedVote) => void;
  onAddToPlan: (post: FeedPost) => void;
  /** 요청이 도는 동안 연타를 막는다 */
  votePending?: boolean;
}

const FeedCard: React.FC<FeedCardProps> = ({
  post,
  onVote,
  onAddToPlan,
  votePending = false,
}) => {
  const mapLink = kakaoMapLink(post);

  return (
    <article className="rounded-[24px] border border-[#ee2b8c0f] bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:shadow-[#ee2b8c0f] md:flex md:gap-5 md:p-[18px_20px]">
      {/* 금액 열 — 넓은 화면에서 세로로 줄이 맞아야 비교가 된다 */}
      <div className="shrink-0 md:w-[120px]">
        {post.amount === undefined ? (
          <div className="font-user-content text-[17px] font-bold tracking-[-0.02em] text-gray-400">
            금액 비공개
          </div>
        ) : (
          <div className="font-user-content text-[23px] font-bold leading-none tracking-[-0.03em] text-[#1b0d14]">
            {post.amount.toLocaleString("ko-KR")}만원
          </div>
        )}
        <div className="mt-1.5 text-[12px] text-gray-400">
          {post.categoryName}
        </div>
      </div>

      <div className="mt-3 min-w-0 flex-1 md:mt-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-[14.5px] font-bold tracking-[-0.01em] text-[#1b0d14]">
            {post.title}
          </h3>
          <Stars rating={post.rating} />
        </div>

        {/*
        장소 줄. 주소가 있으면 도로명 주소 + 카카오맵, 없으면 지역만.
        둘 다 없으면 줄 자체를 내지 않는다 — 온라인 주문처럼 장소가 없는 게
        정상인 카테고리가 있어서 "미확인" 을 크게 적을 이유가 없다.
      */}
        {(post.address || post.region) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-[#7a6c74]">
              <MapPin className="h-3 w-3 shrink-0 text-[#ee2b8c]" />
              <span className="truncate">{post.address || post.region}</span>
            </span>
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 border-b border-[#ee2b8c44] text-[12px] font-bold text-[#ee2b8c]"
              >
                카카오맵
              </a>
            )}
          </div>
        )}

        {post.body && (
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#7a6c74]">
            {post.body}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-gray-400">
            {describeAuthor(post)} · {describeWhen(post.createDate)}
            {post.isMine && (
              <span className="ml-1.5 rounded-full bg-[#fff2f6] px-2 py-0.5 text-[11px] font-bold text-[#ee2b8c]">
                내 후기
              </span>
            )}
          </span>

          <div className="flex shrink-0 items-center gap-2">
            {/*
            "도움이 돼요" 는 수를 함께 보여주고, "안 돼요" 는 수를 감춘다.
            정직하게 올린 후기에 "안 돼요 12" 가 공개로 박히면 다음 사람이
            안 올린다 — 공급이 이 기능의 생사다. 안 돼요는 정렬과 어뷰징
            감지에만 쓴다.
          */}
            <button
              type="button"
              onClick={() => onVote(post, "HELPFUL")}
              disabled={votePending}
              aria-pressed={post.myVote === "HELPFUL"}
              aria-label="도움이 돼요"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors disabled:opacity-60 ${
                post.myVote === "HELPFUL"
                  ? "border-[#ee2b8c33] bg-[#fff2f6] text-[#ee2b8c]"
                  : "border-[#efe7eb] bg-white text-[#7a6c74] hover:border-[#ee2b8c33] hover:text-[#ee2b8c]"
              }`}
            >
              <ThumbsUp
                className={`h-3.5 w-3.5 ${
                  post.myVote === "HELPFUL" ? "fill-current" : ""
                }`}
              />
              도움이 돼요
              {post.helpfulCount > 0 && (
                <span className="font-user-content">{post.helpfulCount}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onVote(post, "NOT_HELPFUL")}
              disabled={votePending}
              aria-pressed={post.myVote === "NOT_HELPFUL"}
              aria-label="도움이 안 돼요"
              title="도움이 안 돼요"
              className={`inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
                post.myVote === "NOT_HELPFUL"
                  ? "border-[#d6ccd2] bg-[#f4eff2] text-[#4a3f45]"
                  : "border-[#efe7eb] bg-white text-[#c8bfc4] hover:text-[#7a6c74]"
              }`}
            >
              <ThumbsDown
                className={`h-3.5 w-3.5 ${
                  post.myVote === "NOT_HELPFUL" ? "fill-current" : ""
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => onAddToPlan(post)}
              className="inline-flex items-center gap-1 rounded-full border border-[#ee2b8c33] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#ee2b8c] transition-colors hover:bg-[#fff2f6] active:bg-[#ffe2ee]"
            >
              <Plus className="h-3.5 w-3.5" />내 플랜에 담기
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default FeedCard;
