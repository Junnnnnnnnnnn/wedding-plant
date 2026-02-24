"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  MessageCircle,
  ClipboardList,
  Calendar,
  ArrowRight,
  Heart,
  Crown,
  Pencil,
  Plus,
  CircleHelp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Plan, ChatRoom } from "@/types";
import { useApi } from "../contexts/ApiContext";
import { getToken, clearToken } from "@/lib/api";
import BottomTabBar from "../components/BottomTabBar";
import LoginRequiredModal from "../components/LoginRequiredModal";
import ChatRoomCreateModal from "../components/ChatRoomCreateModal";
import GuideOverlay, { GuideStep } from "../components/GuideOverlay";

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

const PlanListPage: React.FC<PlanListPageProps> = ({ onSelectPlan }) => {
  const router = useRouter();
  const { fetchWithAuth } = useApi();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalTitle, setLoginModalTitle] = useState("세션이 만료되었습니다. 다시 로그인해 주세요.");
  const [showChatCreateModal, setShowChatCreateModal] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // Guide State
  const [showGuide, setShowGuide] = useState(false);
  const [hasSeenChatGuide, setHasSeenChatGuide] = useState<boolean | null>(null);

  const fetchPlans = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoginModalTitle("참여 플랜 리스트를 보려면 로그인이 필요합니다.");
      setShowLoginModal(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 100));

      const userRes = await fetchWithAuth("/plan/user");
      if (userRes.status === 401) {
        clearToken();
        setLoginModalTitle("세션이 만료되었습니다. 다시 로그인해 주세요.");
        setShowLoginModal(true);
        setLoading(false);
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

      const res = await fetchWithAuth("/plan/room/list");
      if (res.status === 401) {
        clearToken();
        setLoginModalTitle("세션이 만료되었습니다. 다시 로그인해 주세요.");
        setShowLoginModal(true);
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (json.result && json.data?.list) {
        setPlans(json.data.list);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

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
      description: "결혼식 날짜, 남은 예산, 그리고 참여 중인 멤버를 한눈에 볼 수 있습니다.",
    },
    {
      id: "plan-members-0",
      title: "참여 멤버",
      description: "플랜에 함께하고 있는 소중한 사람들을 확인해 보세요.",
    },
    {
      id: "plan-channels-0",
      title: "채팅 채널",
      description: "플랜별 전용 채팅방입니다. 클릭하여 바로 대화를 시작할 수 있어요.",
    },
    {
      id: "add-chat-button-0",
      title: "새 채팅방 추가",
      description: "용도에 맞는 새로운 채팅방이 필요하다면 여기서 바로 추가해 보세요!",
    },
  ];

  const handleSelectPlan = (id: number) => {
    if (onSelectPlan) {
      onSelectPlan(id);
    } else {
      router.push(`/main?roomId=${id}`);
    }
  };

  const openChatCreateModal = (e: React.MouseEvent, roomId: number) => {
    e.stopPropagation();
    setSelectedRoomId(roomId);
    setShowChatCreateModal(true);
  };

  return (
    <div className="min-h-screen bg-[#fcfbfc]">
      <div className="min-h-screen max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col grid-bg z-10 pb-24">
        <div className="absolute top-[-5%] right-[-10%] w-64 h-64 bg-[#ee2b8c0a] rounded-full blur-3xl pointer-events-none" />

        <header className="pt-12 px-6 mb-10 relative z-10 flex justify-between items-end">
          <div id="plan-list-header">
            <h2 className="text-4xl font-black text-[#1b0d14] tracking-tight">
              참여 플랜 리스트
            </h2>
            <p className="text-gray-400 font-bold text-sm mt-2">
              함께 가꾸는 소중한 결혼 준비 계획들
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="가이드 보기"
          >
            <CircleHelp className="h-6 w-6" strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 px-6 space-y-6 relative z-10 overflow-y-auto no-scrollbar">
          {loading ? null : plans.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p>참여 중인 플랜이 없습니다.</p>
            </div>
          ) : (
            plans.map((plan, index) => {
              const progress = (plan.remainingBudget / plan.budget) * 100;
              const isFirst = index === 0;
              return (
                <div
                  key={plan.roomId}
                  id={isFirst ? "plan-card-0" : undefined}
                  onClick={() => handleSelectPlan(plan.roomId)}
                  className="w-full text-left bg-white rounded-[32px] p-6 border border-[#ee2b8c0a] shadow-sm shadow-[#ee2b8c05] transition-all transform relative overflow-hidden cursor-pointer group hover:shadow-xl hover:shadow-[#ee2b8c11] active:scale-[0.98]"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ee2b8c05] to-transparent rounded-bl-full group-hover:bg-[#ee2b8c0a] transition-colors" />

                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#1b0d14] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                          Room #{index + 1}
                        </span>
                        <span className="text-[#ee2b8c]">
                          <Heart className="w-3 h-3 fill-current" />
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-[#1b0d14]">
                        {plan.onwerName}의 웨딩 플랜
                      </h3>
                    </div>
                    <div className="w-10 h-10 bg-[#ee2b8c11] rounded-2xl flex items-center justify-center text-[#ee2b8c] group-hover:bg-[#ee2b8c] group-hover:text-white transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Members Section */}
                  <div className="mb-6" id={isFirst ? "plan-members-0" : undefined}>
                    <p className="text-[10px] font-extrabold text-gray-300 uppercase tracking-widest mb-3">
                      참여 멤버
                    </p>
                    <div className="flex items-center -space-x-2">
                      {plan.members.map((member, idx) => (
                        <div
                          key={member.planUserId}
                          className="relative flex-shrink-0"
                          style={{ zIndex: plan.members.length - idx }}
                        >
                          {String(member.permission ?? "").toUpperCase() === "OWNER" && (
                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-amber-900 shadow-sm">
                              <Crown className="w-2.5 h-2.5" strokeWidth={2.5} />
                            </span>
                          )}
                          <div
                            className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-black shadow-sm overflow-hidden"
                            style={{
                              background: member.image
                                ? undefined
                                : AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
                            }}
                          >
                            {member.image ? (
                              <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{member.name?.trim().charAt(0)?.toUpperCase()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chat Rooms Section */}
                  <div className="mt-2 mb-6 space-y-2" id={isFirst ? "plan-channels-0" : undefined}>
                    <div className="grid grid-cols-1 gap-2">
                      {plan.chatRooms?.map((chatRoom) => (
                        <div
                          key={chatRoom.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/chat/${plan.roomId}?chatRoomId=${chatRoom.id}`);
                          }}
                          className="flex items-center justify-between p-3 bg-[#fcfbfc] hover:bg-white rounded-2xl transition-all border border-transparent hover:border-[#ee2b8c11] hover:shadow-md hover:shadow-[#ee2b8c0a] group/chat-item"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#ee2b8c0a] rounded-xl flex items-center justify-center text-[#ee2b8c] group-hover/chat-item:bg-[#ee2b8c] group-hover/chat-item:text-white transition-all">
                              <MessageCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-[#1b0d14]">
                                {chatRoom.name}
                              </h4>
                              <div className="flex items-center -space-x-1.5 mt-1">
                                {chatRoom.memberList.slice(0, 4).map((m, i) => (
                                  <div
                                    key={m.planUserId}
                                    className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[7px] font-black text-white overflow-hidden shadow-sm"
                                    style={{
                                      background: m.image
                                        ? undefined
                                        : AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                                    }}
                                  >
                                    {m.image ? (
                                      <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{m.name.charAt(0)}</span>
                                    )}
                                  </div>
                                ))}
                                {chatRoom.memberList.length > 4 && (
                                  <div className="w-5 h-5 rounded-full border border-white bg-stone-100 flex items-center justify-center text-[7px] font-black text-stone-400">
                                    +{chatRoom.memberList.length - 4}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-stone-300 group-hover/chat-item:text-[#ee2b8c] group-hover/chat-item:bg-[#ee2b8c0a] transition-all">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      ))}

                      {/* Add Chat Room Button */}
                      <button
                        id={isFirst ? "add-chat-button-0" : undefined}
                        onClick={(e) => openChatCreateModal(e, plan.roomId)}
                        className="flex items-center gap-3 p-3 bg-white border-2 border-dashed border-stone-100 rounded-2xl text-stone-300 hover:text-[#ee2b8c] hover:border-[#ee2b8c33] hover:bg-[#ee2b8c05] transition-all group/add-chat"
                      >
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center group-hover/add-chat:bg-[#ee2b8c11] transition-all">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold">새 채팅방 추가</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-bold">{plan.weddingDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <ClipboardList className="w-4 h-4" />
                      <span className="text-xs font-bold">{plan.planCount}개의 계획</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-extrabold text-gray-300 uppercase tracking-widest mb-1">
                          Remaining Budget
                        </p>
                        <p className="text-xl font-black text-[#1b0d14]">
                          {plan.remainingBudget.toLocaleString("ko-KR")}만 원
                        </p>
                      </div>
                      <p className="text-xs font-bold text-gray-400">
                        / {plan.budget.toLocaleString("ko-KR")}만 원
                      </p>
                    </div>
                    <div className="h-2 w-full bg-[#ee2b8c0a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#ee2b8c] to-[#ff94a1] rounded-full transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <BottomTabBar unreadCount={5} />

        <LoginRequiredModal
          show={showLoginModal}
          onClose={() => {
            setShowLoginModal(false);
            router.replace("/");
          }}
          title={loginModalTitle}
        />

        <ChatRoomCreateModal
          show={showChatCreateModal}
          roomId={selectedRoomId}
          onClose={() => setShowChatCreateModal(false)}
          onCreated={() => fetchPlans()}
        />

        <GuideOverlay
          isOpen={showGuide}
          onClose={handleCloseGuide}
          steps={guideSteps}
        />
      </div>
    </div>
  );
};

export default PlanListPage;
