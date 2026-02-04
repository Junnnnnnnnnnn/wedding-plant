"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApi } from "@/app/contexts/ApiContext";
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

/** JWT + 플랜 정보가 있으면 /main으로 보낼 진입 경로 (상세·추가 등은 제외) */
const ENTRY_PATHS = ["/", "/setting"];

/**
 * 랜딩(/) 또는 /setting 접속 시: 세션 스토리지에 JWT가 있고 GET /plan/user 에
 * weddingDate, budget, name이 모두 있으면 /main으로 이동.
 * (상세·플랜 추가 등 다른 페이지에서는 리다이렉트하지 않음)
 */
export default function AuthRedirectToMain() {
  const pathname = usePathname();
  const router = useRouter();
  const { fetchWithAuth } = useApi();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getToken();
    // JWT 없을 때(예: 로그인 없이 둘러보기 후 setting → main) /plan/user 요청 금지
    if (!token || !ENTRY_PATHS.includes(pathname)) return;
    // 동일 path 내 중복 요청 방지
    if (checkedRef.current) return;
    checkedRef.current = true;

    const controller = new AbortController();
    fetchWithAuth("/plan/user", { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          result?: boolean;
          data?: {
            weddingDate?: string | null;
            budget?: number | string | null;
            name?: string | null;
          };
        };
        if (
          json.result === true &&
          json.data &&
          isPlanDataComplete(json.data)
        ) {
          router.replace("/main");
        }
      })
      .catch(() => {
        // 네트워크/파싱 실패 시 무시 (다음 방문 시 다시 시도)
      })
      .finally(() => {
        checkedRef.current = false;
      });

    return () => {
      controller.abort();
      checkedRef.current = false;
    };
  }, [pathname, router, fetchWithAuth]);

  return null;
}
