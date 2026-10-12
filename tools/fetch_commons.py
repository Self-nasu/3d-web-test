#!/usr/bin/env python3
"""Fetch openly licensed images from Wikimedia Commons into assets/img and
record author/licence/source for every file in assets/credits.json.
Only CC0, Public Domain, CC BY and CC BY-SA files are accepted.
Usage: python3 tools/fetch_commons.py [slot ...]   (default: all slots)"""
import json, os, re, sys, time, urllib.parse, urllib.request
UA = "UdaipurVirtuallyYours/0.1 (hackathon demo; nj@rudraas.com)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
CRED = os.path.join(ROOT, "assets", "credits.json")
OK = re.compile(r"^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)", re.I)
# slot -> (search query, used-for caption)
SLOTS = {
 "hero-pichola":   ("Lake Pichola Udaipur City Palace sunset", "Landing hero / parallax background"),
 "citypalace":     ("City Palace Udaipur facade", "City Palace heritage card"),
 "jagmandir":      ("Jag Mandir Udaipur island palace", "Jag Mandir heritage card"),
 "fatehsagar":     ("Fateh Sagar Lake Udaipur", "Fateh Sagar flyover caption"),
 "aravalli":       ("Aravalli hills Udaipur landscape", "Flyover start - Aravalli hills"),
 "oldcity":        ("Udaipur old city street Jagdish Temple lane", "Walk the old city card"),
 "bagore":         ("Bagore ki Haveli Udaipur", "Heritage card / street scene"),
 "miniature":      ("Mewar miniature painting Udaipur artist", "Artisan - miniature painting"),
 "marble":         ("Rajasthan marble inlay carving craft", "Artisan - marble craft"),
 "textile":        ("Rajasthan block print textile Bagru", "Artisan - textiles"),
 "thali":          ("Dal baati churma Rajasthani thali", "Local food discovery"),
 "pichwai":        ("Pichwai painting Nathdwara", "Product - pichwai"),
}
def api(**p):
    p.update(action="query", format="json")
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)
    for a in range(8):
        time.sleep(6 + a * 10)
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40))
        except Exception as e:
            print("  retry", a, e, file=sys.stderr)
    raise SystemExit("giving up (rate limited)")
def pick(q):
    d = api(list="search", srsearch=q + " filetype:bitmap", srnamespace=6, srlimit=15)
    titles = [s["title"] for s in d["query"]["search"]]
    if not titles: return None
    d = api(titles="|".join(titles), prop="imageinfo", iiprop="url|extmetadata|size|mime", iiurlwidth=1600)
    best = None
    for p in d["query"]["pages"].values():
        ii = p["imageinfo"][0]; m = ii["extmetadata"]
        lic = m.get("LicenseShortName", {}).get("value", "")
        if ii["mime"] != "image/jpeg" or ii["width"] < 1600 or not OK.match(lic): continue
        if best is None or ii["width"] * ii["height"] > best[0]["width"] * best[0]["height"]:
            best = (ii, m, lic, p["title"])
    return best
def main():
    cred = json.load(open(CRED)) if os.path.exists(CRED) else {}
    for slot in (sys.argv[1:] or SLOTS):
        out = os.path.join(IMG, slot + ".jpg")
        if os.path.exists(out) and slot in cred: continue
        q, use = SLOTS[slot]; print("==", slot, "<-", q)
        r = pick(q)
        if not r: print("  no suitable file"); continue
        ii, m, lic, title = r
        time.sleep(5)
        data = urllib.request.urlopen(urllib.request.Request(ii["thumburl"], headers={"User-Agent": UA}), timeout=90).read()
        open(out, "wb").write(data)
        strip = lambda k: re.sub(r"\s+", " ", re.sub("<[^>]+>", "", m.get(k, {}).get("value", ""))).strip()
        cred[slot] = {"file": "assets/img/%s.jpg" % slot, "title": title, "author": strip("Artist") or "Unknown",
                      "license": lic, "license_url": m.get("LicenseUrl", {}).get("value", ""),
                      "source": ii["descriptionurl"], "caption": use, "bytes": len(data)}
        json.dump(cred, open(CRED, "w"), indent=2, ensure_ascii=False)
        print("  ->", title, "|", lic, "|", cred[slot]["author"][:40])
main()
