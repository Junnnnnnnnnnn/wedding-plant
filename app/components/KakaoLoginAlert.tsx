"use client";

import { useEffect, useRef } from "react";

type KakaoLoginAlertProps = {
  show: boolean;
};

export default function KakaoLoginAlert({ show }: KakaoLoginAlertProps) {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!show || shownRef.current) return;

    const run = async () => {
      shownRef.current = true;
      try {
        const res = await fetch("/api/auth/kakao/me");
        const data = await res.json();

        if (!res.ok) {
          alert(`조회 실패\n${data.error ?? JSON.stringify(data)}`);
          return;
        }

        const text =
          typeof data === "object"
            ? JSON.stringify(data, null, 2)
            : String(data);
        alert(`카카오 사용자 정보\n\n${text}`);
      } catch (e) {
        alert(`조회 중 오류\n${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("kakao_login");
          window.history.replaceState({}, "", url.pathname + url.search);
        }
      }
    };

    run();
  }, [show]);

  return null;
}
