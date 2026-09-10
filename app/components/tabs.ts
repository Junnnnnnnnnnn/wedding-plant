import {
  Columns3,
  Home,
  MessageCircle,
  NotepadText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

/** 모바일 하단 탭바의 탭. 4개 그대로 유지한다 */
export type TabType = "home" | "feed" | "rooms" | "settings";

/**
 * 데스크톱 좌측 레일의 메뉴. 하단 탭 4개에 "플랜 보드"와 "자랑하기"가
 * 더해진 6개다.
 *
 * 폰에서 탭 6개는 좁다. 보드는 애초에 넓은 화면 전용 뷰이고, 자랑하기는
 * 홈의 예산 패널에서 들어가는 곳이라 둘 다 모바일 탭을 따로 두지 않는다.
 * 그래서 레일과 탭바는 항목 수가 다르고, 두 화면에 있을 때 모바일 탭바는
 * pathnameToTab 규칙대로 "홈"을 활성 표시한다.
 */
export type RailViewType = TabType | "board" | "brag";

export const TAB_ROUTES: Record<TabType, string> = {
  home: "/main",
  feed: "/feed",
  rooms: "/plan-list",
  settings: "/user",
};

export const RAIL_ROUTES: Record<RailViewType, string> = {
  ...TAB_ROUTES,
  board: "/calendar",
  brag: "/brag",
};

/**
 * 하단 탭바용 경로 → 탭 매핑.
 *
 * 동작을 바꾸지 않는다. /calendar 가 home 으로 묶이는 것도 그대로다
 * (보드는 폰에 없는 뷰라 홈 탭에 귀속시키는 근거가 된다).
 */
export function pathnameToTab(pathname: string): TabType {
  // /brag 는 폰에서 홈의 예산 패널을 통해서만 들어간다. 보드(/calendar)와
  // 같은 이유로 탭을 따로 두지 않고 "홈"에 귀속시킨다
  if (pathname === "/main" || pathname === "/calendar" || pathname === "/brag")
    return "home";
  if (pathname === "/feed") return "feed";
  if (pathname === "/plan-list") return "rooms";
  if (pathname === "/user" || pathname === "/setting") return "settings";
  return "home";
}

/** 레일용 경로 → 메뉴 매핑. 보드와 채팅을 별도로 구분한다 */
export function pathnameToRailView(pathname: string): RailViewType {
  if (pathname === "/calendar") return "board";
  if (pathname === "/brag") return "brag";
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
  /*
    시안(C안)의 아이콘이다. 피드는 돋보기가 아니라 **글 목록**이다 — 이
    화면은 검색하는 곳이 아니라 남이 올린 후기를 훑는 곳이라, 돋보기는
    없는 기능을 약속한다. 참여 플랜은 격자가 아니라 **사람**이다.
  */
  { id: "feed", label: "피드", icon: NotepadText },
  { id: "rooms", label: "참여 플랜", icon: Users },
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
      { id: "feed", label: "피드", icon: NotepadText },
      /*
        자랑하기는 **순위가 아니라 구경거리**다. 트로피·메달을 쓰면 누가
        더 잘했는지를 겨루는 화면으로 읽히는데, 여기는 남의 플랜 한 장을
        그대로 들여다보는 곳이다.
      */
      { id: "brag", label: "자랑하기", icon: Sparkles },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

/** 활성/비활성 아이콘·라벨 색. 레일과 탭바가 같은 값을 쓴다 */
export const NAV_ACTIVE_COLOR = "#ffaab8";
export const NAV_INACTIVE_COLOR = "#99a1af";
