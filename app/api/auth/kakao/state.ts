/**
 * 카카오 OAuth의 state 파라미터를 CSRF 논스로 사용하기 위한 헬퍼.
 *
 * state는 원래 로그인 후 어디로 돌아갈지("main" / "home") 알려주는
 * 라우팅 힌트로만 쓰였다. 검증 없이 그대로 소비되었기 때문에, 공격자가
 * 자기 카카오 code가 담긴 콜백 URL을 피해자에게 클릭시키면 피해자
 * 브라우저가 공격자 계정으로 로그인되는 로그인 CSRF가 가능했다.
 *
 * 이제 `<논스>:<라우팅 힌트>` 형태로 만들고, 논스는 httpOnly 쿠키에
 * 저장해 콜백에서 대조한다.
 */

export const OAUTH_STATE_COOKIE = "kakao_oauth_state";

/** 콜백 → 클라이언트로 카카오 access_token 을 넘길 때 쓰는 1회용 쿠키 */
export const KAKAO_TOKEN_COOKIE = "kakao_access_token";

/** 회수 전용이라 짧게 (60초) */
export const KAKAO_TOKEN_MAX_AGE = 60;

/** 인증 왕복에 넉넉한 10분 */
export const OAUTH_STATE_MAX_AGE = 60 * 10;

const SEPARATOR = ":";

/** 예측 불가능한 논스 생성 */
export function createStateNonce(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

/** 논스와 라우팅 힌트를 하나의 state 값으로 합친다 */
export function buildState(nonce: string, from: string): string {
  return `${nonce}${SEPARATOR}${from}`;
}

/** state에서 논스와 라우팅 힌트를 분리한다 */
export function parseState(state: string | null): {
  nonce: string;
  from: string;
} {
  if (!state) return { nonce: "", from: "" };
  const index = state.indexOf(SEPARATOR);
  if (index === -1) return { nonce: state, from: "" };
  return {
    nonce: state.slice(0, index),
    from: state.slice(index + 1),
  };
}

/**
 * 논스 비교. 길이가 같을 때 전체를 순회해 타이밍 차이를 줄인다.
 * (빈 값은 항상 실패)
 */
export function isValidNonce(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
