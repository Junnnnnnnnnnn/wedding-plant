"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useApi } from "../contexts/ApiContext";
import {
  getToken,
  setShareAfterLogin,
  setReturnPathAfterLogin,
  clearReturnPathAfterLogin,
  isPlanDataComplete,
} from "@/lib/api";

/** 카카오 로그인/플랜 확인 후 /main 또는 /api/auth/kakao로 이동 */
export function useKakaoAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { fetchWithAuth, setLoading, loading } = useApi();

  const handleKakaoAuth = useCallback(async () => {
    setLoading(true);

    // OAuth로 외부 이동할 때는 setLoading(false)를 호출하지 않음.
    // 브라우저 unload 전까지 로딩이 유지되어야 사용자가 빈 화면에 머물지 않음.
    let willRedirect = false;
    const redirectToOAuth = (url: string) => {
      willRedirect = true;
      let navigated = false;
      const go = () => {
        if (navigated) return;
        navigated = true;
        window.location.href = url;
      };
      // 첫 페인트가 끝난 뒤 이동시켜 로딩 오버레이가 반드시 한 프레임 보이도록 함
      requestAnimationFrame(() => {
        requestAnimationFrame(go);
      });
      // 문서가 hidden이면(창이 가려지거나 최소화, 백그라운드 탭)
      // requestAnimationFrame이 멈춰 이동이 영영 일어나지 않는다.
      // 그러면 버튼이 "확인 중..."에 멈추고 로딩 오버레이가 남으므로
      // 타이머로 보완한다. 먼저 실행된 쪽만 이동한다.
      setTimeout(go, 150);
    };

    /**
     * OAuth 로 나가기 전, 로그인 후 복귀에 필요한 값을 저장한다.
     *
     * 예전에는 이 처리가 `!token` 분기 안에만 있어서, 만료된 토큰이
     * 남아 있으면 ?share= 링크가 통째로 무시됐다(토큰 존재 여부만 보고
     * 유효성은 안 봤기 때문). 어느 경로로 나가든 항상 저장한다.
     */
    const rememberReturnTarget = () => {
      const share =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("share")
          : null;
      if (share?.trim()) setShareAfterLogin(share.trim());

      if (pathname === "/" || pathname === "/main") {
        // 랜딩·메인에서 시작했다면 이전에 남은 복귀 경로를 지운다.
        // 취소된 로그인이 남긴 stale 값이 다음 로그인의 분기를 가로챘다.
        clearReturnPathAfterLogin();
      } else {
        // 현재 경로를 복귀 지점으로 남긴다.
        //
        // `/login` 처럼 로그인하러 들어오는 문은 `setReturnPathAfterLogin` 이
        // 조용히 무시한다 — 저장했다가는 로그인을 마치고 다시 로그인 화면으로
        // 돌아오고, 세션 만료로 밀려오기 전에 보던 진짜 복귀 경로까지 덮어쓴다.
        setReturnPathAfterLogin(pathname);
      }
    };

    /** /main → from=main, / → from=home (콜백의 착지 지점 결정) */
    const oauthUrl = () => {
      if (pathname === "/main") return "/api/auth/kakao?from=main";
      if (pathname === "/") return "/api/auth/kakao?from=home";
      return "/api/auth/kakao";
    };

    const token = getToken();
    if (!token) {
      rememberReturnTarget();
      redirectToOAuth(oauthUrl());
      return;
    }
    try {
      const res = await fetchWithAuth("/plan/user", { skipLoading: true });
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
        rememberReturnTarget();
        redirectToOAuth(oauthUrl());
      }
    } catch {
      rememberReturnTarget();
      redirectToOAuth(oauthUrl());
    } finally {
      if (!willRedirect) setLoading(false);
    }
  }, [fetchWithAuth, setLoading, router, pathname]);

  return { handleKakaoAuth, loading };
}
