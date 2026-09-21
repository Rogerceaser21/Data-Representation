## Teacher Tracker (otp-v0.12)

A password-gated page listing every teacher and where they are in the six-step
observation process, so a coach can check "have I observed this teacher, and
what's next" without opening the Sheet. Built from an owner-approved look mock
(`handoff/research/2026-09-21-otp-v012/mock/tracker-mock.html`), wired to the
LIVE read-only Supabase function `get_otp_tracker()` (`supabase/sql/migrate_25_otp_tracker.sql`),
which reuses the exact rules `get_teacher_lap_state` (the form's own status
strip) already uses, so the tracker and the strip can never disagree. It never
returns a token, a rating, a note or a Next Step, only stage.

- Master: `src/otp-tracker.html`. Self-contained like the form (inline CSS/JS,
  `../brand/AIS Logo/...` relative paths, Google Fonts the only external
  request). POSTs to `SB_URL + '/rest/v1/rpc/get_otp_tracker'` with the same
  publishable key and header pattern as the form's `sbRpcTimed`. Hard rule 12
  (no error UI, ever): each attempt is capped via `AbortController` (7s in
  production; a documented test-only `?_tmo=<ms>` query flag shortens it for
  the resilience specs), a stall or a bad answer retries silently behind the
  loading overlay, a guarded `?_r=1` reload is the last resort after 8
  attempts, and a tab restored from bfcache reloads outright. A Refresh
  button re-fetches on demand.
- Build: `encrypt.sh` adds a THIRD StatiCrypt output, `otp-tracker.html`
  (same password `ais2026ais`, same `password-template.html`, its own
  `--template-title`/`--template-button`). Never hand-edit the output.
- Gate: same access password as the form, so only coaches and leaders can
  open it (teachers never get the password). The ungated teacher viewer
  (`otp-record.html`) already hides the Check Teacher link and ships with a
  blank `SB_URL`/`SB_KEY`, so it has no visible or reachable route to the
  tracker and cannot call Supabase at all.
- The form's Check Teacher button (`Assets/OTP/src/otp-progress-form.html`)
  now opens `otp-tracker.html` in a new tab instead of the old Google Sheet;
  nothing else about the form changed.
- Row mapping (six steps: Teacher Observation, Teacher Reflection Form
  [Coming soon], Observation details emailed, Observation Feedback Meeting,
  Teacher Plan Form [Coming soon], Observation complete): an open lap ->
  completed/coming/(emails done? completed : pending)/ACTIVE/coming/pending;
  no open but a last closed lap -> all completed except the two Coming-soon
  steps; neither -> all pending. Tapping a row expands its full history,
  oldest first. Chips: All, Not observed, Observation, Reflection Form
  (disabled), Emails, Feedback Meeting, Plan Form (disabled), Completed. A to
  Z by name; an `on_roster:false` test teacher renders like any other row.
  Dates render like the form does ("14 Sep"). All teacher-derived text goes
  through `textContent`, never `innerHTML`.
- A commented seam in `otp-tracker.html` (and in the SQL) marks where a later
  version could show what the teacher wrote per step, once the Reflection
  Form and Plan Form exist. Not built.
- Tests: `tests/tracker.spec.ts`, every title prefixed `otp-v0.12 A2:`. Mocks
  `get_otp_tracker` with fixtures using the real key names; covers every row
  state, the three counts, A-to-Z order, every chip's exact row set, search,
  history expand/collapse (including multi-lap history), the Active pill at
  744/834/1024 with no clipping, light/dark, the two resilience paths (a
  stalled first response, a 500 then a 200), and the lock-out guarantees
  above (the built tracker's raw bytes hold no fixture name/key, the viewer
  stays keyless with no reachable link, the form's link targets the tracker).

## otp-v0.11 · released to main (2026-09-20)

Tag `otp-v0.11` (`3b5399f`). What GitHub Pages serves is this release build
(served md5 = committed: form `aad7f69fabecc46d6312a49a9811ec7d`, teacher page
`774fa0429a86103a2245d437e78b2f18`). The preview is archived as origin tag
`preview-otp-v0.11`. Apps Script @33: OTP email subjects read
`AIS OTP Observation N · [teacher ·] date` (the teacher's own copy carries no
name) and every link is the text "Click here to view." / "Click here to edit.".
The one-open-observation block is ON in Supabase
(`app_config.otp_block_open_required`); the matching Script Property
`OTP_BLOCK_OPEN_REQUIRED` is set by hand in the Apps Script editor. Known,
shipped as-is (cosmetic): on Mac Safari the Teacher list can stay open after a
pick (not reproduced on the WebKit rig yet). Suite: 294 specs, Chromium +
WebKit, exit 0. Live proof: test observation 17 (`AIS-OTP-20260920-115018`).

## otp-v0.11 · continue and close, no reload (2026-09-18, task 7, preview build)

Part of the otp-v0.11 "lap tracker" plan (`graph/continue` branch, wave 3),
built on task 5 (the strip) and task 6 (email stamps). Fixes the three
findings an independent review left open on task 5, then builds plan 2.2
(continue and close an open observation from the normal form, no page
reload) and plan 3.6 (definitive Supabase answers never fall back to
Google). Live writes untouched; the edge function change is additive.

- **STRIP-001 (`refreshTeacherStatus`).** A teacher change now renders the
  grey pending state (`STRIP_GREY_VIEW`) at once, before awaiting
  `get_teacher_lap_state`. Before this fix, changing from Teacher A (open
  observation drawn) to Teacher B left A's line, card states and
  `#strip-continue` (with A's token) on screen until B's answer returned.
- **STRIP-002 (`submitForm`).** Right after a successful Save & Lock the
  strip now shows the observation just opened (card 1 Completed, card 4
  Current) for the whole 3 s locked interval, via a direct local render
  (`renderStripJustOpened`) instead of the stale pre-submit picture. Prefers
  the lap from the write result (Supabase path); the Google fallback answers
  with no lap, so it falls back to `nextLapCache`, the `next_lap` cached from
  the last `get_teacher_lap_state` read for the picked teacher.
- **STRIP-003 (`formatDay`).** A date-only value (`"2026-09-16"`) is now
  parsed as a local calendar date (`new Date(y, m-1, d)`), not
  `new Date("2026-09-16")` (UTC midnight, which a browser west of UTC showed
  as the day before). The month is spelled from a fixed table
  (`FORMAT_DAY_MONTHS`) because en-GB's `Intl` abbreviates September as
  "Sept", not the "Sep" of the approved mock. A full timestamp (`closed_at`
  etc.) is unaffected, unchanged.
- **`EDIT_MODE` is switchable state, not a load-once constant.** `EDIT_TOKEN`
  / `EDIT_MODE` are now `let`, flipped in place by `continueOpenObservation()`
  and `exitEditToBlank()`, with no page reload (a reload can show the gate
  again; the wrapped iOS app needs this). `#strip-continue` is now a
  `<button>` (was an `<a>`): its token lives only in the closure variable
  `stripContinueToken`, read by one click handler, never the DOM, a log, or
  the URL.
- **Continue** (`continueOpenObservation`, plan 2.2 + 3.5): flushes the blank
  form's draft (local, then its Supabase copy) first (if anything besides
  the teacher/observer names was typed, a confirm asks first, and it stays
  saved as the draft either way), then bumps `formContextGen` and loads the
  picked teacher's open record through the exact path `?edit=` already uses
  (`loadClosedRecord` in edit mode, Supabase `otp-record` first).
- **`formContextGen`** (plan 3.5.2): bumped on Continue, on Reset, on the
  Teacher-box × (`exitEditToBlank`), and once a record finishes loading
  (`enterEditMode`). `loadClosedRecord`, `pullDraftFromSupabase`,
  `syncDraftToSupabase` and the Evidence Pad's `extractAndApply` /
  `applyTextToField` all capture it when they start and do nothing (or, for a
  pad extraction, write into the STORED draft instead of the screen, via
  `writeIntoStoredDraft`) if it has changed by the time they resolve. The
  dropdown options fetch stays page-wide and exempt, unchanged.
- **`clearRecordDisplay`** (plan 3.5.4/3.5.5): every record control, pending
  Tom Select value, rubric chip/note, pad paperclip and the pad lightbox
  state are cleared before a record fills the page (never the saved draft);
  the fill loop no longer skips a field the record deliberately left blank
  (`loadClosedRecord` dropped its `value === ''` guard). Pad images now cache
  by record token + filename, not filename alone (`fetchPadImage`), so a
  late image for another record, or the same filename from a different
  teacher, is never shown. `EvidencePad.refreshAvailability()` re-hides/shows
  the field pencils on a mode change; `EvidencePad.available` is a live
  getter, not a value frozen at construction.
- **Exit to blank** (`exitEditToBlank`, plan 2.2.6 + 3.5.7): the Teacher-box
  × while continuing (its Tom Select `onChange` now checks `!value &&
  EDIT_MODE`) runs the same steps in reverse: the draft comes back, and the
  strip + Next Steps echo re-read for whatever teacher the draft names.
- **R7 on the blank form** (plan 2.2.4): while the picked teacher has an open
  observation, Save & Lock stays grey regardless of what is filled
  (`updateSubmitState`'s `teacherOpenBlocked`, from `openBlockInfo`, set by
  `refreshTeacherStatus`); a tap says exactly "Observation N is still open.
  Continue it, or close it first." (`showOpenObservationBlocked`), no
  override.
- **Definitive answers (plan 3.6).** The v0.11 form always sends
  `enforce_open_block: 'true'` on a submit (never stored in `content`, the
  server strips it). A parsed Supabase answer whose `error` is
  `open_observation` or `already_closed` is final: `sbWrite` attaches the
  parsed answer as `err.answer`; `submitForm` and `postEditRecord` show the
  calm message and refresh the strip without ever asking Google. The Google
  fallback stays for everything else (no answer, a timeout, unusable JSON,
  any other `success:false`). `supabase/functions/otp-submit/index.ts` now
  passes through an allowlist (`lap`, `id`, `status`, `closed_at`) on those
  two error codes only; nothing else about its answer shape changed.
- **Specs:** the three Part A fixes (STRIP-001/002/003, the last in its own
  `timezoneId: 'America/Los_Angeles'` describe block), one per point of plan
  2.2, plus: a record load via Continue or `?edit=` never touches the draft
  (hard rule 13); typed Next Steps never survive into a continued record
  whose own are empty; a draft pull and a pad extraction that resolve AFTER
  Continue change nothing in the loaded record; teacher A's pad image is
  never shown for teacher B's same-named file; a record that arrives before
  its option lists still ends with Teacher/Observer/Subject filled and the
  edit buttons enabled; `open_observation` / `already_closed` never fall
  back to Google and name the lap from the answer. The existing Continue spec
  was rewritten: the button no longer navigates, so the token-placement
  assertion now expects it nowhere in the DOM at all (was: exactly once, in
  `href`).

## otp-v0.11 · status strip + Next Steps rework (2026-09-18, task 5, preview build)

Part of the otp-v0.11 "lap tracker" plan (`graph/strip` branch, wave 2).
Adds the always-present six-card status strip above the top cards and
reworks the Next Steps echo. Continue / Close without a reload (task 7) and
the email naming sweep (task 8) are separate, later nodes.

- **Status strip** (`#status-strip-section`, plan 2.1). One read of the new
  Supabase RPC `get_teacher_lap_state` per teacher pick (`sbRpcTimed`, 3 s
  cap) drives the line above the cards and each card's Current / Completed
  / Pending / Coming soon / grey state. No answer, a timeout or
  `success:false`: the strip shows the grey "Select a teacher" look, no
  error text (hard rule 12). Never rendered in the ungated teacher viewer
  (`window.R3_VIEWER`). Card 3 (emails) reads `open.emails_legacy` or both
  email stamps; card 1's title uses the ordinal word for the observation
  number. The Continue button (`#strip-continue`, an `<a>`) carries
  `?edit=<token>` as its only copy of the token; wiring it to switch the
  form without a reload is task 7's job.
- **The blue "Teacher observed" card is gone.** `#prev-ns-card` (markup,
  CSS, and the card-only parts of `prevNsRender` / `prevNsHide`) is
  removed; the strip does that job now.
- **Next Steps echo** (`#prev-ns-echo`, plan 2.3), still driven by the same
  `get_teacher_lap_state` read: nothing for a genuinely first observation;
  an open observation's own Next Steps, falling back to the predecessor's
  (labelled "Observation N-1", R8) while its own are empty; the last closed
  observation's when nothing is open. When the new read gives no answer at
  all, the old Supabase-then-Google `get_prev_next_steps` path still fills
  the last-closed case, unchanged.
- **Naming (owner ruling R6).** Every on-screen "Lap N" / "lap" wording that
  names the numbered thing is now "Observation N" / "observation" (the
  locked banner, the Close Lap confirm dialog, the closed toast, the sticky
  open-observation notice, the Close Lap button's tooltip). The button
  itself stays "Close Lap"; stored field names, payload keys, Sheet
  columns and function names are untouched, while email labels use
  "Observation N".
- **Specs:** 13 new otp-v0.11 specs (Chromium + WebKit) cover the four
  worked examples, above-Tenth card 1 wording, the grey state, a dead
  `get_teacher_lap_state` (Save & Lock still works), a late answer for a
  dropped teacher, the three Next Steps states (including the predecessor
  and no-predecessor cases), the strip's absence in the viewer, the
  Continue link's `href` and token placement, reduced motion, the three
  widths, and (fix round 1) three sequence-guard races (F1-F3 below).
  Several existing `#prev-ns-card` specs were updated or removed.
- **Fix round 1 (2026-09-18), an independent review found four defects:**
  (F1) a distinct teacher change now invalidates any Next Steps fallback
  still in flight for the PREVIOUS teacher (`prevNsSeq`/`prevNsTeacher`
  reset, echo hidden) before the new teacher's own read starts, so a late
  `refreshPrevNextSteps()` answer can never land on the wrong echo; (F2)
  `closeCurrentLap()` now bumps `lapStateSeq` before its direct "just
  closed" render, so a `get_teacher_lap_state` read still in flight from
  `enterEditMode()` can never redraw the strip back to "open" afterwards;
  (F3) an `?edit=` link to an ALREADY-CLOSED record now calls
  `refreshTeacherStatus()` itself (`loadClosedRecord`'s `lockForm` branch),
  not only `enterEditMode()`, so the strip still reads the teacher's
  history even when the option lists landed first; (F4) the Save & Lock
  confirm's "until you close the lap." was missed by the first naming
  sweep, now "until you close the observation."

## otp-v0.10 · released to main (2026-09-18)

Tag `otp-v0.10` (`eab8c25`). The preview folder (`Assets/OTP/preview.10/`)
and its `gh-pages` branch are gone: what GitHub Pages serves now is this
release build. Phase 1-3 below (Supabase-first reads, writes, record links)
describe the same technical contract that shipped.

## otp-v0.10 · Phase 3 (2026-09-17)

Supabase-first, part three: the record links. Preview only, same branch as
Phases 1 and 2. No Sheet column, POST key, email or Apps Script change (still
@31): this phase only changes where a saved record is READ from.

- **The record comes from Supabase first.** `loadClosedRecord` now makes ONE
  plain GET to the edge function `otp-record`
  (`supabase/functions/otp-record/index.ts`, 3 s `AbortController` cap, no
  `apikey` and no `Authorization` header, so it stays a simple CORS request
  with no preflight) before the Apps Script token GET. The function calls
  `otp_record_by_token` (migration `db/migrate_21_otp_record.sql` in
  `~/AIS-Data-Dashboard`, service_role only), which answers one OTP record's
  `content` minus `record_token`, and adds `pad_files` by listing the private
  `evidence-pads` bucket exactly as `06_PadExtract.gs listPadFiles` does. The
  answer has the same shape the Apps Script read has, so nothing downstream
  changed: field population, the rubric version, the pad paperclips and the
  edit-mode unlock are untouched. About 1 s instead of 3-45 s, in all three
  places that open a record: the teacher viewer, `?edit=<token>` and the gated
  form's locked `?token=` view. `window.__otpReadSource.record` records which
  path answered (`supabase` or `google`).
- **A Supabase answer IS the record; a Supabase miss is not final.** A
  `success:true` answer renders and Google is not asked, in view or edit mode
  (owner ruling: Supabase is the main road, Google the backup). Anything else
  (a miss, a stall, an HTTP error, unparseable JSON) falls to the existing
  six-attempt Apps Script loop UNCHANGED, because the Sheet can still hold a
  row Supabase lacks and that same endpoint also resolves R3 tokens. Only
  Google's answer can produce the viewer's calm landing card or the gated
  form's toast, exactly as before. No error UI ever (hard rule 12).
- **One token, trimmed once.** `loadClosedRecord` trims the token at the top
  and that one value feeds the edge call, the Google URL, the pad viewer and
  the edit state. Nothing lowercases it: hard rule 10 is an exact match and
  Apps Script compares the same way, so only the canonical `^[0-9a-f]{32}$`
  form reaches Supabase and any other spelling goes straight to Google
  unchanged, as today. Every miss, wrong token, short token, missing token,
  database or storage failure answers the SAME generic
  `{success:false, error:'Record not found'}` at HTTP 200; a token is never
  logged and `record_token` never leaves in `data`.
- **The key-free viewer no longer waits on the option lists.** The ungated
  build (`window.R3_VIEWER`) holds no Supabase key (hard rule 14), so its only
  source for the lists was Apps Script (1.9-8.5 s, spikes to 95 s) and a 1 s
  record would still have sat behind the 'Preparing form' overlay. It no
  longer calls `loadDropdownOptions()` at all: Teacher / Observer / Subject
  each get ONE option built from the record's own text under an opaque key
  (`r0`, hard rule 11), Curriculum is drawn by `renderPillGroup` from the
  record's own value, and `loadClosedRecord` hides the overlay itself when the
  record lands and on its terminal failure path (the landing card still owns
  the overlay). The gated form is unchanged: it has the key, Phase 1 serves its
  lists from Supabase in about 0.5 s, and `applyDropdownOptions` there also
  drives `updateSubmitState()` / `refreshPrevNextSteps()`.
- **Locked stays locked.** On a locked `?token=` view, and on `?edit=` of a
  closed lap, the lists can now land AFTER the record. Neither
  `setSearchableLoadingState(false)` nor `refreshSubjectOptions()` will
  `enable()` a Tom Select while the form carries `is-locked`; only the
  edit-mode path (an open lap, which never locks) leaves them live.
- **Out of scope:** pad page IMAGES stay on Apps Script (`?action=pad_image`,
  token-gated and lazy), R3 records stay on Apps Script, and nothing is built
  for a Supabase outage (owner ruling: the Google fallback is the precaution;
  `db/verify_mirror.mjs` runs once before the Phase 4 release).
- **Specs:** ten new `otp-v0.10` Phase 3 specs (Chromium + WebKit). One
  pre-existing spec changed with the behaviour: the viewer's searchables now
  read `r0` where the list-fed gated form gives `t0` / `i0` / `s0`.

## otp-v0.10 · Phase 2 (2026-09-16)

Supabase-first, part two: the form's WRITES and the draft. Preview only, same
branch as Phase 1. No Sheet column, POST key or email change: the Sheet keeps
every row and Apps Script still sends every email.

- **Save & Lock, Save changes, Close Lap write to Supabase first.** The form
  mints a 32-hex `record_token` (one per attempt chain) and POSTs to the edge
  function `otp-submit` (`supabase/functions/otp-submit/index.ts`, 8 s cap,
  `sbWrite`). The function calls `otp_write` (migration
  `db/migrate_19_otp_writes.sql` in `~/AIS-Data-Dashboard`, service_role
  only), which builds the 38-key record exactly as `buildOtpRecord` /
  `handleOtpUpdateOrClose` would (id `AIS-OTP-YYYYMMDD-HHMMSS` in Asia/Dubai,
  lap, round, derived school, observer <- inspector, date), calls the existing
  idempotent `ingest_otp`, and answers in about a second. A double tap or a
  timed-out first try can never make two rows: both backends key on the token.
- **The Sheet is the mirror of Supabase's CURRENT state.** After answering, the
  function POSTs the record's token to Apps Script `action:'mirror'`
  (`08_OtpMirror.gs`, @31). Apps Script reads that record back from Supabase
  itself (`otp_record_for_mirror`, service key) and makes the Sheet row equal
  to it (appended, or overwritten in place by token; only the `getOtpColumns()`
  columns are ever written; a closed row is never reopened), sends the same
  submit / teacher / close emails as before, and `mark_otp_mirrored` stamps
  `assessments.mirrored_at` only if no newer write happened meanwhile. Because
  the payload is never trusted, two mirrors arriving out of order both write
  the latest state, and the anonymous route can only trigger a copy.
  `handleOtpPost`, `handleOtpUpdateOrClose` and the mirror share one
  `LockService` script lock (one Sheet writer at a time). `healOtpMirror`
  (5-minute trigger, `installOtpHealTrigger` once from the editor; also
  `doPost` action `'heal'`) mirrors up to 5 records per run that are still
  unmirrored after 2 minutes, each under its own lock and without the slow
  previous-lap pre-warm. The Sheet may lag, never lose.
- **Google fallback, silent.** Any edge-function miss (stall, HTTP error, a
  `success:false` such as a lap Supabase does not hold) takes the old Apps
  Script POST with the SAME token; `handleOtpPost` honours a valid supplied
  token: if Supabase already holds that token (the first write landed, its
  answer was lost) it mirrors THAT record and answers its id, so the Sheet,
  the emails and Supabase never disagree on an id; otherwise the old full
  submit runs. A stalled first Supabase try gets one shorter second try
  before Google: `otp_write` re-applies a repeated submit of an OPEN lap as an
  update (a retry with more typed in keeps the later text) and answers a
  repeated close as a no-op success, so the observer sees the truth. No error
  UI ever (hard rule 12). `window.__otpWriteSource` records
  which path took each write (`submit`, `edit`, `draftSave`, `draftLoad`).
- **The draft follows the observer.** Every local save is pushed to Supabase
  2 s after the last keystroke (`save_draft`, keyed by `DRAFT_SCOPE` + observer
  name; the preview build uses scope `otp-preview`). Picking an observer pulls
  that draft (`load_draft`): applied when this device holds nothing beyond the
  observer's name, or when this device's draft is fully synced and the
  Supabase copy carries a newer server stamp (server stamp against server
  stamp, kept in `localStorage['ais-otp-form-v1:sync']`; no device clock is
  compared; unsynced typing always stays); the teacher / grade / subject
  lists resolve immediately (`applyPulledDraftToControls`). Content typed
  under one observer's name never uploads under another's (a mis-tap on the
  Observer field cannot overwrite that person's draft). Save & Lock and Reset
  delete it (`delete_draft`, under the key it went up with). Footer now reads "Auto saved". Record views and edit mode
  never read or write it (hard rule 13).
- **Measured live (2026-09-16):** submit 0.9-1.1 s, update 0.4 s, close 0.9 s;
  Sheet row + emails 4-5 s later; heal sweep healed a deliberately unmirrored
  record; draft typed on the Mac appeared on the iPad simulator (iPadOS 26,
  real Safari) in about 1 s and survived a reload. Specs: seven new
  `otp-v0.10` specs; the submit contract spec filters `record_token` (transport
  identity, like `action` on the edit path). A cold-context review (Opus)
  returned 13 findings; 11 fixed in `migrate_20_otp_writes_fixes.sql`, @31
  and the form; two are trade-offs for Igor: the anon draft RPCs let anyone
  holding the gate password read, overwrite or wipe any observer's draft by
  name (closed by the @ais.ae sign-in), and the heal trigger exists only
  once `installOtpHealTrigger` has been run in the editor.

## otp-v0.10 · Phase 1 (2026-09-16)

Supabase-first, part one: the form's READS. Igor's goal is a form that loads,
picks a teacher, saves and closes in about a second; today the Apps Script
endpoints take 3-5 s with spikes to 95 s (lists) and 27-34 s (previous-lap
card). Phase 1 moves the reads; Phase 2 moves the writes + adds auto-save;
Phase 3 the record links. No Sheet column, POST key or email changes.

- **Lists from Supabase.** `fetchOptionsOnce` calls the anon RPC
  `get_form_options('otp')` first (3 s cap, `sbRpcTimed`), which returns the
  SAME payload shape as `?action=options&form=otp`; an empty or failed answer
  falls through to the unchanged Google path. The Sheet stays the MASTER for
  the lists: `ref_lists` (migration `db/migrate_18_otp_reference.sql` in
  `~/AIS-Data-Dashboard`) is a plain mirror of five tabs (Teachers 26-27, OTP
  Coaches 26-27, R3 Inspectors 26-27, Curriculum, Subjects + its school
  header), replaced wholesale per tab by `upsert_reference` (service key only).
  Synced daily at 06:30 Dubai by Apps Script `07_ReferenceSync.gs`
  (`installReferenceSyncTrigger` once from the editor; `syncReferenceNow` for
  a same-day edit) and from the Mac by `db/sync_reference.mjs --write`
  (`--diff` proves the RPC equals the live options payload name for name).
- **Previous-lap card from Supabase.** `refreshPrevNextSteps` calls
  `get_prev_next_steps(teacher)` first (same rule as the Apps Script read:
  latest CLOSED lap in the current round read from the row's own mirrored
  `round` cell, blank counts as current); a FOUND answer is final, a not-found
  or failed answer still asks Google (non-blocking), because the mirror is fed
  by a dual-write that swallows its failures until Phase 2 flips the order.
- `window.__otpReadSource` records which path answered (`supabase` /
  `google`) for the proof scripts and specs; never shown to the user.
- The ungated viewer build blanks `SB_URL`/`SB_KEY` as before, so the viewer
  skips the Supabase step and keeps the Google path (hard rule 14).

## otp-v0.9.4 (2026-09-15)

The Safari-on-Mac fix and the Teacher observed card, from Igor's Focus OS
reports. Front-end only: no Apps Script, no Sheet columns, no POST keys, no
Supabase.

- **Empty date and time fields look empty.** Safari on Mac draws an EMPTY date
  or time field as today's date or 12:30 PM, in the field's own text colour, so
  an empty Date, Time In or Time Out looked filled while the form held nothing,
  and Save & Lock stayed grey. An empty one (`.dt-empty`, kept in sync by
  `syncDateTimeEmpty`) is now drawn blank until it is focused. Safari only
  stores a date or a time once every part is set (day, month and year; hour,
  minute and AM/PM), and it never moves to the next part by itself.
- **A tap on the grey Save & Lock says what is missing.** "Not ready" is
  `aria-disabled` plus the grey class instead of the `disabled` attribute, so
  the tap arrives: the required boxes still empty get a dashed outline and a
  toast names them ("Still to fill: Date, Time Out"). The tap re-reads the
  fields first, so a stale grey state can never block a complete form.
- **Reset** also clears the Teacher observed card and its echo; a late answer
  for the teacher just wiped cannot bring them back.
- **The Teacher observed card** wraps inside the Teacher box: `.info-cell`
  gets `min-width: 0` (the one-line nowrap card made the Teacher column wider
  and squeezed the other two). Non-breaking spaces keep each "·" at a line end.
- **Proof in real Safari:** `tests/safari/safari_check.py` fails on
  otp-v0.9.3 (empty fields painting a value) and passes on otp-v0.9.4.

## otp-v0.9.3 (2026-09-12)

Six front-end changes Igor approved for the observers' first week. Front-end
only: no Apps Script, no Sheet columns, no POST keys, no Supabase.

- **C1** the card under Teacher is ONE line and nothing expands it: "Teacher
  observed 11 Sept 2026 · Lap 8 · goals below". The toggle, the chevron and the
  card's own copy of the three steps are gone.
- **C2** the goals themselves (the read-only echo of the previous lap's Next
  Steps) move ABOVE the rubric heading, so they are read before the new
  observation is scored. They appear in one place only.
- **C3** Close Lap pulses a soft red the whole time an open record is being
  edited, and stops the moment the lap closes. Colour only; reduced motion
  holds the tint without the pulse.
- **C4** Save changes on an open lap no longer fades a "Changes saved" toast:
  a sticky notice says the lap is still OPEN and what to do about it, and stays
  until it is dismissed, Close Lap succeeds, or the record locks.
- **C5** Time Out sits BELOW Next Steps / Support 3, right-aligned to that
  box's edge, at every width (it used to sit beside it in a second column).
- **C6** the five long-text boxes (Observer Comments, Other Observations, Next
  Steps / Support 1-3) grow with what is written in them, never shrink below
  their four-line start height, and go back to it on Reset.

## otp-v0.9.2 (2026-09-11, evening)

- D2 · iPadOS 26 keyboard dismiss key: the keyboard engine now remembers the largest keyboard inset seen (`peak`) and, once the viewport has come back, treats the docked accessory strip's re-inset (172 pt on an iPad Air 13-inch, measured on the device) as "keyboard down" instead of a keyboard; RESET / SAVE & LOCK / the cog / the theme toggle return within a second of the dismiss key instead of staying hidden until the page is tapped. Two deterministic specs replay the device-measured viewport heights through a fake `visualViewport` (53 specs per engine).

# Progress in Lessons OTP form · otp-v0.9.1

Third AIS observation form: **Lesson Observation form WHOLE SCHOOL, Observation
against the Outstanding Teacher Profile**. It is a COPY of the R3 Evidence form
master (`../R3/src/r3-evidence-form.html`, v0.58) with only the content sections
swapped. Every interaction is the R3 one, unchanged: the vv-delta keyboard
engine, the Evidence Pad, the debounced localStorage draft, the opaque-keyed Tom
Selects, the resilient options/record fetches, the token-gated record view.

Who it is for (from the source doc): DHoS, HoDs, Teacher Mentors, Coaches, doing
a focussed observation against one or more criteria of the OTP, to improve
practice through observational support and coaching.

## What is on the page

1. Nine header fields: Teacher, Support Teachers / CAs, Time In, **Observer**
   (the field is still named `inspector`), Curriculum, Grade, Date, Room
   Number, Subject. No class statistics. otp-v0.8: a required **Time Out**
   sits at the BOTTOM of the form, beside Next Steps / Support 3 (the R3
   form's `summary-with-timeout` layout), gates Save & Lock like the other
   required fields and is recorded as Sheet column 34; still no duration.
   otp-v0.5: Grade (Pre-Kindy, Kindy, Prep, 1-12, a 5-column tap grid)
   replaces the School pills; School is derived from Grade and no longer
   shown (Pre-Kindy/Kindy -> Kindy, Prep/1-6 -> Primary, 7-12 -> Secondary).
2. The static Who / What / Why strip from the doc.
3. **OTP Reference: SP1 Student Progress** rendered as the doc's table, one
   tappable chip per rubric criterion. otp-v0.6: the live rubric is
   `rubric-sp1-v2.json`, **32 single-sentence criteria** (Beginner 4, Emerging
   5, Good 7, Great 8, Outstanding 8), which is `rubric-sp1.json` split at
   sentence boundaries with the wording untouched. Both files are inlined
   verbatim as JS constants (`SP1` and `SP1_V1`), no runtime fetch; `SP1_V1`
   (26 paragraphs) exists only so a record saved before otp-v0.6 renders on the
   numbering it was written with. otp-v0.2: the chip colour is
   RECORDED DATA, not an on/off toggle. Each tap cycles the criterion clear ->
   green (present in lesson) -> yellow (partially present in lesson) -> red (not
   present in lesson) -> clear; any number of chips across any columns.
   otp-v0.3: the colour legend is a permanent strip directly under the level
   headers (Beginner..Outstanding) and above the chip row, always visible on
   the form and on a locked record view; there is no Info button.
   otp-v0.4: the Aspect of Practice caption is centred, the three legend
   items are spread evenly across the strip, and the tap hint sits on its
   own centred line as a quiet pale-blue pill so observers notice it.
   otp-v0.5: the legend gains a first entry for the untouched chip, and the
   criteria left uncoloured are recorded (see `sp1_not_seen` below); the tap
   cycle is unchanged.
   otp-v0.6: every chip also carries a small **`+` note button** at its
   bottom-right (a sibling of the chip, never nested, so it can never cycle the
   colour). The legend wording is now
   `Not Applicable to this lesson` (otp-v0.7.1 follow-up wording; v0.6 said
   `No colour: not assessed (does not count)`), `Green: present in lesson`,
   `Yellow: partially present in lesson`,
   `Red: expected but not present in lesson`.
   otp-v0.7: the note opens as a **pop-up card anchored to the chip it came
   from**, not as a table row, so it is impossible to miss on the bottom rows.
   There is ONE card and ONE scrim, permanently mounted inside the rubric
   section and driven by `data-state` alone (never `display`, `hidden` or
   `visibility`, the iOS raster rule), positioned `absolute` inside that
   section (never `fixed`, the keyboard engine owns `fixed`), so there is no
   scroll lock, no body reposition and no auto-focus: an Apple Pencil user
   never gets the keyboard thrown at them. It materialises out of the `+` and
   settles (280 ms in, 200 ms mirrored out, transform and opacity only; a
   reduced-motion reader gets the fade alone), and closes on Done, the scrim,
   Esc or the same `+`; another chip's `+` re-anchors the same card. It holds
   the criterion text, a textarea, the Evidence Pad pencil and paperclip for
   that criterion, and a Done button. otp-v0.7 also calms the colours: a
   filled note turns the `+` solid AIS navy `#143642` (not electric blue), and
   a coloured chip is a pale tint (`#E8F3EC`, `#FBF3DC`, `#FBE9EA`) keeping
   the normal dark ink, so a marked-up rubric reads calm rather than as a
   Christmas tree. The rubric wrapper no longer scrolls at tablet or desktop
   widths, so no scrollbar paints beside or under the table.
   otp-v0.7.1 (Igor's three complaints on the live v0.7): (a) the chip no
   longer reserves a 30 px strip for the `+`: the text sits in
   `.rub-chip-text` followed by an empty float spacer `.rub-note-gap`, so the
   `+` shares the last line with the text and the chip only grows when that
   line is full (a one-line chip went from 59 px to 28 px); (b) the `+` is a
   20 px circle inset 4 px from the chip's corner (36 x 32 tap pad) whose plus
   is an inline SVG of 2 px strokes on integer coordinates, so it rasterises
   dead-centre at 1x, 2x and 3x (the v0.7 1.5 px CSS gradient bars landed on
   half pixels and drifted 0.24 device px off-centre at 2x); (c) the 3 px
   coloured left edge on chips, legend swatches and print is gone, the tint
   alone is the state, the chip keeps its normal 1 px border; the edge hues
   `#2F7D4F` / `#C28E0E` / `#B23B3B` survive only as the pop-up's state dot.
   otp-v0.8: the card's textarea is FOCUSED the moment it opens (Igor: the
   cursor is already in the box), inside the tap itself so iPadOS raises the
   keyboard (a Pencil tap gets Scribble), and blurred again on close so the
   keyboard goes; a locked record view never focuses.
4. Five Observer Notes blocks, each with the Evidence Pad pencil button and the
   pad-pages paperclip: Observer Comments, Other Observations, and Next Steps /
   Support 1-3. otp-v0.8 removed the floating top-right "Evidence Pad"
   launcher: the pencils are the only way into the pad.
   otp-v0.6 adds 32 more Evidence Pad targets, one per criterion
   (`sp1_<level>_<n>_note`, page files `sp1-<level>-<n>-note[-k].jpg`),
   generated from the rubric rather than hand-listed. A criterion's pad page is
   created the first time its pencil is tapped, so the pad keeps its five
   standing pages until a note is actually written on one.

## Build

```bash
bash Assets/OTP/encrypt.sh
```

Edit the master `src/otp-progress-form.html` only. The script regenerates BOTH
outputs and neither may be hand-edited:

- `otp-progress-form.html` · StatiCrypt-gated observer form (password `ais2026ais`)
- `otp-record.html` · ungated teacher viewer, record-link-only
  (`window.R3_VIEWER=true` injected, `SB_KEY`/`SB_URL` blanked so the Supabase
  publishable key never ships in cleartext, hard rule 14)

Tom Select, Konva and perfect-freehand are **not duplicated**: the master loads
them from `../R3/lib/`. The AIS logos come from `../brand/`, same as R3.

## Backend contract

Submit POSTs JSON to the same `WEB_APP_URL` as R3 with exactly these keys:

```
form ("otp"), teacher, curriculum, inspector, date, room_number, time_in, time_out,
subject, school, grade, support_teachers_cas, otp_ref ("SP1"),
otp_aspect ("Facilitating better than expected progress"),
sp1_beginner, sp1_emerging, sp1_good, sp1_great, sp1_outstanding,
sp1_selected_text, sp1_present, sp1_partially_present, sp1_not_present,
sp1_not_seen, sp1_notes, rubric_version,
observer_comments, other_observations,
next_step_1, next_step_2, next_step_3, evidence_pad_id
```

32 keys (the 31 of otp-v0.6 plus `time_out`, otp-v0.8), asserted verbatim AND by
count in `tests/otp.spec.ts`, which reads the key list straight out of the
otp-v0.8 contract (`.planning/2026-09-10-otp-v0.8-contract.md`). otp-v0.6 appends the last two of the rubric block,
`sp1_notes` and `rubric_version`; nothing else changed name or position.

otp-v0.2 value formats. The three state words are exactly `present`,
`partially present`, `not present`.

- `sp1_<level>` hold that level's rated criteria as `"n:<state word>"` tokens
  joined by `", "` in ascending `n` (`"1:present, 3:partially present"`, empty
  string when none). A bare number is a legacy otp-v0.1 value and reads as
  `present`.
- `sp1_selected_text` is `"<Level> <n> (<State>): <criterion text>"` joined with
  `" | "`, level order Beginner..Outstanding then ascending `n`, `State`
  capitalised (`Present` / `Partially present` / `Not present`). otp-v0.6: it
  carries one item per criterion that is coloured **or carries a note**, an
  uncoloured criterion with a note reads `Not assessed`, and a note is appended
  to its item as `" Note: " + note` with its whitespace collapsed to single
  spaces (the cell is one line).
- `sp1_present`, `sp1_partially_present`, `sp1_not_present` are the same
  selection grouped by state: `"<Level> <n>"` items joined by `", "` in level
  order then ascending `n` (`"Good 1, Great 2"`), empty string when none. These
  three are **appended** Sheet columns (hard rule 1: append, never reorder).

otp-v0.5 additions (columns 30 and 31, appended).

- `sp1_not_seen` lists every criterion left uncoloured, `"<Level> <n>"` items
  joined by `", "` in level order then ascending `n`; all 32 when nothing is
  coloured (26 on a pre-v0.6 record), empty string when all of them are
  coloured. The four by-state lists always partition the criteria, so "not
  assessed" is its own bucket and never counts as present or absent.
- `grade` is one of `Pre-Kindy`, `Kindy`, `Prep`, `1` .. `12` (strings).
  `school` is still posted (derived on the client for the Subject filter) but
  the Apps Script re-derives it from `grade` and grade wins: Pre-Kindy/Kindy
  -> `Kindy`, Prep/1-6 -> `Primary`, 7-12 -> `Secondary`; an empty grade keeps
  the posted school (legacy rows). The Sheet row, the backup email and the
  Supabase mirror all carry the derived value.

otp-v0.6 additions (columns 32 and 33, appended).

- `sp1_notes` is `""` when no criterion carries a note; otherwise a
  `JSON.stringify` object whose keys are `"<Level> <n>"` in level order then
  ascending `n` and whose values are the note text, trimmed, internal newlines
  preserved, non-empty notes only. Example:
  `{"Good 3":"challenge is not provided","Great 5":"students still on SC1"}`.
  A note is typed in the panel or written with the Apple Pencil on that
  criterion's Evidence Pad page; either way the hidden `sp1_notes` input is the
  single source of truth and the textarea is never posted or drafted directly.
- `rubric_version` is the literal `sp1-v2` on every otp-v0.6 submission. It
  says which rubric the `sp1_*` numbering refers to. A record without it (or
  with any other value) is pre-v0.6 and is rendered on the 26 v1 paragraphs; a
  localStorage draft without it keeps every non-rubric field and drops its
  `sp1_*` values, so a stale draft can never light the wrong criterion.

- Options: `WEB_APP_URL + '?action=options&form=otp'` (same response shape as R3).
  Since 2026-09-10 (Apps Script @23) the teachers come from the shared
  `Teachers 26-27` tab and the observers from `OTP Coaches 26-27` (the HOD line
  managers, paired observers and R3 inspectors in one list); a missing coaches
  tab yields an empty observer list, never the R3 inspectors.
- Record view: `otp-record.html?token=...` fetches
  `WEB_APP_URL + '?token=...&form=otp'`; the legacy `?id=...&token=...` shape is
  still accepted and forwarded.
- Evidence Pad extract posts `target` = one of the five note field names, or
  (otp-v0.6) a criterion target `sp1_<level>_<n>_note`. A criterion target also
  posts `context` = that criterion's text, capped at 400 characters, so the
  backend prompt can name the field it is transcribing.
- Admin cog: same `verify_admin_password` RPC, but reads `get_current_round_otp`
  and writes `admin_set_setting` with `p_key: 'current_round_otp'`, so OTP rounds
  are independent of R3 rounds.
- localStorage draft key is `ais-otp-form-v1` (R3 keeps `ais-r3-form-v2`; a
  shared key would bleed drafts between the two forms on the same Pages origin).
  The Evidence Pad draft DB is `ais-otp-pad-v1`.

otp-v0.8 additions (column 34, appended).
otp-v0.9 additions (backend, appended): columns 35 `status` (`observed` | `closed`), 36 `closed_at`,
37 `lap` (1 + earlier rows for the same teacher), 38 `round` (the OTP round label at submit);
POST `action:'update'` / `action:'close'` keyed on `record_token` (refused once closed), and
`?action=prev_next_steps&form=otp&teacher=<name>` (latest closed lap of the current round,
names and Next Steps only). Blank cells on older rows read as observed / lap 1 / current round.

- `time_out` is the `HH:MM` the observer entered in the required Time Out
  field at the bottom of the form, exactly as posted. Rows written before
  otp-v0.8 stay 33 cells wide; the header self-heals to 34 on the first
  otp-v0.8 submission.

## Tests

```bash
npm install            # once, repo root: @playwright/test is the only dependency
bash Assets/OTP/encrypt.sh
npx playwright test    # config at the repo root, spec at Assets/OTP/tests/otp.spec.ts
```

The spec drives the BUILT artifacts (through the StatiCrypt gate, and the
ungated viewer) with every `script.google.com` / `supabase.co` call mocked.
51 specs as of otp-v0.9.1, run in BOTH Chromium and WebKit (the iPad rules
are WebKit rules), so a full pass is 102 results.

## Changelog

- **otp-v0.9.3** · Six approved front-end changes, no data change (same 32 POST
  keys, same Sheet columns, no Apps Script change): the previous-lap card under
  Teacher collapses to one unexpandable line pointing at the goals (C1); the
  goals themselves move above the rubric heading and appear there only (C2);
  Close Lap pulses soft red until the lap is closed (C3); Save changes on an
  open lap raises a sticky notice saying the lap is still open instead of a
  toast that fades (C4); Time Out sits below Next Steps / Support 3,
  right-aligned to it, at every width (C5); and the five long-text boxes grow
  with what is written in them (C6).

- **otp-v0.9.1** · Four defects the observers hit on the live form, fixed with
  no data change (same 32 POST keys, same Sheet columns, no Apps Script change):
  - **D1** a reload or reopen of a part-filled form wiped Teacher, Observer and
    Subject out of the `ais-otp-form-v1` draft while every other field survived;
    the restored text now waits in `dataset.pendingValue` until the Tom Select
    options land (the channel a record view already uses) and the autosave keeps
    it instead of blanking it.
  - **D3** Subject stays disabled, reading "Select Grade first", until a Grade is
    picked; clearing the loading state used to wipe that guard and leave the
    picker open on an empty list answering "No results found".
  - **D4** in the ungated viewer a wrong or expired link lands on the calm
    landing card with one quiet line, "This link is not valid or has expired.
    Ask your observer for a new link.", instead of a red toast over a blank form
    (hard rule 12); the gated form keeps its toast.
  - **D6** the Save & Lock confirm no longer claims the record cannot be edited:
    it says the observer can still change it from the link in the confirmation
    email until the lap is closed.

  Four specs added, one per defect (51 per engine).

- **otp-v0.9** · The coaching lifecycle, form side. A record reopens on the
  gated form at `?edit=<token>`: it loads through the same token GET as a
  locked record view and populates the same way (header fields, opaque-keyed
  Tom Selects, rubric chips, per-criterion notes, the Evidence Pad page
  viewer), but the fields stay LIVE while the lap is open. The action bar
  swaps Reset and Save & Lock for **Save changes** (posts `action:'update'`
  with `record_token` plus the same 32 contract keys, quiet confirmation, form
  stays editable) and **Close Lap** (one native confirm naming the lap and the
  teacher, then `action:'close'`, then the existing lock path). `evidence_pad_id`
  goes back exactly as it came: edit mode adds no pad pages, existing ones stay
  viewable through the paperclips, the pencils are hidden. A record that is
  already closed opens read-only, with no dead buttons. Edit mode never reads
  or writes the localStorage draft (hard rule 13 now reads
  `CLOSED_RECORD_VIEW || EDIT_MODE`), so the observer's in-progress new
  observation on the same iPad is untouched. Second feature: **previous Next
  Steps**, one read-only component in two places, a card under Teacher
  collapsed to `Lap 1 Next Steps · <date> · <observer>` and the same three
  steps echoed above Next Steps / Support 1. It reads
  `?action=prev_next_steps&form=otp&teacher=<name>` when a teacher is picked
  (and in edit mode from the record's own teacher); not found, a stall or a
  garbled answer leaves both hidden and says nothing (hard rule 12). Never in
  the ungated viewer. The locked banner now carries the lap: `Lap 1 · open` or
  `Lap 1 · closed <date>`. Nothing new is fixed-position, no scroll lock, the
  keyboard engine is untouched, and every new control is wired on `click`
  (never `pointerdown`, the otp-v0.8 WebKit lesson). One shared-default fix on
  the way past: `.pad-attach[hidden]` / `.pad-field-btn[hidden]` now really do
  hide, everywhere, not only inside the note card, so a pad button switched off
  in code stops showing as a dead icon.

- **otp-v0.8** · Igor's three asks of 2026-09-10. (1) The note card's
  textarea is focused the moment a `+` opens it and blurred on close
  (overrides the v0.7 no-auto-focus rule at his call: on iPad the keyboard
  rises on open, a Pencil tap gets Scribble). (2) A required **Time Out** at
  the bottom of the form (beside Next Steps / Support 3, the R3 layout) gates
  Save & Lock; new POST key `time_out` (32 keys) and Sheet column 34
  (`getOtpColumns()`, header self-heal, backup email row `Time out`, Apps
  Script redeployed in place). (3) The floating top-right Evidence Pad
  launcher is gone; every pencil and paperclip stays. Four specs added (34),
  harness 34 columns with a v0.6-tab heal case.
- **otp-v0.7.1** · Igor's three fixes to the v0.7 note UI, form only, no
  data change (same 31 POST keys, same values, same 33 Sheet columns, no
  Apps Script change): the chip hugs its text (the 30 px reserved strip is
  replaced by a trailing float spacer beside the last line), the `+` is a
  20 px circle inset 4 px with an inline-SVG plus on integer coordinates that
  measures 0.00 px off-centre at every device density (the v0.7 CSS gradient
  bars drifted 0.24 device px at 2x), and the 3 px coloured left edge is
  removed from chips, legend swatches and print (tints unchanged). Two specs
  adapted (`+` geometry and plus symmetry measured from the SVG path rect;
  tint-only borders), the print spec's badge check follows the SVG.
  Follow-up the same morning, same version: the first legend line reads
  `Not Applicable to this lesson` (Igor's wording); the recorded data words
  (`Not assessed` in `sp1_selected_text` and the print list), the note card
  header and the backup email label are unchanged.
- **otp-v0.7** · The note UI reworked to Igor's eye, form only; the data
  contract is untouched (same 31 POST keys, same `sp1_notes` /
  `sp1_selected_text` values, same 33 Sheet columns, no Apps Script change).
  The in-row note panel becomes ONE persistent pop-up card anchored to the
  chip's `+`, absolute inside the rubric section with its own scrim, growing
  out of the button it came from and shrinking back into it (280 ms
  `cubic-bezier(.22, 1, .36, 1)` in, 200 ms mirrored out, transform and
  opacity only, opacity-only under `prefers-reduced-motion`); Done, the scrim,
  Esc and the same `+` close it, another `+` re-anchors it. The `+` is a 22 px
  circle inset 6 px / 6 px with its plus drawn as CSS bars instead of a text
  glyph, a 36 px hit pad, and a one-shot pop when a note is filled by hand or
  by the pad (never on load or a draft restore); filled it is solid AIS navy
  `#143642`, and it prints as a solid dot. Coloured chips become calm tints
  with a 3 px coloured left edge and the normal dark ink, matched by the
  legend swatches, in light, dark and print. The rubric wrapper is
  `overflow: visible` above 760 px (only a phone still scrolls it sideways)
  and the overflow that forced the 1 px / 3 px scrollbars is gone.
- **otp-v0.6** · Sentence chips plus a note per criterion. The live rubric
  becomes `rubric-sp1-v2.json`, the same wording split at sentence boundaries
  into 32 single-sentence criteria (4/5/7/8/8); `rubric-sp1.json` stays in the
  repo and renders pre-v0.6 records. Every chip gains a `+` note button and an
  in-place note panel (typed, or handwritten through the Evidence Pad, which
  gains 32 generated criterion targets); the notes are posted as the appended
  `sp1_notes` JSON column and folded into `sp1_selected_text`, and the appended
  `rubric_version` column records which rubric the numbering refers to. Legend
  wording: "not seen" becomes "not assessed", and Red reads "expected but not
  present in lesson". Notes with content print as a Criterion notes list under
  the rubric table.
- **otp-v0.5** · "Not seen" becomes recorded data: a first legend entry
  "No colour: not seen in lesson (does not count)" and an appended
  `sp1_not_seen` column listing the uncoloured criteria (the tap cycle is
  unchanged). The School pills are replaced by a Grade picker (Pre-Kindy,
  Kindy, Prep, 1-12); School is derived from Grade on the server and stored
  as before, `grade` is appended as column 31. Backup email gains Grade and
  Not seen rows. Apps Script redeployed in place.
- **otp-v0.4** · Rubric head centring: the Aspect of Practice caption row is
  centred, the legend's three colour items are spread evenly and centred, and
  the tap hint moves to its own centred line styled as a quiet pale-blue pill
  so observers notice it. CSS only; no data, markup or JS change.
- **otp-v0.3** · The colour legend became a permanent strip under the level
  headers instead of behind a toggle; the Info button is removed. The floating
  Agenda button now opens the OTP Sheet instead of the inherited R3 inspection
  agenda Doc.
- **otp-v0.2** · SP1 chips became a four-state tap cycle whose colour is
  recorded data (clear / green present / yellow partially present / red not
  present), plus an Info button opening a colour legend row in the rubric head.
  Adds the three by-state hidden inputs and Sheet columns `sp1_present`,
  `sp1_partially_present`, `sp1_not_present`; `sp1_<level>` and
  `sp1_selected_text` changed shape (legacy otp-v0.1 rows still read as
  present). Same chip size, layout and feel as v0.1.
- **otp-v0.1** · First release: R3 v0.58 master copied, content sections swapped.
