#!/usr/bin/env bash
#
# Builds the deployed, StatiCrypt-gated dashboard.
#
#   1. Inlines data.js INTO the master HTML (src/index.html) so the sensitive
#      governance snapshot is encrypted along with the page. If data.js were
#      left as a separate <script src>, it would sit publicly readable at
#      /dashboard/data.js and defeat the gate. This is the whole point.
#   2. Runs StatiCrypt over the combined single file with the AIS gate template.
#   3. Writes the encrypted result to index.html (what GitHub Pages serves).
#
# Run from any cwd:
#     ./dashboard/encrypt.sh
#
# To refresh the data first: re-run the snapshot export, then this script:
#     node ~/AIS-Data-Dashboard/db/export_snapshot.mjs "<repo>/dashboard/data.js"
#     ./dashboard/encrypt.sh
#
# Password is intentionally hardcoded (school-wide, low entropy by design,
# same gate as the R3 form; rotate by editing here + re-encrypting).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

PASSWORD="ais2026ais"
MASTER="src/index.html"
DATA="data.js"
OUTPUT="index.html"
TEMPLATE="password-template.html"
BUILD_DIR=".build"
TMP_OUT=".staticrypt-out"

for f in "$MASTER" "$DATA" "$TEMPLATE"; do
  if [[ ! -f "$f" ]]; then echo "Missing: $f" >&2; exit 1; fi
done

rm -rf "$BUILD_DIR" "$TMP_OUT"
mkdir -p "$BUILD_DIR"

# 1. Inline data.js where the master references it (replace the <script src> line).
awk -v d="$HERE/$DATA" '
  /src="data\.js"/ {
    print "<script>"
    while ((getline line < d) > 0) print line
    close(d)
    print "</script>"
    next
  }
  { print }
' "$MASTER" > "$BUILD_DIR/index.html"

# sanity: the combined file must NOT still reference the external data.js
if grep -q 'src="data\.js"' "$BUILD_DIR/index.html"; then
  echo "Inline failed: combined file still references data.js" >&2; exit 1
fi

# 2. Encrypt the single combined file with the AIS gate.
npx --yes staticrypt "$BUILD_DIR/index.html" -p "$PASSWORD" --short \
  --template "$TEMPLATE" \
  --template-title "AIS Observation Dashboard" \
  --template-button "Open Dashboard" \
  --template-placeholder "Access password" \
  --template-error "That password is not right. Try again." \
  --template-remember "Remember me on this device" \
  -d "$TMP_OUT"

# 3. Move the gated output into place.
mv "$TMP_OUT/index.html" "$OUTPUT"
rm -rf "$BUILD_DIR" "$TMP_OUT"

echo "Encrypted dashboard written to dashboard/$OUTPUT"
echo "Assets (AIS logos) stay public at dashboard/assets/ by design."
