# STORYBOARD · AIS Observation System explainer (~4m28 finished)

Audience: SPEA + prospective buyer schools + executive principals. Register: confident product
showcase, "as an example, this school". 1920x1080, AIS Cinematic light style. Narration is FINAL
(timings.json, 260.2s + 8s end card). NO em or en dashes anywhere in on-screen copy.

## Laws (non-negotiable)

1. Freeze-safe: resting state = final visible state. Entrances `.from()`/`.fromTo(...,immediateRender:false)`.
2. Cues: entrances 0-1.5s use `at(id, off)`; anything at/after 2.0s uses `atf(id, frac)`. Staggers keep fixed values; check the last item lands inside the scene.
3. Every number on screen comes from `assets/data/video-data.json` (computed from the product's own code). Anything else numeric is labeled `Illustrative` on screen (small quiet tag, class `ill-tag`).
4. Product surfaces are rebuilt VERBATIM from the product's own CSS: dashboard scenes from `styles/dashboard.css` tokens + `../dr-main-src-excerpts` given per scene; form scenes from `styles/form.css` (61k, the R3 form's real stylesheet; copy the exact token values and component rules you need into your scoped fragment, do not link it wholesale).
5. Invented people only. Faces: `assets/faces/face-01.jpg .. face-09.jpg` (2:3 portraits; crop with `object-fit:cover; object-position:50% 18%` so the chest-level ID badges stay out of frame). Names below.
6. Scene grammar: the shell classes (`.scene`, `.sbody`, `.shead`, stat tiles, histogram bars, `.beat-h`) are defined in `styles/dashboard.css`; copy the usage patterns from an existing fragment in `template/fragments/` (e.g. `s07_story.section.html`, `s13_report.section.html`). Section shell: `<section class="scene [top|navy] clip" id="scNN" data-start="{{START:<sceneid>}}" data-duration="{{DUR:<sceneid>}}" data-track-index="1">`.
7. Spotlight dose is assigned per scene below; no extras. Use the shared `spotlight(sel, when, hold)` helper. (word-share fractions given).
8. GSAP only, on the shared paused timeline `tl`. No Math.random (seeded LCG only). No setInterval; count-ups via the shared `countUp()`.
9. NO school branding on screen (no logo, no school name, no authority name), in any scene. Product chrome (colour rails, star fields) stays. This law POST-DATES the scene notes below and WINS over any branded detail still described there: the shipped build uses the neutral forms (form eyebrow "Human Resources", record IDs "R3-20260610-091412", portal row "R3 Observation").

## Cast (invented)

face-01 Eleanor Whitfield (FEATURED teacher: s11 drill-down + s12 portal page; English, Secondary)
face-02 Khalid Rahmani · face-03 Priya Nandakumar · face-04 Marcus De Villiers · face-05 Rosario Almeda
face-06 Samir Haddad · face-07 Charlotte Braithwaite · face-08 Omar Selim · face-09 Fiona Macallister

## Data (assets/data/video-data.json, computed live 2026-07-29)

June round: 111 lessons · 105 teachers observed · 149 on register · 44 not yet · dist {1:8, 2:21, 3:26, 4:36, 5:7, 6:4} · avgBest 3.222 ("Good") · 652 references · pct Good+ 52%.
SEAS scale (1 best): 1 Outstanding · 2 Very Good · 3 Good · 4 Acceptable · 5 Weak · 6 Very Weak.
Movement (s09): use ILLUSTRATIVE data (Feb baseline is a mock seed; real compare is not honest evidence). Illustrative: cohort 86, improved 34, held 41, declined 11, with `Illustrative movement · demonstration data` tag.

## Scenes (agent assignments)

### AGENT A · form act (reads styles/form.css + the form src excerpt file given in your prompt)

**s02_form (21.2s) · "The form"** - The R3 form's paper card rebuilt: brand gradient rail, no logo (law 9), red eyebrow "Human Resources", serif title "Form: R3 Evidence" with green italic "Evidence". Show the 18-cell context info grid (3-col, real field labels: Teacher, Support Teachers / CAs, Time In, Inspector, Curriculum, School, Date, Room Number, Subject, Grade, Ability Group Type, Gender Mix, Number of SEN, Number of G&T, Number on Roll, Number Male, Number Female, How many present?). Animate: card enters, then a Tom Select style dropdown opens on Teacher showing 5 INVENTED names (cast list) with one highlighting green; pill groups (School: Kindy/Primary/Secondary) fill green on "a few taps". iPad frame optional but keep it subtle (thin rounded bezel). No spotlight.
**s03_scale (18.2s) · "The regulator's scale"** - The judgement key strip VERBATIM (6 cells: number chip + quality word + proportion + band: 1 Outstanding / Almost All / Over 90% ... 6 Very Weak / Minority / 0-30%), yellow number chips per form.css. Below: the 10 criteria table rows (Attainment, Progress, Learning skills, PSD & innovation, Teaching, Assessment, Curriculum, PCGS, Leadership & Management, Other) with 1-6 rate buttons; a few pre-selected (green fill). Animate: key cells stagger in, then criteria rows rise; one rate button taps itself (scale pop) mid-scene. SPOTLIGHT: criteria table block at atf('s03_scale', 0.48) ("Ten criteria"), hold 2.2.
**s04_pad (21.7s) · "Evidence Pad"** - The Evidence Pad full-screen: dark canvas area, pad toolbar (Select/Pen/Highlighter/Eraser pills, 3 AIS ink swatches navy/blue/red, Undo, page indicator "Observer notes · 1/4"). A handwriting SVG line-draws itself (stroke-dashoffset, 2-3 short lines of authored "ink" path, navy), a small photo polaroid drops in, then an arrow/flow moment: the ink transforms into typed text landing in the Observer Notes textarea (crossfade ink -> typed text block) with the toast "Pad notes added to Observer notes." Tag the transcription moment with quiet caption "AI transcription · judgements stay human". No spotlight.

### AGENT B · lock, pipeline, trust

**s05_lock (14.0s) · "Save and Lock"** - Big Save & Lock moment: the green action pill (form.css style) with tooltip, click ripple, then the locked state: green "Submitted · Cannot be edited" banner slides in with Record ID "R3-20260610-091412" + timestamp, fields tint and fade to read-only, action bar swaps to "New observation". Then a quick soft-reset wipe: form clears to blank, ready again (fast, 0.6s). SPOTLIGHT: the Save & Lock button at at('s05_lock', 1.0), hold 2.0.
**s06_pipeline (20.3s) · "One tap, filed four ways"** - Diagram scene (navy or light per your judgement, match sample flowstrip grammar): center node "One record" fans to four destination cards with icons: Google Sheet (source of truth), Live database (duplicate proof), Backup email (branded, to leadership), Private storage (handwriting archive). Connectors draw (scaleX or svg line-draw), cards land as units. Then a small "if any step fails, it retries quietly" beat: one connector pulses amber then settles green. Caption chip: "No error a stakeholder can see". No spotlight.
**s14_trust (18.6s) · "Trust"** - Three locks row: three cards (School password / Admin password, server verified / Per-record key, 128 bit) with lock glyphs (CSS/SVG, no icon fonts), staggered. Below: a quiet strip: "Google Workspace · Supabase · static hosting" + line "No servers to maintain. No per seat licences." Keep monochrome navy register (governance feel, like sample report scenes). No spotlight.

### AGENT C · dashboard act 1 (reads styles/dashboard.css; dashboard src excerpts in your prompt)

**s07_story (22.9s) · "The dashboard story"** - Two beats. Beat 1 (0-30%): the gate: navy card, neutral product mark (no crest, law 9), "Confidential · Internal Review Tool" kicker, password dots filling (never real characters), unlock wipe. Beat 2: the Snapshot Story frame: headline stat tiles counting up (111 lessons, 105 teachers from data), the SEAS ramp gauge arc drawing to 3.222 captioned "Good", a mini dot-sort: ~30 dots flying onto 6 ramp-colored columns (heights proportional to dist). End beat: a "Present" chip appears. Use countUp() + fromTo height bars per sample s03. No spotlight (count-ups carry it).
**s08_evidence (14.6s) · "Evidence behind every claim"** - A claim sentence card ("Questioning that checks for understanding is the strongest consistent strength.") with a numbered marker chip [12]; marker clicks, a sources drawer pushes in from the right with 2 source cards: subject area, date, judgement word, verbatim-style quote in italics (author invented quotes, generic: "Targeted questioning moved every group forward"; label drawer footer "Identifying details withheld"). Big counter tile "652 references · one round" (from data). SPOTLIGHT: the marker chip at atf('s08_evidence', 0.52) ("the inspector's words, verbatim"), hold 2.2.
**s09_movement (17.1s) · "Movement between rounds"** - Slopegraph: two vertical band axes (Feb / June, 6 SEAS bands each side), ~12 lines drawing across; green lines slope toward better (upward to band 1..3), grey flat, a couple red. Beside it the 6x6 transition matrix, cells tinting green above diagonal / red below, then three summary chips: Improved 34 · Held 41 · Declined 11 (ILLUSTRATIVE - place the `Illustrative movement · demonstration data` tag visibly under the board title). SPOTLIGHT: the matrix at atf('s09_movement', 0.57), hold 2.2.
**s10_coverage (9.7s) · SHORT scene · "Coverage"** - Four stat tiles: 149 on register, 105 observed, 44 not yet, 111 lessons (countUp), plus the coverage ring (SVG arc, 105/149 = 70%) drawing. Nothing else; the scene is 9.7s. No spotlight.

### AGENT D · dashboard act 2 (faces + portal; dashboard src excerpts in your prompt)

**s11_teacher (20.5s) · "The teacher view"** - Teacher drill-down card for Eleanor Whitfield (face-01, small round avatar + name). Two mirrored SEAS gauges: Student progress (left) and Teaching (right) arcs drawing; between them a spectrum strip with 3 session dots. Below: one session card (Inspection details: invented inspector "Observer: J. Carver", June 2026, English; Skills observed: 3 judgement words with swatches) + the coaching block: current -> target ladder (Acceptable -> Good), one focus card: recommended move + "grounded in the progress rubric" line + Draft/Approved badge flipping to Approved. Tag card corner: "Illustrative record". SPOTLIGHT: coaching block at atf('s11_teacher', 0.49), hold 2.4 + sibling dim per motion-rules.
**s12_portal (15.5s) · "The teacher portal"** - Beat 1: the yearbook wall: 9 portrait tiles (faces 01-09, 2:3, name scrim bottom: cast names; section chips), staggered tile entrance (fixed stagger 0.12). Beat 2: zoom-push to Eleanor's portal page: navy hero band, her portrait in white frame, numbered section list (01 Probationary · 02 OTP & APR · 03 Lesson Observations · 04 R3 Observation · 05 Classroom Profiling · 06 Walkthroughs · 07 Links and Files), 04 carries a pulsing red "New Notification" badge. Caption: "Approved records only. No observer rough notes." SPOTLIGHT: the New Notification badge at atf('s12_portal', 0.33), hold 2.0.
**s13_report (14.9s) · "Reports and regeneration"** - Split moment: left, the monochrome governance report page (navy on white, serif title "R3 June 26 · Governance Report", 2 bullet claims with tiny numbered markers); right, the branded Google Doc cover materializes (navy cover card, "References attached · Teachers anonymised"). Then a small regen beat: a progress bar labeled "Regenerating round narrative... machine checks passed" filling. SPOTLIGHT: the Make Google Doc button at atf('s13_report', 0.42), hold 2.0.

### MINE (not agents): s01_cover, s15_close, s16_end card + skeleton + assembly.

## Deliverable contract (each agent)

Write into `template/fragments/`:
- `<sceneid>.section.html` - the complete `<section>...</section>` block (shell attributes exactly as law 6; unique ids prefixed by scene, e.g. `#s7gate`).
- `<sceneid>.css` - scoped styles (`#scNN ...` selectors only), verbatim product token values.
- `<sceneid>.cues.js` - the timeline cue block (uses `tl`, `at`, `atf`, `spotlight`, `countUp` - already defined globally; do NOT redeclare).
Then run `node scripts/build.mjs` is NOT yours to run; return a structured summary instead. Fragments must be self-contained; no new fonts, no external assets beyond assets/faces and assets/ais-*.png.
