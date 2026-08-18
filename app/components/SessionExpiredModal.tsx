"use client";

import { useApi } from "../contexts/ApiContext";
import LoginRequiredModal from "./LoginRequiredModal";

/**
 * 인증이 만료됐을 때(fetchWithAuth가 401을 받았을 때) 앱 어디서든 뜨는 안내.
 *
 * 예전에는 화면마다 401을 따로 처리했고, 처리하지 않는 화면에서는
 * 만료된 토큰으로 요청이 조용히 실패해 사용자가 이유를 알 수 없었다.
 */
export default function SessionExpiredModal() {
  const { sessionExpired, dismissSessionExpired } = useApi();

  return (
    <LoginRequiredModal
      show={sessionExpired}
      onClose={dismissSessionExpired}
      title="세션이 만료되었습니다. 다시 로그인해 주세요."
    />
  );
}
