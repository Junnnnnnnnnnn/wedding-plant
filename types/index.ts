export interface ChatRoom {
  id: number;
  name: string;
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
  planCount: number;
  chatRooms: ChatRoom[];
  members: Member[];
}
