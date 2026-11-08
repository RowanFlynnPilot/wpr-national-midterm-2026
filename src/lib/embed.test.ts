import { describe, expect, it } from "vitest";
import { compactEmbedSnippet, EMBED_ID, pageEmbedSnippet, raceEmbedSnippet } from "./embed";

describe("pageEmbedSnippet", () => {
  it("embeds the page with a home state and forwards the article's hash", () => {
    const s = pageEmbedSnippet("https://example.github.io/tool/", "MN");
    expect(s).toContain(`id="${EMBED_ID}"`);
    expect(s).toContain("f.src = 'https://example.github.io/tool/?home=MN' + location.hash;");
    expect(s).toContain("e.origin !== 'https://example.github.io'");
    expect(s).toContain(`e.data.id === '${EMBED_ID}'`);
    expect(s).toContain("clipboard-write; web-share");
    expect(s).not.toContain('"'.repeat(2));
  });
  it("without a home state the page is Wisconsin's", () => {
    expect(pageEmbedSnippet("https://example.github.io/tool/", null)).toContain("f.src = 'https://example.github.io/tool/' + location.hash;");
  });
});

describe("compactEmbedSnippet", () => {
  it("names the module's own container and height message", () => {
    const s = compactEmbedSnippet("https://example.github.io/tool/compact.html");
    expect(s).toContain(`id="${EMBED_ID}-compact"`);
    expect(s).toContain(`e.data.id === '${EMBED_ID}-compact'`);
    expect(s).toContain("f.src = 'https://example.github.io/tool/compact.html';");
  });
});

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
