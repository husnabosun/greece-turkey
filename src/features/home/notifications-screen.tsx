"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  ChevronLeft,
  FlaskConical,
  Package,
  ShieldAlert,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type NotifKind = "offer" | "delivery" | "lab" | "paid" | "risk";

type NotifItem = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  at: string;
  href: string;
  unread: boolean;
};

/** Aggregated notification center from offers / deliveries / risk (Β11). */
export function NotificationsScreen() {
  const t = useTranslations("farmerNotifications");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const [offersRes, deliveriesRes, tasksRes] = await Promise.all([
        supabase
          .from("offers")
          .select("id, status, tons, price_per_kg, created_at, updated_at, lots(variety)")
          .eq("farmer_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("deliveries")
          .select("id, status, lab_result, tons, updated_at, scheduled_for")
          .eq("farmer_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("tasks")
          .select("id, title, kind, due_on, created_at, done")
          .eq("farmer_id", user.id)
          .eq("done", false)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (cancelled) return;

      const next: NotifItem[] = [];
      for (const row of offersRes.data ?? []) {
        const variety =
          row.lots && typeof row.lots === "object" && !Array.isArray(row.lots)
            ? String((row.lots as { variety?: string | null }).variety ?? "")
            : "";
        if (row.status === "pending") {
          next.push({
            id: `offer-${row.id}`,
            kind: "offer",
            title: t("newOffer"),
            body: t("offerBody", {
              tons: Number(row.tons),
              price: Number(row.price_per_kg),
              variety: variety || "—",
            }),
            at: row.updated_at ?? row.created_at,
            href: "/farmer/market?tab=offers",
            unread: true,
          });
        } else if (row.status === "rejected" || row.status === "countered") {
          next.push({
            id: `offer-${row.id}-${row.status}`,
            kind: "offer",
            title: row.status === "rejected" ? t("offerRejected") : t("offerCountered"),
            body: t("offerBody", {
              tons: Number(row.tons),
              price: Number(row.price_per_kg),
              variety: variety || "—",
            }),
            at: row.updated_at ?? row.created_at,
            href: "/farmer/market?tab=offers",
            unread: false,
          });
        }
      }

      for (const row of deliveriesRes.data ?? []) {
        if (row.status === "paid") {
          next.push({
            id: `del-${row.id}-paid`,
            kind: "paid",
            title: t("paymentDone"),
            body: t("deliveryBody", { tons: Number(row.tons), status: row.status }),
            at: row.updated_at,
            href: "/farmer/market?tab=sales",
            unread: false,
          });
        } else if (row.lab_result === "failed" || row.lab_result === "passed") {
          next.push({
            id: `del-${row.id}-lab`,
            kind: "lab",
            title: row.lab_result === "passed" ? t("labPassed") : t("labFailed"),
            body: t("deliveryBody", { tons: Number(row.tons), status: row.status }),
            at: row.updated_at,
            href: "/farmer/market?tab=sales",
            unread: row.lab_result === "failed",
          });
        } else {
          next.push({
            id: `del-${row.id}`,
            kind: "delivery",
            title: t("deliveryStep"),
            body: t("deliveryBody", { tons: Number(row.tons), status: row.status }),
            at: row.updated_at,
            href: "/farmer/market?tab=sales",
            unread: row.status === "scheduled" || row.status === "weighed",
          });
        }
      }

      for (const row of tasksRes.data ?? []) {
        if (row.kind === "recheck" || /risk|ρίσκο|risk/i.test(row.title ?? "")) {
          next.push({
            id: `task-${row.id}`,
            kind: "risk",
            title: t("highRisk"),
            body: row.title || t("checkField"),
            at: row.due_on ?? row.created_at,
            href: "/farmer/tasks",
            unread: true,
          });
        }
      }

      next.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      setItems(next.slice(0, 40));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const unread = useMemo(() => items.filter((i) => i.unread).length, [items]);

  const fmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 16);
    }
  };

  const iconFor = (kind: NotifKind) => {
    if (kind === "offer") return ShoppingBag;
    if (kind === "lab") return FlaskConical;
    if (kind === "paid") return Wallet;
    if (kind === "risk") return ShieldAlert;
    return Package;
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))] md:max-w-2xl md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("back")}
          onClick={() => router.push("/farmer/dashboard")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tracking-tight text-ink">{t("title")}</h1>
          <p className="text-ap-small text-muted-foreground">
            {unread > 0 ? t("unread", { n: unread }) : t("allCaughtUp")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-soft">
            <Bell className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-3 text-ap-body font-semibold text-ink">{t("empty")}</p>
          <p className="mt-1 text-ap-small text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => {
            const Icon = iconFor(item.kind);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex gap-3 rounded-2xl border px-3 py-3",
                    item.unread ? "border-good/30 bg-good-soft/40" : "border-line bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      item.kind === "risk" ? "bg-risk-soft text-risk" : "bg-soft text-ink",
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-ap-body font-bold text-ink">{item.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(item.at)}</span>
                    </span>
                    <span className="mt-0.5 block text-ap-small text-muted-foreground">{item.body}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
