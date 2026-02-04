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
import ClickSpark from "@/components/ClickSpark";

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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "우리 플랜트",
  description: "우리만의 우리 플랜, 지금 시작해요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${hakgyoansim.className} ${hakgyoansim.variable} ${geistMono.variable} antialiased`}
      >
        <ApiProvider>
          <AuthRedirectToMain />
          <ClickSpark
            sparkColor="#FFAAB8"
            sparkSize={10}
            sparkRadius={15}
            sparkCount={8}
            duration={400}
          >
            <WeddingProvider>
              {children}
              <ApiLoadingOverlay />
              <Suspense fallback={null}>
                <ApiErrorModal />
              </Suspense>
            </WeddingProvider>
          </ClickSpark>
        </ApiProvider>
      </body>
    </html>
  );
}
