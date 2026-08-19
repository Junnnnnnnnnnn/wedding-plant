"use client";

import { useKakaoAuth } from "../hooks/useKakaoAuth";

const TITLE = "로그인이 필요해요!";
const BODY = "회원가입 또는 로그인을 해주세요.";
const TIP = "아래에서 원하는 방법으로 로그인해 주세요.";

type LoginRequiredModalProps = {
  show: boolean;
  onClose: () => void;
  title?: string;
};

export default function LoginRequiredModal({
  show,
  onClose,
  title,
}: LoginRequiredModalProps) {
  const { handleKakaoAuth, loading } = useKakaoAuth();

  const handleClose = () => {
    onClose();
  };

  if (!show) return null;

  const resolvedTitle = title ?? TITLE;
  const baseBtnClass =
    "w-full rounded-full text-sm font-semibold h-11 flex items-center justify-center transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={handleClose}
      onKeyDown={(e) => e.key === "Escape" && handleClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white px-5 py-6 sm:p-6 shadow-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-modal="true"
        aria-label={resolvedTitle}
      >
        <h2 className="text-center text-base sm:text-lg font-bold text-stone-900 break-keep line-clamp-2">
          {resolvedTitle}
        </h2>
        <p className="mt-3 text-center text-[14px] sm:text-[15px] font-normal leading-relaxed text-stone-700 break-keep">
          {BODY}
        </p>
        <p className="mt-2 text-center text-[12px] sm:text-[13px] text-gray-500 break-keep">
          {TIP}
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:gap-3">
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
            onClick={handleClose}
            className={`${baseBtnClass} border-2 border-stone-300 bg-white text-stone-700`}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
