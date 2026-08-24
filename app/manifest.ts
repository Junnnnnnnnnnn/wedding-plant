import type { MetadataRoute } from "next";

/**
 * PWA manifest.
 *
 * iOS 앱을 당장 내지 않기로 해서, 아이폰 사용자는 **웹이 유일한 통로**다.
 * 홈 화면에 추가했을 때 사파리 주소창이 그대로 뜨면 웹사이트로 남고,
 * `display: "standalone"` 이라야 앱처럼 열린다.
 *
 * 아이콘은 흰 바탕으로 구워 둔다 — `app/icon.png` 는 배경이 투명이라
 * 런처가 검은 판 위에 얹으면 로고가 묻힌다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "웨딩 플랜트",
    short_name: "웨딩플랜트",
    description: "결혼 준비 예산과 일정을 둘이 함께 한곳에서",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ee2b8c",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // 안드로이드 런처가 원형·둥근사각으로 잘라 쓰는 판. 로고 둘레에
      // 여백을 넉넉히 두고 구웠으므로 잘려도 하트와 연필이 살아 있다.
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
