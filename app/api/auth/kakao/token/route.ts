import { NextRequest, NextResponse } from "next/server";

import { KAKAO_TOKEN_COOKIE } from "../state";

/**
 * 콜백이 쿠키에 넣어둔 카카오 access_token 을 한 번만 꺼내 준다.
 *
 * 예전에는 콜백이 토큰을 URL fragment(#kakao_token=...)로 넘겼다.
 * fragment 는 Referer 로는 안 새지만, 서버가 내보내는 Location 응답
 * 헤더에는 평문으로 들어가 CDN·플랫폼 액세스 로그에 남는다.
 * 이제 httpOnly 쿠키로 넘기고 이 라우트에서 회수한 뒤 즉시 지운다.
 */
export async function GET(request: NextRequest) {
  const kakaoToken = request.cookies.get(KAKAO_TOKEN_COOKIE)?.value ?? "";

  const response = NextResponse.json(
    kakaoToken ? { kakaoToken } : { error: "no_token" },
    { status: kakaoToken ? 200 : 404 },
  );

  // 한 번 쓰면 바로 폐기한다
  response.cookies.set(KAKAO_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
