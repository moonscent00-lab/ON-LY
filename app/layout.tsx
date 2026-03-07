import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/top-nav";

const ibmSans = IBM_Plex_Sans_KR({
  variable: "--font-ibm-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ON:LY Recod On:",
  description: "흩어진 정보를 하나로 모으는 개인/공유 다이어리 OS",
  icons: {
    icon: [{ url: "/favicon.png?v=2", type: "image/png" }],
    shortcut: "/favicon.png?v=2",
    apple: "/favicon.png?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${ibmSans.variable} ${ibmMono.variable} antialiased`}>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
