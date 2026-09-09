type LandingHeroProps = {
  title: string;
  subtitle: string;
  titleSize?: string;
  subtitleSize?: string;
  /** true면 TmoneyRoundWindRegular, false면 기존(덩근미소) 폰트 */
  useUserFont?: boolean;
  /**
   * 온보딩 질문 단계는 `start` 다(시안 C안 10). 질문이 가운데 정렬이면
   * 두 줄짜리 제목의 둘째 줄이 매번 다른 자리에서 시작해 읽는 눈이 흔들린다.
   * 축하·환영 같은 연출 화면은 그대로 가운데다.
   */
  align?: "center" | "start";
};

export default function LandingHero({
  title,
  subtitle,
  titleSize = "text-4xl sm:text-5xl",
  subtitleSize = "text-lg sm:text-xl",
  useUserFont = true,
  align = "center",
}: LandingHeroProps) {
  const start = align === "start";
  return (
    <div
      className={`flex flex-col justify-center ${
        start ? "w-full max-w-[340px] items-start" : "items-center"
      } ${useUserFont ? "font-user-content" : ""}`}
    >
      <div
        className={`animate-rise mb-6 flex flex-col gap-2 break-keep ${
          start ? "w-full items-start text-left" : "items-center text-center"
        }`}
      >
        <p
          className={`${titleSize} font-bold tracking-tight text-stone-900 ${start ? "leading-[1.3]" : ""}`}
        >
          {title}
        </p>
        <p
          className={`animate-rise-delayed ${subtitleSize} tracking-tight ${
            start ? "font-normal text-[#555d6d]" : "font-bold text-stone-900"
          }`}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
