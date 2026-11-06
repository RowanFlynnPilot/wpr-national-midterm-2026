# wpr-national-midterm-2026

Reader-facing explorer of every Nov. 3, 2026 U.S. Senate, House and governor race, for Wausau Pilot & Review.
Built Nov. 5, 2026, two days after the election, while ~34 races were still uncalled.

## Stack

Python fetch/build → static JSON in `public/data/` → React + TypeScript + Vite + d3-geo → GitHub Pages → WordPress iframe.
No Python dependencies (stdlib only). Node 22.

```
npm install
npm run data      # fetch civicAPI + rebuild public/data/{results,counties-S,counties-G}.json
npm run dev       # local server
npm run build     # type-check + production build to dist/
npm test          # Vitest: src/lib/*.test.ts against src/lib/__fixtures__/races.json (19 real races frozen Nov. 5)
npm run hexmap    # ONLY when district maps change (run `npm run data` first): regenerates public/data/house-hex.json
npm run screens   # Playwright screenshots of every view at 390/768/1280/1600 into screens/ (build first); fails on console errors
```

## Map shapes

`public/data/us-albers-10m.json` is a committed copy of us-atlas 3.0.1's `counties-albers-10m.json` (Census boundaries
pre-projected to Albers USA, 975×610). It is the single copy: the front end fetches it in parallel with the results
(`src/lib/data.ts` → `buildGeo`), `pipeline/build.py` reads it for the county FIPS/name index, and `scripts/hexmap.mjs`
for county centroids. It is not in the JS bundle (JS is ~62 KB gzipped). `index.html` preloads all five data files.

## Data source: civicAPI only

- `https://civicapi.org/api/v2/race/search` (all races on 2026-11-03) and `/race/{id}` (candidates, call time, county breakdown).
- Terms: free for commercial use; **attribution required** (footer links civicapi.org). Keep it.
- Race calls are civicAPI's own and can differ from AP/DDHQ. The footer says so.
- The NYT results JSON is reachable but not licensed for republication. Do not use it.

## Pipeline

- `pipeline/fetch.py` — writes `pipeline/raw/` (gitignored). Fails if counts are not exactly 35 Senate / 435 House / 36 governor.
- `pipeline/build.py` — normalizes to the front-end schema (`src/lib/types.ts`). Fails the build on impossible states (`check_race`): two winners, a winner plus runoff finalists, negative votes, shares past 100%, reporting outside 0–100, a Senate/governor race with no seat holder in baselines, or county rows summing more than 2% away from the statewide total. Party codes: Democratic→D, Republican→R, everything else→I (the panel shows the real party name). Candidates under 1% fold into "Others" (max 5 kept).
- County rows: `[pctReporting, votes for race.cands[0..2] (excluding Others), all other votes]`. New England and Alaska use civicAPI's County/Borough aggregate rows, not towns or House districts.
- Alaska: civicAPI uses the 2019 split census areas (02063, 02066); us-atlas still draws Valdez-Cordova (02261), so they're merged (`FIPS_MERGE`).
- A few counties come without FIPS (Le Flore OK, Lewis and Clark MT, Oglala Lakota SD, three MN); resolved by name against us-atlas. Any unresolved county fails the build.
- `pipeline/baselines.json` — hand-maintained pre-election seat holders (Senate and governor by state) and pre-election totals. House baseline = 2024 result (D 215, R 220).

## Race status rules (`src/lib/status.ts`, `pipeline/build.py`)

- **won** — civicAPI `winner`. **runoff** — a candidate is `advanced`, or Louisiana House with no one at 50% (`MAJORITY_RUNOFF`; LA moved its House primaries to Nov. 3 with a Dec. 12 runoff, and civicAPI flags finalists only once second place is settled). **decided** — top-two finalists from one party (CA-04/07/11/14, CA-40): the seat counts for that party before a call. **leading** — everything else.
- `unopposed` — one non-"Others" candidate. Florida doesn't print unopposed races, so FL-10 has zero votes; the card says so.
- Ranked-choice note (Alaska, Maine federal races) appears only when no one has a majority of first choices.
- Nevada's "None of These Candidates" is party `O`, "Ballot option".

## Known data limits (deliberate choices)

- **No House seat-by-seat flips.** civicAPI flags only ~50 of ~370 incumbents, and several states redrew maps in 2025–26. The House shows called/leading only; the panel explains why.
- `percent_reporting` is civicAPI's figure, labeled "% reporting". Some states show 100% while uncalled (CA counts ballots for weeks).
- `calledAt` is missing on ~34 races civicAPI called without a timestamp; the card shows "Winner called" for those.

## House hex cartogram (`scripts/hexmap.mjs`)

Each district's target = vote-weighted centroid of the counties it covers (from civicAPI county breakdowns, so it reflects 2026 maps). State centers are pulled together (SHRINK 0.60), separated by a collision force, and slid inward slightly (GRAVITY 0.012). Then each state grows a contiguous hex blob toward its own district targets, and districts are assigned to hexes inside the blob by pairwise-swap descent. The output is committed and **not** regenerated on the cron, because vote weights shift and districts would move.

## Front end

- `src/App.tsx` — selection state + hash routing (`#senate`, `#senate-tx`, `#house-wi`, `#house-wi-03`, `#governors-ks`).
- `src/lib/summary.ts` — chamber tallies, data-driven headline and dek. Senate majority 51 (VP is a Republican), House 218, no majority marker for governors.
- `src/components/NationalMap.tsx` — states/counties map on us-atlas Albers USA (pre-projected; no projection at runtime). Small NE states get callout chips.
- `src/components/HexMap.tsx`, `SidePanel.tsx`, `RaceCard.tsx`, `CountyMap.tsx`, `RaceTable.tsx` (table view = accessible twin of the maps).
- Colors validated with the dataviz palette checker on cream: D `#2D63A6`, R `#C23A30`, Ind/other `#B88A1E` (below 3:1, always paired with a label). Pale tints = leading, not called.
- WPR design system: teal `#3A867C`, cream `#F6F2E9`, Fraunces (headlines), Public Sans (UI, hero numbers), JetBrains Mono (vote counts in tables).

## WordPress embed

`src/lib/embed.ts` posts `{type: "wpr-embed-height", id: "wpr-national-midterm-2026", height}` to the parent whenever
`document.body` resizes (standard WPR shape, same as wpr-auto-loan and wpr-tip-desk). The snippet forwards the article's
hash into the iframe so a shared link opens on the right view, and passes the article URL as `?host=` so "Copy link"
(`src/lib/share.ts`) produces an article link, not the Pages URL. Only `https://*.wausaupilotandreview.com` is accepted as a host.
`allow="clipboard-write"` is what lets the copy button work inside the frame.

```html
<div id="wpr-national-midterm-2026"></div>
<script>
(function () {
  var f = document.createElement('iframe');
  f.src = 'https://rowanflynnpilot.github.io/wpr-national-midterm-2026/?host='
    + encodeURIComponent(location.origin + location.pathname) + location.hash;
  f.style.cssText = 'width:100%;border:0;min-height:900px';
  f.allow = 'clipboard-write';
  f.title = '2026 midterm election results';
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://rowanflynnpilot.github.io') return;
    if (e.data && e.data.type === 'wpr-embed-height' && e.data.id === 'wpr-national-midterm-2026')
      f.style.height = e.data.height + 'px';
  });
  document.getElementById('wpr-national-midterm-2026').appendChild(f);
})();
</script>
```

## Sharing and freshness

- `share.html` + `src/share.tsx` render `ShareCard` (balance of power, 1200×630). `scripts/share-image.mjs` screenshots it to
  `dist/share.png` as the last step of `npm run build` and stamps `?v=<fetched>` onto the og:image URL in `dist/index.html`
  so crawlers refetch after each data run. Open Graph and Twitter tags live in `index.html`.
- `.stale` notice appears when `results.fetched` is more than three hours old (`isStale`, re-checked every minute).

## Deploy

`.github/workflows/update-results.yml` fetches, tests, builds (including share.png via a cached Playwright Chromium) and deploys to Pages hourly (each run makes ~500 civicAPI requests; keep it gentle on a free API). Enable Pages → Source: "GitHub Actions" in repo settings, and run the workflow once by hand to publish. If a fetch or build fails, nothing deploys and the last good version stays up. Stop the cron once states certify (late November into December).

## AP cross-check (Nov. 5, 2026)

Every race civicAPI called by under 3 points (27 races) was checked against AP reporting. 26 agree. **NY-21** (Constantino R +2.1)
is called by civicAPI and Decision Desk HQ but was not called by AP as of Nov. 5; left as civicAPI reports it. civicAPI called
FL-13 nearly two days before AP. Its `percent_reporting` lags AP on several called races (TN-09, NJ-02, NY-02, TN-07, TN governor).

## Next steps

1. Settings → Pages → Source: GitHub Actions, then run "Update results" once by hand.
2. Later: statewide ballot measures as a fourth tab (~169 in civicAPI).
