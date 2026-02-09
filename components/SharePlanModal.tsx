"use client";

import React, { useState } from "react";
import {
  X,
  Link2,
  MessageCircle,
  Shield,
  ShieldAlert,
  Check,
} from "lucide-react";
import { useApi } from "@/app/contexts/ApiContext";

interface SharePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SharePlanModal: React.FC<SharePlanModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const { fetchWithAuth } = useApi();

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    setCopyError(null);
    try {
      const res = await fetchWithAuth("/plan/room/share-code", {
        method: "GET",
      });
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
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopyError(
        err instanceof Error ? err.message : "링크 복사에 실패했습니다.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-[75px]"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-t-[44px] px-5 sm:px-6 py-8 sm:p-8 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom duration-300 overflow-hidden relative flex flex-col max-h-[calc(100dvh-140px)] min-h-0"
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
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </header>

        <div className="space-y-6 sm:space-y-8 overflow-y-auto flex-1 min-h-0 scrollbar-hide -mx-2 px-2 pb-2">
          {/* Main Illustration/Description */}
          <div className="bg-[#ee2b8c08] rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-center border border-[#ee2b8c11]">
            <p className="text-[#1b0d14] font-bold text-xs sm:text-sm leading-relaxed break-keep">
              연인이나 플랜 전문가 등에게 플랜을 공유하고 수정해봐요!
            </p>
            <div className="mt-3 inline-block px-3 py-1 bg-[#ff940011] rounded-full">
              <p className="text-[#ff9400] text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                최대 4명까지 가능합니다.
              </p>
            </div>
          </div>

          {/* Sharing Methods */}
          <div className="space-y-4">
            <h4 className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">
              공유 방법 선택
            </h4>
            {copyError && (
              <p className="text-xs sm:text-sm font-bold text-red-500 -mt-2">
                {copyError}
              </p>
            )}
            <div className="flex gap-3 sm:gap-4">
              <button
                onClick={handleCopyLink}
                className="flex-1 h-14 sm:h-16 bg-white border border-gray-100 rounded-2xl sm:rounded-3xl flex items-center justify-center gap-2 sm:gap-3 font-bold text-sm sm:text-base text-[#1b0d14] shadow-sm hover:shadow-md transition-all active:scale-95 min-w-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <Link2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#ee2b8c] flex-shrink-0" />
                )}
                <span className="truncate">{copied ? "복사됨" : "링크 복사"}</span>
              </button>

              <button className="w-14 h-14 sm:w-16 sm:h-16 bg-[#FEE500] rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-lg shadow-[#FEE50033] hover:opacity-90 active:scale-95 transition-all flex-shrink-0">
                <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-[#1b0d14] fill-[#1b0d14]" />
              </button>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={onClose}
            className="w-full h-14 sm:h-16 bg-[#ee2b8c] text-white rounded-2xl sm:rounded-3xl font-black text-base sm:text-lg shadow-xl shadow-[#ee2b8c33] transition-all hover:bg-[#d4237b] active:scale-95 mt-2 sm:mt-4 flex-shrink-0"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePlanModal;
