"use client";

import { useEffect, useState } from "react";
import type { FieldWeather } from "@/features/weather-risk/weather";
import { assessField, highestRisk, type FieldRisk } from "@/features/weather-risk/risk";
import { EMPTY_SIGNALS } from "@/features/weather-risk/risk/signals";

type State = {
  weather: FieldWeather | null;
  risk: FieldRisk | null;
  loading: boolean;
  error: string | null;
};

const DEFAULT_POINT = { fieldId: "preview", lat: 39.325, lon: 26.7 };

/** Loads live Open-Meteo weather and runs the agronomic risk engine in the browser. */
export function useFieldWeather(point = DEFAULT_POINT) {
  const [state, setState] = useState<State>({ weather: null, risk: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
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
  }, [point.fieldId, point.lat, point.lon]);

  const top = state.risk ? highestRisk(state.risk, 3) : null;
  return { ...state, top };
}
