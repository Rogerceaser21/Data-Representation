/* 14 . trust
   One card per lock as the narrator names it, each with its shackle dropping
   shut; then the platform strip on "the tools a school already pays for". */
tl.from('#sc14 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s14_trust', -0.45))
  .from('#s14c1', { opacity: 0, y: 22, duration: 0.75, ease: 'power2.out' }, at('s14_trust', 0.85))
  .from('#s14c1 .s14shk', { y: -3.4, opacity: 0.3, duration: 0.45, ease: 'back.out(2.2)' }, at('s14_trust', 1.15))
  .from('#s14c2', { opacity: 0, y: 22, duration: 0.75, ease: 'power2.out' }, atf('s14_trust', 0.135))
  .from('#s14c2 .s14shk', { y: -3.4, opacity: 0.3, duration: 0.45, ease: 'back.out(2.2)' }, atf('s14_trust', 0.158))
  .from('#s14c3', { opacity: 0, y: 22, duration: 0.75, ease: 'power2.out' }, atf('s14_trust', 0.27))
  .from('#s14c3 .s14shk', { y: -3.4, opacity: 0.3, duration: 0.45, ease: 'back.out(2.2)' }, atf('s14_trust', 0.293));

/* "runs on the tools a school already pays for" */
tl.from('#s14strip', { opacity: 0, y: 16, duration: 0.75, ease: 'power2.out' }, atf('s14_trust', 0.50))
  .from('#sc14 .s14chips span', { opacity: 0, y: 12, duration: 0.55, stagger: 0.22, ease: 'power2.out' }, atf('s14_trust', 0.595))
  .from('#s14line', { opacity: 0, y: 12, duration: 0.7, ease: 'power2.out' }, atf('s14_trust', 0.715))
  .from('#s14sub', { opacity: 0, duration: 0.7 }, atf('s14_trust', 0.85));
