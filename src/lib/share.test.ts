import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, isStale, shareUrl } from "./share";

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

describe("isStale", () => {
  const fetched = "2026-11-06T02:07:35Z";
  it("flags results fetched more than three hours ago", () => {
    expect(isStale(fetched, Date.parse(fetched) + STALE_AFTER_MS - 1)).toBe(false);
    expect(isStale(fetched, Date.parse(fetched) + STALE_AFTER_MS + 1)).toBe(true);
  });
});
