import { create } from 'zustand';
import {
  factories,
  fields as seedFields,
  initialNotifications,
  initialScans,
  initialTrees,
  LOCATION_RISK_PENALTY,
  offers as seedOffers,
  sales as seedSales,
  sprays as seedSprays,
  tasks as seedTasks,
  tonsAvailable,
  type Field,
  type Offer,
  type Scan,
  type Sale,
  type Spray,
  type Task,
  type Tree,
} from '@/data/mock';
import { nextTimestamp } from '@/lib/scans';
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
  locationRiskDone: boolean;
  labTestOrdered: boolean;
  draft: OnboardingDraft;
  banners: typeof initialNotifications | null;
  notificationsSeen: boolean;
  toast: ToastMsg | null;

  selectField: (id: string | 'all') => void;
  selectTree: (id: number | null) => void;
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
}

let toastId = 0;

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
  locationRiskDone: false,
  labTestOrdered: false,
  draft: EMPTY_DRAFT,
  banners: null,
  notificationsSeen: false,
  toast: null,

  selectField: (id) => set({ selectedFieldId: id, selectedTreeId: null }),
  selectTree: (id) => set({ selectedTreeId: id }),

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
    const factory = factories.find((f) => f.id === offer.factoryId);
    set((s) => ({
      offers: s.offers.map((o) => (o.id === id ? { ...o, status: 'accepted' } : o)),
      sales: [
        {
          id: `a${Date.now()}`,
          fieldId: offer.fieldId,
          factoryId: offer.factoryId,
          tons: tonsAvailable,
          pricePerKg: offer.pricePerKg,
          status: 'inProgress',
          step: 0,
          note: 'agreed today',
        },
        ...s.sales,
      ],
    }));
    get().showToast(`Offer from ${factory?.name} accepted`);
  },

  joinGroup: (id) => {
    set((s) => ({ joinedGroups: s.joinedGroups.includes(id) ? s.joinedGroups : [...s.joinedGroups, id] }));
    get().showToast('You joined the group');
  },

  publishListing: (listing) => {
    set((s) => ({ listings: [{ ...listing, id: `l${Date.now()}` }, ...s.listings.filter((l) => l.fieldId !== listing.fieldId)] }));
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
}));

/** The field shown on single-field screens: the selected one, or the first when "All fields" is on. */
export function useActiveField(): Field {
  return useStore((s) => s.fields.find((f) => f.id === s.selectedFieldId) ?? s.fields[0]);
}
