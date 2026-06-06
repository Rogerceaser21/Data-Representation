# CLAUDE.md · Data-Representation

> Bootstrap doc for future Claude sessions. Read this *before* touching anything in this folder.

---

## What this is

AIS Sharjah **Teacher Observation showcase system**, pitched 2026-05-21 to principal Steven McLuckie ahead of the early-2027 school review. Currently at **v0.37** with **two parallel HTML forms** wired to **two separate Google Sheets** backed by **two separate Apps Script projects** (both under admin.user@ais.ae):

1. **Lesson Observation form**, internal AIS template, 4 sections, 36 S/U criteria, signatures, OTP aligned
2. **R3 Evidence form**, SPEA / governance template, single-select Evidence Type, 10 judgements on a 1-6 scale, searchable teacher dropdown sourced from 6 staff Workspace Groups

Plus a **5-slide HTML pitch deck** at `index.html` that links to both forms from P3.

Live: https://rogerceaser21.github.io/Data-Representation/

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
│       ├── r3-evidence-form.html             ENCRYPTED output (StatiCrypt) · what teachers / GitHub Pages serves
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
│       │   ├── 00_Config.gs                  getSheetId() via PropertiesService + getR3Columns() 48-col schema + BACKUP_EMAIL_TO + FORM_PUBLIC_URL
│       │   ├── 01_doPost.gs                  append row, generate record_token, auto-compute duration (v0.32), email-on-submit + CC inspector (v0.31), Link-only URL (v0.33)
│       │   ├── 02_doGet.gs                   ?id=AIS-R3-...&token=... · safeForSelector + CacheService 5-min TTL + clearOptionsCache (v0.31, v0.33)
│       │   ├── 03_helpers.gs                 jsonOut, forceAuth, bootstrap (creates Sheet + tabs + seeds + stores SHEET_ID)
│       │   ├── 04_TeacherLoader.gs           pulls staff from 6 Workspace Groups via Admin SDK (recurses nested groups)
│       │   └── appsscript.json               webapp + AdminDirectory advanced service + admin.directory.* + script.send_mail scopes
│       └── 2026-05-28_email_R3-Data...md     correspondence record (R3 kickoff email to Dave, CC Leon + Steve)
├── SPEA Data Report/                         worked-example source docs (Jo Mare Kruger portrait, OTP, probation form)
├── .planning/
│   └── v0.10-r3-form-checklist.md            multi-phase plan + acceptance criteria + IDs
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
2. **Record ID formats are `AIS-OBS-YYYYMMDD-HHMM` and `AIS-R3-YYYYMMDD-HHMM`.** Generated server-side. Changing the format breaks the closed-record-viewer URL pattern for every existing record.
3. **`WEB_APP_URL` constants must match the deployed `/exec` URL for each form.** If you `clasp deploy` a new version that gets a new `/exec` URL, update the matching constant in the form HTML and ship.
   - Lesson Observation: `Assets/Lesson Observation Form/lesson-observation-form.html`, search for `const WEB_APP_URL`
   - R3 master: `Assets/R3/src/r3-evidence-form.html` (the encrypted output at `Assets/R3/r3-evidence-form.html` is regenerated from this)
4. **Repo stays private** until ratings are real OR the form is StatiCrypt-encrypted (R3 form is, from v0.29). Real teacher names sit next to fabricated ratings.
5. **Don't commit the `.docx` file's noise diffs.** `SPEA Data Report/Lesson Observation - Igor- 12_11.docx` flutters by a byte every time Word touches it. Skip unless content actually changed.
6. **Every push bumps the visible version label AND tags.** Bump version in: cover term-tag, every masthead `.school` text, P5 floor, version-badge element, AND both form footers (R3 footer lives in the **master** at `Assets/R3/src/r3-evidence-form.html`). Commit msg starts `vX.Y · summary`. `git tag vX.Y` after the commit. `git push origin main --tags`.
7. **R3 reference tab schemas are load-bearing.** The R3 form reads Inspectors / Curriculum / Subjects / Teachers from named tabs via `?action=options`. Single-column tabs assume header row + data rows; Teachers tab uses column A = name only (v0.28). The form's `setupSearchableTeacher` + `loadDropdownOptions` break silently if the tab schemas shift.
8. **The redirect stub at `lesson-observation-form.html` (root) must be preserved.** It catches old URLs (`/lesson-observation-form.html?id=AIS-OBS-...`) and forwards to the new path. Removing it 404s any reference shared before the v0.10 move.
9. **R3 master / encrypted split (v0.29).** Edit `Assets/R3/src/r3-evidence-form.html`. Run `Assets/R3/encrypt.sh` from anywhere; it regenerates `Assets/R3/r3-evidence-form.html` (the StatiCrypt-encrypted output GitHub Pages serves). Never hand-edit the encrypted output. School-wide gate password is `ais2026ais` (hardcoded in `encrypt.sh`; rotate by editing + re-encrypting).
10. **R3 locked-record viewing requires a token.** From v0.29 the URL must be `?id=AIS-R3-...&token=<32-hex>`. The token is generated in `01_doPost.gs` per submission and is included in the backup email to `admin.user@ais.ae`. Without the token, the doGet returns "Record not found". Pre-v0.29 test records have no token and are not viewable.
11. **Never put user-data strings into Tom Select option `value` (v0.34 iOS WebKit fix).** Tom Select v2.6.1's internal `addSlashes` only escapes `\ " '` and does NOT escape NBSP, ZWSP, U+2028/9, control chars, or other CSS-meaningful chars. iOS WebKit's strict selector parser throws `SyntaxError: The string did not match the expected pattern` from the resulting malformed selectors, blanking the dropdowns. StatiCrypt's `document.write` aggravates this by triggering stricter post-load parsing. **Rule:** teacher / inspector / subject (any Tom Select fed user-controlled strings) must use **opaque indices** as `value` (e.g. `t0`, `i0`, `s0`...) and put the human-readable name in `text`. Translate `value` back to `text` via `tomSelects[name].options[value].text` at submit + save time so the Sheet still stores names. See `src/r3-evidence-form.html` `populateTomSelect`, `refreshSubjectOptions`, `submitForm`, `saveForm`, `loadClosedRecord` for the pattern.
12. **Stakeholders must never see an error or a stuck spinner (v0.37).** The R3 form is used by the school's most senior staff; Igor's absolute rule is "no error UI, ever." The dropdown options fetch in `src/r3-evidence-form.html` `loadDropdownOptions()` therefore: caps each attempt at 7s via `AbortController`+`setTimeout` (NOT `AbortSignal.timeout`, which is iOS 16+ only), silently retries behind the existing frosted overlay (no toast, no error text), reloads once as a last resort (guarded by a `?_r=1` flag against loops), and reloads on `pageshow` when `event.persisted` is true (a stale iOS tab restored from bfcache, the documented cause of the "stuck on loading" hang). When changing this code path, preserve all four behaviours: timeout, silent retry, bfcache reload, guarded last-resort reload. Never surface a visible failure state to the user.

---

## Identity / auth (current state as of v0.10 · 2026-05-28)

Both Apps Script projects and both Sheets run as **`admin.user@ais.ae`** (Super Admin). Single-identity setup across the whole system. R3 also requires the **AdminDirectory** advanced service (for the staff-groups teacher list).

**Pre-v0.9 history:** the lesson observation script was originally on `igorsbasketball@gmail.com` because an AIS Workspace policy blocked `ANYONE_ANONYMOUS` Apps Script Web Apps under @ais.ae. Migrated to admin.user once Super Admin rights landed; empirical test confirmed @ais.ae now serves anon web apps without a visible Admin Console toggle being flipped (likely Super Admin auto-trust for internal apps). The old igorsbasketball deployment is the rollback path, decommission target ~2026-06-07.

**Diagnosing future Apps Script web app 302s:** A 302 from `/macros/.../exec` is *normal*. Apps Script always sandbox-redirects to `script.googleusercontent.com/macros/echo?...` to serve responses. **Look at the `Location:` header** before panicking: `googleusercontent.com` = healthy, `accounts.google.com/ServiceLogin` = auth broken. For POSTs via `curl`, do NOT use `-X POST`. Apps Script needs the redirect followed as a GET (browser default behavior).

---

## Deploy chain

### HTML changes (`index.html` or either form)

1. Edit master, bump version labels everywhere (see hard rule 6). For R3 the master is `Assets/R3/src/r3-evidence-form.html`.
2. **R3 only:** run `Assets/R3/encrypt.sh` to regenerate the encrypted `Assets/R3/r3-evidence-form.html`. Lesson Observation is not encrypted; skip this step.
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
