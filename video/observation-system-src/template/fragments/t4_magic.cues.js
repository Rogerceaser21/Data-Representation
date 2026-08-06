/* T4 . the magic transition (non spine; geometry lives in t4_magic.css)
   "This is where the real magic happens. With the help of AI."        (12 words)

   WORD SHARE, computed not eyeballed. This is a TWO sentence line, so the full
   stop after "happens" gets its own slice of the span (T4_MAGIC_GAP) before the
   second sentence starts. Without that slice every word after the break lands
   early, and the two beats that matter here are both in the second sentence.
   With the gap budgeted at 7.5% of the line, one word is 0.0771 of it:

     w1   "This"        0.000    the well opens, the citations start falling
     w6   "magic"       0.385    the core takes the pulse
     w7   "happens"     0.463
     w8   "With"        0.615    the core inhales
     w12  "AI."         0.923    the core bursts into the wash

   The burst is BUDGETED from what the line actually leaves after that last word
   (the t3_step3 idiom), never from a constant, so a shorter real take cannot
   leave the flare frozen half spent on the cut. */

var T4_MAGIC_GAP = 0.075;                                     /* the full stop, as a share of the line */
var T4_MAGIC_WS = (1 - T4_MAGIC_GAP) / 12;                    /* one word's share */
function t4word(n) { return atf('t4_magic', (n - 1) * T4_MAGIC_WS + (n > 7 ? T4_MAGIC_GAP : 0)); }

var T4_IN = t4word(1);                                        /* "This" */
var T4_HIT = t4word(6);                                       /* "magic" */
var T4_DRAW = t4word(8);                                      /* "With the help of" */
/* the flare has to PEAK on the word, not start on it (the s08 ripple fires
   ahead of the drawer for the same reason), so the burst opens a beat early. */
var T4_LEAD = 0.14;
var T4_GO = t4word(12) - T4_LEAD;                             /* "AI." */
var T4_STEP = 0.045;                                          /* per chip stagger, 14 chips = 0.59s of stream */
var T4_FLY = Math.max(0.85, T4_HIT - T4_IN - 0.15);           /* flight, so the last chip lands before the pulse spends */
var T4_HOLD = Math.max(0.35, T4_GO - T4_DRAW - 0.06);         /* the inhale, from what the second sentence gives */
var T4_TAIL = at('t4_magic', NARR.t4_magic.dur - 0.15);       /* last frame still credibly on this scene */
var T4_BURST = Math.min(0.62, Math.max(0.30, (T4_TAIL - T4_GO) * 0.98));
var T4_WASH = Math.min(0.32, Math.max(0.16, T4_BURST * 0.62));  /* the wash beats the ring to full and HOLDS */

/* the stage arrives before the first word, the way t1 / t2 / t3 do */
tl.from('#sct4 .mstage, #t4stars', { opacity: 0, duration: 0.5, ease: 'power1.out' }, at('t4_magic', -0.45));
tl.to('#t4stars', { y: -12, duration: NARR.t4_magic.dur + 1.4, ease: 'none' }, at('t4_magic', -0.45));

/* "This is where": the well opens */
tl.from('#t4well', { opacity: 0, scale: 1.28, duration: 0.85, ease: 'power2.out' }, T4_IN - 0.2);

/* the citations fall in. THREE tweens, one job each, staggered identically, so
   no two of them ever write the same property on the same chip at the same
   time: (1) fade up out at the edge, (2) fall to the core, (3) be absorbed.
   Start offsets are read from the precomputed data-mx / data-my attributes. */
tl.fromTo('#t4chips .mchip', { opacity: 0, scale: 0.72 },
    { opacity: 1, scale: 1, duration: 0.42, ease: 'power2.out', immediateRender: false,
      stagger: { each: T4_STEP, from: 'start' } }, T4_IN)
  .fromTo('#t4chips .mchip',
    { x: function (i, el) { return +el.dataset.mx; }, y: function (i, el) { return +el.dataset.my; } },
    { x: 0, y: 0, duration: T4_FLY, ease: 'power2.in', immediateRender: false,
      stagger: { each: T4_STEP, from: 'start' } }, T4_IN)
  .fromTo('#t4chips .mchip', { opacity: 1, scale: 1 },
    { opacity: 0, scale: 0.26, duration: 0.34, ease: 'power2.in', immediateRender: false,
      stagger: { each: T4_STEP, from: 'start' } }, T4_IN + T4_FLY - 0.22);

/* the core is fed by the stream for exactly as long as chips are arriving.
   .from(), so the CSS rests on the FED core and the growth is the entrance. */
tl.from('#t4core', { scale: 0.34, opacity: 0.45, duration: T4_HIT - T4_IN, ease: 'power2.inOut' }, T4_IN);

/* "magic": the core pulses. The yoyo returns to scale 1, which IS the end of
   the growth above, so the two tweens hand over cleanly and neither overlaps. */
tl.fromTo('#t4core', { scale: 1 },
    { scale: 1.17, duration: 0.20, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, T4_HIT)
  .fromTo('#t4pulse', { scale: 0.5, opacity: 0.92 },
    { scale: 1.55, opacity: 0, duration: 0.8, ease: 'power2.out', immediateRender: false }, T4_HIT)
  .fromTo('#t4well', { scale: 1 },
    { scale: 1.07, duration: 0.42, yoyo: true, repeat: 1, ease: 'power2.inOut', immediateRender: false }, T4_HIT);

/* "With the help of": the well contracts and the core draws in on itself, so the
   burst has something to burst OUT of. Ends where the burst begins (scale .76). */
tl.fromTo('#t4core', { scale: 1 },
    { scale: 0.76, duration: T4_HOLD, ease: 'power2.in', immediateRender: false }, T4_DRAW)
  .fromTo('#t4well', { scale: 1 },
    { scale: 0.88, duration: T4_HOLD, ease: 'power2.in', immediateRender: false }, T4_DRAW);

/* "AI.": the core flares open and the wash takes the frame. The wash ends at
   full and HOLDS there, so the last frame of the scene is the wash the next
   scene cuts from; the clip window is what removes it, not a tween. */
tl.fromTo('#t4core', { scale: 0.76, opacity: 1 },
    { scale: 6.4, opacity: 0, duration: T4_BURST, ease: 'power3.out', immediateRender: false }, T4_GO)
  .fromTo('#t4burst', { scale: 0.3, opacity: 1 },
    { scale: 3.8, opacity: 0, duration: T4_BURST, ease: 'power3.out', immediateRender: false }, T4_GO)
  .fromTo('#t4well', { scale: 0.88, opacity: 1 },
    { scale: 2.2, opacity: 0, duration: T4_BURST, ease: 'power3.out', immediateRender: false }, T4_GO)
  /* the wash goes bright FAST and then rests bright: a warm wash held at half
     opacity over the navy is a muddy grey, so it must not linger there. */
  .fromTo('#t4wash', { opacity: 0 },
    { opacity: 0.97, duration: T4_WASH, ease: 'power2.out', immediateRender: false }, T4_GO + 0.04);
