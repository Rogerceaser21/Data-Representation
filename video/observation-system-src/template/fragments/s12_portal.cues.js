/* 12 . teacher portal
   Beat 1 the wall, beat 2 the portal page. The page is a full-frame layer over
   the wall and enters with .from(), so the scene's resting state is the finished
   portal page; the wall is only ever visible while that entrance has not run. */
      tl.from('#s12kick', { opacity: 0, y: 14, duration: 0.6 }, at('s12_portal', -0.4))
        .from('#sc12 .psecthead', { opacity: 0, y: 12, duration: 0.6 }, at('s12_portal', -0.2))
        /* "A portal for every member of staff" */
        .from('#s12tiles .pface', { opacity: 0, y: 22, scale: 0.96, duration: 0.6, stagger: 0.12, ease: 'power2.out' }, at('s12_portal', 0.1))
        /* the zoom push: the wall eases forward, Eleanor's page lands over it */
        .fromTo('#s12wall', { scale: 1 }, { scale: 1.06, duration: 0.9, ease: 'power2.in', immediateRender: false }, atf('s12_portal', 0.20))
        .from('#s12page', { opacity: 0, scale: 1.08, duration: 0.85, ease: 'power3.out' }, atf('s12_portal', 0.22))
        /* "their photograph, their record" */
        .from('#s12band .bkick, #s12name, #s12band .bmeta', { opacity: 0, y: 14, duration: 0.6, stagger: 0.1 }, atf('s12_portal', 0.25))
        .fromTo('#s12frame', { y: 18, rotate: 5 }, { y: 0, rotate: 1.6, duration: 0.8, ease: 'power3.out', immediateRender: false }, atf('s12_portal', 0.25))
        .from('#s12secs .hsecrow', { opacity: 0, y: 12, duration: 0.5, stagger: 0.09 }, atf('s12_portal', 0.27))
        /* "and a notification when a new plan is approved" */
        .from('#s12badge', { opacity: 0, x: -12, duration: 0.5, ease: 'power2.out' }, atf('s12_portal', 0.31))
        .to('#s12frame .pstar', { y: -12, rotate: 9, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: 0.7 }, atf('s12_portal', 0.30))
        /* the badge pulse, on the timeline (never a CSS loop) so a seek is deterministic */
        .fromTo('#s12badge i', { boxShadow: '0 0 0 0 rgba(255,255,255,.55)' },
          { boxShadow: '0 0 0 6px rgba(255,255,255,0)', duration: 0.8, repeat: 6, ease: 'power2.out', immediateRender: false }, atf('s12_portal', 0.36))
        /* "No observer's rough notes, no other teachers" */
        .from('#s12cap', { opacity: 0, y: 10, duration: 0.6 }, atf('s12_portal', 0.66));
      spotlight('#s12badge', atf('s12_portal', 0.33), 2.0);                     // "a notification when a new plan is approved"
