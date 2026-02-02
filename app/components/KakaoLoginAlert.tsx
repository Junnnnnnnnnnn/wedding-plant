"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApi } from "@/app/contexts/ApiContext";
import { useWedding } from "@/app/contexts/WeddingContext";
import { clearToken, setToken } from "@/lib/api";

type KakaoLoginAlertProps = {
  show: boolean;
  /** /main에서 로그인 성공 후 GET /plan/user로 데이터를 불러올 때 호출 */
  onSuccessFromMain?: () => void | Promise<void>;
};

function getKakaoTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return params.get("kakao_token");
}

export default function KakaoLoginAlert({
  show,
  onSuccessFromMain,
}: KakaoLoginAlertProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { fetchBackend, fetchWithAuth } = useApi();
  const { weddingData } = useWedding();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!show || shownRef.current) return;

    const kakaoToken = getKakaoTokenFromHash();
    if (!kakaoToken) {
      shownRef.current = true;
      clearToken();
      router.replace("/?login_error=1");
      return;
    }

    shownRef.current = true;
    const run = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetchBackend("/plan/auth/kakao/login", {
          method: "POST",
          body: JSON.stringify({ kakaoToken }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = (await res.json()) as {
          data?: { token?: string };
          result?: boolean;
          error?: string;
        };

        if (!res.ok) {
          clearTimeout(timeoutId);
          clearToken();
          router.replace("/?login_error=1");
          return;
        }

        const token = data?.data?.token;
        if (token) {
          clearTimeout(timeoutId);
          setToken(token);
          const url = new URL(window.location.href);
          url.searchParams.delete("kakao_login");
          url.hash = "";
          window.history.replaceState({}, "", url.pathname + url.search);

          const isFromMain = pathname === "/main";
          if (isFromMain) {
            // /main에서 로그인한 경우: 세션의 웨딩 데이터를 백엔드에 POST 후 GET /plan/user로 데이터 로드, /main 유지
            if (weddingData.date) {
              const { year, month, day } = weddingData.date;
              const weddingDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              try {
                await fetchWithAuth("/plan/setting", {
                  method: "POST",
                  body: JSON.stringify({
                    weddingDate,
                    budget: Number(weddingData.budget) || 0,
                    name: weddingData.name.trim() || "",
                  }),
                });
              } catch {
                // POST 실패해도 /main으로 이동
              }
            }
            await onSuccessFromMain?.();
            router.replace("/main");
          } else if (!pathname.startsWith("/setting")) {
            router.push("/setting");
          }
        } else {
          clearTimeout(timeoutId);
          clearToken();
          router.replace("/?login_error=1");
        }
      } catch {
        clearTimeout(timeoutId);
        clearToken();
        router.replace("/?login_error=1");
      }
    };

    run();
  }, [
    show,
    fetchBackend,
    fetchWithAuth,
    router,
    pathname,
    weddingData,
    onSuccessFromMain,
  ]);

  return null;
}
