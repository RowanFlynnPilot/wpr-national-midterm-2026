import { describe, expect, it } from "vitest";
import { stateName } from "./states";

describe("stateName", () => {
  it("names states by postal code", () => {
    expect(stateName("WI")).toBe("Wisconsin");
    expect(() => stateName("ZZ")).toThrow();
  });
});
