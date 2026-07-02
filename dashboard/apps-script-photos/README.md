# AIS Teacher Photo Mirror (Apps Script)

Daily mirror of the staff headshots from Drive into Supabase Storage, feeding
`teachers.photo_url` for the dashboard Teacher portal. Decision record:
`.planning/2026-07-02-teacher-portal-DECISIONS.md` (decisions 6 + 7).

- **Source:** Drive `AUISDF24082025 DB and YB Files/DB Files` (249 name-keyed 400x600
  headshots) + `Staff/Database` extras + loose files in `Staff/`. YB Files ignored.
- **Destination:** Supabase Storage bucket `teacher-photos`, object `<teacher uuid>.jpg`,
  public read (URLs unguessable by uuid); `photo_url` carries `?v=<md5[0:8]>` for cache-busting.
- **Matching:** deterministic only. Exact normalised `full_name` OR a `photo_alias` row.
  Fuzzy discovery + the human match report live in `~/AIS-Data-Dashboard/db/photo_match.mjs`
  (report: `db/photo_match_report.md`). Unmatched teachers get the initials avatar in the UI.
- **Idempotent:** Drive `md5Checksum` vs `teachers.photo_md5`; unchanged files are skipped.
  Deletions propagate (Drive photo gone -> storage object deleted + `photo_url` nulled).
- **Never in the Pages repo:** photos must not land in `dashboard/assets` (public by design).

## One-time setup (browser editor, as admin.user@ais.ae)

1. `clasp push` from this folder (already done at build time).
2. Editor > Project Settings > Script Properties: add `SUPABASE_SECRET_KEY` =
   the **legacy service_role JWT** (`eyJ...`; the `sb_secret_` key CANNOT work from
   Apps Script, same as the R3 ingest bridge, CLAUDE.md hard rule 14).
3. Run `forceAuth` -> click through the OAuth consent.
4. Run `checkSetup` -> expect "setup OK: supabase reachable (1 row) · drive photos visible: ~258".
5. Run `installDailyTrigger` -> daily 03:00 Asia/Dubai.
6. Optional first `syncPhotos` run: expect mostly `kept` (the initial import was done by
   `node db/photo_mirror.mjs --write` from the Mac).

## Heal / big photo drop

Run `syncPhotos` manually in the editor (or wait for the nightly trigger). The Mac-side
equivalent is `node ~/AIS-Data-Dashboard/db/photo_mirror.mjs --write` (same logic, same state).
After new hires land in the photo folder, re-run `node db/photo_match.mjs --write` first if
their filenames don't exactly match `teachers.full_name` (it re-seeds `photo_alias` + refreshes
the match report).
