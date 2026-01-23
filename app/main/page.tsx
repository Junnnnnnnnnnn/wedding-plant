"use client";

import { CircleDollarSign, User } from "lucide-react";
import { useWedding } from "../contexts/WeddingContext";
import CountUp from "@/components/CountUp";

export default function Home() {
  const { weddingData, user } = useWedding();

  // 예산 관리 변수
  // user가 null이고 setting에서 지정한 예산이 있으면 그 값을 사용, 없으면 기본값 1000
  const initialBudget = Number(weddingData.budget) || 1000; // 초기 예산 (만원)
  const usedBudget = 0; // 사용한 예산 (만원) - 추후 API로 받아올 예정
  const remainingBudget = initialBudget - usedBudget; // 남은 예산 실시간 계산

  // 예산 사용률 계산
  const budgetUsagePercentage = Math.round((usedBudget / initialBudget) * 100);

  // 예산 사용률에 따른 그라데이션 색상 계산
  const getGradientColors = (percentage: number) => {
    // 0% = 현재 색상(기본), 100% = 진한 색상
    const t = percentage / 100; // 0 ~ 1

    // 기본 색상 (0%일 때 - 현재 색상)
    const baseStart = { h: 351, s: 100, l: 83 }; // #ffaab8
    const baseEnd = { h: 347, s: 100, l: 92 }; // #ffd8df

    // 진한 색상 (100%일 때)
    const darkStart = { h: 351, s: 100, l: 65 };
    const darkEnd = { h: 347, s: 100, l: 78 };

    // 0%에서 100%로 갈수록 명도(lightness)를 줄여서 진하게 만듦
    const startColor = `hsl(${baseStart.h}, ${baseStart.s}%, ${baseStart.l - (baseStart.l - darkStart.l) * t}%)`;
    const endColor = `hsl(${baseEnd.h}, ${baseEnd.s}%, ${baseEnd.l - (baseEnd.l - darkEnd.l) * t}%)`;

    return `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`;
  };

  const budgetGradient = getGradientColors(budgetUsagePercentage);

  // User 버튼 클릭 핸들러
  const handleUserClick = () => {
    if (!user) {
      // TODO: 추후 회원가입/로그인 모달이나 페이지로 이동
      alert("로그인이 필요합니다. 회원가입 또는 로그인을 해주세요.");
    } else {
      // TODO: 추후 마이페이지나 설정 페이지로 이동
      alert(`${user.name}님 환영합니다!`);
    }
  };

  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <main className="flex h-full w-full max-w-[500px] flex-col items-center overflow-y-auto bg-[#FFF5F2] px-6">
        <div className="w-full pt-8">
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
            <button
              type="button"
              onClick={handleUserClick}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full ml-auto mt-2 cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                background: "linear-gradient(135deg, #ffaab8 0%, #ffd8df 100%)",
              }}
            >
              <User className="h-6 w-6 text-white" strokeWidth={2} />
            </button>
          </div>
          {/* TodayFocus - Figma 20:206 */}
          <div className="mt-4 w-full">
            <div
              className="flex w-full flex-col rounded-[24px] p-6"
              style={{
                background: budgetGradient,
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
                    남은 예산
                  </p>
                  <p className="my-3 text-[42px] font-semibold leading-7 text-white">
                    <CountUp
                      to={remainingBudget}
                      separator=","
                      duration={0.5}
                      className="inline"
                    />
                    만 원
                  </p>
                </div>
              </div>
              <p className="mt-1 pl-[52px] py-2 text-xl font-semibold leading-none text-white">
                <CountUp
                  to={initialBudget}
                  separator=","
                  duration={0.5}
                  className="inline"
                />
                만 원 중{" "}
                <CountUp
                  to={usedBudget}
                  separator=","
                  duration={0.5}
                  className="inline"
                />
                만 원 계획
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${budgetUsagePercentage}%` }}
                  />
                </div>
                <span className="shrink-0 text-sm font-normal leading-5 text-white">
                  {budgetUsagePercentage}%
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
