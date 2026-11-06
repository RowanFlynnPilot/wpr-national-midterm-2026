// Candidate headshots for the top two candidates in every race, where a trustworthy
// source exists. Run by hand (`npm run headshots`), never on the cron: it makes a few
// thousand requests and the result is reviewed, committed and reused.
//
// Sources, in order:
//   1. Sitting members of Congress: the unitedstates/congress-legislators dataset matched
//      on name and state, portrait from the unitedstates/images repo (public domain).
//   2. Wikidata: an entity whose label is the candidate's name, that is a human with an
//      English Wikipedia article whose intro mentions the race's state and a political role.
//      Exactly one such entity, or no match. The photo is the article's lead image (Wikidata's
//      own image claim can be stale: Nick Begich III's was his grandfather's portrait), via
//      Wikimedia Commons, kept only under CC BY, CC BY-SA, CC0 or public domain, with author
//      and license recorded for the credits page.
//   3. pipeline/headshots-overrides.json: { "<candidate_id>": "Q123" } forces a Wikidata
//      entity; { "<candidate_id>": null } suppresses a photo. Review tool for the newsroom.
//
// Writes public/headshots/<candidate_id>.webp (96x96), pipeline/headshots.json (the
// manifest build.py reads) and public/credits.html. Already-resolved candidates are kept,
// so reruns only look up new names.
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";
import { STATE_NAME } from "../src/lib/states.ts";

const UA = "wpr-national-midterm-2026/1.0 (Wausau Pilot & Review; https://wausaupilotandreview.com)";
const OUT_DIR = "public/headshots";
const MANIFEST = "pipeline/headshots.json";
const OVERRIDES = "pipeline/headshots-overrides.json";
const SIZE = 96;
const ROLE = /politic|Representative|Senator|Governor|legislat|Assembly|mayor|council|candidate|attorney general|secretary of state|lieutenant governor/i;
const LICENSE_OK = /^(CC BY(-SA)?( \d(\.\d)?)?|CC0|Public domain|PD|Copyrighted free use)/i; // Commons "free use" permits any use with attribution
const NOT_A_PORTRAIT = /seal|flag|logo|map|coat.of.arms|emblem|\.svg|signature|banner/i; // an infobox placeholder, not the person

/** The Commons file name behind an upload.wikimedia.org URL, thumbnail or original. */
function commonsFile(url) {
  const parts = new URL(url).pathname.split("/").map(decodeURIComponent);
  const i = parts.indexOf("thumb");
  return (i === -1 ? parts[parts.length - 1] : parts[parts.length - 2]).replace(/_/g, " ");
}
const TOP = 2;

const results = JSON.parse(readFileSync("public/data/results.json", "utf8"));
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf8")) : {};
mkdirSync(OUT_DIR, { recursive: true });

async function get(url, type = "json") {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt)); // 3, 6, 12, 24, 48 s
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return type === "json" ? res.json() : Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`gave up on ${url}`);
}

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
/** "Jonathan S. "JKT" Kreiss-Tomkins" -> { first: "jonathan", full: "jonathan kreiss tomkins" } */
function parseName(name) {
  const tokens = name
    .replace(/["“”][^"“”]*["“”]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/^(jr|sr|ii|iii|iv|v)\.?,?$/i.test(t) && !/^[A-Z]\.?$/.test(t));
  const full = fold(tokens.join(" "));
  return { first: full.split(" ")[0] ?? "", full };
}

// --- 1. Congress -------------------------------------------------------------
const legislators = await get("https://unitedstates.github.io/congress-legislators/legislators-current.json");
function congressMatch(cand, state) {
  const { first, full } = parseName(cand.name);
  const hits = legislators.filter((l) => {
    const term = l.terms[l.terms.length - 1];
    if (term.state !== state) return false;
    const last = fold(l.name.last);
    if (!full.endsWith(last)) return false;
    return [l.name.first, l.name.nickname, l.name.official_full?.split(" ")[0]].filter(Boolean).some((f) => fold(f).split(" ")[0] === first);
  });
  return hits.length === 1 ? hits[0] : null;
}

// --- 2. Wikidata -------------------------------------------------------------
async function wikidataMatch(cand, state, forcedId) {
  const { full } = parseName(cand.name);
  let ids;
  if (forcedId) ids = [forcedId];
  else {
    const search = await get(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(full)}&language=en&type=item&format=json&limit=10`);
    ids = search.search.filter((h) => parseName(h.label ?? "").full === full).map((h) => h.id); // same suffix rules as the candidate
    if (!ids.length) return null;
  }
  const entities = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=claims|sitelinks&format=json`);
  const accepted = [];
  for (const id of ids) {
    const ent = entities.entities[id];
    const claims = ent?.claims ?? {};
    const human = (claims.P31 ?? []).some((c) => c.mainsnak.datavalue?.value?.id === "Q5");
    const title = ent?.sitelinks?.enwiki?.title;
    if (!human || !title) continue;
    // Namesakes from history: anyone with a date of death, or born before 1920, is not on a 2026 ballot.
    const born = claims.P569?.[0]?.mainsnak?.datavalue?.value?.time;
    if (claims.P570?.length || (born && Number(born.slice(1, 5)) < 1920)) continue;
    const summary = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`).catch(() => null);
    if (!forcedId) {
      const extract = summary?.extract ?? "";
      if (!extract.includes(STATE_NAME[state]) || !ROLE.test(extract)) continue;
    }
    // The article's lead image first (Wikidata's image claim can be stale); the claim only when the
    // article shows a placeholder such as a state seal instead of the person.
    const lead = summary?.originalimage?.source ? commonsFile(summary.originalimage.source) : null;
    const claim = claims.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
    const image = [lead, claim].find((f) => f && !NOT_A_PORTRAIT.test(f));
    if (!image) continue;
    accepted.push({ id, image, title });
  }
  if (accepted.length !== 1) {
    if (accepted.length > 1) console.log(`  ambiguous: ${cand.name} (${state}) -> ${accepted.map((a) => a.id).join(", ")}`);
    return null;
  }
  const hit = accepted[0];
  const info = await get(`https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(hit.image)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&format=json`);
  const page = Object.values(info.query.pages)[0];
  const ii = page.imageinfo?.[0];
  const meta = ii?.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? "";
  if (!ii?.thumburl || !LICENSE_OK.test(license)) {
    console.log(`  license not usable: ${cand.name} -> ${hit.image} (${license || "none"})`);
    return null;
  }
  const strip = (html) => (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/This (image|file) .*$/, "").trim().slice(0, 80);
  return {
    source: "commons",
    wikidata: hit.id,
    url: ii.thumburl,
    page: `https://commons.wikimedia.org/wiki/File:${hit.image.replace(/ /g, "_")}`,
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
    credit: strip(meta.Artist?.value) || strip(meta.Credit?.value) || "Wikimedia Commons",
  };
}

// --- run ---------------------------------------------------------------------
const queue = [];
for (const race of results.races) {
  if (race.office === "B") continue; // a ballot measure's "candidates" are Yes and No
  const cands = race.cands.filter((c) => c.party !== "O").slice(0, TOP);
  for (const c of cands) queue.push({ cand: c, state: race.state });
}
let looked = 0, found = 0;
const todo = queue.filter(({ cand }) => !(cand.id in manifest) || (cand.id in overrides && manifest[cand.id]?.override !== JSON.stringify(overrides[cand.id])));
console.log(`${queue.length} candidates, ${todo.length} to resolve`);

async function resolve({ cand, state }) {
  looked++;
  const override = overrides[cand.id];
  let match = null;
  if (cand.id in overrides && override === null) match = null;
  else {
    const member = override ? null : congressMatch(cand, state);
    if (member) {
      match = {
        source: "congress",
        bioguide: member.id.bioguide,
        url: `https://unitedstates.github.io/images/congress/450x550/${member.id.bioguide}.jpg`,
        page: `https://bioguide.congress.gov/search/bio/${member.id.bioguide}`,
        license: "Public domain",
        licenseUrl: null,
        credit: "U.S. Congress",
      };
    } else {
      try {
        match = await wikidataMatch(cand, state, override ?? null);
      } catch (err) {
        // A failed lookup is not "no photo": leave the candidate out of the manifest so the next run retries.
        console.log(`  error: ${cand.name}: ${err.message}`);
        return;
      }
    }
  }
  const entry = { name: cand.name, state, override: cand.id in overrides ? JSON.stringify(override) : undefined };
  if (match) {
    let buf;
    try {
      buf = await get(match.url, "buffer");
    } catch (err) {
      if (match.source === "congress" && /^404/.test(err.message)) {
        // The portrait repo lags new members; the Wikidata tier usually has them.
        match = await wikidataMatch(cand, state, override ?? null).catch((e) => (console.log(`  error: ${cand.name}: ${e.message}`), undefined));
        if (match === undefined) return;
        if (match) buf = await get(match.url, "buffer").catch((e) => (console.log(`  error: ${cand.name}: ${e.message}`), null));
        if (match && !buf) return;
      } else {
        console.log(`  error: ${cand.name}: ${err.message}`);
        return;
      }
    }
    if (match) {
      await sharp(buf).rotate().resize(SIZE, SIZE, { fit: "cover", position: sharp.strategy.attention }).webp({ quality: 82 }).toFile(`${OUT_DIR}/${cand.id}.webp`);
      Object.assign(entry, match, { file: `${cand.id}.webp` });
      found++;
    }
  }
  manifest[cand.id] = entry;
  if (looked % 25 === 0) {
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1)); // progress survives a crash
    console.log(`  ${looked}/${todo.length} looked up, ${found} photos`);
  }
}

const CONCURRENCY = 2; // Wikimedia rate-limits bursts
let i = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (i < todo.length) await resolve(todo[i++]);
}));

const ordered = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => Number(a) - Number(b)));
writeFileSync(MANIFEST, JSON.stringify(ordered, null, 1));
// Only files the manifest points at ship; anything left from an earlier run goes.
const referenced = new Set(Object.values(ordered).map((e) => e.file).filter(Boolean));
for (const f of readdirSync(OUT_DIR)) if (!referenced.has(f)) unlinkSync(`${OUT_DIR}/${f}`);
const withPhoto = Object.entries(ordered).filter(([, e]) => e.file);
console.log(`done: ${withPhoto.length} of ${Object.keys(ordered).length} candidates have a photo (${withPhoto.filter(([, e]) => e.source === "congress").length} Congress, ${withPhoto.filter(([, e]) => e.source === "commons").length} Commons)`);

// --- credits page ------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const rows = withPhoto
  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
  .map(([id, e]) => `<tr><td><img src="headshots/${id}.webp" width="32" height="32" alt="" loading="lazy"></td><td>${esc(e.name)} (${esc(e.state)})</td><td><a href="${esc(e.page)}">${e.source === "congress" ? "U.S. Congress" : "Wikimedia Commons"}</a></td><td>${esc(e.credit)}</td><td>${e.licenseUrl ? `<a href="${esc(e.licenseUrl)}">${esc(e.license)}</a>` : esc(e.license)}</td></tr>`)
  .join("\n");
writeFileSync(
  "public/credits.html",
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Photo credits — 2026 Midterm Election Results</title>
<style>
@font-face{font-family:"Fraunces";font-weight:400 700;font-display:swap;src:url("fonts/fraunces.woff2") format("woff2")}
@font-face{font-family:"Public Sans";font-weight:400 700;font-display:swap;src:url("fonts/public-sans.woff2") format("woff2")}
body{margin:0;padding:1.5rem;background:#f6f2e9;color:#1d1b17;font:400 15px/1.5 "Public Sans",system-ui,sans-serif}
.flag{display:flex;align-items:center;gap:14px;padding:1rem 0 .75rem;margin-bottom:1.25rem;border-top:4px solid #32373c;border-bottom:1px solid #32373c}
.flag img{mix-blend-mode:multiply}.flag .wm{height:34px;width:auto}
h1{font:600 1.6rem/1.2 Fraunces,Georgia,serif;margin:0 0 .5rem}p{max-width:70ch;color:#4e4a42}
table{border-collapse:collapse;width:100%;margin-top:1rem;font-size:.875rem}td{padding:.4rem .5rem;border-bottom:1px solid #d9d1c1;vertical-align:middle}
img{border-radius:50%;display:block}a{color:#2b6b62}
</style>
</head>
<body>
<header class="flag"><img src="brand/wpr-typewriter-badge.png" alt="" width="44" height="44"><a href="https://wausaupilotandreview.com/"><img class="wm" src="brand/wpr-wordmark.png" alt="Wausau Pilot &amp; Review" width="640" height="82"></a></header>
<h1>Candidate photo credits</h1>
<p>Portraits of sitting members of Congress are official photographs in the public domain. Other candidate photos come from Wikimedia Commons under the license shown; click the source for the original file. To report a wrong photo, email the Wausau Pilot &amp; Review newsroom.</p>
<table>${rows}</table>
</body>
</html>
`,
);
