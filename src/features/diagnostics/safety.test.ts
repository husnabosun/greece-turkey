import { describe, expect, it } from "vitest";
import { containsChemicalAdvice, isAdviceSafe } from "./safety";

describe("AI safety", () => {
  it("detects chemical product names", () => {
    expect(containsChemicalAdvice("Spray dimethoate tomorrow")).toBe(true);
    expect(containsChemicalAdvice("Pick up fallen fruit")).toBe(false);
  });

  it("rejects invented numbers in advice", () => {
    const advice = {
      summary: "High olive fly risk at 88.",
      actions: ["Check traps"],
      whyNow: "Because score is 88 today.",
    };
    expect(isAdviceSafe(advice, [65])).toBe(false);
    expect(isAdviceSafe(advice, [88])).toBe(true);
  });
});
