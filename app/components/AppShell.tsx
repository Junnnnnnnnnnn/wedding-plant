"use client";

import React from "react";
import cn from "@/lib/utils";
import BottomTabBar from "./BottomTabBar";
import SideNavRail from "./SideNavRail";
import { RailViewType, TabType } from "./tabs";

interface AppShellProps {
  /** 모바일 하단 탭바의 활성 탭. 없으면 pathname 으로 결정 */
  activeTab?: TabType;
  /** 데스크톱 레일의 활성 메뉴. 없으면 pathname 으로 결정 */
  activeRailView?: RailViewType;
  unreadCount?: number;
  /** 레일 하단에 표시할 사용자 */
  railUser?: { name: string; caption?: string | null } | null;

  /** 마스터 컬럼 내용 */
  children: React.ReactNode;
  /**
   * ≥1024px 에서 우측에 붙는 디테일 pane.
   * 이 prop 을 넘기지 않으면 마스터만 렌더되고 컬럼도 나뉘지 않는다.
   */
  detail?: React.ReactNode;
  /** detail 이 null 일 때 우측 pane 에 보여줄 빈 상태 */
  detailEmpty?: React.ReactNode;
  /** 디테일이 있을 때 마스터 컬럼 폭 */
  masterWidthClassName?: string;
  /**
   * 디테일 pane 폭. 기본은 남는 자리를 다 쓴다(채팅처럼 디테일이 주인공일 때).
   * 보드처럼 마스터가 넓어야 하는 화면은 여기에 고정 폭을 준다.
   */
  detailWidthClassName?: string;
  /** 마스터 컬럼에 배경 점 패턴을 깔지 */
  gridBackground?: boolean;
  /**
   * 모바일 하단 탭바를 직접 넘긴다. 로그인 버튼이나 탭 클릭 동작을
   * 따로 붙여야 하는 화면(/main)에서 쓴다. 없으면 기본 탭바를 렌더한다.
   */
  bottomBarSlot?: React.ReactNode;
  className?: string;
}

/**
 * 화면 7개가 각자 반복하던 폰 프레임을 대신하는 공통 셸.
 *
 *  <768  : 지금과 동일 — max-w-md 중앙 정렬 + 하단 탭바
 *  ≥768  : 하단 탭바 대신 좌측 아이콘 레일, 컨텐츠는 폭 제한 해제
 *  ≥1024 : 레일에 라벨이 붙고, detail 이 있으면 마스터-디테일 2열
 *  ≥1280 : 마스터 컬럼이 넓어지고 전체가 1440px 에서 멈춘다
 *
 * detail 을 넘기지 않는 화면(설정 등)도 같은 셸을 써서 레일과 탭바가
 * 화면마다 어긋나지 않게 한다.
 */
export default function AppShell({
  activeTab,
  activeRailView,
  unreadCount,
  railUser = null,
  children,
  detail,
  detailEmpty,
  masterWidthClassName = "lg:w-[372px] xl:w-[420px]",
  detailWidthClassName = "flex-1",
  gridBackground = false,
  bottomBarSlot,
  className,
}: AppShellProps) {
  // detail prop 자체를 넘겼는지로 2열 여부를 정한다.
  // detail 이 null 이어도(아무것도 선택 안 한 상태) 컬럼은 유지해야
  // 선택할 때마다 레이아웃이 흔들리지 않는다.
  const hasDetailPane = detail !== undefined;

  return (
    <div
      className={cn("flex h-[100dvh] overflow-hidden bg-[#fcfbfc]", className)}
    >
      <SideNavRail
        user={railUser}
        activeView={activeRailView}
        unreadCount={unreadCount}
      />

      <div className="flex min-w-0 flex-1 xl:mx-auto xl:max-w-[1440px]">
        <div
          className={cn(
            "relative mx-auto flex w-full min-w-0 max-w-md flex-1 flex-col overflow-hidden bg-white shadow-2xl",
            "md:max-w-none md:shadow-none",
            hasDetailPane &&
              cn(
                "lg:mx-0 lg:flex-none lg:border-r lg:border-stone-100",
                masterWidthClassName,
              ),
            gridBackground && "grid-bg",
          )}
        >
          {children}
        </div>

        {hasDetailPane && (
          <div
            className={cn(
              "hidden min-w-0 flex-col overflow-hidden bg-[#fcfbfc] lg:flex",
              detailWidthClassName,
            )}
          >
            {detail ?? detailEmpty ?? null}
          </div>
        )}
      </div>

      {/* 하단 탭바는 모바일 전용. ≥768 에서는 좌측 레일이 대신한다 */}
      <div className="md:hidden">
        {bottomBarSlot ?? (
          <BottomTabBar activeTab={activeTab} unreadCount={unreadCount} />
        )}
      </div>
    </div>
  );
}
