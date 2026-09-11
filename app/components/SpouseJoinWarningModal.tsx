"use client";

/**
 * 신랑·신부 초대를 수락하기 **전에** 무슨 일이 일어나는지 알린다.
 *
 * 배우자로 들어가면 그 방이 내 플랜이 되고(`lib/boundRoom.ts`), 내가 그전에
 * 만들어 둔 일정·예산은 화면에서 내려간다. 눌러 보고 나서야 알게 되면
 * "내 플랜이 사라졌다"로 읽힌다 — 이 정책에서 가장 나쁜 경우다.
 *
 * **지워진다고 쓰지 않는다.** 실제로는 DB 에 그대로 있고 함께하기를
 * 그만두면 다시 보인다. 겁을 주려고 사실보다 세게 쓰면, 나중에 "사라진다더니
 * 남아 있네"가 되어 다음 경고까지 같이 못 믿게 된다.
 *
 * 조언자(READ) 초대에는 띄우지 않는다 — 귀속이 아니라 잃는 것도 없다.
 */

type SpouseJoinWarningModalProps = {
  show: boolean;
  /** 초대한 사람 이름. 모르면 비워 둔다 — 지어내지 않는다 */
  ownerName?: string | null;
  /** 내가 이미 만들어 둔 일정 수. 모르면 `null` */
  myPlanCount?: number | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function SpouseJoinWarningModal({
  show,
  ownerName,
  myPlanCount,
  loading = false,
  onConfirm,
  onCancel,
}: SpouseJoinWarningModalProps) {
  if (!show) return null;

  const who = ownerName?.trim() ? `${ownerName.trim()}님의` : "초대한 사람의";
  /*
    내가 만든 게 실제로 있을 때만 개수를 말한다. 0 건인 사람에게
    "일정이 안 보이게 된다"고 하면 없는 손해를 지어내는 셈이다.
  */
  const hasMine = typeof myPlanCount === "number" && myPlanCount > 0;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={loading ? undefined : onCancel}
      onKeyDown={(e) => e.key === "Escape" && !loading && onCancel()}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white px-5 py-6 shadow-xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="신랑 · 신부로 함께하기"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 className="break-keep text-center text-base font-bold text-stone-900 sm:text-lg">
          지금부터 {who} 플랜을
          <br />
          같이 쓰게 돼요
        </h2>

        <p className="mt-3 break-keep text-center text-[14px] leading-relaxed text-stone-700 sm:text-[15px]">
          신랑 · 신부는 플랜 하나를 함께 씁니다. 홈 · 플랜 보드 · 예산이 모두{" "}
          {who} 플랜으로 바뀌고, 같이 고칠 수 있어요.
        </p>

        {hasMine && (
          /*
            노란 주의 면. 이 화면에서 사람이 꼭 읽어야 하는 한 문장이라
            본문과 같은 회색으로 두지 않는다.
          */
          <div className="mt-4 rounded-xl bg-[#fff8e6] px-4 py-3.5">
            <p className="break-keep text-[13px] font-bold leading-relaxed text-[#8a6100]">
              내가 만들어 둔 일정 {myPlanCount}건은 화면에서 보이지 않게 돼요
            </p>
            <p className="mt-1 break-keep text-[12px] leading-relaxed text-[#7a6c54]">
              지워지는 건 아니에요. 함께하기를 그만두면 다시 보여요.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-full bg-[#ee2b8c] text-sm font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "참여하는 중..." : "네, 같이 준비할게요"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-full border-2 border-stone-300 bg-white text-sm font-semibold text-stone-700 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            아직 아니요
          </button>
        </div>
      </div>
    </div>
  );
}
