import type { FieldSignals, ScanSignal, SpraySignal, ThreatId } from "./types";

/** Minimal scan shape needed to build risk signals (decoupled from legacy mock). */
export type SignalScan = {
  fieldId: string;
  ts: number;
  mode: ScanSignal["mode"];
  title: string;
  tone: string;
  spots?: number;
  flies?: number;
};

export type SignalSpray = {
  fieldId: string;
  ts: number;
  product: string;
  targets?: ThreatId[];
  protectionDays?: number;
  banned?: boolean;
};

export type SignalField = {
  id: string;
  prunedDaysAgo?: number;
  locationRisks?: FieldSignals["locationRisks"];
};

export const EMPTY_SIGNALS: FieldSignals = {
  scans: [],
  sprays: [],
  locationRisks: [],
  locationMitigated: false,
};

/** Collects what we know about one field from its scans, sprays and field data. */
export function buildSignals(
  field: SignalField,
  scans: SignalScan[],
  sprays: SignalSpray[],
  locationMitigated = false,
): FieldSignals {
  return {
    scans: scans
      .filter((s) => s.fieldId === field.id)
      .map(
        (s): ScanSignal => ({
          ts: s.ts,
          mode: s.mode,
          title: s.title,
          tone: s.tone,
          spots: s.spots,
          flies: s.flies,
        }),
      ),
    sprays: sprays
      .filter((s) => s.fieldId === field.id)
      .map(
        (s): SpraySignal => ({
          ts: s.ts,
          product: s.product,
          targets: s.targets ?? [],
          protectionDays: s.protectionDays ?? 0,
          banned: Boolean(s.banned),
        }),
      ),
    prunedDaysAgo: field.prunedDaysAgo,
    locationRisks: field.locationRisks ?? [],
    locationMitigated,
  };
}
