import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TestnetBanner } from "@/components/TestnetBanner";
import { SplashIntro } from "@/components/SplashIntro";

export const metadata: Metadata = {
  title: "Parabola — launch tokens on Arc",
  description:
    "Launch meme and builder tokens on Arc with USDC-denominated bonding curves that graduate permissionlessly to a public DEX pool. No admin can touch a live launch's funds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <SplashIntro />
          <TestnetBanner />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
