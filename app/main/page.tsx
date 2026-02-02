"use client";

import {
  Calendar,
  Check,
  CircleDollarSign,
  CirclePlus,
  User,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import CountUp from "@/components/CountUp";
import BottomTabBar from "../components/BottomTabBar";
import KakaoLoginAlert from "../components/KakaoLoginAlert";
import ProfileEditModal from "../components/ProfileEditModal";
import LoginRequiredModal from "../components/LoginRequiredModal";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import { getToken, clearAllStoredData } from "@/lib/api";

/** API weddingDate "YYYY-MM-DD" → { year, month, day } */
function parseWeddingDate(
  weddingDate?: string,
): { year: number; month: number; day: number } | undefined {
  if (!weddingDate || typeof weddingDate !== "string") return undefined;
  const [y, m, d] = weddingDate.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return undefined;
  return { year: y, month: m, day: d };
}

// 결혼식 날짜 포맷 (YYYY년 MM월 DD일 (요일))
function formatWeddingDate(date?: {
  year: number;
  month: number;
  day: number;
}) {
  if (!date) return null;
  const d = new Date(date.year, date.month - 1, date.day);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[d.getDay()];
  return `${date.year}년 ${date.month}월 ${date.day}일 (${weekday})`;
}

// 결혼식 날짜로부터 오늘까지의 D-day 계산 (일 단위)
function getDDay(weddingDate?: { year: number; month: number; day: number }) {
  if (!weddingDate) return null;
  const wedding = new Date(
    weddingDate.year,
    weddingDate.month - 1,
    weddingDate.day,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  wedding.setHours(0, 0, 0, 0);
  const diffMs = wedding.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

interface PlanUserData {
  id: string;
  weddingDate: string;
  budget: number;
  name: string;
}

export default function MainPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { weddingData, resetData } = useWedding();
  const { fetchWithAuth } = useApi();
  const [apiPlanData, setApiPlanData] = useState<PlanUserData | null | "none">(
    null,
  );
  const [tokenChecked, setTokenChecked] = useState(false);
  const cancelledRef = useRef(false);
  const fetchPlanUser = useCallback(
    async (onApiError: () => void) => {
      if (!getToken()) {
        setApiPlanData("none");
        return;
      }
      try {
        const res = await fetchWithAuth("/plan/user");
        if (cancelledRef.current) return;
        const json = (await res.json()) as {
          result?: boolean;
          data?: PlanUserData;
        };
        if (cancelledRef.current) return;
        if (json.result === true && json.data) {
          setApiPlanData(json.data);
        } else {
          setApiPlanData("none");
          if (!res.ok) onApiError();
        }
      } catch {
        if (!cancelledRef.current) onApiError();
      }
    },
    [fetchWithAuth],
  );

  const handleApiError = useCallback(() => {
    clearAllStoredData();
    resetData();
    router.replace("/?api_error=1");
  }, [resetData, router]);

  // /main 접속 시 JWT가 존재하면 무조건 GET /plan/user 호출 (토큰 확인 후에만 실제 데이터 표시)
  useEffect(() => {
    const token = getToken();
    setTokenChecked(true);
    if (!token) {
      setApiPlanData("none");
      return;
    }
    cancelledRef.current = false;
    fetchPlanUser(handleApiError);
    // eslint-disable-next-line consistent-return -- useEffect cleanup is valid
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchPlanUser, handleApiError]);

  // JWT 있으면 GET /plan/user 결과(apiPlanData) 사용, 없으면 세션 스토리지(weddingData) 데이터 적용
  const displayData = useMemo(() => {
    if (apiPlanData && apiPlanData !== "none") {
      const date = parseWeddingDate(apiPlanData.weddingDate);
      return {
        name: apiPlanData.name ?? "",
        budget: String(apiPlanData.budget ?? 1000),
        date,
      };
    }
    // JWT 없음 → 세션 스토리지에 있는 이름·날짜·예산 적용
    return {
      name: weddingData.name ?? "",
      budget: weddingData.budget ?? "1000",
      date: weddingData.date,
    };
  }, [apiPlanData, weddingData]);

  const isPlanLoading = Boolean(
    !tokenChecked || (getToken() && apiPlanData === null),
  );

  const dDay = useMemo(() => getDDay(displayData.date), [displayData.date]);
  const dDayLabel = (() => {
    if (dDay === null) return "날짜 설정";
    if (dDay > 0) return `D-${dDay}`;
    if (dDay === 0) return "D-Day";
    return `D+${Math.abs(dDay)}`;
  })();
  const weddingDateText = formatWeddingDate(displayData.date);

  // 예산 관리 변수
  const initialBudget = Number(displayData.budget) || 1000; // 초기 예산 (만원)
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

  // 날짜 포맷팅 함수 (YYYY년 MM월 DD일 + 요일)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = [
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일",
    ];
    const weekday = weekdays[date.getDay()];
    return {
      dateText: `${year}년 ${month}월 ${day}일`,
      weekday,
    };
  };

  // 샘플 예산 계획 데이터 (추후 API로 받아올 예정)
  const budgetPlans = [
    {
      id: 1,
      title: "디자인 목업 검토하기",
      date: "2026-12-26",
      price: 1000000,
    },
    { id: 2, title: "웨딩홀 투어 예약", date: "2026-12-27", price: 0 },
    { id: 3, title: "드레스 피팅", date: "2026-12-28", price: 500000 },
    { id: 4, title: "예식장 꽃장식 상담", date: "2026-12-29", price: 2000000 },
    { id: 5, title: "사진작가 미팅", date: "2026-12-30", price: 3000000 },
    { id: 6, title: "청첩장 디자인 확인", date: "2027-01-02", price: 800000 },
    { id: 7, title: "혼주 선물 준비", date: "2027-01-03", price: 1500000 },
    { id: 8, title: "예식 음악 선정", date: "2027-01-04", price: 0 },
    { id: 9, title: "신혼여행 일정 확인", date: "2027-01-05", price: 5000000 },
    {
      id: 10,
      title: "예식장 계약금 입금",
      date: "2027-01-06",
      price: 10000000,
    },
  ];

  // 각 계획의 체크 상태 관리
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);

  // 체크박스 토글 핸들러
  const handleToggleCheck = (id: number) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 프로필 버튼 클릭 핸들러
  const handleUserClick = () => {
    if (getToken()) {
      setShowProfileEditModal(true);
    } else {
      setShowLoginRequiredModal(true);
    }
  };

  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <KakaoLoginAlert
        show={searchParams.get("kakao_login") === "1"}
        onSuccessFromMain={() => fetchPlanUser(handleApiError)}
      />
      <main className="flex h-full w-full max-w-[500px] flex-col items-center overflow-y-auto bg-[#FFF5F2] px-6">
        <div className="w-full pt-8">
          {/* 상단 영역 */}
          <div className="w-full flex items-center justify-between">
            {/* 이름 + D-day 영역 (로딩 시 스켈레톤) */}
            <div className="flex flex-col items-start justify-start">
              {isPlanLoading ? (
                <>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span
                      className="skeleton-shimmer h-[42px] w-[120px] rounded-lg"
                      aria-hidden
                    />
                    <span
                      className="skeleton-shimmer h-8 w-[98px] shrink-0 rounded-full"
                      aria-hidden
                    />
                  </div>
                  <span
                    className="skeleton-shimmer mt-1.5 block h-4 w-[152px] rounded"
                    aria-hidden
                  />
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-[42px] font-semibold text-[#000000] leading-none">
                      {displayData.name || "이름"}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-4 py-1.5 text-[18px] font-semibold leading-none shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #ffaab8 0%, #ffd8df 100%)",
                        color: "#fff",
                        boxShadow: "0 2px 8px rgba(255, 170, 184, 0.35)",
                      }}
                    >
                      {dDayLabel}
                    </span>
                  </div>
                  {weddingDateText && (
                    <span className="mt-1.5 text-[13px] font-normal leading-tight text-gray-500">
                      결혼식: {weddingDateText}
                    </span>
                  )}
                </>
              )}
            </div>
            {/* 프로필 이미지 영역 (로딩 시 스켈레톤 시머) */}
            {isPlanLoading ? (
              <span
                className="skeleton-shimmer h-12 w-12 shrink-0 rounded-full"
                aria-hidden
              />
            ) : (
              <button
                type="button"
                onClick={handleUserClick}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  background:
                    "linear-gradient(135deg, #ffaab8 0%, #ffd8df 100%)",
                }}
              >
                <User className="h-6 w-6 text-white" strokeWidth={2} />
              </button>
            )}
          </div>
          {/* TodayFocus - 로딩 시 요소별 스켈레톤 */}
          <div className="mt-4 w-full">
            {isPlanLoading ? (
              <div className="flex w-full flex-col rounded-[24px] border-2 border-stone-200/50 bg-white/50 p-6">
                <div className="flex items-start gap-3">
                  <span
                    className="skeleton-shimmer h-10 w-10 shrink-0 rounded-full"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <span
                      className="skeleton-shimmer block h-5 w-20 rounded"
                      aria-hidden
                    />
                    <span
                      className="skeleton-shimmer block h-[42px] w-28 rounded"
                      aria-hidden
                    />
                  </div>
                </div>
                <span
                  className="skeleton-shimmer mt-4 block h-6 w-48 rounded"
                  aria-hidden
                />
                <div className="mt-4 flex items-center gap-2">
                  <span
                    className="skeleton-shimmer h-2 flex-1 rounded-full"
                    aria-hidden
                  />
                  <span
                    className="skeleton-shimmer h-4 w-8 shrink-0 rounded"
                    aria-hidden
                  />
                </div>
              </div>
            ) : (
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
                        duration={0.1}
                        className="inline"
                      />
                      만 원
                    </p>
                  </div>
                </div>
                <p className="mt-1 pl-[52px] py-2 text-xl font-semibold leading-none text-white">
                  예산 중{" "}
                  <CountUp
                    to={usedBudget}
                    separator=","
                    duration={0.1}
                    className="inline"
                  />
                  만 원 지출 예정
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
            )}
          </div>
        </div>
        <div className="w-full mt-8 pb-24">
          {/* 하단 영역 */}
          <div className="flex justify-between">
            <div className="flex flex-col items-start justify-start">
              <span className="text-lg font-semibold">플랜 가이드</span>
              {isPlanLoading ? (
                <span
                  className="skeleton-shimmer mt-0.5 block h-5 w-32 rounded"
                  aria-hidden
                />
              ) : (
                <span className="text-lg text-gray-500">
                  {budgetPlans.length}개의 플랜이 있어요
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push("/add-plen")}
              className="flex items-center gap-2 px-4 py-3 text-white rounded-lg font-semibold text-lg transition-colors shadow-md hover:opacity-90 active:opacity-80"
              style={{ backgroundColor: "#FFAAB8" }}
            >
              플랜 추가
              <CirclePlus className="h-5 w-5 text-white" strokeWidth={2.5} />
            </button>
          </div>
          <ul className="mt-4 w-full flex flex-col gap-3">
            {isPlanLoading
              ? ["a", "b", "c", "d", "e"].map((id) => (
                  <li
                    key={`skeleton-plan-${id}`}
                    className="flex items-center gap-4 rounded-[20px] bg-white p-4"
                  >
                    <span
                      className="skeleton-shimmer h-6 w-6 shrink-0 rounded-full"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <span
                        className="skeleton-shimmer block h-[22px] max-w-[200px] rounded"
                        style={{ width: "75%" }}
                        aria-hidden
                      />
                      <span
                        className="skeleton-shimmer block h-4 w-32 rounded"
                        aria-hidden
                      />
                    </div>
                    <span
                      className="skeleton-shimmer h-5 w-16 shrink-0 rounded"
                      aria-hidden
                    />
                  </li>
                ))
              : budgetPlans.map((plan) => {
                  const isChecked = checkedItems.has(plan.id);
                  return (
                    <li
                      key={plan.id}
                      className="flex items-center gap-4 rounded-[20px] bg-white p-4"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleCheck(plan.id)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all hover:opacity-80 ${
                          isChecked
                            ? "bg-[#ffaab8] border-[#ffaab8]"
                            : "bg-white border-[#ffaab8]"
                        }`}
                      >
                        {isChecked && (
                          <Check
                            className="h-3 w-3 text-white"
                            strokeWidth={3}
                          />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[15px] font-normal leading-[22.5px] ${
                            isChecked ? "line-through" : ""
                          }`}
                          style={{
                            color: isChecked ? "#99a1af" : "#2D5016",
                          }}
                        >
                          {plan.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-[#6a7282]" />
                          {(() => {
                            const { dateText, weekday } = formatDate(plan.date);
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-normal leading-[19.5px] text-[#6a7282]">
                                  {dateText}
                                </span>
                                <span className="text-[13px] font-normal leading-[19.5px] text-[#99a1af]">
                                  ({weekday})
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {plan.price > 0 ? (
                          <span className="text-[15px] font-semibold leading-[22.5px] text-black whitespace-nowrap">
                            {plan.price.toLocaleString()}원
                          </span>
                        ) : (
                          <span className="text-[15px] font-normal leading-[22.5px] text-[#99a1af] whitespace-nowrap">
                            미정
                          </span>
                        )}
                        <div className="h-2 w-2 rounded-full bg-[#ffaab8]" />
                      </div>
                    </li>
                  );
                })}
          </ul>
        </div>
      </main>
      {/* 하단 탭바 - Sticky로 최상단에 고정 */}
      <BottomTabBar
        activeTab="home"
        onTabClick={(tab) => {
          if (tab === "home") {
            // 이미 /main 페이지에 있으면 새로고침, 아니면 이동
            if (window.location.pathname === "/main") {
              router.refresh();
            } else {
              router.push("/main");
            }
          }
          // TODO: 나머지 탭들은 나중에 처리
        }}
      />
      <LoginRequiredModal
        show={showLoginRequiredModal}
        onClose={() => setShowLoginRequiredModal(false)}
      />
      <ProfileEditModal
        show={showProfileEditModal}
        onClose={() => setShowProfileEditModal(false)}
        displayData={{
          name: displayData.name,
          date: displayData.date,
          budget: displayData.budget,
        }}
        onSaved={() => fetchPlanUser(handleApiError)}
      />
    </div>
  );
}
