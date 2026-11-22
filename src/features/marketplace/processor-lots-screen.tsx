"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, FlaskConical, Leaf, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { publicEnv } from "@/core/config/env";
import { marketplaceVarietyOptions, varietyLabel as varietyLabelFn } from "@/features/fields/olive-varieties";
import { reverseGeocodePlace } from "@/features/fields/reverse-geocode";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Chip } from "@/shared/components/brand/chip";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { trustBadges } from "@/features/marketplace/badges";
import {
  MARKET_LIMITS,
  formatEuro,
  formatEuroPerKg,
  formatQuantity,
  kgToTons,
  parseBounded,
  parseLocaleNumber,
  tonsToKg,
} from "@/features/marketplace/pricing";
import {
  OIL_CATEGORIES,
  OIL_STORAGES,
  ProductBadge,
  oilCategoryI18nKey,
  oilStorageI18nKey,
  productI18nKey,
} from "@/features/marketplace/product-badge";
import type { OilCategory, OilStorage, ProductKind } from "@/shared/types/database";
// Mapbox (~1 MB) is only fetched when a map is actually on screen.
const LotsMap = dynamic(() => import("./lots-map").then((m) => m.LotsMap), {
  ssr: false,
  loading: () => <div className="w-full animate-pulse rounded-[18px] bg-soft" style={{ height: 360 }} />,
});
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
import { MARKET_REGIONS, regionLabel, regionMatches, resolveMarketRegion } from "./regions";
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  nextSevenDays,
  todayIsoDate,
} from "./schedule";
import { SCORE_SLIDER_MAX, ScoreSlider, scoreBand } from "./score-slider";
import {
  harvestRangeLabel,
  lotPlaceLabel,
  placeLotOffer,
  useProcessorMarket,
  type ProcessorLot,
} from "./use-processor-market";
import { useBoundsMessage, useErrorMessage } from "@/shared/lib/error-message";

type SortKey = "score" | "price" | "harvest" | "tons";
type MobileView = "list" | "map";

const CHIP_TOUCH = "min-h-11 h-auto py-2";

function useVarietyLabel() {
  const locale = useLocale();
  return (slug: string) => varietyLabelFn(slug, locale);
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
            const region = lot.region ? regionLabel(lot.region, locale) : "";
            next[lot.id] = `${lot.town}${region ? `, ${region}` : ""}`;
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
    out.push({ id: "lab-suggested", label: t("labTestSuggested") });
  }
  if (lot.hasBannedSpray) {
    out.unshift({ id: "banned", label: t("sprayNotApproved") });
  }
  return out;
}

export function ProcessorLotsScreen() {
  const t = useTranslations("processor");
  const errMsg = useErrorMessage();
  const boundsMsg = useBoundsMessage();
  const locale = useLocale();
  const router = useRouter();
  const varietyLabel = useVarietyLabel();
  const varietyOptions = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  const { lots, loading, error, reload } = useProcessorMarket();
  const placeById = useLotPlaceLabels(lots);
  const [productFilter, setProductFilter] = useState<ProductKind>("oil");
  const [useFilter, setUseFilter] = useState<"all" | "oil" | "table">("all");
  const [oilCategoryFilter, setOilCategoryFilter] = useState<"all" | OilCategory>("all");
  const [maxAcidityText, setMaxAcidityText] = useState("");
  const [organicOnly, setOrganicOnly] = useState(false);
  const [storageFilter, setStorageFilter] = useState<"all" | OilStorage>("all");
  const [variety, setVariety] = useState("all");
  const [varietyExpanded, setVarietyExpanded] = useState(false);
  const [province, setProvince] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [noBanned, setNoBanned] = useState(false);
  const [labSuggested, setLabSuggested] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [offerLot, setOfferLot] = useState<ProcessorLot | null>(null);
  const [offerTons, setOfferTons] = useState("5");
  const [offerPrice, setOfferPrice] = useState("0.80");
  const offerIsOil = offerLot?.product === "oil";
  const [offerArrive, setOfferArrive] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const offerWeek = useMemo(() => nextSevenDays(), []);
  const mapToken = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;

  const listed = useMemo(() => lots.filter((l) => l.status === "listed"), [lots]);

  const regionOptions = useMemo(() => {
    const keys = new Set<string>([...MARKET_REGIONS]);
    for (const r of listed.map((l) => l.region).filter(Boolean)) {
      keys.add(resolveMarketRegion(r) ?? r);
    }
    return [...keys].map((value) => ({
      value,
      label: regionLabel(value, locale),
    }));
  }, [listed, locale]);

  const popularVarieties = varietyOptions.slice(0, 3);
  const extraVarieties = varietyOptions.slice(3);
  const visibleVarieties = varietyExpanded ? varietyOptions : popularVarieties;

  const maxAcidityN = parseLocaleNumber(maxAcidityText);

  const shown = useMemo(() => {
    const filtered = listed
      .filter((l) => l.product === productFilter)
      .filter((l) =>
        productFilter === "olives" ? (useFilter === "all" ? true : l.useType === useFilter) : true,
      )
      .filter((l) =>
        productFilter === "oil" && oilCategoryFilter !== "all"
          ? l.oilCategory === oilCategoryFilter
          : true,
      )
      .filter((l) =>
        productFilter === "oil" && maxAcidityN != null
          ? l.acidity != null && l.acidity <= maxAcidityN
          : true,
      )
      .filter((l) => (productFilter === "oil" && organicOnly ? l.organic : true))
      .filter((l) =>
        productFilter === "oil" && storageFilter !== "all" ? l.storage === storageFilter : true,
      )
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
  }, [
    listed,
    productFilter,
    useFilter,
    oilCategoryFilter,
    maxAcidityN,
    organicOnly,
    storageFilter,
    variety,
    province,
    minScore,
    noBanned,
    labSuggested,
    placeById,
    sort,
  ]);

  const mapPoints = useMemo(
    () =>
      shown
        .filter((l) => l.lat != null && l.lon != null)
        .map((l) => {
          const place = lotPlaceLabel(l, t("anonymousGrove"), placeById[l.id], locale);
          return {
            id: l.id,
            lat: l.lat!,
            lon: l.lon!,
            label: place,
            score: l.qualityScore,
            title: `${varietyLabel(l.variety)} · ${formatQuantity(l.product, l.tons, locale)}`,
            subtitle: t("lotSub", {
              place,
              harvest: harvestRangeLabel(l.harvestStart, l.harvestEnd, locale),
              use:
                l.product === "oil"
                  ? [
                      l.oilCategory ? t(oilCategoryI18nKey(l.oilCategory)) : t("productOil"),
                      l.acidity != null ? `${t("acidity")} ${l.acidity}%` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : l.useType === "table"
                    ? t("filterTable")
                    : t("filterOil"),
            }),
            priceLabel:
              l.pricePerKg != null
                ? `${formatEuroPerKg(l.pricePerKg, locale)} · ${t("farmerPrice")}`
                : t("openToOffers"),
            useLabel:
              l.product === "oil"
                ? l.oilCategory
                  ? t(oilCategoryI18nKey(l.oilCategory))
                  : t("productOil")
                : l.useType === "table"
                  ? t("filterTable")
                  : t("filterOil"),
            harvestLabel: harvestRangeLabel(l.harvestStart, l.harvestEnd, locale),
          };
        }),
    [shown, placeById, t, varietyLabel, locale],
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
    (labSuggested ? 1 : 0) +
    (productFilter === "oil" && oilCategoryFilter !== "all" ? 1 : 0) +
    (productFilter === "oil" && maxAcidityText.trim() ? 1 : 0) +
    (productFilter === "oil" && organicOnly ? 1 : 0) +
    (productFilter === "oil" && storageFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setVariety("all");
    setProvince("all");
    setMinScore(0);
    setNoBanned(false);
    setLabSuggested(false);
    setVarietyExpanded(false);
    setOilCategoryFilter("all");
    setMaxAcidityText("");
    setOrganicOnly(false);
    setStorageFilter("all");
  };

  const submitOffer = async () => {
    if (!offerLot?.farmerId) {
      toast.error(t("identityHidden"));
      return;
    }
    const oil = offerLot.product === "oil";
    const qtyBounds = oil
      ? {
          min: MARKET_LIMITS.oilKg.min,
          max: Math.min(MARKET_LIMITS.oilKg.max, tonsToKg(offerLot.tons)),
        }
      : {
          min: MARKET_LIMITS.lotTons.min,
          max: Math.min(MARKET_LIMITS.lotTons.max, offerLot.tons ?? MARKET_LIMITS.lotTons.max),
        };
    const tc = parseBounded(String(offerTons), qtyBounds);
    if (!tc.ok) {
      toast.error(boundsMsg(tc, oil ? "kg" : "tons", locale));
      return;
    }
    const pc = parseBounded(String(offerPrice), oil ? MARKET_LIMITS.oilPricePerKg : MARKET_LIMITS.pricePerKg);
    if (!pc.ok) {
      toast.error(boundsMsg(pc, "price", locale));
      return;
    }
    const tons = oil ? kgToTons(tc.value) : tc.value;
    const price = pc.value;
    const toastId = toast.loading(t("sendingOffer"));
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
      toast.error(errMsg(res.error, "saveFailed"), { id: toastId });
      return;
    }
    toast.success(t("offerSentDetail"), { id: toastId });
    setOfferLot(null);
    await reload();
  };

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "score", label: t("sortBestScore") },
    { value: "price", label: t("sortLowestPrice") },
    { value: "harvest", label: t("sortNearestHarvest") },
    { value: "tons", label: t("sortMostTons") },
  ];

  const filtersBody = (
    <>
      {productFilter === "oil" ? (
        <>
          <ChipGroup
            label={t("oilCategory")}
            value={oilCategoryFilter}
            onChange={(v) => setOilCategoryFilter(v as "all" | OilCategory)}
            chipClassName={CHIP_TOUCH}
            options={[
              { value: "all", label: t("filterAll") },
              ...OIL_CATEGORIES.map((c) => ({ value: c, label: t(oilCategoryI18nKey(c)) })),
            ]}
          />
          <TextField
            label={t("maxAcidity")}
            value={maxAcidityText}
            onChange={setMaxAcidityText}
            suffix="%"
            inputMode="decimal"
            placeholder="0,8"
          />
          <ChipGroup
            label={t("storage")}
            value={storageFilter}
            onChange={(v) => setStorageFilter(v as "all" | OilStorage)}
            chipClassName={CHIP_TOUCH}
            options={[
              { value: "all", label: t("filterAll") },
              ...OIL_STORAGES.map((s) => ({ value: s, label: t(oilStorageI18nKey(s)) })),
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Chip tone="black" on={organicOnly} onClick={() => setOrganicOnly((v) => !v)} className={CHIP_TOUCH}>
              <span className={cn("text-[12px] font-bold", organicOnly ? "text-white" : "text-ink")}>
                {t("organicOil")}
              </span>
            </Chip>
          </div>
        </>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{t("variety")}</p>
        <div className="flex flex-wrap gap-2">
          <Chip tone="black" on={variety === "all"} onClick={() => setVariety("all")} className={CHIP_TOUCH}>
            <span className={cn("text-[12px] font-bold", variety === "all" ? "text-white" : "text-ink")}>{t("filterAll")}</span>
          </Chip>
          {visibleVarieties.map((v) => (
            <Chip key={v.value} tone="black" on={variety === v.value} onClick={() => setVariety(v.value)} className={CHIP_TOUCH}>
              <span className={cn("text-[12px] font-bold", variety === v.value ? "text-white" : "text-ink")}>{v.label}</span>
            </Chip>
          ))}
          {!varietyExpanded && extraVarieties.length > 0 ? (
            <Chip tone="black" on={false} onClick={() => setVarietyExpanded(true)} className={CHIP_TOUCH}>
              <span className="text-[12px] font-bold text-ink">{t("moreVarieties", { n: extraVarieties.length })}</span>
            </Chip>
          ) : null}
        </div>
      </div>

      <ChipGroup
        label={t("province")}
        value={province}
        onChange={setProvince}
        chipClassName={CHIP_TOUCH}
        options={[{ value: "all", label: t("filterAll") }, ...regionOptions]}
      />

      <ScoreSlider
        label={t("minScore")}
        value={minScore}
        onChange={setMinScore}
        min={0}
        max={SCORE_SLIDER_MAX}
        step={1}
        valueLabel={minScore <= 0 ? t("allScores") : t("requestScoreMin", { score: String(minScore) })}
        bandLabel={
          minScore <= 0
            ? t("allScores")
            : t(
                scoreBand(minScore) === "high"
                  ? "scoreBandHigh"
                  : scoreBand(minScore) === "mid"
                    ? "scoreBandMid"
                    : "scoreBandLow",
              )
        }
        hint={minScore <= 0 ? undefined : t("scoreSliderHint", { score: String(minScore) })}
      />

      <div className="flex flex-wrap gap-2">
        <Chip tone="black" on={noBanned} onClick={() => setNoBanned((v) => !v)} className={CHIP_TOUCH}>
          <span className={cn("text-[12px] font-bold", noBanned ? "text-white" : "text-ink")}>{t("noBannedProducts")}</span>
        </Chip>
        <Chip tone="black" on={labSuggested} onClick={() => setLabSuggested((v) => !v)} className={CHIP_TOUCH}>
          <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-bold", labSuggested ? "text-white" : "text-ink")}>
            <FlaskConical className="size-3.5 shrink-0" />
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
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {varietyLabel(variety)}
            <X className="size-3.5" />
          </button>
        ) : null}
        {province !== "all" ? (
          <button
            type="button"
            onClick={() => setProvince("all")}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {regionLabel(province, locale)}
            <X className="size-3.5" />
          </button>
        ) : null}
        {minScore > 0 ? (
          <button
            type="button"
            onClick={() => setMinScore(0)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {t("minScoreValue", { score: minScore })}
            <X className="size-3.5" />
          </button>
        ) : null}
        {noBanned ? (
          <button
            type="button"
            onClick={() => setNoBanned(false)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {t("noBannedProducts")}
            <X className="size-3.5" />
          </button>
        ) : null}
        {labSuggested ? (
          <button
            type="button"
            onClick={() => setLabSuggested(false)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {t("labTestSuggested")}
            <X className="size-3.5" />
          </button>
        ) : null}
        {productFilter === "oil" && oilCategoryFilter !== "all" ? (
          <button
            type="button"
            onClick={() => setOilCategoryFilter("all")}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {t(oilCategoryI18nKey(oilCategoryFilter))}
            <X className="size-3.5" />
          </button>
        ) : null}
        {productFilter === "oil" && maxAcidityText.trim() ? (
          <button
            type="button"
            onClick={() => setMaxAcidityText("")}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {t("maxAcidity")} {maxAcidityText}%
            <X className="size-3.5" />
          </button>
        ) : null}
        {productFilter === "oil" && organicOnly ? (
          <button
            type="button"
            onClick={() => setOrganicOnly(false)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {t("organicOil")}
            <X className="size-3.5" />
          </button>
        ) : null}
        {productFilter === "oil" && storageFilter !== "all" ? (
          <button
            type="button"
            onClick={() => setStorageFilter("all")}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-ink"
          >
            {t(oilStorageI18nKey(storageFilter))}
            <X className="size-3.5" />
          </button>
        ) : null}
        <button type="button" onClick={clearFilters} className="text-[12px] font-bold text-muted-foreground hover:text-ink">
          {t("clearAllFilters")}
        </button>
      </div>
    ) : null;

  const mapBlock = (className?: string) => (
    <LotsMap
      token={mapToken}
      points={mapPoints}
      selectedId={selectedMapId}
      onSelect={setSelectedMapId}
      onOpenLot={(id) => router.push(`/processor/lots/${id}`)}
      className={className}
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
  );

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
      <div
        className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[900px]:gap-4"
        onMouseLeave={() => setSelectedMapId(null)}
      >
        {shown.map((lot) => {
          const badges = lotBadgesFor(lot, t).slice(0, 3);
          const place = regionLabel(lot.region, locale);
          const oilMeta =
            lot.product === "oil"
              ? [
                  lot.oilCategory ? t(oilCategoryI18nKey(lot.oilCategory)) : null,
                  lot.acidity != null ? `${t("acidity")} ${lot.acidity}%` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "";
          const harvest = harvestRangeLabel(lot.harvestStart, lot.harvestEnd, locale);
          return (
            <LotResultCard
              key={lot.id}
              href={`/processor/lots/${lot.id}`}
              title={`${varietyLabel(lot.variety)} · ${formatQuantity(lot.product, lot.tons, locale)}`}
              place={place}
              harvest={oilMeta ? `${oilMeta}${harvest !== "—" ? ` · ${harvest}` : ""}` : harvest}
              score={lot.product === "oil" ? null : lot.qualityScore}
              scoreLabel={t("qualityScore")}
              badges={
                <>
                  <ProductBadge product={lot.product} label={t(productI18nKey(lot.product))} />
                  {lot.product === "olives" ? <LotBadges badges={badges} max={3} /> : null}
                </>
              }
              price={
                lot.pricePerKg != null ? (
                  <Amount value={formatEuro(lot.pricePerKg, locale)} unit="/kg" />
                ) : (
                  <span className="text-[13px] font-semibold text-muted-foreground">{t("openToOffers")}</span>
                )
              }
              priceHint={lot.pricePerKg != null ? t("farmerPrice") : undefined}
              selected={selectedMapId === lot.id}
              onHover={() => setSelectedMapId(lot.id)}
            />
          );
        })}
      </div>
    );

  const productSegmented = (
    <Segmented
      fullWidth
      value={productFilter}
      onChange={setProductFilter}
      options={[
        { value: "oil", label: t("productOil") },
        { value: "olives", label: t("productOlives") },
      ]}
    />
  );

  const useFilterSegmented =
    productFilter === "olives" ? (
      <Segmented
        value={useFilter}
        onChange={setUseFilter}
        options={[
          { value: "all", label: t("filterAll") },
          { value: "oil", label: t("filterOil") },
          { value: "table", label: t("filterTable") },
        ]}
      />
    ) : null;

  const sortSelect = (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{t("sort")}</span>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
        className="h-10 rounded-full border border-line bg-card px-3 text-[13px] font-bold text-ink outline-none focus:border-ink"
        aria-label={t("sort")}
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <div className="mb-2 flex flex-col gap-3 min-[720px]:mb-6 min-[720px]:flex-row min-[720px]:items-end min-[720px]:justify-between">
        <div className="min-w-0 flex-1 [&_>div]:mb-0">
          <PageHeader title={t("findTitle")} subtitle={t("findSubtitle")} />
        </div>
        <div className="w-full shrink-0 min-[720px]:w-[260px]">{productSegmented}</div>
      </div>

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      {/* —— Mobile —— */}
      <div className="space-y-3 min-[900px]:hidden">
        <div className="flex gap-2">
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[16px] font-extrabold text-ink">{t("lotsCount", { count: shown.length })}</p>
          <Segmented
            value={mobileView}
            onChange={setMobileView}
            options={[
              { value: "list", label: t("viewList") },
              { value: "map", label: t("viewMap") },
            ]}
          />
        </div>

        {useFilterSegmented ? (
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{useFilterSegmented}</div>
        ) : null}
        {activeChips}

        {mobileView === "map"
          ? mapBlock("!h-[60vh] !min-h-[60vh] min-[900px]:!h-[60vh]")
          : resultsBlock}
      </div>

      {/* —— Desktop —— */}
      <div className="hidden gap-6 min-[900px]:grid min-[900px]:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-4">
          <ApCard className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-extrabold text-ink">{t("filters")}</p>
              {activeFilterCount > 0 ? (
                <button type="button" onClick={clearFilters} className="text-[12px] font-bold text-muted-foreground hover:text-ink">
                  {t("clearAllFilters")}
                </button>
              ) : null}
            </div>
            {filtersBody}
          </ApCard>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {useFilterSegmented}
              <p className="text-[16px] font-extrabold text-ink">{t("lotsCount", { count: shown.length })}</p>
            </div>
            {sortSelect}
          </div>

          {activeChips}
          {resultsBlock}
        </div>

        <aside className="min-w-0">
          <div className="sticky top-8 h-[calc(100vh-120px)] overflow-hidden rounded-[18px]">
            {mapBlock("!h-full !min-h-full !max-h-none min-[900px]:!h-full min-[900px]:!min-h-full")}
          </div>
        </aside>
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

      <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)} title={t("sort")}>
        <div className="flex flex-col gap-2">
          {sortOptions.map((o) => {
            const on = sort === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setSort(o.value);
                  setSortOpen(false);
                }}
                className={cn(
                  "flex min-h-11 items-center rounded-xl border px-4 text-left text-[14px] font-bold",
                  on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:bg-soft",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <Dialog
        open={offerLot != null}
        onClose={() => setOfferLot(null)}
        title={t("makeOffer")}
        subtitle={
          offerLot
            ? `${varietyLabel(offerLot.variety)} · ${formatQuantity(offerLot.product, offerLot.tons, locale)}`
            : undefined
        }
        actionLabel={t("sendOffer")}
        onAction={() => submitOffer()}
      >
        <TextField
          label={offerIsOil ? t("quantityKg") : t("tons")}
          value={offerTons}
          onChange={setOfferTons}
          suffix={offerIsOil ? "kg" : "t"}
          inputMode="decimal"
        />
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
