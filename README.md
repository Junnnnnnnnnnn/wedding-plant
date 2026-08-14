# wedding-plant

결혼 준비 일정·예산·업체를 함께 관리하는 웨딩 플래너 웹앱입니다. 모바일 웹 기준으로 설계되어 있고, 카카오 로그인 없이 게스트 모드로도 사용할 수 있습니다.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4

## 시작하기

### 1. 백엔드 서버 (필수)

플랜·일정·예산·채팅 등 **모든 데이터 API는 별도 백엔드 레포**에 있습니다. 로컬 개발 시 백엔드를 **3111 포트**에 먼저 띄워야 합니다. 띄우지 않으면 카카오 로그인 시 `ERR_CONNECTION_REFUSED`가 발생합니다.

백엔드 응답은 일관되게 `{ result: boolean, data: ... }` 형태입니다.

### 2. 환경 변수

루트에 `.env` 파일을 만들고 아래 값을 채웁니다 (`.env.example` 참고). `.env`는 `.gitignore`에 포함되어 있습니다.

| 변수                               | 용도                                            |
| ---------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`         | 백엔드 주소. 로컬은 `http://localhost:3111`     |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | `/add-plen` 페이지의 카카오 지도                |
| `KAKAO_REST_API_KEY`               | 서버 사이드 OAuth 토큰 교환                     |
| `KAKAO_CLIENT_SECRET`              | 서버 사이드 OAuth 토큰 교환                     |
| `KAKAO_REDIRECT_URI`               | `http://localhost:3000/api/auth/kakao/callback` |

`KAKAO_*` 3개는 서버 전용이라 `NEXT_PUBLIC_` 접두사가 없습니다. 카카오 개발자 콘솔의 **로그인 > Redirect URI**에 localhost 주소와 배포 도메인을 각각 등록해야 합니다.

### 3. 개발 서버 실행

```bash
npm install
npm run dev     # http://localhost:3000
```

## 명령어

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버
npm run lint         # ESLint (airbnb + airbnb-typescript + prettier)
npm run lint:fix     # ESLint 자동 수정
npm run format       # Prettier 적용
npm run format:check # Prettier 검사만
```

테스트 인프라는 없습니다. UI를 변경한 경우 dev 서버에서 직접 확인해야 합니다.

## 라우트

| 경로                                          | 설명                                     |
| --------------------------------------------- | ---------------------------------------- |
| `/`                                           | 랜딩 · 로그인 진입점                     |
| `/setting`                                    | 최초 온보딩 (이름 · 결혼일 · 예산)       |
| `/main`                                       | 홈 대시보드                              |
| `/calendar`                                   | 일정 캘린더                              |
| `/schedule-detail`                            | 일정 상세                                |
| `/budget-detail`                              | 예산 상세 · 지출 분석                    |
| `/add-plen`                                   | 업체 검색 · 지도 (카카오 맵) · 채팅 공유 |
| `/plan-list`                                  | 참여 중인 플랜 목록                      |
| `/chat/[chatRoomId]`                          | 플랜별 채팅                              |
| `/share/[shareCode]`                          | 공유 링크로 플랜 참여                    |
| `/user`                                       | 설정                                     |
| `/api/auth/kakao`, `/api/auth/kakao/callback` | 카카오 OAuth (서버 라우트)               |

하단 탭바는 `/main`(홈) · `/plan-list`(참여 플랜) · `/user`(설정) 3개이며, `/calendar`도 홈 탭으로 취급됩니다. "피드" 탭은 현재 준비중 모달만 표시합니다.

## 구조

```
app/
  contexts/      ApiContext · WeddingContext · NotificationContext
  components/    페이지 공용 컴포넌트 · 모달
  hooks/         useKakaoAuth · useScrollDirection
  api/auth/      카카오 OAuth 서버 라우트
  robots.ts      robots.txt 생성
  sitemap.ts     sitemap.xml 생성
components/      3D · 비주얼 컴포넌트 (Lanyard, ClickSpark, CountUp, SharePlanModal)
lib/             api.ts (토큰·fetch) · guestSchedule.ts · utils.ts (KST 날짜)
types/           공용 타입
docs/            3D_AND_STASH.md · OPENSEARCH_INTEGRATION.md
```

주요 페이지(`/main`, `/add-plen`, `/setting` 등)는 의도적으로 하나의 큰 `page.tsx`로 구현되어 있습니다.

### 컨텍스트 3종

`layout.tsx`에서 `ApiProvider` → `NotificationProvider` → `WeddingProvider` 순으로 적용됩니다.

- **ApiContext** — 모든 백엔드 호출의 단일 진입점. `request`(same-origin) / `fetchBackend`(인증 없음) / `fetchWithAuth`(Bearer JWT). 카운터 기반 로딩 상태가 `ApiLoadingOverlay`에 자동 반영됩니다.
- **WeddingContext** — 예산·이름·결혼일을 `sessionStorage`에 영속화.
- **NotificationContext** — 채팅방별 SSE(`EventSource`) 구독으로 토스트 알림과 미읽음 카운트를 관리합니다.

### 인증

카카오 OAuth로 받은 access_token을 백엔드에 넘겨 **앱 자체 JWT**를 발급받는 구조입니다. 토큰 키는 `plan_auth_token`. 상세한 플로우와 게스트 → 로그인 데이터 마이그레이션 분기는 [CLAUDE.md](./CLAUDE.md)에 정리되어 있습니다.

### 게스트 모드

로그인 없이도 사용 가능하며 게스트 데이터는 모두 `sessionStorage`에 보관됩니다. 로그인 시 `KakaoLoginAlert`가 백엔드로 마이그레이션합니다.

## 코드 컨벤션

- 경로 별칭 `@/*` → 레포 루트 (`@/lib/api`, `@/app/contexts/ApiContext`)
- Server Component가 기본. 클라이언트 컴포넌트는 상단에 `"use client"` 명시
- shadcn/ui style `new-york`, neutral, lucide 아이콘. `cn()`은 `@/lib/utils`의 default export
- 날짜는 **KST 기준**. `lib/utils.ts`의 `getKstToday / getKstDate / getKstDateString / parseLocalDate`를 사용하고, 타임존 오프셋 문제 때문에 `new Date("YYYY-MM-DD")` 직접 파싱은 금지입니다
- 권한 문자열은 `"OWNER" | "WRITE" | "READ"`
- UI 텍스트와 주석은 한글이 표준입니다

### 줄바꿈

저장소에는 항상 LF로 저장되고(`.gitattributes`), 작업 트리 줄바꿈은 각자의 `core.autocrlf` 설정을 따릅니다. Prettier는 `endOfLine: "auto"`로 양쪽 모두 통과시키므로 Windows에서도 별도 설정이 필요 없습니다.

## 더 보기

- [CLAUDE.md](./CLAUDE.md) — 아키텍처 상세, 인증 플로우, 알려진 미해결 항목
- [docs/3D_AND_STASH.md](./docs/3D_AND_STASH.md) — Lanyard 3D 컴포넌트 및 stash 복구 절차
- [docs/OPENSEARCH_INTEGRATION.md](./docs/OPENSEARCH_INTEGRATION.md) — 카테고리 검색 백엔드 연동 명세 (미구현)
