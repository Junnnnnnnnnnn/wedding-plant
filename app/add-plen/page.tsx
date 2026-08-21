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

  return (
    <AddPlanView
      variant="page"
      editId={editId}
      roomId={roomId}
      initialDate={searchParams.get("date")}
      from={searchParams.get("from")}
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
