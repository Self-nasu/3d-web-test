#!/usr/bin/env bash
# Download a *Creative Commons (CC BY)* YouTube video locally — never embed YouTube URLs.
# Usage: tools/fetch_youtube.sh <youtube-url> <slot> [start] [end]   e.g.  ... https://youtu.be/XXXX hero-video 00:00:05 00:00:25
# Run on your own machine (YouTube blocks datacentre IPs). Requires yt-dlp + ffmpeg.
set -euo pipefail
URL="$1"; SLOT="$2"; SS="${3:-}"; TO="${4:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; TMP="$(mktemp -d)"; OUT="$ROOT/assets/video/$SLOT.mp4"
META=$(yt-dlp --skip-download --print "%(license)s|%(uploader)s|%(title)s|%(webpage_url)s" "$URL")
IFS='|' read -r LIC UP TITLE PAGE <<<"$META"
case "$LIC" in *"Creative Commons"*) ;; *) echo "REFUSED: licence is '$LIC', not Creative Commons Attribution." >&2; exit 1;; esac
yt-dlp -f "bv*[height<=1080]+ba/b" --merge-output-format mp4 -o "$TMP/src.%(ext)s" "$URL"
ARGS=(); [ -n "$SS" ] && ARGS+=(-ss "$SS"); [ -n "$TO" ] && ARGS+=(-to "$TO")
# hero loop: muted, 1280px wide, small enough for the web
ffmpeg -y "${ARGS[@]}" -i "$TMP"/src.* -an -vf "scale=1280:-2" -c:v libx264 -crf 28 -preset slow -movflags +faststart "$OUT"
python3 "$ROOT/tools/add_credit.py" "$SLOT" "assets/video/$SLOT.mp4" "$TITLE" "$UP" "CC BY (YouTube Creative Commons)" "https://creativecommons.org/licenses/by/3.0/" "$PAGE" "Downloaded locally; not embedded"
rm -rf "$TMP"; echo "OK -> $OUT (credited)"
