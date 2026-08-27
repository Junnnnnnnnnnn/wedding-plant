import { Suspense } from "react";
import HomeKakaoLoginHandler from "./components/HomeKakaoLoginHandler";
import Landing from "./components/Landing";
import LoginErrorModal from "./components/LoginErrorModal";

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <LoginErrorModal />
      </Suspense>
      <Suspense fallback={null}>
        <HomeKakaoLoginHandler />
      </Suspense>
      <Landing />
    </>
  );
}
