"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldWeather } from "@/features/weather-risk/weather";
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
 * Chip/dot colours from each field's current top risk (demo: High red / Medium amber / Low green).
 */
export function useFieldRiskColors(fields: FieldPoint[]): Record<string, string> {
  const key = useMemo(
    () =>
      fields
        .map((f) => `${f.id}:${f.lat ?? ""}:${f.lon ?? ""}`)
        .sort()
        .join("|"),
    [fields],
  );
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const points = fields.filter(
      (f): f is FieldPoint & { lat: number; lon: number } => f.lat != null && f.lon != null,
    );
    if (!points.length) {
      setMap({});
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
            if (!json.ok || !json.data) return [f.id, colors.good] as const;
            const risk = assessField(json.data, EMPTY_SIGNALS, Date.now(), 1);
            const top = highestRisk(risk, 1);
            return [f.id, LEVEL_COLOR[top?.level ?? "Low"]] as const;
          } catch {
            return [f.id, colors.good] as const;
          }
        }),
      );
      if (!cancelled) setMap(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by stable field signature
  }, [key]);

  return map;
}
