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
  /** 시/구 까지만 */
  region: string | null;
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
  location: string | null;
  startDate: string | null;
}
