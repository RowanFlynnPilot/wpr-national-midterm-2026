import { describe, expect, it } from "vitest";
import { parseHash, toHash } from "./route";

describe("parseHash and toHash", () => {
  it("round-trip every kind of view", () => {
    for (const h of ["senate", "senate-tx", "house", "house-wi", "house-wi-03", "governors-ks", "measures", "measures-wi", "measures-wi-179849"]) {
      expect(toHash(parseHash(`#${h}`))).toBe(h);
    }
  });
  it("defaults to the Senate overview and ignores junk", () => {
    expect(parseHash("")).toEqual({ office: "S", state: null, district: null });
    expect(parseHash("#nonsense-zz")).toEqual({ office: "S", state: "ZZ", district: null });
    expect(parseHash("#senate-tx-05")).toEqual({ office: "S", state: "TX", district: null }); // a statewide race has no district
  });
});
