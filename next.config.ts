import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Legacy Expo prototype is reference-only; keep it out of the Next compiler graph.
  turbopack: {
    resolveAlias: {},
  },
};

export default withNextIntl(nextConfig);
