"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * matchMedia 결과를 구독한다.
 *
 * useSyncExternalStore 를 쓰는 이유: 서버 렌더에서는 항상 false 를 주고,
 * 하이드레이션 직후 실제 값으로 한 번 다시 렌더된다. useState + useEffect
 * 조합처럼 첫 페인트에 잘못된 분기가 잠깐 보이는 일이 없다.
 *
 * 화면 폭으로 레이아웃을 바꾸는 것은 CSS(Tailwind md:/lg:)가 맡는다.
 * 이 훅은 "클릭했을 때 라우트를 밀지, 옆 pane 을 열지" 처럼 CSS 로
 * 표현할 수 없는 동작 분기에만 쓴다.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Tailwind md 브레이크포인트. 이 위로는 하단 탭바 대신 좌측 레일이 뜬다 */
export function useIsTabletUp(): boolean {
  return useMediaQuery("(min-width: 768px)");
}

/** Tailwind lg 브레이크포인트. 이 위로는 마스터-디테일 2열이 된다 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
