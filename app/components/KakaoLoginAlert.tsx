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

          // GET /plan/user로 플랜 데이터 확인 - weddingDate, budget, name이 있으면 /main에 머물며 사용자·플랜·스케줄 데이터 로드
          try {
            const userRes = await fetchWithAuth("/plan/user");
            const userJson = (await userRes.json()) as {
              result?: boolean;
              data?: {
                weddingDate?: string | null;
                budget?: number | string | null;
                name?: string | null;
              };
            };
            if (
              userJson.result === true &&
              userJson.data &&
              isPlanDataComplete(userJson.data)
            ) {
              // /main에서 로그인 성공 시 메인 페이지에 사용자·플랜·스케줄 등 데이터 갱신 요청
              if (pathname === "/main") {
                await onSuccessFromMain?.();
              }
              router.replace("/main");
              return;
            }
          } catch {
            // GET 실패 시 기존 로직으로 fallback
          }

          const isFromMain = pathname === "/main";
          if (isFromMain) {
            // /main에서 로그인한 경우: 세션의 웨딩 데이터가 있으면 백엔드에 POST 후 /main 유지, 없으면 /setting으로
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
              await onSuccessFromMain?.();
              router.replace("/main");
            } else {
              // 홈 등에서 로그인 후 /main으로 왔지만 저장된 플랜 없음 → 설정 페이지로
              router.push("/setting");
            }
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
