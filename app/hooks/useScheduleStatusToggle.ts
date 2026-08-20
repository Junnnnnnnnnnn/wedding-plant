"use client";

import { useCallback, useRef, useState } from "react";
import { useApi } from "../contexts/ApiContext";

export type ScheduleStatus = "NORMAL" | "COMPLETED";

/**
 * 일정 완료 여부를 토글한다. PATCH /plan/schedule/status/{id}
 *
 * 서버 응답을 기다리지 않고 화면을 먼저 바꾸고(낙관적 업데이트), 실패하면
 * 호출한 쪽이 되돌린다. 같은 항목을 연타해도 요청이 겹치지 않게 막는다.
 *
 * /main 은 이 훅을 쓰지 않는다. 거기 토글은 카드가 날아가는 애니메이션
 * (removedItems·togglingIds)과 탭별 카운트 보정까지 얽혀 있어서, 억지로
 * 공통화하면 오히려 읽기 어려워진다. 보드처럼 상태만 바꾸면 되는 곳에서 쓴다.
 */
export function useScheduleStatusToggle() {
  const { fetchWithAuth } = useApi();
  const pendingRef = useRef<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<number[]>([]);

  const sync = useCallback(() => {
    setPendingIds([...pendingRef.current]);
  }, []);

  const setStatus = useCallback(
    async (id: number, next: ScheduleStatus): Promise<boolean> => {
      if (pendingRef.current.has(id)) return false;
      pendingRef.current.add(id);
      sync();
      try {
        const res = await fetchWithAuth(`/plan/schedule/status/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
          skipLoading: true,
        });
        const json = (await res.json().catch(() => null)) as {
          result?: boolean;
        } | null;
        return res.ok && json?.result === true;
      } catch {
        return false;
      } finally {
        pendingRef.current.delete(id);
        sync();
      }
    },
    [fetchWithAuth, sync],
  );

  const isPending = useCallback(
    (id: number) => pendingIds.includes(id),
    [pendingIds],
  );

  return { setStatus, isPending };
}

/**
 * 일정의 날짜만 바꾼다. PATCH /plan/schedule/{id} 는 부분 수정이라
 * startDate 만 보내면 나머지 필드는 그대로 남는다
 * (app/add-plen/page.tsx 의 저장 로직 주석 참고).
 */
export function useScheduleDateMove() {
  const { fetchWithAuth } = useApi();

  const moveTo = useCallback(
    async (id: number, startDate: string): Promise<boolean> => {
      try {
        const res = await fetchWithAuth(`/plan/schedule/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ startDate }),
          skipLoading: true,
        });
        const json = (await res.json().catch(() => null)) as {
          result?: boolean;
        } | null;
        return res.ok && json?.result === true;
      } catch {
        return false;
      }
    },
    [fetchWithAuth],
  );

  return { moveTo };
}
