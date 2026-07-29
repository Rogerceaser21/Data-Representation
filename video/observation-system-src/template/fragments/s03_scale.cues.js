/* 3 . the regulator's scale
   "Judgements use the regulator's own six point scale, from Outstanding to
    Very Weak, with the same proportion bands inspectors already use. Ten
    criteria ... The form speaks the language of inspection, because it was
    built from it."  (18.2s, 50 words) */
tl.from('#s3dev', { opacity: 0, y: 26, scale: 0.985, duration: 0.9, ease: 'power3.out' }, at('s03_scale', -0.35))
  .from('#s3title', { opacity: 0, y: 10, duration: 0.6, ease: 'power2.out' }, at('s03_scale', 0.3))
  /* the six key cells land one per band, tracking "from Outstanding to Very Weak" */
  .from('#s3key .jk-cell', { opacity: 0, y: 16, scale: 0.94, duration: 0.5, stagger: 0.24, ease: 'back.out(1.5)' }, atf('s03_scale', 0.09))
  /* "Ten criteria, from attainment and progress to teaching and leadership" */
  .from('#s3tbl thead th', { opacity: 0, duration: 0.5, stagger: 0.08 }, atf('s03_scale', 0.36))
  .from('#s3tbl tbody tr', { opacity: 0, y: 18, duration: 0.5, stagger: 0.11, ease: 'power2.out' }, atf('s03_scale', 0.40));

spotlight('#s3tblwrap', atf('s03_scale', 0.48), 2.2);          // "Ten criteria"

/* the Teaching row rates itself while the table is lit */
tl.from('#s3tap', {
  backgroundColor: 'rgba(46,161,90,0)', color: '#6b7e85', borderColor: 'rgba(20,54,66,0.14)',
  scale: 0.7, duration: 0.5, ease: 'back.out(2.4)'
}, atf('s03_scale', 0.57));

tl.from('#s3ill', { opacity: 0, duration: 0.6 }, atf('s03_scale', 0.80));
