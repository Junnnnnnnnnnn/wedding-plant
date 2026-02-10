"use client";

import {
  Calendar,
  Check,
  CircleDollarSign,
  CirclePlus,
  Crown,
  LogOut,
  Mail,
  Pencil,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import CountUp from "@/components/CountUp";
import BottomTabBar from "../components/BottomTabBar";
import KakaoLoginAlert from "../components/KakaoLoginAlert";
import LoginRequiredModal from "../components/LoginRequiredModal";
import GuestPlanLimitModal from "../components/GuestPlanLimitModal";
import SharePlanModal from "@/components/SharePlanModal";
import NoPlanFoundModal from "../components/NoPlanFoundModal";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import {
  getToken,
  getPlanUserIdFromToken,
  getSubFromToken,
  clearAllStoredData,
} from "@/lib/api";
import { getGuestScheduleList } from "@/lib/guestSchedule";
import { parseLocalDate, getKstDate } from "@/lib/utils";
import { useScrollDirection } from "../hooks/useScrollDirection";

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
  const today = getKstDate();
  wedding.setHours(0, 0, 0, 0);
  const diffMs = wedding.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/** GET /plan/user 응답의 data.members 항목 */
interface PlanUserMember {
  planUserId: string;
  name: string;
  image: string | null;
  permission: string;
}

interface PlanUserData {
  id: string;
  weddingDate: string;
  budget: number;
  name: string;
  roomId?: number | null;
  members?: PlanUserMember[];
}

/** GET /plan/schedule/list 응답 항목 */
interface ScheduleListItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  /** COMPLETED 일 때 체크박스·취소선·회색 표시 */
  status?: string | null;
}

const SCHEDULE_FETCH_COUNT = 10000;
const SCHEDULE_SORT = "DESC";
const SCHEDULE_SORT_COLUMN = "createDate";

/** 카테고리명으로 파스텔 색상 반환 (동일 이름 = 동일 색상) */
function getCategoryColor(categoryName: string): string {
  const colors = [
    "#FFE4E9",
    "#E8DDF5",
    "#D5F0E5",
    "#FFF0D6",
    "#D4EBF7",
    "#FFE5D9",
  ];
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = (hash << 5) - hash + categoryName.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

/** startDate와 오늘의 거리에 따라 점 색상: 가까울수록 진한 분홍, 멀수록 회색. null이면 미정(회색) */
function getDotColorByDate(startDate: string | null): string {
  if (!startDate?.trim()) return "#9ca3af"; // 미정: 회색
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "#9ca3af";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diffMs = start.getTime() - today.getTime();
  const daysUntil = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "#bbf7d0"; // 지난 일정: 연한 녹색
  if (daysUntil <= 7) return "#ff8fa3"; // 1주 이내: 찐한 분홍
  if (daysUntil <= 30) return "#ffaab8"; // 1개월 이내: 분홍
  if (daysUntil <= 90) return "#ffd0d9"; // 3개월 이내: 연한 분홍
  return "#bbf7d0"; // 그 이상: 연한 녹색
}

/** 공유 방 호스트 정보 (public API 응답) */
interface SharedRoomUser {
  id: string;
  weddingDate: string;
  budget: number;
  name: string;
}

/** GET /plan/user/room/member/{shareCode} 응답 항목 */
interface RoomMember {
  planUserId: string;
  name: string;
  image: string | null;
  permission: string;
}

/** 멤버별 아바타 그라데이션 (인덱스별 다른 색상) */
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #ee2b8c 0%, #ff7eb3 100%)",
  "linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%)",
  "linear-gradient(135deg, #059669 0%, #34d399 100%)",
  "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #7dd3fc 100%)",
];

function MainPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareCode = searchParams.get("share");
  const roomId = searchParams.get("roomId");
  const { weddingData, resetData } = useWedding();
  const { fetchWithAuth } = useApi();
  const [apiPlanData, setApiPlanData] = useState<PlanUserData | null | "none">(
    null,
  );
  const [totalAmountManwon, setTotalAmountManwon] = useState<number | null>(
    null,
  );
  const [tokenChecked, setTokenChecked] = useState(false);
  const [sharedRoomUser, setSharedRoomUser] = useState<
    SharedRoomUser | null | "error"
  >(null);
  const [sharedRoomScheduleList, setSharedRoomScheduleList] = useState<
    ScheduleListItem[]
  >([]);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [showNoPlanModal, setShowNoPlanModal] = useState(false);
  const [isNoPlanBlur, setIsNoPlanBlur] = useState(false);
  const sharedFetchingRef = useRef(false);
  const cancelledRef = useRef(false);

  // JWT 있고 share 파라미터 있으면 GET /plan/user/{shareCode} + schedule + room/member 호출
  const fetchSharedRoomWithAuth = useCallback(
    async (code: string) => {
      if (sharedFetchingRef.current) return;
      sharedFetchingRef.current = true;
      setSharedRoomUser(null);
      setSharedRoomScheduleList([]);
      setRoomMembers([]);
      try {
        const [userRes, scheduleRes, memberRes] = await Promise.all([
          fetchWithAuth(`/plan/user/${encodeURIComponent(code)}`),
          fetchWithAuth(
            `/plan/schedule/room/${encodeURIComponent(code)}/list?page=1&count=10000&sort=DESC&sortColumn=startDate`,
          ),
          fetchWithAuth(`/plan/user/room/member/${encodeURIComponent(code)}`),
        ]);
        const userJson = (await userRes.json()) as {
          result?: boolean;
          data?: SharedRoomUser;
        };
        const scheduleJson = (await scheduleRes.json()) as {
          result?: boolean;
          data?: { total: number; list: ScheduleListItem[] };
        };
        const memberJson = (await memberRes.json()) as {
          result?: boolean;
          data?: { total?: number; list?: RoomMember[]; members?: RoomMember[] };
        };
        if (userJson.result === true && userJson.data) {
          setSharedRoomUser(userJson.data);
        } else {
          setSharedRoomUser("error");
        }
        if (scheduleJson.result === true && scheduleJson.data?.list) {
          setSharedRoomScheduleList(scheduleJson.data.list);
        }
        if (memberJson.result === true && memberJson.data) {
          const list =
            memberJson.data.list ??
            memberJson.data.members ??
            [];
          setRoomMembers(Array.isArray(list) ? list : []);
        }
      } catch {
        setSharedRoomUser("error");
      } finally {
        sharedFetchingRef.current = false;
      }
    },
    [fetchWithAuth],
  );


  const fetchPlanUser = useCallback(
    async (
      onApiError: (status?: number) => void,
      roomIdParam?: string,
    ) => {
      if (!getToken()) {
        setApiPlanData("none");
        return;
      }
      try {
        const url = roomIdParam?.trim()
          ? `/plan/room/${encodeURIComponent(roomIdParam.trim())}`
          : "/plan/user";
        const res = await fetchWithAuth(url);
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
          if (!res.ok) onApiError(res.status);
        }
      } catch {
        if (!cancelledRef.current) onApiError();
      }
    },
    [fetchWithAuth],
  );

  const fetchTotalAmount = useCallback(
    async (
      onApiError: (status?: number) => void,
      roomIdParam?: string,
    ) => {
      if (!getToken()) {
        setTotalAmountManwon(0);
        return;
      }
      // 참여 플랜(roomId) 모드에서는 total-amount API 없음 → 스케줄 합산으로 사용
      if (roomIdParam?.trim()) {
        setTotalAmountManwon(0);
        return;
      }
      try {
        const res = await fetchWithAuth("/plan/user/total-amount");
        if (cancelledRef.current) return;
        const json = (await res.json()) as {
          result?: boolean;
          data?: { totalAmount?: number };
        };
        if (cancelledRef.current) return;
        if (json.result === true && json.data?.totalAmount != null) {
          setTotalAmountManwon(json.data.totalAmount);
        } else {
          setTotalAmountManwon(0);
          if (!res.ok) onApiError(res.status);
        }
      } catch {
        if (!cancelledRef.current) {
          setTotalAmountManwon(0);
          onApiError();
        }
      }
    },
    [fetchWithAuth],
  );

  /** 401이면 모달 없이 / 로만 이동, 그 외에는 api_error=1 로 ApiErrorModal 표시 */
  const handleApiError = useCallback(
    (status?: number) => {
      clearAllStoredData();
      resetData();
      if (status === 401) {
        router.replace("/");
      } else {
        router.replace("/?api_error=1");
      }
    },
    [resetData, router],
  );

  // 로그인되어 있을 때만 API 사용. 비로그인(setting→main 로그인 없이 둘러보기 등) 시 API 호출 없음
  useEffect(() => {
    const token = getToken();
    setTokenChecked(true);
    if (!token) {
      setApiPlanData("none");
      setTotalAmountManwon(0);
      return;
    }
    cancelledRef.current = false;
    const roomIdParam = roomId?.trim();
    if (shareCode?.trim()) {
      (async () => {
        await Promise.all([
          fetchPlanUser(handleApiError),
          fetchTotalAmount(handleApiError),
        ]);
        if (!cancelledRef.current) {
          fetchSharedRoomWithAuth(shareCode.trim());
        }
      })();
    } else if (roomIdParam) {
      setApiPlanData(null);
      setScheduleList([]);
      setScheduleInitialFetched(false);
      fetchPlanUser(handleApiError, roomIdParam);
      fetchTotalAmount(handleApiError, roomIdParam);
    } else {
      // /main으로 돌아왔을 때 본인 플랜 데이터 다시 로드 (이전 room/share 데이터 제거)
      setApiPlanData(null);
      setScheduleList([]);
      setScheduleInitialFetched(false);
      fetchPlanUser(handleApiError);
      fetchTotalAmount(handleApiError);
    }
    // eslint-disable-next-line consistent-return -- useEffect cleanup is valid
    return () => {
      cancelledRef.current = true;
    };
  }, [
    fetchPlanUser,
    fetchTotalAmount,
    fetchSharedRoomWithAuth,
    handleApiError,
    shareCode,
    roomId,
  ]);

  // 자신의 플랜이 없는 경우 안내 모달 표시 및 블러 처리
  useEffect(() => {
    const isPlanIncomplete = () => {
      if (apiPlanData === "none") return true;
      if (!apiPlanData || typeof apiPlanData === "string") return false;
      const hasWeddingDate = !!apiPlanData.weddingDate?.trim();
      const hasName = !!apiPlanData.name?.trim();
      // budget은 0일 수도 있으므로 null/undefined만 체크하거나 0 이상 조건 (여기서는 null체크)
      const hasBudget = apiPlanData.budget !== null && apiPlanData.budget !== undefined;
      return !hasWeddingDate || !hasName || !hasBudget;
    };

    if (
      tokenChecked &&
      getToken() &&
      !shareCode &&
      !roomId &&
      isPlanIncomplete()
    ) {
      setShowNoPlanModal(true);
      setIsNoPlanBlur(true);
    } else {
      setShowNoPlanModal(false);
      setIsNoPlanBlur(false);
    }
  }, [tokenChecked, shareCode, roomId, apiPlanData]);


  // 공유 링크로 접속한 비로그인 유저에게 로그인 모달 표시
  useEffect(() => {
    if (!tokenChecked || getToken() || !shareCode?.trim()) return;
    setLoginRequiredTitle("공유 플랜을 보려면 로그인해 주세요");
    setShowLoginRequiredModal(true);
  }, [tokenChecked, shareCode]);

  // share 파라미터 있으면 공유 방 데이터, JWT 있으면 apiPlanData, 없으면 weddingData 적용
  const displayData = useMemo(() => {
    // 공유 링크(로그인/비로그인) → 공유 방 호스트 정보 적용
    if (shareCode && sharedRoomUser && sharedRoomUser !== "error") {
      const date = parseWeddingDate(sharedRoomUser.weddingDate);
      return {
        name: sharedRoomUser.name ?? "",
        budget: String(sharedRoomUser.budget ?? 1000),
        date,
      };
    }
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
  }, [shareCode, apiPlanData, sharedRoomUser, weddingData]);

  const isSharedView =
    !!shareCode && sharedRoomUser && sharedRoomUser !== "error";
  const isSharedLoading = !!shareCode && sharedRoomUser === null;
  const isRoomView =
    !!roomId?.trim() ||
    (apiPlanData &&
      apiPlanData !== "none" &&
      !!apiPlanData.roomId);

  /** roomId 모드에서 현재 로그인 유저의 해당 방 권한. READ면 플랜 추가 버튼 숨김 */
  const myRoomPermission = useMemo(() => {
    if (!isRoomView || !apiPlanData || apiPlanData === "none" || !apiPlanData.members?.length)
      return undefined;
    const myId = String(getPlanUserIdFromToken() ?? "").trim().toLowerCase();
    if (!myId) return undefined;
    const me = apiPlanData.members.find(
      (m) => String(m.planUserId ?? "").trim().toLowerCase() === myId,
    );
    return me?.permission ?? undefined;
  }, [isRoomView, apiPlanData]);

  const isPlanLoading = Boolean(
    !tokenChecked ||
    isSharedLoading ||
    (getToken() && !shareCode && apiPlanData === null),
  );

  const dDay = useMemo(() => getDDay(displayData.date), [displayData.date]);
  const dDayLabel = (() => {
    if (dDay === null) return "날짜 설정";
    if (dDay > 0) return `D-${dDay}`;
    if (dDay === 0) return "D-Day";
    return `D+${Math.abs(dDay)}`;
  })();
  const weddingDateText = formatWeddingDate(displayData.date);

  // 스케줄 목록 API: count=10000으로 한 번에 전체 로드
  const [scheduleList, setScheduleList] = useState<ScheduleListItem[]>([]);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleInitialFetched, setScheduleInitialFetched] = useState(false);
  const scheduleFetchingRef = useRef(false);

  const effectiveScheduleList = isSharedView
    ? sharedRoomScheduleList
    : scheduleList;
  const effectiveScheduleTotal = isSharedView
    ? sharedRoomScheduleList.length
    : scheduleTotal;
  const isListLoaded = getToken()
    ? scheduleInitialFetched
    : shareCode
      ? sharedRoomUser !== null
      : scheduleInitialFetched;

  // 예산 관리 변수 (지출 예정 = GET /plan/user/total-amount)
  const initialBudget = Number(displayData.budget) || 1000; // 초기 예산 (만원)
  const guestUsedBudget = useMemo(() => {
    return effectiveScheduleList.reduce((sum, plan) => {
      const amount = typeof plan.amount === "number" ? plan.amount : 0;
      return sum + amount;
    }, 0);
  }, [effectiveScheduleList]);
  // 공유 뷰·참여 플랜(roomId) 또는 비로그인 시 스케줄 합산, 로그인 본인 플랜 시 totalAmountManwon
  const usedBudget =
    !isSharedView && !isRoomView && getToken()
      ? (totalAmountManwon ?? 0)
      : guestUsedBudget; // 지출 예정 총액 (만원)
  const remainingBudget = initialBudget - usedBudget; // 남은 예산 실시간 계산

  // 예산 사용률 계산
  const budgetUsagePercentage = Math.round(
    initialBudget > 0 ? (usedBudget / initialBudget) * 100 : 0,
  );
  const budgetUsagePercentageForBar = Math.max(
    0,
    Math.min(100, budgetUsagePercentage),
  );

  // 예산 사용률에 따른 그라데이션 색상 계산
  const getGradientColors = (percentage: number) => {
    // 0% = 현재 색상(기본), 100% = 진한 색상
    const t = percentage / 100; // 0 ~ 1

    // 기본 색상 (0%일 때 - Pink Solid variant from budget detail)
    // #ee2b8c is HSL(328, 86%, 55%)

    // Let's just use a solid logic for now or a simpler gradient based on the new pink
    // Start: #ee2b8c (Primary Pink)
    // End: #ff659c (Slightly lighter/different hue for gradient)

    return `linear-gradient(135deg, #ee2b8c 0%, #ff5c95 100%)`;
  };

  const budgetGradient = getGradientColors(budgetUsagePercentage);

  // 날짜 포맷팅 함수 (YYYY년 MM월 DD일 + 요일, 로컬 파싱으로 타임존 오차 방지)
  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    if (!date) return { dateText: "날짜 미정", weekday: "" };
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

  const fetchScheduleList = useCallback(
    async (roomIdParam?: string) => {
      if (scheduleFetchingRef.current) return;
      const token = getToken();
      if (!token) {
        setScheduleInitialFetched(true);
        return;
      }
      scheduleFetchingRef.current = true;
      setScheduleLoading(true);
      try {
        const params = new URLSearchParams({
          page: "1",
          count: String(SCHEDULE_FETCH_COUNT),
          sort: SCHEDULE_SORT,
          sortColumn: roomIdParam?.trim()
            ? "startDate"
            : SCHEDULE_SORT_COLUMN,
        });
        const url = roomIdParam?.trim()
          ? `/plan/schedule/room/${encodeURIComponent(roomIdParam.trim())}/list?${params.toString()}`
          : `/plan/schedule/list?${params.toString()}`;
        const res = await fetchWithAuth(url);
        const json = (await res.json()) as {
          result?: boolean;
          data?: { total: number; list: ScheduleListItem[] };
        };
        if (json.result === true && json.data) {
          const { total, list } = json.data;
          setScheduleTotal(total);
          setScheduleList(list);
        } else {
          setScheduleList([]);
        }
      } catch {
        setScheduleList([]);
      } finally {
        setScheduleLoading(false);
        setScheduleInitialFetched(true);
        scheduleFetchingRef.current = false;
      }
    },
    [fetchWithAuth],
  );

  // 로그인되어 있을 때만 스케줄 API 호출. share 있으면 fetchSharedRoomWithAuth에서 스케줄 로드
  useEffect(() => {
    if (!getToken()) {
      setScheduleInitialFetched(true);
      setScheduleList(getGuestScheduleList());
      return;
    }
    // share 모드에서는 fetchSharedRoomWithAuth가 스케줄을 로드하므로 여기서는 skip
    if (shareCode?.trim()) return;

    // apiPlanData가 아직 로드되지 않았으면(null) 대기 — roomId 여부를 판단할 수 없으므로
    if (apiPlanData === null) return;

    const roomIdParam =
      roomId?.trim() ||
      (apiPlanData && apiPlanData !== "none" && apiPlanData.roomId
        ? String(apiPlanData.roomId)
        : null);

    if (roomIdParam) {
      fetchScheduleList(roomIdParam);
    } else {
      fetchScheduleList();
    }
  }, [fetchScheduleList, shareCode, roomId, apiPlanData]);


  // 각 계획의 체크 상태 관리
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [loginRequiredTitle, setLoginRequiredTitle] = useState<
    string | undefined
  >(undefined);
  const [showGuestPlanLimitModal, setShowGuestPlanLimitModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const mainScrollRef = useRef<HTMLElement>(null);
  const scrollDirection = useScrollDirection(mainScrollRef);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const togglingIdsRef = useRef<Set<number>>(new Set());
  const checkedItemsRef = useRef<Set<number>>(checkedItems);
  const scheduleListRef = useRef(scheduleList);
  checkedItemsRef.current = checkedItems;
  scheduleListRef.current = scheduleList;

  // 체크박스 토글 핸들러 (PATCH /plan/schedule/status/{id} — COMPLETED / NORMAL)
  const handleToggleCheck = useCallback(
    async (id: number) => {
      if (!getToken()) {
        setShowLoginRequiredModal(true);
        return;
      }
      if (togglingIdsRef.current.has(id)) return;
      togglingIdsRef.current.add(id);
      setTogglingIds((prev) => new Set(prev).add(id));

      const plan = scheduleListRef.current.find((p) => p.id === id);
      const isCurrentlyChecked =
        checkedItemsRef.current.has(id) || plan?.status === "COMPLETED";
      const newStatus = isCurrentlyChecked ? "NORMAL" : "COMPLETED";

      setCheckedItems((prev) => {
        const next = new Set(prev);
        if (isCurrentlyChecked) next.delete(id);
        else next.add(id);
        return next;
      });

      try {
        const res = await fetchWithAuth(`/plan/schedule/status/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
        const json = (await res.json()) as { result?: boolean };
        if (!res.ok || !json.result) {
          setCheckedItems((prev) => {
            const revert = new Set(prev);
            if (isCurrentlyChecked) revert.add(id);
            else revert.delete(id);
            return revert;
          });
        }
      } catch {
        setCheckedItems((prev) => {
          const revert = new Set(prev);
          if (isCurrentlyChecked) revert.add(id);
          else revert.delete(id);
          return revert;
        });
      } finally {
        togglingIdsRef.current.delete(id);
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [fetchWithAuth],
  );

  const handleOpenScheduleDetail = (id: number) => {
    if (!getToken()) {
      setShowLoginRequiredModal(true);
      return;
    }
    router.push(`/schedule-detail?id=${id}`);
  };

  return (
    <div className="min-h-screen bg-[#fcfbfc]">
      <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />
      <div className="min-h-screen max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col grid-bg z-10">
        <KakaoLoginAlert
          show={searchParams.get("kakao_login") === "1"}
          onSuccessFromMain={() => {
            fetchPlanUser(handleApiError);
            fetchTotalAmount(handleApiError);
            fetchScheduleList();
          }}
        />
        <main
          ref={mainScrollRef}
          className={`flex flex-1 flex-col items-center overflow-y-auto w-full px-4 sm:px-6 transition-all duration-500 ${isNoPlanBlur ? "blur-xl scale-[0.98] pointer-events-none select-none opacity-60" : ""}`}
        >
          {shareCode && sharedRoomUser === "error" && (
            <div className="w-full mt-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
              공유 링크가 유효하지 않거나 만료되었습니다.
            </div>
          )}
          <div className="w-full pt-8">
            {/* 상단 영역: 1행=이름·초대(이름 우측), 2행=결혼식 날짜(좌측)·D-day(날짜 오른쪽), 오른쪽=프로필 */}
            <div className="w-full flex items-start justify-between gap-4">
              {/* 왼쪽: [이름(좌)·초대(우)] + [결혼식 날짜(좌)·D-day(우)] */}
              <div className="flex flex-col items-start min-w-0 flex-1">
                {/* 1행: 이름(좌) · 초대(이름 바로 옆, 이름 길이에 따라 가변) */}
                <div className="flex items-center gap-2 flex-nowrap min-w-0">
                  {isPlanLoading ? (
                    <span
                      className="skeleton-shimmer h-[42px] w-[120px] rounded-lg shrink-0"
                      aria-hidden
                    />
                  ) : (
                    <span className="text-3xl sm:text-[42px] font-semibold text-[#1b0d14] leading-tight shrink-0 min-w-0 break-keep line-clamp-2">
                      {displayData.name || "이름"}
                    </span>
                  )}
                  {isPlanLoading ? (
                    <span
                      className="skeleton-shimmer h-10 w-[88px] shrink-0 rounded-full"
                      aria-hidden
                    />
                  ) : isSharedView && roomMembers.length > 0 ? (
                    <div
                      className="flex shrink-0 -space-x-2 items-center"
                      aria-label="함께하는 멤버"
                    >
                      {(() => {
                        const planId = getPlanUserIdFromToken()
                          ?.trim()
                          .toLowerCase();
                        const subId = getSubFromToken()?.trim().toLowerCase();
                        const apiPlanId =
                          apiPlanData && apiPlanData !== "none"
                            ? String(apiPlanData.id).trim().toLowerCase()
                            : "";
                        const myIds = [planId, subId, apiPlanId].filter(
                          (id): id is string => !!id,
                        );
                        const list = [...roomMembers];
                        const idx = list.findIndex((m) => {
                          const id = String(m.planUserId ?? "")
                            .trim()
                            .toLowerCase();
                          return myIds.some((myId) => myId === id);
                        });
                        if (idx >= 0 && idx !== 0) {
                          const [me] = list.splice(idx, 1);
                          list.unshift(me);
                        }
                        return list.slice(0, 2);
                      })().map((member, i) => (
                        <div
                          key={member.planUserId}
                          className="relative flex-shrink-0"
                          style={{ zIndex: i }}
                        >
                          {(String(member.permission ?? "").toUpperCase() ===
                            "OWNER" ||
                            String(member.planUserId ?? "")
                              .trim()
                              .toLowerCase() ===
                            String(sharedRoomUser.id)
                              .trim()
                              .toLowerCase()) && (
                              <span
                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-amber-900 shadow-sm"
                                aria-hidden
                              >
                                <Crown
                                  className="w-2.5 h-2.5"
                                  strokeWidth={2.5}
                                />
                              </span>
                            )}
                          {String(member.permission ?? "").toUpperCase() ===
                            "WRITE" &&
                            String(member.permission ?? "").toUpperCase() !==
                            "OWNER" && (
                              <span
                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-slate-500 text-white shadow-sm"
                                aria-hidden
                              >
                                <Pencil
                                  className="w-2.5 h-2.5"
                                  strokeWidth={2.5}
                                />
                              </span>
                            )}
                          <div
                            className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-black shadow-sm overflow-hidden"
                            style={{
                              background: member.image
                                ? undefined
                                : AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                            }}
                            title={member.name}
                          >
                            {member.image ? (
                              <img
                                src={member.image}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>
                                {member.name?.trim().charAt(0)?.toUpperCase() ||
                                  "?"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {roomMembers.length === 1 && (
                        <button
                          type="button"
                          onClick={() => setShowShareModal(true)}
                          className="relative flex-shrink-0 z-10 w-10 h-10 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center text-stone-400 bg-stone-50 hover:bg-stone-100 transition-colors shadow-sm"
                          aria-label="멤버 초대하기"
                        >
                          <Plus className="w-5 h-5" strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  ) : apiPlanData &&
                    apiPlanData !== "none" &&
                    apiPlanData.members &&
                    apiPlanData.members.length > 0 ? (
                    <div
                      className="flex shrink-0 -space-x-2 items-center"
                      aria-label="함께하는 멤버"
                    >
                      {(() => {
                        const list = [...apiPlanData.members];
                        const ownerIdx = list.findIndex(
                          (m) =>
                            String(m.permission ?? "").toUpperCase() ===
                            "OWNER",
                        );
                        if (ownerIdx >= 0 && ownerIdx !== 0) {
                          const [owner] = list.splice(ownerIdx, 1);
                          list.unshift(owner);
                        }
                        return list.slice(0, 2);
                      })().map((member, i) => (
                        <div
                          key={member.planUserId}
                          className="relative flex-shrink-0"
                          style={{ zIndex: i }}
                        >
                          {String(member.permission ?? "").toUpperCase() ===
                            "OWNER" && (
                              <span
                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-amber-900 shadow-sm"
                                aria-hidden
                              >
                                <Crown
                                  className="w-2.5 h-2.5"
                                  strokeWidth={2.5}
                                />
                              </span>
                            )}
                          {String(member.permission ?? "").toUpperCase() ===
                            "WRITE" &&
                            String(member.permission ?? "").toUpperCase() !==
                            "OWNER" && (
                              <span
                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-slate-500 text-white shadow-sm"
                                aria-hidden
                              >
                                <Pencil
                                  className="w-2.5 h-2.5"
                                  strokeWidth={2.5}
                                />
                              </span>
                            )}
                          <div
                            className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-black shadow-sm overflow-hidden"
                            style={{
                              background: member.image
                                ? undefined
                                : AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                            }}
                            title={member.name}
                          >
                            {member.image ? (
                              <img
                                src={member.image}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>
                                {member.name?.trim().charAt(0)?.toUpperCase() ||
                                  "?"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {apiPlanData &&
                        apiPlanData !== "none" &&
                        apiPlanData.members?.length === 1 && (
                          <button
                            type="button"
                            onClick={() => setShowShareModal(true)}
                            className="relative flex-shrink-0 z-10 w-10 h-10 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center text-stone-400 bg-stone-50 hover:bg-stone-100 transition-colors shadow-sm"
                            aria-label="멤버 초대하기"
                          >
                            <Plus className="w-5 h-5" strokeWidth={3} />
                          </button>
                        )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!getToken()) {
                          setShowShareModal(false);
                          setShowLoginRequiredModal(true);
                          return;
                        }
                        setShowShareModal(true);
                      }}
                      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-[#1b0d14] bg-stone-100 hover:bg-stone-200 transition-colors border border-stone-200"
                      aria-label="플랜 초대하기"
                    >
                      <Mail
                        className="h-4 w-4 text-stone-600"
                        strokeWidth={2}
                      />
                      초대
                    </button>
                  )}
                </div>
                {/* 2행: 결혼식 날짜(좌측) + D-day(날짜 오른쪽에 붙임) */}
                <div className="mt-[5px] flex items-center gap-1.5 flex-nowrap min-w-0 max-w-[200px] sm:max-w-none">
                  {isPlanLoading ? (
                    <>
                      <span
                        className="skeleton-shimmer h-3.5 w-[152px] rounded shrink-0"
                        aria-hidden
                      />
                      <span
                        className="skeleton-shimmer h-10 w-14 shrink-0 rounded-full"
                        aria-hidden
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-[12px] font-normal leading-tight text-gray-500 shrink-0">
                        {weddingDateText
                          ? `결혼식: ${weddingDateText}`
                          : "\u00A0"}
                      </span>
                      <span
                        className="flex h-5 shrink-0 items-center rounded-full px-4 py-2 text-sm font-semibold leading-none"
                        style={{
                          background: "#ee2b8c",
                          color: "#fff",
                          boxShadow: "0 2px 8px rgba(238, 43, 140, 0.35)",
                        }}
                      >
                        {dDayLabel}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {/* roomId 또는 shareCode일 때 우측 상단 나가기 버튼 */}
              {(shareCode || roomId) && (
                <button
                  type="button"
                  onClick={() => router.push("/plan-list")}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-600 text-white cursor-pointer hover:bg-stone-700 transition-colors"
                  aria-label="나가기"
                >
                  <LogOut
                    className="h-6 w-6"
                    strokeWidth={2}
                  />
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
                  onClick={() => {
                    router.push("/budget-detail");
                  }}
                  className="flex w-full flex-col rounded-[24px] p-6 cursor-pointer hover:opacity-95 transition-opacity"
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
                      <p
                        className={
                          Math.abs(remainingBudget) >= 1000
                            ? "my-3 text-[32px] max-[350px]:text-[28px] font-semibold leading-7 text-white"
                            : "my-3 text-[42px] max-[350px]:text-[37px] font-semibold leading-7 text-white"
                        }
                      >
                        <span className="whitespace-nowrap">
                          <CountUp
                            to={remainingBudget}
                            separator=","
                            duration={0.1}
                            className="inline"
                          />
                          만 원
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 pl-[52px] py-2 text-xl max-[350px]:text-[15px] font-semibold leading-none text-white">
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
                        style={{ width: `${budgetUsagePercentageForBar}%` }}
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
                <span className="text-lg font-bold text-[#1b0d14]">
                  플랜 가이드
                </span>
                {isPlanLoading ? (
                  <span
                    className="skeleton-shimmer mt-0.5 block h-5 w-32 rounded"
                    aria-hidden
                  />
                ) : (
                  <span className="text-lg text-gray-500">
                    {effectiveScheduleTotal > 0
                      ? `${effectiveScheduleTotal}개의 플랜이 있어요`
                      : effectiveScheduleList.length > 0
                        ? `${effectiveScheduleList.length}개의 플랜이 있어요`
                        : "플랜을 추가해볼까요?"}
                  </span>
                )}
              </div>
              {!(isRoomView && String(myRoomPermission ?? "").toUpperCase() === "READ") && (
                <button
                  type="button"
                  onClick={() => {
                    const roomIdValue =
                      roomId ??
                      (apiPlanData &&
                        apiPlanData !== "none" &&
                        apiPlanData.roomId
                        ? String(apiPlanData.roomId)
                        : null);

                    const addPlanPath = roomIdValue
                      ? `/add-plen?roomId=${roomIdValue}`
                      : "/add-plen";
                    if (getToken()) {
                      router.push(addPlanPath);
                      return;
                    }
                    if (isSharedView) {
                      setLoginRequiredTitle("플랜을 추가하려면 로그인해 주세요");
                      setShowLoginRequiredModal(true);
                      return;
                    }

                    // Guest: allow up to 3 plans saved in sessionStorage
                    const guestCount = effectiveScheduleList.length;
                    if (guestCount === 0) {
                      // 기존 동작: 비로그인 + 첫 플랜 추가 시 안내 모달
                      setShowGuestPlanLimitModal(true);
                      return;
                    }
                    if (guestCount >= 3) {
                      setLoginRequiredTitle("이미 3개의 플랜을 계획하셨어요");
                      setShowLoginRequiredModal(true);
                      return;
                    }
                    router.push(addPlanPath);
                  }}
                  className="flex items-center gap-2 px-4 py-3 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:opacity-90 active:opacity-80 active:scale-95 transform transition-transform"
                  style={{
                    backgroundColor:
                      !getToken() &&
                        !isSharedView &&
                        effectiveScheduleList.length >= 3
                        ? "#cbd5e1"
                        : "#ee2b8c",
                    boxShadow:
                      !getToken() &&
                        !isSharedView &&
                        effectiveScheduleList.length >= 3
                        ? "0 4px 12px rgba(148, 163, 184, 0.35)"
                        : "0 4px 12px rgba(238, 43, 140, 0.3)",
                  }}
                >
                  플랜 추가
                  <CirclePlus className="h-5 w-5 text-white" strokeWidth={2.5} />
                </button>
              )}
            </div>
            <ul className="mt-4 w-full flex flex-col gap-3 min-h-[200px] relative">
              {(scheduleLoading || isSharedLoading) &&
                effectiveScheduleList.length === 0 ? (
                ["a", "b", "c", "d", "e"].map((id) => (
                  <li
                    key={`skeleton-plan-${id}`}
                    className="flex items-center gap-4 rounded-3xl border border-[#ee2b8c0a] bg-white p-4 shadow-sm"
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
              ) : isListLoaded && effectiveScheduleList.length === 0 ? (
                <li className="flex flex-1 flex-col items-center justify-center py-16">
                  <p className="text-4xl font-semibold text-stone-400">텅~</p>
                </li>
              ) : (
                <>
                  {effectiveScheduleList.map((plan) => {
                    const isChecked =
                      checkedItems.has(plan.id) || plan.status === "COMPLETED";
                    const amount = plan.amount ?? 0;
                    const categoryColor = getCategoryColor(plan.categoryName);
                    const detailHref = `/schedule-detail?id=${plan.id}`;
                    const dateLabel = plan.startDate?.trim()
                      ? (() => {
                        const { dateText, weekday } = formatDate(
                          plan.startDate as string,
                        );
                        return `${dateText} (${weekday})`;
                      })()
                      : "미정";
                    return (
                      <li key={plan.id}>
                        <Link
                          href={detailHref}
                          className={`flex items-center gap-4 bg-white p-4 rounded-3xl border border-[#ee2b8c0a] shadow-sm transition-transform active:scale-[0.98] ${isChecked ? "opacity-75" : ""}`}
                          aria-label={`플랜 상세 보기: ${plan.title}`}
                        >
                          <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${categoryColor}` }}
                          >
                            <button
                              type="button"
                              id={String(plan.id)}
                              disabled={togglingIds.has(plan.id)}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleToggleCheck(plan.id);
                              }}
                              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all hover:opacity-90 disabled:opacity-60 disabled:pointer-events-none ${isChecked
                                ? "bg-[#ee2b8c] border-[#ee2b8c]"
                                : "bg-white/80 border-[#ee2b8c]"
                                }`}
                            >
                              {isChecked && (
                                <Check
                                  className="h-3 w-3 text-white"
                                  strokeWidth={3}
                                />
                              )}
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4
                              className={`text-[#1b0d14] font-bold text-lg truncate ${isChecked ? "line-through text-gray-400" : ""}`}
                            >
                              {plan.title}
                            </h4>
                            <div className="text-gray-400 text-xs font-semibold tracking-tight mt-0.5 space-y-0.5">
                              <p className="truncate">{plan.categoryName}</p>
                              <p className="truncate">{dateLabel}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-extrabold text-[#1b0d14] mb-1">
                              {amount > 0
                                ? `${amount.toLocaleString()}만 원`
                                : "미정"}
                            </div>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold tracking-tight ${isChecked
                                ? "bg-[#ee2b8c] text-white"
                                : "bg-gray-100 text-gray-500"
                                }`}
                            >
                              {isChecked ? "완료" : "예정"}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </>
              )}
            </ul>
            {tokenChecked &&
              !getToken() &&
              !showGuestPlanLimitModal &&
              !showLoginRequiredModal && (
                <div className="mt-4 w-full">
                  <button
                    type="button"
                    onClick={() => setShowLoginRequiredModal(true)}
                    className="w-full h-16 bg-[#ee2b8c] text-white rounded-2xl flex items-center justify-center gap-3 font-bold text-lg shadow-xl shadow-[#ee2b8c44] hover:bg-[#d4237b] transition-all transform hover:scale-[1.02] active:scale-95"
                  >
                    로그인 하기
                  </button>
                </div>
              )}
          </div>
        </main>
        {/* 하단 탭바 - Sticky로 최상단에 고정 */}
        <BottomTabBar
          activeTab={roomId || shareCode ? "rooms" : undefined}
          showLoginButton={false}
          scrollDirection={scrollDirection}
          onTabClick={(tab) => {
            if (tab === "home") {
              // /main?roomId= 또는 /main?share= 일 때는 /main으로 이동(쿼리 제거), 그 외 /main이면 새로고침
              if (
                window.location.pathname === "/main" &&
                !window.location.search
              ) {
                router.refresh();
              } else {
                router.push("/main");
              }
            } else {
              router.push(
                tab === "rooms" ? "/plan-list" : tab === "settings" ? "/user" : "/main",
              );
            }
          }}
        />
        <LoginRequiredModal
          show={showLoginRequiredModal}
          onClose={() => {
            setShowLoginRequiredModal(false);
            setLoginRequiredTitle(undefined);
          }}
          title={loginRequiredTitle}
        />
        <GuestPlanLimitModal
          show={showGuestPlanLimitModal}
          onClose={() => setShowGuestPlanLimitModal(false)}
          onConfirm={() => router.push("/add-plen")}
        />
        {/* 플랜 공유하기 모달: 닫을 때 plan/user 재조회하여 members 반영 */}
        <SharePlanModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            fetchPlanUser(handleApiError);
          }}
        />
        <NoPlanFoundModal
          show={showNoPlanModal}
          onConfirm={() => router.push("/setting")}
          onCancel={() => router.push("/plan-list")}
        />
      </div>
    </div>
  );
}

export default function MainPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-[#FFF5F2]" />
      }
    >
      <MainPageContent />
    </Suspense>
  );
}
