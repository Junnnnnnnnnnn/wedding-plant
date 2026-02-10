"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getToken, setShareAfterLogin } from "@/lib/api";
import KakaoLoginAlert from "./KakaoLoginAlert";
import LoginRequiredModal from "./LoginRequiredModal";

/**
 * / 경로에서 Kakao 로그인 콜백 처리 및 공유 링크 접근 처리.
 * kakao_login=1 이면 로딩 모달을 보여주며 로그인·데이터 로드 후
 * 데이터 있음 → /main, 없음 → /setting 으로 이동.
 * share=[code] 가 있고 비로그인 상태면 로그인 장려 모달 표시.
 */
export default function HomeKakaoLoginHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showLoginAlert = searchParams.get("kakao_login") === "1";
  const shareCode = searchParams.get("share");
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    if (shareCode?.trim() && !getToken()) {
      setShareAfterLogin(shareCode.trim());
      setShowShareModal(true);
    }
  }, [shareCode]);

  const handleCloseModal = () => {
    setShowShareModal(false);
    // URL에서 share 파라미터 제거
    const url = new URL(window.location.href);
    url.searchParams.delete("share");
    router.replace(url.pathname + url.search);
  };

  return (
    <>
      <KakaoLoginAlert show={showLoginAlert} />
      <LoginRequiredModal
        show={showShareModal}
        onClose={handleCloseModal}
        title="공유 플랜을 보려면 로그인해 주세요"
      />
    </>
  );
}
