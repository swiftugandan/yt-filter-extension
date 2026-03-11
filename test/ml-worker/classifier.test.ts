import { describe, it, expect } from "vitest";
import { dotProduct } from "../../src/ml-worker/classifier";

describe("dotProduct", () => {
  it("computes dot product of two vectors", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    expect(dotProduct(a, b)).toBe(32);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(dotProduct(a, b)).toBe(0);
  });

  it("returns 1 for identical unit vectors", () => {
    const v = 1 / Math.sqrt(3);
    const a = new Float32Array([v, v, v]);
    expect(dotProduct(a, a)).toBeCloseTo(1, 5);
  });

  it("handles negative values", () => {
    const a = new Float32Array([1, -1]);
    const b = new Float32Array([-1, 1]);
    expect(dotProduct(a, b)).toBe(-2);
  });

  it("returns 0 for zero vectors", () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    expect(dotProduct(a, b)).toBe(0);
  });
});
