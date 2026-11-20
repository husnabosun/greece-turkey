import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Inter, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/shared/components/ui/sonner";
import { routing } from "@/shared/i18n/routing";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster richColors closeButton position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
