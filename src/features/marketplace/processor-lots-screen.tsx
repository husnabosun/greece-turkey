"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, FlaskConical, Leaf, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { publicEnv } from "@/core/config/env";
import { marketplaceVarietyOptions } from "@/features/fields/olive-varieties";
import { reverseGeocodePlace } from "@/features/fields/reverse-geocode";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Chip } from "@/shared/components/brand/chip";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { trustBadges } from "@/features/marketplace/badges";
import { euroPrice } from "@/features/marketplace/pricing";
import { LotsMap } from "./lots-map";
import {
  Amount,
  BottomSheet,
  ChipGroup,
  DayChipPicker,
  Dialog,
  EmptyBlock,
  LotBadges,
  LotResultCard,
  PageHeader,
  Segmented,
  TextField,
  type LotBadge,
} from "./processor-kit";
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

const PROVINCES = ["Crete", "Messinia", "Peloponnese", "Laconia", "Aydın", "Balıkesir", "İzmir"] as const;

type SortKey = "score" | "price" | "harvest" | "tons";

const REGION_I18N: Record<(typeof PROVINCES)[number], { en: string; el: string; tr: string }> = {
  Crete: { en: "Crete", el: "Κρήτη", tr: "Girit" },
  Messinia: { en: "Messenia", el: "Μεσσηνία", tr: "Messinya" },
  Peloponnese: { en: "Peloponnese", el: "Πελοπόννησος", tr: "Peloponez" },
  Laconia: { en: "Laconia", el: "Λακωνία", tr: "Lakonya" },
  Aydın: { en: "Aydın", el: "Αϊδίνιο", tr: "Aydın" },
  Balıkesir: { en: "Balıkesir", el: "Μπαλικεσίρ", tr: "Balıkesir" },
  İzmir: { en: "İzmir", el: "Σμύρνη", tr: "İzmir" },
};

function regionLabel(raw: string, locale: string): string {
  const hit = PROVINCES.find(
    (p) =>
      p.toLowerCase() === raw.toLowerCase() ||
      REGION_I18N[p].en.toLowerCase() === raw.toLowerCase() ||
      REGION_I18N[p].el.toLowerCase() === raw.toLowerCase() ||
      REGION_I18N[p].tr.toLowerCase() === raw.toLowerCase(),
  );
  if (!hit) return raw;
  const lang = locale.startsWith("el") ? "el" : locale.startsWith("tr") ? "tr" : "en";
  return REGION_I18N[hit][lang];
}

function regionMatches(lotRegion: string, place: string, selected: string): boolean {
  if (selected === "all") return true;
  const needle = selected.toLowerCase();
  if (lotRegion.toLowerCase() === needle || place.toLowerCase().includes(needle)) return true;
  const hit = PROVINCES.find((p) => p === selected);
  if (!hit) return lotRegion === selected || place.includes(selected);
  const aliases = [hit, REGION_I18N[hit].en, REGION_I18N[hit].el, REGION_I18N[hit].tr].map((s) =>
    s.toLowerCase(),
  );
  return aliases.some((a) => lotRegion.toLowerCase() === a || place.toLowerCase().includes(a));
}

function useVarietyLabel() {
  const locale = useLocale();
  const options = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  return (slug: string) => options.find((o) => o.value === slug)?.label ?? slug;
}

function useLotPlaceLabels(lots: ProcessorLot[]) {
  const locale = useLocale();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const lotsRef = useRef(lots);
  lotsRef.current = lots;
  const key = lots
    .filter((l) => l.lat != null && l.lon != null)
    .map((l) => `${l.id}:${l.lat},${l.lon}:${l.town ?? ""}:${l.region}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!key) {
      setLabels((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        lotsRef.current.map(async (lot) => {
          if (lot.lat == null || lot.lon == null) return;
          if (lot.town) {
            next[lot.id] = `${lot.town}${lot.region ? `, ${lot.region}` : ""}`;
            return;
          }
          const place = await reverseGeocodePlace(lot.lat, lot.lon, locale);
          if (place) next[lot.id] = place;
        }),
      );
      if (!cancelled) setLabels(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, locale]);

  return labels;
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

export function ProcessorLotsScreen() {
  const t = useTranslations("processor");
  const locale = useLocale();
  const varietyLabel = useVarietyLabel();
  const varietyOptions = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  const { lots, loading, error, reload } = useProcessorMarket();
  const placeById = useLotPlaceLabels(lots);
  const [useFilter, setUseFilter] = useState<"all" | "oil" | "table">("all");
  const [variety, setVariety] = useState("all");
  const [varietyExpanded, setVarietyExpanded] = useState(false);
  const [province, setProvince] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [noBanned, setNoBanned] = useState(false);
  const [labSuggested, setLabSuggested] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [offerLot, setOfferLot] = useState<ProcessorLot | null>(null);
  const [offerTons, setOfferTons] = useState("5");
  const [offerPrice, setOfferPrice] = useState("0.80");
  const [offerArrive, setOfferArrive] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const offerWeek = useMemo(() => nextSevenDays(), []);
  const mapToken = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;

  const listed = useMemo(() => lots.filter((l) => l.status === "listed"), [lots]);

  const regionOptions = useMemo(() => {
    const fromLots = listed.map((l) => l.region).filter(Boolean);
    const keys = new Set<string>([...PROVINCES]);
    for (const r of fromLots) {
      const known = PROVINCES.find(
        (p) =>
          p.toLowerCase() === r.toLowerCase() ||
          REGION_I18N[p].en.toLowerCase() === r.toLowerCase() ||
          REGION_I18N[p].el.toLowerCase() === r.toLowerCase() ||
          REGION_I18N[p].tr.toLowerCase() === r.toLowerCase(),
      );
      keys.add(known ?? r);
    }
    return [...keys].map((value) => ({
      value,
      label: regionLabel(value, locale),
    }));
  }, [listed, locale]);

  const popularVarieties = varietyOptions.slice(0, 3);
  const extraVarieties = varietyOptions.slice(3);
  const visibleVarieties = varietyExpanded ? varietyOptions : popularVarieties;

  const shown = useMemo(() => {
    const filtered = listed
      .filter((l) => (useFilter === "all" ? true : l.useType === useFilter))
      .filter((l) => (variety === "all" ? true : l.variety === variety))
      .filter((l) => regionMatches(l.region, placeById[l.id] ?? "", province))
      .filter((l) => (l.qualityScore ?? 0) >= minScore)
      .filter((l) => (noBanned ? !l.hasBannedSpray : true))
      .filter((l) => (labSuggested ? l.labResult == null && (l.qualityScore ?? 100) < 80 : true));

    const harvestTs = (l: ProcessorLot) => {
      const d = l.harvestStart ?? l.harvestEnd;
      if (!d) return Number.POSITIVE_INFINITY;
      return new Date(`${d}T12:00:00`).getTime();
    };

    return [...filtered].sort((a, b) => {
      if (sort === "price") {
        const ap = a.pricePerKg ?? Number.POSITIVE_INFINITY;
        const bp = b.pricePerKg ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      }
      if (sort === "harvest") return harvestTs(a) - harvestTs(b);
      if (sort === "tons") return b.tons - a.tons;
      return (b.qualityScore ?? -1) - (a.qualityScore ?? -1);
    });
  }, [listed, useFilter, variety, province, minScore, noBanned, labSuggested, placeById, sort]);

  const mapPoints = useMemo(
    () =>
      shown
        .filter((l) => l.lat != null && l.lon != null)
        .map((l) => {
          const place = lotPlaceLabel(l, t("anonymousGrove"), placeById[l.id]);
          return {
            id: l.id,
            lat: l.lat!,
            lon: l.lon!,
            label: place,
            score: l.qualityScore,
            title: `${varietyLabel(l.variety)} · ${l.tons} t`,
            subtitle: t("lotSub", {
              place,
              harvest: harvestRangeLabel(l.harvestStart, l.harvestEnd),
              use: l.useType === "table" ? t("filterTable") : t("filterOil"),
            }),
            priceLabel:
              l.pricePerKg != null ? `${euroPrice(l.pricePerKg)} /kg · ${t("farmerPrice")}` : t("openToOffers"),
            useLabel: l.useType === "table" ? t("filterTable") : t("filterOil"),
            harvestLabel: harvestRangeLabel(l.harvestStart, l.harvestEnd),
          };
        }),
    [shown, placeById, t, varietyLabel],
  );

  useEffect(() => {
    if (selectedMapId && !shown.some((l) => l.id === selectedMapId)) {
      setSelectedMapId(null);
    }
  }, [shown, selectedMapId]);

  const activeFilterCount =
    (variety !== "all" ? 1 : 0) +
    (province !== "all" ? 1 : 0) +
    (minScore > 0 ? 1 : 0) +
    (noBanned ? 1 : 0) +
    (labSuggested ? 1 : 0);

  const clearFilters = () => {
    setVariety("all");
    setProvince("all");
    setMinScore(0);
    setNoBanned(false);
    setLabSuggested(false);
    setVarietyExpanded(false);
  };

  const submitOffer = async () => {
    if (!offerLot?.farmerId) {
      toast.error(t("identityHidden"));
      return;
    }
    const tons = Number(offerTons);
    const price = Number(offerPrice);
    if (!(tons > 0) || !(price > 0)) {
      toast.error(t("invalidOfferValues"));
      return;
    }
    toast.message(t("sendingOffer"));
    const deliveryInDays = Math.max(
      0,
      Math.round(
        (new Date(`${offerArrive}T12:00:00`).getTime() - new Date(`${todayIsoDate()}T12:00:00`).getTime()) /
          86_400_000,
      ),
    );
    const res = await placeLotOffer({
      lotId: offerLot.id,
      farmerId: offerLot.farmerId,
      tons,
      pricePerKg: price,
      deliveryInDays,
    });
    if (!res.ok) {
      toast.error(res.error ?? t("saveFailed"));
      return;
    }
    toast.success(t("offerSentDetail"));
    setOfferLot(null);
    await reload();
  };

  const sortLabel =
    sort === "price"
      ? t("sortLowestPrice")
      : sort === "harvest"
        ? t("sortNearestHarvest")
        : sort === "tons"
          ? t("sortMostTons")
          : t("sortBestScore");

  const filtersBody = (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{t("variety")}</p>
        <div className="flex flex-wrap gap-2">
          <Chip tone="black" on={variety === "all"} onClick={() => setVariety("all")}>
            <span className={cn("text-[12px] font-bold", variety === "all" ? "text-white" : "text-ink")}>{t("filterAll")}</span>
          </Chip>
          {visibleVarieties.map((v) => (
            <Chip key={v.value} tone="black" on={variety === v.value} onClick={() => setVariety(v.value)}>
              <span className={cn("text-[12px] font-bold", variety === v.value ? "text-white" : "text-ink")}>{v.label}</span>
            </Chip>
          ))}
          {!varietyExpanded && extraVarieties.length > 0 ? (
            <Chip tone="black" on={false} onClick={() => setVarietyExpanded(true)}>
              <span className="text-[12px] font-bold text-ink">{t("moreVarieties", { n: extraVarieties.length })}</span>
            </Chip>
          ) : null}
        </div>
      </div>

      <ChipGroup
        label={t("province")}
        value={province}
        onChange={setProvince}
        options={[{ value: "all", label: t("filterAll") }, ...regionOptions]}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{t("minScore")}</p>
          <p className="text-[13px] font-extrabold text-ink">
            {minScore <= 0 ? t("allScores") : t("minScoreValue", { score: minScore })}
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={95}
          step={5}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="w-full accent-ink"
          aria-label={t("minScore")}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip tone="black" on={noBanned} onClick={() => setNoBanned((v) => !v)}>
          <span className={cn("text-[12px] font-bold", noBanned ? "text-white" : "text-ink")}>{t("noBannedProducts")}</span>
        </Chip>
        <Chip tone="black" on={labSuggested} onClick={() => setLabSuggested((v) => !v)}>
          <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-bold", labSuggested ? "text-white" : "text-ink")}>
            <FlaskConical className="size-3.5" />
            {t("labTestSuggested")}
          </span>
        </Chip>
      </div>
    </>
  );

  const activeChips =
    activeFilterCount > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        {variety !== "all" ? (
          <button
            type="button"
            onClick={() => setVariety("all")}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-3 text-[12px] font-bold text-ink"
          >
            {varietyLabel(variety)}
            <X className="size-3.5" />
          </button>
        ) : null}
        {province !== "all" ? (
          <button
            type="button"
            onClick={() => setProvince("all")}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-3 text-[12px] font-bold text-ink"
          >
            {regionLabel(province, locale)}
            <X className="size-3.5" />
          </button>
        ) : null}
        {minScore > 0 ? (
          <button
            type="button"
            onClick={() => setMinScore(0)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-3 text-[12px] font-bold text-ink"
          >
            {t("minScoreValue", { score: minScore })}
            <X className="size-3.5" />
          </button>
        ) : null}
        {noBanned ? (
          <button
            type="button"
            onClick={() => setNoBanned(false)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-3 text-[12px] font-bold text-ink"
          >
            {t("noBannedProducts")}
            <X className="size-3.5" />
          </button>
        ) : null}
        {labSuggested ? (
          <button
            type="button"
            onClick={() => setLabSuggested(false)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-3 text-[12px] font-bold text-ink"
          >
            {t("labTestSuggested")}
            <X className="size-3.5" />
          </button>
        ) : null}
        <button type="button" onClick={clearFilters} className="text-[12px] font-bold text-muted-foreground hover:text-ink">
          {t("clearAllFilters")}
        </button>
      </div>
    ) : null;

  const resultsBlock =
    listed.length === 0 && !loading ? (
      <ApCard>
        <EmptyBlock
          icon={<Leaf className="size-5" />}
          title={t("noLotsAvailableTitle")}
          body={t("noLotsAvailableBody")}
          action={
            <Link href="/processor/requests">
              <ApButton label={t("createRequest")} variant="dark" icon={<Plus className="size-4" />} />
            </Link>
          }
        />
      </ApCard>
    ) : shown.length === 0 ? (
      <ApCard>
        <EmptyBlock
          icon={<Search className="size-5" />}
          title={t("filtersNoMatchTitle")}
          body={loading ? t("loading") : t("filtersNoMatchBody")}
          action={<ApButton label={t("clearFilters")} variant="outline" onClick={clearFilters} />}
        />
      </ApCard>
    ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((lot) => {
          const badges = lotBadgesFor(lot, t).slice(0, 3);
          const place = regionLabel(lot.region, locale);
          return (
            <LotResultCard
              key={lot.id}
              href={`/processor/lots/${lot.id}`}
              title={`${varietyLabel(lot.variety)} · ${lot.tons % 1 ? lot.tons.toFixed(1) : lot.tons} t`}
              place={place}
              harvest={harvestRangeLabel(lot.harvestStart, lot.harvestEnd)}
              score={lot.qualityScore}
              badges={<LotBadges badges={badges} max={3} />}
              price={
                lot.pricePerKg != null ? (
                  <Amount value={euroPrice(lot.pricePerKg)} unit="/kg" />
                ) : (
                  <span className="text-[13px] font-semibold text-muted-foreground">{t("openToOffers")}</span>
                )
              }
              priceHint={lot.pricePerKg != null ? t("farmerPrice") : undefined}
              ctaLabel={t("viewLot")}
              selected={selectedMapId === lot.id}
              onHover={() => setSelectedMapId(lot.id)}
            />
          );
        })}
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <PageHeader title={t("findTitle")} subtitle={t("findSubtitle")} />

      <Segmented
        fullWidth
        value={useFilter}
        onChange={setUseFilter}
        options={[
          { value: "all", label: t("filterAll") },
          { value: "oil", label: t("filterOil") },
          { value: "table", label: t("filterTable") },
        ]}
      />

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      <LotsMap
        token={mapToken}
        points={mapPoints}
        selectedId={selectedMapId}
        onSelect={setSelectedMapId}
        labels={{
          locate: t("mapLocate"),
          zoomIn: t("mapZoomIn"),
          zoomOut: t("mapZoomOut"),
          needToken: t("mapNeedToken"),
          empty: t("mapEmpty"),
          qualityScore: t("qualityScore"),
          openLot: t("openLot"),
        }}
      />

      <div className="flex gap-2 min-[900px]:hidden">
        <ApButton
          label={activeFilterCount > 0 ? t("filtersWithCount", { n: activeFilterCount }) : t("filters")}
          variant="outline"
          icon={<SlidersHorizontal className="size-4" />}
          onClick={() => setFiltersOpen(true)}
          className="flex-1"
        />
        <ApButton
          label={t("sort")}
          variant="outline"
          icon={<ArrowUpDown className="size-4" />}
          onClick={() => setSortOpen(true)}
          className="flex-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden min-[900px]:block">
          <ApCard className="sticky top-4 space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-extrabold text-ink">{t("filters")}</p>
              {activeFilterCount > 0 ? (
                <button type="button" onClick={clearFilters} className="text-[12px] font-bold text-muted-foreground hover:text-ink">
                  {t("clearAllFilters")}
                </button>
              ) : null}
            </div>
            {filtersBody}
            <div className="border-t border-line pt-3">
              <ChipGroup
                label={t("sort")}
                value={sort}
                onChange={(v) => setSort(v as SortKey)}
                options={[
                  { value: "score", label: t("sortBestScore") },
                  { value: "price", label: t("sortLowestPrice") },
                  { value: "harvest", label: t("sortNearestHarvest") },
                  { value: "tons", label: t("sortMostTons") },
                ]}
              />
            </div>
          </ApCard>
        </aside>

        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-[16px] font-extrabold text-ink">{t("lotsCount", { count: shown.length })}</p>
            <p className="text-[12px] font-medium text-muted-foreground">{sortLabel}</p>
          </div>
          {activeChips}
          {resultsBlock}
        </div>
      </div>

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("filters")}
        actionLabel={t("showLots", { count: shown.length })}
        onAction={() => setFiltersOpen(false)}
      >
        {filtersBody}
      </BottomSheet>

      <BottomSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title={t("sort")}
        actionLabel={t("applySort")}
        onAction={() => setSortOpen(false)}
      >
        <ChipGroup
          label={t("sort")}
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={[
            { value: "score", label: t("sortBestScore") },
            { value: "price", label: t("sortLowestPrice") },
            { value: "harvest", label: t("sortNearestHarvest") },
            { value: "tons", label: t("sortMostTons") },
          ]}
        />
      </BottomSheet>

      <Dialog
        open={offerLot != null}
        onClose={() => setOfferLot(null)}
        title={t("makeOffer")}
        subtitle={offerLot ? `${varietyLabel(offerLot.variety)} · ${offerLot.tons} t` : undefined}
        actionLabel={t("sendOffer")}
        onAction={() => void submitOffer()}
      >
        <TextField label={t("tons")} value={offerTons} onChange={setOfferTons} suffix="t" inputMode="decimal" />
        <TextField label={t("price")} value={offerPrice} onChange={setOfferPrice} suffix="€/kg" inputMode="decimal" />
        <DayChipPicker
          label={t("arriveOn")}
          days={offerWeek}
          value={offerArrive}
          onChange={setOfferArrive}
          formatDay={(iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short" })}
          todayLabel={t("todayShort")}
        />
      </Dialog>
    </div>
  );
}
