import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Noto_Sans_SC, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// Inter Tight (body) + Instrument Serif (headings) stand in for the Mecha
// reference's commercial faces. Self-hosted from Google Fonts' hinted builds
// (OFL, see app/fonts/): next/font/google ships unhinted files, which get
// uneven letter spacing at small sizes on Linux/Windows.
// Noto SC/KR give Chinese and Korean coverage (§5.9).
const interTight = localFont({
  src: "./fonts/InterTight-latin.woff2",
  weight: "100 900",
  variable: "--font-inter-tight",
  display: "swap",
});
const instrumentSerif = localFont({
  src: "./fonts/InstrumentSerif-latin.woff2",
  weight: "400",
  variable: "--font-instrument-serif",
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

// viewport-fit=cover makes env(safe-area-inset-*) non-zero on notched phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#15171d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables live on <html> so the :root font stacks in globals.css can use them.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interTight.variable} ${instrumentSerif.variable} ${notoSC.variable} ${notoKR.variable}`}
    >
      <head>
        {/* Inside the website's /demo phone (an iframe), mark the page before
            first paint so the app's own header is hidden without a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(window.self!==window.top)document.documentElement.setAttribute("data-embedded","")}catch(e){document.documentElement.setAttribute("data-embedded","")}',
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
