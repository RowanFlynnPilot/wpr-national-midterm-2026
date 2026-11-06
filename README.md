# 2026 Midterm Election Results

Interactive results for every U.S. Senate, House and governor race in the Nov. 3, 2026 midterm elections, built by [Wausau Pilot & Review](https://wausaupilotandreview.com).

- National balance of power for the Senate, House and governors
- State and county results maps for every Senate and governor race
- A hex map of all 435 House districts, placed near where each district's voters live
- Race-by-race detail and a searchable table of every race

## Data

Results and race calls come from [civicAPI](https://civicapi.org), a free election results API. Race calls may differ in timing from the Associated Press and other decision desks, and all results are unofficial until states certify them. Map boundaries are from the U.S. Census Bureau via [us-atlas](https://github.com/topojson/us-atlas).

## Run it

```
npm install
npm run data   # fetch the latest results (Python 3, standard library only)
npm run dev
```

`npm run build` writes the static site to `dist/`. A GitHub Actions workflow refreshes the data and redeploys to GitHub Pages every hour.
