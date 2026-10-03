import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_SC, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// Latin + CJK coverage so Spanish, Chinese and Korean all render cleanly (§5.9).
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto",
  display: "swap",
});
const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sc",
  display: "swap",
});
const notoKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Haggle",
  description: "Speak to it in your language. It negotiates in English on your behalf.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${notoSans.variable} ${notoSC.variable} ${notoKR.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
