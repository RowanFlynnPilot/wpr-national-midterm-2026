import { describe, expect, it } from "vitest";
import { homeState, stateName } from "./states";

describe("homeState", () => {
  it("is Wisconsin unless the page is opened with ?home=", () => {
    expect(homeState("")).toBe("WI");
    expect(homeState("?host=https%3A%2F%2Fwausaupilotandreview.com%2Fx")).toBe("WI");
    expect(homeState("?home=mn")).toBe("MN");
    expect(homeState("?demo&home=TX")).toBe("TX");
  });
  it("fails on a code that is not a state", () => {
    expect(() => homeState("?home=ZZ")).toThrow("unknown home state ZZ");
    expect(() => homeState("?home=DC")).toThrow();
    expect(() => homeState("?home=")).toThrow();
  });
  it("names states by postal code", () => {
    expect(stateName("WI")).toBe("Wisconsin");
    expect(() => stateName("ZZ")).toThrow();
  });
});
