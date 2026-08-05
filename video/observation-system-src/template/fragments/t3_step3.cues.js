/* T3 . step three transition (the pattern is documented in t1_step1.cues.js)
   "Step three. The coaching plan."                               (5 words)
     0.0000  "Step three."          the chip lands                (0/5)
     0.4000  "The coaching plan."   node 3 detaches               (2/5)

   The shortest line in the take, which is exactly why the flight and the
   arrival ring are budgeted from what this line actually leaves after the
   detach instead of from a constant: at five words the 1.35s flight t1 and t2
   get would still be moving when the scene cuts, and the ring would freeze
   half spent (caught on the render, not on paper).
   Hero is the right node, so it flies left to the centre (x -355). */

var T3_GO = atf('t3_step3', 0.40);                             // "The coaching plan"
var T3_TAIL = at('t3_step3', NARR.t3_step3.dur - 0.2);         // last frame still on this scene
var T3_D = Math.min(1.35, Math.max(0.6, (T3_TAIL - T3_GO) * 0.62));        // flight
var T3_P = Math.min(0.9, Math.max(0.35, T3_TAIL - T3_GO - T3_D));         // arrival ring

tl.from('#sct3 .jstage, #t3stars', { opacity: 0, duration: 0.5, ease: 'power1.out' }, at('t3_step3', -0.55));
tl.to('#t3stars', { y: -14, duration: NARR.t3_step3.dur + 2, ease: 'none' }, at('t3_step3', -0.55));

/* the chip, on "Step three" */
tl.from('#t3chip', { opacity: 0, y: -14, duration: 0.6, ease: 'power2.out' }, atf('t3_step3', 0.0));

/* the detach, the flight, the growth */
tl.fromTo('#t3hero', { x: 0, y: 0, scale: 1 },
    { x: -355, y: -170, scale: 2.2, duration: T3_D, ease: 'power3.inOut', immediateRender: false }, T3_GO)
  .fromTo('#t3map', { y: 0, scale: 1, opacity: 1 },
    { y: 260, scale: 0.78, opacity: 0.26, duration: T3_D + 0.15, ease: 'power2.inOut', immediateRender: false }, T3_GO);

/* one ring off the line, one on arrival; both spend to the CSS resting 0 */
tl.fromTo('#t3hero .jpulse', { scale: 0.66, opacity: 0.85 },
    { scale: 1.25, opacity: 0, duration: Math.min(0.7, T3_D * 0.55), ease: 'power2.out', immediateRender: false }, T3_GO)
  .fromTo('#t3hero .jpulse', { scale: 0.72, opacity: 0.7 },
    { scale: 1.4, opacity: 0, duration: T3_P, ease: 'power2.out', immediateRender: false }, T3_GO + T3_D - 0.1);
