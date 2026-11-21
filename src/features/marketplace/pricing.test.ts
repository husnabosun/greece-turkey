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
