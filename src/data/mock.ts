/** Seed data for the demo. All names, places and numbers come from here. */
export type Level = 'high' | 'medium' | 'low' | 'good';

export interface Field {
  id: string;
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
  date: string;
  area: string;
  dose: string;
  banned: boolean;
  /** Short description shown next to "Approved for olives". */
  tag?: string;
  /** Shown in the "Approved for olives" box. */
  licence?: string;
  stage?: number;
  /** Warning shown under the record, e.g. rain after spraying. */
  note?: string;
}

export interface SprayProduct {
  name: string;
  dose: string;
  banned: boolean;
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

export const farmer = { name: 'Mehmet', place: 'Germencik, Aydın' };
export const weather = { temp: 22, sky: 'Sunny', next: 'Rain tomorrow' };

export const fields: Field[] = [
  {
    id: 'north',
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
  { name: 'Copper oxychloride', dose: '3 kg/ha', banned: false, licence: '12-4471', stage: 75 },
  { name: 'Kaolin clay', dose: '50 kg/ha', banned: false, tag: 'natural fly barrier', licence: '09-2210', stage: 71 },
  { name: 'Chlorpyrifos product', dose: '1 l/ha', banned: true },
];

export const sprays: Spray[] = [
  { id: 's1', fieldId: 'north', product: 'Chlorpyrifos product', date: '12 Oct', area: 'North grove, rows 1–6', dose: '1 l/ha', banned: true },
  {
    id: 's2', fieldId: 'north', product: 'Copper oxychloride', date: '18 Sep', area: 'whole field', dose: '3 kg/ha',
    banned: false, licence: '12-4471', stage: 75, note: 'It rained 4 hours later. The spray may have washed off.',
  },
  {
    id: 's3', fieldId: 'north', product: 'Kaolin clay', date: '2 Aug', area: 'whole field', dose: '50 kg/ha',
    banned: false, tag: 'natural fly barrier', licence: '09-2210', stage: 71,
  },
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
  { id: 'a1', fieldId: 'north', factoryId: 'duru', tons: 2.5, pricePerKg: 0.8, status: 'paid', step: 4, note: '', paidDate: '12 Oct 2026' },
  { id: 'a2', fieldId: 'hill', factoryId: 'taris', tons: 0.5, pricePerKg: 0.9, status: 'paid', step: 4, note: '', paidDate: '28 Sep 2026' },
];

/** Tons the farmer can sell from a field this season. */
export const tonsAvailable = 2.5;
export const marketTrend = { pct: 6, avgPrice: 0.95 };

export const initialNotifications = [
  { id: 'n1', emoji: '📸', title: 'Send a photo of your fly trap', body: 'Fly numbers rose 60% near River plot. Takes 10 seconds.', when: 'now' },
  { id: 'n2', emoji: '💧', title: 'Did you spray this week?', body: 'Peacock spot risk was high in North grove. Tap Yes or No.', when: '1h ago' },
];

export type RiskLevel = 'low' | 'medium' | 'high';
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const forecasts: Record<'pests' | 'weather', { title: string; subtitle: string; note: string; levels: RiskLevel[] }> = {
  pests: {
    title: '7-day forecast',
    subtitle: 'Olive fly risk · North grove',
    note: 'Higher risk on Wed–Thu due to warm temperatures. Check traps and monitor closely.',
    levels: ['low', 'low', 'medium', 'high', 'medium', 'medium', 'low'],
  },
  weather: {
    title: '7-day rain',
    subtitle: 'Rain risk · North grove',
    note: 'Rain is likely on Tue–Wed. Wet leaves help peacock spot spread, so check leaves afterwards.',
    levels: ['low', 'medium', 'high', 'medium', 'low', 'low', 'low'],
  },
};

export const alerts: AlertItem[] = [
  {
    id: 'al1', tab: 'pests', title: 'Olive fly', where: 'North grove · 2 hours ago', level: 'high',
    text: 'Trap counts increased by 60% this week. Check traps and consider control measures.',
    ai: 'The fly lays eggs in the olive fruit when it is warm. Check the yellow traps every two days.',
  },
  {
    id: 'al2', tab: 'pests', title: 'Peacock spot', where: 'North grove · today', level: 'medium',
    text: 'Early spots detected on Tree #23. Monitor leaves, especially after rain.',
    ai: 'Round dark spots on the leaves are peacock spot. Prune for airflow and remove fallen leaves.',
  },
  {
    id: 'al3', tab: 'weather', title: 'Rain tomorrow', where: 'North grove · tomorrow', level: 'medium',
    text: 'About 12 mm of rain is expected. Wet leaves help peacock spot spread.',
    ai: 'Do not spray right before rain, it washes the product off. Check the leaves after the rain.',
  },
  {
    id: 'al4', tab: 'weather', title: 'Warm week', where: 'All fields · today', level: 'low',
    text: 'Temperatures stay above 25 °C until Saturday.',
    ai: 'Warm weather makes the olive fly more active. Check the traps more often.',
  },
  {
    id: 'al5', tab: 'location', title: 'Location risk', where: 'Hill · coal power plant 4 km away', level: 'action',
    text: 'Ash can settle on olives this week (north wind).',
    ai: 'Wash the olives before delivery or order a lab test.',
  },
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
  /** This scan asked for a re-check. It is due until a newer scan of the same tree exists. */
  recheckDue?: boolean;
}

const day = (month: number, d: number, h = 9, m = 0) => Date.UTC(2026, month, d, h, m);

export const initialScans: Scan[] = [
  { id: 'sc1', fieldId: 'north', treeId: 23, mode: 'leaf', title: 'Peacock spot', latin: 'Spilocaea oleaginea · early stage', tone: 'high', pill: 'High risk', confidence: 92, date: '12 Oct', when: '12 Oct, 08:40', ts: day(9, 12, 8, 40), photo: 'leaf-spots', spots: 4 },
  { id: 'sc2', fieldId: 'north', treeId: 23, mode: 'leaf', title: 'Peacock spot', latin: 'Spilocaea oleaginea · early stage', tone: 'medium', pill: 'Medium risk', confidence: 90, date: 'Today', when: 'Today, 09:12', ts: day(9, 27, 9, 12), photo: 'leaf-spots', spots: 1 },
  { id: 'sc3', fieldId: 'north', treeId: 41, mode: 'leaf', title: 'Peacock spot', latin: 'Spilocaea oleaginea · early stage', tone: 'high', pill: 'High risk', confidence: 88, date: '2 Oct', when: '2 Oct, 10:05', ts: day(9, 2, 10, 5), photo: 'leaf-spots', spots: 3, recheckDue: true },
  { id: 'sc4', fieldId: 'north', treeId: 12, mode: 'leaf', title: 'Healthy leaf', tone: 'healthy', pill: 'Healthy', confidence: 94, date: '28 Sep', when: '28 Sep, 17:20', ts: day(8, 28, 17, 20), photo: 'leaf-healthy' },
  { id: 'sc5', fieldId: 'river', mode: 'trap', title: 'Fly trap', tone: 'medium', pill: 'Medium risk', confidence: 88, date: 'Today', when: 'Today, 07:50', ts: day(9, 27, 7, 50), photo: 'trap', flies: 14 },
  { id: 'sc6', fieldId: 'river', mode: 'fruit', title: 'Olive fly sting', latin: 'Bactrocera oleae', tone: 'watch', pill: 'Watch', confidence: 77, date: '20 Oct', when: '20 Oct, 12:15', ts: day(9, 20, 12, 15), photo: 'fruit' },
];
