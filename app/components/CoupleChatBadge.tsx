"use client";

/**
 * 신랑·신부 방 표식.
 *
 * 대화 목록이 여러 화면에 흩어져 있어(홈 대시보드·참여 플랜 카드·채팅방
 * 머리글) 표시 규칙을 여기 한 곳에 둔다. `PlanTaskCardBody` 와 같은 이유다.
 *
 * 커플 방인지는 백엔드가 `isCouple` 로 알려 준다 — 방장과 배우자 둘만 있는
 * 채팅방이다.
 */
export default function CoupleChatBadge({
  size = "md",
}: {
  /** `sm` 은 좁은 목록 줄, `md` 는 머리글 */
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  /*
    시안(C안 03)의 `.ch__b` 다 — 하트를 뺐다. 10.5px 짜리 글자 옆의 하트는
    형태가 뭉개져 얼룩으로만 보였고, 방 이름 옆에서 눈만 끌었다.
  */
  return (
    <span
      className={`inline-flex shrink-0 items-center font-bold text-[#cc1873] ${
        sm
          ? "rounded-[4px] bg-[#fff1f7] px-[5px] py-px text-[10px]"
          : "rounded-full bg-[#fff1f7] px-2.5 py-1 text-[11.5px]"
      }`}
    >
      {sm ? "신랑·신부" : "신랑 · 신부"}
    </span>
  );
}

/**
 * 커플 방을 맨 위로. 나머지 순서는 건드리지 않는다.
 *
 * 정렬을 부르는 쪽마다 따로 쓰면 화면마다 순서가 어긋난다.
 */
export function sortCoupleFirst<T extends { isCouple?: boolean }>(
  rooms: T[],
): T[] {
  return [...rooms].sort(
    (a, b) => Number(b.isCouple ?? false) - Number(a.isCouple ?? false),
  );
}
