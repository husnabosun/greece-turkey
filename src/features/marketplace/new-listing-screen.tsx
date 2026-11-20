"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronLeft, Trees } from "lucide-react";
import { formatStremmata } from "@/features/fields/area";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { varietyAgronomyContext, varietyLabelFromStored } from "@/features/fields/olive-varieties";
import { DayChipPicker } from "@/features/marketplace/processor-kit";
import { formatEuro, formatEuroPerKg, formatTons } from "@/features/marketplace/pricing";
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

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function nextDays(fromIso: string, count: number) {
  return Array.from({ length: count }, (_, i) => addDaysIso(fromIso, i));
}

type Step = 1 | 2 | 3;

export function NewListingScreen({
  fieldId,
  factoryId,
  buyRequestId,
}: {
  fieldId?: string;
  factoryId?: string;
  buyRequestId?: string;
}) {
  const t = useTranslations("farmerMarket");
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading } = useFarmerFields();
  const fieldIds = useMemo(() => fields.map((f) => f.id), [fields]);
  const { fieldCards } = useFarmerMarket(fieldIds);
  const [step, setStep] = useState<Step>(1);
  const [currentId, setCurrentId] = useState(fieldId ?? "");
  const field = fields.find((f) => f.id === currentId) ?? fields[0];
  const targetProcessorId = factoryId?.trim() || null;
  const targetRequestId = buyRequestId?.trim() || null;
  const isOfferToMill = Boolean(targetProcessorId);

  useEffect(() => {
    if (!fields.length) return;
    if (fieldId && fields.some((f) => f.id === fieldId)) {
      setCurrentId(fieldId);
      return;
    }
    if (!fields.some((f) => f.id === currentId)) setCurrentId(fields[0]!.id);
  }, [fields, fieldId, currentId]);

  const defaultStart = useMemo(() => isoToday(), []);
  const [tonsText, setTonsText] = useState("");
  const [harvestStart, setHarvestStart] = useState(defaultStart);
  const [harvestEnd, setHarvestEnd] = useState(() => addDaysIso(defaultStart, 7));
  const [negotiable, setNegotiable] = useState(false);
  const [delivery, setDelivery] = useState<"pickup" | "deliver">("pickup");
  const [priceText, setPriceText] = useState("");
  const [publishing, setPublishing] = useState(false);
  const publishLock = useRef(false);

  const startDays = useMemo(() => nextDays(defaultStart, 14), [defaultStart]);
  const endDays = useMemo(() => nextDays(harvestStart, 14), [harvestStart]);

  const score = field ? fieldCards[field.id]?.qualityScore ?? null : null;
  const tons = parsePositiveNumber(tonsText);
  const price = parsePositiveNumber(priceText);

  async function publish() {
    if (!field || publishing || publishLock.current) return;
    if (tons == null) {
      toast.error(t("invalidTons"));
      return;
    }
    if (price == null) {
      toast.error(t("invalidPrice"));
      return;
    }
    if (!harvestStart || !harvestEnd || harvestEnd < harvestStart) {
      toast.error(t("invalidHarvestRange"));
      return;
    }
    publishLock.current = true;
    setPublishing(true);
    try {
      const result = await publishLot({
        fieldId: field.id,
        variety: field.variety,
        varietySlug: field.variety_slug ?? null,
        tons,
        pricePerKg: price,
        negotiable,
        delivery,
        harvestStart,
        harvestEnd,
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

  if (fields.length === 0) {
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
          <Label>{t("fieldLabel")}</Label>
          <div className="space-y-2">
            {fields.map((f) => {
              const on = f.id === field?.id;
              const sc = fieldCards[f.id]?.qualityScore;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCurrentId(f.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[18px] border p-3 text-left",
                    on ? "border-good/40 bg-good-soft" : "border-line bg-card",
                  )}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-soft">
                    <Trees className="size-5 text-good" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ap-card font-extrabold text-ink">{f.name}</span>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {f.variety || f.variety_slug ? (
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-ap-pill font-bold text-ink">
                          {varietyLabelFromStored(f.variety_slug ?? f.variety, locale)}
                        </span>
                      ) : null}
                      {f.area_ha != null ? (
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-ap-pill font-bold text-ink">
                          {t("haPill", { n: formatStremmata(Number(f.area_ha), 1, locale) })}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-center">
                    <span className="block text-ap-small text-muted-foreground">{t("qualityScore")}</span>
                    <span className="text-[22px] leading-none font-extrabold text-ink">
                      {sc != null ? sc : "—"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!field}
            onClick={() => setStep(2)}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
          >
            {t("continue")}
            <ArrowRight className="size-4" />
          </button>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
            <p className="text-ap-body text-muted-foreground">{t("howMuch")}</p>
            <div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-line bg-background px-3">
              <input
                type="text"
                inputMode="decimal"
                value={tonsText}
                onChange={(e) => setTonsText(e.target.value)}
                placeholder="0,0"
                className="min-w-0 flex-1 bg-transparent text-ap-card font-extrabold text-ink outline-none placeholder:text-muted-foreground/50"
                aria-label={t("howMuch")}
              />
              <span className="text-ap-body font-bold text-muted-foreground">t</span>
            </div>
            <p className="mt-1 text-ap-small text-muted-foreground">{t("anyQuantityHint")}</p>
          </div>

          <Label>{t("harvestPeriod")}</Label>
          <div className="space-y-3 rounded-[18px] border border-line bg-card p-3">
            <DayChipPicker
              label={t("fromDate")}
              days={startDays}
              value={harvestStart}
              onChange={(next) => {
                setHarvestStart(next);
                if (harvestEnd < next) setHarvestEnd(addDaysIso(next, 7));
              }}
              todayLabel={t("today")}
              formatDay={(iso) =>
                new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short" })
              }
            />
            <DayChipPicker
              label={t("toDate")}
              days={endDays}
              value={harvestEnd}
              onChange={setHarvestEnd}
              todayLabel={t("today")}
              formatDay={(iso) =>
                new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short" })
              }
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-line bg-card text-ap-btn font-bold text-ink"
            >
              {t("back")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (parsePositiveNumber(tonsText) == null) {
                  toast.error(t("invalidTons"));
                  return;
                }
                setStep(3);
              }}
              className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white"
            >
              {t("continue")}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <button
            type="button"
            role="checkbox"
            aria-checked={negotiable}
            onClick={() => setNegotiable((v) => !v)}
            className="mt-2 flex h-12 w-full items-center gap-3 rounded-[18px] border border-line bg-card px-3 text-left"
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-md border-2",
                negotiable ? "border-primary bg-primary text-white" : "border-ink/60",
              )}
            >
              {negotiable ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
            <span className="text-ap-btn font-semibold text-ink">{t("openNegotiation")}</span>
          </button>

          <Label>{t("deliveryLabel")}</Label>
          <div className="grid h-11 grid-cols-2 gap-1 rounded-xl bg-soft p-1">
            {(
              [
                ["pickup", t("factoryPickup")],
                ["deliver", t("iDeliver")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDelivery(id)}
                className={cn(
                  "rounded-lg text-ap-body font-bold",
                  delivery === id ? "border border-ink bg-card text-ink" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Label>{t("priceLabel")}</Label>
          <div className="rounded-[18px] border border-line bg-card p-3">
            <p className="text-ap-body text-muted-foreground">{t("yourPrice")}</p>
            <div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-line px-3">
              <span className="text-ap-card font-extrabold text-muted-foreground">€</span>
              <input
                type="text"
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="0,00"
                className="min-w-0 flex-1 bg-transparent text-[22px] font-extrabold text-ink outline-none placeholder:text-muted-foreground/50"
                aria-label={t("yourPrice")}
              />
              <span className="text-ap-small font-medium text-muted-foreground">{t("perKg")}</span>
            </div>
          </div>

          <div className="mt-3 rounded-[18px] bg-soft p-3">
            <p className="text-ap-small font-bold text-muted-foreground uppercase">{t("summary")}</p>
            <p className="mt-1 text-ap-body font-extrabold text-ink">{field?.name}</p>
            <p className="text-ap-small text-muted-foreground">
              {tons != null ? formatTons(tons, locale) : "—"}
              {" · "}
              {price != null ? formatEuroPerKg(price, locale) : "—"}
              {tons != null && price != null
                ? ` · ≈ ${formatEuro(tons * 1000 * price, locale)}`
                : null}
            </p>
            {score != null ? (
              <p className="mt-1 text-ap-small text-muted-foreground">
                {t("qualityScore")}: {score}
              </p>
            ) : null}
            {field?.variety || field?.variety_slug ? (
              <p className="text-ap-small text-muted-foreground">
                {varietyLabelFromStored(field.variety_slug ?? field.variety, locale)}
                {(() => {
                  const agro = varietyAgronomyContext(field.variety_slug ?? field.variety);
                  return agro ? ` · ${labelForPrimaryUse(agro.primary_use, t)}` : "";
                })()}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-line bg-card text-ap-btn font-bold text-ink"
            >
              {t("back")}
            </button>
            <button
              type="button"
              disabled={publishing || !field}
              onClick={() => void publish()}
              className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
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
