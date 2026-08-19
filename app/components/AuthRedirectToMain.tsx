"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApi } from "@/app/contexts/ApiContext";
import { getToken, isPlanDataComplete } from "@/lib/api";

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
    // 카카오 콜백 착지 직후에는 이전 계정의 토큰이 아직 남아 있을 수 있다.
    // 그 토큰으로 /plan/user 를 부르면 남의 플랜이 완성돼 있다는 이유로
    // /main 으로 튕겨, 새 토큰 교환이 끝나기 전까지 다른 계정 데이터가
    // 잠깐 보였다. 이 구간의 라우팅은 KakaoLoginAlert 가 끝까지 책임진다.
    if (new URLSearchParams(window.location.search).has("kakao_login")) return;

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
      });

    return () => {
      controller.abort();
      checkedRef.current = false;
    };
  }, [pathname, router, fetchWithAuth]);

  return null;
}
