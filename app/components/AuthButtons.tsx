import Link from "next/link";

type AuthButtonsProps = {
  guestLabel?: string;
};

function AuthButton({
  label,
  className,
  href,
}: {
  label: string;
  className: string;
  href?: string;
}) {
  const baseClass = `h-11 w-full rounded-full text-sm font-semibold shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99] ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`block w-full ${baseClass} flex items-center justify-center`}
      >
        {label}
      </Link>
    );
  }

  return (
    <button type="button" className={baseClass}>
      {label}
    </button>
  );
}

export default function AuthButtons({
  guestLabel = "로그인 없이 둘러보기",
}: AuthButtonsProps) {
  return (
    <div className="animate-rise-delayed w-full max-w-[320px] pb-10">
      <div className="flex flex-col items-center gap-3">
        <AuthButton
          label="네이버로 시작하기"
          className="bg-[#03c75a] text-white"
        />
        <AuthButton
          label="카카오로 시작하기"
          className="bg-[#FEE500] text-[#191919]"
          href="/api/auth/kakao"
        />
        <AuthButton label="Apple로 시작하기" className="bg-black text-white" />

        <Link href="/setting">
          <button
            type="button"
            className="mt-2 text-xs font-medium text-stone-600 underline underline-offset-4 cursor-pointer"
          >
            {guestLabel}
          </button>
        </Link>
      </div>
    </div>
  );
}
