"use client";

import React from "react";
import { Plus } from "lucide-react";

/**
 * "아직 혼자 준비 중이에요" 띠.
 *
 * 온보딩의 초대 단계를 건너뛴 사실이 홈에 남는 자리다. 온보딩은 한 번뿐이라
 * 거기서 안 부르면 다시 물을 기회가 없었고, 예전 진입점(점선 ＋ 원)은
 * **멤버가 나 혼자일 때만** 떠서 조언자 한 명만 들어와도 사라졌다.
 *
 * 닫기 버튼을 두지 않는다 — 배우자가 들어오면 저절로 사라지는 띠라
 * "끄는" 동작의 의미가 애매하고, 끄고 나면 다시 부를 자리가 없어진다.
 * 대신 문장을 한 줄로 짧게 두어 자리를 적게 쓴다.
 */

/** `SPOUSE` 가 한 명이라도 있으면 띠를 내리지 않는다 */
export function hasSpouse(
  members: { permission?: string | null }[] | undefined,
): boolean {
  return (members ?? []).some(
    (m) => String(m.permission ?? "").toUpperCase() === "SPOUSE",
  );
}

interface SoloPlanBannerProps {
  onInvite: () => void;
  /** 폰 트리에서는 좌우 여백을 바깥이 잡아 준다 */
  className?: string;
}

const SoloPlanBanner: React.FC<SoloPlanBannerProps> = ({
  onInvite,
  className = "",
}) => (
  <div
    className={`flex items-center gap-3 rounded-2xl border border-[#ee2b8c22] bg-[#fff6fa] px-3.5 py-3 sm:px-4 ${className}`}
  >
    <span
      className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-dashed border-[#ee2b8c55] text-[#ee2b8c]"
      aria-hidden
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[13.5px] font-bold leading-tight text-[#1b0d14]">
        아직 혼자 준비 중이에요
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[#7a6c74] break-keep">
        신랑·신부를 부르면 예산과 일정을 같이 고칠 수 있어요
      </p>
    </div>
    <button
      type="button"
      onClick={onInvite}
      className="h-9 flex-none rounded-xl bg-[#ee2b8c] px-4 text-[13px] font-bold whitespace-nowrap text-white shadow-[0_8px_20px_-8px_rgba(238,43,140,0.75)] transition-transform duration-200 hover:-translate-y-px active:scale-95"
    >
      부르기
    </button>
  </div>
);

export default SoloPlanBanner;
