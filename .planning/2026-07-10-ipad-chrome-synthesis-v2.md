# Synthesis v2 · v0.57 on-device failures F1/F2/F3 · verdicts + v0.58 diagnostic-switch plan · 2026-07-10

Inputs: P2 Tasks 8-10 in `.planning/2026-07-09-ipad-chrome-research-findings.md` (Sonnet 5 researchers, Opus 4.8 adversarial refuters + auditors, converged) + phase-1 docs. Igor's device screenshots (P2 task 7) NOT yet delivered: verdicts marked pending-device stay hypotheses per the CLAUDE.md lessons (web research is hypothesis; the device confirms). NO code changed in this phase.

## Verdicts per failure

### F2 · Save & Lock disappears; tapping the page brings it back

- **Verdict: CONFIRMED BY AUDIT (highest confidence of the three; device corroboration = behavioral match, exact).** This is MY v0.57 design bug, not a browser bug. `body.kb-open` makes the three bottom controls `opacity:0 + pointer-events:none` from the moment ANY keyboard-type field gets focus (CSS 1401-1403, add 2539-2541); removal happens ONLY via focusout + 350ms (2542-2552). Three stuck/hidden paths: (i) keyboard dismissed via the dismiss key/strip without blur (focusout never fires; literature split, decisive one-gesture test defined in Task 8); (ii) hardware keyboard: controls hidden for the ENTIRE typing session; (iii) **Apple Pencil Scribble writing into a textarea: focus with NO keyboard at all, controls vanish during normal pen use.** The revive is the working native-blur path: the first tap passes THROUGH the invisible button (pointer-events:none), lands behind it, blurs the field; 350ms later the button returns; the second tap works. Two taps minimum, by design. Matches Igor's words verbatim.
- Falsifier: controls vanishing with NO field ever focused (would point at the pin instead).

### F3 · Void past the footer persists; bottom buttons vanish/return after taps

- **Verdict: HIGH CONFIDENCE, two-layer.** Root (pre-existing, phase-1): WKWebView adds keyboard height to the scrollable extent additively with buggy late cleanup. v0.57's mitigation FAILED because: the only cleanup (nudge + clamp) lives inside focusout (never fires on no-blur dismissal, same trigger family as F2); when it does run, the clamp measures against the still-INFLATED `scrollHeight` and uses `window.innerHeight`, the exact value the file's own pin avoids as bogus (2549 vs 2493-2507), so it no-ops; the 1px nudge is a no-op at scroll boundaries, generating no scroll event, so the frozen `--vv-shift` (pin bails while kb-open, 2506, and nothing re-drives it after) never recomputes. "Buttons reappear after a few taps" = the taps ARE the missing events the fix logic depends on but never generates. The type->pad->close flow explicitly skips the clamp (pad-open guard 2547).
- Falsifier: void reproducible with the keyboard NEVER opened in the session (would remove the inset mechanism and point at pure toolbar/vh geometry).

### F1 · Pad Done covered by Chrome's top bar (landscape), page stuck, rotation repairs

- **Verdict: mechanism split PENDING DEVICE; the structure is certain, the trigger needs one bit.** Certain: the pad's TOP row has ZERO viewport compensation (no safe-area-inset-top anywhere in the file, no `--vv-shift` on pad chrome, no svh sizing on `.pad-modal`, no orientationchange handler; the entire v0.56/v0.57 pinning effort went to the BOTTOM controls only), `containScroll` blocks every pan escape (2834-2841), the form is display:none = truly stuck, and only rotation forces WKWebView's full re-layout (WebKit 170595 signature). Also certain: "the swap caused F1" is REFUTED: the toolbar covered pad buttons already in v0.56 on a scrollable page (N1); the swap removed the scroll-collapse ESCAPE (regression in recoverability, not new coverage). Pending device (the one-bit test): does Done get covered on a COLD pad open (pure toolbar overlay, M1) or only after typing (stale rect from the not-actually-dismissed keyboard, M2; script blur() cannot force the OS keyboard closed)?
- Two extra code paths found (audit): async `openPad` has NO try/catch (an error after body.pad-open is set = blank stuck page, nothing removes the class; `openPadView` has the error exit, `openPad` does not); the pen-pill launch (`openPadAt`) SKIPS `blurAndSettle` because the button steals focus first, so `padScrollY` is read mid-inset-flux (scroll restore corruption).
- Falsifier for M1-only: diagnostics showing `vv.offsetTop` stuck > 0 or a short pad rect in the covered state (= M2 present).

### Converged root sentence

v0.57 equates "keyboard gone" with "focusout fired" and "overlay covers the screen" with "layout viewport is correct"; neither holds on iPad, and the pad's top edge never received the compensation the bottom controls got.

## v0.58 plan · corrections + ONE-SUSPECT-OFF diagnostic switches (bisect lesson, round three)

Every corrected mechanism ships behind its own kill-switch URL param (`?d=` comma-list, e.g. `?d=nokb,nopin`), so one test pass on Igor's iPad convicts or clears each mechanism individually. Switches are read once at load, zero UI, invisible to stakeholders (rule 12).

1. **KB-STATE ENGINE REWRITE** (kills F2's three paths at once; switch `?d=nokb` disables all hiding). Replace the focus-event state machine with visualViewport-DELTA detection: keyboard considered open only when `vv.height` drops > ~150px from the session baseline (iPad keyboard = 264pt portrait / 352pt landscape; accessory strip ~55px and toolbar ~100px stay BELOW threshold, per Discourse's production values); focus events remain only as fast-path hints. kb-open removal driven by the vv-resize keyboard-close signal (fires regardless of blur) + settle. Direct consequences: Scribble and hardware-keyboard typing NEVER hide the controls (no large vv shrink), and the dismiss key always restores them.
2. **VOID CLEANUP REWRITE** (F3; switch `?d=nonudge`). Drive the cleanup from the same vv-delta close signal (not focusout); clamp against `documentElement.clientHeight` (not innerHeight); re-check once more at +1s (documented late inset cleanup); after cleanup explicitly re-run the pin's `apply()` (no more waiting for accidental scroll events). Pin re-drive also on kb-open removal (`?d=nopin` disables the pin entirely, controls fall back to plain fixed).
3. **PAD HARDENING** (F1; switch `?d=noswap` reverts the in-document swap to the plain v0.56-style overlay for A/B). Keep the swap (it did kill the scroll-under + indicator class) and add: (a) **Done/close duplicated in the pad's BOTTOM bar** (the bottom edge carries the working pin machinery; Done is then always reachable regardless of what covers the top); (b) `openPad` wrapped in try/catch: any error removes `body.pad-open` and restores the form (no more blank stuck page; silent, rule 12); (c) `openPadAt` fixed to settle when a text field was focused just before the button stole focus (track last-focused field or settle whenever the vv-delta says the keyboard is/was up); (d) an opening-flag guard so Done during the settle window cancels the pending open (race); (e) OPTIONAL experiment behind `?d=scrollhair`: keep ~2px scrollable extent while the pad is open, testing whether a collapsible toolbar (scroll escape) beats zero-extent (toolbar frozen) on the device.
4. **Diagnostics v2** (already-shipped cog readout gains: pad-modal getBoundingClientRect top/height, active `?d=` switches, kb-engine state + baseline). Feeds the F1 one-bit test and the F2 dismiss test.

### Locked-constraint cross-check

No Fullscreen API; no body repositioning (display/class toggles only); exact scroll restore kept and STRENGTHENED (openPadAt settle fix removes a corruption path); rule 12 (all silent, kill-switches invisible, try/catch degrades silently); StatiCrypt single-file build unchanged; Konva/Pencil ink untouched; `--vv-shift` 3-place transform contract kept.

### On-device test matrix (v0.58, Chrome + Safari, PORTRAIT AND LANDSCAPE each)

| # | State | Check |
|---|---|---|
| 1 | default, cold pad open (no typing first) | Done reachable top AND bottom; note if top covered (M1 evidence) |
| 2 | default, type in Weakness then open pad via pen pill | same checks (difference vs #1 = M2 evidence); Done returns to exact spot |
| 3 | default, type then dismiss keyboard via dismiss key, NO page tap | Save & Lock returns by itself within ~1s (vv-close signal) |
| 4 | default, write into a textarea with the PENCIL (Scribble) | Save & Lock never disappears |
| 5 | default, keyboard cycles then scroll to bottom | page stops at footer, no void |
| 6 | `?d=nokb` | controls never hide; does anything else break |
| 7 | `?d=noswap` | pad as overlay: does the old scroll-under/indicator return (A/B evidence) |
| 8 | `?d=scrollhair` | with the pad open, can a small scroll collapse Chrome's toolbar off the pad top |
| 9 | any failing state | cog diagnostics screenshot (numbers decide M1 vs M2 and tune thresholds) |

Execution: gated tasks in Focus OS "R3 Apple Pencil Exec Plan" behind a new [BLOCKED] approval gate; no code before Igor's go.
