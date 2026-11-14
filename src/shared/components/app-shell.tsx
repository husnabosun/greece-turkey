"use client";

import type { ComponentType, ReactNode } from "react";
import { Leaf } from "lucide-react";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { SignOutButton } from "@/features/auth/sign-out-button";

export type AppShellLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;
  /** Legacy: Home/Field/Scan use dark green; Logbook/Market use ink. */
  circle?: "primary" | "ink";
};

type Props = {
  brand: string;
  links: AppShellLink[];
  children: ReactNode;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Farmer chrome: no top app bar (demo). Language + sign-out live in Home settings. */
export function AppShell({ brand, links, children }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh bg-background text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="size-4" aria-hidden />
          </span>
          <p className="truncate text-sm font-extrabold tracking-tight">{brand}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-full px-3 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-good-soft hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <SignOutButton className="w-full justify-start" />
        </div>
      </aside>

      <div className="flex min-h-dvh w-full flex-1 flex-col md:pl-60">
        <main className="flex w-full min-h-0 flex-1 flex-col px-4 pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-4 md:pb-6">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white md:hidden">
        <div
          className="mx-auto grid w-full px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
          style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
        >
          {links.map(({ href, label, icon: Icon, circle = "primary" }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className="flex min-h-14 flex-col items-center justify-start gap-0.5 px-1"
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full",
                    active && (circle === "ink" ? "bg-ink text-white" : "bg-primary text-white"),
                  )}
                >
                  <Icon
                    className={cn("size-[22px]", active ? "text-white" : "text-[#444]")}
                    strokeWidth={active ? 2.2 : 1.8}
                    aria-hidden
                  />
                </span>
                <span
                  className={cn(
                    "text-ap-small",
                    active ? "font-bold text-ink" : "font-medium text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
