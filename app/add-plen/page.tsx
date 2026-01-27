"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import BottomTabBar from "../components/BottomTabBar";
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
  const [location, setLocation] = useState("");
  const [showMap, setShowMap] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  /**
   * ============================================================================
   * Kakao 지도 초기화
   * ============================================================================
   */
  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (!showMap) {
      return;
    }

    // Kakao Maps SDK가 이미 로드되었는지 확인
    if (window.kakao && window.kakao.maps) {
      // 이미 로드된 경우 바로 지도 초기화
      const container = document.getElementById("map");
      if (container) {
        const options = {
          center: new window.kakao.maps.LatLng(33.450701, 126.570667),
          level: 3,
        };
        // 지도 생성 (변수는 사용하지 않지만 생성은 필요)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const map = new window.kakao.maps.Map(container, options);
      }
      return;
    }

    // Kakao Maps SDK 스크립트 로드
    const script = document.createElement("script");
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.async = true;

    script.onload = () => {
      // Kakao Maps API 로드 완료 후 지도 초기화
      window.kakao.maps.load(() => {
        const container = document.getElementById("map");
        if (container) {
          const options = {
            center: new window.kakao.maps.LatLng(33.450701, 126.570667),
            level: 3,
          };
          // 지도 생성 (변수는 사용하지 않지만 생성은 필요)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const map = new window.kakao.maps.Map(container, options);
        }
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
  }, [showMap]);

  // 지도가 나타나면 해당 영역으로 자동 스크롤
  useEffect(() => {
    if (!showMap) {
      return undefined;
    }
    // DOM 반영 후 스크롤 (지도 초기화 대기)
    const timer = setTimeout(() => {
      mapContainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line consistent-return
  }, [showMap]);

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
    if (location.trim()) {
      setShowMap(true);
      // TODO: Kakao Map Search API 연동
    }
  };

  const handleSkipLocation = () => {
    setLocation("");
    setShowMap(false);
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
            <div className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center" style={{ textAlign: 'left' }}>
              <span className="text-xl font-semibold text-[#FFAAB8]" style={{ textAlign: 'left' }}>제목</span>
            </div>
          </div>
          <input
            id="plan-name"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="추가할 플랜 제목을 입력해주세요"
            className="w-full px-4 py-3.5 text-base font-semibold text-stone-900 placeholder:text-stone-400 bg-white rounded-xl border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] transition-colors"
          />
        </div>
        {/* 카테고리 영역 - 항상 표시 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <div className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex-shrink-0 flex justify-start items-center" style={{ textAlign: 'left' }}>
              <span className="text-xl font-semibold text-[#FFAAB8]" style={{ textAlign: 'left' }}>
                카테고리
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
        {/* 금액 영역 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center" style={{ textAlign: 'left' }}>
              <span className="text-xl font-semibold text-[#FFAAB8]" style={{ textAlign: 'left' }}>금액</span>
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
        {/* 위치 영역 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white pl-4 pr-4 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8] flex justify-start items-center" style={{ textAlign: 'left' }}>
              <span className="text-xl font-semibold text-[#FFAAB8]" style={{ textAlign: 'left' }}>위치</span>
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
          <button
            type="button"
            onClick={handleSkipLocation}
            className="mt-2 w-full px-4 py-3 bg-stone-200 text-stone-700 font-medium rounded-xl hover:bg-stone-300 transition-colors"
          >
            건너뛰기
          </button>
        </div>
        {/* 지도 영역 - 검색 시에만 표시 */}
        {showMap && (
          <div ref={mapContainerRef} className="mt-4 w-full">
            <div id="map" className="w-full h-[400px] rounded-xl" />
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
    </div>
  );
}
