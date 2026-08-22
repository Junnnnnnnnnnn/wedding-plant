"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  NAV_ACTIVE_COLOR,
  NAV_INACTIVE_COLOR,
  RAIL_GROUPS,
  RAIL_ROUTES,
  RailViewType,
  pathnameToRailView,
} from "./tabs";

interface SideNavRailProps {
  /** 레일 하단에 표시할 사용자. 없으면 그 영역을 그리지 않는다 */
  user?: { name: string; caption?: string | null } | null;
  /** 활성 메뉴. 없으면 pathname 으로 결정 */
  activeView?: RailViewType;
  /** 메뉴 클릭 핸들러. 없으면 RAIL_ROUTES 로 라우팅 */
  onViewClick?: (view: RailViewType) => void;
  /** 참여 플랜 메뉴에 표시할 알림 수 */
  unreadCount?: number;
}

/**
 * 태블릿 이상(≥768px)에서 하단 탭바를 대신하는 좌측 세로 내비게이션.
 *
 * 768~1023: 아이콘만 (76px)
 * 1024+   : 아이콘 + 라벨 + 그룹 헤더 (236px)
 *
 * 활성 색상과 탭 구성은 BottomTabBar 와 같은 소스(tabs.ts)를 쓴다.
 */
export default function SideNavRail({
  user = null,
  activeView,
  onViewClick,
  unreadCount,
}: SideNavRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const resolvedActive = activeView ?? pathnameToRailView(pathname);

  const handleClick = (view: RailViewType) => {
    if (onViewClick) {
      onViewClick(view);
    } else {
      router.push(RAIL_ROUTES[view]);
    }
  };

  return (
    <aside className="hidden h-full shrink-0 flex-col overflow-hidden border-r border-stone-100 bg-white py-5 md:flex md:w-[76px] lg:w-[236px] lg:px-4 lg:py-6">
      <div className="flex items-center justify-center gap-2.5 pb-6 lg:justify-start lg:pl-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[#ee2b8c] text-sm font-bold text-white shadow-[0_4px_12px_-3px_rgba(238,43,140,0.55)]">
          WP
        </div>
        <div className="hidden text-[15px] font-bold tracking-tight text-[#1b0d14] lg:block">
          웨딩 플랜트
        </div>
      </div>

      {/* 항목이 많아지면 사용자 블록이 화면 밖으로 밀린다. 메뉴만 스크롤 */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        {RAIL_GROUPS.map((group, groupIndex) => (
          <div key={group.label}>
            <div className="hidden px-3.5 pb-1.5 pt-4 text-[11px] text-stone-300 lg:block">
              {group.label}
            </div>
            {groupIndex > 0 && (
              <div className="mx-3 my-3.5 h-px bg-stone-100 lg:hidden" />
            )}
            <nav className="flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = resolvedActive === item.id;
                const color = isActive ? NAV_ACTIVE_COLOR : NAV_INACTIVE_COLOR;
                const badgeCount = item.badge ? (unreadCount ?? 0) : 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleClick(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative mx-3 flex items-center justify-center gap-3 rounded-[14px] py-3 transition-colors lg:mx-0 lg:justify-start lg:px-3.5 ${
                      isActive ? "bg-[#fff2f6]" : "hover:bg-[#faf7f9]"
                    }`}
                  >
                    <Icon
                      className="h-[22px] w-[22px] shrink-0"
                      style={{ color }}
                      strokeWidth={2}
                    />
                    <span className="hidden text-sm lg:block" style={{ color }}>
                      {item.label}
                    </span>
                    {badgeCount > 0 && (
                      <span className="absolute left-1/2 top-1.5 ml-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#ee2b8c] px-1 text-[10px] font-bold leading-none text-white lg:static lg:ml-auto lg:h-[18px] lg:min-w-[18px]">
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {user && (
        <div className="shrink-0 px-3 pt-4 lg:px-0">
          <div className="flex items-center justify-center gap-2.5 rounded-[14px] p-2 lg:justify-start">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#ee2b8c] font-user-content text-[12.5px] font-bold text-white">
              {user.name?.trim().charAt(0) || "?"}
            </span>
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate text-[13px] font-bold tracking-tight text-[#1b0d14]">
                {user.name}
              </span>
              {user.caption && (
                <span className="mt-px block truncate text-[11.5px] text-gray-400">
                  {user.caption}
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
