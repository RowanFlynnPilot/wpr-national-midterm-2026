import { describe, expect, it } from "vitest";
import { apNumber, centralTime, marginText, relativeAge, timeAgo } from "./format";

describe("apNumber", () => {
  it("spells out one through nine and formats larger numbers", () => {
    expect(apNumber(0)).toBe("zero");
    expect(apNumber(9)).toBe("nine");
    expect(apNumber(10)).toBe("10");
    expect(apNumber(1234)).toBe("1,234");
  });
});

describe("marginText", () => {
  it("shows one decimal and a floor for near-ties", () => {
    expect(marginText(2.26)).toBe("2.3");
    expect(marginText(0.04)).toBe("<0.1");
  });
});

describe("centralTime", () => {
  it("AP style in Central time", () => {
    expect(centralTime("2026-11-04T02:19:08Z")).toBe("Nov. 3, 8:19 p.m. CST");
    expect(centralTime("2026-11-05T17:04:24Z")).toBe("Nov. 5, 11:04 a.m. CST");
  });
});

describe("timeAgo", () => {
  const t = Date.parse("2026-11-05T17:04:24Z");
  it("minutes, hours, then the full time", () => {
    expect(timeAgo("2026-11-05T17:04:24Z", t + 30_000)).toBe("just now");
    expect(timeAgo("2026-11-05T17:04:24Z", t + 12 * 60_000)).toBe("12 min. ago");
    expect(timeAgo("2026-11-05T17:04:24Z", t + 3 * 3_600_000 + 5)).toBe("3 hr. ago");
    expect(timeAgo("2026-11-05T17:04:24Z", t + 25 * 3_600_000)).toBe("Nov. 5, 11:04 a.m.");
  });
  it("relativeAge is null after a day", () => {
    expect(relativeAge("2026-11-05T17:04:24Z", t + 90 * 60_000)).toBe("1 hr. ago");
    expect(relativeAge("2026-11-05T17:04:24Z", t + 25 * 3_600_000)).toBeNull();
  });
});
