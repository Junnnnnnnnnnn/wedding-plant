"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { useApi } from "../contexts/ApiContext";

/** GET /plan/activity/list 의 항목 */
interface ActivityItem {
  id: number;
  type: string;
  actorPlanUserId: string;
  actorName: string;
  actorImage: string | null;
  targetType: string | null;
  targetId: number | null;
  targetTitle: string | null;
  amount: number | null;
  createDate: string;
}

interface ActivityPanelProps {
  /** 공유 방 id. 없으면 개인 플랜의 기록을 본다 */
  roomId?: string | null;
  /** 몇 건까지 보여줄지 */
  count?: number;
  /**
   * 대시보드 그리드 안에 들어갈 때. 바깥이 간격을 잡으므로 자체 여백을
   * 빼고, md:block 대신 항상 보이게 한다.
   */
  inDashboard?: boolean;
}

const AVATAR_COLORS = ["#ee2b8c", "#7c6cf0", "#f0a23c", "#059669", "#0ea5e9"];

function avatarColor(planUserId: string): string {
  let hash = 0;
  for (let i = 0; i < planUserId.length; i += 1) {
    hash = (hash * 31 + planUserId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * 문장은 서버가 아니라 여기서 조립한다. 서버가 완성된 문구를 내려보내면
 * 문구를 고칠 때마다 백엔드 배포에 묶인다.
 */
function describe(item: ActivityItem): string {
  const title = item.targetTitle?.trim();
  switch (item.type) {
    case "SCHEDULE_CREATED":
      return title ? `${title}을 추가했어요` : "플랜을 추가했어요";
    case "SCHEDULE_COMPLETED":
      return title ? `${title}을 완료했어요` : "플랜을 완료했어요";
    case "SCHEDULE_DELETED":
      return title ? `${title}을 삭제했어요` : "플랜을 삭제했어요";
    case "BUDGET_UPDATED":
      return item.amount != null
        ? `총 예산을 ${item.amount.toLocaleString("ko-KR")}만원으로 수정했어요`
        : "총 예산을 수정했어요";
    case "MEMBER_JOINED":
      return "플랜에 참여했어요";
    case "ROOM_CREATED":
      return "플랜을 함께 쓰기 시작했어요";
    default:
      return "플랜을 업데이트했어요";
  }
}

/** "2시간 전", "어제", "8월 16일" */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMin = Math.floor((Date.now() - then) / 60000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffHour < 48) return "어제";
  const d = new Date(then);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 최근 활동. 넓은 화면(≥768)의 홈 좌측 컬럼에 붙는다.
 *
 * 기록이 없으면 아무것도 렌더하지 않는다. 활동 로그는 이 기능이 배포된
 * 뒤부터 쌓이므로, 기존 사용자는 한동안 비어 있는 게 정상이다.
 */
export default function ActivityPanel({
  roomId = null,
  count = 5,
  inDashboard = false,
}: ActivityPanelProps) {
  const { fetchWithAuth } = useApi();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!getToken()) {
      setLoaded(true);
      return;
    }
    try {
      const params = new URLSearchParams({
        page: "1",
        count: String(count),
      });
      if (roomId?.trim()) params.set("roomId", roomId.trim());
      const res = await fetchWithAuth(
        `/plan/activity/list?${params.toString()}`,
        { skipLoading: true },
      );
      const json = (await res.json().catch(() => null)) as {
        result?: boolean;
        data?: { list?: ActivityItem[] };
      } | null;
      if (json?.result === true && json.data?.list) {
        setItems(json.data.list);
      }
    } catch {
      // 부가 정보라 실패해도 화면에 오류를 띄우지 않는다
    } finally {
      setLoaded(true);
    }
  }, [count, fetchWithAuth, roomId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (!loaded || items.length === 0) return null;

  return (
    <section
      className={
        inDashboard
          ? "w-full rounded-[28px] border border-[#ee2b8c0f] bg-white p-6 shadow-sm"
          : "mt-6 hidden w-full rounded-[24px] border border-[#ee2b8c0f] bg-white p-5 shadow-sm md:block"
      }
    >
      <h2 className="mb-3 text-[15px] font-bold tracking-tight text-[#1b0d14]">
        최근 활동
      </h2>
      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            {item.actorImage ? (
              <img
                src={item.actorImage}
                alt={item.actorName}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ background: avatarColor(item.actorPlanUserId) }}
              >
                {item.actorName?.trim().charAt(0) || "?"}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[13px] leading-relaxed text-[#4a3f45] break-keep">
                <b className="font-bold">{item.actorName || "누군가"}</b>님이{" "}
                {describe(item)}
              </p>
              <time className="mt-0.5 block text-[11.5px] text-gray-400">
                {relativeTime(item.createDate)}
              </time>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
