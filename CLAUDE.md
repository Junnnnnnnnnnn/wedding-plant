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

### 세션은 쓰는 동안 계속 밀린다 (슬라이딩 갱신)

앱 JWT 수명은 **180일**이고, 절반(90일)이 지나면 백엔드가 **아무 플랜 API
응답에나** 새 토큰을 `X-Renewed-Token` 헤더로 얹어 줍니다. `ApiContext` 의
`fetchWithAuth` 가 그걸 받아 `setToken` 으로 갈아 끼웁니다
(`storeRenewedToken`). 그래서 계속 쓰는 사람은 로그인이 풀리지 않고, 180일
동안 한 번도 안 들어온 경우에만 다시 로그인합니다.

- **`Access-Control-Expose-Headers` 에서 이 헤더를 빼면 갱신이 조용히 죽습니다.**
  브라우저는 다른 오리진의 응답에서 노출한 헤더만 읽습니다 — 헤더가 오는데도
  프론트에는 없는 것처럼 보이고, 90일 뒤에야 증상이 납니다. 백엔드
  `apps/api/src/main.ts` 의 `cors: { exposedHeaders: [...] }` 자리입니다.
- 갱신 판단은 백엔드 `PlanApiGuard` 가 **인증을 다 통과한 뒤에만** 합니다.
  회수·만료된 토큰은 거기까지 못 오므로 죽은 토큰이 갱신으로 되살아나지
  않습니다.
- 예전에 발급된 토큰(카카오 access_token 이 payload 에 박혀 있던 100년짜리)은
  수명이 남아도 갱신 대상입니다. 새 모양으로 한 번 갈아 끼워 그 카카오
  토큰을 클라이언트에서 걷어냅니다.
- **로그인 상태를 카카오 토큰에 다시 매달지 마세요.** 예전에는 가드가 매 요청
  카카오 서버에 물어봐서, 우리 JWT 가 100년짜리여도 실효 세션은 카카오
  access_token 수명인 6시간이었습니다.
- 확인은 `node scripts/session-renewal.cjs` (프론트 쪽), 백엔드는
  `test/plan.session.spec.ts` 입니다.

`AuthRedirectToMain` (layout 전역) 은 **`/`나 `/setting` 진입 시에만** 토큰 + `weddingDate/budget/name`이 모두 채워졌는지 확인 후 `/main`으로 자동 이동시킵니다 (`isPlanDataComplete()`). `/main` 자체는 자동 리다이렉트 대상이 아닙니다.

**OAuth 외부 이동 시 로딩 유지:** `useKakaoAuth.handleKakaoAuth`는 `redirectToOAuth` 헬퍼로 `requestAnimationFrame` 두 번 후 `window.location.href`를 설정하고, **`willRedirect` 플래그가 true이면 `setLoading(false)`를 호출하지 않습니다.** 외부 페이지 전환 직전에 로딩이 꺼지면 사용자가 빈 화면을 보게 되는 회귀 버그가 있었기 때문입니다. 새 OAuth 분기를 추가할 때 같은 패턴을 유지하세요.

### 진입 규칙 — 랜딩 · 로그인 · 대시보드

`/` 는 **이 앱이 뭔지 모르는 사람** 자리입니다. 한 번이라도 로그인한 적이 있으면
다시 보여 주지 않습니다. `AuthRedirectToMain` 이 토큰을 보고 갈 곳을 정합니다.

| 상태 | 가는 곳 |
| --- | --- |
| 토큰 없음 | `/` (랜딩) |
| 토큰 살아 있고 플랜 완성 | `/main` |
| 토큰 만료(401·403) | **`/login?expired=1`** |

- **랜딩 위에 "세션이 만료되었습니다" 모달을 띄우지 마세요.** 앱을 처음 보는
  사람에게도 뜨는 것처럼 보이고, 닫으면 갈 곳이 없습니다. 그래서
  `AuthRedirectToMain` 의 `/plan/user` 만 `skipAuthHandling: true` 로 401 을 직접
  받아 `/login` 으로 보냅니다 — 공통 처리에 맡기면 전역 모달이 뜹니다.
- `SessionExpiredModal` 은 `/` 와 `/login` 에서 뜨지 않습니다(`SILENT_PATHS`).
  둘 다 로그인하러 들어오는 문이라 말이 겹칩니다. 앱 안에서 쓰다가 끊기는
  경우에는 그대로 뜹니다 — 거기서는 하던 자리를 잃지 않는 게 낫습니다.
- `/login` 은 `GuestGate` 가 막지 않습니다. 문이니까요.
- 확인은 `node scripts/session-entry.cjs` (백엔드를 목으로 세워 세 경우를 돕니다).

### 비회원(게스트) 모드

**앱 화면은 온보딩을 마쳐야 들어갈 수 있습니다** — `app/components/GuestGate.tsx`
(레이아웃에 마운트, `AuthRedirectToMain` 과 같은 자리). 토큰도 없고
`HAS_COMPLETED_GUEST_SETTING_KEY` 도 없으면 **`/setting`(온보딩)으로** 보냅니다.

- 막는 곳: `/main`·`/calendar`·`/plan-list`·`/feed`·`/budget-detail`·`/user`·
  `/add-plen`·`/schedule-detail`·`/chat`
- 안 막는 곳: `/`·`/setting`(들어오는 문), `/privacy`(로그인 없이 봐야 하는 문서),
  **`/share/…` 와 `?share=…`** — 초대받은 사람이 처음 닿는 곳이라 막으면 초대가 끊깁니다.
  `?kakao_login` 이 붙은 콜백 착지 구간도 건드리지 않습니다(그 라우팅은 `KakaoLoginAlert` 담당).

**목록을 화면마다 복사하지 마세요.** 예전에는 `/main` 에만 검사가 있어서 `/calendar` 로
주소를 바로 치면 이름도 날짜도 없는 채로 앱이 열렸고, 거기서 레일의 "홈" 을 눌러야
그제서야 튕겼습니다. **그리고 `/`(랜딩)로 보내지 마세요** — 앱을 쓰려던 사람이 앱
밖으로 밀려납니다. 온보딩 전에는 홈 머리글이 `이름 / D-Day` 로 비는데, 그 빈칸을
채우는 화면이 바로 `/setting` 입니다.

플래그가 `sessionStorage` 라 **새 탭에서는 온보딩을 다시 탑니다.** 게스트 데이터
자체가 전부 sessionStorage 라 새 탭에는 보여 줄 플랜도 없으니 맞는 동작입니다.
확인은 `node scripts/guest-flow.cjs` 입니다.

로그인 없이도 사용 가능하며, 모든 게스트 데이터는 `sessionStorage`에 보관됩니다:

- `weddingData` — 예산·이름·날짜 (`WeddingContext`)
- `guest_schedule_list_v1` — 게스트 일정 (`lib/guestSchedule.ts`, id가 음수 + `_guest: true` 마커)
- `plan_guest_agreement` — 게스트가 동의한 약관, 로그인 시 PATCH로 백엔드에 동기화
- `plan_share_after_login`, `plan_return_path_after_login` — 로그인 후 복귀 경로

게스트 → 로그인 시 데이터 마이그레이션은 `KakaoLoginAlert`의 effect에서 처리됩니다 (250줄짜리 거대 effect). 분기 우선순위: **shareCode → returnPath → 플랜 완성된 기존 사용자 → 참여 방 보유 → 진짜 게스트(`HAS_COMPLETED_GUEST_SETTING_KEY` 플래그) → 신규 사용자(`/setting`)**. `HAS_COMPLETED_GUEST_SETTING_KEY`는 직접 `/main` 진입 차단 판단에도 쓰입니다. 각 분기는 반드시 `return`으로 종료해야 후속 분기가 잘못 트리거되지 않습니다.

### 신랑·신부 정책 (권한)

`PlanUserRoomMemberPermission` = `OWNER | SPOUSE | WRITE | READ`.

|                     | 플랜(일정·예산) 편집 | 채팅 |
| ------------------- | -------------------- | ---- |
| `OWNER` 방장        | 가능                 | 가능 |
| `SPOUSE` 신랑·신부  | 가능                 | 가능 |
| `WRITE` 예전 기본값 | 가능                 | 가능 |
| `READ` 조언자       | **불가**             | 가능 |

- **초대 링크가 역할을 지닙니다.** `?as=spouse` 로 들어오면 바로 `SPOUSE`, 그냥 들어오면 `READ` 입니다. 이미 배우자가 있으면 배우자 링크로 와도 조용히 `READ` 로 들어옵니다 — **먼저 들어온 사람이 배우자**입니다. 잘못 들어와도 방장이 `PATCH /plan/room/spouse` 로 바꿉니다. 방마다 한 명뿐이고(부분 유니크 인덱스), 새로 지정하면 이전 사람은 `READ` 로 내려갑니다.
- `WRITE` 는 정책 이전에 붙은 값입니다. 새로 생기지 않지만 **일괄 강등하지 않았습니다** — 운영 데이터의 권한을 조용히 뺏지 않습니다.
- 백엔드 게이트는 전부 **"`READ` 면 거절"** 형태라 권한을 추가해도 게이트를 고칠 필요가 없습니다. 새 게이트도 같은 형태로 쓰세요.
- **함께 보는 사람도 대화는 합니다.** 채팅 전송에 권한 검사를 넣지 마세요 — 남의 플랜을 같이 보며 거드는 게 이 권한의 목적입니다.

**커플 채팅방은 컬럼이 아니라 멤버 구성으로 판별합니다** — 방장과 배우자 둘만 있는 방(`apps/api/src/module/plen/chat/couple-chat.util.ts`). 배우자를 바꿔도 저절로 따라오고 플래그가 어긋날 일이 없습니다. `isCouple` 이 대화 목록·방 목록·방 정보 세 응답에 실립니다.

프론트는 `app/components/CoupleChatBadge.tsx` 한 곳에서 배지와 정렬(`sortCoupleFirst`)을 내고 홈 대시보드·참여 플랜 카드·채팅방 머리글이 공유합니다. 배우자 지정은 `components/SharePlanModal.tsx` 의 참여 멤버 목록에서 하고 **대시보드 헤더의 `멤버` 버튼**으로 엽니다 — 예전 공유 버튼은 "멤버가 나 혼자일 때"만 떠서 사람이 들어온 뒤에는 열 방법이 없었습니다.

**소켓에 인증이 걸려 있습니다.** `handshake.auth.token` 을 검증하고, payload 의 사용자 id 는 무시하며, 채팅방 멤버인지 확인합니다. 예전에는 방 id 와 아무 사용자 id 만 알면 남의 이름으로 메시지를 넣을 수 있었습니다.

### 컨텍스트 3종 (layout.tsx에서 항상 적용)

순서: `ApiProvider` → `NotificationProvider` → `WeddingProvider`.

- **`ApiContext`** (`app/contexts/ApiContext.tsx`) — 모든 fetch는 여기를 거쳐야 합니다. `request`(same-origin) / `fetchBackend`(백엔드, no auth) / `fetchWithAuth`(백엔드 + Bearer JWT). 카운터 기반 로딩 상태가 `ApiLoadingOverlay`에 자동 반영됨. `skipLoading: true` 옵션으로 오버레이 억제 가능 (외부에서 이미 `setLoading`을 켜둔 상황 등에서 사용).
- **`WeddingContext`** — 예산/이름/결혼일을 sessionStorage에 영속화. 레거시 `weddingDate` 키 → `weddingData.date` 마이그레이션 로직 포함. 날짜 미설정 사용자는 KST 오늘 날짜로 자동 채워짐.
- **`NotificationContext`** — 채팅방별로 `EventSource`(SSE)를 `/plan/notification/chat/{roomId}` 에 열어 토스트 알림 + 미읽음 카운트 관리. **현재 채팅방에 있을 때는 알림 무시** (`currentRoomIdRef`, `usePathname`/`useParams` 기반). SSE 에러 시 3초 후 자동 재연결. **`ApiContext`에 의존하지 않고 자체 fetch 함수**를 씁니다 (독립 동작 의도).

### 라우팅 / 페이지 단위

App Router. **주요 페이지는 의도적으로 한 파일에 거대한 `page.tsx`로 구현**되어 있습니다 (`app/main/page.tsx` ≈ 96KB, `app/add-plen/page.tsx` ≈ 78KB, `app/setting/page.tsx` ≈ 35KB). 새 기능 추가 시 무리하게 분리하기보다 기존 페이지 파일 안에 머물러 있는 패턴을 우선 따르세요.

`BottomTabBar`의 탭 라우팅은 `/main` (홈), `/feed` (피드), `/plan-list` (참여 플랜), `/user` (Settings) 입니다. `/calendar`는 home 탭으로 취급됩니다 (보드는 넓은 화면 전용 뷰라 폰 탭이 따로 없습니다).

### 적응형 셸 (태블릿·데스크톱)

화면마다 반복하던 폰 프레임(`max-w-md mx-auto bg-white shadow-2xl` + `hidden lg:block ... bg-gray-100` 레터박스)은 **`app/components/AppShell.tsx`로 대체**합니다. 새 화면이나 기존 화면을 손볼 때 프레임을 직접 쓰지 말고 셸을 쓰세요.

- `<768` 지금과 동일 — `max-w-md` 중앙 정렬 + `BottomTabBar`
- `≥768` 하단 탭바 대신 좌측 아이콘 레일(`SideNavRail`, 76px)
- `≥1024` 레일에 라벨(236px). `detail` prop 을 넘기면 마스터-디테일 2열
- `≥1280` 마스터 컬럼 확장. **폭 상한은 두지 않습니다** — 예전에는 1440px 로 묶고 가운데 정렬했는데, 넓은 모니터에서 양옆이 크게 비고 보드·대시보드가 쓸 수 있는 폭을 스스로 버렸습니다. 읽는 폭은 각 화면이 카드·컬럼으로 잡습니다

**탭·메뉴 정의는 `app/components/tabs.ts` 한 곳에만** 둡니다. 하단 탭바는 4개(홈·피드·참여 플랜·Settings), 데스크톱 레일은 5개(+ 플랜 보드)로 **의도적으로 다릅니다** — 보드는 넓은 화면 전용 뷰라 폰에서는 `pathnameToTab` 규칙대로 홈 탭에 귀속됩니다.

폭에 따라 **동작**이 갈리는 곳(라우트를 밀지, 옆 pane 을 열지)은 `app/hooks/useMediaQuery.ts`를 씁니다. 레이아웃 자체는 CSS(`md:`/`lg:`)가 맡습니다. 단, 이 훅은 서버 스냅샷이 `false`라 하이드레이션 직후 한 번 `false`로 렌더됩니다. **effect 안에서 폭으로 라우팅을 바꾸는 코드는 훅 값 대신 `window.matchMedia`를 직접 읽으세요** (`app/plan-list/page.tsx`의 승격 effect 참고). 안 그러면 데스크톱에서도 한 번 튕겨 나갑니다.

`app/chat/[chatRoomId]/ChatRoomView.tsx`는 `variant="standalone" | "pane"` 을 받습니다. `pane`에서는 `fixed inset-0` + visualViewport 높이 계산을 건너뜁니다(높이를 셸이 정하므로). 방을 바꿀 때는 반드시 **`key`로 새로 마운트**하세요 — 초기 로드 여부를 ref 로 기억해서 같은 인스턴스를 재사용하면 새 방의 히스토리를 불러오지 않습니다.

`app/schedule-detail/ScheduleDetailView.tsx`도 같은 구조입니다 (`variant="page" | "inspector"`). `inspector`는 보드·캘린더 옆에 붙고, 뒤로가기 대신 `onClose`를 씁니다.

**두 변형은 생김새가 다릅니다.** `page`(폰)는 분홍 히어로 카드 + 회전하는 완료/예정 스티커 + 컬러 아이콘 타일을 그대로 씁니다. `inspector`(웹)는 대시보드 카드 언어입니다 — 흰 카드 + 카테고리 칩 + 상태 알약 + 큰 금액. 인스펙터의 지도에는 **"크게 보기"** 가 있습니다. 지도 DOM 을 옮기면 Kakao 인스턴스가 죽으므로, **감싼 상자만 `fixed` 로 키우고 안쪽 `#schedule-detail-map` 은 그대로 둡니다**(framer `layout` FLIP). 크기가 바뀌면 기존 `ResizeObserver` 가 `relayout()` 하고 중심을 다시 잡습니다 — `relayout()` 만 하면 커진 만큼 마커가 밀립니다. 뒷 배경은 어둡게 하지 않고 ESC 로 닫습니다.

**단독 라우트(`/schedule-detail`)도 셸을 씁니다.** 예전에는 `max-w-md` 폰 프레임이라 넓은 화면의 홈 대시보드에서 카드를 눌러 들어오면 448px 띠로 떨어졌습니다. 지금은 `/main` 이 `≥1024` 에서 인스펙터 pane 을 열고(`/calendar` 와 같은 기준), 그보다 좁을 때만 이 라우트로 갑니다.

**`isInspector` 분기를 지우고 하나로 합치지 마세요**, 폰 화면이 통째로 바뀝니다. `scripts/plan-board.cjs`가 `page` 변형에 분홍 히어로와 스티커가 남아 있는지 매번 확인합니다.

### 플랜 등록 pane (`app/add-plen/AddPlanView.tsx`)

폼 본체는 `AddPlanView` 에 있고 `app/add-plen/page.tsx` 는 쿼리를 읽어 넘기는
얇은 래퍼입니다 (`ChatRoomView`·`ScheduleDetailView` 와 같은 구조).

`variant="pane"` 을 주면 **`≥1024` 에서 보드·캘린더·홈 오른쪽 컬럼에 붙습니다.**
그보다 좁으면 지금처럼 `/add-plen` 으로 이동합니다 — 인스펙터가 열리는 기준과
같습니다. `AppShell` 의 디테일 컬럼 자체가 `hidden lg:flex` 라 그 아래에는 둘
자리가 없습니다.

- pane 에서는 셸을 내지 않습니다(바깥이 잡음). 떠 있는 "뒤로가기" 알약 대신
  인스펙터와 같은 머리글 + X 를 씁니다. 나가는 길은 라우팅이 아니라 `onClose`
  입니다 — pane 에서 라우팅하면 뒤에 있던 보드까지 통째로 다시 그립니다.
- 저장이 끝나면 `onSaved` 로 부모가 목록을 다시 받습니다.
- 폼은 폰 폭에 맞춰 크게 잡혀 있어, pane 에서는 `cardClass`·`fieldTextClass`
  로 카드 여백과 입력 글자만 한 단계 줄입니다. 모바일 마크업은 그대로입니다.
- **하네스에서 pane 을 닫을 때 `[aria-label="닫기"]` 를 전역으로 찾지 마세요.**
  캘린더 헤더의 X 까지 잡혀 `/main` 으로 나가 버립니다. 머리글 안에서 찾으세요.

### 홈 대시보드 (`app/components/HomeDashboard.tsx`)

`/main` 은 ≥768 에서 **모바일 트리를 통째로 숨기고**(`md:hidden`) 대시보드를 따로 렌더합니다. 기존 스냅 두 섹션의 마크업을 한 줄도 건드리지 않아야 모바일이 픽셀 그대로 남습니다. 같은 DOM 을 CSS 로 재배치하려 들지 마세요 — 한 번 그렇게 했다가 되돌렸습니다.

**이번 달 할 일 스트립에는 완료한 항목이 나오지 않습니다.** 남은 일을 보는 자리라서, 무엇을 언제 얼마에 끝냈는지는 플랜 보드의 완료 묶음에서 봅니다. 예산 패널의 "이번 달 지출"은 반대로 완료된 것만 셉니다 — 둘은 서로 다른 계산이니 같이 묶지 마세요.

구성은 상단 바(커플·D-day·`[플랜 보드]` `[플랜 추가]`) → 이번 달 할 일 스트립 → 3열(예산 패널 · 다가오는 일정 타임라인 · 활동/대화)입니다. 예산은 넓은 패널, 일정은 타임라인, 활동·대화는 좁은 사이드로 **성격을 다르게** 둡니다. 같은 크기 카드 세 장은 무엇이 중요한지 안 보입니다.

카테고리 스택바는 `/plan/user/amount/category-chart`(방이면 `/plan/room/amount/category-chart/{roomId}`)를 씁니다.

**가이드 앵커가 폰과 웹이 따로입니다.** 모바일 트리가 `md:hidden` 이라 넓은
화면에서는 `main-header-info`·`main-budget-card`·`main-tabs`·`main-plan-list`·
`main-bottom-nav` 가 **전부 `display:none`** 이 됩니다. 예전에는 이 다섯 개만
있어서 `≥768` 에서 가이드가 짚을 대상이 하나도 없었고, 스팟라이트가 좌상단
0×0 으로 붕괴해 **화면만 까맣게 덮였습니다**(말풍선은 `max-width:0`).

- 대시보드 쪽 앵커는 `main-dash-header`·`main-dash-tasks`·`main-dash-budget`·
  `main-dash-timeline`·`main-dash-side` 이고, 레일은 `SideNavRail` 의
  `main-side-nav` 입니다. **지우거나 이름을 바꾸지 마세요.**
- 스텝 배열은 `app/main/page.tsx` 의 `MOBILE_GUIDE_STEPS` / `DESKTOP_GUIDE_STEPS`
  이고, **여는 순간 `window.matchMedia("(min-width: 768px)")` 를 직접 읽어**
  고릅니다. `useMediaQuery` 는 서버 스냅샷이 `false` 라 하이드레이션 직후 한 번
  뒤집히는데, 그 값으로 배열을 갈면 가이드가 열린 채 앵커가 통째로 바뀝니다.
- **대시보드 헤더에도 `가이드 보기` 버튼이 있습니다.** 예전에는 폰 트리에만
  있어서 넓은 화면에서는 한 번 닫으면 다시 볼 방법이 없었습니다.
- `GuideOverlay` 는 대상이 화면 밖이면 `scrollIntoView` 로 끌어옵니다 — 768 에서
  대시보드가 1열로 접히면 뒤쪽 스텝이 스크롤 아래로 내려갑니다. 앵커를 못 찾으면
  말풍선을 화면 가운데에 띄웁니다(예전에는 까만 배경만 깔려 글이 안 보였습니다).
- 확인은 `node scripts/main-dashboard.cjs` — 375·768·1280·2327 에서 스텝을 실제로
  넘기며 앵커가 보이는지, 스팟라이트 폭이 앵커와 맞는지 검사합니다.
  **오버레이에는 "다음" 버튼이 없고 오버레이를 눌러야 넘어갑니다.**

**배우자가 없으면 상단에 초대 띠가 붙습니다** (`app/components/SoloPlanBanner.tsx`).
온보딩의 `함께할 사람` 단계를 건너뛴 사실이 남는 자리입니다 — 온보딩은 한 번뿐이라
거기서 안 부르면 다시 물을 기회가 없었습니다.

- 폰 트리와 대시보드가 **각각 렌더**합니다(`md:hidden` 이라 같은 DOM 을 쓸 수
  없습니다). 노출 조건은 `app/main/page.tsx` 의 `showSoloBanner` 한 곳에서 냅니다.
- **`myRoomPermission` 만으로 판단하지 마세요.** 내 플랜은 `roomId` 가 아직
  없을 수 있어(`isRoomView` false) 권한이 `undefined` 로 떨어지고, 그러면 띠가
  영영 안 뜹니다. "방을 보고 있지 않으면 내 플랜"이 맞습니다. 남의 플랜을
  보는 중이면 방장이 아니므로 띠를 내지 않습니다.
- 닫기 버튼을 두지 않습니다. 배우자가 들어오면 저절로 사라지는 띠라 "끄는"
  동작의 뜻이 애매하고, 끄고 나면 다시 부를 자리가 없어집니다.
- 확인은 `NO_SPOUSE=1 node scripts/main-dashboard.cjs` 입니다 (배우자가 있는
  기본 모드에서는 띠가 **DOM 에도 없어야** 합니다).

**이름·날짜는 `planLoading` 동안 스켈레톤으로 가려야 합니다.** `WeddingContext` 가 sessionStorage 를 클라이언트에서만 읽어서, 그냥 그리면 서버 렌더와 값이 달라 하이드레이션 불일치가 납니다(실제로 났습니다).

등록 pane 이 열리면 **뷰포트는 그대로인데 대시보드만 400px 넘게 줄어듭니다.**
`lg:`/`xl:` 로는 알 수 없어 `narrow` prop 으로 알려 주고, 그때만 컨테이너 쿼리
(`@[770px]:`)로 열을 정합니다. pane 이 닫혀 있으면 예전 규칙 그대로입니다 —
레일이 768/1024 에서 76px↔236px 로 뛰어서 컨테이너 기준 하나로는 기존 분기를
재현할 수 없습니다. `/main` 은 `masterWidthClassName="lg:flex-1"` 을 넘겨야
합니다. 기본값(372/420px)은 목록 화면용이라 대시보드가 눌립니다.

카드 속 내용은 `app/components/PlanTaskCard.tsx` 를 홈 스트립과 플랜 보드가 공유합니다. 껍데기는 각자 다릅니다 — 보드는 드래그·선택을 얹은 div, 홈은 상세로 가는 button.

### 플랜 보드 (`app/calendar/PlanBoard.tsx`)

`/calendar`는 ≥768에서 **보드 ↔ 캘린더** 전환이 생깁니다. 보드는 일정을 **월별 컬럼**으로 나눕니다(날짜 미정 컬럼이 맨 앞).

- 데이터는 `/plan/schedule/calendar`가 아니라 **`/plan/schedule/list?count=10000`** 을 씁니다. 캘린더 응답은 그 달만 주는데 보드는 달 경계를 넘나들며 끌어야 합니다.
- **완료한 일정은 지우지 않고 컬럼 안에서 아래로 모읍니다.** "언제 얼마를 왜 썼는지"가 남아야 해서 숨기지 않고 예정과 갈라 놓고, 위에 `완료 N ... N만 원 씀` 구분선을 답니다. 완료 카드는 그림자를 빼 기록으로만 보이게 낮춥니다.
- **인스펙터는 고른 게 없으면 접힙니다** (`detail`에 `null`이 아니라 `undefined`를 넘김). 안내문만 띄운 320~360px을 늘 물고 있으면 넓은 화면에서도 월 컬럼이 잘립니다.
- **완료 토글**: `PATCH /plan/schedule/status/{id}` — `useScheduleStatusToggle`
- **드래그 날짜 이동**: `PATCH /plan/schedule/{id}` 에 `{ startDate }` 만 — `useScheduleDateMove`. 부분 수정 시맨틱이라 다른 필드는 그대로 남습니다(`app/add-plen/page.tsx` 저장 로직 주석 참고). 옮긴 달의 같은 일자를 유지하되 없는 날짜면 말일로 맞춥니다.
- 드래그는 HTML5 DnD가 아니라 **pointer 이벤트**로 직접 구현했습니다(터치에서 DnD가 안 뜨기 때문). 터치는 400ms 롱프레스로 시작하고, 그 전에 움직이면 목록 스크롤로 넘깁니다. **인스펙터에서 날짜를 고치는 경로를 항상 함께 두세요** — 드래그가 안 되는 기기에서 기능이 막히면 안 됩니다.
- 카드에 `select-none`이 필요합니다. 없으면 마우스로 끌 때 글자가 선택됩니다.

`/main`의 완료 토글은 이 훅을 쓰지 **않습니다**. 거기 토글은 카드가 날아가는 애니메이션과 탭별 카운트 보정까지 얽혀 있어 억지로 공통화하면 더 읽기 어려워집니다.

### 캘린더도 완료를 보여 줍니다

`/plan/schedule/calendar` 의 day 항목은 `id`·`title`·`status` 외에 **`categoryName`·`amount`·`startTime`** 까지 내려옵니다. 완료한 일정이 언제 얼마짜리였는지를 달력에서 바로 봐야 하기 때문입니다.

- 달 제목 아래에 `이번 달 지출 / 예정` 합계 띠가 붙습니다. `calendarData` 는 앞뒤 달까지 합쳐 들고 있으므로 **그 달의 날짜 키만 골라** 셉니다.
- 셀 안 금액은 `≥768` 에서만 보입니다. 폰에서는 제목이 먼저입니다.
- **완료 표시에 색 클래스를 겹쳐 쓰지 마세요.** `text-[#1b0d14]` 와 `text-gray-400` 을 같이 얹으면 클래스 나열 순서가 아니라 생성된 CSS 순서가 승자를 정해 완료 회색이 흐려집니다(실제로 두 곳에서 그랬습니다). 조건에 따라 한쪽만 내세요.

### 최근 활동 (`GET /plan/activity/list`)

홈 좌측 컬럼의 `ActivityPanel`이 읽습니다. `roomId`를 주면 그 방의 기록, 없으면 개인 기록입니다.

**문장은 프론트에서 조립합니다.** 서버는 `type`·`targetTitle`·`amount`만 주고 "…님이 …했어요" 문구는 `ActivityPanel.describe()`가 만듭니다. 서버가 완성된 문구를 내려보내면 문구 수정이 백엔드 배포에 묶입니다.

기록은 이 기능이 배포된 뒤부터 쌓입니다. 기존 사용자는 한동안 비어 있는 게 정상입니다.

**비어 있어도 카드는 그대로 냅니다.** 예전에는 기록이 없으면 패널이 아무것도
렌더하지 않아서, 대시보드 사이드 컬럼이 통째로 사라지고 화면에 구멍이 뚫린
것처럼 보였습니다. 지금은 세 상태를 모두 냅니다 —
**받는 중**은 `skeleton-shimmer` 로 자리만 잡고(빈 상태를 먼저 보여 줬다가
기록이 뜨면 카드 높이가 튑니다), **비었으면** "무엇을 하면 여기가 채워지는지"를
적고, 있으면 목록을 냅니다. `return null` 로 되돌리지 마세요 —
가이드의 `main-dash-side` 앵커도 이 카드에 기대고 있어, 패널이 사라지면
앵커 높이가 0 이 됩니다.
확인은 `EMPTY_ACTIVITY=1 node scripts/main-dashboard.cjs` 입니다.

백엔드는 `~/DEV/seoul-moment-api`의 `apps/api/src/module/plen/activity/` 입니다.

### 참여 플랜 · 대화 (`app/plan-list/page.tsx`)

`≥768` 은 홈 대시보드와 같은 템플릿을 씁니다 — 머리글 띠(`border-b bg-white px-8 py-5`)

- `px-8 pt-6` 스크롤 영역 + `rounded-[28px] border-[#ee2b8c0f]` 카드.

* 카드 열 수는 `@container` 로 정합니다(`@[680px]` 2열, `@[1060px]` 3열).
  오른쪽 대화 pane 이 폭을 가져가므로 뷰포트 기준으로는 늘 어긋납니다.
* `masterWidthClassName="lg:flex-1 lg:max-w-[780px]"`. **남는 폭은 대화가 가져갑니다** —
  목록은 카드 두 줄이면 충분해서 780px 에서 멈추고 그 위로는 전부 채팅에 줍니다.
  기본값(372/420px)은 목록을 폰 폭에 묶어 둬서 넓은 화면에서 카드가 한 줄만 보였습니다.

**플랜 카드는 폰·웹 같은 마크업이고 홈 대시보드의 시각 언어를 씁니다.**
읽는 순서가 곧 중요도입니다 — **이름·D-day → 남은 예산 → 대화**.

- 예전에는 `MEMBERS`/`CHANNELS` 같은 `10px` 회색 대문자 라벨과 검정 `플랜 N`
  알약이 먼저 눈에 들어와 정작 남은 예산이 카드 맨 아래에서 묻혔습니다.
  라벨은 `12.5px text-gray-400` 문장(`대화 3`)으로, 알약과 모서리 그러데이션
  얼룩은 없앴습니다. 참여 멤버 얼굴은 제목 오른쪽으로 올라가 한 줄을 벌었습니다.
- 날짜 줄은 `weddingDate` + `getDaysUntil` 로 홈 상단과 같은 문장을 만듭니다
  (`2026년 12월 31일 · D-131`). 날짜가 없으면 줄 자체를 내지 않습니다.
- 카드 하나가 통째로 플랜 상세로 가는 버튼이고, 채팅방 줄은 `stopPropagation`
  으로 끊어 자기 방을 엽니다. **예전의 "안 보이는 복제 레이어 + 절대 배치"
  구조는 없앴습니다** — 카드 높이를 맞추려고 카드 내용을 두 번 그리던 것이라
  프로필 이미지도 두 번 받고 선택자도 중복됐습니다.
- 카드에 `transform`(`active:scale`)을 다시 붙이지 마세요. 안쪽 채팅방 줄을
  누를 때 카드까지 같이 줄어듭니다 — 복제 레이어가 있던 이유가 그것이었습니다.
  누른 느낌은 `active:bg-[#fffafc]` 로 냅니다.

* 카드의 예산 블록은 폭과 무관하게 홈 예산 패널과 같은 짜임입니다 — 큰 숫자 +
  "N만원 중 남음" + `h-3` `bg-[#f4eff2]` 트랙. **막대는 분홍=실제 지출,
  회색=아직 안 쓴 예정, 남은 트랙=여유** 로 홈과 뜻이 같습니다. 예전에는
  분홍이 "남은 비율"이라 아무것도 안 썼을 때 막대가 꽉 차 보였습니다.
  예정 몫은 `/plan/room/list` 의 `plannedUseAmount` 를 씁니다
  (`remainingBudget = budget - (예정 + 사용)` 이므로 지출 = 그 차 - 예정).
* 대화 pane 은 접지 않습니다. 이 화면은 목록과 대화가 대등한 목적이라
  빈 상태("대화를 선택하세요")가 조작 방법을 알려 주는 역할을 합니다.
  (플랜 보드는 반대로 접습니다 — 거기는 가로 폭이 곧 기능입니다.)
* **`GuideOverlay` 앵커(`#plan-list-header`·`#plan-card-0`·`#plan-channels-0`)를
  건드리지 마세요.** 말풍선 좌표를 이 rect 로 잡습니다.
  `#plan-channels-0` 은 채팅방이 하나도 없어도 빈 채로 남깁니다.
  `scripts/plan-list-panes.cjs` 가 폭마다 앵커가 화면 안에 있는지 확인합니다.

### 예산 상세 (`app/budget-detail/page.tsx`)

`≥768` 은 셸 + 대시보드 머리글 띠를 씁니다. 폰의 "뒤로가기/가이드" 줄은
`main` 안에 남아 함께 스크롤되고(`md:hidden`), 넓은 화면은 고정 띠를 따로 냅니다.

**두 열로 나뉩니다 — 왼쪽 도넛 요약, 오른쪽 카테고리 표 + 항목 목록**
(`@[980px]`, `[minmax(280px,340px)_minmax(0,1fr)]`). 비율은 도넛이, 정확한
값은 표가 맡습니다. 폭은 `md:max-w-[1500px]` 로 묶습니다.

- **도넛은 자본을 넘긴 경우가 어려운 부분입니다** (`components/BudgetDonut.tsx`).
  원은 100% 를 넘길 수 없어 그냥 그리면 124% 도 "꽉 참"으로만 보입니다.
  분모를 `max(자본, 사용+예정)` 으로 두고 **자본 위치에 검은 눈금**을 찍어
  그 너머를 빨간 초과 구간으로 냅니다 — 홈 대시보드의 막대를 원으로 만 것과
  같고 색의 뜻도 같습니다(분홍=사용, 회색=예정, 트랙=여유). 눈금은 흰 틈 위에
  얹어야 색 경계에 묻히지 않습니다. **사용이 자본을 안 넘고 예정 때문에만
  넘는 경우**에는 빨간 구간이 없어서 이 눈금이 유일한 표시입니다.
- **`남은 금액`(자본-예정-사용)과 `사용 후 잔액`(자본-사용)이 따로 놀던 문제를
  없앴습니다.** 예전에는 두 값이 다른 이유를 물음표 툴팁으로 해명했습니다.
  지금은 둘 다 이 도넛의 구간이라 툴팁이 필요 없습니다 — **다시 두 번째
  "잔액" 숫자를 만들지 마세요.**
- 넘긴 경우 분홍 구간은 "사용 전체"가 아니라 자본까지입니다. 범례를
  `자본 내 사용` / `자본 초과` 로 나눈 이유입니다 — 그냥 `사용` 이라 쓰면 옆
  표의 합과 어긋나 보입니다.
- **카테고리 표는 예산·사용·남음을 열로 세웁니다**
  (`components/SpendingAnalysis.tsx`). 예전에는 `사용 / 예산` 한 덩어리라
  "얼마 남았나"를 사람이 암산해야 했습니다. 좁으면 열이 접혀 한 줄로 돌아가고,
  기준은 뷰포트가 아니라 **그 카드의 폭**입니다(`@container` + `@[560px]`) —
  오른쪽에 목록이 붙으면 뷰포트가 그대로여도 카드는 좁아집니다.
- 카테고리 줄을 누르면 아래 항목 목록이 그 카테고리로 좁혀집니다. `필터 해제`
  는 표 제목 줄에 함께 둡니다.
- **AI 조언 버튼은 없앴습니다.** 눌러도 "준비중" 모달만 뜨는 미완성
  기능이라 앱 심사(애플 2.1)에 걸리고, 기대를 만들고 배신하는 자리였습니다.
  시세 데이터가 쌓인 뒤 준비 패스의 유료 기능으로 제대로 냅니다 —
  **다시 "준비중" 상태로 되살리지 마세요.**
- 카테고리 아이콘은 `constants.tsx` 의 `CATEGORY_ICONS` 이고 **한국어 키가
  실제로 쓰이는 값**입니다. 빠지면 전부 `Others` 의 "..." 로 떨어집니다.
- 게스트 흐림은 **오른쪽 열에만** 겁니다. 왼쪽 요약은 예전에도 흐리지
  않았습니다.
- 가이드 앵커 4개(`#budget-stat-grid`·`#budget-analysis`·`#budget-tab`·
  `#budget-list`)를 건드리지 마세요. 이름은 예전 구조에서 온 것이라 지금
  붙어 있는 곳과 뜻이 조금 다릅니다 —
  `budget-stat-grid`=도넛 카드, `budget-analysis`=카테고리 표,
  `budget-tab`=예정/사용 알약, `budget-list`=항목 목록.
  (`#budget-ai-insight` 는 AI 버튼과 함께 없앴습니다.)
  `scripts/budget-detail.cjs` 가 폭마다 열 수와 앵커 위치를 확인하고,
  **`OVER=1` 을 붙이면 자본을 넘긴 상태**로 구동합니다(도넛 초과 표현 확인용).

### 피드 — 견적 후기 (`app/feed/page.tsx`)

**단위는 사진이 아니라 "완료된 일정 = 견적 후기"** 입니다. 결혼 준비의 1번
질문이 "이게 비싼 건가?" 인데 그 답이 될 값(업체명·실제 지출·지역)이 이미
`plan_schedule` 에 들어 있습니다. 글을 새로 쓰게 하지 않고 있는 값에 별점과
한 줄만 얹어 올립니다 — 콘텐츠 제작 비용이 0 이라야 콜드 스타트를 넘깁니다.

**리텐션 축은 코어로 되돌리는 것**입니다. 카드의 `내 플랜에 담기` 가
`/add-plen` 을 카테고리·업체명·금액·지역이 채워진 채로 엽니다. 무한
스크롤로 시간을 뺏는 화면이 아닙니다.

- 화면은 **시안 D — 한 줄 카드**. 왼쪽에 금액 하나만 크게 둡니다. 이 화면에서
  사람이 실제로 하는 일이 "금액을 위아래로 훑는 것"이라 금액이 같은 x 좌표에
  세로로 줄서야 비교가 됩니다. **금액을 카드 안쪽으로 넣지 마세요.**
- 넓어지면 목록 | 사이드 2열(`@container` + `@[900px]`). 사이드는 "내 후기 ·
  도움이 됐어요 · 아직 안 올린 일정" — **공급이 이 기능의 생사**라 계속
  상기시키는 자리입니다. 좁을 때는 이 카드를 감추고 목록 위 **한 줄 띠**가
  대신합니다. 카드를 그대로 위에 얹으면 보러 온 후기가 한 화면 아래로
  밀립니다(실제로 그랬습니다).
- 후기 작성은 별도 라우트가 아니라 **완료한 일정에서 여는 모달**
  (`app/components/FeedPostModal.tsx`). 진입점은 피드 상단과
  `ScheduleDetailView` 의 완료 상태 두 곳입니다.
- 목록은 `article` 로 그립니다. 하네스가 이 선택자로 카드를 셉니다.

**익명·프라이버시 (백엔드와 짝, 타협하지 말 것)**

- 응답에 `planUserId` 가 없습니다. `"D-131 신부"` 문장은
  `FeedCard.describeAuthor()` 가 `authorDDay`·`authorRole` 로 만듭니다
  (`ActivityPanel.describe()` 와 같은 규칙 — 문구가 백엔드 배포에 묶이지 않게).
- **비공개 금액은 `amount` 필드 자체가 없습니다.** `?? 0` 이나 `?? null` 로
  채우지 마세요 — "0원" 으로 그려집니다. `post.amount === undefined` 로 갈라
  "금액 비공개" 를 냅니다.
  **장소(카카오)는 후기 모달에서 다시 고릅니다.** 일정의 `location` 은
  카카오 검색으로 고르면 **주소가 아니라 업체명**(`place_name`)이 들어가는
  자리입니다. 이걸 주소로 알고 파싱하다 지역이 늘 비는 버그가 있었습니다.

- `region` 은 **`address` 에서만** 만듭니다. 일정의 `location` 을 넘기지
  마세요. 자르는 일은 백엔드(`toRegion`)가 합니다 — 프론트에 맡기면 앱마다
  다르게 자르고, 한 곳만 빠뜨려도 전체 주소가 올라갑니다.
- 고른 장소에서 `placeId · placeName · address · lat · lng` 를 함께
  저장합니다. **`placeId` 가 같은 업체 후기를 묶는 유일한 열쇠**입니다 —
  업체명은 자유 문자열이라 `SG웨딩홀` 과 `sg 웨딩홀` 이 서로 다른 업체가
  됩니다. 지금 안 쌓으면 나중에 소급이 안 됩니다.
- **업체명은 고른 장소 이름이 일정 제목을 이깁니다.** 일정 제목은 개인
  메모(`본식 촬영`)인 경우가 많습니다.
- **장소는 필수가 아닙니다.** 청첩장·예물·신혼여행처럼 지도에 없는 게
  정상인 카테고리가 있고, 막으면 공급이 죽습니다. 없으면 카드의 장소 줄
  자체를 내지 않습니다 ("미확인" 이라고 크게 적지 않습니다).
- 카카오 SDK 로드와 키워드 검색은 `app/components/useKakaoPlaces.ts` 입니다.
  `AddPlanView` 는 지도 렌더까지 얽혀 있어 아직 안 옮겼습니다.

**목록에 지도를 깔지 마세요.** 카드의 장소 줄은 도로명 주소 한 줄 +
`카카오맵` 링크입니다(시안 A). 작은 지도를 카드마다 붙이면 금액을 세로로
훑는 설계가 깨지고 staticmap 쿼터·로딩이 붙습니다. 지도가 필요한 사람은
카카오맵 링크로 넘어가고, 앱 안의 지도는 **업체 상세(2차)** 에 하나만 둡니다.

- 후기 카드를 눌러도 아직 아무 일도 나지 않습니다. 상세를 만든다면
  "후기 상세" 가 아니라 **업체 상세**(지도 + 그 업체 후기 전체 + 중앙값)가
  맞습니다 — 후기 하나에 대해 더 보여줄 게 없습니다.

**평가는 하트가 아니라 `도움이 돼요` / `도움이 안 돼요` 양방향 투표입니다.**
이 피드의 값어치는 "예쁘다" 가 아니라 "쓸모 있다" 에 있고, 하트는 쓸모없는
후기를 아래로 밀어내지 못합니다. 한 사람이 한 표고, 마음을 바꾸면 행이
늘지 않고 값이 뒤집힙니다. 같은 값을 다시 누르면 취소입니다.

**"도움이 안 돼요" 수는 절대 공개하지 마세요.** 정직하게 올린 후기에
"안 돼요 12" 가 박히면 다음 사람이 안 올립니다 — 공급이 이 기능의 생사입니다.
응답(`GetPlanFeedResponse`)에 `notHelpfulCount` 를 넣지 말고, 화면에도 숫자를
붙이지 마세요. **정렬(도움순 = 돼요 - 안 돼요)과 어뷰징 감지에만** 씁니다.
`scripts/feed.cjs` 가 이 숫자가 새는지 매번 확인합니다.

**투표는 낙관적으로 그립니다.** 요청 전에 숫자를 먼저 바꾸고 응답이 오면
서버 값으로 맞춥니다(동시에 누른 사람이 있으면 다를 수 있음). 실패하면
되돌립니다. 즉시 반응하지 않으면 사람들이 두 번 누릅니다.

**탭.** `tabs.ts` 의 `feed` 는 이제 `/feed` 로 갑니다. 예전의 "서비스
준비중" 모달은 `BottomTabBar`·`SideNavRail` 양쪽에서 지웠습니다.

**백엔드**는 `~/DEV/seoul-moment-api` 의
`apps/api/src/module/plen/feed/` 입니다. 방 권한(`READ`/`SPOUSE`)과
**무관합니다** — 후기는 방이 아니라 개인 자격으로 올립니다. 게이트를 넣지
마세요. 평가 개수는 `plan_feed_post` 의 `helpful_count`·`not_helpful_count`
에 비정규화하고 `@Transactional()` 로 `plan_feed_vote` 행과 함께 씁니다.
도움순은 점수 컬럼을 따로 두지 않고 `helpful_count - not_helpful_count` 식으로
정렬합니다 — 카운터가 셋이 되면 어긋날 자리가 하나 더 늘어납니다.

**시세는 평균이 아니라 중앙값·사분위수로 냅니다**
(`findCategoryStats`). 자기 신고 금액이라 단위를 잘못 적은 한 건이 평균을
통째로 흔듭니다. 표본 수를 함께 주는 이유는 **적으면 아예 안 보여주기
위해서**입니다 — 3개로 시세를 말하는 건 조작보다 큰 거짓말입니다.
기획 전제(완료 일정이 후기가 될 만한지) 실측 쿼리는 백엔드
`docs/feed-data-audit.sql` 에 있습니다.

확인은 `node scripts/feed.cjs` — 폭별 캡처, 카테고리 칩, 투표 POST/DELETE·전환,
`내 플랜에 담기` → `/add-plen` 프리필, 비공개 금액 분기까지 실제 요청을 잡아
봅니다. **등록 폼은 단계형이라 결제 유형을 고르기 전에는 금액·장소 칸이
없습니다** — 프리필 확인은 그 뒤에 해야 합니다.

### 프로필 (`app/user/page.tsx` → `app/components/SettingsPage.tsx`)

셸 + 대시보드 머리글 띠를 씁니다. 화면 본체는 `SettingsPage` 한 곳에 있고
`/user` 는 데이터를 넣어 주기만 합니다.

**왼쪽 미리보기 | 오른쪽 편집 폼** 두 열입니다
(`@container` + `@[860px]`, `[320px_minmax(0,1fr)]`).

- **미리보기는 `user` 가 아니라 `formData` 를 읽습니다.** 오른쪽에서 고치는
  대로 같이 바뀌어야 "저장하면 이렇게 보인다"가 되고, 그게 이 열의 존재
  이유입니다.
- **좁을 때는 폼이 먼저입니다** (`order-1` / `order-2`). 미리보기는 넓은
  화면의 덤이라 `@[860px]` 아래에서는 아예 감춥니다 — 바로 아래 폼과 같은
  값을 두 번 보여줄 뿐이고, 위에 두면 정작 고치러 온 폼이 화면 밖으로
  밀립니다. 로그아웃 카드는 폰에서 맨 끝에 놓입니다.
- **입력 칸은 라벨을 항상 띄웁니다**(`Field` 컴포넌트). 예전에는 placeholder
  뿐이라 값을 넣는 순간 무슨 칸인지 사라졌습니다 — 화면에 `4200`,
  `2026-11-14` 만 남았습니다. **placeholder 만 있는 칸을 다시 만들지 마세요.**
- 날짜는 `DatePickerModal` 로만 고칩니다(add-plen 과 같음). 예전에 칸 옆에
  있던 보라색 달력 버튼은 칸 자체가 이미 눌려서 하는 일이 같았고, 앱에 없는
  색이었습니다.
- 저장 버튼은 앱 primary(`#ee2b8c`)이고 이름은 **`저장`** 입니다. 예전에는
  검정 배경에 `프로필 수정` 이라, 이미 프로필 수정 화면인데 무엇이 일어날지
  애매했습니다.
- D-day 는 **머리글 띠 한 곳에만** 둡니다. 미리보기 카드에도 넣으면 넓은
  화면에서 같은 값이 두 번 보입니다.
- 로그아웃은 저장된 플랜 데이터까지 지우므로 **2단 확인**을 유지하세요.
- 하단에 있던 `공지 사항 및 소개` 는 **없앴습니다.** 눌리지도 않는 문구라
  화면만 차지했습니다. 연결할 페이지가 생기면 그때 링크로 다시 넣으세요.
- 폭별 캡처는 `scripts/misc-pages.cjs` 가 `/user` 를 포함해 찍습니다.

### 셸을 쓰지 않는 화면

- **`/setting`** (온보딩) — 레일·탭바를 달지 않습니다. 온보딩 중에 홈·보드로 새면 안 됩니다.
  - **단계 수가 로그인 여부에 따라 다릅니다.** 회원은 `결혼 날짜 · 예산 ·
이름 · 약관 동의 · 함께할 사람` 5단계, 게스트는 `함께할 사람` 을 뺀
    4단계입니다.
    게스트는 방이 없어 공유 코드가 안 나오고, **보낼 링크 자체가 만들어지지
    않습니다** — 못 쓰는 단계를 보여 주는 건 안 보여 주는 것보다 나쁩니다.
    `canInvite` 는 `getToken()` 을 effect 안에서 읽어 켭니다(서버 렌더와
    어긋나지 않게). `ONBOARDING_STEPS_GUEST` / `ONBOARDING_STEPS_MEMBER` 두
    배열이 있고 진행 막대·`N / M 단계` 가 여기서 나옵니다.
  - **`함께할 사람` 단계(`showSixth`)는 맨 끝, 약관 동의 다음입니다.**
    이 앱의 메리트가 "신랑·신부가 같이"인데 예전에는 초대 진입점이 홈의 작은
    점선 `＋` 원 하나였고, 그마저 **멤버가 나 혼자일 때만** 떠서 조언자 한
    명만 들어와도 사라졌습니다. 온보딩은 이미 한 번에 하나씩 묻는 연출이라,
    여기에 한 칸을 더하면 초대가 부탁이 아니라 **절차**로 읽힙니다.
  - **초대를 약관 앞으로 옮기지 마세요.** 방과 `roomShareCode` 는 카카오
    로그인 때 이미 만들어지므로(백엔드 `plan.auth.service.ts` 의 `uuidV4()`)
    링크는 그때도 유효합니다. 비어 있는 건 방이 아니라 **내용**입니다 —
    날짜·예산·이름은 `handleGoToMain` 의 `POST /plan/setting` 에서만 저장되고,
    그건 약관 다음입니다. 앞에 두면 (1) 초대받은 사람이 **빈 플랜**에 들어오고,
    (2) 필수·제3자 제공 동의를 받기 전에 남에게 접근 권한을 주는 링크가 나가고,
    (3) 초대만 보내고 약관에서 이탈하면 상대가 영영 빈 플랜에 남습니다.
    그래서 `handleGoToMain` 은 **저장이 성공한 뒤에야** 초대 단계를 엽니다 —
    하네스가 `POST /plan/setting` 과 `share-code` 의 **요청 순서**를 봅니다.
  - 그래서 약관 버튼 문구가 갈립니다 — 게스트는 `계획 짜러 가기`(끝),
    회원은 `다음`(초대가 남음). 마지막 `계획 짜러 가기` 는 초대 단계에 있습니다.
  - 초대 단계에는 **뒤로가기를 달지 않습니다.** 저장이 이미 끝난 뒤라
    되돌아갈 곳이 없습니다.
  - **초대 단계는 한 번 나가면 다시 볼 수 없습니다.** 약관에서 저장이 끝나
    `weddingDate`·`budget`·`name` 이 모두 찼으므로, `/setting` 으로 다시 들어와도
    `isPlanDataComplete()` 가 참이라 `AuthRedirectToMain` 과 `/setting` 자체
    effect 가 둘 다 `/main` 으로 보냅니다(질문을 되풀이하지 않는 게 맞습니다).
    **그래서 홈의 초대 띠가 유일한 재진입점입니다** — 띠를 없애면 온보딩에서
    건너뛴 사람은 초대할 방법이 사라집니다. 하네스가 이 재진입을 실제로 태워
    `/main` 에 도착하는지 확인합니다.
  - **반드시 빠져나갈 길을 함께 둡니다.** 두 카드(`부를게요` / `혼자 먼저`)
    중 하나를 고르기 전에는 기본 버튼이 잠기고, 그와 별개로 `나중에 할게요`
    가 항상 있습니다. 공유 시트를 취소해도(AbortError) 갇히지 않습니다 —
    막으면 온보딩에서 이탈합니다.
  - 초대 링크 조회·공유는 `app/hooks/useSpouseInvite.ts` 입니다. **`?as=spouse`
    가 빠지면 배우자로 부르고도 상대가 `READ` 로 들어옵니다** — 하네스가 보낸
    URL 을 실제로 잡아 확인합니다.
    대신 **`≥1024` 에서 좌우 2열**입니다 — 왼쪽 340px 흰 패널에 브랜드와 남은 단계
    (`결혼 날짜 · 예산 · 이름 · 약관 동의`)와 하단 진행 막대, 오른쪽에 지금 질문.
    **몇 개나 더 묻는지가 처음부터 보여야 이탈이 줄어듭니다** — 예전에는 1686px 화면에
    가운데 600px 세로 띠 하나라 좌우 1,000px 이 통째로 비었고, 다음 질문이 몇 개
    남았는지 알 수 없었습니다.
  - 패널은 **질문 단계에만** 붙습니다(`stepIndex` 1~4). 축하·환영·출입증(Lanyard)은
    전체 화면 연출이라 패널을 달지 않고 단계로 세지도 않습니다.
  - **`main` 은 `≥1024` 에서 폭 상한이 없습니다.** 연출 화면은 `absolute inset-0`
    으로 펼쳐지는데, 예전에는 `main` 이 `lg:max-w-[600px]` 라 2327px 모니터에서
    출입증이 **가운데 600px 띠**였습니다 — 전체 화면 연출이라고 적어 놓고 실제로는
    폰 화면이었습니다. 여기에 다시 `max-w` 를 걸지 마세요.
    `Lanyard` 의 `isMobile` 은 컨테이너가 아니라 `window.innerWidth` 를 읽고 카메라는
    fov 고정이라, 컨테이너를 넓혀도 물리 월드는 다시 잡히지 않습니다.
    다만 `Lanyard` 자체는 여전히 건드리지 마세요.
  - **약관 단계 안의 작은 출입증 미리보기는 `.lanyard-preview` 상자에 넣습니다.**
    `.lanyard-wrapper` 는 전체 화면용이라 `min-height:100dvh` 인데, 그대로 두면
    200px 상자 안에서도 캔버스가 화면 높이만큼 커집니다. **fov 는 세로 기준이라
    캔버스가 세로로 길수록 보이는 가로가 좁아져**(8.82 × 가로/세로) 카드
    (`BoxGeometry(0.8,1.125)` × `scale 2.25` = **1.8×2.53 유닛**)의 좌우가
    잘렸습니다 — 1249px 높이에서 보이는 가로가 1.41 유닛까지 줄었습니다.
    `components/Lanyard.css` 의 `.lanyard-preview .lanyard-wrapper` 가 캔버스를
    상자에 맞추고, 상자 비율은 카드(0.71)에 맞춰 잡습니다. **상자를 세로로 길게
    잡거나 `min-height` 를 되살리지 마세요.** 카메라 `position` z 는 카드가 상자를
    채우는 거리입니다(미리보기 10, 전체 화면 25).
  - **`<1024` 는 좌우 분할이 없습니다.** 새로 붙인 분할 클래스는 전부 `lg:` 이고,
    패널은 `hidden lg:flex` 입니다. 폰에는 진행 막대를 따로 내지 않습니다 —
    한 번에 하나씩 묻는 연출이 이미 진행 표시 역할을 합니다.
  - 넓은 화면에서는 질문·입력·버튼을 세로로 벌리던 `flex-1` 스페이서를 `lg:hidden`
    으로 접어 한 덩어리로 모읍니다. 안 그러면 900px 높이에 셋이 흩어집니다.
  - 확인은 `node scripts/onboarding.cjs` (폭별로 4단계를 실제로 눌러 넘기며 찍습니다).
- **`/`** (랜딩) — 로그인 전 화면이라 셸을 쓰지 않습니다. 아래 "랜딩" 항목을 보세요.
- **`/share/[shareCode]`** — 이미 중앙 정렬 flex + `max-w-sm` 카드라 어느 폭에서도 정상입니다. 손대지 않았습니다.
- **`/privacy`** (개인정보처리방침) — 읽으러 들어오는 문서라 내비게이션이 방해가 되고, 앱을 안 쓰는 사람도 봅니다. 서버 컴포넌트로 두어 **자바스크립트 없이도 전문이 보입니다** — 스토어 심사자와 크롤러가 그렇게 접근합니다.

### 랜딩 (`app/page.tsx` → `app/components/Landing.tsx`)

로그인 전 첫 화면입니다. 시안 `docs/concepts/landing-1a-final.html` 을 그대로
옮겨 온 것이라, **고칠 때 시안과 나란히 놓고 diff 를 볼 수 있어야 합니다.**

- 스타일은 `app/landing.css` 이고 **전부 `#lp` 아래로 스코프**되어 있습니다.
  클래스 이름(`.wrap`·`.sec`·`.tile`·`.web`…)이 흔한 것도 이유지만, 더 큰 이유는
  **`--color-*` 를 `:root` 에 두면 Tailwind v4 가 테마 색으로 등록해** 앱 전체에
  샙니다. 스코프를 풀지 마세요.
- **`app/landing.css` 는 손으로 고치지 말고 시안에서 다시 만듭니다** —
  `node scripts/gen-landing-css.cjs`. **`app/landing.css` 를 직접 고치면 다음
  생성 때 통째로 사라집니다** — 예산 막대 순서와 D-day 숫자 굵기를 그렇게 고쳤다가
  두 번 다 되살아났습니다. 고칠 곳은 언제나 시안입니다. 시안의 `<style>` 을 PostCSS 로 파싱해
  선택자마다 `#lp` 를 붙이고, 규칙 수·선언 수가 시안과 같은지 검사한 뒤에만 씁니다.
  손으로 짠 문자열 치환으로 옮겼다가 **주석이 선택자 자리에 끼면서 규칙 두 개가
  뒤섞여**, 모바일 리셋(`opacity:1`)이 통째로 사라진 적이 있습니다.
- **폰에서도 핀을 겁니다.** 예전에는 `<1020` 에서 핀을 풀어, 스크롤텔링이 히어로
  에서만 돌고 나머지 네 섹션은 그냥 흘렀습니다. 못 걸었던 이유는 좌우 2열이
  세로로 쌓여 내용이 화면보다 1.3~1.7배 커지기 때문입니다.
- **두 칸은 폰에서도 둘 다 보여야 합니다.** 한 자리에 겹쳐 두고 갈아 끼워 봤더니
  한 번에 하나만 보여 "지금 vs 여기서는" 대비가 통째로 사라졌습니다. 지금은
  **문서끼리(노션)는 세로로 쌓고, 기기끼리(폰·웹·폰·폰)는 가로로 나란히** 둡니다 —
  가로로 두면 작아지지만 생김새의 대비는 그게 더 삽니다. 대신 목업 속을 폰 폭에
  맞춰 낮춰야 합니다(부제·타일 숨김, 글자 축소, 카드 수 줄이기). 안 그러면 글자가
  한 글자씩 줄바꿈됩니다.
- **D-day 오도미터의 마스크 폭은 자릿수를 따라갑니다.** 가장 넓은 숫자(312)에
  고정하면 `D-0` 일 때 오른쪽에 빈칸이 남아 덩어리가 왼쪽으로 치우쳐 보입니다
  (`@keyframes maskW`, 굴림과 같은 구간).
- **핀은 폭과 높이를 같이 봅니다** — `max-width:700px and min-height:780px`.
  그 밖(701~1019, 그리고 폰인데 높이 <780)은 예전처럼 흐릅니다. 375×667 에서는
  제목·리드문·알약만으로 165px 를 넘겨 어떤 크기로도 안 들어갑니다.
- **감속 모드(`prefers-reduced-motion: reduce`)에서는 핀과 안무가 전부 꺼집니다.**
  윈도우의 `설정 > 접근성 > 시각 효과 > 애니메이션 효과` 를 끈 사람이 보는 화면이고,
  적지 않습니다. 평범하게 흐르는 한 장의 문서가 되는 게 맞지만 **여백도 같이
  줄여야** 합니다 — 핀을 걷어낸 자리에 여백이 그대로 남으면 빈 화면이 몇 개씩 생깁니다.
- **헤드리스 크롬은 이 값이 기본으로 `reduce` 입니다.** 그대로 검사하면 감속 폴백만
  보게 되고 스크롤 안무는 한 번도 돌지 않습니다 — 이걸 모르고 "이상 없음" 을 여러 번
  보고했습니다. 하네스는 반드시
  `page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"no-preference"}])`
  로 실제 사용자 환경을 맞춘 뒤 검사합니다. "PC 에서 스크롤텔링이 안 된다" 는 제보가
  오면 먼저 `matchMedia('(prefers-reduced-motion: reduce)').matches` 를 확인하세요.
- **모바일 크기를 키울 때는 반드시 한 화면에 들어가는지 재세요.** `.pin2` 의
  `overflow:hidden` 이 위아래를 잘라 먹습니다.
  확인은 `node scripts/landing-widths.cjs` — 15개 뷰포트(2327~320)에서 핀 유무·핀
  넘침·가운데 투명·가로 스크롤·히어로 타일·D-day 중심을 봅니다.
- 넓은 화면용 비율도 같이 풀어야 합니다 — 노션 창은 사이드바를 접고 표에 폭을 주고,
  `.win2` 의 `min-height` 를 0 으로 두지 않으면 카드 아래가 통째로 빕니다.
- **모바일 리셋 선택자 목록 가운데에 다른 규칙을 끼워 넣지 마세요.** 목록이 두
  동강 나면서 제목·리드문이 통째로 투명해집니다(실제로 그래서 한 화면이 백지였습니다).
- 폰트는 `@font-face` 를 다시 선언하지 않고 `next/font` 가 붙여 둔
  `--font-dunggeunmiso` / `--font-tmoney` 를 씁니다.
- **다섯 장면 전부 스크롤 안무가 CSS scroll-driven animation** 입니다
  (`animation-timeline`). 자바스크립트는 `app/components/landingFx.ts` 의 두 개뿐이고
  **둘 다 없어도 화면은 정상으로 보입니다** — (1) 손으로 쓴 WebGL 배경,
  (2) 핀 진행도를 라디오로 옮기는 동기화. 장면 고르기 자체는 라디오 + `:has()` 라
  JS 가 필요 없습니다.
- **안무는 각 무대의 `view-timeline` 에 묶습니다.** 히어로가 예전에
  `scroll(root)`(문서 전체 스크롤의 몇 %)였는데, 뒤에 섹션을 더할 때마다 문서가
  길어져 같은 % 가 무대 밖으로 밀렸습니다 — 네 번째 타일이 채워지기 전에 무대가
  지나가 버렸습니다. 지금은 `--hero` 입니다. **`scroll(root)` 로 되돌리지 마세요**
  (상단 진행 막대 `.progress` 만 예외 — 그건 문서 전체 진행도가 맞습니다).
- `.pin`/`.pin2` 는 `justify-content:safe center` 입니다. 그냥 `center` 면 내용이
  무대보다 클 때 위쪽 패딩을 무시하고 밀어내 **제목이 고정 내비에 잘립니다**.
- 시안 파일은 `.prettierignore` 에 있습니다. `npm run format` 이 손으로 맞춘
  CSS·인라인 SVG 를 통째로 들쑤셔 원본과 어긋나게 만듭니다.
- CTA 는 `useKakaoAuth` 와 `/setting` 으로 연결돼 있습니다. 시안의 `href="#start"`
  자리입니다.

### 약관·방침 문구는 `lib/legal.ts` 한 곳에만 (필수)

동의서 4종(개인정보·위치·제3자·마케팅)과 개인정보처리방침 본문이 전부 여기 있습니다. 예전에는 같은 문구가 `PrivacyAgreementSection` 과 `app/setting/page.tsx` 에 복사돼 있었고, **한쪽만 고치면 사용자가 동의한 문서와 화면에 보이는 문서가 달라집니다** — 동의받은 적 없는 문서로 서비스하는 것과 같습니다.

- **동의서와 방침은 다른 문서입니다.** 동의서는 가입할 때 받고, 방침은 누구나 로그인 없이 봐야 합니다. 구글 플레이는 스토어 등록 양식에서 방침의 **공개 URL** 을 요구하고, **계정 삭제 방법이 방침에 적혀 있는지도** 확인합니다(6번 항목).
- **위탁 표(5번)를 비우지 마세요.** Clarity 와 GA 를 붙인 순간 Microsoft·Google 이 처리자가 됩니다. 분석 도구를 빼거나 더할 때 이 표를 같이 고칩니다.
- `LEGAL_INFO` 의 사업자명·보호책임자·연락처·시행일이 비어 있으면 방침 페이지가 **경고 박스를 띄웁니다.** 배포 전에 반드시 채워야 합니다.

### `components/Lanyard.tsx`의 `window.innerWidth`는 그대로 둡니다

`useMediaQuery`로 바꾸지 마세요. 이 훅은 서버 스냅샷이 `false`라 하이드레이션 직후 한 번 `false`로 렌더되는데, Lanyard 의 `isMobile`은 **dpr·물리 timeStep(1/30↔1/60)·곡선 점 개수·clearcoat**를 동시에 결정합니다. 값이 뒤늦게 뒤집히면 모바일에서 접속할 때마다 물리 월드와 지오메트리가 다시 잡힙니다. 지금처럼 첫 렌더에서 `window.innerWidth`를 동기로 읽는 편이 맞습니다.

### 일정의 시각 (`startTime`)

일정은 **날짜(`startDate`)와 시각(`startTime`)을 따로** 갖습니다. `startDate` 는
`date` 컬럼이라 시각이 들어가지 않고, `timestamp` 로 바꾸면 이미 쌓인 데이터를
옮겨야 해서 `varchar(5)` 짜리 `"HH:mm"` 컬럼을 따로 뒀습니다.

- **시각은 선택입니다.** 날짜만 잡아 두는 일정이 훨씬 많아 비어 있는 게 기본이고,
  `날짜 미정` 이면 시각 입력 자체를 감춥니다.
- 표시는 `lib/utils.ts` 의 `formatKoreanTime()` 하나로 통일합니다 (`"11:00"` →
  `"오전 11:00"`). 값이 없으면 빈 문자열을 돌려주므로 `formatKoreanTime(t) ? ... : null`
  로 걸러 쓰세요.
- **지우려면 빈 문자열을 보냅니다.** 필드를 빼면 PATCH 시맨틱상 "변경 없음"입니다.

### PATCH `/plan/schedule/{id}` 는 보낸 필드만 바꿉니다

백엔드는 `save()` 를 쓰는데 `undefined` 는 무시하고 `null` 은 그대로 씁니다.
예전에는 `startDate` 를 안 보내면 무조건 `null` 로 덮어써서, 시각만 고치는 호출이
날짜를 조용히 지웠습니다. 지금은 보내지 않은 필드를 건드리지 않습니다.
**새 필드를 추가할 때 같은 패턴(`body.x === undefined ? undefined : ...`)을 지키세요.**

### 예식장 이름 (`weddingVenue`)

`PlanUser` 에 있고 `/user` 프로필 화면에서만 입력합니다. 온보딩(`/setting`)은
묻지 않으므로 **백엔드는 `weddingVenue` 를 보낸 경우에만 반영합니다** — 아니면
온보딩을 다시 저장할 때마다 값이 지워집니다. 홈 대시보드 상단의 결혼식 날짜
옆에 붙습니다. 게스트는 저장할 곳이 없어 항상 비어 있습니다.

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
- ~~READ 권한이 도달 불가~~ → 아래 "신랑·신부 정책 (권한)" 으로 열렸습니다.

### 해결된 항목 (예전 기록이 남아 있을 수 있음)

- ~~카카오 access_token이 URL hash로 노출~~ → httpOnly 쿠키 + `/api/auth/kakao/token`으로 회수합니다. OAuth state 논스 검증도 있습니다.
- ~~401 자동 처리 부재~~ → `ApiContext`가 공통 처리합니다(토큰 정리 + 복귀 경로 저장 + `SessionExpiredModal`). 자체 처리가 필요한 곳은 `skipAuthHandling: true`를 쓰며, 현재 `share` 페이지와 `chat`뿐입니다.
- ~~`KakaoLoginAlert`의 거대 effect~~ → 라우팅 결정은 `resolveDestination()`으로 분리했습니다. 이 컴포넌트를 수정할 때는 **`node scripts/login-branches.cjs`를 수정 전후로 돌려 출력을 비교**하세요 (실제 카카오 인증 없이 10개 분기를 확인하는 유일한 수단입니다).

## 개발용 스크립트

`npm install --no-save puppeteer-core` 후 `chrome.exe --remote-debugging-port=9222 --user-data-dir=<경로>` 로 크롬을 띄워 두고 실행합니다.

- `scripts/login-branches.cjs` — 로그인 후 라우팅 10분기를 목 응답으로 구동
- `scripts/room-permission-ui.cjs` — 방 권한(WRITE/READ)별 UI 게이트 확인
- `scripts/plan-list-panes.cjs` — `/plan-list` 폭별 레이아웃 + 채팅 pane + 알림 토스트 억제 확인. 자체적으로 크롬을 띄우므로 `npm run dev`만 있으면 됩니다 (`SHOT_DIR`로 캡처 위치 지정)
- `scripts/main-dashboard.cjs` — `/main` 폭별 레이아웃 + 리스트 스크롤 게이트 + 가이드 말풍선 좌표 + **초대 띠** 확인. `HEADED=1`을 붙이면 브라우저를 띄워 직접 눌러볼 수 있고, `NO_SPOUSE=1` 을 붙이면 배우자가 아직 없는 사용자로 구동합니다
- `scripts/plan-board.cjs` — `/calendar` 보드 뷰. 컬럼 분리, 보드↔캘린더 전환, 인스펙터, 완료 토글(`PATCH status`), 드래그 날짜 이동(`PATCH schedule`)까지 실제 요청을 잡아 확인합니다
- `scripts/landing-widths.cjs` — **랜딩 폭·높이별 검사.** 15개 뷰포트(2327~320)에서 다섯 섹션을 훑으며 핀이 걸려야 할 곳에 걸렸는지, 핀 내용이 한 화면을 넘치는지(`.pin2` 의 `overflow:hidden` 이 잘라 먹습니다), 화면 한가운데인데 투명한 덩어리가 있는지, 가로 스크롤·히어로 끝 타일·D-day 중심을 봅니다
- `scripts/session-renewal.cjs` — **세션 슬라이딩 갱신.** 백엔드를 목으로 세워 `X-Renewed-Token` 헤더가 오면 저장된 토큰이 바뀌는지, 없으면 그대로인지, **CORS 로 노출하지 않으면 갱신이 죽는지**, 비로그인에는 심지 않는지를 확인합니다. `npm run dev` 만 있으면 됩니다
- `scripts/session-entry.cjs` — **랜딩·로그인 진입 규칙.** `/plan/user` 를 목으로 세워 토큰 없음 → 랜딩, 만료(401) → `/login?expired=1`, 살아 있음 → `/main` 세 경우를 돌고, 랜딩에 세션 만료 모달이 뜨지 않는지·만료 토큰이 지워지는지 확인합니다
- `scripts/guest-flow.cjs` — **게스트(로그인 없이 둘러보기) 흐름 전체.** 랜딩 → 온보딩 4단계 → `/main` 을 실제로 눌러 넘기고, 일곱 화면을 돌며 **매번 "홈" 을 눌러 랜딩으로 튕겨 나가지 않는지** 확인합니다. 온보딩을 건너뛰고 `/calendar` 로 직접 들어온 경우와 새 탭도 따로 봅니다. 일정 추가는 단계형 폼(제목 → 카테고리 → 결제 유형 → 저장)을 순서대로 몰아 sessionStorage 저장과 보드 반영까지 확인하고, **게스트인데 인증 API 를 불렀는지**도 봅니다. `npm run dev` 만 있으면 되고 `HEADED=1` 로 띄워 볼 수 있습니다
- `scripts/misc-pages.cjs` — `/`, `/user`, `/add-plen`, `/setting` 폭별 캡처
- `scripts/onboarding.cjs` — `/setting` 온보딩을 실제로 눌러 넘기며 폭별(375·768·1280·1686·2327) 캡처. **게스트(4단계)와 회원(5단계) 두 모드를 모두 돕니다** — 회원 모드는 토큰을 심고 `share-code` 를 목으로 주며, 약관까지 실제로 동의해 넘어간 뒤 초대 단계에서 카드 선택 전 버튼 잠김 · 선택 후 라벨 전환 · 보낸 뒤 안내 문구 · **보낸 링크의 `?as=spouse`** · **`POST /plan/setting` 이 `share-code` 보다 먼저 나갔는지** · 끝나고 `/main` 으로 갔는지까지 확인합니다. 헤드리스 크롬에도 `navigator.share` 가 있어 그대로 두면 취소로 빠지므로 하네스가 스텁합니다. 회원 모드 기본 폭은 375·1280 이고 `WIDTHS` 를 주면 그 폭을 씁니다. `≥1024` 에서만 좌측 진행 패널이 붙는지, 연출 화면에는 안 붙는지, **출입증 캔버스가 `≥1024` 에서 뷰포트 폭을 다 쓰는지**(그 아래는 폰 프레임 500px) 확인합니다. Lanyard 는 dynamic import 라 캔버스가 붙을 때까지 기다린 뒤 찍습니다
- `scripts/budget-detail.cjs` — `/budget-detail` 폭별 레이아웃 + 2열 분기 + 가이드 앵커 위치
- `scripts/feed.cjs` — `/feed` 폭별 레이아웃 + 카테고리 칩 + 도움이 돼요/안 돼요 투표(전환·취소) + `내 플랜에 담기` 프리필 + 비공개 금액·안 돼요 수 비노출 확인

`plan-list-panes.cjs`는 **API 호스트로 가는 WebSocket을 막습니다.** socket.io 는 WS 로 붙어서 puppeteer 의 요청 가로채기를 우회하는데, 그대로 두면 가짜 토큰으로 공유 백엔드에 접속해 "존재하지 않는 방" 오류 모달이 뜹니다. 새 하네스를 만들 때도 같은 처리를 하세요.

목 응답에는 **CORS 헤더와 `OPTIONS` 프리플라이트 응답이 반드시 필요**합니다. 없으면 전부 CORS로 막혀 분기까지 가지 못합니다.

## 사용자 응답 규칙

이 프로젝트의 사용자(seoulmomenttw@gmail.com)는 모든 답변을 한글로 받기를 선호합니다 (코드·명령어·기술 용어는 영어 유지). 코드/문자열에 이모지는 사용자가 명시적으로 요청하지 않는 한 넣지 마세요.
