/** Glue between the app and the AI server (/api): prepares photos, calls the endpoints, and falls back to the demo when anything fails. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';
import { adviceKey, buildAdviceRequest, fallbackAdvice } from '@/lib/ai/mappers';
import {
  adviceResult,
  fruitResult,
  labelResult,
  trapResult,
  MAX_IMAGE_BASE64,
  type AdviceResult,
  type AdviseRequest,
  type AiSource,
  type FruitResult,
  type LabelResult,
  type TrapResult,
} from '@/lib/ai/schemas';
import { useRisk } from './risk';
import { useStore } from './store';

/**
 * Where /api lives. On the web, the same site (empty string). In local development or on a phone, set
 * EXPO_PUBLIC_API_URL to the address of `vercel dev` or of your Vercel site. It is a public address, never a key.
 */
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const CLIENT_TIMEOUT_MS = 20_000;
const MAX_SIDE = 1024;

let deviceId: string | null = null;

/** A random id per install, only used for the rate limit. */
async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  try {
    const stored = await AsyncStorage.getItem('agropulse.device');
    if (stored) return (deviceId = stored);
  } catch {
    // Storage is optional.
  }
  deviceId = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  try {
    await AsyncStorage.setItem('agropulse.device', deviceId);
  } catch {
    // Storage is optional.
  }
  return deviceId;
}

/** Resizes a photo to at most 1024 px on the long side and 1 MB. Returns base64 (no prefix), or null when that is not possible. */
export async function prepareImage(uri: string): Promise<string | null> {
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    const scaled =
      Math.max(original.width, original.height) > MAX_SIDE
        ? await ImageManipulator.manipulate(original).resize(original.width >= original.height ? { width: MAX_SIDE } : { height: MAX_SIDE }).renderAsync()
        : original;
    for (const compress of [0.7, 0.5, 0.35]) {
      const out = await scaled.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
      if (out.base64 && out.base64.length <= MAX_IMAGE_BASE64) return out.base64;
    }
    return null;
  } catch {
    return null;
  }
}

/** POST to our server. Returns the checked answer, or null on any problem (offline, no key, timeout, bad answer). */
async function post<S extends z.ZodType>(path: string, body: unknown, schema: S): Promise<z.infer<S> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': await getDeviceId() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json()) as { ok?: boolean };
    if (!json.ok) return null;
    const parsed = schema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function readLabelAi(uri: string): Promise<LabelResult | null> {
  const imageBase64 = await prepareImage(uri);
  return imageBase64 ? post('read-label', { imageBase64 }, labelResult) : null;
}

export async function diagnoseFruitAi(uri: string): Promise<FruitResult | null> {
  const imageBase64 = await prepareImage(uri);
  return imageBase64 ? post('diagnose-fruit-trap', { imageBase64, mode: 'fruit' }, fruitResult) : null;
}

export async function diagnoseTrapAi(uri: string): Promise<TrapResult | null> {
  const imageBase64 = await prepareImage(uri);
  return imageBase64 ? post('diagnose-fruit-trap', { imageBase64, mode: 'trap' }, trapResult) : null;
}

export const adviseAi = (req: AdviseRequest) => post('advise', req, adviceResult);

/** Takes a photo with the camera, or picks one from the gallery when the camera is not available. */
export async function takeOrPickPhoto(): Promise<string | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.granted) {
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      return res.canceled ? null : res.assets[0].uri;
    }
  } catch {
    // Fall through to the gallery.
  }
  try {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    return res.canceled ? null : res.assets[0].uri;
  } catch {
    return null;
  }
}

export interface Advice extends AdviceResult {
  source: AiSource;
}

const adviceCache = new Map<string, Advice>();

/**
 * The advisor text of one field in the selected language, explaining what our risk engine found.
 * While it loads, or when the AI is not available, the engine's own English text is shown as a demo result.
 */
export function useAdvice(fieldId: string): { advice: Advice | null; loading: boolean } {
  const field = useStore((s) => s.fields.find((f) => f.id === fieldId));
  const scans = useStore((s) => s.scans);
  const sprays = useStore((s) => s.sprays);
  const language = useStore((s) => s.language);
  const view = useRisk()[fieldId];
  const weatherStatus = view?.status;

  const request = useMemo(() => {
    if (!field || !view || weatherStatus === 'loading') return null;
    // `now` is rounded to the hour so the cache key stays stable while the farmer browses.
    const now = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    return buildAdviceRequest({ language, field, risk: view.risk, weather: view.weather, scans, sprays, now });
  }, [field, view, weatherStatus, language, scans, sprays]);

  const key = request ? adviceKey(request) : null;
  const [state, setState] = useState<{ key: string; advice: Advice } | null>(null);

  useEffect(() => {
    if (!request || !key) return;
    const hit = adviceCache.get(key);
    if (hit) {
      setState({ key, advice: hit });
      return;
    }
    let live = true;
    void adviseAi(request).then((res) => {
      if (!res) return;
      const advice: Advice = { summary: res.summary, actions: res.actions, whyNow: res.whyNow, source: 'gemini' };
      adviceCache.set(key, advice);
      if (live) setState({ key, advice });
    });
    return () => {
      live = false;
    };
  }, [request, key]);

  const fallback = useMemo<Advice | null>(() => (field && view ? { ...fallbackAdvice(view.risk, field.name), source: 'demo' } : null), [field, view]);
  const ready = state && state.key === key ? state.advice : null;
  return { advice: ready ?? fallback, loading: !ready && !!request };
}
