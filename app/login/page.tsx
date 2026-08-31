import { Suspense } from "react";
import type { Metadata } from "next";
import HomeKakaoLoginHandler from "../components/HomeKakaoLoginHandler";
import LoginErrorModal from "../components/LoginErrorModal";
import LoginView from "../components/LoginView";

export const metadata: Metadata = {
  title: "로그인 · 웨딩 플랜트",
  robots: { index: false, follow: false },
};

/**
 * 한 번이라도 로그인한 적이 있는 사람이 돌아오는 자리.
 *
 * 랜딩(`/`)은 "이 앱이 뭔지" 를 설명하는 화면이라, 이미 아는 사람에게 다시
 * 보여 줄 이유가 없다. 세션이 끊기면 `AuthRedirectToMain` 이 여기로 보낸다.
 */
export default function LoginPage() {
  return (
    <>
      <Suspense fallback={null}>
        <LoginErrorModal />
      </Suspense>
      <Suspense fallback={null}>
        <HomeKakaoLoginHandler />
      </Suspense>
      <Suspense fallback={null}>
        <LoginView />
      </Suspense>
    </>
  );
}
