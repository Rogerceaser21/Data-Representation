/* 6 . one tap, filed four ways
   "four ways at once" fans all four connectors and lands the four empty card
   slots together; each destination then fills on the words that name it. */
tl.from('#sc06 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s06_pipeline', -0.45))
  .from('#s6node', { opacity: 0, scale: 0.94, duration: 0.8, ease: 'power2.out' }, at('s06_pipeline', -0.15))
  .from('#sc06 .s6card', { opacity: 0, scaleY: 0.7, duration: 0.55, stagger: 0.09, ease: 'power2.out' }, at('s06_pipeline', 1.2));

/* the fan itself: line-draw, one connector per destination */
document.querySelectorAll('#sc06 .s6p').forEach(function (p, i) {
  tl.fromTo(p, { strokeDashoffset: 460 },
    { strokeDashoffset: 0, duration: 0.62, ease: 'power2.inOut', immediateRender: false },
    at('s06_pipeline', 1.2) + i * 0.09);
});

/* each card fills on the words that name it */
tl.from('#s6in1', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.205))
  .from('#s6in1 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.215))
  .from('#s6in2', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.335))
  .from('#s6in2 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.345))
  .from('#s6in3', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.45))
  .from('#s6in3 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.46))
  .from('#s6in4', { opacity: 0, x: 18, duration: 0.6, ease: 'power2.out' }, atf('s06_pipeline', 0.65))
  .from('#s6in4 .s6ic', { scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, atf('s06_pipeline', 0.66));

/* "if any step fails, it retries quietly": one connector goes amber, the chip
   swaps in place, then both settle back. Resting state is the settled one. */
tl.fromTo('#s6p3', { stroke: 'rgba(60,187,108,0.52)' },
    { stroke: '#FFBA14', duration: 0.28, ease: 'power2.out', immediateRender: false }, atf('s06_pipeline', 0.775))
  .fromTo('#s6tag3', { opacity: 1 },
    { opacity: 0, duration: 0.24, ease: 'power1.in', immediateRender: false }, atf('s06_pipeline', 0.78))
  .fromTo('#s6warn', { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', immediateRender: false }, atf('s06_pipeline', 0.785))
  .fromTo('#s6p3', { stroke: '#FFBA14' },
    { stroke: 'rgba(60,187,108,0.52)', duration: 0.5, ease: 'power2.inOut', immediateRender: false }, atf('s06_pipeline', 0.845))
  .fromTo('#s6warn', { opacity: 1, y: 0 },
    { opacity: 0, y: -5, duration: 0.3, ease: 'power1.in', immediateRender: false }, atf('s06_pipeline', 0.845))
  .fromTo('#s6tag3', { opacity: 0 },
    { opacity: 1, duration: 0.4, ease: 'power2.out', immediateRender: false }, atf('s06_pipeline', 0.855));

/* "Nobody in a school ever sees an error" */
tl.from('#s6note', { opacity: 0, y: 10, duration: 0.7, ease: 'power2.out' }, atf('s06_pipeline', 0.875));
