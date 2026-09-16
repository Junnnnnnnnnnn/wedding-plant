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

      **폰은 위·아래로 벌리고(`justify-between`), `md` 부터는 덩어리를 화면
      한가운데로 모은다.** 이 화면에는 `max-w-md` 컬럼 하나뿐이라 예전에는
      1440px 에서 오른쪽 1,000px 이 통째로 빈 분홍이었고, 제목과 버튼 사이도
      600px 가까이 벌어져 둘이 같은 화면의 일부로 안 읽혔다. 온보딩이 같은
      문제를 겪고 고친 자리다(CLAUDE.md "셸을 쓰지 않는 화면").

      **글은 넓은 화면에서도 왼쪽 정렬이다.** 가운데로 맞추면 두 줄짜리
      제목의 둘째 줄이 매번 다른 자리에서 시작해 읽는 눈이 흔들린다 —
      온보딩 질문 단계와 같은 이유다. 가운데로 오는 건 덩어리이지 글이 아니다.

      높이는 `100dvh` 다. `100vh` 면 iOS 사파리에서 주소창 높이만큼 넘쳐
      맨 아래 "처음이신가요?" 줄이 잘린다.
    */
    <div className="relative flex min-h-[100dvh] w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-8 pb-10 pt-20 md:items-center md:justify-center md:gap-14 md:py-20">
      <div className="z-10 w-full max-w-md">
        <div className="mb-8 inline-flex items-center justify-center rounded-[24px] bg-white p-3 shadow-lg shadow-black/10 md:mb-10">
          <Image
            src="/images/icon.png"
            alt="웨딩 플랜트"
            width={128}
            height={128}
            quality={100}
            className="h-14 w-14 rounded-[14px] object-contain md:h-16 md:w-16"
          />
        </div>

        {expired ? (
          <>
            <h1 className="text-[32px] font-black leading-tight tracking-[-0.045em] text-white md:text-[44px]">
              다시
              <br />
              로그인해 주세요
            </h1>
            <p className="mt-3 text-base font-bold leading-snug text-white/80 md:mt-4 md:text-lg">
              로그인이 만료됐어요.
              <br />
              플랜은 그대로 있으니 걱정 마세요.
            </p>
          </>
        ) : (
          /*
            **처음 오는 사람 기준의 문구다.** 랜딩의 "시작하기" 가 이 화면으로
            바로 오므로, 예전의 "다시 오셨네요" 는 앱을 처음 보는 사람에게
            어긋났다. 돌아온 사람에게는 `?expired=1` 쪽 문구가 뜬다.
          */
          <>
            <h1 className="text-[32px] font-black leading-tight tracking-[-0.045em] text-white md:text-[44px]">
              결혼 준비
              <br />
              같이 시작해요
            </h1>
            <p className="mt-3 text-base font-bold leading-snug text-white/80 md:mt-4 md:text-lg">
              카카오로 시작하면
              <br />
              일정과 예산이 한곳에 모여요.
            </p>
          </>
        )}
      </div>

      <div className="z-10 flex w-full max-w-md flex-col items-center">
        <AuthButtons variant="onBrand" />
        <Link
          href="/"
          className="mt-4 text-xs font-medium text-white/70 underline underline-offset-4 md:mt-5 md:text-sm"
        >
          웨딩 플랜트가 처음이신가요?
        </Link>
      </div>
    </div>
  );
}
