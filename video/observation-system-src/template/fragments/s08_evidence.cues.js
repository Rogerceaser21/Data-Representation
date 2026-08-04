/* 8 . references behind every statement. Fractions are word share through the
   v2.3 line (60 words). The counter is gone; the citation strip replaces it. */
tl.from('#sc08 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s08_evidence', -0.4))
  .from('#s8claim', { opacity: 0, y: 20, duration: 0.8, ease: 'power2.out' }, at('s08_evidence', 0.0))
  /* "a citation, a reference stemming from an actual observation" */
  .from('#s8claim .refmk', { opacity: 0, scale: 0.4, duration: 0.5, stagger: 0.13, ease: 'back.out(2)' }, atf('s08_evidence', 0.117))
  /* "Click or tap": the ripple fires 0.15s ahead of the ring, so the drawer is
     visibly opened by something. Same recipe as #s5ripple, rests invisible. */
  .fromTo('#s8mk .taprip', { scale: 0, opacity: 0.6 },
    { scale: 14, opacity: 0, duration: 0.6, ease: 'power2.out', immediateRender: false }, atf('s08_evidence', 0.267) - 0.15)
  /* the sources drawer pushes in from the right */
  .fromTo('#s8panel', { xPercent: 104 }, { xPercent: 0, duration: 0.95, ease: 'power3.out' }, atf('s08_evidence', 0.30))
  .from('#s8panel .refmethod', { opacity: 0, duration: 0.5 }, atf('s08_evidence', 0.34))
  /* "see the actual observations behind each statement" */
  .from('#s8panel .refcard', { opacity: 0, y: 18, duration: 0.7, stagger: 0.34 }, atf('s08_evidence', 0.400));
spotlight('#s8mk', atf('s08_evidence', 0.267), 2.0);                      // "Click or tap to open the references"

/* "subject, date, judgement" then "the inspector's words, verbatim": cheap colour
   lifts, no second ring in a scene that already owns one. Literal hexes are this
   scene's own light theme tokens: --ink-mid #586479 and --ink-faint's sibling
   --ink-dim #3a4a66, lifting to --ink #14233f, then released to rest. */
tl.fromTo('#s8panel .refmeta', { color: '#586479' },
    { color: '#14233f', duration: 0.4, ease: 'power2.out', immediateRender: false }, atf('s08_evidence', 0.517))
  .to('#s8panel .refmeta', { color: '#586479', duration: 0.6, ease: 'power2.inOut' }, atf('s08_evidence', 0.517) + 0.9)
  .fromTo('#s8panel .refq', { color: '#3a4a66' },
    { color: '#14233f', duration: 0.4, ease: 'power2.out', immediateRender: false }, atf('s08_evidence', 0.583))
  .to('#s8panel .refq', { color: '#3a4a66', duration: 0.6, ease: 'power2.inOut' }, atf('s08_evidence', 0.583) + 0.9);

/* "AI cites the hundreds of references": the strip fans in chip by chip, the two
   ruled ghosts last (26 items at 0.035 = 0.91s of stagger, inside the line) */
tl.from('#s8cites .s8citecap', { opacity: 0, y: 10, duration: 0.5 }, atf('s08_evidence', 0.650))
  .from('#s8cites .s8citegrid > *', { opacity: 0, scale: 0.4, duration: 0.45, ease: 'back.out(1.6)',
    stagger: { each: 0.035, from: 'start' } }, atf('s08_evidence', 0.660))
  .from('#s8cites .subtle', { opacity: 0, duration: 0.5 }, atf('s08_evidence', 0.760))
  /* "Nothing on this dashboard is an opinion without evidence" */
  .from('#s8note', { opacity: 0, duration: 0.7 }, atf('s08_evidence', 0.850));
