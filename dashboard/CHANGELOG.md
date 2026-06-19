# AIS Observation Dashboard . changelog

Every dashboard release bumps the footer badge in `src/index.html`, adds a row to
the Settings "Build history" panel, appends an entry here, and is git-tagged
`dash-vX.Y` so any version can be restored. Live (gated, password `ais2026ais`):
https://rogerceaser21.github.io/Data-Representation/dashboard/

## v0.25 . 2026-06-20
- **Story rebuilt so the animation tells the story with the data, not illustrations.** Removed the hand-drawn SVGs (the teacher cluster and the eye/lens). The hero motion is now a **SEAS dot-sort**: each lesson is a dot that flies in (CSS keyframes, rAF-safe) and sorts onto the six-point rating scale by colour, beside the gauge sweep. The numbers beat is big count-ups; the cover uses a generated AIS-toned image (`assets/snapshot-cover.jpg`).
- **Uses ONLY the V1 (Detail) wording + stats.** Removed all invented narration ("How is progress?", "What we did", "the progress picture", etc.). Beats now carry the V1 labels verbatim: "Student progress . best evidence per teacher", "What is working" + its evidence line + summary + bullets + "Insights . what the evidence reveals", "Where to focus next", "Progress distribution . Primary & Kindy against Secondary", "Insights . drawing the two together".
- Beats per phase: cover, numbers (count-ups), student progress (dot-sort + gauge), what-is-working bullets, its insights, where-to-focus bullets, its insights. Compare: cover, numbers (PK vs Secondary cards), distribution (diverging), insights.
- Controls unchanged: auto-play with play/pause, prev/next + arrows, beat dots, full-screen Present, Settings auto-play on/off. Detail (v1) one click away. Coverage and Observations untouched. Both themes; no console errors.
- Rollback: `dash-v0.24`.

## v0.24 . 2026-06-19
- **New animated Story view, now the Snapshot landing.** A beat-by-beat narrative built to the `look-cinematic.html` motion grammar (overlapping GSAP timeline, blur-up headings, back.out pops, stroke-dash draw-on, count-ups). Per phase, 7 beats: cover, scale (custom **Teacher** figure-cluster SVG + **Observations** lens SVG, both animated, with count-ups), progress (gauge sweep + distribution), what-is-working bullets, its insights, where-to-focus bullets, its insights. Compare has its own 4 beats ending on the diverging distribution + cross-phase insights.
- **Auto-play with full control:** plays on its own, with Play/Pause, Prev/Next (and arrow keys), beat dots, a full-screen **Present** mode (Esc to exit), and an **Auto-play on/off** switch in Settings (persisted; off shows the story static and you step it). Space toggles play.
- **The original cards are preserved as Detail (v1)**, one click away via a Story | Detail toggle. Same data, same phase toggle. Reuses `snapAgg`/`NARR`/`buildValueArc`/`renderHisto`/`renderDiv`.
- **Login always lands on Snapshot** (stale hash cleared on entry). Leaving Snapshot pauses the story and drops full-screen.
- **Scope:** all additions are inside the Snapshot view (`#snapStory` + the slide engine). **Coverage and Observations are not touched.** rAF-safe: the active beat is shown via a CSS class at final visible state, entrances are `immediateRender:false` + `settle()`, so a frozen or restored tab never strands a beat; reduced-motion respected; no em/en dashes.
- Fixed a load-order TDZ (the `snapReady` gate already added in v0.23 covers the new `resolveArea` use).
- Rollback: `dash-v0.23`.

## v0.23 . 2026-06-19
- **Data accuracy fix: the Snapshot now counts distinct LESSONS, not raw form submissions.** During the June inspection week most lessons were co-observed by two inspectors who each filed a form (plus a few accidental resubmissions), so the raw 167 rows over-counted real lessons. `snapAgg()` now collapses a teacher's June submissions into lessons by **teacher + date + normalised subject** (the resolved subject area, folding variants like "Music" / "QCE Music In Practice"), resolving each judgement by **best score wins (min)** across co-observers.
- **Corrected figures** (verified against Supabase and the source Sheet): whole sweep **109 lessons / 103 teachers** (was 167); Primary & Kindy **47 / 45** (was 68); Secondary **62 / 58** (was 99). Progress distribution per lesson: PK `2,9,13,15,3,0`; Secondary `6,12,12,20,4,4`, so **Secondary Very Weak = 4** (the v0.22 board showed 8, which was 4 lessons each filed by two inspectors) and Outstanding = 6. Average progress and teacher counts are unchanged (best-per-teacher is invariant to duplicates): PK 3.19, Secondary 3.24, overall 3.22.
- The insight copy numbers were corrected to the deduped basis (lesson counts, Very Weak 4, Outstanding 6, evidence-base note counts) with the qualitative findings kept.
- **Scope:** the dedupe is isolated to the Snapshot (`snapAgg` + a `lessonSubjKey` helper). It only READS `D.teachers[].observations` and never mutates them, so the **Observations board is untouched** and still shows every individual submission, and Coverage is unchanged. Fixed a load-order bug: gated the initial `applyTheme` render (`snapReady`) because `snapAgg` now uses `resolveArea`, a const defined lower in the file.
- Retrieval stays Supabase-first (`get_raw_snapshot`); the dedupe runs identically on live and the baked fallback.
- Rollback: `dash-v0.22`.

## v0.22 . 2026-06-19
- **New Snapshot board, now the landing view** (`#v-snapshot`, first nav pill, default no-hash route; Coverage moves to `#coverage`). A governance "at a glance" picture of the June R3 sweep (`SNAP_ROUND='R3 June 26'`), scoped to that round only.
- **Phase toggle: Primary & Kindy | Secondary | Compare** (`#phaseTabs`, `snapPhase`). A persistent "Whole June sweep" band shows the overall lessons/teachers/average progress; each phase view adds its own lessons observed, teachers seen, average progress, a ramp gauge, and a six-point progress distribution histogram, plus "What is working" and "Where to focus next" summaries with bullets and **three insights for each**. Compare puts the two phases side by side with a **diverging distribution chart** and three cross-phase insights.
- **Per-phase numbers are computed live from `D`** (`snapAgg()`), so they track both the baked snapshot and the live Supabase swap. Average progress = the best Progress rating (r3_02) per teacher (best evidence wins), averaged across teachers. Verified against SQL: Primary & Kindy 68 lessons / 45 teachers / 3.19; Secondary 99 / 58 / 3.24; overall 167 / 103 / 3.22.
- **Teacher `section` (subschool) is now populated in Supabase** from the R3 Sheet Teachers tab (Kindy/Primary/Secondary), via the new reproducible tool `db/set_sections.mjs`. The export + RPC + `shapeSnapshot` already carried `section`; it was just unpopulated. `data.js` rebaked so the offline fallback matches.
- The insight copy is the human synthesis of the round's written strengths and areas to develop (Australian English, no em/en dashes). All new visuals are rAF-safe (histogram + diverging bars use reflow + CSS transition; the gauge is final-state + a CSS fade), light and dark first-class.
- Rollback: `dash-v0.21`.

## v0.21 . 2026-06-18
- **Dashboard now reads live from Supabase (Option A: anon read, login-less; the StatiCrypt gate stays as the soft lock).** It paints the baked `data.js` snapshot first (instant + offline fallback), then `loadLive()` upgrades `window.__AIS_DATA` to live data and re-renders the current view. Edits in Supabase now show on refresh.
- New Postgres RPC `public.get_raw_snapshot()` (`db/migrate_03_dashboard_rpc.sql`, SECURITY DEFINER, EXECUTE granted to `anon`/`authenticated`) returns the five raw query results that `export_snapshot.mjs` pulls. The browser runs the SAME shaping (`shapeSnapshot`, ported verbatim incl. `resolveArea` + inlined area map) into the identical `__AIS_DATA` shape. Validated: live vs baked match exactly on coverage, quality, scores, departments, criteria, inspectors, names, ids, tokens; the only delta is observation dates, which the baked snapshot had shifted 1 day early via an export timezone artifact, the live read is correct.
- `D`/`WORD`/`SCALE_WORDS`/`CRIT_LABEL` made reassignable; `deriveFromD()` re-derives them after the live swap. Fetch is guarded (7s `AbortController` timeout, shape/length checks, try/catch); any failure silently keeps the baked snapshot, no error UI.
- `data.js` is KEPT as the encrypted fallback (not rebuilt). Auth/RLS: tables stay RLS-on; only the definer RPC is exposed to anon. Supabase URL + publishable key live in the master (client-safe) and ship inside the StatiCrypt-encrypted page.
- Next: @ais.ae sign-in + per-role RLS; the R3 form dual-write (Sheet + Supabase) so submissions land live.
- Rollback: `dash-v0.20` (and the RPC can be dropped; the dashboard falls back to baked automatically if the RPC is gone).

## v0.20 . 2026-06-18
- Masthead controls removed: the "Stars" and "Dark"/theme buttons are deleted from the top bar (the `.ctrls` block). Both toggles remain in Settings (`#starsToggle`, `#themeToggle`) and still work.
- Added a floating light/dark toggle modelled on the R3 form: a round sun (light) / moon (dark) icon button (`.themeico` / `#themeFloat`) fixed in the **top-right** corner, z-index 50 (above the masthead, below the entry splash). Same SVG icons and theme-swap behaviour as R3.
- JS: dropped the masthead-button references; `toggleTheme` is wired to both the floating button and the Settings switch; `applyStars` wired to the Settings stars switch; removed the old `themeBtn.textContent` line (the floating icon swaps via CSS, the Settings `#themeName` label still updates). Removed the dead `.ctrls` / `.tg` CSS.
- Rollback: `dash-v0.19`.

## v0.19 . 2026-06-18
- R3 Obs is now a fan-out dropdown menu of observation LEVELS (front-end only; only Teacher Level is wired to data):
  - **Teacher Level** -> the existing teacher search + list/detail (unchanged behaviour).
  - **Grade / Department Level** -> a styled placeholder panel (note: assigned grades/departments to be connected later).
  - **School Level** -> expands inline to **Kindy, Lower Primary, Upper Primary, Whole Primary, Secondary**; each lands on the placeholder panel naming the segment.
- The R3 Obs button (`#r3ObsBtn`, now with a caret) stays visible in every Observations state as the menu trigger. Menu (`#obsMenu`) opens on click with a staggered reveal, School expands `#subSchool` inline (accordion), and it closes on selection or outside-click. New placeholder panel `#obsPlaceholder` (`phKick`/`phTitle`/`phNote`).
- `obsView` generalised to `'hub' | 'teacher' | 'placeholder'`; helpers `setObsMenu`, `showPlaceholder`, `enterTeacherLevel`. The `[hidden]` global rule (v0.18) keeps the menu/sub-list hide reliable. No new URLs: sub-levels stay in-page under the `#teachers` hash.
- Rollback: `dash-v0.18`.

## v0.18 . 2026-06-18
- Fixed the Observations search. Root cause: `.search{display:flex}` overrode the `hidden` attribute on `#tsearchWrap`, so the search bar showed in the hub state (before R3 Obs was clicked) where `obsView` is still `'hub'` and the list is hidden, making it look like search did nothing. Fix: a global `[hidden]{display:none!important}` so the attribute always wins. Now hub shows only the R3 Obs button; entering it shows the search + list and typing filters.
- Added hash routing so each tab has its own URL: Observations = `#teachers`, Settings = `#settings`, Coverage = no hash (default). `showBoard` calls `syncHash`; a `hashchange` listener handles deep links and browser back/forward; on load the board named in the hash is opened after the entry sequence. The link now changes and is bookmarkable/refresh-safe. (A pure no-`#` path would need a separate built page or a 404 redirect on static Pages; hash chosen by Igor.)
- Rollback: `dash-v0.17`.

## v0.17 . 2026-06-18
- Observations tab tightened to one line. The R3 Obs button (hub) and the teacher search bar + "Not yet observed" filter (work) now live inline in the `.head` next to the "Observations" kick, in a new `.obshead` flex cluster, instead of each sitting in its own stacked panel. Only the active state's control shows; the list / detail render below. `#obsHub` and `#obsSearchCard` panels removed; `#obsListCard` (just the list) + `#obsDetail` remain. `layoutObs` retargeted to `#r3ObsBtn` / `#tsearchWrap` / `#fltNoobs` / `#obsListCard` / `#obsDetail`.
- Removed the coloured index letters: the yellow `A` / `B` (`.ix`) on the Coverage and Observations pills, and the redundant yellow `R3` on the R3 Obs button (it still reads "R3 Obs"). The kicks are simplified from "Board A . Coverage" / "Board B . Observations" to "Coverage" / "Observations" (Settings already plain). The now-dead `.pill .ix` rule was removed.
- No navigation change: the Observations tab was already a same-page view switch (single HTML, sections toggled); the URL never changes.
- Rollback: `dash-v0.16`.

## v0.16 . 2026-06-18
- The "Teacher" tab is renamed "Observations" and turned into a 3-state workflow (internal board key stays `teacher`).
  - **Hub:** opening the tab lands on a hub card with a single "R3 Obs" button (room for more observation systems later).
  - **Search:** clicking R3 Obs reveals the teacher search card, which is MOVED off the Coverage page into here (Coverage is now overview-only: stats, ring, distribution, spread, not-yet-observed). No teacher detail shows yet.
  - **Detail:** picking a teacher hides the list and keeps only the search bar at the top, with the selected teacher's drill-down (the former Teacher page) below it. Typing in the search again re-shows the list so you can switch teacher; the "Not yet observed" filter and the list only appear while browsing.
  - Back returns to Coverage from any state.
- Implementation: new `obsView` ('hub'|'work') + `layoutObs()` toggles `#obsHub` / `#obsSearchCard` / `#obsDetail`; `showBoard('teacher')` resets to the hub and clears the selection; `openTeacher` now transitions the sub-state (no board switch) and keeps the FLIP name animation; `renderTlist` removed from the Coverage render and theme-toggle paths, with the teacher re-render guarded to the detail state.
- Rollback: `dash-v0.15`.

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
