/** Official olive-oil geographical indications for the listing picker.
 *  `source: "eu"` = registered in the EU eAmbrosia register (PDO/PGI).
 *  `source: "tr-national"` = registered with the Turkish Patent and Trademark Office.
 *  Only names we are confident are registered olive-oil GIs are included.
 *  Stored value is `slug`, compatible with lots.pdo_pgi (text).
 */

export type GiCountry = "GR" | "TR";
export type GiKind = "PDO" | "PGI";
export type GiSource = "eu" | "tr-national";

export type OilPdoPgi = {
  slug: string;
  country: GiCountry;
  kind: GiKind;
  source: GiSource;
  names: { el: string; en: string; tr: string };
};

export const OIL_PDO_PGI: readonly OilPdoPgi[] = [
  // Greece — EU PDO
  gi("sitia-lasithiou-kritis", "GR", "PDO", "eu", "Σητεία Λασιθίου Κρήτης", "Sitia Lasithiou Kritis", "Sitia Lasithiou Kritis"),
  gi("kolymvari-chanion-kritis", "GR", "PDO", "eu", "Κολυμβάρι Χανίων Κρήτης", "Kolymvari Chanion Kritis", "Kolymvari Chanion Kritis"),
  gi("apokoronas-chanion-kritis", "GR", "PDO", "eu", "Αποκορώνας Χανίων Κρήτης", "Apokoronas Chanion Kritis", "Apokoronas Chanion Kritis"),
  gi("peza-irakliou-kritis", "GR", "PDO", "eu", "Πεζά Ηρακλείου Κρήτης", "Peza Irakliou Kritis", "Peza Irakliou Kritis"),
  gi("archanes-irakliou-kritis", "GR", "PDO", "eu", "Αρχάνες Ηρακλείου Κρήτης", "Archanes Irakliou Kritis", "Archanes Irakliou Kritis"),
  gi("viannos-irakliou-kritis", "GR", "PDO", "eu", "Βιάννος Ηρακλείου Κρήτης", "Viannos Irakliou Kritis", "Viannos Irakliou Kritis"),
  gi("vorios-mylopotamos-rethymnis-kritis", "GR", "PDO", "eu", "Βόρειος Μυλοπόταμος Ρεθύμνης Κρήτης", "Vorios Mylopotamos Rethymnis Kritis", "Vorios Mylopotamos Rethymnis Kritis"),
  gi("thrapsano", "GR", "PDO", "eu", "Θραψανό", "Thrapsano", "Thrapsano"),
  gi("selino-kritis", "GR", "PDO", "eu", "Σελίνο Κρήτης", "Selino Kritis", "Selino Kritis"),
  gi("messara", "GR", "PDO", "eu", "Μεσσαρά", "Messara", "Messara"),
  gi("kalamata", "GR", "PDO", "eu", "Καλαμάτα", "Kalamata", "Kalamata"),
  gi("kranidi-argolidas", "GR", "PDO", "eu", "Κρανίδι Αργολίδας", "Kranidi Argolidas", "Kranidi Argolidas"),
  gi("lygourio-asklipiou", "GR", "PDO", "eu", "Λυγουριό Ασκληπιείου", "Lygourio Asklipiou", "Lygourio Asklipiou"),
  gi("krokees-lakonias", "GR", "PDO", "eu", "Κροκεές Λακωνίας", "Krokees Lakonias", "Krokees Lakonias"),
  gi("petrina-lakonias", "GR", "PDO", "eu", "Πετρίνα Λακωνίας", "Petrina Lakonias", "Petrina Lakonias"),
  gi("finiki-lakonias", "GR", "PDO", "eu", "Φοινίκι Λακωνίας", "Finiki Lakonias", "Finiki Lakonias"),
  gi("trizinia", "GR", "PDO", "eu", "Εξαιρετικό παρθένο ελαιόλαδο Τροιζηνία", "Exeretiko partheno eleolado Trizinia", "Trizinia sızma zeytinyağı"),
  // Greece — EU PGI
  gi("chania-kritis", "GR", "PGI", "eu", "Χανιά Κρήτης", "Chania Kritis", "Chania Kritis"),
  gi("lakonia", "GR", "PGI", "eu", "Λακωνία", "Lakonia", "Lakonia"),
  gi("lesvos", "GR", "PGI", "eu", "Λέσβος", "Lesvos", "Lesvos"),
  gi("olympia", "GR", "PGI", "eu", "Ολυμπία", "Olympia", "Olympia"),
  gi("preveza", "GR", "PGI", "eu", "Πρέβεζα", "Preveza", "Preveza"),
  gi("kefalonia", "GR", "PGI", "eu", "Κεφαλονιά", "Kefalonia", "Kefalonia"),
  gi("zakynthos", "GR", "PGI", "eu", "Ζάκυνθος", "Zakynthos", "Zakynthos"),
  gi("agios-mattheos-kerkyras", "GR", "PGI", "eu", "Άγιος Ματθαίος Κέρκυρας", "Agios Mattheos Kerkyras", "Agios Mattheos Kerkyras"),
  gi("rodos", "GR", "PGI", "eu", "Ρόδος", "Rodos", "Rodos"),
  gi("thassos", "GR", "PGI", "eu", "Θάσος", "Thassos", "Thassos"),
  gi("samos", "GR", "PGI", "eu", "Σάμος", "Samos", "Samos"),
  // Türkiye — EU PDO
  gi("ayvalik-zeytinyagi", "TR", "PDO", "eu", "Αϊβαλίκ", "Ayvalık Zeytinyağı", "Ayvalık Zeytinyağı"),
  gi("milas-zeytinyagi", "TR", "PDO", "eu", "Μίλας", "Milas Zeytinyağı", "Milas Zeytinyağı"),
  // Türkiye — national GIs (Türk Patent ve Marka Kurumu)
  gi("edremit-korfezi-zeytinyaglari", "TR", "PDO", "tr-national", "Κόλπος Εδραμιτίου", "Edremit Körfezi Zeytinyağları", "Edremit Körfezi Zeytinyağları"),
  gi("aydin-zeytinyagi", "TR", "PDO", "tr-national", "Αϊδίνιο", "Aydın Zeytinyağı", "Aydın Zeytinyağı"),
  gi("guney-ege-zeytinyaglari", "TR", "PDO", "tr-national", "Νότιο Αιγαίο (Τουρκία)", "Güney Ege Zeytinyağları", "Güney Ege Zeytinyağları"),
  gi("kuzey-ege-zeytinyaglari", "TR", "PDO", "tr-national", "Βόρειο Αιγαίο (Τουρκία)", "Kuzey Ege Zeytinyağları", "Kuzey Ege Zeytinyağları"),
];

function gi(
  slug: string,
  country: GiCountry,
  kind: GiKind,
  source: GiSource,
  el: string,
  en: string,
  tr: string,
): OilPdoPgi {
  return { slug, country, kind, source, names: { el, en, tr } };
}

const GENERIC = new Set([
  "pdo",
  "pgi",
  "pop",
  "ποπ",
  "πγε",
  "zeytinyagi",
  "zeytinyaglari",
  "eleolado",
  "olive",
  "oil",
  "exeretiko",
  "partheno",
  "sızma",
  "sizma",
]);

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[«»"'`]/g, "")
    .replace(/ı/g, "i")
    .replace(/[-_]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distinctive(value: string): string {
  return fold(value)
    .split(" ")
    .filter((w) => w && !GENERIC.has(w))
    .join(" ");
}

function locKey(locale: string): "el" | "en" | "tr" {
  if (locale.startsWith("el")) return "el";
  if (locale.startsWith("tr")) return "tr";
  return "en";
}

function kindLabel(kind: GiKind, locale: string): string {
  const loc = locKey(locale);
  if (kind === "PDO") return loc === "el" ? "ΠΟΠ" : "PDO";
  return loc === "el" ? "ΠΓΕ" : loc === "tr" ? "PGI" : "PGI";
}

const bySlug = new Map(OIL_PDO_PGI.map((item) => [item.slug, item]));
const byDistinctive = new Map<string, OilPdoPgi>();
for (const item of OIL_PDO_PGI) {
  const keys = new Set(
    [item.slug, item.names.el, item.names.en, item.names.tr].map(distinctive).filter(Boolean),
  );
  for (const key of keys) {
    if (!byDistinctive.has(key)) byDistinctive.set(key, item);
  }
}

export function findOilPdoPgi(value: string | null | undefined): OilPdoPgi | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  return bySlug.get(trimmed) ?? byDistinctive.get(distinctive(trimmed)) ?? null;
}

/** Localized official name, or the raw stored text when it is not in the list. */
export function formatOilPdoPgi(value: string, locale: string): string {
  const item = findOilPdoPgi(value);
  if (!item) return value.trim();
  const loc = locKey(locale);
  return `${item.names[loc]} (${kindLabel(item.kind, locale)})`;
}

export function oilPdoPgiOptionLabel(item: OilPdoPgi, locale: string): string {
  const loc = locKey(locale);
  return `${item.names[loc]} (${kindLabel(item.kind, locale)})`;
}

export function oilPdoPgiGrouped(
  locale: string,
): { country: GiCountry; label: string; items: OilPdoPgi[] }[] {
  const loc = locKey(locale);
  const labels: Record<GiCountry, { el: string; en: string; tr: string }> = {
    GR: { el: "Ελλάδα", en: "Greece", tr: "Yunanistan" },
    TR: { el: "Τουρκία", en: "Türkiye", tr: "Türkiye" },
  };
  return (["GR", "TR"] as const).map((country) => ({
    country,
    label: labels[country][loc],
    items: OIL_PDO_PGI.filter((item) => item.country === country).sort((a, b) =>
      oilPdoPgiOptionLabel(a, locale).localeCompare(oilPdoPgiOptionLabel(b, locale), locale),
    ),
  }));
}
