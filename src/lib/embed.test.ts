import { describe, expect, it } from "vitest";
import { EMBED_ID, raceEmbedSnippet } from "./embed";

describe("raceEmbedSnippet", () => {
  it("names the race's own container and height message, and points race.html at the hash", () => {
    const s = raceEmbedSnippet("governors-wi", "Wisconsin Governor", "https://example.github.io/tool/race.html");
    expect(s).toContain(`id="${EMBED_ID}-race-governors-wi"`);
    expect(s).toContain(`'${EMBED_ID}-race-governors-wi'`);
    expect(s).toContain("https://example.github.io/tool/race.html?host=");
    expect(s).toContain("#governors-wi");
    expect(s).toContain("e.origin !== 'https://example.github.io'");
    expect(s).toContain("Wisconsin Governor: 2026 result");
    expect(s).not.toContain('"'.repeat(2)); // single quotes inside, so it pastes into an HTML block whole
  });
  it("escapes a title with a quote", () => {
    const s = raceEmbedSnippet("measures-wi-1", "Wisconsin Question 1 - Prohibit \"Partial\" Veto", "https://x.test/race.html");
    expect(s).toContain("Prohibit &quot;Partial&quot; Veto");
  });
});
