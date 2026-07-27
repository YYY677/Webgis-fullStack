import { describe, expect, it } from "vitest";
import { calculateSlopeAndAspect } from "./terrain-analysis";

describe("terrain analysis", () => {
  it("returns zero slope and no aspect for a flat 3 by 3 terrain grid", () => {
    const result = calculateSlopeAndAspect(Array(9).fill(100), 30);

    expect(result.slopeDegrees).toBe(0);
    expect(result.aspectDegrees).toBeNull();
  });

  it("returns a west-facing downhill aspect when terrain rises to the east", () => {
    const result = calculateSlopeAndAspect(
      [0, 100, 200, 0, 100, 200, 0, 100, 200],
      100,
    );

    expect(result.slopeDegrees).toBeCloseTo(45, 6);
    expect(result.aspectDegrees).toBeCloseTo(270, 6);
  });

  it("returns a south-facing downhill aspect when terrain rises to the north", () => {
    const result = calculateSlopeAndAspect(
      [200, 200, 200, 100, 100, 100, 0, 0, 0],
      100,
    );

    expect(result.slopeDegrees).toBeCloseTo(45, 6);
    expect(result.aspectDegrees).toBeCloseTo(180, 6);
  });
});
