import type { Metadata } from "next";
import { Inter, DM_Mono, Space_Grotesk } from "next/font/google";
import { ClientProviders } from "@/components/ClientProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StockLens — AI Stock Research Platform",
  description:
    "Professional-grade AI stock research. Real financials, SEC filings, earnings intelligence, and political trading activity — all cited.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
