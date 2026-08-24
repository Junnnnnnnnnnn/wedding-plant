/**
 * 서비스 지표 이벤트.
 *
 * GA 가 붙어 있어도 페이지뷰만으로는 아무것도 알 수 없다 — "온보딩에서 몇 명이
 * 빠져나갔나", "배우자를 부른 커플이 몇 %인가", "실제로 계약이 얼마나 일어나나"
 * 는 전부 아래 여섯 개로 센다.
 *
 * 여섯 개로 묶어 둔 이유가 있다. 이벤트를 늘리면 당장은 더 많이 아는 것 같지만,
 * 실제로는 어느 숫자를 봐야 하는지 모르게 된다. 새 이벤트를 넣기 전에 "이 숫자가
 * 나빴을 때 무엇을 바꿀 것인가" 에 답할 수 있어야 한다.
 *
 * **이름을 바꾸지 말 것.** GA 는 이벤트 이름으로 과거와 잇는다. 한 번 바꾸면
 * 그 지점에서 지표가 끊기고, 끊긴 구간은 되살릴 수 없다.
 */
export type PlanEvent =
  /** 카카오 로그인 성공. 게스트→회원 전환의 분모 */
  | "signup"
  /** 온보딩에서 결혼일·예산·이름을 다 채움. 첫 관문 */
  | "onboarding_complete"
  /** 일정 등록. 이 이벤트가 3번 찍힌 사용자가 곧 북극성(활성 커플) */
  | "schedule_add"
  /** 초대 링크를 실제로 복사·공유함. 커플 앱의 유입 배수 */
  | "invite_send"
  /** 일정을 완료로 바꿈 = 계약이 일어남. 견적 후기의 재고 */
  | "schedule_complete"
  /** 견적 후기 등록. 피드 공급량 */
  | "feed_post";

type EventParams = Record<string, string | number | boolean>;

type GtagWindow = Window & {
  gtag?: (command: string, event: string, params?: EventParams) => void;
};

/**
 * 이벤트 한 건 전송.
 *
 * GA 가 없는 환경(개발 서버, 광고 차단, 스크립트 로드 실패)에서는 조용히
 * 아무 일도 하지 않는다. 지표 수집이 실패해서 사용자의 저장이 막히는 일은
 * 절대 없어야 하므로 예외도 삼킨다.
 */
export function track(event: PlanEvent, params?: EventParams): void {
  if (typeof window === "undefined") return;

  const { gtag } = window as GtagWindow;
  if (typeof gtag !== "function") return;

  try {
    gtag("event", event, params ?? {});
  } catch {
    // 계측 실패는 사용자에게 보이지 않아야 한다
  }
}
