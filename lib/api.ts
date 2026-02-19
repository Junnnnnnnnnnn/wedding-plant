/** sessionStorage key for backend JWT */
export const AUTH_TOKEN_KEY = "plan_auth_token";
export const AUTH_TOKEN_CHANGED_EVENT = "plan-auth-token-changed";

/** OAuth 로그인 전 공유 링크 shareCode 저장용 (로그인 후 /main?share=xxx로 복원) */
export const SHARE_AFTER_LOGIN_KEY = "plan_share_after_login";

/** 비로그인 시 setting 완료 후 /main 진입 시 설정. 직접 /main 접속 시 리다이렉트 판단용 */
export const HAS_COMPLETED_GUEST_SETTING_KEY = "plan_has_completed_guest_setting";

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

function getJwtPayload(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    return JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as JwtPayload;
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

/** 세션/로컬 스토리지, 인증 등 모든 저장값 삭제 */
export function clearAllStoredData(): void {
  if (typeof window === "undefined") return;
  sessionStorage.clear();
  localStorage.clear();
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
