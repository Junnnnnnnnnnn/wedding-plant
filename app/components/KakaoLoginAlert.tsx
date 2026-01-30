"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/app/contexts/ApiContext";
import { setToken } from "@/lib/api";

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
      alert("카카오 토큰이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    shownRef.current = true;
    const run = async () => {
      try {
        const res = await fetchBackend("/plan/auth/kakao/login", {
          method: "POST",
          body: JSON.stringify({ kakaoToken }),
        });
        const data = (await res.json()) as {
          data?: { token?: string };
          result?: boolean;
          error?: string;
        };

        if (!res.ok) {
          alert(
            (data && typeof data === "object" && "error" in data
              ? data.error
              : "로그인 처리에 실패했습니다.") as string,
          );
          return;
        }

        const token = data?.data?.token;
        if (token) {
          setToken(token);
          const url = new URL(window.location.href);
          url.searchParams.delete("kakao_login");
          url.hash = "";
          window.history.replaceState({}, "", url.pathname + url.search);
          if (!window.location.pathname.startsWith("/setting")) {
            router.push("/setting");
          }
        } else {
          alert("토큰을 받지 못했습니다.");
        }
      } catch (e) {
        alert(
          `로그인 처리 중 오류\n${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };

    run();
  }, [show, fetchBackend, router]);

  return null;
}
