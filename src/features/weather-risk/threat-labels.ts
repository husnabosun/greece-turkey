import type { ThreatId } from "@/features/weather-risk/risk/types";

/** i18n keys under `riskThreats.*` for every engine threat id. */
export const THREAT_MESSAGE_KEY: Record<ThreatId, string> = {
  "peacock-spot": "peacockSpot",
  "olive-fly": "oliveFly",
  "olive-moth": "oliveMoth",
  anthracnose: "anthracnose",
  "olive-knot": "oliveKnot",
  frost: "frost",
  heat: "heat",
  wind: "wind",
  drought: "drought",
  location: "location",
};

export type ThreatTranslator = {
  (key: string): string;
  has: (key: string) => boolean;
};

export function threatLabel(threat: ThreatId | string, t: ThreatTranslator): string {
  const key = THREAT_MESSAGE_KEY[threat as ThreatId];
  if (key && t.has(key)) return t(key);
  return threat.replaceAll("-", " ");
}

export function threatTip(threat: ThreatId | string, t: ThreatTranslator): string {
  const key = THREAT_MESSAGE_KEY[threat as ThreatId];
  const tipKey = key ? `tip.${key}` : "";
  if (tipKey && t.has(tipKey)) return t(tipKey);
  return "";
}

export function riskLevelLabel(
  level: string,
  t: { (key: string): string; has: (key: string) => boolean },
): string {
  if (level === "High" && t.has("levelHigh")) return t("levelHigh");
  if (level === "Medium" && t.has("levelMedium")) return t("levelMedium");
  if (level === "Low" && t.has("levelLow")) return t("levelLow");
  return level;
}
