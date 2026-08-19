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

목 응답에는 **CORS 헤더와 `OPTIONS` 프리플라이트 응답이 반드시 필요**합니다. 없으면 전부 CORS로 막혀 분기까지 가지 못합니다.

## 사용자 응답 규칙

이 프로젝트의 사용자(seoulmomenttw@gmail.com)는 모든 답변을 한글로 받기를 선호합니다 (코드·명령어·기술 용어는 영어 유지). 코드/문자열에 이모지는 사용자가 명시적으로 요청하지 않는 한 넣지 마세요.
