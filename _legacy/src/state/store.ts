import { create } from 'zustand';
import {
  areas,
  deliveries as seedDeliveries,
  factories,
  farmer,
  fields as seedFields,
  incomingOffers as seedIncoming,
  initialNotifications,
  initialScans,
  initialTrees,
  LOCATION_RISK_PENALTY,
  lots as otherLots,
  offers as seedOffers,
  PROCESSOR_ID,
  procRequests as seedRequests,
  sales as seedSales,
  season,
  sprays as seedSprays,
  tasks as seedTasks,
  tonsAvailable,
  type Delivery,
  type Field,
  type IncomingOffer,
  type Offer,
  type ProcRequest,
  type Scan,
  type Sale,
  type SentOffer,
  type Spray,
  type Task,
  type Tree,
} from '@/data/mock';
import { formatDay } from '@/lib/dates';
import { AFTER_LAB, AFTER_WEIGHING, deliveryStepToSaleStep, lotHasBanned, PAID_STEP } from '@/lib/processor';
import type { Language } from '@/lib/ai/schemas';
import { createFeedback, upsertFeedback, type FeedbackAnswer, type FeedbackEntry } from '@/lib/feedback';
import type { Assessment } from '@/lib/risk';
import { buildSignals } from '@/lib/risk/signals';
import { seasonStage } from '@/lib/risk/season';
import { nextTimestamp } from '@/lib/scans';
import type { FieldWeather } from '@/lib/weather';
import { loadAllWeather, loadFeedback, loadLanguage, saveFeedback, saveLanguage } from './services';
import type { CropStage, RecordsKind, SprayCount } from '@/lib/onboarding';

export interface Listing {
  id: string;
  fieldId: string;
  tons: number;
  pricePerKg: number;
  period: string;
  negotiable: boolean;
  delivery: 'pickup' | 'deliver';
}

export interface ToastMsg {
  id: number;
  text: string;
}

export interface OnboardingDraft {
  name: string;
  trees: number;
  age: string;
  variety: string;
  irrigated: boolean;
  stage: CropStage;
  sprays: SprayCount;
  records: RecordsKind;
  proofs: string[];
}

const EMPTY_DRAFT: OnboardingDraft = {
  name: '',
  trees: 80,
  age: '20–50 years',
  variety: 'Ayvalık',
  irrigated: false,
  stage: 'harvested',
  sprays: '1-2',
  records: 'brecete',
  proofs: ['olives-photo', 'spray-receipt'],
};

const FIELD_COLORS = ['#2E6FB0', '#7B3FB5', '#2E8B8B', '#B5663F'];

/** A few healthy trees so the map of a new field is not empty. */
const NEW_FIELD_TREES = (start: number): Tree[] =>
  [[20, 25], [42, 22], [65, 30], [30, 50], [55, 55], [78, 52], [25, 75], [50, 78], [72, 74]].map(([x, y], i) => ({
    id: start + i,
    x,
    y,
    status: 'healthy' as const,
    lastPhoto: 'never',
    lastSpray: 'none',
  }));

interface AppState {
  fields: Field[];
  sprays: Spray[];
  tasks: Task[];
  offers: Offer[];
  sales: Sale[];
  trees: Record<string, Tree[]>;
  listings: Listing[];
  selectedTreeId: number | null;
  joinedGroups: string[];
  selectedFieldId: string | 'all';
  scans: Scan[];
  /** Scan that was just analysed and is not saved yet. */
  pendingScan: Scan | null;
  /** Photo taken or picked in the camera, waiting to be analysed. */
  captureUri: string | null;
  /** Id of the scan saved last; its field is shown first in the list. */
  lastSavedScanId: string | null;
  /** Dark status bar in the phone frame (camera screens). */
  darkChrome: boolean;
  /** Live, cached or demo weather per field. Missing until the first load finishes. */
  weather: Record<string, FieldWeather>;
  weatherLoading: boolean;
  /** "Was this right?" answers, kept as training data. */
  feedback: FeedbackEntry[];
  /** Language of the AI advisor text (the app itself stays in English). */
  language: Language;
  locationRiskDone: boolean;
  labTestOrdered: boolean;
  draft: OnboardingDraft;
  banners: typeof initialNotifications | null;
  notificationsSeen: boolean;
  toast: ToastMsg | null;

  // Processor panel (web). The same store, so both views stay in step.
  procRequests: ProcRequest[];
  /** Farmers' offers to the processor. */
  incomingOffers: IncomingOffer[];
  /** Processor offers for lots of other farmers (offers for the demo farmer's fields are in `offers`). */
  sentOffers: SentOffer[];
  deliveries: Delivery[];
  /** Live, cached or demo weather per region, for the supply outlook. Key: region name. */
  areaWeather: Record<string, FieldWeather>;

  selectField: (id: string | 'all') => void;
  selectTree: (id: number | null) => void;
  loadWeather: (opts?: { force?: boolean }) => Promise<void>;
  loadAreaWeather: (opts?: { force?: boolean }) => Promise<void>;
  answerFeedback: (a: { fieldId: string; assessment: Assessment; answer: FeedbackAnswer; reason?: string }) => void;
  hydrateFeedback: () => Promise<void>;
  setLanguage: (language: Language) => void;
  setPendingScan: (scan: Scan | null) => void;
  setCaptureUri: (uri: string | null) => void;
  saveScan: () => void;
  setDarkChrome: (v: boolean) => void;
  addSpray: (spray: Omit<Spray, 'id'>) => void;
  completeTask: (id: string, message?: string) => void;
  acceptOffer: (id: string) => void;
  joinGroup: (id: string) => void;
  publishListing: (listing: Omit<Listing, 'id'>) => void;
  markLocationRiskDone: () => void;
  orderLabTest: () => void;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  resetDraft: () => void;
  addField: (input: Omit<Field, 'id' | 'color'>) => string;
  showWelcomeBanners: () => void;
  hideBanners: () => void;
  showToast: (text: string) => void;
  hideToast: () => void;

  createRequest: (input: Omit<ProcRequest, 'id' | 'filledTons' | 'farmers' | 'shared'>) => void;
  makeOffer: (input: { lotId: string; tons: number; pricePerKg: number; deliveryIn: number }) => void;
  acceptIncomingOffer: (id: string) => void;
  recordWeighbridge: (deliveryId: string, kg: number) => void;
  /** Lab check passed, then paid. */
  advanceDelivery: (deliveryId: string) => void;
}

let toastId = 0;
let idSeq = 0;
/** Unique id, also for two actions in the same millisecond. */
const uid = (prefix: string) => `${prefix}${Date.now()}${++idSeq}`;
const todayWithYear = () => `${formatDay(0)} ${season}`;

export const useStore = create<AppState>((set, get) => ({
  fields: seedFields,
  sprays: seedSprays,
  tasks: seedTasks,
  offers: seedOffers,
  sales: seedSales,
  trees: initialTrees,
  selectedTreeId: null,
  listings: [],
  joinedGroups: [],
  selectedFieldId: 'all',
  scans: initialScans,
  pendingScan: null,
  captureUri: null,
  lastSavedScanId: null,
  darkChrome: false,
  weather: {},
  weatherLoading: false,
  feedback: [],
  language: 'en',
  locationRiskDone: false,
  labTestOrdered: false,
  draft: EMPTY_DRAFT,
  banners: null,
  notificationsSeen: false,
  toast: null,
  procRequests: seedRequests,
  incomingOffers: seedIncoming,
  sentOffers: [],
  deliveries: seedDeliveries,
  areaWeather: {},

  selectField: (id) => set({ selectedFieldId: id, selectedTreeId: null }),
  selectTree: (id) => set({ selectedTreeId: id }),

  loadWeather: async (opts) => {
    set({ weatherLoading: true });
    const fields = get().fields;
    const results = await loadAllWeather(fields, opts);
    set((s) => ({ weather: { ...s.weather, ...results }, weatherLoading: false }));
  },

  loadAreaWeather: async (opts) => {
    const results = await loadAllWeather(areas.map((a) => ({ id: `area:${a.region}`, lat: a.lat, lon: a.lon, wetness: a.wetness })), opts);
    set({ areaWeather: Object.fromEntries(areas.map((a) => [a.region, results[`area:${a.region}`]])) });
  },

  /** Saves a "Was this right?" answer with the prediction, the weather and the field signals. */
  answerFeedback: ({ fieldId, assessment, answer, reason }) => {
    const s = get();
    const field = s.fields.find((f) => f.id === fieldId);
    const w = s.weather[fieldId];
    if (!field || !w) return;
    const entry = createFeedback({
      fieldId,
      assessment,
      answer,
      reason,
      season: seasonStage(assessment.day),
      weatherSource: w.source,
      weather: w.days,
      signals: buildSignals(field, s.scans, s.sprays, s.locationRiskDone),
    });
    const next = upsertFeedback(s.feedback, entry);
    set({ feedback: next });
    void saveFeedback(next);
  },

  setLanguage: (language) => {
    set({ language });
    void saveLanguage(language);
  },

  hydrateFeedback: async () => {
    const language = await loadLanguage();
    if (language) set({ language });
    const stored = await loadFeedback();
    if (stored.length) set((s) => ({ feedback: [...stored.filter((e) => !s.feedback.some((x) => x.id === e.id)), ...s.feedback] }));
  },

  setPendingScan: (scan) => set({ pendingScan: scan }),
  setCaptureUri: (uri) => set({ captureUri: uri }),
  setDarkChrome: (v) => set({ darkChrome: v }),

  /** Saves the pending scan, updates its tree, and finishes a matching re-check or trap task. */
  saveScan: () => {
    const pending = get().pendingScan;
    if (!pending) return;
    const scan: Scan = { ...pending, ts: nextTimestamp(get().scans) };
    set((s) => ({
      scans: [scan, ...s.scans],
      pendingScan: null,
      lastSavedScanId: scan.id,
      trees: scan.treeId
        ? { ...s.trees, [scan.fieldId]: (s.trees[scan.fieldId] ?? []).map((t) => (t.id === scan.treeId ? { ...t, lastPhoto: 'today' } : t)) }
        : s.trees,
    }));
    const task = get().tasks.find(
      (t) =>
        !t.done &&
        t.fieldId === scan.fieldId &&
        ((t.kind === 'recheck' && t.treeId === scan.treeId) || (t.kind === 'photo' && scan.mode === 'trap')),
    );
    if (task) get().completeTask(task.id, 'Scan saved. Task done, score +1');
    else get().showToast('Scan saved');
  },

  addSpray: (spray) => {
    set((s) => ({ sprays: [{ ...spray, id: `s${Date.now()}` }, ...s.sprays] }));
    get().showToast('Spray saved to your logbook');
  },

  /** Marks a task done and adds +1 to that field's quality score. */
  completeTask: (id, message) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || task.done) return;
    const field = get().fields.find((f) => f.id === task.fieldId);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: true } : t)),
      fields: s.fields.map((f) => (f.id === task.fieldId ? { ...f, score: Math.min(100, f.score + 1) } : f)),
    }));
    get().showToast(message ?? `Done. ${field?.name ?? 'Field'} score +1`);
  },

  acceptOffer: (id) => {
    const offer = get().offers.find((o) => o.id === id);
    if (!offer) return;
    if (offer.status === 'accepted') return;
    const factory = factories.find((f) => f.id === offer.factoryId);
    const tons = offer.tons ?? tonsAvailable;
    const saleId = uid('a');
    const field = get().fields.find((f) => f.id === offer.fieldId);
    set((s) => ({
      offers: s.offers.map((o) => (o.id === id ? { ...o, status: 'accepted' } : o)),
      sales: [
        {
          id: saleId,
          fieldId: offer.fieldId,
          factoryId: offer.factoryId,
          tons,
          pricePerKg: offer.pricePerKg,
          status: 'inProgress',
          step: 0,
          note: 'agreed today',
        },
        ...s.sales,
      ],
      // An offer of the processor panel becomes a delivery there.
      deliveries:
        offer.factoryId === PROCESSOR_ID
          ? [
              {
                id: uid('d'),
                saleId,
                lotId: offer.fieldId,
                farmerName: farmer.name,
                place: farmer.place,
                variety: field?.variety ?? '',
                tons,
                pricePerKg: offer.pricePerKg,
                scheduledIn: offer.deliveryIn ?? 5,
                step: 0,
                score: field?.score,
                bannedFree: !s.sprays.some((sp) => sp.fieldId === offer.fieldId && sp.banned),
              },
              ...s.deliveries,
            ]
          : s.deliveries,
    }));
    get().showToast(`Offer from ${factory?.name} accepted`);
  },

  joinGroup: (id) => {
    set((s) => ({ joinedGroups: s.joinedGroups.includes(id) ? s.joinedGroups : [...s.joinedGroups, id] }));
    get().showToast('You joined the group');
  },

  publishListing: (listing) => {
    set((s) => ({
      listings: [{ ...listing, id: uid('l') }, ...s.listings.filter((l) => l.fieldId !== listing.fieldId)],
      // The processor panel sees the listing as an incoming offer (a newer listing replaces the older open one).
      incomingOffers: [
        { id: uid('io'), lotId: listing.fieldId, tons: listing.tons, pricePerKg: listing.pricePerKg, status: 'open' },
        ...s.incomingOffers.filter((o) => !(o.lotId === listing.fieldId && o.status === 'open')),
      ],
    }));
    get().showToast('Listing published');
  },

  markLocationRiskDone: () => {
    set({ locationRiskDone: true });
    get().showToast(`Done. Hill keeps its score (no -${LOCATION_RISK_PENALTY})`);
  },

  orderLabTest: () => {
    set({ labTestOrdered: true });
    get().showToast('Lab test ordered for Hill');
  },

  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  resetDraft: () => set({ draft: EMPTY_DRAFT }),

  addField: (input) => {
    const id = `f${Date.now()}`;
    const color = FIELD_COLORS[(get().fields.length - 3) % FIELD_COLORS.length] ?? FIELD_COLORS[0];
    set((s) => ({
      fields: [...s.fields, { ...input, id, color }],
      trees: { ...s.trees, [id]: NEW_FIELD_TREES(1000 + s.fields.length * 10) },
      selectedFieldId: id,
      selectedTreeId: null,
    }));
    return id;
  },

  showWelcomeBanners: () => {
    if (get().notificationsSeen) return;
    set({ notificationsSeen: true, banners: initialNotifications });
  },
  hideBanners: () => set({ banners: null }),

  showToast: (text) => set({ toast: { id: ++toastId, text } }),
  hideToast: () => set({ toast: null }),

  createRequest: (input) => {
    set((s) => ({ procRequests: [{ ...input, id: uid('r'), filledTons: 0, farmers: 0, shared: true }, ...s.procRequests] }));
    get().showToast('Request created. Farmers can see it');
  },

  /** An offer for the demo farmer's field goes to the farmer's Market > Offers; others are only kept here. */
  makeOffer: ({ lotId, tons, pricePerKg, deliveryIn }) => {
    const forDemoFarmer = get().fields.some((f) => f.id === lotId);
    if (forDemoFarmer) {
      set((s) => ({
        offers: [
          { id: uid('o'), fieldId: lotId, factoryId: PROCESSOR_ID, pricePerKg, status: 'open', tons, deliveryIn },
          ...s.offers.filter((o) => !(o.factoryId === PROCESSOR_ID && o.fieldId === lotId && o.status === 'open')),
        ],
      }));
    } else {
      set((s) => ({ sentOffers: [{ id: uid('so'), lotId, tons, pricePerKg, deliveryIn }, ...s.sentOffers.filter((o) => o.lotId !== lotId)] }));
    }
    get().showToast('Offer sent to the farmer');
  },

  /** Accepting a farmer's offer unlocks the farmer's name and starts a delivery. A listing of the demo farmer also becomes a sale in the farmer app. */
  acceptIncomingOffer: (id) => {
    const s = get();
    const offer = s.incomingOffers.find((o) => o.id === id);
    if (!offer || offer.status !== 'open') return;
    const field = s.fields.find((f) => f.id === offer.lotId);
    const lot = field ? undefined : otherLots.find((l) => l.id === offer.lotId);
    if (!field && !lot) return;
    const farmerName = field ? farmer.name : lot!.farmerName;
    const saleId = field ? uid('a') : undefined;
    set((st) => ({
      incomingOffers: st.incomingOffers.map((o) => (o.id === id ? { ...o, status: 'accepted' } : o)),
      sales: field
        ? [{ id: saleId!, fieldId: field.id, factoryId: PROCESSOR_ID, tons: offer.tons, pricePerKg: offer.pricePerKg, status: 'inProgress', step: 0, note: 'agreed today' }, ...st.sales]
        : st.sales,
      deliveries: [
        {
          id: uid('d'),
          saleId,
          lotId: offer.lotId,
          farmerName,
          place: field ? farmer.place : `${lot!.town}, ${lot!.region}`,
          variety: field?.variety ?? lot!.variety,
          tons: offer.tons,
          pricePerKg: offer.pricePerKg,
          scheduledIn: 5,
          step: 0,
          score: field?.score ?? lot!.score,
          bannedFree: field ? !st.sprays.some((sp) => sp.fieldId === field.id && sp.banned) : !lotHasBanned(lot!),
        },
        ...st.deliveries,
      ],
    }));
    get().showToast(`Offer accepted. ${farmerName} is now visible`);
  },

  recordWeighbridge: (deliveryId, kg) => {
    const d = get().deliveries.find((x) => x.id === deliveryId);
    if (!d || d.step >= AFTER_WEIGHING || !(kg > 0)) return;
    set((s) => ({
      deliveries: s.deliveries.map((x) => (x.id === deliveryId ? { ...x, actualKg: kg, step: AFTER_WEIGHING } : x)),
      sales: d.saleId
        ? s.sales.map((x) => (x.id === d.saleId ? { ...x, tons: kg / 1000, actualKg: kg, step: deliveryStepToSaleStep(AFTER_WEIGHING), note: 'weighed' } : x))
        : s.sales,
    }));
    get().showToast(`Weighbridge recorded: ${kg.toLocaleString('en-US')} kg`);
  },

  advanceDelivery: (deliveryId) => {
    const d = get().deliveries.find((x) => x.id === deliveryId);
    if (!d || d.step < AFTER_WEIGHING || d.step >= PAID_STEP) return;
    if (d.step === AFTER_WEIGHING) {
      set((s) => ({
        deliveries: s.deliveries.map((x) => (x.id === deliveryId ? { ...x, step: AFTER_LAB, labResult: 'passed' } : x)),
        sales: d.saleId ? s.sales.map((x) => (x.id === d.saleId ? { ...x, step: deliveryStepToSaleStep(AFTER_LAB), labResult: 'passed', note: 'lab check passed' } : x)) : s.sales,
      }));
      get().showToast('Lab check passed');
      return;
    }
    const paidDate = todayWithYear();
    set((s) => ({
      deliveries: s.deliveries.map((x) => (x.id === deliveryId ? { ...x, step: PAID_STEP, paidDate, paidAgo: 0 } : x)),
      sales: d.saleId ? s.sales.map((x) => (x.id === d.saleId ? { ...x, status: 'paid', step: deliveryStepToSaleStep(PAID_STEP), paidDate, note: '' } : x)) : s.sales,
    }));
    get().showToast('Marked as paid');
  },
}));

/** The field shown on single-field screens: the selected one, or the first when "All fields" is on. */
export function useActiveField(): Field {
  return useStore((s) => s.fields.find((f) => f.id === s.selectedFieldId) ?? s.fields[0]);
}
