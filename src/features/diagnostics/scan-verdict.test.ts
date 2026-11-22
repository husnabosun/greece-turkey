import { describe, expect, it } from "vitest";
import { DEMO_FRUIT, DEMO_LABEL, DEMO_TRAP } from "./demos";
import { fruitResult, labelResult, trapResult } from "./schemas";
import { judgeFruit, judgeLabel, judgeTrap, summaryIsSafe, UNSURE_BELOW } from "./scan-verdict";

const fruit = { photo: "ok", diagnosis: "olive fly", confidence: 0.85, summary: "Small dark dots on the skin look like olive fly stings." } as const;
const trap = { photo: "ok", flyCount: 4, mothCount: 0, otherInsects: false, confidence: 0.8, summary: "About 4 olive flies are on the trap." } as const;

describe("fruit verdict", () => {
  it("shows a confident answer", () => {
    expect(judgeFruit(fruit)).toEqual({ kind: "ok" });
    expect(judgeFruit({ ...fruit, diagnosis: "healthy", summary: "The olive looks clean." })).toEqual({ kind: "ok" });
  });

  it("asks for a new photo, with the reason, when the photo is not usable", () => {
    for (const photo of ["not_olive", "wrong_scan_type", "blurry", "too_dark"] as const) {
      // Even with a confident diagnosis in the same answer: never show it.
      expect(judgeFruit({ ...fruit, photo })).toEqual({ kind: "retake", reason: photo });
    }
  });

  it("is unsure below 0.6 confidence, exactly at 0.6 it is not", () => {
    expect(judgeFruit({ ...fruit, confidence: UNSURE_BELOW - 0.01 })).toEqual({ kind: "unsure" });
    expect(judgeFruit({ ...fruit, confidence: UNSURE_BELOW })).toEqual({ kind: "ok" });
  });

  it("is unsure when the model says unclear", () => {
    expect(judgeFruit({ ...fruit, diagnosis: "unclear", confidence: 0.95 })).toEqual({ kind: "unsure" });
  });

  it("is unsure when the sentence names a chemical or a dose, or is an essay", () => {
    expect(judgeFruit({ ...fruit, summary: "Spray copper oxychloride on the trees." })).toEqual({ kind: "unsure" });
    expect(judgeFruit({ ...fruit, summary: "Use 3 kg/ha of it." })).toEqual({ kind: "unsure" });
    expect(judgeFruit({ ...fruit, summary: "One. Two. Three sentences here." })).toEqual({ kind: "unsure" });
  });
});

describe("trap verdict", () => {
  it("shows a confident count, also an empty trap", () => {
    expect(judgeTrap(trap)).toEqual({ kind: "ok" });
    expect(judgeTrap({ ...trap, flyCount: 0, summary: "The trap is clean." })).toEqual({ kind: "ok" });
  });
  it("asks for a new photo when the picture is not a trap", () => {
    expect(judgeTrap({ ...trap, photo: "wrong_scan_type" })).toEqual({ kind: "retake", reason: "wrong_scan_type" });
    expect(judgeTrap({ ...trap, photo: "blurry", flyCount: 30 })).toEqual({ kind: "retake", reason: "blurry" });
  });
  it("asks to photograph the catch inside when a McPhail trap is seen from outside", () => {
    expect(judgeTrap({ ...trap, photo: "catch_not_visible", flyCount: 0 })).toEqual({ kind: "retake", reason: "catch_not_visible" });
    expect(trapResult.safeParse({ ...trap, photo: "catch_not_visible" }).success).toBe(true);
    expect(fruitResult.safeParse({ ...fruit, photo: "catch_not_visible" }).success).toBe(false);
  });
  it("is unsure when the count is not reliable", () => {
    expect(judgeTrap({ ...trap, confidence: 0.4 })).toEqual({ kind: "unsure" });
  });
});

describe("label verdict", () => {
  const label = { ...DEMO_LABEL, photo: "ok" as const, confidence: 0.9 };
  it("accepts a confident label, with substance names (they are printed on it)", () => {
    expect(judgeLabel(label)).toEqual({ kind: "ok" });
  });
  it("retakes a photo that is not a label, cut off, blurry or dark", () => {
    for (const photo of ["not_a_label", "cut_off", "blurry", "too_dark"] as const) {
      expect(judgeLabel({ ...label, photo })).toEqual({ kind: "retake", reason: photo });
    }
  });
  it("retakes a low-confidence read and an empty read, never fills the form from them", () => {
    expect(judgeLabel({ ...label, confidence: 0.5 })).toEqual({ kind: "retake", reason: "unclear" });
    expect(judgeLabel({ ...label, productName: "", activeSubstances: [] })).toEqual({ kind: "retake", reason: "not_a_label" });
  });
});

describe("summaryIsSafe", () => {
  it("accepts one plain sentence and rejects empty text", () => {
    expect(summaryIsSafe("The olive looks healthy.")).toBe(true);
    expect(summaryIsSafe("   ")).toBe(false);
  });
});

describe("schemas", () => {
  it("accepts the new answer shapes and keeps the demo results valid", () => {
    expect(fruitResult.safeParse(fruit).success).toBe(true);
    expect(trapResult.safeParse(trap).success).toBe(true);
    expect(fruitResult.safeParse(DEMO_FRUIT).success).toBe(true);
    expect(trapResult.safeParse(DEMO_TRAP).success).toBe(true);
    expect(labelResult.safeParse(DEMO_LABEL).success).toBe(true);
  });
  it("reads an old 'olive fly sting' answer as olive fly", () => {
    const r = fruitResult.parse({ ...fruit, diagnosis: "Olive fly sting" });
    expect(r.diagnosis).toBe("olive fly");
  });
  it("reads null numbers and text of a bad photo as 0 and empty, so the photo is retaken (not 'AI unavailable')", () => {
    const t = trapResult.parse({ photo: "too_dark", flyCount: null, mothCount: null, otherInsects: null, confidence: null, summary: null });
    expect(t).toMatchObject({ flyCount: 0, mothCount: 0, otherInsects: false, confidence: 0, summary: "" });
    expect(judgeTrap(t)).toEqual({ kind: "retake", reason: "too_dark" });
    const f = fruitResult.parse({ photo: "blurry", diagnosis: null, confidence: null, summary: null });
    expect(judgeFruit(f)).toEqual({ kind: "retake", reason: "blurry" });
  });
  it("an answer that says the photo is fine but has no sentence is unsure, not shown", () => {
    expect(judgeFruit(fruitResult.parse({ ...fruit, summary: "" }))).toEqual({ kind: "unsure" });
  });
  it("rejects a diagnosis that is not in the list and a missing photo check", () => {
    expect(fruitResult.safeParse({ ...fruit, diagnosis: "frost" }).success).toBe(false);
    expect(fruitResult.safeParse({ diagnosis: "healthy", confidence: 1, summary: "x" }).success).toBe(false);
  });
});
