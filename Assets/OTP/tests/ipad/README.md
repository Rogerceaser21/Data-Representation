# iPad Simulator rig for the OTP form: iPadOS 26.3

Proved on this Mac 2026-09-11 against the iPad Air 13-inch (M3) simulator,
**UDID `38AB16E5-8346-4C96-B0A5-CE876D3AE4F4`**, iPadOS 26.3.1, Safari 26.3,
1024x1366 device points, 2x (2048x2732 screenshots). Xcode 26.3 at
`/Applications/Xcode-26.3.app`. Re-proves and extends the iOS 18.3 rig probed
2026-09-03 (`handoff/research/2026-09-03-otp-ipad-how-to-test.md`) for the
current OTP form (`Assets/OTP/src/otp-progress-form.html`, live at
`Assets/OTP/otp-progress-form.html`, otp-v0.9).

**Another iPad is routinely also booted on this Mac** (`F52A342C-...`, iOS
18.3) and must never be used by these scripts - every command below passes
the UDID explicitly.

---

## Files

- `rig.sh` - `status | boot | open <url> | shot <file> | shutdown`. UDID
  pinned as a shell variable at the top.
- `read.mjs` - safaridriver DOM-truth reader. Subcommands `dom "<expr>"`,
  `gate`, `draft`, `clear-draft`, `url <url>`. Each subcommand is a
  self-contained process (own session, own gate pass, deletes its session on
  exit) - see "Why each read.mjs call re-gates itself" below.
- `evidence.mjs` - `node evidence.mjs <Tn> <id> "<measured>" "<expected>"
  <PASS|FAIL> [file]` appends one row to
  `<evidence-root>/<Tn>/index.md` (creates the file on first use).
  Evidence root is a constant in the script:
  `Data-Representation/handoff/research/2026-09-11-otp-ipad-test`.

## Commands that worked (copy-pasteable)

```bash
UDID=38AB16E5-8346-4C96-B0A5-CE876D3AE4F4

# boot (software keyboard ON must be set BEFORE boot)
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
xcrun simctl boot $UDID
open -a "/Applications/Xcode-26.3.app/Contents/Developer/Applications/Simulator.app"
xcrun simctl openurl $UDID "https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-progress-form.html"
xcrun simctl io $UDID screenshot out.png

bash rig.sh status                 # -> "Booted for 38AB16E5"
bash rig.sh open "<url>"
bash rig.sh shot out.png

node read.mjs gate                 # WebDriver-only gate pass, prints true/false
node read.mjs dom "document.querySelector('#otp-form')!==null"   # -> true
node read.mjs dom "document.querySelectorAll('.rub-chip').length"  # -> 32
node evidence.mjs T1 my-check "measured" "expected" PASS "shots/x.png"
```

## The tap route: MCP tool unavailable here, idb is the working fallback

`mcp__Claude_Code_iOS_Simulator__control` (`attach`, `screenshot`, `tap`,
`text`, ...) is the documented primary driver from the 2026-09-03 probe, but
in THIS session (a non-interactive Focus-OS builder) both `attach` and
`screenshot` returned:

> Could not attach simulator panel: The user did not respond to the access
> request ... / The user has not granted Claude access ...

It needs a live human to click "Let Claude use it" in the simulator panel,
which cannot happen in a background builder session. **Fallback proved and
used for every real tap/type in this run: `idb`.**

```bash
brew install idb-companion
pip3 install --user fb-idb          # already present on this Mac
export PATH="/Users/igor/Library/Python/3.9/bin:$PATH"   # idb CLI lives here

idb_companion --udid $UDID &        # start the companion for this device
idb connect $UDID 10882             # attach the idb CLI to it (or read the
                                     # companion's own printed grpc port)
idb list-targets                    # confirm "localhost:<port>" not
                                     # "No Companion Connected"

idb ui tap --udid $UDID <x> <y>          # device points, origin top-left
idb ui text --udid $UDID "some text"     # real typed characters
idb ui swipe --udid $UDID x1 y1 x2 y2 --duration 0.3
idb ui describe-all --udid $UDID         # accessibility tree - Safari CHROME
                                          # only, no web-content elements once
                                          # a page is loaded (empirically 1-9
                                          # elements back, no DOM); use
                                          # screenshot pixel coordinates for
                                          # web-content taps instead, same as
                                          # the MCP driver in the 2026-09-03
                                          # doc.
```

`idb ui tap` + `idb ui text` is the proved route: a real tap on the
StatiCrypt password field shows a text cursor and raises the full on-screen
keyboard, typed text appears as real password dots (not the WebDriver value
setter), and a real tap on OPEN FORM passes the gate and renders the form
with all 32 rubric chips visible. Documented in
`../../../../handoff/research/2026-09-11-otp-ipad-test/T1/index.md`, rows
`gate-tap-route` and `idb-fallback-route`.

**Coordinates**: `idb ui describe-all` does not expose web content (Safari's
WKWebView accessibility tree is chrome-only in this rig), so every tap
target for page content is a device-point coordinate read off a screenshot
(same approach the 2026-09-03 MCP-driven probe used). `simctl io screenshot`
returns 2x pixels; divide by 2 for `idb ui tap` device points.

## WebDriver (safaridriver): DOM truth, but confirmed NOT a write instrument

Everything the 2026-09-03 doc found on iOS 18.3 reproduces on iPadOS 26.3:

- `platformName: "ios"` is load-bearing in the session capabilities -
  without it the driver defaults to macOS and 500s.
- `element/click` and W3C Actions with `pointerType:"touch"` (also tried
  `"mouse"`) on a real `<input>` field DO focus it (cursor/touch-indicator
  visible in a screenshot) but do **not** raise the real software keyboard -
  `visualViewport.height` stayed equal to `innerHeight` in both cases, and
  no keyboard or accessory bar appeared on screen. Newly re-verified this
  session (`webdriver-cannot-raise-keyboard` row) with the W3C Actions API
  specifically, which the 2026-09-03 doc had only tried with `pointerType`
  `"pen"`/`"mouse"`, not `"touch"`.
- sendKeys / Actions keyDown-keyUp do not type (not re-tested this session,
  inherited from the 18.3 doc - no reason to expect it changed).
- **A live WebDriver session and idb/simulator taps are mutually exclusive**:
  creating a session puts Safari into automation mode (visible orange
  address bar); a real tap during that state can trigger the "Running an
  Automated Test" modal instead of reaching the page. Always
  `DELETE /session/<id>` before switching to idb taps, and vice versa avoid
  driving idb while a WebDriver session is open.

**A fresh WebDriver session does not attach to whatever tab idb/`simctl
openurl` last showed.** Proved directly this session: session A navigated,
passed the gate, confirmed `#otp-form` present, then was deleted; a brand
new session B (no navigation) came up with `url` = `""` (blank) and
`#otp-form` = `false`. Deleting a session discards its automation tab.

### Why each `read.mjs` call re-gates itself

Because of the above, `read.mjs dom "<expr>"` (and `draft` / `clear-draft`)
each start their own session, navigate to the live OTP form URL, and pass
the gate via the JS property-setter route **before** evaluating the
requested expression - every invocation is a standalone, complete pass, not
a continuation of a previous `read.mjs gate` call's browser state. This is
what makes `node read.mjs gate` followed by a separate `node read.mjs dom
"..."` process both succeed: each command gates itself independently, not
because the second command reuses the first's tab.

`read.mjs gate`'s own JS-setter route is **not** the tap-and-type route -
it exists so DOM-assertion subcommands can reach the gated form headlessly.
The proof that a real human-equivalent tap+type gate pass works is the idb
route above (screenshots in the T1 evidence, not a `read.mjs` call).

## Chip selector: `.rub-chip` is exact, `[class*=rub-chip]` over-matches

`document.querySelectorAll('[class*=rub-chip]').length` returns **64**, not
32, because it also matches the `.rub-chip-text` child span inside every
chip (`32 chips + 32 text spans = 64`). The correct selector for "one row
per rubric criterion" is the **exact class** `.rub-chip`
(`document.querySelectorAll('.rub-chip').length` -> 32, matches the expected
count of single-sentence chips). Use `.rub-chip`, not a substring match, in
any future check.

## `#time_in` / `#time_out` are native `<input type="time">`, not text fields

Tapping `#time_in` with a real idb touch focuses it (visible green
underline) but raises **no** QWERTY keyboard and no accessory bar - iOS
renders its native time-wheel control for `type="time"` inputs, which this
rig cannot screenshot-distinguish from "nothing happened" without a longer
wait or a different interaction (the wheel may need a second tap or a small
delay to appear, not confirmed either way this session). **For the
software-keyboard signal check, use a `textarea` instead** (e.g.
`#observer_comments`, in the main scroll flow after the rubric grid, no pad
popup needed) - a real idb tap there reliably raises the keyboard input
session, confirmed by the 69pt keyboard accessory bar (keyboard-toggle icon,
up/down field navigation, mic) appearing pinned to the bottom edge.

## Keyboard appearance is non-deterministic - always screenshot-confirm

Matches the 2026-09-03 finding, reproduced here: the same tap on the same
field can raise the full QWERTY keyboard (seen on the password field, first
gate pass) or only the slim ~69pt accessory/shortcut bar (seen on later
password-field passes and on the `#observer_comments` textarea). Both are
valid "keyboard is up" states - **never assert a specific keyboard height,
only that some keyboard/accessory element is visible**, and always take a
screenshot to confirm rather than trusting that a tap "must have" raised it.
If a check needs the keyboard state and the first screenshot looks wrong,
retry the tap once before failing.

## Save Password system dialog (new gotcha this session)

After a REAL tap+type submit of the password field (not the WebDriver
setter), iOS Safari can queue its native "Save Password?" sheet and show it
the next time the app is foregrounded (e.g. after `simctl openurl` brings
Safari back from another app). It has a text cursor already focused in a
"User Name" field and two buttons, **Not Now** / **Save**. Tap **Not Now**
(do not save AIS credentials into the simulator's keychain) before
continuing - it blocks all further taps on the page underneath until
dismissed. Screenshot `shots/08-save-password-dialog-gotcha.png`. It only
appeared once in this session (after the very first real submit); it did
not reappear on later gate passes.

## What this rig still cannot reproduce (carried over from 2026-09-03, unchanged)

Apple Pencil / `pointerType:"pen"` ink, iPad Chrome, Scribble, a real
hardware keyboard, real device performance, Face ID/passcode, camera
capture, school Wi-Fi conditions, Stage Manager/Split View, and real Safari
bfcache-under-memory-pressure. Not re-tested this session; no reason to
expect any of these changed on 26.3. See the 2026-09-03 doc for the full
list and the evidence behind each.

## Guard rail

Never tap **Save & Lock** (`#btn-submit`), **Save changes**
(`#btn-save-changes`), or **Close Lap** (`#btn-close-lap`). Never open the
admin cog. Never delete data. This session only reached the gate and the
freshly-loaded, empty form - no submission was made.
