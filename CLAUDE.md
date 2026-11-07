# wpr-national-midterm-2026

Reader-facing explorer of every Nov. 3, 2026 U.S. Senate, House and governor race, plus statewide ballot measures, for Wausau Pilot & Review.
Built Nov. 5, 2026, two days after the election, while ~34 races were still uncalled.

## Stack

Python fetch/build → static JSON in `public/data/` → React + TypeScript + Vite + d3-geo → GitHub Pages → WordPress iframe.
No Python dependencies (stdlib only). Node 22.

```
npm install
npm run data      # fetch civicAPI + rebuild public/data/{results,counties-S,counties-G,counties-B}.json + record the count history
npm run dev       # local server
npm run build     # type-check + production build to dist/
npm test          # Vitest: src/lib/*.test.ts against src/lib/__fixtures__/races.json (19 real races frozen Nov. 5)
npm run hexmap    # ONLY when district maps change (run `npm run data` first): regenerates public/data/house-hex.json
npm run headshots # by hand only: resolves candidate photos into public/headshots + pipeline/headshots.json (see Candidate photos)
npm run screens   # Playwright screenshots of every view at 390/768/1280/1600 into screens/ (build first); fails on console errors
```

## Count history

`pipeline/history.py` appends one point per data run for every race without a winner (and for called races only while
their numbers still change) to `pipeline/history.json`: `{"<race id>": [[t, leader, margin, pctIn], ...]}`, t in Unix seconds
of the fetch, no point repeated for an unchanged reading. It writes `public/data/history.json`, the last 7 days for races with
two or more points. The workflow runs it after `build.py` and, after the deploy, commits `pipeline/history.json` back to main
with the skip-ci phrase in the subject (the push trigger also ignores that path), so the hourly run never retriggers itself.
GitHub scans the whole commit message for that phrase, so never mention it in your own commit bodies, or the push will not
deploy (it happened once; `gh workflow run "Update results"` is the recovery). The record step rebases with `--autostash`
because the rebuilt data files are unstaged in the runner's tree. `--backfill` replays
every `results.json` in git history; it seeded the file on Nov. 5. Front end: `src/lib/history.ts` signs each margin from
the race's current side (`readings`), `trend` compares the last two points (widening / narrowing / flipped, under 0.1 pt is
nothing), `Sparkline.tsx` draws the series on the race card, and the "still being counted" rows carry the trend glyph.
history.json is fetched after first paint and again after each live refresh.

## Candidate photos

`scripts/headshots.mjs` (Node + sharp, run by hand, never on the cron) finds a photo for the top two candidates in every race:
1. Sitting members of Congress: `unitedstates/congress-legislators` matched on name and state → public-domain portrait from
   `unitedstates/images` (falls through to tier 2 when the repo lacks a new member's portrait).
2. Wikidata: an entity whose label is the name (labels get the same suffix/initial stripping as candidate names, so
   "Nick Begich III" matches the III entity, not the grandfather), human, no date of death and not born before 1920, with an
   English Wikipedia article whose intro mentions the race's state and a political role. Exactly one such entity or no match.
   The photo is the article's lead image (Wikidata's own image claim can be stale); placeholder images (seals, flags, logos,
   SVGs) are rejected. Commons images are kept only under CC BY, CC BY-SA, CC0, public domain or Commons "free use";
   author and license go into the manifest.
3. `pipeline/headshots-overrides.json`: `{"<candidate_id>": "Q123"}` forces an entity, `{"<candidate_id>": null}` suppresses a photo.
   This is the review path: a wrong face is worse than none, so fix it here and rerun.

Output: `public/headshots/<candidate_id>.webp` (96×96), `pipeline/headshots.json` (manifest; `build.py` copies `file` onto each
candidate as `photo`, keyed by civicAPI `candidate_id`), and `public/credits.html` (per-photo source, author, license; linked
from the footer). Failed lookups are left out of the manifest so the next run retries them; resolved ones are not re-looked-up.
Candidates have `id` in results.json for this; the "Others" bucket is id 0. `build.py` fails if the manifest points at a file
that is not in `public/headshots`. Photos appear only on race cards (44px, lazy); rows and tooltips stay text, because coverage
is partial and mixed rows looked uneven. Review every Commons match on a contact sheet after a run; Congress portraits are reliable.

## Map shapes

`public/data/us-albers-10m.json` is a committed copy of us-atlas 3.0.1's `counties-albers-10m.json` (Census boundaries
pre-projected to Albers USA, 975×610). It is the single copy: the front end fetches it in parallel with the results
(`src/lib/data.ts` → `buildGeo`), `pipeline/build.py` reads it for the county FIPS/name index, and `scripts/hexmap.mjs`
for county centroids. It is not in the JS bundle (JS is ~64 KB gzipped). Only `results.json` and `house-hex.json` gate the first render
(`loadData`); the three county files (`loadCounties`, ~120 KB gzipped, in `useLive`), the atlas (`loadAtlas`, in an effect
in `App`) and `history.json` follow the first paint (`afterPaint` in `data.ts`: two animation frames plus a 150 ms margin
after the effect, because the browser reports the headline's paint some tens of milliseconds after the frame and a file
landing before that gets charged to the largest contentful paint in Lighthouse's simulation), so the headline, tabs, panel and table never wait on them and the maps
fill in as they land (`MapPending` holds the space, naming what it waits for). `buildGeo` is async and builds the 3,200
county paths in chunks of 400 with a yield between, so no task runs long on a phone. The entry point paints the WPR flag
before any data arrives.

## Data source: civicAPI only

- `https://civicapi.org/api/v2/race/search` (all races on 2026-11-03) and `/race/{id}` (candidates, call time, county breakdown).
- Terms: free for commercial use; **attribution required** (footer links civicapi.org). Keep it.
- Race calls are civicAPI's own and can differ from AP/DDHQ. The footer says so.
- The NYT results JSON is reachable but not licensed for republication. Do not use it.

## Pipeline

- `pipeline/fetch.py` — writes `pipeline/raw/` (gitignored). Fails if counts are not exactly 35 Senate / 435 House / 36 governor. Also fetches statewide ballot measures: race types Referendum / Proposition / Ballot Measure with `election_type` "Statewide", no district or municipality, and a Yes/No answer set (133 on Nov. 5; one "official state firearm" vote with six options is excluded by that rule); fails under 100.
- **Ballot measures are races with office `B`** (`build.py`): the answers are candidates with party `Y`/`N` (blank-ballot lines fold into Others), `title` holds the measure name, and `district` is `<state>-<civicAPI id>` so a measure routes like a district (`#measures-wi-179849`). Within a state they sort in natural title order (`title_key`: "Question 2" before "Question 10"), since civicAPI ids put Wisconsin's Question 2 before Question 1. County rows go to `counties-B.json` with the same row shape.
- `pipeline/build.py` — normalizes to the front-end schema (`src/lib/types.ts`). Fails the build on impossible states (`check_race`): two winners, a winner plus runoff finalists, negative votes, shares past 100%, reporting outside 0–100, a Senate/governor race with no seat holder in baselines, or county rows summing more than 2% away from the statewide total. Party codes: Democratic→D, Republican→R, everything else→I (the panel shows the real party name). Candidates under 1% fold into "Others" (max 5 kept).
- County rows: `[pctReporting, votes for race.cands[0..2] (excluding Others), all other votes]`. New England and Alaska use civicAPI's County/Borough aggregate rows, not towns or House districts.
- Alaska: civicAPI uses the 2019 split census areas (02063, 02066); us-atlas still draws Valdez-Cordova (02261), so they're merged (`FIPS_MERGE`).
- A few counties come without FIPS (Le Flore OK, Lewis and Clark MT, Oglala Lakota SD, three MN); resolved by name against us-atlas. Any unresolved county fails the build.
- `pipeline/baselines.json` — hand-maintained pre-election seat holders (Senate and governor by state) and pre-election totals. House baseline = 2024 result (D 215, R 220).

## Race status rules (`src/lib/status.ts`, `pipeline/build.py`)

- Measures: **won** with winner `Y` reads "Passed", `N` "Failed"; otherwise "Not called. Yes leads by X points". No ranked-choice note, no flips, no majority line; the tab's bar is passed / leading yes / leading no / failed.
- **no votes yet** — `total` is 0 and no winner (`noVotesYet`): neutral fill, "No votes reported yet", never a painted lead. **won** — civicAPI `winner`. **runoff** — a candidate is `advanced`, or Louisiana House with no one at 50% (`MAJORITY_RUNOFF`; LA moved its House primaries to Nov. 3 with a Dec. 12 runoff, and civicAPI flags finalists only once second place is settled). **decided** — top-two finalists from one party (CA-04/07/11/14, CA-40): the seat counts for that party before a call. **leading** — everything else.
- `unopposed` — one non-"Others" candidate. Florida doesn't print unopposed races, so FL-10 has zero votes; the card says so.
- Ranked-choice note (Alaska, Maine federal races) appears only when no one has a majority of first choices; Alaska's adds that the tabulation runs around Nov. 18. `RUNOFF_DATE` puts "Dec. 12" on Louisiana runoff text. Same-party finals read "Seat decided: both finalists are Democrats. Winner not called".
- Each race carries civicAPI's `last_updated` as `updated`; the race card footer shows it, so a race civicAPI stops updating is visible as such.
- Nevada's "None of These Candidates" is party `O`, "Ballot option".

## Known data limits (deliberate choices)

- **No House seat-by-seat flips.** civicAPI flags only ~50 of ~370 incumbents, and several states redrew maps in 2025–26. The House shows called/leading only; the panel explains why.
- `percent_reporting` is civicAPI's figure, labeled "% reporting". Some states show 100% while uncalled (CA counts ballots for weeks).
- `calledAt` is missing on ~34 races civicAPI called without a timestamp; the card shows "Winner called" for those.

## House hex cartogram (`scripts/hexmap.mjs`)

Each district's target = vote-weighted centroid of the counties it covers (from civicAPI county breakdowns, so it reflects 2026 maps). State centers are pulled together (SHRINK 0.60), separated by a collision force, and slid inward slightly (GRAVITY 0.012). Then each state grows a contiguous hex blob toward its own district targets. Interior holes left by growth are filled: the hole goes to the state touching it most, which releases its worst-placed exterior hex (a landlocked state releases one toward a neighbor and the shift ripples outward), so every state keeps one hex per district and stays contiguous. Districts are then assigned to hexes inside the blob by pairwise-swap descent. The output is committed and **not** regenerated on the cron, because vote weights shift and districts would move.

## Front end

- `src/App.tsx` — selection state + hash routing (`#senate`, `#senate-tx`, `#house-wi`, `#house-wi-03`, `#governors-ks`, `#measures`, `#measures-wi`, `#measures-wi-179849`).
- `src/lib/summary.ts` — chamber tallies, data-driven headline and dek. Senate majority 51 (VP is a Republican), House 218, no majority marker for governors. `latestCalls` = the 8 newest calls with a `calledAt` for the office (the ~34 calls civicAPI timestamps are skipped; the panel says so); shown on the overview panel with `timeAgo`.
- `src/components/NationalMap.tsx` — states/counties map on us-atlas Albers USA (pre-projected; no projection at runtime). Small NE states get callout chips.
- `src/components/NationalMap.tsx` has a `measures` mode (states shaded by how many statewide measures they have, `measureCountColor`; the tooltip gives passed/failed/not called); the measures tab has no counties toggle, each measure's card carries its own county map. For the other offices it has three modes: states, counties (margin bins) and "Still counting" (`remaining`: share of each county's vote still out, teal ramp from `remainingColor`; the legend names civicAPI's % reporting as the source). Both county modes zoom to the selected state (CSS transform on `.map-zoom`, non-scaling strokes, "All states" button to return; no animation under `prefers-reduced-motion`).
- `src/components/HexMap.tsx`: roving tabindex, arrow keys walk the grid (skipping gaps), Enter/Space selects, focus shows the tooltip (`focusPoint` in `Tooltip.tsx`; the same `HoverHandler` serves pointer and keyboard). `SidePanel.tsx`, `RaceCard.tsx`, `CountyMap.tsx`, `RaceTable.tsx` (table view = accessible twin of the maps).
- `src/lib/live.ts` (`useLive`) loads the county files after the first paint, then refetches results (and counties, once loaded) every 15 minutes and when the tab becomes visible, but never within 5 minutes of the last refresh (a tab flicking in and out of view was re-downloading everything). The old render stays at reduced opacity while a refresh is in flight; a failed refresh shows a specific notice while keeping the last good data. `document.title` names the selected race.
- `HOME_STATE` (`src/lib/states.ts`, "WI") drives the Wisconsin shortcut: a toolbar chip that selects it on the current tab, a resting teal outline on both maps (replaced by the selected outline once picked), and the "Wisconsin at a glance" block (Senate and governor races, then the measures, then the House delegation; `GLANCE_ORDER`) at the top of every overview panel.
- `RaceTable.tsx`: each row expands (chevron, or click the row) into the full `RaceCard` with every candidate, votes, photos, call and update times and the count sparkline, plus an "Open on the map" button; the state cell still opens the panel. Columns: State/District, Leading candidate (sortable by share), Runner-up, Margin (with the trend glyph), Reporting, Votes, Called (relative time; "No time given" for calls civicAPI left unstamped), Status. Filters: All, Not called, Flipped (Senate and governors), Within 5 points. A summary line counts called and not called; "Download CSV" writes the filtered, sorted rows via `src/lib/csv.ts` (one row per race, top two candidates spelled out, status and timing). Reporting, Votes and Called hide under 960px (they are in the expanded row; with them the table scrolled sideways on tablets), Runner-up under 700px.
- Map pass (Nov. 6): the key (`Legend.tsx`) is a row of toggle buttons on the states and hex views; pressing one spotlights those races (`legendKey`/`inSpotlight` in `status.ts`, `spotlight` state in App, cleared when the office or mode changes; "Seat flipped" and "Called in the last 3 hours" are entries too; the latter appears only while `isFresh` finds one, `FRESH_MS`) and dims everything else to 22% (`.is-out`, `.is-dim`); "Show all" clears it. Fresh calls get a dashed teal ring (`.fresh-outlines`, `.hex--fresh`). Hover is an ink outline drawn on top (`.hover-outline`, `.hex-hover`) rather than a darkened fill, fills cross-fade over 400 ms when a refresh changes a call, both maps fade in once on mount (`map-in`, off under reduced motion) and the state group and hex blob carry one soft drop shadow for elevation. The tooltip leads with the leader's headshot (when the manifest has one), the call time or % reporting, and a share bar per candidate. A zoomed state names its five biggest counties by votes (`.county-labels`, 9px scaled by `zoomScale`, skipping any within `LABEL_GAP` of a bigger one; hidden under 700px where they would be 3px).
- Replay election night (`src/lib/replay.ts`, `Replay.tsx`): `callOrder` is every timestamped call oldest first; position i of the scrubber shows `resultsAfter(results, i, calls)`, the results with every later call undone (winner, flip, call time and the candidate's winner flag cleared; leads and votes stay as they are today, since the count history starts later). The ~34 calls civicAPI left unstamped are undone at every position but the last. App derives `results` from the live results and the position, so the maps, tabs, headline, panel and table all replay together, and the board's `clock` is the position's call time (so "Called in the last 3 hours" and the latest-calls ages follow the replay); the masthead and the stale notice keep the real time. Play steps one call every 45 ms; the control shows on the states and hex views and the measures map, and leaving the states mode exits the replay. The overview's "still being counted" list caps at 40 rows (`COUNTING_LISTED`), since mid-replay hundreds are uncalled.
- Since your last visit (`src/lib/visits.ts`, `SinceVisit.tsx`): localStorage keeps the ids of the races this browser had seen called and when (`wpr-midterm-2026-last-visit`, written on every results load, read once at mount before the first write); the strip under the tabs lists the races called since, newest first, five shown plus a count, dismissable, hidden during replay. Storage failures (private windows) leave the page as it was. Nothing leaves the browser.
- How close the House was (`MarginStrip.tsx`, on the House overview): every district as one dot on a margin axis in 2-point columns, Democratic wins left and Republican right, full color when called and pale when leading, Wisconsin's districts outlined in ink, each dot clickable with a native title. The 38-and-over columns hold dozens of safe seats each and are drawn as one labeled bar so they don't flatten the rest; a home-state seat there stays a dot. Dot pitch shrinks only as far as the tallest ordinary column needs.
- Print (`@media print`): controls, replay, the visit strip, tooltips, the open sponsor slot and expanders are hidden, the key reads as plain entries, the map shadows go, the table starts a new page and links print as text.
- Parliament arcs (`src/lib/arc.ts`, `SeatArc.tsx`): each chamber card draws every seat as a dot in a half circle, ordered left to right as secured D, D leads, secured independents, their leads, runoffs, R leads, secured R (measures: passed, yes leading, no leading, failed), so the undecided seats sit in the middle under the majority tick (at angle π·(1 − majority/total)). `arcRows` picks the row count that gives seats about as much room along a row as between rows; `arcSeats` allots seats to rows by radius (largest remainder) and sorts by angle so each block fills as a wedge. Dots fade in staggered from both ends toward the middle (3 ms per seat, opacity only so 700 dots cost the first frame little, off under reduced motion; the arc is memoized so the count-up's per-frame renders never touch it) and their fill transitions over 400 ms, so a replay step or a refresh recolors the arc. Every dot is a seat from `chamberSeats` (`src/lib/seats.ts`): holdovers (Senate and governor seats not up this year, from the baselines), then within each block the widest margin outermost so the closest races of both parties meet under the majority tick. Hovering a dot opens the same tooltip the maps use (a holdover reads "Not on the ballot this year"), clicking one opens its race; the card itself is the click target for the office and the `chamber__tab` button inside it carries the tab role, since a button may not contain the dots. Under a coarse pointer the dots take no events, so a tap opens the office. The share card passes no handlers and its arc stays a picture. Ring: inner radius 34, outer 98 of a 200-wide viewBox. `seatLabel` in `summary.ts` is the one accessible name for the arc and the seat bar (the bar remains on the compact embed; the share card draws the arcs, 240px wide, entrance off). The cards' big numbers run up from zero on first load (`useCountUp`, 800 ms ease-out, tabular figures; later changes land at once). The headline sets "Democrats" and "Republicans" in their party colors (`PartyWords`). Tooltips fade up over 120 ms.
- Chamber tabs are WAI-ARIA tabs (Left/Right/Home/End). `raceTitle` in `summary.ts` is the one source for race names (cards, tooltips, aria-labels).
- Colors validated with the dataviz palette checker on cream: D `#2D63A6`, R `#C23A30`, Ind/other `#B88A1E` (below 3:1, always paired with a label). Measures: Yes `#2B7A6F` (brand teal), No `#A0612C` (warm brown), with pale and five-step ramps in `colors.ts`; the tab's hero numbers and the table's Yes/No columns carry those colors beside their labels. Pale tints = leading, not called. `--muted` is `#6b665a` (5.1:1 on cream, 4.7:1 on the wash); the earlier `#7d776b` was under AA.
- WPR design system ("Follow the Money" pairing in the wpr-brand skill's terms): teal `#3A867C`, cream `#F6F2E9`, Fraunces (headlines), Public Sans (UI, hero numbers), JetBrains Mono (vote counts in tables). The brand invariants live in `src/components/Masthead.tsx`: the press-seal badge (`public/brand/wpr-typewriter-badge.png`, committed copy, never hot-linked) and wordmark (`public/brand/wpr-wordmark.png`) as one centered lockup linking to wausaupilotandreview.com, the tagline "Where Locals Look First For News" (uppercase, 0.28em tracking), a dateline (long date left, WAUSAU, WISCONSIN right) and the thick-over-thin slate rule (`--slate: #32373c`, 4px over 1px). Both assets are black on white, so they get `mix-blend-mode: multiply` on the cream (normal in print). The hero carries a kicker with the update time; the footer leads with the seal at 44px and ends with "Wausau Pilot & Review · 715-301-5539" plus the provenance and non-affiliation lines; the share card and credits page carry the seal and wordmark too. favicon.png and apple-touch-icon.png are made from the seal.
- Fonts are self-hosted in `public/fonts` (latin subsets of the variable woff2 files Google Fonts serves; `python scripts/fetch_fonts.py` refreshes them), declared at the top of `styles.css` and preloaded from `index.html`. Nothing render-blocking leaves the origin.
- The four chamber tabs sit two by two under 1000px. The map toolbar's caption yields (`flex: 1 1 12rem`) so the controls never wrap onto a second row; "Copy link" is icon-only under 700px (named by aria-label). Counties outside the zoomed state fade to 35% opacity.
- `.loading` uses padding, not margin: a top margin collapses through `<body>` and shifts the page when the app replaces it (that was a 0.08 CLS).

## Swing and county patterns (Nov. 7, 2026)

Two sources beyond civicAPI, both static, fetched by hand and committed; neither runs on the cron.

- **County demographics**: `pipeline/demographics.py` (`npm run demographics`) downloads four ACS 5-year table files and the
  county gazetteer from the Census Bureau's FTP (no API key) into `pipeline/raw/acs/` and writes `public/data/demographics.json`:
  `{"<fips>": [population, collegePct, medianIncome | null, whiteNhPct, density]}`. Vintage 2017–2021, the last whose geography
  is the counties the maps and civicAPI use (from 2022 the Census reports Connecticut by planning region). Alaska's split census
  areas are merged like the vote. The build fails if any atlas county lacks a row; one county (Loving, TX) has no median income.
  Public domain; credited in the footer. Front end: `src/lib/patterns.ts` (`countyPatterns`: the vote of the given races summed
  over counties grouped by one variable into four bins; a race counts only when a Democrat and a Republican finished first and
  second (`twoPartyRace` in `shift.ts`; six 2026 races had an independent in the top two), a county only with votes and the variable) and `CountyPatterns.tsx`, on the Senate and governor overview panels (every
  race of the office) and on a state's panel (that race): a menu of four variables (people per square mile, bachelor's share,
  median household income, white non-Hispanic share), each bin's share of the vote, D/R result and, once the 2024 baseline is
  loaded, the shift. The note says these are patterns of places, not a survey of voters.
- **2024 presidential baseline**: `pipeline/baseline.py` (`npm run baseline`) reads the MIT Election Data and Science Lab's
  "County Presidential Election Returns 2000-2024" (Harvard Dataverse doi:10.7910/DVN/VOQCHQ, CC0) from `pipeline/raw/medsl/`
  (the download needs a Dataverse guestbook response, so it is saved by hand) and writes `public/data/baseline-2024.json`:
  `[dem, rep, total]` by county FIPS (where the atlas draws the county; Alaska and Connecticut have state totals only) and by
  state. It uses a county's TOTAL vote-mode rows where they exist and fails unless the national totals land within 1% of the
  certified count. `src/lib/shift.ts`: `raceShift` and `countyShift` compare a race's or a county's Democratic-minus-Republican
  share of all votes with 2024 (null unless `twoPartyRace`), `shiftText` words it, `shiftColor` in `colors.ts` steps the party
  margin ramps at 5, 10 and 20 points (cut against the 2026 county distribution: median 14, quartiles 8 and 19). Once the file loads (after first paint, with the demographics): a
  fourth map mode "Shift since 2024" for Senate and governor races (counties on the margin ramps by how far they moved, with a
  diverging key), a line on every statewide race card and tooltip (`shiftText`), a sortable "vs. 2024" column in the table
  and a `shift_vs_2024_pts` CSV column, the shift column in the county-patterns block, and a "Compared with 2024" block on
  the Senate and governor overview panels (`officeShift`: the races with both parties, vote-weighted against their states;
  `biggestShifts`: the three largest moves toward each party). House races have no shift: a district has no statewide baseline.

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

## Sponsorship

The WPR tracker model (wpr-brand skill, `references/sponsorship.md`). Inventory lives in `src/sponsors.ts` and nowhere else:
`SPONSORS.title` is a `Sponsor` or `null`. Sold: `SponsorLockup` under the hero dek, a white card marked on top in teal with
"Presented by", the logo (`public/sponsors/<file>`, drawn for white, ~50px) or the name in Fraunces, the tagline split at the
em dash into a bold offer and a muted place, a Directions chip when there is an address (Apple Maps on Apple hardware, Google
Maps elsewhere; a button-role span, since the card is already a link), UTM tags on the way out and
`rel="noopener noreferrer sponsored"`. Open: `OpenSlot`, a dashed card leading with "Sponsorship available", one line of
value, a "Book this placement →" mailto to `SALES_EMAIL` (weber.chris@wausaupilotandreview.com, the one address) with the
placement in the subject, which also copies the address and confirms inline. `?demo` fills every open slot with "Your Brand
Here" under a ribbon that names itself a sales preview; sold slots are never overridden. The footer carries "Advertise on this
page". To sell the slot: fill in `SPONSORS.title`, drop the logo in `public/sponsors/`, commit.

## Compact embed

`compact.html` + `src/compact.tsx`: the balance of power (four cards) and the six latest calls, for a homepage module or an
article sidebar. One `results.json` fetch, no maps, refreshed every 15 minutes. Container queries lay the cards 1, 2 or 4
across (280px sidebar to a full-width band). Every card and row links to the full page with `target="_top"`; with
`?host=<article URL>` the links point at the article's hash instead (`shareUrl`, same rule as Copy link). It posts
`{type: "wpr-embed-height", id: "wpr-national-midterm-2026-compact", height}` so both embeds can share a page.

```html
<div id="wpr-national-midterm-2026-compact"></div>
<script>
(function () {
  var f = document.createElement('iframe');
  f.src = 'https://rowanflynnpilot.github.io/wpr-national-midterm-2026/compact.html?host='
    + encodeURIComponent('https://wausaupilotandreview.com/2026-election-results/');
  f.style.cssText = 'width:100%;border:0;min-height:420px';
  f.title = '2026 midterm results: balance of power';
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://rowanflynnpilot.github.io') return;
    if (e.data && e.data.type === 'wpr-embed-height' && e.data.id === 'wpr-national-midterm-2026-compact')
      f.style.height = e.data.height + 'px';
  });
  document.getElementById('wpr-national-midterm-2026-compact').appendChild(f);
})();
</script>
```

## Sharing and freshness

- `share.html` + `src/share.tsx` render `ShareCard` (balance of power with the parliament arcs, 1200×630). `scripts/share-image.mjs` screenshots it to
  `dist/share.png` as the last step of `npm run build` and stamps `?v=<fetched>` onto the og:image URL in `dist/index.html`
  so crawlers refetch after each data run. Open Graph and Twitter tags live in `index.html`.
- `.stale` notice appears when `results.fetched` is more than three hours old (`isStale`, re-checked every minute).

## Review pass (Nov. 5, 2026, evening)

Based on a survey of AP, Decision Desk HQ, NBC, ABC and 2024 accessibility audits (notes in `reports/polish-2026-11-05/README.md`):
hover styles are gated behind `(hover: hover) and (pointer: fine)`; controls have `:active` feedback, `touch-action: manipulation`
and no text selection; form controls are 16px on coarse pointers; a skip link; the map's accessible name carries the tallies
(`mapDescription` in App); a visually hidden status line announces the selection. Deliberately not done: a sticky balance-of-power
strip (sticky does not work inside the auto-height iframe), a needle or probabilities (no model), swing vs. 2024 (no county
baselines under the new maps), incumbent markers (civicAPI flags only ~50).

## Device checks

Touch behavior is verified under Playwright's Pixel 7 (Chromium) and iPhone 14 (WebKit) emulation against the live site:
coarse pointer with no hover, transparent tap highlight, 16px form controls, zoomable viewport with `viewport-fit=cover`,
no horizontal overflow, icon-only Copy link, a hex tap opening the state list, a district row tap opening the district,
no hover background left on a tapped row, county-mode tap zooming and the All states control returning. Emulation cannot
prove sticky hover, the 300ms tap delay, rubber-banding, safe areas or the software keyboard: check those on hardware.

## Quality gates (Nov. 5–6, 2026)

`node scripts/serve.mjs 4174` serves `dist/` with gzip like Pages does (Vite's preview does not compress, which skews
Lighthouse's throttling) and a 40 ms round trip per response (a zero-latency server lets files land before the headline's
paint is reported, and Lighthouse's simulation then charges the paint for them). Lighthouse mobile on `/#senate` and
`/#house` is bimodal by design of its simulation: 100 when the app's first frame is also the first paint, 94 (LCP ≈ 3.1 s
simulated on slow 4G) when the loading flag painted first and the headline is charged for the JavaScript, results.json and
the two preloaded fonts it truly needs. Both are honest; 94 is the floor. Accessibility 100, Best Practices 100, CLS 0,
TBT under 90 ms. The mono font is not preloaded (tables only, below the fold). `npm run screens` doubles as the zero-console-errors gate. `npm audit` clean.

## Deploy

`public/embed-test.html` wraps the build in the CLAUDE.md snippet so auto-height can be checked locally (`/embed-test.html` on Pages).
`.github/workflows/update-results.yml` checks out the branch tip (`ref: main`, not the pushed commit: runs are serialized by the
`pages` concurrency group, and a queued push-triggered run must see the snapshot the run before it committed, or its own snapshot
commit conflicts in `pipeline/history.json`; that failed once on Nov. 7), fetches, tests, builds (including share.png via a cached Playwright Chromium) and deploys to Pages hourly (each run makes ~500 civicAPI requests; keep it gentle on a free API). Enable Pages → Source: "GitHub Actions" in repo settings, and run the workflow once by hand to publish. If a fetch or build fails, nothing deploys and the last good version stays up. Stop the cron once states certify (late November into December).

## AP cross-check (Nov. 5, 2026)

Every race civicAPI called by under 3 points (27 races) was checked against AP reporting. 26 agree. **NY-21** (Constantino R +2.1)
is called by civicAPI and Decision Desk HQ but was not called by AP as of Nov. 5; left as civicAPI reports it. civicAPI called
FL-13 nearly two days before AP. Its `percent_reporting` lags AP on several called races (TN-09, NJ-02, NY-02, TN-07, TN governor).

## Next steps

1. Settings → Pages → Source: GitHub Actions, then run "Update results" once by hand.
3. Local measures (civicAPI has ~2,300 `election_type` "Local" referendums) are out of scope.
