import { describe, expect, it } from "vitest";
import { arcRows, arcSeats } from "./arc";

describe("arcSeats", () => {
  it("places every seat, left to right, inside the ring", () => {
    for (const total of [50, 100, 133, 435]) {
      const rows = arcRows(total, 40, 96);
      const seats = arcSeats(total, rows, 40, 96);
      expect(seats).toHaveLength(total);
      for (let i = 1; i < seats.length; i++) expect((seats[i - 1]?.angle as number) >= (seats[i]?.angle as number)).toBe(true);
      for (const s of seats) {
        const radius = Math.hypot(s.x, s.y);
        expect(radius).toBeGreaterThanOrEqual(39.99);
        expect(radius).toBeLessThanOrEqual(96.01);
        expect(s.y).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it("gives the House more rows than the Senate", () => {
    expect(arcRows(435, 40, 96)).toBeGreaterThan(arcRows(100, 40, 96));
  });
});
