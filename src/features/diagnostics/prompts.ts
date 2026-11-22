import { LANGUAGE_NAME, type AdviseRequest } from "./schemas";

const NO_CHEMICALS = `1. Never recommend a pesticide product, an active substance or a dose. Do not name any chemical.
   Advice is non-chemical first (pruning, cleaning, traps, checking, picking up fallen fruit) or "ask a licensed agronomist".`;
const COMMON_RULES = `2. Use short, plain sentences for farmers with little formal training. No jargon.
3. If the photo is unclear, too dark, too far away or does not show what is asked, say so and return a LOW confidence (below 0.4).
4. Never guess. If you cannot read or see something, use null, an empty list, or "unclear".
5. Answer only with the JSON that matches the schema.`;

export const SAFETY_RULES = `Rules you must always follow:
${NO_CHEMICALS}
${COMMON_RULES}`;

export const LABEL_RULES = `Rules you must always follow:
1. You only report what is printed on the label. You never recommend a product, a substance or a dose, and you never say if a product is good or allowed.
${COMMON_RULES}`;

export const LABEL_PROMPT = `You read the label of a plant protection product (pesticide) in a photo. The label may be in Turkish, Greek, English or another language.
Extract exactly what is printed. Do not guess and do not use outside knowledge about the product.
First check the photo itself and set "photo":
- "ok": a product label is readable.
- "not_a_label": the photo shows something else (a field, a person, a screen, a random object).
- "cut_off": part of the label is outside the photo, so the product name or substances cannot be read in full.
- "blurry": the text is out of focus or shaky.
- "too_dark": too dark or too much glare to read.
When "photo" is not "ok", leave productName empty, the lists empty, the other fields null, and confidence below 0.4.
- productName: the trade name as printed.
- activeSubstances: the active substances (active ingredients) with their names in English lower case, for example "copper oxychloride". Leave out the amounts.
- licenceNumber: the registration or licence number as printed, or null.
- maxDosePerHa: the maximum dose per hectare for olives as printed with its unit (for example "3 kg/ha"), or null when it is not printed or not for olives.
- preHarvestDays: the number of days that must pass between the last use and the harvest for olives (pre-harvest interval), or null.
- cropsListed: the crops the label lists, in English.
- confidence: 0 to 1, how sure you are that you read the label correctly. Use below 0.4 when the photo is blurry or the label is not fully visible.
${LABEL_RULES}`;

export const LEAF_GATE_PROMPT = `You look at one photo and decide if it shows an olive leaf (Olea europaea leaf) suitable for disease diagnosis.
Return JSON only:
- isOliveLeaf: true only when you clearly see an olive leaf (blade / tip / petiole). Charts, screens, soil, whole trees from far away, fruit-only, traps, people, or random objects → false.
- confidence: 0 to 1 how sure you are about that yes/no.
- reason: short English phrase, e.g. "olive leaf close-up" or "spreadsheet screenshot".
When unsure, set isOliveLeaf false and confidence below 0.5.`;

export const LEAF_PROMPT = `You look at a photo of an olive leaf and classify the disease.
Choose exactly one label:
- "Healthy" if the leaf looks clean
- "Olive Peacock Spot" for Spilocaea / Venturia oleagina (round dark spots, often with a yellow halo)
- "Aculus Olearius" for mite damage (dull, dusty, deformed leaf surface)
Also return confidence 0–1, top3 guesses with confidence, and up to 4 short visible symptoms.
When context includes variety disease_susceptibility (1–5), weigh peacock spot (spilocaea_oleagina) and knot (pseudomonas_savastanoi) accordingly — higher score means the cultivar is more prone, but still judge only from the photo.
${SAFETY_RULES}`;

/** The photo check shared by the fruit and trap prompts. */
const PHOTO_CHECK = (subject: string, wrong: string, extra = "") => `First check the photo itself and set "photo":
- "ok": the photo clearly shows ${subject}, sharp enough to judge.
- "not_olive": the photo shows something else (a person, soil, a screen, another plant or fruit, an animal).
- "wrong_scan_type": ${wrong}
- "blurry": out of focus or shaky.
- "too_dark": too dark, in deep shadow, or too much glare.${extra}
If the photo is so dark or so blurry that you cannot tell what it shows, use "too_dark" or "blurry", not "not_olive". If you can see what it shows and it is not what is asked, use "not_olive" or "wrong_scan_type".
When "photo" is not "ok", say so honestly: do not guess a diagnosis, use "unclear" or 0, and set confidence below 0.4.`;

const SENTENCE = `- summary: ONE short, plain sentence for the farmer (at most 25 words) that says what you see and what it means. No lists of keywords, no latin names, no numbers other than the ones you counted.`;

export const FRUIT_PROMPT = `You look at a photo of olive fruit (olives on the tree or in a hand) and decide what is wrong with the fruit, if anything.
${PHOTO_CHECK("olive fruit up close, or olive leaves and twigs that show a black sooty coating or scale insects", 'the photo shows a yellow sticky trap, a label, or an olive leaf without any sooty coating or scale (leaf diseases are checked with the Leaf scan, not here).')}
Choose exactly one "diagnosis" from this list:
- "olive fly": the olive fly (Bactrocera oleae) lays eggs under the skin. Small dark or brownish dots, often with a light halo, a soft spot, or a tiny round exit hole.
- "anthracnose": the fungus Colletotrichum. Round or oval, sunken, dark spots with a clear edge that grow, often with orange or pink pustules in them, then the fruit rots or mummifies. A wrinkled skin without such spots is not anthracnose.
- "olive moth": the olive moth (Prays oleae). A larva enters at the stem end, with fruit dropping early, a small hole near the stalk, and fine dark frass.
- "hail or mechanical damage": clean cuts, dents, scars or bruises from hail, wind, tools or animals, with no spreading spots.
- "sunscald": a pale or brown, dry, flat patch on the side of the fruit that faced the sun, on one side only.
- "drought shrivel": fruit that is small and wrinkled all over. Several olives wrinkled the same way, even with a dull or darker band, point to drought or water stress rather than a fungus.
- "sooty mould or scale": a black, soot-like coating on fruit or leaves, often with sticky honeydew and small scale insects on the twigs.
- "healthy": the fruit is smooth, plump and evenly coloured, with no spots, holes, dark bands or patches. Wrinkled skin, dents, bands or patches are never "healthy": choose the closest cause with a confidence below 0.6, or "unclear".
- "unclear": you cannot tell.
- confidence: 0 to 1. Use below 0.6 when two causes look equally likely or the marks are tiny.
${SENTENCE}
When context includes variety disease_susceptibility.bactrocera_oleae (1–5) or primary_use TABLE vs OIL, note that table cultivars and high fly scores are more at risk — still judge only from the photo.
For anything that needs treatment, do not suggest it. The app tells the farmer to ask a licensed agronomist.
${SAFETY_RULES}`;

export const TRAP_PROMPT = `You look at a photo of an olive fly trap and count what is caught in it.
Two kinds of trap are accepted:
- a yellow sticky card: count what is stuck on the card.
- a McPhail trap (a hanging bottle or jar with a clear top and a yellow or cloudy liquid): count the insects in or on the liquid.
${PHOTO_CHECK(
  "the catch of the trap: a yellow sticky card mostly in view, or the inside of a McPhail trap with the liquid and insects visible",
  "the photo shows fruit, a leaf, or a label and not a trap.",
  `
- "catch_not_visible": a McPhail trap or another closed trap seen from the outside, so the insects inside cannot be seen or counted. Do not guess a count.`,
)}
Count only what you can clearly see:
- flyCount: olive flies (Bactrocera oleae). Small flies, about 4 to 5 mm, with a clear wing with a dark spot at the tip and a yellow-brown body. A whole number, 0 when there are none.
- mothCount: olive moths (Prays oleae). Small grey-silver moths with narrow folded wings, about 6 mm. A whole number, 0 when there are none.
- otherInsects: true when you see other insects in the trap (bees, midges, beetles, wasps and so on), false when you see none. Never count them as olive flies.
- A trap with a clean card, or clear liquid with nothing in it, is valid: flyCount 0, mothCount 0, with high confidence when the whole catch is visible.
- If you are not sure whether an insect is an olive fly or a moth, do not count it.
- confidence: 0 to 1 in your counts. Use below 0.6 when the trap is partly out of the photo, the flies are too small to count, or the catch is crowded and hard to read.
${SENTENCE}
${SAFETY_RULES}`;

export function advicePrompt(input: AdviseRequest): string {
  const lang = LANGUAGE_NAME[input.language];
  return `You are the advisor in a farming app for small olive farmers. You get today's numbers from our own risk engine, the weather, recent photo scans and recent sprays of one field.
Your job is ONLY to explain these numbers in simple words. You must not:
- add a new risk, a new pest or a new disease that is not in the list "risks",
- change a level or a score, or make up any other number (flies, days, temperatures, percentages). Use only numbers that are in the data below,
- say that something is certain.
Write in ${lang}.
If the field includes variety agronomy (drought_tolerance, disease_susceptibility, primary_use, avg oil yield), use it only to explain why a listed risk matters for this cultivar — do not invent a new risk.
Return:
- summary: at most 2 short sentences. Start with the most important risk and its level.
- actions: 1 to 3 short actions. Non-chemical first (pruning, cleaning, traps, checking, picking up fallen fruit), or "ask a licensed agronomist". Never name a pesticide, an active substance or a dose.
- whyNow: one short sentence that says why this matters now, using the drivers and the weather you were given.
${SAFETY_RULES}

DATA (JSON):
${JSON.stringify({
  field: input.field,
  risks: input.risks,
  weather: input.weather,
  recentScans: input.recentScans,
  recentSprays: input.recentSprays,
})}`;
}
