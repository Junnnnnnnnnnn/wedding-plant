"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import KakaoLoginAlert from "../components/KakaoLoginAlert";
import CustomAlertModal from "../components/CustomAlertModal";
import LandingHero from "../components/LandingHero";
import TermsModal from "../components/TermsModal";
import CelebrationEffects from "../components/CelebrationEffects";
import DatePickerWheel from "../components/DatePickerWheel";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import {
  getToken,
  HAS_COMPLETED_GUEST_SETTING_KEY,
  isPlanDataComplete,
  setGuestAgreement,
} from "@/lib/api";
import { getKstDateString } from "@/lib/utils";
import CountUp from "../../components/CountUp";

/**
 * 좌측 진행 패널의 단계 목록.
 * 몇 개나 더 묻는지 처음부터 보여야 온보딩에서 덜 이탈한다.
 * 축하·환영·출입증(Lanyard)은 전체 화면 연출이라 단계로 세지 않는다.
 * (패널만 안 붙을 뿐, 그 화면들도 폭은 전부 쓴다)
 */
const ONBOARDING_STEPS = ["결혼 날짜", "예산", "이름", "약관 동의"];

// 3D(WebGL)는 클라이언트에서만 로드해 Context Lost·엑스박스 방지
const Lanyard = dynamic(() => import("../../components/Lanyard"), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#fcfbfc] grid-bg">
      {/* Decorative Blur Elements (match app/page.tsx) */}
      <div className="absolute top-[-10%] right-[-20%] w-80 h-80 bg-[#ee2b8c11] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-20%] w-80 h-80 bg-purple-100/50 rounded-full blur-[100px] pointer-events-none" />

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
  const [showSeventh, setShowSeventh] = useState(false);
  /** 플랜 설정 저장 실패 안내 */
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDatePickerFadingOut, setIsDatePickerFadingOut] = useState(false);
  const [isBudgetFadingOut, setIsBudgetFadingOut] = useState(false);
  const [isNameFadingOut, setIsNameFadingOut] = useState(false);
  const [isNameShaking, setIsNameShaking] = useState(false);
  const [isFifthFadingOut, setIsFifthFadingOut] = useState(false);
  const [isCountUpComplete, setIsCountUpComplete] = useState(false);
  const [countUpKey, setCountUpKey] = useState(0);
  const [showLanyard, setShowLanyard] = useState(false);
  const [isLanyardFadingOut, setIsLanyardFadingOut] = useState(false);
  const [userCheckDone, setUserCheckDone] = useState(false);
  const [nextStep, setNextStep] = useState<"second" | "third" | "fourth">(
    "second",
  );

  // 약관 동의 상태
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeLocation, setAgreeLocation] = useState(false);
  const [agreeThirdParty, setAgreeThirdParty] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  // 약관 모달 상태
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showThirdPartyModal, setShowThirdPartyModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);

  const isAllRequiredAgreed = agreePrivacy && agreeLocation && agreeThirdParty;
  const isAllAgreed = isAllRequiredAgreed && agreeMarketing;

  const handleAgreeAll = () => {
    const newValue = !isAllAgreed;
    setAgreePrivacy(newValue);
    setAgreeLocation(newValue);
    setAgreeThirdParty(newValue);
    setAgreeMarketing(newValue);
  };

  // 비로그인 + 이미 setting 완료(플래그 있음) + weddingDate 등 데이터 다 찼으면 → main으로 리다이렉트
  // (다시 setting 접근 시 차단. 플로우 중에는 플래그가 없으므로 리다이렉트 안 함)
  useEffect(() => {
    const token = getToken();
    if (!token) {
      const hasCompleted =
        typeof window !== "undefined" &&
        sessionStorage.getItem(HAS_COMPLETED_GUEST_SETTING_KEY) === "1";
      if (!hasCompleted) return;

      const d = weddingData.date;
      const hasDate =
        d &&
        typeof d.year === "number" &&
        typeof d.month === "number" &&
        typeof d.day === "number";
      const hasBudget =
        weddingData.budget != null && String(weddingData.budget).trim() !== "";
      const hasName =
        typeof weddingData.name === "string" && weddingData.name.trim() !== "";
      if (hasDate && hasBudget && hasName) {
        router.replace("/main");
      }
    }
  }, [weddingData.date, weddingData.budget, weddingData.name, router]);

  // 토큰 있으면 GET /plan/user 조회. weddingDate·budget 없으면 setting 플로우 진행
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUserCheckDone(true);
      return;
    }

    const check = async () => {
      try {
        const res = await fetchWithAuth("/plan/user");
        const json = (await res.json()) as {
          result?: boolean;
          data?: {
            weddingDate?: string | null;
            budget?: number | string | null;
            name?: string | null;
          };
        };
        if (json.result !== true || !json.data) {
          setUserCheckDone(true);
          return;
        }
        const d = json.data;

        if (isPlanDataComplete(d)) {
          router.replace("/main");
          return;
        }

        // prefill
        if (d.name) setName(d.name);
        if (d.budget != null) setBudget(String(d.budget));
        if (d.weddingDate) {
          const parts = d.weddingDate.split("-").map(Number);
          if (parts.length === 3 && !parts.some(Number.isNaN)) {
            setDate({ year: parts[0], month: parts[1], day: parts[2] });
          }
        }

        // weddingDate·budget 없으면 setting 플로우 진행, 처음에 누락된 단계부터
        const hasDate =
          typeof d.weddingDate === "string" && d.weddingDate.trim() !== "";
        const hasBudget =
          d.budget != null &&
          (typeof d.budget === "number" ||
            (typeof d.budget === "string" &&
              d.budget.toString().trim() !== ""));

        if (!hasDate) {
          setNextStep("second");
        } else if (!hasBudget) {
          setNextStep("third");
          setIsCountUpComplete(true);
          if (d.budget != null) setBudget(String(d.budget));
        } else {
          setNextStep("fourth");
        }
      } catch {
        // fetch 실패 시 날짜 단계부터 진행
        setNextStep("second");
      } finally {
        setUserCheckDone(true);
      }
    };

    check();
  }, [fetchWithAuth, router, setName, setBudget, setDate]);

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
    // 첫 번째 축하 메시지 3초 표시 후 → 다음 단계로 전환
    if (!userCheckDone) return undefined;

    const timer1 = setTimeout(() => setIsFadingOut(true), 3000);
    const timer2 = setTimeout(() => {
      setShowFirst(false);
      if (nextStep === "third") {
        setShowThird(true);
      } else if (nextStep === "fourth") {
        setShowFourth(true);
      } else {
        setShowSecond(true);
      }
    }, 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [userCheckDone, nextStep]);

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
      setShowSeventh(true);
    }, 500); // fade-out 애니메이션 시간과 동일
  };

  // 로그인되어 있을 때만 API 사용. 비로그인(로그인 없이 둘러보기) 시 API 호출 없이 /main으로만 이동
  const handleGoToMain = async () => {
    if (!getToken()) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(HAS_COMPLETED_GUEST_SETTING_KEY, "1");
        const agreementDate = getKstDateString();
        setGuestAgreement({
          requiredAgreementDate: agreementDate,
          ...(agreeMarketing && { adAgreementDate: agreementDate }),
        });
      }
      router.push("/main");
      return;
    }
    if (weddingData.date) {
      const { year, month, day } = weddingData.date;
      const weddingDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const agreementDate = getKstDateString(); // 한국(KST) 기준 YYYY-MM-DD
      try {
        const res = await fetchWithAuth("/plan/setting", {
          method: "POST",
          body: JSON.stringify({
            weddingDate,
            budget: Number(weddingData.budget) || 0,
            name: weddingData.name.trim(),
            requiredAgreementDate: agreementDate, // 필수: 동의 시 항상 전송
            ...(agreeMarketing && { adAgreementDate: agreementDate }), // 선택: 마케팅 동의 시에만 전송
          }),
        });
        if (!res.ok) {
          // 예전에는 파싱만 하고 그대로 /main 으로 갔다. 사용자는 온보딩을
          // 마쳤다고 믿지만 서버에는 아무것도 저장되지 않은 상태였다.
          const body = await res.json().catch(() => null);
          console.error("플랜 설정 저장 실패:", res.status, body);
          setSaveError(
            "설정을 저장하지 못했습니다. 네트워크 확인 후 다시 시도해 주세요.",
          );
          return;
        }
      } catch (err) {
        console.error("플랜 설정 저장 실패:", err);
        setSaveError(
          "설정을 저장하지 못했습니다. 네트워크 확인 후 다시 시도해 주세요.",
        );
        return;
      }
    }
    router.push("/main");
  };

  /** 좌측 패널에 표시할 현재 단계(1~4). 0이면 연출 화면이라 패널을 내지 않는다 */
  const stepIndex = showSecond
    ? 1
    : showThird
      ? 2
      : showFourth
        ? 3
        : showSeventh
          ? 4
          : 0;
  /** lg 이상에서만 좌우 분할. 폰에서는 예전 그대로 한 화면에 하나씩 */
  const isSplitStep = stepIndex > 0;

  const handleBack = () => {
    // 일곱 번째 화면에서 Lanyard로
    if (showSeventh) {
      setShowSeventh(false);
      setShowLanyard(true);
      setIsLanyardFadingOut(false);
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
    <div className="flex h-[100dvh] justify-center bg-[#fcfbfc] px-0 text-stone-900 overflow-hidden overscroll-none lg:px-0">
      <KakaoLoginAlert show={showKakaoLogin} />
      <CustomAlertModal
        isOpen={saveError !== null}
        message={saveError ?? ""}
        type="error"
        onClose={() => setSaveError(null)}
      />
      {isSplitStep && (
        <aside className="hidden w-[340px] flex-none flex-col border-r border-[#f4eff2] bg-white px-7 py-8 lg:flex">
          <span className="flex items-center gap-2.5 text-sm font-bold text-stone-900">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[#ee2b8c] text-[12px] font-bold text-white">
              WP
            </span>
            웨딩 플랜트
          </span>
          <p className="mt-[30px] mb-1.5 text-[19px] font-bold leading-[1.45] tracking-[-0.02em] text-stone-900">
            결혼 준비를
            <br />
            같이 시작해요
          </p>
          <p className="mb-[22px] text-[12.5px] leading-relaxed text-[#7a6c74]">
            네 가지만 알려 주시면 됩니다. 1분이면 끝나요.
          </p>
          <ol className="grid gap-0.5" aria-label="온보딩 단계">
            {ONBOARDING_STEPS.map((label, i) => {
              const n = i + 1;
              const isCurrent = n === stepIndex;
              const isDone = n < stepIndex;
              return (
                <li
                  key={label}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] ${
                    isCurrent
                      ? "bg-[#fff2f6] font-bold text-[#ee2b8c]"
                      : isDone
                        ? "text-[#7a6c74]"
                        : "text-gray-400"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold ${
                      isCurrent
                        ? "bg-[#ee2b8c] text-white"
                        : isDone
                          ? "bg-[#ffd9e8] text-[#ee2b8c]"
                          : "bg-[#f1eaee] text-[#b7abb2]"
                    }`}
                  >
                    {n}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
          <div className="mt-auto">
            <div className="h-1 overflow-hidden rounded-full bg-[#f1eaee]">
              <span
                className="block h-full rounded-full bg-[#ee2b8c] transition-[width] duration-500 ease-out"
                style={{
                  width: `${(stepIndex / ONBOARDING_STEPS.length) * 100}%`,
                }}
              />
            </div>
            <p className="mt-2.5 text-xs text-gray-400">
              {stepIndex} / {ONBOARDING_STEPS.length} 단계
            </p>
          </div>
        </aside>
      )}
      {/*
       * lg 이상에서는 남은 폭을 전부 쓴다. 연출 화면(축하·환영·출입증)은
       * absolute inset-0 로 펼쳐지는데, 여기를 600px 로 묶어 두면 전체 화면
       * 연출이 아니라 넓은 모니터 한가운데 600px 띠가 된다.
       */}
      <main className="relative flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-[#fcfbfc] px-4 sm:px-6 py-8 overscroll-none grid-bg lg:max-w-none lg:flex-1 lg:px-10 lg:py-12">
        {/* Decorative Blur Elements (match app/page.tsx) */}
        <div className="absolute top-[-10%] right-[-20%] w-80 h-80 bg-[#ee2b8c11] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-20%] w-80 h-80 bg-purple-100/50 rounded-full blur-[100px] pointer-events-none" />

        {(showThird || showFourth || showFifth || showSeventh) && (
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
            className={`absolute inset-0 flex flex-col items-center justify-center ${isFadingOut ? "animate-fade-out" : ""}`}
          >
            <LandingHero
              title="결혼"
              subtitle="🎉 축하드려요 🎉"
              useUserFont={false}
            />
          </div>
        )}
        {showSecond && (
          <div
            className={`flex flex-1 flex-col items-center pt-20 pb-12 lg:justify-center lg:pt-0 lg:pb-0 ${isDatePickerFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title="결혼 날짜가 언제인가요"
              subtitle="예신, 예랑님. 가장 빛날 그날까지 함께해요."
              titleSize="text-2xl sm:text-4xl"
              subtitleSize="text-sm sm:text-lg"
              useUserFont={false}
            />
            <div className="flex flex-1 flex-col items-center justify-center lg:my-9 lg:flex-none">
              <DatePickerWheel
                initialDate={weddingData.date}
                onDateChange={handleDateChange}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                handleDateChange(
                  weddingData.date || {
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    day: new Date().getDate(),
                  },
                );
                handleDateNext();
              }}
              className="w-full max-w-[320px] px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md"
            >
              다음
            </button>
          </div>
        )}
        {showThird && (
          <div
            className={`flex flex-1 flex-col items-center pt-20 pb-12 lg:justify-center lg:pt-0 lg:pb-0 ${isBudgetFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title="예산도 살짝 알려주세요!"
              subtitle="마음 편하시게 제가 꼼꼼히 챙겨드릴게요."
              titleSize="text-2xl sm:text-4xl"
              subtitleSize="text-sm sm:text-lg"
              useUserFont={false}
            />
            <div className="flex flex-1 lg:hidden" />
            <div className="flex flex-col items-center mb-6 lg:mt-7">
              <div className="flex items-center justify-center gap-4">
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
                      className="font-user-content px-4 py-3 text-lg font-semibold text-stone-900 bg-white rounded-lg border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] w-32 text-center"
                    />
                  )}
                  <span className="text-lg font-semibold text-stone-700">
                    만원
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleBudgetNext}
              className="w-full max-w-[320px] px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md"
            >
              다음
            </button>
          </div>
        )}
        {showFourth && (
          <div
            className={`flex flex-1 flex-col items-center pt-20 pb-12 lg:justify-center lg:pt-0 lg:pb-0 ${isNameFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title="이름도 괜찮을까요?"
              subtitle="닉네임도 괜찮아요!"
              titleSize="text-2xl sm:text-4xl"
              subtitleSize="text-sm sm:text-lg"
              useUserFont={false}
            />
            <div className="flex flex-1 lg:hidden" />
            <div className="flex flex-col items-center mb-6 lg:mt-7">
              <p className="text-sm text-stone-500 mb-2">최대 6 글자</p>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="text"
                  value={weddingData.name}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue.length > 6) {
                      // 6글자 초과 시 흔들림 애니메이션
                      setIsNameShaking(true);
                      setTimeout(() => setIsNameShaking(false), 400);
                      // 6글자까지만 저장
                      setName(newValue.slice(0, 6));
                    } else {
                      setName(newValue);
                    }
                  }}
                  placeholder="이름 또는 닉네임"
                  maxLength={6}
                  className={`font-user-content px-4 py-3 text-lg font-semibold text-stone-900 bg-white rounded-lg border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] w-full max-w-[240px] text-center ${isNameShaking ? "animate-shake" : ""}`}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleNameNext}
              disabled={!weddingData.name || weddingData.name.trim() === ""}
              className="w-full max-w-[320px] px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md disabled:bg-stone-300 disabled:cursor-not-allowed disabled:hover:bg-stone-300"
            >
              다음
            </button>
          </div>
        )}
        {showFifth && !showLanyard && (
          <div
            className={`flex flex-1 flex-col items-center justify-center ${isFifthFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title={`${weddingData.name} 님 환영합니다`}
              subtitle="출입증을 발급해 드렸어요!"
              titleSize="text-2xl sm:text-4xl"
              subtitleSize="text-sm sm:text-lg"
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

        {showSeventh && (
          <div className="flex flex-1 flex-col items-center pt-10 pb-12 lg:pt-14 animate-fade-in overflow-y-auto w-full">
            <LandingHero
              title="자 이제 시작해볼까요?"
              subtitle="결혼식까지 든든한 플랜을 같이 짜보아요"
              useUserFont={false}
              titleSize="text-2xl sm:text-4xl"
              subtitleSize="text-sm sm:text-lg"
            />
            {/*
             * 상자 비율을 카드(1.8×2.53 ≈ 0.71)에 맞춘다. 예전의 200×40vh 는
             * 화면이 높을수록 세로로 길어져 카드 좌우가 잘렸다.
             * 카메라 z 는 카드가 상자를 알맞게 채우는 거리다(전체 화면은 25).
             */}
            <div className="lanyard-preview relative flex flex-shrink-0 w-[240px] h-[320px] lg:w-[260px] lg:h-[350px] items-center justify-center overflow-hidden rounded-xl mb-4 mt-2">
              <Lanyard position={[0, 0, 10]} gravity={[0, -40, 0]} />
            </div>

            {/* 개인정보 및 이용약관 동의 레이아웃 */}
            <div className="w-full max-w-[320px] mb-8 flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer mb-1">
                <div
                  className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                    isAllAgreed
                      ? "bg-[#FFAAB8] border-[#FFAAB8]"
                      : "bg-white border-stone-300"
                  }`}
                >
                  <Check
                    strokeWidth={3}
                    className={`w-3 h-3 ${isAllAgreed ? "text-white" : "text-stone-300"}`}
                  />
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={isAllAgreed}
                  onChange={handleAgreeAll}
                />
                <span className="text-sm font-semibold text-stone-800">
                  전체 동의합니다.
                </span>
              </label>

              <hr className="border-stone-200" />

              <div className="flex flex-col gap-3.5 mt-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                        agreePrivacy
                          ? "bg-[#FFAAB8] border-[#FFAAB8]"
                          : "bg-white border-stone-300"
                      }`}
                    >
                      <Check
                        strokeWidth={3}
                        className={`w-2.5 h-2.5 ${agreePrivacy ? "text-white" : "text-stone-300"}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={agreePrivacy}
                      onChange={() => setAgreePrivacy(!agreePrivacy)}
                    />
                    <span className="text-xs text-stone-600">
                      (필수) 개인정보 수집 및 이용 동의
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-[10px] text-stone-400 underline"
                  >
                    보기
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                        agreeLocation
                          ? "bg-[#FFAAB8] border-[#FFAAB8]"
                          : "bg-white border-stone-300"
                      }`}
                    >
                      <Check
                        strokeWidth={3}
                        className={`w-2.5 h-2.5 ${agreeLocation ? "text-white" : "text-stone-300"}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={agreeLocation}
                      onChange={() => setAgreeLocation(!agreeLocation)}
                    />
                    <span className="text-xs text-stone-600">
                      (필수) 위치정보 수집 및 이용 동의
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="text-[10px] text-stone-400 underline"
                  >
                    보기
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                        agreeThirdParty
                          ? "bg-[#FFAAB8] border-[#FFAAB8]"
                          : "bg-white border-stone-300"
                      }`}
                    >
                      <Check
                        strokeWidth={3}
                        className={`w-2.5 h-2.5 ${agreeThirdParty ? "text-white" : "text-stone-300"}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={agreeThirdParty}
                      onChange={() => setAgreeThirdParty(!agreeThirdParty)}
                    />
                    <span className="text-xs text-stone-600">
                      (필수) 개인정보 제3자 제공 동의
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowThirdPartyModal(true)}
                    className="text-[10px] text-stone-400 underline"
                  >
                    보기
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                        agreeMarketing
                          ? "bg-[#FFAAB8] border-[#FFAAB8]"
                          : "bg-white border-stone-300"
                      }`}
                    >
                      <Check
                        strokeWidth={3}
                        className={`w-2.5 h-2.5 ${agreeMarketing ? "text-white" : "text-stone-300"}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={agreeMarketing}
                      onChange={() => setAgreeMarketing(!agreeMarketing)}
                    />
                    <span className="text-xs text-stone-600">
                      (선택) 마케팅 목적 이용 동의
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMarketingModal(true)}
                    className="text-[10px] text-stone-400 underline"
                  >
                    보기
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full flex justify-center">
              <button
                type="button"
                onClick={handleGoToMain}
                disabled={!isAllRequiredAgreed}
                className="w-full max-w-[320px] px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md disabled:bg-stone-300 disabled:cursor-not-allowed disabled:hover:bg-stone-300"
              >
                계획 짜러 가기
              </button>
            </div>

            <TermsModal
              isOpen={showPrivacyModal}
              onClose={() => setShowPrivacyModal(false)}
              title="개인정보 수집 및 이용 동의"
              content={`본 서비스는 개인정보보호법 제15조에 따라 아래와 같이 개인정보를 수집 및 이용합니다.\n\n1. 수집 목적\n- 회원 가입 및 서비스 제공\n- 고객 상담 및 불만 처리\n- 서비스 이용 기록 분석 및 개선\n\n2. 수집 항목\n- (필수) 이름, 이메일 주소, 프로필 이미지\n- (필수) 소셜 로그인 식별자 (카카오톡, 구글, 네이버 등)\n\n3. 보유 및 이용 기간\n- 회원 탈퇴 시 지체 없이 파기\n- 단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 법령에서 정한 기간 동안 보존합니다.\n\n4. 동의 거부 권리\n- 귀하는 개인정보 수집 및 이용에 대해 동의를 거부할 권리가 있습니다. 단, 필수 항목 동의 거부 시 서비스 이용이 제한될 수 있습니다.`}
            />

            <TermsModal
              isOpen={showLocationModal}
              onClose={() => setShowLocationModal(false)}
              title="위치정보 수집 및 이용 동의"
              content={`본 서비스는 위치정보의 보호 및 이용 등에 관한 법률 제15조에 따라 아래와 같이 위치정보를 수집 및 이용합니다.\n\n1. 수집 목적\n- 예식장 위치 안내 및 하객 길찾기 서비스 제공\n- 위치 기반 웨딩 일정 관리 및 알림 기능 제공\n\n2. 수집 항목\n- (필수) GPS 좌표 (위도, 경도) 및 장소 정보\n\n3. 보유 및 이용 기간\n- 서비스 제공 목적 달성 시 또는 회원 탈퇴 시 지체 없이 파기합니다.\n\n4. 동의 거부 권리\n- 귀하는 위치정보 수집 및 이용에 대해 동의를 거부할 권리가 있습니다. 단, 동의 거부 시 위치 기반 기능(길안내 등) 이용이 제한됩니다.`}
            />

            <TermsModal
              isOpen={showThirdPartyModal}
              onClose={() => setShowThirdPartyModal(false)}
              title="개인정보 제3자 제공 동의"
              content={`본 서비스는 개인정보보호법 제17조에 따라 아래와 같이 개인정보를 제3자에게 제공합니다.\n\n1. 제공받는 자\n- 동일한 웨딩 플랜 룸(공유 룸)에 참여 및 초대된 다른 사용자\n\n2. 제공 목적\n- 일정, 예산, 채팅 등 웨딩 준비 데이터의 공동 관리 및 원활한 커뮤니케이션\n\n3. 제공 항목\n- (필수) 이름, 프로필 이미지, 채팅 내역, 일정 및 예산 입력 정보\n\n4. 보유 및 이용 기간\n- 웨딩 플랜 룸 참여 기간 동안 유지되며, 퇴장 시 또는 회원 탈퇴 시 파기됩니다.\n\n5. 동의 거부 권리\n- 귀하는 개인정보 제3자 제공에 대해 동의를 거부할 권리가 있습니다. 단, 동의 거부 시 플랜 공유 룸 기능 및 협업 서비스 이용이 불가능합니다.`}
            />

            <TermsModal
              isOpen={showMarketingModal}
              onClose={() => setShowMarketingModal(false)}
              title="마케팅 목적 이용 동의"
              content={`1. 수집 및 이용 목적\n- 신규 서비스 및 업데이트 안내\n- 이벤트, 프로모션 알림 및 혜택 제공\n- 맞춤형 웨딩 정보 및 광고 전송 (앱 푸시, 이메일, 알림톡 등)\n\n2. 수집 항목\n- (선택) 이름, 이메일 주소, 서비스 이용 기록\n\n3. 보유 및 이용 기간\n- 회원 탈퇴 시 또는 마케팅 목적 이용 동의 철회 시까지 보관 및 이용됩니다.\n\n4. 동의 거부 권리\n- 귀하는 마케팅 목적 이용에 대한 동의를 선택적으로 거부하실 수 있습니다. 동의를 거부하셔도 웨딩 플랜트의 기본 서비스는 정상적으로 이용하실 수 있습니다.`}
            />
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
        <div className="flex h-[100dvh] justify-center bg-[#fcfbfc] px-0 overflow-hidden">
          <div className="h-full w-full max-w-[500px] bg-[#fcfbfc] grid-bg lg:max-w-none lg:flex-1" />
        </div>
      }
    >
      <SettingPageContent />
    </Suspense>
  );
}
