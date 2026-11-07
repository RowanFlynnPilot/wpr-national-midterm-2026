"""The 2024 presidential vote by county and by state, for the "shift since 2024" layer.

Source: MIT Election Data and Science Lab, "County Presidential Election Returns 2000-2024", Harvard Dataverse,
doi:10.7910/DVN/VOQCHQ, CC0 1.0. The download sits behind a Dataverse guestbook, so it is fetched by hand: save the
file as pipeline/raw/medsl/countypres_2000-2024.csv (or .tab) and run `npm run baseline`. Never on the cron: the input
does not change.

Writes public/data/baseline-2024.json:
    {"source": "...", "counties": {"<fips>": [dem, rep, total]}, "states": {"<USPS>": [dem, rep, total]}}

Counties are kept only where the atlas draws them (Alaska reports by legislative district and Connecticut by planning
region in this file, so those have state totals only). The build fails unless the national totals land within 1% of
the certified count, which catches a double-counted vote mode or a mis-read column.
"""
import csv
import json
import sys
from pathlib import Path

from build import FIPS_MERGE, ROOT, load_county_index

SRC_DIR = ROOT / "pipeline" / "raw" / "medsl"
OUT = ROOT / "public" / "data" / "baseline-2024.json"
SOURCE = "MIT Election Data and Science Lab, County Presidential Election Returns 2000-2024 (CC0)"
YEAR = "2024"
CERTIFIED = {"DEMOCRAT": 75_017_613, "REPUBLICAN": 77_303_568}  # Harris, Trump; the check allows 1%
TOLERANCE = 0.01
DISTRICT_STATES = {"AK"}  # reported by state House district, not borough; state totals only
FIPS_ALIAS = {"46113": "46102"}  # Shannon County, S.D., became Oglala Lakota County in 2015; the atlas uses the new code


def source_file() -> Path:
    files = sorted(SRC_DIR.glob("countypres*"))
    if not files:
        raise RuntimeError(f"no countypres file in {SRC_DIR}; download it from doi:10.7910/DVN/VOQCHQ (see the docstring)")
    return files[0]


def rows_2024(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    dialect = "excel-tab" if "\t" in text.splitlines()[0] else "excel"
    return [r for r in csv.DictReader(text.splitlines(), dialect=dialect) if r["year"] == YEAR and r["office"] == "US PRESIDENT"]


def fips_of(raw: str) -> str | None:
    raw = raw.strip()
    if not raw or raw.upper() == "NA":
        return None
    return raw.removesuffix(".0").zfill(5)


def main() -> None:
    rows = rows_2024(source_file())
    if not rows:
        raise RuntimeError("no 2024 presidential rows in the file")
    # A county reported by vote mode (early, election day, ...) may also carry a TOTAL row; use TOTAL where it exists.
    by_county: dict[tuple, list[dict]] = {}
    for r in rows:
        by_county.setdefault((r["state_po"], r["county_name"], r["county_fips"]), []).append(r)
    ids, _ = load_county_index()
    counties: dict[str, list[int]] = {}
    states: dict[str, list[int]] = {}
    for (state, _name, raw_fips), group in by_county.items():
        if any(r["mode"] == "TOTAL" for r in group):
            group = [r for r in group if r["mode"] == "TOTAL"]
        dem = sum(int(r["candidatevotes"]) for r in group if r["party"] == "DEMOCRAT")
        rep = sum(int(r["candidatevotes"]) for r in group if r["party"] == "REPUBLICAN")
        total = max(int(r["totalvotes"]) for r in group)
        if dem > total or rep > total:
            raise RuntimeError(f"{state} {_name}: party votes exceed the total")
        s = states.setdefault(state, [0, 0, 0])
        s[0] += dem
        s[1] += rep
        s[2] += total
        fips = fips_of(raw_fips)
        fips = FIPS_MERGE.get(fips, FIPS_ALIAS.get(fips, fips)) if fips else None
        if state in DISTRICT_STATES:
            fips = None  # the "county_fips" of a legislative district collides with real borough codes
        if fips in ids:
            c = counties.setdefault(fips, [0, 0, 0])
            c[0] += dem
            c[1] += rep
            c[2] += total
    for party, i in (("DEMOCRAT", 0), ("REPUBLICAN", 1)):
        got = sum(s[i] for s in states.values())
        if abs(got - CERTIFIED[party]) > CERTIFIED[party] * TOLERANCE:
            raise RuntimeError(f"national {party} total {got:,} is not within 1% of the certified {CERTIFIED[party]:,}")
    if len(states) != 51:
        raise RuntimeError(f"{len(states)} states in the file, expected 50 plus D.C.")
    OUT.write_text(json.dumps({"source": SOURCE, "counties": counties, "states": states}, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(counties)} counties, {len(states)} states", file=sys.stderr)


if __name__ == "__main__":
    main()
