import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ApiProvider } from "./contexts/ApiContext";
import { WeddingProvider } from "./contexts/WeddingContext";
import ApiLoadingOverlay from "@/app/components/ApiLoadingOverlay";
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
          <ClickSpark
            sparkColor="#FFAAB8"
            sparkSize={10}
            sparkRadius={15}
            sparkCount={8}
            duration={400}
          >
            <WeddingProvider>{children}</WeddingProvider>
          </ClickSpark>
          <ApiLoadingOverlay />
        </ApiProvider>
      </body>
    </html>
  );
}
