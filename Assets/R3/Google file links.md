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

## Related

- Form code + deploy workflow: [README.md](README.md)
- Whole-project context, hard rules, identity / auth notes: [`../../CLAUDE.md`](../../CLAUDE.md)
