/* 1 . the journey spine (cover, bound to the APPROVED v2.4 narration)
   "Every school should observe lessons. Very few can show what happens next.
    This is the Observation System: one route from lesson observation, to
    collected evidence, to a coaching plan for every teacher, covering every
    step of the learning journey."                              (39 words)

   v2.4 changes: the sentence "Here is the whole journey" is GONE, so the
   zoom-out beat and the #jtext line that carried it are cut. The scene now
   ends on the three lit nodes and the bed of light under them, which is the
   exact frame t1 opens on.

   Cue times are word share through that text (words before the phrase / 39),
   per knowledge/motion-rules.md section 2:
     0.3077  "This is the Observation System"   the name lands    (12/39)
     0.4359  "one route from"                   the spine draws   (17/39)
     0.5128  "lesson observation"               node 1 lights     (20/39)
     0.5897  "collected evidence"               node 2            (23/39)
     0.6667  "a coaching plan"                  node 3            (26/39)
     0.8205  "covering every step"              the route settles (32/39)

   Freeze-safe: every entrance is .from(), so the authored DOM (route drawn,
   all three nodes lit, title readable, pulses spent) IS the final frame. */

/* the whole route parallax bed: slow, linear, no Math.random anywhere (the
   star field is the seeded LCG string shared with the end card) */
tl.to('#coverStars', { y: -28, duration: NARR.s01_cover.dur + 2, ease: 'none' }, 0);

/* 1 . title settles, house stripe wipes open (absolute, tied to the first words) */
tl.from('#jtitle', { opacity: 0, y: 26, duration: 1.1, ease: 'power3.out' }, at('s01_cover', -0.2))
  .from('#jstripe', { scaleX: 0, opacity: 0, duration: 0.9, ease: 'power2.out' }, at('s01_cover', 0.7));

/* 2 . the name lands: cheap emphasis, the gold word glows and releases.
   No ring on the cover. Resting text-shadow is the CSS one, restored by the
   second tween, so a freeze anywhere reads as the authored title. */
tl.fromTo('#jtitle em', { textShadow: '0 0 38px rgba(240,176,42,0.40)' },
    { textShadow: '0 0 64px rgba(240,176,42,0.85)', duration: 0.5, ease: 'power2.out', immediateRender: false }, atf('s01_cover', 0.3077))
  .to('#jtitle em', { textShadow: '0 0 38px rgba(240,176,42,0.40)', duration: 0.8, ease: 'power2.inOut' }, atf('s01_cover', 0.3077) + 0.5);

/* the faint track appears just before the route is spoken */
tl.from('#sc01 .jtrack', { opacity: 0, duration: 0.8, ease: 'power2.out' }, atf('s01_cover', 0.397));

/* 3 . the spine draws itself, left to right, at constant speed, so "the line
       reaches a node" and "the node lights" are the same instant BY
       CONSTRUCTION: node x is 250 + f * 1420, so f fixes when each node is
       reached. Under the geometry law (nodes at 25 / 50 / 75 %) the window
       solved from node 1 ("lesson observation", 0.5128) and node 3 ("a
       coaching plan", 0.6667) starts at 0.4359, which is exactly "one route
       from", and node 2 is reached at 0.5897, which is exactly "collected
       evidence". Three phrases, three nodes, no fudge factor left.
       dasharray 1420 = the line's own length. This is the FIRST tween on
       strokeDashoffset, so it keeps GSAP's default immediateRender:true and
       the line is undrawn from frame 0. With immediateRender:false the CSS
       resting value (dashoffset 0) leaks through and the whole route sits
       finished, then snaps blank and redraws. Verified on the render. */
var S1_DRAW0 = atf('s01_cover', 0.4359);                 // "one route from"
var S1_DRAWD = atf('s01_cover', 0.7436) - S1_DRAW0;      // ends past "coaching plan"
var S1_NODEF = [0.25, 0.50, 0.75];                       // the geometry law itself

tl.from('#jcapA', { opacity: 0, scale: 0.4, duration: 0.5, ease: 'back.out(2)' }, S1_DRAW0 - 0.25)
  .fromTo('#jspine', { strokeDashoffset: 1420 },
    { strokeDashoffset: 0, duration: S1_DRAWD, ease: 'none' }, S1_DRAW0)
  .from('#jcapB', { opacity: 0, scale: 0.4, duration: 0.6, ease: 'back.out(2)' }, S1_DRAW0 + S1_DRAWD - 0.15);

/* the leading edge: a gold dot rides the draw, then hands over to the end cap */
tl.fromTo('#jtrav', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, S1_DRAW0)
  .fromTo('#jtrav', { x: 0 }, { x: 1420, duration: S1_DRAWD, ease: 'none', immediateRender: false }, S1_DRAW0)
  .fromTo('#jtrav', { opacity: 1 }, { opacity: 0, duration: 0.55, ease: 'power2.in', immediateRender: false }, S1_DRAW0 + S1_DRAWD - 0.55);

/* 4 . the three milestones, each on the instant the line arrives, which is the
       instant its station is named. Durations are fixed (motion rules 2). */
['#jn1', '#jn2', '#jn3'].forEach(function (n, i) {
  var t = S1_DRAW0 + S1_NODEF[i] * S1_DRAWD;
  tl.from(n + ' .jring', { opacity: 0, scale: 0.42, duration: 0.72, ease: 'back.out(1.7)' }, t - 0.12)
    .fromTo(n + ' .jpulse', { scale: 0.66, opacity: 0.85 },
      { scale: 2.25, opacity: 0, duration: 1.25, ease: 'power2.out', immediateRender: false }, t)
    .from(n + ' .jlab', { opacity: 0, y: 12, duration: 0.65, ease: 'power2.out' }, t + 0.22);
});

/* 5 . "covering every step of the learning journey": the route settles into
       its finished state, the spine comes up to full gold and the bed of
       light rises under the whole line. NO zoom out: the v2.3 pull-back
       belonged to "Here is the whole journey", which v2.4 cut, and t1 opens
       on this exact frame, so the spine must not move. */
tl.from('#jspine', { stroke: 'rgba(240,176,42,0.5)', duration: 2.2, ease: 'power2.out' }, atf('s01_cover', 0.8205))
  .from('#jglow', { opacity: 0, scale: 0.86, duration: 2.0, ease: 'power2.out' }, atf('s01_cover', 0.8205));
