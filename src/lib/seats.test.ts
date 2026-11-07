import { describe, expect, it } from "vitest";
import { RESULTS } from "./fixture";
import { chamberSeats } from "./seats";
import { chamber } from "./summary";
import type { Race } from "./types";

describe("chamberSeats", () => {
  it("draws one seat per holdover and per race, left block, middle, right block", () => {
    for (const office of ["S", "H", "G", "B"] as const) {
      const c = chamber(RESULTS, office);
      const seats = chamberSeats(c);
      expect(seats.length).toBe(c.notUp.D + c.notUp.R + c.races.length);
      expect(seats.filter((s) => s.race === null).length).toBe(c.notUp.D + c.notUp.R);
      const side = seats.map((s) => (s.kind === "runoff" ? "M" : s.party === "D" || s.party === "Y" ? "L" : s.party === "R" || s.party === "N" ? "R" : "M"));
      expect(side.join("")).toMatch(/^L*M*R*$/);
    }
  });

  it("puts the closest races nearest the middle on both sides", () => {
    const seats = chamberSeats(chamber(RESULTS, "S"));
    const margins = (party: "D" | "R") => seats.filter((s) => s.party === party && s.kind === "won").map((s) => (s.race as Race).margin);
    expect(margins("D")).toEqual([...margins("D")].sort((a, b) => b - a)); // widest first: the left edge inward
    expect(margins("R")).toEqual([...margins("R")].sort((a, b) => a - b)); // closest first: the middle outward
    const first = seats[0] as (typeof seats)[number];
    expect(first.kind).toBe("notUp"); // Democrats' holdovers at the far left
    expect(first.race).toBeNull();
  });
});
