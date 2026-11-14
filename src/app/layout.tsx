import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/core/config/constants";
import "./globals.css";

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

/**
 * Root shell — `<html>` / `<body>` live in `[locale]/layout` so `lang`
 * can follow the active locale. Fonts are loaded there too.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
