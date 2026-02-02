"use client";

import { Home, Calendar, BarChart3, Settings } from "lucide-react";

type TabType = "home" | "calendar" | "stats" | "settings";

/* eslint-disable react/require-default-props */
interface BottomTabBarProps {
  activeTab?: TabType;
  onTabClick?: (tab: TabType) => void;
  showLoginButton?: boolean;
  onLoginClick?: () => void;
  /** When "down", login button slides down (hide). When "up" or null, shows. */
  scrollDirection?: "up" | "down" | null;
}
/* eslint-enable react/require-default-props */

export default function BottomTabBar({
  activeTab = "home",
  onTabClick,
  showLoginButton = false,
  onLoginClick,
  scrollDirection = null,
}: BottomTabBarProps) {
  const tabs: Array<{
    id: TabType;
    label: string;
    icon: typeof Home;
  }> = [
    { id: "home", label: "홈", icon: Home },
    { id: "calendar", label: "캘린더", icon: Calendar },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleClick = (tab: TabType) => {
    if (onTabClick) {
      onTabClick(tab);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-center">
      {showLoginButton && onLoginClick && (
        <div className="w-full max-w-[500px] min-h-[70px] px-6 pb-2 flex items-center justify-center bg-transparent overflow-hidden">
          <button
            type="button"
            onClick={onLoginClick}
            className="w-full max-w-[280px] py-3 rounded-full text-white font-semibold text-base transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-md"
            style={{
              backgroundColor: "#FFAAB8",
              transform:
                scrollDirection === "down"
                  ? "translateY(calc(100% + 16px)) scale(0.95)"
                  : "translateY(0) scale(1)",
              transition:
                "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            로그인 하기
          </button>
        </div>
      )}
      <nav className="w-full flex justify-center bg-white">
        <div className="flex w-full max-w-[500px] items-center justify-around px-6 py-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const iconColor = isActive ? "#ffaab8" : "#99a1af";
          const textColor = isActive ? "#ffaab8" : "#99a1af";

          return (
            <button
              key={tab.id}
              type="button"
              className="flex flex-col items-center gap-1 px-4 py-2 -m-2"
              onClick={() => handleClick(tab.id)}
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
