"use client";

import { Sparkles, ArrowRight } from "lucide-react";

interface NoPlanFoundModalProps {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function NoPlanFoundModal({
  show,
  onConfirm,
  onCancel,
}: NoPlanFoundModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-md px-4 sm:px-6">
      <div
        className="w-full max-w-sm bg-white rounded-[32px] sm:rounded-[40px] px-6 py-8 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#ee2b8c0a] rounded-full blur-3xl p-6" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#ee2b8c11] rounded-[24px] sm:rounded-3xl flex items-center justify-center text-[#ee2b8c] mb-5 sm:mb-6 animate-bounce">
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-[#1b0d14] leading-tight mb-3 break-keep">
            나만의 계획이 없으시네요?
          </h2>
          <p className="text-gray-500 font-bold text-xs sm:text-sm leading-relaxed mb-8 break-keep px-2">
            예신, 예랑님만의 특별한 웨딩 플랜을
            <br />
            지금 바로 만들어 가볼까요?
          </p>

          <div className="w-full space-y-3">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full h-14 sm:h-16 bg-[#ee2b8c] text-white rounded-2xl sm:rounded-3xl font-black text-base sm:text-lg shadow-xl shadow-[#ee2b8c33] transition-all hover:bg-[#d4237b] active:scale-95 flex items-center justify-center gap-2 group"
            >
              네, 만들래요!
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full h-12 sm:h-14 bg-gray-50 text-gray-400 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all hover:bg-gray-100 active:scale-95"
            >
              아니오, 나중에요
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
