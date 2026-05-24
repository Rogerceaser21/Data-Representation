# CLAUDE.md — Data-Representation

> Bootstrap doc for future Claude sessions. Read this *before* touching anything in this folder.

---

## What this is

AIS Sharjah **Teacher Observation showcase system**, pitched 2026-05-21 to principal Steven McLuckie ahead of the early-2027 school review. Three pieces glued together:

1. **5-slide HTML pitch deck** (`index.html`) — the showcase Steven sees first
2. **Interactive lesson-observation form** (`lesson-observation-form.html`) — observers fill this in, it locks on submit, and can be re-opened in read-only mode via `?id=AIS-OBS-...`
3. **Google Apps Script backend** (`apps-script/`) — receives form POSTs, appends rows to a Google Sheet, returns records on GET

Currently at **v0.9** (Apps Script + Web App migrated to admin.user@ais.ae). Live at https://rogerceaser21.github.io/Data-Representation/

---

## File map

```
Data-Representation/                          github.com/Rogerceaser21/Data-Representation (PRIVATE)
├── index.html                                5-slide pitch deck; P3 has 3 sub-link buttons (GDoc, HTML form, closed form)
├── lesson-observation-form.html              interactive form; WEB_APP_URL constant lives at line 1319
├── apps-script/                              clasp project for the Web App backend
│   ├── .clasp.json                           scriptId 1wfwv-3le3lMFeiV6E_hghRQ3F2kAiInNaNlnQbipx4bLMFH9N0yRKXEL (admin.user@ais.ae)
│   ├── 00_Config.gs                          SHEET_ID + getColumns() — 80+ column schema, DO NOT REORDER
│   ├── 01_doPost.gs                          append-row handler, generates record_id
│   ├── 02_doGet.gs                           ?id=AIS-OBS-... → record as JSON
│   ├── 03_helpers.gs                         jsonOut wrapper + forceAuth (one-shot OAuth trigger; keep)
│   └── appsscript.json                       webapp: ANYONE_ANONYMOUS, USER_DEPLOYING
├── SPEA Data Report/                         worked-example source docs (Jo Mare Kruger portrait, OTP, probation form)
├── Assets/brand/AIS Logo/                    AIS White.png + AIS Navy.png (only assets the deck loads at runtime)
├── README.md                                 STALE — still describes v0.1 pitch only; slated for rewrite separately
├── CLAUDE.md                                 this file
└── .gitignore
```

The deck and form are self-contained at runtime — all CSS and JS are inline; only Google Fonts and the AIS logo PNGs are external.

---

## How the pieces connect

```
                                          Google Sheet "Submissions"
                                     (admin.user@ais.ae's Drive, shared
                                      with igor.sesar and igorsbasketball)
                                                    ▲
                                                    │ append row / read row
                                                    │
   index.html ──P3 buttons──► form ──POST JSON──► Apps Script Web App
   (GitHub Pages)            (Pages)      ▲       (deployed as igorsbasketball@gmail.com)
                               │           │
                               └─GET ?id=──┘   closed-record viewer mode
```

---

## Hard rules — do not break

1. **Sheet column order is load-bearing.** The 80+ column schema in `apps-script/00_Config.gs` `getColumns()` was auto-created on first POST. Existing rows are positional. *Append* new columns at the end if needed — never reorder or insert in the middle.
2. **Record ID format is `AIS-OBS-YYYYMMDD-HHMM`** (generated server-side from `submitted_at` in `01_doPost.gs:62`). Changing the format breaks the closed-record-viewer URL pattern for every existing record.
3. **`WEB_APP_URL` lives at `lesson-observation-form.html:1319`.** If you `clasp deploy` a new version that gets a new `/exec` URL, you must update that constant and ship the HTML — otherwise the form silently keeps hitting the old deployment.
4. **Repo stays private** until ratings are real OR the deck is StatiCrypt-encrypted like the sibling `sample-student-report`. Real teacher names (Jo Mare Kruger, Olivia Gill) sit next to fabricated ratings, plus real SPEA source docs.
5. **Don't commit the `.docx` file's noise diffs.** `SPEA Data Report/Lesson Observation - Igor- 12_11.docx` flutters by a byte every time Word touches it. Skip it unless the content actually changed.
6. **Every push bumps the visible version label AND tags.** Bump version in: cover term-tag, every masthead `.school` text, P5 floor, `.version-badge` element. Commit msg starts `vX.Y · summary`. `git tag vX.Y` after the commit. `git push origin main --tags`. The version badge must be visible on the live site so Igor can tell at a glance what he's looking at.

---

## Identity / auth (current state as of v0.9 · 2026-05-24)

Apps Script project + Web App run as **`admin.user@ais.ae`** (Super Admin).
Destination Sheet also lives in **`admin.user@ais.ae`**'s Drive — single-identity setup.

**The old two-identity setup (pre-v0.9):** Originally the script was deployed under `igorsbasketball@gmail.com` (Igor's personal Gmail) because an AIS Workspace policy was blocking `ANYONE_ANONYMOUS` Apps Script Web Apps under @ais.ae — deploys returned 302 to `accounts.google.com/ServiceLogin`. That setup was migrated out on 2026-05-24 once admin.user got Super Admin rights. Empirical test confirmed @ais.ae now serves `ANYONE_ANONYMOUS` web apps without any visible Admin Console toggle being flipped — Google appears to auto-trust internal apps deployed by a Super Admin.

**Old deployment still alive as rollback** (will be soft-cut ~2026-06-07): `https://script.google.com/macros/s/AKfycbzoxepKzA8vSQkDd0_OEl65EVw017BCC_kFhxSJueP5nZqTQYMtLVMuUr_vpILdavQ4/exec` (script `1_7so0rIf1guEYc8AkEPj6f2-yDerR3aH4tItFYDemf7E_UdcrtbWky_e`). If the new deployment develops a problem, revert `WEB_APP_URL` in `lesson-observation-form.html:1319` to the old URL, push, done.

**Diagnosing future Apps Script web app 302s:** A 302 from `/macros/.../exec` is *normal* — Apps Script always sandbox-redirects to `script.googleusercontent.com/macros/echo?...` to serve responses. **Look at the `Location:` header** before panicking: `googleusercontent.com` = healthy, `accounts.google.com/ServiceLogin` = auth broken. For POSTs via `curl`, do NOT use `-X POST` — Apps Script needs the redirect followed as a GET (which is what browsers do by default; curl needs `-d` without `-X POST`).

---

## Deploy chain

### HTML changes (`index.html`, `lesson-observation-form.html`)

1. Edit master → bump version labels everywhere (see hard rule 6)
2. `git add -p && git commit -m "vX.Y · ..."`
3. `git tag vX.Y && git push origin main --tags`
4. GitHub Pages rebuilds in ~30-90s; hard-refresh (Cmd+Shift+R) to verify

### Apps Script changes (`apps-script/*.gs`)

1. Edit `.gs` files
2. `cd apps-script && clasp push --force` (clasp must be logged in as the script owner — currently `admin.user@ais.ae`)
3. `clasp deploy --description "..."` → note the new `/exec` URL
4. **If the URL changed**: update `WEB_APP_URL` in `lesson-observation-form.html:1319` and ship the HTML
5. **First-time deploys** require a one-time manual auth: open the script in the browser editor, run any function, click through the unverified-app warning. CLI cannot trigger this.

---

## Coding discipline (Karpathy guidelines)

These apply to every edit in this repo. If a request seems to require violating one, surface it first.

1. **Think before coding.** State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so. Push back when warranted. If something's unclear, stop and ask.
2. **Simplicity first.** Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no flexibility or configurability that wasn't requested, no error handling for impossible scenarios. If 200 lines could be 50, rewrite it.
3. **Surgical changes.** Touch only what the user asked about. Don't "improve" adjacent code, formatting, or comments. Match existing style even if you'd do it differently. Mention unrelated dead code — don't delete it. Every changed line should trace directly to the request.
4. **Goal-driven execution.** Transform vague tasks into verifiable goals before starting. "Add validation" → "Write tests for invalid inputs, then make them pass." "Fix the bug" → "Write a test that reproduces it, then make it pass." For multi-step work, state a brief plan with a verify step per item.

---

## When in doubt

Ask Igor — he prefers a question over a wrong assumption. But the bar is *genuinely undetermined*. Things derivable from this repo, the sibling `Export Ready HTML AIS Report/`, or the prior conversation are not genuinely undetermined — infer the default and proceed (noting the assumption briefly).

Once Igor has weighed a concern and made a call, **execute** — don't re-raise the same concern with a different framing.

---

## Related

| Thing | Value |
|---|---|
| This repo | `github.com/Rogerceaser21/Data-Representation` (private) |
| Live deck | https://rogerceaser21.github.io/Data-Representation/ |
| Live form | https://rogerceaser21.github.io/Data-Representation/lesson-observation-form.html |
| Sample locked record | https://rogerceaser21.github.io/Data-Representation/lesson-observation-form.html?id=AIS-OBS-20241112-1430 |
| Sheet | https://docs.google.com/spreadsheets/d/1KKgHe42JnRe5iA8iODRrh3UZHD93szZSDatQylivoAc/edit |
| Apps Script project (current) | `1wfwv-3le3lMFeiV6E_hghRQ3F2kAiInNaNlnQbipx4bLMFH9N0yRKXEL` (admin.user@ais.ae) |
| Web App `/exec` (current) | `https://script.google.com/macros/s/AKfycbw8b_yMyCg1cW63q4d6SDxOKRLeFFv7rwywCIAh-y4bY3ZUUxhKrpYOmkZXAODTeDI3/exec` |
| Apps Script project (old, rollback) | `1_7so0rIf1guEYc8AkEPj6f2-yDerR3aH4tItFYDemf7E_UdcrtbWky_e` (igorsbasketball@gmail.com, decommission ~2026-06-07) |
| Web App `/exec` (old, rollback) | `https://script.google.com/macros/s/AKfycbzoxepKzA8vSQkDd0_OEl65EVw017BCC_kFhxSJueP5nZqTQYMtLVMuUr_vpILdavQ4/exec` |
| Seed record | `AIS-OBS-20241112-1430` (Ben Hyde observing Mr Igor, 2024-11-12) |
| Sibling design-precedent | `../Export Ready HTML AIS Report/` (academic report, StatiCrypt, ship.sh workflow) |
| Sibling deployed | `github.com/Rogerceaser21/sample-student-report` |
