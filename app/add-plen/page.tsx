"use client";

import BottomTabBar from "../components/BottomTabBar";
import { useRouter } from "next/navigation";

export default function AddPlanPage() {
  const router = useRouter();
  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <main className="flex h-full w-full max-w-[500px] flex-col items-center overflow-y-auto bg-[#FFF5F2] px-6">
      <div className="w-full pt-8">
        <div className="flex flex-col items-start justify-start">
            <span className="text-[32px] font-semibold text-[#FFAAB8] leading-none">
            계획을 추가해보세요
            </span>
            <span className="text-[42px] font-semibold text-[#000000] leading-none mt-2">
            플랜 추가
            </span>
        </div>

      </div>
      </main>
        {/* 하단 탭바 - Sticky로 최상단에 고정 */}
      <BottomTabBar
        activeTab="home"
        onTabClick={(tab) => {
          if (tab === "home") {
            router.push("/main");
          }
          // TODO: 나머지 탭들은 나중에 처리
        }}
      />
    </div>
  );
}