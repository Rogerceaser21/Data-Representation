# Progress in Lessons OTP form · otp-v0.3

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
   (the field is still named `inspector`), Curriculum, School, Date, Room
   Number, Subject. No class statistics, no Time Out, so no duration.
2. The static Who / What / Why strip from the doc.
3. **OTP Reference: SP1 Student Progress** rendered as the doc's table, one
   tappable chip per rubric paragraph (26 of them, `rubric-sp1.json` inlined
   verbatim as a JS constant, no runtime fetch). otp-v0.2: the chip colour is
   RECORDED DATA, not an on/off toggle. Each tap cycles the criterion clear ->
   green (present in lesson) -> yellow (partially present in lesson) -> red (not
   present in lesson) -> clear; any number of chips across any columns.
   otp-v0.3: the colour legend is a permanent strip directly under the level
   headers (Beginner..Outstanding) and above the chip row, always visible on
   the form and on a locked record view; there is no Info button.
4. Five Observer Notes blocks, each with the Evidence Pad pencil button and the
   pad-pages paperclip: Observer Comments, Other Observations, and Next Steps /
   Support 1-3.

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
subject, school, support_teachers_cas, otp_ref ("SP1"),
otp_aspect ("Facilitating better than expected progress"),
sp1_beginner, sp1_emerging, sp1_good, sp1_great, sp1_outstanding,
sp1_selected_text, sp1_present, sp1_partially_present, sp1_not_present,
observer_comments, other_observations,
next_step_1, next_step_2, next_step_3, evidence_pad_id
```

otp-v0.2 value formats. The three state words are exactly `present`,
`partially present`, `not present`.

- `sp1_<level>` hold that level's rated criteria as `"n:<state word>"` tokens
  joined by `", "` in ascending `n` (`"1:present, 3:partially present"`, empty
  string when none). A bare number is a legacy otp-v0.1 value and reads as
  `present`.
- `sp1_selected_text` is `"<Level> <n> (<State>): <paragraph text>"` joined with
  `" | "`, level order Beginner..Outstanding then ascending `n`, `State`
  capitalised (`Present` / `Partially present` / `Not present`).
- `sp1_present`, `sp1_partially_present`, `sp1_not_present` are the same
  selection grouped by state: `"<Level> <n>"` items joined by `", "` in level
  order then ascending `n` (`"Good 1, Great 2"`), empty string when none. These
  three are **appended** Sheet columns (hard rule 1: append, never reorder).

- Options: `WEB_APP_URL + '?action=options&form=otp'` (same response shape as R3).
- Record view: `otp-record.html?token=...` fetches
  `WEB_APP_URL + '?token=...&form=otp'`; the legacy `?id=...&token=...` shape is
  still accepted and forwarded.
- Evidence Pad extract posts `target` = one of the five note field names.
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

## Changelog

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
