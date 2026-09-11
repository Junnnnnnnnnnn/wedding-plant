import { getPlanUserIdFromToken } from "./api";

/**
 * 신랑·신부로 초대를 받으면 **그 방이 내 플랜이 된다**(귀속).
 *
 * 부부는 결혼식을 두 번 하지 않는다. 그래서 배우자 초대를 수락한 사람은
 * 방장의 플랜을 "참여 플랜" 하나로 곁들여 보는 게 아니라, 그 플랜을 자기
 * 플랜으로 쓴다 — 홈·보드·예산이 전부 그 방을 본다.
 *
 * **초대 전에 자기가 만들어 둔 플랜은 화면에서 내린다.** 지우지는 않는다
 * (DB 에 그대로 있다). 함께하기를 그만두면 다시 보인다. 그래서 수락 전에
 * `SpouseJoinWarningModal` 로 반드시 알린다 — 모르고 눌렀다가 자기 일정이
 * 사라진 것처럼 보이는 게 이 정책에서 가장 나쁜 경우다.
 *
 * **조언자(READ)는 귀속이 아니다.** 남의 플랜을 같이 보며 거드는 자리라
 * 자기 플랜을 그대로 둔다. 그래서 경고도 띄우지 않는다.
 *
 * 판단 근거는 `/plan/room/list` 의 `members[].permission` 하나뿐이라
 * 백엔드에 새 필드를 만들지 않았다.
 */
export const SPOUSE_PERMISSION = "SPOUSE";

type RoomMemberLike = {
  planUserId?: string | null;
  permission?: string | null;
};

type RoomLike = {
  roomId?: number | null;
  onwerName?: string | null;
  members?: RoomMemberLike[] | null;
};

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

/** 이 방에서 내 권한. 멤버가 아니면 `null` */
export function myPermissionIn(
  room: RoomLike,
  myPlanUserId?: string | null,
): string | null {
  const myId = norm(myPlanUserId ?? getPlanUserIdFromToken());
  if (!myId) return null;
  const me = room.members?.find((m) => norm(m.planUserId) === myId);
  const permission = me?.permission;
  return permission ? String(permission).toUpperCase() : null;
}

/**
 * 내가 배우자로 들어간 방. 없으면 `null`.
 *
 * 방이 여러 개여도 배우자 자리는 한 곳뿐이라(백엔드 부분 유니크 인덱스)
 * 처음 찾은 것을 쓴다.
 */
export function findBoundRoom<T extends RoomLike>(
  rooms: T[] | null | undefined,
  myPlanUserId?: string | null,
): T | null {
  if (!rooms?.length) return null;
  const myId = myPlanUserId ?? getPlanUserIdFromToken();
  return (
    rooms.find(
      (room) =>
        room.roomId != null && myPermissionIn(room, myId) === SPOUSE_PERMISSION,
    ) ?? null
  );
}

/**
 * 귀속 여부를 세션에 적어 둔다.
 *
 * 이걸 안 두면 **귀속되지 않은 사람도** 방 화면에 들어올 때마다
 * `/plan/room/list` 를 기다리는 동안 가림막을 보게 된다. 대부분의 사용자가
 * 거기에 해당하므로, 한 번 물어본 답을 세션 동안 재사용한다.
 *
 * `sessionStorage` 인 이유는 게스트 데이터·복귀 경로와 같다 — 탭을 닫으면
 * 지워지는 게 맞고, 방을 나가거나 새로 초대받은 경우 다음 탭에서 다시 묻는다.
 * 그 사이에도 매 방문 백그라운드로 확인해 값을 고쳐 둔다.
 */
export const BOUND_ROOM_CACHE_KEY = "plan_bound_room";

/** 귀속된 적 없음을 뜻하는 표시. `null`(아직 모름)과 구분해야 한다 */
const NOT_BOUND = "none";

/** `null` = 아직 모름, `"none"` = 귀속 아님, 그 밖 = 방 id */
export function readBoundRoomCache(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(BOUND_ROOM_CACHE_KEY);
  } catch {
    return null;
  }
}

export function writeBoundRoomCache(roomId: number | null): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      BOUND_ROOM_CACHE_KEY,
      roomId == null ? NOT_BOUND : String(roomId),
    );
  } catch {
    // 사파리 비공개 모드 등. 캐시가 없으면 매번 묻는 것뿐이라 치명적이지 않다
  }
}

/** 캐시가 "귀속 아님" 이라고 말하는가 */
export function isCachedNotBound(cached: string | null): boolean {
  return cached === NOT_BOUND;
}

/**
 * `?roomId=` 로 방을 보는 화면들. **여기 한 곳에만 둔다** — 화면마다 같은
 * 판단을 복사하면 하나 빠뜨렸을 때 그 화면만 조용히 개인 플랜을 연다.
 *
 * `/plan-list` 와 `/feed` 는 없다. 목록은 방을 고르는 자리이고, 피드는 방이
 * 아니라 개인 자격으로 쓴다.
 */
export const ROOM_AWARE_PATHS = [
  "/main",
  "/calendar",
  "/budget-detail",
  "/schedule-detail",
  "/add-plen",
];

/**
 * 귀속된 사람이 갈 주소로 고친다 — **홈이 곧 그 방**이다.
 *
 * 탭바의 "홈" 은 `/main` 으로 가면서 쿼리를 떼어 낸다. 그대로 두면 방을
 * 보다가 홈을 눌렀을 때 내 개인 플랜(빈 화면)으로 떨어지고, 그다음
 * `BoundRoomRedirect` 가 다시 방으로 돌리느라 한 번 더 깜빡인다.
 * 링크가 처음부터 방을 달고 가면 그 왕복이 아예 없다.
 *
 * 캐시를 아직 모르면(첫 방문) 그대로 둔다 — `BoundRoomRedirect` 가 맡는다.
 */
export function withBoundRoom(path: string): string {
  const cached = readBoundRoomCache();
  if (!cached || isCachedNotBound(cached)) return path;
  const [bare, rawQuery] = path.split("?");
  if (!ROOM_AWARE_PATHS.includes(bare)) return path;
  const query = new URLSearchParams(rawQuery ?? "");
  if (query.get("roomId")?.trim()) return path;
  query.set("roomId", cached);
  return `${bare}?${query.toString()}`;
}
