type LandingHeroProps = {
  title: string;
  subtitle: string;
};

export function LandingHero({ title, subtitle }: LandingHeroProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="animate-rise mb-6 flex flex-col items-center gap-2">
        <p className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          {title}
        </p>
        <p className="animate-rise-delayed text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

