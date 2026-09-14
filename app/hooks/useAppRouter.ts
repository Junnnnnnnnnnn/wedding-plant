"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { beginNavigation } from "@/lib/navPending";

/**
 * `useRouter` 와 똑같이 쓰되, `push` 가 **누른 순간 목적지 뼈대를 띄운다**
 * (`lib/navPending`).
 *
 * 앱 안에서 다른 화면으로 넘어가는 `push` 는 이걸 쓴다. `replace` 는 그대로
 * 둔다 — 로그인·온보딩 문으로 돌려보내는 리다이렉트라 사용자가 누른 동작이
 * 아니고, 거기서 앱 셸 뼈대가 뜨면 오히려 엉뚱한 화면이 번쩍인다.
 */
export function useAppRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      back: () => router.back(),
      forward: () => router.forward(),
      refresh: () => router.refresh(),
      prefetch: router.prefetch,
      replace: router.replace,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => {
        beginNavigation(href);
        router.push(href, options);
      },
    }),
    [router],
  );
}
