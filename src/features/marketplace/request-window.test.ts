import { describe, expect, it } from "vitest";
import { isRequestWindowExpired, requestWindowEnd } from "./request-window";

describe("requestWindowEnd", () => {
  it("parses English month ranges", () => {
    const end = requestWindowEnd("15–25 Nov", new Date("2026-11-01T12:00:00Z"));
    expect(end?.getMonth()).toBe(10);
    expect(end?.getDate()).toBe(25);
  });

  it("marks past windows expired", () => {
    expect(isRequestWindowExpired("1–10 Oct", new Date("2026-11-20T12:00:00Z"))).toBe(true);
  });

  it("keeps future windows", () => {
    expect(isRequestWindowExpired("20–30 Nov", new Date("2026-11-20T12:00:00Z"))).toBe(false);
  });
});
