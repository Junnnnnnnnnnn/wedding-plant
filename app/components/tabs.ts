import {
  Columns3,
  Home,
  LayoutGrid,
  MessageCircle,
  Search,
  Settings,
} from "lucide-react";

/** 모바일 하단 탭바의 탭. 4개 그대로 유지한다 */
export type TabType = "home" | "feed" | "rooms" | "settings";

/**
 * 데스크톱 좌측 레일의 메뉴. 하단 탭 4개에 "플랜 보드"가 추가된 5개다.
 *
 * 폰에서 탭 5개는 좁고, 보드는 애초에 넓은 화면 전용 뷰라 모바일에는
 * 넣지 않는다. 그래서 레일과 탭바는 항목 수가 다르고, 보드 화면(/calendar)에
 * 있을 때 모바일 탭바는 pathnameToTab 규칙대로 "홈"을 활성 표시한다.
 */
export type RailViewType = TabType | "board";

export const TAB_ROUTES: Record<TabType, string> = {
  home: "/main",
  feed: "/feed",
  rooms: "/plan-list",
  settings: "/user",
};

export const RAIL_ROUTES: Record<RailViewType, string> = {
  ...TAB_ROUTES,
  board: "/calendar",
};

/**
 * 하단 탭바용 경로 → 탭 매핑.
 *
 * 동작을 바꾸지 않는다. /calendar 가 home 으로 묶이는 것도 그대로다
 * (보드는 폰에 없는 뷰라 홈 탭에 귀속시키는 근거가 된다).
 */
export function pathnameToTab(pathname: string): TabType {
  if (pathname === "/main" || pathname === "/calendar") return "home";
  if (pathname === "/feed") return "feed";
  if (pathname === "/plan-list") return "rooms";
  if (pathname === "/user" || pathname === "/setting") return "settings";
  return "home";
}

/** 레일용 경로 → 메뉴 매핑. 보드와 채팅을 별도로 구분한다 */
export function pathnameToRailView(pathname: string): RailViewType {
  if (pathname === "/calendar") return "board";
  if (pathname === "/feed") return "feed";
  if (pathname === "/plan-list" || pathname.startsWith("/chat/"))
    return "rooms";
  if (pathname === "/user" || pathname === "/setting") return "settings";
  return "home";
}

interface NavItem<T> {
  id: T;
  label: string;
  icon: typeof Home;
}

/** 하단 탭바 항목 (모바일) */
export const TAB_ITEMS: Array<NavItem<TabType>> = [
  { id: "home", label: "홈", icon: Home },
  { id: "feed", label: "피드", icon: Search },
  { id: "rooms", label: "참여 플랜", icon: LayoutGrid },
  { id: "settings", label: "Settings", icon: Settings },
];

/** 레일 항목 (태블릿 이상). 그룹으로 나뉜다 */
export const RAIL_GROUPS: Array<{
  label: string;
  items: Array<NavItem<RailViewType> & { soon?: boolean; badge?: boolean }>;
}> = [
  {
    label: "우리 결혼 준비",
    items: [
      { id: "home", label: "홈", icon: Home },
      { id: "board", label: "플랜 보드", icon: Columns3 },
      {
        id: "rooms",
        label: "참여 플랜 · 대화",
        icon: MessageCircle,
        badge: true,
      },
    ],
  },
  {
    label: "둘러보기",
    items: [
      { id: "feed", label: "피드", icon: Search },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

/** 활성/비활성 아이콘·라벨 색. 레일과 탭바가 같은 값을 쓴다 */
export const NAV_ACTIVE_COLOR = "#ffaab8";
export const NAV_INACTIVE_COLOR = "#99a1af";
