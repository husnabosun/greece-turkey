import { buildSignals, type SignalScan, type SignalSpray } from "./risk/signals";
import type { FieldSignals, ThreatId } from "./risk/types";

/**
 * One place that turns what the app already loads (scans, logbook sprays, the field's variety)
 * into the signals of the risk engine. Pure TypeScript, no UI or database imports.
 * The engine rules are not touched here: we only describe the field to the engine.
 */

export type ScanInput = {
  fieldId: string | null;
  /** ISO time the photo was taken (`scans.captured_at`). */
  at: string;
  mode: SignalScan["mode"];
  /** Stored title. It is written in the farmer's language, so it is only a fallback. */
  title?: string | null;
  /** Stable key of the presented diagnosis (`diagnosis.presented.titleKey`), language free. */
  titleKey?: string | null;
  /** Pill tone of the presented result: risk · warn · good. */
  tone?: string | null;
  /** `scans.fly_count` (trap scans). */
  flyCount?: number | null;
  spotCount?: number | null;
  /** `scans.diagnosis` JSON, used when an old row has no `titleKey`. */
  diagnosis?: unknown;
};

export type SprayInput = {
  fieldId: string | null;
  /** ISO time of the spray (`logbook_entries.applied_at`). */
  at: string;
  product: string;
  substances?: string[];
  /** `logbook_entries.eu_banned`. */
  banned: boolean;
  /** `logbook_entries.targets` (threat ids). Often empty: then known products are used. */
  targets?: string[] | null;
  /** `logbook_entries.protection_days`. */
  protectionDays?: number | null;
};

export type FieldInput = { id: string; varietySlug?: string | null };

const THREAT_IDS: readonly ThreatId[] = [
  "peacock-spot",
  "olive-fly",
  "olive-moth",
  "anthracnose",
  "olive-knot",
  "frost",
  "heat",
  "wind",
  "drought",
  "location",
];
const isThreat = (v: string): v is ThreatId => (THREAT_IDS as readonly string[]).includes(v);

/** English diagnosis text per stable title key. The engine looks for "olive fly" and "peacock spot" in it. */
const TITLE_BY_KEY: Record<string, string> = {
  oliveFly: "Olive fly sting",
  peacock: "Peacock spot",
  budMite: "Bud mite",
  healthyLeaf: "Healthy leaf",
  healthyFruit: "Healthy fruit",
  otherDamage: "Other damage",
  notClear: "Not clear",
  anthracnose: "Anthracnose",
  oliveMoth: "Olive moth damage",
  mechanicalDamage: "Hail or mechanical damage",
  sunscald: "Sunscald",
  droughtShrivel: "Drought shrivel",
  sootyMould: "Sooty mould or scale",
  uncertain: "Uncertain",
  trapTitle: "Fly trap",
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function titleOf(s: ScanInput): string {
  if (s.titleKey && TITLE_BY_KEY[s.titleKey]) return TITLE_BY_KEY[s.titleKey];
  const d = isRecord(s.diagnosis) ? s.diagnosis : null;
  const presented = d && isRecord(d.presented) ? d.presented : null;
  const key = presented && typeof presented.titleKey === "string" ? presented.titleKey : null;
  if (key && TITLE_BY_KEY[key]) return TITLE_BY_KEY[key];
  const result = d && isRecord(d.result) ? d.result : null;
  const raw = result?.diagnosis ?? result?.label;
  if (typeof raw === "string" && raw.trim()) return raw;
  return s.title ?? "";
}

function toneOf(tone: string | null | undefined): string {
  return tone === "risk" ? "high" : tone === "warn" ? "medium" : "low";
}

function fliesOf(s: ScanInput): number | undefined {
  if (s.mode !== "trap") return undefined;
  if (typeof s.flyCount === "number") return s.flyCount;
  const d = isRecord(s.diagnosis) ? s.diagnosis : null;
  const result = d && isRecord(d.result) ? d.result : null;
  return typeof result?.flyCount === "number" ? result.flyCount : undefined;
}

type KnownProduct = { match: RegExp; targets: ThreatId[]; protectionDays: number };

/**
 * Products the farmer's logbook does not describe in detail. The logbook stores no targets yet, so we use the same
 * facts as the Expo demo: copper protects the leaf diseases for 14 days, kaolin keeps the fly and moth off for 10 days.
 */
const KNOWN_PRODUCTS: KnownProduct[] = [
  { match: /copper|bordeaux|bak[ıi]r|χαλκ/i, targets: ["peacock-spot", "anthracnose", "olive-knot"], protectionDays: 14 },
  { match: /kaolin|καολιν/i, targets: ["olive-fly", "olive-moth"], protectionDays: 10 },
];

function sprayProtection(s: SprayInput): { targets: ThreatId[]; protectionDays: number } {
  const stored = (s.targets ?? []).filter(isThreat);
  const days = s.protectionDays ?? 0;
  if (stored.length > 0 && days > 0) return { targets: stored, protectionDays: days };
  const text = [s.product, ...(s.substances ?? [])].join(" ");
  const known = KNOWN_PRODUCTS.find((p) => p.match.test(text));
  if (known) return { targets: known.targets, protectionDays: days > 0 ? days : known.protectionDays };
  // No targets or no protection time: the spray is recorded but protects nothing (also avoids dividing by 0 days).
  return { targets: [], protectionDays: Math.max(0, days) };
}

/** The risk-engine signals of one field. */
export function buildFieldSignals(field: FieldInput, scans: ScanInput[], sprays: SprayInput[]): FieldSignals {
  const signalScans: SignalScan[] = [];
  for (const s of scans) {
    const ts = Date.parse(s.at);
    if (!Number.isFinite(ts)) continue;
    signalScans.push({
      fieldId: s.fieldId ?? "",
      ts,
      mode: s.mode,
      title: titleOf(s),
      tone: toneOf(s.tone),
      spots: s.spotCount ?? undefined,
      flies: fliesOf(s),
    });
  }

  const signalSprays: SignalSpray[] = [];
  for (const s of sprays) {
    const ts = Date.parse(s.at);
    if (!Number.isFinite(ts)) continue;
    const p = s.banned ? { targets: [] as ThreatId[], protectionDays: 0 } : sprayProtection(s);
    signalSprays.push({ fieldId: s.fieldId ?? "", ts, product: s.product, banned: s.banned, ...p });
  }

  return { ...buildSignals({ id: field.id }, signalScans, signalSprays), varietySlug: field.varietySlug ?? null };
}
