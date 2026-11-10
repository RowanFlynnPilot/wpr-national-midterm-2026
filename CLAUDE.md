# wpr-national-midterm-2026

Reader-facing explorer of every Nov. 3, 2026 U.S. Senate, House and governor race, plus statewide ballot measures, for Wausau Pilot & Review.
Built Nov. 5, 2026, two days after the election, while ~34 races were still uncalled.

## Stack

Python fetch/build → static JSON in `public/data/` → React + TypeScript + Vite + d3-geo → GitHub Pages → WordPress iframe.
No Python dependencies (stdlib only). Node 22.

```
npm install
npm run data      # fetch civicAPI + rebuild public/data/{results,counties-S,counties-G,counties-B,counties-H}.json + record the count history
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
- **Ballot measures are races with office `B`** (`build.py`): the answers are candidates with party `Y`/`N` (blank-ballot lines fold into one `Blank` line, party `O`, "No vote on the question"; the county page's remainder row takes that name), `title` holds the measure name, and `district` is `<state>-<civicAPI id>` so a measure routes like a district (`#measures-wi-179849`). Within a state they sort in natural title order (`title_key`: "Question 2" before "Question 10"), since civicAPI ids put Wisconsin's Question 2 before Question 1. County rows go to `counties-B.json` with the same row shape.
- `pipeline/build.py` — normalizes to the front-end schema (`src/lib/types.ts`). Fails the build on impossible states (`check_race`): two winners, a winner plus runoff finalists, negative votes, shares past 100%, reporting outside 0–100, a Senate/governor race with no seat holder in baselines, or county rows summing more than 2% away from the statewide total. Party codes: Democratic→D, Republican→R, everything else→I (the panel shows the real party name). Candidates under 1% fold into "Others" (max 5 kept).
- County rows: `[pctReporting, votes for race.cands[0..2] (excluding Others), all other votes]`. New England and Alaska use civicAPI's County/Borough aggregate rows, not towns or House districts. House races get the same rows in `counties-H.json` (a district's part of each county it covers; see "A county page in all 50 states"), which the hex map script already read from the raw files.
- Alaska: civicAPI uses the 2019 split census areas (02063, 02066); us-atlas still draws Valdez-Cordova (02261), so they're merged (`FIPS_MERGE`).
- A few counties come without FIPS (Le Flore OK, Lewis and Clark MT, Oglala Lakota SD, three MN); resolved by name against us-atlas. Any unresolved county fails the build.
- `pipeline/exclusions.json` — hand-maintained list of civicAPI race ids its Nov. 3 search returns that were not on the Nov. 3 ballot
  (`{"<id>": "<reason>"}`; the Kansas Supreme Court Justices Amendment was decided at the Aug. 4 primary and sat here with no votes).
  `build.py` drops them before anything else and fails if an id is no longer in the search, so a stale line gets removed. It also prints a
  note for any race with no votes and no update since before Election Day; that is not a failure, because Virginia's three questions sat
  like that for two days before civicAPI filled them.
- `pipeline/measure-rules.json` — hand-maintained pass rules for measures read against something other than a plain majority of the
  votes shown, by civicAPI id: `{"needs": 60, "label": "60%", "text": "Florida requires 60% of the vote to amend its constitution."}`.
  `build.py` copies the entry onto the race as `rule` (null otherwise), fails if an id is not a measure the search returns, and prints a
  note when civicAPI's call disagrees with the rule. Nov. 8: Florida's three amendments (60%), Colorado Amendments 81–86 (55% for an
  amendment that adds to the constitution; 87 only repeals and needs a majority), New Hampshire Question 1 (two-thirds) and Minnesota
  Amendment 1 (a blank counts as No; civicAPI's blank lines are in the total, so the shares already read that way). Verify each new
  entry against the state's rule before adding it. The leader, the map shading and the tab's tallies stay civicAPI's; only the words
  change (see Race status rules).
- `pipeline/key-dates.json` — hand-maintained (Nov. 9): what happens next in states with a candidate race not yet called, and each
  state's recount rule in a sentence. `{"dates": [{"date", "end"?, "state", "offices"?, "text", "source"}], "recounts": {"<state>":
  {"offices"?, "text", "source"}}}`; `date` and `end` are ISO days, `offices` limits an entry to some of S/G/H (absent means all), and
  `source` is the state's own page or statute (kept in the file, not sent to the page). `build.py` (`key_dates`, `check_note`,
  `recount_for`) fails on an unknown key, a date before Election Day, an end before its date, a state with no race in the search,
  an office outside S/G/H, an empty sentence or a source that is not https; it writes the dates into `results.json` as `dates` in
  (date, state) order and each candidate race's `recount` sentence (null for measures and states without an entry), and prints a
  note for every date already past, which is the cue to delete it. Every entry was read on the state's own calendar or statute
  (Tennessee's and Mississippi's statutes on law.justia.com, since the states publish theirs through a vendor). Verify a new entry
  the same way before adding it, and leave out anything that could not be confirmed on a primary source. Upkeep: remove dates as
  they pass and a state's entries once its last race is called; the page already hides both.
- `pipeline/baselines.json` — hand-maintained pre-election seat holders (Senate and governor by state) and pre-election totals. House baseline = 2024 result (D 215, R 220).

## Race status rules (`src/lib/status.ts`, `pipeline/build.py`)

- Measures: **won** with winner `Y` reads "Passed", `N` "Failed"; otherwise "Not called. Yes leads by X points". With a `rule`
  (`pipeline/measure-rules.json`): "Failed: Yes 58.2% fell short of the 60% required" when Yes led but lost, "Not called. Yes leads by
  2.2 points but is under the 55% needed" while Yes leads short of it (`failedText`, `measureLeadText`, `yesShare` in `status.ts`), the
  race card carries the rule's sentence, and a failed measure Yes led shows "Failed · Yes 58.2%" in the panel rows rather than
  "Failed by 16.4", which read as a No landslide. No ranked-choice note, no flips, no majority line; the tab's bar is passed / leading yes / leading no / failed.
- **no votes yet** — `total` is 0 and no winner (`noVotesYet`): neutral fill, "No votes reported yet", never a painted lead. **won** — civicAPI `winner`. **runoff** — a candidate is `advanced`, or Louisiana House with no one at 50% (`MAJORITY_RUNOFF`; LA moved its House primaries to Nov. 3 with a Dec. 12 runoff, and civicAPI flags finalists only once second place is settled). **decided** — top-two finalists from one party (CA-04/07/11/14, CA-40): the seat counts for that party before a call. **leading** — everything else.
- `unopposed` — one non-"Others" candidate. Florida doesn't print unopposed races, so FL-10 has zero votes; the card says so.
- Ranked-choice note (Alaska, Maine federal races) appears only when no one has a majority of first choices; Alaska's adds that the tabulation runs on Nov. 18. `RUNOFF_DATE` puts "Dec. 12" on Louisiana runoff text. Same-party finals read "Seat decided: both finalists are Democrats. Winner not called".
- Each race carries civicAPI's `last_updated` as `updated`; the race card footer shows it, so a race civicAPI stops updating is visible as such.
- **Why a race is not called** (`whyNotCalled` in `status.ts`, a `race-card__note` led by "Why isn’t this called?"): null for a called
  race, a measure, a race with no votes and a race whose call a replay has undone (`undone`). A runoff gets one sentence and nothing
  else ("No candidate won the majority Louisiana requires, so the top two finishers meet in a runoff on Dec. 12."). Otherwise the
  reasons that apply, in this order: ranked choice with no first-choice majority; civicAPI's reporting share under 100% (rounded,
  and only when `reportingShare` gives one); a lead under one point, in votes and points ("first-choice lead" in a ranked-choice
  race), followed by the state's `recount` sentence when it has one. No reason in hand means no line: there is no catch-all
  sentence, so a race at 100% with a lead of a point or more (California's same-party finals) says nothing.
- Nevada's "None of These Candidates" is party `O`, "Ballot option".

## Known data limits (deliberate choices)

- **No House seat-by-seat flips.** civicAPI flags only ~50 of ~370 incumbents, and several states redrew maps in 2025–26. The House shows called/leading only; the panel explains why.
- `percent_reporting` is civicAPI's figure, labeled "% reporting". Some states show 100% while uncalled (CA counts ballots for weeks).
  Alaska's two measures carry 0 beside 200,000 votes: civicAPI gives them no share. `reportingShare` / `reportingText` in `format.ts` is
  the one rule for printing it (card, share card, table, rows, tooltips, county page, sparkline, takeaway): a zero beside a count is a
  missing figure and reads "Share reporting not given" (or a dash in the table and a blank `pct_reporting` in the CSV), never 0%.
- civicAPI is slow to call measures: on Nov. 8 it had called 62 of 130, and 40 of the 68 uncalled stood at 99.9% reporting with leads up
  to 63 points. The panel's list is headed "Measures not yet called" and its note counts how many are at least 99% counted; the calls stay
  civicAPI's.
- `calledAt` is missing on ~34 races civicAPI called without a timestamp; the card shows "Winner called" for those. With a
  timestamp the time takes the words' place ("Called Nov. 3, 10:32 p.m. CST"): `statusParts` in `status.ts` is the one rule,
  for the race card and the share card.

## House hex cartogram (`scripts/hexmap.mjs`)

Each district's target = vote-weighted centroid of the counties it covers (from civicAPI county breakdowns, so it reflects 2026 maps). State centers are pulled together (SHRINK 0.60), separated by a collision force, and slid inward slightly (GRAVITY 0.012). Then each state grows a contiguous hex blob toward its own district targets. Interior holes left by growth are filled: the hole goes to the state touching it most, which releases its worst-placed exterior hex (a landlocked state releases one toward a neighbor and the shift ripples outward), so every state keeps one hex per district and stays contiguous. Districts are then assigned to hexes inside the blob by pairwise-swap descent. The output is committed and **not** regenerated on the cron, because vote weights shift and districts would move.

## Front end

- `src/App.tsx` — selection state + hash routing (`#senate`, `#senate-tx`, `#house-wi`, `#house-wi-03`, `#governors-ks`, `#measures`, `#measures-wi`, `#measures-wi-179849`, and a county page `#governors-wi-55073` or `#house-in-18097`; see County pages).
- `src/lib/summary.ts` — chamber tallies, data-driven headline and dek. Senate majority 51 (VP is a Republican), House 218, no majority marker for governors. `latestCalls` = the 8 newest calls with a `calledAt` for the office (the ~34 calls civicAPI timestamps are skipped; the panel says so); shown on the overview panel with `timeAgo`.
- `src/components/NationalMap.tsx` — states/counties map on us-atlas Albers USA (pre-projected; no projection at runtime). Small NE states get callout chips.
- `src/components/NationalMap.tsx` has a `measures` mode (states shaded by how many statewide measures they have, `measureCountColor`; the tooltip gives passed/failed/not called); the measures tab has no counties toggle, each measure's card carries its own county map. For the other offices it has three modes: states, counties (margin bins) and "Still counting" (`remaining`: share of each county's vote still out, teal ramp from `remainingColor`; the legend names civicAPI's % reporting as the source). Both county modes zoom to the selected state (CSS transform on `.map-zoom`, non-scaling strokes, "All states" button to return; no animation under `prefers-reduced-motion`).
- `src/components/HexMap.tsx`: roving tabindex, arrow keys walk the grid (skipping gaps), Enter/Space selects, focus shows the tooltip (`focusPoint` in `Tooltip.tsx`; the same `HoverHandler` serves pointer and keyboard). `SidePanel.tsx`, `RaceCard.tsx`, `CountyMap.tsx`, `RaceTable.tsx` (table view = accessible twin of the maps).
- `src/lib/live.ts` (`useLive`) loads the county files after the first paint, then refetches results (and counties, once loaded) every 15 minutes and when the tab becomes visible, but never within 5 minutes of the last refresh (a tab flicking in and out of view was re-downloading everything). The old render stays at reduced opacity while a refresh is in flight; a failed refresh shows a specific notice while keeping the last good data. `document.title` names the selected race.
- `HOME_STATE` (`src/lib/states.ts`) drives the Wisconsin shortcut: a toolbar chip that selects it on the current tab, a resting teal outline on both maps (replaced by the selected outline once picked), the "Wisconsin at a glance" block (Senate and governor races, then the measures, then the House delegation; `GLANCE_ORDER`) at the top of every overview panel, the outlined dots on the House margin strip and the last "thing to know". It is "WI" unless the page is opened with `?home=<postal code>` (`homeState`), so another newsroom can embed the tool around its own state (see WordPress embed); an unknown code fails the page at load, since it is a setup error. The masthead, the sales copy and the headline stay WPR's.
- `RaceTable.tsx`: each row expands (chevron, or click the row) into the full `RaceCard` with every candidate, votes, photos, call and update times and the count sparkline, plus an "Open on the map" button; the state cell still opens the panel. Columns: State/District, Leading candidate (sortable by share), Runner-up, Margin (with the trend glyph), Reporting, Votes, Called (relative time; "No time given" for calls civicAPI left unstamped), Status. Filters: All, Not called, Flipped (Senate and governors), Within 5 points. A summary line counts called and not called; "Download CSV" writes the filtered, sorted rows via `src/lib/csv.ts` (one row per race, top two candidates spelled out, status and timing). Reporting, Votes and Called hide under 960px (they are in the expanded row; with them the table scrolled sideways on tablets), Runner-up under 700px, and on the measures table Margin too (`phone-hide`; the Yes and No shares beside it say the same). Under 390px the header labels wrap, the cells tighten and the party dash narrows so the longest names stay whole (see "Review pass (Nov. 9, 2026, evening)").
- Map pass (Nov. 6): the key (`Legend.tsx`) is a row of toggle buttons on the states and hex views; pressing one spotlights those races (`legendKey`/`inSpotlight` in `status.ts`, `spotlight` state in App, cleared when the office or mode changes; "Seat flipped" and "Called in the last 3 hours" are entries too; the latter appears only while `isFresh` finds one, `FRESH_MS`) and dims everything else to 22% (`.is-out`, `.is-dim`); "Show all" clears it. Fresh calls get a dashed teal ring (`.fresh-outlines`, `.hex--fresh`). Hover is an ink outline drawn on top (`.hover-outline`, `.hex-hover`) rather than a darkened fill, fills cross-fade over 400 ms when a refresh changes a call, both maps fade in once on mount (`map-in`, off under reduced motion) and the state group and hex blob carry one soft drop shadow for elevation. The tooltip leads with the leader's headshot (when the manifest has one), the call time or % reporting, and a share bar per candidate. A zoomed state names its five biggest counties by votes (`.county-labels`, 9px scaled by `zoomScale`, skipping any within `LABEL_GAP` of a bigger one; hidden under 700px where they would be 3px).
- Replay election night (`src/lib/replay.ts`, `Replay.tsx`): `callOrder` is every timestamped call oldest first; position i of the scrubber shows `resultsAfter(results, i, calls)`, the results with every later call undone (winner, flip, call time and the candidate's winner flag cleared, and `undone` set on the race so the card gives no reason it is uncalled; leads and votes stay as they are today, since the count history starts later). The ~34 calls civicAPI left unstamped are undone at every position but the last. App derives `results` from the live results and the position, so the maps, tabs, headline, panel and table all replay together, and the board's `clock` is the position's call time (so "Called in the last 3 hours" and the latest-calls ages follow the replay); the masthead and the stale notice keep the real time. Play steps one call every 45 ms; the control shows on the states and hex views and the measures map, and leaving the states mode exits the replay. The overview's "still being counted" list shows 12 rows (`COUNTING_LISTED`) and a "Show all N" button that expands it in place (`Overview` is keyed by office so it folds back on a tab change); mid-replay hundreds are uncalled.
- Since your last visit (`src/lib/visits.ts`, `SinceVisit.tsx`): localStorage keeps the ids of the races this browser had seen called and when (`wpr-midterm-2026-last-visit`, written on every results load, read once at mount before the first write); the strip under the tabs lists the races called since, newest first, five shown plus a count, dismissable, hidden during replay. Storage failures (private windows) leave the page as it was. Nothing leaves the browser.
- How close the House was (`MarginStrip.tsx`, on the House overview): every district as one dot on a margin axis in 2-point columns, Democratic wins left and Republican right, full color when called and pale when leading, Wisconsin's districts outlined in ink, each dot clickable with a native title. The 38-and-over columns hold dozens of safe seats each and are drawn as one labeled bar so they don't flatten the rest; a home-state seat there stays a dot. Dot pitch shrinks only as far as the tallest ordinary column needs.
- Print (`@media print`): controls, replay, the visit strip, tooltips, the open sponsor slot and expanders are hidden, the key reads as plain entries, the map shadows go, the table starts a new page and links print as text.
- Parliament arcs (`src/lib/arc.ts`, `SeatArc.tsx`): each chamber card draws every seat as a dot in a half circle, ordered left to right as secured D, D leads, secured independents, their leads, runoffs, R leads, secured R (measures: passed, yes leading, no leading, failed), so the undecided seats sit in the middle under the majority tick (at angle π·(1 − majority/total)). `arcRows` picks the row count that gives seats about as much room along a row as between rows; `arcSeats` allots seats to rows by radius (largest remainder) and sorts by angle so each block fills as a wedge. Dots fade in staggered from both ends toward the middle (3 ms per seat, opacity only so 700 dots cost the first frame little, off under reduced motion; the arc is memoized so the count-up's per-frame renders never touch it) and their fill transitions over 400 ms, so a replay step or a refresh recolors the arc. Every dot is a seat from `chamberSeats` (`src/lib/seats.ts`): holdovers (Senate and governor seats not up this year, from the baselines), then within each block the widest margin outermost so the closest races of both parties meet under the majority tick. Hovering a dot opens the same tooltip the maps use (a holdover reads "Not on the ballot this year"); clicking one opens the race's card in a pop-up under the dot (`SeatPopover.tsx`, Nov. 9: the race card with its sparkline and shift line, a close button and "Open on the map", which selects the race; Escape or a click anywhere else closes it, no tooltip shows while it is open, and it scrolls itself into view, since the dots sit low in the cards and on a laptop the card opens across the fold). It is anchored in the chambers frame rather than centered in the viewport because inside the auto-height iframe the viewport is the whole article, and a centered dialog would open far below the reader. The pop-up reads its race by id from the live results, so a refresh or a replay step updates an open card. Keyboard: the seats with a race are one roving tab stop per arc (`role="button"`, named by `raceTitle` and `statusText`); Left/Right walk them in the arc's order, Home/End jump to the ends, focus shows the tooltip and an ink ring, Enter or Space opens the pop-up and closing it returns focus to the seat; holdovers are skipped. The card itself is the click target for the office and the `chamber__tab` button inside it carries the tab role, since a button may not contain the dots. The tab list is an empty element that owns the four tab buttons through `aria-owns` (ids `chamber-tab-<office>`): a tablist may hold nothing but tabs, and the cards hold the arcs' buttons too (Lighthouse accessibility fell to 96 on `aria-required-children` when the arcs became groups inside it). The tab list's arrow-key handler acts only when a tab has focus, so the arcs keep their own arrows. Under a coarse pointer the dots take no events, so a tap opens the office. The share card passes no handlers and its arc stays a picture. Ring: inner radius 34, outer 98; the viewBox pads the ring by the dot radius (at least the majority tick's 5 units) plus one for the hover stroke, because a box that stopped at the ring cut the Senate's 5-unit dots at the sides and the bottom. `seatLabel` in `summary.ts` is the one accessible name for the arc and the seat bar (the bar remains on the compact embed; the share card draws the arcs, 240px wide, entrance off). The cards' big numbers run up from zero on first load (`useCountUp`, 800 ms ease-out, tabular figures; later changes land at once). The headline sets "Democrats" and "Republicans" in their party colors (`PartyWords`). Tooltips fade up over 120 ms.
- Chamber tabs are WAI-ARIA tabs (Left/Right/Home/End). `raceTitle` in `summary.ts` is the one source for race names (cards, tooltips, aria-labels).
- Colors validated with the dataviz palette checker on cream: D `#2D63A6`, R `#C23A30`, Ind/other `#B88A1E` (below 3:1, always paired with a label). Measures: Yes `#2B7A6F` (brand teal), No `#A0612C` (warm brown), with pale and five-step ramps in `colors.ts`; the tab's hero numbers and the table's Yes/No columns carry those colors beside their labels. Pale tints = leading, not called. `--muted` is `#6b665a` (5.1:1 on cream, 4.7:1 on the wash); the earlier `#7d776b` was under AA.
- WPR design system ("Follow the Money" pairing in the wpr-brand skill's terms): teal `#3A867C`, cream `#F6F2E9`, Fraunces (headlines), Public Sans (UI, hero numbers), JetBrains Mono (vote counts in tables). The brand invariants live in `src/components/Masthead.tsx`: the press-seal badge (`public/brand/wpr-typewriter-badge.png`, committed copy, never hot-linked) and wordmark (`public/brand/wpr-wordmark.png`) as one centered lockup linking to wausaupilotandreview.com, the tagline "Where Locals Look First For News" (uppercase, 0.28em tracking), a dateline (long date left, WAUSAU, WISCONSIN right) and the thick-over-thin slate rule (`--slate: #32373c`, 4px over 1px). Both assets are black on white, so they get `mix-blend-mode: multiply` on the cream (normal in print). The hero carries a kicker with the update time; the footer leads with the seal at 44px and ends with "Wausau Pilot & Review · 715-301-5539" plus the provenance and non-affiliation lines; the share card and credits page carry the seal and wordmark too. favicon.png and apple-touch-icon.png are made from the seal.
- Fonts are self-hosted in `public/fonts` (latin subsets of the variable woff2 files Google Fonts serves; `python scripts/fetch_fonts.py` refreshes them), declared at the top of `styles.css` and preloaded from `index.html`. Nothing render-blocking leaves the origin.
- The four chamber tabs sit two by two under 1000px. The map toolbar's caption yields (`flex: 1 1 12rem`) and the controls are one flex item, so when the four-mode row and a long caption cannot share a line the controls move to the next line whole, never one control at a time; "Copy link" is icon-only under 700px (named by aria-label). Counties outside the zoomed state fade to 35% opacity.
- `.loading` uses padding, not margin: a top margin collapses through `<body>` and shifts the page when the app replaces it (that was a 0.08 CLS).

## Swing and county patterns (Nov. 7, 2026)

Two sources beyond civicAPI, both static, fetched by hand and committed; neither runs on the cron.

- **County demographics**: `pipeline/demographics.py` (`npm run demographics`) downloads four ACS 5-year table files and the
  county gazetteer from the Census Bureau's FTP (no API key) into `pipeline/raw/acs/` and writes `public/data/demographics.json`:
  `{"<fips>": [population, collegePct, medianIncome | null, whiteNhPct, density]}`. Vintage 2017–2021, the last whose geography
  is the counties the maps and civicAPI use (from 2022 the Census reports Connecticut by planning region). Alaska's split census
  areas are merged like the vote. The build fails if any atlas county lacks a row; one county (Loving, TX) has no median income.
  Public domain; credited in the footer. Front end: `src/lib/patterns.ts` (`countyPatterns`: the vote of the given races summed
  over counties grouped by one variable into four bins; a race counts only when its two sides finished first and
  second (`headToHead` in `shift.ts`; six 2026 races had an independent in the top two), a county only with votes and the variable;
  a measure reads Yes and No (`sides`), and its card carries the block too) and `CountyPatterns.tsx`, on the Senate and governor overview panels (every
  race of the office) and on a state's panel (that race): a menu of four variables (people per square mile, bachelor's share,
  median household income, white non-Hispanic share), each bin's share of the vote, D/R result and, once the 2024 baseline is
  loaded, the shift. The note says these are patterns of places, not a survey of voters.
- **2024 presidential baseline**: `pipeline/baseline.py` (`npm run baseline`) reads the MIT Election Data and Science Lab's
  "County Presidential Election Returns 2000-2024" (Harvard Dataverse doi:10.7910/DVN/VOQCHQ, CC0) from `pipeline/raw/medsl/`
  (the download needs a Dataverse guestbook response, so it is saved by hand) and writes `public/data/baseline-2024.json`:
  `[dem, rep, total]` by county FIPS (where the atlas draws the county; Alaska and Connecticut have state totals only) and by
  state. It uses a county's TOTAL vote-mode rows where they exist and fails unless the national totals land within 1% of the
  certified count. `src/lib/shift.ts`: `raceShift` and `countyShift` compare a race's or a county's Democratic-minus-Republican
  share of all votes with 2024 (null unless `headToHead`), `shiftText` words it, `shiftColor` in `colors.ts` steps the party
  margin ramps at 5, 10 and 20 points (cut against the 2026 county distribution: median 14, quartiles 8 and 19). Once the file loads (after first paint, with the demographics): a
  fourth map mode "Shift since 2024" for Senate and governor races (counties on the margin ramps by how far they moved, with a
  diverging key), a line on every statewide race card and tooltip (`shiftText`), a sortable "vs. 2024" column in the table
  and a `shift_vs_2024_pts` CSV column, the shift column in the county-patterns block, and a "Compared with 2024" block on
  the Senate and governor overview panels (`officeShift`: the races with both parties, vote-weighted against their states;
  `biggestShifts`: the three largest moves toward each party). House races have no shift: a district has no statewide baseline.

## The vote in depth (`Analysis.tsx`, Nov. 7 evening)

The band renders only once it comes within 600px of the viewport (`useInView`, `src/lib/inView.ts`): its thousands of
scatter dots had put about 250 ms of blocking time into the load (Lighthouse TBT 273–324 ms, from under 90). The screenshot
script sweeps a page to the bottom and back before a full-page capture so the band is in the picture. Inside the auto-height
iframe the frame's viewport is the whole document, so there the band renders at once.

The analysis blocks had made the side panel two and a half times the map's height at laptop width, leaving the column under the
map empty. They now form a full-width band between the board and the table that follows the selection: for a Senate or governor
overview, "Compared with 2024" (the vote-weighted aggregate and the three biggest moves each way) with the county scatter on the
left and "How counties voted" on the right; for a selected statewide race, that race's shift sentence, scatter and patterns; for a
selected measure, its Yes/No patterns alone. The House has no band (no district baseline, no district county rows). The panel
keeps the glance, the still-counting list, the latest calls and the flips. The CLAUDE.md paragraphs above that place the scatter
and patterns "on the panel" predate this move. (Nov. 8: the latest calls, the runoffs and the flips left the panel too; see
"Polish pass".)

## Three more statistics (Nov. 7, 2026, evening)

All in `src/lib/shift.ts`, from the results and the 2024 baseline already in hand; nothing new is fetched.

- **Counties that changed sides since 2024** (`countyFlip`, `countyFlips`, `countyFlipsText`): a county whose head-to-head
  winner differs from its 2024 presidential winner, counted as the vote stands (a partial count can still change it), only in
  races that read against 2024 (`comparable`) and only for counties with a 2024 figure and votes. On the race card and the
  state tooltip as a sentence (the card needs the office's county rows: the panel and the race page pass them, the table's
  expanded card does not have them), on the county tooltip as "Changed sides since 2024", outlined in ink on the shift map
  (`.is-flipped`, with a key entry), and summed across the office in the "Compared with 2024" block.
- **Votes counted against 2024 turnout** (`turnoutVs2024`, `officeTurnout`): a statewide race's or measure's total as a
  share of its state's 2024 presidential vote. A sentence on the race card ("Votes counted so far come to 78% of the state's
  2024 presidential vote"), pooled in the "Compared with 2024" block, and a `votes_vs_2024_turnout_pct` CSV column. No
  House figure: a district has no 2024 total.
- **Senate and governor on the same ballot** (`ticketPairs`, `TicketPairs` in `Analysis.tsx`): every state with both races
  read head to head (a state with two Senate races pairs its regular one), the two Democratic-minus-Republican margins side by
  side, widest gap first, a "Split" tag where the leaders differ; a table under the analysis grid on the Senate and governor
  overviews (the surname column hides under 700px), and takeaway five when any state split.

## County pages and the county finder (Nov. 7, 2026, night)

A county is the one place every reader in the country has, so every county in the 50 states has a page of its own, reachable
three ways and shareable as a link. (Until Nov. 9 only states electing a senator or governor had them; see "A county page in
all 50 states" below, which this section now includes.)

- **Route**: `#senate-wi-55073` / `#governors-wi-55073` / `#house-in-18097`, the third segment a county FIPS inside the state
  (`Selection.county`, optional). On the House view five digits that begin with the state's FIPS prefix are a county (no
  district number has five digits); a FIPS from another state reads as a district the state does not have and gets the
  missing-district notice. The measures view has no county pages, since a measure's id sits in that segment.
  On the Senate and governor views opening one forces the counties map mode (an effect in App) and choosing the states mode
  leaves the page (`pickMode`), since that map cannot show one county; the House has one map, the hexes, so a county page
  there leaves the mode alone. Escape steps county → state → overview.
- **Finder** (`CountyFinder.tsx`, a WAI-ARIA combobox): "How did your county vote?" at the top of every overview panel,
  under a state's county map on the Senate and governor views and under a state's district rows on the House view. Every word typed must appear in the county's name or state
  ("marathon wi"); names that begin with the first word rank first; eight matches at most. A pick opens the county on
  the current tab when its state has a race there, else the Senate, else the governor, else the House view (Indiana,
  Missouri, North Dakota, Utah and Washington elect neither a senator nor a governor this year). Counties come from the
  atlas, so the list says it is loading until the shapes land. The District of Columbia is in the atlas and has no race
  here, so it is not offered. Hidden in print.
- **Map**: inside a zoomed state, clicking a county opens its page (the first tap on a phone zooms, the second picks); the
  county is outlined in ink over a paper casing (`.county-outline`) and named first among the county labels, in bold.
- **Page** (`CountyView.tsx`): the name as the atlas has it ("Marathon, Wisconsin": us-atlas carries no County/Parish/Borough
  suffix), the Census line (people, density, bachelor's share, median income, white non-Hispanic share), the county's
  2024 presidential vote (`county2024` in `shift.ts`), then a block per race in the state that covers the county (Senate,
  governor, House, measures; each title opens the race): every county column with votes, share and bar, Others when there are any,
  % reporting, votes, the county's votes against its own 2024 presidential vote (`countyTurnoutVs2024`), the shift
  sentence and "Changed sides since 2024". `Back.tsx` is the shared step-back button. A FIPS the atlas does not have shows the
  state's list with a notice, like an unknown measure or district (see "Polish pass").

## A county page in all 50 states (Nov. 9, 2026, night)

"How did your county vote?" had nothing to offer in Indiana, Missouri, North Dakota, Utah and Washington, which elect neither a
senator nor a governor this year. The civicAPI files already fetched carry every House race by county, so the House joined the
county pages with no new source.

- **Pipeline**: `build.py` writes `public/data/counties-H.json` (435 races, about 3,760 rows, 42 KB gzipped) in the row shape of the
  other county files: a district's part of each county it covers. It fails unless every atlas county outside the District of
  Columbia (`DC_FIPS`; civicAPI's Nov. 3 search has no delegate race) has at least one House row. civicAPI sends Illinois one row
  named "Chicago" beside Cook County's; `NOT_COUNTIES` skips it and fails the build if it ever carries votes.
- **Front end**: `CountySets` has `H`, loaded with the other three after the first paint (`loadCounties`). `CountyView` lists a
  House district when it has a row for the county, so those blocks appear once the county files land. 409 counties sit in more
  than one district (Los Angeles in 18, Cook in 11, Harris in nine); the page then says "Marion is split among two House
  districts. Each shows the votes from its part of the county." (`.county-fact--split`) and shows each district's part. House
  blocks carry no shift, turnout or changed-sides line: a district has no 2024 baseline. Florida does not print unopposed races,
  so FL-10's block says the candidate ran unopposed and the state reports no votes.
- Los Angeles County's page lists 18 districts and is long (about 5,400 px at phone width). Deliberate: every district's part is a
  real result a reader there may want; nothing is folded.
- **Seen in civicAPI's files and left**: Marathon County, Wisconsin (55073) carries the same figures in WI-07 (race 87489: Alfonso
  34,468, Clark 26,381, 87.9% reporting) and in the governor's race (87491: Tiffany 34,468, Crowley 26,381, 87.9%). It is the only
  one of the House county rows that matches a statewide row in its county. The county clerk's unofficial summary (checked Nov. 9)
  has Tiffany 34,468 and Crowley 26,381 for governor and Alfonso 32,382 and Clark 27,685 for Congress, so the WI-07 row is the
  copy: it overstates Alfonso by 2,086 votes and understates Clark by 1,304 in that county. The page still shows both as civicAPI
  reports them (civicAPI is the only source); reported to Rowan, not corrected.
- Gate: `county-house` (Marion, Indiana: a split county in a state with no Senate or governor race) and `house-finder`.

## What happens next, and why a race is not called (Nov. 9, 2026, late night)

Two additions for the days after the election, when the page's readers ask what the count is waiting for.

- **What happens next** (`KeyDates.tsx`, `upcoming` in `src/lib/next.ts`): the first block under the map on the Senate, governor and
  House overviews (`OverviewLists`, before the latest calls). It lists the dates from `pipeline/key-dates.json` for states where
  that office still has a race without a winner, honoring an entry's `offices`, soonest first, each kept until its day (or its
  `end`) is over in Central time. Six show (`LISTED`) with a "Show all N dates" button; the block is keyed by office so it folds
  back on a tab change. The note says where the dates come from and that they can change. No block on the measures tab (the file
  covers only states with a candidate race open) and none during a replay (App passes no dates then: the dates are today's).
  On Nov. 9 the Senate tab had seven dates (Mississippi, Alaska), the governor tab four (Alaska) and the House tab 23.
- **Why isn’t this called?** on every uncalled candidate race card (see Race status rules). The share card and the tooltips do not
  carry it.
- Alaska's ranked-choice note now says the tabulation runs "on Nov. 18" (it said "around"): the Division of Elections calendar
  gives that day.
- **Left out of the dates file because no primary source confirmed them**: Alaska's recount request deadlines and contest date,
  California's Dec. 8 date, Maine's recount request date, Minnesota's county canvass window and recount request date, Tennessee's
  county and state certification dates, whether Mississippi has a recount at all (secondary reports only; it has no recount
  sentence), whether FL-27's recount was ordered (the state's site says "Machine Recount Indicated"), and the outcome of ME-02's
  ranked-choice tabulation, which began Nov. 9. Kansas and Wisconsin dates were verified but have no uncalled race, so they are
  not in the file.
- Gate: `key-dates` (the House overview's under-map lists) and `why-not-called` (Mississippi Senate's panel).

## Statement pass (Nov. 7, 2026)

- **Things to know** (`src/lib/takeaways.ts`, `Takeaways.tsx`): up to six sentences written from the data under the chamber
  cards, each a button into the view behind it: the closest race still being counted (statewide, else House), the seats that
  changed parties with the widest flip, the House popular vote beside the seat count, the move since 2024 (once the baseline
  loads; Senate first), the states that split their Senate and governor votes between the parties (when any did) and the home
  state (its statewide winner, delegation and questions). Derived from the results in hand, so it replays with them. The list
  sits three across on a laptop (six as 3 by 2, five as 3 and 2).
- **Swing arrows** (`NationalMap.tsx`, `ShiftStyle`): the shift mode draws arrows by default, one per county from its center,
  up-left toward Democrats and up-right toward Republicans, length by the move up to 30 points (`ARROW_MAX` 17 map units,
  divided by the zoom so they hold their size in a zoomed state, and `ARROW_ZOOMED` 2.4 times longer and bolder there, where moves are often under 10 points), over a flat `ARROW_BASE` fill; "Shading" in the key returns
  the choropleth. In both drawings a county under `COUNTED` (90) percent reporting is lighter (`is-partial`), after the Boston
  Globe's rule of reading swings only where the count is nearly done. Arrows take no pointer events; the county underneath
  keeps the tooltip.
- **Where the vote moved** (`ShiftScatter.tsx`): every county of the office's comparable races (or of one race on its state
  panel) as a dot, x people per square mile on a log axis, y the move since 2024, area by votes, lighter under 90% counted;
  a native title names the county. Inside the "Compared with 2024" block and under a state's county map.

## WordPress embed

`src/lib/embed.ts` posts `{type: "wpr-embed-height", id: "wpr-national-midterm-2026", height}` to the parent whenever
`document.body` resizes (standard WPR shape, same as wpr-auto-loan and wpr-tip-desk). The snippet forwards the article's
hash into the iframe so a shared link opens on the right view, and passes the article URL as `?host=` so "Copy link"
(`src/lib/share.ts`) produces an article link, not the Pages URL. Only `https://*.wausaupilotandreview.com` is accepted as a host.
`allow="clipboard-write; web-share"` is what lets the copy buttons and the share sheet work inside the frame.

Another newsroom embeds the same page with `?home=<its state>` and without `?host=` (Copy link then gives the Pages URL, since only
WPR's domain is accepted as a host). **`partners.html`** (`src/partners.tsx`, linked from the footer as "Newsrooms: embed these
results") is the page to send them: what readers get, what WPR asks (keep the masthead, footer and civicAPI credit; say it is from
WPR; tell us where it runs; calls are civicAPI's), a state picker that builds the snippet (`pageEmbedSnippet` in `embed.ts`, the one
source for the page snippet; `compactEmbedSnippet` for the module) with a live preview of the app in a frame sized by the height
message, and the contact (`PARTNER_EMAIL`, the sales address until WPR names another). The snippets above are what those
functions produce with WPR's `?host=`.

```html
<div id="wpr-national-midterm-2026"></div>
<script>
(function () {
  var f = document.createElement('iframe');
  f.src = 'https://rowanflynnpilot.github.io/wpr-national-midterm-2026/?host='
    + encodeURIComponent(location.origin + location.pathname) + location.hash;
  f.style.cssText = 'width:100%;border:0;min-height:900px';
  f.allow = 'clipboard-write; web-share';
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
value, a "Book this placement →" mailto to `SALES_EMAIL` (chris.weber@wausaupilotandreview.com, the one address) with the
placement in the subject, which also copies the address and confirms inline. `?demo` fills every open slot with "Your Brand
Here" under a ribbon that names itself a sales preview; sold slots are never overridden. The footer carries "Advertise on this
page". To sell the slot: fill in `SPONSORS.title`, drop the logo in `public/sponsors/`, commit.

## Compact embed

`compact.html` + `src/compact.tsx`: the balance of power (four cards), the first three "things to know" (as links to the full
page at the view behind each; it loads the 2024 baseline for the shift sentence) and the six latest calls, for a homepage module
or an article sidebar. One `results.json` fetch, no maps, refreshed every 15 minutes. Container queries lay the cards 1, 2 or 4
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

## Single-race embed

`race.html` + `src/race.tsx`: one race for an article, at any view hash that names a race (`race.html#governors-wi`,
`#house-wi-03`, `#measures-wi-179849`): the compact masthead, the race card as an `h1` (with the shift line once the
baseline loads), the county map for a statewide race or measure (it loads only that office's county file, `loadCountySet`),
and a link to the full page at the same hash (the article's hash when `?host=` is passed). Refreshes every 15 minutes.
It posts `{type: "wpr-embed-height", id: "wpr-national-midterm-2026-race-<hash>", height}`, one id per race so several
can share an article. The panel's race views carry an "Embed this race in an article" button (`EmbedRace.tsx`) that
copies the snippet (`raceEmbedSnippet` in `src/lib/embed.ts`, single-quoted so it pastes into a WordPress HTML block
whole); it is for the newsroom and does not print. `parseHash`/`toHash` moved to `src/lib/route.ts` so both pages share them.

## Sharing and freshness

- `share.html` + `src/share.tsx` render `ShareCard` (balance of power with the parliament arcs, 1200×630; the bottom line carries
  the measures tally and, from the 2024 baseline, how far the Senate vote moved). `scripts/share-image.mjs` screenshots it to
  `dist/share.png` as the last step of `npm run build` and stamps `?v=<fetched>` onto the og:image URL in `dist/index.html`
  so crawlers refetch after each data run. Open Graph and Twitter tags live in `index.html`.
- **A card and a link for every race** (Nov. 7, night). `share.html#<race hash>` renders `RaceShare` (the race's title, where it
  stands, up to four candidates with photos or an initial disc, shares, votes and the shift line; a measure's title gets
  smaller type and three lines). The same script walks every race hash (the page lists them in `#card-index`, so the route
  grammar stays in TypeScript), screenshots each to `dist/share/<hash>.jpg` (JPEG: 639 cards are 37 MB, about 40 s a build)
  and writes `dist/s/<hash>.html`, a stub page whose meta tags carry that card (`cardMeta` in `RaceShare.tsx`, copied from the
  page's `#card-meta`) and whose script sends a reader on to the app at the race's hash, or to the article named by `?to=`
  when it is on WPR's domain (the publisher pattern is `PUBLISHER` in `share.ts`, read from the page). A hash fragment
  never reaches a crawler, so this is the only way a shared race link gets its own preview. Stubs are `noindex`.
- `ShareRace.tsx`, on every race view in the panel and on `race.html`: "Share this race" opens the device's share sheet
  (`navigator.share`; the iframe needs `allow="web-share"`), else copies the stub link (`raceShareUrl`: `s/<hash>.html`,
  with `?to=<article>` when embedded), and "Save image" downloads the card. The toolbar's Copy link is unchanged: it copies
  the view itself (the article hash when embedded), and the stub exists for the preview.
- `.stale` notice appears when `results.fetched` is more than three hours old (`isStale`, re-checked every minute).

## Polish pass (Nov. 8, 2026)

- **A link that names no race shows the state, not a blank page.** `#measures-wi-1`, `#house-wi-99` or `#governors-wi-55999`
  used to throw from the panel and, with no error boundary, React unmounted the whole app. A URL is the reader's input
  (a typo, a link truncated in a text message, a measure civicAPI renumbers), so `SidePanel` now checks the race with
  `raceFor` (and the county against the atlas once it loads) and renders the state's list under a one-line notice
  ("No measure matches that link. Showing Wisconsin instead.", `.panel__missing`, the stale notice's style). The hash is left
  as typed, so Copy link and Escape behave as on any state list. The data still fails fast in `build.py`; `race.html` and
  `share.html` still throw on a bad hash, since there it is a newsroom's setup error. The gate captures all three.
- **The overview's calls, runoffs and flips sit under the map** (`OverviewLists` in `SidePanel.tsx`, rendered by App inside
  the board as `.board__under`, grid area "under" spanning both columns; stacked under 960px it follows the panel, which is
  where those lists read before). At laptop width the panel had run about a thousand pixels past the map, leaving the
  column under the map blank; now the panel beside the map holds the finder, the glance and the races still being counted,
  and the lists lay out `auto-fill` at panel width (two on a tablet, one on a phone). The measures and House panels still run
  long when their still-counting lists did (`COUNTING_LISTED` 40); the second round below capped the list.

## Polish pass, second round (Nov. 8, 2026, afternoon)

- **A Kansas measure that was not on the ballot** is excluded in the pipeline (`pipeline/exclusions.json`, see Pipeline).
- **Races with no votes yet sort last** among the uncalled (`chamber.uncalled` in `summary.ts`): a zero margin is not a close count, and
  they had led a list captioned "Closest first".
- **One rule for a missing reporting share** (`reportingShare`, see Known data limits).
- **The panel ends near the map on every tab.** The still-counting list shows 12 rows and a "Show all N" button (the House had 29 rows and
  the measures 40, running 1,300 and 3,000 px past the map at 1280), and "Measures that failed" moved under the map into `OverviewLists`
  beside the latest calls, where the Senate's flips already sit.
- **A measure's analysis band spans the width**: `.analysis__grid--one` was capped at 36rem, leaving the right half blank and the result
  bars short.
- The gate gained `measures-ak` (the rows without a share) and `measures-lists` (the under-map lists on the measures tab; clip `under`).
- The House caption is "One hexagon per House district, placed near its voters", one line beside the controls at 1280.
- The partner page's preview frame loads lazily, after the text and the snippet.

## Seat pop-up (Nov. 9, 2026)

- **A click on a seat opens its race where the reader is.** It used to select the race in the panel, which at laptop width is
  below the fold, so the click looked like nothing happened. See "Parliament arcs" under Front end for the pop-up's rules.
- **"Open on the map" brings the board into view.** `selectRace` in App scrolls `#board` to the top on wide screens (under 960px
  `select` already scrolled to the panel), so the seat pop-up, the table's expanded card and the analysis band all land the reader
  on the map and panel they changed. The table's button and the pop-up's share the `.open-map` class.
- **The Senate arc was clipped.** The arc's viewBox stopped at the outer ring, and the Senate's dots (radius 5 of 98) were cut at the
  far left, far right and bottom; the governors' (radius 6.6) too. The box now pads the ring by the dot radius.
- The gate gained `senate-arc-click` and `governors-arc-click` (the pop-up, clipped to itself).

## Seat pop-up, second round (Nov. 9, 2026, afternoon)

- **Keyboard access to the arcs** (see Parliament arcs under Front end). Gate: `senate-arc-keys` (focus walks the seats and shows the
  tooltip) and `senate-arc-enter` (Enter opens the pop-up); the gate's clip target is scrolled into view after the focus and key steps,
  since those may be what creates it.
- **A quiet count says so.** When an office's newest timestamped call is more than a day old (`QUIET_MS`), the Latest calls list ends
  with "The newest call with a time here is from Nov. 7, 3:12 p.m. CST. The count goes on; the calls are civicAPI's." (reworded that evening:
  civicAPI calls some races without a timestamp, so "nothing has been called since" claimed more than the list knows). civicAPI made no call
  between Kansas governor on Nov. 7 and at least Nov. 9, and the list's ages had read as the page being stuck. During a replay the
  clock is the position's call time, so the line does not appear.
- **The still-counting list shows 8 rows** (`COUNTING_LISTED`, was 12). Measured at 1280 against the map column's content: the Senate
  and governor panels end 70–90 px above the map; the House panel ran 900 px past it and the measures panel 550 px, and the shorter
  list brings them to 700 and 360 px over. What remains is the glance (about 300 px on every tab) and the House's popular-vote and
  margin blocks, all deliberate; leveling those tabs would mean moving the glance under the map there, which was not done.
- **AP cross-check**: AP called FL-13 for Luna on Nov. 5 at 2:38 p.m. EST, so civicAPI's Nov. 4 call stands agreed. Kansas governor:
  no AP call found by Nov. 9 (MultiState reports one, the Movement Voter Project's AP feed shows none); Masterson's recount window
  runs to about Nov. 17. Left as civicAPI reports it.
- **Lighthouse (Nov. 9, mobile, `lighthouse` 13.6 via npx with Playwright's Chromium, `serve.mjs` gzip server)**: the current build and
  the pre-pop-up commit 9db689c, built in a worktree and run alternately, both score 89–93 with 120–460 ms of blocking time run to run,
  LCP 0.9 or 3.1–3.4 s by the simulation's bimodality, CLS 0, accessibility and best practices 100. Today's code moved nothing; the
  "under 90 ms" blocking time recorded on Nov. 7 does not reproduce on the baseline either, so it was the Lighthouse version or the
  machine. Run Lighthouse alone: runs that overlapped the screenshot gate read 20–100 ms worse.

## Review pass (Nov. 9, 2026, evening)

A fresh walk of every view at 360 to 1600 px against the live data. Wording and phone-table fixes only; no number changed its meaning.

- **One rule for a margin in words and one for a signed margin** (`format.ts`). `marginWords` gives "less than 0.1" under a tenth of a
  point and one decimal otherwise (the status lines and takeaways had printed "leads by 0.0 points"); `signedMargin` gives "+2.3",
  "−0.4", "<0.1" or "<0.1 behind" for the panel rows, the sparkline and the margin strip. `sentenceStart` capitalizes a sentence's
  first letter, so a count that opens a sentence is spelled out and capitalized ("Two not called" on the chamber cards, the takeaways).
- **County flips say which way** (`flipWays` in `shift.ts`): ": 11 to Democrats, 1 to Republicans", ", all to Democrats", or nothing when
  none changed. `countyFlipsText` and the "Compared with 2024" block both end with it.
- **Where one party ran several candidates, the comparison says its votes are added** (`summedNote` in `shift.ts`: "The three
  Republicans’ votes are added together for this comparison"). Alaska's ranked-choice races are the live case: the shift line and the
  ticket table read the Republicans' summed first choices, so the card shows a Democrat leading beside a shift computed from a
  Republican total. The note follows the shift line on the race card, the race's analysis lede, and the ticket table's lede names Alaska.
- **Takeaway one names its scope** ("The closest House race still being counted is …"), and the delegation tally keeps its figures on
  one line with non-breaking spaces.
- **The stale notice** reads "These results may be out of date. They were last fetched {time}." **Back labels** are "All Senate races" /
  "All governor races" (lowercasing the office name had produced "All senate races"). The map's title is "{Senate} results by state".
- **Phone tables.** The measures table's `.measure-cell` floor of 11rem is gone and its Margin column hides under 700px. Under 390px
  (`@media (max-width: 389px)` near the end of `styles.css`) the header labels wrap, cell padding is 0.25rem, the candidate cell's
  party dash is 8px with a 0.25rem gap and a 5.9rem floor ("Hickenlooper" needs 82px to stay whole at 13px), the expander column is
  24px and the state link is 0.75rem ("Massachusetts" and "New Hampshire" set that column's floor). Measured at 360, 375 and 390 on
  all four tables: no sideways overflow, no word broken mid-word. A scratch script did the measuring; the gate does not cover 360.
- **The refresh is not hourly in practice.** The workflow's cron is hourly, but GitHub ran it 14 times between Nov. 6 09:21 UTC and
  Nov. 9 17:28 UTC, with gaps of 4 to 11 hours (scheduled workflows on free runners are delayed and dropped under load; every run that
  started succeeded). Rowan chose softer copy over an outside trigger for `workflow_dispatch` (Nov. 9, night): the footer, the
  partner page, the meta and Open Graph descriptions and the race stubs' descriptions say "several times a day", and the open
  sponsor slot's line is "Reach Wisconsin readers following every race in the country." (it was "every race, every hour"). Do not
  write "hourly" in reader-facing copy again. The cron stays hourly, since that is the request GitHub is given. The stale notice is
  still three hours (`STALE_AFTER_MS`), so with these gaps it shows for much of the day; raising it is Rowan's call.
- Seen and left: the ticket table's Alaska row reads "R +2.0" beside a pale blue map (explained by the lede now); NC-05's reporting
  share fell from 100% to 87% in civicAPI's own figures; the filter labels wrap to two lines at 360.

## Polish pass, third round (Nov. 8, 2026, evening)

- **Measures that need more than a majority say so.** Florida Amendment 2 drew 58.2% Yes and failed under Florida's 60% rule, and the
  card read "Failed" with a check beside No at 41.8%; Colorado Amendment 85 showed a pale Yes lead at 51% while short of its 55%.
  `pipeline/measure-rules.json` and the status rules above carry the threshold into the words (card, share card, tooltip, table status,
  CSV, panel rows). New Hampshire Question 1 (64.8% Yes, two-thirds needed) is the other live case.
- **Blank ballots are "Blank", not "Other candidates".** Minnesota counts a blank as a No on an amendment, so civicAPI reports 230,000
  blank lines on Amendment 1; the measure's Others bucket is now named `Blank` / "No vote on the question" in `build.py`, and the county
  page's remainder row takes the race's own name for it.
- The CSV's `pct_reporting` is blank where the share is not given (Alaska's measures), matching the table's dash.
- The main page's meta and Open Graph descriptions name the statewide ballot measures, as the compact and partner pages did.
- Kansas governor added to the AP cross-check below: civicAPI's call stands; the mismatch is recorded.
- The gate gained `measure-threshold` (Florida Amendment 2's card) and `measure-blank` (Minnesota Amendment 1's card).

## Review pass (Nov. 5, 2026, evening)

Based on a survey of AP, Decision Desk HQ, NBC, ABC and 2024 accessibility audits (notes in `reports/polish-2026-11-05/README.md`):
hover styles are gated behind `(hover: hover) and (pointer: fine)`; controls have `:active` feedback, `touch-action: manipulation`
and no text selection; form controls are 16px on coarse pointers; a skip link; the map's accessible name carries the tallies
(`mapDescription` in App); a visually hidden status line announces the selection. Deliberately not done: a sticky balance-of-power
strip (sticky does not work inside the auto-height iframe), a needle or probabilities (no model), swing vs. 2024 (no county
baselines under the new maps), incumbent markers (civicAPI flags only ~50).

## Phone pass (Nov. 7, 2026, evening)

Found by walking every view in 844px slices under Playwright's iPhone 14 emulation (touch, coarse pointer, no hover) at 390
and 360 wide; the committed gate's full-page captures are too small to show phone-width faults. Under 700px the map-mode
control had wrapped two of its four labels onto two lines, so each button carries a long and a short label (`.seg-long`,
`.seg-short`: "Counting", "vs. 2024") and the control takes a row of its own, full width, after the Copy link (`order: 1`),
which joins the Wisconsin chip and the state picker on the first row. A zoomed county map painted past the map's box over
the page around it (`.national-map` has `overflow: visible` for its shadow): `.is-zoomed` clips it. The county map's
readout ("Point at or tap a county") lost the tapped county as the finger lifted, since a touch pointer leaves on
pointerup; a touch pointerleave is ignored, so the tap's county stays until the next. Stacked under 960px the board's
bottom rule sat 1.5rem under the panel's last list rule and read as an empty band, so the stacked board has no bottom
rule and the analysis band brings no rule of its own at any width (the board's rule is the separator on wide screens).
Coarse pointers get 40px-tall chip controls, 16px on every select (the patterns picker had 13px and would zoom iOS Safari),
and wider hit areas on the sort headers and key entries through padding offset by negative margins so no row moves; the
scatter's "Point at a dot" sentence is hidden there (`.fine-hint`). The margin key's third row is "Ind." (it was
clipped at every width). At tablet width the toolbar's controls ran past their column and clipped the Copy link:
`.map-controls` may now shrink (`flex: 0 1 auto`) so its children wrap inside the column; it still drops to its own line
whole, since the toolbar breaks lines by the unshrunk basis. Verified under emulation; sticky hover, rubber-banding, safe areas and the keyboard still want a phone.

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
the two preloaded fonts it truly needs. Both are honest; 94 was the floor, 93 after the swing and demographics layers added about 8 KB of JavaScript (Nov. 7: 100, 93, 93). Accessibility 100, Best Practices 100, CLS 0,
TBT under 90 ms. The mono font is not preloaded (tables only, below the fold). `npm run screens` doubles as the zero-console-errors gate. `npm audit` clean.

## Deploy

`public/embed-test.html` wraps the build in the CLAUDE.md snippet, and below it one race through the race snippet, so both
auto-heights can be checked locally (`/embed-test.html` on Pages).
`.github/workflows/update-results.yml` checks out the branch tip (`ref: main`, not the pushed commit: runs are serialized by the
`pages` concurrency group, and a queued push-triggered run must see the snapshot the run before it committed, or its own snapshot
commit conflicts in `pipeline/history.json`; that failed once on Nov. 7), fetches, tests, builds (including share.png via a cached Playwright Chromium) and deploys to Pages on an hourly cron (GitHub runs it far less often: see "Review pass (Nov. 9, 2026, evening)"; each run makes ~500 civicAPI requests; keep it gentle on a free API). Enable Pages → Source: "GitHub Actions" in repo settings, and run the workflow once by hand to publish. If a fetch or build fails, nothing deploys and the last good version stays up. Stop the cron once states certify (late November into December).

## AP cross-check (Nov. 5, 2026)

Every race civicAPI called by under 3 points (27 races) was checked against AP reporting. 26 agree. **NY-21** (Constantino R +2.1)
is called by civicAPI and Decision Desk HQ but was not called by AP as of Nov. 5; left as civicAPI reports it. civicAPI called
FL-13 nearly two days before AP. Its `percent_reporting` lags AP on several called races (TN-09, NJ-02, NY-02, TN-07, TN governor). **Kansas governor**
(Holscher D +0.7 at 95% in) was called by civicAPI on Nov. 7 and by Decision Desk HQ; on Nov. 8 NBC still had it too close to call and
Masterson had asked for "another look". Left as civicAPI reports it.

## Next steps

1. Settings → Pages → Source: GitHub Actions, then run "Update results" once by hand.
3. Local measures (civicAPI has ~2,300 `election_type` "Local" referendums) are out of scope.
