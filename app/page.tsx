import AuthButtons from "./components/AuthButtons";
import KakaoLoginAlert from "./components/KakaoLoginAlert";
import LandingHero from "./components/LandingHero";

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const showKakaoAlert = params?.kakao_login === "1";

  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <main className="flex h-full w-full max-w-[500px] flex-col items-center overflow-hidden bg-[#FFF5F2] px-6">
        <KakaoLoginAlert show={showKakaoAlert} />
        <LandingHero
          title="우리 플랜트"
          subtitle="우리만의 우리 플랜, 지금 시작해요"
        />
        <AuthButtons />
      </main>
    </div>
  );
}
