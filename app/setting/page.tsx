"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Heart, Plus } from "lucide-react";
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
import { useSpouseInvite } from "../hooks/useSpouseInvite";
import {
  PRIVACY_CONTENT,
  LOCATION_CONTENT,
  THIRD_PARTY_CONTENT,
  MARKETING_CONTENT,
} from "@/lib/legal";
import CountUp from "../../components/CountUp";

import { track } from "@/lib/analytics";
/**
 * 좌측 진행 패널의 단계 목록.
 * 몇 개나 더 묻는지 처음부터 보여야 온보딩에서 덜 이탈한다.
 * 축하·환영·출입증(Lanyard)은 전체 화면 연출이라 단계로 세지 않는다.
 * (패널만 안 붙을 뿐, 그 화면들도 폭은 전부 쓴다)
 *
 * **게스트는 `함께할 사람` 단계가 없다.** 방이 없으면 공유 코드도 없어서
 * 보낼 링크 자체가 만들어지지 않는다. 못 쓰는 단계를 보여 주는 건
 * 안 보여 주는 것보다 나쁘다.
 */
const ONBOARDING_STEPS_GUEST = ["결혼 날짜", "예산", "이름", "약관 동의"];
const ONBOARDING_STEPS_MEMBER = [
  "결혼 날짜",
  "예산",
  "이름",
  "약관 동의",
  "함께할 사람",
];

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
  /**
   * 초대 단계. **약관 동의 + 저장(`POST /plan/setting`) 다음**에 온다.
   * 그 앞에 두면 두 가지가 깨진다 —
   *   1. 날짜·예산·이름이 아직 저장 전이라 초대받은 사람이 **빈 플랜**에 들어온다
   *      (방과 `roomShareCode` 는 카카오 로그인 때 이미 만들어져 링크는 유효하다.
   *       비어 있는 건 방이 아니라 내용이다)
   *   2. 필수·제3자 제공 동의를 받기 전에 남에게 접근 권한을 주는 링크를 보낸다
   * 로그인 사용자에게만 뜬다.
   */
  const [showSixth, setShowSixth] = useState(false);
  const [showSeventh, setShowSeventh] = useState(false);
  /** 플랜 설정 저장 실패 안내 */
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDatePickerFadingOut, setIsDatePickerFadingOut] = useState(false);
  const [isBudgetFadingOut, setIsBudgetFadingOut] = useState(false);
  const [isNameFadingOut, setIsNameFadingOut] = useState(false);
  const [isNameShaking, setIsNameShaking] = useState(false);
  const [isFifthFadingOut, setIsFifthFadingOut] = useState(false);
  const [isSixthFadingOut, setIsSixthFadingOut] = useState(false);
  /**
   * 초대 단계를 낼 수 있는지. 게스트는 방이 없어 공유 코드를 못 만든다.
   * 하이드레이션 직후 서버 렌더와 어긋나지 않도록 effect 에서만 켠다.
   */
  const [canInvite, setCanInvite] = useState(false);
  /** 초대 단계에서 고른 값. null 이면 아직 안 고름 */
  const [inviteChoice, setInviteChoice] = useState<"invite" | "solo" | null>(
    null,
  );
  /** 초대장을 실제로 보냈는지(공유 시트 완료 또는 링크 복사) */
  const [inviteSent, setInviteSent] = useState<"shared" | "copied" | null>(
    null,
  );
  const [isCountUpComplete, setIsCountUpComplete] = useState(false);
  const [countUpKey, setCountUpKey] = useState(0);
  const [showLanyard, setShowLanyard] = useState(false);
  const [isLanyardFadingOut, setIsLanyardFadingOut] = useState(false);
  const [userCheckDone, setUserCheckDone] = useState(false);
  const [nextStep, setNextStep] = useState<"second" | "third" | "fourth">(
    "second",
  );

  /** 초대 단계에 들어갈 때만 공유 코드를 받아 온다 */
  const {
    loading: inviteLinkLoading,
    error: inviteError,
    setError: setInviteError,
    invite,
  } = useSpouseInvite({ enabled: showSixth, from: "onboarding" });

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

    setCanInvite(true);

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

  /** 초대 단계가 마지막이다. 보냈든 건너뛰었든 홈으로 나간다 */
  const handleInviteNext = () => {
    setIsSixthFadingOut(true);
    setTimeout(() => router.push("/main"), 500);
  };

  const handleSendInvite = async () => {
    const result = await invite("spouse");
    if (result === "shared" || result === "copied") {
      setInviteSent(result);
    }
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

        track("onboarding_complete");
      } catch (err) {
        console.error("플랜 설정 저장 실패:", err);
        setSaveError(
          "설정을 저장하지 못했습니다. 네트워크 확인 후 다시 시도해 주세요.",
        );
        return;
      }
    }
    /*
      저장이 끝난 다음에야 초대 단계를 연다. 이 순서가 뒤집히면 초대받은
      사람이 날짜·예산·이름이 비어 있는 플랜에 들어오고, 필수·제3자 제공
      동의 전에 남에게 접근 권한을 주는 링크가 나간다.
    */
    if (canInvite) {
      setShowSeventh(false);
      setShowSixth(true);
      return;
    }
    router.push("/main");
  };

  const onboardingSteps = canInvite
    ? ONBOARDING_STEPS_MEMBER
    : ONBOARDING_STEPS_GUEST;

  /** 좌측 패널에 표시할 현재 단계. 0이면 연출 화면이라 패널을 내지 않는다 */
  const stepIndex = showSecond
    ? 1
    : showThird
      ? 2
      : showFourth
        ? 3
        : showSeventh
          ? 4
          : showSixth
            ? 5
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
            {onboardingSteps.length}가지만 알려 주시면 됩니다. 1분이면 끝나요.
          </p>
          <ol className="grid gap-0.5" aria-label="온보딩 단계">
            {onboardingSteps.map((label, i) => {
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
                  width: `${(stepIndex / onboardingSteps.length) * 100}%`,
                }}
              />
            </div>
            <p className="mt-2.5 text-xs text-gray-400">
              {stepIndex} / {onboardingSteps.length} 단계
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
        {/*
          초대 단계. 온보딩은 이미 "한 번에 하나씩 묻는" 연출이라, 여기에
          한 칸을 더하면 초대가 부탁이 아니라 절차로 읽힌다. 다만 반드시
          빠져나갈 길("나중에 할게요")을 함께 둔다 — 막으면 이탈한다.
        */}
        {showSixth && (
          <div
            className={`flex flex-1 flex-col items-center pt-20 pb-12 lg:justify-center lg:pt-0 lg:pb-0 ${isSixthFadingOut ? "animate-fade-out" : "animate-fade-in"}`}
          >
            <LandingHero
              title="누구와 함께 준비하세요?"
              subtitle="신랑·신부는 일정과 예산을 같이 고칠 수 있어요"
              titleSize="text-2xl sm:text-4xl"
              subtitleSize="text-sm sm:text-lg"
              useUserFont={false}
            />
            <div className="flex flex-1 lg:hidden" />
            <div
              className="mb-5 grid w-full max-w-[340px] gap-2.5 lg:mt-7"
              role="radiogroup"
              aria-label="함께 준비할 사람"
            >
              <button
                type="button"
                role="radio"
                aria-checked={inviteChoice === "invite"}
                onClick={() => {
                  setInviteChoice("invite");
                  setInviteError(null);
                }}
                className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-left transition-colors duration-200 ${
                  inviteChoice === "invite"
                    ? "border-[#ee2b8c] bg-[#fff7fb]"
                    : "border-stone-200 hover:border-[#FFAAB8]"
                }`}
              >
                <span
                  className={`grid h-10 w-10 flex-none place-items-center rounded-full transition-colors duration-200 ${
                    inviteChoice === "invite"
                      ? "bg-[#ee2b8c] text-white"
                      : "bg-[#ffeaf3] text-[#ee2b8c]"
                  }`}
                  aria-hidden
                >
                  <Heart className="h-[18px] w-[18px] fill-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-stone-900">
                    신랑 · 신부를 부를게요
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-stone-500 break-keep">
                    지금 초대장을 보냅니다
                  </span>
                </span>
                {inviteChoice === "invite" && (
                  <Check
                    className="h-5 w-5 flex-none text-[#ee2b8c]"
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={inviteChoice === "solo"}
                onClick={() => {
                  setInviteChoice("solo");
                  setInviteError(null);
                }}
                className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-left transition-colors duration-200 ${
                  inviteChoice === "solo"
                    ? "border-[#ee2b8c] bg-[#fff7fb]"
                    : "border-stone-200 hover:border-[#FFAAB8]"
                }`}
              >
                <span
                  className={`grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-dashed transition-colors duration-200 ${
                    inviteChoice === "solo"
                      ? "border-[#ee2b8c] text-[#ee2b8c]"
                      : "border-stone-300 text-stone-400"
                  }`}
                  aria-hidden
                >
                  <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-stone-900">
                    혼자 먼저 둘러볼게요
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-stone-500 break-keep">
                    나중에 홈에서 언제든 부를 수 있어요
                  </span>
                </span>
                {inviteChoice === "solo" && (
                  <Check
                    className="h-5 w-5 flex-none text-[#ee2b8c]"
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
              </button>
            </div>

            {/* 보냄·실패 안내. 자리를 늘 잡아 두면 버튼이 위아래로 튀지 않는다 */}
            <p
              role="status"
              className={`mb-3 min-h-[18px] max-w-[340px] px-2 text-center text-xs leading-relaxed break-keep ${
                inviteError ? "text-red-500" : "text-[#ee2b8c]"
              }`}
            >
              {inviteError ??
                (inviteSent === "shared"
                  ? "초대장을 보냈어요. 상대가 열면 신랑·신부로 들어옵니다."
                  : inviteSent === "copied"
                    ? "링크를 복사했어요. 붙여 넣어 보내 주세요."
                    : "")}
            </p>

            <button
              type="button"
              onClick={
                inviteChoice === "invite" && !inviteSent
                  ? handleSendInvite
                  : handleInviteNext
              }
              disabled={
                inviteChoice === null ||
                (inviteChoice === "invite" && !inviteSent && inviteLinkLoading)
              }
              className="w-full max-w-[320px] px-8 py-3 bg-[#FFAAB8] text-white text-lg font-semibold rounded-lg hover:bg-[#FF9AA8] transition-colors duration-200 shadow-md disabled:bg-stone-300 disabled:cursor-not-allowed disabled:hover:bg-stone-300"
            >
              {inviteChoice === "invite" && !inviteSent
                ? inviteLinkLoading
                  ? "준비 중..."
                  : "초대장 보내기"
                : "계획 짜러 가기"}
            </button>
            <button
              type="button"
              onClick={handleInviteNext}
              className="mt-3 px-3 py-1 text-sm text-stone-400 underline underline-offset-4 transition-colors duration-200 hover:text-stone-600"
            >
              나중에 할게요
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
                {/* 회원은 뒤에 초대 단계가 하나 더 남아 있다 */}
                {canInvite ? "다음" : "계획 짜러 가기"}
              </button>
            </div>

            <TermsModal
              isOpen={showPrivacyModal}
              onClose={() => setShowPrivacyModal(false)}
              title="개인정보 수집 및 이용 동의"
              content={PRIVACY_CONTENT}
            />

            <TermsModal
              isOpen={showLocationModal}
              onClose={() => setShowLocationModal(false)}
              title="위치정보 수집 및 이용 동의"
              content={LOCATION_CONTENT}
            />

            <TermsModal
              isOpen={showThirdPartyModal}
              onClose={() => setShowThirdPartyModal(false)}
              title="개인정보 제3자 제공 동의"
              content={THIRD_PARTY_CONTENT}
            />

            <TermsModal
              isOpen={showMarketingModal}
              onClose={() => setShowMarketingModal(false)}
              title="마케팅 목적 이용 동의"
              content={MARKETING_CONTENT}
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
