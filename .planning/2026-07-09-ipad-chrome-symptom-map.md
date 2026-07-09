# iPad Chrome symptom -> mechanism map · R3 form v0.56 · 2026-07-09

Igor's 2026-07-09 retest of v0.56 on iPad Air 13, CHROME (Safari mostly OK). Three symptoms from his screenshots plus one handwritten note. Code refs = `Assets/R3/src/r3-evidence-form.html` at origin/main `8f02836` (v0.56). This doc is the anchor for research tasks 2-5 in Focus OS project "R3 Apple Pencil Research"; findings from those tasks are appended below as they land.

Serves AIS-Data-Dashboard task `09018a59`. Doc-only branch `research/ipad-chrome-0709`. No form code changes in this phase.

## Baseline facts about the current code

| Fact | Code ref (line, at 8f02836) |
|---|---|
| Meta viewport is plain `width=device-width, initial-scale=1.0`, no `interactive-widget`, no `viewport-fit` | 5 |
| `body { min-height: 100vh }`, no `dvh`/`svh`/`lvh` anywhere in the file | 105 |
| `.action-bar` (Reset / Save & Lock) `position:fixed; bottom; right; z-index:90` + `translateY(var(--vv-shift,0px))` | 491-501 |
| `.theme-toggle` and admin cog `position:fixed; bottom` + same `--vv-shift` transform (base 701/1635, hover 707/1641, `(hover:none)` 1306) | 683-707, 1306, 1620-1641 |
| `pinBottomControls()`: `gap = window.innerHeight - vv.height - vv.offsetTop`; `gap > 200px` treated as keyboard and zeroed; writes `--vv-shift`; listens on `vv.resize`, `vv.scroll`, `window.scroll` | 2448-2471 |
| `.pad-modal` = `position:fixed; inset:0; z-index:980; overscroll-behavior:none`, flex column, opaque `var(--page-bg)` background | 1370-1379 |
| Pad open: save `window.scrollY` -> `classList.add('open')` -> `window.scrollTo(0,0)`; close: `window.scrollTo(0, padScrollY)` then remove `open` | 3358-3391 |
| Pad-view lightbox mirrors the same save/jump/restore | 3843-3897 |
| `containScroll()`: non-passive `touchmove`/`wheel` preventDefault on `#pad-modal`/`#pad-view` except inside `.pad-view-scroll` | 2718-2726 |
| The form document behind the pad stays fully laid out while the pad is open (nothing gets `display:none`); its scroll extent remains | structural, see 1370-1379 vs 1940 |

## Symptom map

### S1 · Infinite scroll past the form end (huge cream void)

| Field | Content |
|---|---|
| Symptom | Form footer ("FORM · R3 EVIDENCE · V0.56") sits at the TOP of the screen; below it a full screen (or more) of empty page-bg; Reset / Save & Lock float mid-void. Scrolling continues far past the document end. |
| Suspected mechanism | Chrome iPadOS resizes the LAYOUT viewport when its top toolbar collapses/expands. `min-height:100vh` resolves against the LARGEST viewport, and WKWebView-in-Chrome is known to leave a stale, over-long scrollable extent after keyboard dismissal or a toolbar transition. The v0.56 programmatic `scrollTo(0,0)` + restore during pad open/close, and iOS auto-scroll to a focused textarea, both exercise exactly those transition windows. The keyboard accessory strip in the S2 shot says the keyboard was involved shortly before. |
| Code ref | body 105 (`100vh`); openPad/closePad 3358-3391 (programmatic scroll during overlay transitions); pinBottomControls 2448-2471 (fires on every scroll, reads `window.innerHeight`). |
| Evidence | Pic 1: footer at screen top, ~1100px of void below it, buttons floating at ~1/3 height. Void colour = `--page-bg`, i.e. the body itself, not overscroll rubber-band (rubber-band shows behind the body edge and snaps back; Igor reports it stays scrollable "forever"). |
| Open questions | (a) Exact trigger sequence: does the void appear only after keyboard use, only after pad close, or after plain toolbar collapse? (b) Is the extent stale layout (WKWebView bug) or genuinely inflated content height? (c) Does `100svh`/`100dvh` on body kill it? -> research task 4. |

### S2 · Bottom-fixed controls ride up mid-screen (v0.56 pin failed on Chrome)

| Field | Content |
|---|---|
| Symptom | Reset / Save & Lock (and cog/theme at left) render vertically mid-screen while the form is scrolled; iPadOS keyboard accessory/shortcut strip visible at screen bottom in the same shot (pic 2). |
| Suspected mechanism | Two candidate holes in `pinBottomControls()`: (1) the reference `window.innerHeight` is itself unstable in Chrome iPadOS mid-toolbar-transition, so `gap` computes wrong exactly when the pin is needed; (2) the `gap > 200px -> 0` keyboard guard: with the software keyboard (or during its dismiss animation) the guard zeroes the shift, leaving the controls at the LAYOUT viewport bottom, which iOS scrolls out from under fixed elements while the keyboard/accessory bar is up, so they visually land mid-screen. An accessory-only strip (~55-70px, hardware keyboard case) passes the guard but may still misreport `offsetTop`. |
| Code ref | 2448-2471 (heuristic + guard), 491-501 / 683-707 / 1620-1641 (the three pinned controls), 5 (no `interactive-widget=resizes-content` meta). |
| Evidence | Pic 2: buttons at ~y=1240 of a 1499px screen with the accessory strip visible below; identical failure to the pre-v0.56 report, so the pin is either not applying or applying the wrong value in this state. |
| Open questions | (a) In Chrome iPadOS with keyboard up, what do `innerHeight` / `vv.height` / `vv.offsetTop` actually report? (b) Is `translateY` on a fixed element even honoured during iOS keyboard scroll? (c) Better anchors: `interactive-widget` meta, sticky-in-flow footer, or pinning to `vv.offsetTop + vv.height` directly? -> research task 3. |

### S3 · Evidence Pad: scroll indicator + form visible underneath

| Field | Content |
|---|---|
| Symptom | With the pad open in Chrome, a scroll indicator animates on the pad's right edge; the form is visible below/behind the pad edge; the pad content shifts (pics 3-4). Scribbled repro in pic 3's note. |
| Suspected mechanism | The pad is an overlay ON TOP of a still-scrollable document. `containScroll` swallows `touchmove`/`wheel` targeted at the pad, but Chrome iPadOS can still scroll the DOCUMENT: gestures that start on browser chrome, Apple Pencil interactions Konva captures then cancels, momentum/anchoring scrolls, and any programmatic scroll (including our own `scrollTo`) move the page under the overlay. The scroll indicator belongs to the page, not the pad. Meanwhile `inset:0` tracks the LAYOUT viewport: when Chrome's top toolbar re-expands, the layout viewport shifts/shrinks and the fixed pad gets composited short, exposing the form beneath its bottom edge. `overscroll-behavior:none` on the pad does not stop document scrolling (and iOS WebKit support is partial anyway). |
| Code ref | 1370-1379 (`.pad-modal` fixed inset:0), 2718-2726 (containScroll, gesture-level only), 3358-3376 (scrollTo(0,0) leaves extent intact), structural: form stays laid out (1940 onward). |
| Evidence | Pic 4: pad canvas visible but form section ("Observation / Evidence Type") showing beneath the pad's bottom edge; pic 3 note reports the scroll animation on the right side of the pad. |
| Open questions | (a) Can ANY overlay-on-scrollable-document approach be made airtight on Chrome iPadOS, or is removing the scrollable document behind (page-swap / separate page) the only robust fix? (b) What does collapsing the document scroll extent (form `display:none` while pad open) break: Tom Select, draft autosave, focus, Konva sizing? -> research task 5. |

### N1 · Handwritten note: "Chrome top menu opens up and covers the evidence pad buttons and elements"

| Field | Content |
|---|---|
| Symptom | Chrome's top toolbar (tab strip + omnibox, ~230px) re-expands while the pad is open and paints OVER the pad's top toolbar row, hiding Done / tools (small screenshot embedded in Igor's note, pic 3). |
| Suspected mechanism | Same root as S3's compositing half. The pad's `inset:0` is sized to the layout viewport measured at open time (toolbar collapsed = taller). Any document scroll (see S3) or edge swipe makes Chrome re-expand its toolbar; the layout viewport's top shifts down but the fixed overlay does not repaint in sync, so browser UI covers the pad's top ~230px where the buttons live. Safari differs: its toolbar overlays/shrinks differently and (per v0.56 testing) its fixed-overlay handling did not visibly break. |
| Code ref | 1370-1379; pad toolbar rows `.pad-top`/`.pad-tools` 1381-1436 (the covered elements). |
| Evidence | Embedded mini-screenshot in pic 3: dark Chrome toolbar overlapping the pad's top edge; toolbar buttons unreachable. |
| Open questions | (a) Does Chrome iPadOS guarantee toolbar stays collapsed when the page cannot scroll at all (document extent == viewport)? If yes, killing S3's document scroll also kills N1. (b) Is there a supported way to request minimal-ui in Chrome iOS? -> research tasks 2 + 5. |

## Cross-cutting observations

1. All four rows share one root class: **the pad/controls are positioned against a layout viewport that Chrome iPadOS mutates mid-interaction (toolbar, keyboard), while the document behind stays scrollable.** Safari mutates its viewport differently, which is why the same code passes there.
2. The v0.56 fixes treated the SYMPTOMS at open/close boundaries (scroll save/jump/restore, translateY pin) but both depend on `window.innerHeight`/fixed-positioning being stable BETWEEN those boundaries. On Chrome iPadOS they are not.
3. Any v0.57 fix must hold the locked constraints: no Fullscreen API, no body repositioning (v0.54 bans), exact scroll-spot restore on pad close, no visible error UI ever (hard rule 12), single-file StatiCrypt build, Konva ink capture intact.

## Appended findings

(Research tasks 2-5 append their findings below this line.)
