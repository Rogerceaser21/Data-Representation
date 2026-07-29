/* 9 . movement between rounds */
tl.from('#sc09 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s09_movement', -0.4))
  .from('#s9tag', { opacity: 0, duration: 0.6 }, at('s09_movement', 0.3))
  .from('#s9slopecard', { opacity: 0, y: 20, duration: 0.8, ease: 'power2.out' }, at('s09_movement', 0.1));
/* each teacher's line draws left to right, exactly as renderSlope does it */
document.querySelectorAll('#s9slope .sl-line').forEach(function (p, i) {
  var L = p.getTotalLength();
  p.style.strokeDasharray = L;
  tl.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.85, ease: 'power2.out', immediateRender: false },
    atf('s09_movement', 0.155) + i * 0.075);
});
tl.from('#s9slope .sl-end', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.028, ease: 'back.out(2)' }, atf('s09_movement', 0.20))
  .from('#s9mxcard', { opacity: 0, y: 20, duration: 0.7, ease: 'power2.out' }, atf('s09_movement', 0.485))
  .from('#s9mx .mc', { scale: 0.9, opacity: 0, duration: 0.45, ease: 'back.out(1.5)', stagger: 0.006 }, atf('s09_movement', 0.52))
  .from('#s9chips .mchip', { opacity: 0, y: 14, duration: 0.5, stagger: 0.2 }, atf('s09_movement', 0.655))
  .from('#s9chips .subtle', { opacity: 0, duration: 0.5 }, atf('s09_movement', 0.73))
  .from('#s9note', { opacity: 0, duration: 0.7 }, atf('s09_movement', 0.78));
spotlight('#s9mxcard', atf('s09_movement', 0.57), 2.2);                   // "a transition matrix counts the improvements"
