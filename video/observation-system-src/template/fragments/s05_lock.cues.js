/* 5 . saved
   v2.4 line (17 words): "When it is done, each observation gets its own ID.
   Everything is saved, and ready for review."

   The word "freezes" is GONE from the v2.4 line, so the snap that used to run on
   it now runs on "gets its own ID" (Igor's v2.4 wording: the record gets an
   identity, and that is what makes it un-editable). The card's locked state is
   still the resting state (see the CSS header), so the mid scene states are the
   DRAFT ones and the lock beats run into the authored values with .from().
   Word share, recomputed on the 17 word line: 0.235 "each observation" .
   0.353 "gets its own ID" (the snap) . 0.529 the word "ID." itself .
   0.824 "ready for review". The tap stays absolute, inside the first 1.5s,
   per motion rules 2. */
tl.from('#sc05 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s05_lock', -0.45))
  .from('#s5paper', { opacity: 0, y: 22, duration: 0.85, ease: 'power2.out' }, at('s05_lock', -0.25))
  /* the draft is already filled when the observer reaches for the button: the
     values come up to FULL, then settle back to the locked 0.7 on the snap.
     First tween on these targets, so default immediateRender stamps the blank
     draft at frame 0 and they fill in on the entrance. */
  .fromTo('#sc05 .s5v', { opacity: 0 },
    { opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power1.out' }, at('s05_lock', 0.05))
  .fromTo('#sc05 .s5sel', { opacity: 0 },
    { opacity: 1, duration: 0.34, stagger: 0.09, ease: 'power1.out' }, at('s05_lock', 0.28))
  /* the rating box under a selection carries the SAME digit as the chip that
     lands on it (the product's own markup: the chip is an overlay, not a swap).
     The box's own number is released on exactly the chip's beat, so the draft
     still shows all six numbers and the locked card never paints two digits in
     one 21px box. It is the wrapped .s5num that fades, not .s5rate, or the chip
     inside it would fade with it. Default immediateRender stamps opacity 1 at
     frame 0, which is the draft state; the resting state is 0, under the chip. */
  .fromTo('#sc05 .s5rate.sel .s5num', { opacity: 1 },
    { opacity: 0, duration: 0.34, stagger: 0.09, ease: 'power1.out' }, at('s05_lock', 0.28))
  .from('#sc05 .s5side .ey', { opacity: 0, x: 12, duration: 0.6 }, at('s05_lock', 0.3))
  .from('#sc05 .s5side > .s5chip:not(.is-new)', { opacity: 0, x: 16, duration: 0.6, stagger: 0.14 }, at('s05_lock', 0.42))
  .from('#sc05 .ill-tag', { opacity: 0, duration: 0.6 }, at('s05_lock', 0.55));

/* "When it is done": the pill takes the press and the ripple runs. Absolute,
   inside the entrance window. Nothing here touches scale or boxShadow. */
tl.fromTo('#s5press', { opacity: 0 },
    { opacity: 1, duration: 0.09, ease: 'none', immediateRender: false }, at('s05_lock', 0.6))
  .fromTo('#s5press', { opacity: 1 },
    { opacity: 0, duration: 0.36, ease: 'power2.out', immediateRender: false }, at('s05_lock', 0.75))
  .fromTo('#s5ripple', { scale: 0, opacity: 0.62 },
    { scale: 17, opacity: 0, duration: 0.72, ease: 'power2.out', immediateRender: false }, at('s05_lock', 0.63));

/* "each observation": the banner drops in and its meta line slides. The Record
   ID inside it then takes a colour lift on the word "ID." itself and releases.
   Cheap emphasis on purpose: the scene is about 6s, and a 2.0s gold ring would
   own a third of it. */
tl.from('#s5banner', { opacity: 0, y: -10, duration: 0.55, ease: 'power3.out' }, atf('s05_lock', 0.235))
  .from('#s5bmeta', { opacity: 0, x: -10, duration: 0.5, ease: 'power2.out' }, atf('s05_lock', 0.294))
  /* literals are --paper-mid and --rate-success-deep: the lift releases back to
     the AA value the token now carries (#5f6e77), not the pre-pass #6b7e85, or
     the meta line would settle one notch lighter than the rest of the card */
  .fromTo('#s5bmeta', { color: '#5f6e77' },
    { color: '#0f5f30', duration: 0.35, ease: 'power2.out', immediateRender: false }, atf('s05_lock', 0.529))
  .to('#s5bmeta', { color: '#5f6e77', duration: 0.55, ease: 'power2.inOut' }, atf('s05_lock', 0.529) + 0.35);

/* "gets its own ID": the whole lock lands as one snap, everything inside half a
   second (this is the beat the v2.3 line called "freezes"). Cells and grid take
   the locked tint, the values settle to the product's locked 0.7, the card takes
   its green edge and the action bar swaps. Each of these ENDS on the resting
   value, so a freeze after the beat is the authored card and a freeze before it
   is a legitimate draft. */
var S5_LOCK = atf('s05_lock', 0.353);
tl.fromTo('#sc05 .s5cell', { backgroundColor: '#ffffff' },
    { backgroundColor: '#f9fafa', duration: 0.5, ease: 'power1.out' }, S5_LOCK)
  .fromTo('#s5grid', { backgroundColor: 'rgba(20,54,66,0.025)' },
    { backgroundColor: 'rgba(20,54,66,0.075)', duration: 0.5, ease: 'power1.out' }, S5_LOCK)
  /* second tween on the values, so immediateRender:false or GSAP stamps
     opacity 1 at frame 0 and the draft never reads as blank */
  /* .s5sel excluded: its locked dim lives in the chip's rgba(.88) background now,
     element opacity on white text broke AA (3.1:1) at the tint beat */
  .fromTo('#sc05 .s5v', { opacity: 1 },
    { opacity: 0.7, duration: 0.5, ease: 'power1.out', immediateRender: false }, S5_LOCK)
  .from('#s5edge', { opacity: 0, duration: 0.5, ease: 'power2.out' }, S5_LOCK)
  .fromTo('#s5draft', { opacity: 1 },
    { opacity: 0, duration: 0.28, ease: 'power1.in' }, S5_LOCK + 0.16)
  .from('#s5locked', { opacity: 0, scale: 0.94, duration: 0.42, ease: 'back.out(1.8)' }, S5_LOCK + 0.22);

/* "ready for review": the new entry lands in the morning's list and the card
   holds. This is the last beat and the resting state of the scene. */
tl.from('#s5chip3', { opacity: 0, y: -14, scale: 0.94, duration: 0.6, ease: 'back.out(1.6)' }, atf('s05_lock', 0.824));
