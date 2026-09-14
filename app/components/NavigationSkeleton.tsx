"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  beginNavigation,
  endNavigation,
  getPendingPath,
  subscribeNavigation,
} from "@/lib/navPending";
import RouteSkeletonScreen from "./RouteSkeleton";
import { RAIL_ROUTES } from "./tabs";

/**
 * 누른 순간 목적지의 뼈대를 이전 화면 위에 덮는다 (`lib/navPending`).
 *
 * 주소의 경로가 바뀌면 걷는다. App Router 는 새 화면(또는 그 라우트의
 * `loading.tsx`)을 그리는 순간에 경로를 바꾸므로, 걷히는 자리에 곧바로 같은
 * 모양의 뼈대나 실제 화면이 있다.
 *
 * **안 걷히는 경우를 막는다.** 이동이 실패하거나(오프라인) 누른 곳이 다른
 * 곳으로 돌려보내 경로가 끝내 안 바뀌면 뼈대만 남아 앱이 멈춘 것처럼 보인다.
 * 개발 서버에서 처음 여는 화면은 컴파일로 10초를 넘기기도 해서 넉넉히 둔다.
 */
const STUCK_MS = 20000;

export default function NavigationSkeleton() {
  const pathname = usePathname();
  const router = useRouter();
  const pending = useSyncExternalStore(
    subscribeNavigation,
    getPendingPath,
    () => null,
  );
  const lastPathname = useRef(pathname);

  // 경로가 바뀌면(도착했든 다른 곳으로 돌려보내졌든) 걷는다
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname;
      endNavigation();
    }
  }, [pathname]);

  useEffect(() => {
    if (!pending) return undefined;
    const t = window.setTimeout(endNavigation, STUCK_MS);
    // 뒤로가기로 빠져나가면 경로가 같을 수도 있다 — 그때도 걷는다
    window.addEventListener("popstate", endNavigation);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("popstate", endNavigation);
    };
  }, [pending]);

  /*
    `<Link>` 로 넘어가는 곳(홈의 일정 카드 등)도 똑같이 덮는다. 링크마다
    핸들러를 붙이면 새 링크를 만들 때마다 빠뜨리므로, 문서에서 한 번에
    잡는다. 새 탭·다운로드·수정키를 누른 클릭은 브라우저가 처리하므로
    건드리지 않는다.

    **링크 안의 버튼·입력에서 시작된 클릭은 이동이 아니다.** 홈 카드의 완료
    체크가 그렇다 — 버튼이 `stopPropagation` 으로 이동을 끊지만, Next 는
    React 를 `document` 에 붙여서 같은 `document` 에 단 이 리스너까지는 못
    막는다(체크만 눌러도 뼈대가 덮였다). `preventDefault` 로도 가를 수 없다 —
    `<Link>` 자신이 클라이언트 이동을 하려고 늘 막는다.
  */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      const control = target?.closest(
        "button, input, select, textarea, label, [role='button']",
      );
      if (control && a.contains(control)) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      beginNavigation(`${url.pathname}${url.search}`);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  /*
    메뉴가 가리키는 화면을 한가할 때 미리 받아 둔다. 프로덕션에서는 이걸로
    누른 뒤 기다리는 시간 자체가 거의 사라진다(개발 서버는 prefetch 를 하지
    않아 뼈대가 그 몫을 한다). 앱 첫 화면을 그리는 데 방해가 되지 않게
    브라우저가 한가해진 뒤에 한다.
  */
  useEffect(() => {
    const routes = [...new Set(Object.values(RAIL_ROUTES))];
    const run = () => routes.forEach((r) => router.prefetch(r));
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run);
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 1500);
    return () => window.clearTimeout(t);
  }, [router]);

  if (!pending || pending === pathname) return null;

  return (
    <div
      data-nav-pending={pending}
      // 모달(z-[9999] 대)보다는 아래, 화면 안의 떠 있는 것들보다는 위
      className="fixed inset-0 z-[500] overflow-hidden bg-white"
    >
      <RouteSkeletonScreen pathname={pending} />
    </div>
  );
}
