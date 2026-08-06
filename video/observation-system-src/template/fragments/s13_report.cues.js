/* 13 . reports: the report is CLICKED OPEN, then it scrolls.

   WORD SHARE for the v2.5 line (64 words, scenes.json s13_report, byte
   identical to v2.4). Fractions are (words spoken before the phrase) / 64 and
   are carried over verbatim from the v2.4 cues file, which derived them from
   this exact text:
     0.000  "For the leadership table,"
     0.063  "one button turns the round into a governance report"
     0.203  "simple or in depth."
     0.266  "One tap or click,"
     0.375  "and you have a PDF or a Google Doc"
     0.469  "all references attached"
     0.516  "teachers anonymised by construction"
     0.578  "When a new round lands"
     0.656  "one more button rewrites the analysis for it"
     0.875  "the Head of Teaching and Learning"

   The two clicks are anchored to the PHRASES the build brief names ("one
   button" and "One tap or click"), not to the percentages it quotes alongside
   them: those percentages were computed against a shorter draft of this line,
   and the phrase is what the viewer hears. The scroll's 0.55 start is the one
   number that lands the same either way.

   The window's own chrome still assembles on a short absolute ladder (0.1 to
   1.1s): that ladder sits inside the first clause either way, and it is the
   window drawing itself, not a beat.

   The scroll is ONE tween, budgeted from what the line leaves after it, so it
   always settles instead of being cut mid travel. */

var S13_TRAVEL = 195;          /* px of report page travel: 664 page - 469 viewport, measured off the built page */
var S13_CUR_INX = 88;          /* cursor entrance, x offset from the Report button */
var S13_CUR_INY = 168;         /* cursor entrance, y offset from the Report button */
var S13_CUR_MIX = -119;        /* the In Depth menu item, x offset from the Report button */
var S13_CUR_MIY = 105;         /* the In Depth menu item, y offset from the Report button */

var S13_CLICK1 = atf('s13_report', 0.063);                    /* "one button turns the round into a governance report" */
var S13_CLICK2 = atf('s13_report', 0.266);                    /* "One tap or click" */
var S13_SCROLL = atf('s13_report', 0.55);
var S13_TAIL = at('s13_report', NARR.s13_report.dur - 0.25);  /* last frame still credibly on this scene */
var S13_SCDUR = Math.max(2.4, S13_TAIL - S13_SCROLL);

/* ---- beat A . the window draws itself, "For the leadership table," ----
   The ladder is BUDGETED, not a constant: its last rung has to have finished
   before the cursor presses the Report button, or the histogram grows after the
   menu is already open. Six rungs, sized from the distance to that first click,
   with the last one landing exactly on it. */
var S13_RUNG = Math.max(0.09, (S13_CLICK1 - at('s13_report', 0.02) - 0.60) / 5);
function s13rung(n) { return at('s13_report', 0.02) + n * S13_RUNG; }

tl.from('#s13head', { opacity: 0, y: 16, duration: 0.7 }, at('s13_report', -0.4))
  .from('#s13win', { opacity: 0, y: 20, duration: 0.7, ease: 'power2.out' }, s13rung(0))
  .from('#s13mast', { opacity: 0, y: -10, duration: 0.45 }, s13rung(1))
  .from('#s13sh', { opacity: 0, y: 10, duration: 0.45 }, s13rung(2))
  .from('#s13ctl', { opacity: 0, y: 10, duration: 0.45 }, s13rung(3))
  .from('#s13stats .stat', { opacity: 0, y: 12, duration: 0.45, stagger: 0.08 }, s13rung(4))
  .from('#s13dist', { opacity: 0, y: 12, duration: 0.45 }, s13rung(5))
  .from('#s13dist .hb', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.4, stagger: 0.035, ease: 'power2.out' }, s13rung(5));

/* ---- beat B . the cursor arrives and clicks Report ----
   The glide LANDS on the click, and the menu opens 0.1s behind the ring, so the
   menu is visibly opened by something (the #s8mk taprip idiom). */
tl.fromTo('#s13cur', { x: S13_CUR_INX, y: S13_CUR_INY, opacity: 0 },
    { x: 0, y: 0, opacity: 1, duration: 0.95, ease: 'power2.inOut', immediateRender: false }, S13_CLICK1 - 0.9)
  .fromTo('#s13click', { scale: 0, opacity: 0.65 },
    { scale: 3.6, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, S13_CLICK1)
  .fromTo('#s13press1', { opacity: 0 },
    { opacity: 1, duration: 0.08, ease: 'none', immediateRender: false }, S13_CLICK1)
  .fromTo('#s13press1', { opacity: 1 },
    { opacity: 0, duration: 0.34, ease: 'power2.out', immediateRender: false }, S13_CLICK1 + 0.12)
  .fromTo('#s13repbtn', { scale: 1 },
    { scale: 0.965, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, S13_CLICK1)
  /* the menu drops open from its own top right corner */
  .fromTo('#s13menu', { opacity: 0, y: -8, scaleY: 0.86 },
    { opacity: 1, y: 0, scaleY: 1, duration: 0.32, ease: 'power3.out', immediateRender: false }, S13_CLICK1 + 0.1);

/* "simple or in depth.": the two items light in the order the narrator says them.
   Literal rgba is the light theme hover tint the product uses on .repmi. */
tl.fromTo('#s13miA', { backgroundColor: 'rgba(20,35,63,0)' },
    { backgroundColor: 'rgba(20,35,63,.07)', duration: 0.22, ease: 'power2.out', immediateRender: false }, atf('s13_report', 0.203))
  .to('#s13miA', { backgroundColor: 'rgba(20,35,63,0)', duration: 0.4, ease: 'power2.inOut' }, atf('s13_report', 0.203) + 0.5)
  .fromTo('#s13miB', { backgroundColor: 'rgba(20,35,63,0)' },
    { backgroundColor: 'rgba(20,35,63,.07)', duration: 0.22, ease: 'power2.out', immediateRender: false }, atf('s13_report', 0.234));

/* ---- beat C . "One tap or click": the cursor takes In Depth ---- */
tl.fromTo('#s13cur', { x: 0, y: 0 },
    { x: S13_CUR_MIX, y: S13_CUR_MIY, duration: 0.55, ease: 'power2.inOut', immediateRender: false }, S13_CLICK2 - 0.5)
  .fromTo('#s13click', { scale: 0, opacity: 0.65 },
    { scale: 3.6, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, S13_CLICK2)
  .fromTo('#s13press2', { opacity: 0 },
    { opacity: 1, duration: 0.08, ease: 'none', immediateRender: false }, S13_CLICK2)
  .fromTo('#s13press2', { opacity: 1 },
    { opacity: 0, duration: 0.34, ease: 'power2.out', immediateRender: false }, S13_CLICK2 + 0.12)
  /* the menu closes, the cursor leaves with it, the live page retires */
  .fromTo('#s13menu', { opacity: 1, y: 0 },
    { opacity: 0, y: -6, duration: 0.24, ease: 'power2.in', immediateRender: false }, S13_CLICK2 + 0.2)
  .fromTo('#s13cur', { opacity: 1 },
    { opacity: 0, duration: 0.3, ease: 'power2.in', immediateRender: false }, S13_CLICK2 + 0.24)
  .fromTo('#s13snapv', { opacity: 1, y: 0 },
    { opacity: 0, y: -16, duration: 0.42, ease: 'power2.in', immediateRender: false }, S13_CLICK2 + 0.2);

/* the report page takes the window. .from(), so the CSS rests on the report,
   which IS the scene's last frame, and the seek before the click holds it out. */
tl.from('#s13repv', { opacity: 0, y: 20, duration: 0.55, ease: 'power3.out' }, S13_CLICK2 + 0.3);

/* "and you have a PDF or a Google Doc": the export control the board renders */
spotlight('#s13export', atf('s13_report', 0.375), 1.7);

/* "all references attached" then "teachers anonymised by construction": the
   method card already says both, in the product's own words, so the beat is a
   colour lift on its two clauses, not a second ring in a scene that owns one.
   Literal hexes are this scene's light theme tokens, the projector pass values
   dashboard.css runs on the board's inks: --ink-mid #586479 lifting to --ink
   #14233f, then released back to rest. */
tl.fromTo('#s13mref', { color: '#586479' },
    { color: '#14233f', duration: 0.4, ease: 'power2.out', immediateRender: false }, atf('s13_report', 0.469))
  .to('#s13mref', { color: '#586479', duration: 0.6, ease: 'power2.inOut' }, atf('s13_report', 0.469) + 1.0)
  .fromTo('#s13mano', { color: '#586479' },
    { color: '#14233f', duration: 0.4, ease: 'power2.out', immediateRender: false }, atf('s13_report', 0.516))
  .to('#s13mano', { color: '#586479', duration: 0.6, ease: 'power2.inOut' }, atf('s13_report', 0.516) + 1.0);

/* ---- beat D . the slow read ----
   ONE tween on the page inside the masked viewport: linear enough to read as a
   reader scrolling, eased at both ends so it neither snaps on nor stops dead.
   It rests at the bottom of its travel, settled on the last bullets. */
tl.fromTo('#s13scroll', { y: 0 },
  { y: -S13_TRAVEL, duration: S13_SCDUR, ease: 'power1.inOut', immediateRender: false }, S13_SCROLL);

/* the citation markers attach as their bullet ARRIVES, not on one stagger: the
   first one lands on the words "all references attached", where it is the only
   bullet above the fold; the other three attach as the scroll lifts them into
   the frame, which the travel puts at roughly 0.75 / 0.84 / 0.93 of the line. */
tl.from('#s13pts li:nth-child(1) .refmk', { opacity: 0, scale: 0.4, duration: 0.45, ease: 'back.out(2)' },
    atf('s13_report', 0.469) + 0.2)
  .from('#s13pts li:nth-child(n+2) .refmk', { opacity: 0, scale: 0.4, duration: 0.45, ease: 'back.out(2)',
    stagger: (atf('s13_report', 0.93) - atf('s13_report', 0.75)) / 2 }, atf('s13_report', 0.75));
