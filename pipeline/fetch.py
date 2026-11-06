"""Fetch Nov. 3, 2026 U.S. Senate, House and Governor results from civicAPI.

Writes raw API responses to pipeline/raw/:
  search.json            every race on the 2026-11-03 ballot (filtered to our three offices)
  races/<id>.json        full race detail (candidates, incumbency, call time, county results)

civicAPI is free for commercial use with attribution: https://civicapi.org
"""
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = "https://civicapi.org/api/v2"
ELECTION_DATE = "2026-11-03"
OFFICES = {"US Senate", "House of Representatives", "Governor"}
STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
    "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
    "VA", "WA", "WV", "WI", "WY",
}
RAW = Path(__file__).parent / "raw"
USER_AGENT = "wpr-national-midterm-2026/1.0 (Wausau Pilot & Review)"


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        if resp.status != 200:
            raise RuntimeError(f"{url} -> HTTP {resp.status}")
        return json.load(resp)


def fetch_search() -> list[dict]:
    url = f"{API}/race/search?startDate={ELECTION_DATE}&endDate={ELECTION_DATE}&limit=50000"
    data = get_json(url)
    if data["count"] != len(data["races"]):
        raise RuntimeError(f"search truncated: count={data['count']} returned={len(data['races'])}")
    races = [r for r in data["races"] if r["type"] in OFFICES and r["province"] in STATES]
    return races


def fetch_detail(race_id: int) -> None:
    detail = get_json(f"{API}/race/{race_id}")
    (RAW / "races" / f"{race_id}.json").write_text(json.dumps(detail))


def main() -> None:
    started = time.time()
    (RAW / "races").mkdir(parents=True, exist_ok=True)
    races = fetch_search()
    counts = {o: sum(r["type"] == o for r in races) for o in OFFICES}
    expected = {"US Senate": 35, "House of Representatives": 435, "Governor": 36}
    if counts != expected:
        raise RuntimeError(f"unexpected race counts {counts}, expected {expected}")
    (RAW / "search.json").write_text(json.dumps({"fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "races": races}))
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(fetch_detail, [r["id"] for r in races]))
    print(f"fetched {len(races)} races in {time.time() - started:.0f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
