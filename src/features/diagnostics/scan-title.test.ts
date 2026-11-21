import { describe, expect, it } from "vitest";
import { inferScanTitleKey, localizedScanTitle } from "./scan-title";
import type { Presented } from "./scan-types";

const base: Presented = {
  mode: "leaf",
  title: "Υγιές φύλλο",
  summary: "",
  tone: "good",
  pillKey: "healthy",
  actionKind: "healthy",
  showNoChemicals: false,
};

describe("scan titles C9", () => {
  it("infers key from legacy Greek title", () => {
    expect(inferScanTitleKey(base)).toBe("healthyLeaf");
  });

  it("prefers stored titleKey", () => {
    expect(inferScanTitleKey({ ...base, titleKey: "peacock", title: "whatever" })).toBe("peacock");
  });

  it("localizes trap counts", () => {
    const presented: Presented = {
      ...base,
      mode: "trap",
      title: "Παγίδα · 8 μύγες",
      titleKey: "trapTitle",
      actionKind: "trap",
    };
    const label = localizedScanTitle(presented, (key, values) =>
      key === "trapTitle" ? `Trap · ${values?.n}` : key,
    );
    expect(label).toBe("Trap · 8");
  });
});
