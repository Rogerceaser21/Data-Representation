/* 7 . the dashboard story . gate wipe, then the Snapshot Story board.
   The gate is held by a fromTo(immediateRender:false) and taken out by a to(),
   so its resting state stays "gone" and a frozen frame shows the board. */
tl.fromTo('#s7gate', { opacity: 1 },
    { opacity: 1, ease: 'none', immediateRender: false,
      duration: atf('s07_story', 0.225) - at('s07_story', -0.55) }, at('s07_story', -0.55))
  .from('#s7gcard', { opacity: 0, y: 22, duration: 0.85, ease: 'power2.out' }, at('s07_story', -0.3))
  .from('#s7gdots i', { opacity: 0, scale: 0.3, duration: 0.26, ease: 'back.out(2.2)', stagger: 0.085 }, at('s07_story', 1.15))
  .fromTo('#s7gbtn', { scale: 1 }, { scale: 0.955, duration: 0.13, ease: 'power2.in', immediateRender: false }, atf('s07_story', 0.176))
  .to('#s7gbtn', { scale: 1, duration: 0.3, ease: 'back.out(2)' }, atf('s07_story', 0.176) + 0.13)
  .to('#s7gate', { yPercent: -100, opacity: 0, duration: 0.85, ease: 'power3.inOut' }, atf('s07_story', 0.225));

/* the board lands BEHIND the gate, a beat before the wipe starts, so the lifting
   gate uncovers a finished board instead of an empty frame */
tl.from('#sc07 .s7top', { opacity: 0, y: 18, duration: 0.75, ease: 'power2.out' }, atf('s07_story', 0.198))
  .from('#s7board', { opacity: 0, y: 26, duration: 0.9, ease: 'power3.out' }, atf('s07_story', 0.208))
  /* tiles land WITH the board (product behaviour: the tile renders, then the
     number counts), so the left column is never a hole waiting for its cue */
  .from('#s7stats .stat', { opacity: 0, y: 20, duration: 0.6, stagger: 0.14 }, atf('s07_story', 0.222))
  /* the dot chart arrives labelled and empty with the board: a chart waiting to
     fill reads as intentional, a missing panel reads as broken */
  .from('#sc07 .s7dcard', { opacity: 0, x: 26, duration: 0.75, ease: 'power2.out' }, atf('s07_story', 0.24));
countUp('#s7stats .stat .v[data-count]', atf('s07_story', 0.30), 1.5);
/* the value arc fills segment by segment, red end toward the average */
tl.from('#s7gauge .arcfill', { opacity: 0, duration: 0.3, stagger: 0.022, ease: 'none' }, atf('s07_story', 0.585))
  .from('#s7gauge .arcw', { opacity: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(1.8)' }, atf('s07_story', 0.655))
  .from('#sc07 .gauge-cap', { opacity: 0, y: 10, duration: 0.5 }, atf('s07_story', 0.665))
  /* the dot panel arrives labelled and empty on "where judgements sit", then the
     102 lessons fly in, one dot each (offsets are seeded, never Math.random) */
  .from('#s7dots .dsdot', { opacity: 0, scale: 0.35, duration: 0.55, ease: 'back.out(1.35)',
    x: function (i, el) { return +el.dataset.fx; }, y: function (i, el) { return +el.dataset.fy; },
    stagger: { each: 0.009 } }, atf('s07_story', 0.625))
  .from('#s7rail .s7beat:nth-child(1)', { opacity: 0, x: -14, duration: 0.5 }, atf('s07_story', 0.722))
  .from('#s7rail .s7beat:nth-child(2)', { opacity: 0, x: -14, duration: 0.5 }, atf('s07_story', 0.762))
  .from('#s7rail .subtle', { opacity: 0, duration: 0.6 }, atf('s07_story', 0.79))
  /* "and Present mode takes it full screen" */
  .from('#s7present', { opacity: 0, scale: 0.88, duration: 0.6, ease: 'back.out(1.7)' }, atf('s07_story', 0.83));
