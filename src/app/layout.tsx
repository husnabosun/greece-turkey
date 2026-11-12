import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { APP_NAME } from "@/core/config/constants";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "greek"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "AgriTech & B2B olive oil supply-chain platform for Mediterranean growers and processors.",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/** Root shell — locale-specific UI lives under `app/[locale]`. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="el" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} min-h-dvh antialiased`}>
        {children}
      </body>
    </html>
  );
}
