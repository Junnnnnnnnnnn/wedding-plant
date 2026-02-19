"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getToken, setShareAfterLogin, clearToken } from "@/lib/api";
import { useApi } from "@/app/contexts/ApiContext";
import LoginRequiredModal from "@/app/components/LoginRequiredModal";

export default function SharePage() {
  const router = useRouter();
  const params = useParams();
  const shareCode = params.shareCode as string;
  const { fetchWithAuth } = useApi();
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (!shareCode) return;

    const token = getToken();
    if (!token) {
      // 로그인 안됨 -> shareCode 저장하고 모달 표시
      setShareAfterLogin(shareCode);
      setShowLoginModal(true);
      return;
    }

    // 로그인 됨 -> 방 참여 API 호출 후 /plan-list 이동
    const joinRoom = async () => {
      try {
        const res = await fetchWithAuth(`/plan/room/${shareCode}`, {
          method: "POST",
        });
        if (res.status === 401) {
          // 토큰 만료 등: 비로그인과 동일하게 모달 표시
          clearToken();
          setShareAfterLogin(shareCode);
          setShowLoginModal(true);
          return;
        }
        if (res.ok) {
          router.replace("/plan-list");
        }
      } catch (err) {
        console.error("Failed to join room:", err);
      }
    };

    joinRoom();
  }, [shareCode, fetchWithAuth, router]);

  const handleCloseModal = () => {
    setShowLoginModal(false);
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-[#fcfbfc] flex items-center justify-center">
      {/* 로딩 표시 또는 배경 레이아웃 */}
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#ee2b8c] border-t-transparent animate-spin" />
        <p className="text-gray-400 font-bold text-sm">공유 플랜 연결 중...</p>
      </div>

      <LoginRequiredModal
        show={showLoginModal}
        onClose={handleCloseModal}
        title="공유 플랜을 보려면 로그인해 주세요"
      />
    </div>
  );
}
