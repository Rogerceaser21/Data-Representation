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

# Teacher Tracker (otp-v0.12): the same gate, same password, same
# password-template.html, own master and own output. Coaches/leaders only,
# same access as the form; the ungated viewer above never gets this link or
# this key (PLAN-A.md section 3/8).
TRACKER_MASTER="src/otp-tracker.html"
TRACKER_OUTPUT="otp-tracker.html"
TRACKER_TMP_DIR=".staticrypt-out-tracker"

if [[ ! -f "$TRACKER_MASTER" ]]; then
  echo "Tracker master not found: $TRACKER_MASTER" >&2
  exit 1
fi

rm -rf "$TRACKER_TMP_DIR"

npx --yes staticrypt "$TRACKER_MASTER" -p "$PASSWORD" --short \
  --template "$TEMPLATE" \
  --template-title "AIS OTP Teacher Tracker" \
  --template-button "Open Tracker" \
  --template-placeholder "Access password" \
  --template-error "That password is not right. Try again." \
  --template-remember "Remember me on this device" \
  -d "$TRACKER_TMP_DIR"

mv "$TRACKER_TMP_DIR/otp-tracker.html" "$TRACKER_OUTPUT"
rmdir "$TRACKER_TMP_DIR"

echo "Encrypted to $TRACKER_OUTPUT"

# Teacher Reflection + Plan (otp-v0.14 T2): self-contained, ships UNGATED
# (no StatiCrypt, no Supabase key; it only calls the public otp-reflect
# edge function, and the token in the link is the only credential, the
# same shape as the ungated teacher viewer above). A plain copy is enough:
# the master carries no build-time secret to strip.
REFLECT_MASTER="src/otp-reflect.html"
REFLECT_OUTPUT="otp-reflect.html"

if [[ ! -f "$REFLECT_MASTER" ]]; then
  echo "Reflect master not found: $REFLECT_MASTER" >&2
  exit 1
fi

cp "$REFLECT_MASTER" "$REFLECT_OUTPUT"
echo "Copied to $REFLECT_OUTPUT"
