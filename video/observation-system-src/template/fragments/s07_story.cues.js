/* 7 . the dashboard story . gate wipe, the Snapshot Story board, then present mode.
   Fractions recomputed on the v2.4 line (78 words): 0.115 "which is password
   protected" . 0.154 "Here is an observation round" (the press) . 0.167 the gate
   lifts . 0.295 "The story plays itself" . 0.346 "a hundred and eleven lessons" .
   0.551 "Where judgements sit on the six point scale" . 0.654 "What is working" .
   0.692 "Where to focus next" . 0.756 "one tap presents" . 0.833 "in full screen".
   The v2.4 open is SHORTER than v2.3's ("For example: first, we open ... which is
   password protected"), so the whole gate act now finishes ~1.8s earlier.
   The gate is held by a fromTo(immediateRender:false) and taken out by a to(), so
   its resting state stays "gone"; the present frame rests VISIBLE, because it is
   the scene's final state, and the finished board rests underneath it. */

/* present mode carries the board's OWN figures: each [data-mirror] slot copies its
   source's data-count (or its text) at load, before any cue runs, so nothing is
   retyped in the markup and the resting DOM already reads finished. */
document.querySelectorAll('#s7pres [data-mirror]').forEach(function (slot) {
  var src = document.querySelector(slot.dataset.mirror);
  if (!src) return;
  slot.textContent = src.dataset.count !== undefined ? src.dataset.count : src.textContent;
});

tl.fromTo('#s7gate', { opacity: 1 },
    { opacity: 1, ease: 'none', immediateRender: false,
      duration: atf('s07_story', 0.167) - at('s07_story', -0.55) }, at('s07_story', -0.55))
  .from('#s7gcard', { opacity: 0, y: 22, duration: 0.85, ease: 'power2.out' }, at('s07_story', -0.3))
  .from('#s7gdots i', { opacity: 0, scale: 0.3, duration: 0.26, ease: 'back.out(2.2)', stagger: 0.085 }, at('s07_story', 1.15))
  /* "which is password protected": the gate's own Confidential kicker lifts to gold
     and back (yoyo, so it rests at the gate's authored red). Literal hexes are the
     gate's own palette, #EF343A and #FFBA14, verbatim from s07_story.css. */
  .fromTo('#sc07 .s7gkick', { color: '#EF343A' },
    { color: '#FFBA14', duration: 0.5, ease: 'power2.inOut', yoyo: true, repeat: 1, immediateRender: false }, atf('s07_story', 0.115))
  /* "Here is an observation round": the button takes the press, then the gate lifts */
  .fromTo('#s7gbtn', { scale: 1 }, { scale: 0.955, duration: 0.13, ease: 'power2.in', immediateRender: false }, atf('s07_story', 0.154))
  .to('#s7gbtn', { scale: 1, duration: 0.3, ease: 'back.out(2)' }, atf('s07_story', 0.154) + 0.13)
  .to('#s7gate', { yPercent: -100, opacity: 0, duration: 0.85, ease: 'power3.inOut' }, atf('s07_story', 0.167));

/* the board lands BEHIND the gate, a beat before the wipe starts, so the lifting
   gate uncovers a finished board instead of an empty frame. The tiles land WITH
   the board (product behaviour: the tile renders, then the number counts), so the
   left column is never a hole; the 0.295 "The story plays itself" beat would leave
   it one for ~3s, and the count-up below carries that phrase instead. */
tl.from('#sc07 .s7top', { opacity: 0, y: 18, duration: 0.75, ease: 'power2.out' }, atf('s07_story', 0.145))
  .from('#s7board', { opacity: 0, y: 26, duration: 0.9, ease: 'power3.out' }, atf('s07_story', 0.155))
  .from('#s7stats .stat', { opacity: 0, y: 20, duration: 0.6, stagger: 0.14 }, atf('s07_story', 0.169))
  /* the dot chart arrives labelled and empty with the board: a chart waiting to
     fill reads as intentional, a missing panel reads as broken */
  .from('#sc07 .s7dcard', { opacity: 0, x: 26, duration: 0.75, ease: 'power2.out' }, atf('s07_story', 0.182));
/* "a hundred and eleven lessons", the second tile still counting on "a hundred and
   five teachers", both settled by "counted up live from the data" (0.474) */
countUp('#s7stats .stat .v[data-count]', atf('s07_story', 0.346), 1.5);

/* "Where judgements sit on the six point scale": the value arc fills segment by
   segment, red end toward the average, and the dot sort flies in beside it */
tl.from('#s7gauge .arcfill', { opacity: 0, duration: 0.3, stagger: 0.022, ease: 'none' }, atf('s07_story', 0.551))
  .from('#s7gauge .arcw', { opacity: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(1.8)' }, atf('s07_story', 0.574))
  .from('#sc07 .s7gaugecard .gauge-cap', { opacity: 0, y: 10, duration: 0.5 }, atf('s07_story', 0.581))
  /* the lessons fly in, one dot each (offsets are seeded, never Math.random) */
  .from('#s7dots .dsdot', { opacity: 0, scale: 0.35, duration: 0.55, ease: 'back.out(1.35)',
    x: function (i, el) { return +el.dataset.fx; }, y: function (i, el) { return +el.dataset.fy; },
    stagger: { each: 0.009 } }, atf('s07_story', 0.563))
  /* "What is working." / "Where to focus next." */
  .from('#s7rail .s7beat:nth-child(1)', { opacity: 0, x: -14, duration: 0.5 }, atf('s07_story', 0.654))
  .from('#s7rail .s7beat:nth-child(2)', { opacity: 0, x: -14, duration: 0.5 }, atf('s07_story', 0.692))
  .from('#s7rail .subtle', { opacity: 0, duration: 0.6 }, atf('s07_story', 0.718));

/* "And one tap presents": the Present pill is named, the tabs beside it dim so the
   eye has somewhere to go (dense card rule), then the ring releases. */
spotlight('#s7present', atf('s07_story', 0.756), 2.0);
tl.to('#s7tabs .s7tab', { opacity: 0.55, duration: 0.45 }, atf('s07_story', 0.756))
  .to('#s7tabs .s7tab', { opacity: 1, duration: 0.6 }, atf('s07_story', 0.756) + 2.0)
  /* "in full screen", holding through "showcase the round by itself in any
     meeting" (0.897) to the cut. This is the scene's resting state. */
  .from('#s7pres', { opacity: 0, scale: 1.06, duration: 0.8, ease: 'power3.out' }, atf('s07_story', 0.833));
