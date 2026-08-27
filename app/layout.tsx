import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
import "./globals.css";
import { ApiProvider } from "./contexts/ApiContext";
import { WeddingProvider } from "./contexts/WeddingContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import ApiErrorModal from "./components/ApiErrorModal";
import ApiLoadingOverlay from "./components/ApiLoadingOverlay";
import SessionExpiredModal from "./components/SessionExpiredModal";
import AuthRedirectToMain from "./components/AuthRedirectToMain";
import GuestGate from "./components/GuestGate";

const hakgyoansim = localFont({
  src: [
    {
      path: "../public/font/woff2/Hakgyoansim-Dunggeunmiso-TTF-R.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/woff2/Hakgyoansim-Dunggeunmiso-TTF-B.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-dunggeunmiso",
  display: "swap",
});

const tmoney = localFont({
  src: [
    {
      path: "../public/font/woff2/TmoneyRoundWindRegular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/woff2/TmoneyRoundWindRegular.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/font/woff2/TmoneyRoundWindExtraBold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/font/woff2/TmoneyRoundWindExtraBold.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-tmoney",
  display: "swap",
});

const kakao = localFont({
  src: [
    {
      path: "../public/font/woff2/KakaoSmallSans-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/font/woff2/KakaoSmallSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/woff2/KakaoSmallSans-Regular.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/font/woff2/KakaoSmallSans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/font/woff2/KakaoSmallSans-Bold.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-kakao",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://wedding-plant.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Wedding Plant",
  title: "웨딩 플랜트 - 우리만의 완벽한 셀프 웨딩 예산 관리",
  verification: {
    google: "89hMDRNVKvw-QiX9s9bk64ZTcJOYqoRuWsIdfutI0q8",
  },
  description:
    "복잡한 결혼 준비, 웨딩 플랜트와 함께 쉽고 체계적으로 예산을 관리하고 일정을 세워보세요.",
  keywords: [
    "웨딩",
    "결혼 준비",
    "웨딩 예산",
    "셀프 웨딩",
    "웨딩 플래너",
    "결혼 예산 관리",
  ],
  openGraph: {
    title: "웨딩 플랜트 - 스마트한 결혼 준비",
    description: "우리만의 완벽한 셀프 웨딩 예산 관리",
    siteName: "Wedding Plant",
    url: siteUrl,
    locale: "ko_KR",
    type: "website",
  },
  alternates: {
    canonical: siteUrl,
  },
  /*
    아이폰 홈 화면에 추가했을 때 사파리 껍데기 없이 열리게 한다.
    iOS 앱을 당장 내지 않기로 해서 아이폰 사용자에게는 이게 곧 앱이다.
    title 을 따로 주는 이유: 안 주면 metadata.title 전체(부제 포함)가
    아이콘 밑에 들어가 잘린다.
  */
  appleWebApp: {
    capable: true,
    title: "웨딩 플랜트",
    statusBarStyle: "default",
  },
};

/*
  themeColor 는 metadata 가 아니라 viewport 로 내보내야 한다(Next 15+).
  안드로이드 크롬 주소창과 홈 화면 추가 시 상단 색이 앱 primary 로 맞는다.

  viewportFit 은 일부러 두지 않는다. `cover` 로 바꾸면 노치 밖까지 그리게
  되어 safe-area 패딩을 화면마다 다시 잡아야 하고, 하단 탭바가 홈 인디케이터에
  가린다. 기본값이면 iOS 가 알아서 안전 영역 안에 그린다.
*/
export const viewport: Viewport = {
  themeColor: "#ee2b8c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Wedding Plant",
    alternateName: "웨딩 플랜트",
    url: siteUrl,
    description: "우리만의 완벽한 셀프 웨딩 예산 관리",
  };

  return (
    <html lang="ko">
      <body
        className={`${hakgyoansim.className} ${hakgyoansim.variable} ${tmoney.variable} ${kakao.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ApiProvider>
          <AuthRedirectToMain />
          <Suspense fallback={null}>
            <GuestGate />
          </Suspense>
          <NotificationProvider>
            <WeddingProvider>
              {children}
              <SpeedInsights />
              <ApiLoadingOverlay />
              <SessionExpiredModal />
              <Suspense fallback={null}>
                <ApiErrorModal />
              </Suspense>
              {process.env.NODE_ENV === "production" &&
                process.env.NEXT_PUBLIC_GA_ID && (
                  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
                )}
              {/*
                Microsoft Clarity — 세션 녹화·히트맵·분노 클릭. 사용자 인터뷰를
                대신하는 자리라, GA 가 "몇 명이 어디서 빠졌나" 를 세면 이쪽은
                "왜 빠졌나" 를 보여 준다. 무료라 표본을 줄일 이유가 없다.

                afterInteractive 로 둔다. 지표 스크립트가 첫 화면 그리는 걸
                늦추면 정작 측정하려는 이탈을 스스로 만든다.
              */}
              {process.env.NODE_ENV === "production" &&
                process.env.NEXT_PUBLIC_CLARITY_ID && (
                  <Script id="ms-clarity" strategy="afterInteractive">
                    {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`}
                  </Script>
                )}
            </WeddingProvider>
          </NotificationProvider>
        </ApiProvider>
      </body>
    </html>
  );
}
