"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronUp,
  ClipboardList,
  Globe,
  Inbox,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { LOCALES, type Locale } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { Initials, initialsOf } from "@/features/marketplace/processor-kit";
import { BrandLogo } from "@/shared/components/brand";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";

type NavItem = {
  labelKey: "overview" | "findOlives" | "offers" | "deliveries" | "requests";
  href: string;
  Icon: LucideIcon;
};

const NAV: NavItem[] = [
  { labelKey: "overview", href: "/processor/overview", Icon: LayoutDashboard },
  { labelKey: "findOlives", href: "/processor/lots", Icon: Search },
  { labelKey: "offers", href: "/processor/offers", Icon: Inbox },
  { labelKey: "deliveries", href: "/processor/deliveries", Icon: Truck },
  { labelKey: "requests", href: "/processor/requests", Icon: ClipboardList },
];

function isActive(pathname: string, href: string) {
  if (href === "/processor/overview") {
    return pathname === "/processor" || pathname === "/processor/" || pathname === "/processor/overview";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavPill({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
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

function BottomTab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex min-h-11 flex-col items-center justify-center gap-0.5 px-1"
    >
      <Icon
        className={cn("size-[22px]", active ? "text-good" : "text-muted-foreground")}
        strokeWidth={active ? 2.3 : 1.9}
        aria-hidden
      />
      <span
        className={cn(
          "max-w-full truncate text-center text-[12px] leading-[14px]",
          active ? "font-bold text-ink" : "font-medium text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function UserMenu({
  company,
  panel,
  logoutLabel,
  settingsLabel,
  languageLabel,
  placement,
  trigger = "text",
  initials,
}: {
  company: string;
  panel: string;
  logoutLabel: string;
  settingsLabel: string;
  languageLabel: string;
  placement: "up" | "down";
  trigger?: "text" | "avatar" | "gear";
  initials?: string;
}) {
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
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
    await supabase.auth.signOut({ scope: "local" });
    setSigningOut(false);
    setOpen(false);
    router.replace("/login");
    router.refresh();
  }

  function onPickLocale(code: Locale) {
    if (code === locale) {
      setOpen(false);
      return;
    }
    router.replace(pathname, { locale: code });
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      {trigger === "gear" ? (
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={settingsLabel}
          onClick={() => setOpen((v) => !v)}
          className="flex size-11 items-center justify-center rounded-full border border-line bg-card transition-colors hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <Settings className="size-[18px]" aria-hidden />
        </button>
      ) : trigger === "avatar" ? (
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={settingsLabel}
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <Initials text={initials || "PR"} size={36} />
        </button>
      ) : (
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
      )}
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 min-w-[220px] overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.14)]",
            placement === "up" ? "bottom-full left-0 mb-2 w-full" : "top-full right-0 mt-2 w-56",
          )}
        >
          <p className="truncate px-2.5 pt-1.5 pb-0.5 text-[12px] font-extrabold text-ink">{company}</p>
          <p className="px-2.5 pb-2 text-[12px] font-medium text-muted-foreground">{panel}</p>

          <Link
            href="/processor/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-11 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-semibold text-ink hover:bg-soft"
          >
            <UserRound className="size-[18px]" aria-hidden />
            {settingsLabel}
          </Link>

          <div className="px-2.5 pt-1.5 pb-2">
            <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Globe className="size-4" aria-hidden />
              {languageLabel}
            </p>
            <div className="flex gap-1.5">
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="menuitem"
                  onClick={() => onPickLocale(code)}
                  className={cn(
                    "h-10 flex-1 rounded-full border text-[12px] font-bold uppercase transition-colors",
                    locale === code ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:bg-soft",
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-1">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void onSignOut()}
              className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-bold text-risk hover:bg-risk-soft disabled:opacity-50"
            >
              <LogOut className="size-[18px]" aria-hidden />
              {signingOut ? tAuth("loading") : logoutLabel}
            </button>
          </div>
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
        <BrandLogo size={36} />
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-background p-3">
          <Initials text={initials} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] leading-5 font-extrabold text-ink">{company}</p>
            <p className="mt-0.5 text-[12px] leading-[14px] font-medium text-muted-foreground">{panel}</p>
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
          logoutLabel={tAuth("logout")}
          settingsLabel={t("settings")}
          languageLabel={t("language")}
          placement="up"
        />
      </aside>

      <div className="relative z-50 overflow-visible border-b border-line bg-card px-4 py-3 min-[900px]:hidden">
        <div className="flex h-11 items-center justify-between gap-2">
          <BrandLogo size={30} />
          <div className="flex items-center gap-2">
            <UserMenu
              company={company}
              panel={panel}
              logoutLabel={tAuth("logout")}
              settingsLabel={t("settings")}
              languageLabel={t("language")}
              placement="down"
              trigger="gear"
            />
            <Initials text={initials} size={36} />
          </div>
        </div>
      </div>

      <div className="flex min-h-dvh flex-1 flex-col min-[900px]:pl-[240px]">
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pt-4 pb-24 min-[900px]:px-6 min-[900px]:pt-6 min-[900px]:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] min-[900px]:hidden"
        aria-label={panel}
      >
        <div className="mx-auto grid h-16 grid-cols-5 px-1">
          {nav.map((item) => (
            <BottomTab
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
