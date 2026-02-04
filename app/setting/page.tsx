"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KakaoLoginAlert from "../components/KakaoLoginAlert";
import LandingHero from "../components/LandingHero";
import CelebrationEffects from "../components/CelebrationEffects";
import DatePickerWheel from "../components/DatePickerWheel";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import { getToken } from "@/lib/api";
import CountUp from "../../components/CountUp";

// 3D(WebGL)는 클라이언트에서만 로드해 Context Lost·엑스박스 방지
const Lanyard = dynamic(() => import("../../components/Lanyard"), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#fcfbfc] grid-bg">
      {/* Decorative Blur Elements (match app/page.tsx) */}
      <div className="absolute top-[-10%] right-[-20%] w-80 h-80 bg-[#ee2b8c11] rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-20%] w-80 h-80 bg-purple-100/50 rounded-full blur-[100px] pointer-events-none"></div>

      <span className="relative z-10 text-stone-500">출입증 준비 중...</span>
    </div>
  ),
});

function SettingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { weddingData, setBudget, setName, setDate } = useWedding();
  const { fetchWithAuth } = useApi();
  const showKakaoLogin = searchParams.get("kakao_login") === "1";
  const [showFirst, setShowFirst] = useState(true);
  const [showSecond, setShowSecond] = useState(false);
  const [showThird, setShowThird] = useState(false);
  const [showFourth, setShowFourth] = useState(false);
  const [showFifth, setShowFifth] = useState(false);
  const [showSixth, setShowSixth] = useState(false);
  const [showSeventh, setShowSeventh] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDatePickerFadingOut, setIsDatePickerFadingOut] = useState(false);
  const [isBudgetFadingOut, setIsBudgetFadingOut] = useState(false);
  const [isNameFadingOut, setIsNameFadingOut] = useState(false);
  const [isNameShaking, setIsNameShaking] = useState(false);
  const [isFifthFadingOut, setIsFifthFadingOut] = useState(false);
  const [isSixthFadingOut, setIsSixthFadingOut] = useState(false);
  const [isCountUpComplete, setIsCountUpComplete] = useState(false);
  const [countUpKey, setCountUpKey] = useState(0);
  const [showLanyard, setShowLanyard] = useState(false);
  const [isLanyardFadingOut, setIsLanyardFadingOut] = useState(false);

  useEffect(() => {
    // 페이지 전체 스크롤 방지 및 오버스크롤 방지
    const originalStyle = {
      overflow: document.body.style.overflow,
      overscrollBehavior: document.body.style.overscrollBehavior,
      position: document.body.style.position,
      width: document.body.style.width,
    };

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = originalStyle.overflow;
      document.body.style.overscrollBehavior = originalStyle.overscrollBehavior;
      document.body.style.position = originalStyle.position;
      document.body.style.width = originalStyle.width;
      document.documentElement.style.overscrollBehavior = "auto";
    };
  }, []);

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

      // fade out 시작 후 Lanyard 표시
      const lanyardTimer = setTimeout(() => {
        setShowLanyard(true);
      }, 5000); // 500ms (fade-in) + 2000ms (display) + 500ms (fade-out)

      return () => {
        clearTimeout(timer);
        clearTimeout(lanyardTimer);
      };
    }
    return undefined;
  }, [showFifth]);

  useEffect(() => {
    if (showSixth) {
      // fade in 완료(500ms) 후 2초간 보여주고 fade out 시작
      const timer = setTimeout(() => {
        setIsSixthFadingOut(true);
      }, 4500); // 500ms (fade-in duration) + 2000ms (display time)

      // fade out 시작 후 showSeventh 표시
      const seventhTimer = setTimeout(() => {
        setShowSixth(false);
        setShowSeventh(true);
      }, 5000); // 500ms (fade-in) + 4000ms (display) + 500ms (fade-out)

      return () => {
        clearTimeout(timer);
        clearTimeout(seventhTimer);
      };
    }
    return undefined;
  }, [showSixth]);

  const handleDateChange = (date: {
    year: number;
    month: number;
    day: number;
  }) => {
    setDate(date);
  };

  const handleDateNext = () => {
    // fade out 시작
    setIsDatePickerFadingOut(true);
    // 애니메이션 완료 후 화면 전환
    setTimeout(() => {
      setShowSecond(false);
      setShowThird(true);
      setIsCountUpComplete(false); // 카운트업 상태 리셋
      setCountUpKey((prev) => prev + 1); // CountUp 재시작을 위한 key 변경
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

  const handleLanyardNext = () => {
    // fade out 시작
    setIsLanyardFadingOut(true);
    // 애니메이션 완료 후 다음 화면 표시
    setTimeout(() => {
      setShowLanyard(false);
      setShowFifth(false);
      setShowSixth(true);
    }, 500); // fade-out 애니메이션 시간과 동일
  };

  // 로그인되어 있을 때만 API 사용. 비로그인(로그인 없이 둘러보기) 시 API 호출 없이 /main으로만 이동
  const handleGoToMain = async () => {
    if (!getToken()) {
      router.push("/main");
      return;
    }
    if (weddingData.date) {
      const { year, month, day } = weddingData.date;
      const weddingDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      try {
        const res = await fetchWithAuth("/plan/setting", {
          method: "POST",
          body: JSON.stringify({
            weddingDate,
            budget: Number(weddingData.budget) || 0,
            name: weddingData.name.trim(),
          }),
        });
        if (!res.ok) {
          await res.json().catch(() => ({}));
        }
      } catch {
        // POST 실패해도 /main으로 이동
      }
    }
    router.push("/main");
  };

  const handleBack = () => {
    // 일곱 번째 화면에서 여섯 번째 화면으로
    if (showSeventh) {
      setShowSeventh(false);
      setShowSixth(true);
      setIsSixthFadingOut(false);
    } else if (showSixth) {
      // 여섯 번째 화면에서 Lanyard로
      setShowSixth(false);
      setShowLanyard(true);
      setIsLanyardFadingOut(false);
      setIsSixthFadingOut(false);
    } else if (showFifth) {
      // 다섯 번째 화면에서 네 번째 화면으로
      setShowFifth(false);
      setShowFourth(true);
      setIsNameFadingOut(false);
      setIsFifthFadingOut(false);
      setShowLanyard(false);
      setIsLanyardFadingOut(false);
    } else if (showFourth) {
      // 네 번째 화면에서 세 번째 화면으로
      setShowFourth(false);
      setShowThird(true);
      setIsBudgetFadingOut(false);
      setIsCountUpComplete(false); // 카운트업 상태 리셋
      setCountUpKey((prev) => prev + 1); // CountUp 재시작을 위한 key 변경
    } else if (showThird) {
      // 세 번째 화면에서 두 번째 화면으로
      setShowThird(false);
      setShowSecond(true);
      setIsDatePickerFadingOut(false);
      setIsCountUpComplete(false); // 카운트업 상태 리셋
      setCountUpKey((prev) => prev + 1); // CountUp 재시작을 위한 key 변경
    }
  };

  return (
    <div className="flex h-[100dvh] justify-center bg-[#fcfbfc] px-0 text-stone-900 lg:bg-white lg:px-6 overflow-hidden overscroll-none">
      <KakaoLoginAlert show={showKakaoLogin} />
      <main className="relative flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-[#fcfbfc] px-6 py-8 overscroll-none grid-bg">
        {/* Decorative Blur Elements (match app/page.tsx) */}
        <div className="absolute top-[-10%] right-[-20%] w-80 h-80 bg-[#ee2b8c11] rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-20%] w-80 h-80 bg-purple-100/50 rounded-full blur-[100px] pointer-events-none"></div>

        {(showThird || showFourth || showFifth || showSixth || showSeventh) && (
          <button
            type="button"
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        {showFirst && !isFadingOut && <CelebrationEffects />}
        {showFirst && (
          <div
            className={`absolute inset-0 flex flex-1 flex-col items-center justify-center ${isFadingOut ? "animate-fade-out" : ""}`}
          >
            <LandingHero title="우리" subtitle="🎉 축하드려요 🎉" />
          </div>
        )}
        {showSecond && (
          <div
            className={`flex flex-1 flex-col items-center justify-center ${isDatePickerFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title="우리 날짜가 언제인가요"
              subtitle="우신, 우랑님. 가장 빛날 그날까지 함께해요."
              titleSize="text-3xl sm:text-4xl"
              subtitleSize="text-base sm:text-lg"
            />
            <DatePickerWheel
              initialDate={weddingData.date}
              onDateChange={handleDateChange}
              onNext={handleDateNext}
            />
          </div>
        )}
        {showThird && (
          <div
            className={`flex flex-1 flex-col items-center justify-center ${isBudgetFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title="예산도 살짝 알려주세요!"
              subtitle="마음 편하시게 제가 꼼꼼히 챙겨드릴게요."
              titleSize="text-3xl sm:text-4xl"
              subtitleSize="text-base sm:text-lg"
            />
            <div className="flex flex-col items-center flex-1 justify-center">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  {!isCountUpComplete ? (
                    <div className="px-4 py-3 text-lg font-semibold text-stone-900 bg-white rounded-lg border-2 border-stone-200 w-32 text-center flex items-center justify-center">
                      <CountUp
                        key={`countup-${countUpKey}`}
                        from={0}
                        to={1000}
                        separator=","
                        direction="up"
                        duration={3}
                        className="count-up-text"
                        startWhen={showThird && !isCountUpComplete}
                        onEnd={() => {
                          setIsCountUpComplete(true);
                          setBudget("1000");
                        }}
                      />
                    </div>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={weddingData.budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="0"
                      className="px-4 py-3 text-lg font-semibold text-stone-900 bg-white rounded-lg border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] w-32 text-center"
                    />
                  )}
                  <span className="text-lg font-semibold text-stone-700">
                    만원
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleBudgetNext}
                className="px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md"
              >
                다음
              </button>
            </div>
          </div>
        )}
        {showFourth && (
          <div
            className={`flex flex-1 flex-col items-center justify-center ${isNameFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title="혹시.. 이름도 괜찮을까요?"
              subtitle="닉네임도 괜찮아요!"
              titleSize="text-3xl sm:text-4xl"
              subtitleSize="text-base sm:text-lg"
            />
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
                type="button"
                onClick={handleNameNext}
                disabled={!weddingData.name || weddingData.name.trim() === ""}
                className="px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md disabled:bg-stone-300 disabled:cursor-not-allowed disabled:hover:bg-stone-300"
              >
                다음
              </button>
            </div>
          </div>
        )}
        {showFifth && !showLanyard && (
          <div
            className={`flex flex-1 flex-col items-center justify-center ${isFifthFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title={`${weddingData.name} 님 환영합니다~`}
              subtitle="제가 작은 선물을 준비했어요"
              titleSize="text-3xl sm:text-4xl"
              subtitleSize="text-base sm:text-lg"
            />
          </div>
        )}
        {showLanyard && (
          <div
            className={`absolute inset-0 z-40 min-h-[100dvh] ${isLanyardFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <div className="absolute inset-0 min-h-[100dvh]">
              <Lanyard position={[0, 0, 20]} gravity={[0, -40, 0]} />
            </div>
            <button
              type="button"
              onClick={handleLanyardNext}
              className="absolute top-6 right-6 z-50 px-5 py-2 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md"
            >
              다음
            </button>
          </div>
        )}
        {showSixth && (
          <div
            className={`flex flex-1 flex-col items-center justify-center ${isSixthFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title="앗.. 실망하셨다고요?"
              subtitle="열심히 준비 했지만 제 마음이 닿지 않았나봐요 ㅠ"
              titleSize="text-3xl sm:text-4xl"
              subtitleSize="text-base sm:text-lg"
            />
          </div>
        )}
        {showSeventh && (
          <div className="flex flex-1 flex-col items-center justify-center animate-fade-in">
            <LandingHero
              title="자 이제 시작해볼까요?"
              subtitle="우리식까지 든든한 플랜을 같이 짜보아요"
              titleSize="text-3xl sm:text-4xl"
              subtitleSize="text-base sm:text-lg"
            />
            <button
              type="button"
              onClick={handleGoToMain}
              className="px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md"
            >
              계획 짜러 가기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SettingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] justify-center bg-[#fcfbfc] px-0 lg:bg-white lg:px-6 overflow-hidden">
          <div className="h-full w-full max-w-[500px] bg-[#fcfbfc] grid-bg" />
        </div>
      }
    >
      <SettingPageContent />
    </Suspense>
  );
}
