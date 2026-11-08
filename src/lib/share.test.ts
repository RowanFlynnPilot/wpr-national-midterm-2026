import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, isStale, raceShareUrl, shareUrl } from "./share";

const page = "https://rowanflynnpilot.github.io/wpr-national-midterm-2026/";

describe("shareUrl", () => {
  it("standalone: this page plus the view hash, replacing any hash already there", () => {
    expect(shareUrl("", "#house-wi-03", page + "#senate")).toBe(page + "#house-wi-03");
  });
  it("embedded: the article URL from ?host= plus the view hash", () => {
    const host = encodeURIComponent("https://wausaupilotandreview.com/2026-results/#old");
    expect(shareUrl(`?host=${host}`, "#senate-tx", page)).toBe("https://wausaupilotandreview.com/2026-results/#senate-tx");
  });
  it("refuses a host that is not the publisher over https", () => {
    for (const host of ["https://evil.example/", "http://wausaupilotandreview.com/"])
      expect(() => shareUrl(`?host=${encodeURIComponent(host)}`, "#senate", page)).toThrow(/Refusing/);
  });
});

describe("raceShareUrl", () => {
  it("standalone: the race's stub page beside the app", () => {
    expect(raceShareUrl("", "house-wi-03", page + "#house-wi-03")).toBe(page + "s/house-wi-03.html");
    expect(raceShareUrl("", "governors-wi", page + "race.html#governors-wi")).toBe(page + "s/governors-wi.html");
  });
  it("embedded: the stub carries the article as ?to=", () => {
    const host = encodeURIComponent("https://wausaupilotandreview.com/2026-results/");
    expect(raceShareUrl(`?host=${host}`, "senate-tx", page)).toBe(page + "s/senate-tx.html?to=https%3A%2F%2Fwausaupilotandreview.com%2F2026-results%2F");
    expect(() => raceShareUrl(`?host=${encodeURIComponent("https://evil.example/")}`, "senate-tx", page)).toThrow(/Refusing/);
  });
});

describe("isStale", () => {
  const fetched = "2026-11-06T02:07:35Z";
  it("flags results fetched more than three hours ago", () => {
    expect(isStale(fetched, Date.parse(fetched) + STALE_AFTER_MS - 1)).toBe(false);
    expect(isStale(fetched, Date.parse(fetched) + STALE_AFTER_MS + 1)).toBe(true);
  });
});
