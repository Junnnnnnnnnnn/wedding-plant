import { Suspense } from "react";
import { Heart } from "lucide-react";
import AuthButtons from "./components/AuthButtons";
import LoginErrorModal from "./components/LoginErrorModal";

export default function Home() {
  return (
    <div className="min-h-screen max-w-md mx-auto bg-[#fcfbfc] relative overflow-hidden flex flex-col items-center justify-between px-8 py-20 grid-bg">
      <Suspense fallback={null}>
        <LoginErrorModal />
      </Suspense>

      {/* Decorative Blur Elements */}
      <div className="absolute top-[-10%] right-[-20%] w-80 h-80 bg-[#ee2b8c11] rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-20%] w-80 h-80 bg-purple-100/50 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Main Branding Section */}
      <div className="w-full space-y-4 text-center mt-12 z-10">
        <div className="inline-flex items-center justify-center p-4 bg-white rounded-[32px] shadow-xl shadow-[#ee2b8c11] border border-[#ee2b8c0a] mb-6">
          <Heart className="w-10 h-10 text-[#ee2b8c] fill-[#ee2b8c]" />
        </div>
        <h1 className="text-5xl font-black text-[#1b0d14] tracking-tight">
          우리 플랜트
        </h1>
        <p className="text-gray-400 font-bold text-lg leading-snug">
          우리만의 특별한 웨딩 플랜,<br />
          <span className="text-[#ee2b8c]">지금 바로 시작하세요.</span>
        </p>
      </div>

      {/* Login Options Section */}
      <div className="w-full space-y-3 z-10 flex flex-col items-center">
        <div className="w-full mt-6 flex justify-center">
          <AuthButtons />
        </div>
      </div>

      {/* Footer removed */}
    </div>
  );
}
