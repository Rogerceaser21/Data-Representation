/* 12 . teacher portal
   v2.5 refit: three beats. Beat 0 the REAL iPad app open plus a synthetic portal
   sign in, beat 1 the wall, beat 2 the portal page. "Teachers have their own
   door" is now literally a real door being opened: REAL iOS Simulator footage
   where a real tap on "Teacher Portal" really opens the app, the footage's own
   dark zoom crossfades into a sign in card (invented name, dots for a password,
   nothing real), and a second tap on Sign in opens the wall. The drawn home
   screen, drawn icon fingertip, gold ripple and authored app-open zoom are GONE.
   The sign in card's own fingertip STAYS: that card is drawn, not footage.
   The page is a full-frame layer over the wall and enters with .from(), so the
   scene's resting state is the finished portal page; the wall is only ever
   visible while that entrance has not run. Both head-beat layers rest at
   opacity 0 and are held visible by fromTo(immediateRender:false), the #s7gate
   idiom, so a frame rendered without the timeline shows the portal page.

   THE CLIP MAP (the one law of this beat)
     clip data-start = S12_TAP - 0.80, so the real tap fires exactly ON the 0.036
     word-share ("their"). This scene is the TIGHT one: the tap cue sits only
     0.65s into the line, and the sign in card, its password and its own tap all
     have to happen before 0.098. So the handover is taken at 1.30s of file time
     rather than the 1.55s used in sc02/sc07: the opened app is already ~96% of
     the frame there, the fill pushes the remaining hairline of wallpaper off the
     frame edge, and the sign in layer is OPAQUE and crossfades up over the rest.
     Clip window 1.90s, cut well before the file's light-gray tail.

   Word share on the v2.4 line (56 words):
     0.036  "their"                the REAL icon tap in the footage
     0.064  the app takes the frame; the sign in card crossfades up out of it
     0.098  the Sign in tap        (inside "A portal for every member of staff")
     0.112  the sign in dissolves                         UNCHANGED
     0.116  the wall kicker                               UNCHANGED
     0.122  the wall head                                 UNCHANGED
     0.128  the staff tiles                               UNCHANGED
     0.194  "staff:"               the zoom push          UNCHANGED
     0.214  "their photograph"     the portal page lands  UNCHANGED
     0.250  "their history"                               UNCHANGED */

var S12_TAP = atf('s12_portal', 0.036);                          // the REAL tap, on "their"
var S12_CLIP = Math.max(S12_TAP - 0.80, at('s12_portal', -0.55)); // = the video's data-start
var S12_DARK = S12_CLIP + 1.30;                                  // the opened app owns the frame
var S12_SIGN = atf('s12_portal', 0.098);      // the fingertip presses Sign in
var S12_OUT = atf('s12_portal', 0.112);       // the sign in dissolves into the wall

/* beat 0a . the tablet. Held from the scene start (poster still under the clip
   window), the touch indicator on the real tap frame, then handed to the sign in
   card, which is opaque and covers it before this fade even finishes. */
tl.fromTo('#s12ipd', { opacity: 1 },
    { opacity: 1, ease: 'none', immediateRender: false,
      duration: (S12_DARK + 0.26) - at('s12_portal', -0.55) }, at('s12_portal', -0.55))
  /* the iOS touch indicator, at full opacity ON the tap frame (see s02_form for
     why the fade-in runs BEFORE the tap and not after it) */
  .fromTo('#s12touch', { opacity: 0, scale: 0.92 },
    { opacity: 1, scale: 1, duration: 0.12, ease: 'power2.out', immediateRender: false }, S12_TAP - 0.12)
  .to('#s12touch', { opacity: 0, duration: 0.25, ease: 'power2.in' }, S12_TAP + 0.18)
  /* the app takes the frame, same move as the other two head beats. Here it does
     a second job: the dissolve is taken at 1.30s of file time rather than 1.60s,
     where a hairline of wallpaper still rings the opened app, and pushing the
     screen past the frame edge crops that ring off outright. */
  .fromTo('#s12ipd .ipdev', { scale: 1 },
    { scale: 2.8, duration: 0.26, ease: 'power2.in', immediateRender: false }, S12_DARK)
  /* the fade waits for the fill to LAND (see s02_form); by then the sign in
     layer above is already opaque, so this is only housekeeping */
  .to('#s12ipd', { opacity: 0, duration: 0.28, ease: 'power2.out' }, S12_DARK + 0.26);

/* beat 0b . the synthetic sign in, crossfading up OUT of the footage's dark so
   the app open reads as one continuous move. */
tl.fromTo('#s12login', { opacity: 0 },
    { opacity: 1, duration: 0.34, ease: 'power2.out', immediateRender: false }, S12_DARK)
  .fromTo('#s12lcard', { opacity: 0, scale: 1.06 },
    { opacity: 1, scale: 1, duration: 0.34, ease: 'power3.out', immediateRender: false }, S12_DARK + 0.02)
  /* the invented name, then the password filling itself, finishing on the press */
  .fromTo('#s12lname', { opacity: 0, x: -10 },
    { opacity: 1, x: 0, duration: 0.20, ease: 'power2.out', immediateRender: false }, S12_DARK + 0.24)
  .fromTo('#s12ldots i', { opacity: 0, scale: 0.3 },
    { opacity: 1, scale: 1, duration: 0.16, ease: 'back.out(2.2)', stagger: 0.020, immediateRender: false }, S12_DARK + 0.32)
  /* the fingertip, anchored to the button itself (.ipdbtnwrap), landing on the cue */
  .fromTo('#s12ltip', { opacity: 0, x: 90, y: 110, scale: 1.25 },
    { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.34, ease: 'power3.out', immediateRender: false }, S12_DARK + 0.26)
  .fromTo('#s12lbtn', { scale: 1 }, { scale: 0.955, duration: 0.12, ease: 'power2.in', immediateRender: false }, S12_SIGN)
  .to('#s12lbtn', { scale: 1, duration: 0.3, ease: 'back.out(2)' }, S12_SIGN + 0.12)
  .fromTo('#s12ltip', { scale: 1 }, { scale: 0.88, duration: 0.12, ease: 'power2.in', immediateRender: false }, S12_SIGN)
  .to('#s12ltip', { scale: 1, duration: 0.3, ease: 'back.out(2)' }, S12_SIGN + 0.12)
  .fromTo('#s12lrip i', { scale: 0.42, opacity: 0.9 },
    { scale: 2.2, opacity: 0, duration: 0.62, ease: 'power2.out', stagger: 0.1, immediateRender: false }, S12_SIGN + 0.08)
  .to('#s12ltip', { opacity: 0, y: -14, duration: 0.26, ease: 'power2.in' }, S12_SIGN + 0.2)
  /* the door opens: the card pushes forward and dissolves onto the wall */
  .to('#s12lcard', { scale: 1.06, duration: 0.55, ease: 'power2.in' }, S12_OUT)
  .to('#s12login', { opacity: 0, duration: 0.55, ease: 'power2.in' }, S12_OUT);

/* beat 1 . the wall, compressed to sit behind the sign in dissolve */
      tl.from('#s12kick', { opacity: 0, y: 14, duration: 0.6 }, atf('s12_portal', 0.116))
        .from('#sc12 .psecthead', { opacity: 0, y: 12, duration: 0.6 }, atf('s12_portal', 0.122))
        /* "A portal for every member of staff" (the phrase runs 0.089 to 0.196,
           so the tiles still land inside it, just later in it) */
        .from('#s12tiles .pface', { opacity: 0, y: 22, scale: 0.96, duration: 0.55, stagger: 0.06, ease: 'power2.out' }, atf('s12_portal', 0.128))
        /* the zoom push: the wall eases forward, Eleanor's page lands over it */
        .fromTo('#s12wall', { scale: 1 }, { scale: 1.06, duration: 0.9, ease: 'power2.in', immediateRender: false }, atf('s12_portal', 0.194))
        /* "their photograph" */
        .from('#s12page', { opacity: 0, scale: 1.08, duration: 0.85, ease: 'power3.out' }, atf('s12_portal', 0.214))
        .fromTo('#s12frame', { y: 18, rotate: 5 }, { y: 0, rotate: 1.6, duration: 0.8, ease: 'power3.out', immediateRender: false }, atf('s12_portal', 0.214))
        /* "their history" */
        .from('#s12band .bkick, #s12name, #s12band .bmeta', { opacity: 0, y: 14, duration: 0.6, stagger: 0.1 }, atf('s12_portal', 0.250))
        .from('#s12secs .hsecrow', { opacity: 0, y: 12, duration: 0.5, stagger: 0.09 }, atf('s12_portal', 0.250))
        /* "and a notification when a new coaching plan is approved" */
        .from('#s12badge', { opacity: 0, x: -12, duration: 0.5, ease: 'power2.out' }, atf('s12_portal', 0.276))
        .to('#s12frame .pstar', { y: -12, rotate: 9, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: 0.7 }, atf('s12_portal', 0.286))
        /* the badge pulse, on the timeline (never a CSS loop) so a seek is deterministic */
        .fromTo('#s12badge i', { boxShadow: '0 0 0 0 rgba(255,255,255,.55)' },
          { boxShadow: '0 0 0 6px rgba(255,255,255,0)', duration: 0.8, repeat: 6, ease: 'power2.out', immediateRender: false }, atf('s12_portal', 0.320))
        /* "What they see is deliberately thinner than what leadership sees": row 04
           lifts, rows 01-03 and 05-07 stay .dim, which is their resting state, so
           there is nothing to restore and a freeze anywhere reads correct */
        .to('#s12row4', { backgroundColor: 'rgba(255,255,255,.14)', borderColor: 'rgba(255,255,255,.22)', duration: 0.45, ease: 'power2.out' }, atf('s12_portal', 0.464))
        .to('#s12row4', { backgroundColor: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.09)', duration: 0.6, ease: 'power2.inOut' }, atf('s12_portal', 0.464) + 1.6)
        /* "no observer's rough notes, no edits" */
        .from('#s12cap', { opacity: 0, y: 10, duration: 0.6 }, atf('s12_portal', 0.714));
      spotlight('#s12badge', atf('s12_portal', 0.286), 2.0);                    // "a notification when a new coaching plan is approved"
