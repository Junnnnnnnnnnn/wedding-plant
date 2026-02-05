/* access_token을 사용해라 그냥 code 말고! */
import { NextRequest, NextResponse } from "next/server";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const redirectToHome = (query?: string) => {
    const url = new URL("/", request.url);
    if (query) url.search = query;
    return NextResponse.redirect(url);
  };

  const redirectWithLoginSuccess = (kakaoToken: string) => {
    // 로그인 직후 항상 /setting으로 이동. KakaoLoginAlert가 플랜 데이터 확인 후
    // 있으면 /main으로 리다이렉트, 없으면 /setting에 머뭄
    const url = new URL("/setting", request.url);
    url.search = "kakao_login=1";
    url.hash = `kakao_token=${encodeURIComponent(kakaoToken)}`;
    return NextResponse.redirect(url.toString());
  };

  if (error) {
    return redirectToHome("?login_error=1");
  }

  if (!code || typeof code !== "string") {
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
