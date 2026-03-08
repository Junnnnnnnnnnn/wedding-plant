import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { ApiProvider } from "./contexts/ApiContext";
import { WeddingProvider } from "./contexts/WeddingContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import ApiErrorModal from "./components/ApiErrorModal";
import ApiLoadingOverlay from "./components/ApiLoadingOverlay";
import AuthRedirectToMain from "./components/AuthRedirectToMain";

const hakgyoansim = localFont({
  src: [
    {
      path: "../public/font/Hakgyoansim Dunggeunmiso TTF R.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/Hakgyoansim Dunggeunmiso TTF B.ttf",
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
      path: "../public/font/TmoneyRoundWindRegular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/TmoneyRoundWindRegular.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/font/TmoneyRoundWindExtraBold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/font/TmoneyRoundWindExtraBold.ttf",
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
      path: "../public/font/KakaoSmallSans-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/font/KakaoSmallSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/KakaoSmallSans-Regular.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/font/KakaoSmallSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/font/KakaoSmallSans-Bold.ttf",
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
          <NotificationProvider>
            <WeddingProvider>
              {children}
              <SpeedInsights />
              <ApiLoadingOverlay />
              <Suspense fallback={null}>
                <ApiErrorModal />
              </Suspense>
              {process.env.NODE_ENV === "production" &&
                process.env.NEXT_PUBLIC_GA_ID && (
                  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
                )}
            </WeddingProvider>
          </NotificationProvider>
        </ApiProvider>
      </body>
    </html>
  );
}
