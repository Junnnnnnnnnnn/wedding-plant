"use client";

import { useSearchParams } from "next/navigation";
import KakaoLoginAlert from "./KakaoLoginAlert";

/**
 * / 경로에서 Kakao 로그인 콜백 처리.
 * kakao_login=1 이면 로딩 모달을 보여주며 로그인·데이터 로드 후
 * 데이터 있음 → /main, 없음 → /setting 으로 이동.
 */
export default function HomeKakaoLoginHandler() {
  const searchParams = useSearchParams();
  const show = searchParams.get("kakao_login") === "1";

  return (
    <KakaoLoginAlert show={show} showLoadingOverlay={true} />
  );
}
