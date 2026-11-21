"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldWeather } from "@/features/weather-risk/weather";
import { assessField, highestRisk } from "@/features/weather-risk/risk";
import { EMPTY_SIGNALS } from "@/features/weather-risk/risk/signals";
import type { FieldSignals } from "@/features/weather-risk/risk/types";

export type WeatherPoint = {
  fieldId: string;
  lat: number;
  lon: number;
};

type State = {
  weather: FieldWeather | null;
  loading: boolean;
  error: string | null;
};

/**
 * Loads live Open-Meteo weather for a real field point. Pass `null` when the farmer has no field yet.
 * `signals` (scans, sprays, variety of the field, see `useFieldSignals`) are added to the weather: when they change,
 * the risk is recalculated without loading the weather again.
 */
export function useFieldWeather(point: WeatherPoint | null, signals: FieldSignals = EMPTY_SIGNALS) {
  const [state, setState] = useState<State>({
    weather: null,
    loading: Boolean(point),
    error: null,
  });

  useEffect(() => {
    if (!point) {
      setState({ weather: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const qs = new URLSearchParams({
          fieldId: point.fieldId,
          lat: String(point.lat),
          lon: String(point.lon),
        });
        const res = await fetch(`/api/weather?${qs}`);
        const json = (await res.json()) as { ok: boolean; data?: FieldWeather; error?: string };
        if (!json.ok || !json.data) throw new Error(json.error ?? "Weather failed");
        if (cancelled) return;
        setState({ weather: json.data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            weather: null,
            loading: false,
            error: err instanceof Error ? err.message : "Weather failed",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [point]);

  const risk = useMemo(
    () => (state.weather ? assessField(state.weather, signals, Date.now(), 3) : null),
    [state.weather, signals],
  );
  const top = risk ? highestRisk(risk, 3) : null;
  return { ...state, risk, top };
}
