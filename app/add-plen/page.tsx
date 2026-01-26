"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import BottomTabBar from "../components/BottomTabBar";

export default function AddPlanPage() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ color: string; label: string }>
  >([]);
  const [selectedCategory, setSelectedCategory] = useState<{
    color: string;
    label: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  };

  const handleSelectFromModal = (category: {
    color: string;
    label: string;
  }) => {
    setSelectedCategory(category);
    setIsModalOpen(false);
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
    } else {
      // 결과가 없으면 회색 박스만 표시
      displayItems = [
        {
          id: "user-input",
          color: "#E5E7EB",
          label: inputValue.trim(),
        },
      ];
    }
  }

  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <main className="flex h-full w-full max-w-[500px] flex-col items-center overflow-y-auto bg-[#FFF5F2] px-6">
        <div className="w-full pt-8">
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
            <div className="bg-white px-10 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8]">
              <span className="text-xl font-semibold text-[#FFAAB8]">제목</span>
            </div>
          </div>
          <input
            id="plan-name"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="추가할 플랜 이름을 입력해주세요"
            className="w-full px-4 py-3.5 text-base font-semibold text-stone-900 placeholder:text-stone-400 bg-white rounded-xl border-2 border-stone-200 focus:outline-none focus:border-[#FFAAB8] transition-colors"
          />
        </div>
        {/* 카테고리 영역 - 항상 표시 */}
        <div className="mt-4 w-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white px-10 py-1 rounded-lg shadow-sm border-2 border-[#FFAAB8]">
              <span className="text-xl font-semibold text-[#FFAAB8]">
                카테고리
              </span>
            </div>
            {/* 선택된 카테고리 표시 */}
            {selectedCategory && (
              <div className="relative">
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
            {/* 플러스 버튼 - 항상 표시 */}
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
        </div>
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
