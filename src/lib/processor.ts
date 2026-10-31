/**
 * Pure helpers of the processor (B2B) panel: lots, filters, expected oil, delivery steps.
 * No UI imports. The processor side shows the public exchange price only, never a fair or recommended price.
 */
import type { Delivery, Factory, Field, Lot, LotSpray, LotUse, ProcRequest, Sale, Spray } from '../data/mock';
import { trustBadges, type Badge, type BadgeId } from './badges';
import { formatDay } from './dates';
import { euCheck } from './euCheck';
import { roundTotal } from './market';
import { assessField, highestRisk, THREAT_BY_ID, type FieldRisk, type FieldSignals, type RiskLevel } from './risk';
import { demoWeather, type FieldWeather } from './weather';

/** Share of the olive weight that becomes oil. Typical range is 15–22 %, 18 % is a middle value. */
export const OIL_YIELD = 0.18;

/** Tonnes of oil expected from `tons` of olives. Table olives are not pressed. */
export function expectedOilTons(tons: number, use: LotUse): number {
  return use === 'oil' ? Math.round(tons * OIL_YIELD * 100) / 100 : 0;
}

/** Total of an offer in euro, rounded to €50. */
export const offerTotal = (tons: number, pricePerKg: number) => roundTotal(tons * 1000 * pricePerKg);

export const avgScore = (scores: number[]) => (scores.length ? Math.round(scores.reduce((t, n) => t + n, 0) / scores.length) : 0);

/** "4 Nov" for a delivery `days` days from today. */
export const deliveryLabel = (days: number, now: Date = new Date()) => formatDay(-days, now);

/** Delivery dates the Make offer modal offers, in days from today. */
export const DELIVERY_CHOICES = [3, 5, 7, 10, 14] as const;

/** A spray is banned when the farmer marked it, or when a substance (or the product name) is not approved in the EU. */
export function sprayEuStatus(spray: Pick<LotSpray, 'product' | 'banned' | 'activeSubstances'>): { banned: boolean; hits: string[] } {
  const check = euCheck([...(spray.activeSubstances ?? []), spray.product]);
  return { banned: spray.banned || check.banned, hits: check.hits };
}

export const lotHasBanned = (lot: Pick<Lot, 'sprays'>) => lot.sprays.some((s) => sprayEuStatus(s).banned);

export const ANY = 'all';

export interface LotFilters {
  variety: string;
  region: string;
  minScore: number;
  noBanned: boolean;
  labSuggested: boolean;
  use: LotUse | typeof ANY;
}

export const NO_FILTERS: LotFilters = { variety: ANY, region: ANY, minScore: 0, noBanned: false, labSuggested: false, use: ANY };

/** `isSuggested` says if a lab test is suggested for a lot; it is needed for the "Lab test suggested" filter. */
export function filterLots<T extends Lot>(lots: T[], f: LotFilters, isSuggested: (lot: T) => boolean = () => false): T[] {
  return lots.filter(
    (l) =>
      (f.variety === ANY || l.variety === f.variety) &&
      (f.region === ANY || l.region === f.region) &&
      l.score >= f.minScore &&
      (f.use === ANY || l.use === f.use) &&
      !(f.noBanned && lotHasBanned(l)) &&
      !(f.labSuggested && !isSuggested(l)),
  );
}

export const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'));

/** Days from today of the first and last harvest day of a field: ready now, or "12 days" away. A window is 10 days long. */
export function harvestWindow(harvest: { ready: boolean; badge: string }): [number, number] {
  const start = harvest.ready ? 0 : Number.parseInt(harvest.badge, 10) || 0;
  return [start, start + 10];
}

/** "Now" when the harvest has started, else "5–12 Nov" (or "20 Nov–1 Dec"). */
export function harvestLabel(lot: Pick<Lot, 'harvestIn'>, now: Date = new Date()): string {
  const [start, end] = lot.harvestIn;
  if (start <= 0) return 'Now';
  const a = formatDay(-start, now).split(' ');
  const b = formatDay(-end, now).split(' ');
  return a[1] === b[1] ? `${a[0]}–${b[0]} ${b[1]}` : `${a[0]} ${a[1]}–${b[0]} ${b[1]}`;
}

/** "Ayvalık, Balıkesir": district and province. The district can have the same name as a variety. */
export const placeLabel = (lot: Pick<Lot, 'town' | 'region'>) => `${lot.town}, ${lot.region}`;

/** "Ayvalık olives": always says that it is a variety. */
export const varietyLabel = (variety: string) => `${variety} olives`;

interface ListingLike {
  fieldId: string;
  tons: number;
  pricePerKg: number;
}

/**
 * The demo farmer's fields as lots. Score and sprays are live, so a new spray in the farmer app
 * changes the lot in the processor panel.
 */
export function buildUserLots(input: {
  fields: Field[];
  sprays: Spray[];
  sales: Sale[];
  listings: ListingLike[];
  farmerName: string;
  place: string;
  defaultTons: number;
}): Lot[] {
  const [town, region] = input.place.split(',').map((x) => x.trim());
  return input.fields.map((f) => {
    const listing = input.listings.find((l) => l.fieldId === f.id);
    const labSale = input.sales.find((s) => s.fieldId === f.id && s.status === 'paid' && s.labResult);
    return {
      id: f.id,
      fieldId: f.id,
      farmerName: input.farmerName,
      town,
      region: region ?? town,
      riskPlace: 'Ayvalık',
      ha: f.ha,
      variety: f.variety,
      tons: listing?.tons ?? input.defaultTons,
      score: f.score,
      harvestIn: harvestWindow(f.harvest),
      use: 'oil',
      breakdown: f.breakdown,
      sprays: input.sprays
        .filter((s) => s.fieldId === f.id)
        .sort((a, b) => b.ts - a.ts)
        .map((s) => ({ product: s.product, date: s.date, ts: s.ts, banned: s.banned, activeSubstances: s.activeSubstances, targets: s.targets, protectionDays: s.protectionDays })),
      lab: labSale ? { result: labSale.labResult!, date: labSale.paidDate ?? '' } : undefined,
    };
  });
}

/** 0–100 share of a request that is filled. */
export const requestFill = (r: Pick<ProcRequest, 'tons' | 'filledTons'>) => Math.min(100, Math.round((r.filledTons / r.tons) * 100));

/** A processor request in the shape of a factory request, for the farmer's Market > Requests. */
export function requestAsFactory(r: ProcRequest, buyer: Factory): Factory {
  return {
    ...buyer,
    needsTons: Math.max(0, Math.round((r.tons - r.filledTons) * 10) / 10),
    minScore: r.minScore,
    variety: r.variety,
    region: r.region,
    harvestBy: r.window.split('–').pop() ?? r.window,
    noBanned: r.noBanned,
    minPerSeller: undefined,
    requests: true,
  };
}

/**
 * Delivery steps (Scheduled, Weighed, Lab checked, Paid) in the farmer's five sale steps
 * (Agreed, Picked up, Weighed, Lab check, Paid). Both use "index of the active step".
 */
export function deliveryStepToSaleStep(step: number): number {
  if (step <= 0) return 0;
  if (step === 1) return 2;
  if (step === 2) return 3;
  return 4;
}

/** Step after the weighbridge result: Weighed is done, the lab check is next. */
export const AFTER_WEIGHING = 2;
/** Step after the lab check: payment is next. */
export const AFTER_LAB = 3;
/** All steps done. */
export const PAID_STEP = 4;

/** "Nazilli, Aydın" gives "Aydın". A place without a comma is already a region. */
export const regionOf = (place: string) => place.split(',').pop()!.trim();

const isPaid = (d: Delivery) => d.step >= PAID_STEP;

/** Weight of a delivery in tonnes: the weighbridge result when there is one, else the agreed amount. */
export const weighedTons = (d: Pick<Delivery, 'tons' | 'actualKg'>) => (d.actualKg ?? d.tons * 1000) / 1000;

/** What was paid for a delivery, rounded to €50. */
export const deliveryTotal = (d: Pick<Delivery, 'tons' | 'actualKg' | 'pricePerKg'>) => offerTotal(weighedTons(d), d.pricePerKg);

const newestFirst = (a: Delivery, b: Delivery) => (a.paidAgo ?? Infinity) - (b.paidAgo ?? Infinity);

/** Paid deliveries, newest first. */
export const completedDeliveries = (deliveries: Delivery[]): Delivery[] => deliveries.filter(isPaid).sort(newestFirst);

/** Deliveries that are not paid yet, in the order they were given. */
export const activeDeliveries = (deliveries: Delivery[]) => deliveries.filter((d) => !isPaid(d));

const scoresOf = (list: Delivery[]) => list.flatMap((d) => (d.score === undefined ? [] : [d.score]));

export interface SeasonStats {
  deliveries: number;
  /** Tonnes bought, one decimal. */
  tons: number;
  /** Total spent in euro: the sum of the rounded totals of each delivery. */
  spent: number;
  avgScore: number;
  /** Share (0-100) of the lots with no banned product. */
  cleanShare: number;
}

/** Totals of the paid deliveries of one season (the year in the paid date). */
export function seasonStats(deliveries: Delivery[], year: number): SeasonStats {
  const paid = deliveries.filter((d) => isPaid(d) && d.paidDate?.endsWith(String(year)));
  const clean = paid.filter((d) => d.bannedFree !== false).length;
  return {
    deliveries: paid.length,
    tons: Math.round(paid.reduce((t, d) => t + weighedTons(d), 0) * 10) / 10,
    spent: paid.reduce((t, d) => t + deliveryTotal(d), 0),
    avgScore: avgScore(scoresOf(paid)),
    cleanShare: paid.length ? Math.round((clean / paid.length) * 100) : 0,
  };
}

export interface BoughtFrom {
  farmerName: string;
  place: string;
  region: string;
  /** Variety of the latest delivery. */
  variety: string;
  deliveries: number;
  avgScore: number;
}

/** Farmers bought from: most deliveries first, then best average score. */
export function farmersBoughtFrom(completed: Delivery[]): BoughtFrom[] {
  const by = new Map<string, Delivery[]>();
  for (const d of completed) by.set(d.farmerName, [...(by.get(d.farmerName) ?? []), d]);
  return [...by.entries()]
    .map(([farmerName, list]) => {
      const latest = [...list].sort(newestFirst)[0];
      return { farmerName, place: latest.place, region: regionOf(latest.place), variety: latest.variety, deliveries: list.length, avgScore: avgScore(scoresOf(list)) };
    })
    .sort((a, b) => b.deliveries - a.deliveries || b.avgScore - a.avgScore || a.farmerName.localeCompare(b.farmerName, 'en'));
}

// ---------------------------------------------------------------------------------------------------------------
// Supply outlook, lab test advice, trust badges
// ---------------------------------------------------------------------------------------------------------------

/** Tonnes per region and week that are ready to harvest. Each lot spreads its tonnes evenly over its harvest window. */
export function weeklySupply(lots: Pick<Lot, 'region' | 'tons' | 'harvestIn'>[], regions: string[], weeks = 4): Record<string, number[]> {
  const out: Record<string, number[]> = Object.fromEntries(regions.map((r) => [r, Array<number>(weeks).fill(0)]));
  for (const l of lots) {
    const row = out[l.region];
    if (!row) continue;
    const [start, end] = l.harvestIn;
    const days = end - start + 1;
    for (let w = 0; w < weeks; w++) {
      const overlap = Math.max(0, Math.min(end, w * 7 + 6) - Math.max(start, w * 7) + 1);
      row[w] += (l.tons * overlap) / days;
    }
  }
  for (const r of regions) out[r] = out[r].map((t) => Math.round(t * 10) / 10);
  return out;
}

/** Date range of week `w` (0 = this week), e.g. "31 Oct–6 Nov". */
export function weekLabel(w: number, now: Date = new Date()): string {
  const a = formatDay(-w * 7, now).split(' ');
  const b = formatDay(-(w * 7 + 6), now).split(' ');
  return a[1] === b[1] ? `${a[0]}–${b[0]} ${b[1]}` : `${a[0]} ${a[1]}–${b[0]} ${b[1]}`;
}

export interface AreaRisk {
  level: RiskLevel;
  /** Name of the most serious pest or disease, e.g. "Peacock spot". Null when nothing is raised. */
  threat: string | null;
  /** One short line for the supply outlook. */
  line: string;
}

/** The most serious pest or disease in the coming days, from the risk engine output of a place. */
export function summarizeRisk(risk: FieldRisk, days = 7): AreaRisk {
  const top = highestRisk(risk, days, (id) => THREAT_BY_ID[id].group === 'pests');
  if (!top) return { level: 'Low', threat: null, line: 'Low risk this week: no extra checks needed' };
  const threat = THREAT_BY_ID[top.threat].name;
  if (top.level === 'High') return { level: 'High', threat, line: `${threat} risk high this week: check lots before buying` };
  if (top.level === 'Medium') return { level: 'Medium', threat, line: `${threat} risk medium this week: ask for spray records` };
  return { level: 'Low', threat, line: 'Low risk this week: no extra checks needed' };
}

/** What the risk engine knows about a lot besides the weather: its sprays (a recent approved spray lowers the risk it protects against). */
export function lotSignals(lot: Pick<Lot, 'sprays'>): FieldSignals {
  return {
    scans: [],
    sprays: lot.sprays.map((s) => ({ ts: s.ts, product: s.product, targets: s.targets ?? [], protectionDays: s.protectionDays ?? 0, banned: s.banned })),
    locationRisks: [],
    locationMitigated: false,
  };
}

/** Pest risk this week for a lot: the weather of its region and the sprays of the farmer, through the risk engine. */
export function lotRisk(lot: Pick<Lot, 'sprays'>, weather: FieldWeather, now: number = Date.now()): AreaRisk {
  return summarizeRisk(assessField(weather, lotSignals(lot), now, 7));
}

export interface LabAdvice {
  suggested: boolean;
  /** Why, in plain words. Empty when no test is suggested. */
  reasons: string[];
}

/** Records score (0-100) below which the spray records count as incomplete. Between this and 80 they are neither complete nor a reason for a test. */
export const RECORDS_INCOMPLETE_BELOW = 70;

/**
 * A lab test is suggested in two cases only:
 *  (a) the pest risk this week in the lot's area is High and the lot has no lab result yet,
 *  (b) the spray records are incomplete.
 * Every reason is one line for the lot page.
 */
export function labAdvice(lot: Pick<Lot, 'breakdown' | 'lab'>, risk?: AreaRisk | null): LabAdvice {
  const reasons: string[] = [];
  if (risk?.level === 'High' && risk.threat && !lot.lab) reasons.push(`High ${risk.threat.toLowerCase()} risk in this area and no lab result yet`);
  if (lot.breakdown.records < RECORDS_INCOMPLETE_BELOW) reasons.push(`Spray records are incomplete (records score ${lot.breakdown.records}%)`);
  return { suggested: reasons.length > 0, reasons };
}

/** Demo weather of an area, with the area's own wetness, so the areas do not all get the same risk. */
export const areaDemoWeather = (a: { region: string; lat: number; lon: number; wetness: number }, now: number = Date.now()): FieldWeather =>
  demoWeather({ id: `area:${a.region}`, lat: a.lat, lon: a.lon }, now, a.wetness);

export type LotBadgeId = BadgeId | 'lab-suggested' | 'banned';

export interface LotBadge {
  id: LotBadgeId;
  label: string;
  /** One line: why the lot has it. */
  why: string;
}

/** Most important first. */
const BADGE_ORDER: LotBadgeId[] = ['lab-suggested', 'banned', 'no-banned', 'reliable-delivery', 'complete-records'];

/**
 * Every badge of a lot, most important first: Lab test suggested, No banned products, Reliable delivery, Complete records.
 * A lot with a banned product gets "Banned product used" in the place of "No banned products".
 */
export function lotBadgeList(trust: Badge[], advice: LabAdvice, banned = false): LotBadge[] {
  const all: LotBadge[] = [...trust];
  if (banned) all.push({ id: 'banned', label: 'Banned product used', why: 'A product that is not approved in the EU was used on this lot.' });
  if (advice.suggested) all.push({ id: 'lab-suggested', label: 'Lab test suggested', why: advice.reasons.join('. ') });
  return all.sort((a, b) => BADGE_ORDER.indexOf(a.id) - BADGE_ORDER.indexOf(b.id));
}

/** The badges a list row shows: at most `max`, and how many more there are. */
export function rowBadges(list: LotBadge[], max = 2): { shown: LotBadge[]; more: number } {
  return { shown: list.slice(0, max), more: Math.max(0, list.length - max) };
}

/** Trust badges of the farmer of a lot, from the lot and the deliveries bought from this farmer. */
export function lotBadges(lot: Pick<Lot, 'farmerName' | 'breakdown' | 'sprays'>, deliveries: Pick<Delivery, 'farmerName' | 'step' | 'labResult'>[]): Badge[] {
  const paid = deliveries.filter((d) => d.farmerName === lot.farmerName && d.step >= PAID_STEP);
  return trustBadges({
    records: lot.breakdown.records,
    hasBanned: lotHasBanned(lot),
    paidDeliveries: paid.length,
    labFailed: paid.filter((d) => d.labResult === 'failed').length,
  });
}
