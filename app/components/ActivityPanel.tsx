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
  /**
   * 값이 바뀌면 다시 받는다. 플랜을 추가하거나 완료하면 그 자체가 활동으로
   * 쌓이므로, 부모가 올려 주지 않으면 새로고침 전까지 기록이 안 보인다.
   */
  refreshToken?: number;
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
    case "SPOUSE_ASSIGNED":
      return "신랑·신부를 정했어요";
    case "SPOUSE_CLEARED":
      return "신랑·신부 지정을 풀었어요";
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
 * 최근 활동. 넓은 화면(≥768)의 홈 대시보드 사이드에 붙는다.
 *
 * 비어 있어도 카드는 그대로 낸다. 예전에는 기록이 없으면 아무것도 렌더하지
 * 않아서, 활동 로그가 아직 안 쌓인 사용자에게는 사이드 컬럼이 통째로 사라지고
 * 대시보드에 구멍이 뚫린 것처럼 보였다. "무엇을 하면 여기가 채워지는지"는
 * 비어 있을 때 오히려 더 알려 줘야 한다.
 */
export default function ActivityPanel({
  roomId = null,
  count = 5,
  inDashboard = false,
  refreshToken = 0,
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
  }, [fetchActivities, refreshToken]);

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
      {/*
        아직 못 받았을 때. 빈 상태를 먼저 보여 줬다가 기록이 뜨면 카드 높이가
        튀므로, 받는 동안은 같은 짜임의 자리만 잡아 둔다.
      */}
      {!loaded && (
        <div className="grid gap-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="skeleton-shimmer h-7 w-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <span
                  className="skeleton-shimmer block h-[13px] rounded"
                  style={{ width: `${[88, 72, 80][i]}%` }}
                />
                <span className="skeleton-shimmer mt-1.5 block h-[11px] w-14 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}
      {loaded && items.length === 0 && (
        <p className="text-[13px] leading-relaxed text-[#7a6c74] break-keep">
          아직 쌓인 기록이 없어요.
          <br />
          플랜을 추가하거나 완료하면, 함께 보는 사람들이 무엇을 했는지 여기에
          남습니다.
        </p>
      )}
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
