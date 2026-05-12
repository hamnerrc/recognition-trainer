"""
oll_database_add.py
-------------------
Fetches named OLL case images from visualcube and adds them to
ll-images.json under the "oll_named" key.

Each entry in db["oll_named"] is:
  {
    "name": "Sune",
    "alg":  "R U R' U R U2 R'",
    "img":  "data:image/<type>;base64,..."
  }

Usage:
  1. Place this script in the same folder as ll-images.json.
  2. Paste your tab-separated "Name\\tAlg" cases into the CASES variable.
  3. Run:  python oll_database_add.py

Safe to re-run — already-fetched entries are skipped.
"""

import json
import base64
import urllib.request
import urllib.parse
import time
import os
import sys

# ── Paste your tab-separated "Name\tAlg" block here ──────────────────────────
CASES = """stealth	(S' R U' R') (S R U R')
H	(R U R' U') (M' U R U' r')
C	(f R f' U') (r' U' R U M')
Tab	R' U' (R' F R F') U R
Bars	U' (R U2' R2' F R F') U2' (R' F R F')
Pick	(F R' F' R) (U S' R U' R' S)
Og	U2 (R U' R2' D') (r U r' D) R2 U R'
pin	U' M R U R' U r U2' r' U M'
wheel	U (R' F R F') U' S R' U' R U R S'
Eyes	(S' R U R' S U') (R' F R F')
Double	U F(S' R U' R' S) (R U2' R' U') F'
truck	(r U R' U) (R U' R' U) R U2' r'
beam	(l' U' L U') (L' U L U') L' U2 l
com	r2' D' (r U r' D) (r2 U' r' U' r)
Y	U r' D' (r U' r' D) (r2 U' r' U) r U r'
Rock	U S'(F R U R' U' F') U S
Mask	S U' (R' F' U' F U R) S'
Hate	U (R U R' U) (R U' R' U) R U2' R'
arm	x' R' D' (F' D F D') (R U' R' D) R U x
iron	F (U R U' R')2 F'
turtle	(R' F' U' F U') (R U R' U R)
beam	U' (R' F U R U') (R2' F' R2 U) R' U' R
gun	F U (R U' R2' F' R) (U R U' R')
luc	R' F R U R' F' R F U' F'
tri	(R U2' R2' F R F') R U2' R'
rack	(F R' F' R) (U R U' R')
L	U' x' (R U' R' D) (R U R' D') x
snipe	U2 (r' U' M' U' R) (U r' U r)
kight	r U r' (R U R' U') r U' r'
stair	M(R U R' U R U2' R') U M'
lay	U2 M' (R' U' R U' R' U2 R U' r' R)
fat	r U R' U R U2' r'
tree	l' U' L U' L' U2 l
block	U2 r' U2' R U R' U r
sup	r U2 R' U' R U' r'
P	F (U R U' R') F'
Q	U' R' U' F' U F R
Pi	R' U2' R2 U R2' U R2 U2' R'
sun	S (R U R' U') (R' F R f')
green	R' U' (F U R U' R' F') R
spam	U2 r U' r2' U r2 U r2' U' r
slam	U2 r' U r2 U' r2' U' r2 U r'
sune	R U R' U R U2' R'
ant	U L' U' L U' L' U2 L
shark	U' x' (R U R' D) (R U' R' D') x
T	F (R U R' U') F'
smooth	(R U R' U') (R' F R F')
sign	x' (R U' R' D) (R U2 R' D') R U' R' x
dub	U2 F (R U R' U')2 F'
teo	U' z F' (U' R' U R)2 F z'
M	(R U R' U) (R U' R' U') (R' F R F')
W	(L' U' L U') (L' U L U) (L F' L' F)
X	S (R' U' R U) (R U R U' R') S'
whack	U F U F' (R' F R U') R' F' R
stick	(R U R' U') (R' F R2 U R' U' F')
fart	f (R' F' R U) (R U' R' S')
hawk	U2 L F' (L' U' L U) F U' L'
""".strip()
# ─────────────────────────────────────────────────────────────────────────────

DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "ll-images.json")
)
API_BASE = "https://api.cuberoot.me/v1/visualcube.svg"
DELAY_SEC = 0.35

# Params for the simplified /v1/ endpoint
FIXED_PARAMS = {
    "view": "oll",
    "size": "256",
}


def parse_cases(text: str) -> list[dict]:
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
    params = dict(FIXED_PARAMS)
    params["case"] = alg  # urllib will encode spaces as %20 / +
    return f"{API_BASE}?{urllib.parse.urlencode(params)}"


def fetch_image(alg: str) -> tuple[bytes, str]:
    """Returns (raw_bytes, mime_type)."""
    url = build_url(alg)
    req = urllib.request.Request(url, headers={"User-Agent": "oll_database_add.py/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status != 200:
            raise IOError(f"HTTP {resp.status}")
        content_type = (
            resp.headers.get("Content-Type", "image/png").split(";")[0].strip()
        )
        return resp.read(), content_type


def load_db() -> dict:
    if os.path.exists(DB_PATH):
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"oll": {}, "pll": {}, "tbld": {}, "oll_named": {}}


def save_db(db: dict) -> None:
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, separators=(",", ":"))


def main() -> None:
    if CASES == "PASTE_CASES_HERE":
        sys.exit("❌  You forgot to paste your cases into the CASES variable!")

    cases = parse_cases(CASES)
    if not cases:
        sys.exit("❌  No valid cases found after parsing. Check your CASES string.")

    print(f"📋  Parsed {len(cases)} OLL cases.")
    print(f"🌐  API base: {API_BASE}")
    print(f"🔧  Fixed params: {FIXED_PARAMS}\n")

    db = load_db()
    if "oll_named" not in db:
        db["oll_named"] = {}

    added = 0
    skipped = 0
    errors = 0

    for i, case in enumerate(cases):
        key = str(i)

        if key in db["oll_named"] and db["oll_named"][key].get("img"):
            print(f"  [{i:>3}] {case['name']:16s} — already in DB, skipping.")
            skipped += 1
            continue

        print(f"  [{i:>3}] {case['name']:16s}  ({case['alg']}) … ", end="", flush=True)
        try:
            img_bytes, mime = fetch_image(case["alg"])
            b64 = base64.b64encode(img_bytes).decode("ascii")
            db["oll_named"][key] = {
                "name": case["name"],
                "alg": case["alg"],
                "img": f"data:{mime};base64,{b64}",
            }
            print(f"✅  ({mime}, {len(img_bytes):,} bytes)")
            added += 1
        except Exception as exc:
            print(f"❌  {exc}")
            errors += 1

        save_db(db)
        time.sleep(DELAY_SEC)

    print(f"\n✅  Done.  added={added}  skipped={skipped}  errors={errors}")
    print(f"   Total oll_named entries in DB: {len(db['oll_named'])}")


if __name__ == "__main__":
    main()
