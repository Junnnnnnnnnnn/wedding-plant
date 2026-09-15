"use client";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  MapPin,
  Star,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useAppRouter } from "@/app/hooks/useAppRouter";
import RouteSkeletonScreen from "@/app/components/RouteSkeleton";
import FeedbackModal from "../components/FeedbackModal";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import CustomAlertModal from "../components/CustomAlertModal";
import FeedPostModal, { FeedPostTarget } from "../components/FeedPostModal";
import { useScrollDirection } from "../hooks/useScrollDirection";
import { useScheduleStatusToggle } from "../hooks/useScheduleStatusToggle";
import { getToken, getPlanUserIdFromToken } from "@/lib/api";
import { getGuestScheduleList } from "@/lib/guestSchedule";
import { formatKoreanTime, parseLocalDate } from "@/lib/utils";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

/** API status: NORMAL = 예정, COMPLETED = 완료 */
type ScheduleDetailData = {
  id: number;
  title: string;
  categoryName: string;
  payType?: "CASH" | "CREDIT" | "OTHER" | string | null;
  amount?: number | null;
  startDate?: string | null;
  /** 시작 시각 "HH:mm". 안 정했으면 비어 있다 */
  startTime?: string | null;
  location?: string | null;
  locationLat?: number | string | null;
  locationLng?: number | string | null;
  memo?: string | null;
  createDate?: string | null;
  updateDate?: string | null;
  addCategoryNameList?: string[] | null;
  /** NORMAL = 예정, COMPLETED = 완료 */
  status?: "NORMAL" | "COMPLETED" | string | null;
};

const PAY_TYPE_LABELS: Record<string, string> = {
  CASH: "현금",
  CREDIT: "카드",
  OTHER: "기타",
};

function isScheduleDetailData(value: unknown): value is ScheduleDetailData {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "number" &&
    typeof obj.title === "string" &&
    typeof obj.categoryName === "string"
  );
}

function extractDetailFromResponse(value: unknown): ScheduleDetailData | null {
  if (!value || typeof value !== "object") return null;

  if (isScheduleDetailData(value)) {
    return value;
  }

  const obj = value as Record<string, unknown>;
  if ("data" in obj) {
    const { data } = obj as { data?: unknown };
    if (isScheduleDetailData(data)) {
      return data;
    }
  }
  return null;
}

/** "2026년 6월 17일 (목)" 형식 (로컬 파싱으로 타임존 오차 방지) */
function formatDate(dateStr?: string | null) {
  if (!dateStr) return "일정 미정";
  const date = parseLocalDate(dateStr);
  if (!date) return dateStr;
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${y}년 ${m}월 ${d}일 (${w})`;
}

export type ScheduleDetailVariant = "page" | "inspector";

interface ScheduleDetailViewProps {
  /** 볼 일정 id. 없으면 안내 문구만 보여준다 */
  scheduleId: number | null;
  /** 참여 방 id. 있으면 내 권한을 확인해 READ 일 때 수정·삭제를 감춘다 */
  roomId?: string | null;
  /** 어디서 왔는지. "calendar" 면 삭제 후 캘린더로 돌아간다 */
  from?: string | null;
  /**
   * page      = /schedule-detail 라우트. 화면 전체 + 하단 탭바.
   * inspector = 보드·캘린더 옆에 붙는 패널. 높이를 바깥이 정하고
   *             뒤로가기 대신 닫기(onClose)를 쓴다.
   */
  variant?: ScheduleDetailVariant;
  /** inspector 에서 닫기. 없으면 router.back() */
  onClose?: () => void;
  /** 삭제가 끝났을 때. 보드가 목록을 다시 불러오는 데 쓴다 */
  onDeleted?: (id: number) => void;
}

export default function ScheduleDetailView({
  scheduleId,
  roomId = null,
  from = null,
  variant = "page",
  onClose,
  onDeleted,
}: ScheduleDetailViewProps) {
  const isInspector = variant === "inspector";
  const router = useAppRouter();
  const { fetchWithAuth } = useApi();
  const { unreadCount } = useNotification();
  const mainScrollRef = useRef<HTMLElement>(null);
  const scrollDirection = useScrollDirection(mainScrollRef);

  const [detail, setDetail] = useState<ScheduleDetailData | null>(null);
  /** 후기 올리기 모달 대상. null 이면 닫힘 */
  const [postTarget, setPostTarget] = useState<FeedPostTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteFeedbackModal, setShowDeleteFeedbackModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    message: string;
    type: "warning" | "error" | "info" | "success";
  }>({
    isOpen: false,
    message: "",
    type: "warning",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  /**
   * 지도 크게 보기. 지도 DOM 을 옮기면 Kakao 인스턴스가 죽으므로,
   * 감싼 상자만 fixed 로 키우고 안쪽은 그대로 둔다. 크기가 바뀌면
   * 아래 ResizeObserver 가 relayout + 재중심을 맡는다.
   */
  const [mapExpanded, setMapExpanded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [kakaoSdkReady, setKakaoSdkReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  /**
   * 참여 방(roomId)에서 내 권한. READ면 수정·삭제를 노출하지 않는다.
   * - null  : 아직 확인 전 (권한 게이트이므로 확인 전에는 숨긴다)
   * - "OWN" : 개인 플랜이라 방 권한 개념이 없음 → 허용
   */
  const [myPermission, setMyPermission] = useState<string | null>(null);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
  }, []);

  const fromParam = from;

  // 참여 방이면 내 권한을 확인해 READ일 때 수정·삭제를 감춘다.
  // 서버도 권한을 검사하지만, 누를 수 없는 버튼을 보여주지 않는 편이 낫다.
  useEffect(() => {
    setMyPermission(null);
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) {
      setMyPermission("OWN"); // 개인 플랜 — 방 권한 개념 없음
      return;
    }
    if (!getToken()) {
      setMyPermission(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(
          `/plan/room/${encodeURIComponent(trimmedRoomId)}`,
          { skipLoading: true },
        );
        if (!res.ok) {
          if (!cancelled) setMyPermission(null);
          return;
        }
        const json = (await res.json()) as {
          result?: boolean;
          data?: {
            members?: { planUserId?: string; permission?: string }[];
          };
        };
        const myId = String(getPlanUserIdFromToken() ?? "")
          .trim()
          .toLowerCase();
        const me = json.data?.members?.find(
          (m) =>
            String(m.planUserId ?? "")
              .trim()
              .toLowerCase() === myId,
        );
        if (!cancelled) {
          setMyPermission(String(me?.permission ?? "").toUpperCase() || null);
        }
      } catch {
        if (!cancelled) setMyPermission(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId, fetchWithAuth]);

  /** 수정·삭제 노출 여부. 확인 전(null)에는 감춘다 */
  const canEdit =
    myPermission === "OWN" ||
    myPermission === "OWNER" ||
    myPermission === "SPOUSE" ||
    myPermission === "WRITE";

  useEffect(() => {
    if (!scheduleId) {
      setError("잘못된 접근입니다. 플랜 ID를 확인해 주세요.");
      return undefined;
    }

    const token = getToken();
    if (!token) {
      const guest = getGuestScheduleList().find((p) => p.id === scheduleId);
      if (!guest) {
        setDetail(null);
        setError("플랜 정보를 불러오지 못했습니다.");
        return undefined;
      }
      setError(null);
      setDetail({
        id: guest.id,
        title: guest.title,
        categoryName: guest.categoryName,
        amount: guest.amount ?? 0,
        payType: guest.payType ?? null,
        startDate: guest.startDate,
        startTime: guest.startTime ?? null,
        status:
          guest.status === "COMPLETED" || guest.status === "NORMAL"
            ? (guest.status as "COMPLETED" | "NORMAL")
            : "NORMAL",
        location: guest.location ?? null,
        locationLat: guest.locationLat ?? null,
        locationLng: guest.locationLng ?? null,
        memo: guest.memo ?? null,
      });
      return undefined;
    }

    const controller = new AbortController();

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetchWithAuth(`/plan/schedule/${scheduleId}`, {
          method: "GET",
          // 전역 스피너 대신 뼈대를 낸다 (위 `loading` 분기)
          skipLoading: true,
          signal: controller.signal,
        });

        if (res.status === 401) {
          // 이 경로는 토큰이 있을 때만 도달한다(비로그인 게스트는 위에서
          // 로컬 데이터로 처리하고 끝난다). 따라서 ApiContext 의 공통 401
          // 처리가 토큰 정리·복귀 경로 저장·재로그인 안내를 모두 맡는다.
          //
          // 예전에는 skipAuthHandling 으로 공통 처리를 건너뛰고 자체 모달만
          // 띄웠다. clearToken 을 하지 않아 만료된 토큰이 남았고, 모달을
          // 닫아도 getToken() 이 참이라 이동조차 안 돼 화면에 갇혔다.
          setError("로그인이 필요합니다.");
        } else {
          const json = (await res.json().catch(() => null)) as unknown;
          const data = extractDetailFromResponse(json);

          if (res.ok && data) {
            setDetail(data);
          } else if (json && typeof json === "object" && "message" in json) {
            const { message } = json as { message?: unknown };
            setError(String(message ?? "플랜 정보를 불러오지 못했습니다."));
          } else {
            setError("플랜 정보를 불러오지 못했습니다.");
          }
        }
      } catch (fetchError) {
        if ((fetchError as { name?: string }).name !== "AbortError") {
          setError("플랜 정보를 불러오는 중 오류가 발생했습니다.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();

    return () => {
      controller.abort();
    };
  }, [fetchWithAuth, scheduleId]);

  const formattedAmount = useMemo(() => {
    if (detail?.amount == null || Number.isNaN(Number(detail.amount)))
      return "미정";
    return `${Number(detail.amount).toLocaleString()}만 원`;
  }, [detail?.amount]);
  const payTypeLabel = useMemo(() => {
    if (!detail?.payType) return "미정";
    return PAY_TYPE_LABELS[detail.payType] ?? detail.payType;
  }, [detail?.payType]);
  const isCompleted = detail?.status === "COMPLETED";

  /**
   * 완료 여부를 이 화면에서 바꾼다.
   *
   * 예전에는 보드와 홈에서만 토글할 수 있었다. 그런데 "끝났나?"를 판단하는
   * 정보(금액·장소·메모)는 전부 이 화면에 있어서, 확인하러 들어왔다가 다시
   * 나가서 눌러야 했다.
   *
   * 낙관적으로 바꾸고 실패하면 되돌린다 — 훅이 같은 항목의 연타는 막는다.
   */
  const { setStatus, isPending } = useScheduleStatusToggle();
  const statusPending = detail ? isPending(detail.id) : false;
  const handleToggleStatus = useCallback(async () => {
    if (!detail) return;
    const next = detail.status === "COMPLETED" ? "NORMAL" : "COMPLETED";
    const prev = detail.status;
    setDetail((d) => (d ? { ...d, status: next } : d));
    const ok = await setStatus(detail.id, next);
    if (!ok) setDetail((d) => (d ? { ...d, status: prev } : d));
  }, [detail, setStatus]);

  const mapLink = useMemo(() => {
    if (!detail?.location) return null;
    const lat = Number(detail.locationLat);
    const lng = Number(detail.locationLng);
    if (Number.isNaN(lat) || Number.isNaN(lng) || (lat === 0 && lng === 0))
      return null;
    const encodedName = encodeURIComponent(detail.location);
    return `https://map.kakao.com/link/map/${encodedName},${lat},${lng}`;
  }, [detail?.location, detail?.locationLat, detail?.locationLng]);

  const mapCoords = useMemo(() => {
    if (!detail) return null;
    const lat = Number(detail.locationLat);
    const lng = Number(detail.locationLng);
    if (Number.isNaN(lat) || Number.isNaN(lng) || (lat === 0 && lng === 0))
      return null;
    return { lat, lng };
  }, [detail]);

  const handleDelete = useCallback(async () => {
    if (!detail?.id || deleting) return;
    setDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const res = await fetchWithAuth(`/plan/schedule/${detail.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted?.(detail.id);
        setShowDeleteFeedbackModal(true);
      } else {
        // 응답 원문(JSON 덩어리)을 그대로 노출하지 않는다
        setAlertConfig({
          isOpen: true,
          message:
            res.status === 403
              ? "이 플랜을 삭제할 권한이 없습니다."
              : "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          type: "error",
        });
      }
    } catch (err) {
      setAlertConfig({
        isOpen: true,
        message: "삭제 중 오류가 발생했습니다.",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  }, [detail?.id, deleting, fetchWithAuth, onDeleted]);

  useEffect(() => {
    if (window.kakao?.maps?.LatLng) {
      setKakaoSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      window.kakao?.maps?.load(() => {
        setKakaoSdkReady(true);
      });
    };
    script.onerror = () => {
      console.error("Failed to load Kakao Maps SDK");
    };
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!mapCoords || !kakaoSdkReady) {
      if (mapRef.current) {
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        mapRef.current = null;
      }
      setMapLoaded(false);
      return undefined;
    }
    setMapLoaded(false);
    const timer = setTimeout(() => {
      const container = document.getElementById("schedule-detail-map");
      if (!container || !window.kakao?.maps?.LatLng) return;
      if (mapRef.current) {
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        mapRef.current = null;
      }
      try {
        const coords = new window.kakao.maps.LatLng(
          mapCoords.lat,
          mapCoords.lng,
        );
        const options = {
          center: coords,
          level: 3,
          scrollwheel: false,
          disableDoubleClick: true,
          disableDoubleClickZoom: true,
        };
        const mapInstance = new window.kakao.maps.Map(container, options);
        mapRef.current = mapInstance;
        const marker = new window.kakao.maps.Marker({
          map: mapInstance,
          position: coords,
        });
        markerRef.current = marker;
        setTimeout(() => {
          setMapLoaded(true);
        }, 300);
      } catch {
        // ignore map init errors
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [mapCoords, kakaoSdkReady]);

  // 컨테이너 크기 변경 시 Kakao 지도 relayout (높이 300px 등으로 변경 시 지도가 새 크기에 맞게 다시 그려지도록)
  useEffect(() => {
    const el = document.getElementById("schedule-detail-map");
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!mapRef.current?.relayout) return;
      mapRef.current.relayout();
      // relayout 만 하면 커진 만큼 마커가 한쪽으로 밀린다. 중심을 다시 잡는다.
      if (mapCoords && window.kakao?.maps) {
        mapRef.current.setCenter(
          new window.kakao.maps.LatLng(mapCoords.lat, mapCoords.lng),
        );
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapCoords]);

  // 크게 본 지도는 ESC 로 닫는다. 뒷 배경을 어둡게 하지 않으므로
  // 바깥을 눌러 닫는 방식은 오히려 오조작이 된다.
  useEffect(() => {
    if (!mapExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMapExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapExpanded]);

  let content: ReactElement | null = null;

  if (loading || (!detail && !error)) {
    // 인스펙터 자리의 뼈대. 단독 라우트는 아래에서 셸째로 뼈대를 낸다
    content = (
      <section
        aria-busy
        className="rounded-[24px] border border-[#ee2b8c0f] bg-white p-5 shadow-sm"
      >
        <span className="sr-only">플랜을 불러오는 중입니다</span>
        <div className="flex justify-between">
          <span className="skeleton-shimmer block h-6 w-16 rounded-full" />
          <span className="skeleton-shimmer block h-6 w-14 rounded-full" />
        </div>
        <span className="skeleton-shimmer mt-4 block h-6 w-3/4 rounded-lg" />
        <span className="skeleton-shimmer mt-2.5 block h-3.5 w-1/2 rounded" />
        <span className="skeleton-shimmer mt-5 block h-8 w-28 rounded-lg" />
        <span className="skeleton-shimmer mt-6 block h-[140px] w-full rounded-2xl" />
      </section>
    );
  } else if (error) {
    content = (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl bg-white px-6 py-12 text-center shadow-md">
        <p className="text-lg font-semibold text-[#ee2b8c]">
          플랜을 찾을 수 없어요
        </p>
        <p className="text-sm leading-relaxed text-stone-500">{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/main")}
            className="rounded-full bg-[#ee2b8c] px-5 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#ee2b8c33]"
          >
            홈으로 이동
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-[#ee2b8c] px-5 py-2 text-sm font-semibold text-[#ee2b8c] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            다시 시도
          </button>
        </div>
      </section>
    );
  } else if (detail) {
    const latStr =
      detail.locationLat != null
        ? parseFloat(String(detail.locationLat)).toFixed(4)
        : "-";
    const lngStr =
      detail.locationLng != null
        ? parseFloat(String(detail.locationLng)).toFixed(4)
        : "-";
    const latNum = Number(detail.locationLat);
    const lngNum = Number(detail.locationLng);
    const hasNonZeroCoords =
      !Number.isNaN(latNum) &&
      !Number.isNaN(lngNum) &&
      (latNum !== 0 || lngNum !== 0);
    const showMapOrCoordBox =
      Boolean(detail.location?.trim()) && (mapCoords || hasNonZeroCoords);

    content = (
      <>
        {/*
          인스펙터는 보드·캘린더 옆에 붙는 웹 UI 라, 폰 화면용 분홍 히어로와
          회전 스티커 대신 대시보드와 같은 흰 카드 언어를 쓴다. page 변형
          (폰의 /schedule-detail)은 손대지 않는다.
        */}
        {isInspector ? (
          <section className="rounded-[24px] border border-[#ee2b8c0f] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-full bg-[#fff2f6] px-2.5 py-1 text-[11.5px] text-[#ee2b8c]">
                {detail.categoryName}
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                  isCompleted
                    ? "bg-[#f2eef0] text-[#7a6c74]"
                    : "bg-[#fff2f6] text-[#ee2b8c]"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  <Clock className="h-3 w-3" strokeWidth={2.5} />
                )}
                {isCompleted ? "완료" : "예정"}
              </span>
            </div>
            <h2 className="font-user-content mt-3 text-[20px] font-bold leading-snug tracking-tight text-[#1b0d14] break-keep">
              {detail.title}
            </h2>
            <p className="mt-1.5 text-[12.5px] text-[#7a6c74]">
              {formatDate(detail.startDate)}
              {formatKoreanTime(detail.startTime) ? (
                <>
                  <span className="mx-1 text-[#e0d5db]">·</span>
                  {formatKoreanTime(detail.startTime)}
                </>
              ) : null}
            </p>
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-dashed border-[#f2eaee] pt-4">
              <div className="min-w-0">
                <div className="text-[12.5px] text-gray-400">지출 금액</div>
                <div className="font-user-content mt-1 text-[26px] font-bold leading-none tracking-[-0.03em] text-[#1b0d14] break-keep">
                  {formattedAmount}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12.5px] text-gray-400">결제 방식</div>
                <div className="mt-1 text-[13.5px] font-bold text-[#4a3f45]">
                  {payTypeLabel}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative -mx-6 -mt-5 mb-2 md:-mx-8"
          >
            {/*
              떠 있는 카드가 아니라 **화면 머리 면**이다. 같은 색을 쓰지만
              카드가 아니라 면이라 덩어리로 보이지 않고 배경으로 물러난다.
              좌우 패딩(px-6 / md:px-8)을 음수 마진으로 상쇄해 가장자리까지
              편다 — main 이 overflow-x-hidden 이라 넘치지 않는다.
            */}
            <div
              data-mobile-head
              className="relative overflow-hidden rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-6 pb-5 pt-4 md:px-8"
            >
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

              {/*
                시안(C안 06)의 머리 줄이다 — **뒤로가기 · 카테고리 · 상태**가
                한 줄에 앉는다. 예전에는 화살표만 한 줄을 다 쓰고 카테고리가
                그 아래로 내려가, 면이 40px 쯤 더 길었다.
              */}
              <div className="relative z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (onClose ? onClose() : router.back())}
                  className="-ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition-colors hover:bg-white/20"
                  aria-label="뒤로가기"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="min-w-0 truncate text-[18px] font-bold tracking-[-0.02em] text-white">
                  {detail.categoryName}
                </span>
                {/*
                  상태 표시. 예전에는 회전하는 주황 스티커였는데, 앱 어디에도
                  없는 세 번째 색인 데다 담고 있는 건 "아직 안 끝났다"는 정보
                  한 줄이었다. 정보에 조작만큼의 무게를 주면 정작 누를 것이
                  안 보인다. 인스펙터 변형이 이미 쓰던 알약을 폰에도 쓴다.
                  (`scripts/plan-board.cjs` 가 이 알약을 찾는다)
                */}
                <span
                  data-status-pill={isCompleted ? "COMPLETED" : "NORMAL"}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold text-white"
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                  {isCompleted ? "완료" : "예정"}
                </span>
              </div>
              <h2 className="font-user-content relative z-10 mt-3 max-w-full text-[28px] font-bold leading-[1.15] tracking-[-0.03em] text-white">
                {detail.title}
              </h2>
              <p className="relative z-10 mt-2 text-[14px] text-white/80">
                {formatDate(detail.startDate)}
                {formatKoreanTime(detail.startTime) ? (
                  <>
                    <span className="mx-1 opacity-60">·</span>
                    {formatKoreanTime(detail.startTime)}
                  </>
                ) : null}
              </p>
              {/* 시안 .c-inset — 금액과 결제 방식이 한 상자에 든다 */}
              <div className="relative z-10 mt-4 flex items-center gap-3 rounded-xl bg-white/15 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-white/80">지출 금액</div>
                  <div className="mt-0.5 break-keep text-[20px] font-bold leading-tight text-white">
                    {formattedAmount}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="whitespace-nowrap text-[12px] text-white/80">
                    결제 방식
                  </div>
                  <div className="mt-0.5 whitespace-nowrap text-[14px] font-bold text-white">
                    {payTypeLabel}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/*
          완료한 일정에서만 뜨는 후기 진입점.

          피드의 생사는 콘텐츠 공급에 달려 있고, 사람들은 "무엇을 올릴 수
          있는지" 를 모르면 안 올린다. 다 쓰고 난 그 자리에서 묻는 게 가장
          자연스럽다. 두 변형이 생김새가 다르므로 껍데기만 갈라 쓴다.
        */}
        {isCompleted && (
          <button
            type="button"
            onClick={() =>
              setPostTarget({
                scheduleId: detail.id,
                categoryName: detail.categoryName,
                title: detail.title,
                amount: detail.amount ?? null,
                location: detail.location ?? null,
                // 좌표가 있으면 모달이 장소를 자동으로 잡는다
                locationLat: mapCoords?.lat ?? null,
                locationLng: mapCoords?.lng ?? null,
              })
            }
            className={`flex w-full items-center gap-3 bg-white text-left transition-colors ${
              isInspector
                ? "rounded-[24px] border border-[#ee2b8c0f] p-4 shadow-sm hover:border-[#ee2b8c33]"
                : "rounded-2xl p-3 shadow-sm hover:shadow-md"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff2f6] text-[#ee2b8c]">
              <Star className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold text-[#1b0d14]">
                피드에 후기 올리기
              </span>
              <span className="mt-0.5 block text-[12px] text-gray-400">
                익명으로 올라가요. 다음 사람이 견적을 가늠할 수 있어요.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#d6ccd2]" />
          </button>
        )}

        {/* Location Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div
            /* 폰은 카드 껍데기를 벗고 구분선으로만 나눈다 — 그림자는
               떠 있는 것에만 쓴다. 인스펙터는 대시보드 카드 언어 그대로. */
            className={`flex flex-col bg-white ${
              isInspector
                ? "rounded-[24px] border border-[#ee2b8c0f] p-4 shadow-sm transition-shadow"
                : "-mx-6 border-b border-[#0000000c] px-6 py-4 md:-mx-8 md:px-8"
            } ${showMapOrCoordBox ? "h-[300px]" : ""}`}
          >
            <div
              className={`flex flex-1 items-start ${isInspector ? "min-h-0 gap-2.5" : "min-h-0 gap-3"}`}
            >
              <div
                className={
                  isInspector
                    ? "shrink-0 rounded-lg bg-[#fff2f6] p-2"
                    : "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef4ff]"
                }
              >
                <MapPin
                  className={
                    isInspector
                      ? "h-4 w-4 text-[#ee2b8c]"
                      : "h-5 w-5 text-[#3b76f6]"
                  }
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <div
                  className={
                    isInspector
                      ? "mb-1 text-[12.5px] text-gray-400"
                      : "text-[12px] font-bold text-[#868b94]"
                  }
                >
                  장소
                </div>
                <div
                  className={`font-user-content shrink-0 text-[#1a1c20] ${
                    isInspector
                      ? "mb-1.5 text-[13.5px] font-bold"
                      : "mt-[3px] mb-3 text-[16px] font-medium"
                  }`}
                >
                  {detail.location?.trim() || "장소 미정"}
                </div>
                {detail.location?.trim() && mapCoords && (
                  <motion.div
                    /*
                      layout: 접힘(자리 안) ↔ 펼침(fixed) 사이를 FLIP 으로
                      잇는다. 지도 DOM 은 이 안에 그대로 있어서 Kakao
                      인스턴스가 살아 있고, 크기만 바뀌므로 ResizeObserver 가
                      relayout 해 준다.
                    */
                    layout={isInspector}
                    transition={{ type: "spring", stiffness: 300, damping: 32 }}
                    className={
                      mapExpanded
                        ? "fixed inset-6 z-[300] shadow-2xl xl:inset-12"
                        : "relative w-full h-[200px]"
                    }
                  >
                    <div
                      id="schedule-detail-map"
                      className={`absolute inset-0 overflow-hidden border transition-opacity duration-300 ${
                        mapExpanded
                          ? "rounded-2xl border-gray-200 bg-white"
                          : isInspector
                            ? "rounded-lg border-gray-200"
                            : "rounded-t-xl border-[#0000000f]"
                      } ${mapLoaded ? "opacity-100" : "opacity-0"}`}
                    />
                    {!mapLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm font-medium">
                            지도 로딩 중...
                          </span>
                        </div>
                      </div>
                    )}
                    {isInspector && mapLoaded && (
                      <button
                        type="button"
                        onClick={() => setMapExpanded((v) => !v)}
                        aria-label={
                          mapExpanded ? "지도 작게 보기" : "지도 크게 보기"
                        }
                        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-[#ee2b8c1a] bg-white/95 px-2.5 py-1.5 text-[11.5px] font-bold text-[#6b6570] shadow-sm backdrop-blur-sm transition-colors hover:border-[#ee2b8c55] hover:text-[#ee2b8c]"
                      >
                        {mapExpanded ? (
                          <Minimize2 className="h-3.5 w-3.5" />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" />
                        )}
                        {mapExpanded ? "작게 보기" : "크게 보기"}
                      </button>
                    )}
                  </motion.div>
                )}
                {detail.location?.trim() && !mapCoords && hasNonZeroCoords && (
                  <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg flex-1 min-h-[200px] flex items-center justify-center border border-gray-200">
                    <div className="text-center font-user-content">
                      <MapPin className="w-5 h-5 text-gray-400 mx-auto mb-0.5" />
                      <div className="text-xs text-gray-500">
                        위도: {latStr}
                      </div>
                      <div className="text-xs text-gray-500">
                        경도: {lngStr}
                      </div>
                    </div>
                  </div>
                )}
                {mapLink && (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      isInspector
                        ? "mt-1.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ee2b8c] px-2.5 py-1 text-xs font-semibold text-[#ee2b8c] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        : /* 시안 .map__a — 지도 상자에 이어 붙는 한 줄 */
                          "block shrink-0 rounded-b-xl border border-t-0 border-[#0000000f] bg-white py-3 text-center text-[13px] font-bold text-[#ee2b8c]"
                    }
                  >
                    카카오맵에서 보기
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Memo Card */}
        {detail.memo?.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className={undefined}
          >
            <div
              className={
                isInspector
                  ? "rounded-[24px] border border-[#ee2b8c0f] bg-white p-4 shadow-sm"
                  : "-mx-6 border-b border-[#0000000c] bg-white px-6 py-4 md:-mx-8 md:px-8"
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className={
                    isInspector
                      ? "rounded-xl bg-[#f4eff2] p-2"
                      : "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff6e3]"
                  }
                >
                  <FileText
                    className={
                      isInspector
                        ? "h-4 w-4 text-[#7a6c74]"
                        : "h-5 w-5 text-[#d99414]"
                    }
                  />
                </div>
                <div className="flex-1">
                  <div
                    className={
                      isInspector
                        ? "mb-1 text-[12.5px] text-gray-400"
                        : "text-[12px] font-bold text-[#868b94]"
                    }
                  >
                    메모
                  </div>
                  <div
                    className={`font-user-content whitespace-pre-wrap text-[#1a1c20] ${
                      isInspector
                        ? "text-[13.5px] font-bold leading-relaxed"
                        : "mt-[3px] text-[16px] font-medium leading-normal"
                    }`}
                  >
                    {detail.memo}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Additional Categories */}
        {detail.addCategoryNameList &&
          detail.addCategoryNameList.filter(Boolean).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className={
                isInspector
                  ? "rounded-[24px] border border-[#ee2b8c0f] bg-white p-4 shadow-sm"
                  : "mt-3 bg-white rounded-2xl p-4 shadow-sm"
              }
            >
              <div className="text-sm text-gray-500 mb-3 font-medium">
                추가 카테고리
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.addCategoryNameList
                  .filter(Boolean)
                  .map((category, index) => (
                    <span
                      key={index}
                      className="bg-[#fff0f7] text-[#ee2b8c] px-4 py-2 rounded-full text-sm font-bold border border-[#ee2b8c11]"
                    >
                      {category}
                    </span>
                  ))}
              </div>
            </motion.div>
          )}
      </>
    );
  }

  const body = (
    <div
      className={
        isInspector
          ? "flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
          : "flex h-full min-h-0 w-full flex-col overflow-hidden"
      }
    >
      <div
        className={
          isInspector
            ? "flex h-full min-h-0 w-full flex-col overflow-hidden"
            : "relative flex h-full min-h-0 w-full flex-col overflow-x-hidden"
        }
      >
        {isInspector ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 px-5 py-3">
            <span className="truncate text-[13px] font-bold text-stone-400">
              플랜 상세
            </span>
            <button
              type="button"
              onClick={() => (onClose ? onClose() : router.back())}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-stone-400 transition-colors hover:bg-[#faf7f9] hover:text-stone-600"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        <main
          ref={mainScrollRef}
          className={
            isInspector
              ? "flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overflow-x-hidden px-5 pb-6 pt-5"
              : "pb-tabbar flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden box-border px-6 pt-5 md:px-8 md:pb-10"
          }
        >
          <div
            className={`w-full max-w-full min-w-0 ${
              isInspector ? "flex flex-col gap-[18px]" : ""
            }`}
          >
            {content}
          </div>

          {/*
            완료로 바꾸는 자리. 예전에는 이 화면에 상태를 바꿀 방법이 아예
            없어서, 금액·장소·메모를 확인하고도 보드나 홈으로 나가서 눌러야
            했다. 인스펙터는 보드 옆에 붙어 있어 그쪽 토글이 바로 보이므로
            폰(page 변형)에만 낸다.
          */}
          {isLoggedIn && detail && canEdit && !isInspector && (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={statusPending}
              className="mt-6 flex w-full items-center gap-3 rounded-xl bg-[#f7f8f9] px-4 py-3.5 text-left transition-colors hover:bg-[#edfaf6] disabled:opacity-60"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                  isCompleted
                    ? "border-[#079171] bg-[#079171] text-white"
                    : "border-[#dcdee3] bg-white"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] font-bold text-[#1a1c20]">
                  {isCompleted ? "예정으로 되돌리기" : "완료로 표시"}
                </span>
                <span className="mt-0.5 block text-[12px] text-[#868b94]">
                  {isCompleted
                    ? "아직 안 끝난 일이면 되돌릴 수 있어요"
                    : "끝난 일이면 눌러 주세요 · 결제 여부는 따로 관리해요"}
                </span>
              </span>
            </button>
          )}

          {/* Action Buttons: 본문 하단 (로그인 + 쓰기 권한이 있을 때만) */}
          {isLoggedIn && detail && canEdit && (
            <div
              className={`flex w-full max-w-full pb-2 ${
                isInspector ? "gap-3" : "mt-2 flex-col gap-2"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({ id: String(detail.id) });
                  if (roomId) params.set("roomId", roomId);
                  if (fromParam === "calendar") params.set("from", "calendar");
                  router.push(`/add-plen?${params.toString()}`);
                }}
                className={
                  isInspector
                    ? "flex-1 rounded-[13px] bg-[#ee2b8c] py-2.5 text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(238,43,140,0.75)] transition-transform hover:-translate-y-px active:scale-95"
                    : "w-full rounded-xl bg-[#ee2b8c] py-4 text-[16px] font-bold text-white transition-colors hover:bg-[#d4237b] active:scale-[0.99]"
                }
              >
                수정하기
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className={
                  isInspector
                    ? "flex-1 rounded-[13px] border border-[#f0e3ea] bg-white py-2.5 text-[13.5px] text-[#6b6570] transition-colors hover:border-[#ee2b8c55] hover:text-[#ee2b8c] disabled:cursor-not-allowed disabled:opacity-60"
                    : "w-full rounded-xl bg-[#f7f8f9] py-4 text-[16px] font-bold text-[#555d6d] transition-colors hover:bg-[#edeef0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                }
              >
                {deleting ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          )}
        </main>

        <FeedPostModal
          target={postTarget}
          onClose={() => setPostTarget(null)}
        />
        <FeedbackModal
          isOpen={showDeleteFeedbackModal}
          onClose={() => {
            setShowDeleteFeedbackModal(false);
            if (isInspector) {
              onClose?.();
            } else if (fromParam === "calendar") {
              router.push(roomId ? `/calendar?roomId=${roomId}` : "/calendar");
            } else {
              router.back();
            }
          }}
          type="deleted"
        />
        <CustomAlertModal
          isOpen={alertConfig.isOpen}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
        />

        {/* 삭제는 되돌릴 수 없으므로 한 번 더 확인받는다 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 px-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="플랜 삭제 확인"
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
            >
              <p className="text-center text-lg font-bold text-[#1b0d14]">
                이 플랜을 삭제할까요?
              </p>
              <p className="mt-2 text-center text-sm text-gray-500">
                삭제하면 되돌릴 수 없습니다.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 h-12 rounded-2xl border border-gray-200 bg-white font-bold text-sm text-[#1b0d14] hover:bg-gray-50 transition-all"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-12 rounded-2xl bg-[#ee2b8c] font-bold text-sm text-white hover:bg-[#d4237b] transition-all disabled:opacity-60"
                >
                  {deleting ? "삭제 중..." : "삭제하기"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isInspector) return body;

  /*
    단독 라우트는 받는 동안 **셸째로** 뼈대를 낸다. 예전에는 요청이 전역
    오버레이를 켜서 스피너가 화면 전체를 덮었다.
  */
  if (loading || (!detail && !error)) {
    return <RouteSkeletonScreen pathname="/schedule-detail" />;
  }

  /*
    단독 라우트(/schedule-detail)도 셸을 쓴다. 예전에는 max-w-md 폰 프레임
    이라, 넓은 화면의 홈 대시보드에서 카드를 눌러 들어오면 448px 띠로
    떨어졌다. 인스펙터는 셸 안에 이미 들어가 있으므로 이 분기만 감싼다.
  */
  return (
    <AppShell
      activeTab="home"
      activeRailView={fromParam === "calendar" ? "board" : "home"}
      unreadCount={unreadCount}
      bottomBarSlot={
        <BottomTabBar
          scrollDirection={scrollDirection}
          showLoginButton={false}
          unreadCount={unreadCount}
        />
      }
    >
      {body}
    </AppShell>
  );
}
