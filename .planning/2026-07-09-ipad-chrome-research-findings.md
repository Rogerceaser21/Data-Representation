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

## Task 4 · Infinite scroll / stale scroll extent in Chrome iPadOS (S1)

### (a) Known WKWebView stale-extent bugs

- WKWebView subscribes to keyboard notifications and calls private `-[UIScrollView _adjustForAutomaticKeyboardInfo]`, ADDING keyboard height to the existing bottom `contentInset` (additive, not max'd with the toolbar inset) = the scrollable range grows by roughly keyboard height while an input is focused (https://gist.github.com/jamesreggio/d5233dba36b184ba3af3).
- Dismissal-time cleanup of that inset has a documented buggy history: WebKit 192564 "keyboard dismissal leaves WKWebView content offscreen / space at the bottom of the screen" (fixed 2019 for that instance, same class recurs); fek.io reports the persisted gap does NOT self-heal without reload or a manual contentOffset reset (https://bugs.webkit.org/show_bug.cgi?id=192564, https://fek.io/blog/nasty-scroll-bug-in-the-wk-web-view-in-i-os-12/).
- `window.scrollTo()` in WKWebView lands at wrong positions depending on `contentInsetAdjustmentBehavior`; regressed repeatedly across iOS versions, still open (https://bugs.webkit.org/show_bug.cgi?id=182710).
- WKWebView ignores `scrollView.contentInset` when computing its internal layout viewport, so a nonzero inset can inflate the effective scrollable range independent of document height (https://rick38yip.medium.com/wkwebview-weird-spacing-issue-in-ios-13-54a4fc686f72).
- Cordova/Quasar WKWebView hosts report the same empty-space-at-bottom family, NOT reproducible in Safari itself (https://github.com/apache/cordova-plugin-wkwebview-engine/issues/71, https://github.com/quasarframework/quasar/issues/6695). Chrome iOS is architecturally the same host category.

### (b)+(c) 100vh's role

- `min-height:100vh` (vh = LARGEST viewport) alone produces only a small toolbar-height overhang (tens of px), affecting iOS Chrome too (https://www.bram.us/2020/05/06/100vh-in-safari-on-ios/, https://github.com/gatsbyjs/gatsby/issues/14590). The screen-or-more void needs the (a) inset staleness stacked on top.
- Switching body to `100svh`/`100dvh` (iOS 15.4+) removes the baseline overhang but likely does NOT alone fix the large void (different layer: CSS sizing vs native UIScrollView inset bookkeeping).

### (e) overscroll-behavior

- Nominally supported since Safari 16 (2022) but documented unreliable on the ROOT scroller in WKWebView browsers; Chrome iOS pull-to-refresh/rubber-band ignores it (https://github.com/ebidel/demos/issues/6). Cannot be the fix for S1.

### Reproduction theory for S1 (numbered; sourced vs hypothesis marked)

1. Form open in Chrome iPad, toolbar expanded; body `min-height:100vh` gives a small permanent overhang [sourced].
2. Focus a textarea near the form bottom; WKWebView adds keyboard-height bottom contentInset, additively [sourced].
3. Programmatic `scrollTo(0,0)` (pad open) executes against that inflated inset state; WKWebView scrollTo has documented inset-dependent bookkeeping errors [sourced mechanism, hypothesis for this sequence].
4. Keyboard dismissed via accessory strip; inset cleanup is the known-buggy path, residual bottom gap persists [sourced class].
5. `scrollTo(0, savedY)` (pad close) restores against stale bookkeeping; content lands high, the leftover inset/extent below stays scrollable [hypothesis from sourced sub-mechanisms].
6. Chrome's own toolbar insets stack on top and `overscroll-behavior` cannot clamp the root scroller, so the void persists instead of rubber-banding back [partially sourced].

Implication for the fix: S1 is attacked most robustly by REMOVING the ingredients: no scrollable document behind the pad (kills the programmatic scrollTo-during-inset-transitions), body sized `100svh/dvh` not `100vh`, and avoiding scrollTo while keyboard state is in flux (blur inputs + settle-delay before any programmatic scroll). A corrective micro-scroll after keyboard dismissal (`scrollBy(0,-1);scrollBy(0,1)`) is the documented nudge for stale bookkeeping.

---

## Task 5 · Pad architecture: in-document swap vs separate page vs hardened overlay (S3/N1)

Evaluated against the actual code (line refs at 8f02836) by a Sonnet 5 agent (code reading + web checks).

### (a) In-document swap (form hidden while pad open)

- Hide `#r3-form` (2040), `.action-bar` (2410), theme toggle (1862), admin cog (1893) while `.pad-modal.open`; pad stays `position:fixed` unchanged; document scroll extent collapses to ~viewport, so Chrome gets NO scroll deltas (toolbar stable) and nothing can scroll under the pad.
- Verified against the code: Tom Select instances survive display:none (JS state + DOM persist; close any open dropdown first, `dropdownParent:'body'` at 3996); autosave unaffected (hidden fields get no events); Konva sizing reads only the pad's own `#pad-stage-wrap` (2955-2975), untouched; `extractAndApplySilently` writes `field.value` + dispatches events, works on hidden elements; the only two getBoundingClientRect calls are the Konva container (2978, 2987); photo inputs live inside the pad (2026-2027).
- REQUIRED extra: `body { min-height:100vh }` (105) is NOT scoped to pad state; hiding children does not collapse it. Needs `body.pad-open { min-height:0; padding:0 }` (or a global `svh/dvh` swap) or the architecture silently fails.
- Scroll restore: while the pad is open nothing can change scrollY (no scrollable extent, no text inputs in the pad), so `scrollTo(0, savedY)` on close restores against an identical layout = strongest restore guarantee of the three.

### (b) True separate page/URL

- BLOCKER 1: `applyTextToField`/`extractAndApply`/`commitForSubmit` (3264-3326, 3215) write into the same-document FORM; a separate page needs a cross-page reconciliation layer (BroadcastChannel or IndexedDB handoff) rebuilt and kept correct against the submit backstop. ~1200 lines of pad module would fork (2700-3900).
- BLOCKER 2 (deciding): full page navigation mid-observation is network-dependent; a WiFi hiccup shows Chrome's native error page, unsuppressable = direct hard rule 12 violation. All existing resilience patterns are within-page.
- Build: third artifact in `encrypt.sh`; StatiCrypt "remember me" carryover across two separately encrypted files is UNVERIFIED (localStorage keys are origin-scoped but hash is per-payload).
- IndexedDB `ais-r3-pad-v2` (2730) IS origin-shared, so state sharing is possible in principle; everything else makes it the worst option.

### (c) Hardened overlay (keep fixed overlay + research fixes)

- Smallest change: toggle `html,body{overflow:hidden}` while pad open (NOT the banned v0.54 position-fixed body lock; the ban comment at 2714-2717 covers repositioning, not overflow) + swap body `100vh` -> `svh/dvh`.
- Residual: WebKit 240860 defeats body overflow:hidden when visual viewport < layout viewport (keyboard up); pad has no text inputs so co-occurrence is unlikely but unmeasured. The scrollTo save/restore stays exposed to pre-existing stale-inset state (S1 risk window unchanged vs v0.56). Form content still exists underneath.

### Comparison table

| Criterion | (a) swap | (b) separate page | (c) hardened overlay |
|---|---|---|---|
| Kills S3 scroll-under | yes | yes | partial (240860 caveat) |
| Kills N1 toolbar-cover (scroll-driven trigger) | mostly | best in theory | mostly |
| Kills S1 contribution | yes | yes (new nav unknowns) | partial |
| No-Fullscreen / no-body-repositioning bans | yes | yes | yes |
| Exact scroll restore | high confidence | medium (browser nav restore) | medium (as today) |
| Hard rule 12 | low risk | ELEVATED (native nav error page) | low risk |
| StatiCrypt build | none | third artifact + unverified gate carryover | none |
| Konva/Pencil | none | fork ~1200 lines | none |
| Implementation size | small-medium (openPad/closePad 3358-3392 + body.pad-open CSS + hide 4 elements) | large | small |

### Recommendation

**Build (a) in-document swap**, with (c)'s `100svh/dvh` body sizing folded in as the S1 baseline fix and (c) as fallback if (a) hits an unforeseen cost. (b) solves nothing (a) does not, at much higher cost and a hard-rule-12 violation.

Top 3 unknowns only an on-device test resolves: (1) does content-collapse stop Chrome toolbar re-expansion on NON-scroll triggers (edge swipe, focus); (2) can stale keyboard inset from typing seconds BEFORE openPad still corrupt the restore (argues for blur + settle-delay in openPad); (3) TomSelect dropdown position quirks across display:none toggles in live WebKit.

---

## P2 Task 8 · iPadOS keyboard dismissal without blur (F2/F3 suspect) · 2026-07-10

Phase-2, after Igor's v0.57 on-device failures (F1 pad Done covered in landscape; F2 Save & Lock vanishes, tap revives; F3 void persists + bottom buttons vanish/return on taps). Sonnet 5 researcher + Opus 4.8 adversarial refuter.

### Research findings (sourced)

- No single canonical source states "the iPadOS dismiss key never fires blur". Composite evidence both ways: Apple forums iOS-13 regression where blur fired only after tapping another element (https://developer.apple.com/forums/thread/123777); React 26160: hide-key fired NATIVE blur in Safari, React synthetic missed it (https://github.com/facebook/react/issues/26160); React 28492: iOS Chrome outlier at the framework layer (https://github.com/facebook/react/issues/28492); Chromium 492894 comment asserts the OPPOSITE: "the blur event is raised in Chrome on iOS (as well as Safari)" on keyboard-hide (https://bugs.chromium.org/p/chromium/issues/detail?id=492894).
- visualViewport.resize fires on keyboard hide REGARDLESS of blur, but settles late: 100ms-1s (https://martijnhols.nl/blog/how-to-get-document-height-ios-safari-osk, https://github.com/semmel/on-screen-keyboard-detector); iOS 26 leaves ~24px stuck offset, Chrome iOS lags Safari on the reset ("fixed on Safari latest beta, Chrome on iOS still an issue", WebKit 297779 comment).
- Production keyboard detection WITHOUT focus events: viewport-delta thresholds; Discourse uses 150px generally and 75px on iPad specifically because the hardware-keyboard ACCESSORY BAR is ~55px (https://github.com/discourse/discourse/pull/18298/files). iPad keyboard heights: 264pt portrait / 352pt landscape (https://federicabenacquista.medium.com/list-of-the-official-ios-keyboards-heights-and-how-to-calculate-them-c2b844ef54b9). on-screen-keyboard-detector: visualViewport-only suffices on Safari, Chrome iOS needs focusin/focusout/resize/visibilitychange layered (https://github.com/semmel/on-screen-keyboard-detector).
- element.blur() from script does NOT reliably dismiss the iOS keyboard (DOM focus and OS keyboard are decoupled in WKWebView; gesture-origin required) (https://developer.apple.com/forums/thread/104771, https://bugs.webkit.org/show_bug.cgi?id=142757). Direct consequence: v0.57's blurAndSettle clears DOM focus but may leave the keyboard UP when the pad opens.
- Gaps: floating/split keyboard and swipe-dismiss blur behaviour undocumented for plain web pages; portrait-vs-landscape event timing undocumented.

### Opus 4.8 adversarial refuter verdict: UNDECIDED, leaning REFUTED-AS-STATED

Ranked alternatives (code-verified at aeff1e2):
- A1 (strongest): F2 is the v0.57 DESIGN, not the dismiss key. focusin hides Save & Lock the moment a field is focused (2539-2541, CSS 1401-1403); the revival tap is the NORMAL native blur path working (tap non-focusable -> activeElement=body -> kb-open removed). Dismiss-without-blur is not needed to reproduce Igor's F2 report.
- A2: our code uses NATIVE focusout; the strongest "no blur" evidence is React-synthetic and off-target; the native-level datapoint says iOS DOES blur on keyboard-hide.
- A3: the claim conflates "v0.57's mitigation did not run" with "cause of the void". F3's root remains the WKWebView stale keyboard inset (pre-dates the kb logic); dismiss-without-blur at most explains the mitigation not triggering.
- A4 (new mechanism): pinBottomControls BAILS while kb-open (2506), freezing --vv-shift for the whole keyboard session; late visualViewport updates are ignored until kb-open clears, so the bar can sit translated off the visible box even after opacity returns; a later tap/scroll re-fires the queue and "brings it back": matches "reappear after a few taps".

### Decisive on-device measurement (one gesture)

Focus a textarea in iPad Chrome, press ONLY the keyboard dismiss key, then read (console or diagnostics): did focusout fire; activeElement tag; body.kb-open; --vv-shift. focusout+BODY+kb-open false = claim REFUTED (F2 = hide-design bug, F3 = WKWebView inset). No focusout+TEXTAREA+kb-open true = claim CONFIRMED. Either way A1/A4 need fixing.

---

## P2 Task 9 · Landscape geometry + the unscrollable-page steady state (F1) · 2026-07-10

Sonnet 5 researcher + Opus 4.8 adversarial refuter.

### Research findings (sourced)

- Content rendering UNDER the browser top bar with ROTATION as the only repair is the documented signature of WKWebView's stale unobscuredContentRect: WebKit 170595 (open since 2017, WKWebView-only so Chrome-hit/Safari-immune): "During rotation, WebKit sends a visible rect update with an unobscuredContentRect that hasn't been updated... We really need to round-trip through the web process with the new size before we can reliably compute rects" (https://bugs.webkit.org/show_bug.cgi?id=170595).
- iOS 26 active regression: a floating bar covers page content in Safari AND Chrome, users report "rotate horizontally then back" as the fix (https://discussions.apple.com/thread/256156706, Oct-Dec 2025); iOS 26 bottom-gap variant: fixed inset:0 overlays fail to reach true edges (https://github.com/mui/material-ui/issues/46953).
- Chrome iOS: 100vh/svh/dvh can ALL collapse to the same wrong value depending on an internal "Fullscreen Smooth Scrolling" experiment (https://issues.chromium.org/issues/40944174, vs Chrome 119). svh is best practice, NOT a guarantee on Chrome iOS.
- env(safe-area-inset-top) reflects DEVICE geometry (notch/status bar), NOT the browser toolbar; useless against Chrome's toolbar (https://css-tricks.com/the-notch-and-css/).
- Toolbar on an unscrollable page: no deltas = toolbar does not MOVE (stays in whatever state it was); landscape forces the address bar to the TOP with no user placement choice (https://support.google.com/chrome/answer/14181646).
- Programmatic rotation-mimicking nudges (resize dispatch, double-rAF, 1px height flip): NO documented success reproducing the full round-trip re-layout; only time-based waits/polling and getBoundingClientRect-forced reflows have any traction (WebKit 170595 comments). Rotate-to-fix is a user workaround with no JS equivalent.
- Leaving ~1-2px scrollable extent to keep scroll machinery alive: documented in adjacent patterns (scroll-chaining prevention), unverified for keeping Chrome's toolbar collapsible (https://dev.to/mpuckett/the-holy-grail-web-app-shell-with-header-and-footer-for-iphone-549j).
- Gaps: no published iPad-Chrome toolbar px heights portrait/landscape (measure on device); no direct iPad-Chrome toolbar-collapse benchmark (inferred from shared WebKit stack).

### Opus 4.8 adversarial refuter verdict: REFUTED AS STATED (the "swap caused F1" attribution)

Timeline kills the causal claim: the toolbar covered the pad buttons ALREADY in v0.56 (symptom map N1) on a scrollable page, and v0.56 also did scrollTo(0,0) on open. The body collapse does not change the fixed overlay's geometry at all. "Unscrollable" does not pin the toolbar EXPANDED; it pins it in whatever state it was at open and REMOVES the scroll-collapse escape.

Ranked F1 mechanisms:
1. M2 stale rect at pad open: blurAndSettle clears DOM focus but CANNOT force the OS keyboard closed (Task 8), so the inset:0 overlay can be laid out against a rect wrong by the toolbar+keyboard delta (WebKit 170595 / 297779 family). Fits: landscape worse (same absolute error = larger fraction of a short viewport, Done falls inside the covered band; portrait clears), rotation repairs (forced full re-layout).
2. M1 + stuckness story: version-independent overlay-under-native-toolbar (app-layer chrome paints over any z-index), which v0.56 users could escape by scrolling (toolbar collapses); v0.57's swap removed that escape = "page gets stuck". The swap caused a REGRESSION IN RECOVERABILITY, not the coverage.
3. The literal claim (swap forces toolbar expanded => covers): weakest, contradicted by the timeline.

### Decisive on-device observations (one state each)

- Pad open in LANDSCAPE with Done covered: is the pad full-height with the toolbar painted ON TOP (M1) or is the pad itself shifted/short with a gap band (M2)? Diagnostics in that state: innerHeight / clientHeight / vv.height / vv.offsetTop + pad-modal getBoundingClientRect (top ~0 + height ~clientHeight = M1; offsetTop stuck > 0 or rect short by ~toolbar+kb = M2).
- One-bit control: does Done get covered on a COLD pad open (no prior typing)? Cold = M1; only-after-keyboard = M2.

---

## P2 Task 10 · Adversarial audit of the v0.57 code paths · 2026-07-10

Opus 4.8 primary auditor + Sonnet 5 independent second opinion, same file (aeff1e2), read separately. THE TWO CONVERGED on all three failures. Line refs verified by both.

### F2 · Save & Lock vanishes (CONVERGED, highest confidence)

- `body.kb-open` CSS (1401-1403) makes the three controls `opacity:0 + pointer-events:none` from the moment ANY keyboard field gets focus (2539-2541). Removal ONLY via focusout + 350ms (2542-2552).
- Stuck paths: (i) keyboard dismissed via the dismiss key / strip WITHOUT blur -> focusout never fires -> kb-open sticky for the session; (ii) HARDWARE keyboard: no software keyboard ever shows, controls hidden the entire typing session; (iii) APPLE PENCIL SCRIBBLE into a textarea: focus without any keyboard at all -> controls vanish during normal pen writing (Sonnet find; directly relevant to Igor's Pencil workflow).
- The tap-to-revive walk matches Igor EXACTLY: with pointer-events:none the first tap on Save & Lock passes THROUGH the invisible button, lands behind it, blurs the field, 350ms later the button returns; the second tap works. Two taps minimum by design.
- Safe paths verified: focus chains (350ms recheck), admin modal close, pad-open ordering in the timeout (kb-open removal wins before the pad guard).

### F3 · Void persists + buttons return after taps (CONVERGED)

- The ONLY void cleanup (nudge + clamp, 2548-2550) lives inside focusout: never runs on no-blur dismissal (same root as F2).
- Even when it runs: the clamp measures against the INFLATED scrollHeight and uses window.innerHeight (2549), the exact value the file's own pin avoids as bogus (2493-2494 vs 2507) -> clamp no-ops against the corrupted extent.
- The 1px nudge is a NO-OP at scroll boundaries (scrollY 0 or max): no scroll delta -> no scroll event -> pinBottomControls.queue never re-fires -> --vv-shift stays frozen (the 2506 kb-open bail froze it all session). "Buttons reappear after a few taps" = the user's taps ARE the missing events the fix logic depends on but never generates itself (Sonnet find).
- Type -> open pad -> close pad: the focusout timer SKIPS the clamp while pad-open (2547), so the one safety net is disabled for exactly the likeliest void flow; closePad blindly scrollTo(0, padScrollY) with no re-validation (3517).

### F1 · Pad Done covered, page stuck, rotation repairs (CONVERGED + two new paths)

- Structural: `.pad-modal` is `inset:0` fixed with NO top compensation of any kind: no safe-area-inset-top (grep = 0 hits; only -bottom exists at 1595/1620), no --vv-shift on the pad chrome, no svh sizing, no orientationchange handler anywhere (grep = 0); the only resize listener just resizes the Konva canvas (3504). The bottom controls got the entire v0.56/v0.57 pinning treatment; the pad's TOP row got nothing.
- openPad scrolls to 0 + collapses the document (3499, 1391); Chrome's toolbar sits over the layout-viewport top where .pad-top/#pad-done live (1405, 1999); containScroll preventDefaults every pan inside the pad (2834-2841) so there is NO gesture escape = "stuck"; rotation is the only full re-layout = "repair".
- NEW PATH 1 (Opus): async openPad has NO try/catch (3489-3508); if showPage/Konva throws after body.pad-open is set (3498), the form is display:none with no pad painted = blank stuck page, nothing removes the class. openPadView HAS an error exit (4003); openPad does not (asymmetry).
- NEW PATH 2 (Opus): pen-pill launch (openPadAt 3510) moves focus to the BUTTON first, so blurAndSettle (2848-2856) sees a non-keyboard activeElement and NO-OPS: the settle it was built for is skipped in the most common launch flow, and padScrollY (3496) is read mid-inset-flux -> closePad restores a corrupted spot.
- Race (Opus): Done tapped during the settle window (~150-170ms before pad-open is set) -> closePad runs first, deferred openPad then sets pad-open anyway = pad opens after the user closed it.

### Second-opinion deltas

No contradictions. Sonnet added Scribble-triggers-kb-open + nudge-no-op-at-boundaries + clamp-vs-inflated-extent timing; Opus added the no-try/catch stuck page, the openPadAt settle-skip, the Done-during-settle race, and verified three suspect paths as actually safe (focus chains, admin close, kb/pad timeout ordering).

### Converged root sentence

The v0.57 code equates "keyboard gone" with "focusout fired" and "overlay covers the screen" with "layout viewport is correct"; neither holds on iPad, and the pad's top edge never received the viewport compensation the bottom controls got.

---

(End of research findings; synthesis v2 in `.planning/2026-07-10-ipad-chrome-synthesis-v2.md`.)
