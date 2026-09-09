"use client";

import Link from "next/link";
import { useKakaoAuth } from "../hooks/useKakaoAuth";

type AuthButtonsProps = {
  guestLabel?: string;
  /**
   * 분홍 면 위에 놓이는 화면(`/login`·`/share/…`)은 `onBrand` 다.
   * 거기서는 둘러보기가 **버튼**이어야 한다 — 흰 글씨 밑줄 링크는 분홍
   * 위에서 "누를 것"으로 안 읽혀, 카카오 말고 다른 길이 있다는 걸 놓친다.
   * 랜딩은 흰 바탕이라 예전 그대로 둔다.
   */
  variant?: "default" | "onBrand";
};

function KakaoAuthButton({ onBrand }: { onBrand: boolean }) {
  const { handleKakaoAuth, loading } = useKakaoAuth();
  const baseClass = onBrand
    ? "w-full h-12 rounded-xl text-[16px] font-bold flex items-center justify-center bg-[#FEE500] text-[#191919] transition-transform active:scale-[0.99]"
    : "w-full rounded-full text-sm font-semibold shadow-sm transition-transform h-11 flex items-center justify-center bg-[#FEE500] text-[#191919] hover:scale-[1.01] active:scale-[0.99]";
  return (
    <button
      type="button"
      onClick={handleKakaoAuth}
      disabled={loading}
      className={`${baseClass} ${loading ? "cursor-not-allowed opacity-70" : ""}`}
      aria-label={loading ? "로딩 중" : "카카오로 시작하기"}
    >
      {loading ? "확인 중..." : "카카오로 시작하기"}
    </button>
  );
}

export default function AuthButtons({
  guestLabel = "로그인 없이 둘러보기",
  variant = "default",
}: AuthButtonsProps) {
  const onBrand = variant === "onBrand";
  return (
    <div className={onBrand ? "w-full" : "w-full max-w-[320px]"}>
      <div
        className={
          onBrand ? "flex flex-col gap-2" : "flex flex-col items-center gap-4"
        }
      >
        <KakaoAuthButton onBrand={onBrand} />

        <Link href="/setting" className={onBrand ? "w-full" : undefined}>
          <button
            type="button"
            className={
              onBrand
                ? "h-12 w-full cursor-pointer rounded-xl bg-white/20 text-[16px] font-bold text-white transition-colors hover:bg-white/25"
                : "mt-1 text-xs font-medium text-stone-600 underline underline-offset-4 cursor-pointer"
            }
          >
            {guestLabel}
          </button>
        </Link>
      </div>
    </div>
  );
}
