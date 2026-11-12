"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Boxes, Handshake, Truck } from "lucide-react";
import { AppShell } from "@/shared/components/app-shell";

export function ProcessorShell({ children }: { children: ReactNode }) {
  const t = useTranslations("processorNav");

  return (
    <AppShell
      brand="Agro Pulse · B2B"
      links={[
        { href: "/processor/overview", label: t("overview"), icon: LayoutDashboard },
        { href: "/processor/lots", label: t("lots"), icon: Boxes },
        { href: "/processor/offers", label: t("offers"), icon: Handshake },
        { href: "/processor/deliveries", label: t("deliveries"), icon: Truck },
      ]}
    >
      {children}
    </AppShell>
  );
}
