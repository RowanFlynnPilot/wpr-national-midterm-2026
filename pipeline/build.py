"""Normalize raw civicAPI responses into the static JSON the explorer reads.

Reads  pipeline/raw/search.json, pipeline/raw/races/*.json, pipeline/baselines.json
Writes public/data/results.json      every Senate, House and Governor race
       public/data/counties-S.json   county results for each Senate race
       public/data/counties-G.json   county results for each Governor race
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
RAW = ROOT / "pipeline" / "raw"
OUT = ROOT / "public" / "data"
OFFICE_CODE = {"US Senate": "S", "House of Representatives": "H", "Governor": "G",
               "Referendum": "B", "Proposition": "B", "Ballot Measure": "B"}  # B: statewide ballot measure
COUNTY_TYPES = {"County", "Parish", "Borough", "City"}  # Virginia independent cities carry county FIPS
# Alaska split Valdez-Cordova (02261) in 2019; us-atlas still draws the old census area.
FIPS_MERGE = {"02063": "02261", "02066": "02261"}
# Louisiana held open House primaries on Nov. 3; anyone under 50% goes to a Dec. 12 runoff.
# civicAPI only flags `advanced` once both finalists are settled (LA-06's second place was not).
MAJORITY_RUNOFF = {("LA", "H")}
KEEP_MIN_PCT = 1.0
MAX_CANDS = 5
COUNTY_CANDS = 3
COUNTY_TOLERANCE_PCT = 2.0  # county rows normally sum within 0.3% of the statewide total; more means a broken feed
# Candidate photos resolved by hand with `npm run headshots` (scripts/headshots.mjs); keyed by civicAPI candidate_id.
HEADSHOTS_PATH = ROOT / "pipeline" / "headshots.json"
HEADSHOTS = json.loads(HEADSHOTS_PATH.read_text(encoding="utf-8")) if HEADSHOTS_PATH.exists() else {}
for _id, _entry in HEADSHOTS.items():
    if _entry.get("file") and not (ROOT / "public" / "headshots" / _entry["file"]).exists():
        raise RuntimeError(f"headshots.json points at missing file public/headshots/{_entry['file']} ({_entry['name']})")


def party_code(party: str) -> str:
    return {"Democratic": "D", "Republican": "R"}.get(party, "I")


def candidate_party(c: dict, office: str) -> tuple[str, str]:
    """(code, display name). Measures carry Y/N; Nevada lists "None of These Candidates" as a ballot line with no party."""
    if office == "B":
        return {"Yes": "Y", "No": "N"}[c["name"]], ""
    if c["name"].lower().startswith("none of these"):
        return "O", "Ballot option"
    if not c["party"]:
        return "I", "No party listed"
    return party_code(c["party"]), c["party"]


def norm_name(name: str) -> str:
    """Applied to both civicAPI and us-atlas names, so "Alexandria City" meets "Alexandria" and "Carson City" meets itself."""
    return re.sub(r"[^a-z]", "", name.lower().removesuffix(" county").removesuffix(" parish").removesuffix(" borough").removesuffix(" city"))


def load_county_index() -> tuple[set[str], dict[tuple[str, str], str]]:
    topo = json.loads((OUT / "us-albers-10m.json").read_text())
    geoms = topo["objects"]["counties"]["geometries"]
    ids = {g["id"] for g in geoms}
    by_name = {(g["id"][:2], norm_name(g["properties"]["name"])): g["id"] for g in geoms}
    return ids, by_name


def candidates(raw: list[dict], office: str) -> list[dict]:
    if office == "B":  # Yes and No only; blank-ballot lines (Massachusetts) fold into "Others"
        raw = sorted(raw, key=lambda c: c["name"] not in ("Yes", "No"))
    ordered = sorted(raw, key=lambda c: -c["votes"])
    total = sum(c["votes"] for c in ordered)
    kept, rest = [], []
    for c in ordered:
        is_writein_bucket = c["name"].lower() == "write-in" or (office == "B" and c["name"] not in ("Yes", "No"))
        if not is_writein_bucket and len(kept) < MAX_CANDS and (c["winner"] or c["percent"] >= KEEP_MIN_PCT or len(kept) < 2):
            kept.append(c)
        else:
            rest.append(c)
    out = [
        {"id": c["candidate_id"], "name": re.sub(r"\s+", " ", c["name"]).strip(), "party": candidate_party(c, office)[0], "partyName": candidate_party(c, office)[1],
         "votes": c["votes"], "pct": c["percent"], "winner": c["winner"], "advanced": c.get("advanced", False),
         "photo": HEADSHOTS.get(str(c["candidate_id"]), {}).get("file")}
        for c in kept
    ]
    other_votes = sum(c["votes"] for c in rest)
    if other_votes:
        out.append({"id": 0, "name": "Others", "party": "O", "partyName": "Other candidates", "votes": other_votes,
                    "pct": round(100 * other_votes / total, 2), "winner": False, "advanced": False, "photo": None})
    return out


def district_num(district: str) -> int:
    seat = district.split("-")[1]
    return 0 if seat == "AL" else int(seat)


def county_rows(detail: dict, cands: list[dict], ids: set[str], by_name: dict) -> dict[str, list]:
    regions = [r for r in detail["region_results"].values() if r["type"] in COUNTY_TYPES]
    state_prefix = next(r["fips"][:2] for r in regions if r.get("fips"))
    top = [c["name"] for c in cands if c["party"] != "O"][:COUNTY_CANDS]
    rows = {}
    for r in regions:
        fips = r.get("fips") or by_name.get((state_prefix, norm_name(r["name"])))
        fips = FIPS_MERGE.get(fips, fips)
        if fips not in ids:
            raise RuntimeError(f"{detail['election_name']}: county {r['name']!r} fips={r.get('fips')} not in us-atlas")
        votes = {re.sub(r"\s+", " ", c["name"]).strip(): c["votes"] for c in r["candidates"]}
        main = [votes.get(name, 0) for name in top]
        row = [r["percent_reporting"], *main, sum(votes.values()) - sum(main)]
        if fips in rows:  # merged census areas: sum votes, keep the lower reporting share
            prev = rows[fips]
            row = [min(prev[0], row[0]), *[a + b for a, b in zip(prev[1:], row[1:])]]
        rows[fips] = row
    statewide = sum(c["votes"] for c in cands)
    counted = sum(sum(row[1:]) for row in rows.values())
    if statewide and abs(counted - statewide) > statewide * COUNTY_TOLERANCE_PCT / 100:
        raise RuntimeError(f"{detail['election_name']}: counties sum to {counted} votes but the race reports {statewide}")
    return rows


def check_race(name: str, detail: dict, cands: list[dict]) -> None:
    """Fail the build on states the front end cannot represent."""
    winners = [c for c in cands if c["winner"]]
    if len(winners) > 1:
        raise RuntimeError(f"{name}: multiple winners {[c['name'] for c in winners]}")
    if winners and any(c["advanced"] for c in cands):
        raise RuntimeError(f"{name}: has a winner and runoff finalists")
    if any(c["votes"] < 0 for c in cands):
        raise RuntimeError(f"{name}: negative vote count")
    if sum(c["pct"] for c in cands) > 100.5:
        raise RuntimeError(f"{name}: candidate shares sum past 100%")
    if not 0 <= detail["percent_reporting"] <= 100:
        raise RuntimeError(f"{name}: percent_reporting {detail['percent_reporting']}")


def main() -> None:
    search = json.loads((RAW / "search.json").read_text())
    baselines = json.loads((ROOT / "pipeline" / "baselines.json").read_text())
    ids, by_name = load_county_index()
    races, counties = [], {"S": {}, "G": {}, "B": {}}
    latest = ""
    for r in search["races"]:
        detail = json.loads((RAW / "races" / f"{r['id']}.json").read_text())
        office = OFFICE_CODE[r["type"]]
        cands = candidates(detail["candidates"], office)
        if office == "B" and [c["party"] for c in cands if c["party"] != "O"] not in (["Y", "N"], ["N", "Y"]):
            raise RuntimeError(f"{r['election_name']}: measure without a Yes/No pair")
        check_race(r["election_name"], detail, cands)
        winners = [c for c in cands if c["winner"]]
        holder = None
        if office in ("S", "G"):
            holder = baselines[{"S": "senate", "G": "governor"}[office]]["seat_holder"].get(r["province"])
            if holder not in ("D", "R", "I"):
                raise RuntimeError(f"{r['election_name']}: no pre-election seat holder for {r['province']} in baselines.json")
        winner = winners[0]["party"] if winners else None
        major = [c for c in cands if c["party"] != "O"]
        runoff = not winner and (
            any(c["advanced"] for c in cands)
            or ((r["province"], office) in MAJORITY_RUNOFF and major[0]["pct"] < 50)
        )
        # Top-two finalists from one party (California, Washington): the seat's party is settled before a call.
        same_party = (not winner and not runoff and len(major) >= 2
                      and major[0]["party"] == major[1]["party"] and major[0]["party"] in ("D", "R"))
        latest = max(latest, detail["last_updated"])
        races.append({
            "id": r["id"],
            "office": office,
            "state": r["province"],
            "district": r["district"] if office != "B" else f"{r['province']}-{r['id']}",  # measures route by id
            "num": district_num(r["district"]) if office == "H" else None,
            "title": r["election_name"] if office == "B" else None,
            "special": "special" in r["election_name"].lower(),
            "pctIn": detail["percent_reporting"],
            "updated": detail["last_updated"],
            "calledAt": detail.get("called_at") if winner else None,  # civicAPI omits it on some races called at poll close
            "winner": winner,
            "leader": major[0]["party"],
            "prior": holder,
            "flip": (winner != holder) if (holder and winner) else None,
            "runoff": runoff,
            "unopposed": len(major) == 1,
            "partyDecided": major[0]["party"] if same_party else None,
            "margin": round(major[0]["pct"] - major[1]["pct"], 2) if len(major) > 1 else 100.0,
            "marginVotes": major[0]["votes"] - major[1]["votes"] if len(major) > 1 else major[0]["votes"],
            "total": sum(c["votes"] for c in cands),
            "cands": cands,
        })
        if office in counties:
            counties[office][str(r["id"])] = county_rows(detail, cands, ids, by_name)

    for office, holder_key in (("S", "senate"), ("G", "governor")):
        expected = set(baselines[holder_key]["seat_holder"])
        got = {x["state"] for x in races if x["office"] == office}
        if expected != got:
            raise RuntimeError(f"{holder_key} states mismatch: missing={expected - got} extra={got - expected}")

    races.sort(key=lambda x: (x["office"], x["state"], x["num"] or 0))
    OUT.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated": latest,
        "fetched": search["fetched_at"],
        "baselines": {k: {kk: vv for kk, vv in v.items() if kk != "seat_holder"} for k, v in baselines.items() if not k.startswith("_")},
        "races": races,
    }
    (OUT / "results.json").write_text(json.dumps(payload, separators=(",", ":")))
    for office, data in counties.items():
        (OUT / f"counties-{office}.json").write_text(json.dumps(data, separators=(",", ":")))
    print(f"wrote {len(races)} races; latest update {latest}")


if __name__ == "__main__":
    main()
