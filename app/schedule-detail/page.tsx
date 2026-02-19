"use client";

import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Tag,
} from "lucide-react";
import { motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import LoginRequiredModal from "../components/LoginRequiredModal";
import FeedbackModal from "../components/FeedbackModal";
import BottomTabBar from "../components/BottomTabBar";
import { useApi } from "../contexts/ApiContext";
import { useScrollDirection } from "../hooks/useScrollDirection";
import { getToken } from "@/lib/api";
import { getGuestScheduleList } from "@/lib/guestSchedule";
import { parseLocalDate } from "@/lib/utils";

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

function ScheduleDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchWithAuth } = useApi();
  const mainScrollRef = useRef<HTMLElement>(null);
  const scrollDirection = useScrollDirection(mainScrollRef);

  const [detail, setDetail] = useState<ScheduleDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteFeedbackModal, setShowDeleteFeedbackModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  const scheduleId = useMemo(() => {
    const idParam = searchParams.get("id");
    if (!idParam) return null;
    const parsed = Number(idParam);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);

  const roomId = searchParams.get("roomId");
  const fromParam = searchParams.get("from");

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
          setShowLoginRequiredModal(true);
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
  }, [detail?.locationLat, detail?.locationLng]);

  const handleDelete = useCallback(async () => {
    if (!detail?.id || deleting) return;
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/plan/schedule/${detail.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShowDeleteFeedbackModal(true);
      } else {
        const text = await res.text();
        window.alert(text || "삭제에 실패했습니다.");
      }
    } catch (err) {
      window.alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }, [detail?.id, deleting, fetchWithAuth, router]);

  useEffect(() => {
    if (window.kakao?.maps) return;
    const script = document.createElement("script");
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      window.kakao?.maps?.load(() => {});
    };
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!mapCoords || !window.kakao?.maps) {
      if (mapRef.current) {
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        mapRef.current = null;
      }
      return undefined;
    }
    const timer = setTimeout(() => {
      const container = document.getElementById("schedule-detail-map");
      if (!container) return;
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
      } catch {
        // ignore map init errors
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [mapCoords]);

  // 컨테이너 크기 변경 시 Kakao 지도 relayout (높이 300px 등으로 변경 시 지도가 새 크기에 맞게 다시 그려지도록)
  useEffect(() => {
    const el = document.getElementById("schedule-detail-map");
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (mapRef.current?.relayout) mapRef.current.relayout();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapCoords]);

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
        {/* Hero Section with status stamp */}
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
              </span>
            </div>
            <div className="h-px bg-white/25 mb-3" />
            <div className="flex items-end justify-between">
              <div>
                <div className="text-white/80 text-xs mb-1.5">지출 금액</div>
                <div className="text-2xl font-black text-white leading-tight">
                  {formattedAmount}
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                <div className="text-white/80 text-xs mb-0.5">결제 방식</div>
                <div className="text-white font-bold text-sm">
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
            className="absolute -top-8 -right-6"
          >
            {isCompleted ? (
              <div className="relative">
                <div className="bg-gradient-to-br from-green-400 to-green-600 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white">
                  <div className="text-center">
                    <Check
                      className="w-10 h-10 text-white mx-auto mb-1"
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
                <div className="bg-gradient-to-br from-orange-300 to-orange-500 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white">
                  <div className="text-center">
                    <Clock
                      className="w-10 h-10 text-white mx-auto mb-1"
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

        {/* Location Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div
            className={`bg-white rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow flex flex-col ${showMapOrCoordBox ? "h-[300px]" : ""}`}
          >
            <div className="flex items-start gap-2.5 flex-1 min-h-0">
              <div className="bg-gradient-to-br from-[#E5F3FF] to-[#D0E7FF] rounded-lg p-2 shrink-0">
                <MapPin className="w-4 h-4 text-[#4A90E2]" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <div className="text-xs font-bold text-[#ee2b8c88] uppercase tracking-wider mb-0.5">
                  장소
                </div>
                <div className="font-user-content text-sm font-bold text-[#1b0d14] mb-1.5 shrink-0">
                  {detail.location?.trim() || "장소 미정"}
                </div>
                {detail.location?.trim() && mapCoords && (
                  <div
                    id="schedule-detail-map"
                    className="w-full flex-1 min-h-[200px] rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                  />
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
            className="mt-4"
          >
            <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] rounded-xl p-2.5">
                  <FileText className="w-5 h-5 text-[#FF9800]" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-[#ee2b8c88] uppercase tracking-wider mb-0.5">
                    메모
                  </div>
                  <div className="font-user-content text-base font-semibold text-[#1b0d14] leading-relaxed whitespace-pre-wrap">
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
              className="mt-3 bg-white rounded-2xl p-4 shadow-sm"
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

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#fcfbfc]">
      <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />
      <div className="min-h-screen w-full max-w-md mx-auto bg-white shadow-2xl relative overflow-x-hidden flex flex-col grid-bg z-10 left-0 right-0">
        <div className="absolute top-0 left-0 right-0 z-50 w-full pointer-events-none">
          <div className="px-6 py-4 pointer-events-auto">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-[#ee2b8c] hover:bg-[#ee2b8c11] px-3 py-1.5 rounded-full transition-colors w-fit backdrop-blur-sm bg-white/30 shadow-sm"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-bold">뒤로가기</span>
            </button>
          </div>
        </div>

        <main
          ref={mainScrollRef}
          className={`flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-6 pt-5 min-w-0 w-full max-w-full box-border ${getToken() ? "pb-36" : "pb-24"}`}
        >
          <div className="w-full max-w-full min-w-0">{content}</div>

          {/* Action Buttons: 본문 하단 (로그인 시에만) */}
          {getToken() && detail && (
            <div className="w-full max-w-full flex gap-3 mt-4 pb-2">
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({ id: String(detail.id) });
                  if (roomId) params.set("roomId", roomId);
                  if (fromParam === "calendar") params.set("from", "calendar");
                  router.push(`/add-plen?${params.toString()}`);
                }}
                className="flex-1 bg-[#ee2b8c] hover:bg-[#d4237b] text-white py-3 rounded-2xl font-bold shadow-lg shadow-[#ee2b8c33] transition-all transform active:scale-95"
              >
                수정하기
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-white hover:bg-gray-50 text-[#1b0d14] py-3 rounded-2xl font-bold border-2 border-gray-100 hover:border-[#ee2b8c33] transition-all transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          )}
        </main>

        <BottomTabBar
          scrollDirection={scrollDirection}
          showLoginButton={false}
        />
        <LoginRequiredModal
          show={showLoginRequiredModal}
          onClose={() => {
            setShowLoginRequiredModal(false);
            if (!getToken()) {
              router.push("/");
            }
          }}
        />
        <FeedbackModal
          isOpen={showDeleteFeedbackModal}
          onClose={() => {
            setShowDeleteFeedbackModal(false);
            if (fromParam === "calendar") {
              router.push(roomId ? `/calendar?roomId=${roomId}` : "/calendar");
            } else {
              router.back();
            }
          }}
          type="deleted"
        />
      </div>
    </div>
  );
}

export default function ScheduleDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-[#fcfbfc]">
          <div className="flex items-center gap-3 text-[#ee2b8c]">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <span className="text-base font-semibold">불러오는 중...</span>
          </div>
        </div>
      }
    >
      <ScheduleDetailPageContent />
    </Suspense>
  );
}
