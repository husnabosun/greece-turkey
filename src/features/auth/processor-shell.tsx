"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, ClipboardList, LayoutDashboard, Search, Truck, type LucideIcon } from "lucide-react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { Initials, initialsOf } from "@/features/marketplace/processor-kit";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";

type NavItem = { labelKey: "overview" | "findOlives" | "requests" | "deliveries"; href: string; Icon: LucideIcon };

const NAV: NavItem[] = [
  { labelKey: "overview", href: "/processor/overview", Icon: LayoutDashboard },
  { labelKey: "findOlives", href: "/processor/lots", Icon: Search },
  { labelKey: "requests", href: "/processor/requests", Icon: ClipboardList },
  { labelKey: "deliveries", href: "/processor/deliveries", Icon: Truck },
];

function isActive(pathname: string, href: string) {
  if (href === "/processor/overview") {
    return pathname === "/processor" || pathname === "/processor/" || pathname === "/processor/overview";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center bg-ink"
        style={{ width: size, height: size, borderRadius: size * 0.3 }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" aria-hidden>
          <path
            d="M4 19 L12 5 L20 19"
            stroke="#B9E09A"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </span>
      <span className="text-[16px] leading-5 font-extrabold text-ink">AgroPulse</span>
    </span>
  );
}

function NavPill({ href, label, Icon, active }: { href: string; label: string; Icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex h-11 shrink-0 items-center gap-2.5 rounded-full px-3.5", active ? "bg-ink" : "hover:bg-soft")}
    >
      <Icon className={cn("size-[18px]", active ? "text-white" : "text-ink")} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
      <span className={cn("text-[14px] leading-[18px] font-bold", active ? "text-white" : "text-ink")}>{label}</span>
    </Link>
  );
}

function SwitchView({ label, className }: { label: string; className?: string }) {
  return (
    <Link
      href="/farmer/dashboard"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full text-[13px] leading-[18px] font-semibold text-muted-foreground hover:bg-white/60",
        className,
      )}
    >
      <ArrowLeftRight className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}

export function ProcessorShell({ children }: { children: ReactNode }) {
  const t = useTranslations("processorNav");
  const pathname = usePathname();
  const fallback = t("processorFallback");
  const [company, setCompany] = useState(fallback);
  const [initials, setInitials] = useState("PR");

  const nav = useMemo(
    () =>
      NAV.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [t],
  );

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, display_name")
        .eq("id", user.id)
        .maybeSingle();
      const name =
        (profile?.company_name as string | null)?.trim() ||
        (profile?.display_name as string | null)?.trim() ||
        user.email?.split("@")[0] ||
        fallback;
      setCompany(name);
      setInitials(initialsOf(name) || "PR");
    })();
  }, [fallback]);

  const panel = t("processorPanel");

  return (
    <div className="min-h-dvh bg-background text-ink">
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-line bg-card px-4 py-5 min-[900px]:flex"
        aria-label={panel}
      >
        <Logo />
        <div className="mt-6 flex items-center gap-2.5 rounded-2xl bg-background p-2.5">
          <Initials text={initials} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-[18px] font-extrabold text-ink">{company}</p>
            <p className="text-[11px] leading-[14px] font-medium text-muted-foreground">{panel}</p>
          </div>
        </div>
        <nav className="mt-5 flex flex-col gap-1">
          {nav.map((item) => (
            <NavPill
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
              active={isActive(pathname, item.href)}
            />
          ))}
        </nav>
        <div className="flex-1" />
        <SwitchView label={t("switchView")} className="self-start px-0" />
      </aside>

      <div className="border-b border-line bg-card px-4 pt-3 pb-3 min-[900px]:hidden">
        <div className="flex items-center justify-between">
          <Logo size={30} />
          <SwitchView label={t("switchView")} className="px-2" />
        </div>
        <p className="mt-1 truncate text-[11px] leading-[14px] font-medium text-muted-foreground">
          {`${company} · ${panel}`}
        </p>
        <nav className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav.map((item) => (
            <NavPill
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
              active={isActive(pathname, item.href)}
            />
          ))}
        </nav>
      </div>

      <div className="flex min-h-dvh flex-1 flex-col min-[900px]:pl-[240px]">
        <main className="flex w-full flex-1 flex-col px-4 pt-4 pb-10 min-[900px]:px-6 min-[900px]:pt-6 min-[900px]:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
