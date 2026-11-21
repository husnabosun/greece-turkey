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

describe("euCheck (night fixes)", () => {
  const banned = (s: string[], p?: string) => euCheck(s, p).banned;
  it("official Greek spellings and trade names", () => {
    expect(banned(["χλωρπυριφός"])).toBe(true);
    expect(banned(["Χλωρπυριφός-μεθύλ 22,5%"])).toBe(true);
    expect(banned(["ιμιδακλοπρίδ"])).toBe(true);
    expect(banned(["ντιμεθοέιτ"])).toBe(true);
    expect(banned(["διμεθοάτ 40 EC"])).toBe(true);
    expect(banned([], "Dursban 4E")).toBe(true);
    expect(banned(["άγνωστο"], "Rogor")).toBe(true);
    expect(banned(["imidakloprid"])).toBe(true);
    expect(banned(["θειαμεθοξάμ"])).toBe(true);
    expect(banned(["φωσμέτ"])).toBe(true);
    expect(banned(["paraquat dichloride"])).toBe(true);
  });
  it("no false positives on short / approved inputs", () => {
    expect(euCheck(["o"]).status).toBe("unknown");
    expect(euCheck(["t"]).status).toBe("unknown");
    expect(euCheck(["deltamethrin 2.5%"]).status).toBe("allowed");
    expect(euCheck(["δελταμεθρίνη"]).status).toBe("allowed");
    expect(euCheck(["χαλκός"]).status).toBe("allowed");
    expect(euCheck(["spinosad"], "Spintor Fly").status).toBe("allowed");
    expect(euCheck(["kaolin"]).banned).toBe(false);
    expect(euCheck(["deltamethrin", "μυστικό"]).status).toBe("unknown");
    expect(euCheck([]).status).toBe("unknown");
  });
});
