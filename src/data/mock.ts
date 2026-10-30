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
}

export interface Factory {
  id: string;
  name: string;
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

export const factories: Factory[] = [
  { id: 'taris', name: 'Tariş', rating: 4.8, praise: 'top rated', km: 22, region: 'Aydın', kind: 'food-oil', needsTons: 10, minScore: 75, priceLow: 0.85, priceHigh: 0.95, variety: 'Ayvalık', harvestBy: '15 Nov', noBanned: true, requests: true },
  { id: 'kamili', name: 'Kamili', rating: 4.6, praise: 'reliable', km: 35, region: 'Aydın', kind: 'food-oil', needsTons: 25, minScore: 80, priceLow: 0.9, priceHigh: 1, variety: 'Ayvalık', harvestBy: '20 Nov', noBanned: false, minPerSeller: 10, requests: true },
  { id: 'duru', name: 'Duru', rating: 4.4, praise: 'fast payments', km: 12, region: 'Aydın', kind: 'soap-refinery', needsTons: 8, minScore: 60, priceLow: 0.7, priceHigh: 0.8, variety: 'any', harvestBy: '30 Nov', noBanned: false, requests: false },
  { id: 'egebirlik', name: 'Egebirlik', rating: 4.7, praise: 'reliable', km: 40, region: 'İzmir', kind: 'food-oil', needsTons: 15, minScore: 70, priceLow: 0.9, priceHigh: 1, variety: 'any', harvestBy: '25 Nov', noBanned: false, requests: false },
  { id: 'dalam', name: 'Dalam', rating: 4.5, praise: 'fast payments', km: 30, region: 'Aydın', kind: 'soap-refinery', needsTons: 12, minScore: 65, priceLow: 0.65, priceHigh: 0.75, variety: 'any', harvestBy: '30 Nov', noBanned: false, requests: false },
];

export const farmerGroups = [
  { id: 'g-kamili', factoryId: 'kamili', initials: ['AY', 'HK', 'MS'], colors: ['#2E8BD8', '#7B3FB5', '#D8453A'], nearby: 3, quality: '84–88' },
];

/** Today's exchange price for olives. The base of the fair price. Mock number, labelled with its source and date. */
export const exchangePrice = { pricePerKg: 0.8, source: 'Demo price · replace with Edremit Commodity Exchange', date: formatDay(0) };

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
