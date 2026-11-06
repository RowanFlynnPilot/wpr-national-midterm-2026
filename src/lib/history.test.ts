import { describe, expect, it } from "vitest";
import { readings, spanText, trend, type HistoryPoint } from "./history";

const H = 3600;
const pts: HistoryPoint[] = [
  [1_000_000, "R", 0.5, 70],
  [1_000_000 + H, "D", 0.2, 80],
  [1_000_000 + 2 * H, "D", 1.4, 90],
  [1_000_000 + 3 * H, "D", 1.1, 97],
];

describe("readings", () => {
  it("signs each margin from the current leader's side", () => {
    expect(readings(pts, "D").map((r) => r.margin)).toEqual([-0.5, 0.2, 1.4, 1.1]);
    expect(readings(pts, "R").map((r) => r.margin)).toEqual([0.5, -0.2, -1.4, -1.1]);
  });
});

describe("trend", () => {
  it("reads the last two points: widening, narrowing, flipped, or nothing under a tenth", () => {
    expect(trend(pts.slice(0, 3), "D")).toBe("widening"); // 0.2 -> 1.4
    expect(trend(pts, "D")).toBe("narrowing"); // 1.4 -> 1.1
    expect(trend(pts.slice(0, 2), "D")).toBe("flipped"); // R +0.5 -> D +0.2
    expect(trend([pts[2] as HistoryPoint, [1, "D", 1.45, 95]], "D")).toBeNull();
    expect(trend(pts.slice(0, 1), "D")).toBeNull();
  });
});

describe("spanText", () => {
  it("hours under two days, then days", () => {
    expect(spanText(pts)).toBe("the last 3 hours");
    expect(spanText([pts[0] as HistoryPoint, [1_000_000 + 30 * 60, "D", 1, 1]])).toBe("the last hour");
    expect(spanText([pts[0] as HistoryPoint, [1_000_000 + 60 * H, "D", 1, 1]])).toBe("the last 3 days");
  });
});
