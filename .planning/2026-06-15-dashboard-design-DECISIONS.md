# AIS Observation Dashboard . Design + Motion Decision Record

**Status:** LOCKED via a grill + build session 2026-06-15 (Igor + Claude). This file holds the look-and-feel, motion, and UI decisions. The architecture (storage, auth, schema, boards, attendance) lives in `.planning/2026-06-12-dashboard-architecture-DECISIONS.md` (Q1-Q11); if they overlap, that file owns data/architecture and this file owns design. The **living, interactive version of this spec is `dashboard-previews/design-spec.html`** (do NOT delete), which renders every decision below.

**Hard deadline:** working logged-in (login-less for demo) dashboard demo by **Tuesday 2026-06-16**, Coverage + Teacher drill-down.

---

## How we got here (so the next agent does not repeat it)
- Three from-scratch board skins were built and REJECTED as generic (`dashboard-previews/{observatory,ledger,console}.html`), then three more (`look-editorial.html`, `look-product.html`, `look-cinematic.html`). Igor was "not impressed" by the static skins.
- The lesson Igor confirmed: **the magic he wants is in the motion and behaviour, not the still frame.** Static skins will always miss. Build the motion.
- Of the three look prototypes, Igor picked **Cinematic** (`look-cinematic.html`) as the direction, with one change (stars, see below). The other two are a parts bin.

## Locked design decisions

### Direction: Cinematic
Dark, deep, alive. Big display serif, glow on the rating colours, depth, the star-field backdrop. Spectacle lives in the backdrop, the entry, and the transitions; the data views stay dense and legible. The Cinematic component language carries across BOTH themes.

### Theme: LIGHT default
The dashboard **opens in light (paper) by default**, dark is a tap away. Both first-class. (Igor reversed an earlier lean to dark; light is final.)

### Signature backdrop: an AIS star-field
- A drifting field of **5-point stars in the four AIS colours ONLY** (yellow, blue, red, green). The round constellation dots were explicitly rejected; they must be stars.
- **Theme-aware rendering** (this is the fix that made it work): DARK uses a soft-glow star texture with `AdditiveBlending` and the bright AIS hexes; LIGHT uses a CRISP star texture with `NormalBlending` and the deeper AIS shades (gold `#C9890C`, blue `#1257FF`, red `#D7382B`, green `#2ea15a`), or it washes out into fuzzy dots on paper.
- **Toggleable on/off** from the masthead, independent of theme.
- **Tunable via three sliders: Count, Size, Shine**, persisted to localStorage. Default tuned calm at **Count 56, Size 1.00, Shine 0.75** (Igor to set final values). Implemented as a pool of 140 sprites with visibility = count.
- three.js is spent ONCE here (ambient depth) plus the login moment; never on top of the numbers. Performance-safe: pixelRatio capped at 2, depthWrite off, paused when tab hidden or toggle off.
- **In the real dashboard these controls live on a Settings page** (stars on/off + the three sliders), so an admin can tune the field per audience (calm for a governor session, lively for a launch).

### Entry: fusion
On login, an authoritative title-card (AIS crest, "Observation Record, Term 3") holds for a beat over the star-field, then **dissolves as the data assembles itself** (count-ups, the matrix fills, the gauge sweeps). The star depth recedes as the data takes the foreground. Authority first, then life.

### Motion grammar: shared-element FLIP
Click a teacher and their row **flies and grows into their page**; the school gauge **morphs into** a teacher gauge; nothing redraws, everything moves. One light camera-depth push carries the login into the first board. Count-ups and staggered reveals throughout. GSAP is the backbone; D3 + custom SVG for the data shapes (so the FLIP morphs work, an off-the-shelf chart lib would fight them).

### Rating language: official 6-point SEAS scale
Outstanding, Very Good, Good, Acceptable, Weak, Very Weak (1 best). **Best evidence wins** (strongest observation stands, MIN). "Not Assessed" is a neutral state, not a score. This matches the database and what SEAS grades on. The deck's softer 5-word gauge labels stay in the deck only. Ramp runs deep green to red, six stops.

### Centerpieces
- **The Spectrum** = the R3 board centerpiece. The 6-point scale laid flat, overall as a flag, every observation dropped on so range is obvious. APPROVED. (The flag/label spacing was fixed; labels sit clear below the bar.)
- **The Arc** = the alternate. A clean radial dial; track + fill follow the ramp (green to red), NOT a flat green; type dots ride just outside the rim. APPROVED.
- **The Matrix** (teacher x criteria, cells on the ramp, overall column) = Grade and Department centerpiece. A row flies out into a teacher (FLIP).
- **The Bloom is DROPPED entirely, including for OTP** (Igor: "looks horrific"). The OTP centerpiece is a separate, still-open question for when OTP is briefed.
- Working bake-off of all four: `dashboard-previews/centerpieces.html`.

### Navigation shell
**Top rounded floating masthead + a horizontal board rail.** The masthead must be a rounded floating bar (radius, border, shadow, margin), NOT a flat edge-to-edge strip (the flat bar in the cinematic/spec drafts looked terrible and was fixed). Present mode (advancing governors board by board) falls out of the rail later.

### Density + charts
Density-with-polish (the "modernize Craigslist" lesson). Several substantial data objects per board, not one chart per screen. D3 + custom SVG.

### Boards (priority)
- **Coverage** and **Teacher drill-down**: the Tuesday demo (login-less).
- Then Quality picture, Grade/Department (matrix + that grade's attendance), Administration (whole-school roll-up + attendance rollups + link out to the Attendance App), SEF/Governors (performance-standard roll-up, AI-drafted statements later).

### Attendance (governance metric only)
Rollups at **whole-school (Primary + Secondary combined), Primary, Secondary, and Grade**, never per-student in the governance view. A **link out** to the Attendance App (`~/.graphify/repos/pristine-project-box`, Supabase `mshlbsgsyzzfxyxramjj`, data sourced live from the "Attendance Master Sheet" Google Sheets) for the granular detail. Pulled as a snapshot now; moves to the hub "Main" Supabase later. Needed for the SPEA/SEF review. See the architecture doc + memory for the full Attendance App map.

---

## Build plan to Tuesday
1. Scaffold the Cinematic shell: rounded masthead, board rail, star-field, default light + dark toggle.
2. A Settings page: stars on/off + Count/Size/Shine sliders, persisted.
3. Wire the live Supabase governance data (read-only): 312 observations / 486 scores already loaded (ref `rfbetrcevtmisknndpgg`).
4. Coverage board.
5. Teacher drill-down: gauge + the Spectrum, with the row-to-page FLIP.
6. Login-less for the demo; @ais.ae Google SSO + RLS straight after.
7. Attendance rollups + remaining boards.

## Artifacts (all under `dashboard-previews/`, keep all)
- `design-spec.html` . the living spec, Cinematic, light default, star sliders, embedded Spectrum + Arc. The reference for the build.
- `centerpieces.html` . the four-way centerpiece bake-off (Spectrum, Arc, Bloom dropped, Ring).
- `look-cinematic.html` . the chosen direction prototype. `look-editorial.html` + `look-product.html` + `spea-dashboard.html` (v1) + `observatory/ledger/console.html` . parts bin.

## Standing rules carried in
No em or en dashes anywhere. Plan then explicit go before outward/irreversible actions. Once Igor decides, execute, do not relitigate. Real AIS assets only. The repo stays private (real names beside sample ratings).
