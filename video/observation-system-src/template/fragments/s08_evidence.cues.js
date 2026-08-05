/* 8 . citations and references behind every statement.
   RETIMED for the v2.4 line (96 words, scenes.json s08_evidence). Every fraction
   below is (words spoken before the phrase) / 96, recomputed from the NEW text:
     0.000  "The report is generated using citations and references"
     0.156  "carries a small number"
     0.208  "a citation count, showing how many times that statement is cited"
     0.354  "Click or tap the number"
     0.417  "to open the citations"
     0.458  "and see the actual observations behind each statement"
     0.531  "subject, date, judgement"
     0.573  "and the inspector's words, verbatim"
     0.615  "AI cites the hundreds of references"
     0.740  "Nothing on this dashboard is an opinion without evidence"
     0.885  "presented to your regulatory body"
     0.958  "at the click of a button"
   The line now OPENS on the report being generated from citations, so the claim
   panel is the first thing on screen, and it CLOSES on the export control, which
   is the last beat of the scene and rests visible. */
tl.from('#sc08 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s08_evidence', -0.4))
  .from('#s8claim', { opacity: 0, y: 20, duration: 0.8, ease: 'power2.out' }, at('s08_evidence', 0.0))
  /* "carries a small number" */
  .from('#s8claim .refmk', { opacity: 0, scale: 0.4, duration: 0.5, stagger: 0.13, ease: 'back.out(2)' }, atf('s08_evidence', 0.156))
  /* "a citation count, showing how many times that statement is cited" */
  .from('#s8cnt', { opacity: 0, y: 8, duration: 0.55, ease: 'power2.out' }, atf('s08_evidence', 0.208))
  /* "Click or tap": the ripple fires 0.15s ahead of the ring, so the drawer is
     visibly opened by something. Same recipe as #s5ripple, rests invisible. */
  .fromTo('#s8mk .taprip', { scale: 0, opacity: 0.6 },
    { scale: 14, opacity: 0, duration: 0.6, ease: 'power2.out', immediateRender: false }, atf('s08_evidence', 0.354) - 0.15)
  /* "to open the citations": the sources drawer pushes in from the right */
  .fromTo('#s8panel', { xPercent: 104 }, { xPercent: 0, duration: 0.95, ease: 'power3.out' }, atf('s08_evidence', 0.417))
  .from('#s8panel .refmethod', { opacity: 0, duration: 0.5 }, atf('s08_evidence', 0.438))
  /* "see the actual observations behind each statement" */
  .from('#s8panel .refcard', { opacity: 0, y: 18, duration: 0.7, stagger: 0.34 }, atf('s08_evidence', 0.458));
spotlight('#s8mk', atf('s08_evidence', 0.354), 2.0);                      // "Click or tap the number"

/* "subject, date, judgement" then "the inspector's words, verbatim": cheap colour
   lifts, no second ring in a scene that already owns one. Literal hexes are this
   scene's own light theme tokens: --ink-mid #586479 and --ink-faint's sibling
   --ink-dim #3a4a66, lifting to --ink #14233f, then released to rest. */
tl.fromTo('#s8panel .refmeta', { color: '#586479' },
    { color: '#14233f', duration: 0.4, ease: 'power2.out', immediateRender: false }, atf('s08_evidence', 0.531))
  .to('#s8panel .refmeta', { color: '#586479', duration: 0.6, ease: 'power2.inOut' }, atf('s08_evidence', 0.531) + 0.9)
  .fromTo('#s8panel .refq', { color: '#3a4a66' },
    { color: '#14233f', duration: 0.4, ease: 'power2.out', immediateRender: false }, atf('s08_evidence', 0.573))
  .to('#s8panel .refq', { color: '#3a4a66', duration: 0.6, ease: 'power2.inOut' }, atf('s08_evidence', 0.573) + 0.9);

/* "AI cites the hundreds of references": the strip fans in chip by chip, the two
   ruled ghosts last (26 items at 0.035 = 0.91s of stagger, inside the line) */
tl.from('#s8cites .s8citecap', { opacity: 0, y: 10, duration: 0.5 }, atf('s08_evidence', 0.615))
  .from('#s8cites .s8citegrid > *', { opacity: 0, scale: 0.4, duration: 0.45, ease: 'back.out(1.6)',
    stagger: { each: 0.035, from: 'start' } }, atf('s08_evidence', 0.625))
  .from('#s8cites .subtle', { opacity: 0, duration: 0.5 }, atf('s08_evidence', 0.700))
  /* "Nothing on this dashboard is an opinion without evidence" */
  .from('#s8note', { opacity: 0, duration: 0.7 }, atf('s08_evidence', 0.740));

/* "and it can all be presented to your regulatory body at the click of a button":
   the report export control lands on "presented", then takes one press on the
   final words. The press overlay and the pulse both END on the resting state
   (opacity 0, scale 1), so the last frame of the scene is the button at rest. */
tl.from('#s8export', { opacity: 0, y: 12, duration: 0.6, ease: 'power3.out' }, atf('s08_evidence', 0.885))
  .fromTo('#s8press', { opacity: 0 },
    { opacity: 1, duration: 0.09, ease: 'none', immediateRender: false }, atf('s08_evidence', 0.958))
  .fromTo('#s8press', { opacity: 1 },
    { opacity: 0, duration: 0.36, ease: 'power2.out', immediateRender: false }, atf('s08_evidence', 0.958) + 0.14)
  .fromTo('#s8export', { scale: 1 },
    { scale: 1.05, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, atf('s08_evidence', 0.958));
