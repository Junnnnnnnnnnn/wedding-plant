"use client";

import React, { useState, useEffect } from "react";
import { X, Share2, MessageCircle, CalendarRange, Sprout } from "lucide-react";
import { useApi } from "@/app/contexts/ApiContext";

interface SharePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SharePlanModal: React.FC<SharePlanModalProps> = ({ isOpen, onClose }) => {
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareUrlLoading, setShareUrlLoading] = useState(false);
  const { fetchWithAuth } = useApi();

  // 모달이 열릴 때 미리 share code 조회
  useEffect(() => {
    if (!isOpen) {
      setShareUrl(null);
      setShareError(null);
      return;
    }
    let cancelled = false;
    setShareUrlLoading(true);
    setShareError(null);
    (async () => {
      try {
        const res = await fetchWithAuth("/plan/room/share-code", {
          method: "GET",
        });
        if (cancelled) return;
        if (!res.ok) {
          throw new Error("공유 링크 생성에 실패했습니다.");
        }
        const json = (await res.json()) as {
          result?: boolean;
          data?: { shareCode?: string };
        };
        const code = json?.data?.shareCode;
        if (!code) {
          throw new Error("shareCode를 받지 못했습니다.");
        }
        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}/share/${code}`
            : "";
        setShareUrl(url);
      } catch (err) {
        if (!cancelled) {
          setShareError(
            err instanceof Error ? err.message : "링크를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setShareUrlLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, fetchWithAuth]);

  const handleShare = async () => {
    setShareError(null);
    if (!shareUrl) {
      setShareError(
        shareUrlLoading ? "준비 중입니다." : "링크를 불러오지 못했습니다.",
      );
      return;
    }

    const shareData = {
      title: "웨딩 플랜 공유",
      text: "함께 웨딩 플랜을 관리해요!",
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setShareError("공유에 실패했습니다.");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareError("링크가 클립보드에 복사되었습니다.");
      } catch {
        setShareError("이 브라우저에서는 공유 기능을 지원하지 않습니다.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-t-[44px] px-5 sm:px-6 pt-8 pb-10 sm:p-10 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom duration-300 overflow-hidden relative flex flex-col max-h-[calc(100dvh-120px)] min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#ee2b8c] to-[#ff94a1]" />

        <header className="flex justify-between items-center mb-6 sm:mb-8 flex-shrink-0">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1b0d14] tracking-tight">
              플랜 공유하기
            </h3>
            <p className="text-gray-400 text-[10px] sm:text-xs font-bold mt-0.5 sm:mt-1">
              함께 관리할 사람들을 초대하세요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </header>

        <div className="space-y-6 sm:space-y-8 overflow-y-auto flex-1 min-h-0 scrollbar-hide -mx-2 px-2 pb-2">
          {/* Info Badge */}
          <div className="flex justify-center">
            <div className="px-4 py-1.5 bg-[#ee2b8c08] rounded-full border border-[#ee2b8c11]">
              <p className="text-[#ee2b8c] text-[10px] sm:text-[11px] font-bold tracking-wide">
                현재 최대 1명까지 공유 가능 · 추후 확대 예정
              </p>
            </div>
          </div>

          {/* Benefits List */}
          <div className="space-y-4 sm:space-y-5">
            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[#ee2b8c03] border border-gray-50 transition-all hover:bg-[#ee2b8c08] hover:border-[#ee2b8c15] hover:translate-x-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ee2b8c] to-[#ff6b9d] flex items-center justify-center text-white shadow-lg shadow-[#ee2b8c22] transition-transform group-hover:scale-110">
                <MessageCircle className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-[#1b0d14] text-base leading-none">
                  실시간 소통
                </h4>
                <p className="text-gray-400 text-[11px] sm:text-xs mt-1.5 font-bold leading-relaxed break-keep">
                  실시간 채팅과 알림으로 파트너와 즉각적으로 소통하며 준비해요.
                </p>
              </div>
            </div>

            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[#ee2b8c03] border border-gray-50 transition-all hover:bg-[#ee2b8c08] hover:border-[#ee2b8c15] hover:translate-x-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center text-white shadow-lg shadow-[#6366f122] transition-transform group-hover:scale-110">
                <CalendarRange className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-[#1b0d14] text-base leading-none">
                  일정 공유
                </h4>
                <p className="text-gray-400 text-[11px] sm:text-xs mt-1.5 font-bold leading-relaxed break-keep">
                  복잡한 웨딩 스케줄을 하나의 캘린더로 함께 보고 꼼꼼하게
                  관리하세요.
                </p>
              </div>
            </div>

            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[#ee2b8c03] border border-gray-50 transition-all hover:bg-[#ee2b8c08] hover:border-[#ee2b8c15] hover:translate-x-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10b981] flex items-center justify-center text-white shadow-lg shadow-[#05966922] transition-transform group-hover:scale-110">
                <Sprout className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-[#1b0d14] text-base leading-none">
                  함께 키우는 재미
                </h4>
                <p className="text-gray-400 text-[11px] sm:text-xs mt-1.5 font-bold leading-relaxed break-keep">
                  준비 단계에 따라 성장하는 우리만의 웨딩 플랜트을 함께
                  완성해보세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Share Button at the bottom */}
        <div className="mt-6 sm:mt-8 space-y-3 flex-shrink-0">
          {shareError && (
            <div
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-center ${shareError.includes("복사") ? "bg-green-50" : "bg-red-50"}`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${shareError.includes("복사") ? "bg-green-500" : "bg-red-500"}`}
              />
              <p
                className={`text-[11px] sm:text-xs font-bold ${shareError.includes("복사") ? "text-green-600" : "text-red-500"}`}
              >
                {shareError}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleShare}
            disabled={shareUrlLoading}
            className="w-full h-14 sm:h-16 bg-gradient-to-r from-[#ee2b8c] to-[#ff6b9d] text-white rounded-2xl sm:rounded-3xl flex items-center justify-center gap-3 font-black text-base sm:text-lg shadow-xl shadow-[#ee2b8c33] hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            <Share2 className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
            <span>{shareUrlLoading ? "준비 중..." : "링크 공유하기"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePlanModal;
