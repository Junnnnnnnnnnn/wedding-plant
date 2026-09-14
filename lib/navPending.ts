/**
 * "지금 어느 화면으로 넘어가는 중인가" 를 한 곳에 둔다.
 *
 * App Router 는 `router.push` 를 해도 **다음 화면의 코드가 다 도착할 때까지
 * 이전 화면을 그대로 둔다.** 그 사이 아무 반응이 없어서, 메뉴를 누르면
 * 1~2초 멈췄다가 갑자기 넘어가는 앱이 고장 난 것처럼 보였다(개발 서버에서
 * 처음 여는 화면은 컴파일까지 기다려 10초도 넘었다).
 *
 * 그래서 누르는 순간 여기에 목적지를 적고, `NavigationSkeleton` 이 그 목적지의
 * 뼈대를 바로 덮는다. 주소가 실제로 바뀌면 지운다.
 *
 * 모듈 한 곳에 두는 이유: 탭바·레일·카드처럼 누르는 자리는 여러 컴포넌트에
 * 흩어져 있고, 덮는 쪽은 레이아웃에 하나뿐이다. 컨텍스트로 두면 레이아웃
 * 트리 바깥(모달 등)에서 부르는 곳까지 감싸야 한다.
 */

type Listener = () => void;

let pendingPath: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn());
}

/** `/feed?x=1#y` → `/feed` */
export function toPathname(href: string): string {
  const cut = href.search(/[?#]/);
  return cut === -1 ? href : href.slice(0, cut) || "/";
}

/**
 * 뼈대를 그릴 줄 아는 화면만 덮는다. 온보딩(`/setting`)·랜딩(`/`)·로그인은
 * 셸이 없는 전체 화면이라 앱 셸 모양의 뼈대를 씌우면 오히려 엉뚱하다.
 */
const SKELETON_PREFIXES = [
  "/main",
  "/calendar",
  "/plan-list",
  "/feed",
  "/brag",
  "/user",
  "/budget-detail",
  "/schedule-detail",
  "/add-plen",
  "/chat/",
];

export function hasRouteSkeleton(pathname: string): boolean {
  return SKELETON_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`),
  );
}

/**
 * 화면 전환을 시작한다. 같은 화면 안에서 쿼리만 바뀌는 이동
 * (`/plan-list?chat=3`)은 덮지 않는다 — 주소의 경로가 안 바뀌어 지울
 * 계기가 없고, 화면도 그대로다.
 */
export function beginNavigation(href: string) {
  if (typeof window === "undefined") return;
  if (!href.startsWith("/")) return;
  const next = toPathname(href);
  if (next === window.location.pathname) return;
  if (!hasRouteSkeleton(next)) return;
  pendingPath = next;
  emit();
}

export function endNavigation() {
  if (pendingPath === null) return;
  pendingPath = null;
  emit();
}

export function subscribeNavigation(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getPendingPath() {
  return pendingPath;
}
