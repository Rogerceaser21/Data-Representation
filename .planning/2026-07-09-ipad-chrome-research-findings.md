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

(Tasks 3-5 append below.)
