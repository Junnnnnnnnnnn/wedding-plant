"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useApi } from "../contexts/ApiContext";
import { getToken, setShareAfterLogin } from "@/lib/api";

function isPlanDataComplete(data: {
  weddingDate?: string | null;
  budget?: number | string | null;
  name?: string | null;
}): boolean {
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

/** 카카오 로그인/플랜 확인 후 /main 또는 /api/auth/kakao로 이동 */
export function useKakaoAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { fetchWithAuth, setLoading, loading } = useApi();

  const handleKakaoAuth = useCallback(async () => {
    setLoading(true);
    const token = getToken();
    if (!token) {
      // 공유 링크(share)가 있으면 로그인 후 복원을 위해 저장
      const share = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("share")
        : null;
      if (share?.trim()) setShareAfterLogin(share.trim());

      // /main 또는 / 에서 로그인 시 콜백에서 /main으로 보냄 → 플랜 데이터 있으면 /main 유지, 없으면 /setting으로
      const goToMainAfterLogin = pathname === "/main" || pathname === "/";
      const url = goToMainAfterLogin ? "/api/auth/kakao?from=main" : "/api/auth/kakao";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.location.href = url;
        });
      });
      return;
    }
    try {
      const res = await fetchWithAuth("/plan/user");
      const json = (await res.json()) as {
        result?: boolean;
        data?: {
          weddingDate?: string | null;
          budget?: number | string | null;
          name?: string | null;
        };
      };
      if (json.result === true && json.data && isPlanDataComplete(json.data)) {
        router.push("/main");
      } else {
        window.location.href = "/api/auth/kakao";
      }
    } catch {
      window.location.href = "/api/auth/kakao";
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, setLoading, router, pathname]);

  return { handleKakaoAuth, loading };
}
