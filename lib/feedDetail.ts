import type { FeedPost } from "@/types";

/**
 * 목록에서 누른 후기를 상세로 넘긴다.
 *
 * **백엔드에 단건 조회가 없다.** `/plan/feed/list` · `my` · `postable` ·
 * 투표뿐이라, 상세가 자기 힘으로 후기 하나를 받아올 방법이 없다. 그래서
 * 목록이 **이미 받아 둔 항목을 그대로 넘긴다** — 카드를 누르는 흐름에서는
 * 요청이 0 개다.
 *
 * 직접 주소를 열거나 새로고침하면 이 값이 없다. 그때는 상세가 목록을 한 번
 * 불러 같은 id 를 찾는다(`FeedDetailView`). 목록 첫 장에 없으면 "목록에서
 * 다시 열어 주세요" 로 끝낸다 — 페이지를 끝까지 뒤지지 않는다.
 *
 * `sessionStorage` 인 이유는 게스트 데이터·복귀 경로와 같다. 탭을 닫으면
 * 지워지는 게 맞고, 남아 있어도 id 가 맞을 때만 쓴다.
 */
const KEY = "plan_feed_detail";

export function putFeedDetail(post: FeedPost): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(post));
  } catch {
    // 사파리 비공개 모드 등. 못 넘기면 상세가 목록에서 찾는다
  }
}

/** 넘겨 둔 후기. id 가 다르면 남의 것이므로 쓰지 않는다 */
export function takeFeedDetail(id: number): FeedPost | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const post = JSON.parse(raw) as FeedPost;
    return post?.id === id ? post : null;
  } catch {
    return null;
  }
}
