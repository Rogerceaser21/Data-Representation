#!/usr/bin/env bash
#
# Encrypts the master R3 evidence form (src/r3-evidence-form.html) with
# StatiCrypt + the custom AIS gate template (password-template.html) and
# writes the gated output to r3-evidence-form.html alongside this script.
#
# Run from any cwd:
#     ./Assets/R3/encrypt.sh
# or from this folder:
#     ./encrypt.sh
#
# Password is intentionally hardcoded here (school-wide, low entropy by design,
# rotated by editing this script + re-encrypting). DO NOT commit to a public
# repo without flipping this to read from an env var.

set -euo pipefail

# Resolve this script's directory regardless of where it's invoked from.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

PASSWORD="ais2026ais"
MASTER="src/r3-evidence-form.html"
OUTPUT="r3-evidence-form.html"
TEMPLATE="password-template.html"
TMP_DIR=".staticrypt-out"

if [[ ! -f "$MASTER" ]]; then
  echo "Master not found: $MASTER" >&2
  exit 1
fi
if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE" >&2
  exit 1
fi

rm -rf "$TMP_DIR"

npx --yes staticrypt "$MASTER" -p "$PASSWORD" --short \
  --template "$TEMPLATE" \
  --template-title "AIS R3 Evidence" \
  --template-button "Open Form" \
  --template-placeholder "Access password" \
  --template-error "That password is not right. Try again." \
  --template-remember "Remember me on this device" \
  -d "$TMP_DIR"

mv "$TMP_DIR/r3-evidence-form.html" "$OUTPUT"
rmdir "$TMP_DIR"

echo "Encrypted to $OUTPUT"
