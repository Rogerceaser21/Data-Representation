# CLAUDE.md · Data-Representation

> Bootstrap doc for future Claude sessions. Read this *before* touching anything in this folder.

---

## What this is

AIS Sharjah **Teacher Observation showcase system**, pitched 2026-05-21 to principal Steven McLuckie ahead of the early-2027 school review. Currently at **v0.49** with **two parallel HTML forms** (plus an ungated teacher viewer generated from the R3 master) wired to **two separate Google Sheets** backed by **two separate Apps Script projects** (both under admin.user@ais.ae). **v0.47 added the R3 -> Supabase dual-write bridge**: every R3 submission now lands in BOTH the Google Sheet (source of truth) AND the dashboard's Supabase, plus a password-gated admin Settings cog on the R3 form that sets the current inspection Round (see hard rule 14).

1. **Lesson Observation form**, internal AIS template, 4 sections, 36 S/U criteria, signatures, OTP aligned
2. **R3 Evidence form**, SPEA / governance template, single-select Evidence Type, 10 judgements on a 1-6 scale, searchable teacher dropdown sourced from 6 staff Workspace Groups

Plus a **5-slide HTML pitch deck** at `index.html` that links to both forms from P3.

Live: https://rogerceaser21.github.io/Data-Representation/

---

## Dashboard build (Supabase) · active workstream, separate from the forms/deck

A role-based **Supabase-backed dashboard** is being built to aggregate all teacher-assessment data for the principal, governors, and the SEF/SEAS review. It is not the forms and not the deck.
- **BUILT + DEPLOYED (gated), iterated to v0.22 (2026-06-19); now reads LIVE from Supabase** in `dashboard/` (tag `dash-v0.22`). Live, StatiCrypt-gated (password `ais2026ais`): https://rogerceaser21.github.io/Data-Representation/dashboard/ . Snapshot board (landing) + Coverage + Observations drill-down + Settings; Cinematic shell, light default + dark, AIS star-field. **Scoring (final, do not regress): per observation = best skill (MIN); teacher overall = the average of those per-observation scores** (sessions 6,6,5,5 -> 5.5). v0.7 reworked the Teacher-board session card (approved preview `dashboard-previews/card-A-revised.html`): two collapsible titled columns (Inspection details, Skills observed), full-width Spectrum, a condensed action bar (observed teacher name + centred Observation Notes toggle + text-only link to the locked R3 record, June submissions only since February has no token), and an expander for notes/strengths/areas-to-develop. The snapshot now carries notes/strengths/weakness/source/token. v0.8 refined the card: any click selects it; the Inspection/Skills arrows sit beside their titles, bob, and open BOTH columns together; the session-card Spectrum is a full-width HTML/CSS bar at a fixed thin height (`specHTML`/`animSpec`; a width-scaled SVG read as fat) with judgement words at the body-text size; the column headers match the Observation Notes header. **v0.9 removed the two top centerpiece cards** and merged the Teacher-board top graphs into the All-observations card: the Spectrum and the old All bar were the SAME data (one dot per observation at its best score), so they are now one full-width HTML/CSS Spectrum (`specHTML`, score-coloured dots + average flag + selected-session ring) inside the All card, with the gauge beside it. The gauge is renamed **Student Progress** and shows ONLY the Progress judgement (criterion `r3_02`): rim dots are each observation's Progress score, the fill/word is the teacher-wide average (`progScore`/`progAvg`); it is built once in `renderTeacher` and **never recalculated on session select** (always reads ALL). Selecting a session only rings its dot on the Spectrum; the gauge is untouched. `buildSpec`/`buildObsRamp`/`SEL_COLOR` and the dead `.tcard`/`.cpstage`/`.oramp` CSS were removed. Individual session cards unchanged. **v0.10** tidied the All card (the inspector legend and the Average-of-observations word removed, the Student Progress label bold, the gauge pulled up beside the Spectrum) AND fixed the freeze bug *properly*: v0.9's GSAP-from-invisible entrances plus a `finalizeViz` rescue could still strand the dots/gauge blank after a backgrounded/bfcached tab, so the Spectrum (`.ospec`/`.osbar`) and gauge (`#svgArc`) entrances are now CSS keyframe animations on a resting-visible base. CSS animations run on the real-time document timeline (NOT requestAnimationFrame), so they always complete to the final visible state whether or not the tab was painted; `animSpec` and `finalizeViz` were removed. **Do not reintroduce a from-invisible (`scale:0`/`opacity:0`) JS entrance on these viz elements; keep the resting state visible.** **v0.11** balanced the All card: "All observations" and "Student Progress" are now matched bold headers (`.ey-bold`, in `.allhead`); the gauge `viewBox` is cropped+centred on the circle and `.allmain` uses `align-items:center` so the gauge circle's middle lines up with the Spectrum bar's middle (the Spectrum dots are absolutely positioned, so the bar never moves and the alignment holds regardless of dot stacking); the card height is trimmed. **v0.12-v0.21 (2026-06-18):** v0.13 made the All card symmetric with a **Teaching gauge** (criterion `r3_05`, mirror of the Progress gauge) right of the Spectrum (`buildArc(t,svgId,scoreFn,avgFn,mirror)`); v0.14-v0.15 restyled the All-card Spectrum as the **SEAS scale** (one seamless bar, six swatches + words, no numbers, dots reserve height, bottom-aligned with the gauges; a `segmented` flag on `specHTML` scopes it to the All card, session cards keep the gradient bar); v0.16-v0.17 renamed **Teacher -> Observations** and moved the teacher search off Coverage; v0.18 added **hash routing** (`#teachers`/`#settings`); v0.19 made **R3 Obs a fan-out menu** (Teacher Level = the working search; Grade/Department + School Level = front-end placeholders); v0.20 removed the masthead Stars/theme buttons (kept in Settings) + added a floating top-right sun/moon theme toggle; **v0.21 wired LIVE Supabase read** (see build chain). **v0.22 (2026-06-19) added the Snapshot board, now the LANDING view** (`#v-snapshot`, first pill, default no-hash route; Coverage moved to `#coverage`): a governance at-a-glance of the June R3 sweep (`SNAP_ROUND='R3 June 26'`, scoped to that one round) with a **Primary & Kindy / Secondary / Compare** toggle (`snapPhase`). Per phase it shows lessons observed, teachers seen, average progress (best Progress `r3_02` per teacher then averaged across teachers, best-evidence-wins) on a ramp gauge + a six-point distribution histogram, a What-is-working / Where-to-focus-next summary, and **three insights each** (the baked `NARR` constant, a human synthesis of the round's written strengths + areas-to-develop); Compare adds a diverging PK-vs-Secondary distribution chart + three cross-phase insights. All numbers compute LIVE from `D` via `snapAgg()` (works on baked + live). **`teachers.section` (subschool: kindy/primary/secondary) is now POPULATED in Supabase** from the R3 Sheet Teachers tab (Kindy/Primary/Secondary booleans) via the re-runnable tool `~/AIS-Data-Dashboard/db/set_sections.mjs`, so the phase split is live data, not hard-coded; the export/RPC/`shapeSnapshot` already carried `section`, it was just unpopulated. `data.js` rebaked to match. Verified end-to-end in a browser (both themes, all three modes, through the StatiCrypt gate; numbers match SQL: PK 68/45/3.19, Secondary 99/58/3.24, overall 167/103/3.22). Login-less for the demo (the gate is the soft lock); @ais.ae SSO + per-role RLS, and a general multi-round selector for the other boards (Coverage/Observations still pool all rounds), are the next steps.
- Architecture (data, auth, schema, boards, attendance): `.planning/2026-06-12-dashboard-architecture-DECISIONS.md`
- Design + motion (Cinematic, LIGHT default, AIS star-field, 6-point SEAS scale, Spectrum/Arc/matrix): `.planning/2026-06-15-dashboard-design-DECISIONS.md`
- Living spec, open in a browser: `dashboard-previews/design-spec.html`
- Current DB + decision state: memory `project_dashboard_architecture.md`. Supabase ref `rfbetrcevtmisknndpgg`; tooling + creds at `~/AIS-Data-Dashboard/` (never echo secrets).
- Latest status: newest doc in `handoff/`.

**Dashboard build chain + hard rules (see also memory):**
- Master = `dashboard/src/index.html` (edit this). It reads `window.__AIS_DATA`; **v0.21 wired the live-Supabase swap**: `loadLive()` fetches the `get_raw_snapshot` RPC, runs `shapeSnapshot()` (a verbatim port of `export_snapshot.mjs`), and replaces `D` on each load, falling back to the baked `data.js` if Supabase is unreachable.
- Data = **LIVE Supabase on each load** via RPC `public.get_raw_snapshot()` (SECURITY DEFINER, EXECUTE to anon; SQL `~/AIS-Data-Dashboard/db/migrate_03_dashboard_rpc.sql`, apply with `node db/apply.mjs <file>`). The baked `data.js` is the **first-paint + offline fallback** (regenerate: `node ~/AIS-Data-Dashboard/db/export_snapshot.mjs "<repo>/dashboard/data.js"`). **`dashboard/data.js` is GITIGNORED on purpose**, it holds real teacher names + ratings in cleartext and must never reach Pages. The Supabase URL + publishable key are inlined in the master and ship inside the StatiCrypt-encrypted page.
- Deploy = `./dashboard/encrypt.sh` (inlines data.js ENCRYPTED into `dashboard/index.html` via StatiCrypt, password `ais2026ais`). Never hand-edit `dashboard/index.html`; it is generated. Then commit + push main + force a Pages rebuild.
- **Versioning (do not skip, the footer was stuck at v0.1 through v0.6):** every dashboard release bumps the footer badge in `dashboard/src/index.html`, adds a row to the Settings "Build history" panel, appends an entry to `dashboard/CHANGELOG.md`, and is git-tagged `dash-vX.Y` (rollback safety).
- All dashboard motion is enhancement only (final state applies without requestAnimationFrame): preserve this so a frozen ticker (hidden/bfcached tab, which StatiCrypt's document.write makes likely) never strands the title card or content.
- The gate is SOFT: the password is publicly fetchable via served files (CLAUDE.md, both encrypt.sh). Treat the URL as soft-gated for a controlled demo, not secure; real access control is the planned SSO + RLS.

---

## File map

```
Data-Representation/                          github.com/Rogerceaser21/Data-Representation (PRIVATE)
├── index.html                                5-slide pitch deck; P3 links to both forms
├── lesson-observation-form.html              3-line redirect stub (preserves old URL after the v0.10 move)
├── apps-script/                              Lesson Observation backend (clasp, admin.user)
│   ├── .clasp.json                           scriptId 1wfwv-3le3lMFeiV6E_hghRQ3F2kAiInNaNlnQbipx4bLMFH9N0yRKXEL
│   ├── 00_Config.gs                          SHEET_ID + getColumns(), 80+ col schema, DO NOT REORDER
│   ├── 01_doPost.gs                          append row, generates AIS-OBS-YYYYMMDD-HHMM
│   ├── 02_doGet.gs                           ?id=AIS-OBS-... returns record as JSON
│   ├── 03_helpers.gs                         jsonOut + forceAuth (one-shot OAuth trigger; keep)
│   └── appsscript.json                       webapp: ANYONE_ANONYMOUS, USER_DEPLOYING
├── Assets/
│   ├── brand/AIS Logo/                       AIS White.png + AIS Navy.png (only runtime brand assets)
│   ├── brand/email-signature-primary.png     Igor's primary-school email signature banner (Pages-hosted for the R3 inspector email)
│   ├── Lesson Observation Form/
│   │   └── lesson-observation-form.html      THE Lesson Observation form (moved here in v0.10)
│   └── R3/
│       ├── r3-evidence-form.html             ENCRYPTED output (StatiCrypt) · the inspectors' form GitHub Pages serves
│       ├── r3-record.html                    UNGATED teacher viewer (v0.42) · generated by encrypt.sh from the master · record-link-only via window.R3_VIEWER
│       ├── src/r3-evidence-form.html         MASTER source · edit this · v0.34 opaque-keyed Tom Selects, v0.37 resilient options fetch
│       ├── password-template.html            AIS-themed StatiCrypt gate (dark / light, AIS yellow, gate prewarm)
│       ├── encrypt.sh                        build script · runs StatiCrypt with password "ais2026ais"
│       ├── .staticrypt.json                  encryption salt (safe to commit)
│       ├── lib/                              vendored Tom Select (loads after decrypt)
│       ├── Google file links.md              quick-access Sheet + Apps Script + Gmail links
│       ├── README.md                         R3-specific deploy workflow + v0.30-v0.34 changelog
│       ├── R3 Evidence Form Template.docx    source template from SPEA
│       ├── apps-script/                      R3 backend (clasp, admin.user)
│       │   ├── .clasp.json                   scriptId 1BYxWpSsqs-48AKnWH4BUQonAKHqDcY6VbiWA1SNbhBZT0QgDzLUatgRn
│       │   ├── 00_Config.gs                  getSheetId() via PropertiesService + getR3Columns() 48-col schema + BACKUP_EMAIL_TO + FORM_PUBLIC_URL + SUPABASE_URL + getSupabaseSecret() (v0.47)
│       │   ├── 01_doPost.gs                  append row, generate record_token, auto-compute duration (v0.32), email-on-submit + CC inspector (v0.31), Link-only URL (v0.33), Supabase dual-write (v0.47)
│       │   ├── 02_doGet.gs                   ?id=AIS-R3-...&token=... · safeForSelector + CacheService 5-min TTL + clearOptionsCache (v0.31, v0.33)
│       │   ├── 03_helpers.gs                 jsonOut, forceAuth, bootstrap (creates Sheet + tabs + seeds + stores SHEET_ID)
│       │   ├── 04_TeacherLoader.gs           pulls staff from 6 Workspace Groups via Admin SDK (recurses nested groups)
│       │   ├── 05_Supabase.gs                v0.47 dual-write · pushToSupabase() POSTs each submission to the ingest_r3 RPC (service_role key from Script Properties)
│       │   └── appsscript.json               webapp + AdminDirectory advanced service + admin.directory.* + script.send_mail + script.external_request scopes
│       └── 2026-05-28_email_R3-Data...md     correspondence record (R3 kickoff email to Dave, CC Leon + Steve)
├── SPEA Data Report/                         worked-example source docs (Jo Mare Kruger portrait, OTP, probation form)
├── .planning/
│   ├── v0.10-r3-form-checklist.md            multi-phase plan + acceptance criteria + IDs
│   ├── 2026-06-11-moderation-and-dashboard-plan.md   Jobs 0-3 (Job 0 + Job 1 done)
│   └── 2026-06-12-dashboard-architecture-DECISIONS.md  AUTHORITATIVE grill record (Q1-Q11) for the Supabase dashboard
├── dashboard/                                 LIVE gated dashboard v0.1 (tag dash-v0.1)
│   ├── index.html                             ENCRYPTED deploy artifact (StatiCrypt, data inlined) · generated, never hand-edit
│   ├── src/index.html                         MASTER · edit this · Cinematic Coverage + Teacher drill-down + Settings
│   ├── data.js                                GITIGNORED baked Supabase snapshot (window.__AIS_DATA) · real names+ratings, never to Pages
│   ├── encrypt.sh                             build · inlines data.js ENCRYPTED into index.html (password ais2026ais)
│   ├── password-template.html                 AIS-themed StatiCrypt gate (re-themed from R3)
│   └── assets/                                ais-white.png + ais-navy.png (public, non-sensitive)
├── dashboard-previews/                        dashboard design concepts · spea-dashboard.html = dashboard-v1 (parked); built from index.html slides 3-4
├── README.md                                 STALE (still describes v0.1 pitch only)
├── CLAUDE.md                                 this file
└── .gitignore
```

Each form is self-contained at runtime. All CSS and JS are inline; only Google Fonts and the AIS logo PNGs are external. Asset paths inside the form HTML use `../brand/AIS Logo/...` since both forms live one level under `Assets/`.

---

## How the pieces connect

Two parallel pipelines, both running under admin.user@ais.ae:

```
                  admin.user@ais.ae Drive
                  ┌──────────────────┬──────────────────┐
                  │ AIS Lesson Obs   │ AIS R3 Evidence  │
                  │ Submissions tab  │ Submissions + 4  │
                  │ (80+ cols)       │ reference tabs   │
                  └────────▲─────────┴─────────▲────────┘
                           │                   │
                POST + GET │                   │ POST + GET + options
                           │                   │
        ┌──────────────────┴───┐   ┌───────────┴──────────┐
        │ Apps Script "AIS     │   │ Apps Script "AIS R3  │
        │ Lesson Observation"  │   │ Evidence Web App"    │
        │ scriptId 1wfwv-3le.. │   │ scriptId 1BYxWpSsqs..│
        └──────────▲───────────┘   └───────────▲──────────┘
                   │                            │
    ┌──────────────┴────────────┐   ┌──────────┴──────────────┐
    │ lesson-observation-       │   │ r3-evidence-form.html   │
    │ form.html                 │   │ (in Assets/R3/)         │
    │ (in Assets/Lesson         │   │                         │
    │  Observation Form/)       │   │                         │
    └──────────────┬────────────┘   └──────────┬──────────────┘
                   │                            │
                   └──────────┬─────────────────┘
                              │
                        index.html (deck)
                  P3 has buttons linking to both
```

---

## Hard rules · do not break

1. **Sheet column order is load-bearing for both Sheets.** `apps-script/00_Config.gs` `getColumns()` (Lesson Obs, 80+ cols) and `Assets/R3/apps-script/00_Config.gs` `getR3Columns()` (R3, 48 cols, last is `record_token`) define schemas auto-created on first POST. Existing rows are positional. *Append* new columns at the end if needed. Never reorder or insert in the middle.
2. **Record ID formats are `AIS-OBS-YYYYMMDD-HHMM` and (R3, v0.46+) `AIS-R3-YYYYMMDD-HHMMSS`.** Generated server-side. The R3 id is now a **display label only** (v0.46): it is minute-resolution pre-v0.46 and COLLIDED for same-minute submissions, so it is NOT a unique key. R3 record lookup keys on the unique `record_token` instead (see rule 10), so the colliding ids are harmless. v0.46 added seconds to NEW R3 ids to keep labels unique. The Lesson Obs id is still the lookup key for that form, so don't change its format. Don't regenerate existing ids.
3. **`WEB_APP_URL` constants must match the deployed `/exec` URL for each form.** If you `clasp deploy` a new version that gets a new `/exec` URL, update the matching constant in the form HTML and ship.
   - Lesson Observation: `Assets/Lesson Observation Form/lesson-observation-form.html`, search for `const WEB_APP_URL`
   - R3 master: `Assets/R3/src/r3-evidence-form.html` (the encrypted output at `Assets/R3/r3-evidence-form.html` is regenerated from this)
4. **Repo stays private** until ratings are real OR the form is StatiCrypt-encrypted (R3 form is, from v0.29). Real teacher names sit next to fabricated ratings.
5. **Don't commit the `.docx` file's noise diffs.** `SPEA Data Report/Lesson Observation - Igor- 12_11.docx` flutters by a byte every time Word touches it. Skip unless content actually changed.
6. **Every push bumps the visible version label AND tags.** Bump version in: cover term-tag, every masthead `.school` text, P5 floor, version-badge element, AND both form footers (R3 footer lives in the **master** at `Assets/R3/src/r3-evidence-form.html`). Commit msg starts `vX.Y · summary`. `git tag vX.Y` after the commit. `git push origin main --tags`.
7. **R3 reference tab schemas are load-bearing.** The R3 form reads Inspectors / Curriculum / Subjects / Teachers from named tabs via `?action=options`. Single-column tabs assume header row + data rows; Teachers tab uses column A = name only (v0.28). The form's `setupSearchableTeacher` + `loadDropdownOptions` break silently if the tab schemas shift.
8. **The redirect stub at `lesson-observation-form.html` (root) must be preserved.** It catches old URLs (`/lesson-observation-form.html?id=AIS-OBS-...`) and forwards to the new path. Removing it 404s any reference shared before the v0.10 move.
9. **R3 master / encrypted split (v0.29), plus the teacher viewer (v0.42).** Edit `Assets/R3/src/r3-evidence-form.html`. Run `Assets/R3/encrypt.sh` from anywhere; it regenerates BOTH outputs: `Assets/R3/r3-evidence-form.html` (the StatiCrypt-encrypted inspectors' form) and `Assets/R3/r3-record.html` (the ungated teacher viewer, same master with `window.R3_VIEWER=true` injected; record-link-only, shows a calm landing card without `?id`). Never hand-edit either output. School-wide gate password is `ais2026ais` (hardcoded in `encrypt.sh`; rotate by editing + re-encrypting). Teachers do NOT get the gate password; their access is their personal `r3-record.html?id=...&token=...` link.
10. **R3 locked-record viewing keys on the token (v0.46), which is also required.** The URL is `?id=AIS-R3-...&token=<32-hex>` (legacy) or `?token=<32-hex>` (token-only, also accepted). `02_doGet.gs getRecordById` finds the row by **`record_token`** (two UUIDs, unique per submission, found by header name so the column's position is irrelevant), NOT by `record_id` (which collides, minute-resolution). The id is ignored for matching; it's a display label. The token is generated in `01_doPost.gs` per submission and included in the backup email to `admin.user@ais.ae`. An exact token match is required; any non-match (wrong token, no token) returns a generic "Record not found" (so attackers can't probe). Pre-v0.29 test records have no token and are not viewable. **Don't revert the lookup to id-first: it reintroduces the same-minute collision bug (17 ids / 37 records during live inspection week were unreachable).**
11. **Never put user-data strings into Tom Select option `value` (v0.34 iOS WebKit fix).** Tom Select v2.6.1's internal `addSlashes` only escapes `\ " '` and does NOT escape NBSP, ZWSP, U+2028/9, control chars, or other CSS-meaningful chars. iOS WebKit's strict selector parser throws `SyntaxError: The string did not match the expected pattern` from the resulting malformed selectors, blanking the dropdowns. StatiCrypt's `document.write` aggravates this by triggering stricter post-load parsing. **Rule:** teacher / inspector / subject (any Tom Select fed user-controlled strings) must use **opaque indices** as `value` (e.g. `t0`, `i0`, `s0`...) and put the human-readable name in `text`. Translate `value` back to `text` via `tomSelects[name].options[value].text` at submit + save time so the Sheet still stores names. See `src/r3-evidence-form.html` `populateTomSelect`, `refreshSubjectOptions`, `submitForm`, `saveForm`, `loadClosedRecord` for the pattern.
12. **Stakeholders must never see an error or a stuck spinner (v0.37).** The R3 form is used by the school's most senior staff; Igor's absolute rule is "no error UI, ever." The dropdown options fetch in `src/r3-evidence-form.html` `loadDropdownOptions()` therefore: caps each attempt at 7s via `AbortController`+`setTimeout` (NOT `AbortSignal.timeout`, which is iOS 16+ only), silently retries behind the existing frosted overlay (no toast, no error text), reloads once as a last resort (guarded by a `?_r=1` flag against loops), and reloads on `pageshow` when `event.persisted` is true (a stale iOS tab restored from bfcache, the documented cause of the "stuck on loading" hang). When changing this code path, preserve all four behaviours: timeout, silent retry, bfcache reload, guarded last-resort reload. Never surface a visible failure state to the user.
13. **Record views never write the localStorage draft (v0.44).** `loadClosedRecord` fires `change` events while populating fields; the debounced autosave must not capture them, or the viewed record silently overwrites the shared draft (both the viewer and the gated form share the GitHub Pages origin). `saveForm` bails when `CLOSED_RECORD_VIEW` is true (viewer build via `window.R3_VIEWER`, or `?id` in the URL); the draft key is `ais-r3-form-v2` (v1 was polluted and is deleted on load). Preserve this guard when touching autosave or the closed-record path. **v0.45 closed the reverse leak (draft -> record view):** the draft was bleeding its Teacher/Inspector over a loaded record (a viewed record showed "Igor Sesar / Saliq Jaral"), and the opaque Tom Selects rendered blank when the staff options landed after the record fetch. Three rules now hold, keep them: (a) `readRestoredFromLocalStorage` returns `''` whenever `CLOSED_RECORD_VIEW` (no draft ever feeds a record view); (b) `populateTomSelect` resolves Teacher/Inspector from `dataset.pendingValue` (the record's text, set by `loadClosedRecord`) BEFORE the draft, mirroring `refreshSubjectOptions`, so they populate regardless of fetch order; (c) `loadForm` is gated on `!CLOSED_RECORD_VIEW` (not just `!R3_VIEWER`). Also `loadClosedRecord` is now resilient (9s `AbortController` timeout + silent retry, only a real server `success:false` surfaces) like `loadDropdownOptions`.
14. **R3 -> Supabase dual-write contract (v0.47). The Google Sheet is the source of truth; Supabase is the mirror.** `01_doPost.gs` appends the Sheet row FIRST, then calls `05_Supabase.gs pushToSupabase()` inside its own try/catch. A Supabase failure is logged and swallowed (never surfaced; hard rule 12) so no data is ever lost and the inspector never sees an error. The bridge POSTs the full row (same column mapping as the Sheet) to the `ingest_r3(payload jsonb)` Supabase RPC, which is **idempotent on `record_token`** (`assessments.source_ref`), so retries/re-submits never duplicate. **Auth:** `ingest_r3` is `SECURITY DEFINER`, EXECUTE granted to **service_role only** (anon is denied, verified 401); the service_role key lives in R3 **Script Properties** (`SUPABASE_SECRET_KEY`), never in code. **It MUST be the legacy service_role JWT (`eyJ...`, ~219 chars; env `SUPABASE_SERVICE_ROLE_KEY`), NOT the new `sb_secret_...` key** — the new secret keys reject any browser-like caller (`401 "Forbidden use of secret API key in browser"`) and Apps Script's `UrlFetchApp` sends a browser-ish User-Agent it cannot override, so `sb_secret_` keys can never work from Apps Script. The SQL is `~/AIS-Data-Dashboard/db/migrate_04_r3_ingest_and_config.sql` (applied via `node db/apply.mjs`); heal any drift with `db/backfill_r3.mjs`, check drift with `db/verify_mirror.mjs`. **Admin Settings cog (v0.47):** a discreet gear on the R3 form opens a password-gated panel (password `AvasIgor`, stored bcrypt-hashed in Supabase `app_config`, checked server-side by the `verify_admin_password` RPC, reusable by any component) that sets the current inspection Round via `admin_set_setting` (key-whitelisted to `current_round`). `ingest_r3` stamps each new record with `app_config.current_round`. The form's Supabase **publishable** key (anon, client-safe) is inlined in the master and ships INSIDE the StatiCrypt-encrypted form; `encrypt.sh` **blanks `SB_KEY`/`SB_URL` in the ungated viewer build** (`r3-record.html`) because the publishable key can call `get_raw_snapshot` (all teacher names + ratings), so it must never ship cleartext on the public viewer. Keep that strip when touching `encrypt.sh`.

---

## Identity / auth (current state as of v0.10 · 2026-05-28)

Both Apps Script projects and both Sheets run as **`admin.user@ais.ae`** (Super Admin). Single-identity setup across the whole system. R3 also requires the **AdminDirectory** advanced service (for the staff-groups teacher list).

**Pre-v0.9 history:** the lesson observation script was originally on `igorsbasketball@gmail.com` because an AIS Workspace policy blocked `ANYONE_ANONYMOUS` Apps Script Web Apps under @ais.ae. Migrated to admin.user once Super Admin rights landed; empirical test confirmed @ais.ae now serves anon web apps without a visible Admin Console toggle being flipped (likely Super Admin auto-trust for internal apps). The old igorsbasketball deployment is the rollback path, decommission target ~2026-06-07.

**Diagnosing future Apps Script web app 302s:** A 302 from `/macros/.../exec` is *normal*. Apps Script always sandbox-redirects to `script.googleusercontent.com/macros/echo?...` to serve responses. **Look at the `Location:` header** before panicking: `googleusercontent.com` = healthy, `accounts.google.com/ServiceLogin` = auth broken. For POSTs via `curl`, do NOT use `-X POST`. Apps Script needs the redirect followed as a GET (browser default behavior).

---

## Deploy chain

### HTML changes (`index.html` or either form)

1. Edit master, bump version labels everywhere (see hard rule 6). For R3 the master is `Assets/R3/src/r3-evidence-form.html`.
2. **R3 only:** run `Assets/R3/encrypt.sh`; it regenerates BOTH `Assets/R3/r3-evidence-form.html` (encrypted) and the ungated teacher viewer `Assets/R3/r3-record.html`. Lesson Observation is not encrypted; skip this step.
3. `git add -p && git commit -m "vX.Y · ..."`
4. `git tag vX.Y && git push origin main --tags`
5. **Pages auto-rebuild has been flaky.** If changes don't appear after ~2 min, force a rebuild: `gh api -X POST repos/Rogerceaser21/Data-Representation/pages/builds`
6. For large pushes (touching the docx template or full forms), Git push may fail with `HTTP 400`. Fix: `git config http.postBuffer 524288000` and retry.

### Apps Script changes (either `apps-script/*.gs` or `Assets/R3/apps-script/*.gs`)

1. Edit `.gs` files
2. `cd <correct apps-script folder> && clasp push --force` (clasp must be logged in as admin.user@ais.ae)
3. **Redeploy in place** (URL stays stable): `clasp redeploy <deployment-id> -d "vX.Y summary"`. The R3 deployment id is `AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ`. If you must create a brand-new deployment (`clasp create-deployment ...`), update the matching `WEB_APP_URL` in the form HTML and re-encrypt R3.
4. **First-time deploys or new scopes:** open the script in the browser editor, run `forceAuth` (and `bootstrap` + `buildTeacherSheet` for R3), click through OAuth consent. CLI cannot trigger this.

### Cache invalidation (R3 only, since v0.33)

`Assets/R3/apps-script/02_doGet.gs` `getDropdownOptions()` is wrapped in `CacheService` with a 5-minute TTL. If you edit the Teachers / Inspectors / Curriculum / Subjects tabs and need the form to see the change before the TTL expires:

1. Open the R3 Apps Script editor (link in `Assets/R3/Google file links.md`).
2. Pick `clearOptionsCache` from the function dropdown.
3. Run.

Otherwise the form serves the cached options until natural expiry.

---

## Coding discipline (Karpathy guidelines)

These apply to every edit in this repo. If a request seems to require violating one, surface it first.

1. **Think before coding.** State assumptions explicitly. If multiple interpretations exist, present them; don't pick silently. If a simpler approach exists, say so. Push back when warranted. If something's unclear, stop and ask.
2. **Simplicity first.** Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no flexibility or configurability that wasn't requested, no error handling for impossible scenarios. If 200 lines could be 50, rewrite it.
3. **Surgical changes.** Touch only what the user asked about. Don't "improve" adjacent code, formatting, or comments. Match existing style even if you'd do it differently. Mention unrelated dead code; don't delete it. Every changed line should trace directly to the request.
4. **Goal-driven execution.** Transform vague tasks into verifiable goals before starting. "Add validation" becomes "Write tests for invalid inputs, then make them pass". For multi-step work, state a brief plan with a verify step per item.

---

## When in doubt

Ask Igor. He prefers a question over a wrong assumption, but the bar is *genuinely undetermined*. Things derivable from this repo, the sibling `Export Ready HTML AIS Report/`, or the prior conversation are not genuinely undetermined; infer the default and proceed (noting the assumption briefly).

Once Igor has weighed a concern and made a call, **execute**; don't re-raise the same concern with a different framing.

**Never use em dashes (—) or en dashes (–) in any output.** Substitute with commas, periods, parentheses, or semicolons. Hyphens inside compound words (like "spreadsheet-first" or "single-select") are fine.

---

## Related

| Thing | Value |
|---|---|
| This repo | `github.com/Rogerceaser21/Data-Representation` (private) |
| Live deck | https://rogerceaser21.github.io/Data-Representation/ |
| **Lesson Observation** ||
| Live form | https://rogerceaser21.github.io/Data-Representation/Assets/Lesson%20Observation%20Form/lesson-observation-form.html |
| Sample locked record | https://rogerceaser21.github.io/Data-Representation/Assets/Lesson%20Observation%20Form/lesson-observation-form.html?id=AIS-OBS-20241112-1430 |
| Sheet | https://docs.google.com/spreadsheets/d/1KKgHe42JnRe5iA8iODRrh3UZHD93szZSDatQylivoAc/edit |
| Apps Script | scriptId `1wfwv-3le3lMFeiV6E_hghRQ3F2kAiInNaNlnQbipx4bLMFH9N0yRKXEL` (admin.user) |
| Web App `/exec` | `https://script.google.com/macros/s/AKfycbw8b_yMyCg1cW63q4d6SDxOKRLeFFv7rwywCIAh-y4bY3ZUUxhKrpYOmkZXAODTeDI3/exec` |
| Seed record | `AIS-OBS-20241112-1430` (Ben Hyde observing Mr Igor, 2024-11-12) |
| **R3 Evidence** ||
| Live form (StatiCrypt-gated) | https://rogerceaser21.github.io/Data-Representation/Assets/R3/r3-evidence-form.html |
| Teacher viewer (ungated, record-link-only) | https://rogerceaser21.github.io/Data-Representation/Assets/R3/r3-record.html?id=...&token=... |
| Access password | `ais2026ais` (edit + re-encrypt to rotate) |
| Master source | `Assets/R3/src/r3-evidence-form.html` |
| Encrypt build | `Assets/R3/encrypt.sh` |
| Apps Script deployment id | `AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ` (use with `clasp redeploy`) |
| Cache invalidation | run `clearOptionsCache` from the Apps Script editor |
| Google asset links | [`Assets/R3/Google file links.md`](Assets/R3/Google%20file%20links.md) |
| Sheet | https://docs.google.com/spreadsheets/d/1V1Nb8hTWN-FpDps2Q_-F0TBWBFnPHVBW_sicWk8XVKo/edit |
| Apps Script | scriptId `1BYxWpSsqs-48AKnWH4BUQonAKHqDcY6VbiWA1SNbhBZT0QgDzLUatgRn` (admin.user) |
| Web App `/exec` | `https://script.google.com/macros/s/AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ/exec` |
| Backup email mailbox | `admin.user@ais.ae` · CC to selected inspector (from `Inspectors!B` column) · auto-label `R3 Submissions` via Gmail filter |
| Source template | `Assets/R3/R3 Evidence Form Template.docx` |
| **Lesson Observation rollback (pre-v0.9, decommission ~2026-06-07)** ||
| Apps Script | scriptId `1_7so0rIf1guEYc8AkEPj6f2-yDerR3aH4tItFYDemf7E_UdcrtbWky_e` (igorsbasketball@gmail.com) |
| Web App `/exec` | `https://script.google.com/macros/s/AKfycbzoxepKzA8vSQkDd0_OEl65EVw017BCC_kFhxSJueP5nZqTQYMtLVMuUr_vpILdavQ4/exec` |
| **Other** ||
| Sibling design-precedent | `../Export Ready HTML AIS Report/` (academic report, StatiCrypt, ship.sh workflow) |
| Sibling deployed | `github.com/Rogerceaser21/sample-student-report` |
