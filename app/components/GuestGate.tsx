"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getToken, HAS_COMPLETED_GUEST_SETTING_KEY } from "@/lib/api";

/**
 * 앱 화면은 **온보딩을 마친 뒤에만** 들어갈 수 있게 한다.
 *
 * 예전에는 `/main` 에만 이 검사가 있었다. 그래서 게스트가 `/calendar` 나
 * `/feed` 로 주소를 바로 치면 이름도 결혼 날짜도 예산도 없는 채로 앱이
 * 열렸고, 거기서 레일의 "홈" 을 누르면 그제서야 튕겨 나갔다.
 *
 * 막을 곳은 **온보딩이 채우는 값에 기대는 화면 전부**다. 목록을 여기 한 곳에
 * 두는 이유는 화면마다 같은 effect 를 복사하면 새 화면을 만들 때 빠뜨리기
 * 때문이다 (`AuthRedirectToMain` 과 같은 자리, 같은 이유).
 *
 * 보내는 곳은 **`/setting`(온보딩)이지 `/`(랜딩)가 아니다.** 랜딩으로 보내면
 * 앱을 쓰려던 사람이 앱 밖으로 밀려난다.
 */
const GUARDED = [
  "/main",
  "/calendar",
  "/plan-list",
  "/feed",
  "/budget-detail",
  "/user",
  "/add-plen",
  "/schedule-detail",
  "/chat",
];

/**
 * 막지 않는 곳
 *  - `/`, `/setting` : 들어오는 문
 *  - `/privacy`      : 로그인 없이 봐야 하는 문서 (스토어 심사·크롤러)
 *  - `/share/…`      : 초대받은 사람이 처음 닿는 곳. 여기서 막으면 초대가 끊긴다
 *  - `?share=…`      : 공유 코드를 들고 들어온 경우도 같다
 */
export default function GuestGate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!GUARDED.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
      return;
    // 카카오 콜백 착지 중에는 토큰 교환이 아직 안 끝났다.
    // 이 구간의 라우팅은 KakaoLoginAlert 가 끝까지 책임진다.
    if (searchParams.has("kakao_login")) return;
    if (getToken()) return;
    if (searchParams.get("share")?.trim()) return;
    if (sessionStorage.getItem(HAS_COMPLETED_GUEST_SETTING_KEY) === "1") return;
    router.replace("/setting");
  }, [pathname, searchParams, router]);

  return null;
}
