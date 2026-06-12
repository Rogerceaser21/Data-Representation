# Next jobs · Moderation change + dashboards

**Captured:** 2026-06-11 (from Igor, after Dave + Brooke conversation)
**Status:** planning only, nothing built yet. Remind Igor 2026-06-12 and onward.

These are Igor's jobs for this weekend / next working session, in order.

---

## Decisions already made (Dave + Brooke)

1. **No formal moderation.** Inspectors "moderate" informally by chatting at the
   time of, or right after, the inspection. There is no separate moderation step
   to build.
2. **Best score wins, and best = lowest number.** The scale is 1-6 where **1 is
   best, 6 is worst**. When a teacher has more than one score on the same
   judgement point (multiple inspectors / observations), we do **NOT average**.
   We take the **lowest (best) score**. Example Dave gave: one inspector scores 3,
   another scores 4, the teacher gets **3** (3 is better than 4).
3. **Inspectors do NOT get to edit their notes.** Not enough impact to be worth
   it. Teachers receive feedback **verbally**. Inspectors already have their own
   notes by email (the per-inspector forwards we did on 2026-06-11).

---

## Job 1 · Change the Observed sheet from AVERAGE to BEST (lowest)

- Target the **"Observed Term 3 - Week 12"** tab in the R3 Sheet
  (`1V1Nb8hTWN-FpDps2Q_-F0TBWBFnPHVBW_sicWk8XVKo`).
- Today the 10 judgement columns use `AVERAGEIFS(... , score>=1)`. Replace the
  average with the **minimum (best) score** per judgement point (lowest of the
  scores given, ignoring blanks/zeros). Keep "blank = not assessed, leave blank,
  never 0".
- Net effect the score handed to the teacher is the best (lowest) any inspector
  gave on that point, not the average.
- Backup the tab first (duplicateSheet) before editing, per the standing rule.

## Job 2 · Parse and clean "this spreadsheet" into the admin/Steve dashboard feed

**The spreadsheet:** "Mock inspection judgements"
`1ACrCZwbRZayV4pKHvj_-HjaMpTgj7We2bq-vFl0NiS8`
https://docs.google.com/spreadsheets/d/1ACrCZwbRZayV4pKHvj_-HjaMpTgj7We2bq-vFl0NiS8/edit
- **Owner: lana.mosleh@ais.ae**, shared with igor.sesar. **NOT shared with
  admin.user**, so the `gws` CLI returns 403. To work on it programmatically,
  either read/write via the **igor.sesar Google Drive tools**, or get Lana/Igor
  to share it with admin.user first.
- ~40+ rows, one row per observation. First tab title "Inspection observations".

**Columns (messy, human-entered, header does not perfectly line up with data):**
roughly Phase (Primary) | Subject | Teacher observed | **Judgement (WORD)** |
Observed by | Feedback provided by | (a second person column) | Date of Feedback |
Summary of next steps | Coaching need.

**Judgements are WORDS, not the 1-6 numbers the R3 form uses.** Map on the
standard SPEA/UAE 6-point scale (1 = best) when merging:
Outstanding=1, Very Good=2, Good=3, Acceptable=4, Weak=5, Very Weak=6.

**Parsing work needed:**
- **Get the correct names in** the teachers are first-name-only or messy
  (e.g. "Rory", "Kate (G1)", "Kate (G3)", "Gina (Kindy)", "Hayden C", "Meg
  Muller", "Eman"). Need mapping to full/correct teacher names.
- Some teachers appear **more than once** (e.g. "Gina (Kindy)" Good + Weak;
  "Eman" Good + Weak). The **best-score-wins (lowest number)** rule from Job 1
  applies here too once words are converted to numbers.
- **Dates vary** (2/2/26, 02/02/2026, 3/2/26, 4/2/26, 5/2/26). Per Igor, treat
  **all observations as dated 2026-02-02**.
- "Coaching need" values: Immediate W5-6, Moderate W7-10, Not required.
- "Observed by / Feedback provided by" use short names and "HOD".

**Then:**
- Produce **two sets of data** on what Igor calls the **admin / Steve dashboard**
  (presumably set 1 = the live R3 form data, numeric; set 2 = this mock-inspection
  data, dated 2026-02-02). Confirm with Igor.
- The **summary notes** ("Summary of next steps") go into **"D observer notes"**
  so they can be gathered/collated later.

## Job 3 · Build the teacher-facing dashboard ("teacher's face" dashboard)

- Start from the **initial SPEA data report** and add the data into it.
- Allow **Steve, Dave, administrators, and Brooke** to manipulate the data.
- Surface **all notes + all judgement scores + everything** first, before adding
  any other data on top.

---

## Job 0 · Teacher-form fixes (R3 form / the copy a teacher receives)

These are on the **R3 master** `Assets/R3/src/r3-evidence-form.html` (re-encrypt
with `Assets/R3/encrypt.sh` after editing, hard rule 9). Bump version + tag.

1. **Time in / Time out missing on the teacher's copy.** They do not render on the
   copy a teacher would get (Igor ref "pic 1", screenshot not captured here).
   Likely dropped when the closed-record view was rebuilt. Check the closed-record
   render path (`loadClosedRecord` in the master) AND `buildSubmissionHtml` in
   `Assets/R3/apps-script/01_doPost.gs` (which currently DOES emit Time in / Time
   out / Duration rows, ~lines 204-206) to find where the teacher-facing copy
   drops them.
2. **Password must not be the same for every teacher.** Today StatiCrypt uses one
   school-wide gate password (`ais2026ais`, hardcoded in `encrypt.sh`). Igor wants
   it per-teacher. This is a design change, StatiCrypt is single-password by
   nature; options to weigh with Igor (per-record token already exists in the
   doGet URL; per-teacher gate; or a different access model). Confirm approach
   before building.
3. **Remove the Agenda, Check Teacher, and New Observation buttons for teachers.**
   These floating quick-links (v0.38-v0.40) are inspector tools; a teacher viewing
   their copy should not see them. Make them conditional (hide in the teacher /
   locked-record context).

## Open questions to confirm with Igor before building

- Job 1 best score = `MINIFS` across the matching score cells? (Assumed yes,
  lowest wins.) Confirm it applies per judgement column, same match keys as the
  current averages (teacher + observation date).
- Job 2 which exact spreadsheet is "this spreadsheet" (the SPEA Data Report docs,
  or a new export)? What are the "bits and pieces" to change?
- Job 2 what are the **two sets of data** on the admin/Steve dashboard?
- Job 3 platform for the dashboard (HTML like the existing forms, or in-Sheet)?

---

## Related / in-flight

- Inspector note backfill (per-inspector email forwards) is the current task.
  Lana done (10). Chris 8, Famia 7, Victoria 3, Dave 12 queued; 5 test-looking
  records held for Igor's call. See the live conversation / handoff.
- Scoring + colour logic and the Observed tab structure are documented in
  `handoff/handoff-2026-06-09-1145.md`.
