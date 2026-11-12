/** Prompts and Gemini response schemas. Pure data, no network. */
import { LANGUAGE_NAME, type AdviseRequest } from './schemas';

/** Rules that go into every prompt. */
const NO_CHEMICALS = `1. Never recommend a pesticide product, an active substance or a dose. Do not name any chemical.
   Advice is non-chemical first (pruning, cleaning, traps, checking, picking up fallen fruit) or "ask a licensed agronomist".`;
const COMMON_RULES = `2. Use short, plain sentences for farmers with little formal training. No jargon.
3. If the photo is unclear, too dark, too far away or does not show what is asked, say so and return a LOW confidence (below 0.4).
4. Never guess. If you cannot read or see something, use null, an empty list, or "unclear".
5. Answer only with the JSON that matches the schema.`;
export const SAFETY_RULES = `Rules you must always follow:
${NO_CHEMICALS}
${COMMON_RULES}`;
/** The label reader must copy the substances that are printed, so rule 1 becomes "report only, never recommend". */
export const LABEL_RULES = `Rules you must always follow:
1. You only report what is printed on the label. You never recommend a product, a substance or a dose, and you never say if a product is good or allowed.
${COMMON_RULES}`;

export const LABEL_PROMPT = `You read the label of a plant protection product (pesticide) in a photo. The label may be in Turkish, Greek, English or another language.
Extract exactly what is printed. Do not guess and do not use outside knowledge about the product.
- productName: the trade name as printed.
- activeSubstances: the active substances (active ingredients) with their names in English lower case, for example "copper oxychloride". Leave out the amounts.
- licenceNumber: the registration or licence number as printed, or null.
- maxDosePerHa: the maximum dose per hectare for olives as printed with its unit (for example "3 kg/ha"), or null when it is not printed or not for olives.
- preHarvestDays: the number of days that must pass between the last use and the harvest for olives (pre-harvest interval), or null.
- cropsListed: the crops the label lists, in English.
- confidence: 0 to 1, how sure you are that you read the label correctly. Use below 0.4 when the photo is blurry or the label is not fully visible.
${LABEL_RULES}`;

export const FRUIT_PROMPT = `You look at a photo of one olive fruit (olives on the tree or in a hand) and decide if it shows olive fly damage.
The olive fly (Bactrocera oleae) lays its egg under the skin of the fruit. A sting looks like a small dark or brownish dot, sometimes with a light halo or a tiny soft spot. Later there can be an exit hole.
- diagnosis: "olive fly sting" if you see such marks, "other damage" for other problems (bird, hail, rot, disease), "healthy" if the fruit looks clean, "unclear" if you cannot judge.
- confidence: 0 to 1.
- symptoms: up to 4 short things you can actually see in the photo.
${SAFETY_RULES}`;

export const TRAP_PROMPT = `You look at a photo of a yellow sticky trap for olive flies and count the olive flies stuck on it.
Count only olive flies (Bactrocera oleae): small flies, about 4 to 5 mm, with a clear wing with a dark spot at the tip and a yellow-brown body.
Do not count other insects, dirt or leaves. If you are not sure whether an insect is an olive fly, do not count it.
- flyCount: the number of olive flies you counted (a whole number, 0 when there are none).
- confidence: 0 to 1 in your count. Use below 0.4 when the trap is partly out of the photo, the photo is blurry, or the flies are too small to count.
- notes: one short sentence, for example what else is on the trap, or why you are not sure.
${SAFETY_RULES}`;

export function advicePrompt(input: AdviseRequest): string {
  const lang = LANGUAGE_NAME[input.language];
  return `You are the advisor in a farming app for small olive farmers. You get today's numbers from our own risk engine, the weather, recent photo scans and recent sprays of one field.
Your job is ONLY to explain these numbers in simple words. You must not:
- add a new risk, a new pest or a new disease that is not in the list "risks",
- change a level or a score, or make up any other number (flies, days, temperatures, percentages). Use only numbers that are in the data below,
- say that something is certain.
Write in ${lang}.
Return:
- summary: at most 2 short sentences. Start with the most important risk and its level.
- actions: 1 to 3 short actions. Non-chemical first (pruning, cleaning, traps, checking, picking up fallen fruit), or "ask a licensed agronomist". Never name a pesticide, an active substance or a dose.
- whyNow: one short sentence that says why this matters now, using the drivers and the weather you were given.
${SAFETY_RULES}

DATA (JSON):
${JSON.stringify({ field: input.field, risks: input.risks, weather: input.weather, recentScans: input.recentScans, recentSprays: input.recentSprays })}`;
}

// ---- Gemini response schemas (OpenAPI subset). The server also checks the answer with zod. ----

const str = { type: 'STRING' } as const;
const num = { type: 'NUMBER' } as const;
const int = { type: 'INTEGER' } as const;
const strList = { type: 'ARRAY', items: str } as const;

export const LABEL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    productName: str,
    activeSubstances: strList,
    licenceNumber: { ...str, nullable: true },
    maxDosePerHa: { ...str, nullable: true },
    preHarvestDays: { ...int, nullable: true },
    cropsListed: strList,
    confidence: num,
  },
  required: ['productName', 'activeSubstances', 'licenceNumber', 'maxDosePerHa', 'preHarvestDays', 'cropsListed', 'confidence'],
} as const;

export const FRUIT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    diagnosis: { type: 'STRING', enum: ['olive fly sting', 'other damage', 'healthy', 'unclear'] },
    confidence: num,
    symptoms: strList,
  },
  required: ['diagnosis', 'confidence', 'symptoms'],
} as const;

export const TRAP_SCHEMA = {
  type: 'OBJECT',
  properties: { flyCount: int, confidence: num, notes: str },
  required: ['flyCount', 'confidence', 'notes'],
} as const;

export const ADVICE_SCHEMA = {
  type: 'OBJECT',
  properties: { summary: str, actions: strList, whyNow: str },
  required: ['summary', 'actions', 'whyNow'],
} as const;
