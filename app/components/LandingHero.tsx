type LandingHeroProps = {
  title: string;
  subtitle: string;
  titleSize?: string;
  subtitleSize?: string;
};

export default function LandingHero({
  title,
  subtitle,
  titleSize = "text-4xl sm:text-5xl",
  subtitleSize = "text-lg sm:text-xl",
}: LandingHeroProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="animate-rise mb-6 flex flex-col items-center gap-2 text-center break-keep">
        <p className={`${titleSize} font-bold tracking-tight text-stone-900`}>
          {title}
        </p>
        <p
          className={`animate-rise-delayed ${subtitleSize} font-bold tracking-tight text-stone-900`}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
