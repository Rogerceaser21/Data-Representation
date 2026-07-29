/* 5 . save and lock
   Arc: a filled draft -> tap -> locked record -> 0.6s soft reset -> clean form.
   The scene ends where it rests (clean form, draft action bar), so every mid
   scene state is an explicit fromTo pair with immediateRender:false. */
tl.from('#sc05 .shead', { opacity: 0, y: 16, duration: 0.7 }, at('s05_lock', -0.45))
  .from('#s5paper', { opacity: 0, y: 22, duration: 0.85, ease: 'power2.out' }, at('s05_lock', -0.25))
  /* the draft is already filled when the observer reaches for the button */
  .fromTo('#sc05 .s5v', { opacity: 0 },
    { opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power1.out', immediateRender: false }, at('s05_lock', 0.05))
  .fromTo('#sc05 .s5sel', { opacity: 0 },
    { opacity: 1, duration: 0.34, stagger: 0.09, ease: 'power1.out', immediateRender: false }, at('s05_lock', 0.28))
  .from('#sc05 .s5side .ey', { opacity: 0, x: 12, duration: 0.6 }, at('s05_lock', 0.3))
  /* direct children only: the ghost chips live in .s5ghosts and enter later */
  .from('#sc05 .s5side > .s5chip:not(.is-new)', { opacity: 0, x: 16, duration: 0.6, stagger: 0.14 }, at('s05_lock', 0.42))
  .from('#sc05 .ill-tag', { opacity: 0, duration: 0.6 }, at('s05_lock', 0.55))
  .fromTo('#s5tip', { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', immediateRender: false }, at('s05_lock', 0.6));

spotlight('#s5submit', at('s05_lock', 1.0), 2.0);                        // "Save and Lock"

/* the tap: tooltip clears, the pill takes the press, the ripple runs.
   Nothing here touches scale or boxShadow, which the spotlight owns. */
tl.fromTo('#s5tip', { opacity: 1, y: 0 },
    { opacity: 0, y: 4, duration: 0.3, ease: 'power1.in', immediateRender: false }, at('s05_lock', 1.4))
  .fromTo('#s5press', { opacity: 0 },
    { opacity: 1, duration: 0.09, ease: 'none', immediateRender: false }, at('s05_lock', 1.5))
  .fromTo('#s5press', { opacity: 1 },
    { opacity: 0, duration: 0.36, ease: 'power2.out', immediateRender: false }, at('s05_lock', 1.6))
  .fromTo('#s5ripple', { scale: 0, opacity: 0.62 },
    { scale: 17, opacity: 0, duration: 0.72, ease: 'power2.out', immediateRender: false }, at('s05_lock', 1.53));

/* "The record gets an ID" */
tl.fromTo('#s5banner', { opacity: 0, y: -10 },
    { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', immediateRender: false }, atf('s05_lock', 0.146))
  .from('#s5bmeta', { opacity: 0, x: -10, duration: 0.5, ease: 'power2.out' }, atf('s05_lock', 0.19));

/* "freezes, and can never be edited again": fields tint to the locked surface,
   the values settle back to the product's locked opacity, the card takes a green edge */
tl.fromTo('#sc05 .s5cell', { backgroundColor: '#ffffff' },
    { backgroundColor: '#f9fafa', duration: 0.5, ease: 'power1.out', immediateRender: false }, atf('s05_lock', 0.25))
  .fromTo('#s5grid', { backgroundColor: 'rgba(20,54,66,0.025)' },
    { backgroundColor: 'rgba(20,54,66,0.075)', duration: 0.5, ease: 'power1.out', immediateRender: false }, atf('s05_lock', 0.25))
  .fromTo('#sc05 .s5v, #sc05 .s5sel', { opacity: 1 },
    { opacity: 0.7, duration: 0.5, ease: 'power1.out', immediateRender: false }, atf('s05_lock', 0.25))
  .fromTo('#s5edge', { opacity: 0 },
    { opacity: 1, duration: 0.5, ease: 'power2.out', immediateRender: false }, atf('s05_lock', 0.25))
  /* the action bar swaps to the locked cluster */
  .fromTo('#s5draft', { opacity: 1 },
    { opacity: 0, duration: 0.28, ease: 'power1.in', immediateRender: false }, atf('s05_lock', 0.275))
  .fromTo('#s5locked', { opacity: 0, scale: 0.94 },
    { opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(1.8)', immediateRender: false }, atf('s05_lock', 0.29))
  .from('#s5chip3', { opacity: 0, y: -14, scale: 0.94, duration: 0.6, ease: 'back.out(1.6)' }, atf('s05_lock', 0.30));

/* "Three seconds later the form is clean": one 0.6s sweep clears it */
tl.fromTo('#s5wipe', { xPercent: -132, opacity: 0 },
    { xPercent: -40, opacity: 1, duration: 0.2, ease: 'none', immediateRender: false }, atf('s05_lock', 0.40))
  .fromTo('#s5wipe', { xPercent: -40, opacity: 1 },
    { xPercent: 232, opacity: 0, duration: 0.55, ease: 'none', immediateRender: false }, atf('s05_lock', 0.40) + 0.2)
  .fromTo('#sc05 .s5v, #sc05 .s5sel', { opacity: 0.7 },
    { opacity: 0, duration: 0.3, ease: 'power1.in', immediateRender: false }, atf('s05_lock', 0.415))
  .fromTo('#s5banner', { opacity: 1, y: 0 },
    { opacity: 0, y: -6, duration: 0.35, ease: 'power1.in', immediateRender: false }, atf('s05_lock', 0.415))
  .fromTo('#s5edge', { opacity: 1 },
    { opacity: 0, duration: 0.4, ease: 'power1.in', immediateRender: false }, atf('s05_lock', 0.42))
  .fromTo('#sc05 .s5cell', { backgroundColor: '#f9fafa' },
    { backgroundColor: '#ffffff', duration: 0.4, ease: 'power1.out', immediateRender: false }, atf('s05_lock', 0.42))
  .fromTo('#s5grid', { backgroundColor: 'rgba(20,54,66,0.075)' },
    { backgroundColor: 'rgba(20,54,66,0.025)', duration: 0.4, ease: 'power1.out', immediateRender: false }, atf('s05_lock', 0.42))
  .fromTo('#s5locked', { opacity: 1, scale: 1 },
    { opacity: 0, scale: 0.96, duration: 0.28, ease: 'power1.in', immediateRender: false }, atf('s05_lock', 0.435))
  .fromTo('#s5draft', { opacity: 0 },
    { opacity: 1, duration: 0.42, ease: 'power2.out', immediateRender: false }, atf('s05_lock', 0.45));

/* "Observers file back to back all morning; a full inspection week runs on
   this one screen": the morning's list keeps going past the frame. */
tl.from('#sc05 .s5gh', { opacity: 0, y: -12, duration: 0.6, stagger: 0.18, ease: 'power2.out' }, atf('s05_lock', 0.665))
  .from('#s5note', { opacity: 0, y: 10, duration: 0.7, ease: 'power2.out' }, atf('s05_lock', 0.74));
