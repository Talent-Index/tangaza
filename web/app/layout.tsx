import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CHAIN } from "@/lib/chain";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Ubu-Tangaza — get paid for the word you spread",
  description:
    "Proof-of-advocacy rewards on Avalanche. Businesses reward real advocacy from a capped budget that can never grow.",
};

export const viewport: Viewport = {
  themeColor: "#08080c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
       * Signing in blocks on two round trips to two different origins: the in-app
       * wallet's auth API, then an RPC read to work out the advocate's smart-account
       * address. On a phone in Nairobi each cold DNS+TLS handshake costs a few hundred
       * ms that the browser only starts paying when the user taps. Opening the sockets
       * while the welcome screen paints takes that off the sign-in path.
       */}
      <link rel="preconnect" href="https://embedded-wallet.thirdweb.com" crossOrigin="" />
      <link rel="preconnect" href={`https://${CHAIN.id}.rpc.thirdweb.com`} crossOrigin="" />
      <body className="app-glow">
        <Providers>
          <div className="relative z-10">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
