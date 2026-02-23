import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ApiProvider } from "./contexts/ApiContext";
import { WeddingProvider } from "./contexts/WeddingContext";
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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "웨딩 플랜트",
  description: "우리만의 웨딩 플랜, 지금 시작해요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${hakgyoansim.className} ${hakgyoansim.variable} ${tmoney.variable} ${geistMono.variable} antialiased`}
      >
        <ApiProvider>
          <AuthRedirectToMain />
          <WeddingProvider>
            {children}
            <ApiLoadingOverlay />
            <Suspense fallback={null}>
              <ApiErrorModal />
            </Suspense>
          </WeddingProvider>
        </ApiProvider>
      </body>
    </html>
  );
}
