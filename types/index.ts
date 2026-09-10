export interface ChatRoom {
  id: number;
  name: string;
  /** 신랑·신부 방. 방장과 배우자 둘만 있는 방이다 */
  isCouple?: boolean;
  memberList: {
    planUserId: string;
    name: string;
    image: string | null;
    permission: string;
  }[];
}

export interface Member {
  planUserId: string;
  name: string;
  image: string | null;
  permission: "OWNER" | "WRITE" | "READ" | string;
}

export interface Plan {
  roomId: number;
  onwerName: string; // API typo maintained
  weddingDate: string;
  budget: number;
  remainingBudget: number;
  /** 아직 안 쓴 예정 지출 (만원). 구버전 응답에는 없다 */
  plannedUseAmount?: number;
  planCount: number;
  chatRooms: ChatRoom[];
  members: Member[];
}

export type FeedVote = "HELPFUL" | "NOT_HELPFUL";

/** 견적 후기 피드의 글. 익명이라 작성자 id 는 내려오지 않는다 */
export interface FeedPost {
  id: number;
  categoryName: string;
  /** 업체명 */
  title: string;
  /** 실제 지출 (만원). **비공개면 필드 자체가 없다** — `?? 0` 으로 채우지 말 것 */
  amount?: number;
  isAmountPublic: boolean;
  /** 시/구 까지만. 필터에 쓴다 */
  region: string | null;
  /** 도로명 주소. 카카오 장소를 고른 후기에만 있다 */
  address: string | null;
  /** 카카오 장소 id. 같은 업체 후기를 묶는 열쇠 (2차) */
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  /** 만족도 1~5 */
  rating: number;
  body: string | null;
  /** 올린 시점의 남은 일수. "D-131" 문장은 프론트가 만든다 */
  authorDDay: number | null;
  authorRole: "GROOM" | "BRIDE" | "UNKNOWN";
  /** "도움이 돼요" 수. **안 돼요 수는 내려오지 않는다** — 공개하면 정직한
   *  후기가 안 올라온다. 정렬과 어뷰징 감지는 서버가 안에서만 쓴다 */
  helpfulCount: number;
  /** 내가 어떻게 평가했는지. 안 했으면 null */
  myVote: FeedVote | null;
  isMine: boolean;
  createDate: string;
}

/** 피드 사이드의 "내 후기" 패널 */
export interface FeedMyStatus {
  postCount: number;
  receivedHelpfulCount: number;
  postableScheduleCount: number;
}

/** 아직 후기로 안 올린 완료 일정 */
export interface PostableSchedule {
  scheduleId: number;
  categoryName: string;
  title: string;
  amount: number | null;
  /** 일정에 적힌 장소. 카카오에서 고른 경우 주소가 아니라 **업체명**이다 */
  location: string | null;
  locationLat: number | null;
  locationLng: number | null;
  startDate: string | null;
}

/* ─────────────────────────────────────────────────────────────
 * 자랑하기 (`/brag`)
 *
 * 단위는 **플랜 전체**다. 일정 하나를 올리는 것은 피드(견적 후기)가 이미
 * 맡고 있고, 여기는 "내 웨딩 플랜 한 장" 이 통째로 올라간다.
 *
 * **피드와 규칙이 정반대다.** 피드는 `planUserId` 조차 내려보내지 않는
 * 익명이고, 자랑하기는 **닉네임이 그대로 공개**된다. 그래서 올리기 전에
 * 안내 모달이 무엇이 공개되는지 글자 그대로 적어 준다
 * (`app/components/BragToggle.tsx` 의 `OPEN_FIELDS`).
 *
 * 금액 단위는 앱의 다른 곳과 같은 **만원**이다.
 * 계약 전문은 `docs/BRAG_API.md`.
 * ───────────────────────────────────────────────────────────── */

/** 목록 카드 한 장. `GET /plan/brag/list` */
export interface BragPost {
  bragId: number;
  /** "지수 · 현우". 방에 배우자가 있으면 두 이름, 없으면 한 이름 */
  nickname: string;
  weddingDate: string | null;
  /** 남은 일수. "D-66" 문장은 프론트가 만든다 (`FeedCard` 와 같은 규칙) */
  dday: number | null;
  totalBudget: number;
  /** 실제 지출 */
  usedAmount: number;
  /** 아직 안 쓴 예정 몫 */
  plannedAmount: number;
  planCount: number;
  doneCount: number;
  /** 카드에 칩으로 낼 카테고리 이름. 지출 큰 순 */
  categories: string[];
  likeCount: number;
  liked: boolean;
  publishedAt: string;
  isMine: boolean;
}

/** 상세 모달(M5-C). `GET /plan/brag/{bragId}` */
export interface BragDetail extends BragPost {
  /** 예산 막대·범례용. 지출 큰 순, 서버가 잘라 준다 */
  categoryChart: Array<{ categoryName: string; usedAmount: number }>;
  /**
   * 플랜 전체를 **평평한 목록**으로 받는다. 카테고리로 묶고 소계를 내는 것은
   * 프론트가 한다 — 소계는 지출과 예정을 함께 세야 하는데(시안 M5-C), 그
   * 규칙이 서버에 있으면 문구 하나 고치는 데 백엔드 배포가 묶인다.
   */
  items: BragPlanItem[];
}

/**
 * 상세 모달에 뜨는 플랜 한 줄.
 *
 * **시각(startTime)과 메모는 없다** — 남에게까지 공개할 값이 아니다.
 * 장소는 상세 시트의 지도 때문에 나중에 더했고, 그때 안내 모달의 공개
 * 목록(`BragToggle` 의 `OPEN_FIELDS`)을 먼저 고쳤다.
 *
 * **이 목록을 늘리려면 그 문구를 먼저 고친다.** 순서를 뒤집으면 동의받지
 * 않은 것을 공개하게 된다.
 */
export interface BragPlanItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  status: string | null;
  /**
   * 장소. 카카오에서 고른 경우 **주소가 아니라 업체명**이다 ("SG웨딩홀").
   * 장소를 넓히기 전에 올라간 스냅샷에는 없어서 `undefined` 로도 온다.
   */
  location?: string | null;
  /** 지도를 그릴 좌표. 카카오에서 고른 경우에만 있다 */
  lat?: number | null;
  lng?: number | null;
}

/** 내 플랜이 지금 올라가 있는지. `GET /plan/brag/my` */
export interface BragMyStatus {
  published: boolean;
  bragId: number | null;
  publishedAt: string | null;
  likeCount: number;
}
