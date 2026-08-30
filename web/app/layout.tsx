import type { Metadata, Viewport } from "next";
import { DM_Sans, Syne } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { CHAIN } from "@/lib/chain";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";
import { Providers } from "./providers";

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const display = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ubu-Tangaza | Grow your business through trackable referrals",
  description:
    "Reward your customers for what they do for your business — bringing you clients, referring friends, spreading the word. Proof behind every action, and a reward budget you control.",
};

export const viewport: Viewport = {
  themeColor: "#050b18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      {/*
       * Signing in blocks on two round trips to two different origins: the in-app
       * wallet's auth API, then an RPC read to work out the advocate's smart-account
       * address. On a phone in Nairobi each cold DNS+TLS handshake costs a few hundred
       * ms that the browser only starts paying when the user taps. Opening the sockets
       * while the welcome screen paints takes that off the sign-in path.
       */}
      <link rel="preconnect" href="https://embedded-wallet.thirdweb.com" crossOrigin="" />
      <link rel="preconnect" href={`https://${CHAIN.id}.rpc.thirdweb.com`} crossOrigin="" />
      <body className="app-glow font-sans">
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
        <Providers>
          <div className="relative z-10">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
