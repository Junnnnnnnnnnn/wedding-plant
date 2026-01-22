"use client";

import { useState, useEffect } from "react";
import { LandingHero } from "../components/LandingHero";
import { CelebrationEffects } from "../components/CelebrationEffects";
import { DatePickerWheel } from "../components/DatePickerWheel";
import { useWedding } from "../contexts/WeddingContext";

export default function SettingPage() {
  const { weddingData, setBudget, setName, setDate } = useWedding();
  const [showFirst, setShowFirst] = useState(true);
  const [showSecond, setShowSecond] = useState(false);
  const [showThird, setShowThird] = useState(false);
  const [showFourth, setShowFourth] = useState(false);
  const [showFifth, setShowFifth] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDatePickerFadingOut, setIsDatePickerFadingOut] = useState(false);
  const [isBudgetFadingOut, setIsBudgetFadingOut] = useState(false);
  const [isNameFadingOut, setIsNameFadingOut] = useState(false);
  const [isNameShaking, setIsNameShaking] = useState(false);
  const [isFifthFadingOut, setIsFifthFadingOut] = useState(false);

  useEffect(() => {
    // 첫 번째 메시지가 3초 후 사라지고, 그 다음 두 번째 메시지가 나타남
    const timer1 = setTimeout(() => {
      setIsFadingOut(true);
    }, 3000);

    const timer2 = setTimeout(() => {
      setShowFirst(false);
      setShowSecond(true);
    }, 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    if (showFifth) {
      // fade in 완료(500ms) 후 2초간 보여주고 fade out 시작
      const timer = setTimeout(() => {
        setIsFifthFadingOut(true);
      }, 4500); // 500ms (fade-in duration) + 2000ms (display time)

      return () => {
        clearTimeout(timer);
      };
    }
  }, [showFifth]);

  const handleDateChange = (date: { year: number; month: number; day: number }) => {
    setDate(date);
    console.log("Selected date:", date);
  };

  const handleDateNext = () => {
    // fade out 시작
    setIsDatePickerFadingOut(true);
    // 애니메이션 완료 후 화면 전환
    setTimeout(() => {
      setShowSecond(false);
      setShowThird(true);
    }, 500); // fade-out 애니메이션 시간과 동일
  };

  const handleBudgetNext = () => {
    // fade out 시작
    setIsBudgetFadingOut(true);
    // 애니메이션 완료 후 화면 전환
    setTimeout(() => {
      setShowThird(false);
      setShowFourth(true);
    }, 500); // fade-out 애니메이션 시간과 동일
  };

  const handleNameNext = () => {
    // fade out 시작
    setIsNameFadingOut(true);
    // 애니메이션 완료 후 화면 전환
    setTimeout(() => {
      setShowFourth(false);
      setShowFifth(true);
    }, 500); // fade-out 애니메이션 시간과 동일
  };

  const handleBack = () => {
    // 다섯 번째 화면에서 네 번째 화면으로
    if (showFifth) {
      setShowFifth(false);
      setShowFourth(true);
      setIsNameFadingOut(false);
      setIsFifthFadingOut(false);
    } else if (showFourth) {
      // 네 번째 화면에서 세 번째 화면으로
      setShowFourth(false);
      setShowThird(true);
      setIsBudgetFadingOut(false);
    } else if (showThird) {
      // 세 번째 화면에서 두 번째 화면으로
      setShowThird(false);
      setShowSecond(true);
      setIsDatePickerFadingOut(false);
    }
  };

  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <main className="relative flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-[#FFF5F2] px-6 py-8">
        {(showThird || showFourth || showFifth) && (
          <button
            onClick={handleBack}
            className="absolute top-6 left-6 z-50 p-2 text-stone-700 hover:text-stone-900 transition-colors duration-200"
            aria-label="뒤로 가기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {showFirst && !isFadingOut && <CelebrationEffects />}
        {showFirst && (
          <div className={`absolute inset-0 flex flex-1 flex-col items-center justify-center ${isFadingOut ? "animate-fade-out" : ""}`}>
            <LandingHero title="우리" subtitle="🎉 축하드려요 🎉" />
          </div>
        )}
        {showSecond && (
          <div className={`flex flex-1 flex-col items-center justify-center ${isDatePickerFadingOut ? "animate-fade-out" : "animate-fade-in"}`}>
            <LandingHero title="결혼 날짜가 언제인가요" subtitle="우신, 우랑님. 가장 빛날 그날까지 함께해요." titleSize="text-3xl sm:text-4xl" subtitleSize="text-base sm:text-lg" />
            <DatePickerWheel onDateChange={handleDateChange} onNext={handleDateNext} />
          </div>
        )}
        {showThird && (
          <div className={`flex flex-1 flex-col items-center justify-center ${isBudgetFadingOut ? "animate-fade-out" : "animate-fade-in"}`}>
            <LandingHero title="예산도 살짝 알려주세요!" subtitle="마음 편하시게 제가 꼼꼼히 챙겨드릴게요." titleSize="text-3xl sm:text-4xl" subtitleSize="text-base sm:text-lg" />
            <div className="flex flex-col items-center mt-24 mb-20">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={weddingData.budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0"
                    className="px-4 py-3 text-lg font-semibold text-stone-900 bg-white rounded-lg border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] w-32 text-center"
                  />
                  <span className="text-lg font-semibold text-stone-700">만원</span>
                </div>
              </div>
              <button
                onClick={handleBudgetNext}
                className="px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md"
              >
                다음
              </button>
            </div>
          </div>
        )}
        {showFourth && (
          <div className={`flex flex-1 flex-col items-center justify-center ${isNameFadingOut ? "animate-fade-out" : "animate-fade-in"}`}>
            <LandingHero title="혹시.. 이름도 괜찮을까요?" subtitle="닉네임도 괜찮아요!" titleSize="text-3xl sm:text-4xl" subtitleSize="text-base sm:text-lg" />
            <div className="flex flex-col items-center mt-24 mb-20">
              <p className="text-sm text-stone-500 mb-2">최대 5 글자</p>
              <div className="flex items-center justify-center gap-4 mb-4">
                <input
                  type="text"
                  value={weddingData.name}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue.length > 5) {
                      // 5글자 초과 시 흔들림 애니메이션
                      setIsNameShaking(true);
                      setTimeout(() => setIsNameShaking(false), 400);
                      // 5글자까지만 저장
                      setName(newValue.slice(0, 5));
                    } else {
                      setName(newValue);
                    }
                  }}
                  placeholder="이름 또는 닉네임"
                  maxLength={5}
                  className={`px-4 py-3 text-lg font-semibold text-stone-900 bg-white rounded-lg border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] w-64 text-center ${isNameShaking ? "animate-shake" : ""}`}
                />
              </div>
              <button
                onClick={handleNameNext}
                className="px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md"
              >
                다음
              </button>
            </div>
          </div>
        )}
        {showFifth && (
          <div className={`flex flex-1 flex-col items-center justify-center ${isFifthFadingOut ? "animate-fade-out" : "animate-fade-in"}`}>
            <LandingHero 
              title={`${weddingData.name || "님"} 환영합니다~`} 
              subtitle="제가 작은 선물을 준비했어요" 
              titleSize="text-3xl sm:text-4xl" 
              subtitleSize="text-base sm:text-lg" 
            />
          </div>
        )}
      </main>
    </div>
  );
}
