import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const kakaoToken = request.cookies.get("kakao_access_token")?.value;
  if (!kakaoToken) {
    return NextResponse.json(
      { error: "카카오 토큰이 없습니다. 먼저 카카오 로그인을 진행해 주세요." },
      { status: 401 },
    );
  }

  const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "API_BASE_URL이 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const url = `${baseUrl.replace(/\/$/, "")}/plan/auth/kakao/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ kakaoToken }),
    });

    const data = (await res.json()) as {
      data?: { token?: string };
      result?: boolean;
    };

    if (!res.ok) {
      return NextResponse.json(
        { error: data && typeof data === "object" ? data : "로그인 요청 실패" },
        { status: res.status },
      );
    }

    const token = data?.data?.token;
    if (!token) {
      return NextResponse.json(
        { error: "토큰을 받지 못했습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json({ token });
  } catch (e) {
    const message = e instanceof Error ? e.message : "로그인 요청 중 오류";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
