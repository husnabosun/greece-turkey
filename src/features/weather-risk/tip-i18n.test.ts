import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWN_TIPS, localizeTip } from "./tip-i18n";

describe("risk tips are translated", () => {
  it("covers every advice line the engine can emit", () => {
    const dir = join(__dirname, "risk/threats");
    const missing: string[] = [];
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(/(?:low|medium|high):\s*\[([^\]]*)\]/g)) {
        for (const t of m[1]!.matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
          if (!KNOWN_TIPS.includes(t[1]!)) missing.push(t[1]!);
        }
      }
    }
    expect(missing).toEqual([]);
    expect(localizeTip("Order a lab test.", "el")).toBe("Ζήτα εργαστηριακό έλεγχο.");
  });
});
