"use client";

import React from "react";
import cn from "@/lib/utils";
import AppShell from "./AppShell";
import { pathnameToRailView, pathnameToTab } from "./tabs";

/*
  화면이 **넘어가는 동안** 보이는 뼈대.

  데이터를 받는 동안의 스켈레톤은 각 화면이 이미 갖고 있다(`planLoading`,
  `ActivityPanel` 등). 이건 그보다 앞 구간 — 메뉴를 누른 순간부터 다음 화면의
  코드가 도착할 때까지다. 예전에는 이 구간에 이전 화면이 멈춰 있었다.

  두 곳에서 쓴다.
    1. `NavigationSkeleton` — 누른 순간 이전 화면 위에 덮는다
    2. 각 라우트의 `loading.tsx` — 주소가 바뀐 뒤 화면 코드가 붙기 전

  **실제 화면과 같은 자리에 같은 크기로 둔다.** 폰은 분홍 머리 면 + 흰 시트,
  넓은 화면은 흰 머리글 띠 + 카드다. 뼈대가 실제와 어긋나면 넘어가는 순간
  한 번 더 튀어서, 기다림을 가리려던 게 오히려 깜빡임이 된다. 화면 모양을
  바꾸면 여기도 같이 고친다.
*/

/** 흰 바탕 위의 뼈 */
function Bone({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("skeleton-shimmer block", className)} />
  );
}

/** 분홍 머리 면 위의 뼈. 회색 시머는 분홍 위에서 때가 탄 것처럼 보인다 */
function BrandBone({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("skeleton-on-brand block rounded-md", className)}
    />
  );
}

/** 폰의 분홍 머리 면. 실제 화면들의 `data-mobile-head` 와 같은 모양 */
function MobileHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-6 py-5 md:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 넓은 화면의 흰 머리글 띠 */
function DesktopHead({ right = 1 }: { right?: number }) {
  return (
    <div className="hidden shrink-0 items-center justify-between border-b border-stone-100 bg-white px-8 py-5 md:flex">
      <div>
        <Bone className="h-7 w-36 rounded-lg" />
        <Bone className="mt-2.5 h-3.5 w-52 rounded" />
      </div>
      <div className="flex gap-2.5">
        {Array.from({ length: right }, (_, i) => (
          <Bone key={i} className="h-10 w-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** 폰 머리 면: 제목 + 부제 + 오른쪽 아이콘 */
function TitleHead({ tall = false }: { tall?: boolean }) {
  return (
    <MobileHead className={tall ? "pt-12" : undefined}>
      <div className="flex items-center justify-between">
        <div>
          <BrandBone className="h-6 w-24" />
          <BrandBone className="mt-2.5 h-3.5 w-40" />
        </div>
        <BrandBone className="h-7 w-7 rounded-full" />
      </div>
    </MobileHead>
  );
}

function Chips({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <Bone
          key={i}
          className={cn("h-8 shrink-0 rounded-full", i === 0 ? "w-14" : "w-20")}
        />
      ))}
    </div>
  );
}

/** 넓은 화면의 카드. 홈 대시보드 카드와 같은 모서리·테두리 */
function Card({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-[#ee2b8c0f] bg-white p-7 shadow-[0_2px_10px_-4px_rgba(27,13,20,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ───────────────────────── 화면별 ───────────────────────── */

function MainSkeleton() {
  return (
    <>
      {/* 폰 — 머리 면 안에 인사·예산 요약, 아래 이번 달 할 일 */}
      <div className="md:hidden">
        <div className="rounded-b-[28px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-4 pb-5 pt-4">
          <div className="flex items-center justify-between">
            <BrandBone className="h-5 w-28" />
            <BrandBone className="h-6 w-6 rounded-full" />
          </div>
          <BrandBone className="mt-6 h-8 w-44" />
          <BrandBone className="mt-2 h-8 w-52" />
          <BrandBone className="mt-4 h-3.5 w-48" />
          <BrandBone className="mt-5 h-[60px] w-full rounded-2xl" />
        </div>
        <div className="px-4 pt-6">
          <div className="flex items-center justify-between px-1">
            <Bone className="h-6 w-28 rounded-lg" />
            <Bone className="h-4 w-8 rounded" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-[20px] bg-[#f7f8f9] px-4 py-4"
              >
                <Bone className="h-6 w-6 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Bone className="h-4 w-2/3 rounded" />
                  <Bone className="mt-2.5 h-3 w-1/3 rounded" />
                </div>
                <Bone className="h-4 w-14 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 넓은 화면 — 대시보드 */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between border-b border-stone-100 bg-white px-8 py-5">
          <div className="flex items-center gap-6">
            <div>
              <Bone className="h-[30px] w-[180px] rounded-lg" />
              <Bone className="mt-2 h-3.5 w-[152px] rounded" />
            </div>
            <Bone className="h-9 w-[92px] rounded-lg" />
          </div>
          <div className="flex gap-2.5">
            <Bone className="h-10 w-16 rounded-xl" />
            <Bone className="hidden h-10 w-20 rounded-xl lg:block" />
            <Bone className="h-10 w-28 rounded-xl" />
          </div>
        </div>
        <div className="px-8 pt-6">
          <Bone className="h-5 w-32 rounded" />
          <div className="mt-4 flex gap-3 overflow-hidden">
            {Array.from({ length: 3 }, (_, i) => (
              <Bone
                key={i}
                className="h-[92px] w-[232px] shrink-0 rounded-[20px]"
              />
            ))}
          </div>
          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
            <Card className="h-[340px]">
              <Bone className="h-5 w-12 rounded" />
              <Bone className="mt-8 h-9 w-[168px] rounded-lg" />
              <Bone className="mt-3 h-3.5 w-[124px] rounded" />
              <Bone className="mt-8 h-3 w-full rounded-full" />
              <Bone className="mt-7 h-3.5 w-3/4 rounded" />
              <Bone className="mt-3 h-3.5 w-2/3 rounded" />
            </Card>
            <Card className="h-[340px]">
              <Bone className="h-5 w-24 rounded" />
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="mt-7">
                  <Bone className="h-3 w-28 rounded" />
                  <Bone className="mt-2.5 h-4 w-40 rounded" />
                </div>
              ))}
            </Card>
            <Card className="hidden h-[340px] lg:block">
              <Bone className="h-5 w-20 rounded" />
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="mt-6 flex gap-3">
                  <Bone className="h-7 w-7 shrink-0 rounded-full" />
                  <div className="flex-1">
                    <Bone className="h-[13px] w-full rounded" />
                    <Bone className="mt-1.5 h-[11px] w-14 rounded" />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function CalendarSkeleton() {
  return (
    <>
      {/* 폰 — 달력 */}
      <div className="md:hidden">
        <MobileHead className="px-6 pb-5 pt-3">
          <div className="flex items-center justify-between">
            <BrandBone className="h-7 w-36" />
            <BrandBone className="h-6 w-6 rounded-full" />
          </div>
          <BrandBone className="mt-4 h-[64px] w-full rounded-2xl" />
          <BrandBone className="mt-4 h-10 w-full rounded-xl" />
        </MobileHead>
        <div className="grid grid-cols-7 gap-y-9 px-4 pt-6">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="flex justify-center">
              <Bone className="h-4 w-5 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 넓은 화면 — 월별 컬럼 보드 */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between px-8 py-5">
          <Bone className="h-8 w-28 rounded-lg" />
          <Bone className="h-10 w-28 rounded-xl" />
        </div>
        <div className="flex gap-6 overflow-hidden px-8">
          {Array.from({ length: 4 }, (_, col) => (
            <div key={col} className="w-[274px] shrink-0">
              <div className="flex items-center justify-between border-b-2 border-[#f4eff2] pb-3">
                <Bone className="h-5 w-12 rounded" />
                <Bone className="h-4 w-16 rounded" />
              </div>
              <div className="mt-4 space-y-3">
                {Array.from({ length: col === 0 ? 3 : 2 }, (__, row) => (
                  <Bone key={row} className="h-[84px] rounded-[20px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function PlanListSkeleton() {
  return (
    <>
      <TitleHead tall />
      <DesktopHead right={0} />
      <div className="space-y-6 px-6 pt-6 md:px-8">
        {/* 폰은 회색 채움 카드(시안 C안 03), 넓은 화면은 흰 카드 — 실제 카드와 같다 */}
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="rounded-[20px] bg-[#f7f8f9] p-5 md:max-w-[700px] md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-6 md:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <Bone className="h-6 w-40 rounded-lg" />
                <Bone className="mt-2.5 h-3.5 w-32 rounded" />
              </div>
              <Bone className="h-9 w-9 rounded-full" />
            </div>
            <Bone className="mt-6 h-8 w-32 rounded-lg" />
            <Bone className="mt-2.5 h-3.5 w-28 rounded" />
            <Bone className="mt-5 h-3 w-full rounded-full" />
            <div className="mt-6 border-t border-dashed border-stone-100 pt-5">
              <Bone className="h-3.5 w-14 rounded" />
              <Bone className="mt-3 h-12 w-full rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FeedSkeleton() {
  return (
    <>
      <TitleHead />
      <DesktopHead />
      <div className="px-4 pt-4 md:px-8 md:pt-6">
        <Chips />
        <div className="mt-4 flex gap-3">
          <Bone className="h-4 w-12 rounded" />
          <Bone className="h-4 w-12 rounded" />
          <Bone className="h-4 w-16 rounded" />
        </div>
        <div className="mt-4 gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* 짜임은 `app/feed/page.tsx` 의 목록 뼈대(= FeedCard)와 같다 */}
          <div className="md:space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="border-b border-[#0000000c] px-1 py-5 md:flex md:gap-5 md:rounded-[24px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-[18px_20px] md:shadow-sm"
              >
                <div className="shrink-0 md:w-[120px]">
                  <Bone className="h-[23px] w-24 rounded" />
                  <Bone className="mt-1.5 h-3 w-12 rounded" />
                </div>
                <div className="mt-3 min-w-0 flex-1 md:mt-0">
                  <Bone className="h-4 w-32 rounded" />
                  <Bone className="mt-2.5 h-3.5 w-48 rounded" />
                  <Bone className="mt-2.5 h-3.5 w-full max-w-[320px] rounded" />
                  <div className="mt-4 flex gap-2">
                    <Bone className="h-9 w-28 rounded-full" />
                    <Bone className="h-9 w-9 rounded-full" />
                    <Bone className="h-9 w-32 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Card className="hidden h-[120px] p-5 lg:block">
            <Bone className="h-3 w-12 rounded" />
            <Bone className="mt-3 h-6 w-8 rounded" />
            <Bone className="mt-3 h-3 w-48 rounded" />
          </Card>
        </div>
      </div>
    </>
  );
}

function BragSkeleton() {
  return (
    <>
      <TitleHead />
      <DesktopHead right={0} />
      <div className="px-4 pt-4 md:px-8 md:pt-5">
        <div className="flex items-center justify-between">
          <Chips count={2} />
          <Bone className="h-3.5 w-8 rounded" />
        </div>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="h-[340px] p-5 md:h-[260px]">
              <Bone className="h-5 w-28 rounded" />
              <Bone className="mt-2.5 h-3.5 w-40 rounded" />
              <Bone className="mt-6 h-8 w-28 rounded-lg" />
              <Bone className="mt-5 h-3 w-full rounded-full" />
              <div className="mt-5 flex gap-1.5">
                <Bone className="h-6 w-14 rounded-md" />
                <Bone className="h-6 w-12 rounded-md" />
                <Bone className="h-6 w-16 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

function UserSkeleton() {
  const field = (i: number) => (
    <div key={i}>
      <Bone className="h-3.5 w-14 rounded md:hidden" />
      <Bone className="mt-2 h-[52px] w-full rounded-2xl md:mt-0 md:h-[62px]" />
    </div>
  );
  return (
    <>
      <MobileHead>
        <div className="flex items-center gap-3">
          <BrandBone className="h-11 w-11 rounded-full" />
          <div>
            <BrandBone className="h-5 w-28" />
            <BrandBone className="mt-2 h-3 w-24" />
          </div>
        </div>
      </MobileHead>
      <div className="hidden shrink-0 items-center gap-3 border-b border-stone-100 bg-white px-8 py-5 md:flex">
        <Bone className="h-11 w-11 rounded-full" />
        <div>
          <Bone className="h-6 w-28 rounded-lg" />
          <Bone className="mt-2 h-3 w-44 rounded" />
        </div>
      </div>
      <div className="px-4 pt-4 md:px-8 md:pt-6">
        <div className="mx-auto gap-5 md:grid md:max-w-[1040px] lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="hidden h-[300px] lg:block">
            <Bone className="mx-auto h-16 w-16 rounded-full" />
            <Bone className="mx-auto mt-4 h-5 w-24 rounded" />
            <Bone className="mt-8 h-3.5 w-full rounded" />
            <Bone className="mt-4 h-3.5 w-full rounded" />
            <Bone className="mt-4 h-3.5 w-full rounded" />
          </Card>
          <div className="space-y-5 md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-6">
            <Bone className="h-5 w-20 rounded" />
            {[0, 1, 2, 3].map(field)}
            <Bone className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 예산 상세의 본문 뼈대. 이 화면이 데이터를 받는 동안에도 그대로 쓴다
 * (`app/budget-detail/page.tsx`). 두 칸으로 가르는 기준도 실제 화면과 같은
 * 컨테이너 폭(`@[980px]`)이다 — 뷰포트로 가르면 레일 폭만큼 어긋난다.
 */
export function BudgetBodySkeleton() {
  return (
    <div aria-hidden className="@container">
      <div className="px-4 py-6 md:px-8 md:pt-6 @[980px]:md:grid @[980px]:md:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] @[980px]:md:items-start @[980px]:md:gap-5">
        <div className="md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-6">
          <div className="mx-auto h-[172px] w-[172px] rounded-full border-[26px] border-[#f4eff2]" />
          <Bone className="mx-auto mt-6 h-3.5 w-20 rounded" />
          <div className="mt-6 space-y-5 border-t border-stone-100 pt-5">
            <Bone className="h-4 w-full rounded" />
            <Bone className="h-4 w-full rounded" />
          </div>
        </div>
        <div className="mt-8 space-y-5 @[980px]:md:mt-0 md:mt-5">
          <div className="md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-6">
            <Bone className="h-5 w-24 rounded" />
            {Array.from({ length: 3 }, (_, i) => (
              <Bone key={i} className="mt-5 h-4 w-full rounded" />
            ))}
          </div>
          <div className="md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-6">
            <Bone className="h-5 w-12 rounded" />
            <Bone className="mt-5 h-9 w-28 rounded-full" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="mt-5 flex items-center gap-3">
                <Bone className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Bone className="h-4 w-32 rounded" />
                  <Bone className="mt-2 h-3 w-16 rounded" />
                </div>
                <Bone className="h-4 w-14 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <>
      <MobileHead className="pb-6 pt-4">
        <div className="flex items-center justify-between">
          <BrandBone className="h-6 w-6 rounded-full" />
          <BrandBone className="h-5 w-12" />
          <BrandBone className="h-6 w-6 rounded-full" />
        </div>
        <BrandBone className="mt-6 h-3.5 w-16" />
        <BrandBone className="mt-2.5 h-10 w-40" />
      </MobileHead>
      <DesktopHead />
      <BudgetBodySkeleton />
    </>
  );
}

/** 일정 상세·후기 상세처럼 한 장을 자세히 보는 화면 */
function DetailSkeleton() {
  return (
    <>
      <div className="shrink-0 rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-6 pb-5 pt-4 md:px-8">
        <div className="flex items-center gap-3">
          <BrandBone className="h-6 w-6 rounded-full" />
          <BrandBone className="h-5 w-24" />
        </div>
        <BrandBone className="mt-5 h-8 w-56" />
        <BrandBone className="mt-2.5 h-3.5 w-44" />
        <BrandBone className="mt-5 h-[68px] w-full rounded-2xl" />
      </div>
      <div className="space-y-5 px-6 pt-6 md:px-8">
        <div className="flex gap-3">
          <Bone className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1">
            <Bone className="h-3 w-10 rounded" />
            <Bone className="mt-2.5 h-4 w-40 rounded" />
          </div>
        </div>
        <Bone className="ml-[52px] h-[180px] rounded-2xl" />
        <Bone className="h-[72px] w-full rounded-2xl" />
        <Bone className="h-14 w-full rounded-2xl" />
      </div>
    </>
  );
}

function AddPlanSkeleton() {
  return (
    <>
      <div className="shrink-0 rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-4 pb-5 pt-4 md:hidden">
        <div className="flex items-center gap-3">
          <BrandBone className="h-6 w-6 rounded-full" />
          <BrandBone className="h-5 w-20" />
        </div>
        <BrandBone className="mt-5 h-8 w-48" />
        <BrandBone className="mt-2.5 h-3.5 w-36" />
      </div>
      <DesktopHead right={0} />
      <div className="px-4 pt-2 md:px-8 md:pt-6">
        <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:px-6">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 border-b border-stone-100 py-5 last:border-b-0 md:grid-cols-[140px_minmax(0,1fr)]"
              >
                <Bone className="h-4 w-14 rounded" />
                <Bone className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <Card className="hidden h-[190px] p-5 lg:block">
            <Bone className="h-3 w-32 rounded" />
            <Bone className="mt-4 h-[110px] w-full rounded-2xl" />
          </Card>
        </div>
      </div>
    </>
  );
}

/**
 * 후기 상세. 셸 없는 흰 전체 화면이다(`app/feed/FeedDetailView.tsx`) —
 * 셸째로 그리면 도착하는 순간 레일·탭바가 사라지며 화면이 튄다.
 * 받는 동안의 뼈대로도 그대로 쓴다. 지도 자리는 좌표를 모르는 채라 비워
 * 둔다 — 없는 후기가 더 많고, 자리를 먼저 잡았다가 빼면 본문이 168px 튄다.
 */
export function FeedDetailSkeleton() {
  return (
    <div aria-hidden className="min-h-[100dvh] bg-white">
      <div className="px-5 pt-16 md:mx-auto md:max-w-[560px]">
        <Bone className="h-3.5 w-14 rounded" />
        <Bone className="mt-3 h-7 w-2/3 rounded-lg" />
        <Bone className="mt-2.5 h-3.5 w-40 rounded" />
        <Bone className="mt-6 h-[112px] w-full rounded-[20px]" />
        <Bone className="mt-6 h-4 w-full rounded" />
        <Bone className="mt-3 h-4 w-5/6 rounded" />
        <Bone className="mt-3 h-4 w-2/3 rounded" />
      </div>
    </div>
  );
}

/** 폰의 채팅방. 셸 없이 화면 전체를 쓴다 */
function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-center gap-3 rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-4 py-4">
        <BrandBone className="h-6 w-6 rounded-full" />
        <div className="flex-1">
          <BrandBone className="h-5 w-28" />
          <BrandBone className="mt-2 h-3 w-16" />
        </div>
        <BrandBone className="h-7 w-12 rounded-full" />
      </div>
      <div className="flex-1 space-y-5 overflow-hidden px-4 pt-6">
        {Array.from({ length: 6 }, (_, i) =>
          i % 2 === 0 ? (
            <div key={i} className="flex items-end gap-2">
              <Bone className="h-10 w-10 shrink-0 rounded-full" />
              <Bone className="h-[62px] w-[62%] rounded-2xl rounded-tl-none" />
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <Bone className="h-[62px] w-[58%] rounded-2xl rounded-tr-none" />
            </div>
          ),
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 px-4 py-4">
        <Bone className="h-11 w-11 rounded-2xl" />
        <Bone className="h-11 flex-1 rounded-2xl" />
        <Bone className="h-11 w-11 rounded-2xl" />
      </div>
    </div>
  );
}

/* ───────────────────────── 조립 ───────────────────────── */

type SkeletonKind =
  | "main"
  | "calendar"
  | "plan-list"
  | "feed"
  | "feed-detail"
  | "brag"
  | "user"
  | "budget"
  | "detail"
  | "add-plen"
  | "chat";

function kindOf(pathname: string): SkeletonKind {
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/plan-list")) return "plan-list";
  if (pathname.startsWith("/feed/")) return "feed-detail";
  if (pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/brag")) return "brag";
  if (pathname.startsWith("/user")) return "user";
  if (pathname.startsWith("/budget-detail")) return "budget";
  if (pathname.startsWith("/schedule-detail")) return "detail";
  if (pathname.startsWith("/add-plen")) return "add-plen";
  if (pathname.startsWith("/chat/")) return "chat";
  return "main";
}

/** 셸 안에 들어가는 화면들. 채팅방·후기 상세는 셸이 없어 따로 그린다 */
const BODIES: Record<
  Exclude<SkeletonKind, "chat" | "feed-detail">,
  () => React.ReactElement
> = {
  main: MainSkeleton,
  calendar: CalendarSkeleton,
  "plan-list": PlanListSkeleton,
  feed: FeedSkeleton,
  brag: BragSkeleton,
  user: UserSkeleton,
  budget: BudgetSkeleton,
  detail: DetailSkeleton,
  "add-plen": AddPlanSkeleton,
};

/**
 * 목적지 화면의 뼈대를 셸째로 그린다. 레일·탭바는 **목적지 메뉴가 켜진
 * 상태**로 그린다 — 누른 메뉴가 곧바로 켜져야 "눌렸다" 가 전해진다.
 */
export default function RouteSkeletonScreen({
  pathname,
}: {
  pathname: string;
}) {
  const kind = kindOf(pathname);
  const label = (
    <span className="sr-only" role="status">
      화면을 불러오는 중입니다
    </span>
  );

  if (kind === "feed-detail") {
    return (
      <div aria-busy>
        {label}
        <FeedDetailSkeleton />
      </div>
    );
  }

  if (kind === "chat") {
    /*
      채팅방은 폰에서는 셸 없는 전체 화면이고, 넓은 화면에서는
      `/plan-list?chat=` 로 옮겨 가 목록 옆 pane 으로 열린다
      (`app/chat/[chatRoomId]/page.tsx`). 뼈대도 폭에 따라 갈라 둔다.
    */
    return (
      <div aria-busy className="h-[100dvh]">
        {label}
        <div className="h-full md:hidden">
          <ChatSkeleton />
        </div>
        <div className="hidden h-full md:block">
          <AppShell
            activeTab="rooms"
            activeRailView="rooms"
            masterWidthClassName="lg:flex-1 lg:max-w-[780px]"
            detail={null}
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <PlanListSkeleton />
            </div>
          </AppShell>
        </div>
      </div>
    );
  }

  const Body = BODIES[kind];
  // 참여 플랜은 목록 | 대화 두 칸이다. 오른쪽 칸 자리를 비워 두어야 넘어간 뒤 폭이 안 튄다
  const isPlanList = kind === "plan-list";
  return (
    <div aria-busy>
      {label}
      <AppShell
        activeTab={pathnameToTab(pathname)}
        activeRailView={pathnameToRailView(pathname)}
        masterWidthClassName={
          isPlanList ? "lg:flex-1 lg:max-w-[780px]" : undefined
        }
        detail={isPlanList ? null : undefined}
      >
        <div className="min-h-0 flex-1 overflow-hidden bg-white md:bg-[#fcfbfc]">
          <Body />
        </div>
      </AppShell>
    </div>
  );
}
