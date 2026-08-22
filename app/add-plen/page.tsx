"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import AddPlanView from "./AddPlanView";

/**
 * 폼 본체는 `AddPlanView` 에 있다. 넓은 화면에서는 같은 컴포넌트를
 * `variant="pane"` 으로 보드·캘린더 옆에 붙이기 때문에, 이 파일은 쿼리를
 * 읽어 넘기는 일만 한다. (`ChatRoomView`·`ScheduleDetailView` 와 같은 구조)
 */
function AddPlanPageContent() {
  const searchParams = useSearchParams();

  const editId = useMemo(() => {
    const idParam = searchParams.get("id");
    if (!idParam) return null;
    const parsed = Number(idParam);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);

  const roomId = useMemo(() => {
    const raw = searchParams.get("roomId");
    if (!raw?.trim()) return null;
    const n = Number(raw.trim());
    return Number.isNaN(n) ? null : n;
  }, [searchParams]);

  /**
   * 피드의 "내 플랜에 담기" 가 넘겨 주는 값.
   * 하나도 없으면 null 을 넘겨 폼이 프리필 로직을 아예 타지 않게 한다.
   */
  const prefill = useMemo(() => {
    const title = searchParams.get("title");
    const categoryName = searchParams.get("category");
    const amountRaw = searchParams.get("amount");
    const location = searchParams.get("location");
    if (!title && !categoryName && !amountRaw && !location) return null;

    const amount = amountRaw ? Number(amountRaw) : null;
    return {
      title,
      categoryName,
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      location,
    };
  }, [searchParams]);

  return (
    <AddPlanView
      variant="page"
      editId={editId}
      roomId={roomId}
      initialDate={searchParams.get("date")}
      from={searchParams.get("from")}
      prefill={prefill}
    />
  );
}

export default function AddPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-[#FFF5F2]">
          <div className="text-[#FF8FA3]">불러오는 중...</div>
        </div>
      }
    >
      <AddPlanPageContent />
    </Suspense>
  );
}
