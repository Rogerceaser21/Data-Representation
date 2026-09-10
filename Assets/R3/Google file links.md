# R3 Evidence · Google file links

Quick-access links to every Google asset wired into the R3 form. All live under `admin.user@ais.ae` and are shared with `igor.sesar@ais.ae` as Editor.

| Asset | Link |
|---|---|
| **R3 Evidence Google Sheet** (Submissions + reference tabs) | https://docs.google.com/spreadsheets/d/1V1Nb8hTWN-FpDps2Q_-F0TBWBFnPHVBW_sicWk8XVKo/edit |
| **R3 Apps Script project** (backend Web App source) | https://script.google.com/home/projects/1BYxWpSsqs-48AKnWH4BUQonAKHqDcY6VbiWA1SNbhBZT0QgDzLUatgRn/edit |
| **R3 Apps Script editor** (run `clearOptionsCache`, `forceAuth`, etc.) | https://script.google.com/home/projects/1BYxWpSsqs-48AKnWH4BUQonAKHqDcY6VbiWA1SNbhBZT0QgDzLUatgRn/edit |
| **R3 Web App `/exec` endpoint** (production deployment) | https://script.google.com/macros/s/AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ/exec |
| **Gmail (backup mailbox)** · search the R3 Submissions label | https://mail.google.com/mail/u/0/#label/R3+Submissions |

## Sheet tabs (quick jump)

| Tab | Purpose |
|---|---|
| `Submissions` | All R3 submissions (48 columns, append-only schema; last is `record_token`) |
| `Teachers` | Staff roster (column A = display name; columns B-G hold Title, First, Family, Code, Email, Curriculum) |
| `Inspectors` | Inspector names + emails. Column A = name, column B = email (added v0.31). Empty B = no CC. |
| `Curriculum` | Curriculum values (single column) |
| `Subjects` | Subjects (school-filtered, columns: Subject, Yes/No, Kindy, Primary, Secondary) |

## Backup mail filter (one-time Gmail setup)

> From: `admin.user@ais.ae`  
> Subject contains: `AIS R3 Evidence ·`  
> → **Skip the Inbox**, **Apply label `R3 Submissions`** (create if needed).

## Force-refresh the dropdowns after a Sheet edit

`getDropdownOptions()` is cached for 5 minutes (v0.33). To see Sheet edits sooner:

1. Open the R3 Apps Script editor (link above).
2. Pick `clearOptionsCache` from the function dropdown next to **Run**.
3. Click **Run**. Cache is wiped; the next form load reads fresh.

## OTP form (otp-v0.1)

The Progress in Lessons OTP form shares this Sheet, this Apps Script project and this
`/exec` endpoint. It is selected by the `form=otp` parameter; without it every call
behaves exactly as the R3 calls above.

| Tab | Purpose |
|---|---|
| `OTP Submissions` | All OTP submissions (33 columns, append-only; `record_token` is 25th, `evidence_pad_id` 26th) |
| `Teachers 26-27` | The 26-27 staff roster BOTH forms read since 2026-09-10 (@23): 186 people from the Secondary + Primary timetable lists, 12 columns (name, Title, First Name, Family Name, Code, Email, Curriculum, Kindy, Primary, Secondary, Grade, Department), emails directory-verified. `Teachers 25-26` is history. |
| `R3 Inspectors 26-27` | This year's R3 inspectors (A = name, B = email), read by the R3 form: everyone marked `Y` in the Observer column (H) of the Secondary + Primary timetable lists, plus the two outside consultants Dr Ahmed and Dr Peter (no email yet) and Igor; 38 rows on 2026-09-10. `R3 Inspectors 25-26` is last year's list, read by nothing. |
| `OTP Coaches 26-27` | The OTP observers (A = name, B = email), read by the OTP form only: the same Observer = `Y` people plus the paired observer Ahmed Osman, the consultants and Igor; 39 rows on 2026-09-10. A row without an email simply gets no CC on the backup email. |
| `Teachers · Workspace groups` | Created on demand by `buildTeacherSheet()`: the raw [email, name] pull from the 6 staff Workspace groups. Never read by a form. |

OTP columns, in order:

```
record_id, submitted_at, teacher, curriculum, observer, observation_date,
room_number, time_in, subject, school, support_teachers_cas, otp_ref, otp_aspect,
sp1_beginner, sp1_emerging, sp1_good, sp1_great, sp1_outstanding, sp1_selected_text,
observer_comments, other_observations, next_step_1, next_step_2, next_step_3,
record_token, evidence_pad_id, sp1_present, sp1_partially_present, sp1_not_present,
sp1_not_seen, grade, sp1_notes, rubric_version, time_out
```

| Endpoint | Value |
|---|---|
| Dropdowns | `.../exec?action=options&form=otp` (own cache key, 5-min TTL) |
| Locked record | `.../exec?token=<32-hex>&form=otp` |
| Backup email subject | `AIS OTP Progress · <teacher> · <date>` (own Gmail filter: subject contains `AIS OTP Progress ·`) |
| Supabase ingest RPC | `ingest_otp` |

Running `clearOptionsCache` from the editor clears the R3 **and** the OTP options cache.

## Related

- Form code + deploy workflow: [README.md](README.md)
- Whole-project context, hard rules, identity / auth notes: [`../../CLAUDE.md`](../../CLAUDE.md)
