import { describe, expect, it } from "vitest";
import { deliverySignature, markAllSeen, sameSeen, unseenDeliveryCount } from "./sales-badge";

const d = (id: string, status = "scheduled", labResult: string | null = null, actualKg: number | null = null) => ({
  id,
  status,
  labResult,
  actualKg,
});

describe("sales badge", () => {
  it("counts every delivery as new before the farmer has opened Sales", () => {
    expect(unseenDeliveryCount([d("a"), d("b")], {})).toBe(2);
  });

  it("is empty once Sales has been opened", () => {
    const list = [d("a"), d("b", "weighed", null, 1200)];
    expect(unseenDeliveryCount(list, markAllSeen(list))).toBe(0);
  });

  it("counts a new delivery that appears after Sales was opened", () => {
    const seen = markAllSeen([d("a")]);
    expect(unseenDeliveryCount([d("a"), d("b")], seen)).toBe(1);
  });

  it("counts a step change (and a lab result) on a delivery already seen", () => {
    const seen = markAllSeen([d("a"), d("b")]);
    expect(unseenDeliveryCount([d("a", "weighed", null, 900), d("b")], seen)).toBe(1);
    expect(unseenDeliveryCount([d("a"), d("b", "lab_checked", "failed", 900)], seen)).toBe(1);
  });

  it("does not count a delivery again when nothing about it changed", () => {
    expect(deliverySignature(d("a", "weighed", null, 900))).toBe(deliverySignature(d("zzz", "weighed", null, 900)));
  });

  it("compares seen maps", () => {
    expect(sameSeen({ a: "x" }, { a: "x" })).toBe(true);
    expect(sameSeen({ a: "x" }, { a: "y" })).toBe(false);
    expect(sameSeen({ a: "x" }, {})).toBe(false);
  });
});
