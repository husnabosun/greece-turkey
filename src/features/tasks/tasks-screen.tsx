"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Bell, Camera, Check, ChevronLeft, Droplet, RefreshCw } from "lucide-react";
import { Link } from "@/shared/i18n/navigation";
import { colors } from "@/shared/theme/tokens";

export function TasksScreen() {
  const t = useTranslations("farmerTasks");
  const done = 0;
  const total = 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="w-full flex-1">
      <div className="flex items-center gap-3">
        <Link
          href="/farmer/dashboard"
          aria-label={t("back")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-ink">{t("thisWeek")}</h1>
        <Link
          href="/farmer/alerts"
          aria-label={t("alerts")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <Bell className="size-[18px]" aria-hidden />
        </Link>
      </div>

      <div className="mt-3 rounded-[18px] border border-line bg-card p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-ap-body font-semibold text-ink">
            {t("checksDone")}{" "}
            <span className="font-extrabold">
              {done} {t("of")} {total}
            </span>
          </p>
          <span className="rounded-full bg-good-soft px-2.5 py-1 text-ap-pill font-bold text-good">
            {t("scorePlus", { n: 0 })}
          </span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-soft">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <EmptyTaskCard
          icon={<Camera className="size-[18px]" style={{ color: colors.risk }} />}
          iconBg="bg-risk-soft"
          title={t("photoTitle")}
          meta={t("emptyMeta")}
          action={t("takePhoto")}
        />
        <EmptyTaskCard
          icon={<Droplet className="size-[18px]" style={{ color: "#A9831F" }} />}
          iconBg="bg-warn-soft"
          title={t("sprayTitle")}
          meta={t("emptyMeta")}
          dual
          yes={t("yesAdd")}
          no={t("no")}
        />
        <EmptyTaskCard
          icon={<RefreshCw className="size-[18px]" style={{ color: colors.accent }} />}
          iconBg="bg-ap-accent-soft"
          title={t("recheckTitle")}
          meta={t("emptyMeta")}
          action={t("recheckNow")}
        />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-ap-small font-bold tracking-wide text-muted-foreground uppercase">
          {t("completed")}
        </p>
        <div className="rounded-[18px] border border-line bg-card px-4 py-6 text-center text-ap-body text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Check className="size-4 text-good" />
            {t("noCompleted")}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyTaskCard({
  icon,
  iconBg,
  title,
  meta,
  action,
  dual,
  yes,
  no,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  meta: string;
  action?: string;
  dual?: boolean;
  yes?: string;
  no?: string;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-card p-3.5 opacity-55">
      <div className="flex items-start gap-2.5">
        <span className={`flex size-10 items-center justify-center rounded-[12px] ${iconBg}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-ap-body font-extrabold text-ink">{title}</p>
              <p className="text-ap-small text-muted-foreground">{meta}</p>
            </div>
            <span className="rounded-full bg-good-soft px-2 py-0.5 text-ap-pill font-bold text-good">+1</span>
          </div>
          {dual ? (
            <div className="mt-3 flex gap-2">
              <button type="button" disabled className="h-10 flex-1 rounded-full bg-ink text-ap-pill font-bold text-white">
                {yes}
              </button>
              <button type="button" disabled className="h-10 flex-1 rounded-full border border-line bg-card text-ap-pill font-bold text-ink">
                {no}
              </button>
            </div>
          ) : (
            <button type="button" disabled className="mt-3 h-10 w-full rounded-full bg-ink text-ap-pill font-bold text-white">
              {action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
