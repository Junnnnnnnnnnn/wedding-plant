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
