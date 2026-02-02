/** sessionStorage key for backend JWT */
export const AUTH_TOKEN_KEY = "plan_auth_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

/** 세션/로컬 스토리지, 인증 등 모든 저장값 삭제 */
export function clearAllStoredData(): void {
  if (typeof window === "undefined") return;
  sessionStorage.clear();
  localStorage.clear();
}

/** Client-side API base URL (NEXT_PUBLIC_API_BASE_URL). */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return url.replace(/\/$/, "");
}
