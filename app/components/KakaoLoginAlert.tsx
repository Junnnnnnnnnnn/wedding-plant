"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/app/contexts/ApiContext";
import { clearToken, setToken } from "@/lib/api";

type KakaoLoginAlertProps = {
  show: boolean;
};

function getKakaoTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return params.get("kakao_token");
}

export default function KakaoLoginAlert({ show }: KakaoLoginAlertProps) {
  const router = useRouter();
  const { fetchBackend } = useApi();
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
          if (!window.location.pathname.startsWith("/setting")) {
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
  }, [show, fetchBackend, router]);

  return null;
}
