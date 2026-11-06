# Polish session report — Nov. 5, 2026

Six commits on `main`, each deployed green by the "Update results" workflow (which now also runs on push).
JS bundle 327 KB → 64 KB gzipped. Lighthouse mobile: Performance 95–100, Accessibility 100, Best Practices 100.

## Flagged for you

1. **NY-21 call mismatch.** civicAPI (and Decision Desk HQ) call it for Anthony Constantino (R, +2.1). AP had not called it as of Nov. 5 (Spectrum News Nov. 4 evening; NCPR Nov. 5). Left as civicAPI reports it; nothing was changed. The other 26 races called within 3 points all match AP (sources in the AP cross-check below).
2. **Embed listener.** You asked me to ask which repo holds the WPR listener. Unable to ask, I matched the fleet convention used by wpr-auto-loan and wpr-tip-desk: `{type: "wpr-embed-height", id: "wpr-national-midterm-2026", height}`, plus wpr-auto-loan's `?host=` hand-off so "Copy link" produces an article link. Snippet in CLAUDE.md. Please confirm that is the listener you meant.
3. **Wisconsin shortcut: proposal, not built** (see below).
4. **Ballot measures tab** (stretch) not started.
5. **civicAPI's `% reporting` lags AP** on several called races (TN-09 87.6, NJ-02 85.3, NY-02 80.7, TN-07 93.5, TN governor 90.9). It is civicAPI's figure, labeled as such; nothing to fix on our side.
6. Live stories seen while checking calls, not verified: GA-01 (Hollowell plans to contest after certification), AR-02 (provisionals counted into next week; recount not ruled out), NC-14 (Womack's pending charge).

## Wisconsin shortcut — proposed design

Recommended: two small pieces, both data-driven from what is already loaded.

- **A "Wisconsin" chip** in the map toolbar beside "Jump to a state". One tap selects WI on whichever tab is open (`#house-wi`, `#governors-wi`; on the Senate tab, where WI has no 2026 race, it opens the state panel that lists the governor race and the eight House seats). On the maps, WI gets a thin teal outline at rest so readers can find it.
- **"Wisconsin at a glance"** at the top of the overview panel, under the popular-vote block on the House tab: the governor result row and the 8-seat delegation bar (`4 D, 4 R`), each row clickable. Hidden once the reader has picked a state, so it never competes with the state panel.

Rejected: opening the page on `#governors-wi` by default (the national headline is the story), and a `?focus=wi` embed parameter (invisible to readers who arrive by link).

## What changed, by phase

### 1. Speed and correctness
- us-atlas moved out of the bundle into `public/data/us-albers-10m.json` (one committed copy, also read by `build.py` and `hexmap.mjs`); `us-atlas` and the full `d3` package dropped. No chunk warning.
- AP spot-check of all 27 races civicAPI called within 3 points: 26 agree, NY-21 flagged (above).
- Vitest: 32 tests over `status.ts`, `summary.ts`, `share.ts` and `format.ts` against a frozen fixture of 19 real races. CI runs them before building.
- `build.py` fails on two winners, a winner plus runoff finalists, negative votes, shares past 100%, reporting outside 0–100, a statewide race with no seat holder, or county rows more than 2% off the statewide total (real data is within 0.3%).

### 2. Embed and sharing
- iframe height via ResizeObserver in the fleet's message shape; "Copy link" button for the current view; Open Graph and Twitter tags; `share.png` (1200×630) rendered from the same seat tallies as the tabs on every build, with the data timestamp stamped onto the og:image URL; "may be out of date" notice after three hours.

### 3. Design and UX
- Hex cartogram: interior holes filled (layout regenerated; 50 states contiguous, one hex per district).
- Keyboard: hexes have a roving tabindex, arrow keys walk the grid, Enter selects, the tooltip follows focus; states and chips get the same ring; chamber tabs follow the WAI-ARIA tabs pattern.
- Counties mode zooms to the clicked state with an "All states" control; strokes don't scale; no animation under `prefers-reduced-motion`.
- Results refetch every 15 minutes and on tab focus; the old render dims while loading; a failed refresh shows a specific notice and keeps the last good data.
- Phone table: names no longer break mid-word, Status wraps instead of clipping, district codes don't split at the hyphen. Chamber-tab footers stack under 960 px. Muted text darkened to pass AA on cream (3.98:1 → 5.1:1).

### 4. Reader value
- "Latest calls" on the overview panel: the eight newest calls for the office, with relative times; calls civicAPI gave no timestamp are skipped and the note says so.

### 5. Quality gates
- Fonts self-hosted and preloaded (the Google Fonts stylesheet was the render-blocking request behind a 4 s LCP). Map shapes load after first paint behind a fixed-ratio placeholder. A margin collapse in the loading state caused the only layout shift; fixed. `<main>` landmark added; stray `aria-label`s removed.
- `npm audit`: 0 vulnerabilities. `npm run screens`: zero console errors across 14 views × 4 widths. Actions: green on every push.

## Review pass (evening)

A second pass against the craft, Web Interface Guidelines and mobile-native checklists, a worst-case-data stress test, and a survey of what AP, Decision Desk HQ, NBC, ABC and PBS shipped this cycle (NYT, Post, Bloomberg, CNN and Politico block fetching; their rows rest on secondary write-ups).

Built from the survey: a "Still counting" county mode showing where votes remain (DDHQ's "Remaining"); a "No votes yet" map state so an early lead is never painted (NYT's gray); per-race update times on the card (AP, DDHQ); data-driven map descriptions for screen readers (the 2024 audits' main complaint); the Dec. 12 date on Louisiana runoff cards and the Nov. 18 timing on Alaska's ranked-choice note; "Seat decided … winner not called" wording for California's same-party finals. Already in place before the survey: the uncalled list sorted by margin with leader and % in, the "N not called" counter, the latest-calls feed, the table as the maps' text twin, a search shortcut.

From the checklists: hover states gated to devices that can hover, press feedback, no tap flash, 16 px touch inputs, a skip link, one status line for assistive tech, print styles. The stress test (70-character names, one-glyph names, 100% shares) found and fixed a horizontal overflow in the race card.

Skipped on purpose: a sticky balance-of-power strip (position: sticky cannot work inside the auto-height iframe), needles or win probabilities (no model), swing arrows vs. 2024 (no county baselines under the redrawn maps), incumbent asterisks (civicAPI flags about 50 of 370).

## Lighthouse (mobile, gzip-served build, two runs per view)

| View | Performance | Accessibility | Best Practices | LCP | CLS |
|---|---|---|---|---|---|
| Before (#senate) | 83 | 96 | 100 | 4.1 s | 0.11 |
| #senate | 100 / 96 | 100 | 100 | 0.8 / 2.7 s | 0 |
| #house | 100 / 100 | 100 | 100 | 0.8 / 0.8 s | 0 |
| #governors | 96 / 95 | 100 | 100 | 2.8 / 2.7 s | 0 |

Full report for one run: [lighthouse-mobile-senate.html](lighthouse-mobile-senate.html). Measured with `node scripts/serve.mjs 4174`, which gzips like GitHub Pages; Vite's preview server does not, which understates the scores.

## Before / after

| View | Before | After |
|---|---|---|
| Senate, 1280 | ![](senate-1280-before.jpg) | ![](senate-1280-after.jpg) |
| House, 1280 | ![](house-1280-before.jpg) | ![](house-1280-after.jpg) |
| House hex map hover, 1280 | ![](house-hover-1280-before.jpg) | ![](house-hover-1280-after.jpg) |
| Senate, 390 | ![](senate-390-before.jpg) | ![](senate-390-after.jpg) |
| WI-03 panel and table, 390 | ![](house-wi-03-390-before.jpg) | ![](house-wi-03-390-after.jpg) |
| Wisconsin House, 768 | ![](house-wi-768-before.jpg) | ![](house-wi-768-after.jpg) |
| Senate counties, 1600 | ![](senate-counties-1600-before.jpg) | ![](senate-counties-1600-after.jpg) |

New views: counties mode zoomed to Texas ([senate-counties-tx-1280-after.jpg](senate-counties-tx-1280-after.jpg)), keyboard focus on a hex with its tooltip ([house-keyboard-1280-after.jpg](house-keyboard-1280-after.jpg)), the share card ([share-after.png](share-after.png)).

## AP cross-check (27 races called within 3 points)

| Race | civicAPI | AP | Source |
|---|---|---|---|
| TN-09 | Taylor R +1.1 | Called for Taylor, Nov. 5 | fox17.com, timesfreepress.com |
| OH-10 | Knickerbocker D +1.6 | Called, Nov. 5 | whio.com |
| NY-21 | Constantino R +2.1 | **Not called** | spectrumlocalnews.com, northcountrypublicradio.org |
| NC-09 | Ojeda D +2.2 | Called, Nov. 5 | rollcall.com |
| NC-14 | Womack D +2.2 | Called, Nov. 5 | wtop.com (AP wire) |
| NC-06 | Jefferson D +2.3 | Called, Nov. 5 | wtop.com (AP wire) |
| VA-01 | S. Taylor D +2.4 | Called, Nov. 5 | vpm.org |
| NC-13 | Barringer D +2.4 | Called, Nov. 5 | kare11.com (AP) |
| NJ-02 | Mullock D +2.7 | Called, Nov. 5 | inquirer.com |
| FL-13 | Luna R +0.8 | Called, Nov. 5 (civicAPI called Nov. 3) | baynews9.com |
| OK-05 | Bice R +1.3 | Called | newson6.com |
| FL governor | Donalds R +1.3 | Called, Nov. 3 | npr.org |
| AR-02 | Hill R +1.7 | Called, Nov. 5 | katv.com |
| LA Senate | Letlow R +1.8 | Called, Nov. 3 | lailluminator.com |
| MI-04 | McCann D +1.8 | Called, Nov. 4 | michiganpublic.org |
| TX-02 | Toth R +2.0 | Called, Nov. 4 | wtop.com (AP wire) |
| FL-04 | Bean R +2.1 | Called, Nov. 3 | baynews9.com (AP wire) |
| VA-05 | McGuire R +2.2 | Called, Nov. 5 | wric.com |
| TN-07 | Van Epps R +2.2 | Called, Nov. 5 | cbsnews.com |
| NY-01 | LaLota R +2.2 | Called, Nov. 5 | wtop.com (AP wire) |
| NY-02 | Garbarino R +2.3 | Called, Nov. 5 | yahoo.com (AP wire) |
| TX-27 | Cloud R +2.3 | Called, Nov. 4 | wtop.com (AP wire) |
| TN governor | Blackburn R +2.5 | Called, Nov. 4 | wsmv.com |
| GA-01 | Kingston R +2.8 | Called, Nov. 4 | wtoc.com |
| FL Senate special | Moody R +2.9 | Called, Nov. 3 | jaxtoday.org |
| TX-32 | Yarbrough R +2.9 | Called, Nov. 4 | wtop.com (AP wire) |
| TX-05 | Gooden R +2.9 | Called, Nov. 4 | foxnews.com (AP calls) |
