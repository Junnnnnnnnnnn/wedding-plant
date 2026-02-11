"use client";

import React, { useEffect } from "react";
import { Check, Trash2, PartyPopper, ArrowRight } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "registered" | "deleted" | "updated";
  /** Optional override for main title (e.g. "수정되었습니다") */
  title?: string;
  /** Optional override for subtitle */
  subtitle?: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  subtitle,
}) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSuccess = type === "registered" || type === "updated";

  const displayTitle =
    title ??
    (isSuccess
      ? type === "updated"
        ? "수정 완료!"
        : "등록 완료!"
      : "삭제 완료");
  const displaySubtitle =
    subtitle ??
    (isSuccess
      ? type === "updated"
        ? "Successfully updated"
        : "Successfully added to your plan"
      : "The item has been removed");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
      {/* Backdrop with premium blur */}
      <div
        className="absolute inset-0 bg-[#1b0d14]/60 backdrop-blur-md animate-in fade-in duration-500"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="닫기"
      />

      {/* Modern Modal Card */}
      <div className="bg-white w-full max-w-[320px] rounded-[48px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative z-10 overflow-hidden animate-in zoom-in-90 fade-in duration-400 ease-out-back">
        {/* Decorative Top Accent */}
        <div
          className={`h-2 w-full ${isSuccess ? "bg-gradient-to-r from-[#ee2b8c] to-[#ff7eb3]" : "bg-gradient-to-r from-gray-700 to-gray-900"}`}
        />

        <div className="p-10 flex flex-col items-center text-center">
          {/* Main Visual Icon Area */}
          <div className="mb-8 relative">
            {/* Background Glow */}
            <div
              className={`absolute inset-0 blur-3xl opacity-40 rounded-full scale-150 ${isSuccess ? "bg-[#ee2b8c]" : "bg-gray-400"}`}
            />
            <div
              className={`relative w-24 h-24 rounded-[32px] flex items-center justify-center shadow-2xl rotate-3 transition-transform hover:rotate-0 duration-500 ${
                isSuccess
                  ? "bg-[#ee2b8c] text-white shadow-[#ee2b8c44]"
                  : "bg-[#1b0d14] text-white shadow-gray-400"
              }`}
            >
              {isSuccess ? (
                <Check
                  className="w-12 h-12 animate-in slide-in-from-bottom-2 duration-500"
                  strokeWidth={3}
                />
              ) : (
                <Trash2
                  className="w-12 h-12 animate-in zoom-in-50 duration-500"
                  strokeWidth={2.5}
                />
              )}
            </div>

            {(type === "registered" || type === "updated") && (
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-[#ee2b8c11] animate-bounce">
                <PartyPopper className="w-6 h-6 text-[#ee2b8c]" />
              </div>
            )}
          </div>

          {/* Content Text */}
          <div className="space-y-2 mb-10">
            <h3 className="text-2xl font-black text-[#1b0d14] tracking-tight leading-none">
              {displayTitle}
            </h3>
            <p className="text-gray-400 text-[11px] font-bold uppercase tracking-[0.2em]">
              {displaySubtitle}
            </p>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={onClose}
            className={`group w-full h-16 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 mb-6 ${
              isSuccess
                ? "bg-[#ee2b8c] text-white shadow-[0_12px_24px_-8px_rgba(238,43,140,0.5)] hover:bg-[#d4237b]"
                : "bg-[#1b0d14] text-white shadow-[0_12px_24px_-8px_rgba(27,13,20,0.5)] hover:bg-black"
            }`}
          >
            확인
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Minimal Timer indicator */}
          <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full animate-progress-shrink ${isSuccess ? "bg-[#ee2b8c]" : "bg-gray-400"}`}
              style={{ animationDuration: "4000ms" }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes progress-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-progress-shrink {
          animation-name: progress-shrink;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
        .ease-out-back {
          transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
};

export default FeedbackModal;
