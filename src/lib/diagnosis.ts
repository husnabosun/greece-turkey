/** Mock diagnosis by scan mode. Pure TS: the real model call replaces `diagnose` later. */
import type { Scan, ScanMode } from '@/data/mock';

export interface Action {
  title: string;
  hint: string;
}

export type Diagnosis = Pick<Scan, 'title' | 'latin' | 'tone' | 'pill' | 'confidence' | 'photo' | 'spots' | 'flies' | 'source' | 'detail'>;

export const PEACOCK_ACTIONS: Action[] = [
  { title: 'Prune for airflow', hint: 'Improve air circulation' },
  { title: 'Remove fallen leaves', hint: 'Reduce infection sources' },
  { title: 'Re-check in 7 days', hint: 'Monitor spread' },
];

const FRUIT_ACTIONS: Action[] = [
  { title: 'Hang a yellow trap', hint: 'Catch adult flies' },
  { title: 'Collect fallen fruit', hint: 'Remove the larvae' },
  { title: 'Re-check in 5 days', hint: 'Look for new stings' },
];

const TRAP_ACTIONS: Action[] = [
  { title: 'Check the trap', hint: 'Every 2 days' },
  { title: 'Replace the card', hint: 'When it is full' },
  { title: 'Send a photo', hint: 'Again next week' },
];

const RETAKE_ACTIONS: Action[] = [
  { title: 'Take a new photo', hint: 'In daylight' },
  { title: 'Move closer', hint: 'One olive or leaf' },
  { title: 'Ask for help', hint: 'If still unsure' },
];

const HEALTHY_ACTIONS: Action[] = [
  { title: 'Keep checking', hint: 'Once a week' },
  { title: 'Scan after rain', hint: 'Wet leaves get spots' },
  { title: 'Keep your records', hint: 'Buyers see them' },
];

/**
 * Mock result for a photo. For a re-check, `previousSpots` makes the new leaf look better,
 * so the before/after card shows "Improving".
 */
export function diagnose(mode: ScanMode, opts: { previousSpots?: number } = {}): Diagnosis {
  if (mode === 'fruit') {
    return { title: 'Olive fly sting', latin: 'Bactrocera oleae', tone: 'watch', pill: 'Watch', confidence: 81, photo: 'fruit', source: 'demo' };
  }
  if (mode === 'trap') {
    return { title: 'Fly trap', tone: 'medium', pill: 'Medium risk', confidence: 88, photo: 'trap', flies: 12, source: 'demo' };
  }
  const spots = opts.previousSpots ? Math.max(1, opts.previousSpots - 2) : 3;
  return {
    title: 'Peacock spot',
    latin: 'Spilocaea oleaginea · early stage',
    tone: spots >= 3 ? 'high' : 'medium',
    pill: spots >= 3 ? 'High risk' : 'Medium risk',
    confidence: 92,
    photo: 'leaf-spots',
    spots,
    source: 'demo',
  };
}

export function confidencePhrase(confidence: number): string {
  if (confidence >= 90) return 'very sure';
  if (confidence >= 75) return 'fairly sure';
  return 'not sure';
}

/** Name shown in lists, e.g. "Tree #41 · Peacock spot" or "Fly trap · 14 flies". */
export function scanTitle(scan: Pick<Scan, 'mode' | 'title' | 'treeId' | 'flies'>): string {
  if (scan.mode === 'trap') return `Fly trap · ${scan.flies ?? 0} flies`;
  if (scan.mode === 'fruit') return `Fruit · ${scan.title.toLowerCase()}`;
  return scan.treeId ? `Tree #${scan.treeId} · ${scan.title}` : scan.title;
}

export function explain(scan: Pick<Scan, 'mode' | 'tone' | 'title' | 'confidence' | 'flies' | 'detail'>): { headline: string; detail: string } {
  const sure = confidencePhrase(scan.confidence);
  const unclear = scan.title === 'Not clear';
  if (scan.mode === 'trap') {
    if (scan.confidence < 40) {
      return { headline: `We are not sure about the count (${scan.flies ?? 0} flies).`, detail: scan.detail ?? 'Lay the trap flat in daylight and take the photo again.' };
    }
    return {
      headline: `We counted ${scan.flies ?? 0} flies on the trap.`,
      detail: scan.detail ?? 'The number of flies shows how strong the attack is. Check the trap again in 2 days.',
    };
  }
  if (scan.mode === 'fruit') {
    if (unclear) return { headline: 'We cannot tell from this photo.', detail: scan.detail ?? 'Take a new photo of one olive, close up and in daylight.' };
    if (scan.tone === 'healthy') return { headline: `We are ${sure} this olive is healthy.`, detail: scan.detail ?? 'We found no marks on the fruit.' };
    if (scan.title === 'Other damage') return { headline: `We see damage, but ${sure === 'not sure' ? 'we are not sure' : 'it is not olive fly'}.`, detail: scan.detail ?? 'Check the fruit again in a few days.' };
    return {
      headline: `We are ${sure} this is an olive fly sting.`,
      detail: scan.detail ?? 'The olive fly lays its egg under the skin of the fruit. Look for a small dark dot.',
    };
  }
  if (scan.tone === 'healthy') {
    return { headline: `We are ${sure} this leaf is healthy.`, detail: 'We found no spots or damage on the leaf.' };
  }
  return {
    headline: `We are ${sure} this is peacock spot.`,
    detail: 'The round spots on the leaves match the typical signs of peacock spot at an early stage.',
  };
}

export function actionsFor(scan: Pick<Scan, 'mode' | 'tone' | 'title' | 'confidence'>): Action[] {
  if (scan.title === 'Not clear' || (scan.mode === 'trap' && scan.confidence < 40)) return RETAKE_ACTIONS;
  if (scan.mode === 'trap') return TRAP_ACTIONS;
  if (scan.mode === 'fruit') return scan.tone === 'healthy' ? HEALTHY_ACTIONS : FRUIT_ACTIONS;
  return scan.tone === 'healthy' ? HEALTHY_ACTIONS : PEACOCK_ACTIONS;
}

export const MODE_LABEL: Record<ScanMode, string> = { leaf: 'Leaf', fruit: 'Fruit', trap: 'Trap', label: 'Label' };
export const PHOTO_LABEL: Record<ScanMode, string> = { leaf: 'Leaf photo', fruit: 'Fruit photo', trap: 'Trap photo', label: 'Label photo' };
export const HINT: Record<ScanMode, string> = {
  leaf: 'Place one leaf inside the frame',
  fruit: 'Place one olive inside the frame',
  trap: 'Lay the sticky trap flat inside the frame',
  label: 'Place the product label inside the frame',
};
