"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getToken, setShareAfterLogin, clearToken } from "@/lib/api";
import { useApi } from "@/app/contexts/ApiContext";
import LoginRequiredModal from "@/app/components/LoginRequiredModal";

const joinedCodes = new Set<string>();

export default function SharePage() {
  const router = useRouter();
  const params = useParams();
  const shareCode = params.shareCode as string;
  /*
    초대 링크가 역할을 지닌다(`?as=spouse`). 로그인 전이면 코드와 함께
    저장해 두었다가 로그인 후 같은 역할로 참여시킨다 — 코드만 저장하면
    배우자로 초대받고도 함께 보는 사람으로 들어간다.
  */
  const searchParams = useSearchParams();
  const asRole = searchParams.get("as") === "spouse" ? "spouse" : null;
  const shareKey = asRole ? `${shareCode}?as=${asRole}` : shareCode;
  const { fetchWithAuth } = useApi();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCode) return;

    const token = getToken();
    if (!token) {
      setShareAfterLogin(shareKey);
      setShowLoginModal(true);
      return;
    }

    if (joinedCodes.has(shareKey)) return;
    joinedCodes.add(shareKey);

    const joinRoom = async () => {
      try {
        // 여기만은 공통 401 처리에 맡기지 않는다. 공유 코드를 다시
        // 저장해야(setShareAfterLogin) 재로그인 후 참여가 이어지고,
        // joinedCodes 에서도 빼 줘야 재시도가 가능하다. 공통 처리는
        // 복귀 경로만 저장하므로 이 둘을 대신하지 못한다.
        const res = await fetchWithAuth(
          `/plan/room/${shareCode}${asRole ? `?as=${asRole}` : ""}`,
          { method: "POST", skipAuthHandling: true },
        );
        if (res.status === 401) {
          clearToken();
          setShareAfterLogin(shareKey);
          setShowLoginModal(true);
          joinedCodes.delete(shareKey);
          return;
        }
        if (res.ok) {
          router.replace("/plan-list");
          return;
        }
        // 성공이 아니면 반드시 사용자에게 알린다.
        // (else가 없어 잘못된 코드·중복 참여·정원 초과 시 스피너로 멈춰 있었음)
        joinedCodes.delete(shareKey);
        setJoinError(
          res.status === 404
            ? "존재하지 않는 공유 링크입니다. 링크를 다시 확인해 주세요."
            : "플랜에 참여하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      } catch (err) {
        joinedCodes.delete(shareKey);
        setJoinError(
          "네트워크 오류로 참여하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.",
        );
        console.error("Failed to join room:", err);
      }
    };

    joinRoom();
  }, [shareCode, shareKey, asRole, fetchWithAuth, router]);

  const handleCloseModal = () => {
    setShowLoginModal(false);
    router.replace("/");
  };

  const handleRetry = () => {
    setJoinError(null);
    joinedCodes.delete(shareKey);
    router.refresh();
    // effect가 다시 돌도록 코드 재설정 없이 강제 리로드
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#fcfbfc] flex items-center justify-center px-6">
      {joinError ? (
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl text-center">
          <p className="text-lg font-bold text-[#1b0d14]">
            플랜에 참여하지 못했어요
          </p>
          <p className="mt-2 text-sm text-gray-500">{joinError}</p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="flex-1 h-12 rounded-2xl border border-gray-200 bg-white font-bold text-sm text-[#1b0d14] hover:bg-gray-50 transition-all"
            >
              홈으로
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="flex-1 h-12 rounded-2xl bg-[#ee2b8c] font-bold text-sm text-white hover:bg-[#d4237b] transition-all"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : (
        !showLoginModal && (
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-[#ee2b8c] border-t-transparent animate-spin" />
            <p className="text-gray-400 font-bold text-sm">
              공유 플랜 연결 중...
            </p>
          </div>
        )
      )}

      <LoginRequiredModal
        show={showLoginModal}
        onClose={handleCloseModal}
        title="공유 플랜을 보려면 로그인해 주세요"
      />
    </div>
  );
}
