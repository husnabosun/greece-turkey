"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FlaskConical, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { publicEnv } from "@/core/config/env";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { varietyLabelFromStored } from "@/features/fields/olive-varieties";
import { reverseGeocodePlace } from "@/features/fields/reverse-geocode";
import type { QualityBreakdown } from "@/features/quality/score-engine";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { trustBadges } from "@/features/marketplace/badges";
import { euroPrice, euroTotal, formatTons, saleTotal } from "@/features/marketplace/pricing";
import { LotsMap } from "./lots-map";
import {
  DayChipPicker,
  Dialog,
  LotBadges,
  ScoreBox,
  TextField,
  type LotBadge,
} from "./processor-kit";
import { regionLabel } from "./regions";
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  nextSevenDays,
  todayIsoDate,
} from "./schedule";
import {
  harvestRangeLabel,
  lotPlaceLabel,
  placeLotOffer,
  useProcessorMarket,
  type ProcessorLot,
} from "./use-processor-market";

const DEMO_EXCHANGE = 0.8;

type SprayRow = {
  id: string;
  product: string;
  appliedAt: string;
  euBanned: boolean;
};

function scoreToneClass(score: number) {
  if (score >= 80) return { bar: "bg-good", text: "text-good", soft: "bg-good-soft" };
  if (score >= 70) return { bar: "bg-warn-text", text: "text-warn-text", soft: "bg-warn-soft" };
  return { bar: "bg-risk", text: "text-risk", soft: "bg-risk-soft" };
}

function fallbackBreakdown(score: number): QualityBreakdown {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return {
    tree: Math.min(100, s + 3),
    spray: Math.max(0, s - 4),
    harvest: Math.min(100, s + 1),
    records: Math.max(0, s - 2),
  };
}

function parseBreakdown(raw: unknown, score: number | null): QualityBreakdown {
  const b = (raw ?? {}) as Partial<QualityBreakdown>;
  const tree = Number(b.tree ?? 0);
  const spray = Number(b.spray ?? 0);
  const harvest = Number(b.harvest ?? 0);
  const records = Number(b.records ?? 0);
  if (tree + spray + harvest + records <= 0 && score != null) return fallbackBreakdown(score);
  return { tree, spray, harvest, records };
}

function lotBadgesFor(lot: ProcessorLot, t: ReturnType<typeof useTranslations<"processor">>): LotBadge[] {
  const trust = trustBadges(
    {
      records: 80,
      hasBanned: lot.hasBannedSpray,
      paidDeliveries: 0,
      labFailed: 0,
    },
    (key, values) => t(key as never, values as never),
  );
  const out: LotBadge[] = trust.map((b) => ({
    id: b.id === "no-banned" ? "no-banned" : b.id === "complete-records" ? "complete-records" : "reliable-delivery",
    label: b.label,
    why: b.why,
  }));
  if (lot.labResult == null && (lot.qualityScore ?? 100) < 80) {
    out.push({ id: "lab-suggested", label: t("badge.labSuggested") });
  }
  if (lot.hasBannedSpray) {
    out.unshift({ id: "banned", label: t("noBannedProducts") });
  }
  return out;
}

function FactorRow({ label, value }: { label: string; value: number }) {
  const tone = scoreToneClass(value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        <p className={cn("text-[14px] font-extrabold", tone.text)}>{value}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-soft">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function ProcessorLotDetailScreen({ id }: { id: string }) {
  const t = useTranslations("processor");
  const locale = useLocale();
  const { lots, offers, loading, reload } = useProcessorMarket();
  const lot = lots.find((l) => l.id === id) ?? null;
  const mapToken = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;

  const [place, setPlace] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<QualityBreakdown | null>(null);
  const [sprays, setSprays] = useState<SprayRow[]>([]);
  const [tons, setTons] = useState("5");
  const [price, setPrice] = useState(String(DEMO_EXCHANGE));
  const [open, setOpen] = useState(false);
  const [arriveOn, setArriveOn] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const offerWeek = useMemo(() => nextSevenDays(), []);

  const sent = offers.some(
    (o) => o.lotId === id && o.initiatedBy === "processor" && (o.status === "pending" || o.status === "countered"),
  );
  const listed = lot?.status === "listed";

  useEffect(() => {
    if (!lot) return;
    let cancelled = false;
    void (async () => {
      if (lot.town) {
        if (!cancelled) setPlace(`${lot.town}${lot.region ? `, ${lot.region}` : ""}`);
      } else if (lot.lat != null && lot.lon != null) {
        const geo = await reverseGeocodePlace(lot.lat, lot.lon, locale);
        if (!cancelled) setPlace(geo);
      } else if (!cancelled) {
        setPlace(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lot, locale]);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase || !lot) {
      setBreakdown(lot?.qualityScore != null ? fallbackBreakdown(lot.qualityScore) : null);
      setSprays([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [{ data: lotExtra }, { data: qs }, { data: sprayRows }] = await Promise.all([
        supabase
          .from("lots")
          .select("quality_breakdown, spray_snapshot")
          .eq("id", lot.id)
          .maybeSingle(),
        lot.fieldId
          ? supabase
              .from("quality_scores")
              .select("breakdown, score")
              .eq("field_id", lot.fieldId)
              .order("computed_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        lot.fieldId
          ? supabase
              .from("logbook_entries")
              .select("id, product_name, applied_at, eu_banned, kind")
              .eq("field_id", lot.fieldId)
              .eq("kind", "spray")
              .order("applied_at", { ascending: false })
              .limit(8)
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const score = lot.qualityScore ?? qs?.score ?? null;
      setBreakdown(parseBreakdown(lotExtra?.quality_breakdown ?? qs?.breakdown, score));

      const fromLog = (sprayRows ?? []).map((r) => ({
        id: r.id as string,
        product: String(r.product_name ?? "—"),
        appliedAt: String(r.applied_at),
        euBanned: Boolean(r.eu_banned),
      }));
      if (fromLog.length > 0) {
        setSprays(fromLog);
        return;
      }
      const snap = Array.isArray(lotExtra?.spray_snapshot) ? lotExtra.spray_snapshot : [];
      setSprays(
        snap
          .map((raw, i) => {
            const s = raw as {
              id?: string;
              product?: string;
              product_name?: string;
              applied_at?: string;
              date?: string;
              eu_banned?: boolean;
              banned?: boolean;
            };
            const product = s.product_name ?? s.product;
            const appliedAt = s.applied_at ?? s.date;
            if (!product || !appliedAt) return null;
            return {
              id: s.id ?? `snap-${i}`,
              product,
              appliedAt,
              euBanned: Boolean(s.eu_banned ?? s.banned),
            };
          })
          .filter((x): x is SprayRow => x != null),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [lot]);

  const openOffer = () => {
    if (!lot) return;
    setTons(String(Math.min(5, lot.tons)));
    setPrice(String(lot.pricePerKg ?? DEMO_EXCHANGE));
    setArriveOn(addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
    setOpen(true);
  };

  const submit = async () => {
    if (!lot?.farmerId) {
      toast.error(t("identityHidden"));
      return;
    }
    const tonsN = Number(String(tons).replace(",", "."));
    const priceN = Number(String(price).replace(",", "."));
    if (!(tonsN > 0) || !(priceN > 0)) {
      toast.error(t("invalidOfferValues"));
      return;
    }
    if (tonsN > lot.tons) {
      toast.error(t("tonsExceedLot", { max: formatTons(lot.tons, locale) }));
      return;
    }
    toast.message(t("sendingOffer"));
    const deliveryInDays = Math.max(
      0,
      Math.round(
        (new Date(`${arriveOn}T12:00:00`).getTime() - new Date(`${todayIsoDate()}T12:00:00`).getTime()) / 86_400_000,
      ),
    );
    const res = await placeLotOffer({
      lotId: lot.id,
      farmerId: lot.farmerId,
      tons: tonsN,
      pricePerKg: priceN,
      deliveryInDays,
    });
    if (!res.ok) {
      toast.error(res.error ?? t("saveFailed"));
      return;
    }
    toast.success(t("offerSentDetail"));
    setOpen(false);
    await reload();
  };

  if (loading && !lot) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-soft" />
        <div className="h-64 animate-pulse rounded-[22px] bg-soft" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="space-y-4">
        <Link
          href="/processor/lots"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-line bg-card px-3 text-[14px] font-bold text-ink"
        >
          <ChevronLeft className="size-4" />
          {t("backToFindOlivesShort")}
        </Link>
        <ApCard className="p-5">
          <p className="text-[16px] font-extrabold text-ink">{t("notAvailable")}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("lotEmptyBody")}</p>
        </ApCard>
      </div>
    );
  }

  const badges = lotBadgesFor(lot, t);
  const resolvedPlace = lotPlaceLabel(lot, t("anonymousGrove"), place, locale);
  const region = regionLabel(lot.region, locale);
  const variety = varietyLabelFromStored(lot.variety, locale);
  const harvest = harvestRangeLabel(lot.harvestStart, lot.harvestEnd, locale);
  const useLabel = lot.useType === "table" ? t("filterTable") : t("filterOil");
  const factors = breakdown ?? (lot.qualityScore != null ? fallbackBreakdown(lot.qualityScore) : null);
  const offerTons = Number(String(tons).replace(",", ".")) || 0;
  const offerPrice = Number(String(price).replace(",", ".")) || 0;
  const offerTotal =
    offerTons > 0 && offerPrice > 0 ? euroTotal(saleTotal(Math.min(offerTons, lot.tons), offerPrice), locale) : null;

  const summaryFacts = (
    <dl className="mt-4 space-y-2.5 border-t border-line pt-4">
      {[
        { k: t("tons"), v: formatTons(lot.tons, locale) },
        { k: t("variety"), v: variety },
        { k: t("province"), v: region },
        { k: t("harvestPeriod"), v: harvest },
        { k: t("useLabel"), v: useLabel },
      ].map((row) => (
        <div key={row.k} className="flex items-baseline justify-between gap-3">
          <dt className="text-[13px] font-medium text-muted-foreground">{row.k}</dt>
          <dd className="text-right text-[14px] font-extrabold text-ink">{row.v}</dd>
        </div>
      ))}
    </dl>
  );

  const summaryCard = (
    <ApCard className="flex flex-col p-5">
      <div className="flex items-end justify-between gap-3">
        {lot.qualityScore != null ? <ScoreBox score={lot.qualityScore} hero /> : <div />}
        <div className="min-w-0 text-right">
          {lot.pricePerKg != null ? (
            <>
              <p className="text-[28px] leading-none font-extrabold tracking-tight text-ink">
                {euroPrice(lot.pricePerKg, locale)}
                <span className="ml-1 text-[14px] font-semibold text-muted-foreground">/kg</span>
              </p>
              <p className="mt-1 text-[12px] font-medium text-muted-foreground">{t("farmerPrice")}</p>
            </>
          ) : (
            <p className="text-[15px] font-semibold text-muted-foreground">{t("openToOffers")}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-7 font-extrabold text-ink">
            {variety} · {formatTons(lot.tons, locale)}
          </h1>
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{t("lotAnonymousLine")}</span>
          </p>
        </div>
        {!listed ? (
          <Pill tone={lot.status === "sold" ? "neutral" : "warn"}>
            {lot.status === "sold" ? t("soldStatus") : lot.status === "reserved" ? t("reservedStatus") : lot.status}
          </Pill>
        ) : null}
      </div>

      <div className="mt-3">
        <LotBadges badges={badges} />
      </div>

      {summaryFacts}

      {listed ? (
        <div className="mt-5 hidden min-[900px]:block">
          <ApButton
            label={sent ? t("offerSent") : t("makeOffer")}
            variant="dark"
            disabled={sent}
            onClick={openOffer}
            className="w-full"
          />
        </div>
      ) : null}
    </ApCard>
  );

  return (
    <div className={cn("mx-auto w-full max-w-[1200px]", listed ? "pb-24 min-[900px]:pb-8" : "pb-8")}>
      <div className="mb-4">
        <Link
          href="/processor/lots"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-line bg-card px-3 text-[14px] font-bold text-ink hover:bg-soft"
        >
          <ChevronLeft className="size-4" />
          {t("backToFindOlivesShort")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 space-y-5 min-[900px]:order-1">
          {factors ? (
            <ApCard className="p-5">
              <p className="text-[16px] font-extrabold text-ink">{t("scoreBreakdownTitle")}</p>
              <p className="mt-1 text-[13px] font-medium text-muted-foreground">{t("scoreBreakdownHint")}</p>
              <div className="mt-4 space-y-3.5">
                <FactorRow label={t("factorTree")} value={factors.tree} />
                <FactorRow label={t("factorSpray")} value={factors.spray} />
                <FactorRow label={t("factorHarvest")} value={factors.harvest} />
                <FactorRow label={t("factorRecords")} value={factors.records} />
              </div>
            </ApCard>
          ) : null}

          <ApCard className="overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-[16px] font-extrabold text-ink">{t("sprayHistoryTitle")}</p>
              <p className="mt-1 text-[13px] font-medium text-muted-foreground">{t("sprayHistoryHint")}</p>
            </div>
            {sprays.length === 0 ? (
              <p className="border-t border-line px-5 py-8 text-center text-[13px] font-semibold text-muted-foreground">
                {lot.hasBannedSpray ? t("sprayHistoryBanned") : t("sprayHistoryEmpty")}
              </p>
            ) : (
              sprays.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
                  <div>
                    <p className="text-[14px] font-extrabold text-ink">{s.product}</p>
                    <p className="text-[12px] font-medium text-muted-foreground">
                      {new Date(s.appliedAt).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Pill tone={s.euBanned ? "risk" : "good"}>
                    {s.euBanned ? t("sprayNotApproved") : t("sprayEuApproved")}
                  </Pill>
                </div>
              ))
            )}
          </ApCard>

          <ApCard className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-ink">
                {lot.labResult ? <FlaskConical className="size-5" /> : <ShieldCheck className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-extrabold text-ink">{t("labResultTitle")}</p>
                {lot.labResult ? (
                  <>
                    <p className="mt-1 text-[14px] font-semibold text-ink">
                      {lot.labResult === "passed" ? t("labPassed") : t("labFailed")}
                      {lot.labAcidity != null ? ` · ${t("labAcidity", { n: String(lot.labAcidity) })}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] font-medium text-muted-foreground">{t("labResultEmpty")}</p>
                )}
              </div>
              {lot.labResult ? (
                <Pill tone={lot.labResult === "passed" ? "good" : "risk"}>
                  {lot.labResult === "passed" ? t("labPassed") : t("labFailed")}
                </Pill>
              ) : null}
            </div>
          </ApCard>

          {lot.lat != null && lot.lon != null ? (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{resolvedPlace}</p>
              <LotsMap
                token={mapToken}
                preview={false}
                points={[
                  {
                    id: lot.id,
                    lat: lot.lat,
                    lon: lot.lon,
                    label: resolvedPlace,
                    score: lot.qualityScore,
                    title: `${variety} · ${formatTons(lot.tons, locale)}`,
                    subtitle: region,
                    priceLabel: lot.pricePerKg != null ? euroPrice(lot.pricePerKg, locale) : t("openToOffers"),
                    useLabel,
                    harvestLabel: harvest,
                  },
                ]}
                selectedId={lot.id}
                onSelect={() => undefined}
                labels={{
                  locate: t("mapLocate"),
                  zoomIn: t("mapZoomIn"),
                  zoomOut: t("mapZoomOut"),
                  needToken: t("mapNeedToken"),
                  empty: t("mapEmpty"),
                  qualityScore: t("qualityScore"),
                  openLot: t("openLot"),
                }}
                className="!h-[240px] !min-h-[240px] min-[900px]:!h-[240px] min-[900px]:!min-h-[240px]"
              />
            </div>
          ) : null}
        </div>

        <aside className="order-1 min-w-0 min-[900px]:order-2">
          <div className="min-[900px]:sticky min-[900px]:top-6">{summaryCard}</div>
        </aside>
      </div>

      {listed ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm min-[900px]:hidden">
          <ApButton
            label={sent ? t("offerSent") : t("makeOffer")}
            variant="dark"
            disabled={sent}
            onClick={openOffer}
            className="w-full"
          />
        </div>
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("makeOffer")}
        subtitle={`${variety} · ${formatTons(lot.tons, locale)}`}
        actionLabel={t("sendOfferAction")}
        onAction={() => void submit()}
      >
        <TextField label={t("tons")} value={tons} onChange={setTons} suffix="t" inputMode="decimal" />
        <TextField label={t("price")} value={price} onChange={setPrice} suffix="€/kg" inputMode="decimal" />
        {offerTotal ? (
          <p className="rounded-xl bg-soft px-3 py-2.5 text-[14px] font-extrabold text-ink">
            {t("offerTotalPreview", { total: offerTotal })}
          </p>
        ) : null}
        <DayChipPicker
          label={t("arriveOn")}
          days={offerWeek}
          value={arriveOn}
          onChange={setArriveOn}
          formatDay={(iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short" })}
          todayLabel={t("todayShort")}
        />
      </Dialog>
    </div>
  );
}
