"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

/*
  화면을 그리다 예외가 난 경우.

  **에러 내용을 사용자에게 보여주지 않는다.** 스택이나 메시지에는 내부 경로와
  값이 섞여 있고, 사용자가 그걸로 할 수 있는 일도 없다. 대신 "다시 시도"를
  준다 - 일시적인 네트워크 실패면 그 버튼 한 번으로 끝난다.

  콘솔에는 남긴다. 사용자는 못 보지만 Clarity 세션 기록과 브라우저 콘솔에서
  원인을 찾을 수 있어야 한다.
*/
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("화면 렌더 중 오류:", error);
  }, [error]);

  return (
    <div className="grid-bg relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#fcfbfc] px-8 py-20">
      <div className="pointer-events-none absolute top-[-10%] right-[-20%] h-80 w-80 rounded-full bg-[#ee2b8c11] blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-20%] h-80 w-80 rounded-full bg-purple-100/50 blur-[100px]" />

      <div className="z-10 flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-[22px] font-black tracking-tight text-[#1b0d14]">
            화면을 불러오지 못했어요
          </h1>
          <p className="text-[15px] leading-relaxed font-bold text-gray-400">
            잠시 문제가 생겼습니다.
            <br />
            다시 시도하면 대부분 해결됩니다.
          </p>
          {/*
            digest 는 서버가 붙이는 짧은 식별자다. 내용이 아니라 번호라
            노출해도 안전하고, 문의가 왔을 때 로그를 찾는 열쇠가 된다.
          */}
          {error.digest && (
            <p className="font-mono text-[11px] text-gray-300">
              오류 번호 {error.digest}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ee2b8c] text-[15px] font-bold text-white transition-colors hover:bg-[#d4237b] active:scale-[0.99]"
          >
            <RotateCcw className="h-4 w-4" />
            다시 시도
          </button>
          <Link
            href="/"
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-stone-200 bg-white text-[15px] font-bold text-[#1b0d14] transition-colors hover:bg-stone-50"
          >
            홈으로 가기
          </Link>
        </div>
      </div>
    </div>
  );
}
