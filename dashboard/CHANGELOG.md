# AIS Observation Dashboard . changelog

Every dashboard release bumps the footer badge in `src/index.html`, adds a row to
the Settings "Build history" panel, appends an entry here, and is git-tagged
`dash-vX.Y` so any version can be restored. Live (gated, password `ais2026ais`):
https://rogerceaser21.github.io/Data-Representation/dashboard/

## v0.7 . 2026-06-16
- Observation card redesign (Option A, "Ledger"), built from the agreed preview in `dashboard-previews/card-A-revised.html`.
- Top of each session card is now two titled, collapsible columns: Inspection details (inspector, subject, area) and Skills observed (each skill with its word and colour swatch on the right). Both start collapsed for a condensed card.
- The Spectrum stretches to the full width of the card.
- A condensed action bar at the bottom holds the observed teacher's name (left), the centred Observation Notes toggle, and a text-only "Open the R3 record" link (right).
- Expander reveals the observation's Observation notes, Strengths, and Areas to develop. The R3 record link opens the locked viewer (`Assets/R3/r3-record.html?id=...&token=...`) and appears only for the live June submissions (February has no token).
- The All-observations card now animates on selection.
- Data snapshot (`db/export_snapshot.mjs`) now carries `notes`, `strengths`, `weakness`, `source`, and the per-record `token`.

## v0.6 . 2026-06-16
- All-observations card reflects the selected session (rings its dot).

## v0.5 . 2026-06-16
- Session-card redesign: subject and subject area, purple selection ring, restored animations.

## v0.4 . 2026-06-16
- Scoring: best skill wins per observation (MIN); teacher overall is the average of those per-observation scores.

## v0.3 . 2026-06-16
- Card ramps match the Spectrum; one fixed colour per skill.

## v0.2 . 2026-06-16
- Per-session scoring and a dynamic observations list.

## v0.1 . 2026-06-15
- First Cinematic build: Coverage board + Teacher drill-down, light default + dark, AIS star-field, StatiCrypt-gated.
