/* 9 . teacher progression between rounds
   Fractions recomputed on the v2.4 line (67 words): 0.119 "Every teacher seen in
   both rounds" . 0.239 "from one judgement point to the next" . 0.463 "green when
   they moved toward Outstanding" . 0.552 "A transition matrix" . 0.627 "the
   improvements, the holds and the declines" . 0.821 / 0.881 / 0.925 the three
   governor questions. */
tl.from('#sc09 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s09_movement', -0.4))
  .from('#s9tag', { opacity: 0, duration: 0.6 }, at('s09_movement', 0.3))
  .from('#s9slopecard', { opacity: 0, y: 20, duration: 0.8, ease: 'power2.out' }, at('s09_movement', 0.1));
/* each teacher's line draws left to right, exactly as renderSlope does it.
   "Every teacher seen in both rounds": 12 lines at 0.075 + a 0.85s draw = ~1.75s.
   DEFAULT immediateRender (true) on purpose: it stamps the undrawn from-state at
   frame 0, so the chart arrives EMPTY with its bands and axis labels and the lines
   draw on the words. With immediateRender:false the CSS resting value (dashoffset
   0) won until the beat, so all 12 lines sat fully drawn for the ~1.95s after the
   card faded in, then blanked one by one and redrew: measured in Chrome at
   at(0.1)+0.8 (card opacity 1, first line offset 0px). Same trap the s04 ink
   comment records. */
document.querySelectorAll('#s9slope .sl-line').forEach(function (p, i) {
  var L = p.getTotalLength();
  p.style.strokeDasharray = L;
  tl.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.85, ease: 'power2.out' },
    atf('s09_movement', 0.119) + i * 0.075);
});
/* "from one judgement point to the next": the two endpoints of every line */
tl.from('#s9slope .sl-end', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.028, ease: 'back.out(2)' }, atf('s09_movement', 0.239))
  /* "green when they moved toward Outstanding": only the green lines lift, then
     release back to the resting .52 the CSS carries, so a freeze reads normal */
  .to('#s9slope .sl-line[stroke="var(--g)"]', { opacity: 0.85, duration: 0.45, ease: 'power2.out' }, atf('s09_movement', 0.463))
  .to('#s9slope .sl-line[stroke="var(--g)"]', { opacity: 0.52, duration: 0.6, ease: 'power2.inOut' }, atf('s09_movement', 0.463) + 1.6)
  .from('#s9mxcard', { opacity: 0, y: 20, duration: 0.7, ease: 'power2.out' }, atf('s09_movement', 0.552))
  .from('#s9mx .mc', { scale: 0.9, opacity: 0, duration: 0.45, ease: 'back.out(1.5)', stagger: 0.006 }, atf('s09_movement', 0.582))
  /* "the improvements, the holds and the declines" */
  .from('#s9chips .mchip', { opacity: 0, y: 14, duration: 0.5, stagger: 0.2 }, atf('s09_movement', 0.627))
  .from('#s9chips .subtle', { opacity: 0, duration: 0.5 }, atf('s09_movement', 0.690))
  /* the three questions governors actually ask, one chip per question */
  .from('#s9qs .pill-note:nth-child(1)', { opacity: 0, y: 10, duration: 0.5 }, atf('s09_movement', 0.821))
  .from('#s9qs .pill-note:nth-child(2)', { opacity: 0, y: 10, duration: 0.5 }, atf('s09_movement', 0.881))
  .from('#s9qs .pill-note:nth-child(3)', { opacity: 0, y: 10, duration: 0.5 }, atf('s09_movement', 0.925));
spotlight('#s9mxcard', atf('s09_movement', 0.567), 2.2);                   // "transition matrix"
