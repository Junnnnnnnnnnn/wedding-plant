"use client";

import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  MapPin,
  Tag,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import FeedbackModal from "../components/FeedbackModal";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import CustomAlertModal from "../components/CustomAlertModal";
import { useScrollDirection } from "../hooks/useScrollDirection";
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
  const router = useRouter();
  const { fetchWithAuth } = useApi();
  const { unreadCount } = useNotification();
  const mainScrollRef = useRef<HTMLElement>(null);
  const scrollDirection = useScrollDirection(mainScrollRef);

  const [detail, setDetail] = useState<ScheduleDetailData | null>(null);
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

  if (loading) {
    content = (
      <section className="flex flex-1 items-center justify-center rounded-3xl bg-white p-10 shadow-md">
        <div className="flex items-center gap-3 text-[#ee2b8c]">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span className="text-base font-semibold">불러오는 중...</span>
        </div>
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
            className="mt-10 mb-2 relative"
          >
            <div className="bg-[#f14d8e] rounded-[32px] p-7 shadow-[0_8px_32px_rgba(238,43,140,0.25)] relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <Tag className="w-3 h-3 text-white/60" />
                <span className="text-white/70 font-medium text-xs">
                  {detail.categoryName}
                </span>
              </div>
              <h2 className="font-user-content text-2xl font-black text-white mb-1.5 max-w-full leading-tight">
                {detail.title}
              </h2>
              <div className="flex items-center gap-2 mb-3 text-white/90">
                <Calendar className="w-3.5 h-3.5" />
                <span className="font-medium text-xs">
                  {formatDate(detail.startDate)}
                  {formatKoreanTime(detail.startTime) ? (
                    <>
                      <span className="mx-1 opacity-60">·</span>
                      {formatKoreanTime(detail.startTime)}
                    </>
                  ) : null}
                </span>
              </div>
              <div className="h-px bg-white/25 mb-3" />
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white/80 text-xs mb-1.5">지출 금액</div>
                  <div className="text-2xl font-black text-white leading-tight break-keep">
                    {formattedAmount}
                  </div>
                </div>
                <div className="shrink-0 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                  <div className="text-white/80 text-xs mb-0.5 whitespace-nowrap">
                    결제 방식
                  </div>
                  <div className="text-white font-bold text-sm whitespace-nowrap">
                    {payTypeLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Sticker: COMPLETED = 완료, NORMAL = 예정 */}
            <motion.div
              initial={{ opacity: 0, scale: 0, rotate: -20 }}
              animate={{
                opacity: 1,
                scale: 1,
                rotate: isCompleted ? 12 : -12,
              }}
              transition={{
                duration: 0.6,
                delay: 0.3,
                type: "spring",
                bounce: 0.5,
              }}
              className={
                isInspector
                  ? "absolute -top-5 -right-1"
                  : "absolute -top-8 -right-6"
              }
            >
              {isCompleted ? (
                <div className="relative">
                  <div
                    className={`bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white ${isInspector ? "w-[74px] h-[74px]" : "w-24 h-24"}`}
                  >
                    <div className="text-center">
                      <Check
                        className={`text-white mx-auto mb-1 ${isInspector ? "w-7 h-7" : "w-10 h-10"}`}
                        strokeWidth={4}
                      />
                      <div className="text-white font-black text-sm tracking-wider">
                        완료
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-green-500/30 rounded-full blur-xl -z-10" />
                </div>
              ) : (
                <div className="relative">
                  <div
                    className={`bg-gradient-to-br from-orange-300 to-orange-500 rounded-full flex items-center justify-center shadow-2xl border-4 border-white ${isInspector ? "w-[74px] h-[74px]" : "w-24 h-24"}`}
                  >
                    <div className="text-center">
                      <Clock
                        className={`text-white mx-auto mb-1 ${isInspector ? "w-7 h-7" : "w-10 h-10"}`}
                        strokeWidth={3}
                      />
                      <div className="text-white font-black text-sm tracking-wider">
                        예정
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-orange-400/30 rounded-full blur-xl -z-10" />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Location Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div
            className={`flex flex-col bg-white transition-shadow ${
              isInspector
                ? "rounded-[24px] border border-[#ee2b8c0f] p-4 shadow-sm"
                : "rounded-2xl p-3 shadow-sm hover:shadow-md"
            } ${showMapOrCoordBox ? "h-[300px]" : ""}`}
          >
            <div className="flex items-start gap-2.5 flex-1 min-h-0">
              <div
                className={
                  isInspector
                    ? "shrink-0 rounded-lg bg-[#fff2f6] p-2"
                    : "bg-gradient-to-br from-[#E5F3FF] to-[#D0E7FF] rounded-lg p-2 shrink-0"
                }
              >
                <MapPin
                  className={`w-4 h-4 ${isInspector ? "text-[#ee2b8c]" : "text-[#4A90E2]"}`}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <div
                  className={
                    isInspector
                      ? "mb-1 text-[12.5px] text-gray-400"
                      : "text-xs font-bold text-[#ee2b8c88] uppercase tracking-wider mb-0.5"
                  }
                >
                  장소
                </div>
                <div
                  className={`font-user-content mb-1.5 shrink-0 font-bold text-[#1b0d14] ${
                    isInspector ? "text-[13.5px]" : "text-sm"
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
                      className={`absolute inset-0 overflow-hidden border border-gray-200 transition-opacity duration-300 ${mapExpanded ? "rounded-2xl bg-white" : "rounded-lg"} ${mapLoaded ? "opacity-100" : "opacity-0"}`}
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
                    className="mt-1.5 shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#ee2b8c] px-2.5 py-1 text-xs font-semibold text-[#ee2b8c] transition-transform hover:scale-[1.02] active:scale-[0.98]"
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
            className={isInspector ? undefined : "mt-4"}
          >
            <div
              className={
                isInspector
                  ? "rounded-[24px] border border-[#ee2b8c0f] bg-white p-4 shadow-sm"
                  : "bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className={
                    isInspector
                      ? "rounded-xl bg-[#f4eff2] p-2"
                      : "bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] rounded-xl p-2.5"
                  }
                >
                  <FileText
                    className={
                      isInspector
                        ? "w-4 h-4 text-[#7a6c74]"
                        : "w-5 h-5 text-[#FF9800]"
                    }
                  />
                </div>
                <div className="flex-1">
                  <div
                    className={
                      isInspector
                        ? "mb-1 text-[12.5px] text-gray-400"
                        : "text-xs font-bold text-[#ee2b8c88] uppercase tracking-wider mb-0.5"
                    }
                  >
                    메모
                  </div>
                  <div
                    className={`font-user-content whitespace-pre-wrap leading-relaxed text-[#1b0d14] ${
                      isInspector
                        ? "text-[13.5px] font-bold"
                        : "text-base font-semibold"
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
        ) : (
          <div className="absolute top-0 left-0 right-0 z-50 w-full pointer-events-none">
            <div className="px-6 py-4 pointer-events-auto">
              <button
                type="button"
                onClick={() => (onClose ? onClose() : router.back())}
                className="flex items-center gap-2 text-[#ee2b8c] hover:bg-[#ee2b8c11] px-3 py-1.5 rounded-full transition-colors w-fit backdrop-blur-sm bg-white/30 shadow-sm"
                aria-label="뒤로가기"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold">뒤로가기</span>
              </button>
            </div>
          </div>
        )}

        <main
          ref={mainScrollRef}
          className={
            isInspector
              ? "flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overflow-x-hidden px-5 pb-6 pt-5"
              : `flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-6 pt-5 min-w-0 w-full max-w-full box-border md:px-8 ${isLoggedIn ? "pb-36 md:pb-10" : "pb-24 md:pb-10"}`
          }
        >
          <div
            className={`w-full max-w-full min-w-0 ${
              isInspector ? "flex flex-col gap-[18px]" : ""
            }`}
          >
            {content}
          </div>

          {/* Action Buttons: 본문 하단 (로그인 + 쓰기 권한이 있을 때만) */}
          {isLoggedIn && detail && canEdit && (
            <div
              className={`w-full max-w-full flex gap-3 pb-2 ${isInspector ? "" : "mt-4"}`}
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
                    : "flex-1 bg-[#ee2b8c] hover:bg-[#d4237b] text-white py-3 rounded-2xl font-bold shadow-lg shadow-[#ee2b8c33] transition-all transform active:scale-95"
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
                    : "flex-1 bg-white hover:bg-gray-50 text-[#1b0d14] py-3 rounded-2xl font-bold border-2 border-gray-100 hover:border-[#ee2b8c33] transition-all transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                }
              >
                {deleting ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          )}
        </main>

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
    단독 라우트(/schedule-detail)도 셸을 쓴다. 예전에는 max-w-md 폰 프레임
    이라, 넓은 화면의 홈 대시보드에서 카드를 눌러 들어오면 448px 띠로
    떨어졌다. 인스펙터는 셸 안에 이미 들어가 있으므로 이 분기만 감싼다.
  */
  return (
    <AppShell
      activeTab="home"
      activeRailView={fromParam === "calendar" ? "board" : "home"}
      unreadCount={unreadCount}
      gridBackground
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
