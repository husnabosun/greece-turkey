/** Seed data for the demo. All names, places and numbers come from here. */
import { dateLabel, daysAgoAt, formatDay, whenLabel } from '../lib/dates';
import type { ProofLevel } from '../lib/onboarding';
import type { ThreatId } from '../lib/risk/types';

export type Level = 'high' | 'medium' | 'low' | 'good';

/** A known place that can harm a field, e.g. a coal power plant. Used by the location risk rule. */
export interface LocationRisk {
  kind: 'coal-plant';
  label: string;
  km: number;
  /** Compass bearing from the field to the source, in degrees (0 = north). */
  bearingDeg: number;
}

export interface Field {
  id: string;
  /** Field centre, used for the weather forecast. */
  lat: number;
  lon: number;
  /** Days since the trees were last pruned, if known. Fresh cuts are wounds for olive knot. */
  prunedDaysAgo?: number;
  locationRisks?: LocationRisk[];
  /** Level from the proof the farmer added. "Lab verified" comes from sales, see verifiedLevel(). */
  proofLevel: ProofLevel;
  name: string;
  trees: number;
  ha: number;
  variety: string;
  score: number;
  color: string;
  pest: { name: string; level: Level };
  harvest: { label: string; badge: string; ready: boolean };
  breakdown: Breakdown;
  /** Change since last month, and why. */
  trend: { pct: number; reason: string };
  /** AI plan to raise the score. */
  plan: { text: string; points: number }[];
}

export interface Breakdown {
  tree: number;
  spray: number;
  harvest: number;
  records: number;
}

export interface Spray {
  id: string;
  fieldId: string;
  product: string;
  /** When the spray was applied (milliseconds). */
  ts: number;
  /** Short date for lists, e.g. "12 Oct". */
  date: string;
  area: string;
  dose: string;
  banned: boolean;
  /** Threats this spray protects against, for as long as its protection window lasts. */
  targets?: ThreatId[];
  protectionDays?: number;
  /** Short description shown next to "Approved for olives". */
  tag?: string;
  /** Shown in the "Approved for olives" box. */
  licence?: string;
  stage?: number;
  /** Filled when the spray was read from a label. */
  activeSubstances?: string[];
  preHarvestDays?: number;
  fromLabel?: boolean;
}

export interface SprayProduct {
  name: string;
  dose: string;
  banned: boolean;
  targets?: ThreatId[];
  protectionDays?: number;
  tag?: string;
  licence?: string;
  stage?: number;
}

export type TreeStatus = 'healthy' | 'suspicious' | 'diseased';

export interface Tree {
  id: number;
  /** Position on the field map, in percent. */
  x: number;
  y: number;
  status: TreeStatus;
  issue?: string;
  level?: Level;
  lastPhoto: string;
  lastSpray: string;
  recheckDays?: number;
}

export interface Task {
  id: string;
  fieldId: string;
  title: string;
  meta: string;
  kind: 'photo' | 'spray' | 'recheck' | 'plain';
  /** AI reason shown under urgent tasks. */
  why?: string;
  urgent?: boolean;
  treeId?: number;
  done: boolean;
}

export interface AlertItem {
  id: string;
  tab: 'pests' | 'weather' | 'location';
  title: string;
  where: string;
  level: 'high' | 'medium' | 'low' | 'action';
  text: string;
  ai: string;
}

export interface Offer {
  id: string;
  fieldId: string;
  factoryId: string;
  pricePerKg: number;
  status: 'open' | 'accepted';
  /** Set on offers made in the processor panel: tons offered for, and days from today to the delivery. */
  tons?: number;
  deliveryIn?: number;
}

export interface Sale {
  id: string;
  fieldId: string;
  factoryId: string;
  tons: number;
  pricePerKg: number;
  status: 'inProgress' | 'paid';
  /** Index into the five sale steps (Agreed … Paid). */
  step: number;
  /** Free text shown after the price, e.g. "picked up 22 Oct". */
  note: string;
  /** Paid date, shown for completed sales. */
  paidDate?: string;
  /** Result of the lab check, once there is one. */
  labResult?: 'passed' | 'failed';
  /** Weighbridge result in kg, once the buyer has recorded it. */
  actualKg?: number;
}

export interface Factory {
  id: string;
  name: string;
  /** Badge text instead of a wordmark, for buyers with a long name. */
  initials?: string;
  rating: number;
  praise: string;
  km: number;
  region: string;
  /** Food-oil buyers care about quality; soap and refinery buyers accept lower scores. */
  kind: 'food-oil' | 'soap-refinery';
  needsTons: number;
  minScore: number;
  priceLow: number;
  priceHigh: number;
  variety: string;
  harvestBy: string;
  noBanned: boolean;
  /** Minimum tons per seller; sellers below this can join a group. */
  minPerSeller?: number;
  /** Has an open buying request (shown in Requests). Others only send offers. */
  requests: boolean;
}

export const SALE_STEPS = ['Agreed', 'Picked up', 'Weighed', 'Lab check', 'Paid'];

/** The buyer of the processor panel. It is also a factory, so its offers show up in the farmer app. */
export const PROCESSOR_ID = 'demo';
export const processor = { id: PROCESSOR_ID, name: 'Demo Olive Oil Co.', initials: 'DO', place: 'Aydın' };

export const factories: Factory[] = [
  { id: 'taris', name: 'Sunridge Oil Mill', initials: 'SO', rating: 4.8, praise: 'top rated', km: 22, region: 'Aydın', kind: 'food-oil', needsTons: 10, minScore: 75, priceLow: 0.85, priceHigh: 0.95, variety: 'Ayvalık', harvestBy: '15 Nov', noBanned: true, requests: true },
  { id: 'kamili', name: 'Valley Press Co.', initials: 'VP', rating: 4.6, praise: 'reliable', km: 35, region: 'Aydın', kind: 'food-oil', needsTons: 25, minScore: 80, priceLow: 0.9, priceHigh: 1, variety: 'Ayvalık', harvestBy: '20 Nov', noBanned: false, minPerSeller: 10, requests: true },
  { id: 'duru', name: 'Harbor Soap Works', initials: 'HS', rating: 4.4, praise: 'fast payments', km: 12, region: 'Aydın', kind: 'soap-refinery', needsTons: 8, minScore: 60, priceLow: 0.7, priceHigh: 0.8, variety: 'any', harvestBy: '30 Nov', noBanned: false, requests: false },
  { id: 'egebirlik', name: 'Northgate Olive Co.', initials: 'NO', rating: 4.7, praise: 'reliable', km: 40, region: 'İzmir', kind: 'food-oil', needsTons: 15, minScore: 70, priceLow: 0.9, priceHigh: 1, variety: 'any', harvestBy: '25 Nov', noBanned: false, requests: false },
  { id: PROCESSOR_ID, name: 'Demo Olive Oil Co.', initials: 'DO', rating: 4.6, praise: 'new on AgroPulse', km: 18, region: 'Aydın', kind: 'food-oil', needsTons: 20, minScore: 75, priceLow: 0.9, priceHigh: 1, variety: 'Ayvalık', harvestBy: '25 Nov', noBanned: true, requests: false },
  { id: 'dalam', name: 'Hillside Refinery', initials: 'HR', rating: 4.5, praise: 'fast payments', km: 30, region: 'Aydın', kind: 'soap-refinery', needsTons: 12, minScore: 65, priceLow: 0.65, priceHigh: 0.75, variety: 'any', harvestBy: '30 Nov', noBanned: false, requests: false },
];

export const farmerGroups = [
  { id: 'g-kamili', factoryId: 'kamili', initials: ['AY', 'HK', 'MS'], colors: ['#2E8BD8', '#7B3FB5', '#D8453A'], nearby: 3, quality: '84–88' },
];

/** The public "Demo price" the processor panel shows as its only price reference. Mock number, labelled as sample data. */
export const exchangePrice = { pricePerKg: 0.8, source: 'Demo price · sample data, not a real exchange quote', date: formatDay(0) };

/**
 * Today's quote of the local commodity exchange, per province: lowest, highest and average price in €/kg. Sample data.
 * A province without an entry has no exchange data (the farmer app then says so, e.g. in Greece).
 */
export const exchangeRanges: Record<string, { min: number; max: number; avg: number }> = {
  Aydın: { min: 0.75, max: 0.9, avg: 0.8 },
  Balıkesir: { min: 0.8, max: 0.95, avg: 0.85 },
  İzmir: { min: 0.75, max: 0.9, avg: 0.8 },
};
export const exchangeName = 'Local commodity exchange';

export const farmer = { name: 'Mehmet', place: 'Germencik, Aydın' };
/** Where a new field is placed until the farmer draws it: the middle of the three demo fields. */
export const farmerLocation = { lat: 39.325, lon: 26.7 };
export const weather = { temp: 22, sky: 'Sunny', next: 'Rain tomorrow' };

export const fields: Field[] = [
  {
    id: 'north',
    lat: 39.33,
    lon: 26.7,
    prunedDaysAgo: 10,
    proofLevel: 'Evidence-based',
    name: 'North grove',
    trees: 120,
    ha: 1.1,
    variety: 'Ayvalık',
    score: 68,
    color: '#C9553A',
    pest: { name: 'Peacock spot', level: 'high' },
    harvest: { label: 'Safe to harvest', badge: '12 days', ready: false },
    breakdown: { tree: 72, spray: 40, harvest: 85, records: 90 },
    trend: { pct: -12, reason: 'Your score decreased because a banned product was detected in a recent record.' },
    plan: [
      { text: 'Remove banned products from your records and keep them off for 6 weeks.', points: 7 },
      { text: 'Prune and re-scan Tree #23 and 2 others to improve tree health.', points: 4 },
      { text: 'Use a natural fly barrier instead of a spray to improve safe spraying.', points: 3 },
    ],
  },
  {
    id: 'river',
    lat: 39.3,
    lon: 26.72,
    proofLevel: 'Evidence-based',
    name: 'River plot',
    trees: 140,
    ha: 0.8,
    variety: 'Ayvalık',
    score: 86,
    color: '#C9A13B',
    pest: { name: 'Olive fly', level: 'medium' },
    harvest: { label: 'Ready to harvest', badge: 'Now', ready: true },
    breakdown: { tree: 88, spray: 85, harvest: 95, records: 80 },
    trend: { pct: 4, reason: 'Your score went up because you sent your fly-trap photos on time.' },
    plan: [
      { text: 'Send a fly-trap photo every week to keep your tree health high.', points: 2 },
      { text: 'Log the harvest date in your logbook.', points: 1 },
    ],
  },
  {
    id: 'hill',
    lat: 39.345,
    lon: 26.68,
    locationRisks: [{ kind: 'coal-plant', label: 'coal power plant', km: 4, bearingDeg: 0 }],
    proofLevel: 'Self-reported',
    name: 'Hill',
    trees: 90,
    ha: 0.7,
    variety: 'Memecik',
    score: 79,
    color: '#3F6B2F',
    pest: { name: 'Olive fly', level: 'low' },
    harvest: { label: 'Safe to harvest', badge: '20 days', ready: false },
    breakdown: { tree: 80, spray: 78, harvest: 85, records: 75 },
    trend: { pct: 2, reason: 'Your score is steady. Ash from the coal plant is the main risk.' },
    plan: [
      { text: 'Wash the olives before delivery to remove ash.', points: 3 },
      { text: 'Order a lab test to show buyers the olives are clean.', points: 2 },
    ],
  },
];

export const sprayProducts: SprayProduct[] = [
  { name: 'Copper oxychloride', dose: '3 kg/ha', banned: false, targets: ['peacock-spot', 'anthracnose', 'olive-knot'], protectionDays: 14, licence: '12-4471', stage: 75 },
  { name: 'Kaolin clay', dose: '50 kg/ha', banned: false, targets: ['olive-fly', 'olive-moth'], protectionDays: 10, tag: 'natural fly barrier', licence: '09-2210', stage: 71 },
  { name: 'Chlorpyrifos product', dose: '1 l/ha', banned: true },
];

const spray = (id: string, fieldId: string, productName: string, days: number, hour: number, area: string): Spray => {
  const p = sprayProducts.find((x) => x.name === productName)!;
  const ts = daysAgoAt(days, hour);
  return {
    id,
    fieldId,
    product: p.name,
    ts,
    date: dateLabel(ts),
    area,
    dose: p.dose,
    banned: p.banned,
    targets: p.targets,
    protectionDays: p.protectionDays,
    tag: p.tag,
    licence: p.licence,
    stage: p.stage,
  };
};

export const sprays: Spray[] = [
  spray('s1', 'north', 'Chlorpyrifos product', 15, 9, 'North grove, rows 1–6'),
  spray('s2', 'north', 'Copper oxychloride', 9, 10, 'whole field'),
  spray('s3', 'north', 'Kaolin clay', 86, 10, 'whole field'),
];

export const tasks: Task[] = [
  {
    id: 't1', fieldId: 'river', title: 'Send a photo of your fly trap', meta: 'River plot · due today', kind: 'photo', urgent: true,
    why: 'Fly numbers rose 60% nearby. Your photo shows if you need to act.', done: false,
  },
  { id: 't2', fieldId: 'north', title: 'Did you spray this week?', meta: 'North grove · peacock spot risk was high', kind: 'spray', done: false },
  { id: 't3', fieldId: 'north', title: 'Re-check Tree #23', meta: 'North grove · in 2 days', kind: 'recheck', treeId: 23, done: false },
  { id: 't4', fieldId: 'hill', title: 'Wash olives after ash warning', meta: 'Hill', kind: 'plain', done: true },
  { id: 't5', fieldId: 'river', title: 'Log harvest date', meta: 'River plot', kind: 'plain', done: true },
];

export const offers: Offer[] = [
  { id: 'o1', fieldId: 'river', factoryId: 'egebirlik', pricePerKg: 1, status: 'open' },
  { id: 'o2', fieldId: 'river', factoryId: 'taris', pricePerKg: 0.95, status: 'open' },
  { id: 'o3', fieldId: 'river', factoryId: 'dalam', pricePerKg: 0.7, status: 'open' },
];

export const sales: Sale[] = [
  { id: 'a0', fieldId: 'hill', factoryId: 'duru', tons: 1, pricePerKg: 0.9, status: 'inProgress', step: 3, note: 'picked up 22 Oct' },
  { id: 'a1', fieldId: 'north', factoryId: 'duru', tons: 2.5, pricePerKg: 0.8, status: 'paid', step: 4, note: '', paidDate: '12 Oct 2026', labResult: 'passed' },
  { id: 'a2', fieldId: 'hill', factoryId: 'taris', tons: 0.5, pricePerKg: 0.9, status: 'paid', step: 4, note: '', paidDate: '28 Sep 2026', labResult: 'passed' },
];

/** Tons the farmer can sell from a field this season. */
export const tonsAvailable = 2.5;
export const marketTrend = { pct: 6, avgPrice: 0.95 };

export const initialNotifications = [
  { id: 'n1', emoji: '📸', title: 'Send a photo of your fly trap', body: 'Fly numbers rose 60% near River plot. Takes 10 seconds.', when: 'now' },
  { id: 'n2', emoji: '💧', title: 'Did you spray this week?', body: 'Peacock spot risk was high in North grove. Tap Yes or No.', when: '1h ago' },
];

/** Points the Hill quality score loses if the location risk is ignored. */
export const LOCATION_RISK_PENALTY = 5;


export const nearbyFarms = 4;

const dots = (list: [number, number, TreeStatus][], start: number): Tree[] =>
  list.map(([x, y, status], i) => ({ id: start + i, x, y, status, lastPhoto: '9 days ago', lastSpray: '18 Sep' }));

export const initialTrees: Record<string, Tree[]> = {
  north: [
    ...dots([[12, 22, 'healthy'], [33, 27, 'healthy'], [53, 16, 'healthy'], [70, 27, 'healthy'], [22, 40, 'suspicious'], [35, 58, 'healthy'], [45, 37, 'suspicious'], [76, 38, 'healthy']], 3),
    { id: 23, x: 50, y: 54, status: 'diseased', issue: 'Peacock spot', level: 'high', lastPhoto: '3 days ago', lastSpray: '18 Sep', recheckDays: 4 },
    ...dots([[16, 58, 'suspicious'], [30, 72, 'healthy'], [52, 63, 'suspicious'], [73, 62, 'suspicious'], [47, 79, 'healthy'], [86, 66, 'healthy'], [18, 79, 'healthy']], 30),
    { id: 12, x: 71, y: 26, status: 'diseased', issue: 'Peacock spot', level: 'medium', lastPhoto: '5 days ago', lastSpray: '18 Sep', recheckDays: 6 },
    { id: 41, x: 25, y: 84, status: 'diseased', issue: 'Peacock spot', level: 'medium', lastPhoto: '6 days ago', lastSpray: '18 Sep', recheckDays: 5 },
  ],
  river: dots([[20, 25, 'healthy'], [40, 35, 'suspicious'], [62, 22, 'healthy'], [30, 60, 'healthy'], [55, 58, 'healthy'], [78, 50, 'healthy']], 101),
  hill: dots([[25, 30, 'healthy'], [48, 25, 'healthy'], [70, 40, 'suspicious'], [35, 62, 'healthy'], [60, 70, 'healthy']], 201),
};

export const scanResult = {
  fieldId: 'north',
  treeId: 23,
  time: 'Today, 09:12',
  name: 'Peacock spot',
  latin: 'Spilocaea oleaginea',
  stage: 'early stage',
  level: 'high' as Level,
  actions: [
    { title: 'Prune for airflow', hint: 'Improve air circulation' },
    { title: 'Remove fallen leaves', hint: 'Reduce infection sources' },
    { title: 'Re-check in 7 days', hint: 'Monitor spread' },
  ],
};

export type ScanMode = 'leaf' | 'fruit' | 'trap' | 'label';
export type ScanTone = 'healthy' | 'medium' | 'high' | 'watch';
export type ScanPhotoKind = 'leaf-spots' | 'leaf-healthy' | 'trap' | 'fruit';

export interface Scan {
  id: string;
  fieldId: string;
  treeId?: number;
  mode: ScanMode;
  /** Diagnosis, e.g. "Peacock spot". */
  title: string;
  latin?: string;
  tone: ScanTone;
  /** Text of the status pill, e.g. "Medium risk". */
  pill: string;
  confidence: number;
  /** Short date for lists, e.g. "28 Sep" or "Today". */
  date: string;
  /** Date and time for the result screen. */
  when: string;
  /** Sort key (milliseconds). */
  ts: number;
  photo: ScanPhotoKind;
  spots?: number;
  flies?: number;
  /** A picked or captured photo; the sample drawing is used when missing. */
  uri?: string;
  /** Who made the diagnosis of a new scan: "gemini", our own "model", or the "demo" mock. Missing on the sample history. */
  source?: 'gemini' | 'model' | 'demo';
  /** Version of the leaf model that made the diagnosis, e.g. "v2". Only for source "model". */
  modelVersion?: string;
  /** Extra sentence from the AI (what it saw, or notes on the trap). Replaces the standard explanation. */
  detail?: string;
  /** This scan asked for a re-check. It is due until a newer scan of the same tree exists. */
  recheckDue?: boolean;
}

const scan = (
  id: string,
  daysAgo: number,
  hour: number,
  minute: number,
  rest: Omit<Scan, 'id' | 'date' | 'when' | 'ts'>,
): Scan => {
  const ts = Math.min(daysAgoAt(daysAgo, hour, minute), Date.now() - 60_000);
  return { id, ts, date: dateLabel(ts), when: whenLabel(ts), ...rest };
};

const PEACOCK = 'Spilocaea oleaginea · early stage';

export const initialScans: Scan[] = [
  scan('sc1', 15, 8, 40, { fieldId: 'north', treeId: 23, mode: 'leaf', title: 'Peacock spot', latin: PEACOCK, tone: 'high', pill: 'High risk', confidence: 92, photo: 'leaf-spots', spots: 4 }),
  scan('sc2', 0, 9, 12, { fieldId: 'north', treeId: 23, mode: 'leaf', title: 'Peacock spot', latin: PEACOCK, tone: 'medium', pill: 'Medium risk', confidence: 90, photo: 'leaf-spots', spots: 1 }),
  scan('sc3', 25, 10, 5, { fieldId: 'north', treeId: 41, mode: 'leaf', title: 'Peacock spot', latin: PEACOCK, tone: 'high', pill: 'High risk', confidence: 88, photo: 'leaf-spots', spots: 3, recheckDue: true }),
  scan('sc4', 29, 17, 20, { fieldId: 'north', treeId: 12, mode: 'leaf', title: 'Healthy leaf', tone: 'healthy', pill: 'Healthy', confidence: 94, photo: 'leaf-healthy' }),
  scan('sc5', 0, 7, 50, { fieldId: 'river', mode: 'trap', title: 'Fly trap', tone: 'medium', pill: 'Medium risk', confidence: 88, photo: 'trap', flies: 14 }),
  scan('sc6', 7, 12, 15, { fieldId: 'river', mode: 'fruit', title: 'Olive fly sting', latin: 'Bactrocera oleae', tone: 'watch', pill: 'Watch', confidence: 77, photo: 'fruit' }),
];

// ---------------------------------------------------------------------------------------------------------------
// Processor panel (B2B). Farmer names stay hidden until an offer is accepted.
// ---------------------------------------------------------------------------------------------------------------

export type LotUse = 'oil' | 'table';

export interface LotSpray {
  product: string;
  /** Short date for lists, e.g. "12 Oct". */
  date: string;
  /** When the spray was applied (milliseconds). */
  ts: number;
  banned: boolean;
  activeSubstances?: string[];
  /** Threats the spray protects against, and for how long, as in sprayProducts. */
  targets?: ThreatId[];
  protectionDays?: number;
}

/** Olives a farmer offers to buyers. Lots of the demo farmer come from `fields` (see buildUserLots). */
export interface Lot {
  id: string;
  /** Set when the lot is one of the demo farmer's own fields. */
  fieldId?: string;
  farmerName: string;
  /** District, e.g. "Ayvalık". Shown together with the province: "Ayvalık, Balıkesir". */
  town: string;
  /** Province (Türkiye) or regional unit (Greece), used by the "Region" filter. */
  region: string;
  /** Nearest place of the season risk table (src/data/seasonRisk.ts). */
  riskPlace: string;
  ha: number;
  variety: string;
  tons: number;
  score: number;
  /** Harvest window in days from today: [first day, last day]. The label is made from it (harvestLabel). */
  harvestIn: [number, number];
  use: LotUse;
  breakdown: Breakdown;
  sprays: LotSpray[];
  lab?: { result: 'passed' | 'failed'; acidity?: number; date: string };
}

/** A spray `daysAgo` days ago. Targets and protection time come from the product list. */
const lotSpray = (product: string, daysAgo: number, banned = false, activeSubstances?: string[]): LotSpray => {
  const p = sprayProducts.find((x) => x.name === product);
  const ts = daysAgoAt(daysAgo, 10);
  return { product, ts, date: dateLabel(ts), banned, activeSubstances, targets: p?.targets, protectionDays: p?.protectionDays };
};

export const lots: Lot[] = [
  { id: 'lot-ay1', farmerName: 'Ayşe Kaya', town: 'Edremit', region: 'Balıkesir', riskPlace: 'Edremit', ha: 1.4, variety: 'Ayvalık', tons: 6, score: 88, harvestIn: [5, 12], use: 'oil',
    breakdown: { tree: 90, spray: 92, harvest: 88, records: 85 }, lab: { result: 'passed', acidity: 0.3, date: '14 Oct' },
    sprays: [lotSpray('Copper oxychloride', 6, false, ['copper oxychloride']), lotSpray('Kaolin clay', 40, false, ['kaolin'])] },
  { id: 'lot-ay2', farmerName: 'Ali Demir', town: 'Ayvalık', region: 'Balıkesir', riskPlace: 'Ayvalık', ha: 1, variety: 'Ayvalık', tons: 4.5, score: 82, harvestIn: [8, 15], use: 'oil',
    breakdown: { tree: 84, spray: 80, harvest: 85, records: 78 },
    sprays: [lotSpray('Copper oxychloride', 9, false, ['copper oxychloride'])] },
  { id: 'lot-ay3', farmerName: 'Hasan Çelik', town: 'Nazilli', region: 'Aydın', riskPlace: 'Ayvalık', ha: 2, variety: 'Memecik', tons: 8, score: 77, harvestIn: [10, 20], use: 'oil',
    breakdown: { tree: 78, spray: 74, harvest: 82, records: 72 },
    sprays: [lotSpray('Copper oxychloride', 30, false, ['copper oxychloride']), lotSpray('Kaolin clay', 50, false, ['kaolin'])] },
  { id: 'lot-ay4', farmerName: 'Fatma Arslan', town: 'Söke', region: 'Aydın', riskPlace: 'Ayvalık', ha: 0.9, variety: 'Memecik', tons: 3, score: 64, harvestIn: [12, 20], use: 'oil',
    breakdown: { tree: 70, spray: 38, harvest: 80, records: 66 },
    sprays: [lotSpray('Chlorpyrifos product', 22, true, ['chlorpyrifos']), lotSpray('Copper oxychloride', 41, false, ['copper oxychloride'])] },
  { id: 'lot-ay5', farmerName: 'Mustafa Öz', town: 'Burhaniye', region: 'Balıkesir', riskPlace: 'Edremit', ha: 1.2, variety: 'Gemlik', tons: 5, score: 91, harvestIn: [1, 8], use: 'table',
    breakdown: { tree: 92, spray: 94, harvest: 90, records: 88 }, lab: { result: 'passed', acidity: 0.4, date: '20 Oct' },
    sprays: [lotSpray('Kaolin clay', 29, false, ['kaolin'])] },
  { id: 'lot-ay6', farmerName: 'Elif Şahin', town: 'Bergama', region: 'İzmir', riskPlace: 'Edremit', ha: 1.6, variety: 'Ayvalık', tons: 7.5, score: 73, harvestIn: [10, 18], use: 'oil',
    breakdown: { tree: 75, spray: 70, harvest: 78, records: 68 },
    sprays: [lotSpray('Copper oxychloride', 36, false, ['copper oxychloride'])] },
  { id: 'lot-gr1', farmerName: 'Nikos Papas', town: 'Kalamata', region: 'Messinia', riskPlace: 'Kalamata', ha: 2.4, variety: 'Koroneiki', tons: 9, score: 85, harvestIn: [15, 25], use: 'oil',
    breakdown: { tree: 86, spray: 84, harvest: 88, records: 82 }, lab: { result: 'passed', acidity: 0.3, date: '18 Oct' },
    sprays: [lotSpray('Copper oxychloride', 5, false, ['copper oxychloride'])] },
  { id: 'lot-gr2', farmerName: 'Eleni Kosta', town: 'Chania', region: 'Crete', riskPlace: 'Chania', ha: 1.8, variety: 'Koroneiki', tons: 6.5, score: 90, harvestIn: [20, 31], use: 'oil',
    breakdown: { tree: 91, spray: 90, harvest: 92, records: 86 },
    sprays: [lotSpray('Kaolin clay', 26, false, ['kaolin'])] },
  { id: 'lot-gr3', farmerName: 'Yannis Mavros', town: 'Kalamata', region: 'Messinia', riskPlace: 'Kalamata', ha: 1.1, variety: 'Kalamon', tons: 3.5, score: 80, harvestIn: [5, 15], use: 'table',
    breakdown: { tree: 82, spray: 78, harvest: 84, records: 76 },
    sprays: [lotSpray('Copper oxychloride', 34, false, ['copper oxychloride'])] },
];

/** A farmer's offer to the processor, waiting for Accept or Counter. */
export interface IncomingOffer {
  id: string;
  lotId: string;
  tons: number;
  pricePerKg: number;
  status: 'open' | 'accepted';
}

export const incomingOffers: IncomingOffer[] = [
  { id: 'io1', lotId: 'lot-ay1', tons: 6, pricePerKg: 0.95, status: 'open' },
  { id: 'io2', lotId: 'lot-gr2', tons: 6.5, pricePerKg: 1, status: 'open' },
  { id: 'io3', lotId: 'lot-ay2', tons: 4.5, pricePerKg: 0.9, status: 'open' },
  { id: 'io4', lotId: 'lot-ay6', tons: 7.5, pricePerKg: 0.85, status: 'open' },
];

/** An offer of the processor for a lot of another farmer. Offers for the demo farmer's fields are `Offer`s. */
export interface SentOffer {
  id: string;
  lotId: string;
  tons: number;
  pricePerKg: number;
  deliveryIn: number;
}

/** A buying request of the processor. */
export interface ProcRequest {
  id: string;
  variety: string;
  tons: number;
  minScore: number;
  /** Delivery window as text, e.g. "5–25 Nov". */
  window: string;
  region: string;
  noBanned: boolean;
  filledTons: number;
  farmers: number;
  /** Created in the demo: also shown to the farmer under Market > Requests. */
  shared: boolean;
}

export const procRequests: ProcRequest[] = [
  { id: 'r1', variety: 'Ayvalık', tons: 20, minScore: 75, window: '5–25 Nov', region: 'Aydın', noBanned: true, filledTons: 8.5, farmers: 3, shared: false },
  { id: 'r2', variety: 'Memecik', tons: 12, minScore: 70, window: '10–30 Nov', region: 'Aydın', noBanned: false, filledTons: 4, farmers: 2, shared: false },
  { id: 'r3', variety: 'Koroneiki', tons: 15, minScore: 80, window: '15 Nov–5 Dec', region: 'Messinia', noBanned: true, filledTons: 0, farmers: 0, shared: false },
];

/** Steps of a delivery. `Delivery.step` is the index of the active step; 4 means all done. */
export const DELIVERY_STEPS = ['Scheduled', 'Weighed', 'Lab checked', 'Paid'];

export interface Delivery {
  id: string;
  /** The farmer's sale, when the lot is one of the demo farmer's fields. */
  saleId?: string;
  /** The lot it came from, so the lot page can show the farmer's name once an offer is accepted. */
  lotId?: string;
  farmerName: string;
  place: string;
  variety: string;
  tons: number;
  pricePerKg: number;
  /** Days from today to the delivery (negative = in the past). */
  scheduledIn: number;
  step: number;
  actualKg?: number;
  labResult?: 'passed' | 'failed';
  /** Paid date with the year, e.g. "12 Oct 2026". */
  paidDate?: string;
  /** Days since it was paid, to sort the purchase history (0 = today). */
  paidAgo?: number;
  /** Quality score of the lot when it was bought. */
  score?: number;
  /** False when a banned product was used on the lot. Missing means no banned product. */
  bannedFree?: boolean;
}

export const deliveries: Delivery[] = [
  { id: 'd1', farmerName: 'Osman Tekin', place: 'Nazilli, Aydın', variety: 'Ayvalık', tons: 5, pricePerKg: 0.9, scheduledIn: 4, step: 0, score: 82 },
  { id: 'd2', farmerName: 'Zeynep Aksoy', place: 'Koçarlı, Aydın', variety: 'Memecik', tons: 3.5, pricePerKg: 0.85, scheduledIn: -2, step: 2, actualKg: 3480, score: 71 },
  // Paid this season (2026): the purchase history.
  { id: 'd4', farmerName: 'Hasan Çelik', place: 'Nazilli, Aydın', variety: 'Memecik', tons: 4.2, pricePerKg: 0.85, scheduledIn: -4, step: 4, actualKg: 4180, labResult: 'passed', paidDate: '28 Oct 2026', paidAgo: 3, score: 78 },
  { id: 'd5', farmerName: 'Ayşe Kaya', place: 'Edremit, Balıkesir', variety: 'Ayvalık', tons: 5.5, pricePerKg: 0.95, scheduledIn: -8, step: 4, actualKg: 5530, labResult: 'passed', paidDate: '25 Oct 2026', paidAgo: 6, score: 89 },
  { id: 'd6', farmerName: 'Eleni Kosta', place: 'Chania, Crete', variety: 'Koroneiki', tons: 6.8, pricePerKg: 1, scheduledIn: -11, step: 4, actualKg: 6760, labResult: 'passed', paidDate: '22 Oct 2026', paidAgo: 9, score: 90 },
  { id: 'd7', farmerName: 'Osman Tekin', place: 'Nazilli, Aydın', variety: 'Ayvalık', tons: 3.2, pricePerKg: 0.9, scheduledIn: -14, step: 4, actualKg: 3210, labResult: 'passed', paidDate: '19 Oct 2026', paidAgo: 12, score: 74 },
  { id: 'd8', farmerName: 'Nikos Papas', place: 'Kalamata, Messinia', variety: 'Koroneiki', tons: 8.4, pricePerKg: 0.95, scheduledIn: -17, step: 4, actualKg: 8390, labResult: 'passed', paidDate: '16 Oct 2026', paidAgo: 15, score: 84 },
  { id: 'd3', farmerName: 'Dimitris Kalogeras', place: 'Pylos, Messinia', variety: 'Koroneiki', tons: 6, pricePerKg: 1, scheduledIn: -18, step: 4, actualKg: 6020, labResult: 'passed', paidDate: '12 Oct 2026', paidAgo: 19, score: 87 },
  { id: 'd9', farmerName: 'Fatma Arslan', place: 'Söke, Aydın', variety: 'Memecik', tons: 2.9, pricePerKg: 0.75, scheduledIn: -22, step: 4, actualKg: 2910, labResult: 'passed', paidDate: '8 Oct 2026', paidAgo: 23, score: 64, bannedFree: false },
  { id: 'd10', farmerName: 'Hasan Çelik', place: 'Nazilli, Aydın', variety: 'Memecik', tons: 3.6, pricePerKg: 0.85, scheduledIn: -26, step: 4, actualKg: 3620, labResult: 'passed', paidDate: '4 Oct 2026', paidAgo: 27, score: 76 },
];

/** The season the purchase history and its totals are about. */
export const season = 2026;

/**
 * Places the processor panel shows weather risk for: one point per region, where the lots are.
 * `wetness` only shapes the offline demo weather (1 = the wet demo week, 0 = dry). It gives a realistic mix through the risk engine:
 * Balıkesir high, Aydın and Crete medium, İzmir and Messinia low.
 */
export const areas = [
  { region: 'Aydın', lat: 37.85, lon: 27.84, wetness: 0.5 },
  { region: 'Balıkesir', lat: 39.32, lon: 26.69, wetness: 0.9 },
  { region: 'İzmir', lat: 39.12, lon: 27.18, wetness: 0.1 },
  { region: 'Crete', lat: 35.51, lon: 24.02, wetness: 0.6 },
  { region: 'Messinia', lat: 37.04, lon: 22.11, wetness: 0.2 },
];
