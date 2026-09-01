/** sessionStorage key for backend JWT */
export const AUTH_TOKEN_KEY = "plan_auth_token";
export const AUTH_TOKEN_CHANGED_EVENT = "plan-auth-token-changed";

/**
 * 백엔드가 갱신된 세션 토큰을 실어 보내는 응답 헤더.
 *
 * 토큰 수명(180일)의 절반이 지나면 백엔드가 요청을 처리하면서 새 토큰을 이
 * 헤더에 담아 준다. 받아서 저장해야 **쓰는 동안 세션이 계속 밀린다** — 안
 * 받으면 매일 들어오는 사람도 로그인한 지 180일째에 한 번 튕긴다.
 *
 * 백엔드가 `exposedHeaders` 로 노출해 둔 헤더다(CORS). 거기서 빠지면
 * 브라우저가 헤더 자체를 숨겨 갱신이 조용히 죽는다.
 */
export const RENEWED_TOKEN_HEADER = "x-renewed-token";

/** OAuth 로그인 전 공유 링크 shareCode 저장용 (로그인 후 /main?share=xxx로 복원) */
export const SHARE_AFTER_LOGIN_KEY = "plan_share_after_login";

/** 비로그인 시 setting 완료 후 /main 진입 시 설정. 직접 /main 접속 시 리다이렉트 판단용 */
export const HAS_COMPLETED_GUEST_SETTING_KEY =
  "plan_has_completed_guest_setting";

/** 비회원이 동의한 약관 데이터 (로그인 시 PATCH로 전송용). sessionStorage에 저장 */
export const GUEST_AGREEMENT_KEY = "plan_guest_agreement";

export interface GuestAgreementData {
  requiredAgreementDate: string;
  adAgreementDate?: string | null;
}

export function getGuestAgreement(): GuestAgreementData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GUEST_AGREEMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestAgreementData;
    return parsed?.requiredAgreementDate ? parsed : null;
  } catch {
    return null;
  }
}

export function setGuestAgreement(data: GuestAgreementData): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(GUEST_AGREEMENT_KEY, JSON.stringify(data));
}

export function clearGuestAgreement(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(GUEST_AGREEMENT_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  // sessionStorage는 탭(창) 단위라 공유 링크를 새 탭에서 열면 토큰이 없을 수 있음
  // localStorage도 함께 확인해 로그인 상태를 탭 간에 유지
  return (
    sessionStorage.getItem(AUTH_TOKEN_KEY) ??
    localStorage.getItem(AUTH_TOKEN_KEY)
  );
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

/** JWT payload 타입 */
interface JwtPayload {
  planUserId?: string;
  sub?: string;
}

/**
 * base64url 문자열을 UTF-8 문자열로 디코딩한다.
 *
 * atob 만 쓰면 두 가지가 깨진다.
 * - 패딩(=)이 없으면 길이에 따라 InvalidCharacterError
 * - atob 는 바이트를 그대로 주므로 한글 같은 non-ASCII 가 깨진다
 *   (예외가 안 나서 catch 에도 안 걸리고 값만 조용히 망가진다)
 */
function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function getJwtPayload(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    return JSON.parse(decodeBase64Url(payloadB64)) as JwtPayload;
  } catch {
    return null;
  }
}

/** JWT에서 planUserId 추출 */
export function getPlanUserIdFromToken(): string | null {
  return getJwtPayload()?.planUserId ?? null;
}

/** JWT에서 sub 추출 */
export function getSubFromToken(): string | null {
  return getJwtPayload()?.sub ?? null;
}

export function getShareAfterLogin(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SHARE_AFTER_LOGIN_KEY);
}

export function setShareAfterLogin(shareCode: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SHARE_AFTER_LOGIN_KEY, shareCode);
}

export function clearShareAfterLogin(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SHARE_AFTER_LOGIN_KEY);
}

/** 앱이 사용하는 모든 storage 키 (clearAllStoredData에서 참조) */
const APP_SESSION_KEYS = [
  AUTH_TOKEN_KEY,
  SHARE_AFTER_LOGIN_KEY,
  HAS_COMPLETED_GUEST_SETTING_KEY,
  GUEST_AGREEMENT_KEY,
  "plan_return_path_after_login",
  "weddingData",
  "weddingDate", // legacy
  "guest_schedule_list_v1",
  "hasSeenMainGuide",
  "hasSeenBudgetGuide",
  "returnToPlanList",
] as const;

const APP_LOCAL_KEYS = [
  AUTH_TOKEN_KEY,
  "hasSeenMainGuide",
  "hasSeenBudgetGuide",
  "hasSeenChatGuide",
] as const;

/** 앱이 사용하는 세션/로컬 스토리지 값만 선별 삭제 (타 라이브러리/애널리틱스 키는 보존) */
export function clearAllStoredData(): void {
  if (typeof window === "undefined") return;
  APP_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
  APP_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

/** Client-side API base URL (NEXT_PUBLIC_API_BASE_URL). */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return url.replace(/\/$/, "");
}

/** 로그인 후 복귀할 경로 저장용 */
export const RETURN_PATH_AFTER_LOGIN_KEY = "plan_return_path_after_login";

export function getReturnPathAfterLogin(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(RETURN_PATH_AFTER_LOGIN_KEY);
}

export function setReturnPathAfterLogin(path: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RETURN_PATH_AFTER_LOGIN_KEY, path);
}

export function clearReturnPathAfterLogin(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RETURN_PATH_AFTER_LOGIN_KEY);
}

/**
 * API 응답에서 유저 정보를 받아
 * name, budget, weddingDate 가 모두 누락 없이 채워져 있는지 확인합니다.
 */
export function isPlanDataComplete(data: {
  weddingDate?: string | null;
  budget?: number | string | null;
  name?: string | null;
}): boolean {
  if (!data) return false;
  const hasWeddingDate =
    typeof data.weddingDate === "string" && data.weddingDate.trim() !== "";
  const hasName = typeof data.name === "string" && data.name.trim() !== "";
  const hasBudget =
    data.budget != null &&
    (typeof data.budget === "number" ||
      (typeof data.budget === "string" &&
        data.budget.toString().trim() !== ""));
  return Boolean(hasWeddingDate && hasName && hasBudget);
}
