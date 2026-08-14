/* access_token을 사용해라 그냥 code 말고! */
import { NextRequest, NextResponse } from "next/server";

import { isValidNonce, OAUTH_STATE_COOKIE, parseState } from "../state";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const { nonce, from } = parseState(searchParams.get("state"));
  const expectedNonce = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";

  /** 한 번 쓴 논스는 재사용되지 않도록 응답에서 쿠키를 지운다 */
  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  };

  const redirectToHome = (query?: string) => {
    const url = new URL("/", request.url);
    if (query) url.search = query;
    return clearStateCookie(NextResponse.redirect(url));
  };

  const redirectWithLoginSuccess = (kakaoToken: string) => {
    // from=main이면 /main으로 (비로그인 setting→main→로그인 시 데이터 병합용)
    // from=home이면 /로 이동
    const path = from === "main" ? "/main" : "/";
    const url = new URL(path, request.url);
    url.search = "kakao_login=1";
    url.hash = `kakao_token=${encodeURIComponent(kakaoToken)}`;
    return clearStateCookie(NextResponse.redirect(url.toString()));
  };

  if (error) {
    return redirectToHome("?login_error=1");
  }

  if (!code || typeof code !== "string") {
    return redirectToHome("?login_error=1");
  }

  // 우리가 시작한 인증인지 확인한다. 논스가 없거나 어긋나면 중단.
  // (검증이 없으면 공격자의 code가 담긴 콜백 URL을 피해자가 열었을 때
  //  피해자 브라우저가 공격자 계정으로 로그인된다)
  if (!isValidNonce(nonce, expectedNonce)) {
    return redirectToHome("?login_error=1");
  }

  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  const clientId = process.env.KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;

  // 개발 환경에서만 로그 출력 (디버깅용)
  if (process.env.NODE_ENV === "development") {
    console.log("카카오 토큰 교환 - Redirect URI:", redirectUri);
    console.log("카카오 토큰 교환 - REST API Key:", clientId);
    console.log(
      "카카오 토큰 교환 - Client Secret:",
      clientSecret ? "설정됨" : "없음",
    );
  }

  if (!redirectUri || !clientId) {
    return redirectToHome("?login_error=1");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });

  // Client Secret이 있으면 반드시 전달해야 함 (카카오 앱 설정에 따라 필수)
  if (clientSecret) {
    params.set("client_secret", clientSecret);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok) {
      return redirectToHome("?login_error=1");
    }

    const accessToken = data.access_token;
    if (!accessToken) {
      return redirectToHome("?login_error=1");
    }

    return redirectWithLoginSuccess(accessToken);
  } catch {
    return redirectToHome("?login_error=1");
  }
}
