"use client";

import { usePathname } from "next/navigation";
import { useApi } from "../contexts/ApiContext";
import LoginRequiredModal from "./LoginRequiredModal";

/**
 * 여기서는 이 모달을 띄우지 않는다 — 둘 다 로그인하러 들어오는 문이라
 * "다시 로그인하세요" 를 덮어 봐야 할 말이 겹치고, 닫으면 갈 곳도 없다.
 * 랜딩에서 만료가 확인되면 `AuthRedirectToMain` 이 `/login` 으로 보낸다.
 */
const SILENT_PATHS = ["/", "/login"];

/**
 * 인증이 만료됐을 때(fetchWithAuth가 401을 받았을 때) 앱 어디서든 뜨는 안내.
 *
 * 예전에는 화면마다 401을 따로 처리했고, 처리하지 않는 화면에서는
 * 만료된 토큰으로 요청이 조용히 실패해 사용자가 이유를 알 수 없었다.
 */
export default function SessionExpiredModal() {
  const { sessionExpired, dismissSessionExpired } = useApi();
  const pathname = usePathname();

  return (
    <LoginRequiredModal
      show={sessionExpired && !SILENT_PATHS.includes(pathname)}
      onClose={dismissSessionExpired}
      title="세션이 만료되었습니다. 다시 로그인해 주세요."
    />
  );
}
