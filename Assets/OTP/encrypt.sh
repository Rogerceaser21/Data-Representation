#!/usr/bin/env bash
#
# Encrypts the master OTP form (src/otp-progress-form.html) with StatiCrypt +
# the custom AIS gate template (password-template.html) and writes the gated
# output to otp-progress-form.html alongside this script.
#
# Run from any cwd:
#     ./Assets/OTP/encrypt.sh
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
MASTER="src/otp-progress-form.html"
OUTPUT="otp-progress-form.html"
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
  --template-title "AIS Progress in Lessons OTP" \
  --template-button "Open Form" \
  --template-placeholder "Access password" \
  --template-error "That password is not right. Try again." \
  --template-remember "Remember me on this device" \
  -d "$TMP_DIR"

mv "$TMP_DIR/otp-progress-form.html" "$OUTPUT"
rmdir "$TMP_DIR"

echo "Encrypted to $OUTPUT"

# Teacher viewer: the same master, served ungated as otp-record.html.
# window.R3_VIEWER makes the page record-link-only: without ?token (or the
# legacy ?id) it holds a calm landing card; it never restores drafts or shows a
# blank form. Access control for a record remains the per-record token enforced
# by doGet.
#
# The viewer is UNENCRYPTED and public, so the Supabase publishable key (which
# can call get_raw_snapshot = all teacher names + ratings) must NOT ship in it.
# Blank SB_KEY/SB_URL here; the admin cog is already hidden in the viewer and
# nothing else in the viewer calls Supabase, so this is inert.
VIEWER="otp-record.html"
sed -e 's|<head>|<head><script>window.R3_VIEWER = true;</script>|' \
    -e "s|const SB_KEY = '[^']*';|const SB_KEY = '';|" \
    -e "s|const SB_URL = '[^']*';|const SB_URL = '';|" \
    "$MASTER" > "$VIEWER"
echo "Viewer written to $VIEWER"
