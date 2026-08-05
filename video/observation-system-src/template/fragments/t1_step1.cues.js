/* T1 . step one transition
   "Step one. The teachers are observed by their coach."          (9 words)
     0.0000  "Step one."                    the chip lands        (0/9)
     0.2222  "The teachers are observed"    node 1 detaches       (2/9)

   THE PATTERN (t1 / t2 / t3 are the same machine, only the hero changes):
     the map (#tXmap) opens at the cover's exact transform, identity, then
     recedes: scale .78 and y +260 about its own 50% 56% origin, which parks
     the whole spine as a dim strip at y 847 .. 990, clear of the big label
     (bottom 744) and clear of the chip (bottom 286).
     the hero (#tXhero) sits in its own layer at its spine x, so it flies with
     x = 960 - node x  ->  t1 +355 | t2 0 | t3 -355,  y = 470 - 640 = -170,
     scale 2.2 about the ring centre (transform-origin 50% 58px), landing the
     icon at (960, 470) with its label under it at 655 .. 744.
     Both are fromTo with immediateRender:false, so the CSS resting state (the
     cover's geometry) is what shows before the beat, and GSAP holds the end
     state for the rest of the scene. Deterministic under seek in both
     directions: nothing else touches these transforms.
     The flight and the arrival ring are budgeted from the time this take
     actually leaves between the detach and the end of the line, never from an
     inherited constant, so a short read (t3 is five words) still lands the
     node AND spends its ring before the cut. Motion rules want fixed
     durations; the cap is the fixed one, the budget only ever shortens it.

   t1 takes a hard match cut from the cover: same spine, same pixels, so there
   is NO entrance fade here on purpose. t2 and t3 cut in from a light
   dashboard scene and do fade their stage in. */

var T1_GO = atf('t1_step1', 0.2222);                          // "The teachers are observed"
var T1_TAIL = at('t1_step1', NARR.t1_step1.dur - 0.2);        // last frame still on this scene
var T1_D = Math.min(1.35, Math.max(0.6, (T1_TAIL - T1_GO) * 0.62));        // flight
var T1_P = Math.min(0.9, Math.max(0.35, T1_TAIL - T1_GO - T1_D));         // arrival ring

tl.to('#t1stars', { y: -14, duration: NARR.t1_step1.dur + 2, ease: 'none' }, at('t1_step1', -0.55));

/* the chip, on "Step one" */
tl.from('#t1chip', { opacity: 0, y: -14, duration: 0.6, ease: 'power2.out' }, atf('t1_step1', 0.0));

/* the detach, the flight, the growth */
tl.fromTo('#t1hero', { x: 0, y: 0, scale: 1 },
    { x: 355, y: -170, scale: 2.2, duration: T1_D, ease: 'power3.inOut', immediateRender: false }, T1_GO)
  .fromTo('#t1map', { y: 0, scale: 1, opacity: 1 },
    { y: 260, scale: 0.78, opacity: 0.26, duration: T1_D + 0.15, ease: 'power2.inOut', immediateRender: false }, T1_GO);

/* one ring on the way off the line, one on arrival. Both spend to opacity 0,
   which is the CSS resting state of .jpulse, so a freeze is never mid ring. */
tl.fromTo('#t1hero .jpulse', { scale: 0.66, opacity: 0.85 },
    { scale: 1.25, opacity: 0, duration: Math.min(0.7, T1_D * 0.55), ease: 'power2.out', immediateRender: false }, T1_GO)
  .fromTo('#t1hero .jpulse', { scale: 0.72, opacity: 0.7 },
    { scale: 1.4, opacity: 0, duration: T1_P, ease: 'power2.out', immediateRender: false }, T1_GO + T1_D - 0.1);
