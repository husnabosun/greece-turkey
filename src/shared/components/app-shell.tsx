"use client";

import type { ComponentType, ReactNode } from "react";
import { BadgeCheck } from "lucide-react";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { LocaleSwitcher } from "@/shared/components/locale-switcher";
import { SignOutButton } from "@/features/auth/sign-out-button";

export type AppShellLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

type Props = {
  brand: string;
  links: AppShellLink[];
  children: ReactNode;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Responsive chrome: phone bottom tabs + compact header;
 * desktop full-viewport left sidebar + wide main.
 */
export function AppShell({ brand, links, children }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            <BadgeCheck className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{brand}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <SignOutButton className="w-full justify-start" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <BadgeCheck className="size-4" aria-hidden />
          </span>
          <span className="truncate">{brand}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      {/* Main column */}
      <div className="md:pl-60">
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b bg-background/95 px-8 py-3 backdrop-blur md:flex">
          <p className="text-sm text-muted-foreground">Agro Pulse AI</p>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <SignOutButton />
          </div>
        </header>
        <main className="w-full flex-1 px-4 py-4 pb-24 md:px-8 md:py-8 md:pb-10 lg:px-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur md:hidden">
        <div
          className="mx-auto grid gap-1 px-2 py-2"
          style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium",
                  active ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
