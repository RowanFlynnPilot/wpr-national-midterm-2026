"""Record how each race's count has moved, one point per data run.

    python pipeline/history.py              # append the current public/data/results.json
    python pipeline/history.py --backfill   # also replay every results.json in git history (one-time seed)

pipeline/history.json  {"<race id>": [[t, leader, margin, pctIn], ...]}   t = Unix seconds of the fetch
public/data/history.json  the last WINDOW_DAYS of it, only races with two or more points

A race is recorded while it has no winner, and after a call only while its numbers keep
changing (late counts). Nothing is recorded twice for one fetch, and a point identical to
the previous one is not repeated: a flat stretch is implied between points.
The workflow commits pipeline/history.json back to main after each run with [skip ci].
"""
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
HISTORY = ROOT / "pipeline" / "history.json"
PUBLIC = ROOT / "public" / "data" / "history.json"
RESULTS = ROOT / "public" / "data" / "results.json"
WINDOW_DAYS = 7


def seconds(iso: str) -> int:
    return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp())


def record(results: dict, history: dict[str, list]) -> int:
    t = seconds(results["fetched"])
    added = 0
    for r in results["races"]:
        points = history.get(str(r["id"]), [])
        if r["winner"] and not points:
            continue  # called before we started watching: nothing to chart
        if points and points[-1][0] >= t:
            continue  # this fetch (or a later one) is already in
        point = [t, r["leader"], r["margin"], r["pctIn"]]
        if points and points[-1][1:] == point[1:]:
            continue  # no movement
        history.setdefault(str(r["id"]), points).append(point)
        added += 1
    return added


def backfill(history: dict[str, list]) -> None:
    shas = subprocess.run(["git", "log", "--reverse", "--format=%H", "--", "public/data/results.json"],
                          cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    for sha in shas:
        blob = subprocess.run(["git", "show", f"{sha}:public/data/results.json"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        results = json.loads(blob)
        if "fetched" not in results:
            continue
        n = record(results, history)
        print(f"{sha[:8]} {results['fetched']}: {n} points", file=sys.stderr)


def public_slice(history: dict[str, list], now: int) -> dict[str, list]:
    cutoff = now - WINDOW_DAYS * 86400
    out = {}
    for key, points in history.items():
        recent = [p for p in points if p[0] >= cutoff]
        earlier = [p for p in points if p[0] < cutoff]
        if earlier:
            recent = [earlier[-1], *recent]  # anchor the window with the last point before it
        if len(recent) >= 2:
            out[key] = recent
    return out


def main() -> None:
    history: dict[str, list] = json.loads(HISTORY.read_text(encoding="utf-8")) if HISTORY.exists() else {}
    for key in history:
        history[key].sort()
    if "--backfill" in sys.argv:
        backfill(history)
    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    added = record(results, history)
    HISTORY.write_text(json.dumps(history, separators=(",", ":")) + "\n", encoding="utf-8")
    slice_ = public_slice(history, seconds(results["fetched"]))
    PUBLIC.write_text(json.dumps(slice_, separators=(",", ":")), encoding="utf-8")
    print(f"recorded {added} points; history covers {len(history)} races, public slice {len(slice_)} races with movement")


if __name__ == "__main__":
    main()
