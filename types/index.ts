export interface Plan {
  roomId: number;
  onwerName: string; // API typo maintained
  weddingDate: string;
  budget: number;
  remainingBudget: number;
  planCount: number;
  members: {
    planUserId: string;
    name: string;
    image: string | null;
    permission: "OWNER" | "WRITE" | "READ" | string;
  }[];
}
