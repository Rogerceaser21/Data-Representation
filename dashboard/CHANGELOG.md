# AIS Observation Dashboard . changelog

Every dashboard release bumps the footer badge in `src/index.html`, adds a row to
the Settings "Build history" panel, appends an entry here, and is git-tagged
`dash-vX.Y` so any version can be restored. Live (gated, password `ais2026ais`):
https://rogerceaser21.github.io/Data-Representation/dashboard/

## v0.47 . 2026-06-26
- **Report opens as its own page; the buttons are tidied.** Choosing Simple or In Depth from the Report menu now routes to a standalone report page (the link reads `/dashboard/#report`, bookmarkable, and browser back returns to the live Snapshot). On the report page the Story / Detail toggle and the dropdown are gone, replaced by a **Back** button and a solid **Simple | In Depth** switch; "Make Google Doc" stays in the report header.
- **The report is now a clean monochrome governance document.** The green, terracotta and gold accents on its section headers, "Insights" labels, insight numbers, the average-progress word and the `R3` title are all removed (navy ink throughout). The live Snapshot header, Story and Detail views keep their colour; only the report body changed.
- **Uniform Snapshot controls.** The phase tabs (Primary & Kindy / Secondary / Compare), Story / Detail, Present and Report are all one size now (38px tall). The round step controls (prev / play / next, A- / A+) stay as icon buttons by design.
- **Admin Settings password popup restyled to match the R3 form's admin card:** AIS gradient top-bar, "AIS . Admin" eyebrow, a Settings display heading, a framed password input, and a ghost **Close** + green **Unlock** pair (the old plain card with the corner x is gone). Works in both light and dark.
- Scope: Snapshot board only (report + tab row + the Settings gate). Coverage, Observations and the Doc export are untouched. Rollback: `dash-v0.46`.

## v0.46 . 2026-06-26
- **The coaching section now explicitly references the AIS progress rubric, using BOTH of its aspects.** "How to move Acceptable to Good" is anchored to the rubric (cited + linked) and frames progression on the rubric's two aspects: **Progress in Lessons** (the outcome, Acceptable to Good) and **Facilitating better than expected progress** (the teaching behaviour). Each direction now shows the move + the Facilitating rubric descriptor it strengthens + the R3 evidence. The In Depth Google Doc carries the same.
- Stored round-scoped in Supabase (a coaching intro row + a rubric descriptor per direction in `narrative.method`) so it carries into the Doc and the future next-round prompt.
- Scope: the In Depth coaching section only (on-screen + Doc). Rollback: `dash-v0.45`.

## v0.45 . 2026-06-25
- **Doc design reworked to the approved AIS-branded concept (v3)** after the first pass read as incoherent (clashing colours, mixed bullets/numbers, stray italics): Playfair Display headings + Lato body, AIS navy with a gold accent (green/terracotta kept only on the What-is-working / Where-to-focus labels), one consistent bullet style, a stat callout, insight cards, and the first tab renamed "Report". Three concepts were mocked up and reviewed; Igor picked v3. Apps Script redeployed in place.
- **Both reports export to a styled Google Doc with the navy cover.** The Simple Doc is card-styled (white page, the cover image, each section in a 1-cell-table card) to mirror the on-screen report; the In Depth Doc is a formal report (cover, a Contents list, then In summary, the phases, the comparison, and How to move Acceptable to Good). Every claim still ends with a numbered marker linked to a real References tab.
- The cover is inserted by URL via the Docs API (`dashboard/assets/report-cover.png`, a high-resolution render of the Story cover slide), so no new Apps Script permission was needed. `buildDocModel` now sends the report `kind`, the cover URL, and the summary + coaching sections; `Code.gs` branches into `buildSimple` (cards) and `buildInDepth` (report + Contents).
- Constraints (Google Docs limits): cards are square-cornered; the Contents is a styled list, not an auto page-numbered TOC (the headings still drive the document outline).
- Scope: export only; the on-screen dashboard is unchanged. Apps Script redeployed in place (same `/exec`). Rollback: `dash-v0.44`.

## v0.44 . 2026-06-25
- **In Depth now opens with an executive summary ("In summary").** A short lead gives the round's picture and the shape behind the average: of the lessons with a progress rating, about half are Good or better, about a third sit at Acceptable, and about one in ten are below; Acceptable is the biggest movable group. Then four headline points, each backed by its evidence behind a marker: the most consistent strength, the main development focus (the ceiling, not the floor), the Primary versus Secondary contrast, and the move to Good by phase.
- Stored round-scoped in Supabase (`narrative` `section='summary'`, phase `all`): the lead has no marker (it is the headline numbers, like the scope line); the four points carry their references. Front-end builds `SUMMARY` in `applyNarrItems` + renders `execSection()` at the top of In Depth.
- Scope: In Depth report ONLY. Verified in preview: the section sits above the phases, the lead reads the distribution, the four points open the sources panel, no console errors.
- Rollback: `dash-v0.43`.

## v0.43 . 2026-06-25
- **The two governor summaries in the In Depth coaching section now carry their own evidence marker.** They were the only claims in the section without one. Each marker opens a representative, balanced set of supporting lessons (a round-robin across that phase's coaching directions, deduped to lessons, up to 12), so the summary is backed like every other statement. New `narrative_ref` rows for `pk_coach_sum` / `secondary_coach_sum`; the front-end renders the marker on `.rec-gov`.
- Scope: In Depth coaching section only. Verified in preview: both summaries show a 12-source marker that opens the panel, no console errors.
- Rollback: `dash-v0.42`.

## v0.42 . 2026-06-25
- **In Depth gains a "How to move Acceptable to Good" coaching section (In Depth only).** For each phase (Primary & Kindy, Secondary) it shows a governor summary plus a set of "Where Coaching Could Help" directions. Each direction is grounded in the AIS progress rubric (the coaching Google Doc) and this round's written evidence: it names what the Good and better lessons did that the Acceptable lessons were flagged for missing, with the concrete classroom move and a "what good looks like" indicator. All supporting lessons sit behind the numbered marker (Good+ exemplars + Acceptable-gap lessons; 6 to 17 each; no teacher names).
- **Stored in Supabase, round-scoped.** New `narrative` rows (`section='coaching'`, kind `summary` + `recommendation`) + `narrative_ref` evidence, so the section recompiles for the next round and feeds the reusable prompt. No schema or RPC change (the generic `get_narrative` carries them); baked into `data.js` for first paint. Tooling: `db/recs_prep.mjs` + `db/recs_seed.mjs`.
- Scope: the new section renders in the In Depth report ONLY (not Simple, not Story/Detail). Coverage and Observations untouched. The Google Doc export does not yet carry the coaching section (next step). Verified in preview: both phases, markers open the sources panel with quotes + why-notes + record links, no console errors.
- Rollback: `dash-v0.41`.

## v0.41 . 2026-06-25
- **In Depth report rebuilt to the readable Simple layout.** The v0.40 In Depth printed every supporting quote inline under each claim, which was too dense to read. In Depth now uses the same clean layout as the Simple report (the summaries, bullets and insights, with each claim's evidence behind the numbered markers that open the right-side sources panel). For now In Depth reads almost the same as Simple; it diverges later when the Acceptable to Good recommendations and a summary are added to it. `renderInDepth()` now delegates to the shared report builder with an "In Depth" kicker; the inline-dump code and its `.idclaim` / `.idrefs` / `.idevhead` styles were removed. The comprehensive ~499 references and their "why this counts" notes are unchanged and still power the markers and the Google Doc export.
- Scope: Snapshot report only. Story, Detail, Coverage and Observations untouched. Verified in the preview (In Depth kicker, markers with their source counts, no inline dump, no console errors).
- Rollback: `dash-v0.40`.

## v0.40 . 2026-06-25
- **In Depth report built, with comprehensive evidence (Phase D, part 2).** Every report statement is now backed by ALL of its supporting June lessons, not a 2-4 sample: a multi-agent pass matched each of the 39 claims against the deduped lesson evidence by meaning, and every quote was code-verified as an exact substring of the source (anti-fabrication). Result: **~499 references**, average ~13/statement (the "routines, relationships and behaviour" bullet went 2 -> 17). Each reference carries a short **"why this counts"** note.
- **Threshold cleanup.** Statements with 5 or fewer proofs were kept only where small-by-design (e.g. "four Very Weak lessons", "self-assessment in a handful of classes"); the one genuinely thin Secondary "where to focus" bullet ("targeted intervention for a small group of lower-attainers", 2 proofs) was **replaced** with a provable one, "Tighten lesson pace and time management so no learning time is lost" (8 proofs).
- **In Depth view.** The Report menu's In Depth now shows every claim with **all its evidence printed inline** (subject, date, rating, the inspector's quote, the why-note, and the R3 record link); Simple keeps the evidence behind the side-panel markers. Both reports export to a Google Doc (the In Depth doc's References tab carries every quote + why-note + link).
- **Storage.** All references + why-notes live in Supabase (`narrative_ref.explanation`, round-scoped), comparable against the next round. `get_narrative` returns the explanation; the references panel shows it too.
- Scope: Snapshot only. Coverage, Observations, Settings untouched. Rollback: `dash-v0.39`.

## v0.39 . 2026-06-25
- **Snapshot Report (Phase D, part 1): a "Report" button with Simple + In Depth, and Google Doc export.** The Report button (in the Snapshot tabs row) opens a menu: **Simple** (the current summaries + insights, laid out as a clean governance report; references stay behind the side-panel markers) or **In Depth** (a button + placeholder for now; the fuller evidence report is built next). Story / Detail return to the live snapshot.
- **Make Google Doc.** Each report has its own export. It builds a real Google Doc from the **live** `get_narrative` payload via a small Apps Script web app (`dashboard/apps-script-export/`, runs as admin.user): a clean main tab that mirrors the on-screen report (no inline quotes) plus a real **References tab** (every source: subject, date, rating, quote, and a link to the locked R3 record), with each claim's number in the report linking to the References tab. If the live data is unreachable it blocks with a calm message rather than exporting a stale Doc. No password gate on export by design (Google SSO + roles later).
- **Insights now have one source of truth.** The narrative text + references are read from Supabase (`narrative` / `narrative_ref`); the page keeps a baked copy in `data.js` only for instant first paint + offline, refreshed at publish time by `export_snapshot.mjs` (`window.__AIS_NARR_ITEMS`). The hand-typed `NARR` constant was removed; markers now show on first paint too.
- Scope: Snapshot only. Coverage, Observations and Settings untouched. In Depth content + its Supabase data are the next step.
- Rollback: `dash-v0.38`.

## v0.38 . 2026-06-23
- **Settings is password-gated (popup on every open) and now saved to Supabase, applying on all devices.** Clicking the Settings nav pops a centered password modal (`#setGate`) over the current board; `showBoard` intercepts `settings` and opens it only after `verify_admin_password` succeeds (the SAME shared admin password as the R3 form, bcrypt server-side in `app_config`). It re-asks every time: `adminPw` is held only while in Settings and cleared on leaving, so each open re-prompts. Cancel / Esc / click-the-dim dismisses and stays on the previous board. The old inline lock card was removed.
- **Light/dark toggle removed from Settings** (the floating round button, top right, is now the only theme control). Theme stays a per-device preference (localStorage).
- **Star-field on/off + the three sliders + Snapshot auto-play now persist to Supabase**, not localStorage: written (password-gated) via `admin_set_setting` on change (sliders debounced 600ms), read via `get_app_settings()` on load and applied, so an admin's choice shows on every device. localStorage stays only as an instant-paint cache.
- **Backend:** `migrate_06_dashboard_settings.sql` (additive, applied via `db/apply.mjs`): seeds `snap_autoplay` + `stars` + `star_cfg` in `app_config`, extends the `admin_set_setting` whitelist to those keys (R3's `current_round` untouched, the password row can never be written), and adds the anon `get_app_settings()` read RPC. One shared `app_config.admin_password_hash` governs both the dashboard and the R3 form. Verified end-to-end in-browser (gate, wrong/right password, re-prompt every open, write -> read-back), no console errors.

## v0.37 . 2026-06-23
- **Story controls moved into the tabs row (layout only; controls + logic unchanged).** The `#storyCtl` pill (prev / play-pause / next / beat dots / Present) moved out of `#snapStory` (a larger bar below the stage) into the `.tabsrow`, between `#phaseTabs` (Primary & Kindy / Secondary / Compare) and `#viewTabs` (Story / Detail), so `justify-content:space-between` centres it. Restyled compact (buttons 38px -> 30px, tighter padding/gaps, smaller Present) to roughly match the phase-toggle pill. It now shows only on the Story view (`renderSnapshot` sets `storyCtl.hidden = snapView!=='story'`, since it used to be auto-hidden inside `#snapStory`); Present still floats it to the bottom via the existing `position:fixed` rule, and print still hides it. IDs preserved -> all button handlers unchanged.

## v0.36 . 2026-06-23
- **Print rendering fixes (print only; the on-screen dashboard is unchanged).** All scoped to `@media print` + the print-prep, per Igor's constraint.
  - **Colours/charts were blank on paper:** browsers strip `background` colours in print by default, and every chart fill is a background (histogram `.dt`, spread swatches, dot-sort `.dsdot`, diverging `.divbar`, gauges, the navy cover). Added `print-color-adjust:exact` (+ `-webkit-`) so they all print; also `transition:none` so bars print at final size.
  - **Story pictures/figures piled at the page bottom:** print-story beats were `position:static`, which un-anchored their `position:absolute` cover image + `.statefig` figures. Changed to `position:relative` so each slide's image/figure anchors to its own page. Cover line-art keeps its brightness filter (the blanket `filter:none` was dimming it; restored with an id-specific selector).
  - **Coverage stat cards stretched the full page:** the old print rule forced grids to full-width block. The `cols-4` stat tiles now `flex-wrap` and hug their text.
- Verified: on-screen dashboard untouched (statgrid still `grid`, no leak); figure anchoring confirmed in-browser; the colour fix only shows in real print (Cmd+P).

## v0.35 . 2026-06-23
- **Coverage corrected to match the Snapshot (June R3, deduped lessons).** The board no longer reads the baked `D.coverage` / `D.quality` (which pooled February + June and counted raw form submissions). A new `covAgg()` recomputes everything from `D.teachers[].observations` scoped to `SNAP_ROUND` ('R3 June 26'), deduped to lessons exactly like `snapAgg` (teacher + date + normalised subject, best score wins). Congruence is now by construction: `covAgg().lessons === snapAgg('all').lessons === 110`. New numbers: 149 on register, 104 observed in June (was 135 = Feb+June pooled), 45 not yet observed (was 14), 110 lessons (was 312 raw). Histogram relabelled "Lessons per teacher"; the judgement spread + not-observed list recompute June-only. Verified at the Supabase source: all six counts reproduce; the old 135 = 104 June + 31 Feb-only; February is a mock seed, June is the live `r3_sheet` dual-write.
- **Print / Save-as-PDF button (view-aware; components never split a page).** A floating Print button (next to the theme toggle) on Snapshot / Coverage / Observations (hidden on Settings and in Present). `@media print` + a `beforeprint`/`afterprint` prep so it works from the button AND Cmd/Ctrl+P: forces light, hides all chrome (nav, star-field, controls, sources panel, footer, tabs), and freezes count-ups to final. Story view prints every beat one page each at final static state (all viz built, navy cover intact); the card views (Detail, Coverage, Observations) stack their cards single-column with `break-inside:avoid` so a component is never cut across a page break.
- Scope: Coverage + a print layer. Snapshot Story/Detail data + Observations untouched. Verified in-browser (both themes, no console errors); print layout verified by injecting the print rules on-screen (headless cannot screenshot real print media).

## v0.34 . 2026-06-23
- **Story stage taller** (`.stage` min-height `clamp(460px,60vh,640px)` -> `clamp(460px,72vh,720px)`). One fixed box, identical for all seven beats; the two Insights beats (slides 5 and 7) now show all three cards without the third clipping. Verified the Secondary "Areas to develop" beat (the worst case) fits. Embedded view only.
- **Present mode: real full screen.** The Present button now calls `requestFullscreen()` on the document (webkit-prefixed for Safari); `fullscreenchange` syncs the `.present` layout back out when the user leaves via Esc, and `exitPresent()` exits fullscreen. iOS Safari (no element fullscreen) silently falls back to the existing CSS full-window present, never an error (hard rule 12). The present stage background is now opaque (`var(--bg)`) so nothing shows through.
- **Present mode: bigger + centred on every beat.** New `#v-snapshot.present` rules re-express the fixed-px type as viewport-scaled (`vh`) clamps and centre the list beats; the figures enlarge too. Scoped to Present; the embedded Story keeps its sizes.
- **A- / A+ text-size control (Present only).** Mirrors the `--font-scale` control from the Lesson-Plan slides (frontend-slides): step 10%, range 50 to 200 percent, session only, shown only in the Present control bar (also Cmd . / Cmd , while presenting). Hidden in the embedded view.
- Scope: Snapshot Story + Present. Coverage, Observations and the Detail view untouched. Verified in-browser, light and dark, no console errors.

## v0.33 . 2026-06-23
- **Snapshot subheading removed** ("110 lessons observed across 104 teachers…") for a more compact header. Dropped `#snapIntro` and the JS that filled it.
- **Coverage and Observations headers made congruent with Snapshot.** Both now use the `.snaphead` two-column header: kicker (+ timestamp on Coverage) on the left, title right-aligned to the masthead edge.
- **Observations restructured:** the page title is now "R3 Observations" (right), the R3 Obs control (with its search box and "Not yet observed" filter) moved into a `.tabsrow` under the header (the same place the Snapshot phase tabs sit), and the **"Back to Coverage" button was removed** (element + handler). The R3 Obs menu, Teacher search and teacher drill-down are unchanged (IDs preserved; verified the menu, search and list still work).
- Scope: headers across Snapshot + Coverage + Observations. Board content/logic untouched. Verified both themes, no console errors.
- Rollback: `dash-v0.32`.

## v0.32 . 2026-06-23
- **Snapshot header restructured into two columns.** Left: the SNAPSHOT kicker with the timestamp moved underneath it. Right (right-aligned to the masthead edge): the "The June R3 picture." title with the subheading underneath. Tops aligned (`.snaphead` / `.snaphL` / `.snaphR`).
- **Phase tabs and the Story/Detail toggle now share one row** (`.tabsrow`, space-between): Primary / Secondary / Compare on the left, Story / Detail on the right. The toggle moved out of the header's top-right.
- **Detail Insights split into two cards.** The single wide Insights panel becomes two side-by-side `.panel` cards in a `cols-2` grid, identical width/gap/padding to the What is working / Where to focus cards above (verified same left/width), each with a coloured-dot header ("Insights . Strengths" green, "Insights . Areas to develop" terracotta). `insCol()` now returns a panel with a `.swhead`.
- Scope: Snapshot board only; Coverage, Observations, Settings untouched. Story content unchanged (only the shared header/tabs above it moved). Verified both themes, no console errors.
- Rollback: `dash-v0.31`.

## v0.31 . 2026-06-23
- **Sources panel reworked from an overlay into a right-hand push-drawer.** It now opens from the RIGHT (was left) and, instead of covering the page, it pushes the app left (`body.refopen` reserves `--refw` on the right; `.wrap` transitions) so the Story and its sources are visible at the same time.
- **Lighter, non-blocking dimming.** The heavy click-blocking scrim (`rgba(0,0,0,.34)`) is gone; the app is only lightly de-emphasised (`.wrap` opacity .84) and stays fully interactive, so the inline markers remain clickable and you can jump straight from one source to another without closing the panel first. Close is via the X or Escape. Verified marker-to-marker switching by real clicks.
- **Story section headers restyled.** The blue presenter headers (the phase title on the numbers beat, the "Student progress" title, and the matching Compare headers) move off the electric blue to the AIS navy (`var(--ink)`, the same navy as the masthead title), and the centred-layout beats now centre their header. The green "What is working" and terracotta "Where to focus" headers are unchanged.
- Build note: the push reserves space with `padding-right:var(--refw)` (no `calc()` wrapping the `clamp()`), which keeps it robust across engines. Verified in both themes, no console errors. Snapshot only; Coverage and Observations untouched.
- Rollback: `dash-v0.30`.

## v0.30 . 2026-06-22
- **Snapshot Insights now carry their sources (#6/#7 Phases A-C).** Every claim on the Snapshot (the strengths/areas summaries, the bullets, and the Insight cards, in both the Story and Detail views, across Primary & Kindy, Secondary and Compare) now shows a small numbered marker. Clicking it opens a slide-out panel from the LEFT with the supporting evidence: one card per source lesson (subject area, date, progress word, and the inspector's verbatim quote), a "how this is counted" note where relevant, and a link to that lesson's locked R3 record. User-facing this is "Insights", never "AI".
- **Read live from Supabase, round-scoped.** The narrative wording and the references come from two new Supabase tables (`narrative` + `narrative_ref`) via a definer RPC `get_narrative(round)`, scoped to the current round ('R3 June 26'). The baked `NARR` constant stays as the instant-first-paint and offline fallback, so the Snapshot still renders fully (without markers) if Supabase is unreachable. No error UI ever.
- **References never name a teacher** (subject area, phase, date, quote and the record link only); a panel footer states identifying details are withheld. The seed came from a Phase A congruence audit that cross-referenced all 43 claims against the live June R3 evidence (`.planning/2026-06-22-phaseA-congruence-audit.md`): 39 congruent, 4 flagged with the real number (the Primary evidence-base denominators drifted 47->48 as late forms arrived; the flags are recorded, the wording is NOT auto-rewritten).
- **Scope:** all additions are inside the Snapshot. Coverage and Observations are untouched. The panel uses CSS-transition motion (no from-invisible JS), so it stays freeze-safe.
- Rollback: `dash-v0.29`.

## v0.29 . 2026-06-22
- **Observer figures resized + teacher motif recoloured to the AIS blue.** The observer illustration on the two Insights beats (slides 5 and 7) is now half its previous size, closer to the teacher motif's scale (`.statefig.figtall` width clamp halved). The teacher motif on the numbers beat used a different blue (#4C82F5) than the headers; it is recoloured to the approved AIS blue #1257FF ("Blue on Star", from the AIS Approved Colours sheet), so the motif and the headers now match and are on-brand. The presenter headers were already #1257FF, so they are unchanged.
- Rollback: `dash-v0.28`.

## v0.28 . 2026-06-22
- **Autoplay now loops.** When the Story reaches the last beat it returns to the first beat and keeps playing, instead of stopping. `scheduleNext()` wraps `storyIdx` to 0 at the end. Pause, step and Present are unchanged.
- **Fixed blank content after the tab is backgrounded and restored** (the "go away and come back, some data is missing, needs a refresh" bug, the same class as the R3 form's bfcache issue). A backgrounded or bfcached tab can freeze an entrance mid-animation or restore stale, leaving a viz blank. A new restore handler re-renders the CURRENT board at final state on `pageshow` (bfcache restore) and on `visibilitychange` to visible, preserving the open teacher and the story position. No manual refresh needed.
- Scope: the restore re-render mirrors the existing `loadLive()` re-render set (the current Snapshot beat, Coverage, or the open teacher detail). It does not reset the teacher selection or restart the story, and does not reload. Verified: a deliberately blanked teacher gauge repaints on restore with state preserved and no console errors; the Observations board is otherwise unchanged.
- Rollback: `dash-v0.27`.

## v0.27 . 2026-06-22
- **Fixed the Snapshot Story first-load text reflow and the in-play header colour change** (two reported bugs, one root cause). The freeze-safety helper `settle()` ran `gsap.set(clearProps:'all')` about 1.9s after each beat, which wiped the beat's hand-authored inline styles, not only GSAP's animation props: the `.beat-h` summary lost its `font-size:clamp(18px,2.3vw,25px)` and jumped to the base 42px (the small-to-big reflow on slides 4 and 6), and the `.beat-k` kicker lost its `color:var(--g)` / `var(--r5)` and reverted to the base blue (the green/terracotta-to-blue change on slides 4 to 7). It read as first-load-only because the strip is permanent on a beat until the Story re-renders, so later autoplay loops showed it already changed.
- **Fix:** `settle()` now clears only the properties GSAP actually animates (`transform,opacity,filter`), so freeze-safety is preserved and the author's inline size and colour are never touched. It was never a webfont problem (display=block and font preloading could not fix it).
- Verified: headlines on slides 4 and 6 hold their size and the kickers on slides 4 to 7 hold their colour through the settle, in both themes; the Observations board (which shares `settle()`) still renders and animates with no console errors.
- Rollback: `dash-v0.26`.

## v0.26 . 2026-06-21
- **Snapshot Story rebuilt to the new illustrated design** (Igor's Claude-design rework, stitched into the master and wired to live data). The cover is a navy classroom scene (a teacher presenting a rising chart to two children while an observer takes notes), each headline number carries a recoloured pencil motif (open book, teacher, rising chart), and the What is working / Where to focus / insight beats gain a quiet margin figure (student writing, raised hand, observer with clipboard). Drifting motes and a per-beat progress bar were added, and the big presenter-intent beat headers are colour-coded (blue for numbers and progress, green for strengths, terracotta for focus).
- **Every number is live from Supabase.** The standalone's frozen `AGG` was removed; the beats read the existing `snapAgg(phase)` (deduped lessons, teachers, average, distribution) and the existing `NARR`, so figures track Supabase on each load and the wording is unchanged from the Detail (v1) view. The data visuals (the SEAS dot-sort, the gauge, the diverging chart) are kept.
- **Font flash fix:** the Google Fonts link was switched from `display=swap` to `display=block`, so the serif headlines lay out once at final size instead of swapping in from the fallback (the slides 4 and 6 reflow).
- **Scope:** all changes are inside the Snapshot Story. The Detail (v1) view, Coverage and Observations are untouched. The gauge stays freeze-safe (final-state draw plus CSS fade, not a from-empty GSAP sweep). Verified in both themes, all three phases, all beats, no console errors.
- Note: this is a WIP checkpoint. Further design changes are queued (Igor, for 2026-06-22), and moving the insight TEXT itself into Supabase (vs the baked `NARR`) is a deliberate next step, not done here.
- Rollback: `dash-v0.25`.

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
