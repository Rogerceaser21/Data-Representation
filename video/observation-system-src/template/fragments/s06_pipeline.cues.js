/* 6 . one tap, filed four ways
   "four ways at once" fans all four connectors and lands the four empty card
   slots together; each destination then fills on the words that name it.
   Fractions recomputed on the v2.4 line (72 words): 0.111 "The observation lands
   in a spreadsheet" . 0.194 "It mirrors into a live database" . 0.389 "an email
   is sent" . 0.444 "to the observer" . 0.667 "Even the form's Evidence Pad
   handwriting" . 0.875 "so everything can be fully reviewed if ever needed".
   The opening sentence is unchanged, so the fan stays absolute at 1.15s. */
tl.from('#sc06 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s06_pipeline', -0.45))
  .from('#s6node', { opacity: 0, scale: 0.94, duration: 0.8, ease: 'power2.out' }, at('s06_pipeline', -0.15))
  /* "four ways at once" = words 5-8 of 72, i.e. ~1.15s in: absolute, per the entrance rule */
  .from('#sc06 .s6card', { opacity: 0, scaleY: 0.7, duration: 0.55, stagger: 0.09, ease: 'power2.out' }, at('s06_pipeline', 1.15));

/* the fan itself: line-draw, one connector per destination.
   DEFAULT immediateRender (true) on purpose: it stamps the undrawn from-state at
   frame 0, so the connectors are BLANK for the 1.3s before the fan and draw on
   the beat. With immediateRender:false the CSS resting value (dashoffset 0) won
   until the beat, so all four connectors sat fully drawn from the scene's first
   frame, blanked at 1.15s and redrew: measured in Chrome at t=at(1.15)-0.2
   (dasharray 460, offset 0px). Same trap the s04 ink comment records. */
document.querySelectorAll('#sc06 .s6p').forEach(function (p, i) {
  tl.fromTo(p, { strokeDashoffset: 460 },
    { strokeDashoffset: 0, duration: 0.62, ease: 'power2.inOut' },
    at('s06_pipeline', 1.15) + i * 0.09);
});

/* each card fills on the words that name it */
tl.from('#s6in1', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.111))      // "The observation lands in a spreadsheet"
  .from('#s6in1 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.121))
  .from('#s6in2', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.194))      // "It mirrors into a live database"
  .from('#s6in2 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.204))
  .from('#s6in3', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.389))      // "an email is sent"
  .from('#s6in3 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.399))
  .from('#s6in4', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.667))      // "Even the form's Evidence Pad handwriting"
  .from('#s6in4 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.677));

/* "to the observer": the fact Igor keeps in the line gets the emphasis, and a
   chip pulse is enough here . four staggered cards already point, so no gold ring.
   yoyo returns the chip to its resting scale and the dot to its resting glow, so a
   freeze on either side of the beat reads the same. Literal rgba is --g (#3CBB6C)
   at the alphas the .s6dot rule carries. */
tl.fromTo('#s6tag3', { scale: 1 },
    { scale: 1.06, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false }, atf('s06_pipeline', 0.444))
  .fromTo('#s6tag3 .s6dot', { boxShadow: '0 0 0 3px rgba(60,187,108,.18)' },
    { boxShadow: '0 0 0 7px rgba(60,187,108,.34)', duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false }, atf('s06_pipeline', 0.444));

/* "so everything can be fully reviewed if ever needed" */
tl.from('#s6note', { opacity: 0, y: 10, duration: 0.7, ease: 'power2.out' }, atf('s06_pipeline', 0.875));
