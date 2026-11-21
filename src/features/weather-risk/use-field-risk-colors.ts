"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldWeather } from "@/features/weather-risk/weather";
import type { FieldSignals } from "@/features/weather-risk/risk/types";
import { assessField, highestRisk, type RiskLevel } from "@/features/weather-risk/risk";
import { EMPTY_SIGNALS } from "@/features/weather-risk/risk/signals";
import { colors } from "@/shared/theme/tokens";

const LEVEL_COLOR: Record<RiskLevel, string> = {
  High: colors.risk,
  Medium: colors.warn,
  Low: colors.good,
};

type FieldPoint = { id: string; lat: number | null; lon: number | null };

/**
 * Chip/dot colours from each field's current top risk (High red / Medium amber / Low green).
 * `signalsFor` gives the scans, sprays and variety of a field (see `useFieldSignals`), the same as Home and Alerts use.
 */
export function useFieldRiskColors(
  fields: FieldPoint[],
  signalsFor: (fieldId: string) => FieldSignals = () => EMPTY_SIGNALS,
): Record<string, string> {
  const key = useMemo(
    () =>
      fields
        .map((f) => `${f.id}:${f.lat ?? ""}:${f.lon ?? ""}`)
        .sort()
        .join("|"),
    [fields],
  );
  /** Weather per field. `null` = the weather could not be loaded (the colour stays green). */
  const [weatherById, setWeatherById] = useState<Record<string, FieldWeather | null>>({});

  useEffect(() => {
    const points = fields.filter(
      (f): f is FieldPoint & { lat: number; lon: number } => f.lat != null && f.lon != null,
    );
    if (!points.length) {
      setWeatherById({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        points.map(async (f) => {
          try {
            const qs = new URLSearchParams({
              fieldId: f.id,
              lat: String(f.lat),
              lon: String(f.lon),
            });
            const res = await fetch(`/api/weather?${qs}`);
            const json = (await res.json()) as { ok: boolean; data?: FieldWeather };
            if (!json.ok || !json.data) return [f.id, null] as const;
            return [f.id, json.data] as const;
          } catch {
            return [f.id, null] as const;
          }
        }),
      );
      if (!cancelled) setWeatherById(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by stable field signature
  }, [key]);

  return useMemo(() => {
    const out: Record<string, string> = {};
    for (const [id, weather] of Object.entries(weatherById)) {
      if (!weather) {
        out[id] = colors.good;
        continue;
      }
      const top = highestRisk(assessField(weather, signalsFor(id), Date.now(), 1), 1);
      out[id] = LEVEL_COLOR[top?.level ?? "Low"];
    }
    return out;
  }, [weatherById, signalsFor]);
}
