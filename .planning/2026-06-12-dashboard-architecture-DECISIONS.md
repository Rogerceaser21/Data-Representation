# AIS Assessment Dashboard · Architecture Decision Record

**Status:** LOCKED via grill-me session 2026-06-12 (Igor + Claude). This is the authoritative record. The handoff (`handoff/handoff-2026-06-12-1653.md`) holds session narrative; this file holds the decisions. If they ever disagree, this file wins.

**One-line goal:** one role-based dashboard that aggregates every teacher-assessment data source at AIS (R3 observations, Lesson Observations, mock judgements, future performance reviews, OTPs) so the principal/admin team can inform the school SEF and the SEAS governing body, with teacher-facing access in a later phase.

**Hard deadline:** a working, logged-in dashboard demo by **Tuesday morning 2026-06-16**.

---

## Locked decisions (the grill)

### Q1 · Product shape — separate app, deck design language
The dashboard is a **separate application**, not an evolution of the pitch deck (`index.html`, which stays frozen at Pitch v0.13). It inherits the deck's design language (cream paper, AIS navy + yellow, serif masthead, portrait cards, green→red judgement palette) but uses **persistent navigation across "boards"**, not forward-only slides. A full-screen **present mode** (board-to-board walkthrough for governors) comes in a later phase.

### Q2 · Storage migration — dual-write bridge
Apps Script `doPost` keeps writing the Google Sheet AND sending the backup/inspector emails exactly as today, AND additionally pushes each submission to Supabase via REST. **The dashboard reads only Supabase.** A one-time backfill ports the existing ~168 submissions. Sheets is demoted to a redundant safety net, retired only once Supabase is trusted. Zero change to the live inspection workflow on day one.

### Q3 · Auth — Google SSO, multi-provider-capable, RLS
Google SSO via **Supabase Auth**, hard-restricted to `@ais.ae` at launch. Supabase Auth is multi-provider, so other schools/providers (e.g. Microsoft) are a later config toggle, not a rebuild. Roles in a `profiles` table. **Row-Level Security** in the database enforces who sees what (the UI is never trusted). **Every core table carries `school_id` and UUID primary keys from day one** (cheap insurance for Igor's future multi-school + hub-database plans).

### Q4 · Access model — immutable evidence, attributed annotations
Phase-1 logins: **all current inspectors**. Original observation records are **immutable** in the dashboard (they are the evidence). Annotations, SEF tags, moderation notes, and follow-up actions are **first-class new records**, each auto-stamped with author + timestamp (audit requirement). Genuine data corrections are deliberate **versioned supersessions** (original stays visible, marked superseded), never silent edits.

### Q5 · Day-one boards (priority order)
1. **Coverage** — who's been observed, how many times, who hasn't (live Observed tracker).
2. **Quality picture** — judgement distribution per criterion, best-score-wins, school-wide and by section.
3. **Teacher drill-down** — one teacher's full history: observations, scores, strengths/weaknesses, notes, annotations (the deck's portrait card, made real).
4. **Department / subject view** — the same picture cut by department and subject.
5. **SEF / governors board** — aggregate story over time, exportable, mapped to performance standards.

### Q6 · Infrastructure
**New dedicated Supabase project inside Igor's EXISTING Supabase organization** (~$10/mo extra). **Region: nearest UAE — Mumbai `ap-south-1`** (one-time, irreversible choice). Dashboard **repo under Igor's private GitHub (Rogerceaser21)**. Future: a separate "main database" Supabase account will pull from per-project DBs (hub-and-spoke) — so **UUIDs + `school_id`** make that sync friction-free.

### Q7 · Schema shape — hybrid spine
- **`assessments` spine:** one row per assessment event — who was assessed, by whom, when, type (r3 / lesson_obs / mock / probation / performance_review / otp), `school_id`, plus the form's **full original content as an immutable JSON snapshot** (the evidence copy).
- **`scores` table (normalized):** one row per judgement — `assessment_id`, `criterion_id`, `score`. EVERY judgement from EVERY form type lands here, so all boards run uniform queries. Lana's word judgements convert to 1-6 rows here.
- **`criteria` registry:** maps each criterion → label, source form, and **`sef_strand`** (performance standard). Adding a future form = registering its criteria, not redesigning the DB.
- Plus: `teachers` (canonical registry), `profiles` (user → role), `departments` + `department_members`, `annotations`, `sef_statements`.

### Q8 · Departments
Section-dependent: in **Kindy/Primary a department = a grade level**; in **Secondary = a subject department** (Humanities, Science, Art...). `departments` table carries a **type** (`grade_level` | `subject_department`) and a section. The principal's "by subject in Primary" need is met by **Subject as a cross-cutting filter** on observations (Subject is already on every record) — Primary subject-departments are NOT created. Memberships carry **role** (member | head) and **source** (website | timetable_solutions | manual) with effective dates.
**Seed sources:** ais.ae website HOD listing (interim, for Secondary heads + department names) + a short "two names per department" list Igor will supply. Timetable Solutions data lands later as a clean re-seed. iSAMS JSONs are unreliable for departments (academy-skewed) — excluded.

### Q9 · SEF rollup — the R3 form mirrors the SEAS framework deliberately
R3's 10 criteria map ~1:1 onto UAE/SEAS performance standards. The **governors board is a performance-standard rollup** driven entirely by the `criteria.sef_strand` mapping: per standard, evidence volume + judgement distribution (best-score-wins) + trend + drill-through. Admins can tag specific observations/annotations as **featured SEF evidence** (just another attributed annotation). No separate SEF data entry — the SEF view is a lens over existing data.

### Q9b · AI-drafted SEF statements
SEAS also wants **statements drawn from the data**. Plan:
- **`sef_statements` table from day one:** statement text, performance standard, scope (school | section | department | subject), evidence date range, **links to the supporting observation ids**, the **AI's reasoning (internal-only field, never in SPEA-facing exports)**, status (draft → approved), approver + timestamp. Same immutable-evidence + attributed-layer model — AI drafts, leadership signs.
- **Generation starts EXTERNAL** (a Claude session pulls Supabase data, drafts statements WITH citations, writes them back as drafts for Steve/Igor to review). Zero app machinery; cheap to iterate on prompt quality.
- **In-app generation is a later toggle**, not a separate system — a "regenerate" edge function writing into the same table with the same review workflow. Only build it if statement-drawing becomes a frequent habit.

### Q10 · Sequencing & the fate of Jobs 1-3
- **Job 1** (Observed tab AVERAGE → BEST/MINIFS): ✅ **DONE 2026-06-12** on Sheets (backup tab "Observed BACKUP pre-MIN 2026-06-12"; 4290 cells; verified every populated cell against raw MIN, 15 cells genuinely changed).
- **Job 2** (Lana's mock judgements): destination changed to **straight into Supabase**, not a Sheets feed. **CRITICAL: never modify Lana's source sheet** (`1ACrCZwbRZayV4pKHvj_-HjaMpTgj7We2bq-vFl0NiS8`) — read-only; work from a copy. Names in the mock sheet are messy/first-name-only and DON'T match the Submissions tab. Approach: a **canonical teacher registry** seeded from the R3 Teachers tab; every mock name is matched against it; ambiguous matches go into a **proposed mapping table Igor approves BEFORE any import** ("Kate (G1) → Kate Arscott?"); unmatchable names are flagged and held, never guessed. Result: mock data speaks the exact same names as live R3 data. All mock observations dated 2026-02-02; word judgements → 1-6; best-score-wins applies.
- **Job 3** (separate teacher-facing dashboard): **absorbed.** The main dashboard's teacher drill-down board (Q5 #3) IS Job 3's content, same people, same permissions. Building it twice would create two drifting products. The only uncovered part — teachers seeing their own page — is deliberately phase 2 (switch on teacher logins; RLS shows each teacher only their own page).

### Q11 · Build order to Tuesday
1. Job 1 on Sheets ✅ done.
2. Supabase project (Igor: create in existing org, Mumbai, capture URL + anon + service_role keys to a local file — service key never pasted in chat).
3. Schema (spine + scores + criteria + departments + profiles + sef_statements + teachers + annotations) + backfill 168 submissions + seed teachers & criteria.
4. Dual-write bridge in Apps Script.
5. Dashboard skeleton: auth (@ais.ae SSO) + coverage board first.
6. Quality → teacher → department boards.
7. Governors board + sef_statements table.
8. Job 2 (mock import w/ name-mapping approval gate) slots in any time after step 3.

---

## UI direction (aesthetics)
- **GSAP + ScrollTrigger** as the animation backbone: filter changes morph charts (no redraws), count-ups, FLIP card reflows, staggered chip entrances, split-text headings, fast subtle easing.
- **D3 or ECharts** for charts, themed to AIS.
- **three.js for ONE signature moment only** (candidate: login/landing scene), never for data views.
- Deck design language + green→red judgement palette throughout. Density-with-polish (the "modernize Craigslist" lesson from the designcourse Fable 5 video Igor supplied, watched via /watch).
- Mine **21st.dev** and reference education dashboards for component ideas at build time.
- Three aesthetic directions to be previewed for Igor before committing (in progress).

## Standing rules carried in
No error UI ever (forms). No em/en dashes. Plan-then-explicit-go before outward/irreversible actions. Version-bump + git-tag every push. Backup a Sheet tab before destructive edits. Confidential records go only to the inspector who filed them. Once Igor decides, execute — don't relitigate.
