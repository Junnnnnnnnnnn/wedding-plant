"use client";

import Link from "next/link";
import { useKakaoAuth } from "../hooks/useKakaoAuth";

type AuthButtonsProps = {
  guestLabel?: string;
};

function KakaoAuthButton() {
  const { handleKakaoAuth, loading } = useKakaoAuth();
  const baseClass =
    "w-full rounded-full text-sm font-semibold shadow-sm transition-transform h-11 flex items-center justify-center bg-[#FEE500] text-[#191919] hover:scale-[1.01] active:scale-[0.99]";
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
}: AuthButtonsProps) {
  return (
    <div className="w-full max-w-[320px]">
      <div className="flex flex-col items-center gap-4">
        <KakaoAuthButton />

        <Link href="/setting">
          <button
            type="button"
            className="mt-1 text-xs font-medium text-stone-600 underline underline-offset-4 cursor-pointer"
          >
            {guestLabel}
          </button>
        </Link>
      </div>
    </div>
  );
}
