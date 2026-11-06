"""Refresh the self-hosted brand faces in public/fonts.

    python scripts/fetch_fonts.py

Downloads the latin subset of each family from Google Fonts' CSS, exactly as a
browser would receive it: one variable woff2 per family covering every weight the
page uses. src/styles.css declares the three faces with the unicode-range this
prints; if Google changes the subset, update that too. Same approach as wpr-auto-loan.

Fraunces, Public Sans and JetBrains Mono are all SIL Open Font License 1.1.
"""
import re
import urllib.request
from pathlib import Path

CSS_URL = (
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700"
    "&family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
)
# A modern UA, so the CSS carries woff2 URLs and unicode-range subsets.
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
OUT = Path(__file__).parent.parent / "public" / "fonts"


def main() -> None:
    css = urllib.request.urlopen(urllib.request.Request(CSS_URL, headers={"User-Agent": UA})).read().decode()
    blocks = re.findall(r"/\* (\S+) \*/\s*@font-face \{(.*?)\}", css, re.S)
    files: dict[str, str] = {}  # family -> url
    ranges: dict[str, str] = {}
    for subset, body in blocks:
        if subset != "latin":
            continue
        family = re.search(r"font-family: '([^']+)'", body).group(1)
        url = re.search(r"url\(([^)]+)\)", body).group(1)
        rng = re.search(r"unicode-range: ([^;]+);", body).group(1)
        if files.setdefault(family, url) != url:
            raise SystemExit(f"{family} is served as more than one file; the single-file @font-face no longer holds")
        ranges[family] = rng
    if len(files) != 3:
        raise SystemExit(f"expected 3 families, got {sorted(files)}")
    OUT.mkdir(parents=True, exist_ok=True)
    for family, url in files.items():
        data = urllib.request.urlopen(url).read()
        name = family.lower().replace(" ", "-") + ".woff2"
        (OUT / name).write_bytes(data)
        print(f"{name}: {len(data):,} bytes")
    if len(set(ranges.values())) != 1:
        raise SystemExit("the families no longer share one latin unicode-range; declare each in styles.css")
    print("unicode-range:", next(iter(ranges.values())))


if __name__ == "__main__":
    main()
