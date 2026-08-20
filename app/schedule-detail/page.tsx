"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import ScheduleDetailView from "./ScheduleDetailView";

/**
 * /schedule-detail 라우트.
 *
 * 본문은 ScheduleDetailView 로 옮겼다. 넓은 화면에서 보드·캘린더 옆의
 * 인스펙터로 같은 뷰를 재사용하기 위해서다. 이 페이지는 쿼리에서
 * id·roomId·from 을 꺼내 넘기는 일만 한다.
 */
function ScheduleDetailPageContent() {
  const searchParams = useSearchParams();

  const scheduleId = useMemo(() => {
    const idParam = searchParams.get("id");
    if (!idParam) return null;
    const parsed = Number(idParam);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);

  return (
    <ScheduleDetailView
      scheduleId={scheduleId}
      roomId={searchParams.get("roomId")}
      from={searchParams.get("from")}
      variant="page"
    />
  );
}

export default function ScheduleDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-[#fcfbfc]">
          <div className="flex items-center gap-3 text-[#ee2b8c]">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <span className="text-base font-semibold">불러오는 중...</span>
          </div>
        </div>
      }
    >
      <ScheduleDetailPageContent />
    </Suspense>
  );
}
