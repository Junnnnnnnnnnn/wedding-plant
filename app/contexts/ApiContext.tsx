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
  RENEWED_TOKEN_HEADER,
  setReturnPathAfterLogin,
  setToken,
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
  const [manualLoading, setManualLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  /** 진행 중인 요청 수. 요청 래퍼만 건드린다. */
  const beginRequest = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);
  const endRequest = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  /**
   * 수동 로딩은 요청 카운터와 분리된 별도 플래그다.
   *
   * 예전에는 setLoading 이 이름만 boolean 이고 실제로는 같은 카운터를
   * 증감했다. 그래서 budget-detail·main·user 처럼 짝 없이
   * setLoading(false) 만 부르는 화면이 무관한 진행 중 요청의 카운터를
   * 깎아, 아직 끝나지 않은 요청의 오버레이가 먼저 사라졌다.
   */
  const setLoading = useCallback((value: boolean) => {
    setManualLoading(value);
  }, []);

  const loading = loadingCount > 0 || manualLoading;

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
  /**
   * 백엔드가 갱신해 준 세션 토큰을 저장한다.
   *
   * 토큰 수명(180일)의 절반이 지나면 백엔드가 아무 플랜 API 응답에나 새
   * 토큰을 헤더로 얹어 준다. 여기서 받아 갈아 끼워야 **쓰는 동안 세션이 계속
   * 밀린다** — 안 그러면 매일 들어오는 사람도 로그인한 지 180일째에 한 번
   * 튕긴다.
   *
   * 갱신은 90일에 한 번뿐이라 이 분기는 거의 타지 않는다. 그래도 보낸 토큰과
   * 같은지 비교하는 이유는, 서버가 매 요청 갱신하는 상태가 되면 여기서
   * setToken 이 계속 불려 SSE 가 그때마다 다시 붙기 때문이다.
   */
  const storeRenewedToken = useCallback((res: Response, sentToken: string) => {
    const renewed = res.headers.get(RENEWED_TOKEN_HEADER)?.trim();
    if (!renewed || renewed === sentToken) return;
    setToken(renewed);
  }, []);

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
      if (e.persisted) {
        setLoadingCount(0);
        setManualLoading(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const request = useCallback(
    async (url: string, options?: ApiRequestOptions) => {
      const skipLoading = options?.skipLoading === true;
      if (!skipLoading) beginRequest();
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
        if (!skipLoading) endRequest();
      }
    },
    [beginRequest, endRequest],
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
      if (!skipLoading) beginRequest();
      try {
        const headers: HeadersInit = {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options?.headers,
        };
        const res = await fetch(url, { ...options, headers });
        return res;
      } finally {
        if (!skipLoading) endRequest();
      }
    },
    [buildBackendUrl, beginRequest, endRequest],
  );

  const fetchWithAuth = useCallback(
    async (path: string, options?: ApiRequestOptions) => {
      const token = getToken();
      const url = buildBackendUrl(path);
      const skipLoading = options?.skipLoading === true;
      if (!skipLoading) beginRequest();
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
        if (token) storeRenewedToken(res, token);
        return res;
      } finally {
        if (!skipLoading) endRequest();
      }
    },
    [
      buildBackendUrl,
      beginRequest,
      endRequest,
      handleUnauthorized,
      storeRenewedToken,
    ],
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
