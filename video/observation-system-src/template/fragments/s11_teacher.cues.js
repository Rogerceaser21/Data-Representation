/* 11 . teacher view
   The two SEAS gauges are drawn by the dashboard's own buildArc(): same cx/cy/r/
   stroke width, same 48 segments, same mirrored Teaching arc, same rim dots and
   centre word. Ported verbatim (no Math.random, no timers) so the video shows the
   product's gauge, not a lookalike. Drawn at FINAL state; the only motion is the
   GSAP fade-in of the filled segments, so a frozen frame reads complete. */
      (function () {
        var NS = 'http://www.w3.org/2000/svg';
        var WORD = { 1: 'Outstanding', 2: 'Very Good', 3: 'Good', 4: 'Acceptable', 5: 'Weak', 6: 'Very Weak' };
        function gc(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
        function RAMP() { return { 1: gc('--r1'), 2: gc('--r2'), 3: gc('--r3'), 4: gc('--r4'), 5: gc('--r5'), 6: gc('--r6') }; }
        function h2r(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
        function lerp(a, b, t) { return a + (b - a) * t; }
        function rampAt(p) { var R = RAMP(); p = Math.max(1, Math.min(6, p)); var lo = Math.floor(p), hi = Math.min(6, lo + 1), t = p - lo, a = h2r(R[lo]), b = h2r(R[hi]);
          return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')'; }
        function svgEl(t, a) { var n = document.createElementNS(NS, t); for (var k in a) n.setAttribute(k, a[k]); return n; }
        function pol(cx, cy, r, d) { var a = (d - 90) * Math.PI / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
        function arcP(cx, cy, r, a0, a1, sweep) { var s = pol(cx, cy, r, a1), e = pol(cx, cy, r, a0); var big = Math.abs(a1 - a0) <= 180 ? 0 : 1;
          return 'M ' + s.x + ' ' + s.y + ' A ' + r + ' ' + r + ' 0 ' + big + ' ' + (sweep || 0) + ' ' + e.x + ' ' + e.y; }
        function frac(r) { return r == null ? 0 : (6 - r) / 5; }
        function wordOf(v) { return v == null ? 'Not assessed' : WORD[Math.min(6, Math.max(1, Math.round(v)))]; }
        function buildArc(svgId, scores, ov, mirror) {
          var s = document.getElementById(svgId); if (!s) return; s.innerHTML = '';
          var cx = 120, cy = 120, r = 80, sw = 14, N = 48;
          var A0 = mirror ? 225 : 135, SW = mirror ? -270 : 270, sweepFlag = mirror ? 1 : 0, nudge = mirror ? -0.6 : 0.6;
          var ang = function (p) { return A0 + SW * p; };
          var seg = function (p0, p1, c, o, cls) {
            var path = svgEl('path', { d: arcP(cx, cy, r, ang(p0), ang(p1) + nudge, sweepFlag), fill: 'none', stroke: c, 'stroke-width': sw, opacity: o });
            if (cls) path.setAttribute('class', cls); s.appendChild(path); return path;
          };
          for (var i = 0; i < N; i++) { var a = i / N, b = (i + 1) / N; seg(a, b, rampAt(6 - 5 * ((a + b) / 2)), 0.2); }
          var M = Math.max(1, Math.round(N * frac(ov)));
          for (var j = 0; j < M; j++) { var a2 = j / N, b2 = (j + 1) / N; seg(a2, b2, rampAt(6 - 5 * ((a2 + b2) / 2)), 1, 'arcfill'); }
          scores.forEach(function (v) { var p = pol(cx, cy, r + 16, ang(frac(v)));
            s.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 4.5, fill: rampAt(v), stroke: gc('--bg'), 'stroke-width': 2.5, 'class': 'arcdot' })); });
          var w = svgEl('text', { x: cx, y: cy + 8, 'text-anchor': 'middle', 'font-size': 22, fill: rampAt(ov), 'class': 'arcword',
            style: 'font-family:var(--display);font-weight:600;font-style:italic' });
          w.textContent = wordOf(ov); s.appendChild(w);
        }
        /* Illustrative record: three sessions, Progress 4/4/3 (avg 3.67 Acceptable),
           Teaching 3/3/2 (avg 2.67 Good). The Teaching arc is the mirrored one. */
        buildArc('s11arcP', [4, 4, 3], 3.667, false);
        buildArc('s11arcT', [3, 3, 2], 2.667, true);
      })();

      tl.from('#s11top', { opacity: 0, y: 16, duration: 0.7 }, at('s11_teacher', -0.4))
        .from('#s11all', { opacity: 0, y: 18, duration: 0.8, ease: 'power2.out' }, at('s11_teacher', 0.1))
        /* "Two gauges, student progress and teaching" */
        .from('#s11arcP .arcfill', { opacity: 0, duration: 0.45, stagger: 0.018, ease: 'none' }, atf('s11_teacher', 0.113))
        .from('#s11arcT .arcfill', { opacity: 0, duration: 0.45, stagger: 0.018, ease: 'none' }, atf('s11_teacher', 0.113))
        .from('#s11all .osramp', { scaleX: 0, transformOrigin: 'left center', duration: 0.6, ease: 'power2.out' }, atf('s11_teacher', 0.161))
        /* "averaged across every observation" */
        .from('#sc11 .arcword', { opacity: 0, duration: 0.6 }, atf('s11_teacher', 0.197))
        .from('#sc11 .arcdot', { opacity: 0, scale: 0.4, duration: 0.4, stagger: 0.09, ease: 'back.out(2)' }, atf('s11_teacher', 0.207))
        .from('#s11all .osd', { opacity: 0, y: -8, scale: 0.4, duration: 0.4, stagger: 0.1, ease: 'back.out(2)' }, atf('s11_teacher', 0.217))
        .from('#s11flag', { opacity: 0, y: -6, duration: 0.5 }, atf('s11_teacher', 0.247))
        /* "Each session, its skills and its notes, one card each" */
        .from('#s11sess', { opacity: 0, x: -18, duration: 0.7, ease: 'power2.out' }, atf('s11_teacher', 0.254))
        .from('#s11sess .odrow', { opacity: 0, x: -10, duration: 0.45, stagger: 0.07 }, atf('s11_teacher', 0.28))
        /* "And below them, a coaching plan" */
        .from('#s11coach', { opacity: 0, y: 18, duration: 0.8, ease: 'power2.out' }, atf('s11_teacher', 0.394))
        .from('#s11lad .ns-cell', { opacity: 0, scaleX: 0.3, duration: 0.4, stagger: 0.04, ease: 'power2.out' }, atf('s11_teacher', 0.42))
        .from('#s11lad .ns-lad-mv', { opacity: 0, x: 10, duration: 0.5, stagger: 0.18 }, atf('s11_teacher', 0.43))
        .from('#s11sum', { opacity: 0, duration: 0.6 }, atf('s11_teacher', 0.44))
        /* the focus card lands as ONE unit: a half-populated card reads as broken */
        .from('#s11fc', { opacity: 0, y: 16, duration: 0.7, ease: 'power2.out' }, atf('s11_teacher', 0.45))
        /* "checked word for word against the source": the summary line lifts to
           full ink and releases back to its resting --ink-dim */
        .to('#s11sum', { color: '#14233f', duration: 0.45, ease: 'power2.out' }, atf('s11_teacher', 0.592))
        .to('#s11sum', { color: '#3a4a66', duration: 0.6, ease: 'power2.inOut' }, atf('s11_teacher', 0.592) + 1.2)
        /* "grounded in the school's own rubric": the Grounded in column's rail
           lifts to --y. Inset shadow, so the resting frame carries no rail. */
        .fromTo('#s11fc .fc-r', { boxShadow: 'inset 3px 0 0 0 rgba(201,137,12,0)' },
          { boxShadow: 'inset 3px 0 0 0 rgba(201,137,12,.9)', duration: 0.5, ease: 'power2.out', immediateRender: false }, atf('s11_teacher', 0.690))
        .to('#s11fc .fc-r', { boxShadow: 'inset 3px 0 0 0 rgba(201,137,12,0)', duration: 0.6, ease: 'power2.inOut' }, atf('s11_teacher', 0.690) + 1.4)
        /* "then amended if needed" */
        .from('#s11amd', { opacity: 0, scale: 0.86, duration: 0.5, ease: 'back.out(1.7)' }, atf('s11_teacher', 0.775))
        /* the badge box holds ONE state at a time: each earlier word is off before
           the next one starts, so no two words ever paint in the same box. The
           hand-offs are fromTo(immediateRender:false), so the resting state is the
           final one: Draft and Amended at 0, Approved alone and visible. */
        .fromTo('#s11draft', { opacity: 1 },
          { opacity: 0, duration: 0.28, ease: 'power2.in', immediateRender: false }, atf('s11_teacher', 0.775) - 0.28)
        .fromTo('#s11amd', { opacity: 1 },
          { opacity: 0, duration: 0.28, ease: 'power2.in', immediateRender: false }, atf('s11_teacher', 0.845) - 0.28)
        /* "and approved by the teacher coach before the teacher ever sees it" */
        .from('#s11appr', { opacity: 0, scale: 0.86, duration: 0.5, ease: 'back.out(1.7)' }, atf('s11_teacher', 0.845));
      spotlight('#s11coach', atf('s11_teacher', 0.479), 2.4);                   // "drafted by AI from that teacher's own lessons"
      tl.to('#s11all, #s11sess', { opacity: 0.5, duration: 0.45 }, atf('s11_teacher', 0.479))
        .to('#s11all, #s11sess', { opacity: 1, duration: 0.6 }, atf('s11_teacher', 0.479) + 2.4);
