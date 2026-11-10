import { describe, expect, it } from "vitest";
import { apNumber, centralTime, marginText, marginWords, relativeAge, reportingShare, reportingText, sentenceStart, signedMargin, timeAgo } from "./format";

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
  it("reads as words inside a sentence", () => {
    expect(marginWords(2.26)).toBe("2.3");
    expect(marginWords(0.04)).toBe("less than 0.1");
  });
  it("signs a caption's margin, and gives no sign to a figure it cannot show", () => {
    expect(signedMargin(2.26)).toBe("+2.3");
    expect(signedMargin(-0.44)).toBe("−0.4");
    expect(signedMargin(0.04)).toBe("<0.1");
    expect(signedMargin(-0.04)).toBe("<0.1 behind");
  });
});

describe("sentenceStart", () => {
  it("capitalizes the first letter only", () => {
    expect(sentenceStart("three not called")).toBe("Three not called");
    expect(sentenceStart("12 not called")).toBe("12 not called");
  });
});

describe("reportingShare", () => {
  it("rounds the share, and gives none for a zero beside a vote count", () => {
    expect(reportingShare(73.9, 214_246)).toBe("74%");
    expect(reportingShare(0, 0)).toBe("0%"); // nothing counted yet: zero is the truth
    expect(reportingShare(0, 204_985)).toBeNull(); // Alaska's measures: civicAPI gives no share
    expect(reportingText(99.9, 1_912_061)).toBe("100% reporting");
    expect(reportingText(0, 204_985)).toBe("Share reporting not given");
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
