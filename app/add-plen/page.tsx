"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import BottomTabBar from "../components/BottomTabBar";
import DatePickerModal from "../components/DatePickerModal";
import { useWedding } from "../contexts/WeddingContext";

// Kakao Maps API 타입 선언
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

export default function AddPlanPage() {
  const router = useRouter();
  const { user } = useWedding();
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
  const [paymentType, setPaymentType] = useState<"현금" | "카드" | "기타">(
    "기타",
  );
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const [showMap, setShowMap] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [map, setMap] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [marker, setMarker] = useState<any>(null);
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
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
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
      return undefined;
    }

    // DOM이 업데이트될 때까지 대기
    const timer = setTimeout(() => {
      const container = document.getElementById("map");
      if (!container) {
        return;
      }

      const coords = new window.kakao.maps.LatLng(mapCoords.lat, mapCoords.lng);

      // 지도가 없으면 새로 생성
      if (!map) {
        const options = {
          center: coords,
          level: 3,
          scrollwheel: false, // 마우스 휠로 지도 확대/축소 비활성화 (페이지 스크롤 허용)
          disableDoubleClick: true, // 더블클릭 확대 비활성화
          disableDoubleClickZoom: true, // 더블클릭 줌 비활성화
        };
        const mapInstance = new window.kakao.maps.Map(container, options);
        setMap(mapInstance);

        // 마커 생성
        const newMarker = new window.kakao.maps.Marker({
          map: mapInstance,
          position: coords,
        });
        setMarker(newMarker);
      } else {
        // 기존 지도 사용 - 좌표 업데이트
        map.setCenter(coords);
        map.setLevel(3);

        // 기존 마커 제거 후 새 마커 생성
        if (marker) {
          marker.setMap(null);
        }
        const newMarker = new window.kakao.maps.Marker({
          map,
          position: coords,
        });
        setMarker(newMarker);
      }

      // 지도 생성 후 스크롤 (선택적 - 필요시에만)
      // 스크롤이 막히는 문제를 방지하기 위해 제거
      // mapContainerRef.current?.scrollIntoView({
      //   behavior: "smooth",
      //   block: "start",
      // });
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line consistent-return
  }, [showMap, mapCoords, map, marker]);

  /**
   * ============================================================================
   * 전체 카테고리 목록 (더미 데이터)
   * ============================================================================
   *
   * TODO: 백엔드 연동 시 아래 내용으로 교체
   *
   * 1. API 엔드포인트: GET /api/categories
   *
   * 2. 응답 형식:
   *    {
   *      "categories": [
   *        { "id": "1", "color": "#FFE4E9", "label": "상견례" },
   *        { "id": "2", "color": "#FFE5D9", "label": "드레스 촬영" },
   *        ...
   *      ]
   *    }
   *
   * 3. 구현 예시:
   *    const [allCategories, setAllCategories] = useState([]);
   *
   *    useEffect(() => {
   *      const fetchCategories = async () => {
   *        const response = await fetch('/api/categories');
   *        const data = await response.json();
   *        setAllCategories(data.categories);
   *      };
   *      fetchCategories();
   *    }, []);
   *
   * 4. OpenSearch 인덱스 구조:
   *    - index: wedding-categories
   *    - mappings: {
   *        "id": "keyword",
   *        "label": "text" with Korean analyzer,
   *        "color": "keyword",
   *        "synonyms": ["text"] // 예: "예약" -> ["신청", "등록"]
   *      }
   * ============================================================================
   */
  const allCategories = useMemo(
    () =>
      [
        { color: "#FFE4E9", label: "가구 구매" },
        { color: "#FFE5D9", label: "결혼식" },
        { color: "#E8DDF5", label: "공연 예약" },
        { color: "#D5F0E5", label: "드레스 구매" },
        { color: "#FFF0D6", label: "드레스 촬영" },
        { color: "#D4EBF7", label: "렌탈 예약" },
        { color: "#FFE4E9", label: "메이크업 예약" },
        { color: "#FFE5D9", label: "부케 주문" },
        { color: "#E8DDF5", label: "상견례" },
        { color: "#D5F0E5", label: "서류 준비" },
        { color: "#FFF0D6", label: "선물 구매" },
        { color: "#D4EBF7", label: "스냅 촬영" },
        { color: "#FFE4E9", label: "신혼여행" },
        { color: "#FFE5D9", label: "예단 준비" },
        { color: "#E8DDF5", label: "예물 구매" },
        { color: "#D5F0E5", label: "예식장 예약" },
        { color: "#FFF0D6", label: "음식 시식" },
        { color: "#D4EBF7", label: "이사 준비" },
        { color: "#FFE4E9", label: "인테리어" },
        { color: "#FFE5D9", label: "전세 계약" },
        { color: "#E8DDF5", label: "축가 부탁" },
        { color: "#D5F0E5", label: "카드 제작" },
        { color: "#FFF0D6", label: "커플링 구매" },
        { color: "#D4EBF7", label: "턱시도 대여" },
        { color: "#FFE4E9", label: "페이퍼 초대장" },
        { color: "#FFE5D9", label: "폐백 준비" },
        { color: "#E8DDF5", label: "한복 대여" },
        { color: "#D5F0E5", label: "허니문 예약" },
        { color: "#FFF0D6", label: "헤어 예약" },
        { color: "#D4EBF7", label: "혼주 구매" },
      ].sort((a, b) => a.label.localeCompare(b.label, "ko")),
    [],
  );

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
      // input에 값이 있으면 검색 실행
      const inputText = inputValue.trim().toLowerCase();
      const results = allCategories.filter((category) =>
        // 입력 텍스트에 카테고리 label이 포함되어 있는지 확인
        inputText.includes(category.label.toLowerCase()),
      );
      setSearchResults(results);
    } else {
      // input이 비어있으면 검색 결과 초기화
      setSearchResults([]);
    }
  }, [inputValue, allCategories]);

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
  };

  const handleRemoveCategory = () => {
    setSelectedCategory(null);
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
    setIsModalOpen(false);
  };

  const handleStartAddingCategory = () => {
    // 로그인 여부 확인
    if (!user) {
      // eslint-disable-next-line no-alert
      alert("로그인이 필요한 서비스입니다.");
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
    if (newCategoryName.trim()) {
      // 기존 카테고리 색상 중 랜덤 선택
      const colors = [
        "#FFE4E9",
        "#FFE5D9",
        "#E8DDF5",
        "#D5F0E5",
        "#FFF0D6",
        "#D4EBF7",
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newCategory = {
        color: randomColor,
        label: newCategoryName.trim(),
      };
      setSelectedCategory(newCategory);
      setIsModalOpen(false);
      setIsAddingCategory(false);
      setNewCategoryName("");
    }
  };

  const handleNewCategoryKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCompleteAddingCategory();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelAddingCategory();
    }
  };

  // 카테고리 추가 모드일 때 input에 포커스
  useEffect(() => {
    if (isAddingCategory && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

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
            // 지도는 숨김 (결과 선택 시에만 표시)
            setShowMap(false);
            setMapCoords(null);
          } else {
            // 검색 결과가 없는 경우
            setLocationSearchResults([]);
            setShowMap(false);
            setMapCoords(null);
          }
        } else {
          // 검색 실패
          setLocationSearchResults([]);
          setShowMap(false);
          setMapCoords(null);
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
    // 선택한 위치로 지도 표시
    setMapCoords({
      lat: result.y,
      lng: result.x,
    });
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
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <main className="relative flex h-full w-full max-w-[500px] flex-col items-center overflow-y-auto bg-[#FFF5F2] px-6 pt-6 pb-24">
        {/* 뒤로가기 버튼 */}
        <button
          type="button"
          onClick={() => router.push("/main")}
          className="absolute top-2 left-4 z-50 p-2 text-stone-700 hover:text-stone-900 transition-colors duration-200"
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
        <div className="w-full pt-6">
          <div className="flex flex-col items-start justify-start">
            <span className="text-[32px] font-semibold text-[#FFAAB8] leading-none">
              계획을 추가해보세요
            </span>
            <span className="text-[42px] font-semibold text-[#000000] leading-none mt-2">
              플랜 추가
            </span>
          </div>
        </div>
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center"
              style={{ textAlign: "left" }}
            >
              <span
                className="text-xl font-semibold text-[#FFAAB8]"
                style={{ textAlign: "left" }}
              >
                제목 <span className="text-red-500">*</span>
              </span>
            </div>
          </div>
          <input
            id="plan-name"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="추가할 플랜 제목을 입력해주세요"
            className="w-full px-4 py-3.5 text-base font-semibold text-stone-900 placeholder:text-stone-400 bg-white rounded-xl border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] transition-colors"
            onKeyDown={(e) => {
              // 스페이스 키 입력 허용
              if (e.key === " ") {
                e.stopPropagation();
              }
            }}
          />
        </div>
        {/* 카테고리 영역 - 항상 표시 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <div
              className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex-shrink-0 flex justify-start items-center"
              style={{ textAlign: "left" }}
            >
              <span
                className="text-xl font-semibold text-[#FFAAB8]"
                style={{ textAlign: "left" }}
              >
                카테고리 <span className="text-red-500">*</span>
              </span>
            </div>
            {/* 선택된 카테고리 표시 */}
            {selectedCategory && (
              <div className="relative flex-shrink-0">
                <div
                  className="h-10 px-4 flex-shrink-0 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: selectedCategory.color }}
                >
                  <span className="text-sm font-semibold text-stone-700 whitespace-nowrap">
                    {selectedCategory.label}
                  </span>
                </div>
                {/* X 버튼 */}
                <button
                  type="button"
                  onClick={handleRemoveCategory}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-stone-600 hover:bg-stone-700 rounded-full flex items-center justify-center transition-colors"
                  aria-label="카테고리 제거"
                >
                  <span className="text-white text-xs font-bold">×</span>
                </button>
              </div>
            )}
            {/* 플러스 버튼 - 카테고리 라벨 오른쪽에 위치 */}
            <button
              type="button"
              onClick={handleOpenModal}
              className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity bg-white border-2 border-[#FFAAB8]"
              aria-label="카테고리 추가"
            >
              <span className="text-xl font-semibold text-[#FFAAB8] select-none">
                +
              </span>
            </button>
          </div>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions */}
          <div
            ref={scrollRef}
            className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide flex gap-3 flex-nowrap pr-2 select-none cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
          >
            {/* 검색 결과 - input에 값이 있을 때만 표시 */}
            {inputValue.trim() &&
              displayItems.map((category) => (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  key={category.id}
                  onClick={() => handleCategoryClick(category)}
                  className="h-10 px-4 flex-shrink-0 rounded-xl flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity select-none"
                  style={{ backgroundColor: category.color }}
                >
                  <span className="text-sm font-semibold text-stone-700 whitespace-nowrap select-none">
                    {category.label}
                  </span>
                </div>
              ))}
          </div>
        </div>
        {/* 결제 유형 영역 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center"
              style={{ textAlign: "left" }}
            >
              <span
                className="text-xl font-semibold text-[#FFAAB8]"
                style={{ textAlign: "left" }}
              >
                결제 유형 <span className="text-red-500">*</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["현금", "카드", "기타"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPaymentType(type)}
                className={`flex-1 px-4 py-3.5 rounded-xl border-2 transition-colors font-semibold text-base ${
                  paymentType === type
                    ? "bg-[#FFAAB8] text-white border-[#FFAAB8]"
                    : "bg-white text-stone-700 border-stone-200 hover:border-[#FFAAB8]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        {/* 금액 영역 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center"
              style={{ textAlign: "left" }}
            >
              <span
                className="text-xl font-semibold text-[#FFAAB8]"
                style={{ textAlign: "left" }}
              >
                금액
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <input
              id="plan-amount"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder="금액을 입력해주세요"
              className="flex-1 min-w-0 px-4 py-3.5 text-base font-semibold text-stone-900 placeholder:text-stone-400 bg-white rounded-xl border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] transition-colors"
            />
            <span className="text-base font-semibold text-stone-700 whitespace-nowrap flex-shrink-0">
              만 원
            </span>
          </div>
        </div>
        {/* 일자 영역 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center"
              style={{ textAlign: "left" }}
            >
              <span
                className="text-xl font-semibold text-[#FFAAB8]"
                style={{ textAlign: "left" }}
              >
                일자
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex-1 min-w-0 px-4 py-3.5 text-base font-semibold rounded-xl border-2 transition-colors ${
                isDateUndecided
                  ? "bg-stone-200 text-stone-500 border-stone-200 cursor-default"
                  : "text-stone-900 bg-white border-stone-200 cursor-pointer hover:border-[#FFAAB8]"
              }`}
              onClick={() => {
                if (!isDateUndecided) {
                  setIsDatePickerOpen(true);
                }
              }}
              role="button"
              tabIndex={isDateUndecided ? -1 : 0}
              onKeyDown={(e) => {
                if (!isDateUndecided && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setIsDatePickerOpen(true);
                }
              }}
            >
              {isDateUndecided ? "미정" : formatDate(selectedDate)}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsDateUndecided(true);
              }}
              className={`px-4 py-3.5 rounded-xl border-2 transition-colors flex-shrink-0 font-semibold text-sm ${
                isDateUndecided
                  ? "bg-stone-300 text-stone-600 border-stone-300"
                  : "bg-white text-stone-700 border-stone-200 hover:border-[#FFAAB8]"
              }`}
              aria-label="날짜 미정"
            >
              미정
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDateUndecided(false);
                setIsDatePickerOpen(true);
              }}
              className="px-4 py-3.5 rounded-xl border-2 border-stone-200 hover:border-[#FFAAB8] transition-colors flex-shrink-0 flex items-center justify-center"
              aria-label="날짜 선택"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="#FF8FA3"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </button>
          </div>
        </div>
        {/* 위치 영역 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center"
              style={{ textAlign: "left" }}
            >
              <span
                className="text-xl font-semibold text-[#FFAAB8]"
                style={{ textAlign: "left" }}
              >
                위치
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <input
              id="plan-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="위치를 입력해주세요"
              className="flex-1 min-w-0 px-4 py-3.5 text-base font-semibold text-stone-900 placeholder:text-stone-400 bg-white rounded-xl border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchLocation();
                }
                // 스페이스 키 입력 허용
                if (e.key === " ") {
                  e.stopPropagation();
                }
              }}
            />
            <button
              type="button"
              onClick={handleSearchLocation}
              disabled={!location.trim()}
              className={`px-4 sm:px-6 py-3.5 font-semibold rounded-xl transition-colors whitespace-nowrap flex-shrink-0 ${
                location.trim()
                  ? "bg-[#FFAAB8] text-white hover:bg-[#FF8FA3] cursor-pointer"
                  : "bg-stone-300 text-stone-500 cursor-not-allowed"
              }`}
            >
              검색
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
                        className="px-4 py-3 bg-white rounded-xl border-2 border-stone-200 hover:border-[#FFAAB8] cursor-pointer transition-colors"
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
                          className="px-4 py-3 bg-white rounded-xl border-2 border-stone-200 hover:border-[#FFAAB8] cursor-pointer transition-colors flex items-center justify-center gap-2"
                        >
                          <span className="text-lg font-bold text-[#FFAAB8]">
                            +
                          </span>
                          <span className="text-sm font-semibold text-stone-700">
                            {locationSearchResults.length - 3}개 더보기
                          </span>
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
                    className="px-4 py-3 bg-white rounded-xl border-2 border-stone-200 hover:border-[#FFAAB8] cursor-pointer transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="text-lg font-bold text-[#FFAAB8]">+</span>
                    <span className="text-sm font-semibold text-stone-700">
                      {locationSearchResults.length}개 더보기
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
          {/* 검색 결과 없음 */}
          {hasSearched && locationSearchResults.length === 0 && (
            <div className="mt-3 w-full">
              <div className="px-4 py-6 bg-white rounded-xl border-2 border-stone-200 text-center">
                <div className="text-base font-semibold text-stone-600 mb-4">
                  검색 결과가 없습니다.
                </div>
                <button
                  type="button"
                  onClick={handleSaveWithoutLocation}
                  className="px-6 py-3 bg-[#FFAAB8] text-white font-semibold rounded-xl hover:bg-[#FF8FA3] transition-colors"
                >
                  건너뛰기
                </button>
              </div>
            </div>
          )}
        </div>
        {/* 지도 영역 - 위치 선택 시에만 표시 */}
        {showMap && (
          <div ref={mapContainerRef} className="mt-4 w-full">
            <div
              id="map"
              className="w-full h-[200px] rounded-xl"
              style={{
                pointerEvents: "auto",
              }}
            />
          </div>
        )}

        {/* 메모 영역 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center"
              style={{ textAlign: "left" }}
            >
              <span
                className="text-xl font-semibold text-[#FFAAB8]"
                style={{ textAlign: "left" }}
              >
                메모
              </span>
            </div>
          </div>
          <textarea
            id="plan-memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모를 입력해주세요"
            rows={4}
            className="w-full px-4 py-3.5 text-base font-semibold text-stone-900 placeholder:text-stone-400 bg-white rounded-xl border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] transition-colors resize-none"
            onKeyDown={(e) => {
              // 스페이스 키 입력 허용
              if (e.key === " ") {
                e.stopPropagation();
              }
            }}
          />
        </div>

        {/* 저장 버튼 - 제목과 카테고리가 모두 있을 때만 표시 */}
        {inputValue.trim() && selectedCategory && (
          <div className="mt-8 w-full">
            <button
              type="button"
              onClick={() => {
                if (validateForm()) {
                  // TODO: API로 데이터 저장
                  // eslint-disable-next-line no-alert
                  alert("플랜이 저장되었습니다.");
                  router.push("/main");
                }
              }}
              className="w-full px-6 py-4 bg-[#FFAAB8] text-white font-bold text-lg rounded-xl hover:bg-[#FF8FA3] transition-colors shadow-md active:scale-[0.98] transform"
            >
              플랜 저장하기
            </button>
          </div>
        )}
      </main>
      {/* 하단 탭바 - Sticky로 최상단에 고정 */}
      <BottomTabBar
        activeTab="home"
        onTabClick={(tab) => {
          if (tab === "home") {
            router.push("/main");
          }
          // TODO: 나머지 탭들은 나중에 처리
        }}
      />

      {/* 카테고리 선택 모달 */}
      {isModalOpen && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4"
          onClick={handleCloseModal}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-stone-200">
              <h2 className="text-xl font-bold text-stone-900">
                카테고리 선택
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
                aria-label="닫기"
              >
                <span className="text-2xl text-stone-600">×</span>
              </button>
            </div>

            {/* 모달 바디 - 스크롤 영역 */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3">
                {allCategories.map((category) => (
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <div
                    key={`modal-${category.label}`}
                    onClick={() => handleSelectFromModal(category)}
                    className="h-16 rounded-xl flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: category.color }}
                  >
                    <span className="text-sm font-semibold text-stone-700 text-center px-2 break-keep">
                      {category.label}
                    </span>
                  </div>
                ))}
                {/* 카테고리 추가 박스 */}
                {isAddingCategory ? (
                  <div className="h-16 rounded-xl flex items-center justify-center border-2 border-[#FFAAB8] bg-white">
                    <input
                      ref={newCategoryInputRef}
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={handleNewCategoryKeyDown}
                      placeholder="카테고리 이름"
                      className="w-full h-full px-3 text-sm font-semibold text-stone-700 text-center bg-transparent border-none outline-none placeholder:text-stone-400"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="h-16 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border-2 border-dashed border-[#FFAAB8] bg-[#FFF5F2]"
                    onClick={handleStartAddingCategory}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleStartAddingCategory();
                      }
                    }}
                  >
                    <span className="text-2xl font-bold text-[#FFAAB8] mb-1">
                      +
                    </span>
                    <span className="text-xs font-semibold text-[#FFAAB8] text-center px-2">
                      카테고리 추가
                    </span>
                  </button>
                )}
              </div>
            </div>
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
  );
}
