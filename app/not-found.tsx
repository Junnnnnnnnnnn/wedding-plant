import Link from "next/link";
import Image from "next/image";

/*
  없는 주소로 들어왔을 때.

  예전에는 Next 기본 화면("This page could not be found.")이 떴다. 한국어
  서비스에서 이 화면만 영문으로 튀고, 무엇을 해야 하는지도 알려주지 않는다.

  랜딩과 같은 옷을 입힌다 - 셸(레일·탭바)은 쓰지 않는다. 길을 잃은 사람에게
  필요한 건 내비게이션이 아니라 **돌아갈 문 하나**다.
*/
export default function NotFound() {
  return (
    <div className="grid-bg relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#fcfbfc] px-8 py-20">
      {/* 랜딩과 같은 배경 얼룩. 장식이라 스크린리더·포인터에서 뺀다 */}
      <div className="pointer-events-none absolute top-[-10%] right-[-20%] h-80 w-80 rounded-full bg-[#ee2b8c11] blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-20%] h-80 w-80 rounded-full bg-purple-100/50 blur-[100px]" />

      <div className="z-10 flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="inline-flex items-center justify-center rounded-[32px] border border-[#ee2b8c0a] bg-white p-4 shadow-xl shadow-[#ee2b8c11]">
          <Image
            src="/icon-192.png"
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-[16px] object-contain"
          />
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-user-content text-[44px] leading-none font-black tracking-tight text-[#ee2b8c]">
            404
          </p>
          <h1 className="text-[22px] font-black tracking-tight text-[#1b0d14]">
            찾으시는 페이지가 없어요
          </h1>
          <p className="text-[15px] leading-relaxed font-bold text-gray-400">
            주소가 바뀌었거나 지워진 페이지입니다.
            <br />
            홈에서 다시 찾아 주세요.
          </p>
        </div>

        <Link
          href="/"
          className="mt-2 flex h-14 w-full items-center justify-center rounded-2xl bg-[#ee2b8c] text-[15px] font-bold text-white transition-colors hover:bg-[#d4237b] active:scale-[0.99]"
        >
          홈으로 가기
        </Link>
      </div>
    </div>
  );
}
