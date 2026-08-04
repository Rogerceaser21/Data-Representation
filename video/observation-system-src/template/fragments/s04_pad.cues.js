/* 4 . the Evidence Pad
   "Coaching notes can be handwritten. The form has an Evidence Pad, designed
    for Apple Pencil. The observer types, or writes with the Pencil, and keeps
    photos of the board or the pupils' work alongside. The system reads the
    handwriting and turns it into text. Everything is saved automatically
    throughout the observation, so nothing is ever lost mid lesson." (58 words)
   Cue times are word share through that text (motion rules 2). */
tl.from('#s4dev', { opacity: 0, y: 26, scale: 0.985, duration: 0.9, ease: 'power3.out' }, at('s04_pad', -0.35))
  .from('#s4top .pad-title, #s4top .pad-btn', { opacity: 0, y: -8, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, at('s04_pad', 0.3))
  .from('#s4tools > *', { opacity: 0, y: 8, duration: 0.45, stagger: 0.05, ease: 'power2.out' }, atf('s04_pad', 0.14))
  .from('#s4ill', { opacity: 0, duration: 0.6 }, atf('s04_pad', 0.20));

/* "The observer types": the typed line wipes in left to right, same grammar as
   the ink. It is nested in #s4typed, so it can reveal long before the
   transcription block enters without a second box owning the top band. */
tl.from('#s4type', { clipPath: 'inset(0% 100% 0% 0%)', duration: 0.6, ease: 'none' }, atf('s04_pad', 0.259));

/* "or writes with the Pencil": the ink draws itself, line by line.
   Resting state is the finished page, so the tween ends on the full rect. */
document.querySelectorAll('#s4ink .hwrect').forEach(function (r, i) {
  // handwriting-font lines reveal left to right as if written; resting state is
  // the full rect (finished page), so a frozen frame always shows complete notes
  // default immediateRender (true): before the writing beat the line is BLANK
  // (from-state width 0), during it wipes on, after it rests full. Matches how
  // the stroke ink behaved in v2.0/v2.1. immediateRender:false made each line
  // sit fully written, vanish at its beat, then rewrite (caught in render QA).
  tl.fromTo(r, { attr: { width: 0 } },
    { attr: { width: 1456 }, duration: 1.15, ease: 'none' }, atf('s04_pad', 0.310) + i * 0.45);
});

/* "and keeps photos of the board or the pupils' work alongside" */
tl.from('#s4photo', { opacity: 0, y: -52, rotate: -11, duration: 0.75, ease: 'back.out(1.3)' }, atf('s04_pad', 0.414))
  .fromTo('#s4hl', { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power2.out' }, atf('s04_pad', 0.44))
  /* "The system reads the handwriting and turns it into text" */
  .fromTo('#s4ink', { opacity: 1 }, { opacity: 0.12, duration: 0.8, ease: 'power2.inOut' }, atf('s04_pad', 0.586))
  .from('#s4typed .section-title, #s4typed .long-text', { opacity: 0, y: 18, duration: 0.75, stagger: 0.06, ease: 'power2.out' }, atf('s04_pad', 0.586))
  .from('#s4toast', { opacity: 0, y: 16, duration: 0.5, ease: 'power2.out' }, atf('s04_pad', 0.66))
  /* the honesty label for the transcription beat: AI reads it, judgements stay human */
  .from('#s4cap', { opacity: 0, duration: 0.6 }, atf('s04_pad', 0.70))
  /* "Everything is saved automatically throughout the observation": it is
     already the green success colour, so opacity plus x is enough, no ring */
  .from('#s4save', { opacity: 0, x: -12, duration: 0.6, ease: 'power2.out' }, atf('s04_pad', 0.759));
