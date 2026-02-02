"use client";

const MESSAGE = "로그인 되어 있습니다";

type LoggedInModalProps = {
  show: boolean;
  onClose: () => void;
};

export default function LoggedInModal({ show, onClose }: LoggedInModalProps) {
  if (!show) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={MESSAGE}
      >
        <p className="text-center text-lg font-semibold text-stone-900">
          {MESSAGE}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-[#FFAAB8] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#FF9AA8]"
        >
          확인
        </button>
      </div>
    </div>
  );
}
