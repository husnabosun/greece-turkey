"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeftRight,
  ChevronUp,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Search,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { Initials, initialsOf } from "@/features/marketplace/processor-kit";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
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

function UserMenu({
  company,
  panel,
  switchLabel,
  logoutLabel,
}: {
  company: string;
  panel: string;
  switchLabel: string;
  logoutLabel: string;
}) {
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onSignOut() {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(tAuth("missingSupabase"));
      return;
    }
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    setOpen(false);
    router.replace("/login");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-full px-2 py-2 text-left text-[13px] font-semibold text-muted-foreground hover:bg-soft"
      >
        <span className="truncate">{company}</span>
        <ChevronUp className={cn("size-4 shrink-0 transition-transform", open ? "rotate-0" : "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-40 mb-2 w-full min-w-[200px] overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-[0_12px_32px_rgba(0,0,0,.14)]"
        >
          <p className="px-3 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">{panel}</p>
          <Link
            href="/farmer/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-[13px] font-bold text-ink hover:bg-soft"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden />
            {switchLabel}
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => void onSignOut()}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-bold text-risk hover:bg-risk-soft disabled:opacity-50"
          >
            <LogOut className="size-3.5" aria-hidden />
            {signingOut ? tAuth("loading") : logoutLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProcessorShell({ children }: { children: ReactNode }) {
  const t = useTranslations("processorNav");
  const tAuth = useTranslations("auth");
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
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-background p-3">
          <Initials text={initials} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] leading-5 font-extrabold text-ink">{company}</p>
            <p className="mt-0.5 text-[11px] leading-[14px] font-medium text-muted-foreground">{panel}</p>
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
        <UserMenu
          company={company}
          panel={panel}
          switchLabel={t("switchView")}
          logoutLabel={tAuth("logout")}
        />
      </aside>

      <div className="border-b border-line bg-card px-4 pt-3 pb-3 min-[900px]:hidden">
        <div className="flex items-center justify-between gap-2">
          <Logo size={30} />
          <UserMenu
            company={company}
            panel={panel}
            switchLabel={t("switchView")}
            logoutLabel={tAuth("logout")}
          />
        </div>
        <p className="mt-1 truncate text-[12px] leading-[16px] font-extrabold text-ink">{company}</p>
        <p className="truncate text-[11px] leading-[14px] font-medium text-muted-foreground">{panel}</p>
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
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pt-4 pb-10 min-[900px]:px-6 min-[900px]:pt-6 min-[900px]:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
