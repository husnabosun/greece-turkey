"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Home, Map, ScanLine, BookOpen, ShoppingBag } from "lucide-react";
import { AppShell } from "@/shared/components/app-shell";

export function FarmerShell({ children }: { children: ReactNode }) {
  const t = useTranslations("farmerNav");

  return (
    <AppShell
      brand="Agro Pulse"
      links={[
        { href: "/farmer/dashboard", label: t("home"), icon: Home },
        { href: "/farmer/fields", label: t("fields"), icon: Map },
        { href: "/farmer/scan", label: t("scan"), icon: ScanLine },
        { href: "/farmer/logbook", label: t("logbook"), icon: BookOpen },
        { href: "/farmer/market", label: t("market"), icon: ShoppingBag },
      ]}
    >
      {children}
    </AppShell>
  );
}
