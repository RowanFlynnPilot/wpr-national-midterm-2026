import { describe, expect, it } from "vitest";
import { parseHash, toHash } from "./route";

describe("parseHash and toHash", () => {
  it("round-trip every kind of view", () => {
    for (const h of ["senate", "senate-tx", "house", "house-wi", "house-wi-03", "governors-ks", "measures", "measures-wi", "measures-wi-179849", "governors-wi-55073", "senate-tx-48201", "house-in-18097"]) {
      expect(toHash(parseHash(`#${h}`))).toBe(h);
    }
  });
  it("defaults to the Senate overview and ignores junk", () => {
    expect(parseHash("")).toEqual({ office: "S", state: null, district: null });
    expect(parseHash("#nonsense-zz")).toEqual({ office: "S", state: "ZZ", district: null });
    expect(parseHash("#senate-tx-05")).toEqual({ office: "S", state: "TX", district: null }); // a statewide race has no district
  });
  it("reads a county only inside its own state, on the Senate, governor and House views", () => {
    expect(parseHash("#governors-wi-55073")).toEqual({ office: "G", state: "WI", district: null, county: "55073" });
    expect(parseHash("#senate-wi-48201")).toEqual({ office: "S", state: "WI", district: null }); // a Texas county is not in Wisconsin
    expect(parseHash("#house-wi-55073")).toEqual({ office: "H", state: "WI", district: null, county: "55073" });
    expect(parseHash("#house-wi-18097")).toEqual({ office: "H", state: "WI", district: "WI-18097" }); // an Indiana county reads as a district Wisconsin does not have
    expect(parseHash("#measures-wi-55073")).toEqual({ office: "B", state: "WI", district: "WI-55073" }); // a measure's id: measures have no county pages
    expect(toHash({ office: "S", state: "TX", district: null })).toBe("senate-tx");
  });
});
