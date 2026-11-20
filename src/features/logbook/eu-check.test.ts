import { describe, expect, it } from "vitest";
import { euCheck } from "./eu-check";

describe("euCheck", () => {
  it("flags chlorpyrifos", () => {
    const r = euCheck(["Chlorpyrifos-methyl 480 g/L"]);
    expect(r.banned).toBe(true);
    expect(r.hits).toContain("chlorpyrifos");
    expect(r.status).toBe("banned");
  });

  it("flags Greek chlorpyrifos spelling", () => {
    const r = euCheck(["χλωροπυριφός"]);
    expect(r.banned).toBe(true);
    expect(r.hits).toContain("chlorpyrifos");
  });

  it("flags Turkish klorpirifos / Dursban", () => {
    expect(euCheck(["klorpirifos"]).banned).toBe(true);
    expect(euCheck(["Dursban"]).banned).toBe(true);
  });

  it("allows copper oxychloride", () => {
    const r = euCheck(["copper oxychloride"]);
    expect(r.banned).toBe(false);
    expect(r.hits).toEqual([]);
    expect(r.status).toBe("allowed");
  });

  it("marks unknown substances as unknown, not approved", () => {
    const r = euCheck(["μυστική ουσία xyz"]);
    expect(r.banned).toBe(false);
    expect(r.status).toBe("unknown");
  });
});
