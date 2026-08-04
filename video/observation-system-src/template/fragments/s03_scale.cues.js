/* 3 . the Regulatory Body's scale
   "Each observation uses the Regulatory Body's own six point scale, from Very
    Weak to Outstanding, with the same proportion bands its inspectors already
    use. Ten criteria, from attainment and progress to teaching and leadership,
    each with room for a comment. The form speaks the language of inspection,
    because it was built to coach teachers using the same criteria." (58 words)
   Cue times are word share through that text (motion rules 2). */
tl.from('#s3dev', { opacity: 0, y: 26, scale: 0.985, duration: 0.9, ease: 'power3.out' }, at('s03_scale', -0.35))
  .from('#s3title', { opacity: 0, y: 10, duration: 0.6, ease: 'power2.out' }, at('s03_scale', 0.3))
  /* "from Very Weak to Outstanding": the line now runs bottom band to top, so
     the reveal runs from the END of the key. The DOM keeps the product's own
     order (1 to 6, left to right); only the stagger direction is reversed, and
     it is a .from(), so the resting state is all six cells visible. */
  .from('#s3key .jk-cell', { opacity: 0, y: 16, scale: 0.94, duration: 0.5, stagger: { each: 0.24, from: 'end' }, ease: 'back.out(1.5)' }, atf('s03_scale', 0.172))
  /* "Ten criteria, from attainment and progress to teaching and leadership" */
  .from('#s3tbl thead th', { opacity: 0, duration: 0.5, stagger: 0.08 }, atf('s03_scale', 0.37))
  .from('#s3tbl tbody tr', { opacity: 0, y: 18, duration: 0.5, stagger: 0.11, ease: 'power2.out' }, atf('s03_scale', 0.40));

spotlight('#s3tblwrap', atf('s03_scale', 0.414), 2.2);          // "Ten criteria"

/* the Teaching row rates itself while the table is lit: "teaching and
   leadership", inside the spotlight hold, so no second ring */
tl.from('#s3tap', {
  backgroundColor: 'rgba(46,161,90,0)', color: '#6b7e85', borderColor: 'rgba(20,54,66,0.14)',
  scale: 0.7, duration: 0.5, ease: 'back.out(2.4)'
}, atf('s03_scale', 0.534));

tl.from('#s3ill', { opacity: 0, duration: 0.6 }, atf('s03_scale', 0.80));
