"use client";

import { useKakaoAuth } from "../hooks/useKakaoAuth";

const MESSAGE = "로그인이 필요해요, 회원가입 또는 로그인을 해주세요.";

type LoginRequiredModalProps = {
  show: boolean;
  onClose: () => void;
};

export default function LoginRequiredModal({
  show,
  onClose,
}: LoginRequiredModalProps) {
  const { handleKakaoAuth, loading } = useKakaoAuth();

  if (!show) return null;

  const baseBtnClass =
    "w-full rounded-full text-sm font-semibold h-11 flex items-center justify-center transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70";

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-modal="true"
        aria-label={MESSAGE}
      >
        <p className="text-center text-lg font-semibold text-stone-900">
          {MESSAGE}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled
            className={`${baseBtnClass} flex-col gap-0.5 bg-[#03c75a] text-white`}
          >
            <span>네이버로 로그인</span>
            <span className="text-xs font-normal opacity-90">
              서비스 준비중
            </span>
          </button>
          <button
            type="button"
            onClick={handleKakaoAuth}
            disabled={loading}
            className={`${baseBtnClass} bg-[#FEE500] text-[#191919]`}
          >
            {loading ? "확인 중..." : "카카오로 로그인"}
          </button>
          <button
            type="button"
            disabled
            className={`${baseBtnClass} flex-col gap-0.5 bg-black text-white`}
          >
            <span>Apple로 로그인</span>
            <span className="text-xs font-normal opacity-90">
              서비스 준비중
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${baseBtnClass} border-2 border-stone-300 bg-white text-stone-700`}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
