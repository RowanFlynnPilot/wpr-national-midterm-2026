import { describe, expect, it } from "vitest";
import { racesCsv, toCsv } from "./csv";
import { race } from "./fixture";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines, and ends every line with CRLF", () => {
    expect(toCsv([["a", 1, null], ['say "hi", now', "x\ny"]])).toBe('a,1,\r\n"say ""hi"", now","x\ny"\r\n');
  });
});

describe("racesCsv", () => {
  it("spells out the top two candidates with the race's status and timing", () => {
    const csv = racesCsv([race("S", "TX"), race("H", "LA-05")]);
    const [header, tx, la] = csv.trim().split("\r\n") as [string, string, string];
    expect(header.startsWith("office,state,race,status,leader,leader_party,leader_pct,leader_votes")).toBe(true);
    expect(tx).toContain("S,Texas,Texas Senate,Winner called. Flipped from Republican,James Talarico,D,55.03,5445156,Ken Paxton,R,42.95,4249762,12.08,98.9");
    expect(la).toContain('"Patricia ""Pat"" Moore"'); // quotes inside a name are doubled
    expect(la).toContain("Headed to a Dec. 12 runoff");
  });
});
