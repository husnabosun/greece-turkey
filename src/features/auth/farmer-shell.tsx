"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { House, Sprout, Camera, ScrollText, ShoppingBasket } from "lucide-react";
import { AppShell } from "@/shared/components/app-shell";

export function FarmerShell({ children }: { children: ReactNode }) {
  const t = useTranslations("farmerNav");

  return (
    <AppShell
      brand="AgroPulse"
      links={[
        { href: "/farmer/dashboard", label: t("home"), icon: House, circle: "primary" },
        { href: "/farmer/fields", label: t("fields"), icon: Sprout, circle: "primary" },
        { href: "/farmer/scan", label: t("scan"), icon: Camera, circle: "primary" },
        { href: "/farmer/logbook", label: t("logbook"), icon: ScrollText, circle: "ink" },
        { href: "/farmer/market", label: t("market"), icon: ShoppingBasket, circle: "ink" },
      ]}
    >
      {children}
    </AppShell>
  );
}
