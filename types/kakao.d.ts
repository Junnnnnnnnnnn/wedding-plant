/* Kakao JavaScript SDK (kakao.min.js) */
interface KakaoAuthAuthorizeOptions {
  redirectUri?: string;
  scope?: string;
  state?: string;
  throughTalk?: boolean;
  prompt?: string;
}

interface KakaoAuth {
  authorize(options: KakaoAuthAuthorizeOptions): void;
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  getStatusInfo(): Promise<{ status: string }>;
  loginForm: (options: unknown) => void;
}

interface KakaoStatic {
  init(key: string): void;
  isInitialized(): boolean;
  Auth: KakaoAuth;
}

declare global {
  interface Window {
    Kakao?: KakaoStatic;
  }
}

export {};
