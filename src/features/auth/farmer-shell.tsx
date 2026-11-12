"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Home, Map, ScanLine, BookOpen, ShoppingBag, BadgeCheck } from "lucide-react";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { LocaleSwitcher } from "@/shared/components/locale-switcher";

const TABS = [
  { href: "/farmer/dashboard", key: "home", icon: Home },
  { href: "/farmer/fields", key: "fields", icon: Map },
  { href: "/farmer/scan", key: "scan", icon: ScanLine },
  { href: "/farmer/logbook", key: "logbook", icon: BookOpen },
  { href: "/farmer/market", key: "market", icon: ShoppingBag },
] as const;

export function FarmerShell({ children }: { children: ReactNode }) {
  const t = useTranslations("farmerNav");
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <BadgeCheck className="size-4" aria-hidden />
          </span>
          <span>Agro Pulse</span>
        </div>
        <LocaleSwitcher />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
          {TABS.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium",
                  active ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
