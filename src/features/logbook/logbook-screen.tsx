"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, ListFilter, Share2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { euCheck } from "@/features/logbook/eu-check";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { AiTag, FieldChips, Pill, PrivacyLine } from "@/shared/components/brand";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { colors, FIELD_DOTS } from "@/shared/theme/tokens";

type Entry = {
  id: string;
  product: string;
  substances: string[];
  banned: boolean;
  hits: string[];
  at: string;
  fieldId: string | null;
  fieldName: string | null;
  licence: string | null;
  dose: string | null;
};

export function LogbookScreen({ startAdd = false }: { startAdd?: boolean }) {
  const t = useTranslations("farmerLogbook");
  const locale = useLocale();
  const { fields, loading } = useFarmerFields();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [adding, setAdding] = useState(false);

  const viewFields = useMemo(
    () => fields.map((f, i) => ({ id: f.id, name: f.name, color: FIELD_DOTS[i % FIELD_DOTS.length] })),
    [fields],
  );

  useEffect(() => {
    if (selectedId && !viewFields.some((f) => f.id === selectedId)) {
      setSelectedId(viewFields[0]?.id ?? null);
    } else if (!selectedId && viewFields[0]) {
      setSelectedId(viewFields[0].id);
    }
  }, [selectedId, viewFields]);

  useEffect(() => {
    if (startAdd) setAdding(true);
  }, [startAdd]);

  const selected = viewFields.find((f) => f.id === selectedId) ?? null;
  const scoped = selectedId ? entries.filter((e) => e.fieldId === selectedId) : entries;
  const year = new Date().getFullYear();
  const yearCount = scoped.filter((e) => new Date(e.at).getFullYear() === year).length;
  const issues = scoped.filter((e) => e.banned);
  const shown = onlyIssues ? issues : scoped;

  async function onShare() {
    const lines = scoped.map((e) => {
      const status = e.banned ? t("notAllowed") : t("allowed");
      return `${formatDay(e.at, locale)} · ${e.product} · ${status}`;
    });
    const text = [t("euRecord"), ...lines].filter(Boolean).join("\n");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("euRecord"), text });
        return;
      } catch {
        return;
      }
    }
    toast(t("shareReady"));
  }

  return (
    <div className="relative w-full flex-1">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-ap-title text-ink">{t("title")}</h1>
        <button
          type="button"
          aria-label={t("filterIssues")}
          aria-pressed={onlyIssues}
          onClick={() => setOnlyIssues((v) => !v)}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border",
            onlyIssues ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
          )}
        >
          <ListFilter className="size-[18px]" aria-hidden />
        </button>
      </div>

      <div className="mt-2.5">
        {loading ? (
          <div className="h-8 animate-pulse rounded-full bg-soft" />
        ) : viewFields.length > 0 ? (
          <FieldChips
            fields={viewFields}
            selected={selected?.id ?? viewFields[0].id}
            onSelect={(id) => {
              if (id !== "all") setSelectedId(id);
            }}
            tone="black"
          />
        ) : null}
      </div>

      <div className="mt-2 flex gap-2">
        <div className="flex-1 rounded-[18px] border border-line bg-soft px-3 py-1.5">
          <p className="text-ap-body text-muted-foreground">{t("safeHarvest")}</p>
          <p className="text-ap-title text-ink">—</p>
        </div>
        <div className="flex-1 rounded-[18px] border border-line bg-card px-3 py-1.5">
          <p className="text-ap-body text-muted-foreground">{t("spraysYear")}</p>
          <p className="text-ap-title text-ink">{yearCount}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2.5 rounded-[18px] border border-line bg-card p-2.5">
        <EuFlag />
        <div className="min-w-0 flex-1">
          <p className="text-ap-body font-extrabold text-ink">{t("euRecord")}</p>
          <p className="text-ap-small text-muted-foreground">{t("euKept")}</p>
          {issues.length > 0 ? (
            <p className="text-ap-small text-risk">
              {t(issues.length === 1 ? "euIssue" : "euIssues", {
                n: issues.length,
                date: formatDay(issues[0].at, locale),
              })}
            </p>
          ) : (
            <p className="text-ap-small font-semibold text-good">{t("noIssues")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onShare()}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-soft px-3 text-ap-pill text-ink"
        >
          <Share2 className="size-3.5" aria-hidden />
          {t("share")}
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <h2 className="text-ap-card text-ink">{t("yourSprays")}</h2>
        <p className="text-ap-body text-muted-foreground">{t("season", { year })}</p>
      </div>

      {shown.length === 0 ? (
        <div className="mt-2 rounded-[18px] border border-line bg-card p-5 text-center text-ap-body font-semibold text-muted-foreground">
          {onlyIssues ? t("emptyIssues") : viewFields.length === 0 ? t("empty") : t("emptyField")}
        </div>
      ) : (
        <div className="mt-1.5">
          {shown.map((entry, i) => (
            <div key={entry.id} className="flex">
              <div className="relative flex w-6 justify-center">
                {i > 0 ? <span className="absolute top-0 h-4 w-px bg-line" /> : null}
                {i < shown.length - 1 ? <span className="absolute top-4 bottom-0 w-px bg-line" /> : null}
                <span
                  className="relative z-10 mt-4 size-3 rounded-full"
                  style={{ backgroundColor: entry.banned ? colors.risk : colors.good }}
                />
              </div>
              <div className="min-w-0 flex-1 pb-1.5">
                <SprayCard entry={entry} locale={locale} />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="fixed right-4 z-30 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-ap-btn text-white shadow-[0_6px_16px_rgba(0,0,0,0.2)] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-8"
      >
        <Camera className="size-[18px]" aria-hidden />
        {t("addSpray")}
      </button>

      {adding ? (
        <AddSpraySheet
          fieldName={selected?.name ?? null}
          onClose={() => setAdding(false)}
          onSave={(draft) => {
            const check = euCheck(draft.substances);
            setEntries((prev) => [
              {
                id: crypto.randomUUID(),
                product: draft.product,
                substances: draft.substances,
                banned: check.banned,
                hits: check.hits,
                at: new Date().toISOString(),
                fieldId: selected?.id ?? null,
                fieldName: selected?.name ?? null,
                licence: draft.licence,
                dose: draft.dose,
              },
              ...prev,
            ]);
            toast.success(t("savedLocal"));
            setAdding(false);
          }}
        />
      ) : null}
    </div>
  );
}

function SprayCard({ entry, locale }: { entry: Entry; locale: string }) {
  const t = useTranslations("farmerLogbook");
  const meta = [
    formatDay(entry.at, locale),
    entry.fieldName,
    entry.banned ? null : entry.dose || (entry.substances.length ? entry.substances.join(", ") : null),
  ]
    .filter(Boolean)
    .join(" · ");
  const substance = entry.hits.join(", ") || entry.substances.join(", ");

  return (
    <div className={cn("rounded-[18px] border p-2.5", entry.banned ? "border-[#EDB6A6] bg-risk-soft" : "border-line bg-card")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-ap-card text-ink">{entry.banned ? t("bannedUsed") : entry.product}</p>
          <p className="text-ap-body text-muted-foreground">{meta}</p>
        </div>
        <Pill tone={entry.banned ? "risk" : "warn"}>{entry.banned ? t("notAllowed") : t("allowed")}</Pill>
      </div>
      {entry.banned ? (
        <div className="mt-2 rounded-lg bg-[#F8D3C8] p-2">
          <p className="text-ap-body text-risk">{t("bannedDetail", { substance })}</p>
        </div>
      ) : entry.substances.length > 0 ? (
        <div className="mt-2 rounded-lg bg-soft px-2 py-1.5">
          <p className="text-ap-body font-bold text-good">{t("approvedOlives")}</p>
          {entry.licence ? <p className="text-ap-small text-muted-foreground">{t("licenceLine", { licence: entry.licence })}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function AddSpraySheet({
  fieldName,
  onClose,
  onSave,
}: {
  fieldName: string | null;
  onClose: () => void;
  onSave: (draft: { product: string; substances: string[]; licence: string | null; dose: string | null }) => void;
}) {
  const t = useTranslations("farmerLogbook");
  const [product, setProduct] = useState("");
  const [substances, setSubstances] = useState("");
  const [licence, setLicence] = useState<string | null>(null);
  const [dose, setDose] = useState<string | null>(null);
  const [fromLabel, setFromLabel] = useState(false);
  const [labelSource, setLabelSource] = useState<"gemini" | "demo" | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);

  const list = substances
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const check = euCheck(list);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const name = product.trim() || list[0] || "";
    if (!name) {
      toast.error(t("needProduct"));
      return;
    }
    onSave({
      product: name,
      substances: list,
      licence: fromLabel ? licence : null,
      dose: fromLabel ? dose : null,
    });
  }

  async function onLabel(file: File | null) {
    if (!file) return;
    setLabelLoading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const base64 = dataUrl.split(",")[1] ?? dataUrl;
      const res = await fetch("/api/ai/read-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const json: unknown = await res.json();
      if (!isRecord(json) || json.ok !== true || !isRecord(json.data) || !isRecord(json.data.label)) {
        const message = isRecord(json) && typeof json.error === "string" ? json.error : t("labelFail");
        throw new Error(message);
      }
      const label = json.data.label;
      if (typeof label.productName !== "string") throw new Error(t("labelFail"));
      const substancesFound = Array.isArray(label.activeSubstances)
        ? label.activeSubstances.filter((s): s is string => typeof s === "string")
        : [];
      setProduct(label.productName);
      setSubstances(substancesFound.join(", "));
      setLicence(typeof label.licenceNumber === "string" ? label.licenceNumber : null);
      setDose(typeof label.maxDosePerHa === "string" ? label.maxDosePerHa : null);
      setFromLabel(true);
      setLabelSource(json.data.source === "demo" ? "demo" : "gemini");
      const source = typeof json.data.source === "string" ? json.data.source : "gemini";
      toast.success(t("labelOk", { source }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("labelFail"));
    } finally {
      setLabelLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:left-60">
      <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={save}
        className="relative z-10 mx-3 mb-[calc(4.25rem+max(0.5rem,env(safe-area-inset-bottom)))] max-h-[min(40rem,calc(100dvh-6rem))] w-full max-w-3xl overflow-y-auto rounded-[18px] bg-card p-4 md:mx-auto md:mb-8"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-ap-title text-ink">{t("addSpray")}</p>
            <p className="text-ap-body text-muted-foreground">{fieldName ?? t("noField")}</p>
          </div>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-soft"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>

        <label className="mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink/40 text-ap-body font-bold text-ink">
          <Camera className="size-4" aria-hidden />
          {labelLoading ? t("reading") : t("scanTheLabel")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={labelLoading}
            onChange={(e) => {
              void onLabel(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
        <div className="mt-1">
          <PrivacyLine />
        </div>
        {labelSource ? <AiTag source={labelSource} className="mt-1.5" /> : null}

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="spray-product">{t("product")}</Label>
            {fromLabel ? (
              <span className="inline-flex h-5 items-center rounded-full bg-good-soft px-2 text-[11px] font-bold text-good">
                {t("fromLabel")}
              </span>
            ) : null}
          </div>
          <Input
            id="spray-product"
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setFromLabel(false);
            }}
            className="rounded-xl"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="spray-sub">{t("substances")}</Label>
          <Input
            id="spray-sub"
            value={substances}
            onChange={(e) => {
              setSubstances(e.target.value);
              setFromLabel(false);
            }}
            className="rounded-xl"
          />
        </div>

        {check.banned ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-risk-soft p-2.5">
            <TriangleAlert className="size-4 shrink-0 text-risk" aria-hidden />
            <p className="text-ap-small font-semibold text-risk">{t("bannedWarn", { substance: check.hits.join(", ") })}</p>
          </div>
        ) : null}

        <button type="submit" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink text-ap-btn text-white">
          {t("saveSpray")}
        </button>
      </form>
    </div>
  );
}

function EuFlag() {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return <circle key={i} cx={20 + Math.cos(a) * 11} cy={20 + Math.sin(a) * 11} r={1.5} fill="#F7D117" />;
  });
  return (
    <svg width={36} height={36} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect width={40} height={40} rx={20} fill="#1F4FA3" />
      {stars}
    </svg>
  );
}

function formatDay(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
