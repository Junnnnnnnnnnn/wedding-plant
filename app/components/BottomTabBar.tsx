"use client";

import { Home } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { TAB_ITEMS, TAB_ROUTES, TabType, pathnameToTab } from "./tabs";

// 탭 정의는 tabs.ts 로 옮겼다. 좌측 레일(SideNavRail)과 같은 소스를 봐야
// 탭 구성이 갈라지지 않는다. 기존 import 경로를 깨지 않도록 재export 한다.
export type { TabType };

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
  const tabs: Array<{
    id: TabType;
    label: string;
    icon: typeof Home;
  }> = TAB_ITEMS;

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
      {/*
        시안(C안)의 `.c-tabbar` 값 그대로다 —
        위에 헤어라인(`stroke-neutral-muted`), 4등분 그리드,
        패딩 8px / 아래 16px. 예전에는 `justify-around` 라 항목 폭이
        글자 길이에 따라 들쭉날쭉했고("참여 플랜"만 넓었다), 위 경계선이
        없어 목록이 탭바로 흘러 들어가는 것처럼 보였다.
      */}
      <nav className="w-full border-t border-[#00000010] bg-white">
        <div className="mx-auto grid w-full max-w-[500px] grid-cols-4 pb-4 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = resolvedActiveTab === tab.id;
            /*
              활성 탭은 **브랜드 분홍**이다. 예전 `#ffaab8` 은 흰 바탕에서
              비활성 회색과 명도가 비슷해, 지금 어느 탭에 있는지가 잘 안
              보였다. 비활성은 SEED 중립 subtle.
            */
            const iconColor = isActive ? "#ee2b8c" : "#868b94";
            const textColor = isActive ? "#ee2b8c" : "#868b94";
            const isDisabled = false;

            return (
              <button
                key={tab.id}
                type="button"
                className={`relative grid justify-items-center gap-[3px] transition-colors ${isDisabled ? "pointer-events-none cursor-not-allowed opacity-40" : ""}`}
                onClick={() => handleClick(tab.id)}
                aria-disabled={isDisabled}
              >
                <div className="relative grid h-[22px] w-[22px] place-items-center">
                  <Icon
                    className="h-[22px] w-[22px]"
                    style={{ color: iconColor }}
                    strokeWidth={2}
                  />
                  {/*
                    시안에는 배지가 없지만 미읽음은 알려 줘야 한다. 예전의
                    말풍선 모양은 아이콘보다 커서 탭바에서 가장 눈에 띄었다 —
                    **작은 원**으로 낮춘다.
                  */}
                  {tab.id === "rooms" && (unreadCount ?? 0) > 0 && (
                    <span className="pointer-events-none absolute -right-1.5 -top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[#ee2b8c] px-1 text-[9px] font-bold leading-none text-white">
                      {unreadCount! > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] leading-none ${isActive ? "font-bold" : "font-medium"}`}
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
