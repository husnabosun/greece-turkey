/** Default delay when an offer has no delivery timing yet. */
export const DEFAULT_DELIVERY_IN_DAYS = 2;

/** Soft daily mill capacity for overload hints on the week strip (tonnes). */
export const DAY_CAPACITY_TONS = 15;

export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T12:00:00`);
  dt.setDate(dt.getDate() + days);
  return todayIsoDate(dt);
}

export function deliveryInDaysFromIso(isoDate: string, from = todayIsoDate()): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${isoDate}T12:00:00`).getTime();
  const diff = Math.round((b - a) / 86_400_000);
  return Math.max(0, diff);
}

export function nextSevenDays(from = todayIsoDate()): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(from, i));
}

export function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m?.[1] ?? null;
}

/** Four rolling delivery windows starting from today (10 days each). */
export function nextDeliveryWindows(count = 4, daysPerWindow = 10, from = todayIsoDate()) {
  return Array.from({ length: count }, (_, i) => {
    const start = addDaysIso(from, i * daysPerWindow);
    const end = addDaysIso(start, daysPerWindow - 1);
    return { start, end, key: `w${i}` };
  });
}

export function formatWindowLabel(start: string, end: string, locale: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const a = new Date(`${start}T12:00:00`).toLocaleDateString(locale, opts);
  const b = new Date(`${end}T12:00:00`).toLocaleDateString(locale, opts);
  return `${a}–${b}`;
}

const EN_MONTH_TO: Record<"el" | "tr", Record<string, string>> = {
  el: {
    Jan: "Ιαν",
    Feb: "Φεβ",
    Mar: "Μαρ",
    Apr: "Απρ",
    May: "Μαΐ",
    Jun: "Ιουν",
    Jul: "Ιουλ",
    Aug: "Αυγ",
    Sep: "Σεπ",
    Oct: "Οκτ",
    Nov: "Νοε",
    Dec: "Δεκ",
  },
  tr: {
    Jan: "Oca",
    Feb: "Şub",
    Mar: "Mar",
    Apr: "Nis",
    May: "May",
    Jun: "Haz",
    Jul: "Tem",
    Aug: "Ağu",
    Sep: "Eyl",
    Oct: "Eki",
    Nov: "Kas",
    Dec: "Ara",
  },
};

/** Relocalize a stored window label like "15–25 Nov" into the UI locale. */
export function localizeStoredWindowLabel(label: string | null | undefined, locale: string): string {
  if (!label?.trim()) return "—";
  const lang = locale.startsWith("el") ? "el" : locale.startsWith("tr") ? "tr" : null;
  if (!lang) return label.trim();
  const map = EN_MONTH_TO[lang];
  return label.replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g,
    (m) => map[m] ?? m,
  );
}
