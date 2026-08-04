/* 9 . movement between rounds */
tl.from('#sc09 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s09_movement', -0.4))
  .from('#s9tag', { opacity: 0, duration: 0.6 }, at('s09_movement', 0.3))
  .from('#s9slopecard', { opacity: 0, y: 20, duration: 0.8, ease: 'power2.out' }, at('s09_movement', 0.1));
/* each teacher's line draws left to right, exactly as renderSlope does it.
   "Every teacher seen in both rounds": 12 lines at 0.075 + a 0.85s draw = ~1.75s */
document.querySelectorAll('#s9slope .sl-line').forEach(function (p, i) {
  var L = p.getTotalLength();
  p.style.strokeDasharray = L;
  tl.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.85, ease: 'power2.out', immediateRender: false },
    atf('s09_movement', 0.113) + i * 0.075);
});
tl.from('#s9slope .sl-end', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.028, ease: 'back.out(2)' }, atf('s09_movement', 0.20))
  /* "green when they moved toward Outstanding": only the green lines lift, then
     release back to the resting .52 the CSS carries, so a freeze reads normal */
  .to('#s9slope .sl-line[stroke="var(--g)"]', { opacity: 0.85, duration: 0.45, ease: 'power2.out' }, atf('s09_movement', 0.419))
  .to('#s9slope .sl-line[stroke="var(--g)"]', { opacity: 0.52, duration: 0.6, ease: 'power2.inOut' }, atf('s09_movement', 0.419) + 1.6)
  .from('#s9mxcard', { opacity: 0, y: 20, duration: 0.7, ease: 'power2.out' }, atf('s09_movement', 0.485))
  .from('#s9mx .mc', { scale: 0.9, opacity: 0, duration: 0.45, ease: 'back.out(1.5)', stagger: 0.006 }, atf('s09_movement', 0.52))
  /* "the improvements, the holds and the declines" */
  .from('#s9chips .mchip', { opacity: 0, y: 14, duration: 0.5, stagger: 0.2 }, atf('s09_movement', 0.597))
  .from('#s9chips .subtle', { opacity: 0, duration: 0.5 }, atf('s09_movement', 0.66))
  /* the three questions governors actually ask, one chip per question */
  .from('#s9qs .pill-note:nth-child(1)', { opacity: 0, y: 10, duration: 0.5 }, atf('s09_movement', 0.806))
  .from('#s9qs .pill-note:nth-child(2)', { opacity: 0, y: 10, duration: 0.5 }, atf('s09_movement', 0.871))
  .from('#s9qs .pill-note:nth-child(3)', { opacity: 0, y: 10, duration: 0.5 }, atf('s09_movement', 0.919));
spotlight('#s9mxcard', atf('s09_movement', 0.516), 2.2);                   // "A transition matrix"
