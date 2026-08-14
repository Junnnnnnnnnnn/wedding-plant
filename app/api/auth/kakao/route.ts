import { NextRequest, NextResponse } from "next/server";

import {
  buildState,
  createStateNonce,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
} from "./state";

const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";

export async function GET(request: NextRequest) {
  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  const clientId = process.env.KAKAO_REST_API_KEY;

  if (!redirectUri || !clientId) {
    return NextResponse.json(
      {
        error:
          "카카오 인증이 설정되지 않았습니다 (REST API 키 또는 Redirect URI)",
      },
      { status: 500 },
    );
  }

  const from = request.nextUrl.searchParams.get("from") ?? "";
  // 논스를 붙여 콜백에서 CSRF 여부를 검증한다
  const nonce = createStateNonce();
  const state = buildState(nonce, from);

  // 개발 환경에서만 로그 출력 (디버깅용)
  if (process.env.NODE_ENV === "development") {
    console.log("카카오 인증 Redirect URI:", redirectUri);
    console.log("카카오 REST API Key:", clientId);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    locale: "ko_KR", // 카카오 로그인 페이지를 한글로 표시
  });
  params.set("state", state);

  const url = `${KAKAO_AUTHORIZE_URL}?${params.toString()}`;
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  return response;
}
