"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { MessageCircle, CircleHelp } from "lucide-react";
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

/**
 * 참여 플랜 카드 — 홈 대시보드와 같은 시각 언어.
 *
 * 이름·날짜 → 예산 → 대화 순으로 읽는다. 예전에는 10px 회색 대문자 라벨
 * (MEMBERS/CHANNELS)과 검정 "플랜 N" 알약이 제목보다 먼저 눈에 들어와
 * 정작 중요한 남은 예산이 카드 맨 아래에서 묻혔다.
 */

/**
 * 시안(C안 03)의 멤버 색. 브랜드 → 잉크 → 초록 → 파랑 순으로 돌린다.
 * 회색 하나로 통일했더니 얼굴이 배경에 묻혀 몇 명인지 안 읽혔다.
 */
const MEMBER_COLORS = ["#fa6bad", "#2a3038", "#079171", "#217cf9"];

/** 겹쳐 놓은 참여 멤버 얼굴. 방장에게만 왕관을 얹지 않는다 */
const MemberAvatars: React.FC<{ members: Member[] }> = ({ members }) => {
  // 같은 파일에서 chatRooms 는 `|| []` 로 방어하면서 members 는 안 하고 있었다.
  // 백엔드가 이 필드를 생략하면 목록 전체가 흰 화면이 된다.
  const list = Array.isArray(members) ? members : [];
  return (
    <div className="flex items-center -space-x-[7px]">
      {list.slice(0, 4).map((member, idx) => (
        <div
          key={member.planUserId}
          className="relative flex-shrink-0"
          style={{ zIndex: list.length - idx }}
        >
          {/*
            시안(C안 03)의 아바타다 — **24px.** 예전에는 32px 에 멤버마다 다른
            그라데이션이고 방장에게 왕관까지 얹혀서, 카드에서 제목보다 얼굴이
            먼저 읽혔다. 누가 방장인지는 멤버 목록(공유 모달)이 말한다.
          */}
          <div
            className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-[#f7f8f9] text-[10px] font-bold text-white"
            style={{
              background: member.image
                ? undefined
                : MEMBER_COLORS[idx % MEMBER_COLORS.length],
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
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#f7f8f9] bg-[#eeeff1] text-[9px] font-bold text-[#868b94]">
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
    <div className="mb-4">
      {/*
        시안(C안 03)의 머리다. 아바타를 **제목 오른쪽**에 붙여 한 줄을
        벌었다 — 예전에는 제목이 "김지수의 웨딩 / 플랜" 으로 끊겼다.
        화살표 원은 없앴다: 카드 전체가 이미 버튼이라 같은 말을 두 번 한다.
      */}
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-[-0.02em] text-[#1a1c20] md:text-[19px]">
          {ownerName}의 웨딩 플랜
        </h3>
        <div className="shrink-0">
          <MemberAvatars members={members} />
        </div>
      </div>
      {dateLine && (
        <p className="mt-1.5 text-[13px] text-[#555d6d]">{dateLine}</p>
      )}
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
      {/* 시안 .plan__chl — 12px, subtle */}
      <p className="mb-2 text-[12px] text-[#868b94]">대화 {rooms.length}</p>
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
            /* 카드가 회색 채움이 되었으므로 그 안의 줄은 흰 바탕으로 뜬다 */
            className="group/chat-item flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2.5 transition-colors hover:bg-[#fff1f7]"
          >
            {/*
              시안(C안 03)의 `.ch` 다 — **이름 · 커플 배지 · 미읽음 수** 셋뿐이다.
              말풍선 아이콘 타일과 멤버 얼굴을 같이 두면 줄마다 같은 것이
              반복돼, 정작 다른 값인 방 이름이 가장 늦게 읽혔다.
            */}
            <span className="min-w-0 truncate text-[14px] font-medium text-[#1a1c20]">
              {chatRoom.name}
            </span>
            {chatRoom.isCouple && <CoupleChatBadge size="sm" />}
            {getRoomUnreadCount(chatRoom.id) > 0 && (
              <span className="ml-auto grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-[#ee2b8c] px-[5px] text-[10px] font-bold text-white">
                {getRoomUnreadCount(chatRoom.id) > 99
                  ? "99+"
                  : getRoomUnreadCount(chatRoom.id)}
              </span>
            )}
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
        {/*
          시안(C안 03)은 숫자 26px · 단위 14px 로 **크기 대비**를 준다.
          같은 크기로 두면 "만 원" 이 숫자만큼 무거워져 금액이 덜 읽힌다.
        */}
        <div className="font-user-content text-[26px] font-bold leading-none tracking-[-0.04em] text-[#1a1c20]">
          {remainingBudget.toLocaleString("ko-KR")}
          <span className="text-[14px]">만 원</span>
        </div>
        {/*
          시안에서 잰 값이 26px 이다(큰 숫자가 <p> 라 브라우저 기본 마진이
          붙어 있었다). 6px 로 붙이면 캡션이 숫자에 딸려 붙어 한 덩어리로
          읽힌다 — 금액이 이 카드의 주인공이라 숨을 줘야 한다.
        */}
        <div className="mt-[26px] text-[13px] text-[#555d6d]">
          {budget.toLocaleString("ko-KR")}만 원 중 남음
        </div>
      </div>
      {/*
      홈 예산 패널과 같은 뜻으로 읽히게 한다 — 분홍은 실제로 나간 돈,
      회색은 아직 안 쓴 예정, 남은 트랙이 여유다. 예전에는 분홍이 "남은
      비율"이라 아무것도 안 썼을 때 막대가 꽉 차 보였다.
    */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#f4eff2]">
        <i
          className="block h-full shrink-0 bg-[#ee2b8c] transition-all duration-1000"
          style={{ width: `${usedPercent * barScale}%` }}
        />
        {plannedUseAmount > 0 && (
          <i
            className="block h-full shrink-0 bg-[#d1d3d8] transition-all duration-1000"
            style={{ width: `${plannedPercent * barScale}%`, minWidth: 4 }}
          />
        )}
      </div>
      {/*
        "사용 예상 N만원" 범례 줄은 없앴다(시안 C안 03). 막대의 회색 구간이
        이미 그 말을 하고 있고, 카드마다 한 줄씩 붙어 세로만 늘렸다.
      */}
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
      {/*
        폰은 **분홍 머리 면**, ≥768 은 대시보드와 같은 흰 머리글 띠.

        예전 폰 머리글은 36px 제목 + 부제로 210px 를 썼고, 그래서 카드가 첫
        화면에 한 장 반만 보였다. 면으로 올리면 두 장이 들어온다. 부제는
        화면이 뭘 하는지 제목이 이미 말하고 있어 **플랜 수 · 대화 수**로 바꾼다.

        가이드 앵커 `#plan-list-header` 는 그대로 둔다 — 말풍선 좌표를 이
        rect 로 잡는다.
      */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 rounded-b-[24px] bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-6 pb-5 pt-12 md:mb-0 md:rounded-none md:border-b md:border-stone-100 md:bg-white md:bg-none md:px-8 md:py-5">
        <div id="plan-list-header" className="min-w-0">
          {/* 시안 .c-head__title 18px bold · .c-head__sub 14px 보통 굵기 */}
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-white md:text-[26px] md:font-semibold md:text-[#1b0d14]">
            참여 플랜
          </h2>
          <p className="mt-2 text-[14px] font-normal text-white/80 md:mt-1.5 md:text-[13px] md:text-[#7a6c74]">
            <span className="md:hidden">
              함께 준비하는 플랜 {plans.length}개
            </span>
            <span className="hidden md:inline">
              함께 가꾸는 소중한 결혼 준비 계획들
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center text-white transition-colors hover:text-white/70 md:h-10 md:w-10 md:text-stone-400 md:hover:text-stone-600"
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
      <div className="@container relative z-10 min-h-0 flex-1 overflow-y-auto no-scrollbar px-6 pb-24 pt-5 md:px-8 md:pb-8 md:pt-6 lg:px-8">
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
                  /*
                    시안(C안 03)의 카드다. 폰은 SEED 채움(`layer-fill`) +
                    r5(20px), 그림자 없음 — 그림자는 떠 있는 것에만 쓴다.
                    ≥768 은 대시보드 카드 언어(흰 카드 + 헤어라인)를 유지한다.

                    `transform`(active:scale)은 붙이지 않는다 — 안쪽 채팅방
                    줄을 누를 때 카드까지 같이 줄어든다. 누른 느낌은 배경색으로.
                  */
                  className="group/card w-full cursor-pointer rounded-[20px] bg-[#f7f8f9] p-5 transition-colors active:bg-[#eeeff1] md:rounded-[28px] md:border md:border-[#ee2b8c0f] md:bg-white md:p-6 md:shadow-sm md:transition-all md:hover:shadow-xl md:hover:shadow-[#ee2b8c11] md:active:bg-[#fffafc]"
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
                      <hr className="my-5 border-0 border-t border-[#0000000c] md:border-dashed md:border-[#f2eaee]" />
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
          /*
           * 홈으로 돌린다. 예전에는 랜딩("/")으로 보내서, 셸 안에서 탭을
           * 눌러 들어온 사람이 닫기 한 번에 내비게이션도 없는 로그인 전
           * 화면까지 튕겨 나갔다.
           * 온보딩을 안 끝낸 게스트를 어디로 보낼지는 /main 이 자기 게이트에서
           * 정한다 — 그 규칙을 여기에 또 적으면 두 곳이 어긋난다.
           */
          router.replace("/main");
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
