#!/usr/bin/env bash
# iPad Simulator rig control: status | boot | open <url> | shot <file> | shutdown
# Device: iPad Air 13-inch (M3), iPadOS 26.3. UDID pinned below on purpose -
# another iPad (F52A342C, iOS 18.3) is routinely also booted on this Mac and
# must never be used by these scripts.
set -euo pipefail

UDID="38AB16E5-8346-4C96-B0A5-CE876D3AE4F4"
XCODE_APP="/Applications/Xcode-26.3.app"
SIMULATOR_APP="$XCODE_APP/Contents/Developer/Applications/Simulator.app"

cmd="${1:-}"

is_booted() {
  xcrun simctl list devices booted 2>/dev/null | grep -q "$UDID"
}

case "$cmd" in
  status)
    if is_booted; then
      echo "Booted for ${UDID%%-*}"
    else
      echo "Not booted: $UDID"
      exit 1
    fi
    ;;

  boot)
    # Must be set BEFORE boot: raises the real on-screen keyboard instead of
    # expecting a hardware keyboard that doesn't exist on this Mac.
    defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
    xcrun simctl boot "$UDID" 2>/dev/null || true
    open -a "$SIMULATOR_APP"
    for i in $(seq 1 30); do
      if is_booted; then
        echo "Booted for ${UDID%%-*}"
        exit 0
      fi
      sleep 2
    done
    echo "Timed out waiting for $UDID to boot" >&2
    exit 1
    ;;

  open)
    url="${2:?usage: rig.sh open <url>}"
    xcrun simctl openurl "$UDID" "$url"
    ;;

  shot)
    file="${2:?usage: rig.sh shot <file>}"
    xcrun simctl io "$UDID" screenshot "$file"
    ;;

  shutdown)
    xcrun simctl shutdown "$UDID"
    ;;

  *)
    echo "usage: rig.sh {status|boot|open <url>|shot <file>|shutdown}" >&2
    exit 1
    ;;
esac
