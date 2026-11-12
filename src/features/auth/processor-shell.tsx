"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Boxes, Handshake, Truck } from "lucide-react";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { LocaleSwitcher } from "@/shared/components/locale-switcher";

const LINKS = [
  { href: "/processor/overview", key: "overview", icon: LayoutDashboard },
  { href: "/processor/lots", key: "lots", icon: Boxes },
  { href: "/processor/offers", key: "offers", icon: Handshake },
  { href: "/processor/deliveries", key: "deliveries", icon: Truck },
] as const;

export function ProcessorShell({ children }: { children: ReactNode }) {
  const t = useTranslations("processorNav");
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col md:flex-row">
        <aside className="border-b bg-background md:w-56 md:border-r md:border-b-0">
          <div className="flex items-center justify-between gap-2 px-4 py-4 md:flex-col md:items-stretch">
            <div className="font-extrabold tracking-tight">Agro Pulse · B2B</div>
            <LocaleSwitcher />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:px-3">
            {LINKS.map(({ href, key, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap",
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(key)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
