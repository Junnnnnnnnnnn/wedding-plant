/* access_token을 사용해라 그냥 code 말고! */
import { NextRequest, NextResponse } from "next/server";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const redirectToHome = (query?: string) => {
    const url = new URL("/", request.url);
    if (query) url.search = query;
    return NextResponse.redirect(url);
  };

  const redirectToHomeWithLoginSuccess = () => redirectToHome("?kakao_login=1");

  if (error) {
    return redirectToHome(
      `?error=${encodeURIComponent(errorDescription ?? error)}`,
    );
  }

  if (!code || typeof code !== "string") {
    return redirectToHome("?error=인증_코드가_없습니다");
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
    return redirectToHome("?error=인증_설정_오류");
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
    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok) {
      const errorMsg = data.error_description ?? data.error ?? "토큰 발급 실패";
      return redirectToHome(`?error=${encodeURIComponent(errorMsg)}`);
    }

    const accessToken = data.access_token;
    if (!accessToken) {
      return redirectToHome("?error=액세스_토큰이_없습니다");
    }

    const res = redirectToHomeWithLoginSuccess();
    res.cookies.set("kakao_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    if (data.refresh_token) {
      res.cookies.set("kakao_refresh_token", data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
    return res;
  } catch (e) {
    const errorMsg =
      e instanceof Error ? e.message : "토큰 처리 중 오류가 발생했습니다";
    return redirectToHome(`?error=${encodeURIComponent(errorMsg)}`);
  }
}
