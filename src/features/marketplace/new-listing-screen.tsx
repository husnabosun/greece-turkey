"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, Trees } from "lucide-react";
import { formatArea } from "@/features/fields/area";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import {
  defaultVarietySlug,
  marketplaceVarietyOptions,
  resolveOliveCountry,
  varietyAgronomyContext,
  varietyLabelFromStored,
} from "@/features/fields/olive-varieties";
import { marketRegionCountry, marketRegionOptions } from "@/features/marketplace/regions";
import {
  MARKET_LIMITS,
  allowedOilCategories,
  formatDateRange,
  formatEuro,
  formatEuroPerKg,
  formatQuantity,
  kgToTons,
  oilCategoryFromAcidity,
  parseBounded,
  parseLocaleNumber,
  saleTotal,
} from "@/features/marketplace/pricing";
import {
  OIL_STORAGES,
  ProductBadge,
  oilCategoryI18nKey,
  oilStorageI18nKey,
  productI18nKey,
} from "@/features/marketplace/product-badge";
import { oilPdoPgiGrouped, oilPdoPgiOptionLabel } from "@/features/marketplace/oil-pdo";
import { ChipGroup, Segmented, Switch, TextField } from "@/features/marketplace/processor-kit";
import { RangeCalendar } from "@/features/marketplace/range-calendar";
import type { OilCategory, OilStorage, ProductKind } from "@/shared/types/database";
import { scoreToneClasses } from "@/features/marketplace/score-slider";
import { useBoundsMessage } from "@/shared/lib/error-message";
import { publishLot } from "@/features/marketplace/save-lot";
import { useFarmerMarket } from "@/features/marketplace/use-farmer-market";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";

function labelForPrimaryUse(use: string, t: (key: "useOil" | "useDual" | "useTable") => string) {
  if (use === "OIL") return t("useOil");
  if (use === "DUAL") return t("useDual");
  if (use === "TABLE") return t("useTable");
  return use;
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Step = 1 | 2 | 3;

function isCommitted(st: string | null | undefined) {
  return st === "sold" || st === "reserved";
}

const SEASON_OPTIONS = ["2025/26", "2026/27"];

export function NewListingScreen({
  fieldId,
  factoryId,
  buyRequestId,
  product: productParam,
}: {
  fieldId?: string;
  factoryId?: string;
  buyRequestId?: string;
  product?: ProductKind;
}) {
  const t = useTranslations("farmerMarket");
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading } = useFarmerFields();
  const fieldIds = useMemo(() => fields.map((f) => f.id), [fields]);
  const { fieldCards } = useFarmerMarket(fieldIds);
  const [step, setStep] = useState<Step>(1);
  const [product, setProduct] = useState<ProductKind>(() =>
    productParam === "oil" || productParam === "olives" ? productParam : fieldId ? "olives" : "oil",
  );
  const isOil = product === "oil";
  const [currentId, setCurrentId] = useState(fieldId ?? "");
  const field = currentId ? (fields.find((f) => f.id === currentId) ?? null) : null;
  const targetProcessorId = factoryId?.trim() || null;
  const targetRequestId = buyRequestId?.trim() || null;
  const isOfferToMill = Boolean(targetProcessorId);

  useEffect(() => {
    if (productParam === "oil" || productParam === "olives") setProduct(productParam);
  }, [productParam]);

  useEffect(() => {
    if (!fields.length) return;
    if (fieldId && fields.some((f) => f.id === fieldId)) {
      setCurrentId(fieldId);
      return;
    }
    if (isOil && !currentId) return;
    if (currentId && !fields.some((f) => f.id === currentId)) {
      // Suggest a field whose harvest isn't already sold / in delivery.
      const free = fields.find((f) => !isCommitted(fieldCards[f.id]?.lotStatus));
      setCurrentId(isOil ? "" : (free ?? fields[0]!).id);
    }
  }, [fields, fieldId, currentId, fieldCards, isOil]);
  const orderedFields = useMemo(
    () =>
      [...fields].sort(
        (a, b) =>
          Number(isCommitted(fieldCards[a.id]?.lotStatus)) -
          Number(isCommitted(fieldCards[b.id]?.lotStatus)),
      ),
    [fields, fieldCards],
  );

  const defaultStart = useMemo(() => isoToday(), []);
  const [tonsText, setTonsText] = useState("");
  const [harvestStart, setHarvestStart] = useState(defaultStart);
  const [harvestEnd, setHarvestEnd] = useState(() => addDaysIso(defaultStart, 7));
  const [negotiable, setNegotiable] = useState(false);
  const [delivery, setDelivery] = useState<"pickup" | "deliver">("pickup");
  const [priceText, setPriceText] = useState("");
  const [acidityText, setAcidityText] = useState("0,3");
  const [oilCategory, setOilCategory] = useState<OilCategory>("extra_virgin");
  const [harvestSeason, setHarvestSeason] = useState(SEASON_OPTIONS[1]!);
  const ownCountry = resolveOliveCountry({ locale }).country;
  const [oilVariety, setOilVariety] = useState<string>(() => defaultVarietySlug(ownCountry));
  const [oilRegion, setOilRegion] = useState<string>("");
  const oilVarietyOptions = useMemo(() => {
    const other = ownCountry === "GR" ? "TR" : "GR";
    const seen = new Set<string>();
    return [
      ...marketplaceVarietyOptions(locale, { profileCountry: ownCountry }),
      ...marketplaceVarietyOptions(locale, { profileCountry: other }),
    ].filter((v) => (seen.has(v.value) ? false : (seen.add(v.value), true)));
  }, [locale, ownCountry]);
  const oilRegionOptions = useMemo(() => marketRegionOptions(locale), [locale]);
  const [storage, setStorage] = useState<OilStorage>("tank");
  const [peroxideText, setPeroxideText] = useState("");
  const [polyphenolsText, setPolyphenolsText] = useState("");
  const [pdoPgi, setPdoPgi] = useState("");
  const [organic, setOrganic] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const publishLock = useRef(false);

  const score = field ? fieldCards[field.id]?.qualityScore ?? null : null;
  const harvestRangeText =
    harvestStart && harvestEnd
      ? formatDateRange(harvestStart, harvestEnd, locale)
      : harvestStart
        ? t("pickHarvestEnd")
        : t("harvestPeriod");
  const boundsMsg = useBoundsMessage();
  const qtyBounds = isOil ? MARKET_LIMITS.oilKg : MARKET_LIMITS.lotTons;
  const tonsCheck = parseBounded(tonsText, qtyBounds);
  const priceCheck = parseBounded(priceText, isOil ? MARKET_LIMITS.oilPricePerKg : MARKET_LIMITS.pricePerKg);
  const acidityCheck = parseBounded(acidityText, MARKET_LIMITS.acidity);
  const acidityN = acidityCheck.ok ? acidityCheck.value : parseLocaleNumber(acidityText);
  const allowedCats = acidityN != null ? allowedOilCategories(acidityN) : allowedOilCategories(0.3);
  const tons = tonsCheck.ok ? (isOil ? kgToTons(tonsCheck.value) : tonsCheck.value) : null;
  const price = priceCheck.ok ? priceCheck.value : null;
  const tonsError =
    tonsText.trim() && !tonsCheck.ok ? boundsMsg(tonsCheck, isOil ? "kg" : "tons", locale) : null;
  const priceError =
    priceText.trim() && !priceCheck.ok ? boundsMsg(priceCheck, "price", locale) : null;

  async function publish() {
    if (publishing || publishLock.current) return;
    if (!isOil && !field) return;
    if (!tonsCheck.ok) {
      toast.error(boundsMsg(tonsCheck, isOil ? "kg" : "tons", locale));
      return;
    }
    if (!priceCheck.ok) {
      toast.error(boundsMsg(priceCheck, "price", locale));
      return;
    }
    if (isOil) {
      if (!acidityCheck.ok) {
        toast.error(t("acidity"));
        return;
      }
      if (!allowedCats.includes(oilCategory)) {
        toast.error(t("oilCategory"));
        return;
      }
      if (!harvestSeason.trim() || !storage) {
        toast.error(t("invalid"));
        return;
      }
      if (!field && !oilRegion) {
        toast.error(t("oilRegionRequired"));
        return;
      }
    } else if (!harvestStart || !harvestEnd || harvestEnd < harvestStart) {
      toast.error(t("invalidHarvestRange"));
      return;
    }
    publishLock.current = true;
    setPublishing(true);
    try {
      const peroxideN = peroxideText.trim() ? parseLocaleNumber(peroxideText) : null;
      const polyphenolsN = polyphenolsText.trim() ? parseLocaleNumber(polyphenolsText) : null;
      const result = await publishLot({
        fieldId: field?.id ?? null,
        product,
        variety: field?.variety ?? (isOil ? oilVariety : null),
        varietySlug: field?.variety_slug ?? (isOil ? oilVariety : null),
        ...(isOil && !field && oilRegion
          ? { region: oilRegion, country: marketRegionCountry(oilRegion) }
          : {}),
        tons: isOil ? kgToTons(tonsCheck.value) : tonsCheck.value,
        pricePerKg: priceCheck.value,
        negotiable,
        delivery,
        harvestStart,
        harvestEnd,
        oilCategory: isOil ? oilCategory : null,
        acidity: isOil && acidityCheck.ok ? acidityCheck.value : null,
        harvestSeason: isOil ? harvestSeason : null,
        storage: isOil ? storage : null,
        peroxide: isOil ? peroxideN : null,
        polyphenols: isOil ? (polyphenolsN != null ? Math.round(polyphenolsN) : null) : null,
        pdoPgi: isOil ? pdoPgi.trim() || null : null,
        organic: isOil ? organic : false,
        processorId: targetProcessorId,
        buyRequestId: targetRequestId,
      });
      if (!result.ok) {
        publishLock.current = false;
        toast.error(
          t(
            result.error === "needLogin" ||
              result.error === "needSupabase" ||
              result.error === "offerFailed"
              ? result.error === "offerFailed"
                ? "offerFailed"
                : result.error
              : "publishFailed",
          ),
        );
        return;
      }
      toast.success(isOfferToMill ? t("offerSent") : t("published"));
      router.push(isOfferToMill ? "/farmer/market?tab=offers" : "/farmer/market?tab=overview");
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full flex-1">
        <Header title={t("newListing")} step={1} />
        <div className="mt-4 h-28 animate-pulse rounded-[18px] bg-soft" />
      </div>
    );
  }

  if (!isOil && fields.length === 0) {
    return (
      <div className="w-full flex-1">
        <Header title={t("newListing")} step={1} />
        <p className="mt-6 text-ap-body text-muted-foreground">{t("noFieldsForListing")}</p>
        <Link
          href="/farmer/fields/new"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-ap-btn font-bold text-white"
        >
          {t("newLot")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 pb-8">
      <Header title={isOfferToMill ? t("offerToMill") : t("newListing")} step={step} />
      {isOfferToMill ? (
        <p className="mt-2 text-ap-body text-muted-foreground">{t("offerToMillHint")}</p>
      ) : (
        <p className="mt-2 text-ap-body text-muted-foreground">{t("listForBidsHint")}</p>
      )}

      {step === 1 ? (
        <>
          <Label>{t("productOil")}</Label>
          <Segmented
            fullWidth
            value={product}
            onChange={(next) => {
              setProduct(next);
              if (next === "olives" && !currentId && fields[0]) setCurrentId(fields[0].id);
              if (next === "oil" && !fieldId) setCurrentId("");
            }}
            options={[
              { value: "oil", label: t("productOil") },
              { value: "olives", label: t("productOlives") },
            ]}
          />
          <Label>{isOil ? t("bulkOil") : t("fieldLabel")}</Label>
          <div className="space-y-2">
            {isOil ? (
              <button
                type="button"
                onClick={() => setCurrentId("")}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-colors",
                  !currentId ? "border-ink bg-soft" : "border-line bg-card hover:bg-soft/50",
                )}
              >
                <ProductBadge product="oil" label={t("productOil")} />
                <span className="min-w-0 flex-1 text-[15px] font-extrabold leading-5 text-ink">{t("bulkOil")}</span>
              </button>
            ) : null}
            {orderedFields.map((f) => {
              const on = f.id === field?.id;
              const sc = fieldCards[f.id]?.qualityScore;
              const st = fieldCards[f.id]?.lotStatus;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCurrentId(f.id)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition-colors",
                    on ? "border-ink bg-soft" : "border-line bg-card hover:bg-soft/50",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card">
                    <Trees className="size-4 text-good" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-extrabold leading-5 text-ink">{f.name}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {f.variety || f.variety_slug ? (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink">
                          {varietyLabelFromStored(f.variety_slug ?? f.variety, locale)}
                        </span>
                      ) : null}
                      {isCommitted(st) ? (
                        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-bold text-warn-text">
                          {st === "sold" ? t("fieldSold") : t("fieldInDelivery")}
                        </span>
                      ) : null}
                      {f.area_ha != null ? (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink">
                          {formatArea(Number(f.area_ha), locale)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-center">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("qualityScore")}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[20px] leading-none font-extrabold",
                        sc != null ? scoreToneClasses(sc).text : "text-ink",
                      )}
                    >
                      {sc != null ? sc : "—"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!isOil && !field}
            onClick={() => setStep(2)}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
          >
            {t("continue")}
            <ArrowRight className="size-4" />
          </button>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
            <p className="text-ap-body text-muted-foreground">{isOil ? t("quantityKg") : t("howMuch")}</p>
            <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-line bg-background px-3">
              <input
                type="text"
                inputMode="decimal"
                value={tonsText}
                onChange={(e) => setTonsText(e.target.value)}
                placeholder={isOil ? "500" : "0,0"}
                className="min-w-0 flex-1 bg-transparent text-[16px] font-extrabold text-ink outline-none placeholder:text-muted-foreground/50"
                aria-label={isOil ? t("quantityKg") : t("howMuch")}
              />
              <span className="text-[13px] font-bold text-muted-foreground">{isOil ? "kg" : "t"}</span>
            </div>
            {tonsError ? (
              <p className="mt-1 text-ap-small font-semibold text-risk" role="alert">{tonsError}</p>
            ) : tons != null && !isOil ? (
              <p className="mt-1 text-ap-small font-semibold text-ink">
                = {Math.round(tons * 1000).toLocaleString(locale)} kg
              </p>
            ) : (
              <p className="mt-1 text-ap-small text-muted-foreground">{isOil ? t("anyQuantityHintKg") : t("anyQuantityHint")}</p>
            )}
          </div>

          {isOil ? (
            <div className="mt-3 space-y-4 rounded-[18px] border border-line bg-card p-3.5">
              <TextField
                label={t("acidity")}
                value={acidityText}
                onChange={(v) => {
                  setAcidityText(v);
                  const n = parseLocaleNumber(v);
                  if (n == null) return;
                  const best = oilCategoryFromAcidity(n);
                  const allowed = allowedOilCategories(n);
                  setOilCategory((prev) => (allowed.includes(prev) ? prev : best));
                }}
                suffix="%"
                inputMode="decimal"
                placeholder="0,3"
              />
              <ChipGroup
                label={t("oilCategory")}
                value={oilCategory}
                onChange={(v) => setOilCategory(v as OilCategory)}
                options={allowedCats.map((c) => ({ value: c, label: t(oilCategoryI18nKey(c)) }))}
              />
              {!field ? (
                <>
                  <ChipGroup
                    label={t("oilVariety")}
                    value={oilVariety}
                    onChange={setOilVariety}
                    options={oilVarietyOptions.map((v) => ({ value: v.value, label: v.label }))}
                  />
                  <ChipGroup
                    label={t("oilRegion")}
                    value={oilRegion}
                    onChange={setOilRegion}
                    options={oilRegionOptions}
                  />
                </>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <ChipGroup
                  label={t("harvestSeason")}
                  value={harvestSeason}
                  onChange={setHarvestSeason}
                  options={SEASON_OPTIONS.map((s) => ({ value: s, label: s }))}
                />
                <ChipGroup
                  label={t("storage")}
                  value={storage}
                  onChange={(v) => setStorage(v as OilStorage)}
                  options={OIL_STORAGES.map((s) => ({ value: s, label: t(oilStorageI18nKey(s)) }))}
                />
              </div>
              <label className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-background px-3">
                <span className="text-[14px] font-semibold text-ink">{t("organicOil")}</span>
                <Switch checked={organic} onCheckedChange={setOrganic} label={t("organicOil")} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={t("peroxide")}
                  value={peroxideText}
                  onChange={setPeroxideText}
                  suffix="meq O₂/kg"
                  inputMode="decimal"
                />
                <TextField
                  label={t("polyphenols")}
                  value={polyphenolsText}
                  onChange={setPolyphenolsText}
                  suffix="mg/kg"
                  inputMode="numeric"
                />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{t("pdoPgi")}</span>
                <span className="flex h-11 items-center rounded-xl border border-line bg-card px-3 focus-within:border-ink">
                  <select
                    value={pdoPgi}
                    onChange={(e) => setPdoPgi(e.target.value)}
                    aria-label={t("pdoPgi")}
                    className="h-full w-full min-w-0 appearance-none bg-transparent text-[14px] font-semibold text-ink outline-none"
                  >
                    <option value="">{t("pdoPgiNone")}</option>
                    {oilPdoPgiGrouped(locale).map((group) => (
                      <optgroup key={group.country} label={group.label}>
                        {group.items.map((item) => (
                          <option key={item.slug} value={item.slug}>
                            {oilPdoPgiOptionLabel(item, locale)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </span>
                <p className="text-ap-small text-muted-foreground">{t("pdoPgiHint")}</p>
              </label>
            </div>
          ) : (
            <>
          <Label>{t("harvestPeriod")}</Label>
          <div className="space-y-3 rounded-[18px] border border-line bg-card p-3">
            <div className="rounded-xl bg-soft px-4 py-3">
              <p className="text-[16px] font-extrabold text-ink">{harvestRangeText}</p>
              {!(harvestStart && harvestEnd) ? (
                <p className="text-[12px] font-semibold text-muted-foreground">{t("pickHarvestEnd")}</p>
              ) : null}
            </div>
            <RangeCalendar
              start={harvestStart}
              end={harvestEnd}
              onChange={(a, b) => {
                if (a) setHarvestStart(a);
                setHarvestEnd(b ?? a ?? harvestEnd);
              }}
              locale={locale}
              monthsShown={1}
              minIso={defaultStart}
              prevLabel={t("prevMonth")}
              nextLabel={t("nextMonth")}
            />
          </div>
            </>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-11 flex-1 items-center justify-center rounded-full border border-line bg-card text-ap-btn font-bold text-ink"
            >
              {t("back")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!tonsCheck.ok) {
                  toast.error(boundsMsg(tonsCheck, isOil ? "kg" : "tons", locale));
                  return;
                }
                if (isOil && !acidityCheck.ok) {
                  toast.error(t("acidity"));
                  return;
                }
                setStep(3);
              }}
              className="flex h-11 flex-[1.6] items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white"
            >
              {t("continue")}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <label className="mt-2 flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-line bg-card px-3.5">
            <span className="text-[14px] font-semibold text-ink">{t("openNegotiation")}</span>
            <Switch
              checked={negotiable}
              onCheckedChange={setNegotiable}
              label={t("openNegotiation")}
            />
          </label>

          <Label>{t("deliveryLabel")}</Label>
          <Segmented
            fullWidth
            value={delivery}
            onChange={setDelivery}
            options={[
              { value: "pickup", label: t("factoryPickup") },
              { value: "deliver", label: t("iDeliver") },
            ]}
          />

          <Label>{t("priceLabel")}</Label>
          <div className="rounded-[18px] border border-line bg-card p-3">
            <p className="text-ap-body text-muted-foreground">{t("yourPrice")}</p>
            <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-line px-3">
              <span className="text-[16px] font-extrabold text-muted-foreground">€</span>
              <input
                type="text"
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="0,00"
                className="min-w-0 flex-1 bg-transparent text-[20px] font-extrabold text-ink outline-none placeholder:text-muted-foreground/50"
                aria-label={t("yourPrice")}
              />
              <span className="text-[12px] font-medium text-muted-foreground">{t("perKg")}</span>
            </div>
            {priceError ? (
              <p className="mt-1 text-ap-small font-semibold text-risk" role="alert">{priceError}</p>
            ) : null}
          </div>

          <div className="mt-3 rounded-[18px] bg-soft p-3">
            <p className="text-ap-small font-bold text-muted-foreground uppercase">{t("summary")}</p>
            <div className="mt-1">
              <ProductBadge product={product} label={t(productI18nKey(product))} />
            </div>
            <p className="mt-1 text-ap-body font-extrabold text-ink">{field?.name ?? t("bulkOil")}</p>
            <p className="text-ap-small text-muted-foreground">
              {tons != null ? formatQuantity(product, tons, locale) : "—"}
              {" · "}
              {price != null ? formatEuroPerKg(price, locale) : "—"}
              {tons != null && price != null
                ? ` · ≈ ${formatEuro(saleTotal(tons, price), locale)}`
                : null}
            </p>
            {isOil ? (
              <p className="mt-1 text-ap-small text-muted-foreground">
                {t(oilCategoryI18nKey(oilCategory))}
                {acidityCheck.ok ? ` · ${t("acidity")} ${acidityCheck.value}%` : ""}
                {` · ${harvestSeason}`}
                {` · ${t(oilStorageI18nKey(storage))}`}
                {organic ? ` · ${t("organicOil")}` : ""}
              </p>
            ) : null}
            {score != null ? (
              <p className="mt-1 text-ap-small text-muted-foreground">
                {t("qualityScore")}: {score}
              </p>
            ) : null}
            {!isOil && field && (field.variety || field.variety_slug) ? (
              <p className="text-ap-small text-muted-foreground">
                {varietyLabelFromStored(field.variety_slug ?? field.variety, locale)}
                {(() => {
                  const agro = varietyAgronomyContext(field.variety_slug ?? field.variety);
                  return agro ? ` · ${labelForPrimaryUse(agro.primary_use, t)}` : "";
                })()}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex h-11 flex-1 items-center justify-center rounded-full border border-line bg-card text-ap-btn font-bold text-ink"
            >
              {t("back")}
            </button>
            <button
              type="button"
              disabled={publishing || (!isOil && !field)}
              onClick={() => void publish()}
              className="flex h-11 flex-[1.6] items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
            >
              {publishing
                ? isOfferToMill
                  ? t("sendingOffer")
                  : t("publishing")
                : isOfferToMill
                  ? t("sendOfferToMill")
                  : t("publishListing")}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Header({ title, step }: { title: string; step: Step }) {
  const t = useTranslations("farmerMarket");
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/farmer/market"
        aria-label={t("back")}
        className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-ink">{title}</h1>
      <div className="flex gap-1" aria-hidden>
        {([1, 2, 3] as const).map((n) => (
          <span key={n} className={cn("h-1 w-6 rounded-full", n <= step ? "bg-ink" : "bg-line")} />
        ))}
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mt-3 mb-1.5 text-ap-small font-semibold text-muted-foreground">{children}</p>;
}
