"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { MessageCircle, ArrowRight, Crown, CircleHelp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plan, ChatRoom, Member } from "@/types";
import { getDaysUntil, parseLocalDate } from "@/lib/utils";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import { getToken } from "@/lib/api";
import AppShell from "../components/AppShell";
import CoupleChatBadge, {
  sortCoupleFirst,
} from "../components/CoupleChatBadge";
import LoginRequiredModal from "../components/LoginRequiredModal";
import GuideOverlay, { GuideStep } from "../components/GuideOverlay";
import ChatRoomView from "../chat/[chatRoomId]/ChatRoomView";
import { useIsDesktop } from "../hooks/useMediaQuery";

interface PlanListPageProps {
  onSelectPlan?: (id: number) => void;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #ee2b8c 0%, #ff7eb3 100%)",
  "linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%)",
  "linear-gradient(135deg, #059669 0%, #34d399 100%)",
  "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #7dd3fc 100%)",
];

/**
 * 참여 플랜 카드 — 홈 대시보드와 같은 시각 언어.
 *
 * 이름·날짜 → 예산 → 대화 순으로 읽는다. 예전에는 10px 회색 대문자 라벨
 * (MEMBERS/CHANNELS)과 검정 "플랜 N" 알약이 제목보다 먼저 눈에 들어와
 * 정작 중요한 남은 예산이 카드 맨 아래에서 묻혔다.
 */

/** 겹쳐 놓은 참여 멤버 얼굴. 방장에게만 왕관을 얹는다 */
const MemberAvatars: React.FC<{ members: Member[] }> = ({ members }) => {
  // 같은 파일에서 chatRooms 는 `|| []` 로 방어하면서 members 는 안 하고 있었다.
  // 백엔드가 이 필드를 생략하면 목록 전체가 흰 화면이 된다.
  const list = Array.isArray(members) ? members : [];
  return (
    <div className="flex items-center -space-x-1.5">
      {list.slice(0, 4).map((member, idx) => (
        <div
          key={member.planUserId}
          className="relative flex-shrink-0"
          style={{ zIndex: list.length - idx }}
        >
          {String(member.permission ?? "").toUpperCase() === "OWNER" && (
            <span className="absolute -top-1 left-1/2 z-10 flex h-3.5 w-3.5 -translate-x-1/2 items-center justify-center rounded-full bg-amber-400 text-amber-900 shadow-sm">
              <Crown className="h-2 w-2" strokeWidth={3} />
            </span>
          )}
          <div
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[11px] font-black text-white shadow-sm"
            style={{
              background: member.image
                ? undefined
                : AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
            }}
          >
            {member.image ? (
              <img
                src={member.image}
                alt={member.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{member.name?.trim().charAt(0)?.toUpperCase()}</span>
            )}
          </div>
        </div>
      ))}
      {list.length > 4 && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-white bg-stone-100 text-[10px] font-black text-stone-400">
          +{list.length - 4}
        </div>
      )}
    </div>
  );
};

interface CardHeaderProps {
  ownerName: string;
  /** "YYYY-MM-DD". 없으면 날짜 줄을 내지 않는다 */
  weddingDate?: string;
  members: Member[];
}

const CardHeader: React.FC<CardHeaderProps> = ({
  ownerName,
  weddingDate,
  members,
}) => {
  // 홈 대시보드 상단과 같은 문장 — "2026년 12월 31일 · D-131"
  const dateLine = (() => {
    const parsed = weddingDate ? parseLocalDate(weddingDate) : null;
    if (!parsed) return null;
    const target = {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
    };
    const days = getDaysUntil(target);
    const dDay = days > 0 ? `D-${days}` : days === 0 ? "D-Day" : `D+${-days}`;
    return `${target.year}년 ${target.month}월 ${target.day}일 · ${dDay}`;
  })();

  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="break-keep text-[20px] font-black tracking-[-0.02em] text-[#1b0d14] md:text-[19px] md:font-bold">
          {ownerName}의 웨딩 플랜
        </h3>
        {dateLine && (
          <p className="mt-1 text-[12.5px] text-gray-400">{dateLine}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <MemberAvatars members={members} />
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ee2b8c0f] text-[#ee2b8c] transition-all group-hover/card:bg-[#ee2b8c] group-hover/card:text-white">
          <ArrowRight className="h-[18px] w-[18px]" />
        </div>
      </div>
    </div>
  );
};

interface CardChatRoomsProps {
  chatRooms: ChatRoom[];
  onChatRoomClick: (chatRoomId: number) => void;
  getRoomUnreadCount: (roomId: number) => number;
}

const CardChatRooms: React.FC<CardChatRoomsProps> = ({
  chatRooms,
  onChatRoomClick,
  getRoomUnreadCount,
}) => {
  const rooms = sortCoupleFirst(chatRooms ?? []);
  if (rooms.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[12.5px] text-gray-400">대화 {rooms.length}</p>
      <div className="space-y-2">
        {rooms.map((chatRoom) => (
          <div
            key={chatRoom.id}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              // 카드 전체가 플랜 상세로 가는 버튼이라 여기서 끊어야 한다
              e.stopPropagation();
              onChatRoomClick(chatRoom.id);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              onChatRoomClick(chatRoom.id);
            }}
            className={`group/chat-item flex cursor-pointer items-center gap-3 rounded-2xl border p-2.5 transition-all hover:border-[#ee2b8c22] hover:bg-white hover:shadow-sm active:scale-[0.99] ${
              chatRoom.isCouple
                ? "border-[#ee2b8c22] bg-[#fff7fa]"
                : "border-transparent bg-[#fcfbfc]"
            }`}
          >
            <div className="relative shrink-0">
              {getRoomUnreadCount(chatRoom.id) > 0 && (
                <div className="absolute -top-1 -left-1 z-20 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#ee2b8c]">
                  <span className="text-[7px] font-black text-white">
                    {getRoomUnreadCount(chatRoom.id) > 9
                      ? "9+"
                      : getRoomUnreadCount(chatRoom.id)}
                  </span>
                </div>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ee2b8c0f] text-[#ee2b8c] transition-all group-hover/chat-item:bg-[#ee2b8c] group-hover/chat-item:text-white">
                <MessageCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1b0d14]">
                <span className="truncate">{chatRoom.name}</span>
                {chatRoom.isCouple && <CoupleChatBadge size="sm" />}
              </h4>
            </div>
            <div className="flex shrink-0 items-center -space-x-1.5">
              {(chatRoom.memberList ?? []).slice(0, 4).map((m, i) => (
                <div
                  key={m.planUserId}
                  className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-white text-[7px] font-black text-white shadow-sm"
                  style={{
                    background: m.image
                      ? undefined
                      : AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                  }}
                >
                  {m.image ? (
                    <img
                      src={m.image}
                      alt={m.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{m.name.charAt(0)}</span>
                  )}
                </div>
              ))}
              {(chatRoom.memberList?.length ?? 0) > 4 && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-stone-100 text-[7px] font-black text-stone-400">
                  +{(chatRoom.memberList?.length ?? 0) - 4}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface CardBudgetProps {
  remainingBudget: number;
  budget: number;
  /** 실제로 나간 몫 (%) */
  usedPercent: number;
  /** 아직 안 쓴 예정 몫 (%) */
  plannedPercent: number;
  /** 예정 금액 (만원). 0 이면 회색 구간을 그리지 않는다 */
  plannedUseAmount: number;
}

const CardBudget: React.FC<CardBudgetProps> = ({
  remainingBudget,
  budget,
  usedPercent,
  plannedPercent,
  plannedUseAmount,
}) => {
  /*
    예산을 넘기면 조각 합이 100% 를 넘어 flex 가 비율대로 줄인다. 그러면
    예정(회색)처럼 작은 몫이 사실상 사라진다. 합이 100 이 되게 직접 누르고,
    예정 조각은 최소 4px 을 남긴다.
  */
  const total = usedPercent + plannedPercent;
  const barScale = total > 100 ? 100 / total : 1;
  return (
    <div className="space-y-3">
      {/* 홈 예산 패널과 같은 짜임 — 큰 숫자 + "N만원 중 남음" + 같은 막대 */}
      <div>
        <div className="font-user-content text-[26px] font-bold leading-none tracking-[-0.03em] text-[#1b0d14]">
          {remainingBudget.toLocaleString("ko-KR")}만원
        </div>
        <div className="mt-1.5 text-[12.5px] text-gray-400">
          {budget.toLocaleString("ko-KR")}만원 중 남음
        </div>
      </div>
      {/*
      홈 예산 패널과 같은 뜻으로 읽히게 한다 — 분홍은 실제로 나간 돈,
      회색은 아직 안 쓴 예정, 남은 트랙이 여유다. 예전에는 분홍이 "남은
      비율"이라 아무것도 안 썼을 때 막대가 꽉 차 보였다.
    */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#f4eff2]">
        <i
          className="block h-full shrink-0 bg-gradient-to-r from-[#ff7ab5] to-[#ee2b8c] transition-all duration-1000"
          style={{ width: `${usedPercent * barScale}%` }}
        />
        {plannedUseAmount > 0 && (
          <i
            className="block h-full shrink-0 bg-[#cdbfc7] transition-all duration-1000"
            style={{ width: `${plannedPercent * barScale}%`, minWidth: 4 }}
          />
        )}
      </div>
      {plannedUseAmount > 0 && (
        <p className="flex items-center gap-1.5 text-[12px] text-gray-400">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
            style={{ background: "#cdbfc7" }}
          />
          사용 예상 {plannedUseAmount.toLocaleString("ko-KR")}만원
        </p>
      )}
    </div>
  );
};

const PlanListPageContent: React.FC<PlanListPageProps> = ({ onSelectPlan }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const { fetchWithAuth, setLoading: setGlobalLoading } = useApi();
  const {
    subscribeToChatRooms,
    unreadCount,
    updateUnreadCount,
    updateRoomUnreadCount,
    getRoomUnreadCount,
  } = useNotification();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalTitle, setLoginModalTitle] = useState(
    "세션이 만료되었습니다. 다시 로그인해 주세요.",
  );

  // Guide State
  const [showGuide, setShowGuide] = useState(false);
  const [hasSeenChatGuide, setHasSeenChatGuide] = useState<boolean | null>(
    null,
  );

  const fetchPlans = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoginModalTitle("참여 플랜 리스트를 보려면 로그인이 필요합니다.");
      setShowLoginModal(true);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 400));

      const userRes = await fetchWithAuth("/plan/user", { skipLoading: true });
      // 401 은 ApiContext 가 공통 처리한다(토큰 정리 + 복귀 경로 저장 +
      // 재로그인 안내). 예전에는 여기서 따로 처리하느라 복귀 경로가
      // 저장되지 않아, 다시 로그인해도 /plan-list 로 돌아오지 못했다.
      if (userRes.status === 401) {
        setListLoading(false);
        return;
      }
      const userJson = await userRes.json();
      if (userJson.result && userJson.data) {
        if (!userJson.data.name) {
          router.replace("/setting");
          return;
        }
        // Save guide seen status from API if available
        setHasSeenChatGuide(userJson.data.hasSeenChatGuide ?? null);
      }

      const res = await fetchWithAuth("/plan/room/list", {
        skipLoading: true,
      });
      if (res.status === 401) {
        setListLoading(false);
        return;
      }
      const json = await res.json();
      if (json.result && json.data?.list) {
        setPlans(json.data.list);

        // SSE Subscription
        const roomIds: number[] = json.data.list.flatMap((plan: Plan) =>
          (plan.chatRooms || []).map((room) => room.id),
        );
        if (roomIds.length > 0) {
          subscribeToChatRooms(roomIds);

          // 총 및 개별 읽지 않은 메시지 수 조회
          let totalUnread = 0;
          await Promise.all(
            roomIds.map(async (rid) => {
              try {
                const countRes = await fetchWithAuth(
                  `/plan/chat/message/count/${rid}`,
                  { skipLoading: true },
                );
                if (countRes.ok) {
                  const countJson = await countRes.json();
                  if (countJson.result) {
                    const c = countJson.data.count || 0;
                    updateRoomUnreadCount(rid, c);
                    totalUnread += c;
                  }
                }
              } catch (err) {
                console.error(`Failed to fetch count for room ${rid}:`, err);
              }
            }),
          );
          updateUnreadCount(totalUnread);
        }
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setListLoading(false);
    }
  }, [
    fetchWithAuth,
    router,
    subscribeToChatRooms,
    updateRoomUnreadCount,
    updateUnreadCount,
  ]);

  useEffect(() => {
    // Disable global loading modal for plan-list to show skeleton instead
    setGlobalLoading(false);
    fetchPlans();
  }, [fetchPlans, setGlobalLoading]);

  // Guide Auto-show
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkGuide = async () => {
      let seen = false;
      if (getToken()) {
        if (hasSeenChatGuide === null) return; // Wait for API
        seen = hasSeenChatGuide === true;
      } else {
        seen = localStorage.getItem("hasSeenChatGuide") === "true";
      }

      if (!seen && plans.length > 0) {
        const timer = setTimeout(() => setShowGuide(true), 1000);
        return () => clearTimeout(timer);
      }
    };
    checkGuide();
  }, [hasSeenChatGuide, plans.length]);

  const handleCloseGuide = useCallback(async () => {
    setShowGuide(false);
    setHasSeenChatGuide(true);
    if (getToken()) {
      try {
        await fetchWithAuth("/plan/user/has-seen-chat-guide", {
          method: "POST",
          skipLoading: true,
        });
      } catch {
        // Silently fail if endpoint doesn't exist
      }
    } else {
      localStorage.setItem("hasSeenChatGuide", "true");
    }
  }, [fetchWithAuth]);

  const guideSteps: GuideStep[] = [
    {
      id: "plan-list-header",
      title: "참여 플랜 리스트",
      description: "함께 만들고 가꾸는 소중한 웨딩 플랜들이 모여있는 곳이에요.",
    },
    {
      id: "plan-card-0",
      title: "웨딩 플랜 카드",
      description:
        "결혼식 날짜, 남은 예산, 그리고 참여 중인 멤버를 한눈에 볼 수 있습니다.",
    },
    {
      id: "plan-channels-0",
      title: "채팅 리스트",
      description:
        "플랜별로 생성된 채팅방 리스트입니다. 클릭하여 바로 대화를 시작할 수 있어요.",
    },
  ];

  const handleSelectPlan = (id: number) => {
    if (onSelectPlan) {
      onSelectPlan(id);
    } else {
      router.push(`/main?roomId=${id}`);
    }
  };

  /** ≥1024 에서 우측 pane 에 열어 둔 채팅방. 새로고침·링크 공유에도 복원된다 */
  const selectedChatRoomId = searchParams.get("chat")?.trim() || null;

  const handleChatRoomClick = useCallback(
    (chatRoomId: number) => {
      // 좁은 화면에서는 지금과 똑같이 채팅 라우트로 이동한다.
      if (!isDesktop) {
        router.push(`/chat/${chatRoomId}`);
        return;
      }
      // 넓은 화면에서는 페이지 이동 없이 옆 pane 에서 연다.
      router.replace(`/plan-list?chat=${chatRoomId}`, { scroll: false });
    },
    [isDesktop, router],
  );

  // 데스크톱에서 대화를 보다가 창을 좁히면 pane 이 사라진다.
  // 보던 대화를 잃지 않도록 채팅 라우트로 승격시킨다.
  //
  // isDesktop 대신 matchMedia 를 직접 읽는다. 훅은 서버 스냅샷이 false 라
  // 하이드레이션 직후 한 번 false 로 렌더되는데, 그 타이밍에 이 이펙트가
  // 돌면 데스크톱에서도 채팅 라우트로 튕겨 나간다.
  useEffect(() => {
    if (!selectedChatRoomId) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    router.replace(`/chat/${selectedChatRoomId}`);
  }, [selectedChatRoomId, isDesktop, router]);

  return (
    <AppShell
      activeTab="rooms"
      activeRailView="rooms"
      unreadCount={unreadCount}
      gridBackground
      /*
        남는 폭은 대화가 가져간다. 목록은 카드 두 줄이면 충분해서 780px 에서
        멈추고, 그 위로는 전부 채팅에 준다 — 넓은 화면에서 읽는 쪽은 대화다.
        기본값(372/420px)은 목록을 폰 폭에 묶어 둬서 카드가 한 줄만 보였다.
      */
      masterWidthClassName="lg:flex-1 lg:max-w-[780px]"
      detail={
        selectedChatRoomId ? (
          // key 로 방마다 새로 마운트한다. ChatRoomView 는 초기 로드 여부를
          // ref 로 기억해서, 같은 인스턴스를 재사용하면 새 방의 히스토리를
          // 불러오지 않는다.
          <ChatRoomView
            key={selectedChatRoomId}
            chatRoomId={selectedChatRoomId}
            variant="pane"
          />
        ) : null
      }
      detailEmpty={
        <div className="flex h-full flex-col items-center justify-center gap-3 px-10 text-center">
          <MessageCircle
            className="h-10 w-10 text-stone-200"
            strokeWidth={1.5}
          />
          <b className="text-[15px] font-bold text-stone-500">
            대화를 선택하세요
          </b>
          <span className="max-w-[260px] text-[13px] leading-relaxed text-gray-400">
            왼쪽 플랜 카드의 채팅방을 누르면 이 자리에서 바로 열립니다.
          </span>
        </div>
      }
    >
      <div className="absolute top-[-5%] right-[-10%] w-64 h-64 bg-[#ee2b8c0a] rounded-full blur-3xl pointer-events-none" />

      {/* >=768 은 대시보드와 같은 머리글 띠. <768 은 지금 그대로다 */}
      <header className="pt-12 px-6 mb-10 relative z-10 flex justify-between items-end shrink-0 md:mb-0 md:items-center md:border-b md:border-stone-100 md:bg-white md:px-8 md:py-5 lg:mb-0 lg:px-8 lg:py-5">
        <div id="plan-list-header">
          <h2 className="text-4xl font-black text-[#1b0d14] tracking-tight md:text-[26px] md:font-semibold lg:text-[26px]">
            참여 플랜 리스트
          </h2>
          <p className="text-gray-400 font-bold text-sm mt-2 md:mt-1.5 md:text-[13px] md:font-normal md:text-[#7a6c74]">
            함께 가꾸는 소중한 결혼 준비 계획들
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center text-stone-400 hover:text-stone-600 transition-colors md:h-10 md:w-10"
          aria-label="가이드 보기"
        >
          <CircleHelp className="h-6 w-6" strokeWidth={2} />
        </button>
      </header>

      {/*
        @container: 카드 열 수를 뷰포트가 아니라 목록이 실제로 차지한 폭으로
        정한다. 오른쪽 대화 pane 이 400~520px 를 가져가므로 뷰포트만 보면
        늘 한 칸씩 어긋난다.
      */}
      <div className="@container flex-1 min-h-0 px-6 pb-24 relative z-10 overflow-y-auto no-scrollbar md:px-8 md:pb-8 md:pt-6 lg:px-8">
        <div className="space-y-6 md:grid md:grid-cols-1 md:gap-6 md:space-y-0 md:content-start @[680px]:md:grid-cols-2 @[1060px]:md:grid-cols-3">
          {listLoading ? (
            <div className="space-y-6 md:col-span-full md:grid md:grid-cols-1 md:gap-6 md:space-y-0 @[680px]:md:grid-cols-2 @[1060px]:md:grid-cols-3">
              {/* Skeleton Cards */}
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="w-full bg-white rounded-[32px] p-6 border border-[#ee2b8c05] shadow-sm relative overflow-hidden animate-pulse"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-2">
                      <div className="w-20 h-4 bg-stone-50 rounded-full" />
                      <div className="w-40 h-8 bg-stone-50 rounded-xl" />
                    </div>
                    <div className="w-10 h-10 bg-stone-50 rounded-2xl" />
                  </div>
                  <div className="space-y-3 mb-6">
                    <div className="w-12 h-3 bg-stone-50 rounded-full" />
                    <div className="flex gap-2">
                      <div className="w-10 h-10 rounded-full bg-stone-50" />
                      <div className="w-10 h-10 rounded-full bg-stone-50" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between mb-1">
                      <div className="w-24 h-3 bg-stone-50 rounded-full" />
                    </div>
                    <div className="w-full h-2 bg-stone-50 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20 text-gray-400 md:col-span-2">
              <p>참여 중인 플랜이 없습니다.</p>
            </div>
          ) : (
            plans.map((plan, index) => {
              // 예산 0이면 나눗셈이 Infinity/NaN이 되고, 무효 CSS width는
              // auto로 떨어져 막대가 꽉 찬 것처럼 보인다. 0~100으로 고정한다.
              const pct = (v: number) => {
                if (!(plan.budget > 0)) return 0;
                const raw = (v / plan.budget) * 100;
                return Number.isFinite(raw)
                  ? Math.min(100, Math.max(0, raw))
                  : 0;
              };
              const plannedUseAmount = plan.plannedUseAmount ?? 0;
              // remainingBudget = budget - (예정 + 사용) 이므로
              // 실제로 나간 돈은 그 차에서 예정을 뺀 값이다.
              const usedAmount =
                plan.budget - plan.remainingBudget - plannedUseAmount;
              const usedPercent = pct(Math.max(0, usedAmount));
              const plannedPercent = pct(plannedUseAmount);
              const isFirst = index === 0;

              return (
                <div
                  key={plan.roomId}
                  id={isFirst ? "plan-card-0" : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectPlan(plan.roomId)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    handleSelectPlan(plan.roomId);
                  }}
                  className="group/card w-full cursor-pointer rounded-[32px] border border-[#ee2b8c0a] bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-[#ee2b8c11] active:bg-[#fffafc] md:rounded-[28px] md:border-[#ee2b8c0f]"
                >
                  <CardHeader
                    ownerName={plan.onwerName}
                    weddingDate={plan.weddingDate}
                    members={plan.members}
                  />
                  <CardBudget
                    remainingBudget={plan.remainingBudget}
                    budget={plan.budget}
                    usedPercent={usedPercent}
                    plannedPercent={plannedPercent}
                    plannedUseAmount={plannedUseAmount}
                  />
                  {/*
                    가이드 앵커라 방이 없어도 이 div 는 남긴다
                    (GuideOverlay 가 이 rect 로 말풍선 좌표를 잡는다).
                  */}
                  <div id={isFirst ? "plan-channels-0" : undefined}>
                    {(plan.chatRooms?.length ?? 0) > 0 && (
                      <hr className="my-5 border-0 border-t border-dashed border-[#f2eaee]" />
                    )}
                    <CardChatRooms
                      chatRooms={plan.chatRooms || []}
                      onChatRoomClick={handleChatRoomClick}
                      getRoomUnreadCount={getRoomUnreadCount}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <LoginRequiredModal
        show={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          router.replace("/");
        }}
        title={loginModalTitle}
      />

      <GuideOverlay
        isOpen={showGuide}
        onClose={handleCloseGuide}
        steps={guideSteps}
      />
    </AppShell>
  );
};

// useSearchParams 는 Suspense 경계가 필요하다 (main·add-plen·budget-detail 과
// 같은 패턴).
const PlanListPage: React.FC<PlanListPageProps> = ({ onSelectPlan }) => (
  <Suspense fallback={<div className="h-[100dvh] bg-[#fcfbfc]" />}>
    <PlanListPageContent onSelectPlan={onSelectPlan} />
  </Suspense>
);

export default PlanListPage;
