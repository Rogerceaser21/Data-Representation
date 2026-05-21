# Data-Representation · Teacher Observation Pitch

Pitch-stage mockup for the AIS Sharjah teacher observation showcase system. Five-slide HTML deck demonstrating a per-teacher dashboard, department-level view, and the three-job build roadmap (form digitisation → central database → pretty website).

Built as a same-day pitch for principal Steven McLuckie following his 2026-05-21 staff email about reviewing teacher observation processes ahead of the early-2027 school review.

## Status

**v0.1 · Pitch only.** Nothing here is approved or being built yet. This repo exists for version history while the deck iterates.

## File map

```
Data-Representation/
├── index.html   # the deck (open in any browser)
├── Assets/brand/AIS Logo/                # runtime: AIS White.png + AIS Navy.png
└── SPEA Data Report/                     # worked-example source files
    ├── Jo Mare Kruger from DB Files.jpg  # teacher portrait used on P1
    ├── Lesson Observation - Igor- 12_11.docx
    ├── Form_ Probation Lesson Observation (8).pdf
    └── 24-25-Primary School OTP - v4.docx
```

The deck is self-contained at runtime — all CSS and JS are inline; only fonts (Google Fonts) and the AIS logo PNGs are external to the HTML.

## Worked example

Jo Mare Kruger (Grade 6 teacher) is the showcase persona. Department-level view (slide 4) uses Olivia Gill (real, Grade 6B) plus four invented Grade 6 colleagues so the matrix demonstrates the cross-teacher rollup without dragging real people into invented ratings.

## Rating scale

Outstanding · Very Good · Sound · Developing · Support Required · Insufficient Evidence — rebranded from the academic-report VH/H/S/D/SR/IE scale. Single source of truth across all observation types.

## Visibility

**Private repository.** Includes real teacher names (Jo Mare Kruger, Olivia Gill) sitting next to fabricated observation ratings, plus real-data SPEA source files (lesson observation, probation form, OTP). Keep private until either (a) the ratings are real, or (b) the showcase is encrypted/gated like `Rogerceaser21/sample-student-report`.

## Related

- Sibling project: `../Export Ready HTML AIS Report/` — the academic report this deck was designed off
- Public deploy precedent: https://github.com/Rogerceaser21/sample-student-report
