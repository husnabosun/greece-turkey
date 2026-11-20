/** Parse buy-request window labels and hide expired ones (B4 / C1). */

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  ιαν: 0,
  feb: 1,
  february: 1,
  φεβ: 1,
  mar: 2,
  march: 2,
  μαρ: 2,
  apr: 3,
  april: 3,
  απρ: 3,
  may: 4,
  μαϊ: 4,
  μαΐ: 4,
  jun: 5,
  june: 5,
  ιουν: 5,
  jul: 6,
  july: 6,
  ιουλ: 6,
  aug: 7,
  august: 7,
  αυγ: 7,
  sep: 8,
  sept: 8,
  september: 8,
  σεπ: 8,
  oct: 9,
  october: 9,
  οκτ: 9,
  nov: 10,
  november: 10,
  νοε: 10,
  dec: 11,
  december: 11,
  δεκ: 11,
  ara: 11,
  kas: 10,
  eki: 9,
  eyl: 8,
};

function monthIndex(token: string): number | null {
  const key = token
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\./g, "");
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (key.startsWith(name)) return idx;
  }
  return null;
}

/** Best-effort end date from labels like "15–25 Nov", "25 Kas–5 Ara", "2026-11-25". */
export function requestWindowEnd(label: string | null | undefined, now = new Date()): Date | null {
  if (!label?.trim()) return null;
  const raw = label.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T23:59:59`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const rangeIso = /(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (rangeIso?.[2]) {
    const d = new Date(`${rangeIso[2]}T23:59:59`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parts = raw.split(/[–—\-]/).map((p) => p.trim()).filter(Boolean);
  const endPart = parts[parts.length - 1] ?? raw;
  const m = /(\d{1,2})\s*([A-Za-zΑ-Ωα-ωΆ-Ώά-ώİıŞşĞğÜüÖöÇç.]+)/u.exec(endPart);
  if (!m) return null;
  const day = Number(m[1]);
  const month = monthIndex(m[2] ?? "");
  if (!Number.isFinite(day) || month == null) return null;

  const year = now.getFullYear();
  // If end month is far behind current month, assume next year window already passed → keep year.
  const candidate = new Date(year, month, day, 23, 59, 59);
  if (month < now.getMonth() - 1 && candidate.getTime() < now.getTime() - 40 * 86_400_000) {
    // already clearly in the past this year
  }
  return candidate;
}

export function isRequestWindowExpired(label: string | null | undefined, now = new Date()): boolean {
  const end = requestWindowEnd(label, now);
  if (!end) return false;
  return end.getTime() < now.getTime();
}

/** Locale-friendly short window for UI. */
export function formatRequestWindow(label: string | null | undefined, locale: string): string | null {
  if (!label?.trim()) return null;
  const end = requestWindowEnd(label);
  if (!end) return label.trim();
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(end);
  } catch {
    return label.trim();
  }
}
