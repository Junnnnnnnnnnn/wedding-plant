"use client";

import { Home, Search, LayoutGrid, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AUTH_TOKEN_CHANGED_EVENT, getToken } from "@/lib/api";

export type TabType = "home" | "feed" | "rooms" | "settings";

const TAB_ROUTES: Record<TabType, string> = {
  home: "/main",
  feed: "/main",
  rooms: "/plan-list",
  settings: "/user",
};

function pathnameToTab(pathname: string): TabType {
  if (pathname === "/main" || pathname === "/calendar") return "home";
  if (pathname === "/plan-list") return "rooms";
  if (pathname === "/user" || pathname === "/setting") return "settings";
  return "home";
}

/* eslint-disable react/require-default-props */
interface BottomTabBarProps {
  /** 활성 탭. 없으면 pathname으로 자동 결정 */
  activeTab?: TabType;
  /** 탭 클릭 핸들러. 없으면 기본 라우팅 사용 (home→/main, rooms→/plan-list, settings→/user) */
  onTabClick?: (tab: TabType) => void;
  showLoginButton?: boolean;
  onLoginClick?: () => void;
  /** When "down", login button slides down (hide). When "up" or null, shows. */
  scrollDirection?: "up" | "down" | null;
}
/* eslint-enable react/require-default-props */

export default function BottomTabBar({
  activeTab,
  onTabClick,
  showLoginButton = false,
  onLoginClick,
  scrollDirection = null,
}: BottomTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const resolvedActiveTab = activeTab ?? pathnameToTab(pathname);
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getToken());

  // 로그인 후(같은 탭/다른 탭) 포커스·가시성·pathname 변경 시 토큰 다시 읽어서 참여플랜/Settings 클릭 가능하도록
  useEffect(() => {
    const sync = () => setIsLoggedIn(!!getToken());
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, sync);
    sync();
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, sync);
    };
  }, [pathname]);

  const tabs: Array<{
    id: TabType;
    label: string;
    icon: typeof Home;
  }> = [
      { id: "home", label: "홈", icon: Home },
      { id: "feed", label: "피드", icon: Search },
      { id: "rooms", label: "참여플랜", icon: LayoutGrid },
      { id: "settings", label: "Settings", icon: Settings },
    ];

  const handleClick = (tab: TabType) => {
    if (onTabClick) {
      onTabClick(tab);
    } else {
      router.push(TAB_ROUTES[tab]);
    }
  };

  return (
    <div
      id="main-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-center"
    >
      {showLoginButton && onLoginClick && (
        <div
          className="w-full max-w-md px-6 flex items-center justify-center bg-transparent overflow-hidden"
          style={{
            transform:
              scrollDirection === "down"
                ? "translateY(calc(100% + 16px)) scale(0.95)"
                : "translateY(0) scale(1)",
            transition:
              "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
        >
          <button
            type="button"
            onClick={onLoginClick}
            className="w-full h-16 bg-[#ee2b8c] text-white rounded-2xl flex items-center justify-center gap-3 font-bold text-lg shadow-xl shadow-[#ee2b8c44] hover:bg-[#d4237b] transition-all transform hover:scale-[1.02] active:scale-95"
          >
            로그인 하기
          </button>
        </div>
      )}
      <nav className="w-full flex justify-center bg-white">
        <div className="flex w-full max-w-[500px] items-center justify-around px-6 py-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = resolvedActiveTab === tab.id;
            const iconColor = isActive ? "#ffaab8" : "#99a1af";
            const textColor = isActive ? "#ffaab8" : "#99a1af";
            const isDisabled = false;

            return (
              <button
                key={tab.id}
                type="button"
                className={`flex flex-col items-center gap-1 px-4 py-2 -m-2 transition-all ${isDisabled ? "pointer-events-none cursor-not-allowed opacity-40" : ""}`}
                onClick={() => handleClick(tab.id)}
                aria-disabled={isDisabled}
              >
                <Icon
                  className="h-6 w-6"
                  style={{ color: iconColor }}
                  strokeWidth={2}
                />
                <span
                  className="text-[10px] leading-[15px]"
                  style={{ color: textColor }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
