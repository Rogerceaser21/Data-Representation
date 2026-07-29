/* 10 . coverage (short scene, 9.7s: four tiles and the ring, nothing else) */
tl.from('#sc10 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s10_coverage', -0.4))
  .from('#s10stats .stat', { opacity: 0, y: 22, duration: 0.65, stagger: 0.15, ease: 'power2.out' }, atf('s10_coverage', 0.28));
countUp('#s10stats .stat .v[data-count]', atf('s10_coverage', 0.30), 1.2);
tl.from('#s10row .panel', { opacity: 0, y: 18, duration: 0.7, stagger: 0.14, ease: 'power2.out' }, atf('s10_coverage', 0.52))
  .fromTo('#s10arc', { attr: { 'stroke-dashoffset': 289.03 } },
    { attr: { 'stroke-dashoffset': 85.35 }, duration: 1.3, ease: 'power2.out', immediateRender: false }, atf('s10_coverage', 0.58));
countUp('#s10ring .pct span[data-count]', atf('s10_coverage', 0.58), 1.3);
/* "and who is still waiting" */
tl.from('#s10names span', { opacity: 0, x: -12, duration: 0.4, stagger: 0.055 }, atf('s10_coverage', 0.66))
  .from('#s10more', { opacity: 0, duration: 0.5 }, atf('s10_coverage', 0.76))
  .from('#s10note', { opacity: 0, duration: 0.6 }, atf('s10_coverage', 0.84));
