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
    <div className="grid-bg relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#fcfbfc] px-8 py-20">
      <div className="pointer-events-none absolute right-[-20%] top-[-10%] h-80 w-80 rounded-full bg-[#ee2b8c11] blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-20%] h-80 w-80 rounded-full bg-purple-100/50 blur-[100px]" />

      <div className="z-10 w-full max-w-md space-y-4 text-center">
        <div className="mb-6 inline-flex items-center justify-center rounded-[32px] border border-[#ee2b8c0a] bg-white p-4 shadow-xl shadow-[#ee2b8c11]">
          <Image
            src="/images/icon.png"
            alt="웨딩 플랜트"
            width={128}
            height={128}
            quality={100}
            className="h-16 w-16 rounded-[16px] object-contain"
          />
        </div>

        {expired ? (
          <>
            <h1 className="text-3xl font-black tracking-tight text-[#1b0d14]">
              다시 로그인해 주세요
            </h1>
            <p className="text-base font-bold leading-snug text-gray-400">
              로그인이 만료됐어요.
              <br />
              <span className="text-[#ee2b8c]">
                플랜은 그대로 있으니 걱정 마세요.
              </span>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-black tracking-tight text-[#1b0d14]">
              다시 오셨네요
            </h1>
            <p className="text-base font-bold leading-snug text-gray-400">
              카카오로 로그인하면
              <br />
              <span className="text-[#ee2b8c]">이어서 준비할 수 있어요.</span>
            </p>
          </>
        )}
      </div>

      <div className="z-10 mt-16 flex w-full max-w-md flex-col items-center">
        <div className="flex w-full justify-center">
          <AuthButtons />
        </div>
        <Link
          href="/"
          className="mt-6 text-xs font-medium text-stone-400 underline underline-offset-4"
        >
          웨딩 플랜트가 처음이신가요?
        </Link>
      </div>
    </div>
  );
}
