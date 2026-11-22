import { describe, it, expect } from "vitest";
import { parseLocaleNumber, saleTotal } from "@/features/marketplace/pricing";
describe("parseLocaleNumber", () => {
  it("parses", () => {
    expect(parseLocaleNumber("12.300")).toBe(12300);
    expect(parseLocaleNumber("12,300")).toBe(12.3);
    expect(parseLocaleNumber("12,5")).toBe(12.5);
    expect(parseLocaleNumber("7950")).toBe(7950);
    expect(parseLocaleNumber("1.234,5")).toBe(1234.5);
    expect(parseLocaleNumber("12 300")).toBe(12300);
    expect(parseLocaleNumber("0.92")).toBe(0.92);
    expect(parseLocaleNumber("1e6")).toBeNull();
    expect(parseLocaleNumber("-5")).toBeNull();
    expect(parseLocaleNumber("abc")).toBeNull();
    expect(parseLocaleNumber("1.000.000")).toBe(1000000);
    expect(saleTotal(7.95, 0.92)).toBe(7314);
    expect(saleTotal(8, 0.92)).toBe(7360);
  });
});
import {
  MARKET_LIMITS,
  allowedOilCategories,
  formatQuantity,
  kgToTons,
  oilCategoryFromAcidity,
  parseBounded,
  tonsToKg,
} from "@/features/marketplace/pricing";

describe("oil quantity + category", () => {
  it("converts tons ↔ kg", () => {
    expect(tonsToKg(2.5)).toBe(2500);
    expect(kgToTons(2500)).toBe(2.5);
    expect(kgToTons(500)).toBe(0.5);
  });
  it("formats oil in kg and olives in tons", () => {
    expect(formatQuantity("oil", 2.5, "el")).toMatch(/2\.500\s*kg|2\.500 kg/);
    expect(formatQuantity("olives", 2.5, "el")).toMatch(/2,5\s*t/);
  });
  it("maps acidity to EU categories", () => {
    expect(oilCategoryFromAcidity(0.2)).toBe("extra_virgin");
    expect(oilCategoryFromAcidity(0.8)).toBe("extra_virgin");
    expect(oilCategoryFromAcidity(0.81)).toBe("virgin");
    expect(oilCategoryFromAcidity(2.0)).toBe("virgin");
    expect(oilCategoryFromAcidity(2.01)).toBe("lampante");
  });
  it("only allows same-or-lower category than acidity", () => {
    expect(allowedOilCategories(0.3)).toEqual(["extra_virgin", "virgin", "lampante"]);
    expect(allowedOilCategories(1.2)).toEqual(["virgin", "lampante"]);
    expect(allowedOilCategories(3)).toEqual(["lampante"]);
  });
});

describe("parseBounded", () => {
  it("keeps leading-zero decimals as decimals", () => {
    expect(parseLocaleNumber("0.450")).toBe(0.45);
    expect(parseLocaleNumber("0,450")).toBe(0.45);
  });
  it("enforces bounds", () => {
    expect(parseBounded("0,45", MARKET_LIMITS.pricePerKg)).toEqual({ ok: true, value: 0.45 });
    expect(parseBounded("25", MARKET_LIMITS.pricePerKg).ok).toBe(false);
    expect(parseBounded("0,01", MARKET_LIMITS.pricePerKg)).toMatchObject({ reason: "tooLow" });
    expect(parseBounded("-3", MARKET_LIMITS.lotTons)).toMatchObject({ reason: "invalid" });
    expect(parseBounded("600", MARKET_LIMITS.lotTons)).toMatchObject({ reason: "tooHigh" });
    expect(parseBounded("1500", MARKET_LIMITS.requestTons)).toEqual({ ok: true, value: 1500 });
  });
});
import { parseTreeCount } from "@/shared/lib/error-message";
describe("parseTreeCount", () => {
  it("never rewrites silently", () => {
    expect(parseTreeCount("80")).toBe(80);
    expect(parseTreeCount("1.500")).toBe(1500);
    expect(parseTreeCount("-50")).toBeNull();
    expect(parseTreeCount("1,5")).toBeNull();
    expect(parseTreeCount("0")).toBeNull();
    expect(parseTreeCount("6000")).toBeNull();
  });
});
