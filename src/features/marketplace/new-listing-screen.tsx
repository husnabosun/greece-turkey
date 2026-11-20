"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronLeft, Trees } from "lucide-react";
import { formatStremmata } from "@/features/fields/area";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { varietyAgronomyContext, varietyLabelFromStored } from "@/features/fields/olive-varieties";
import { publishLot } from "@/features/marketplace/save-lot";
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
  const [currentId, setCurrentId] = useState(fieldId ?? "");
  const field = fields.find((f) => f.id === currentId) ?? fields[0];
  /** Flow B: offer to a mill buy-request. Flow A: plain public listing. */
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

  if (loading) {
    return (
      <div className="w-full flex-1">
        <Header title={t("newListing")} />
        <div className="mt-4 h-28 animate-pulse rounded-[18px] bg-soft" />
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="w-full flex-1">
        <Header title={t("newListing")} />
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
    <div className="w-full flex-1">
      <Header title={isOfferToMill ? t("offerToMill") : t("newListing")} />
      {isOfferToMill ? (
        <p className="mt-2 text-ap-body text-muted-foreground">{t("offerToMillHint")}</p>
      ) : (
        <p className="mt-2 text-ap-body text-muted-foreground">{t("listForBidsHint")}</p>
      )}

      <Label>{t("fieldLabel")}</Label>
      <div className="flex items-center gap-2.5 rounded-[18px] border border-line bg-card p-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-good-soft">
          <Trees className="size-6 text-good" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-ap-card font-extrabold text-ink">{field?.name ?? "—"}</p>
            <button
              type="button"
              className="shrink-0 text-ap-body font-bold text-ap-accent disabled:opacity-40"
              disabled={fields.length < 2}
              onClick={() => {
                const i = fields.findIndex((f) => f.id === field?.id);
                const next = fields[(i + 1) % fields.length];
                if (next) setCurrentId(next.id);
              }}
            >
              {t("change")}
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {field?.variety || field?.variety_slug ? (
              <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-ink">
                {varietyLabelFromStored(field.variety_slug ?? field.variety, locale)}
              </span>
            ) : null}
            {(() => {
              const agro = varietyAgronomyContext(field?.variety_slug ?? field?.variety);
              if (!agro) return null;
              return (
                <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-muted-foreground">
                  {labelForPrimaryUse(agro.primary_use, t)} · {agro.avg_oil_yield_pct[0]}–{agro.avg_oil_yield_pct[1]}%
                </span>
              );
            })()}
            {field?.tree_count != null ? (
              <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-ink">
                {t("treesPill", { n: field.tree_count })}
              </span>
            ) : null}
            {field?.area_ha != null ? (
              <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-ink">
                {t("haPill", { n: formatStremmata(Number(field.area_ha)) })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-soft px-2.5 py-1.5 text-center">
          <p className="text-[10px] font-semibold text-muted-foreground">{t("qualityScore")}</p>
          <p className="text-[22px] leading-none font-extrabold text-muted-foreground">—</p>
        </div>
      </div>

      <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
        <p className="text-ap-body text-muted-foreground">{t("howMuch")}</p>
        <div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-line bg-background px-3">
          <input
            type="text"
            inputMode="decimal"
            value={tonsText}
            onChange={(e) => setTonsText(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-ap-card font-extrabold text-ink outline-none"
            aria-label={t("howMuch")}
          />
          <span className="text-ap-body font-bold text-muted-foreground">t</span>
        </div>
        <p className="mt-1 text-ap-small text-muted-foreground">{t("anyQuantityHint")}</p>
      </div>

      <Label>{t("harvestPeriod")}</Label>
      <div className="rounded-[18px] border border-line bg-card p-3">
        <p className="text-ap-small text-muted-foreground">{t("harvestRangeHint")}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">
              {t("fromDate")}
            </span>
            <input
              type="date"
              value={harvestStart}
              onChange={(e) => {
                const next = e.target.value;
                setHarvestStart(next);
                if (harvestEnd < next) setHarvestEnd(next);
              }}
              className="mt-1 h-11 w-full rounded-xl border border-line bg-background px-3 text-ap-body font-semibold text-ink"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">
              {t("toDate")}
            </span>
            <input
              type="date"
              value={harvestEnd}
              min={harvestStart}
              onChange={(e) => setHarvestEnd(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-line bg-background px-3 text-ap-body font-semibold text-ink"
            />
          </label>
        </div>
      </div>

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
        <div className="rounded-xl bg-good-soft px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ap-body font-extrabold text-good">{t("exchangeRange")}</p>
            <p className="text-ap-card font-extrabold text-ink">
              —
              <span className="text-ap-small font-medium text-muted-foreground"> {t("perKg")}</span>
            </p>
          </div>
          <p className="mt-0.5 text-ap-small text-muted-foreground">{t("noExchange")}</p>
        </div>
        <p className="mt-3 text-ap-body text-muted-foreground">{t("yourPrice")}</p>
        <div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-line px-3">
          <span className="text-ap-card font-extrabold text-muted-foreground">€</span>
          <input
            type="text"
            inputMode="decimal"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[22px] font-extrabold text-ink outline-none"
            aria-label={t("yourPrice")}
          />
          <span className="text-ap-small font-medium text-muted-foreground">{t("perKg")}</span>
        </div>
        <p className="mt-2 text-ap-small text-muted-foreground">{t("anyPriceHint")}</p>
      </div>

      <button
        type="button"
        disabled={publishing || !field}
        onClick={() => {
          if (!field || publishing || publishLock.current) return;
          const tons = parsePositiveNumber(tonsText);
          const price = parsePositiveNumber(priceText);
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
          void (async () => {
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
          })();
        }}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
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
  );
}

function Header({ title }: { title: string }) {
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
        <span className="h-1 w-6 rounded-full bg-ink" />
        <span className="h-1 w-6 rounded-full bg-ink/70" />
        <span className="h-1 w-6 rounded-full bg-line" />
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mt-3 mb-1.5 text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">{children}</p>;
}
