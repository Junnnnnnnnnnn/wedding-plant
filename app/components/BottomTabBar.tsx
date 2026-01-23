"use client";

import { Home, Calendar, BarChart3, Settings } from "lucide-react";

type TabType = "home" | "calendar" | "stats" | "settings";

/* eslint-disable react/require-default-props */
interface BottomTabBarProps {
  activeTab?: TabType;
  onTabClick?: (tab: TabType) => void;
}
/* eslint-enable react/require-default-props */

export default function BottomTabBar({
  activeTab = "home",
  onTabClick,
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-white">
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
  );
}
