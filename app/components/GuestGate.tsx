"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/api";

/**
 * 앱 화면과 온보딩은 **로그인한 사람만** 들어올 수 있게 한다.
 *
 * 예전에는 "로그인 없이 둘러보기" 가 있어서, 온보딩(`/setting`)만 마치면
 * 토큰 없이도 앱이 열렸다. 그 모드를 없앴다 — 이제 들어오는 길은 카카오
 * 로그인 하나다.
 *
 * 막을 곳 목록을 여기 한 곳에 두는 이유는 화면마다 같은 effect 를 복사하면
 * 새 화면을 만들 때 빠뜨리기 때문이다. 예전에 `/main` 에만 검사가 있어서
 * `/calendar` 로 주소를 바로 치면 그대로 열린 적이 있다.
 */
const GUARDED = [
  "/main",
  "/calendar",
  "/plan-list",
  "/feed",
  "/brag",
  "/budget-detail",
  "/user",
  "/add-plen",
  "/schedule-detail",
  "/chat",
];

/** 온보딩. 로그인 전에는 물을 것이 없다 — 답을 저장할 곳이 없다 */
const ONBOARDING = "/setting";

/**
 * 막지 않는 곳
 *  - `/`, `/login`   : 들어오는 문
 *  - `/privacy`      : 로그인 없이 봐야 하는 문서 (스토어 심사·크롤러)
 *  - `/share/…`      : 초대받은 사람이 처음 닿는 곳. 거기서 로그인을 권한다
 *  - `?share=…`      : 공유 코드를 들고 들어온 경우도 같다
 */
export default function GuestGate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isOnboarding = pathname === ONBOARDING;
    const isApp = GUARDED.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (!isOnboarding && !isApp) return;
    // 카카오 콜백 착지 중에는 토큰 교환이 아직 안 끝났다.
    // 이 구간의 라우팅은 KakaoLoginAlert 가 끝까지 책임진다.
    if (searchParams.has("kakao_login")) return;
    if (getToken()) return;
    if (searchParams.get("share")?.trim()) return;

    if (isOnboarding) {
      // 앱을 아직 모르는 사람이다. 로그인 화면("다시 오셨네요")보다 랜딩이 맞다.
      router.replace("/");
      return;
    }
    /*
      복귀 경로는 **저장하지 않는다.** `KakaoLoginAlert` 에서 복귀 경로가
      "신규 사용자 → /setting" 보다 앞서서, 처음 온 사람이 주소로 `/calendar`
      를 치고 로그인하면 온보딩을 건너뛴 빈 앱에 떨어진다. 세션이 끊겨서
      나간 경우의 복귀 경로는 `ApiContext` 가 401 을 받을 때 이미 적어 둔다.
    */
    router.replace("/login");
  }, [pathname, searchParams, router]);

  return null;
}
