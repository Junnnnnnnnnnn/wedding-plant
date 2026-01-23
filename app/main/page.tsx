"use client";

import { CircleDollarSign, User } from "lucide-react";
import { useWedding } from "../contexts/WeddingContext";

export default function Home() {
  const { weddingData } = useWedding();

  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <main className="flex h-full w-full max-w-[500px] flex-col items-center overflow-y-auto bg-[#FFF5F2] px-6">
        <div className="w-full bg-blue-200 pt-8">
          {/* 상단 영역 */}
          <div className="w-full flex items-start justify-between">
            {/* 이름 영역 */}
            <div className="flex flex-col items-start justify-start">
              <span className="text-[32px] font-semibold text-[#FFAAB8] leading-none">
                좋은 하루입니다.
              </span>
              <span className="text-[42px] font-semibold text-[#000000] leading-none mt-2">
                {weddingData.name || "이름"}
              </span>
            </div>
            {/* 프로필 이미지 영역 */}
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full ml-auto mt-2"
              style={{
                background: "linear-gradient(135deg, #ffaab8 0%, #ffd8df 100%)",
              }}
            >
              <User className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
          </div>
          {/* TodayFocus - Figma 20:206 */}
          <div className="mt-4 w-full">
            <div
              className="flex w-full flex-col rounded-[24px] p-6"
              style={{
                background: "linear-gradient(135deg, #ffaab8 0%, #ffd8df 100%)",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/30">
                  <CircleDollarSign
                    className="h-5 w-5 text-white"
                    strokeWidth={2}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5 text-white">
                    우리 예산 꼼꼼하게 들여다보기
                  </p>
                  <p className="mt-1  text-[42px] font-semibold leading-7 text-white">
                    350만 원
                  </p>
                </div>
              </div>
              <p className="mt-1 pl-[52px] py-2 text-xl font-semibold leading-none text-white">
                총 1,000만 원 중 650만 원 계획 중!
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: "65%" }}
                  />
                </div>
                <span className="shrink-0 text-sm font-normal leading-5 text-white">
                  65%
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full bg-green-200 ">
          {/* 하단 영역 */}
          <span className="text-lg font-semibold">하단 영역</span>
        </div>
      </main>
    </div>
  );
}
