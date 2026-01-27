# OpenSearch 백엔드 연동 가이드

> 현재 `app/add-plen/page.tsx`는 로컬 검색 기능으로 임시 구현되어 있습니다.
> 이 문서는 추후 OpenSearch 백엔드와 연동할 때 참고할 가이드입니다.

## 📋 목차

1. [현재 구현 상태](#현재-구현-상태)
2. [백엔드 API 명세](#백엔드-api-명세)
3. [OpenSearch 설정](#opensearch-설정)
4. [프론트엔드 변경사항](#프론트엔드-변경사항)
5. [테스트 시나리오](#테스트-시나리오)

---

## 🔍 현재 구현 상태

### 1. 자연어 검색 기능

**위치**: `app/add-plen/page.tsx` (line 53-107)

**현재 로직**:

```typescript
useEffect(() => {
  if (inputValue.trim()) {
    const inputText = inputValue.trim().toLowerCase();
    const results = allCategories.filter((category) =>
      inputText.includes(category.label.toLowerCase()),
    );
    setSearchResults(results);
  } else {
    setSearchResults([]);
  }
}, [inputValue, allCategories]);
```

**동작**:

- 사용자 입력: "나는 상견례를 하고 싶어"
- 결과: "상견례" 카테고리가 검색됨
- 원리: 입력 텍스트에 카테고리 label이 포함되어 있는지 확인

### 2. 전체 카테고리 목록

**위치**: `app/add-plen/page.tsx` (line 19-51)

**현재 데이터**:

```typescript
const allCategories = [
  { color: "#FFE4E9", label: "가구 구매" },
  { color: "#FFE5D9", label: "결혼식" },
  // ... 총 30개 카테고리
].sort((a, b) => a.label.localeCompare(b.label, "ko"));
```

---

## 🌐 백엔드 API 명세

### 1. 전체 카테고리 조회

**Endpoint**: `GET /api/categories`

**Request**:

```http
GET /api/categories HTTP/1.1
Host: your-domain.com
```

**Response**:

```json
{
  "categories": [
    {
      "id": "1",
      "label": "상견례",
      "color": "#FFE4E9",
      "synonyms": ["상견례", "양가 상봉", "첫 만남"]
    },
    {
      "id": "2",
      "label": "드레스 촬영",
      "color": "#FFE5D9",
      "synonyms": ["드레스 촬영", "스튜디오 촬영", "웨딩 촬영"]
    }
    // ...
  ],
  "total": 30
}
```

**Status Codes**:

- `200 OK`: 성공
- `500 Internal Server Error`: 서버 에러

---

### 2. 자연어 카테고리 검색 (OpenSearch)

**Endpoint**: `POST /api/search/categories`

**Request**:

```http
POST /api/search/categories HTTP/1.1
Host: your-domain.com
Content-Type: application/json

{
  "query": "나는 상견례를 하고 싶어",
  "size": 10
}
```

**Response**:

```json
{
  "results": [
    {
      "id": "1",
      "label": "상견례",
      "color": "#FFE4E9",
      "score": 0.95,
      "highlight": {
        "matched_text": "상견례"
      }
    },
    {
      "id": "9",
      "label": "드레스 촬영",
      "color": "#E8DDF5",
      "score": 0.12,
      "highlight": null
    }
  ],
  "total": 2,
  "took": 15
}
```

**Parameters**:

- `query` (required): 사용자 입력 텍스트
- `size` (optional): 최대 결과 개수 (default: 10)
- `min_score` (optional): 최소 관련도 점수 (default: 0.1)

**Status Codes**:

- `200 OK`: 성공
- `400 Bad Request`: 잘못된 요청 (query 누락 등)
- `500 Internal Server Error`: 서버 에러

---

## ⚙️ OpenSearch 설정

### 1. 인덱스 생성

**인덱스명**: `wedding-categories`

**Mappings**:

```json
{
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "label": {
        "type": "text",
        "analyzer": "korean_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "color": {
        "type": "keyword"
      },
      "synonyms": {
        "type": "text",
        "analyzer": "korean_analyzer"
      }
    }
  }
}
```

### 2. 한국어 Analyzer 설정

**분석기명**: `korean_analyzer`

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "korean_analyzer": {
          "type": "custom",
          "tokenizer": "nori_tokenizer",
          "filter": ["nori_part_of_speech", "lowercase"]
        }
      },
      "tokenizer": {
        "nori_tokenizer": {
          "type": "nori_tokenizer",
          "decompound_mode": "mixed"
        }
      }
    }
  }
}
```

### 3. Synonym 설정 (동의어)

**예시**:

```
예약, 신청, 등록 => 예약
촬영, 사진, 포토 => 촬영
드레스, 웨딩드레스, 예복 => 드레스
```

### 4. 쿼리 예시

**Match Query (기본)**:

```json
{
  "query": {
    "multi_match": {
      "query": "나는 상견례를 하고 싶어",
      "fields": ["label^2", "synonyms"],
      "type": "best_fields",
      "fuzziness": "AUTO"
    }
  },
  "size": 10,
  "min_score": 0.1
}
```

**설명**:

- `label^2`: label 필드에 가중치 2배 부여
- `fuzziness: "AUTO"`: 자동 퍼지 매칭 (오타 허용)
- `min_score: 0.1`: 최소 관련도 점수 설정

---

## 💻 프론트엔드 변경사항

### 1. 전체 카테고리 조회 로직 변경

**변경 전** (`app/add-plen/page.tsx`):

```typescript
const allCategories = [
  { color: "#FFE4E9", label: "가구 구매" },
  // ... 하드코딩된 데이터
].sort((a, b) => a.label.localeCompare(b.label, "ko"));
```

**변경 후**:

```typescript
const [allCategories, setAllCategories] = useState<
  Array<{ id: string; color: string; label: string }>
>([]);
const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);

useEffect(() => {
  const fetchCategories = async () => {
    try {
      setIsCategoriesLoading(true);
      const response = await fetch("/api/categories");

      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }

      const data = await response.json();
      setAllCategories(data.categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      // TODO: 에러 UI 표시
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  fetchCategories();
}, []);
```

### 2. 자연어 검색 로직 변경

**변경 전** (`app/add-plen/page.tsx`, line 53-107):

```typescript
useEffect(() => {
  if (inputValue.trim()) {
    const inputText = inputValue.trim().toLowerCase();
    const results = allCategories.filter((category) =>
      inputText.includes(category.label.toLowerCase()),
    );
    setSearchResults(results);
  } else {
    setSearchResults([]);
  }
}, [inputValue, allCategories]);
```

**변경 후**:

```typescript
const [isSearching, setIsSearching] = useState(false);

// Debounce 추가 (너무 빈번한 API 호출 방지)
useEffect(() => {
  if (!inputValue.trim()) {
    setSearchResults([]);
    return;
  }

  const timeoutId = setTimeout(async () => {
    try {
      setIsSearching(true);
      const response = await fetch("/api/search/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: inputValue.trim(),
          size: 10,
          min_score: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setSearchResults(data.results);
    } catch (error) {
      console.error("Error searching categories:", error);
      // TODO: 에러 UI 표시
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, 300); // 300ms debounce

  return () => clearTimeout(timeoutId);
}, [inputValue]);
```

### 3. State 추가

```typescript
// 로딩 상태
const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
const [isSearching, setIsSearching] = useState(false);

// 에러 상태 (optional)
const [categoriesError, setCategoriesError] = useState<string | null>(null);
const [searchError, setSearchError] = useState<string | null>(null);
```

### 4. UI 업데이트

**로딩 인디케이터**:

```tsx
{
  isSearching && (
    <div className="flex items-center justify-center py-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFAAB8]" />
    </div>
  );
}
```

**에러 메시지**:

```tsx
{
  searchError && (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-sm text-red-600">{searchError}</p>
    </div>
  );
}
```

---

## 🧪 테스트 시나리오

### 1. 기본 검색 테스트

| 입력                            | 기대 결과                            |
| ------------------------------- | ------------------------------------ |
| "상견례"                        | "상견례" 카테고리 표시               |
| "나는 상견례를 하고 싶어"       | "상견례" 카테고리 표시               |
| "드레스 촬영을 예약하고 싶어요" | "드레스 촬영" 카테고리 표시          |
| "웨딩 촬영"                     | "드레스 촬영" 카테고리 표시 (동의어) |

### 2. 복수 카테고리 검색

| 입력                           | 기대 결과                             |
| ------------------------------ | ------------------------------------- |
| "상견례와 드레스 촬영"         | "상견례", "드레스 촬영" 두 개 표시    |
| "커플링 구매 그리고 혼주 구매" | "커플링 구매", "혼주 구매" 두 개 표시 |

### 3. 오타 허용 테스트 (Fuzzy)

| 입력                 | 기대 결과                   |
| -------------------- | --------------------------- |
| "상견례" (오타)      | "상견례" 카테고리 표시      |
| "드레슨 촬영" (오타) | "드레스 촬영" 카테고리 표시 |

### 4. 검색 결과 없음

| 입력                     | 기대 결과                 |
| ------------------------ | ------------------------- |
| "xyz123"                 | 회색 박스에 "xyz123" 표시 |
| "존재하지 않는 카테고리" | 회색 박스에 텍스트 표시   |

### 5. 성능 테스트

- 검색 응답 시간: < 100ms
- Debounce 동작 확인: 300ms
- 연속 입력 시 이전 요청 취소 확인

---

## 📝 체크리스트

### 백엔드 개발

- [ ] OpenSearch 클러스터 설정
- [ ] `wedding-categories` 인덱스 생성
- [ ] 한국어 Analyzer 설정
- [ ] Synonym 설정
- [ ] GET /api/categories API 구현
- [ ] POST /api/search/categories API 구현
- [ ] 에러 핸들링 구현
- [ ] API 문서 작성

### 프론트엔드 개발

- [ ] allCategories를 API에서 가져오도록 수정
- [ ] 자연어 검색을 API로 변경
- [ ] Debounce 추가
- [ ] Loading state UI 추가
- [ ] Error handling UI 추가
- [ ] 캐싱 전략 고려
- [ ] 성능 최적화

### 테스트

- [ ] 기본 검색 테스트
- [ ] 복수 카테고리 검색 테스트
- [ ] 오타 허용 테스트
- [ ] 검색 결과 없음 테스트
- [ ] 성능 테스트
- [ ] 에러 시나리오 테스트

### 배포

- [ ] 환경 변수 설정 (API URL 등)
- [ ] OpenSearch 보안 설정
- [ ] 모니터링 설정
- [ ] 로그 수집 설정

---

## 📚 참고 자료

- [OpenSearch Documentation](https://opensearch.org/docs/latest/)
- [Nori Korean Analyzer](https://opensearch.org/docs/latest/analyzers/language-analyzers/#korean)
- [OpenSearch Fuzzy Query](https://opensearch.org/docs/latest/query-dsl/term/fuzzy/)
- [React useEffect Hook](https://react.dev/reference/react/useEffect)

---

## 🔗 관련 파일

- `app/add-plen/page.tsx`: 메인 페이지 (line 53-107: 검색 로직, line 19-51: 카테고리 데이터)
- `app/main/page.tsx`: 메인 페이지 참고용

---

**작성일**: 2026-01-26
**최종 수정일**: 2026-01-26
