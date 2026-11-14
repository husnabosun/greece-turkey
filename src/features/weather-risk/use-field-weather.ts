"use client";

import { useEffect, useState } from "react";
import type { FieldWeather } from "@/features/weather-risk/weather";
import { assessField, highestRisk, type FieldRisk } from "@/features/weather-risk/risk";
import { EMPTY_SIGNALS } from "@/features/weather-risk/risk/signals";

export type WeatherPoint = {
  fieldId: string;
  lat: number;
  lon: number;
};

type State = {
  weather: FieldWeather | null;
  risk: FieldRisk | null;
  loading: boolean;
  error: string | null;
};

/** Loads live Open-Meteo weather for a real field point. Pass `null` when the farmer has no field yet. */
export function useFieldWeather(point: WeatherPoint | null) {
  const [state, setState] = useState<State>({
    weather: null,
    risk: null,
    loading: Boolean(point),
    error: null,
  });

  useEffect(() => {
    if (!point) {
      setState({ weather: null, risk: null, loading: false, error: null });
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
        const risk = assessField(json.data, EMPTY_SIGNALS, Date.now(), 3);
        setState({ weather: json.data, risk, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            weather: null,
            risk: null,
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

  const top = state.risk ? highestRisk(state.risk, 3) : null;
  return { ...state, top };
}
