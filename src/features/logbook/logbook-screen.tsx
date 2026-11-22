"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, Camera, CircleCheck, Droplets, Loader2, NotebookPen, Plus, Share2, ShieldAlert, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { euCheck } from "@/features/logbook/eu-check";
import { deleteLogbookEntry, saveLogbookEntry } from "@/features/logbook/save-logbook-entry";
import { safeHarvestDays, useFarmerLogbook, type LogbookEntryView } from "@/features/logbook/use-farmer-logbook";
import { BottomSheet } from "@/features/marketplace/processor-kit";
import { AiTag, ApButton, Chip, FieldChips, Pill, PrivacyLine, SectionHeader } from "@/shared/components/brand";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { FIELD_DOTS } from "@/shared/theme/tokens";
import { useErrorMessage } from "@/shared/lib/error-message";

type Entry = LogbookEntryView;

export function LogbookScreen({ startAdd = false }: { startAdd?: boolean }) {
  const t = useTranslations("farmerLogbook");
  const errMsg = useErrorMessage();
  const locale = useLocale();
  const { fields, loading } = useFarmerFields();
  const { entries, setEntries, loading: entriesLoading } = useFarmerLogbook();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);

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
  const harvestDays = safeHarvestDays(scoped);

  async function onShare() {
    const lines = scoped.map((e) => {
      const status = e.banned ? t("notAllowed") : e.euStatus === "allowed" ? t("allowed") : t("unknownPill");
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
    <div className="relative w-full flex-1 pb-28">
      <h1 className="text-[20px] font-extrabold tracking-tight text-ink">{t("title")}</h1>

      <div className="mt-2.5">
        {loading ? (
          <div className="h-11 animate-pulse rounded-full bg-soft" />
        ) : viewFields.length > 0 ? (
          <FieldChips
            fields={viewFields}
            selected={selected?.id ?? viewFields[0].id}
            onSelect={(id) => {
              if (id !== "all") setSelectedId(id);
            }}
            tone="black"
            trailing={
              <>
                <Chip on={onlyIssues} tone="black" onClick={() => setOnlyIssues((v) => !v)}>
                  <ShieldAlert className={cn("size-3.5", onlyIssues ? "text-white" : "text-risk")} aria-hidden />
                  <span className={cn("text-ap-pill font-bold", onlyIssues ? "text-white" : "text-ink")}>
                    {t("filterIssues")}
                  </span>
                </Chip>
              </>
            }
          />
        ) : null}
      </div>

      <div className="mt-2 flex gap-2">
        <div
          className={cn(
            "min-w-0 flex-1 rounded-[18px] border px-3 py-2.5",
            harvestDays == null
              ? "border-line bg-card"
              : harvestDays === 0
                ? "border-good/30 bg-good-soft/60"
                : "border-warn/40 bg-warn-soft/60",
          )}
        >
          <p className="flex items-center gap-1.5 text-ap-small font-semibold text-muted-foreground">
            <CalendarCheck
              className={cn(
                "size-3.5 shrink-0",
                harvestDays === 0 ? "text-good" : harvestDays == null ? "" : "text-warn-text",
              )}
              aria-hidden
            />
            <span className="truncate">{t("safeHarvest")}</span>
          </p>
          <p
            className={cn(
              "mt-0.5 text-[22px] leading-tight font-extrabold tracking-tight",
              harvestDays === 0 ? "text-good" : harvestDays == null ? "text-ink" : "text-warn-text",
            )}
          >
            {harvestDays == null ? "—" : harvestDays === 0 ? t("harvestNow") : t("safeHarvestDays", { n: harvestDays })}
          </p>
        </div>
        <div className="min-w-0 flex-1 rounded-[18px] border border-line bg-card px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-ap-small font-semibold text-muted-foreground">
            <Droplets className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t("spraysYear")}</span>
          </p>
          <p className="mt-0.5 text-[22px] leading-tight font-extrabold tracking-tight text-ink">{yearCount}</p>
        </div>
      </div>

      <div
        className={cn(
          "mt-2 flex items-center gap-2.5 rounded-[18px] border p-2.5",
          issues.length > 0 ? "border-risk/35 bg-risk-soft/45" : "border-line bg-card",
        )}
      >
        <EuFlag />
        <div className="min-w-0 flex-1">
          <p className="text-ap-body font-extrabold text-ink">{t("euRecord")}</p>
          <p className="text-ap-small text-muted-foreground">{t("euKept")}</p>
          {issues.length > 0 ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-ap-small font-bold text-risk">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
              {t(issues.length === 1 ? "euIssue" : "euIssues", {
                n: issues.length,
                date: formatDay(issues[0].at, locale),
              })}
            </p>
          ) : (
            <p className="mt-0.5 inline-flex items-center gap-1 text-ap-small font-semibold text-good">
              <CircleCheck className="size-3.5 shrink-0" aria-hidden />
              {t("noIssues")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onShare()}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-ap-pill text-ink hover:bg-soft"
        >
          <Share2 className="size-3.5" aria-hidden />
          {t("share")}
        </button>
      </div>

      <SectionHeader
        title={t("yourSprays")}
        action={<span className="text-ap-small text-muted-foreground">{t("season", { year })}</span>}
      />

      {entriesLoading ? (
        <div className="mt-2 flex flex-col gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="ml-6 h-[72px] animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-soft">
            {onlyIssues ? (
              <CircleCheck className="size-6 text-muted-foreground" aria-hidden />
            ) : (
              <NotebookPen className="size-6 text-muted-foreground" aria-hidden />
            )}
          </div>
          <p className="mt-3 text-ap-body font-semibold text-ink">
            {onlyIssues ? t("emptyIssues") : viewFields.length === 0 ? t("empty") : t("emptyField")}
          </p>
          {onlyIssues ? null : (
            <div className="mt-4">
              <ApButton
                label={t("addSpray")}
                icon={<Plus className="size-4" aria-hidden />}
                onClick={() => setAdding(true)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1.5">
          {shown.map((entry, i) => (
            <div key={entry.id} className="flex">
              <div className="relative flex w-6 justify-center">
                {i > 0 ? <span className="absolute top-0 h-4 w-px bg-line" /> : null}
                {i < shown.length - 1 ? <span className="absolute top-4 bottom-0 w-px bg-line" /> : null}
                <span
                  className={cn(
                    "relative z-10 mt-4 size-3 rounded-full ring-4 ring-background",
                    entry.banned ? "bg-risk" : entry.euStatus === "allowed" ? "bg-good" : "bg-warn",
                  )}
                />
              </div>
              <div className="min-w-0 flex-1 pb-1.5">
                <SprayCard
                  entry={entry}
                  locale={locale}
                  onDelete={() => setDeleteTarget(entry)}
                />
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
        <Plus className="size-[18px]" aria-hidden />
        {t("addSpray")}
      </button>

      <BottomSheet
        open={deleteTarget != null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title={t("deleteTitle")}
        footer={
          <div className="flex flex-col gap-2">
            <ApButton
              label={t("delete")}
              variant="risk"
              className="w-full"
              disabled={deleting}
              onClick={() => {
                void (async () => {
                  if (!deleteTarget) return;
                  setDeleting(true);
                  try {
                    const res = await deleteLogbookEntry(deleteTarget.id);
                    if (!res.ok) {
                      toast.error(errMsg(res.error, "saveFailed"));
                      return;
                    }
                    setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
                    setDeleteTarget(null);
                    toast.success(t("deleted"));
                  } finally {
                    setDeleting(false);
                  }
                })();
              }}
            />
            <ApButton
              label={t("cancel")}
              variant="outline"
              className="w-full"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            />
          </div>
        }
      >
        {deleteTarget ? (
          <div className="space-y-2">
            <p className="text-ap-card font-extrabold text-ink">{deleteTarget.product}</p>
            <p className="text-ap-small text-muted-foreground">{t("deleteConfirm")}</p>
          </div>
        ) : null}
      </BottomSheet>

      {adding ? (
        <AddSpraySheet
          fieldName={selected?.name ?? null}
          saving={saving}
          onClose={() => setAdding(false)}
          onSave={(draft) => {
            void (async () => {
              if (!selected) {
                toast.error(t("needField"));
                return;
              }
              setSaving(true);
              try {
                const result = await saveLogbookEntry({
                  product: draft.product,
                  substances: draft.substances,
                  licence: draft.licence,
                  dose: draft.dose,
                  appliedOn: draft.appliedOn,
                  preHarvestDays: draft.preHarvestDays,
                  fieldId: selected.id,
                  fieldName: selected.name,
                });
                if (!result.ok) {
                  toast.error(
                    t(
                      result.error === "needLogin" || result.error === "needSupabase"
                        ? result.error
                        : "saveFailed",
                    ),
                  );
                  return;
                }
                setEntries((prev) => [result.entry, ...prev.filter((e) => e.id !== result.entry.id)]);
                toast.success(t("saved"));
                setAdding(false);
              } finally {
                setSaving(false);
              }
            })();
          }}
        />
      ) : null}
    </div>
  );
}

function SprayCard({
  entry,
  locale,
  onDelete,
}: {
  entry: Entry;
  locale: string;
  onDelete: () => void;
}) {
  const t = useTranslations("farmerLogbook");
  const meta = [
    formatDay(entry.at, locale),
    entry.fieldName,
    entry.banned ? null : entry.dose || (entry.substances.length ? entry.substances.join(", ") : null),
    entry.preHarvestDays != null ? t("phiDays", { n: entry.preHarvestDays }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const substance = entry.hits.join(", ") || entry.substances.join(", ");

  return (
    <div className={cn("rounded-[18px] border p-2.5", entry.banned ? "border-risk/35 bg-risk-soft" : "border-line bg-card")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-ap-card text-ink">{entry.banned ? t("bannedUsed") : entry.product}</p>
          <p className="text-ap-body text-muted-foreground">{meta}</p>
        </div>
        <div className="-mr-1 -mb-1 flex shrink-0 flex-col items-end">
          <Pill tone={entry.banned ? "risk" : entry.euStatus === "allowed" ? "good" : "warn"}>
            {entry.banned ? t("notAllowed") : entry.euStatus === "allowed" ? t("allowed") : t("unknownPill")}
          </Pill>
          <button
            type="button"
            aria-label={t("delete")}
            title={t("delete")}
            onClick={onDelete}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-risk-soft hover:text-risk"
          >
            <Trash2 className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>
      {entry.banned ? (
        <div className="mt-1 flex gap-2 rounded-xl bg-risk/15 p-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-risk" aria-hidden />
          <p className="text-ap-body text-risk">{t("bannedDetail", { substance })}</p>
        </div>
      ) : entry.euStatus !== "allowed" ? (
        <div className="mt-1 flex gap-2 rounded-xl bg-warn-soft p-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn-text" aria-hidden />
          <p className="text-ap-body font-bold text-warn-text">{t("unknownSubstance")}</p>
        </div>
      ) : entry.substances.length > 0 ? (
        <div className="mt-1 rounded-xl bg-soft p-2.5">
          <p className="inline-flex items-center gap-1.5 text-ap-body font-bold text-good">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            {t("approvedOlives")}
          </p>
          {entry.licence ? <p className="text-ap-small text-muted-foreground">{t("licenceLine", { licence: entry.licence })}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Message key for a label photo the server rejected (see scan-verdict.ts). */
function labelRetakeKey(reason: unknown): string {
  switch (reason) {
    case "cut_off":
      return "labelCutOff";
    case "blurry":
      return "labelBlurry";
    case "too_dark":
      return "labelTooDark";
    case "unclear":
      return "labelUnclear";
    default:
      return "labelNotLabel";
  }
}

function AddSpraySheet({
  fieldName,
  saving = false,
  onClose,
  onSave,
}: {
  fieldName: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: {
    product: string;
    substances: string[];
    licence: string | null;
    dose: string | null;
    appliedOn: string;
    preHarvestDays: number | null;
  }) => void;
}) {
  const t = useTranslations("farmerLogbook");
  const [product, setProduct] = useState("");
  const [substances, setSubstances] = useState("");
  const [licence, setLicence] = useState<string | null>(null);
  const [dose, setDose] = useState("");
  const [appliedOn, setAppliedOn] = useState(todayIso);
  const [phiText, setPhiText] = useState("");
  const [fromLabel, setFromLabel] = useState(false);
  const [labelSource, setLabelSource] = useState<"gemini" | "demo" | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);

  const list = substances
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const check = euCheck(list, product);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const name = product.trim() || list[0] || "";
    if (!name) {
      toast.error(t("needProduct"));
      return;
    }
    const phiRaw = phiText.trim();
    const phi = phiRaw === "" ? null : Number(phiRaw.replace(",", "."));
    if (phiRaw !== "" && (!Number.isFinite(phi) || (phi as number) < 0)) {
      toast.error(t("invalidPhi"));
      return;
    }
    onSave({
      product: name,
      substances: list,
      licence: fromLabel ? licence : null,
      dose: dose.trim() || null,
      appliedOn,
      preHarvestDays: phi == null ? null : Math.round(phi),
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
      if (!isRecord(json) || json.ok !== true || !isRecord(json.data)) {
        const message = isRecord(json) && typeof json.error === "string" ? json.error : t("labelFail");
        throw new Error(message);
      }
      const data = json.data;
      // The AI is down: say so. The form is never filled from a made-up label.
      if (data.unavailable === true || data.source === "demo") {
        toast.error(t("labelUnavailable"));
        return;
      }
      // The server rejected the photo or the read was not confident: ask for a new photo, leave the form as it is.
      const verdict = isRecord(data.verdict) ? data.verdict : null;
      if (verdict?.kind !== "ok" || !isRecord(data.label)) {
        toast.error(t(labelRetakeKey(verdict?.reason)));
        return;
      }
      const label = data.label;
      if (typeof label.productName !== "string") throw new Error(t("labelFail"));
      const substancesFound = Array.isArray(label.activeSubstances)
        ? label.activeSubstances.filter((s): s is string => typeof s === "string")
        : [];
      setProduct(label.productName);
      setSubstances(substancesFound.join(", "));
      setLicence(typeof label.licenceNumber === "string" ? label.licenceNumber : null);
      setDose(typeof label.maxDosePerHa === "string" ? label.maxDosePerHa : "");
      if (typeof label.preHarvestDays === "number") {
        setPhiText(String(label.preHarvestDays));
      }
      setFromLabel(true);
      setLabelSource("gemini");
      toast.success(t("labelOk", { source: "gemini" }));
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
        className="relative z-10 mx-3 mb-[calc(4.25rem+max(0.5rem,env(safe-area-inset-bottom)))] max-h-[min(40rem,calc(100dvh-6rem))] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-[18px] bg-card px-4 md:mx-auto md:mb-8"
      >
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-card px-4 pt-4 pb-3">
          <div className="min-w-0">
            <p className="text-[20px] font-extrabold tracking-tight text-ink">{t("addSpray")}</p>
            <p className="text-ap-small text-muted-foreground">{fieldName ?? t("noField")}</p>
          </div>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-soft"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>

        <label
          className={cn(
            "mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink/40 bg-soft/60 text-ap-body font-bold text-ink",
            labelLoading && "cursor-wait opacity-70",
          )}
        >
          {labelLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
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
              <span className="inline-flex h-5 items-center rounded-full bg-good-soft px-2 text-[12px] font-bold text-good">
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
            className="h-11 rounded-xl px-3"
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
            className="h-11 rounded-xl px-3"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="spray-date">{t("appliedOn")}</Label>
            <Input
              id="spray-date"
              type="date"
              value={appliedOn}
              onChange={(e) => setAppliedOn(e.target.value)}
              className="h-11 rounded-xl px-3"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spray-phi">{t("phiLabel")}</Label>
            <Input
              id="spray-phi"
              inputMode="numeric"
              value={phiText}
              onChange={(e) => setPhiText(e.target.value)}
              placeholder="14"
              className="h-11 rounded-xl px-3"
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor="spray-dose">{t("dose")}</Label>
          <Input
            id="spray-dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="1,5 L/ha"
            className="h-11 rounded-xl px-3"
          />
        </div>

        {!product.trim() && list.length === 0 ? null : check.banned ? (
          <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-xl border border-risk/35 bg-risk-soft p-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-risk" aria-hidden />
            <p className="text-ap-body font-semibold text-risk">{t("bannedWarn", { substance: check.hits.join(", ") })}</p>
          </div>
        ) : check.status === "unknown" ? (
          <div role="status" className="mt-3 flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn-soft p-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn-text" aria-hidden />
            <p className="text-ap-body font-semibold text-warn-text">{t("unknownSubstance")}</p>
          </div>
        ) : (
          <div role="status" className="mt-3 flex items-center gap-2.5 rounded-xl border border-good/30 bg-good-soft p-3">
            <CircleCheck className="size-5 shrink-0 text-good" aria-hidden />
            <p className="text-ap-body font-bold text-good">{t("approvedOlives")}</p>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-card px-4 pt-3 pb-4">
          <ApButton
            type="submit"
            variant="dark"
            className="w-full"
            disabled={saving}
            icon={saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            label={saving ? t("saving") : t("saveSpray")}
          />
        </div>
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
