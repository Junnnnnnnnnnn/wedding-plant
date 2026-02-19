"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ClipboardList,
  Calendar,
  ArrowRight,
  Heart,
  User,
  Crown,
  Pencil,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Plan } from "@/types";
import { useApi } from "../contexts/ApiContext";
import { getToken, clearToken } from "@/lib/api";
import BottomTabBar from "../components/BottomTabBar";
import LoginRequiredModal from "../components/LoginRequiredModal";
import NameInputModal from "../components/NameInputModal";

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
  const [showNameModal, setShowNameModal] = useState(false);

  const fetchPlans = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetchWithAuth("/plan/room/list");
      if (res.status === 401) {
        clearToken();
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
    // Check user name first
    const checkUserName = async () => {
      if (!getToken()) {
        fetchPlans();
        return;
      }
      try {
        const res = await fetchWithAuth("/plan/user");
        const json = (await res.json()) as {
          result?: boolean;
          data?: { name?: string | null };
        };
        if (
          json.result === true &&
          json.data &&
          (!json.data.name || !json.data.name.trim())
        ) {
          setLoading(false);
          setShowNameModal(true);
          return; // don't fetch plans yet
        }
      } catch {
        // ignore, proceed with plan fetch
      }
      fetchPlans();
    };
    checkUserName();
  }, [fetchPlans, fetchWithAuth]);

  const handleNameComplete = useCallback(() => {
    setShowNameModal(false);
    setLoading(true);
    fetchPlans();
  }, [fetchPlans]);

  const handleSelectPlan = (id: number) => {
    if (onSelectPlan) {
      onSelectPlan(id);
    } else {
      router.push(`/main?roomId=${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbfc]">
      <div className="min-h-screen max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col grid-bg z-10 pb-24">
        {/* Decorative background blur */}
        <div className="absolute top-[-5%] right-[-10%] w-64 h-64 bg-[#ee2b8c0a] rounded-full blur-3xl pointer-events-none" />

        <header className="pt-12 px-6 mb-10 relative z-10">
          <h2 className="text-4xl font-black text-[#1b0d14] tracking-tight">
            참여 플랜 리스트
          </h2>
          <p className="text-gray-400 font-bold text-sm mt-2">
            함께 가꾸는 소중한 결혼 준비 계획들
          </p>
        </header>

        <div className="flex-1 px-6 space-y-6 relative z-10 overflow-y-auto no-scrollbar">
          {loading ? null : plans.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p>참여 중인 플랜이 없습니다.</p>
            </div>
          ) : (
            plans.map((plan, index) => {
              const progress = (plan.remainingBudget / plan.budget) * 100;
              return (
                <button
                  key={plan.roomId}
                  onClick={() => handleSelectPlan(plan.roomId)}
                  className="w-full text-left bg-white rounded-[32px] p-6 border border-[#ee2b8c0a] shadow-sm shadow-[#ee2b8c05] hover:shadow-xl hover:shadow-[#ee2b8c11] transition-all transform active:scale-[0.98] group relative overflow-hidden"
                >
                  {/* Subtle hover decoration */}
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
                  <div className="mb-6">
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
                          {String(member.permission ?? "").toUpperCase() ===
                            "OWNER" && (
                              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-amber-900 shadow-sm">
                                <Crown
                                  className="w-2.5 h-2.5"
                                  strokeWidth={2.5}
                                />
                              </span>
                            )}
                          {String(member.permission ?? "").toUpperCase() ===
                            "WRITE" && (
                              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-slate-500 text-white shadow-sm">
                                <Pencil
                                  className="w-2.5 h-2.5"
                                  strokeWidth={2.5}
                                />
                              </span>
                            )}

                          <div
                            className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white text-sm font-black shadow-sm overflow-hidden"
                            style={{
                              background: member.image
                                ? undefined
                                : AVATAR_GRADIENTS[
                                idx % AVATAR_GRADIENTS.length
                                ],
                            }}
                          >
                            {member.image ? (
                              <img
                                src={member.image}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>
                                {member.name?.trim().charAt(0)?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          {/* Name Tooltip (Optional, matching main page style if needed, but main page just shows image) */}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-bold">
                        {plan.weddingDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <ClipboardList className="w-4 h-4" />
                      <span className="text-xs font-bold">
                        {plan.planCount}개의 계획
                      </span>
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
                </button>
              );
            })
          )}
        </div>

        <BottomTabBar />

        <LoginRequiredModal
          show={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title="세션이 만료되었습니다. 다시 로그인해 주세요."
        />
        <NameInputModal show={showNameModal} onComplete={handleNameComplete} />
      </div>
    </div>
  );
};

export default PlanListPage;
