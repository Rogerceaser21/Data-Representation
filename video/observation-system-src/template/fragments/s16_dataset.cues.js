/* 16 . the data set  (30 words)
   "Once an observation round is completed, the relevant school stakeholders
    receive a whole set of data. Individual lesson observations. A snapshot of
    the round. Coverage. And a highly detailed report."

   Word share, recomputed from THIS text (words spoken before the phrase / 30):
     0.100  "completed"                     -> the illustrative tag
     0.333  "receive"                       -> the h2's own em lands
     0.367  "a whole set of data"           -> four ruled slots, the set arriving
     0.533  "Individual lesson observations"-> sheet 01, the locked record
     0.633  "A snapshot of the round"       -> sheet 02, the Story board
     0.800  "Coverage"                      -> sheet 03, the coverage ring
     0.833  "And a highly detailed report"  -> sheet 04, the governance report
   The last two beats are 0.033 apart because the narration says them that way
   ("Coverage. And a highly detailed report."); the sheets land as a one two.
   Every sheet lands with .from(), so the resting frame is the finished 2x2. */

/* Deterministic star field for this navy stage. It lives in the fragment rather
   than in the skeleton's cover/end-card script so the scene stays self
   contained; seeded LCG, never Math.random, so every render paints it the same. */
(function () {
  var el = document.getElementById('s16dstars');
  if (!el) return;
  var seed = 20260805, n = 120, h = '';
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  for (var i = 0; i < n; i++) {
    var s = 1 + rnd() * 2.1, x = rnd() * 100, y = rnd() * 100, o = 0.16 + rnd() * 0.6;
    h += '<i style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;width:' + s.toFixed(2) +
      'px;height:' + s.toFixed(2) + 'px;opacity:' + o.toFixed(2) + '"></i>';
  }
  el.innerHTML = h;
})();

tl.from('#s16dhead .kick', { opacity: 0, y: 14, duration: 0.65, ease: 'power2.out' }, at('s16_dataset', -0.45))
  .from('#s16dh', { opacity: 0, y: 18, duration: 0.8, ease: 'power3.out' }, at('s16_dataset', -0.15))
  /* "completed" */
  .from('#s16dill', { opacity: 0, duration: 0.5 }, atf('s16_dataset', 0.100))
  /* "receive": the sentence completes itself on the word */
  .from('#s16dhem', { opacity: 0, y: 12, duration: 0.6, ease: 'power3.out' }, atf('s16_dataset', 0.333))
  /* "a whole set of data": four ruled slots, so the set is visibly a set before
     any of it is named. immediateRender:false, or the fan in would stamp its
     from state over the resting 0 at frame 0. */
  .fromTo('#sc16d .s16dgh', { opacity: 0 },
    { opacity: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out', immediateRender: false }, atf('s16_dataset', 0.367));

/* 01 . "Individual lesson observations" */
tl.from('#s16dc1', { opacity: 0, y: 26, duration: 0.75, ease: 'power3.out' }, atf('s16_dataset', 0.533))
  .to('#s16dg1', { opacity: 0, duration: 0.45, ease: 'power1.out' }, atf('s16_dataset', 0.533));

/* 02 . "A snapshot of the round": the board's own tiles count up as it lands */
tl.from('#s16dc2', { opacity: 0, y: 26, duration: 0.75, ease: 'power3.out' }, atf('s16_dataset', 0.633))
  .to('#s16dg2', { opacity: 0, duration: 0.45, ease: 'power1.out' }, atf('s16_dataset', 0.633))
  .from('#s16dc2 .osramp .rc', { opacity: 0, duration: 0.4, stagger: 0.05 }, atf('s16_dataset', 0.633) + 0.35);
countUp('#s16dc2 .stat .v[data-count]', atf('s16_dataset', 0.633) + 0.2, 0.9);

/* 03 . "Coverage": the ring draws to the round's own 70 percent (105 of 149).
   The arc rests DRAWN (dashoffset 85.35 in the markup, the same value #sc10
   ships), so a freeze either side of the beat reads finished. */
tl.from('#s16dc3', { opacity: 0, y: 26, duration: 0.75, ease: 'power3.out' }, atf('s16_dataset', 0.800))
  .to('#s16dg3', { opacity: 0, duration: 0.45, ease: 'power1.out' }, atf('s16_dataset', 0.800))
  .fromTo('#s16darc', { attr: { 'stroke-dashoffset': 289.03 } },
    { attr: { 'stroke-dashoffset': 85.35 }, duration: 1.1, ease: 'power2.out', immediateRender: false },
    atf('s16_dataset', 0.800) + 0.15);
countUp('#s16dpct span[data-count]', atf('s16_dataset', 0.800) + 0.15, 1.0);

/* 04 . "And a highly detailed report", with its citation markers last */
tl.from('#s16dc4', { opacity: 0, y: 26, duration: 0.75, ease: 'power3.out' }, atf('s16_dataset', 0.833))
  .to('#s16dg4', { opacity: 0, duration: 0.45, ease: 'power1.out' }, atf('s16_dataset', 0.833))
  .from('#s16dc4 .refmk', { opacity: 0, scale: 0.4, duration: 0.45, stagger: 0.12, ease: 'back.out(2)' },
    atf('s16_dataset', 0.833) + 0.5);
