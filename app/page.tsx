import { Suspense } from "react";
import AuthButtons from "./components/AuthButtons";
import LandingHero from "./components/LandingHero";
import LoginErrorModal from "./components/LoginErrorModal";

export default function Home() {
  return (
    <div className="flex h-[100dvh] justify-center bg-[#FFF5F2] px-0 text-stone-900 lg:bg-white lg:px-6">
      <Suspense fallback={null}>
        <LoginErrorModal />
      </Suspense>
      <main className="flex h-full w-full max-w-[500px] flex-col items-center overflow-hidden bg-[#FFF5F2] px-6">
        <LandingHero
          title="우리 플랜트"
          subtitle="우리만의 우리 플랜, 지금 시작해요"
        />
        <AuthButtons />
      </main>
    </div>
  );
}
