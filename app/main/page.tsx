"use client";

import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CircleDollarSign,
  CircleHelp,
  CirclePlus,
  Crown,
  Info,
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
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import CountUp from "@/components/CountUp";
import AddPlanView from "../add-plen/AddPlanView";
import AppShell from "../components/AppShell";
import ScheduleDetailView from "../schedule-detail/ScheduleDetailView";
import HomeDashboard from "../components/HomeDashboard";
import BottomTabBar from "../components/BottomTabBar";
import KakaoLoginAlert from "../components/KakaoLoginAlert";
import LoginRequiredModal from "../components/LoginRequiredModal";
import CustomAlertModal from "../components/CustomAlertModal";
import GuestPlanLimitModal from "../components/GuestPlanLimitModal";
import SharePlanModal from "@/components/SharePlanModal";
import NoPlanFoundModal from "../components/NoPlanFoundModal";
import PlanFilterModal, {
  type PlanSortOption,
} from "../components/PlanFilterModal";
import ScrollDownAnimation from "../components/ScrollDownAnimation";
import GuideOverlay, { GuideStep } from "../components/GuideOverlay";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import {
  getToken,
  getPlanUserIdFromToken,
  getSubFromToken,
  clearAllStoredData,
  HAS_COMPLETED_GUEST_SETTING_KEY,
} from "@/lib/api";
import { getGuestScheduleList } from "@/lib/guestSchedule";
import { parseLocalDate, getKstDate, getDaysUntil } from "@/lib/utils";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useScrollDirection } from "../hooks/useScrollDirection";

/** 정렬 옵션 → 버튼 표시용 라벨(가격/날짜/이름) + 방향 */
function getSortButtonLabel(opt: PlanSortOption): {
  label: string;
  isDesc: boolean;
} {
  const desc = opt.endsWith("_desc");
  if (opt.startsWith("price_")) return { label: "가격", isDesc: desc };
  if (opt.startsWith("date_")) return { label: "시작", isDesc: desc };
  if (opt.startsWith("name_")) return { label: "제목", isDesc: desc };
  return { label: "필터", isDesc: true };
}

/** 정렬 옵션 → API sortColumn, sort */
function getSortApiParams(opt: PlanSortOption): {
  sortColumn: "title" | "amount" | "startDate";
  sort: "ASC" | "DESC";
} {
  const desc = opt.endsWith("_desc");
  const sort = desc ? "DESC" : "ASC";
  if (opt.startsWith("price_")) return { sortColumn: "amount", sort };
  if (opt.startsWith("date_")) return { sortColumn: "startDate", sort };
  if (opt.startsWith("name_")) return { sortColumn: "title", sort };
  return { sortColumn: "startDate", sort: "DESC" };
}

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
  return getDaysUntil(weddingDate);
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
  /** 예식장 이름. 프로필에서 넣지 않았으면 null */
  weddingVenue?: string | null;
  roomId?: number | null;
  members?: PlanUserMember[];
  chatRooms?: {
    id: number;
    name: string;
    /** 마지막 대화 한 줄. 사진·플랜 공유는 텍스트가 없어 null 이다 */
    lastMessage?: string | null;
  }[];
  hasSeenMainGuide?: boolean;
  hasSeenBudgetGuide?: boolean;
}

/** GET /plan/schedule/list 응답 항목 */
interface ScheduleListItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  /** 시작 시각 "HH:mm". 안 정했으면 null */
  startTime?: string | null;
  /** 등록일 (ISO 문자열). API에서 반환 시 사용 */
  createDate?: string | null;
  /** COMPLETED 일 때 체크박스·취소선·회색 표시 */
  status?: string | null;
  /** 장소. 대시보드의 "다가오는 일정"이 쓴다 */
  location?: string | null;
}

const SCHEDULE_FETCH_COUNT = 10000;
/** 카테고리명으로 파스텔 색상 반환 (동일 이름 = 동일 색상) */
function getCategoryColor(categoryName?: string | null): string {
  const colors = [
    "#FFE4E9",
    "#E8DDF5",
    "#D5F0E5",
    "#FFF0D6",
    "#D4EBF7",
    "#FFE5D9",
  ];
  // 백엔드가 카테고리명을 비워 보내는 경우가 있어 방어한다 (없으면 첫 색상)
  const name = typeof categoryName === "string" ? categoryName : "";
  let hash = 0;

  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * 정렬용 시각. 날짜가 없거나 파싱 불가면 null 을 돌려준다.
 * (빈 문자열을 new Date 에 넣으면 NaN 이 되어 정렬이 무너진다)
 */
function getSortTime(item: {
  startDate?: string | null;
  createDate?: string | null;
}): number | null {
  const raw = item.startDate?.trim() || item.createDate?.trim() || "";
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

/** startDate가 오늘보다 이전(지난 날짜)이면 true */
function isStartDatePast(startDate: string | null): boolean {
  if (!startDate?.trim()) return false;
  const start = parseLocalDate(startDate);
  if (!start) return false;
  const today = getKstDate();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return start.getTime() < today.getTime();
}

/** startDate와 오늘(KST) 비교 → 예정 | 임박 | D-day | 지남 */
function getDateStatusLabel(
  startDate: string | null,
): "예정" | "임박" | "D-day" | "지남" {
  if (!startDate?.trim()) return "예정";
  const start = parseLocalDate(startDate);
  if (!start) return "예정";
  const today = getKstDate();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const todayMs = today.getTime();
  const diffDays = Math.floor((startMs - todayMs) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "지남";
  if (diffDays === 0) return "D-day";
  if (diffDays <= 5) return "임박";
  return "예정";
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

const PAST_DATE_TOOLTIP = "예정된 날짜가 지났어요!";

function PastDateIndicator() {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTooltip]);

  return (
    <div
      ref={containerRef}
      className="absolute top-0 right-1 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowTooltip((prev) => !prev);
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
        aria-label="지난 날짜 안내"
      >
        <Info className="h-4 w-4" strokeWidth={2} />
      </button>
      {showTooltip && (
        <div
          className="absolute right-0 top-full mt-1 z-20 w-52 rounded-lg bg-[#1b0d14] text-white text-xs leading-relaxed px-3 py-2 shadow-lg"
          role="tooltip"
        >
          {PAST_DATE_TOOLTIP}
          <span className="absolute -top-1.5 right-4 w-2.5 h-2.5 bg-[#1b0d14] rotate-45" />
        </div>
      )}
    </div>
  );
}

function MainPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareCode = searchParams.get("share");
  const roomId = searchParams.get("roomId");
  const { weddingData, resetData } = useWedding();
  const { fetchWithAuth, setLoading } = useApi();
  const { subscribeToChatRooms, unreadCount } = useNotification();
  const [apiPlanData, setApiPlanData] = useState<PlanUserData | null | "none">(
    null,
  );
  const [totalAmountManwon, setTotalAmountManwon] = useState<number | null>(
    null,
  );
  const [usedAmountManwon, setUsedAmountManwon] = useState<number | null>(null);
  const [remainingAmountManwon, setRemainingAmountManwon] = useState<
    number | null
  >(null);
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

  // 스케줄 목록 상태 (상단으로 이동 - useCallback에서 사용하기 전에 정의)
  const [scheduleList, setScheduleList] = useState<ScheduleListItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleInitialFetched, setScheduleInitialFetched] = useState(false);
  const scheduleFetchingRef = useRef(false);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const togglingIdsRef = useRef<Set<number>>(new Set());
  const fetchingStatusRef = useRef<"NORMAL" | "COMPLETED" | null>(null);

  // 탭 및 카운트 상태
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [removedItems, setRemovedItems] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"planned" | "completed">(
    "planned",
  );
  const plannedListRef = useRef<ScheduleListItem[]>([]);
  const lastPlannedCountRef = useRef(0);
  const lastCompletedCountRef = useRef(0);
  const [plannedTotal, setPlannedTotal] = useState(0);
  const [completedTotal, setCompletedTotal] = useState(0);

  // 로그인 및 공유 모달 상태
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  /** READ 권한 멤버가 쓰기 동작을 시도했을 때 안내 */
  const [readOnlyNotice, setReadOnlyNotice] = useState<string | null>(null);
  const [loginRequiredTitle, setLoginRequiredTitle] = useState<
    string | undefined
  >(undefined);
  const [showGuestPlanLimitModal, setShowGuestPlanLimitModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortOptions, setSortOptions] = useState<PlanSortOption[]>([
    "date_desc",
  ]);

  // Guide Overlay State. 로그인 시: GET /plan/user 응답으로만 설정·참조( localStorage 미참조 )
  const [hasSeenMainGuide, setHasSeenMainGuide] = useState<boolean | null>(
    null,
  );
  const [showGuide, setShowGuide] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("전체");

  // Hydration: date-dependent UI only after mount so server and first client render match
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 가이드 표시: 로그인 시 GET /plan/user 응답만 사용( localStorage 참조 금지 ), 비로그인 시에만 localStorage
  useEffect(() => {
    if (getToken()) {
      // 로그인: API 응답(hasSeenMainGuide)으로만 판단
      if (hasSeenMainGuide !== false) return;
    } else {
      if (typeof window === "undefined") return;
      if (localStorage.getItem("hasSeenMainGuide") === "true") return;
    }
    const timer = setTimeout(() => setShowGuide(true), 1000);
    return () => clearTimeout(timer);
  }, [hasSeenMainGuide, tokenChecked]);

  const handleCloseGuide = useCallback(async () => {
    setShowGuide(false);
    setHasSeenMainGuide(true);
    if (getToken()) {
      try {
        await fetchWithAuth("/plan/user/has-seen-main-guide", {
          method: "POST",
          skipLoading: true,
        });
      } catch {
        // 무시
      }
    } else if (typeof window !== "undefined")
      localStorage.setItem("hasSeenMainGuide", "true");
  }, [fetchWithAuth]);

  const guideSteps: GuideStep[] = [
    {
      id: "main-header-info",
      title: "기본 정보",
      description:
        "신랑신부님의 이름과 D-day, 그리고 함께 관리하는 멤버를 확인할 수 있어요.",
    },
    {
      id: "main-budget-card",
      title: "예산 현황",
      description: "전체 예산 대비 현재까지의 지출 현황을 한눈에 파악하세요.",
    },
    {
      id: "main-tabs",
      title: "플랜 탭",
      description: "계획 중인 플랜과 완료된 플랜을 나누어 볼 수 있어요.",
      tooltipPosition: "above",
    },
    {
      id: "main-plan-list",
      title: "플랜 리스트",
      description:
        "등록된 스케줄을 확인하고 체크하여 완료 상태로 변경할 수 있어요.",
      spotlightOffset: { left: 12 },
      tooltipPosition: "above",
    },
    {
      id: "main-bottom-nav",
      title: "네비게이션",
      description: "다른 메뉴로 빠르게 이동할 수 있는 하단 메뉴바입니다.",
      tooltipAlign: "center",
    },
  ];

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
          fetchWithAuth(`/plan/user/${encodeURIComponent(code)}`, {
            skipLoading: true,
          }),
          fetchWithAuth(
            (() => {
              const opt = sortOptions[0] ?? "date_desc";
              const { sortColumn, sort } = getSortApiParams(opt);
              return `/plan/schedule/room/${encodeURIComponent(code)}/list?page=1&count=10000&sort=${sort}&sortColumn=${sortColumn}&status=NORMAL`;
            })(),
            { skipLoading: true },
          ),
          fetchWithAuth(`/plan/user/room/member/${encodeURIComponent(code)}`, {
            skipLoading: true,
          }),
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
          data?: {
            total?: number;
            list?: RoomMember[];
            members?: RoomMember[];
          };
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
          const list = memberJson.data.list ?? memberJson.data.members ?? [];
          setRoomMembers(Array.isArray(list) ? list : []);
        }
      } catch {
        setSharedRoomUser("error");
      } finally {
        sharedFetchingRef.current = false;
      }
    },
    [fetchWithAuth, sortOptions],
  );

  const fetchingSharedStatusRef = useRef<"NORMAL" | "COMPLETED" | null>(null);
  const fetchSharedRoomScheduleList = useCallback(
    async (status: "NORMAL" | "COMPLETED") => {
      const code = shareCode?.trim();
      if (!code || !getToken()) return;
      fetchingSharedStatusRef.current = status;
      setScheduleLoading(true);
      try {
        const opt = sortOptions[0] ?? "date_desc";
        const { sortColumn, sort } = getSortApiParams(opt);
        const res = await fetchWithAuth(
          `/plan/schedule/room/${encodeURIComponent(code)}/list?page=1&count=10000&sort=${sort}&sortColumn=${sortColumn}&status=${status}`,
          { skipLoading: true },
        );
        const json = (await res.json()) as {
          result?: boolean;
          data?: { total: number; list: ScheduleListItem[] };
        };
        if (fetchingSharedStatusRef.current !== status) return;
        if (json.result === true && json.data?.list) {
          setSharedRoomScheduleList((prev) => {
            const other = prev.filter((p) => p.status !== status);
            return [...other, ...json.data!.list];
          });
        } else {
          setSharedRoomScheduleList((prev) =>
            prev.filter((p) => p.status !== status),
          );
        }
      } catch {
        if (fetchingSharedStatusRef.current === status) {
          setSharedRoomScheduleList((prev) =>
            prev.filter((p) => p.status !== status),
          );
        }
      } finally {
        setScheduleLoading(false);
      }
    },
    [fetchWithAuth, shareCode, sortOptions],
  );

  const fetchSharedRoomCounts = useCallback(
    async (code: string) => {
      if (!getToken()) return;
      try {
        const [normRes, compRes] = await Promise.all([
          fetchWithAuth(
            `/plan/schedule/room/${encodeURIComponent(code)}/list?page=1&count=1&status=NORMAL`,
            { skipLoading: true },
          ),
          fetchWithAuth(
            `/plan/schedule/room/${encodeURIComponent(code)}/list?page=1&count=1&status=COMPLETED`,
            { skipLoading: true },
          ),
        ]);
        const normJson = await normRes.json();
        const compJson = await compRes.json();
        if (normJson.result === true) setPlannedTotal(normJson.data.total ?? 0);
        if (compJson.result === true)
          setCompletedTotal(compJson.data.total ?? 0);
      } catch {
        // ignore
      }
    },
    [fetchWithAuth],
  );

  const fetchPersonalCounts = useCallback(
    async (roomIdParam?: string) => {
      if (!getToken()) return;
      try {
        const baseUrl = roomIdParam?.trim()
          ? `/plan/schedule/room/${encodeURIComponent(roomIdParam.trim())}/list`
          : "/plan/schedule/list";
        const [normRes, compRes] = await Promise.all([
          fetchWithAuth(`${baseUrl}?page=1&count=1&status=NORMAL`, {
            skipLoading: true,
          }),
          fetchWithAuth(`${baseUrl}?page=1&count=1&status=COMPLETED`, {
            skipLoading: true,
          }),
        ]);
        const normJson = await normRes.json();
        const compJson = await compRes.json();
        if (normJson.result === true) setPlannedTotal(normJson.data.total ?? 0);
        if (compJson.result === true)
          setCompletedTotal(compJson.data.total ?? 0);
      } catch {
        // ignore
      }
    },
    [fetchWithAuth],
  );

  const fetchPlanUser = useCallback(
    async (
      onApiError: (status?: number) => void,
      roomIdParam?: string,
    ): Promise<PlanUserData | null | "none"> => {
      if (!getToken()) {
        setApiPlanData("none");
        return "none";
      }
      try {
        const url = roomIdParam?.trim()
          ? `/plan/room/${encodeURIComponent(roomIdParam.trim())}`
          : "/plan/user";
        const res = await fetchWithAuth(url, { skipLoading: true });
        if (cancelledRef.current) return null;
        const json = (await res.json()) as {
          result?: boolean;
          data?: PlanUserData;
        };
        if (cancelledRef.current) return null;
        if (json.result === true && json.data) {
          setApiPlanData(json.data);

          // SSE Subscription
          if (json.data.chatRooms && json.data.chatRooms.length > 0) {
            const roomIds = json.data.chatRooms.map((r) => r.id);
            subscribeToChatRooms(roomIds);
          }

          return json.data;
        }
        setApiPlanData("none");
        if (!res.ok) onApiError(res.status);
        return "none";
      } catch {
        if (!cancelledRef.current) onApiError();
        return null;
      }
    },
    [fetchWithAuth, subscribeToChatRooms],
  );

  const fetchTotalAmount = useCallback(
    async (onApiError: (status?: number) => void, roomIdParam?: string) => {
      if (!getToken()) {
        setTotalAmountManwon(0);
        setUsedAmountManwon(null);
        setRemainingAmountManwon(null);
        return;
      }
      const url = roomIdParam?.trim()
        ? `/plan/room/total-amount/${encodeURIComponent(roomIdParam.trim())}`
        : "/plan/user/total-amount";
      try {
        const res = await fetchWithAuth(url, { skipLoading: true });
        if (cancelledRef.current) return;
        const json = (await res.json()) as {
          result?: boolean;
          data?: {
            totalAmount?: number;
            usedAmount?: number;
            remainingAmount?: number;
          };
        };
        if (cancelledRef.current) return;
        if (json.result === true && json.data) {
          setTotalAmountManwon(json.data.totalAmount ?? 0);
          setUsedAmountManwon(json.data.usedAmount ?? 0);
          setRemainingAmountManwon(json.data.remainingAmount ?? 0);
        } else {
          setTotalAmountManwon(0);
          setUsedAmountManwon(0);
          setRemainingAmountManwon(0);
          if (!res.ok) onApiError(res.status);
        }
      } catch {
        if (!cancelledRef.current) {
          setTotalAmountManwon(0);
          setUsedAmountManwon(0);
          setRemainingAmountManwon(0);
          onApiError();
        }
      }
    },
    [fetchWithAuth],
  );

  /** 401이면 모달 없이 / 로만 이동, 그 외에는 api_error=1 로 ApiErrorModal 표시 */
  const handleApiError = useCallback(
    (status?: number) => {
      // 비로그인 게스트 사용자(setting 완료 후 /main 진입)는 401이어도 데이터 유지
      const isGuestUser =
        typeof window !== "undefined" &&
        !getToken() &&
        sessionStorage.getItem(HAS_COMPLETED_GUEST_SETTING_KEY) === "1";

      if (status === 401 && isGuestUser) {
        // 게스트 사용자는 401이 정상 (토큰 없으므로), 데이터 삭제하지 않고 그대로 유지
        return;
      }

      // 인증이 끊긴 경우(401/403)에만 저장 데이터를 정리한다.
      // 5xx·네트워크 오류(status undefined)로 지우면 일시적 장애에
      // 사용자가 강제 로그아웃되고 게스트 데이터까지 날아간다.
      const isAuthFailure = status === 401 || status === 403;
      if (isAuthFailure) {
        clearAllStoredData();
        resetData();
        router.replace("/");
        return;
      }

      router.replace("/?api_error=1");
    },
    [resetData, router],
  );

  // 비로그인 + share 없을 때: setting 미완료(플래그 없음) → / 로 리다이렉트
  useEffect(() => {
    if (getToken() || shareCode?.trim()) return;
    const hasCompleted =
      typeof window !== "undefined" &&
      sessionStorage.getItem(HAS_COMPLETED_GUEST_SETTING_KEY) === "1";
    if (!hasCompleted) {
      router.replace("/");
    }
  }, [shareCode, router]);

  // 로그인되어 있을 때만 API 사용. 비로그인(setting→main 로그인 없이 둘러보기 등) 시 API 호출 없음
  useEffect(() => {
    const token = getToken();
    setTokenChecked(true);
    if (!token) {
      setApiPlanData("none");
      setTotalAmountManwon(0);
      setUsedAmountManwon(null);
      setRemainingAmountManwon(null);
      return;
    }
    cancelledRef.current = false;

    const syncGuestGuideThenProceed = async () => {
      const seenMain =
        typeof window !== "undefined" &&
        localStorage.getItem("hasSeenMainGuide") === "true";
      const seenBudget =
        typeof window !== "undefined" &&
        localStorage.getItem("hasSeenBudgetGuide") === "true";
      if (seenMain || seenBudget) {
        try {
          await fetchWithAuth("/plan/user/has-seen-main-guide", {
            method: "POST",
            skipLoading: true,
          });
          await fetchWithAuth("/plan/user/has-seen-budget-guide", {
            method: "POST",
            skipLoading: true,
          });
          if (typeof window !== "undefined") {
            localStorage.removeItem("hasSeenMainGuide");
            localStorage.removeItem("hasSeenBudgetGuide");
            sessionStorage.removeItem("hasSeenMainGuide");
            sessionStorage.removeItem("hasSeenBudgetGuide");
          }
        } catch {
          // 무시
        }
      }
    };

    const roomIdParam = roomId?.trim();

    (async () => {
      // Disable global loading modal for /main to show skeleton instead
      setLoading(false);

      // Small delay for smooth navigation
      await new Promise((r) => setTimeout(r, 100));
      if (cancelledRef.current) return;

      if (shareCode?.trim()) {
        await syncGuestGuideThenProceed();
        if (cancelledRef.current) return;
        await Promise.all([
          fetchPlanUser(handleApiError),
          fetchTotalAmount(handleApiError),
        ]);
        if (!cancelledRef.current) {
          fetchSharedRoomWithAuth(shareCode.trim());
          fetchSharedRoomCounts(shareCode.trim());
        }
      } else if (roomIdParam) {
        setApiPlanData(null);
        setScheduleList([]);
        setScheduleInitialFetched(false);
        // Important: All concurrent fetches must be inside this block
        const [planUserData] = await Promise.all([
          fetchPlanUser(handleApiError, roomIdParam),
          fetchTotalAmount(handleApiError, roomIdParam),
          fetchPersonalCounts(roomIdParam),
        ]);
        if (cancelledRef.current) return;

        await syncGuestGuideThenProceed();
        if (cancelledRef.current) return;
        // fetchPlanUser 가 이미 /plan/user 를 받아오고 SSE 구독까지 하므로
        // 가이드 플래그만 보려고 같은 요청을 한 번 더 하지 않는다.
        setHasSeenMainGuide(
          planUserData && planUserData !== "none"
            ? (planUserData.hasSeenMainGuide ?? true)
            : true,
        );
      } else {
        setApiPlanData(null);
        setScheduleList([]);
        setScheduleInitialFetched(false);

        await syncGuestGuideThenProceed();
        if (cancelledRef.current) return;
        const planData = await fetchPlanUser(handleApiError);
        if (cancelledRef.current) return;

        setHasSeenMainGuide(
          planData && planData !== "none"
            ? (planData.hasSeenMainGuide ?? true)
            : true,
        );
        const roomIdForAmount =
          planData && planData !== "none" && planData.roomId != null
            ? String(planData.roomId)
            : undefined;
        await Promise.all([
          fetchTotalAmount(handleApiError, roomIdForAmount),
          fetchPersonalCounts(roomIdForAmount),
        ]);
      }
    })();
    // eslint-disable-next-line consistent-return -- useEffect cleanup is valid
    return () => {
      cancelledRef.current = true;
    };
  }, [
    fetchPlanUser,
    fetchTotalAmount,
    fetchWithAuth,
    fetchSharedRoomWithAuth,
    fetchSharedRoomCounts,
    fetchPersonalCounts,
    handleApiError,
    shareCode,
    roomId,
    setLoading,
    subscribeToChatRooms,
  ]);

  // 자신의 플랜이 없는 경우 안내 모달 표시 및 블러 처리
  useEffect(() => {
    const isPlanIncomplete = () => {
      if (apiPlanData === "none") return true;
      if (!apiPlanData || typeof apiPlanData === "string") return false;
      const hasWeddingDate = !!apiPlanData.weddingDate?.trim();
      const hasName = !!apiPlanData.name?.trim();
      // budget은 0일 수도 있으므로 null/undefined만 체크하거나 0 이상 조건 (여기서는 null체크)
      const hasBudget =
        apiPlanData.budget !== null && apiPlanData.budget !== undefined;
      return !hasWeddingDate || !hasName || !hasBudget;
    };

    if (
      tokenChecked &&
      getToken() &&
      !shareCode &&
      !roomId?.trim() &&
      isPlanIncomplete()
    ) {
      setShowNoPlanModal(true);
      setIsNoPlanBlur(true);
      setShowGuide(false); // 노플랜 모달이 뜰 때는 가이드 오버레이 표시 안 함
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
        venue: null,
      };
    }
    if (apiPlanData && apiPlanData !== "none") {
      const date = parseWeddingDate(apiPlanData.weddingDate);
      return {
        name: apiPlanData.name ?? "",
        budget: String(apiPlanData.budget ?? 1000),
        date,
        venue: apiPlanData.weddingVenue ?? null,
      };
    }
    // JWT 없음 → 세션 스토리지에 있는 이름·날짜·예산 적용
    return {
      name: weddingData.name ?? "",
      budget: weddingData.budget ?? "1000",
      date: weddingData.date,
      venue: null,
    };
  }, [shareCode, apiPlanData, sharedRoomUser, weddingData]);

  const isSharedView =
    !!shareCode && sharedRoomUser && sharedRoomUser !== "error";
  const isSharedLoading = !!shareCode && sharedRoomUser === null;
  const isRoomView =
    !!roomId?.trim() ||
    (apiPlanData && apiPlanData !== "none" && !!apiPlanData.roomId);

  /** roomId 모드에서 현재 로그인 유저의 해당 방 권한. READ면 플랜 추가 버튼 숨김 */
  const myRoomPermission = useMemo(() => {
    if (
      !isRoomView ||
      !apiPlanData ||
      apiPlanData === "none" ||
      !apiPlanData.members?.length
    )
      return undefined;
    const myId = String(getPlanUserIdFromToken() ?? "")
      .trim()
      .toLowerCase();
    if (!myId) return undefined;
    const me = apiPlanData.members.find(
      (m) =>
        String(m.planUserId ?? "")
          .trim()
          .toLowerCase() === myId,
    );
    return me?.permission ?? undefined;
  }, [isRoomView, apiPlanData]);

  const isPlanLoading = Boolean(
    !tokenChecked ||
    isSharedLoading ||
    (getToken() && !shareCode && !roomId?.trim() && apiPlanData === null) ||
    (getToken() && roomId?.trim() && apiPlanData === null),
  );

  const dDay = useMemo(() => getDDay(displayData.date), [displayData.date]);
  const dDayLabel = (() => {
    if (dDay === null) return "날짜 설정";
    if (dDay > 0) return `D-${dDay}`;
    if (dDay === 0) return "D-Day";
    return `D+${Math.abs(dDay)}`;
  })();
  const weddingDateText = formatWeddingDate(displayData.date);

  const effectiveScheduleList = isSharedView
    ? sharedRoomScheduleList
    : scheduleList;

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
  // 공유 뷰·참여 플랜(roomId) 또는 비로그인 시 스케줄 합산, 로그인 시 API 값 사용 (user: /plan/user/total-amount, room: /plan/room/total-amount/{id})
  const useApiAmounts =
    !isSharedView &&
    getToken() &&
    (remainingAmountManwon != null || usedAmountManwon != null);
  const usedBudget = useApiAmounts
    ? (usedAmountManwon ?? totalAmountManwon ?? 0)
    : guestUsedBudget; // 지출 예정 총액 (만원)
  const remainingBudget =
    useApiAmounts && remainingAmountManwon != null
      ? remainingAmountManwon
      : initialBudget - usedBudget; // 남은 예산: API remainingAmount 우선, 없으면 계산값

  // 예산 사용률 계산: 로그인 시 API totalAmount·usedAmount 기준 (user/room 공통), 그 외에는 initialBudget·usedBudget
  const budgetUsagePercentage = (() => {
    if (
      !isSharedView &&
      getToken() &&
      totalAmountManwon != null &&
      totalAmountManwon > 0 &&
      usedAmountManwon != null
    ) {
      return Math.round((usedAmountManwon / totalAmountManwon) * 100);
    }
    return initialBudget > 0
      ? Math.round((usedBudget / initialBudget) * 100)
      : 0;
  })();
  const budgetUsagePercentageForBar = Math.max(
    0,
    Math.min(100, budgetUsagePercentage),
  );

  // 예산 사용률에 따른 그라데이션 색상 계산
  const getGradientColors = () => {
    return `linear-gradient(135deg, #ee2b8c 0%, #ff5c95 100%)`;
  };

  const budgetGradient = getGradientColors();

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
    async (roomIdParam?: string, status?: "NORMAL" | "COMPLETED") => {
      const token = getToken();
      if (!token) {
        // 비로그인(게스트)은 로컬 스토리지 데이터 사용
        const guestList = getGuestScheduleList();
        setScheduleList(guestList);
        setScheduleInitialFetched(true);
        setRemovedItems(new Set()); // 탭 전환 시 애니메이션 상태 초기화
        return;
      }
      const requestedStatus = status ?? "NORMAL";
      fetchingStatusRef.current = requestedStatus;
      scheduleFetchingRef.current = true;
      setScheduleLoading(true);
      try {
        const opt = sortOptions[0] ?? "date_desc";
        const { sortColumn, sort } = getSortApiParams(opt);
        const params = new URLSearchParams({
          page: "1",
          count: String(SCHEDULE_FETCH_COUNT),
          sort,
          sortColumn,
        });
        if (requestedStatus) params.set("status", requestedStatus);
        const url = roomIdParam?.trim()
          ? `/plan/schedule/room/${encodeURIComponent(roomIdParam.trim())}/list?${params.toString()}`
          : `/plan/schedule/list?${params.toString()}`;
        const res = await fetchWithAuth(url, { skipLoading: true });
        const json = (await res.json()) as {
          result?: boolean;
          data?: { total: number; list: ScheduleListItem[] };
        };
        if (json.result === true && json.data) {
          const { total, list } = json.data;
          if (fetchingStatusRef.current === requestedStatus) {
            if (requestedStatus === "NORMAL") setPlannedTotal(total);
            else setCompletedTotal(total);
            setScheduleList((prev) => {
              const other = prev.filter((p) => p.status !== requestedStatus);
              return [...other, ...list];
            });
            setRemovedItems(new Set()); // 신규 리스트 로드 시 애니메이션 상태 초기화
          }
        } else if (fetchingStatusRef.current === requestedStatus) {
          setScheduleList((prev) =>
            prev.filter((p) => p.status !== requestedStatus),
          );
          setRemovedItems(new Set());
        }
      } catch {
        if (fetchingStatusRef.current === requestedStatus) {
          setScheduleList((prev) =>
            prev.filter((p) => p.status !== requestedStatus),
          );
          setRemovedItems(new Set());
        }
      } finally {
        setScheduleLoading(false);
        setScheduleInitialFetched(true);
        scheduleFetchingRef.current = false;
      }
    },
    [fetchWithAuth, sortOptions],
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
      fetchScheduleList(roomIdParam, "NORMAL");
    } else {
      fetchScheduleList(undefined, "NORMAL");
    }
  }, [fetchScheduleList, shareCode, roomId, apiPlanData]);

  // 필터(sortOptions) 변경 시 현재 탭에 맞게 리패치 (완료 탭에서 필터 선택 시에도 적용)
  const prevSortOptionsRef = useRef(sortOptions);
  useEffect(() => {
    if (prevSortOptionsRef.current === sortOptions) return;
    prevSortOptionsRef.current = sortOptions;
    if (!getToken()) return;
    const status = activeTab === "planned" ? "NORMAL" : "COMPLETED";
    const roomIdParam =
      roomId?.trim() ||
      (apiPlanData && apiPlanData !== "none" && apiPlanData.roomId
        ? String(apiPlanData.roomId)
        : null);
    if (shareCode?.trim()) {
      fetchSharedRoomScheduleList(status);
    } else if (apiPlanData !== null) {
      fetchScheduleList(roomIdParam ?? undefined, status);
    }
  }, [
    sortOptions,
    activeTab,
    shareCode,
    roomId,
    apiPlanData,
    fetchSharedRoomScheduleList,
    fetchScheduleList,
  ]);

  // 탭별 리스트 카운킹 (게스트 모드는 로컬 리스트 기준, 로그인 모드는 명시적 상태 활용)
  const plannedCount = useMemo(() => {
    if (!getToken()) {
      return effectiveScheduleList.filter(
        (p) => p.status === "NORMAL" && !removedItems.has(p.id),
      ).length;
    }
    return plannedTotal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScheduleList.length, plannedTotal, removedItems.size]);

  const completedCount = useMemo(() => {
    if (!getToken()) {
      return effectiveScheduleList.filter(
        (p) => p.status === "COMPLETED" && !removedItems.has(p.id),
      ).length;
    }
    return completedTotal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScheduleList.length, completedTotal, removedItems.size]);

  const baseVisibleList = useMemo(() => {
    const targetStatus = activeTab === "planned" ? "NORMAL" : "COMPLETED";
    return effectiveScheduleList.filter((plan) => {
      const isMatch = plan.status === targetStatus;
      const isBeingToggled = togglingIds.has(plan.id);
      // 토글 중인 동안은 필터링에서 제외되지 않도록 유지하여 애니메이션 유도
      return isMatch || isBeingToggled;
    });
  }, [effectiveScheduleList, activeTab, togglingIds]);

  // 카테고리 순서를 알파벳순으로 고정 → 필터(정렬) 리패치 시 순서가 바뀌지 않아 스크롤 위치 유지
  const currentTabCategories = useMemo(() => {
    const cats = baseVisibleList
      .map((p) => p.categoryName)
      .filter((c) => c && c.trim() !== "");
    const unique = Array.from(new Set(cats)).sort((a, b) =>
      a.localeCompare(b, "ko"),
    );
    return ["전체", ...unique];
  }, [baseVisibleList]);

  // 필터로 고른 카테고리의 마지막 플랜을 완료하면 그 칩이 목록에서
  // 사라지는데 selectedCategory 는 남아, 다른 카테고리에 플랜이 있어도
  // "모든 플랜을 완료했어요"만 보였다. 사라지면 전체로 되돌린다.
  useEffect(() => {
    if (selectedCategory === "전체") return;
    if (currentTabCategories.includes(selectedCategory)) return;
    setSelectedCategory("전체");
  }, [currentTabCategories, selectedCategory]);

  const visibleScheduleList = useMemo(() => {
    const list =
      selectedCategory === "전체"
        ? [...baseVisibleList]
        : baseVisibleList.filter((p) => p.categoryName === selectedCategory);

    const compare = (
      a: ScheduleListItem,
      b: ScheduleListItem,
      opt: PlanSortOption,
    ): number => {
      switch (opt) {
        case "price_desc":
          return (b.amount ?? 0) - (a.amount ?? 0);
        case "price_asc":
          return (a.amount ?? 0) - (b.amount ?? 0);
        case "date_desc": {
          // ?? 는 빈 문자열을 걸러내지 못해 new Date("").getTime() 이 NaN 이
          // 되고, comparator 가 NaN 을 반환하면 sort 가 "같음"으로 취급해
          // 미정 항목이 섞인 목록의 순서가 예측 불가능해졌다.
          const aTime = getSortTime(a);
          const bTime = getSortTime(b);
          if (aTime === null && bTime === null) return b.id - a.id;
          if (aTime === null) return 1; // 날짜 없는 항목은 뒤로
          if (bTime === null) return -1;
          return bTime - aTime;
        }
        case "date_asc": {
          const aTime = getSortTime(a);
          const bTime = getSortTime(b);
          if (aTime === null && bTime === null) return a.id - b.id;
          if (aTime === null) return 1;
          if (bTime === null) return -1;
          return aTime - bTime;
        }
        case "name_desc":
          return (b.title ?? "").localeCompare(a.title ?? "", "ko");
        case "name_asc":
          return (a.title ?? "").localeCompare(b.title ?? "", "ko");
        default:
          return 0;
      }
    };

    const opts =
      sortOptions.length > 0
        ? sortOptions
        : (["date_desc"] as PlanSortOption[]);
    return [...list].sort((a, b) => {
      let result = 0;
      opts.some((opt) => {
        result = compare(a, b, opt);
        return result !== 0;
      });
      return result;
    });
  }, [baseVisibleList, selectedCategory, sortOptions]);

  if (!scheduleLoading && !isSharedLoading) {
    lastPlannedCountRef.current =
      activeTab === "planned"
        ? baseVisibleList.length
        : lastPlannedCountRef.current;
    lastCompletedCountRef.current =
      activeTab === "completed"
        ? baseVisibleList.length
        : lastCompletedCountRef.current;
  }
  const displayCount =
    scheduleLoading || isSharedLoading
      ? activeTab === "planned"
        ? lastPlannedCountRef.current
        : lastCompletedCountRef.current
      : baseVisibleList.length;

  const mainScrollRef = useRef<HTMLElement>(null);
  const firstSectionRef = useRef<HTMLDivElement>(null);
  const secondSectionRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const selectedCategoryButtonRef = useRef<HTMLButtonElement | null>(null);
  const categoryDragRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    hasMoved: false,
  });
  const [allowPlanListScroll, setAllowPlanListScroll] = useState(false);

  // PC에서 카테고리 영역 드래그 스크롤 (드래그 시 버튼 클릭 방지)
  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;

    const handleMouseDown = (e: MouseEvent) => {
      categoryDragRef.current = {
        active: true,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        hasMoved: false,
      };
    };
    const DRAG_THRESHOLD = 5;
    const handleMouseMove = (e: MouseEvent) => {
      const ref = categoryDragRef.current;
      if (!ref.active) return;
      const dx = Math.abs(e.clientX - ref.startX);
      if (dx >= DRAG_THRESHOLD) ref.hasMoved = true;
      el.scrollLeft = ref.startScrollLeft + (ref.startX - e.clientX);
    };
    const handleMouseUp = () => {
      categoryDragRef.current.active = false;
    };
    const handleClickCapture = (e: MouseEvent) => {
      if (categoryDragRef.current.hasMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    el.addEventListener("click", handleClickCapture, true);
    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      el.removeEventListener("click", handleClickCapture, true);
    };
  }, []);

  // 리패치 후에도 선택한 카테고리가 보이도록 스크롤 (전체가 아닐 때만)
  const prevListRef = useRef(effectiveScheduleList);
  useEffect(() => {
    if (selectedCategory === "전체") return;
    if (prevListRef.current === effectiveScheduleList) return;
    prevListRef.current = effectiveScheduleList;
    const btn = selectedCategoryButtonRef.current;
    if (!btn) return;
    const scrollToSelected = () => {
      btn.scrollIntoView({ inline: "center", block: "nearest" });
    };
    scrollToSelected();
    const t1 = setTimeout(scrollToSelected, 100);
    const t2 = setTimeout(scrollToSelected, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [effectiveScheduleList, selectedCategory]);

  const scrollDirection = useScrollDirection(mainScrollRef);

  const { scrollY } = useScroll({ container: mainScrollRef });

  // 메인 스크롤이 상단 섹션(헤더+예산)을 완전히 올린 뒤에만 플랜 리스트 스크롤 허용
  useEffect(() => {
    const main = mainScrollRef.current;
    if (!main) return;
    const check = () => {
      const first = firstSectionRef.current;
      const threshold = first ? first.offsetHeight : 280;
      const scrolledEnough = main.scrollTop >= Math.max(0, threshold - 10);
      setAllowPlanListScroll((prev) => {
        if (scrolledEnough && !prev) return true;
        if (!scrolledEnough && prev) return false;
        return prev;
      });
    };
    main.addEventListener("scroll", check, { passive: true });
    const raf = requestAnimationFrame(check);
    return () => {
      main.removeEventListener("scroll", check);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 뒤로가기 시 플랜 리스트 섹션으로 복구
  useEffect(() => {
    if (mounted && mainScrollRef.current) {
      const returnToPlanList =
        sessionStorage.getItem("returnToPlanList") === "true";
      if (returnToPlanList) {
        sessionStorage.removeItem("returnToPlanList");
        setTimeout(() => {
          secondSectionRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 150);
      }
    }
  }, [mounted]);
  const headerOpacity = useTransform(scrollY, [50, 200], [1, 0.2]);
  const headerScale = useTransform(scrollY, [0, 200], [1, 0.9]);

  /** 넓은 화면의 좌측 컬럼에 붙는 대화 목록 (GET /plan/user 의 chatRooms) */
  const chatRoomsForPanel =
    apiPlanData && apiPlanData !== "none" ? (apiPlanData.chatRooms ?? []) : [];

  const checkedItemsRef = useRef<Set<number>>(checkedItems);
  const scheduleListRef = useRef(scheduleList);
  const sharedScheduleListRef = useRef(sharedRoomScheduleList);
  checkedItemsRef.current = checkedItems;
  scheduleListRef.current = scheduleList;
  // 공유 뷰의 항목은 sharedRoomScheduleList 에만 있어, 개인 리스트만 보면
  // 토글 시 현재 상태를 못 찾아 이미 완료인 항목에 다시 COMPLETED 를 보냈다.
  sharedScheduleListRef.current = sharedRoomScheduleList;
  if (activeTab === "planned") plannedListRef.current = visibleScheduleList;

  /**
   * 플랜 추가로 이동. 로그인·게스트 한도 분기를 한 곳에 모은다.
   * 리스트 상단의 "추가" 버튼과 대시보드 상단 바가 같은 경로를 쓴다.
   */
  /**
   * 넓은 화면(>=1024)에서 오른쪽에 여는 플랜 등록 pane.
   * 좁은 화면은 지금처럼 /add-plen 으로 간다.
   */
  const isDesktopWidth = useIsDesktop();
  const [isAddPaneOpen, setIsAddPaneOpen] = useState(false);
  /**
   * 넓은 화면에서 오른쪽에 여는 플랜 상세. 등록 pane 과 자리를 나눠 쓰므로
   * 둘 중 하나만 열린다. 좁은 화면은 지금처럼 /schedule-detail 로 간다.
   */
  const [inspectorScheduleId, setInspectorScheduleId] = useState<number | null>(
    null,
  );
  /** 등록이 끝나면 올려서 대시보드가 일정·예산을 다시 받게 한다 */
  const [dashboardRefresh, setDashboardRefresh] = useState(0);

  const handleAddPlan = useCallback(() => {
    // 공유 뷰에서는 내 방 id 를 붙이지 않는다 (내 플랜에 저장되던 문제)
    const roomIdValue = isSharedView
      ? roomId
      : (roomId ??
        (apiPlanData && apiPlanData !== "none" && apiPlanData.roomId
          ? String(apiPlanData.roomId)
          : null));

    const addPlanPath = roomIdValue
      ? `/add-plen?roomId=${roomIdValue}`
      : "/add-plen";
    if (getToken()) {
      if (isDesktopWidth) {
        setInspectorScheduleId(null);
        setIsAddPaneOpen(true);
        return;
      }
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
    if (isDesktopWidth) {
      setInspectorScheduleId(null);
      setIsAddPaneOpen(true);
      return;
    }
    router.push(addPlanPath);
  }, [
    apiPlanData,
    effectiveScheduleList.length,
    isDesktopWidth,
    isSharedView,
    roomId,
    router,
  ]);

  // 체크박스 토글 핸들러 (PATCH /plan/schedule/status/{id} — COMPLETED / NORMAL)
  const handleToggleCheck = useCallback(
    async (id: number) => {
      if (!getToken()) {
        setShowLoginRequiredModal(true);
        return;
      }
      // 권한은 추가 버튼 노출에만 쓰이고 토글에는 검사가 없었다.
      // READ 멤버가 체크하면 서버가 거절해 카운트만 깜빡였다 원복됐다.
      if (String(myRoomPermission ?? "").toUpperCase() === "READ") {
        setReadOnlyNotice("읽기 권한만 있어 플랜 상태를 변경할 수 없습니다.");
        return;
      }
      if (togglingIdsRef.current.has(id)) return;
      togglingIdsRef.current.add(id);
      setTogglingIds((prev) => new Set(prev).add(id));

      const plan =
        scheduleListRef.current.find((p) => p.id === id) ??
        sharedScheduleListRef.current.find((p) => p.id === id);
      const isCurrentlyChecked =
        checkedItemsRef.current.has(id) || plan?.status === "COMPLETED";
      const newStatus = isCurrentlyChecked ? "NORMAL" : "COMPLETED";

      setCheckedItems((prev) => {
        const next = new Set(prev);
        if (isCurrentlyChecked) next.delete(id);
        else next.add(id);
        return next;
      });

      // 낙관적 업데이트: 카운트 즉시 반영
      if (newStatus === "COMPLETED") {
        setPlannedTotal((prev) => Math.max(0, prev - 1));
        setCompletedTotal((prev) => prev + 1);
      } else {
        setCompletedTotal((prev) => Math.max(0, prev - 1));
        setPlannedTotal((prev) => prev + 1);
      }

      // 1. '비행 준비' 상태(removedItems)를 먼저 반영 (AnimatePresence의 exit prop 결정용)
      setRemovedItems((prev) => new Set(prev).add(id));

      // 2. 약간의 시간차(100ms)를 두어 리스트에서 실제로 제거 (이때 AnimatePresence가 날아가는 exit 애니메이션 실행)
      setTimeout(() => {
        togglingIdsRef.current.delete(id);
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 350); // 충분한 렌더링 결합 방지 시간

      try {
        const res = await fetchWithAuth(`/plan/schedule/status/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
          skipLoading: true,
        });
        const json = (await res.json()) as { result?: boolean };
        if (res.ok && json.result) {
          // 완료 탭에 바로 반영되도록 로컬 리스트의 status 갱신
          const updateStatus = (list: ScheduleListItem[]) =>
            list.map((p) => (p.id === id ? { ...p, status: newStatus } : p));
          setScheduleList((prev) => updateStatus(prev));
          setSharedRoomScheduleList((prev) => updateStatus(prev));
          // 예산·카테고리·대시보드 목록까지 서버 값으로 맞춘다.
          // 완료로 바꾸면 "이번 달 지출"과 카테고리 비중이 함께 움직인다.
          setDashboardRefresh((n) => n + 1);
        } else {
          // 실패 시 카운트 복구
          if (newStatus === "COMPLETED") {
            setPlannedTotal((prev) => prev + 1);
            setCompletedTotal((prev) => Math.max(0, prev - 1));
          } else {
            setCompletedTotal((prev) => prev + 1);
            setPlannedTotal((prev) => Math.max(0, prev - 1));
          }
          setCheckedItems((prev) => {
            const revert = new Set(prev);
            if (isCurrentlyChecked) revert.add(id);
            else revert.delete(id);
            return revert;
          });
          setRemovedItems((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      } catch {
        // 에러 시 카운트 복구
        if (newStatus === "COMPLETED") {
          setPlannedTotal((prev) => prev + 1);
          setCompletedTotal((prev) => Math.max(0, prev - 1));
        } else {
          setCompletedTotal((prev) => prev + 1);
          setPlannedTotal((prev) => Math.max(0, prev - 1));
        }
        setCheckedItems((prev) => {
          const revert = new Set(prev);
          if (isCurrentlyChecked) revert.add(id);
          else revert.delete(id);
          return revert;
        });
        setRemovedItems((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } finally {
        // togglingId 제거는 위에서 선언한 setTimeout(300ms)에서 담당함
      }
    },
    [fetchWithAuth, myRoomPermission],
  );

  // 공유 뷰(?share=)에서는 내 방 roomId 로 폴백하면 안 된다.
  // 남의 플랜을 보는 중인데 내 방 id 가 붙어 상세·추가가 엉뚱한 곳으로 갔다.
  const roomIdForDetail = isSharedView
    ? roomId?.trim() || null
    : roomId?.trim() ||
      (apiPlanData && apiPlanData !== "none" && apiPlanData.roomId
        ? String(apiPlanData.roomId)
        : null);

  /**
   * 예정 지출. 예산 패널의 "예정된 지출까지 반영하면 …" 문구에 쓴다.
   * GET /plan/user/amount/detail (방이면 /plan/room/amount/detail/{roomId})
   */
  const [plannedUseAmount, setPlannedUseAmount] = useState<number | null>(null);
  useEffect(() => {
    if (!getToken() || isSharedView) return;
    let cancelled = false;
    (async () => {
      try {
        const url = roomIdForDetail
          ? `/plan/room/amount/detail/${encodeURIComponent(roomIdForDetail)}`
          : "/plan/user/amount/detail";
        const res = await fetchWithAuth(url, { skipLoading: true });
        const json = (await res.json().catch(() => null)) as {
          result?: boolean;
          data?: { plannedUseAmount?: number };
        } | null;
        if (!cancelled && json?.result === true && json.data) {
          setPlannedUseAmount(json.data.plannedUseAmount ?? null);
        }
      } catch {
        // 예산 패널의 부가 문구라 실패해도 조용히 넘어간다
      }
    })();
    return () => {
      cancelled = true;
    };
    // dashboardRefresh: 플랜을 추가하거나 완료를 바꾸면 다시 받는다
  }, [fetchWithAuth, isSharedView, roomIdForDetail, dashboardRefresh]);

  /**
   * 플랜이 바뀌면 예산 숫자(남은 금액·사용액)도 바로 따라와야 한다.
   *
   * 부트스트랩 effect 에 매달면 SSE 재구독·가이드 동기화까지 다시 돌아서,
   * 예산에 필요한 요청만 따로 받는다. 첫 렌더는 부트스트랩이 이미 받아
   * 왔으므로 건너뛴다.
   */
  const budgetSyncedOnceRef = useRef(false);
  useEffect(() => {
    if (!budgetSyncedOnceRef.current) {
      budgetSyncedOnceRef.current = true;
      return;
    }
    if (!getToken() || isSharedView) return;
    fetchTotalAmount(handleApiError, roomIdForDetail ?? undefined);
  }, [
    dashboardRefresh,
    fetchTotalAmount,
    handleApiError,
    isSharedView,
    roomIdForDetail,
  ]);

  return (
    <AppShell
      activeTab={roomId || shareCode ? "rooms" : "home"}
      activeRailView={roomId || shareCode ? "rooms" : "home"}
      unreadCount={unreadCount}
      railUser={
        displayData.name
          ? {
              name: displayData.name,
              caption: weddingDateText
                ? `${dDayLabel} · ${weddingDateText.replace(/^\d{4}년 /, "").replace(/ \(.\)$/, "")}`
                : null,
            }
          : null
      }
      gridBackground
      /* 기본값(372/420px)은 목록 화면용이다. 대시보드는 남는 폭을 다 쓴다 */
      masterWidthClassName="lg:flex-1"
      detailWidthClassName="w-[392px] 2xl:w-[428px]"
      /*
        등록 pane 을 열었을 때만 컬럼을 만든다. 대시보드는 3열이라
        빈 pane 을 늘 물고 있으면 가로가 크게 좁아진다.
      */
      detail={
        isDesktopWidth && inspectorScheduleId ? (
          <ScheduleDetailView
            key={inspectorScheduleId}
            scheduleId={inspectorScheduleId}
            roomId={roomIdForDetail}
            variant="inspector"
            onClose={() => setInspectorScheduleId(null)}
            onDeleted={() => {
              setInspectorScheduleId(null);
              setDashboardRefresh((n) => n + 1);
              const status = activeTab === "planned" ? "NORMAL" : "COMPLETED";
              fetchScheduleList(roomIdForDetail ?? undefined, status);
            }}
          />
        ) : isDesktopWidth && isAddPaneOpen ? (
          <AddPlanView
            variant="pane"
            roomId={
              roomId?.trim()
                ? Number(roomId.trim())
                : apiPlanData && apiPlanData !== "none" && apiPlanData.roomId
                  ? apiPlanData.roomId
                  : null
            }
            from="main"
            onClose={() => setIsAddPaneOpen(false)}
            onSaved={() => {
              // 예산·카테고리는 dashboardRefresh 를 보는 effect 가 맡는다
              setDashboardRefresh((n) => n + 1);
              const status = activeTab === "planned" ? "NORMAL" : "COMPLETED";
              const roomIdParam =
                roomId?.trim() ||
                (apiPlanData && apiPlanData !== "none" && apiPlanData.roomId
                  ? String(apiPlanData.roomId)
                  : null);
              fetchScheduleList(roomIdParam ?? undefined, status);
            }}
          />
        ) : undefined
      }
      bottomBarSlot={
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
                tab === "rooms"
                  ? "/plan-list"
                  : tab === "settings"
                    ? "/user"
                    : "/main",
              );
            }
          }}
          unreadCount={unreadCount}
        />
      }
    >
      <KakaoLoginAlert
        show={searchParams.get("kakao_login") === "1"}
        onSuccessFromMain={async () => {
          const planData = await fetchPlanUser(handleApiError);
          const roomIdForAmount =
            planData && planData !== "none" && planData.roomId != null
              ? String(planData.roomId)
              : undefined;
          fetchTotalAmount(handleApiError, roomIdForAmount);
          fetchScheduleList();
        }}
      />
      <main
        ref={mainScrollRef}
        className={`flex flex-1 flex-col items-center overflow-y-auto w-full px-4 sm:px-6 transition-all duration-500 snap-y snap-mandatory scroll-smooth md:hidden ${isNoPlanBlur ? "blur-xl scale-[0.98] pointer-events-none select-none opacity-60" : ""}`}
      >
        {shareCode && sharedRoomUser === "error" && (
          <div className="w-full mt-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
            공유 링크가 유효하지 않거나 만료되었습니다.
          </div>
        )}
        <motion.div
          ref={firstSectionRef}
          className="w-full shrink-0 pt-8 pb-10 origin-top snap-start flex flex-col justify-start"
          style={{
            height: "340px",
            opacity: headerOpacity,
            scale: headerScale,
            transformPerspective: 1000,
          }}
        >
          {/* 상단 영역: 1행=이름·초대(이름 우측), 2행=결혼식 날짜(좌측)·D-day(날짜 오른쪽), 오른쪽=프로필 */}
          <div className="w-full flex items-start justify-between gap-4">
            {/* 왼쪽: [이름(좌)·초대(우)] + [결혼식 날짜(좌)·D-day(우)] */}
            <div
              id="main-header-info"
              className="flex flex-col items-start min-w-0 flex-1 p-2 -m-2 rounded-xl transition-colors"
            >
              {/* 1행: 이름(좌) · 초대(이름 바로 옆, 이름 길이에 따라 가변) */}
              <div className="flex items-center gap-2 flex-nowrap min-w-0">
                {isPlanLoading ? (
                  <span
                    className="skeleton-shimmer h-[42px] w-[120px] rounded-lg shrink-0"
                    aria-hidden
                  />
                ) : (
                  <span className="font-user-content text-3xl sm:text-[42px] font-semibold text-[#1b0d14] leading-tight shrink-0 min-w-0 break-keep line-clamp-2">
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
                            String(sharedRoomUser.id).trim().toLowerCase()) && (
                          <span
                            className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-amber-900 shadow-sm"
                            aria-hidden
                          >
                            <Crown className="w-2.5 h-2.5" strokeWidth={2.5} />
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
                          String(m.permission ?? "").toUpperCase() === "OWNER",
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
                            <Crown className="w-2.5 h-2.5" strokeWidth={2.5} />
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
                    {apiPlanData.members?.length === 1 && (
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
                    <Mail className="h-4 w-4 text-stone-600" strokeWidth={2} />
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="flex h-12 w-12 shrink-0 items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
                aria-label="가이드 보기"
              >
                <CircleHelp className="h-6 w-6" strokeWidth={2} />
              </button>
              {/* roomId 또는 shareCode일 때 우측 상단 나가기 버튼 */}
              {(shareCode || roomId) && (
                <button
                  type="button"
                  onClick={() => router.push("/plan-list")}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-600 text-white cursor-pointer hover:bg-stone-700 transition-colors"
                  aria-label="나가기"
                >
                  <LogOut className="h-6 w-6" strokeWidth={2} />
                </button>
              )}
            </div>
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
                id="main-budget-card"
                onClick={() => {
                  router.push(
                    roomIdForDetail
                      ? `/budget-detail?roomId=${roomIdForDetail}`
                      : "/budget-detail",
                  );
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
                  만 원 지출/예정
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
        </motion.div>
        <motion.div
          ref={secondSectionRef}
          className="w-full min-h-[100dvh] h-[100dvh] pt-4 snap-start bg-transparent relative flex flex-col shrink-0"
        >
          {/* 하단 영역 */}
          <div className="flex justify-between items-end gap-3">
            <div className="flex flex-col items-start w-full overflow-hidden pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-[#1b0d14] shrink-0">
                  플랜 리스트
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // 공유 뷰에서는 내 방 id 를 붙이지 않는다 (내 플랜에 저장되던 문제)
                    const roomIdValue = isSharedView
                      ? roomId
                      : (roomId ??
                        (apiPlanData &&
                        apiPlanData !== "none" &&
                        apiPlanData.roomId
                          ? String(apiPlanData.roomId)
                          : null));
                    router.push(
                      roomIdValue
                        ? `/calendar?roomId=${roomIdValue}`
                        : "/calendar",
                    );
                  }}
                  className="p-1.5 text-gray-400 hover:text-[#ee2b8c] hover:bg-[#ee2b8c10] transition-all rounded-lg active:scale-95"
                  aria-label="캘린더 보기"
                >
                  <Calendar className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>
              {/* 카테고리 필터 영역 (테스트) */}
              <div
                ref={categoryScrollRef}
                className="flex w-full items-center gap-1.5 overflow-x-auto scrollbar-hide py-1.5 mt-0.5 mask-linear-right select-none cursor-grab active:cursor-grabbing"
              >
                {isPlanLoading ? (
                  <span
                    className="skeleton-shimmer block h-6 w-48 rounded"
                    aria-hidden
                  />
                ) : displayCount > 0 ? (
                  currentTabCategories.map((catName) => {
                    const isSelected = selectedCategory === catName;
                    return (
                      <button
                        key={catName}
                        ref={isSelected ? selectedCategoryButtonRef : undefined}
                        type="button"
                        onClick={() => setSelectedCategory(catName)}
                        className={`shrink-0 px-3 py-1 rounded-md text-[12px] font-bold transition-all flex items-center gap-1 ${
                          isSelected
                            ? "bg-[#ee2b8c] text-white shadow-sm"
                            : "bg-gray-100/80 text-gray-600 hover:bg-gray-200 active:scale-95"
                        }`}
                      >
                        {catName}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[14px] text-gray-400 font-medium">
                    플랜을 추가해볼까요?
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 pb-1.5 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className="inline-flex items-center justify-center gap-1.5 h-[36px] px-3.5 py-0 rounded-lg font-bold text-xs whitespace-nowrap shrink-0 transition-colors hover:opacity-90 active:opacity-80 active:scale-95 border-2 border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                aria-label="필터"
              >
                {(() => {
                  const current = sortOptions[0] ?? "date_desc";
                  const { label, isDesc } = getSortButtonLabel(current);
                  return (
                    <>
                      <span>{label}</span>
                      {isDesc ? (
                        <ArrowDown
                          className="h-3.5 w-3.5 shrink-0"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <ArrowUp
                          className="h-3.5 w-3.5 shrink-0"
                          strokeWidth={2.5}
                        />
                      )}
                    </>
                  );
                })()}
              </button>
              {!(
                isRoomView &&
                String(myRoomPermission ?? "").toUpperCase() === "READ"
              ) && (
                <button
                  type="button"
                  onClick={handleAddPlan}
                  className="flex h-[36px] justify-center items-center gap-1.5 px-3.5 py-0 text-white rounded-lg font-bold text-xs whitespace-nowrap shrink-0 transition-colors hover:opacity-90 active:opacity-80 active:scale-95 transform transition-transform"
                  style={{
                    backgroundColor:
                      !getToken() &&
                      !isSharedView &&
                      effectiveScheduleList.length >= 3
                        ? "#cbd5e1"
                        : "#ee2b8c",
                  }}
                >
                  추가
                  <CirclePlus
                    className="h-4 w-4 shrink-0 text-white"
                    strokeWidth={2.5}
                  />
                </button>
              )}
            </div>
          </div>
          {/* 탭 영역 - Sticky 고정 */}
          <div
            id="main-tabs"
            className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm px-0 sm:px-2 py-2 -mx-4 sm:mx-0 px-4 sm:px-2 border-b border-gray-50/50"
          >
            <div className="flex bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("planned");
                  setSelectedCategory("전체");
                  if (shareCode?.trim()) {
                    fetchSharedRoomScheduleList("NORMAL");
                  } else if (getToken()) {
                    const roomIdParam =
                      roomId?.trim() ||
                      (apiPlanData &&
                      apiPlanData !== "none" &&
                      apiPlanData.roomId
                        ? String(apiPlanData.roomId)
                        : null);
                    fetchScheduleList(roomIdParam ?? undefined, "NORMAL");
                  }
                }}
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
                  activeTab === "planned"
                    ? "bg-white text-[#ee2b8c] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <span>계획 중</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "planned" ? "bg-[#ee2b8c10] text-[#ee2b8c]" : "bg-gray-200 text-gray-500"}`}
                >
                  {plannedCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("completed");
                  setSelectedCategory("전체");
                  if (shareCode?.trim()) {
                    fetchSharedRoomScheduleList("COMPLETED");
                  } else if (getToken()) {
                    const roomIdParam =
                      roomId?.trim() ||
                      (apiPlanData &&
                      apiPlanData !== "none" &&
                      apiPlanData.roomId
                        ? String(apiPlanData.roomId)
                        : null);
                    fetchScheduleList(roomIdParam ?? undefined, "COMPLETED");
                  }
                }}
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
                  activeTab === "completed"
                    ? "bg-white text-[#ee2b8c] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <span>완료</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "completed" ? "bg-[#ee2b8c10] text-[#ee2b8c]" : "bg-gray-200 text-gray-500"}`}
                >
                  {completedCount}
                </span>
              </button>
            </div>
          </div>
          <div
            className={`flex-1 w-full pb-24 min-h-0 scrollbar-hide ${allowPlanListScroll ? "overflow-y-auto" : "overflow-hidden touch-pan-y"}`}
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 24px, black 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 24px, black 100%)",
            }}
          >
            <ul
              id="main-plan-list"
              className="mt-2 w-full flex flex-col gap-3 min-h-[200px] relative bg-transparent"
            >
              {/* 
                  플랜 리스트 로딩: 초기 로드/유저·방 로딩 시에만 스켈레톤.
                  필터 리패치 시에는 스켈레톤 미표시 → 카테고리 스크롤 위치 유지.
                */}
              {!isListLoaded || isPlanLoading || isSharedLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <li
                    key={`skeleton-plan-${idx}`}
                    className="flex items-center gap-4 rounded-3xl border border-[#ee2b8c0a] bg-white p-4 shadow-sm animate-pulse"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-stone-50 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-5 w-3/4 bg-stone-50 rounded" />
                      <div className="space-y-1">
                        <div className="h-3 w-1/2 bg-stone-50 rounded" />
                        <div className="h-3 w-1/3 bg-stone-50 rounded" />
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="h-5 w-16 bg-stone-50 rounded ml-auto" />
                      <div className="h-4 w-10 bg-stone-50 rounded-lg ml-auto" />
                    </div>
                  </li>
                ))
              ) : isListLoaded && effectiveScheduleList.length === 0 ? (
                <li className="flex flex-1 flex-col items-center justify-center py-16">
                  <p className="text-4xl font-semibold text-stone-400">텅~</p>
                </li>
              ) : (
                <AnimatePresence initial={false}>
                  {visibleScheduleList.map((plan) => {
                    const isChecked =
                      checkedItems.has(plan.id) || plan.status === "COMPLETED";
                    const amount = plan.amount ?? 0;
                    const dateStatus = getDateStatusLabel(plan.startDate);
                    const categoryColor = getCategoryColor(plan.categoryName);
                    const detailHref = `/schedule-detail?id=${plan.id}${roomIdForDetail ? `&roomId=${roomIdForDetail}` : ""}`;
                    const dateLabel = plan.startDate?.trim()
                      ? (() => {
                          const { dateText, weekday } = formatDate(
                            plan.startDate as string,
                          );
                          return `${dateText} (${weekday})`;
                        })()
                      : "미정";

                    return (
                      <motion.li
                        key={plan.id}
                        layout
                        className="w-full"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: [1, 1, 0],
                          y: [0, -10, -10],
                          x: [0, 0, activeTab === "planned" ? 500 : -500],
                          scale: [1, 1.05, 1.05],
                          transition: {
                            duration: 0.6,
                            times: [0, 0.4, 1],
                            ease: "easeInOut",
                          },
                        }}
                      >
                        <Link
                          href={detailHref}
                          onClick={() => {
                            sessionStorage.setItem("returnToPlanList", "true");
                          }}
                          className={`relative flex w-full items-center gap-4 bg-white p-4 rounded-3xl border border-[#ee2b8c0a] shadow-sm transition-transform active:scale-[0.98] ${isChecked ? "opacity-75" : ""}`}
                          aria-label={`플랜 상세 보기: ${plan.title}`}
                        >
                          {mounted &&
                            activeTab === "planned" &&
                            isStartDatePast(plan.startDate) && (
                              <PastDateIndicator />
                            )}
                          <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${categoryColor}`,
                            }}
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
                              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all hover:opacity-90 disabled:opacity-60 disabled:pointer-events-none ${
                                isChecked
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
                              // 색 클래스를 겹쳐 쓰면 생성된 CSS 순서가 승자를
                              // 정해 완료 표시가 흐려진다. 한쪽만 낸다.
                              className={`font-user-content font-bold text-lg truncate ${isChecked ? "line-through text-gray-400" : "text-[#1b0d14]"}`}
                            >
                              {plan.title}
                            </h4>
                            <div className="font-user-content text-gray-400 text-xs font-semibold tracking-tight mt-0.5 space-y-0.5">
                              <p className="truncate">{plan.categoryName}</p>
                              <p className="truncate">{dateLabel}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-extrabold text-[#1b0d14] mb-1">
                              {amount > 0
                                ? `${amount.toLocaleString("ko-KR")}만 원`
                                : "미정"}
                            </div>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black tracking-tight ${
                                isChecked
                                  ? "bg-emerald-50 text-emerald-600"
                                  : dateStatus === "D-day"
                                    ? "bg-[#ee2b8c] text-white shadow-xs"
                                    : dateStatus === "임박"
                                      ? "bg-orange-50 text-orange-600"
                                      : dateStatus === "예정"
                                        ? "bg-sky-50 text-sky-600"
                                        : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {isChecked ? "완료" : dateStatus}
                            </span>
                          </div>
                        </Link>
                      </motion.li>
                    );
                  })}
                  {visibleScheduleList.length === 0 && (
                    <motion.li
                      key={`empty-${activeTab}`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-1 flex-col items-center justify-center py-16"
                    >
                      <p className="text-xl font-semibold text-stone-400 text-center w-full">
                        {activeTab === "completed"
                          ? "완료한 플랜이 없어요"
                          : "모든 플랜을 완료했어요! 🎉"}
                      </p>
                    </motion.li>
                  )}
                </AnimatePresence>
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
        </motion.div>

        {/* 스크롤 유도 애니메이션 */}
        <ScrollDownAnimation scrollContainerRef={mainScrollRef} />
      </main>

      {/* 태블릿 이상(≥768) — D 시안의 홈 대시보드 */}
      <HomeDashboard
        coupleName={displayData.name}
        weddingDateText={weddingDateText}
        venue={displayData.venue}
        planLoading={isPlanLoading}
        dDayLabel={dDayLabel}
        dDayCount={dDay}
        plannedUseAmount={plannedUseAmount}
        totalBudget={initialBudget}
        remainingBudget={remainingBudget}
        budgetUsagePercentage={budgetUsagePercentage}
        chatRooms={chatRoomsForPanel}
        roomId={roomIdForDetail}
        canEdit={
          String(myRoomPermission ?? "").toUpperCase() !== "READ" &&
          !isSharedView
        }
        onAddPlan={handleAddPlan}
        refreshToken={dashboardRefresh}
        // 상세 인스펙터도 등록 pane 과 같은 자리를 쓴다. 둘 중 뭐가 열리든
        // 대시보드가 쓸 수 있는 폭은 400px 넘게 줄어든다.
        narrow={
          isDesktopWidth && (isAddPaneOpen || inspectorScheduleId !== null)
        }
        onToggle={handleToggleCheck}
        onOpenSchedule={(id) => {
          // 넓은 화면은 옆에서 열고, 좁으면 지금처럼 상세 라우트로 간다.
          // /calendar 인스펙터와 같은 기준(>=1024)이다.
          if (isDesktopWidth) {
            setIsAddPaneOpen(false);
            setInspectorScheduleId(id);
            return;
          }
          router.push(
            `/schedule-detail?id=${id}${roomIdForDetail ? `&roomId=${roomIdForDetail}` : ""}`,
          );
        }}
        onOpenBudgetDetail={() =>
          router.push(
            roomIdForDetail
              ? `/budget-detail?roomId=${roomIdForDetail}`
              : "/budget-detail",
          )
        }
        onOpenBoard={() =>
          router.push(
            roomIdForDetail
              ? `/calendar?roomId=${roomIdForDetail}`
              : "/calendar",
          )
        }
      />
      <CustomAlertModal
        isOpen={readOnlyNotice !== null}
        message={readOnlyNotice ?? ""}
        type="warning"
        onClose={() => setReadOnlyNotice(null)}
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
      <PlanFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        sortOptions={sortOptions}
        onSortChange={setSortOptions}
      />
      {!showNoPlanModal && (
        <GuideOverlay
          isOpen={showGuide}
          onClose={handleCloseGuide}
          steps={guideSteps}
        />
      )}
    </AppShell>
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
