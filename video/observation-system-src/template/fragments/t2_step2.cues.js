/* T2 . step two transition (the pattern is documented in t1_step1.cues.js)
   "Step two. Retrieving and viewing the collected evidence."     (8 words)
     0.0000  "Step two."                the chip lands            (0/8)
     0.2500  "Retrieving and viewing"   node 2 detaches           (2/8)

   Hero is the middle node, so the flight is a pure grow: x stays 0, y -170,
   scale 2.2. This scene cuts in from a light dashboard scene, so the stage
   fades in (t1 does not: it match cuts from the cover). */

var T2_GO = atf('t2_step2', 0.25);                             // "Retrieving and viewing"
var T2_TAIL = at('t2_step2', NARR.t2_step2.dur - 0.2);         // last frame still on this scene
var T2_D = Math.min(1.35, Math.max(0.6, (T2_TAIL - T2_GO) * 0.62));        // flight
var T2_P = Math.min(0.9, Math.max(0.35, T2_TAIL - T2_GO - T2_D));         // arrival ring

tl.from('#sct2 .jstage, #t2stars', { opacity: 0, duration: 0.5, ease: 'power1.out' }, at('t2_step2', -0.55));
tl.to('#t2stars', { y: -14, duration: NARR.t2_step2.dur + 2, ease: 'none' }, at('t2_step2', -0.55));

/* the chip, on "Step two" */
tl.from('#t2chip', { opacity: 0, y: -14, duration: 0.6, ease: 'power2.out' }, atf('t2_step2', 0.0));

/* the detach, the flight, the growth */
tl.fromTo('#t2hero', { x: 0, y: 0, scale: 1 },
    { x: 0, y: -170, scale: 2.2, duration: T2_D, ease: 'power3.inOut', immediateRender: false }, T2_GO)
  .fromTo('#t2map', { y: 0, scale: 1, opacity: 1 },
    { y: 260, scale: 0.78, opacity: 0.26, duration: T2_D + 0.15, ease: 'power2.inOut', immediateRender: false }, T2_GO);

/* one ring off the line, one on arrival; both spend to the CSS resting 0 */
tl.fromTo('#t2hero .jpulse', { scale: 0.66, opacity: 0.85 },
    { scale: 1.25, opacity: 0, duration: Math.min(0.7, T2_D * 0.55), ease: 'power2.out', immediateRender: false }, T2_GO)
  .fromTo('#t2hero .jpulse', { scale: 0.72, opacity: 0.7 },
    { scale: 1.4, opacity: 0, duration: T2_P, ease: 'power2.out', immediateRender: false }, T2_GO + T2_D - 0.1);
