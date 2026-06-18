# AIS Observation Dashboard . changelog

Every dashboard release bumps the footer badge in `src/index.html`, adds a row to
the Settings "Build history" panel, appends an entry here, and is git-tagged
`dash-vX.Y` so any version can be restored. Live (gated, password `ais2026ais`):
https://rogerceaser21.github.io/Data-Representation/dashboard/

## v0.15 . 2026-06-18
- All-observations SEAS bar refined per Igor. The six cards are now JOINED into one seamless bar: `.osseg .osramp` is a single rounded, bordered, `overflow:hidden` container and each `.rc` is a borderless `flex:1` swatch+label that butts against its neighbours (no gaps, no dividers). The numbers are removed (word only).
- The observation dots now reserve REAL height instead of overflowing: `specHTML` computes the tallest same-score stack (`maxStk`) and sets `.osdots` height inline (`16 + (maxStk-1)*14`px); dots are bottom-anchored (`bottom:(stk-1)*14px`) just above the bar and stack upward. So the All card GROWS to hold a tall stack rather than bleeding over the "All observations / N observations" headers.
- The bar is bottom-aligned: `.allmain` switched `align-items:center -> end`, so the segmented bar and both gauges share a baseline and the bar never drops below the gauge circles (Igor's constraint). Gauges bottom-align to the same line.
- Scope unchanged: still only the All-observations card (the `segmented` branch). Per-session cards keep the smooth gradient bar and centre-stacked dots.
- Rollback: `dash-v0.14` (cards with gaps + numbers), `dash-v0.13` (smooth gradient bar).

## v0.14 . 2026-06-18
- All-observations Spectrum restyled as the official SEAS scale (Option B). The single smooth gradient bar is replaced by six SEAS cards, the same `.rc` card used by the design-spec ramp: a colour swatch (`--r1..--r6`) over the judgement word + number, centred, one card per scale point. The observation dots still float ABOVE the card row and the teacher-average triangle below, pointing up.
- Scoped to the All-observations card only via a new `segmented` flag on the shared `specHTML(items, flagVal, selIdx, segmented)`; passed `true` from both the initial All render and the on-select re-render. The per-session cards pass nothing and keep the smooth gradient bar, so nothing else changed.
- Card colours use the ramp CSS vars, so they reflow on theme toggle (the All card rebuilds via renderTeacher). Entrance stays CSS-only (`.ospec` specin), so the freeze-safety rule holds.
- Rollback: the previous look is tagged `dash-v0.13`.

## v0.13 . 2026-06-18
- All-observations card made symmetric. The Student Progress gauge moved to the LEFT of the Spectrum and a new Teaching gauge added to the RIGHT, so the card reads [Student Progress | Spectrum | Teaching]. Three matched `.ey-bold` headers now sit one per column (Student Progress | All observations | Teaching); both grids share `196px 1fr 196px` columns so each title sits above its column, and the gauge centres still line up with the Spectrum bar (align-items:center).
- Teaching gauge = the "Teaching" judgement only (criterion `r3_05`), teacher-wide average, always reads ALL, never recalced on session select (identical rule to Student Progress). Rim dots = each observation's Teaching score, centre word = the average.
- Teaching is an exact horizontal mirror of Student Progress: gap opens LEFT and it fills clockwise (Student opens right, anticlockwise). `buildArc` is now generic (`buildArc(t, svgId, scoreFn, avgFn, mirror)`); mirror flips the start angle (135->225) and sweep (270->-270) and the arc sweep-flag, reflecting the whole drawing about x=120 (verified numerically) while the centre word stays upright. `arcP` gained an optional sweep-flag arg (default 0, so the rest of the gauge is unchanged).

## v0.12 . 2026-06-18
- Spectrum average marker (`.osflag`) fixed. It was a CSS triangle built with a solid `border-top`, which points DOWN (away from the bar, into empty space below the scale). Swapped to a solid `border-bottom` so it points UP at the bar, marking the teacher-wide average's position on the scale (and the inline ramp colour moved from `border-top-color` to `border-bottom-color` in `specHTML` so it stays score-coloured). Also enlarged 25% (6px->7.5px sides, 8px->10px height; `margin-left` -6px->-7.5px to keep it centred). One shared engine, so every Spectrum (session cards + All-observations card) is fixed at once.

## v0.11 . 2026-06-17
- All-observations card rebalanced. "All observations" and "Student Progress" are now two matched bold headers (`.ey-bold`) for congruency.
- The Student Progress gauge is pulled up and vertically centred so its circle's middle lines up with the middle of the Spectrum bar. The gauge `viewBox` is cropped+centred on the circle, and `.allmain` uses `align-items:center`; because the Spectrum dots are absolutely positioned they never move the bar, so the alignment holds regardless of how many dots stack.
- The card is trimmed to the height it actually needs (no more tall empty space).
- Session cards and the shared Spectrum engine untouched.

## v0.10 . 2026-06-17
- All-observations card cleanup: removed the inspector legend and the "Average of observations" word; the Student Progress label is now bold and the gauge is pulled up beside the Spectrum.
- Freeze bug fixed properly. The previous GSAP-from-invisible entrances (plus the `finalizeViz` rescue) could still strand the Spectrum dots and the gauge blank after the tab was backgrounded (opening the R3 record in a new tab) or bfcached. The Spectrum (`.ospec`/`.osbar`) and gauge (`#svgArc`) entrances are now CSS keyframe animations on a resting-visible base: CSS animations run on the real-time document timeline (not requestAnimationFrame), so they always complete to the final visible state whether or not the tab was ever painted. Removed `animSpec`, `finalizeViz`, and the dead `.olegend`/`.oavg` CSS.

## v0.9 . 2026-06-17
- Merged the three top graphs into the All-observations card. The two top centerpiece cards (The Spectrum, Overall gauge) are removed.
- The Spectrum and the old All-observations bar showed the same data (one dot per observation at its best-skill score); they are now a single full-width HTML/CSS Spectrum inside the All-observations card, stretched the full card width with the judgement words at the individual-card size.
- The gauge is renamed Student Progress and now shows ONLY the Progress judgement (criterion r3_02): the rim dots are each observation's Progress score and the fill/word is the teacher-wide average. It is built once and always reads all observations; it does not recalculate when a single session is selected.
- Selecting a session still rings its dot on the merged Spectrum (data and flag unchanged); the gauge is untouched.
- Freeze fix: the gauge and the spectrums animate their content in from invisible, so a backgrounded or bfcached tab (for example after opening the R3 record in a new tab) used to strand them blank. A pageshow/visibilitychange `finalizeViz` now forces the final visible state on restore.
- Individual session cards are unchanged.

## v0.8 . 2026-06-16
- Card refinements (no data change). Clicking anywhere on a card now selects it (the chevrons and links no longer swallow the click).
- The Inspection details and Skills observed arrows sit beside their titles (not far-right), gently bob to signal they open, and open BOTH columns together; the Observation Notes toggle stays independent.
- The session-card Spectrum is now a full-width HTML/CSS bar at a fixed thin height (a width-scaled SVG was magnifying it), with the judgement words at the Observation Notes text size; the gradient uses the theme ramp variables so it reflows on theme change.
- The Inspection details and Skills observed headers now match the Observation Notes header size.

## v0.7 . 2026-06-16
- Observation card redesign (Option A, "Ledger"), built from the agreed preview in `dashboard-previews/card-A-revised.html`.
- Top of each session card is now two titled, collapsible columns: Inspection details (inspector, subject, area) and Skills observed (each skill with its word and colour swatch on the right). Both start collapsed for a condensed card.
- The Spectrum stretches to the full width of the card.
- A condensed action bar at the bottom holds the observed teacher's name (left), the centred Observation Notes toggle, and a text-only "Open the R3 record" link (right).
- Expander reveals the observation's Observation notes, Strengths, and Areas to develop. The R3 record link opens the locked viewer (`Assets/R3/r3-record.html?id=...&token=...`) and appears only for the live June submissions (February has no token).
- The All-observations card now animates on selection.
- Data snapshot (`db/export_snapshot.mjs`) now carries `notes`, `strengths`, `weakness`, `source`, and the per-record `token`.

## v0.6 . 2026-06-16
- All-observations card reflects the selected session (rings its dot).

## v0.5 . 2026-06-16
- Session-card redesign: subject and subject area, purple selection ring, restored animations.

## v0.4 . 2026-06-16
- Scoring: best skill wins per observation (MIN); teacher overall is the average of those per-observation scores.

## v0.3 . 2026-06-16
- Card ramps match the Spectrum; one fixed colour per skill.

## v0.2 . 2026-06-16
- Per-session scoring and a dynamic observations list.

## v0.1 . 2026-06-15
- First Cinematic build: Coverage board + Teacher drill-down, light default + dark, AIS star-field, StatiCrypt-gated.
