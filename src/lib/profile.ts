/** The demo farmer's country: which farmer the app shows, and how shared data looks for that farmer. Pure TS. */
import type { Country, Factory, FarmerProfile, Field } from '@/data/mock';
import type { Language } from './ai/schemas';
import { LANGUAGES } from './ai/schemas';

/** Greek shows the farmer in Greece; Turkish and English show the farmer in Türkiye. */
export const countryOf = (language: Language): Country => (language === 'el' ? 'gr' : 'tr');

/** The first app language among the device's preferred locales ("el-GR", "tr", …). English when none fits. */
export function languageFromLocales(locales: readonly string[]): Language {
  for (const l of locales) {
    const code = l.toLowerCase().split(/[-_]/)[0];
    if ((LANGUAGES as readonly string[]).includes(code)) return code as Language;
  }
  return 'en';
}

/** The fields with the names, varieties and coordinates of `profile`. Scores, records and everything else stay. Fields added by the farmer are kept as they are. */
export function applyProfile<F extends Pick<Field, 'id' | 'name' | 'variety' | 'lat' | 'lon'>>(fields: F[], profile: FarmerProfile): F[] {
  return fields.map((f) => {
    const p = profile.fields[f.id];
    return p ? { ...f, name: p.name, variety: p.variety, lat: p.lat, lon: p.lon } : f;
  });
}

/** A factory as the farmer of `profile` sees it: the demo factories' Turkish varieties and regions become local ones in Greece. */
export function localFactory<F extends Pick<Factory, 'variety' | 'region'>>(f: F, profile: FarmerProfile): F {
  return { ...f, variety: profile.factoryVariety[f.variety] ?? f.variety, region: profile.factoryRegion[f.region] ?? f.region };
}

/** Weather cache key of a field: the same field id has other coordinates in the other country. */
export const weatherKey = (fieldId: string, country: Country) => (country === 'tr' ? fieldId : `${country}:${fieldId}`);
