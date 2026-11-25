import type { Metadata, Viewport } from "next";
import { Anton, DM_Sans, Fraunces, JetBrains_Mono, Syne } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { CONTACT } from "@/lib/contact";
import { RPC_URL } from "@/lib/rpc";
import {
  SHARE_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  X_HANDLE,
  X_PROFILE,
} from "@/lib/seo";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";
import { Providers } from "./providers";

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Syne (the BrandMark and the headings on the sign-in, waitlist and legal screens) and
// Fraunces (campaign page headings) appear on neither the landing page nor /pricing, so
// they are not preloaded: a preload is fetched on every page whether or not the font is
// used there. They still load, fallback first, on the screens that do use them.
const display = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  preload: false,
});

// The landing's poster type: one heavy condensed weight, used nowhere else.
const poster = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  preload: false,
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
  weight: ["400", "500"],
});

const HOME_TITLE = `${SITE_NAME} | ${SITE_TAGLINE}`;

// Ownership checks for Google Search Console and Bing Webmaster Tools: set the variable
// to the code each one gives you and redeploy. Unset means no tag at all.
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();

// No `alternates.canonical` here on purpose: a canonical in the root layout is inherited
// by every page and would point them all at one URL. Each page sets its own through
// pageMetadata() in lib/seo.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_KE",
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: X_HANDLE,
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  ...(googleVerification || bingVerification
    ? {
        verification: {
          ...(googleVerification ? { google: googleVerification } : {}),
          ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
        },
      }
    : {}),
};

/**
 * Who runs the site and what it is called, for search engines. The alternate names are
 * the point: people type the brand as one word ("ubutangaza", as in the domain), and
 * this is where a search engine learns that spelling and "Ubu-Tangaza" are one name.
 * No SearchAction, because the site has no search.
 */
const ALTERNATE_NAMES = ["Ubutangaza", "UbuTangaza", "Ubu Tangaza"];
const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: ALTERNATE_NAMES,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      description: SITE_DESCRIPTION,
      sameAs: [X_PROFILE],
      areaServed: "KE",
      email: CONTACT.email,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: CONTACT.email,
        areaServed: "KE",
        availableLanguage: "en",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: ALTERNATE_NAMES,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en-KE",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#131008",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable} ${serif.variable} ${poster.variable}`} suppressHydrationWarning>
      {/*
       * Signing in blocks on two round trips to two different origins: the in-app
       * wallet's auth API, then an RPC read to work out the advocate's smart-account
       * address. On a phone in Nairobi each cold DNS+TLS handshake costs a few hundred
       * ms that the browser only starts paying when the user taps. Opening the sockets
       * while the welcome screen paints takes that off the sign-in path.
       */}
      <link rel="preconnect" href="https://embedded-wallet.thirdweb.com" crossOrigin="" />
      <link rel="preconnect" href={new URL(RPC_URL).origin} crossOrigin="" />
      <body className="app-glow font-sans">
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
        <JsonLd data={SITE_JSON_LD} />
        <Providers>
          <div className="relative z-10">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
