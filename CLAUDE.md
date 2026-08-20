# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 기동
npm run lint         # ESLint (airbnb + airbnb-typescript + prettier)
npm run lint:fix     # ESLint 자동 수정
npm run format       # Prettier 적용
npm run format:check # Prettier 검사만
```

테스트 인프라는 없습니다 (테스트 스크립트·라이브러리 미설정). UI 변경을 한 경우 직접 dev 서버에서 확인해야 합니다.

## 프론트엔드 작업 규칙 (필수)

**UI·디자인·화면과 관련된 모든 작업은 아래 두 스킬 중 하나를 반드시 먼저 로드한 뒤 진행합니다.** 두 스킬 모두 `.claude/skills/`에 설치되어 있습니다. 사용자가 스킬 이름을 대지 않아도 프론트엔드 작업이면 자동으로 적용하세요.

| 상황                                                                                              | 사용할 스킬                                                                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 새 페이지·랜딩·화면을 처음부터 만들 때, 전면 리디자인, 레퍼런스(URL·스크린샷)에서 디자인 추출     | `hallmark` (`audit` / `redesign` / `study` 서브커맨드)                                              |
| 기존 화면 개선 — 폴리싱, 레이아웃·타이포·컬러 정리, 모션 추가, 접근성·성능·반응형 손보기, UX 비평 | `impeccable` (`polish` / `critique` / `layout` / `animate` / `colorize` / `harden` / `optimize` 등) |

이 프로젝트는 이미 구현된 앱이므로 **기본은 `impeccable`** 입니다. `hallmark`는 새 화면을 만들거나 기존 화면을 갈아엎을 때 씁니다. 판단이 애매하면 사용자에게 어느 쪽인지 물어보세요.

주의사항:

- 두 스킬 모두 **기존 코드를 밀어버리지 않는 안전장치**를 갖고 있습니다. 편집 전에 수정·생성·삭제할 파일을 먼저 밝히고, 삭제는 반드시 확인을 받으세요.
- `impeccable`은 첫 사용 시 `node .claude/skills/impeccable/scripts/context.mjs`를 세션당 한 번 실행합니다 (cwd는 프로젝트 루트 유지).
- 이 프로젝트에는 `PRODUCT.md` / `DESIGN.md`가 없어 `impeccable`이 컨텍스트 부족을 알립니다. 좁은 범위의 개선 작업은 기존 구현을 기준으로 그냥 진행하면 되고, 새 화면·전면 리디자인을 할 때만 `/impeccable init`으로 먼저 문서를 만드세요.
- 작업 후에는 글로벌 지침대로 `app-screenshot` 스킬로 실제 화면을 캡처해 눈으로 확인해야 검증 완료입니다.

## 백엔드 의존성 (필수)

로컬 실행 시 **반드시 백엔드 서버를 `:3111`에서 띄워야** 합니다. 안 띄우면 카카오 로그인 시 `ERR_CONNECTION_REFUSED`가 발생합니다. 백엔드는 별도 레포에 있고, 모든 데이터 API는 `${NEXT_PUBLIC_API_BASE_URL}/plan/...` 경로로 호출됩니다.

`.env` 필수 변수 (`.env.example` 참고):

- `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` — `add-plen` 페이지의 Kakao Maps용
- `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI` — 서버 사이드 OAuth 교환용 (`/api/auth/kakao` 라우트)
- `NEXT_PUBLIC_API_BASE_URL` — 백엔드 주소 (브라우저·서버 공통)

백엔드 응답은 일관되게 `{ result: boolean, data: ... }` 형태입니다. 새 API 호출을 추가할 때 이 모양을 가정하세요.

## 아키텍처

### 인증 플로우 (코드만 보고는 파악이 어려움)

1. 사용자가 카카오 로그인 클릭 → `useKakaoAuth.handleKakaoAuth` (모든 로그인 진입점에서 사용)
2. 토큰 없거나 `/plan/user`가 실패하면 `/api/auth/kakao` (Next 서버 라우트) → 카카오 OAuth로 리다이렉트
3. 콜백 `app/api/auth/kakao/callback/route.ts`가 `code`를 카카오 `access_token`으로 교환
4. **access_token은 URL hash(`#kakao_token=...`)로 클라이언트에 전달** (쿠키 아님)
5. `KakaoLoginAlert`(`/`, `/main`, `/setting` 모두에 마운트됨)가 hash에서 토큰을 읽어 백엔드 `/plan/auth/kakao/login`으로 직접 POST
6. 받은 **앱 자체 JWT**를 `lib/api.ts`의 `setToken`으로 저장 → `sessionStorage` + `localStorage` 두 군데 모두 (탭 간 공유 의도; 한쪽만 통합하는 후속 정리는 검토 대상)
7. 토큰 키는 `plan_auth_token`. JWT payload에서 `planUserId / sub` 디코드 (`getPlanUserIdFromToken`, `getSubFromToken`)

`AuthRedirectToMain` (layout 전역) 은 **`/`나 `/setting` 진입 시에만** 토큰 + `weddingDate/budget/name`이 모두 채워졌는지 확인 후 `/main`으로 자동 이동시킵니다 (`isPlanDataComplete()`). `/main` 자체는 자동 리다이렉트 대상이 아닙니다.

**OAuth 외부 이동 시 로딩 유지:** `useKakaoAuth.handleKakaoAuth`는 `redirectToOAuth` 헬퍼로 `requestAnimationFrame` 두 번 후 `window.location.href`를 설정하고, **`willRedirect` 플래그가 true이면 `setLoading(false)`를 호출하지 않습니다.** 외부 페이지 전환 직전에 로딩이 꺼지면 사용자가 빈 화면을 보게 되는 회귀 버그가 있었기 때문입니다. 새 OAuth 분기를 추가할 때 같은 패턴을 유지하세요.

### 비회원(게스트) 모드

로그인 없이도 사용 가능하며, 모든 게스트 데이터는 `sessionStorage`에 보관됩니다:

- `weddingData` — 예산·이름·날짜 (`WeddingContext`)
- `guest_schedule_list_v1` — 게스트 일정 (`lib/guestSchedule.ts`, id가 음수 + `_guest: true` 마커)
- `plan_guest_agreement` — 게스트가 동의한 약관, 로그인 시 PATCH로 백엔드에 동기화
- `plan_share_after_login`, `plan_return_path_after_login` — 로그인 후 복귀 경로

게스트 → 로그인 시 데이터 마이그레이션은 `KakaoLoginAlert`의 effect에서 처리됩니다 (250줄짜리 거대 effect). 분기 우선순위: **shareCode → returnPath → 플랜 완성된 기존 사용자 → 참여 방 보유 → 진짜 게스트(`HAS_COMPLETED_GUEST_SETTING_KEY` 플래그) → 신규 사용자(`/setting`)**. `HAS_COMPLETED_GUEST_SETTING_KEY`는 직접 `/main` 진입 차단 판단에도 쓰입니다. 각 분기는 반드시 `return`으로 종료해야 후속 분기가 잘못 트리거되지 않습니다.

### 컨텍스트 3종 (layout.tsx에서 항상 적용)

순서: `ApiProvider` → `NotificationProvider` → `WeddingProvider`.

- **`ApiContext`** (`app/contexts/ApiContext.tsx`) — 모든 fetch는 여기를 거쳐야 합니다. `request`(same-origin) / `fetchBackend`(백엔드, no auth) / `fetchWithAuth`(백엔드 + Bearer JWT). 카운터 기반 로딩 상태가 `ApiLoadingOverlay`에 자동 반영됨. `skipLoading: true` 옵션으로 오버레이 억제 가능 (외부에서 이미 `setLoading`을 켜둔 상황 등에서 사용).
- **`WeddingContext`** — 예산/이름/결혼일을 sessionStorage에 영속화. 레거시 `weddingDate` 키 → `weddingData.date` 마이그레이션 로직 포함. 날짜 미설정 사용자는 KST 오늘 날짜로 자동 채워짐.
- **`NotificationContext`** — 채팅방별로 `EventSource`(SSE)를 `/plan/notification/chat/{roomId}` 에 열어 토스트 알림 + 미읽음 카운트 관리. **현재 채팅방에 있을 때는 알림 무시** (`currentRoomIdRef`, `usePathname`/`useParams` 기반). SSE 에러 시 3초 후 자동 재연결. **`ApiContext`에 의존하지 않고 자체 fetch 함수**를 씁니다 (독립 동작 의도).

### 라우팅 / 페이지 단위

App Router. **주요 페이지는 의도적으로 한 파일에 거대한 `page.tsx`로 구현**되어 있습니다 (`app/main/page.tsx` ≈ 96KB, `app/add-plen/page.tsx` ≈ 78KB, `app/setting/page.tsx` ≈ 35KB). 새 기능 추가 시 무리하게 분리하기보다 기존 페이지 파일 안에 머물러 있는 패턴을 우선 따르세요.

`BottomTabBar`의 탭 라우팅은 `/main` (홈), `/plan-list` (참여 플랜), `/user` (Settings) 입니다. "피드" 탭은 의도적으로 "준비중" 모달만 띄우는 상태이고, `/calendar`도 home 탭으로 취급됩니다.

### 적응형 셸 (태블릿·데스크톱)

화면마다 반복하던 폰 프레임(`max-w-md mx-auto bg-white shadow-2xl` + `hidden lg:block ... bg-gray-100` 레터박스)은 **`app/components/AppShell.tsx`로 대체**합니다. 새 화면이나 기존 화면을 손볼 때 프레임을 직접 쓰지 말고 셸을 쓰세요.

- `<768` 지금과 동일 — `max-w-md` 중앙 정렬 + `BottomTabBar`
- `≥768` 하단 탭바 대신 좌측 아이콘 레일(`SideNavRail`, 76px)
- `≥1024` 레일에 라벨(236px). `detail` prop 을 넘기면 마스터-디테일 2열
- `≥1280` 마스터 컬럼 확장, 전체 최대 1440px

**탭·메뉴 정의는 `app/components/tabs.ts` 한 곳에만** 둡니다. 하단 탭바는 4개(홈·피드·참여 플랜·Settings), 데스크톱 레일은 5개(+ 플랜 보드)로 **의도적으로 다릅니다** — 보드는 넓은 화면 전용 뷰라 폰에서는 `pathnameToTab` 규칙대로 홈 탭에 귀속됩니다.

폭에 따라 **동작**이 갈리는 곳(라우트를 밀지, 옆 pane 을 열지)은 `app/hooks/useMediaQuery.ts`를 씁니다. 레이아웃 자체는 CSS(`md:`/`lg:`)가 맡습니다. 단, 이 훅은 서버 스냅샷이 `false`라 하이드레이션 직후 한 번 `false`로 렌더됩니다. **effect 안에서 폭으로 라우팅을 바꾸는 코드는 훅 값 대신 `window.matchMedia`를 직접 읽으세요** (`app/plan-list/page.tsx`의 승격 effect 참고). 안 그러면 데스크톱에서도 한 번 튕겨 나갑니다.

`app/chat/[chatRoomId]/ChatRoomView.tsx`는 `variant="standalone" | "pane"` 을 받습니다. `pane`에서는 `fixed inset-0` + visualViewport 높이 계산을 건너뜁니다(높이를 셸이 정하므로). 방을 바꿀 때는 반드시 **`key`로 새로 마운트**하세요 — 초기 로드 여부를 ref 로 기억해서 같은 인스턴스를 재사용하면 새 방의 히스토리를 불러오지 않습니다.

`app/schedule-detail/ScheduleDetailView.tsx`도 같은 구조입니다 (`variant="page" | "inspector"`). `inspector`는 보드·캘린더 옆에 붙고, 뒤로가기 대신 `onClose`를 씁니다.

### 홈 대시보드 (`app/components/HomeDashboard.tsx`)

`/main` 은 ≥768 에서 **모바일 트리를 통째로 숨기고**(`md:hidden`) 대시보드를 따로 렌더합니다. 기존 스냅 두 섹션의 마크업을 한 줄도 건드리지 않아야 모바일이 픽셀 그대로 남습니다. 같은 DOM 을 CSS 로 재배치하려 들지 마세요 — 한 번 그렇게 했다가 되돌렸습니다.

구성은 상단 바(커플·D-day·`[플랜 보드]` `[플랜 추가]`) → 이번 달 할 일 스트립 → 3열(예산 패널 · 다가오는 일정 타임라인 · 활동/대화)입니다. 예산은 넓은 패널, 일정은 타임라인, 활동·대화는 좁은 사이드로 **성격을 다르게** 둡니다. 같은 크기 카드 세 장은 무엇이 중요한지 안 보입니다.

카테고리 스택바는 `/plan/user/amount/category-chart`(방이면 `/plan/room/amount/category-chart/{roomId}`)를 씁니다.

**이름·날짜는 `planLoading` 동안 스켈레톤으로 가려야 합니다.** `WeddingContext` 가 sessionStorage 를 클라이언트에서만 읽어서, 그냥 그리면 서버 렌더와 값이 달라 하이드레이션 불일치가 납니다(실제로 났습니다).

카드 속 내용은 `app/components/PlanTaskCard.tsx` 를 홈 스트립과 플랜 보드가 공유합니다. 껍데기는 각자 다릅니다 — 보드는 드래그·선택을 얹은 div, 홈은 상세로 가는 button.

### 플랜 보드 (`app/calendar/PlanBoard.tsx`)

`/calendar`는 ≥768에서 **보드 ↔ 캘린더** 전환이 생깁니다. 보드는 일정을 **월별 컬럼**으로 나눕니다(날짜 미정 컬럼이 맨 앞).

- 데이터는 `/plan/schedule/calendar`가 아니라 **`/plan/schedule/list?count=10000`** 을 씁니다. 캘린더 응답은 `amount`·`status`·`categoryName`이 비어 오는 경우가 있어 보드 카드를 채우지 못합니다.
- **완료 토글**: `PATCH /plan/schedule/status/{id}` — `useScheduleStatusToggle`
- **드래그 날짜 이동**: `PATCH /plan/schedule/{id}` 에 `{ startDate }` 만 — `useScheduleDateMove`. 부분 수정 시맨틱이라 다른 필드는 그대로 남습니다(`app/add-plen/page.tsx` 저장 로직 주석 참고). 옮긴 달의 같은 일자를 유지하되 없는 날짜면 말일로 맞춥니다.
- 드래그는 HTML5 DnD가 아니라 **pointer 이벤트**로 직접 구현했습니다(터치에서 DnD가 안 뜨기 때문). 터치는 400ms 롱프레스로 시작하고, 그 전에 움직이면 목록 스크롤로 넘깁니다. **인스펙터에서 날짜를 고치는 경로를 항상 함께 두세요** — 드래그가 안 되는 기기에서 기능이 막히면 안 됩니다.
- 카드에 `select-none`이 필요합니다. 없으면 마우스로 끌 때 글자가 선택됩니다.

`/main`의 완료 토글은 이 훅을 쓰지 **않습니다**. 거기 토글은 카드가 날아가는 애니메이션과 탭별 카운트 보정까지 얽혀 있어 억지로 공통화하면 더 읽기 어려워집니다.

### 최근 활동 (`GET /plan/activity/list`)

홈 좌측 컬럼의 `ActivityPanel`이 읽습니다. `roomId`를 주면 그 방의 기록, 없으면 개인 기록입니다.

**문장은 프론트에서 조립합니다.** 서버는 `type`·`targetTitle`·`amount`만 주고 "…님이 …했어요" 문구는 `ActivityPanel.describe()`가 만듭니다. 서버가 완성된 문구를 내려보내면 문구 수정이 백엔드 배포에 묶입니다.

기록은 이 기능이 배포된 뒤부터 쌓입니다. 기존 사용자는 한동안 비어 있는 게 정상이고, 그때는 패널이 스스로 렌더하지 않습니다.

백엔드는 `~/DEV/seoul-moment-api`의 `apps/api/src/module/plen/activity/` 입니다.

### 셸을 쓰지 않는 화면

- **`/setting`** (온보딩) — 스텝을 한 번에 하나씩 보여주는 흐름이라 레일·탭바가 방해가 됩니다. 중앙 정렬을 유지하고 `lg`에서 컬럼 폭만 600px로 넓혔습니다.
- **`/`** (랜딩) — 로그인 전 화면이라 내비게이션이 없습니다. 448px 띠를 없애고 화면을 채우되 내용은 가운데 컬럼에 가둡니다.
- **`/share/[shareCode]`** — 이미 중앙 정렬 flex + `max-w-sm` 카드라 어느 폭에서도 정상입니다. 손대지 않았습니다.

### `components/Lanyard.tsx`의 `window.innerWidth`는 그대로 둡니다

`useMediaQuery`로 바꾸지 마세요. 이 훅은 서버 스냅샷이 `false`라 하이드레이션 직후 한 번 `false`로 렌더되는데, Lanyard 의 `isMobile`은 **dpr·물리 timeStep(1/30↔1/60)·곡선 점 개수·clearcoat**를 동시에 결정합니다. 값이 뒤늦게 뒤집히면 모바일에서 접속할 때마다 물리 월드와 지오메트리가 다시 잡힙니다. 지금처럼 첫 렌더에서 `window.innerWidth`를 동기로 읽는 편이 맞습니다.

### 시간/날짜 처리

`lib/utils.ts`의 `getKstToday / getKstDate / getKstDateString / parseLocalDate`를 사용하세요. 한국 사용자 대상이라 **KST 기준**으로 통일되어야 하고, `new Date("YYYY-MM-DD")` 직접 파싱은 타임존 오프셋 문제로 금지입니다.

### 3D (Lanyard)

`components/Lanyard.tsx`는 `@react-three/fiber/drei/rapier` 기반의 출입증 카드 시뮬레이션입니다. ESLint에 R3F DOM props (`intensity`, `position`, `roughness`, `args` 등) 와 spread 예외 (`mesh`, `group`, `RigidBody`, `BallCollider`, `CuboidCollider`)가 화이트리스트로 등록되어 있습니다. 이 컴포넌트가 자주 깨지므로 `docs/3D_AND_STASH.md` 의 stash 복구 절차도 참고하세요.

### 카테고리 검색 (미완성 영역)

`app/add-plen/page.tsx`의 자연어 카테고리 검색은 **하드코딩된 카테고리 배열에 대한 로컬 substring 매칭**입니다. 백엔드 OpenSearch 연동이 미래 작업으로 남아있고, API 명세는 `docs/OPENSEARCH_INTEGRATION.md`에 있습니다 — 이 페이지를 수정할 때 참고하세요.

## 코드 컨벤션

- 경로 별칭 `@/*` → 레포 루트 (예: `@/lib/api`, `@/app/contexts/ApiContext`)
- 클라이언트 컴포넌트 상단에 `"use client"` 명시 (Server Component가 기본)
- shadcn/ui style: `new-york`, neutral, lucide icons. `cn()` 유틸은 `@/lib/utils`의 default export
- 타이포: 백엔드 응답 필드 `onwerName` (sic) 은 `types/index.ts:Plan`에 그대로 유지되어 있음 — 클라이언트에서도 그대로 쓰세요
- 권한 문자열: `"OWNER" | "WRITE" | "READ"`
- 한국어 주석/문구가 기본. UI 텍스트는 한글이 표준입니다
- ESLint에서 `no-console`, `@typescript-eslint/no-explicit-any` off — 그래도 새 코드에서는 자제

## 알려진 미해결 항목 (수정 시 유의)

- **JWT를 `sessionStorage` + `localStorage` 모두 저장**: 탭 간 공유 의도지만 사실상 localStorage만으로 충분. 단순화 검토 대상.
- **`PATCH /plan/user`가 약관 날짜 2개를 문자열 필수로 요구**: 마케팅 미동의를 표현할 방법이 없어, 프로필 저장은 `POST /plan/setting`으로 우회해 둔 상태입니다 (`app/user/page.tsx`). 백엔드에서 선택 항목으로 바꾸는 것이 근본 해결입니다.
- **READ 권한이 도달 불가능**: 읽기 전용 참여자는 기획에 있으나 보류 상태입니다. 공유 코드로 참여하면 백엔드가 항상 `WRITE`를 부여하고 권한 변경 수단이 없습니다. `/main`·`/calendar`의 READ 게이트는 기능이 열릴 때를 대비해 남겨둔 것이니 "죽은 코드"로 보고 지우지 마세요.

### 해결된 항목 (예전 기록이 남아 있을 수 있음)

- ~~카카오 access_token이 URL hash로 노출~~ → httpOnly 쿠키 + `/api/auth/kakao/token`으로 회수합니다. OAuth state 논스 검증도 있습니다.
- ~~401 자동 처리 부재~~ → `ApiContext`가 공통 처리합니다(토큰 정리 + 복귀 경로 저장 + `SessionExpiredModal`). 자체 처리가 필요한 곳은 `skipAuthHandling: true`를 쓰며, 현재 `share` 페이지와 `chat`뿐입니다.
- ~~`KakaoLoginAlert`의 거대 effect~~ → 라우팅 결정은 `resolveDestination()`으로 분리했습니다. 이 컴포넌트를 수정할 때는 **`node scripts/login-branches.cjs`를 수정 전후로 돌려 출력을 비교**하세요 (실제 카카오 인증 없이 10개 분기를 확인하는 유일한 수단입니다).

## 개발용 스크립트

`npm install --no-save puppeteer-core` 후 `chrome.exe --remote-debugging-port=9222 --user-data-dir=<경로>` 로 크롬을 띄워 두고 실행합니다.

- `scripts/login-branches.cjs` — 로그인 후 라우팅 10분기를 목 응답으로 구동
- `scripts/room-permission-ui.cjs` — 방 권한(WRITE/READ)별 UI 게이트 확인
- `scripts/plan-list-panes.cjs` — `/plan-list` 폭별 레이아웃 + 채팅 pane + 알림 토스트 억제 확인. 자체적으로 크롬을 띄우므로 `npm run dev`만 있으면 됩니다 (`SHOT_DIR`로 캡처 위치 지정)
- `scripts/main-dashboard.cjs` — `/main` 폭별 레이아웃 + 리스트 스크롤 게이트 + 가이드 말풍선 좌표 확인. `HEADED=1`을 붙이면 브라우저를 띄워 직접 눌러볼 수 있습니다
- `scripts/plan-board.cjs` — `/calendar` 보드 뷰. 컬럼 분리, 보드↔캘린더 전환, 인스펙터, 완료 토글(`PATCH status`), 드래그 날짜 이동(`PATCH schedule`)까지 실제 요청을 잡아 확인합니다
- `scripts/misc-pages.cjs` — `/`, `/user`, `/add-plen`, `/setting` 폭별 캡처

`plan-list-panes.cjs`는 **API 호스트로 가는 WebSocket을 막습니다.** socket.io 는 WS 로 붙어서 puppeteer 의 요청 가로채기를 우회하는데, 그대로 두면 가짜 토큰으로 공유 백엔드에 접속해 "존재하지 않는 방" 오류 모달이 뜹니다. 새 하네스를 만들 때도 같은 처리를 하세요.

목 응답에는 **CORS 헤더와 `OPTIONS` 프리플라이트 응답이 반드시 필요**합니다. 없으면 전부 CORS로 막혀 분기까지 가지 못합니다.

## 사용자 응답 규칙

이 프로젝트의 사용자(seoulmomenttw@gmail.com)는 모든 답변을 한글로 받기를 선호합니다 (코드·명령어·기술 용어는 영어 유지). 코드/문자열에 이모지는 사용자가 명시적으로 요청하지 않는 한 넣지 마세요.
