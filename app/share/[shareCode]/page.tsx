"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getToken, setShareAfterLogin, clearToken } from "@/lib/api";
import { useApi } from "@/app/contexts/ApiContext";
import LoginRequiredModal from "@/app/components/LoginRequiredModal";

const joinedCodes = new Set<string>();

export default function SharePage() {
  const router = useRouter();
  const params = useParams();
  const shareCode = params.shareCode as string;
  const { fetchWithAuth } = useApi();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!shareCode) return;

    const token = getToken();
    if (!token) {
      setShareAfterLogin(shareCode);
      setShowLoginModal(true);
      return;
    }

    if (joinedCodes.has(shareCode)) return;
    joinedCodes.add(shareCode);

    abortControllerRef.current = new AbortController();

    const joinRoom = async () => {
      try {
        const res = await fetchWithAuth(`/plan/room/${shareCode}`, {
          method: "POST",
          signal: abortControllerRef.current?.signal,
        });
        if (res.status === 401) {
          clearToken();
          setShareAfterLogin(shareCode);
          setShowLoginModal(true);
          joinedCodes.delete(shareCode);
          return;
        }
        if (res.ok) {
          router.replace("/plan-list");
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to join room:", err);
          joinedCodes.delete(shareCode);
        }
      }
    };

    joinRoom();

    return () => {
      abortControllerRef.current?.abort();
    };
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
