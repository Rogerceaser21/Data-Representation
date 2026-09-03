# OTP v0.1 deploy runbook (drafted 2026-09-03, executes only on Igor's word)

Branch `claude/otp-form` holds everything (form, Apps Script, migration). Nothing below has run.
Order matters: Sheet tabs -> Apps Script -> Supabase -> git/Pages -> docs. Each step has a check
and a rollback. Run from the build worktree (or any fresh checkout of the branch), never the
stale Drive checkout.

## 0. Preconditions (read-only)

```bash
node Assets/OTP/tests/gs-harness.mjs            # expect: 56 passed, 0 failed
npx playwright test                              # expect: 6 passed
(cd ~/AIS-Data-Dashboard && node db/dryrun.mjs db/migrate_14_otp.sql)   # expect: verdict PASS
```

## 1. Google Sheet: roster tabs (gws as admin.user, super admin)

Live tab ids (read 2026-09-03): Teachers = 2005119720, Inspectors = 479063594, Submissions = 0.
One atomic batchUpdate (all four requests succeed or none). Validate locally first with `--dry-run`.

```bash
gws sheets spreadsheets batchUpdate --dry-run \
  --params '{"spreadsheetId":"1V1Nb8hTWN-FpDps2Q_-F0TBWBFnPHVBW_sicWk8XVKo"}' \
  --json '{"requests":[
    {"updateSheetProperties":{"properties":{"sheetId":2005119720,"title":"Teachers 25-26"},"fields":"title"}},
    {"duplicateSheet":{"sourceSheetId":2005119720,"insertSheetIndex":6,"newSheetName":"Teachers 26-27"}},
    {"updateSheetProperties":{"properties":{"sheetId":479063594,"title":"Inspectors 25-26"},"fields":"title"}},
    {"duplicateSheet":{"sourceSheetId":479063594,"insertSheetIndex":8,"newSheetName":"Inspectors 26-27"}}
  ]}'
```

Then the same command without `--dry-run`. Check:

```bash
gws sheets spreadsheets get --params '{"spreadsheetId":"1V1Nb8hTWN-FpDps2Q_-F0TBWBFnPHVBW_sicWk8XVKo","fields":"sheets.properties(sheetId,title)"}'
```

Expect titles: Submissions, Teachers 25-26, Teachers 26-27, Inspectors 25-26, Inspectors 26-27, Curriculum, Subjects (plus the old backup tabs).
The 26-27 copies hold last year's rows until Igor pastes the new roster (column layout unchanged: Teachers col A = name; Inspectors col A = name, col B = email).

Then point R3 at the renamed tabs (R3 keeps last year's roster until Igor flips these two constants to 26-27):

```
Assets/R3/apps-script/00_Config.gs
  const SHEET_NAME_TEACHERS    = 'Teachers 25-26';
  const SHEET_NAME_INSPECTORS  = 'Inspectors 25-26';
```

`getTabWithFallback` then falls back to the 25-26 tabs if a 26-27 tab is ever missing. Re-run the harness after the edit (56 passed expected; the harness seeds its own tab names, so update `ROSTER_R3` keys in `Assets/OTP/tests/gs-harness.mjs` to the new names in the same commit). Commit on the branch.

Rollback: rename back (`title` -> `Teachers` / `Inspectors`) and `deleteSheet` the two copies.

## 2. Apps Script (shared R3 project, URL stays stable)

```bash
cd Assets/R3/apps-script
clasp push --force
clasp redeploy AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ -d "otp-v0.1 · OTP form routing + 26-27 rosters"
```

Then open the script editor (link in `Assets/R3/Google file links.md`) and run `clearOptionsCache` once.
No new scopes were added, so no re-consent is expected.

Check (both must be `success:true`; the second must list the same teachers as the Teachers 26-27 tab):

```bash
curl -sL "https://script.google.com/macros/s/AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ/exec?action=options" | head -c 300
curl -sL "https://script.google.com/macros/s/AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ/exec?action=options&form=otp" | head -c 300
```

Rollback: `clasp deployments` to find the previous version, `clasp redeploy <id> -V <previous version>`.

## 3. Supabase migration

```bash
cd ~/AIS-Data-Dashboard
node db/dryrun.mjs db/migrate_14_otp.sql         # PASS again, right before applying
node db/apply.mjs  db/migrate_14_otp.sql
node db/q.mjs "select (select count(*) from criteria where source_form='otp') otp_criteria, (select value from app_config where key='current_round_otp') otp_round, (select has_function_privilege('anon','public.ingest_otp(jsonb)','execute')) anon_can_ingest, (select has_function_privilege('service_role','public.ingest_otp(jsonb)','execute')) service_can_ingest, (select count(*) from information_schema.columns where table_name in ('teachers','inspectors') and column_name='roster') roster_cols"
```

Expect: otp_criteria 1, otp_round "OTP Term 1 26-27", anon_can_ingest false, service_can_ingest true, roster_cols 2.
Then confirm the dashboard still loads its snapshot (open the live dashboard once; the migration restricts `get_raw_snapshot` to r3 rows, proven byte-identical for today's data).

Rollback: `get_raw_snapshot` from `db/migrate_10_photos.sql`, `admin_set_setting` from `db/migrate_06_dashboard_settings.sql`; `drop function ingest_otp(jsonb), get_current_round_otp()`; the criterion row, config key and roster columns are harmless to leave.

## 4. Git: merge to main, tag, Pages

```bash
git fetch origin
git checkout claude/otp-form && git rebase origin/main      # expect: already up to date
git push origin claude/otp-form:main
git tag otp-v0.1 && git push origin otp-v0.1
```

Pages deploys from main via the self-healing Actions workflow. Verify live = committed:

```bash
for f in otp-progress-form.html otp-record.html; do
  echo "$f local $(md5 -q Assets/OTP/$f) live $(curl -sL https://rogerceaser21.github.io/Data-Representation/Assets/OTP/$f | md5 -q)"; done
```

Mismatch after ~3 min -> `gh workflow run "Deploy to GitHub Pages"` and re-check.
Then open https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-progress-form.html (password ais2026ais): dropdowns populate, the network tab shows `?action=options&form=otp` success:true. Open the R3 form once too.

## 5. CLAUDE.md doc-sync (pre-approved doc edit, apply after step 4)

File map, under `Assets/`:

```
│   └── OTP/
│       ├── otp-progress-form.html            ENCRYPTED output (StatiCrypt) · the observers' Progress in Lessons OTP form (otp-v0.1)
│       ├── otp-record.html                   UNGATED viewer · generated by encrypt.sh (window.R3_VIEWER, SB key stripped)
│       ├── src/otp-progress-form.html        MASTER · R3 v0.58 master copy with content sections swapped (header, SP1 rubric chips, five notes)
│       ├── rubric-sp1.json                   verbatim SP1 rubric (26 paragraphs) inlined into the master
│       ├── encrypt.sh                        build · same password as R3
│       ├── db/migrate_14_otp.sql             Supabase: ingest_otp, otp_sp1 criterion, current_round_otp, roster columns, snapshot guard (+ dryrun.mjs)
│       ├── tests/                            otp.spec.ts (Playwright) + gs-harness.mjs (Apps Script harness, R3 byte-identity)
│       └── README.md · DEPLOY-v0.1.md
```

Related table rows:

| **Progress in Lessons OTP** ||
| Live form (StatiCrypt-gated) | https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-progress-form.html |
| Viewer (ungated, token-only) | https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-record.html?token=... |
| Backend | same R3 Apps Script + Sheet; tab `OTP Submissions` (26 cols), rosters `Teachers 26-27` / `Inspectors 26-27`; Supabase `ingest_otp`, round key `current_round_otp` (admin cog, password AvasIgor) |

Hard-rule addendum to rule 14 (one sentence): the OTP form mirrors through `ingest_otp` (service_role only, idempotent on record_token) and the dashboard snapshot is restricted to `type = 'r3'`.
