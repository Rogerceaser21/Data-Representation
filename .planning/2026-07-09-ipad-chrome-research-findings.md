# iPad Chrome research findings · R3 form v0.56 · 2026-07-09

Companion to `.planning/2026-07-09-ipad-chrome-symptom-map.md` (symptoms S1/S2/S3/N1, code refs at origin/main 8f02836). Findings gathered by Sonnet 5 web-research agents; every claim carries its source. Sections appended per Focus OS research task.

---

## Task 2 · Chrome-on-iPadOS viewport model

### (a) How Chrome iOS manages its toolbar, and what it does to the viewport

- Chrome for iOS is NOT Blink. Apple forces every third-party iOS browser to embed the system WKWebView; Chrome's toolbar is Chrome's own native UIKit chrome wrapped AROUND that web view (https://microsoftedge.github.io/edgevr/posts/Hacking-Chrome-iOS/, https://github.com/bokand/URLBarSizing).
- Chromium engineer David Bokan, on why Chrome iOS cannot behave like Safari: "iOS Chrome uses a WebView control provided by the OS. When the URL bar changes state, Chrome needs to resize the WebView. On Android and in Safari, the browser can resize the page layout but treat elements like fixed and sticky specially by smoothly animating them with the URL bar. The iOS WebView doesn't provide that level of granular control to the embedding app." The only smooth alternative would be resizing the whole WKWebView ~60x/sec during the toolbar animation, a performance non-starter (https://github.com/bokand/URLBarSizing; quoted in https://generatepress.com/forums/topic/sticky-navigation-gap-on-scroll-chrome-ios/).
- So Chrome iOS toolbar transitions = COARSE, DEFERRED whole-web-view resizes, not Safari's per-frame inset animation. Resize events are coalesced/late (Chrome fires on touchend; Safari fires mid-animation) (https://github.com/bokand/URLBarSizing).
- Toolbar collapse is driven by live scroll-delta signals (collapses on scroll-down, re-expands on scroll-up/interaction), not by a binary "is the page scrollable" check; but a page with no scrollable overflow gives Chrome no scroll deltas, so the toolbar has no reason to move (https://stevefenton.co.uk/blog/2022/12/mobile-position-sticky-issue/).

### (b) What each measurement tracks during transitions (Chrome iPadOS vs Safari)

- Initial Containing Block (ICB, what `height:100%` resolves against): STATIC, sized to the SMALLEST viewport (toolbar shown). `vh` units: STATIC, sized to the LARGEST viewport (toolbar hidden). `position:fixed` boxes: special-cased to resize with the VISIBLE viewport, recalculated at touch-end in Chrome (https://github.com/bokand/URLBarSizing, https://developer.chrome.com/blog/url-bar-resizing).
- Consequence for the R3 form: `body { min-height:100vh }` reserves the LARGEST viewport height. When Chrome's toolbar is expanded (viewport = smallest), the body is up to toolbar-height TALLER than the visible area even with no content, guaranteeing scrollable overflow.
- `svh`/`lvh`/`dvh`: supported since Safari/WebKit 15.4 (Mar 2022), inherited identically by Chrome iOS (same WebKit); `dvh` updates are THROTTLED/stepped, not 60fps, and may be debounced per gesture (https://www.bram.us/2021/07/08/the-large-small-and-dynamic-viewports/, https://web.dev/blog/viewport-units).
- `window.innerHeight` in WKWebView embedders can report stale/bogus values after orientation/frame changes, a WebKit bug open since iOS 10.3 explicitly filed as "...but not MobileSafari" (WKWebView-only, so it hits Chrome but not Safari); workaround: prefer `document.documentElement.clientHeight` or settle-delays (https://bugs.webkit.org/show_bug.cgi?id=170595).
- Keyboard: on iOS BOTH browsers only shrink the VISUAL viewport; the layout viewport (which fixed elements anchor to) is untouched, so `position:fixed; bottom:0` elements sit under/over the keyboard unless corrected via visualViewport (https://developer.chrome.com/blog/viewport-resize-behavior, https://www.bram.us/2021/09/13/prevent-items-from-being-hidden-underneath-the-virtual-keyboard-by-means-of-the-virtualkeyboard-api/).

### (c) Fixed inset:0 overlay open while the toolbar re-expands

- CURRENT REGRESSION, directly matching Igor's symptoms: WebKit bug 297779 "[iOS 26] Fixed elements move up and down when the scroll direction changes": fixed elements shift ~10-24px when (1) the address bar minimizes during scroll, (2) a virtual keyboard opens then dismisses, (3) a text input is touched; `visualViewport.offsetTop` gets STUCK at ~24px after keyboard dismissal instead of returning to 0. Apple confirmed "a bug in a system component"; reports say it PERSISTS in Chrome on iOS and WKWebView even after iOS 26.1 (https://bugs.webkit.org/show_bug.cgi?id=297779).
- Companion Apple report FB19889436: after keyboard dismiss, `visualViewport.height` stays ~24px SMALLER than `window.innerHeight`; explicitly notes "full-screen overlays/drawers no longer cover full viewport height" (https://developer.apple.com/forums/thread/800125).
- Mechanism for hit-test drift: viewport resize/offset changes fired mid-gesture on iOS interrupt/cancel/restart in-flight touch events; combined with fixed boxes computed against a stale visual-viewport snapshot during throttled updates, taps land offset from where UI paints (https://github.com/nolimits4web/swiper/issues/5091, https://web.dev/blog/viewport-units).

### (d) Known issue-tracker bugs matching S1-S3

- S1 (scroll past end / stale extent): WebKit 240860 "body with overflow:hidden is scrollable when the visual viewport is smaller than the layout viewport", confirmed by WebKit's Simon Fraser as an engine bug, filed 2022, still NEW as of Apr 2025; related 214781, 222654, 237961, 153852 (https://bugs.webkit.org/show_bug.cgi?id=240860). Chrome-iOS rotation leaves a stale shrunk viewport needing manual reload (chromium 1150075 via https://hashir.blog/2021/02/google-is-taking-forever-to-fix-this-chrome-ios-bug/). Stale scroll position/height carries across content changes in Chrome mobile (https://github.com/react-navigation/react-navigation/issues/11274, https://github.com/locomotivemtl/locomotive-boilerplate/issues/164).
- S2 (fixed bottom bar mid-screen): sticky/fixed gap on Chrome iOS specifically, not Safari (https://generatepress.com/forums/topic/sticky-navigation-gap-on-scroll-chrome-ios/); iOS 26 keyboard-dismiss visualViewport staleness misplacing fixed elements + workarounds (https://iifx.dev/en/articles/460201403/debugging-ios-26-how-to-correct-fixed-positioning-post-keyboard-interaction); historical WKWebView-only keyboard-restore bug 192564 (https://bugs.webkit.org/show_bug.cgi?id=192564).
- S3 (overlay leaks + toolbar paints over): scroll latches under a modal in Chromium WebView family (https://github.com/ionic-team/ionic-framework/issues/28407, also 17971, 19370); iOS 26 floating-toolbar-over-content reports affecting Safari AND Chrome (https://discussions.apple.com/thread/256156706, https://www.macobserver.com/tips/how-to/floating-search-bar-overlay-bug-on-safari-and-chrome-after-ios-26-update/); fixed elements detach during rubber-band overscroll, WebKit 206227 still ASSIGNED Nov 2024 (https://bugs.webkit.org/show_bug.cgi?id=206227).
- `interactive-widget` viewport meta: NOT supported in iOS WebKit at all (Chromium/Blink-only; WebKit standards position silent), so it is NOT a tool available to the R3 form (https://bugs.webkit.org/show_bug.cgi?id=259770, https://developer.chrome.com/blog/viewport-resize-behavior).

### Why Chrome breaks where Safari does not (the direct answer)

1. Safari IS the OS browser: its toolbar and WebKit are co-designed, so toolbar motion is an internal, per-frame viewport-inset animation with fixed/sticky elements special-cased to track it smoothly.
2. Chrome iOS is a third-party app around WKWebView, which does NOT expose those per-frame hooks. On toolbar state changes Chrome must coarsely resize the whole web view, deferred/coalesced for performance. Between Chrome's UI state and the web view's viewport state there is a desynchronization window on EVERY toolbar or keyboard transition.
3. Chrome's toolbar is a native layer painted on top of the web view. It can re-expand at any moment (scroll-up delta, focus change) and simply draws OVER page content, including a z-index 980 fixed overlay: page z-index is meaningless against app-layer chrome (N1).
4. visualViewport events in Chrome fire at coarser, later moments than Safari's, so any JS correction computed from them (the v0.56 --vv-shift pin) uses stale numbers exactly during transitions (S2).
5. Shared WebKit engine bugs (240860 scroll-lock defeat, 297779 stuck offsetTop, 206227 rubber-band detach) exist in BOTH browsers, but Chrome's extra resize/desync layer triggers them far more often; Safari's tighter integration mostly avoids the triggering conditions. Some (170595 innerHeight staleness) are literally WKWebView-only, i.e. Chrome-affecting, Safari-immune.

Sources rated: architectural chain = named Chromium engineer + Chromium source history (high confidence); iOS 26 offsetTop regression = primary WebKit bug + Apple forum (high); exact iPad-vs-iPhone timing quantification = not available (gap); a few legacy crbug numbers unverifiable behind auth walls (snippet-level only).

### Mitigations documented as working on Chrome iOS (input for tasks 3-5)

- Kill the scrollable overflow instead of fighting the toolbar: a document with zero scrollable extent gives Chrome no scroll deltas, keeping its toolbar stable; `min-height:100vh` (largest viewport) is actively harmful, `100svh`/`100dvh` or content-height are safer (https://github.com/bokand/URLBarSizing + https://developer.chrome.com/blog/url-bar-resizing inference; svh/dvh support per https://www.bram.us/2021/07/08/the-large-small-and-dynamic-viewports/).
- `overscroll-behavior` alone is documented NOT sufficient on Chrome iOS (https://github.com/ebidel/demos/issues/6); the classic `html,body{position:fixed;overflow:hidden}` lock is degraded on iOS 12+ AND banned in this project (v0.54).
- Position bottom bars via `top` computed from `visualViewport.height + offsetTop` with `translateY(-100%)`, re-read ~100ms after focusout (iOS 26 staleness), optionally micro-nudge `scrollBy(0,-1);scrollBy(0,1)` to force the engine to re-settle (https://saricden.com/how-to-make-fixed-elements-respect-the-virtual-keyboard-on-ios, https://iifx.dev/en/articles/460201403/debugging-ios-26-how-to-correct-fixed-positioning-post-keyboard-interaction).
- A dummy empty `position:fixed` element can poke Chrome iOS into recomputing fixed placement after toolbar transitions (https://stevefenton.co.uk/blog/2022/12/mobile-position-sticky-issue/).

---

## Task 3 · Keyboard + bottom-fixed controls on iPadOS Chrome (S2)

### (a) iPad keyboard variants and the visual viewport

- Docked software keyboard: classic "resizes-visual" case, shrinks `visualViewport.height` / raises `offsetTop`, layout viewport untouched (https://developer.chrome.com/blog/viewport-resize-behavior).
- Floating + split keyboards: NO authoritative doc on whether they fire visualViewport resize at all; native-UIKit guidance treats them as needing no avoidance, implying no reliable occlusion signal (https://vp0.com/blogs/floating-keyboard-avoidance-ui-ipad, native-focused, inference only).
- Hardware-keyboard accessory/shortcut strip and the Apple Pencil Scribble bar: NOTHING published measures their visualViewport effect. Confirmed to exist and eat screen space (https://www.technetexperts.com/hide-ios-input-bar/), no web API to suppress on a plain page. **This is exactly the S2 trigger state and it is unmeasured anywhere; on-device instrumentation is required** (see recommendation).

### (b) What happens during focus auto-scroll

- iOS pans the VISUAL viewport inside the untouched layout viewport to reveal a focused input; `position:fixed` elements stay anchored to the layout viewport, so they visually drift, "start behaving like position:static" while the keyboard is open (https://github.com/w3c/csswg-drafts/issues/7475, https://medium.com/@im_rahul/safari-and-position-fixed-978122be5f29). A CSSWG fix (exclude keyboard from the fixed viewport) is proposed, unshipped.
- Stale-read race: reading `visualViewport` synchronously inside its own `resize`/`scroll` handler can return stale values (`offsetTop === 0`); documented fix = defer the read by `setTimeout(50)` or DOUBLE `requestAnimationFrame` (WebKit bug 237851, https://bugs.webkit.org/show_bug.cgi?id=237851). The v0.56 `pinBottomControls` reads in the same tick (one rAF, queued from the event) = exposed to this race.
- Updates lag: iOS "only updates after scroll has finished", so any translateY correction lags the pan mid-gesture (https://www.bram.us/2021/09/13/prevent-items-from-being-hidden-underneath-the-virtual-keyboard-by-means-of-the-virtualkeyboard-api/).

### (c) Reference values

- `window.innerHeight` is NOT a safe reference in Chrome iPadOS: WKWebView reports bogus/stale innerHeight (WebKit bug 170595, open since 2017, comment 2025-03-21 confirms it persists in Chrome on iOS); historically WKWebView even SUBTRACTED keyboard height from innerHeight while Safari did not (bug 150401) (https://bugs.webkit.org/show_bug.cgi?id=170595, https://bugs.webkit.org/show_bug.cgi?id=150401).
- Community consensus: `visualViewport.height + offsetTop` is the sole source of truth; innerHeight only as unshrunk baseline (https://martijnhols.nl/blog/how-to-get-document-height-ios-safari-osk, https://mathix.dev/blog/fix-html-elements-on-top-of-the-ios-keyboard-using-html-css-js).
- `dvh`/`svh`/`lvh` DO NOT track the keyboard (only browser-chrome collapse), so they are irrelevant to S2 (relevant to S1 instead) (https://www.bram.us/2021/07/08/the-large-small-and-dynamic-viewports/).
- VERDICT on v0.56: the formula `innerHeight - vv.height - vv.offsetTop` is the community-standard recipe (bram.us, saricden, mathix.dev all converge on it). S2 persists because (i) the `innerHeight` reference is unreliable in WKWebView/Chrome, (ii) the read races stale values in the same tick, (iii) during keyboard pan fixed elements drift regardless, and (iv) the iOS 26 stuck-offset regression leaves a permanent phantom gap after keyboard dismissal on affected builds.

### (d) Battle-tested patterns + failure modes

1. Top-anchored pin: `top = vv.offsetTop + vv.height` with `translateY(-100%)`, updated on vv resize+scroll, read DEFERRED by double-rAF (https://saricden.com/how-to-make-fixed-elements-respect-the-virtual-keyboard-on-ios + WebKit 237851). Failure modes: overscroll needs clamping; iOS updates only after scroll settles (transient drift); still wrong mid-pan.
2. VirtualKeyboard API / `env(keyboard-inset-height)`: NOT shipped in WebKit at all, Chromium-Android-only, and buggy even there. Dead end for iOS (https://zouhir.org/blog/virtual-keyboard-api/, https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API).
3. Sticky-in-flow footer (wrapper sticky + inner absolute + scroll compensation): avoids some fixed breakage but still needs JS compensation and blur handling; not keyboard-immune (https://www.codemzy.com/blog/sticky-fixed-header-ios-keyboard-fix).
4. Hide-while-focused: hide the bottom controls on `focusin`, reshow on `focusout` after a keyboard-settle delay. Simple, kills every keyboard-state misplacement by never showing controls in that state. Pitfalls: `focusout` fires before the dismiss animation ends (reshow delayed ~300ms); the hardware-keyboard accessory strip can exist WITHOUT a DOM focus event the page sees, so this cannot be the ONLY mechanism.
5. Continuous rAF polling: no evidence it beats event-driven + deferred reads; wasted battery. Winning pattern = event-driven + double-rAF read (WebKit 237851).

### Candidate fixes for S2 (input for synthesis)

- FIX A (recommended combo): rebuild the pin on `visualViewport` ONLY (drop `window.innerHeight`; baseline from `document.documentElement.clientHeight` at load or `100lvh`), anchor via top+translateY(-100%) equivalent, defer reads by double-rAF, clamp negatives, micro-nudge `scrollBy(0,-1);scrollBy(0,1)` after `focusout` to break the iOS 26 stuck-offset state. PLUS hide the three controls while a text field is focused (keyboard state = controls absent, nothing to misplace). Trade-offs: more code on a hot path; hide/show flicker ~300ms after blur; still cannot fix the unmeasured accessory-strip-only state.
- FIX B (structural): stop fixing the controls over content near the keyboard entirely: move Reset / Save & Lock into the document flow at the form's end (sticky footer inside the form card), keep only cog+theme floating. During keyboard states in-flow elements never drift. Trade-offs: visual design change (Igor approval needed); controls no longer omnipresent while scrolling; sticky still needs the wrapper pattern if it must FLOAT.
- Either fix needs an INSTRUMENTATION step first: a temporary hidden debug readout (admin-gated, not user-visible; hard rule 12) logging `vv.height/offsetTop/innerHeight/clientHeight` on Igor's iPad in the accessory-strip state, because no published source measures it.

---

(Tasks 4-5 append below.)
