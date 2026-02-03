"use client";

const TITLE = "로그인 없이 이용 중이시네요!";
const BODY = (
  <>
    비로그인 상태에서는 최대 3개까지만
    <br />
    플랜을 추가할 수 있어요. 📌
    <br />
    <br />
    또한 비로그인 상태에서는 데이터가 저장되지 않아요.
  </>
);
const TIP = "더 많은 플랜을 관리하고 싶다면 로그인해 보세요!";

type GuestPlanLimitModalProps = {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function GuestPlanLimitModal({
  show,
  onClose,
  onConfirm,
}: GuestPlanLimitModalProps) {
  if (!show) return null;

  const handleConfirm = () => {
    onClose();
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-modal="true"
        aria-label={TITLE}
      >
        <h2 className="text-center text-lg font-semibold text-stone-900">
          {TITLE}
        </h2>
        <p className="mt-3 text-center text-[15px] font-normal leading-relaxed text-stone-700">
          {BODY}
        </p>
        <p className="mt-2 text-center text-[13px] text-gray-500">
          {TIP}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-full h-11 flex items-center justify-center text-sm font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99] text-white"
            style={{ backgroundColor: "#FFAAB8" }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
