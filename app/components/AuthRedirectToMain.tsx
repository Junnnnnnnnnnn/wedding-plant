"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApi } from "@/app/contexts/ApiContext";
import { clearToken, getToken, isPlanDataComplete } from "@/lib/api";

/** JWT + 플랜 정보가 있으면 /main으로 보낼 진입 경로 (상세·추가 등은 제외).
    `/login` 도 문이라 여기 든다 — 이미 로그인된 사람이 주소로 들어오면 통과시킨다. */
const ENTRY_PATHS = ["/", "/setting", "/login"];

/**
 * 랜딩(/) 또는 /setting 에 들어왔을 때 토큰을 보고 갈 곳을 정한다.
 *
 * - 토큰이 살아 있고 플랜이 다 찼으면  → `/main`
 * - 토큰이 만료됐으면(401)             → `/login?expired=1`
 * - 토큰이 아예 없으면                 → 그대로 (랜딩을 본다)
 *
 * **만료된 사람에게 랜딩을 보여 주지 않는다.** 랜딩은 "이 앱이 뭔지" 를 설명하는
 * 화면이라 이미 아는 사람에게 다시 낼 이유가 없다. 예전에는 랜딩 위에
 * "세션이 만료되었습니다" 모달만 떠서, 처음 온 사람에게도 뜨는 것처럼 보였고
 * 닫으면 갈 곳이 없었다.
 *
 * 그래서 이 요청만 `skipAuthHandling: true` 로 401 을 직접 받는다 — 공통 처리에
 * 맡기면 전역 `SessionExpiredModal` 이 랜딩 위에 뜬다.
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
    fetchWithAuth("/plan/user", {
      signal: controller.signal,
      skipAuthHandling: true,
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          clearToken();
          router.replace("/login?expired=1");
          return;
        }
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
