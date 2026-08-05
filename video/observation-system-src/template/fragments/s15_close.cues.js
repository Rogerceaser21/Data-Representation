/* 15 . close, as the LOOP (APPROVED v2.4 narration)
   "From a lesson observed, to evidence, to a coaching plan in the teacher's
    hand. And when the next round begins, the journey starts again: observe,
    evidence, coach. Better never stops."                       (30 words)

   Word share through that text (words before the phrase / 30):
     0.0667  "lesson observed"          node 1 relights            (2/30)
     0.1667  "evidence"                 node 2                     (5/30)
     0.2667  "coaching plan"            node 3                     (8/30)
     0.4667  "And when the next round begins"  light runs the line (14/30)
     0.6667  "the journey starts again"  the return path draws     (20/30)
     0.8000  "observe,"                 node 1 pulses             (24/30)
     0.8333  "evidence,"                node 2 pulses             (25/30)
     0.8667  "coach."                   node 3 pulses             (26/30)
     0.9000  "Better"                   word 1 materialises       (27/30)
     0.9333  "never"                    word 2                    (28/30)
     0.9667  "stops."                   word 3                    (29/30)

   The end card that follows is silent and unchanged: it echoes the same three
   words, so the payoff has to be settled INSIDE this scene, on the phrase.

   Freeze-safe: the resting DOM is the closed loop with all three nodes lit and
   the payoff readable, and every beat here is a .from() or a fromTo() that
   keeps immediateRender true, so nothing leaks a finished state early. */

tl.to('#s15stars', { y: -20, duration: NARR.s15_close.dur + 2, ease: 'none' }, at('s15_close', -0.55));

/* 1 . the pull back: the whole map comes back into view, symmetric and whole */
tl.from('#s15route', { opacity: 0, scale: 1.12, y: 24, duration: 1.6, ease: 'power2.out' }, at('s15_close', -0.55));

/* 2 . "From a lesson observed, to evidence, to a coaching plan": the three
       stations relight in the order the sentence names them. */
[['#s15n1', 0.0667], ['#s15n2', 0.1667], ['#s15n3', 0.2667]].forEach(function (p) {
  var t = atf('s15_close', p[1]);
  tl.from(p[0] + ' .jring', { opacity: 0, scale: 0.46, duration: 0.66, ease: 'back.out(1.7)' }, t - 0.1)
    .fromTo(p[0] + ' .jpulse', { scale: 0.66, opacity: 0.8 },
      { scale: 2.1, opacity: 0, duration: 1.1, ease: 'power2.out', immediateRender: false }, t)
    .from(p[0] + ' .jlab', { opacity: 0, y: 10, duration: 0.6, ease: 'power2.out' }, t + 0.18);
});

/* 3 . "And when the next round begins": light runs the line once, forward,
       the same travelling dot the cover drew with, then hands over. */
var S15_RUN = atf('s15_close', 0.4667);
tl.fromTo('#s15trav', { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out', immediateRender: false }, S15_RUN)
  .fromTo('#s15trav', { x: 0 }, { x: 1420, duration: 1.5, ease: 'power1.inOut', immediateRender: false }, S15_RUN)
  .fromTo('#s15trav', { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power2.in', immediateRender: false }, S15_RUN + 1.0);

/* 4 . "the journey starts again": the return path draws itself from the
       Coaching Plan node back to the Observe node and the loop is closed.
       dasharray 2320 is the path's measured length (2318, rounded up). This is
       the ONLY tween on this dashoffset, so it keeps GSAP's default
       immediateRender:true: the path is undrawn from frame 0 and the CSS
       resting value (0, closed) never leaks in before the beat. */
var S15_LOOP = atf('s15_close', 0.6667);
tl.fromTo('#s15loop', { strokeDashoffset: 2320 },
    { strokeDashoffset: 0, duration: 1.6, ease: 'power1.inOut' }, S15_LOOP)
  .from('#s15arrow', { opacity: 0, duration: 0.45, ease: 'power2.out' }, S15_LOOP + 1.45);

/* 5 . "observe, evidence, coach": the three stations answer in order. Second
       use of each .jpulse, which is fine: both tweens end on opacity 0, the
       element's own CSS resting state. */
[['#s15n1', 0.80], ['#s15n2', 0.8333], ['#s15n3', 0.8667]].forEach(function (p) {
  tl.fromTo(p[0] + ' .jpulse', { scale: 0.7, opacity: 0.85 },
      { scale: 2.0, opacity: 0, duration: 0.95, ease: 'power2.out', immediateRender: false }, atf('s15_close', p[1]))
    .fromTo(p[0] + ' .jring', { boxShadow: '0 0 38px rgba(240,176,42,.28), inset 0 0 24px rgba(240,176,42,.10)' },
      { boxShadow: '0 0 60px rgba(240,176,42,.55), inset 0 0 30px rgba(240,176,42,.20)',
        duration: 0.32, ease: 'power2.out', immediateRender: false }, atf('s15_close', p[1]))
    .to(p[0] + ' .jring', { boxShadow: '0 0 38px rgba(240,176,42,.28), inset 0 0 24px rgba(240,176,42,.10)',
      duration: 0.6, ease: 'power2.inOut' }, atf('s15_close', p[1]) + 0.32);
});

/* 6 . "Better never stops.": one word per word, each materialising out of a
       soft blur as it is spoken. The end value of the filter is the CSS
       blur(0px) declared in s15_close.css, so there is no "none" to
       interpolate towards. */
[0.90, 0.9333, 0.9667].forEach(function (f, i) {
  tl.from('#s15bns .w' + (i + 1), { opacity: 0, y: 18, scale: 0.96, filter: 'blur(9px)',
    duration: 0.8, ease: 'power3.out' }, atf('s15_close', f));
});
