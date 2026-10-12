#!/usr/bin/env python3
"""Register a media file in assets/credits.json so it is shown on the site's Credits list and captions.
Usage: add_credit.py <slot> <file> <title> <author> <license> <license_url> <source_url> <caption>
Use for Pexels / Pixabay / Mixkit / YouTube-CC downloads you place under assets/."""
import json, os, sys
slot, file, title, author, lic, lic_url, src, cap = sys.argv[1:9]
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "credits.json")
d = json.load(open(p)) if os.path.exists(p) else {}
d[slot] = dict(file=file, title=title, author=author, license=lic, license_url=lic_url, source=src, caption=cap)
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False); print("credited", slot)
