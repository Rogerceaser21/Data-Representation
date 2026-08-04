/* 6 . one tap, filed four ways
   "four ways at once" fans all four connectors and lands the four empty card
   slots together; each destination then fills on the words that name it.
   Fractions are word share through the v2.3 line (62 words). */
tl.from('#sc06 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s06_pipeline', -0.45))
  .from('#s6node', { opacity: 0, scale: 0.94, duration: 0.8, ease: 'power2.out' }, at('s06_pipeline', -0.15))
  /* "four ways at once" = words 5-8 of 62, i.e. 1.15s in: absolute, per the entrance rule */
  .from('#sc06 .s6card', { opacity: 0, scaleY: 0.7, duration: 0.55, stagger: 0.09, ease: 'power2.out' }, at('s06_pipeline', 1.15));

/* the fan itself: line-draw, one connector per destination */
document.querySelectorAll('#sc06 .s6p').forEach(function (p, i) {
  tl.fromTo(p, { strokeDashoffset: 460 },
    { strokeDashoffset: 0, duration: 0.62, ease: 'power2.inOut', immediateRender: false },
    at('s06_pipeline', 1.15) + i * 0.09);
});

/* each card fills on the words that name it */
tl.from('#s6in1', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.129))      // "The observation lands in a spreadsheet"
  .from('#s6in1 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.139))
  .from('#s6in2', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.226))      // "It mirrors into a live database"
  .from('#s6in2 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.236))
  .from('#s6in3', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.387))      // "A branded backup email"
  .from('#s6in3 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.397))
  .from('#s6in4', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.726))      // "And the handwriting itself"
  .from('#s6in4 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.736));

/* "goes to the observer": the fact that changed in v2.3 gets the emphasis, and a
   chip pulse is enough here . four staggered cards already point, so no gold ring.
   yoyo returns the chip to its resting scale and the dot to its resting glow, so a
   freeze on either side of the beat reads the same. Literal rgba is --g (#3CBB6C)
   at the alphas the .s6dot rule carries. */
tl.fromTo('#s6tag3', { scale: 1 },
    { scale: 1.06, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false }, atf('s06_pipeline', 0.452))
  .fromTo('#s6tag3 .s6dot', { boxShadow: '0 0 0 3px rgba(60,187,108,.18)' },
    { boxShadow: '0 0 0 7px rgba(60,187,108,.34)', duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false }, atf('s06_pipeline', 0.452));

/* "so it can be reviewed if ever needed" */
tl.from('#s6note', { opacity: 0, y: 10, duration: 0.7, ease: 'power2.out' }, atf('s06_pipeline', 0.871));
