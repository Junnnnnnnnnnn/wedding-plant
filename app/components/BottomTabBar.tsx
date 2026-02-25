"use client";

import {
  Home,
  Search,
  LayoutGrid,
  Settings,
  MessageCircle,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

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

interface BottomTabBarProps {
  /** 활성 탭. 없으면 pathname으로 자동 결정 */
  activeTab?: TabType;
  /** 탭 클릭 핸들러. 없으면 기본 라우팅 사용 (home→/main, rooms→/plan-list, settings→/user) */
  onTabClick?: (tab: TabType) => void;
  showLoginButton?: boolean;
  onLoginClick?: () => void;
  /** When "down", login button slides down (hide). When "up" or null, shows. */
  scrollDirection?: "up" | "down" | null;
  /** 참여플랜 탭에 표시할 알림 수 */
  unreadCount?: number;
}

export default function BottomTabBar({
  activeTab,
  onTabClick,
  showLoginButton = false,
  onLoginClick,
  scrollDirection = null,
  unreadCount,
}: BottomTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const resolvedActiveTab = activeTab ?? pathnameToTab(pathname);
  const [showFeedPrepModal, setShowFeedPrepModal] = useState(false);

  const tabs: Array<{
    id: TabType;
    label: string;
    icon: typeof Home;
  }> = [
    { id: "home", label: "홈", icon: Home },
    { id: "feed", label: "피드", icon: Search },
    { id: "rooms", label: "참여 플랜", icon: LayoutGrid },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleClick = (tab: TabType) => {
    if (tab === "feed") {
      setShowFeedPrepModal(true);
      return;
    }
    if (onTabClick) {
      onTabClick(tab);
    } else {
      router.push(TAB_ROUTES[tab]);
    }
  };

  return (
    <>
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
          <div className="flex w-full max-w-[500px] items-center justify-around px-6 py-2.5">
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
                  className={`flex flex-col items-center gap-0.5 px-4 py-1.5 -m-2 transition-all relative ${isDisabled ? "pointer-events-none cursor-not-allowed opacity-40" : ""}`}
                  onClick={() => handleClick(tab.id)}
                  aria-disabled={isDisabled}
                >
                  <div className="relative">
                    <Icon
                      className="h-6 w-6"
                      style={{ color: iconColor }}
                      strokeWidth={2}
                    />
                    {tab.id === "rooms" && (unreadCount ?? 0) > 0 && (
                      <div className="absolute -top-3.5 -right-4 flex items-center justify-center animate-in zoom-in duration-300 pointer-events-none">
                        <div className="relative w-5 h-5 flex items-center justify-center">
                          <MessageCircle
                            className="absolute inset-0 w-full h-full fill-[#ee2b8c] text-[#ee2b8c]"
                            strokeWidth={1}
                          />
                          <span className="relative z-10 text-[9px] font-black text-white flex items-center justify-center leading-none -mt-[2px] ml-[0.5px]">
                            {unreadCount! > 9 ? "9+" : unreadCount}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
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

      {/* 피드 서비스 준비중 모달 */}
      {showFeedPrepModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowFeedPrepModal(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowFeedPrepModal(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            tabIndex={-1}
            aria-modal="true"
            aria-label="서비스 준비중입니다."
          >
            <h2 className="text-center text-lg font-semibold text-stone-900">
              서비스 준비중입니다.
            </h2>
            <p className="mt-3 text-center text-[15px] font-normal leading-relaxed text-stone-700">
              조금만 기다려 주세요 🙇‍♂️
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowFeedPrepModal(false)}
                className="w-full rounded-full text-sm font-semibold h-11 flex items-center justify-center transition-transform hover:scale-[1.01] active:scale-[0.99] border-2 border-stone-300 bg-white text-stone-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
