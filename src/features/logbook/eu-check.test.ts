import { describe, expect, it } from "vitest";
import { euCheck } from "./eu-check";

describe("euCheck", () => {
  it("flags chlorpyrifos", () => {
    const r = euCheck(["Chlorpyrifos-methyl 480 g/L"]);
    expect(r.banned).toBe(true);
    expect(r.hits).toContain("chlorpyrifos");
  });

  it("allows copper oxychloride", () => {
    const r = euCheck(["copper oxychloride"]);
    expect(r.banned).toBe(false);
    expect(r.hits).toEqual([]);
  });
});
