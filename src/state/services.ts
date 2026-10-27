/** Glue between the pure libs and the device: AsyncStorage for the weather cache and the feedback answers. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Field } from '@/data/mock';
import type { FeedbackEntry } from '@/lib/feedback';
import { getFieldWeather, type FieldWeather, type WeatherStorage } from '@/lib/weather';

const storage: WeatherStorage = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
};

const memory = new Map<string, FieldWeather>();

/** One weather call per field, in parallel. Each result says if it is live, cached or demo. */
export async function loadAllWeather(fields: Field[], opts: { force?: boolean } = {}): Promise<Record<string, FieldWeather>> {
  const entries = await Promise.all(
    fields.map(async (f) => [f.id, await getFieldWeather({ id: f.id, lat: f.lat, lon: f.lon }, { storage, memory }, opts)] as const),
  );
  return Object.fromEntries(entries);
}

const FEEDBACK_KEY = 'agropulse.feedback';

export async function loadFeedback(): Promise<FeedbackEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_KEY);
    return raw ? (JSON.parse(raw) as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveFeedback(entries: FeedbackEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries));
  } catch {
    // Storage is optional: the answers stay in memory.
  }
}
