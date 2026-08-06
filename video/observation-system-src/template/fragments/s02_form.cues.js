/* 2 . the form
   v2.5 refit: the scene OPENS on REAL iOS Simulator footage of a real iPadOS
   springboard, and a real tap really opens the Observation Form app. The
   CSS-drawn home screen, the drawn fingertip, the gold ripple and the authored
   app-open zoom are all GONE; the footage's own zoom IS the transition. What is
   still authored here is exactly three things: WHEN the clip starts, the iOS
   touch indicator over the tapped icon, and the dissolve off the footage's dark
   peak into the form.

   THE CLIP MAP (the one law of this beat)
     the footage carries its tap 0.80s into the file, so
       clip data-start = S2_TAP - 0.80          (stamped by {{ATF:...:-0.80}})
       the real tap therefore fires exactly ON the 0.060 word-share
     the app-open zoom fills the screen with black by ~1.55s of file time; the
     file's TAIL (past ~2.16s) is the opened app painting its own light-gray
     ground, so the clip window is 2.05s and the beat cuts before it.

   v2.4 line (58 words), every fraction recomputed from THIS text:
   "While the coaches are observing a lesson, they fill in the relevant
    observation form: subject, class and teacher, with live dropdowns fed by the
    school's own staff directory, so nothing is typed from memory and no list is
    ever out of date. Class composition is a few taps. The whole context of the
    lesson, captured throughout the observation."
   Word share: 0.060 the real tap (mid "coaches") . 0.096 the footage is fully
   dark and the app takes the frame . 0.117 the black has faded off the form .
   0.121 "they fill in the relevant observation
   form" . 0.310 "with live dropdowns" . 0.397 "the school's own staff
   directory" . 0.500 "so nothing is typed from memory" . 0.724 "Class
   composition is a few taps" . 0.931 "captured throughout the observation". */

var S2_TAP = atf('s02_form', 0.060);                          // the REAL tap in the footage
var S2_CLIP = Math.max(S2_TAP - 0.80, at('s02_form', -0.55)); // = the video's data-start
var S2_DARK = S2_CLIP + 1.55;                                 // footage is full-frame black

/* the tablet layer is HELD visible across the head beat by a fromTo, then taken
   out by a to(), so its resting state stays "gone" and a frame rendered without
   the timeline shows the form (the #s7gate idiom). The screen carries the
   footage's frame 0 as a poster still, so the 1.00s between the layer appearing
   and the clip window opening is the same springboard, not a black rectangle. */
tl.fromTo('#s2ipd', { opacity: 1 },
    { opacity: 1, ease: 'none', immediateRender: false,
      duration: (S2_DARK + 0.26) - at('s02_form', -0.55) }, at('s02_form', -0.55))
  /* the iOS touch indicator. It reaches full opacity ON the tap frame, so the
     fade-in runs over the last 0.12s of the still springboard and the disc is
     visibly sitting on the icon at the instant the real app-open begins: the
     footage's zoom starts on the SAME frame as the tap, so a disc that only
     started fading in at the tap would never once be seen on an icon.
     0.12 in / 0.18 hold / 0.25 out, explicit times off the scene timeline. */
  .fromTo('#s2touch', { opacity: 0, scale: 0.92 },
    { opacity: 1, scale: 1, duration: 0.12, ease: 'power2.out', immediateRender: false }, S2_TAP - 0.12)
  .to('#s2touch', { opacity: 0, duration: 0.25, ease: 'power2.in' }, S2_TAP + 0.18)
  /* THE APP TAKES THE FRAME. The footage's own zoom has already filled the
     tablet's SCREEN with black; this pushes that black screen out to fill the
     1920x1080 frame (720 * 2.8 = 2016 wide, so the bezel leaves the frame), and
     only then does the layer fade. Without it the fade is a dark tablet
     dissolving over a LIT cream form and the frame passes through a muddy gray
     double-image (proved on a frame at the 50% point). Fading from a full-frame
     black instead is one clean move and never shows two pictures at once. */
  .fromTo('#s2ipd .ipdev', { scale: 1 },
    { scale: 2.8, duration: 0.26, ease: 'power2.in', immediateRender: false }, S2_DARK)
  /* the fade starts only once the fill has LANDED: at +0.22 the screen is still
     1649px of a 1920px frame and the navy field shows as two stripes down the
     sides of the fade (proved on a frame). +0.26 is the first instant the black
     covers. */
  .to('#s2ipd', { opacity: 0, duration: 0.28, ease: 'power2.out' }, S2_DARK + 0.26);

/* the form rides out of the black, then plays exactly as it did in v2.4 */
tl.from('#s2dev', { opacity: 0, y: 14, scale: 1.05, duration: 0.72, ease: 'power3.out' }, S2_DARK + 0.24)
  .from('#s2head', { opacity: 0, y: 12, duration: 0.7, ease: 'power2.out' }, S2_DARK + 0.42)
  /* "they fill in the relevant observation form": the context grid fills cell by cell */
  .from('#s2grid .info-cell', { opacity: 0, y: 14, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, atf('s02_form', 0.121));

/* "with live dropdowns fed by the school's own staff directory" */
tl.fromTo('#s2drop', { opacity: 0, scaleY: 0.82, y: -8 },
    { opacity: 1, scaleY: 1, y: 0, duration: 0.36, ease: 'power2.out', immediateRender: false }, atf('s02_form', 0.310))
  .from('#s2drop .option', { opacity: 0, x: -12, duration: 0.3, stagger: 0.07, ease: 'power2.out' }, atf('s02_form', 0.328))
  /* the name lands on the row: the product's green .selected state */
  .from('#s2sel', { backgroundColor: 'rgba(46,161,90,0)', color: '#143642', duration: 0.45, ease: 'power2.out' }, atf('s02_form', 0.397))
  .to('#s2drop', { opacity: 0, scaleY: 0.9, duration: 0.28, ease: 'power2.in' }, atf('s02_form', 0.466))
  .fromTo('#s2ph', { opacity: 1 }, { opacity: 0, duration: 0.22 }, atf('s02_form', 0.483))
  /* "so nothing is typed from memory": the picked name resting in the row */
  .from('#s2tname', { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out' }, atf('s02_form', 0.500));

/* "Class composition is a few taps": four pill groups fill green */
tl.from('#sc02 .pill.is-selected', {
    backgroundColor: 'rgba(46,161,90,0)', color: '#6b7e85', borderColor: 'rgba(20,54,66,0.14)',
    scale: 0.86, duration: 0.42, stagger: 0.16, ease: 'back.out(2)'
  }, atf('s02_form', 0.724))
  .from('#s2ill', { opacity: 0, duration: 0.6 }, atf('s02_form', 0.810))
  /* "captured throughout the observation": the closing phrase of the line */
  .from('#s2note', { opacity: 0, x: -14, duration: 0.7, ease: 'power2.out' }, atf('s02_form', 0.931));
