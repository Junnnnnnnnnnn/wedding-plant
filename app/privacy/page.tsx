import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_INFO,
  PRIVACY_POLICY_SECTIONS,
  isLegalInfoFilled,
} from "@/lib/legal";

/*
  개인정보처리방침 공개 페이지.

  **로그인 없이 볼 수 있어야 한다.** 구글 플레이는 스토어 등록 양식에서 이
  주소를 요구하고, 심사자와 크롤러가 로그인 없이 접근한다. 앱 안 모달로만
  갖고 있으면 등록 양식을 제출할 수 없다.

  셸(레일·탭바)을 쓰지 않는다. `/setting` 이나 랜딩과 같은 이유다 — 읽으러
  들어오는 문서라 내비게이션이 방해가 되고, 앱을 안 쓰는 사람도 본다.

  서버 컴포넌트로 둔다. 클라이언트 상태가 없고, 정적으로 미리 그려 두면
  크롤러가 자바스크립트 없이도 전문을 읽는다.
*/

export const metadata: Metadata = {
  title: "개인정보처리방침 - 웨딩 플랜트",
  description:
    "웨딩 플랜트가 어떤 정보를 어떤 목적으로 처리하고, 어떻게 삭제할 수 있는지 안내합니다.",
  robots: { index: true, follow: true },
};

/** 연락처가 들어가는 자리. 값이 비면 방침이 반쪽이라 눈에 띄게 알린다 */
function ContactBlock() {
  if (!isLegalInfoFilled()) {
    return (
      <div className="rounded-xl bg-[#fdf0e8] px-5 py-4 text-[14px] leading-relaxed text-[#8a4318]">
        <p className="font-bold">보호책임자 정보가 아직 채워지지 않았습니다.</p>
        <p className="mt-1">
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-[13px]">
            lib/legal.ts
          </code>{" "}
          의 <code className="text-[13px]">LEGAL_INFO</code> 에 사업자명,
          보호책임자, 연락처 이메일, 시행일을 넣어 주세요. 구글 플레이 등록에
          필요합니다.
        </p>
      </div>
    );
  }

  return (
    <dl className="grid gap-2 rounded-xl bg-[#faf6f8] px-5 py-4 text-[15px] sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-6">
      <dt className="text-[#7a6470]">개인정보 보호책임자</dt>
      <dd className="font-bold text-[#1b0d14]">{LEGAL_INFO.officer}</dd>
      <dt className="text-[#7a6470]">문의</dt>
      <dd className="font-bold text-[#1b0d14]">
        <a
          href={`mailto:${LEGAL_INFO.contactEmail}`}
          className="underline underline-offset-2 hover:text-[#ee2b8c]"
        >
          {LEGAL_INFO.contactEmail}
        </a>
      </dd>
    </dl>
  );
}

export default function PrivacyPage() {
  const filled = isLegalInfoFilled();

  return (
    <main className="min-h-[100dvh] bg-white px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-10">
        <header className="flex flex-col gap-3 border-b border-[#f0e6eb] pb-8">
          <Link
            href="/"
            className="w-fit text-[13px] text-[#7a6470] underline underline-offset-2 transition-colors hover:text-[#ee2b8c]"
          >
            {LEGAL_INFO.serviceName}
          </Link>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-[#1b0d14] sm:text-[32px]">
            개인정보처리방침
          </h1>
          <p className="text-[15px] leading-relaxed text-[#7a6470]">
            {filled ? LEGAL_INFO.company : LEGAL_INFO.serviceName}
            (은)는 이용자의 개인정보를 소중히 다루며, 관련 법령을 지킵니다.
            아래에서 어떤 정보를 어떤 목적으로 처리하고, 어떻게 삭제할 수 있는지
            안내합니다.
          </p>
          {filled && (
            <p className="text-[13px] text-[#9c8892]">
              시행일 {LEGAL_INFO.effectiveDate}
            </p>
          )}
        </header>

        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[#1b0d14]">
              {section.title}
            </h2>
            {/*
              원문은 빈 줄로 문단을 나눈 순수 텍스트다. 마크다운을 끌어오는
              대신 문단 단위로 끊어 그린다 - 목록 기호(-, [ ])까지 그대로
              보여야 법령 문서로 읽힌다.
            */}
            {section.body.split("\n\n").map((para) => (
              <p
                key={para.slice(0, 24)}
                className="text-[15px] leading-[1.85] whitespace-pre-line text-[#3d2c35]"
              >
                {para}
              </p>
            ))}
            {section.title.startsWith("10.") && <ContactBlock />}
          </section>
        ))}

        <footer className="border-t border-[#f0e6eb] pt-8 text-[13px] text-[#9c8892]">
          <Link
            href="/"
            className="underline underline-offset-2 transition-colors hover:text-[#ee2b8c]"
          >
            웨딩 플랜트로 돌아가기
          </Link>
        </footer>
      </div>
    </main>
  );
}
