"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/app/contexts/ApiContext";
import { getToken } from "@/lib/api";
import {
  findBoundRoom,
  isCachedNotBound,
  readBoundRoomCache,
  ROOM_AWARE_PATHS,
  writeBoundRoomCache,
} from "@/lib/boundRoom";

/**
 * 방을 볼 수 있는 화면에 `roomId` 없이 들어온 **귀속된 사람**을 그 방으로 돌린다.
 *
 * 배우자 초대는 귀속이다(`lib/boundRoom.ts`). 부부는 결혼식을 두 번 하지
 * 않으므로, 수락한 뒤에는 방장의 플랜이 곧 내 플랜이다.
 *
 * **`/main` 에만 걸면 안 된다.** 홈에서 눌러 들어가면 `/calendar?roomId=…`
 * 처럼 파라미터가 붙어 따라오지만, **주소를 직접 치면 안 붙어서** 내 개인
 * 플랜이 열린다 — 귀속된 사람에게는 빈 화면이다. `GuestGate` 가 예전에 같은
 * 이유로 `/main` 에만 있다가 `/calendar` 로 새는 구멍을 냈다.
 *
 * `/add-plen` 이 특히 중요하다. `roomId` 없이 열리면 새 일정이 **화면에
 * 보이지도 않는 개인 플랜에 저장된다.**
 *
 * **초대 전에 만들어 둔 개인 플랜은 이렇게 화면에서 내려간다** — 지우지
 * 않는다. DB 에 그대로 있고, 방에서 나가면 다시 홈에 뜬다. 사용자는 그 사실을
 * 수락 전에 `SpouseJoinWarningModal` 로 듣는다.
 *
 * 돌리지 않는 경우:
 * - `?roomId=` 가 이미 있으면 사용자가 고른 방이다. 건드리지 않는다.
 * - `?share=` 와 `?kakao_login` 은 착지 구간이라 다른 라우팅이 책임진다
 *   (`KakaoLoginAlert`). 겹치면 서로를 덮어쓴다.
 * - 방장(OWNER)이나 조언자(READ)는 귀속이 아니다. `findBoundRoom` 이 배우자
 *   자리만 고른다.
 */

/**
 * 전환한 뒤, 그 화면이 방 데이터를 받아 그릴 때까지 가림막을 더 두는 시간.
 *
 * 곧바로 걷으면 내 개인 플랜이 한 박자 스쳤다가 방 플랜으로 바뀐다 —
 * 사용자가 "깜빡인다" 고 한 자리다.
 */
const HANDOFF_MS = 700;

export default function BoundRoomRedirect() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { fetchWithAuth } = useApi();
  const checkedRef = useRef(false);

  /*
    **공용 로딩 상태(`setLoading`)를 쓰지 않는다.** 그건 누구나 끌 수 있어서
    `/main` 의 "스켈레톤을 보여 주려고 끄는" 한 줄에 이 가림막까지 꺼졌고,
    그 틈으로 개인 예산 "3,000" 이 그대로 보였다(실측). 게다가 공용
    오버레이는 `bg-white/40` 라 반투명이어서, 떠 있어도 뒤 숫자가 비친다.

    그래서 이 컴포넌트가 자기 가림막을 직접 들고 **불투명**하게 덮는다.
  */
  const [veiled, setVeiled] = useState(false);
  const veiledRef = useRef(false);

  const veil = useCallback(() => {
    veiledRef.current = true;
    setVeiled(true);
  }, []);

  const unveil = useCallback(() => {
    if (!veiledRef.current) return;
    veiledRef.current = false;
    setVeiled(false);
  }, []);

  const roomIdParam = searchParams.get("roomId")?.trim();

  /*
    전환이 끝난 뒤(= roomId 가 붙은 뒤) 가림막을 걷는다.
    그동안 화면은 방 데이터를 받고 있다.
  */
  useEffect(() => {
    if (!veiledRef.current) return;
    if (!roomIdParam) return;
    const timer = setTimeout(unveil, HANDOFF_MS);
    return () => clearTimeout(timer);
  }, [roomIdParam, unveil]);

  useEffect(() => {
    if (!ROOM_AWARE_PATHS.includes(pathname)) return;
    if (roomIdParam) return;
    if (searchParams.get("share")?.trim()) return;
    if (searchParams.has("kakao_login")) return;
    if (!getToken()) return;
    if (checkedRef.current) return;
    checkedRef.current = true;

    const controller = new AbortController();

    /** 기존 쿼리를 지우지 않고 roomId 만 얹어 그 방으로 보낸다 */
    const goToRoom = (id: string) => {
      // `/schedule-detail?id=12` 에서 id 를 날리면 어느 일정인지 잃는다
      const next = new URLSearchParams(searchParams.toString());
      next.set("roomId", id);
      router.replace(`${pathname}?${next.toString()}`);
    };

    const cached = readBoundRoomCache();

    /*
      **묻는 동안 가린다.** 답이 오기 전에 화면은 이미 내 개인 플랜을 그리고
      있다 — 예산·이름·날짜는 sessionStorage 에서 곧바로 나오므로 네트워크를
      기다리지도 않는다.

      단, 이 세션에서 이미 "귀속 아님" 을 확인했다면 가리지 않는다.
      **대부분의 사용자가 여기 해당하고**, 그들에게 방 화면마다 흰 막이
      번쩍이면 고치려던 것보다 나쁜 화면이 된다. 그래도 아래에서 조용히
      다시 물어 값을 고쳐 둔다(그 사이 초대를 수락했을 수 있다).
    */
    if (!isCachedNotBound(cached)) veil();

    // 이미 아는 방이 있으면 묻기 전에 먼저 옮긴다 — 왕복만큼 덜 기다린다
    if (cached && !isCachedNotBound(cached)) goToRoom(cached);

    fetchWithAuth("/plan/room/list", {
      skipLoading: true,
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const bound = findBoundRoom(json?.data?.list);
        writeBoundRoomCache(bound?.roomId ?? null);
        if (bound?.roomId == null) {
          unveil();
          return;
        }
        /*
          캐시로 이미 옮겼으면 다시 옮기지 않는다.
          가림막은 여기서 걷지 않는다 — 위 effect 가 전환을 보고 걷는다.
        */
        if (String(bound.roomId) !== cached) goToRoom(String(bound.roomId));
      })
      .catch(() => {
        // 못 물어봤으면 내 플랜을 그대로 본다. 다음 방문에 다시 시도한다.
        unveil();
      });

    return () => {
      controller.abort();
      checkedRef.current = false;
    };
  }, [
    pathname,
    roomIdParam,
    searchParams,
    router,
    fetchWithAuth,
    veil,
    unveil,
  ]);

  /*
    화면을 떠날 때 가림막이 남지 않게 한다. 전환 도중에 사용자가 뒤로 가면
    가림막만 남아 앱이 멈춘 것처럼 보인다.
  */
  useEffect(() => () => unveil(), [unveil]);

  if (!veiled) return null;

  /*
    **불투명하다.** 이 막의 일은 "곧 바뀔 값"을 아예 안 보이게 하는 것이고,
    반투명이면 큰 숫자는 그대로 읽힌다.
  */
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-white"
      aria-busy
      aria-live="polite"
      aria-label="플랜을 불러오는 중입니다"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ee2b8c] border-t-transparent" />
      <p className="text-sm font-bold text-[#b0a8ae]">플랜을 불러오는 중...</p>
    </div>
  );
}
