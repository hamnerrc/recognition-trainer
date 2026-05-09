"""
database_add.py
---------------
Fetches Team Blind (TBLD) case images from the visualcube API and
adds them to ll-images.json under the "tbld" key.

Each entry in db["tbld"] is:
  {
    "name": "Sledge",
    "alg":  "U R U' R'",
    "img":  "data:image/svg+xml;base64,..."
  }

Usage:
  1. Place this script in the same folder as ll-images.json.
  2. Paste your cases string into the CASES variable below.
  3. Run:  python database_add.py

Skips entries that are already in the database (safe to re-run).
"""

import json
import base64
import urllib.request
import urllib.parse
import time
import os
import sys

# ── Paste your tab-separated "Name\tAlg" block here ───────────────────────────
CASES = """
Sledge	U R U' R'
Hedge	y' U' R' U R
Split	R U R'
fill	y' R' U' R
Bonk	(F' L' U2 L F) R U R'
Fonk	R U' R' (F' L' U2 L F)
Count	(R2 U2' R' U' R U' R') U2 R'
Clock	(R U2 R U R' U R) U2' R2'
Cat	(R' F R F') R U R'
dog	U2 R U' R' (F R' F' R)
Flip	y' R' U R (f R U R2' U' R f')
12	(F R' F' R) (U R U R')
Crib	U (F U R U' R' F') R U' R'
Rud	(R U2' R' U') R U R'
Flood	y' (R' U2' R U) R' U' R
Sleep	U (R' F R F') (U R U R')
Wake	d' (L F' L' F) (U' L' U' L)
verse	(R U' R' U) R U' R'
slice	y' (R' U R U') R' U R
Spam	(R U' R' U) R U R'
Wave	d (R' U R U') R' U' R
sex	(R U R' U') R U R'
sled	y' (R' U' R U) R' U' R
Buff	(R U2' R' U2) R U' R'
horse	y' (R' U2 R U2') R' U R
mult	(R U R' U) R U' R'
wide	y' (R' U R U2') R' U' R
thin	U2 (R U2' R' U) R U' R'
horn	y' (R' U2 R U') R' U R
ny	(R U' R' U') R U R'
Car	U d (R' U' R U') R' U' R
Trip	U2 (F R' F' R) (U' R U R')
Tree	(R' F R F') R U' R'
stand	(R U' R' U2) R U' R'
com	U2 R' D' (R U R' D) R
stripe	U' R U R' (F R' F' R)
Tux	U' (F' U' F U') R U R'
snake	(R U R' U2) R U' R'
Scorch	U d (R' U' R U) R' U2 R
check	R' U2' R2 U R2' U R
mate	d R U2' R2' U' R2 U' R'
""".strip()
# ──────────────────────────────────────────────────────────────────────────────

DB_PATH   = "ll-images.json"
API_BASE  = "https://api.cuberoot.me/v1/visualcube.svg"
IMG_SIZE  = 256
DELAY_SEC = 0.35   # polite delay between requests


def parse_cases(text: str) -> list[dict]:
    """Parse tab-separated 'Name\\tAlg' lines into a list of dicts."""
    cases = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t", 1)
        if len(parts) != 2:
            print(f"  ⚠  Skipping malformed line: {repr(line)}")
            continue
        name, alg = parts[0].strip(), parts[1].strip()
        if name and alg:
            cases.append({"name": name, "alg": alg})
    return cases


def build_url(alg: str) -> str:
    """Build the visualcube API URL for a given alg (applied as a case, i.e. inverted)."""
    # quote_plus: spaces → '+', apostrophes → '%27', etc.
    encoded = urllib.parse.quote_plus(alg)
    return f"{API_BASE}?case={encoded}&mask=f2l&size={IMG_SIZE}"


def fetch_svg(alg: str) -> bytes:
    url = build_url(alg)
    req = urllib.request.Request(url, headers={"User-Agent": "database_add.py/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status != 200:
            raise IOError(f"HTTP {resp.status}")
        return resp.read()


def load_db() -> dict:
    if os.path.exists(DB_PATH):
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"oll": {}, "pll": {}}


def save_db(db: dict) -> None:
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, separators=(",", ":"))   # compact — same style as original


def main() -> None:
    if CASES == "PASTE_CASES_HERE":
        sys.exit("❌  You forgot to paste your cases into the CASES variable!")

    cases = parse_cases(CASES)
    if not cases:
        sys.exit("❌  No valid cases found after parsing. Check your CASES string.")

    print(f"📋  Parsed {len(cases)} cases.")

    db = load_db()
    if "tbld" not in db:
        db["tbld"] = {}

    added   = 0
    skipped = 0
    errors  = 0

    for i, case in enumerate(cases):
        key = str(i)

        # Skip if already present (safe re-run)
        if key in db["tbld"] and db["tbld"][key].get("img"):
            print(f"  [{i:>3}] {case['name']:12s} — already in DB, skipping.")
            skipped += 1
            continue

        print(f"  [{i:>3}] {case['name']:12s}  ({case['alg']}) … ", end="", flush=True)
        try:
            svg_bytes = fetch_svg(case["alg"])
            b64 = base64.b64encode(svg_bytes).decode("ascii")
            db["tbld"][key] = {
                "name": case["name"],
                "alg":  case["alg"],
                "img":  f"data:image/svg+xml;base64,{b64}",
            }
            print("✅")
            added += 1
        except Exception as exc:
            print(f"❌  {exc}")
            errors += 1

        # Save after every entry so a crash doesn't lose progress
        save_db(db)
        time.sleep(DELAY_SEC)

    print(f"\n✅  Done.  added={added}  skipped={skipped}  errors={errors}")
    print(f"   Total tbld entries in DB: {len(db['tbld'])}")


if __name__ == "__main__":
    main()
