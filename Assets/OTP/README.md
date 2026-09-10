# Progress in Lessons OTP form · otp-v0.7.1

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
   Number, Subject. No class statistics, no Time Out, so no duration.
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
   `No colour: not assessed (does not count)`, `Green: present in lesson`,
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
4. Five Observer Notes blocks, each with the Evidence Pad pencil button and the
   pad-pages paperclip: Observer Comments, Other Observations, and Next Steps /
   Support 1-3. otp-v0.6 adds 32 more Evidence Pad targets, one per criterion
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
form ("otp"), teacher, curriculum, inspector, date, room_number, time_in,
subject, school, grade, support_teachers_cas, otp_ref ("SP1"),
otp_aspect ("Facilitating better than expected progress"),
sp1_beginner, sp1_emerging, sp1_good, sp1_great, sp1_outstanding,
sp1_selected_text, sp1_present, sp1_partially_present, sp1_not_present,
sp1_not_seen, sp1_notes, rubric_version,
observer_comments, other_observations,
next_step_1, next_step_2, next_step_3, evidence_pad_id
```

31 keys (the 29 of otp-v0.5 plus the two new ones), asserted verbatim AND by
count in `tests/otp.spec.ts`, which reads the key list straight out of the
otp-v0.6 contract. otp-v0.6 appends the last two of the rubric block,
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

## Tests

```bash
npm install            # once, repo root: @playwright/test is the only dependency
bash Assets/OTP/encrypt.sh
npx playwright test    # config at the repo root, spec at Assets/OTP/tests/otp.spec.ts
```

The spec drives the BUILT artifacts (through the StatiCrypt gate, and the
ungated viewer) with every `script.google.com` / `supabase.co` call mocked.
30 specs as of otp-v0.7.1.

## Changelog

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
