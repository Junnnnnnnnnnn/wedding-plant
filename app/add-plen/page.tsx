"use client";

import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Tag,
  X,
  Check,
  FileText,
  CreditCard,
  Wallet,
  DollarSign,
  Calendar,
  MapPin,
  Search,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import BottomTabBar from "../components/BottomTabBar";
import FeedbackModal from "../components/FeedbackModal";
import LoginRequiredModal from "../components/LoginRequiredModal";
import { getToken } from "@/lib/api";
import {
  addGuestScheduleItem,
  getGuestScheduleList,
} from "@/lib/guestSchedule";
import { useScrollDirection } from "../hooks/useScrollDirection";
import DatePickerModal from "../components/DatePickerModal";
import { useApi } from "../contexts/ApiContext";

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
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
};

function AddPlanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchWithAuth } = useApi();
  const editId = useMemo(() => {
    const idParam = searchParams.get("id");
    if (!idParam) return null;
    const parsed = Number(idParam);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);
  const roomIdParam = searchParams.get("roomId");
  const roomId = useMemo(() => {
    if (!roomIdParam?.trim()) return null;
    const n = Number(roomIdParam.trim());
    return Number.isNaN(n) ? null : n;
  }, [roomIdParam]);

  const dateParam = searchParams.get("date");
  const fromParam = searchParams.get("from");

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
  const [paymentType, setPaymentType] = useState<"현금" | "카드" | "기타" | null>(
    null,
  );
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
      y: number;
      x: number;
    }>
  >([]);
  const [showAllLocationResults, setShowAllLocationResults] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDuplicateCategoryModal, setShowDuplicateCategoryModal] =
    useState(false);
  const [showPlanSavedModal, setShowPlanSavedModal] = useState(false);
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

  /** 클라이언트 마운트 후에만 토큰 기준 표시 (로그인 버튼 플래시 방지) */
  useEffect(() => {
    setTokenChecked(true);
  }, []);

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
    // API 스크립트가 이미 로드되었는지 확인
    if (window.kakao && window.kakao.maps) {
      return;
    }

    // Kakao Maps SDK 스크립트 로드 (libraries=services 추가)
    const script = document.createElement("script");
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    script.async = true;

    script.onload = () => {
      // Kakao Maps API 로드 완료
      window.kakao.maps.load(() => {
        // API 준비 완료 - 지도 생성은 검색 시에 함
      });
    };

    document.head.appendChild(script);

    // Cleanup: 컴포넌트 언마운트 시 스크립트 제거
    // eslint-disable-next-line consistent-return
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // 지도 컨테이너가 렌더링된 후 지도 생성
  useEffect(() => {
    if (!showMap || !mapCoords || !window.kakao || !window.kakao.maps) {
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

      const coords = new window.kakao.maps.LatLng(mapCoords.lat, mapCoords.lng);

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

      // 항상 새로 생성 (컨테이너가 새로 생성되었을 수 있으므로)
      const options = {
        center: coords,
        level: 3,
        scrollwheel: false, // 마우스 휠로 지도 확대/축소 비활성화 (페이지 스크롤 허용)
        disableDoubleClick: true, // 더블클릭 확대 비활성화
        disableDoubleClickZoom: true, // 더블클릭 줌 비활성화
      };

      try {
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
      // cleanup은 showMap이 false가 될 때만 수행
    };
    // eslint-disable-next-line consistent-return
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, mapCoords]);

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
        };
        if (!json.result || !json.data?.list) return;
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
  const categoriesForModal = useMemo(
    () => [...allCategories, ...userAddedCategories],
    [allCategories, userAddedCategories],
  );

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
        });
        const json = (await res.json().catch(() => null)) as {
          result?: boolean;
          data?: {
            title?: string;
            categoryName?: string;
            amount?: number;
            startDate?: string | null;
            payType?: string;
            location?: string | null;
            locationLat?: number | string | null;
            locationLng?: number | string | null;
            memo?: string | null;
            addCategoryNameList?: string[] | null;
          };
        };

        if (!res.ok || !json.result || !json.data) {
          setShowSystemErrorModal(true);
          return;
        }

        const { data } = json;
        setInputValue(data.title?.trim() ?? "");

        const catLabel = data.categoryName?.trim();
        if (catLabel) {
          const found = allCategories.find((c) => c.label === catLabel);
          setSelectedCategory(found ?? { color: getColorByLabel(catLabel), label: catLabel });
        }

        if (data.amount != null && !Number.isNaN(Number(data.amount))) {
          setAmount(String(data.amount));
        }

        if (data.startDate?.trim()) {
          const d = new Date(data.startDate);
          if (!Number.isNaN(d.getTime())) {
            setSelectedDate(d);
            setIsDateUndecided(false);
          }
        } else {
          setIsDateUndecided(true);
        }

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
    if (found && (selectedCategory as CategoryItem).id !== found.id) {
      setSelectedCategory(found);
    }
  }, [allCategories, selectedCategory?.label]);

  /**
   * ============================================================================
   * 로컬 검색 함수 (임시 - OpenSearch 연동 전까지만 사용)
   * ============================================================================
   *
   * 현재 구현:
   * - allCategories 배열에서 자연어 입력을 기반으로 카테고리 추출
   * - 예: "나는 상견례를 하고 싶어" → "상견례" 카테고리 추출
   *
   * TODO: OpenSearch 백엔드 연동 시 아래 내용으로 교체
   *
   * 1. API 엔드포인트: POST /api/search/categories
   *
   * 2. 요청 형식:
   *    {
   *      "query": "사용자 입력 텍스트 (예: 나는 상견례를 하고 싶어)",
   *      "size": 10  // 최대 결과 개수
   *    }
   *
   * 3. 응답 형식:
   *    {
   *      "results": [
   *        { "color": "#FFE4E9", "label": "상견례", "score": 0.95 },
   *        { "color": "#FFE5D9", "label": "드레스 촬영", "score": 0.85 }
   *      ]
   *    }
   *
   * 4. 구현 예시:
   *    const response = await fetch('/api/search/categories', {
   *      method: 'POST',
   *      headers: { 'Content-Type': 'application/json' },
   *      body: JSON.stringify({ query: inputValue.trim(), size: 10 })
   *    });
   *    const data = await response.json();
   *    setSearchResults(data.results);
   *
   * 5. OpenSearch 쿼리 설정:
   *    - Natural Language Processing (NLP) 활용
   *    - Fuzzy matching으로 오타 허용
   *    - Synonyms (동의어) 설정: "예약" = "신청" = "등록"
   *    - Korean analyzer 사용 (nori)
   *
   * 6. 기타 고려사항:
   *    - Debounce 추가 (너무 빈번한 API 호출 방지)
   *    - Loading state 추가
   *    - Error handling 추가
   *    - Cache 고려
   * ============================================================================
   */
  useEffect(() => {
    if (inputValue.trim()) {
      const inputText = inputValue.trim().toLowerCase();
      const results = categoriesForModal.filter((category) =>
        inputText.includes(category.label.toLowerCase()),
      );
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

  const handleRemoveCategory = () => {
    setSelectedCategory(null);
    setCategorySelectedByUser(false);
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
    // 새로운 검색 시 기존 지도 숨기기 및 초기화
    setShowMap(false);
    setMapCoords(null);
    // 지도 인스턴스 초기화는 useEffect에서 처리됨

    // API가 로드될 때까지 대기
    const waitForApiAndSearch = () => {
      if (!window.kakao || !window.kakao.maps) {
        setTimeout(waitForApiAndSearch, 100);
        return;
      }

      // 장소 검색 서비스 객체 생성
      const places = new window.kakao.maps.services.Places();

      // 키워드 검색 콜백 함수
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callback = (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
          // 검색 결과가 있는 경우
          if (result.length > 0) {
            // 검색 결과 저장 (최대 10개)
            setLocationSearchResults(result.slice(0, 10));
            setShowAllLocationResults(false);
          } else {
            // 검색 결과가 없는 경우
            setLocationSearchResults([]);
          }
        } else {
          // 검색 실패
          setLocationSearchResults([]);
        }
      };

      // 키워드로 장소 검색 (최대 10개)
      places.keywordSearch(location.trim(), callback, {
        size: 10,
      });
    };

    waitForApiAndSearch();
  };

  const handleSelectLocation = (result: {
    place_name: string;
    address_name: string;
    road_address_name?: string;
    y: number;
    x: number;
  }) => {
    // 선택한 장소명으로 입력값 갱신
    setLocation(result.place_name);
    // 선택한 위치로 지도 표시
    const newCoords = {
      lat: result.y,
      lng: result.x,
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
      // eslint-disable-next-line no-alert
      alert("제목을 입력해주세요.");
      return false;
    }
    if (!selectedCategory) {
      // eslint-disable-next-line no-alert
      alert("카테고리를 선택해주세요.");
      return false;
    }
    if (!paymentType) {
      // eslint-disable-next-line no-alert
      alert("결제 유형을 선택해주세요.");
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

  return (
    <div className="min-h-screen bg-[#fcfbfc]">
      <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />
      <div className="min-h-screen max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col grid-bg z-10">
        <div className="absolute top-0 left-0 z-50 w-full pointer-events-none">
          <div className="px-6 py-4 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                if (fromParam === "calendar") {
                  router.push(roomId ? `/calendar?roomId=${roomId}` : "/calendar");
                } else {
                  router.push(roomId ? `/main?roomId=${roomId}` : "/main");
                }
              }}
              className="flex items-center gap-2 text-stone-500 hover:bg-stone-100 px-3 py-1.5 rounded-full transition-colors w-fit bg-white/50 backdrop-blur-sm"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">뒤로가기</span>
            </button>
          </div>
        </div>

        <main
          ref={mainScrollRef}
          className="flex flex-1 flex-col items-center overflow-y-auto px-6 pt-14 pb-24"
        >
          <div className="w-full pt-2">
            <div className="flex flex-col items-start justify-start">
              <span className="text-[32px] font-semibold text-[#ee2b8c] leading-none">
                {editId ? "플랜 수정" : "계획을 추가해보세요"}
              </span>
              <span className="text-[42px] font-semibold text-[#1b0d14] leading-none mt-2">
                {editId ? "수정하기" : "플랜 추가"}
              </span>
              {editId && isLoadingDetail && (
                <span className="text-sm text-stone-500 mt-2">
                  불러오는 중...
                </span>
              )}
            </div>
          </div>
          {/* 폼 카드 영역 */}
          <div className="mt-6 w-full space-y-5">
            {/* 제목 */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
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
                className="w-full px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#ee2b8c]/20 transition-all text-stone-800 placeholder:text-stone-400 font-user-content font-extrabold text-lg"
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
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
                    <label className="block text-sm font-semibold text-stone-600 mb-2">
                      카테고리 <span className="text-[#ee2b8c]">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenModal}
                        className={`flex-1 px-4 py-4 rounded-2xl text-left transition-all border font-user-content font-extrabold ${selectedCategory
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
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
                    <label className="block text-sm font-semibold text-stone-600 mb-2">
                      결제 유형 <span className="text-[#ee2b8c]">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["현금", "카드", "기타"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setPaymentType(type)}
                          className={`py-3 rounded-xl font-medium transition-all text-sm border ${paymentType === type
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
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
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
                        className="w-full px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#ee2b8c]/20 transition-all text-stone-800 placeholder:text-stone-300 font-medium text-lg text-right pr-12"
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
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
                    <label className="block text-sm font-semibold text-stone-600 mb-2">
                      일자
                    </label>
                    <div className="flex gap-2">
                      <div
                        className={`flex-1 px-4 py-4 rounded-2xl text-lg font-medium transition-all cursor-pointer flex items-center justify-center border ${isDateUndecided
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
                        className={`px-6 rounded-2xl font-medium transition-all text-sm border ${isDateUndecided
                          ? "bg-stone-800 text-white border-stone-800"
                          : "bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100"
                          }`}
                      >
                        미정
                      </button>
                    </div>
                  </div>
                  {/* 위치 */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
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
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 border ${location.trim()
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
                                    {result.road_address_name || result.address_name}
                                  </div>
                                </div>
                              ))}
                              {locationSearchResults.length > 3 &&
                                !showAllLocationResults && (
                                  <button
                                    type="button"
                                    onClick={() => setShowAllLocationResults(true)}
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
                              다른 장소 선택하기 ({locationSearchResults.length}개)
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
                          className="w-full h-[180px] rounded-2xl overflow-hidden border border-stone-200"
                          style={{ pointerEvents: "auto" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* 메모 */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
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
          {inputValue.trim() && selectedCategory && paymentType && !isLoadingDetail && (
            <div className="mt-8 w-full">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!validateForm()) return;
                  if (!getToken()) {
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
                      status: "NORMAL",
                      location: location.trim() || "",
                      locationLat: mapCoords?.lat ?? 0,
                      locationLng: mapCoords?.lng ?? 0,
                      memo: memo.trim() || "",
                      payType: paymentType ? PAY_TYPE_MAP[paymentType] : "OTHER",
                      addCategoryNameList: userAddedCategories.map(
                        (c) => c.label,
                      ),
                    };
                    addGuestScheduleItem(guestItem);
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
                  if (!isDateUndecided) {
                    body.startDate = formatDate(selectedDate);
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
                    });
                    const json = await res.json().catch(() => ({}));

                    if (res.ok && json.result === true) {
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
        {/* 하단 탭바 - Sticky로 최상단에 고정 */}
        <BottomTabBar
          showLoginButton={false}
          scrollDirection={scrollDirection}
        />
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
                        className={`w-full text-left px-6 py-4 rounded-2xl transition-all flex items-center justify-between border-2 ${selectedCategory?.label === category.label
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
        <FeedbackModal
          isOpen={showPlanSavedModal}
          onClose={() => {
            setShowPlanSavedModal(false);
            if (fromParam === "calendar") {
              router.push(roomId ? `/calendar?roomId=${roomId}` : "/calendar");
            } else {
              router.push(roomId ? `/main?roomId=${roomId}` : "/main");
            }
          }}
          type={editId ? "updated" : "registered"}
          title={editId ? "수정되었습니다" : "등록되었습니다"}
          subtitle={
            editId
              ? "Successfully updated"
              : "Successfully added to your plan"
          }
        />

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
      </div>
    </div>
  );
}

export default function AddPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-[#FFF5F2]">
          <div className="text-[#FF8FA3]">불러오는 중...</div>
        </div>
      }
    >
      <AddPlanPageContent />
    </Suspense>
  );
}
