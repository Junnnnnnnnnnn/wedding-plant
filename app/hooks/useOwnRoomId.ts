"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { useApi } from "../contexts/ApiContext";

/**
 * 로그인한 사람의 **내 플랜 방 id**.
 *
 * 일정은 `plan_schedule.plan_user_room_id` 가 비어 있으면 방에 붙지 않는다.
 * 그러면 만든 본인 말고는 아무도 못 본다 — 배우자가 열면 백엔드가
 * `You are not allowed to access this plan schedule` 로 막고
 * (`plan-schedule.service.ts` 의 `getAuthorizedPlanSchedule`),
 * 방 기준으로 세는 홈 대시보드·예산 합계에서도 통째로 빠진다.
 *
 * 그런데 화면들은 방 id 를 **주소창의 `?roomId=` 에서만** 읽어 왔다.
 * 내 플랜을 보는 중에는 그 파라미터가 없으므로 `/calendar`·`/feed` 에서
 * 등록한 일정이 전부 방 밖으로 떨어졌다. `/main` 에만 `/plan/user` 의
 * `roomId` 로 메우는 폴백이 있었다.
 *
 * **읽기 경로에 쓰지 말 것.** 여기서 주는 값은 "저장할 곳"이다.
 * 남의 플랜을 보는 공유 뷰에서는 내 방 id 를 붙이면 안 되므로
 * (남의 화면에서 만든 일정이 내 플랜에 저장된다) 폴백 여부는 화면이 정한다.
 */
export function useOwnRoomId(): number | null {
  const { fetchWithAuth } = useApi();
  const [ownRoomId, setOwnRoomId] = useState<number | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetchWithAuth("/plan/user", { skipLoading: true });
        if (!res.ok) return;
        const json = (await res.json()) as {
          result?: boolean;
          data?: { roomId?: number | null };
        };
        if (!alive || json.result !== true) return;
        if (typeof json.data?.roomId === "number") {
          setOwnRoomId(json.data.roomId);
        }
      } catch {
        // 못 받으면 예전처럼 개인 일정으로 저장된다. 화면을 막지는 않는다.
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchWithAuth]);

  return ownRoomId;
}
