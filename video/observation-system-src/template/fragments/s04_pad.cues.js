/* 4 . the Evidence Pad
   "Real observation notes are handwritten. So the form has an Evidence Pad.
    The observer writes with Apple Pencil, keeps photos ... alongside, and the
    system reads the handwriting and types it into the right field ...
    Transcription only, never judgement; the ratings stay human. And every
    stroke survives a closed lid, mid lesson."  (21.7s, 63 words) */
tl.from('#s4dev', { opacity: 0, y: 26, scale: 0.985, duration: 0.9, ease: 'power3.out' }, at('s04_pad', -0.35))
  .from('#s4top .pad-title, #s4top .pad-btn', { opacity: 0, y: -8, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, at('s04_pad', 0.3))
  .from('#s4tools > *', { opacity: 0, y: 8, duration: 0.45, stagger: 0.05, ease: 'power2.out' }, atf('s04_pad', 0.14))
  .from('#s4ill', { opacity: 0, duration: 0.6 }, atf('s04_pad', 0.20));

/* "the observer writes with Apple Pencil": the ink draws itself, line by line.
   Resting state is the finished page, so the tween ends on dashoffset 0. */
document.querySelectorAll('#s4ink .hw').forEach(function (p, i) {
  var L = 0;
  try { L = p.getTotalLength(); } catch (e) { L = 0; }
  if (!L || !isFinite(L)) L = +p.dataset.len || 1200;
  p.style.strokeDasharray = L;
  p.style.strokeDashoffset = 0;
  tl.fromTo(p, { strokeDashoffset: L },
    { strokeDashoffset: 0, duration: 1.15, ease: 'none' }, atf('s04_pad', 0.21) + i * 0.45);
});

tl.from('#s4photo', { opacity: 0, y: -52, rotate: -11, duration: 0.75, ease: 'back.out(1.3)' }, atf('s04_pad', 0.30))
  .fromTo('#s4hl', { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power2.out' }, atf('s04_pad', 0.37))
  /* "the system reads the handwriting and types it into the right field" */
  .fromTo('#s4ink', { opacity: 1 }, { opacity: 0.12, duration: 0.8, ease: 'power2.inOut' }, atf('s04_pad', 0.47))
  .from('#s4typed', { opacity: 0, y: 18, duration: 0.75, ease: 'power2.out' }, atf('s04_pad', 0.49))
  .from('#s4toast', { opacity: 0, y: 16, duration: 0.5, ease: 'power2.out' }, atf('s04_pad', 0.60))
  /* "Transcription only, never judgement" */
  .from('#s4cap', { opacity: 0, duration: 0.6 }, atf('s04_pad', 0.72))
  /* "every stroke survives a closed lid" */
  .from('#s4save', { opacity: 0, x: -12, duration: 0.6, ease: 'power2.out' }, atf('s04_pad', 0.86));
