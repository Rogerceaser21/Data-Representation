# Teacher portal · grill record (LOCKED 2026-07-02)

Igor + Claude, grill-me session 2026-07-02. Integrate the parked v1 page
`dashboard-previews/spea-dashboard.html` into the live dashboard as the **Teacher portal**.
These decisions are settled; do not relitigate.

## Decisions

1. **Audience (staged, option C).** Built NOW as a leadership browse inside the gated dashboard;
   ARCHITECTED so one teacher's page can later stand alone behind @ais.ae SSO (each page = a pure
   self-contained render of ONE teacher's data slice, no cross-teacher leakage inside it).
   SSO itself stays task `243b0534`, not this build.
2. **Scope.** Teacher view + Department view only. Administration view = OUT (Snapshot/Coverage
   already do it). The mock is a BASE TEMPLATE only: restyle everything to the house Cinematic
   look (dashboard-aesthetic skill). Focus = wiring real data + beautifying.
3. **Placement.** Teacher portal = NEW 5th masthead pill `Teacher portal` (`#portal`), the future
   SSO landing. Department view = fills the EXISTING "Grade/Department" placeholder in the
   Observations R3 Obs menu. The existing Observations teacher drill-down stays (leadership
   deep-dive); cross-links both ways ("Open portal" / back).
4. **Teacher page content.**
   - All 8 observation-type rows stay visible; row 1 renamed **"SPEA R3 Observations"** (live);
     the other 7 render quiet "Not assessed" until their pipelines exist (OTP/APR next, then
     Lesson Observations; build nothing for them now).
   - SPEA rating chip = the teacher's established overall (per lesson best skill MIN, teacher =
     average, SEAS word). Row expands to their R3 evidence lines (date, subject, judgement),
     each linking their OWN locked record via `token`.
   - **Donut KEPT** (not the Arc): 8 segments, one per observation type, each segment coloured by
     that type's SEAS rating; unassessed segments neutral. Centre = overall word.
   - Teacher summary = their approved "Next Steps & Improvement" coaching summary (read-only).
   - "Report" = links to their coaching note view + their locked R3 records. Doc export stays an
     admin action in Observations.
   - Round scope = current round (June) headline; evidence list may group by round.
   - Portrait BIGGER than the mock.
5. **Browse.** All 149 register teachers have a page (unobserved = honestly empty). Navigation =
   search-first typeahead (same pattern as Observations) + quiet section/dept filters. The 6-chip
   strip and the 6 mock photos die with the mock.
6. **Photos - source.** Drive folder `1vlGVDGVLb7liU0AfyHNRJne6NUM99IZ5` (verified full access via
   gws CLI as admin.user, download proven). `AUISDF24082025 DB and YB Files/DB Files`
   (`1cMl0Y2xLbYm4OhMOZpNLy0hJUNIJGSvu`) = 249 name-keyed 400x600 headshots (use these);
   YB Files = big yearbook shots (ignore); `Staff/Database` + `Staff/Yearbook` = 8 extra each,
   suffixed names (merge into matching). Name-match test vs D.teachers: 89 exact + 16 fuzzy =
   105/149 (70%); remainder via a hand-maintained alias map; initials-avatar fallback for anyone
   truly missing. Mock jpgs never used for real teachers.
7. **Photos - storage + mirror.** NEVER in the public Pages repo (`dashboard/assets` is public).
   Supabase Storage bucket keyed by teacher id + `photo_url` on teachers. Mirrored from Drive by
   an **Apps Script daily time-trigger under admin.user** (DriveApp read -> checksum compare ->
   resize -> Storage upsert -> row update; deletions propagate; service key in Script Properties;
   idempotent; same family as the ingest_r3 bridge).
8. **Department view v1.** Menu: Department -> Primary school | Secondary school; Secondary ->
   **Humanities** (the only live entry; already in data: 8 secondary teachers, Daniel Van Wyk
   head, from the Sheet Teachers tab). Matrix: teacher rows (photo + name + head badge) x 8 type
   columns on the SEAS ramp (only SPEA lit), dept header strip (observed count, avg word, mini
   distribution), row click FLIPs into the teacher's portal. Primary + others = calm "departments
   land with the new academic year" placeholder; new depts marked in the Sheet appear on export.
   Departments finalise ~8 weeks away (new academic year); design for that, hardcode nothing.
9. **Build phasing (preview-first, NOTHING to GitHub until Igor ships each):**
   - Phase 1: photo mirror + match table (alias file + initials fallback).
   - Phase 2: Teacher portal page + browse (house-styled, responsive/iPad from day one;
     21st.dev MCP mined for visual ideas, hand-built vanilla).
   - Phase 3: Department menu + Humanities matrix.

## Standing constraints picked up in this session
- **Whole dashboard must be mobile/tablet friendly, iPad-first, Safari + Chrome** (memory
  `project_dashboard_mobile_tablet.md`). Portal ships tablet-checked; existing boards get a
  separate responsive-audit task.
- 21st.dev serves React/Tailwind: mine ideas, hand-build in the vanilla HTML + GSAP stack.
- House rules apply throughout: SEAS ramp + words, best-evidence-wins (MIN), rAF-safe motion,
  no em dashes, master = `dashboard/src/index.html`, StatiCrypt deploy chain.

## Facts inventory (recon 2026-07-02)
- Mock: `dashboard-previews/spea-dashboard.html` (28KB, 3 views, 6 hardcoded teachers,
  8 observation types, conic-gradient donut, own three.js + theme).
- Data hooks live today: `D.teachers[]` (id, name, section, dept, dept_role, n_obs, overall,
  best, observations[] with per-obs `token`), `__AIS_NEXTSTEPS` (104 coaching notes).
- Only R3 feeds real ratings; teacher overall metric already established in Observations.
