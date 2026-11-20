import { describe, expect, it } from "vitest";
import { NEWSROOMS, OWNER, WPR } from "../newsrooms";
import { newsroom, onSite, sitesPattern } from "./newsroom";
import { STATE_NAME } from "./states";

describe("newsroom", () => {
  it("is the owner unless the page is opened with ?partner=", () => {
    expect(newsroom("")).toEqual({ ...WPR, slug: OWNER });
    expect(newsroom("?host=https%3A%2F%2Fwausaupilotandreview.com%2Fx").slug).toBe(OWNER);
    expect(newsroom("?partner=demo").slug).toBe("demo");
    expect(newsroom("?partner=demo").name).toBe("Your Newsroom");
  });

  it("fails on a slug that is not in the registry, inherited names included", () => {
    expect(() => newsroom("?partner=nobody")).toThrow("unknown partner nobody");
    expect(() => newsroom("?partner=toString")).toThrow("unknown partner toString");
    expect(() => newsroom("?partner=")).toThrow();
    expect(() => newsroom("?partner=WPR")).toThrow();
  });

  it("?home= moves the home state of whichever newsroom is picked", () => {
    expect(newsroom("").home).toBe("WI");
    expect(newsroom("?home=mn").home).toBe("MN");
    expect(newsroom("?demo&home=TX").home).toBe("TX");
    expect(newsroom("?partner=demo&home=oh").home).toBe("OH");
  });

  it("fails on a home that is not a state", () => {
    expect(() => newsroom("?home=ZZ")).toThrow("unknown home state ZZ");
    expect(() => newsroom("?home=DC")).toThrow();
    expect(() => newsroom("?home=")).toThrow();
  });
});

describe("onSite", () => {
  const gazette = { ...WPR, domain: "gazette.example" };

  it("accepts a newsroom's domain and its subdomains over https, and nothing else", () => {
    expect(onSite(new URL("https://gazette.example/results/"), gazette)).toBe(true);
    expect(onSite(new URL("https://www.gazette.example/results/"), gazette)).toBe(true);
    expect(onSite(new URL("http://gazette.example/results/"), gazette)).toBe(false);
    expect(onSite(new URL("https://notgazette.example/"), gazette)).toBe(false);
    expect(onSite(new URL("https://gazette.example.evil.test/"), gazette)).toBe(false);
    expect(onSite(new URL("https://wausaupilotandreview.com/"), gazette)).toBe(false);
  });
});

describe("sitesPattern", () => {
  it("matches a host on any registered domain and no other", () => {
    const pattern = new RegExp(sitesPattern());
    expect(pattern.test("wausaupilotandreview.com")).toBe(true);
    expect(pattern.test("www.wausaupilotandreview.com")).toBe(true);
    expect(pattern.test("notwausaupilotandreview.com")).toBe(false);
    expect(pattern.test("wausaupilotandreview.com.evil.test")).toBe(false);
    expect(pattern.test("wausaupilotandreviewxcom")).toBe(false);
  });
});

describe("the registry", () => {
  const entries = Object.entries(NEWSROOMS);
  const onDisk = Object.keys(import.meta.glob("/public/sponsors/*")); // the logo files, by Vite's own listing

  it("has the owner, and slugs a share stub can pass along", () => {
    expect(NEWSROOMS[OWNER]).toBe(WPR);
    for (const [slug] of entries) expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(onDisk).toContain("/public/sponsors/README.md"); // the listing sees the folder, so the logo check below is not empty
  });

  it.each(entries)("%s: a state, an https site on its own domain, a sales address and logos on disk", (_slug, room) => {
    expect(room.home in STATE_NAME && room.home !== "DC").toBe(true);
    expect(room.domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    expect(onSite(new URL(room.site), room)).toBe(true);
    expect(room.salesEmail).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
    expect(room.name.trim()).toBe(room.name);
    expect(room.name).not.toBe("");
    for (const sponsor of Object.values(room.sponsors)) {
      if (sponsor?.logo) expect(onDisk).toContain(`/public/sponsors/${sponsor.logo}`);
    }
  });
});
