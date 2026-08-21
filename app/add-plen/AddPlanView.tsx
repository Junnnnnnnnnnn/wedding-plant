"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Tag,
  X,
  Check,
  Search,
  Plus,
  ArrowLeft,
  MessageCircle,
  ChevronRight,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { io, Socket } from "socket.io-client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import LoginRequiredModal from "../components/LoginRequiredModal";
import { getToken, getApiBaseUrl } from "@/lib/api";
import { parseLocalDate } from "@/lib/utils";
import {
  addGuestScheduleItem,
  getGuestScheduleList,
} from "@/lib/guestSchedule";
import { useScrollDirection } from "../hooks/useScrollDirection";
import DatePickerModal from "../components/DatePickerModal";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import CustomAlertModal from "../components/CustomAlertModal";
import { Plan, ChatRoom } from "@/types";

// Kakao Maps API 타입 선언
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

/** 결제 유형 → API payType */
const PAY_TYPE_MAP: Record<"현금" | "카드" | "기타", string> = {
  현금: "CASH",
  카드: "CREDIT",
  기타: "OTHER",
};

/** API payType → 결제 유형 */
const PAY_TYPE_FROM_API: Record<string, "현금" | "카드" | "기타"> = {
  CASH: "현금",
  CREDIT: "카드",
  OTHER: "기타",
};

const PASTEL_COLORS = [
  "#FFE4E9", // 연분홍
  "#FFE5D9", // 살구색
  "#E8DDF5", // 연보라
  "#D5F0E5", // 민트
  "#FFF0D6", // 연노랑
  "#D4EBF7", // 연하늘
  "#E6F4EA", // 라이트 그린
  "#FCE4EC", // 코튼 캔디
];

const getColorByLabel = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash); // eslint-disable-line no-bitwise
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
};

/**
 * 제목에서 카테고리를 추천할 때 쓰는 매칭 규칙.
 *
 * 예전에는 단순히 `제목.includes(라벨)` 이었다. 그래서 "홀" 같은 한 글자
 * 라벨이 "홀리데이 스냅"에, "기타" 가 "기타 소품"에 계속 따라붙었다.
 *
 * - 한 글자 라벨은 아예 추천하지 않는다 (신호 대비 잡음이 너무 크다)
 * - 두 글자 라벨은 토큰 경계에 있을 때만 (문자열 처음·끝이거나 공백·구두점 옆)
 * - 세 글자 이상은 종전대로 부분 문자열 매칭
 */
const TOKEN_BOUNDARY = /[\s,./·()[\]{}\-_|]/;

function matchesCategoryLabel(inputText: string, rawLabel: string): boolean {
  const label = rawLabel.trim().toLowerCase();
  if (label.length < 2) return false;
  if (label.length >= 3) return inputText.includes(label);

  let from = 0;
  for (;;) {
    const at = inputText.indexOf(label, from);
    if (at === -1) return false;
    const before = at === 0 ? "" : inputText[at - 1];
    const afterIndex = at + label.length;
    const after = afterIndex >= inputText.length ? "" : inputText[afterIndex];
    const okBefore = before === "" || TOKEN_BOUNDARY.test(before);
    const okAfter = after === "" || TOKEN_BOUNDARY.test(after);
    if (okBefore && okAfter) return true;
    from = at + 1;
  }
}

export interface AddPlanViewProps {
  /**
   * `page` 는 자기 화면으로 열릴 때(폰·직접 진입). 셸과 뒤로가기를 직접 낸다.
   * `pane` 은 넓은 화면에서 보드·캘린더 옆에 붙을 때. 셸은 바깥이 잡고,
   * 나가는 길은 라우팅이 아니라 `onClose` 다.
   */
  variant?: "page" | "pane";
  /** 수정할 일정 id. 없으면 새로 만든다 */
  editId?: number | null;
  /** 공유 방 id */
  roomId?: number | null;
  /** 미리 채울 날짜 "YYYY-MM-DD" */
  initialDate?: string | null;
  /** 어디서 왔는지. page 변형에서 뒤로가기 목적지를 정한다 */
  from?: string | null;
  /** pane 변형에서 닫기 */
  onClose?: () => void;
  /** 저장이 끝났을 때. 부모가 목록을 다시 받는다 */
  onSaved?: () => void;
}

export default function AddPlanView({
  variant = "page",
  editId = null,
  roomId = null,
  initialDate = null,
  from = null,
  onClose,
  onSaved,
}: AddPlanViewProps) {
  const router = useRouter();
  const { fetchWithAuth, setLoading: setGlobalLoading } = useApi();
  const { unreadCount } = useNotification();
  const isPane = variant === "pane";
  /**
   * 폼은 폰 폭(≈390px 전체)에 맞춰 크게 잡혀 있다. pane 은 그와 비슷한
   * 폭이지만 옆에 보드가 함께 있어, 같은 크기로 두면 화면이 시끄럽다.
   * 카드 여백과 입력 글자만 한 단계 줄인다.
   */
  const cardClass = isPane
    ? "bg-white p-4 rounded-2xl shadow-sm border border-stone-100"
    : "bg-white p-5 rounded-2xl shadow-sm border border-stone-100";
  const fieldTextClass = isPane ? "text-[15px]" : "text-lg";
  const dateParam = initialDate;
  const fromParam = from;

  /**
   * 이 화면을 떠난다. 자기 화면이면 온 곳으로 돌아가고, pane 이면 닫기만
   * 한다 — pane 에서 라우팅하면 뒤에 있던 보드까지 통째로 다시 그린다.
   */
  const leaveScreen = React.useCallback(() => {
    if (isPane) {
      onClose?.();
      return;
    }
    if (fromParam === "calendar") {
      router.push(roomId ? `/calendar?roomId=${roomId}` : "/calendar");
    } else {
      router.push(roomId ? `/main?roomId=${roomId}` : "/main");
    }
  }, [isPane, onClose, fromParam, roomId, router]);

  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ color: string; label: string }>
  >([]);
  const [selectedCategory, setSelectedCategory] = useState<{
    color: string;
    label: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDateUndecided, setIsDateUndecided] = useState(false);
  /** 시작 시각 "HH:mm". 빈 문자열이면 "시간은 아직 안 정함" */
  const [startTime, setStartTime] = useState("");
  const [paymentType, setPaymentType] = useState<
    "현금" | "카드" | "기타" | null
  >(null);
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMap, setShowMap] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [mapCoords, setMapCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationSearchResults, setLocationSearchResults] = useState<
    Array<{
      place_name: string;
      address_name: string;
      road_address_name?: string;
      /** Kakao keywordSearch 는 좌표를 문자열로 준다 */
      y: string;
      x: string;
    }>
  >([]);
  const [showAllLocationResults, setShowAllLocationResults] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  /** Kakao Maps SDK가 실제로 쓸 수 있는 상태인지 (maps.load 완료) */
  const [kakaoSdkReady, setKakaoSdkReady] = useState(false);
  /** SDK 로드 자체가 실패했는지 (키 미설정·도메인 미등록·차단) */
  const [kakaoSdkFailed, setKakaoSdkFailed] = useState(false);
  /** 검색 요청 순번 — 늦게 온 이전 응답이 최신 결과를 덮어쓰지 않도록 */
  const searchSeqRef = useRef(0);
  /** 지도에 표시 중인 좌표가 어떤 장소명으로 선택된 것인지 */
  const selectedPlaceNameRef = useRef<string>("");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /**
   * 게스트 저장을 이미 마쳤는지. 게스트 경로는 setIsSaving 을 켜지 않아
   * 중복 제출 가드가 전혀 없었고, 저장 버튼을 빠르게 두 번 누르면
   * 같은 플랜이 두 건 들어갔다. disabled 는 리렌더 후에야 적용되므로
   * 동기적으로 막히는 ref 가 필요하다.
   */
  const guestSavedRef = useRef(false);
  const [showDuplicateCategoryModal, setShowDuplicateCategoryModal] =
    useState(false);
  const [showPlanSavedModal, setShowPlanSavedModal] = useState(false);
  const [showChatShareSelection, setShowChatShareSelection] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [savedScheduleId, setSavedScheduleId] = useState<number | null>(null);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    message: string;
    type: "warning" | "error" | "info" | "success";
  }>({
    isOpen: false,
    message: "",
    type: "warning",
  });

  const handleShareToChat = async (chatRoomId: number) => {
    try {
      const token = getToken();
      if (!token || !savedScheduleId) {
        setAlertConfig({
          isOpen: true,
          message: "공유에 실패했습니다.",
          type: "error",
        });
        return;
      }

      // 사용자 정보 가져오기
      const userRes = await fetchWithAuth("/plan/user", { skipLoading: true });
      const userJson = await userRes.json();
      if (!userJson.result || !userJson.data) {
        setAlertConfig({
          isOpen: true,
          message: "사용자 정보를 가져올 수 없습니다.",
          type: "error",
        });
        return;
      }

      const planUser = {
        id: userJson.data.id,
        name: userJson.data.name || "",
        profileImageUrl: userJson.data.profileImageUrl || "",
      };

      // 소켓 연결 및 메시지 전송
      const baseUrl = getApiBaseUrl();
      const socketUrl = baseUrl.replace(/\/+$/, "");

      const socket: Socket = io(`${socketUrl}/chat`, {
        transports: ["websocket"],
        auth: { token },
        forceNew: true,
      });

      /** 성공/실패 안내 후 원래 화면으로 돌아간다 */
      const finishShare = (ok: boolean) => {
        setAlertConfig({
          isOpen: true,
          message: ok
            ? editId
              ? "수정된 플랜이 채팅방에 공유되었습니다."
              : "채팅방에 플랜이 공유되었습니다."
            : "공유에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          type: ok ? "success" : "error",
        });
        setShowChatShareSelection(false);
        if (!ok) return;
        setTimeout(() => {
          onSaved?.();
          leaveScreen();
        }, 1500);
      };

      // 연결 여부와 무관하게 성공 알림을 띄우던 것을 고친다.
      // 연결이 안 되면 메시지는 전송되지 않는데 사용자는 공유됐다고 믿었다.
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        socket.disconnect();
        finishShare(ok);
      };

      // 연결이 끝내 안 되는 경우를 대비한 타임아웃
      timeoutId = setTimeout(() => settle(false), 10000);

      socket.on("connect", () => {
        socket.emit(
          "message",
          {
            room: chatRoomId,
            message: savedScheduleId,
            messageType: "schedule",
            planUser,
          },
          // 서버가 ack를 주면 그때 성공 처리, 안 주면 아래 타이머로 마무리
          () => settle(true),
        );
        // ack 미지원 서버 대비: 전송 직후 잠시 뒤 성공으로 간주
        setTimeout(() => settle(true), 800);
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        settle(false);
      });
    } catch (error) {
      console.error("Failed to share to chat:", error);
      setAlertConfig({
        isOpen: true,
        message: "공유에 실패했습니다.",
        type: "error",
      });
    }
  };

  const fetchChatRooms = async () => {
    try {
      const res = await fetchWithAuth("/plan/room/list", { skipLoading: true });
      const json = await res.json();
      if (json.result && json.data?.list) {
        const currentRoom = json.data.list.find(
          (p: Plan) => p.roomId === roomId,
        );
        if (currentRoom) {
          setChatRooms(currentRoom.chatRooms || []);
        } else if (json.data.list.length > 0) {
          // If roomId not found, show all chat rooms from all plans
          const allRooms = json.data.list.flatMap(
            (p: Plan) => p.chatRooms || [],
          );
          setChatRooms(allRooms);
        }
      }
    } catch (error) {
      console.error("Failed to fetch chat rooms:", error);
    }
  };

  const handlePlanSavedConfirm = () => {
    setShowPlanSavedModal(false);
    setShowChatShareSelection(true);
    fetchChatRooms();
  };

  const handlePlanSavedCancel = () => {
    setShowPlanSavedModal(false);
    onSaved?.();
    leaveScreen();
  };
  const [showSystemErrorModal, setShowSystemErrorModal] = useState(false);
  const [duplicateCategoryLabel, setDuplicateCategoryLabel] = useState<
    string | null
  >(null);
  const [highlightCategoryLabel, setHighlightCategoryLabel] = useState<
    string | null
  >(null);
  const highlightedCategoryRef = useRef<HTMLDivElement>(null);
  /** 모달/칩으로 카테고리를 직접 선택했을 때 true → 제목 추천 칩 영역 숨김. 제목 입력 변경 시 false로 리셋되어 제목 매칭 시 다시 표시 */
  const [categorySelectedByUser, setCategorySelectedByUser] = useState(false);
  const [userAddedCategories, setUserAddedCategories] = useState<
    Array<{ color: string; label: string }>
  >([]);
  const mainScrollRef = useRef<HTMLElement>(null);
  const scrollDirection = useScrollDirection(mainScrollRef);
  const loadedEditIdRef = useRef<number | null>(null);

  // ── 순차 표시 플래그 ──
  const isEditMode = !!editId && !isLoadingDetail;
  const showCategory = isEditMode || inputValue.trim().length > 0;
  const showPaymentType = isEditMode || !!selectedCategory;
  const showRestFields = isEditMode || !!paymentType;

  /** 캘린더에서 날짜 선택 후 플랜 추가 시 URL date 파라미터로 일자 초기화 */
  useEffect(() => {
    if (!dateParam?.trim()) return;
    const match = dateParam.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return;
    const [, y, m, d] = match;
    const year = Number(y);
    const month = Number(m) - 1;
    const day = Number(d);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return;
    const date = new Date(year, month, day);
    if (Number.isNaN(date.getTime())) return;
    setSelectedDate(date);
    setIsDateUndecided(false);
  }, [dateParam]);

  /**
   * ============================================================================
   * Kakao 지도 초기화 (API 스크립트 로드)
   * ============================================================================
   */
  // eslint-disable-next-line consistent-return
  useEffect(() => {
    // autoload=false 라서 sdk.js 실행 직후에도 window.kakao.maps 는 존재하지만
    // maps.load() 콜백 전까지 services / Map / LatLng 는 undefined 다.
    // 실제 심볼이 생겼는지로 준비 여부를 판단해야 한다.
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
      // 키 미설정·도메인 미등록·네트워크 차단 시. 무한 폴링 대신 여기서 끝낸다.
      console.error("Failed to load Kakao Maps SDK");
      setKakaoSdkFailed(true);
    };

    document.head.appendChild(script);

    // eslint-disable-next-line consistent-return
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    // Disable global loading modal for add-plen to show skeleton instead
    setGlobalLoading(false);
  }, [setGlobalLoading]);

  // 지도 컨테이너가 렌더링된 후 지도 생성
  useEffect(() => {
    if (
      !showMap ||
      !mapCoords ||
      !kakaoSdkReady ||
      !window.kakao?.maps?.LatLng
    ) {
      // showMap이 false가 되면 지도 인스턴스 초기화
      if (!showMap && mapRef.current) {
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        mapRef.current = null;
      }
      return undefined;
    }

    // DOM이 업데이트될 때까지 대기 (컨테이너가 렌더링될 시간 확보)
    const timer = setTimeout(() => {
      const container = document.getElementById("map");
      if (!container) {
        return;
      }

      // showMap이 false였다가 true로 변경되면 컨테이너가 새로 생성되므로 항상 새로 생성
      // 기존 지도 인스턴스가 있으면 제거
      if (mapRef.current) {
        // 기존 마커 제거
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        // 지도 인스턴스는 자동으로 정리되므로 null로 설정
        mapRef.current = null;
      }

      try {
        // LatLng 생성이 try 밖에 있으면 SDK가 덜 준비된 순간 setTimeout
        // 콜백에서 uncaught TypeError가 나 지도 생성이 통째로 스킵된다.
        const coords = new window.kakao.maps.LatLng(
          mapCoords.lat,
          mapCoords.lng,
        );
        const options = {
          center: coords,
          level: 3,
          scrollwheel: false, // 마우스 휠 확대/축소 비활성화 (페이지 스크롤 허용)
          disableDoubleClick: true,
          disableDoubleClickZoom: true,
        };
        const mapInstance = new window.kakao.maps.Map(container, options);
        mapRef.current = mapInstance;

        // 마커 생성
        const newMarker = new window.kakao.maps.Marker({
          map: mapInstance,
          position: coords,
        });
        markerRef.current = newMarker;
      } catch (error) {
        // 지도 생성 실패 시 무시 (에러는 발생하지만 사용자에게는 표시하지 않음)
      }
    }, 150); // 대기 시간을 약간 늘림

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line consistent-return
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, mapCoords]);

  // 언마운트 시 지도/마커 참조 정리.
  // 예전에는 cleanup 이 타이머만 정리해, 페이지를 오갈 때마다 Kakao Map
  // 인스턴스가 쌓였다.
  useEffect(
    () => () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapRef.current = null;
    },
    [],
  );

  /** API 카테고리 항목: type USER → 모달에서 "my" 뱃지 표시 */
  type CategoryItem = {
    id?: number;
    color: string;
    label: string;
    type?: "SYSTEM" | "USER" | "ROOM";
  };

  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);

  /** GET /plan/category/list 또는 /plan/category/room/{roomId}/list 로 카테고리 목록 로드 */
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const endpoint = roomId
          ? `/plan/category/room/${roomId}/list`
          : getToken()
            ? "/plan/category/user/list"
            : "/plan/category/list";

        const res = await fetchWithAuth(endpoint, {
          method: "GET",
          skipLoading: true,
        });
        const json = (await res.json().catch(() => null)) as {
          result?: boolean;
          data?: {
            total?: number;
            list?: Array<{
              id: number;
              name: string;
              color: string;
              type: "SYSTEM" | "USER" | "ROOM";
            }>;
          };
        } | null;
        // .catch(() => null) 을 달아 놓고 null 이 아닌 타입으로 단언하고
        // 있었다. 비-JSON 응답이면 json.result 에서 TypeError 가 나 바깥
        // catch 로 삼켜지고, 카테고리 목록이 빈 채로 남았다.
        if (!json?.result || !json.data?.list) return;
        const list = json.data.list
          .map((item) => ({
            id: item.id,
            color: getColorByLabel(item.name),
            label: item.name,
            type: item.type,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "ko"));
        setAllCategories(list);
      } catch {
        // 실패 시 빈 목록 유지
      }
    };
    loadCategories();
  }, [fetchWithAuth, roomId]);

  /** 모달 그리드용: API 카테고리 + 세션에서 추가한 카테고리 */
  const categoriesForModal = useMemo(() => {
    // 상세 응답의 addCategoryNameList 와 /plan/category 목록에 같은 이름이
    // 겹쳐 들어와 모달에 같은 항목이 두 번 뜨는 일이 있었다. 라벨 기준으로 합친다.
    const merged = [...allCategories, ...userAddedCategories];
    const seen = new Set<string>();
    return merged.filter((c) => {
      const key = c.label.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allCategories, userAddedCategories]);

  /** "my" 뱃지 표시 대상: API type USER + 세션에서 추가한 카테고리 라벨 */
  const userAddedLabels = useMemo(
    () =>
      new Set([
        ...allCategories.filter((c) => c.type === "USER").map((c) => c.label),
        ...userAddedCategories.map((c) => c.label),
      ]),
    [allCategories, userAddedCategories],
  );

  /** 수정 모드: id가 있으면 GET /plan/schedule/{id} 로 폼 채우기 (중복 요청 방지) */
  useEffect(() => {
    if (!editId || !getToken()) return;
    if (loadedEditIdRef.current === editId) return;
    loadedEditIdRef.current = editId;
    setIsLoadingDetail(true);

    const loadDetail = async () => {
      try {
        const res = await fetchWithAuth(`/plan/schedule/${editId}`, {
          method: "GET",
          skipLoading: true,
        });
        const json = (await res.json().catch(() => null)) as {
          result?: boolean;
          data?: {
            title?: string;
            categoryName?: string;
            amount?: number;
            startDate?: string | null;
            startTime?: string | null;
            payType?: string;
            location?: string | null;
            locationLat?: number | string | null;
            locationLng?: number | string | null;
            memo?: string | null;
            addCategoryNameList?: string[] | null;
          };
        } | null;

        if (!res.ok || !json?.result || !json.data) {
          setShowSystemErrorModal(true);
          return;
        }

        const { data } = json;
        setInputValue(data.title?.trim() ?? "");

        const catLabel = data.categoryName?.trim();
        if (catLabel) {
          const found = allCategories.find((c) => c.label === catLabel);
          setSelectedCategory(
            found ?? { color: getColorByLabel(catLabel), label: catLabel },
          );
        }

        if (data.amount != null && !Number.isNaN(Number(data.amount))) {
          setAmount(String(data.amount));
        }

        if (data.startDate?.trim()) {
          // "YYYY-MM-DD" 를 new Date 로 파싱하면 UTC 자정으로 읽혀
          // 타임존에 따라 하루 밀린다. 로컬 파싱 유틸을 쓴다.
          const d = parseLocalDate(data.startDate) ?? new Date(data.startDate);
          if (!Number.isNaN(d.getTime())) {
            setSelectedDate(d);
            setIsDateUndecided(false);
          }
        } else {
          setIsDateUndecided(true);
        }

        setStartTime(data.startTime?.trim() ?? "");

        const payType =
          data.payType && PAY_TYPE_FROM_API[data.payType]
            ? PAY_TYPE_FROM_API[data.payType]
            : "기타";
        setPaymentType(payType);

        setLocation(data.location?.trim() ?? "");

        const lat =
          data.locationLat != null ? parseFloat(String(data.locationLat)) : NaN;
        const lng =
          data.locationLng != null ? parseFloat(String(data.locationLng)) : NaN;
        if (
          !Number.isNaN(lat) &&
          !Number.isNaN(lng) &&
          (lat !== 0 || lng !== 0)
        ) {
          setMapCoords({ lat, lng });
          setShowMap(true);
        }

        setMemo(data.memo?.trim() ?? "");

        if (
          Array.isArray(data.addCategoryNameList) &&
          data.addCategoryNameList.length > 0
        ) {
          const added = data.addCategoryNameList
            .filter(
              (name): name is string =>
                typeof name === "string" && name.trim() !== "",
            )
            .map((label) => ({
              color: getColorByLabel(label.trim()),
              label: label.trim(),
            }));
          setUserAddedCategories(added);
        }
      } catch {
        setShowSystemErrorModal(true);
      } finally {
        setIsLoadingDetail(false);
      }
    };

    loadDetail();
  }, [editId, fetchWithAuth, allCategories]);

  /** API 카테고리 로드 후 selectedCategory가 있으면 API 항목으로 동기화 (색상/type 반영) */
  useEffect(() => {
    if (!selectedCategory || allCategories.length === 0) return;

    const found = allCategories.find((c) => c.label === selectedCategory.label);

    // label이 같은데 id가 다르다면, 최신 API 데이터(found)로 업데이트
    if (found && (selectedCategory as CategoryItem).id !== found.id) {
      setSelectedCategory(found);
    }
  }, [allCategories, selectedCategory]); // label 대신 selectedCategory 전체를 넣음

  useEffect(() => {
    if (inputValue.trim()) {
      const inputText = inputValue.trim().toLowerCase();
      const results = categoriesForModal
        .filter((category) => matchesCategoryLabel(inputText, category.label))
        // 더 구체적인(긴) 라벨을 위로 올린다
        .sort((a, b) => b.label.length - a.label.length);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [inputValue, categoriesForModal]);

  // 마우스 드래그로 슬라이드 기능
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [hasMoved, setHasMoved] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setHasMoved(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // 스크롤 속도 조절

    // 실제로 움직임이 있으면 hasMoved를 true로 설정
    if (Math.abs(walk) > 5) {
      setHasMoved(true);
    }

    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    // 드래그가 끝난 후 약간의 지연을 두고 hasMoved 리셋
    setTimeout(() => setHasMoved(false), 100);
  };

  const handleCategoryClick = (category: { color: string; label: string }) => {
    // 드래그 중이거나 드래그가 발생했으면 클릭 무시
    if (isDragging || hasMoved) return;
    setSelectedCategory(category);
    setCategorySelectedByUser(true);
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsAddingCategory(false);
    setNewCategoryName("");
  };

  const handleSelectFromModal = (category: {
    color: string;
    label: string;
  }) => {
    setSelectedCategory(category);
    setCategorySelectedByUser(true);
    setIsModalOpen(false);
  };

  const handleStartAddingCategory = () => {
    // JWT(로그인) 여부 확인
    if (!getToken()) {
      handleCloseModal();
      setShowLoginRequiredModal(true);
      return;
    }
    setIsAddingCategory(true);
    setNewCategoryName("");
  };

  const handleCancelAddingCategory = () => {
    setIsAddingCategory(false);
    setNewCategoryName("");
  };

  const handleCompleteAddingCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    // 기존 카테고리·사용자 추가 카테고리와 이름 중복 검사
    const existsInAll = allCategories.some(
      (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
    );
    const existsInUser = userAddedCategories.some(
      (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existsInAll || existsInUser) {
      const existingLabel =
        allCategories.find(
          (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
        )?.label ??
        userAddedCategories.find(
          (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
        )?.label ??
        trimmed;
      setDuplicateCategoryLabel(existingLabel);
      setShowDuplicateCategoryModal(true);
      setIsAddingCategory(false);
      setNewCategoryName("");
      return;
    }

    const categoryColor = getColorByLabel(trimmed);

    const newCategory = {
      color: categoryColor,
      label: trimmed,
    };
    setUserAddedCategories((prev) => [...prev, newCategory]);
    setSelectedCategory(newCategory);
    setCategorySelectedByUser(true);
    setIsModalOpen(false);
    setIsAddingCategory(false);
    setNewCategoryName("");
  };

  const handleNewCategoryKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation(); // ClickSpark 트리거 방지
      // 글자 없이 엔터 입력 시 무력화
      if (newCategoryName.trim()) {
        handleCompleteAddingCategory();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleCancelAddingCategory();
    } else if (e.key === " ") {
      // 글자 없이 스페이스 입력 시 무력화
      if (!newCategoryName.trim()) {
        e.preventDefault();
      }
      e.stopPropagation();
    }
  };

  // 카테고리 추가 모드일 때 input에 포커스
  useEffect(() => {
    if (isAddingCategory && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  // "이미 존재합니다" 모달 닫기 → 중복 카테고리 위치로 스크롤 후 밝은 분홍 보더
  const handleCloseDuplicateModal = () => {
    const label = duplicateCategoryLabel;
    setShowDuplicateCategoryModal(false);
    setDuplicateCategoryLabel(null);
    if (label) {
      setHighlightCategoryLabel(label);
    }
  };

  // 하이라이트 대상이 설정되면 해당 요소로 스크롤
  useEffect(() => {
    if (!highlightCategoryLabel) return;
    const timer = requestAnimationFrame(() => {
      highlightedCategoryRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(timer);
  }, [highlightCategoryLabel]);

  // 하이라이트 3초 후 해제
  useEffect(() => {
    if (!highlightCategoryLabel) return;
    const id = setTimeout(() => setHighlightCategoryLabel(null), 3000);
    return () => clearTimeout(id);
  }, [highlightCategoryLabel]);

  // 금액 포맷팅 (콤마 추가)
  const formatNumber = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, "");
    // 콤마 추가
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const formatted = formatNumber(value);
    setAmount(formatted);
  };

  const handleSearchLocation = () => {
    if (!location.trim()) return;

    setHasSearched(true);
    setShowMap(false);
    setMapCoords(null);
    // 이전 검색 결과를 남겨두면, 새 결과가 오기 전에 사용자가 옛 항목을
    // 눌러 엉뚱한 좌표가 저장될 수 있다.
    setLocationSearchResults([]);
    setShowAllLocationResults(false);

    if (kakaoSdkFailed) {
      setAlertConfig({
        isOpen: true,
        message:
          "지도 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        type: "error",
      });
      return;
    }
    // SDK가 아직 준비되지 않았으면 준비된 뒤 effect가 다시 검색한다.
    // (예전에는 100ms 재귀 폴링이라 SDK가 영영 안 뜨면 무한히 돌았다)
    if (!kakaoSdkReady) return;

    const seq = searchSeqRef.current + 1;
    searchSeqRef.current = seq;

    const places = new window.kakao.maps.services.Places();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callback = (result: any, status: any) => {
      // 더 최신 검색이 시작됐으면 이 응답은 버린다
      if (searchSeqRef.current !== seq) return;
      if (
        status === window.kakao.maps.services.Status.OK &&
        Array.isArray(result) &&
        result.length > 0
      ) {
        setLocationSearchResults(result.slice(0, 10));
        setShowAllLocationResults(false);
      } else {
        setLocationSearchResults([]);
      }
    };

    places.keywordSearch(location.trim(), callback, { size: 10 });
  };

  // SDK가 늦게 준비된 경우, 사용자가 이미 눌러둔 검색을 이어서 실행한다.
  // (검색 시점에 준비가 안 됐으면 handleSearchLocation 이 그냥 반환하기 때문)
  useEffect(() => {
    if (!kakaoSdkReady) return;
    if (!hasSearched) return;
    if (locationSearchResults.length > 0) return;
    if (!location.trim()) return;
    handleSearchLocation();
    // handleSearchLocation 은 매 렌더 새로 만들어지므로 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakaoSdkReady]);

  const handleSelectLocation = (result: {
    place_name: string;
    address_name: string;
    road_address_name?: string;
    y: string;
    x: string;
  }) => {
    // 선택한 장소명으로 입력값 갱신
    setLocation(result.place_name);
    selectedPlaceNameRef.current = result.place_name.trim();
    // Kakao 결과의 x/y 는 문자열이라 그대로 저장하면 백엔드에도
    // 문자열로 전송된다. 숫자로 변환해 둔다.
    const lat = Number(result.y);
    const lng = Number(result.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setAlertConfig({
        isOpen: true,
        message: "위치 좌표를 읽지 못했습니다. 다른 장소를 선택해 주세요.",
        type: "error",
      });
      return;
    }
    const newCoords = {
      lat,
      lng,
    };
    setMapCoords(newCoords);
    setShowMap(true);
    // 검색 결과 목록 접기 (버튼만 표시)
    setShowAllLocationResults(false);
  };

  const handleSaveWithoutLocation = () => {
    // 지도 정보 없이 저장 - 위치 입력은 유지하되 검색 결과만 초기화
    setShowMap(false);
    setMapCoords(null);
    setLocationSearchResults([]);
    setShowAllLocationResults(false);
    setHasSearched(false);
    // 위치 입력은 유지 (사용자가 다시 검색할 수 있도록)
  };

  // 날짜 포맷팅 (YYYY-MM-DD)
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setIsDateUndecided(false);
  };

  // 필수값 유효성 검사
  const validateForm = () => {
    if (!inputValue.trim()) {
      setAlertConfig({
        isOpen: true,
        message: "제목을 입력해주세요.",
        type: "warning",
      });
      return false;
    }
    if (!selectedCategory) {
      setAlertConfig({
        isOpen: true,
        message: "카테고리를 선택해주세요.",
        type: "warning",
      });
      return false;
    }
    if (!paymentType) {
      setAlertConfig({
        isOpen: true,
        message: "결제 유형을 선택해주세요.",
        type: "warning",
      });
      return false;
    }
    return true;
  };

  // 표시할 항목 결정 (Input에 값이 있을 때만)
  let displayItems: Array<{ id: string; color: string; label: string }> = [];

  if (inputValue.trim()) {
    // Input에 텍스트가 있으면
    if (searchResults.length > 0) {
      // 검색 결과가 있으면 결과만 표시
      displayItems = searchResults.map((item, idx) => ({
        ...item,
        id: `search-${idx}`,
      }));
    }
    // 검색 결과가 없으면 아무것도 표시하지 않음
  }

  const content = (
    // data-plan-pane: pane 으로 붙었을 때 바깥에서 이 영역만 집어내는 표식.
    // /main 에는 같은 이름의 카테고리 필터 칩이 이미 떠 있어, 문서 전체에서
    // 버튼을 찾으면 엉뚱한 걸 누른다 (하네스가 실제로 그렇게 눌렀다).
    <div
      data-plan-pane={isPane ? "" : undefined}
      className="relative flex h-full min-h-0 w-full flex-col"
    >
      {isPane ? (
        /*
            pane 은 폭이 좁고 셸이 이미 화면을 나눠 놨다. 떠 있는
            "뒤로가기" 알약 대신, 인스펙터와 같은 모양의 머리글을 둔다.
          */
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#ee2b8c14] bg-white px-5 py-3.5">
          <b className="truncate text-[15px] font-bold tracking-tight text-[#1b0d14]">
            {editId ? "플랜 수정" : "플랜 추가"}
          </b>
          <button
            type="button"
            onClick={leaveScreen}
            aria-label="닫기"
            className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="absolute top-0 left-0 z-50 w-full pointer-events-none">
          <div className="px-6 py-4 pointer-events-auto">
            <button
              type="button"
              onClick={leaveScreen}
              className="flex items-center gap-2 text-stone-500 hover:bg-stone-100 px-3 py-1.5 rounded-full transition-colors w-fit bg-white/50 backdrop-blur-sm"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">뒤로가기</span>
            </button>
          </div>
        </div>
      )}

      <main
        ref={mainScrollRef}
        className={
          isPane
            ? "flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pt-5 pb-10"
            : "flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pt-14 pb-24 md:px-8 md:pb-12"
        }
      >
        {!isPane && (
          <div className="w-full pt-2 md:max-w-[680px]">
            <div className="flex flex-col items-start justify-start">
              <span className="text-[32px] font-semibold text-[#ee2b8c] leading-none">
                {editId ? "플랜 수정" : "계획을 추가해보세요"}
              </span>
              <span className="text-[42px] font-semibold text-[#1b0d14] leading-none mt-2">
                {editId ? "수정하기" : "플랜 추가"}
              </span>
            </div>
          </div>
        )}
        {editId && isLoadingDetail && (
          <div className="mt-6 w-full space-y-5 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-stone-50 rounded-2xl border border-stone-100"
              />
            ))}
          </div>
        )}
        {/* 폼 카드 영역 */}
        <div
          className={
            isPane
              ? "w-full space-y-4"
              : "mt-6 w-full space-y-5 md:max-w-[680px]"
          }
        >
          {/* 제목 */}
          <div className={cardClass}>
            <label className="block text-sm font-semibold text-stone-600 mb-2">
              제목 <span className="text-[#ee2b8c]">*</span>
            </label>
            <input
              id="plan-name"
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setCategorySelectedByUser(false);
              }}
              placeholder="어떤 지출인가요?"
              className={`w-full px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#ee2b8c]/20 transition-all text-stone-800 placeholder:text-stone-400 font-user-content font-extrabold ${fieldTextClass}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  if (!inputValue.trim()) {
                    e.preventDefault();
                    e.stopPropagation();
                  } else {
                    e.stopPropagation();
                  }
                }
              }}
            />
          </div>
          {/* 카테고리 */}
          <AnimatePresence>
            {showCategory && (
              <motion.div
                key="category-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className={cardClass}>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    카테고리 <span className="text-[#ee2b8c]">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenModal}
                      className={`flex-1 px-4 py-4 rounded-2xl text-left transition-all border font-user-content font-extrabold ${
                        selectedCategory
                          ? "bg-[#ee2b8c]/5 text-[#ee2b8c] border-[#ee2b8c]/20"
                          : "bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {selectedCategory
                        ? selectedCategory.label
                        : "카테고리 선택"}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenModal}
                      className="w-14 h-14 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center hover:bg-stone-100 transition-colors flex-shrink-0"
                      aria-label="카테고리 추가"
                    >
                      <Plus className="w-6 h-6 text-stone-400" />
                    </button>
                  </div>
                  {/* 검색 결과 - 제목 입력 시 추천 카테고리 (모달/칩으로 직접 선택했을 때는 숨김, 제목 수정 시 다시 표시) */}
                  {inputValue.trim() &&
                    displayItems.length > 0 &&
                    !categorySelectedByUser && (
                      <div
                        ref={scrollRef}
                        className="mt-3 w-full overflow-x-auto overflow-y-hidden scrollbar-hide flex gap-2 flex-nowrap pr-2 select-none cursor-grab active:cursor-grabbing"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                      >
                        {displayItems.map((category) => (
                          <div
                            key={category.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleCategoryClick(category)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleCategoryClick(category);
                              }
                            }}
                            className="h-9 px-3 flex-shrink-0 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity bg-stone-100 border border-stone-200"
                          >
                            <span className="text-sm font-medium text-stone-600 whitespace-nowrap">
                              {category.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* 결제 유형 */}
          <AnimatePresence>
            {showPaymentType && (
              <motion.div
                key="payment-type-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className={cardClass}>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    결제 유형 <span className="text-[#ee2b8c]">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["현금", "카드", "기타"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPaymentType(type)}
                        className={`py-3 rounded-xl font-medium transition-all text-sm border ${
                          paymentType === type
                            ? "bg-stone-800 text-white shadow-sm border-stone-800"
                            : "bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* 나머지 필드: 금액·일자·위치·메모 */}
          <AnimatePresence>
            {showRestFields && (
              <motion.div
                key="rest-fields-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-5"
              >
                {/* 금액 */}
                <div className={cardClass}>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    금액
                  </label>
                  <div className="relative">
                    <input
                      id="plan-amount"
                      type="text"
                      inputMode="numeric"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0"
                      className={`w-full px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#ee2b8c]/20 transition-all text-stone-800 placeholder:text-stone-300 font-medium ${fieldTextClass} text-right pr-12`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          if (!amount.trim()) {
                            e.preventDefault();
                            e.stopPropagation();
                          } else {
                            e.stopPropagation();
                          }
                        }
                      }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 font-medium">
                      만원
                    </span>
                  </div>
                </div>
                {/* 일자 */}
                <div className={cardClass}>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    일자
                  </label>
                  <div className="flex gap-2">
                    <div
                      className={`flex-1 px-4 py-4 rounded-2xl ${fieldTextClass} font-medium transition-all cursor-pointer flex items-center justify-center border ${
                        isDateUndecided
                          ? "bg-stone-50 text-stone-300 border-stone-200"
                          : "bg-[#ee2b8c]/5 text-[#ee2b8c] border-[#ee2b8c]/20"
                      }`}
                      onClick={() => {
                        setIsDateUndecided(false);
                        setIsDatePickerOpen(true);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsDateUndecided(false);
                          setIsDatePickerOpen(true);
                        }
                      }}
                    >
                      {isDateUndecided ? "미정" : formatDate(selectedDate)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDateUndecided(!isDateUndecided)}
                      className={`px-6 rounded-2xl font-medium transition-all text-sm border ${
                        isDateUndecided
                          ? "bg-stone-800 text-white border-stone-800"
                          : "bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      미정
                    </button>
                  </div>
                  {/*
                      시간은 선택이다. 날짜만 잡아 두는 일정이 훨씬 많아서
                      비워 두는 걸 기본으로 하고, 날짜가 미정이면 아예 감춘다.
                    */}
                  {!isDateUndecided && (
                    <div className="mt-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-stone-400 shrink-0" />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        step={300}
                        aria-label="시작 시각"
                        className="flex-1 px-4 py-3 rounded-2xl border border-stone-200 bg-stone-50 text-base font-medium text-stone-700 outline-none transition-colors focus:border-[#ee2b8c]/40 focus:bg-white"
                      />
                      {startTime ? (
                        <button
                          type="button"
                          onClick={() => setStartTime("")}
                          className="px-4 py-3 rounded-2xl text-sm font-medium text-stone-400 border border-stone-200 bg-stone-50 transition-colors hover:bg-stone-100"
                        >
                          지우기
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
                {/* 위치 */}
                <div className={cardClass}>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    위치
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      id="plan-location"
                      type="text"
                      value={location}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setLocation(newValue);
                        if (!newValue.trim()) {
                          setLocationSearchResults([]);
                          setShowMap(false);
                          setMapCoords(null);
                          setHasSearched(false);
                          setShowAllLocationResults(false);
                        } else if (
                          mapCoords &&
                          newValue.trim() !== selectedPlaceNameRef.current
                        ) {
                          // 장소를 고른 뒤 이름만 바꾸면 좌표가 그대로 남아
                          // 엉뚱한 위치가 저장된다. 이름이 달라지면 좌표를 버린다.
                          setShowMap(false);
                          setMapCoords(null);
                        }
                      }}
                      placeholder="예식장, 스튜디오 등"
                      className="flex-1 min-w-0 px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#ee2b8c]/20 transition-all text-stone-800 placeholder:text-stone-400 font-user-content font-semibold"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          if (!location.trim()) {
                            e.preventDefault();
                          } else {
                            handleSearchLocation();
                          }
                        }
                        if (e.key === " ") {
                          if (!location.trim()) e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSearchLocation}
                      disabled={!location.trim()}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 border ${
                        location.trim()
                          ? "bg-stone-800 text-white border-stone-800 hover:bg-stone-700 shadow-sm"
                          : "bg-stone-100 text-stone-400 border-stone-200"
                      }`}
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  </div>
                  {/* 검색 결과 목록 */}
                  {hasSearched && locationSearchResults.length > 0 && (
                    <div className="mt-3 w-full">
                      <div className="flex flex-col gap-2">
                        {/* 지도가 표시되지 않았을 때만 검색 결과 목록 표시 */}
                        {!showMap && (
                          <>
                            {(showAllLocationResults
                              ? locationSearchResults
                              : locationSearchResults.slice(0, 3)
                            ).map((result) => (
                              <div
                                key={`${result.x}-${result.y}-${result.place_name}`}
                                onClick={() => handleSelectLocation(result)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleSelectLocation(result);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                className="px-4 py-3 bg-white rounded-xl border border-stone-200 hover:border-[#ee2b8c] cursor-pointer transition-colors"
                              >
                                <div className="font-bold text-stone-900 mb-1">
                                  {result.place_name}
                                </div>
                                <div className="text-sm text-stone-600">
                                  {result.road_address_name ||
                                    result.address_name}
                                </div>
                              </div>
                            ))}
                            {locationSearchResults.length > 3 &&
                              !showAllLocationResults && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowAllLocationResults(true)
                                  }
                                  className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-600 font-medium text-sm hover:bg-stone-100 transition-colors"
                                >
                                  + {locationSearchResults.length - 3}개 더보기
                                </button>
                              )}
                          </>
                        )}
                        {/* 지도가 표시되었을 때는 버튼만 표시 (전체 개수) */}
                        {showMap && locationSearchResults.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowMap(false);
                              setShowAllLocationResults(false);
                            }}
                            className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-600 font-medium text-sm hover:bg-stone-100 transition-colors"
                          >
                            다른 장소 선택하기 ({locationSearchResults.length}
                            개)
                          </button>
                        )}
                        {/* 원하는 결과가 없을 때 */}
                        {!showMap && (
                          <div className="flex justify-between items-center px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl">
                            <span className="text-sm text-stone-500">
                              원하는 결과가 없나요?
                            </span>
                            <button
                              type="button"
                              onClick={handleSaveWithoutLocation}
                              className="text-sm font-semibold text-stone-700 hover:text-stone-900 underline underline-offset-2"
                            >
                              그냥 사용하기
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* 검색 결과 없음 */}
                  {hasSearched && locationSearchResults.length === 0 && (
                    <div className="mt-2 text-center text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-xl py-4">
                      검색 결과가 없습니다.{" "}
                      <button
                        type="button"
                        onClick={handleSaveWithoutLocation}
                        className="font-semibold text-stone-700 underline underline-offset-2"
                      >
                        그냥 사용하기
                      </button>
                    </div>
                  )}
                  {/* 지도 - 위치 선택 시 카드 내에 표시 */}
                  {showMap && (
                    <div ref={mapContainerRef} className="mt-3 w-full">
                      <div
                        id="map"
                        className="w-full h-[180px] rounded-2xl overflow-hidden border border-stone-200 md:h-[260px] lg:h-[320px]"
                        style={{ pointerEvents: "auto" }}
                      />
                    </div>
                  )}
                </div>

                {/* 메모 */}
                <div className={cardClass}>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    메모
                  </label>
                  <div className="relative">
                    <textarea
                      ref={memoTextareaRef}
                      id="plan-memo"
                      value={memo}
                      maxLength={500}
                      onChange={(e) => {
                        const newValue = e.target.value.slice(0, 500);
                        setMemo(newValue);
                        if (memoTextareaRef.current) {
                          memoTextareaRef.current.style.height = "auto";
                          memoTextareaRef.current.style.height = `${memoTextareaRef.current.scrollHeight}px`;
                        }
                      }}
                      placeholder="메모 남기기"
                      className="w-full min-h-[100px] px-4 py-4 pb-8 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#ee2b8c]/20 transition-all resize-none text-stone-800 placeholder:text-stone-400 font-user-content font-semibold"
                      style={{ height: "auto" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          if (!memo.trim()) {
                            e.preventDefault();
                            e.stopPropagation();
                          } else {
                            e.stopPropagation();
                          }
                        }
                      }}
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-stone-400 font-medium">
                      {memo.length}/500
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 저장 버튼 - 제목과 카테고리가 모두 있을 때만 표시 */}
        {inputValue.trim() &&
          selectedCategory &&
          paymentType &&
          !isLoadingDetail && (
            <div className="mt-8 w-full">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!validateForm()) return;
                  if (!getToken()) {
                    if (guestSavedRef.current) return;
                    const existing = getGuestScheduleList();
                    if (existing.length >= 3) {
                      setShowLoginRequiredModal(true);
                      return;
                    }

                    const amountValue = amount.replace(/,/g, "");
                    const guestItem = {
                      categoryName: selectedCategory.label,
                      title: inputValue.trim(),
                      amount: amountValue ? parseInt(amountValue, 10) : 0,
                      startDate: isDateUndecided
                        ? null
                        : formatDate(selectedDate),
                      startTime: isDateUndecided ? null : startTime || null,
                      status: "NORMAL",
                      location: location.trim() || "",
                      locationLat: mapCoords?.lat ?? 0,
                      locationLng: mapCoords?.lng ?? 0,
                      memo: memo.trim() || "",
                      payType: paymentType
                        ? PAY_TYPE_MAP[paymentType]
                        : "OTHER",
                      addCategoryNameList: userAddedCategories.map(
                        (c) => c.label,
                      ),
                    };
                    guestSavedRef.current = true;
                    addGuestScheduleItem(guestItem);
                    setIsSaving(true);
                    setShowPlanSavedModal(true);
                    return;
                  }

                  const amountValue = amount.replace(/,/g, "");
                  const body: Record<string, unknown> = {
                    categoryName: selectedCategory.label,
                    title: inputValue.trim(),
                    payType: paymentType ? PAY_TYPE_MAP[paymentType] : "OTHER",
                    amount: amountValue ? parseInt(amountValue, 10) : 0,
                    location: location.trim() || "",
                    locationLat: mapCoords?.lat ?? 0,
                    locationLng: mapCoords?.lng ?? 0,
                    memo: memo.trim() || "",
                    addCategoryNameList: userAddedCategories.map(
                      (c) => c.label,
                    ),
                  };
                  if (isDateUndecided) {
                    // 수정 시 필드를 빼면 PATCH 시맨틱상 "변경 없음"이라
                    // 날짜를 미정으로 되돌릴 수 없었다. null 을 명시한다.
                    if (editId) body.startDate = null;
                    // 날짜가 미정이면 시각도 의미가 없다
                    body.startTime = "";
                  } else {
                    body.startDate = formatDate(selectedDate);
                    body.startTime = startTime || "";
                  }
                  if (!editId && roomId != null) {
                    body.roomId = roomId;
                  }

                  setIsSaving(true);
                  try {
                    const url = editId
                      ? `/plan/schedule/${editId}`
                      : "/plan/schedule";
                    const res = await fetchWithAuth(url, {
                      method: editId ? "PATCH" : "POST",
                      body: JSON.stringify(body),
                      skipLoading: true,
                    });
                    const json = await res.json().catch(() => ({}));

                    if (res.ok && json.result === true) {
                      // 수정 모드일 때는 기존 editId 사용, 새로 생성할 때는 응답에서 받은 ID 사용
                      const scheduleId =
                        editId || (json.data?.id ? Number(json.data.id) : null);
                      if (scheduleId) {
                        setSavedScheduleId(scheduleId);
                        console.log(
                          "Schedule ID for sharing:",
                          scheduleId,
                          editId ? "(edit mode)" : "(new)",
                        );
                      }
                      setShowPlanSavedModal(true);
                      return;
                    }
                    setShowSystemErrorModal(true);
                  } catch {
                    setShowSystemErrorModal(true);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="w-full px-6 py-4 bg-[#ee2b8c] text-white font-bold text-lg rounded-xl hover:bg-[#d4237b] transition-colors shadow-lg shadow-[#ee2b8c44] active:scale-[0.98] transform disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSaving
                  ? editId
                    ? "수정 중..."
                    : "저장 중..."
                  : editId
                    ? "수정하기"
                    : "플랜 저장하기"}
              </button>
            </div>
          )}
      </main>
      {/*
        하단 탭바 — 모바일 전용. ≥768 은 셸의 좌측 레일이 대신한다.
        pane 에서는 내지 않는다. 셸이 이미 하나 렌더하고 있어서 DOM 에
        탭바가 둘이 되고, 바깥에서 pane 안을 훑을 때 걸리적거린다.
      */}
      {!isPane && (
        <div className="md:hidden">
          <BottomTabBar
            showLoginButton={false}
            scrollDirection={scrollDirection}
            unreadCount={unreadCount}
          />
        </div>
      )}
      <LoginRequiredModal
        show={showLoginRequiredModal}
        onClose={() => setShowLoginRequiredModal(false)}
        title={
          !getToken() && getGuestScheduleList().length >= 3
            ? "이미 3개의 플랜을 계획하셨어요"
            : undefined
        }
      />

      {/* 카테고리 선택 모달 */}
      <AnimatePresence>
        {isModalOpen && (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <motion.div
            key="category-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={handleCloseModal}
          >
            <motion.div
              key="category-modal-content"
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{
                duration: 0.3,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="bg-white rounded-3xl w-full max-w-md p-7 max-h-[70vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-amber-600" />
                  </div>
                  <h2 className="text-2xl font-black text-stone-900">
                    카테고리 선택
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  aria-label="닫기"
                >
                  <X className="w-6 h-6 text-stone-500" />
                </button>
              </div>

              {/* 카테고리 목록 - 왼쪽에서 차례대로 슬라이드 인 */}
              <div className="space-y-3">
                {categoriesForModal.map((category, index) => (
                  <motion.div
                    key={`modal-${"id" in category && category.id != null ? category.id : `new-${category.label}`}`}
                    ref={
                      category.label === highlightCategoryLabel
                        ? highlightedCategoryRef
                        : null
                    }
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={
                      category.label === highlightCategoryLabel
                        ? "scroll-mt-8"
                        : ""
                    }
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectFromModal(category)}
                      style={
                        selectedCategory?.label === category.label
                          ? { backgroundColor: category.color }
                          : {
                              backgroundColor: `${category.color}20`,
                              borderColor: category.color,
                            }
                      }
                      className={`w-full text-left px-6 py-4 rounded-2xl transition-all flex items-center justify-between border-2 ${
                        selectedCategory?.label === category.label
                          ? "text-[#1b0d14] shadow-lg scale-[1.02]"
                          : "text-[#1b0d14] hover:opacity-90"
                      } ${category.label === highlightCategoryLabel ? "ring-2 ring-[#FF8FA3] ring-offset-2" : ""}`}
                    >
                      <span className="font-user-content font-bold text-lg flex items-center gap-2">
                        {selectedCategory?.label === category.label
                          ? "✨ "
                          : ""}
                        {category.label}
                        {userAddedLabels.has(category.label) && (
                          <span
                            className="rounded-full bg-[#ee2b8c] text-white text-xs font-bold px-2 py-0.5"
                            aria-label="내가 추가한 카테고리"
                          >
                            my
                          </span>
                        )}
                        {"type" in category && category.type === "ROOM" && (
                          <span
                            className="rounded-full bg-stone-600 text-white text-xs font-bold px-2 py-0.5"
                            aria-label="공유 카테고리"
                          >
                            room
                          </span>
                        )}
                      </span>
                      {selectedCategory?.label === category.label && (
                        <Check className="w-6 h-6 flex-shrink-0" />
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* 카테고리 종류 추가 - 모달 내 마지막 요소 */}
              <div className="mt-4 pt-4 border-t border-stone-100">
                {isAddingCategory ? (
                  <div className="rounded-2xl flex flex-col items-stretch gap-3 border-2 border-[#FFAAB8] bg-white p-4">
                    <input
                      ref={newCategoryInputRef}
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={handleNewCategoryKeyDown}
                      placeholder="새 카테고리 이름"
                      className="w-full px-4 py-3 text-sm font-extrabold font-user-content text-[#1b0d14] bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-[#ee2b8c] placeholder:text-stone-400"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancelAddingCategory}
                        className="flex-1 py-3 rounded-xl border-2 border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-100 transition-colors"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleCompleteAddingCategory}
                        disabled={!newCategoryName.trim()}
                        className="flex-1 py-3 rounded-xl bg-[#ee2b8c] text-white font-semibold text-sm hover:bg-[#d4237b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        확인
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full py-4 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border-2 border-dashed border-[#ee2b8c] bg-[#FFF5F2]"
                    onClick={handleStartAddingCategory}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleStartAddingCategory();
                      }
                    }}
                  >
                    <span className="text-2xl font-bold text-[#ee2b8c] mb-1">
                      +
                    </span>
                    <span className="text-sm font-semibold text-[#ee2b8c]">
                      카테고리 추가
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 플랜 등록/수정 완료 피드백 모달 */}
      <AnimatePresence>
        {showPlanSavedModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#1b0d14]/60 backdrop-blur-md"
              onClick={handlePlanSavedCancel}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-[320px] rounded-[40px] shadow-2xl relative z-10 overflow-hidden p-8 flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-[#ee2b8c11] rounded-3xl flex items-center justify-center mb-6">
                <Check className="w-10 h-10 text-[#ee2b8c]" strokeWidth={3} />
              </div>
              <h3 className="text-xl font-black text-[#1b0d14] mb-2">
                플랜이 {editId ? "수정" : "생성"}되었습니다
              </h3>
              <p className="text-stone-500 text-sm font-medium mb-8 leading-relaxed">
                {editId
                  ? "수정된 플랜을 채팅방에 공유할까요?"
                  : "채팅방에 공유할까요?"}
              </p>
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={handlePlanSavedCancel}
                  className="flex-1 h-14 rounded-2xl bg-stone-100 text-stone-500 font-bold hover:bg-stone-200 transition-colors"
                >
                  아니요
                </button>
                <button
                  type="button"
                  onClick={handlePlanSavedConfirm}
                  className="flex-1 h-14 rounded-2xl bg-[#ee2b8c] text-white font-bold shadow-lg shadow-[#ee2b8c33] hover:bg-[#d4237b] transition-colors"
                >
                  예
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 채팅방 선택 모달 */}
      <AnimatePresence>
        {showChatShareSelection && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#1b0d14]/60 backdrop-blur-md"
              onClick={() => {
                setShowChatShareSelection(false);
                handlePlanSavedCancel();
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-md rounded-t-[40px] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[70vh]"
            >
              <div className="p-6 border-b border-stone-50 flex justify-between items-center">
                <h3 className="text-xl font-black text-[#1b0d14]">
                  {editId ? "수정된 플랜 공유" : "공유할 채팅방 선택"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowChatShareSelection(false);
                    handlePlanSavedCancel();
                  }}
                  className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center text-stone-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {chatRooms.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 font-medium">
                    참여 중인 채팅방이 없습니다.
                  </div>
                ) : (
                  chatRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => handleShareToChat(room.id)}
                      className="w-full flex items-center justify-between p-4 bg-stone-50 rounded-2xl hover:bg-[#ee2b8c05] hover:border-[#ee2b8c22] border border-transparent transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#ee2b8c] shadow-sm">
                          <MessageCircle className="w-6 h-6" />
                        </div>
                        <span className="font-bold text-[#1b0d14]">
                          {room.name}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-[#ee2b8c] transition-colors" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 시스템 오류 모달 */}
      {showSystemErrorModal && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowSystemErrorModal(false)}
          onKeyDown={(e) =>
            e.key === "Escape" && setShowSystemErrorModal(false)
          }
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-error-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p
              id="system-error-modal-title"
              className="text-center text-lg font-semibold text-stone-900"
            >
              시스템 오류입니다
            </p>
            <button
              type="button"
              onClick={() => setShowSystemErrorModal(false)}
              className="mt-4 w-full rounded-xl bg-[#ee2b8c] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d4237b]"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 이미 존재하는 카테고리 알림 모달 */}
      {showDuplicateCategoryModal && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          onClick={handleCloseDuplicateModal}
          onKeyDown={(e) => e.key === "Escape" && handleCloseDuplicateModal()}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p
              id="duplicate-modal-title"
              className="text-center text-lg font-semibold text-stone-900"
            >
              이미 존재합니다
            </p>
            <p className="mt-2 text-center text-sm text-stone-600">
              동일한 이름의 카테고리가 있습니다.
            </p>
            <button
              type="button"
              onClick={handleCloseDuplicateModal}
              className="mt-4 w-full rounded-xl bg-[#FFAAB8] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#FF8FA3]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 날짜 선택 캘린더 모달 */}
      <DatePickerModal
        isOpen={isDatePickerOpen}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onClose={() => setIsDatePickerOpen(false)}
      />

      {/* 커스텀 알림 모달 */}
      <CustomAlertModal
        isOpen={alertConfig.isOpen}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );

  if (isPane) return content;

  return (
    <AppShell activeTab="home" activeRailView="home" gridBackground>
      {content}
    </AppShell>
  );
}
