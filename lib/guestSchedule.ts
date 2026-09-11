export interface GuestScheduleItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  /** 시작 시각 "HH:mm". 날짜만 정하고 시간은 비워 둘 수 있다 */
  startTime?: string | null;
  status?: string | null;
  /**
   * 돈이 나갔는지. 일정 완료와 다른 축이다 (`lib/schedulePaid.ts`).
   * 없으면 완료 여부를 따라가므로 예전에 만든 게스트 일정도 그대로 읽힌다.
   */
  isPaid?: boolean | null;
  /** client-only marker */
  _guest?: true;
  createdAt: number;
  location?: string;
  locationLat?: number;
  locationLng?: number;
  memo?: string;
  payType?: string;
  addCategoryNameList?: string[];
}

const GUEST_SCHEDULE_KEY = "guest_schedule_list_v1";

function safeParseList(raw: string | null): GuestScheduleItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as GuestScheduleItem[];
  } catch {
    return [];
  }
}

export function getGuestScheduleList(): GuestScheduleItem[] {
  if (typeof window === "undefined") return [];
  return safeParseList(sessionStorage.getItem(GUEST_SCHEDULE_KEY));
}

export function setGuestScheduleList(list: GuestScheduleItem[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(GUEST_SCHEDULE_KEY, JSON.stringify(list));
}

export function addGuestScheduleItem(
  item: Omit<GuestScheduleItem, "id" | "createdAt">,
): GuestScheduleItem {
  const list = getGuestScheduleList();
  const next: GuestScheduleItem = {
    ...item,
    id: -Date.now(),
    createdAt: Date.now(),
    _guest: true,
  };
  setGuestScheduleList([next, ...list]);
  return next;
}

export function clearGuestScheduleList() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(GUEST_SCHEDULE_KEY);
}
