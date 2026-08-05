/* 13 . reports and regeneration
   RETIMED for the v2.4 line (64 words, scenes.json s13_report). Fractions are
   (words spoken before the phrase) / 64, recomputed from the NEW text:
     0.000  "For the leadership table,"
     0.063  "one button turns the round into a governance report"
     0.203  "simple or in depth."
     0.266  "One tap or click,"
     0.375  "and you have a PDF or a Google Doc"
     0.469  "all references attached"
     0.516  "teachers anonymised by construction"
     0.578  "When a new round lands"
     0.656  "one more button rewrites the analysis for it"
     0.875  "the Head of Teaching and Learning"
   The page's own chrome still assembles on absolute offsets (0.1 to 1.3s): that
   ladder sits inside the first clause either way, and it is the page drawing
   itself, not a beat. Visuals are unchanged from v2.3. */
      tl.from('#s13head', { opacity: 0, y: 16, duration: 0.7 }, at('s13_report', -0.4))
        .from('#s13page', { opacity: 0, y: 20, duration: 0.8, ease: 'power2.out' }, at('s13_report', 0.1))
        .from('#s13top', { opacity: 0, y: 12, duration: 0.6 }, at('s13_report', 0.5))
        .from('#s13tabs', { opacity: 0, y: 10, duration: 0.5 }, at('s13_report', 0.7))
        .from('#s13scope', { opacity: 0, y: 10, duration: 0.55 }, at('s13_report', 0.9))
        .from('#s13method', { opacity: 0, duration: 0.55 }, at('s13_report', 1.1))
        /* "one button turns the round into a governance report" (word share 0.063) */
        .from('#s13sec', { opacity: 0, y: 12, duration: 0.6 }, at('s13_report', 1.3))
        .from('#s13bl li', { opacity: 0, x: -10, duration: 0.45, stagger: 0.14 }, atf('s13_report', 0.125))
        .from('#sc13 .refmk', { opacity: 0, scale: 0.4, duration: 0.45, stagger: 0.1, ease: 'back.out(2)' }, atf('s13_report', 0.156))
        /* "simple or in depth": the second tab taps itself */
        .fromTo('#s13tabB', { scale: 1 }, { scale: 1.07, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, atf('s13_report', 0.203))
        /* "and you have a PDF or a Google Doc": the document the export builds */
        .from('#s13doc', { opacity: 0, scale: 0.94, y: 16, duration: 0.8, ease: 'power3.out' }, atf('s13_report', 0.375))
        .from('#s13d1, #s13d2, #s13d3, #s13d4, #s13d5', { opacity: 0, y: 10, duration: 0.5, stagger: 0.09 }, atf('s13_report', 0.410))
        /* "all references attached" */
        .fromTo('#s13sheen', { xPercent: -140 }, { xPercent: 140, duration: 1.1, ease: 'power1.inOut', immediateRender: false }, atf('s13_report', 0.469))
        /* "When a new round lands, one more button rewrites the analysis for it" */
        .from('#s13regen', { opacity: 0, y: 14, duration: 0.6 }, atf('s13_report', 0.578))
        .fromTo('#s13bar', { width: '0%' }, { width: '100%', duration: 2.0, ease: 'power1.inOut' }, atf('s13_report', 0.656))
        /* land the chip on the person, not on the bar finishing */
        .from('#s13chk', { opacity: 0, scale: 0.9, duration: 0.45, ease: 'back.out(1.7)' }, atf('s13_report', 0.875));
      spotlight('#s13export', atf('s13_report', 0.266), 2.0);                   // "One tap or click"
