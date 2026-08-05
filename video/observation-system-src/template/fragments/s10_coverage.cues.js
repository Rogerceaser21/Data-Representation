/* 10 . coverage (short scene: four tiles and the ring, nothing else)
   Fractions recomputed on the v2.4 line (36 words): 0.278 "who has been seen?"
   (the tiles land on the question, then count through the list that answers it) .
   0.389 "Teachers on the register" . 0.528 "teachers observed" . 0.583 "lessons
   per teacher" (the ring) . 0.639 "and who is still waiting" . 0.806 "no one is
   invisible for a term". */
tl.from('#sc10 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s10_coverage', -0.4))
  .from('#s10stats .stat', { opacity: 0, y: 22, duration: 0.65, stagger: 0.15, ease: 'power2.out' }, atf('s10_coverage', 0.278));
countUp('#s10stats .stat .v[data-count]', atf('s10_coverage', 0.306), 1.2);
/* the ring: DEFAULT immediateRender (true) on purpose, so the empty ring (offset
   289.03) is stamped at frame 0 and the arc draws on the beat. With
   immediateRender:false the markup's resting 85.35 won until the beat, so the ring
   was visibly already at 70% through the panel's fade-in, then snapped empty and
   redrew (measured in Chrome: arcOffset 85.35 with the panel at opacity 1, 0.03s
   before the draw). The 70% resting value stays the tween's END state. */
tl.from('#s10row .panel', { opacity: 0, y: 18, duration: 0.7, stagger: 0.14, ease: 'power2.out' }, atf('s10_coverage', 0.528))
  .fromTo('#s10arc', { attr: { 'stroke-dashoffset': 289.03 } },
    { attr: { 'stroke-dashoffset': 85.35 }, duration: 1.3, ease: 'power2.out' }, atf('s10_coverage', 0.583));
countUp('#s10ring .pct span[data-count]', atf('s10_coverage', 0.583), 1.3);
/* "and who is still waiting" */
tl.from('#s10names span', { opacity: 0, x: -12, duration: 0.4, stagger: 0.055 }, atf('s10_coverage', 0.639))
  .from('#s10more', { opacity: 0, duration: 0.5 }, atf('s10_coverage', 0.750))
  /* "so no one is invisible for a term": the note IS that phrase */
  .from('#s10note', { opacity: 0, duration: 0.6 }, atf('s10_coverage', 0.806));
