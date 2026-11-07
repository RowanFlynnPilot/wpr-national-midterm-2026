"""County demographics from the U.S. Census Bureau's American Community Survey, for the "county patterns" block.

Run by hand (`npm run demographics`), never on the cron: the inputs do not change. Downloads four ACS 5-year table
files and the county gazetteer into pipeline/raw/acs/ (gitignored), writes public/data/demographics.json:

    {"vintage": "2017-2021 ACS 5-year", "counties": {"<fips>": [population, collegePct, medianIncome, whiteNhPct, density]}}

    population   B01003 total population
    collegePct   share of adults 25 and over with a bachelor's degree or higher (B15003)
    medianIncome median household income in 2021 dollars (B19013); null where the Census publishes none
    whiteNhPct   share of the population that is white alone and not Hispanic or Latino (B03002)
    density      people per square mile of land (gazetteer ALAND_SQMI)

Vintage 2021 is the last whose geography is the counties the maps and civicAPI use: from the 2022 release the Census
reports Connecticut by planning region. Alaska's split census areas are merged like the vote (FIPS_MERGE): population,
college and white counts are summed, the median income is the population-weighted mean of the two medians.
Public domain (U.S. government work); credited in the footer.
"""
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

from build import FIPS_MERGE, ROOT, load_county_index

VINTAGE = 2021
SF = f"https://www2.census.gov/programs-surveys/acs/summary_file/{VINTAGE}/table-based-SF/data/5YRData"
GAZETTEER = f"https://www2.census.gov/geo/docs/maps-data/data/gazetteer/{VINTAGE}_Gazetteer/{VINTAGE}_Gaz_counties_national.zip"
TABLES = {
    "b01003": ["E001"],  # total population
    "b15003": ["E001", "E022", "E023", "E024", "E025"],  # 25+: total, bachelor's, master's, professional, doctorate
    "b19013": ["E001"],  # median household income
    "b03002": ["E001", "E003"],  # total, white alone not Hispanic or Latino
}
RAW = ROOT / "pipeline" / "raw" / "acs"
OUT = ROOT / "public" / "data" / "demographics.json"
USER_AGENT = "wpr-national-midterm-2026/1.0 (Wausau Pilot & Review)"
COUNTY = "0500000US"


def download(url: str, dest: Path) -> bytes:
    if dest.exists():
        return dest.read_bytes()
    print(f"downloading {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = resp.read()
    dest.write_bytes(data)
    return data


def table(name: str, fields: list[str]) -> dict[str, list[int | None]]:
    """County rows of one ACS table: fips -> the requested estimates (None where the Census publishes none)."""
    text = download(f"{SF}/acsdt5y{VINTAGE}-{name}.dat", RAW / f"{name}.dat").decode("utf-8")
    lines = text.splitlines()
    header = lines[0].split("|")
    cols = [header.index(f"{name.upper()}_{f}") for f in fields]
    rows = {}
    for line in lines[1:]:
        if not line.startswith(COUNTY):
            continue
        parts = line.split("|")
        rows[parts[0][len(COUNTY):]] = [int(parts[c]) if parts[c] not in ("", ".") and int(parts[c]) >= 0 else None for c in cols]
    return rows


def land_sqmi() -> dict[str, float]:
    data = download(GAZETTEER, RAW / "gazetteer.zip")
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        text = z.read(z.namelist()[0]).decode("utf-8")
    lines = text.splitlines()
    header = [h.strip() for h in lines[0].split("\t")]
    geoid, aland = header.index("GEOID"), header.index("ALAND_SQMI")
    return {parts[geoid]: float(parts[aland]) for parts in (l.split("\t") for l in lines[1:]) if len(parts) > aland}


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    pop, edu, inc, race = (table(n, f) for n, f in TABLES.items())
    land = land_sqmi()
    ids, _ = load_county_index()
    wanted = {i for i in ids if i[:2] <= "56"}  # the 50 states and D.C.; the atlas has no territories
    counts: dict[str, dict] = {}
    for fips in set(pop) & set(edu) & set(inc) & set(race) & set(land):
        if fips[:2] > "56":
            continue
        p = pop[fips][0]
        adults, *degrees = edu[fips]
        total, white = race[fips]
        if p is None or adults is None or total is None or white is None or any(d is None for d in degrees):
            raise RuntimeError(f"{fips}: a count the shares need is missing")
        c = counts.setdefault(FIPS_MERGE.get(fips, fips), {"pop": 0, "adults": 0, "degrees": 0, "total": 0, "white": 0, "land": 0.0, "income": []})
        c["pop"] += p
        c["adults"] += adults
        c["degrees"] += sum(degrees)
        c["total"] += total
        c["white"] += white
        c["land"] += land[fips]
        if inc[fips][0] is not None:
            c["income"].append((inc[fips][0], p))
    missing = wanted - set(counts)
    if missing:
        raise RuntimeError(f"{len(missing)} atlas counties have no ACS row: {sorted(missing)[:10]}")
    out = {}
    for fips in sorted(wanted):
        c = counts[fips]
        if c["pop"] <= 0 or c["adults"] <= 0 or c["total"] <= 0 or c["land"] <= 0:
            raise RuntimeError(f"{fips}: zero population, adults, total or land")
        weight = sum(w for _, w in c["income"])
        income = round(sum(v * w for v, w in c["income"]) / weight) if weight else None
        out[fips] = [
            c["pop"],
            round(100 * c["degrees"] / c["adults"], 1),
            income,
            round(100 * c["white"] / c["total"], 1),
            round(c["pop"] / c["land"], 1),
        ]
    OUT.write_text(json.dumps({"vintage": f"{VINTAGE - 4}-{VINTAGE} ACS 5-year", "counties": out}, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} counties, {sum(1 for v in out.values() if v[2] is None)} without a median income", file=sys.stderr)


if __name__ == "__main__":
    main()
