"use client";

import { useCallback, useMemo } from "react";
import { useFarmerScans } from "@/features/diagnostics/use-farmer-scans";
import { useFarmerLogbook } from "@/features/logbook/use-farmer-logbook";
import { buildFieldSignals, type ScanInput, type SprayInput } from "./field-signals";
import { EMPTY_SIGNALS } from "./risk/signals";
import type { FieldSignals } from "./risk/types";

type FieldRef = { id: string; variety_slug?: string | null };

/**
 * Risk-engine signals per field, from the farmer's scans, logbook sprays and the field's variety.
 * Home, Alerts, Quality and the field colours all use this, so they always show the same risk.
 * `signalsFor` changes only when the data changes, so it is safe in effect and memo dependencies.
 */
export function useFieldSignals(fields: FieldRef[]) {
  const { scans, loading: scansLoading } = useFarmerScans();
  const { entries, loading: logbookLoading } = useFarmerLogbook();

  const scanInputs = useMemo<ScanInput[]>(
    () =>
      scans.map((s) => ({
        fieldId: s.fieldId,
        at: s.at,
        mode: s.presented.mode,
        title: s.presented.title,
        titleKey: s.presented.titleKey,
        tone: s.presented.tone,
        flyCount: s.flyCount,
        diagnosis: s.diagnosis,
      })),
    [scans],
  );
  const sprayInputs = useMemo<SprayInput[]>(
    () =>
      entries.map((e) => ({
        fieldId: e.fieldId,
        at: e.at,
        product: e.product,
        substances: e.substances,
        banned: e.banned,
        targets: e.targets,
        protectionDays: e.protectionDays,
      })),
    [entries],
  );

  const varietyKey = fields.map((f) => `${f.id}:${f.variety_slug ?? ""}`).join("|");
  const byField = useMemo(() => {
    const map = new Map<string, FieldSignals>();
    for (const f of fields) {
      map.set(f.id, buildFieldSignals({ id: f.id, varietySlug: f.variety_slug ?? null }, scanInputs, sprayInputs));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the field ids and varieties
  }, [varietyKey, scanInputs, sprayInputs]);

  const signalsFor = useCallback((fieldId: string): FieldSignals => byField.get(fieldId) ?? EMPTY_SIGNALS, [byField]);
  return { signalsFor, loading: scansLoading || logbookLoading };
}
