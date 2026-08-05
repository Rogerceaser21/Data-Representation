/* 2 . the form
   v2.4 line (58 words), every fraction recomputed from THIS text:
   "While the coaches are observing a lesson, they fill in the relevant
    observation form: subject, class and teacher, with live dropdowns fed by the
    school's own staff directory, so nothing is typed from memory and no list is
    ever out of date. Class composition is a few taps. The whole context of the
    lesson, captured throughout the observation."
   Word share: 0.121 "they fill in the relevant observation form" .
   0.310 "with live dropdowns" . 0.397 "the school's own staff directory" .
   0.500 "so nothing is typed from memory" . 0.724 "Class composition is a few
   taps" . 0.931 "captured throughout the observation". */
tl.from('#s2dev', { opacity: 0, y: 26, scale: 0.985, duration: 0.9, ease: 'power3.out' }, at('s02_form', -0.35))
  .from('#s2head', { opacity: 0, y: 12, duration: 0.7, ease: 'power2.out' }, at('s02_form', 0.35))
  /* "they fill in the relevant observation form": the context grid fills cell by cell */
  .from('#s2grid .info-cell', { opacity: 0, y: 14, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, atf('s02_form', 0.121));

/* "with live dropdowns fed by the school's own staff directory" */
tl.fromTo('#s2drop', { opacity: 0, scaleY: 0.82, y: -8 },
    { opacity: 1, scaleY: 1, y: 0, duration: 0.36, ease: 'power2.out', immediateRender: false }, atf('s02_form', 0.310))
  .from('#s2drop .option', { opacity: 0, x: -12, duration: 0.3, stagger: 0.07, ease: 'power2.out' }, atf('s02_form', 0.328))
  /* the name lands on the row: the product's green .selected state */
  .from('#s2sel', { backgroundColor: 'rgba(46,161,90,0)', color: '#143642', duration: 0.45, ease: 'power2.out' }, atf('s02_form', 0.397))
  .to('#s2drop', { opacity: 0, scaleY: 0.9, duration: 0.28, ease: 'power2.in' }, atf('s02_form', 0.466))
  .fromTo('#s2ph', { opacity: 1 }, { opacity: 0, duration: 0.22 }, atf('s02_form', 0.483))
  /* "so nothing is typed from memory": the picked name resting in the row */
  .from('#s2tname', { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out' }, atf('s02_form', 0.500));

/* "Class composition is a few taps": four pill groups fill green */
tl.from('#sc02 .pill.is-selected', {
    backgroundColor: 'rgba(46,161,90,0)', color: '#6b7e85', borderColor: 'rgba(20,54,66,0.14)',
    scale: 0.86, duration: 0.42, stagger: 0.16, ease: 'back.out(2)'
  }, atf('s02_form', 0.724))
  .from('#s2ill', { opacity: 0, duration: 0.6 }, atf('s02_form', 0.810))
  /* "captured throughout the observation": the closing phrase of the line */
  .from('#s2note', { opacity: 0, x: -14, duration: 0.7, ease: 'power2.out' }, atf('s02_form', 0.931));
