import { NextRequest, NextResponse } from "next/server";

const KAKAO_USER_ME_URL = "https://kapi.kakao.com/v2/user/me";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("kakao_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: "액세스 토큰이 없습니다." },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(KAKAO_USER_ME_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: data.msg ?? data.error_description ?? "사용자 정보 조회 실패",
        },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "사용자 정보 조회 중 오류가 발생했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
