/** In-app notifications built from the app state. Pure TS, no UI imports. Texts are English; the app translates them. */
import type { AppNotification } from '@/data/mock';
import { euroPrice } from './market';
import { harvestWindow } from './processor';

/** A harvest reminder is shown when the harvest starts within this many days. */
export const HARVEST_REMIND_DAYS = 3;

interface FieldLike {
  id: string;
  name: string;
  harvest: { ready: boolean; badge: string };
}

/** One reminder per field whose harvest starts today or within `HARVEST_REMIND_DAYS` days. Tapping it opens a new listing for that field. */
export function harvestReminders(fields: FieldLike[]): AppNotification[] {
  return fields.flatMap((f) => {
    const [start] = harvestWindow(f.harvest);
    if (start > HARVEST_REMIND_DAYS) return [];
    const now = start <= 0;
    return [
      {
        id: `harvest-${f.id}`,
        emoji: '🫒',
        title: now ? `${f.name} is ready to harvest` : `${f.name} is ready to harvest in ${start} days`,
        body: now ? 'Buyers are looking for olives now. Tap to sell them.' : 'Plan your pickers now. Tap to list the olives early.',
        when: 'now',
        href: `/farmer/market/new?fieldId=${f.id}`,
      },
    ];
  });
}

/**
 * Notifications that stay under the bell (This week) after their banner is gone.
 * A harvest reminder goes away once the field is listed; a "New offer" once that offer is no longer open.
 */
export function activeInbox(
  ids: string[],
  state: {
    fields: FieldLike[];
    listings: { fieldId: string }[];
    offers: { id: string; fieldId: string; factoryId: string; status: string; pricePerKg: number; tons?: number }[];
    factoryName: (id: string) => string;
  },
): AppNotification[] {
  // Built from the current state, so names and texts follow the language and the farmer's country.
  const reminders = harvestReminders(state.fields);
  return ids.flatMap((id) => {
    if (id.startsWith('harvest-')) {
      const n = reminders.find((r) => r.id === id);
      return n && !state.listings.some((l) => l.fieldId === id.slice('harvest-'.length)) ? [n] : [];
    }
    if (id.startsWith('offer-')) {
      const o = state.offers.find((x) => `offer-${x.id}` === id && x.status === 'open');
      const field = o && state.fields.find((f) => f.id === o.fieldId);
      return o && field ? [offerNotification(o, state.factoryName(o.factoryId), field.name)] : [];
    }
    return [];
  });
}

/** Adds the ids of banners that open a screen to the inbox, newest first, without duplicates. Plain reminders are already tasks. */
export function addToInbox(ids: string[], banners: AppNotification[]): string[] {
  const fresh = banners.filter((b) => b.href).map((b) => b.id);
  return [...fresh, ...ids.filter((id) => !fresh.includes(id))];
}

/** "New offer" banner for an offer a factory just made. Tapping it opens the Offers tab. */
export function offerNotification(offer: { id: string; pricePerKg: number; tons?: number }, factoryName: string, fieldName: string): AppNotification {
  return {
    id: `offer-${offer.id}`,
    emoji: '💶',
    title: `New offer: ${euroPrice(offer.pricePerKg)}/kg`,
    body: offer.tons ? `${factoryName} wants ${offer.tons} t from ${fieldName}. Tap to see it.` : `${factoryName} wants olives from ${fieldName}. Tap to see it.`,
    when: 'now',
    href: '/farmer/market/offers',
  };
}
