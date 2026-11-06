# 2026 Midterm Election Results

Interactive results for every U.S. Senate, House and governor race in the Nov. 3, 2026 midterm elections, built by [Wausau Pilot & Review](https://wausaupilotandreview.com).

- National balance of power for the Senate, House and governors, with a data-driven headline
- State maps, county margins, and a "still counting" view of where votes remain, for every Senate and governor race
- A hex map of all 435 House districts, placed near where each district's voters live, fully keyboard-navigable
- Race cards with candidate photos, call times and county maps; latest calls and closest races; a searchable, sortable table of every race
- A Wisconsin shortcut for WPR readers, a copy-link button, an Open Graph card that updates with the data, and a WordPress embed that sizes itself

## Data

Results and race calls come from [civicAPI](https://civicapi.org), a free election results API. Race calls may differ in timing from the Associated Press and other decision desks, and all results are unofficial until states certify them. Map boundaries are from the U.S. Census Bureau via [us-atlas](https://github.com/topojson/us-atlas). Candidate photos are official congressional portraits (public domain) or Wikimedia Commons images under the license listed on the site's credits page.

## Run it

```
npm install
npm run data        # fetch the latest results (Python 3, standard library only)
npm run dev
```

`npm run build` writes the static site to `dist/`, including the share image. `npm test` runs the unit tests, `npm run screens` captures every view at four widths, and `npm run headshots` resolves candidate photos (by hand; the result is committed). A GitHub Actions workflow refreshes the data and redeploys to GitHub Pages hourly and on every push. See CLAUDE.md for the details.
