/* 8 . evidence behind every claim */
tl.from('#sc08 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s08_evidence', -0.4))
  .from('#s8claim', { opacity: 0, y: 20, duration: 0.8, ease: 'power2.out' }, at('s08_evidence', 0.0))
  .from('#s8claim .refmk', { opacity: 0, scale: 0.4, duration: 0.5, stagger: 0.13, ease: 'back.out(2)' }, atf('s08_evidence', 0.10))
  /* "open it" . the sources drawer pushes in from the right */
  .fromTo('#s8panel', { xPercent: 104 }, { xPercent: 0, duration: 0.95, ease: 'power3.out' }, atf('s08_evidence', 0.19))
  .from('#s8panel .refmethod', { opacity: 0, duration: 0.5 }, atf('s08_evidence', 0.26))
  .from('#s8panel .refcard', { opacity: 0, y: 18, duration: 0.7, stagger: 0.34 }, atf('s08_evidence', 0.29))
  .from('#s8count', { opacity: 0, y: 16, duration: 0.6 }, atf('s08_evidence', 0.60));
countUp('#s8count .big-n', atf('s08_evidence', 0.615), 1.5);
tl.from('#s8note', { opacity: 0, duration: 0.7 }, atf('s08_evidence', 0.82));
spotlight('#s8mk', atf('s08_evidence', 0.52), 2.2);                       // "the inspector's words, verbatim"
