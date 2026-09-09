"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthButtons from "./AuthButtons";

/**
 * 로그인 화면.
 *
 * `?expired=1` 로 들어오면 왜 여기로 왔는지 한 줄로 알려 준다. **모달이 아니라
 * 화면 안의 문장이다** — 예전에는 랜딩 위에 "세션이 만료되었습니다" 모달이 떠서,
 * 앱을 처음 보는 사람에게도 뜨는 것처럼 보였고 닫으면 갈 곳이 없었다.
 */
export default function LoginView() {
  const expired = useSearchParams().get("expired") === "1";

  return (
    /*
      로그인은 **들어오는 문**이다. 안에 들어와야 볼 것이 있는 화면이 아니라
      들어올지 말지를 정하는 화면이라, 분홍을 머리에만 두지 않고 화면 전체로
      편다 — 앱에서 초대 수락과 이 화면 둘만 그렇다.

      점 패턴과 뿌연 원 두 개는 걷어냈다(SEED 기준: 표면은 민 바탕).
    */
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-8 pb-10 pt-20">
      <div className="z-10 w-full max-w-md">
        <div className="mb-8 inline-flex items-center justify-center rounded-[24px] bg-white p-3 shadow-lg shadow-black/10">
          <Image
            src="/images/icon.png"
            alt="웨딩 플랜트"
            width={128}
            height={128}
            quality={100}
            className="h-14 w-14 rounded-[14px] object-contain"
          />
        </div>

        {expired ? (
          <>
            <h1 className="text-[32px] font-black leading-tight tracking-[-0.045em] text-white">
              다시
              <br />
              로그인해 주세요
            </h1>
            <p className="mt-3 text-base font-bold leading-snug text-white/80">
              로그인이 만료됐어요.
              <br />
              플랜은 그대로 있으니 걱정 마세요.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[32px] font-black leading-tight tracking-[-0.045em] text-white">
              다시
              <br />
              오셨네요
            </h1>
            <p className="mt-3 text-base font-bold leading-snug text-white/80">
              카카오로 로그인하면
              <br />
              이어서 준비할 수 있어요.
            </p>
          </>
        )}
      </div>

      <div className="z-10 flex w-full max-w-md flex-col items-center">
        <AuthButtons variant="onBrand" />
        <Link
          href="/"
          className="mt-4 text-xs font-medium text-white/70 underline underline-offset-4"
        >
          웨딩 플랜트가 처음이신가요?
        </Link>
      </div>
    </div>
  );
}
