import Link from "next/link";

type AuthButtonsProps = {
  guestLabel?: string;
};

function AuthButton({
  label,
  className,
  href,
  preparing,
  fullPageRedirect,
}: {
  label: string;
  className: string;
  href?: string;
  preparing?: boolean;
  /** true면 <a> 사용. OAuth 등 외부 리다이렉트 시 fetch/RSC CORS 회피용 */
  fullPageRedirect?: boolean;
}) {
  const baseClass = `w-full rounded-full text-sm font-semibold shadow-sm transition-transform ${preparing ? "min-h-11 py-2.5 cursor-not-allowed opacity-70" : "h-11"} ${className} ${!preparing ? "hover:scale-[1.01] active:scale-[0.99]" : ""}`;

  if (href && !preparing) {
    const linkClass = `block w-full ${baseClass} flex items-center justify-center`;
    if (fullPageRedirect) {
      return (
        <a href={href} className={linkClass}>
          {label}
        </a>
      );
    }
    return (
      <Link href={href} className={linkClass}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${baseClass} flex flex-col items-center justify-center gap-0.5`}
      disabled={preparing}
      aria-label={preparing ? `${label} (서비스 준비중)` : label}
    >
      <span>{label}</span>
      {preparing && (
        <span className="text-xs font-normal opacity-90">서비스 준비중</span>
      )}
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
          preparing
        />
        <AuthButton
          label="카카오로 시작하기"
          className="bg-[#FEE500] text-[#191919]"
          href="/api/auth/kakao"
          fullPageRedirect
        />
        <AuthButton
          label="Apple로 시작하기"
          className="bg-black text-white"
          preparing
        />

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
