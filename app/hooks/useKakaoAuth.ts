"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useApi } from "../contexts/ApiContext";
import { getToken } from "@/lib/api";

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
  const { fetchWithAuth } = useApi();
  const [loading, setLoading] = useState(false);

  const handleKakaoAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      const fromMain = pathname === "/main";
      window.location.href = fromMain
        ? "/api/auth/kakao?from=main"
        : "/api/auth/kakao";
      return;
    }
    setLoading(true);
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
  }, [fetchWithAuth, router, pathname]);

  return { handleKakaoAuth, loading };
}
