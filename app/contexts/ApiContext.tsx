"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearToken,
  getApiBaseUrl,
  getToken,
  setReturnPathAfterLogin,
} from "@/lib/api";

interface ApiRequestOptions extends RequestInit {
  skipLoading?: boolean;
  /**
   * 401을 공통 처리(토큰 정리 + 재로그인 안내)하지 않는다.
   * 호출부가 401을 직접 다뤄야 하는 경우에만 사용한다.
   */
  skipAuthHandling?: boolean;
}

interface ApiContextType {
  loading: boolean;
  /** 인증이 만료돼 재로그인이 필요한 상태 (fetchWithAuth가 401을 받으면 켜짐) */
  sessionExpired: boolean;
  /** 세션 만료 안내를 닫는다 */
  dismissSessionExpired: () => void;
  /** 수동 로딩 제어 (예: OAuth 리다이렉트 전 즉시 로딩 표시) */
  setLoading: (value: boolean) => void;
  /** Same-origin 요청 (로딩 표시). 예: /api/... */
  request: (url: string, options?: ApiRequestOptions) => Promise<Response>;
  /** 백엔드 API 요청 (Bearer 없음, 로딩 표시). 예: 로그인 POST /plan/auth/kakao/login */
  fetchBackend: (
    path: string,
    options?: ApiRequestOptions,
  ) => Promise<Response>;
  /** 백엔드 API 요청. Authorization: Bearer 토큰 + 로딩 표시 */
  fetchWithAuth: (
    path: string,
    options?: ApiRequestOptions,
  ) => Promise<Response>;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const [loadingCount, setLoadingCount] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);

  const setLoading = useCallback((value: boolean) => {
    setLoadingCount((prev) => (value ? prev + 1 : Math.max(0, prev - 1)));
  }, []);

  const loading = loadingCount > 0;

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  /**
   * 인증이 끊긴 응답(401)을 한 곳에서 처리한다.
   *
   * 예전에는 화면마다 401을 따로 처리했고, 처리하지 않는 화면에서는
   * 만료된 토큰으로 요청이 조용히 실패해 "데이터가 없습니다" 같은
   * 엉뚱한 화면만 보였다.
   *
   * 토큰이 있었는데 401이 온 경우에만 만료로 간주한다.
   * (비로그인 게스트의 401은 정상이므로 건드리지 않는다)
   */
  const handleUnauthorized = useCallback((hadToken: boolean) => {
    if (!hadToken) return;
    clearToken();
    if (typeof window !== "undefined") {
      const { pathname, search } = window.location;
      // 로그인 후 돌아올 곳을 남긴다 (랜딩/메인은 기본 경로라 제외)
      if (pathname !== "/" && pathname !== "/main") {
        setReturnPathAfterLogin(`${pathname}${search}`);
      }
    }
    setSessionExpired(true);
  }, []);

  // OAuth로 외부 이동할 때는 로딩을 켠 채로 두는데(빈 화면 방지),
  // 뒤로가기로 bfcache 복원되면 카운터가 1인 상태 그대로 살아나
  // 전체 화면 오버레이가 영영 사라지지 않는다. 복원 시 카운터를 비운다.
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoadingCount(0);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const request = useCallback(
    async (url: string, options?: ApiRequestOptions) => {
      const skipLoading = options?.skipLoading === true;
      if (!skipLoading) setLoading(true);
      try {
        const res = await fetch(url, {
          ...options,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...options?.headers,
          },
        });
        return res;
      } finally {
        if (!skipLoading) setLoading(false);
      }
    },
    [setLoading],
  );

  const buildBackendUrl = useCallback((path: string) => {
    const baseUrl = getApiBaseUrl();
    return path.startsWith("http")
      ? path
      : `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  }, []);

  const fetchBackend = useCallback(
    async (path: string, options?: ApiRequestOptions) => {
      const url = buildBackendUrl(path);
      const skipLoading = options?.skipLoading === true;
      if (!skipLoading) setLoading(true);
      try {
        const headers: HeadersInit = {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options?.headers,
        };
        const res = await fetch(url, { ...options, headers });
        return res;
      } finally {
        if (!skipLoading) setLoading(false);
      }
    },
    [buildBackendUrl, setLoading],
  );

  const fetchWithAuth = useCallback(
    async (path: string, options?: ApiRequestOptions) => {
      const token = getToken();
      const url = buildBackendUrl(path);
      const skipLoading = options?.skipLoading === true;
      if (!skipLoading) setLoading(true);
      try {
        const headers: HeadersInit = {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options?.headers,
        };
        if (token) {
          (headers as Record<string, string>).Authorization = `Bearer ${token}`;
        }
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401 && options?.skipAuthHandling !== true) {
          handleUnauthorized(!!token);
        }
        return res;
      } finally {
        if (!skipLoading) setLoading(false);
      }
    },
    [buildBackendUrl, setLoading, handleUnauthorized],
  );

  const value = useMemo(
    () => ({
      loading,
      setLoading,
      sessionExpired,
      dismissSessionExpired,
      request,
      fetchBackend,
      fetchWithAuth,
    }),
    [
      loading,
      setLoading,
      sessionExpired,
      dismissSessionExpired,
      request,
      fetchBackend,
      fetchWithAuth,
    ],
  );

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error("useApi must be used within an ApiProvider");
  }
  return context;
}
