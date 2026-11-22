import { describe, expect, it } from "vitest";
import { applyAgronomicGuardrail } from "@/features/fields/olive-density";

describe("applyAgronomicGuardrail", () => {
  it("replaces the 105-on-13.2stremmata undercount with ~264", () => {
    // 13.2 στρέμματα = 1.32 ha
    const result = applyAgronomicGuardrail(105, 1.32);
    expect(result.adjusted).toBe(true);
    expect(result.min).toBe(198);
    expect(result.max).toBe(462);
    expect(result.treeCount).toBe(264);
  });

  it("keeps a Vision count inside the 15–35 / στρέμμα band", () => {
    const result = applyAgronomicGuardrail(250, 1.32);
    expect(result.adjusted).toBe(false);
    expect(result.treeCount).toBe(250);
  });

  it("also clamps absurd overcounts", () => {
    const result = applyAgronomicGuardrail(900, 1.32);
    expect(result.adjusted).toBe(true);
    expect(result.treeCount).toBe(264);
  });
});
