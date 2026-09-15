"use client";

import { useKakaoAuth } from "../hooks/useKakaoAuth";

type AuthButtonsProps = {
  /**
   * 분홍 면 위에 놓이는 화면(`/login`·`/share/…`)은 `onBrand` 다.
   * 랜딩은 흰 바탕이라 예전 그대로 둔다.
   *
   * 예전에는 카카오 아래에 "로그인 없이 둘러보기" 가 붙어 있었다. 지금은
   * **회원만 앱에 들어온다** — 게스트 입구를 다시 만들지 말 것.
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

export default function AuthButtons({ variant = "default" }: AuthButtonsProps) {
  const onBrand = variant === "onBrand";
  return (
    <div className={onBrand ? "w-full" : "w-full max-w-[320px]"}>
      <KakaoAuthButton onBrand={onBrand} />
    </div>
  );
}
