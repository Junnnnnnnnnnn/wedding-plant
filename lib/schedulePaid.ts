/**
 * 일정의 **결제 여부**.
 *
 * ── 축이 둘이다 ─────────────────────────────────────────────
 * `status` 는 **일정이 끝났는가**, `isPaid` 는 **돈이 나갔는가**다. 예전에는
 * 축이 하나뿐이라 계약금을 미리 낸 돈이 "아직 안 쓴 예정" 으로 잡혔다 —
 * 통장에서는 이미 빠져나갔는데 예산에 안 보였다. 반대로 끝났는데 아직
 * 정산 안 한 것은 쓴 돈이 아니다.
 *
 *   예정 + 미결제   아직 아무것도
 *   예정 + 결제     미리 낸 계약금
 *   완료 + 결제     끝났고 냈다 (예전의 "완료")
 *   완료 + 미결제   끝났는데 아직 정산 안 함
 *
 * ── `null`/`undefined` 는 `false` 가 아니다 ──────────────────
 * 이 값이 생기기 전에 만들어진 일정은 값이 없는데, 그때는 **완료가 곧
 * 결제**였다. 그래서 없으면 `status === "COMPLETED"` 로 읽는다. 둘을 같게
 * 다루면 쌓여 있는 완료 일정이 통째로 미결제가 되어 지출이 0 이 된다.
 * 백엔드의 `isSchedulePaid()` 와 **같은 규칙**이다 — 한쪽만 고치지 말 것.
 */
export function isPaid(item: {
  isPaid?: boolean | null;
  status?: string | null;
}): boolean {
  if (item.isPaid !== null && item.isPaid !== undefined) return item.isPaid;
  return item.status === "COMPLETED";
}

/**
 * 결제와 일정이 어긋난 경우인가. 화면에 표시를 붙일지 정할 때 쓴다.
 *
 * 둘이 같으면(예정+미결제 / 완료+결제) 예전과 같은 모습이라 아무 표시도
 * 붙이지 않는다 — 대부분의 일정이 여기다. **어긋날 때만** 말해 준다.
 */
export function paymentMismatch(item: {
  isPaid?: boolean | null;
  status?: string | null;
}): "PAID_AHEAD" | "UNPAID_DONE" | null {
  const done = item.status === "COMPLETED";
  const paid = isPaid(item);
  if (!done && paid) return "PAID_AHEAD";
  if (done && !paid) return "UNPAID_DONE";
  return null;
}

/** 어긋난 경우에 붙이는 짧은 말 */
export const PAYMENT_MISMATCH_LABEL: Record<
  NonNullable<ReturnType<typeof paymentMismatch>>,
  string
> = {
  PAID_AHEAD: "결제함",
  UNPAID_DONE: "미결제",
};
