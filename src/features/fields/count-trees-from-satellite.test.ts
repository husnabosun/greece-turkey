import { describe, expect, it } from "vitest";
import {
  polygonAreaHa,
  polygonToPixelRing,
} from "@/features/fields/count-trees-from-satellite";
import type { FieldPolygon } from "@/features/fields/satellite-style";

describe("polygonToPixelRing", () => {
  it("maps SW/NE corners into pixel space with y flipped", () => {
    const polygon: FieldPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [21.9, 37.05],
          [21.901, 37.05],
          [21.901, 37.051],
          [21.9, 37.051],
          [21.9, 37.05],
        ],
      ],
    };
    const ring = polygonToPixelRing(
      polygon,
      { minLon: 21.9, maxLon: 21.901, minLat: 37.05, maxLat: 37.051 },
      1000,
      1000,
    );
    expect(ring[0]).toEqual([0, 1000]);
    expect(ring[2]![0]).toBeCloseTo(1000, 5);
    expect(ring[2]![1]).toBeCloseTo(0, 5);
  });
});

describe("polygonAreaHa", () => {
  it("returns a positive area for a real-sized grove ring", () => {
    // ~115 m × 115 m ≈ 1.3 ha near Messinia
    const ring: [number, number][] = [
      [21.9, 37.05],
      [21.9013, 37.05],
      [21.9013, 37.05105],
      [21.9, 37.05105],
      [21.9, 37.05],
    ];
    const ha = polygonAreaHa(ring);
    expect(ha).toBeGreaterThan(1);
    expect(ha).toBeLessThan(2);
  });
});
