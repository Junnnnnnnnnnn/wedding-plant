"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getApiBaseUrl, getToken } from "@/lib/api";

interface ApiRequestOptions extends RequestInit {
  skipLoading?: boolean;
}

interface ApiContextType {
  loading: boolean;
  /** 수동 로딩 제어 (예: OAuth 리다이렉트 전 즉시 로딩 표시) */
  setLoading: (value: boolean) => void;
  /** Same-origin 요청 (로딩 표시). 예: /api/... */
  request: (url: string, options?: ApiRequestOptions) => Promise<Response>;
  /** 백엔드 API 요청 (Bearer 없음, 로딩 표시). 예: 로그인 POST /plan/auth/kakao/login */
  fetchBackend: (path: string, options?: ApiRequestOptions) => Promise<Response>;
  /** 백엔드 API 요청. Authorization: Bearer 토큰 + 로딩 표시 */
  fetchWithAuth: (path: string, options?: ApiRequestOptions) => Promise<Response>;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const [loadingCount, setLoadingCount] = useState(0);

  const setLoading = useCallback((value: boolean) => {
    setLoadingCount((prev) => (value ? prev + 1 : Math.max(0, prev - 1)));
  }, []);

  const loading = loadingCount > 0;

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
        return res;
      } finally {
        if (!skipLoading) setLoading(false);
      }
    },
    [buildBackendUrl, setLoading],
  );

  const value = useMemo(
    () => ({ loading, setLoading, request, fetchBackend, fetchWithAuth }),
    [loading, setLoading, request, fetchBackend, fetchWithAuth],
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
