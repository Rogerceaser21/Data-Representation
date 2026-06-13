# Graph Report - Data-Representation  (2026-06-12)

## Corpus Check
- 27 files · ~230,785 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 444 nodes · 710 edges · 34 communities (26 shown, 8 thin omitted)
- Extraction: 93% EXTRACTED · 6% INFERRED · 1% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0ec40891`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_AIS Observation Forms & Scripts|AIS Observation Forms & Scripts]]
- [[_COMMUNITY_TomSelect Core API|TomSelect Core API]]
- [[_COMMUNITY_Pitch Deck Build & Bugs|Pitch Deck Build & Bugs]]
- [[_COMMUNITY_TomSelect Plugin Hooks|TomSelect Plugin Hooks]]
- [[_COMMUNITY_TomSelect Item Selection|TomSelect Item Selection]]
- [[_COMMUNITY_Lesson Obs Script Manifest|Lesson Obs Script Manifest]]
- [[_COMMUNITY_TomSelect Active Item Navigation|TomSelect Active Item Navigation]]
- [[_COMMUNITY_TomSelect Option Browsing|TomSelect Option Browsing]]
- [[_COMMUNITY_TomSelect Item CRUD Operations|TomSelect Item CRUD Operations]]
- [[_COMMUNITY_R3 Script Manifest|R3 Script Manifest]]
- [[_COMMUNITY_Lesson Obs Clasp Config|Lesson Obs Clasp Config]]
- [[_COMMUNITY_R3 Clasp Config|R3 Clasp Config]]
- [[_COMMUNITY_TomSelect Focus & Loading|TomSelect Focus & Loading]]
- [[_COMMUNITY_TomSelect Dropdown State|TomSelect Dropdown State]]
- [[_COMMUNITY_TomSelect Item Creation|TomSelect Item Creation]]
- [[_COMMUNITY_TomSelect Option Registration|TomSelect Option Registration]]
- [[_COMMUNITY_Claude Code Permissions|Claude Code Permissions]]
- [[_COMMUNITY_StatiCrypt Encryption Script|StatiCrypt Encryption Script]]
- [[_COMMUNITY_StatiCrypt Salt Config|StatiCrypt Salt Config]]
- [[_COMMUNITY_Lesson Obs Helper Functions|Lesson Obs Helper Functions]]
- [[_COMMUNITY_R3 Helper Functions|R3 Helper Functions]]
- [[_COMMUNITY_Project README|Project README]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]

## God Nodes (most connected - your core abstractions)
1. `ce` - 97 edges
2. `R3 Evidence Form Master Source` - 23 edges
3. `R3 Evidence Form (Master Source)` - 17 edges
4. `Teacher Observation Pitch Deck (index.html)` - 16 edges
5. `Year 6 Lesson Plan – Build Tetris with A.I.` - 15 edges
6. `v0.10 · R3 Evidence Form build + Lesson Observation reorg` - 13 edges
7. `Lesson Observation Form (HTML)` - 13 edges
8. `Primary School Outstanding Teacher Profile (OTP)` - 13 edges
9. `t` - 11 edges
10. `Handoff · Job 0 shipped (v0.41-v0.44) + dashboard architecture grilling (resume at Q7)` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Curtis All Portrait` --conceptually_related_to--> `Teacher Observation Pitch Deck (index.html)`  [AMBIGUOUS]
  SPEA Data Report/Curtis All.jpg → index.html
- `Deena AbuGeras Portrait` --conceptually_related_to--> `Teacher Observation Pitch Deck (index.html)`  [AMBIGUOUS]
  SPEA Data Report/Deena AbuGeras from DB Files.jpg → index.html
- `Gina Hanlon Portrait` --conceptually_related_to--> `Teacher Observation Pitch Deck (index.html)`  [AMBIGUOUS]
  SPEA Data Report/Gina Hanlon from DB Files (1).jpg → index.html
- `Hani Asad Portrait` --conceptually_related_to--> `Teacher Observation Pitch Deck (index.html)`  [AMBIGUOUS]
  SPEA Data Report/Hani Asad - DB Files.jpg → index.html
- `Lana Mosleh Portrait` --conceptually_related_to--> `Teacher Observation Pitch Deck (index.html)`  [AMBIGUOUS]
  SPEA Data Report/Lana Mosleh.jpg → index.html

## Import Cycles
- None detected.

## Communities (34 total, 8 thin omitted)

### Community 0 - "AIS Observation Forms & Scripts"
Cohesion: 0.07
Nodes (61): admin.user@ais.ae (Super Admin Identity), Lesson Obs Apps Script Config (00_Config.gs), Lesson Obs Apps Script doGet (02_doGet.gs), Lesson Obs Apps Script doPost (01_doPost.gs), R3 Apps Script Config (00_Config.gs), R3 Apps Script doGet (02_doGet.gs), R3 Apps Script doPost (01_doPost.gs), R3 Apps Script TeacherLoader (04_TeacherLoader.gs) (+53 more)

### Community 1 - "TomSelect Core API"
Cohesion: 0.05
Nodes (49): Lesson Observation - Igor 12/11, Classroom Management (Observation), Curriculum Development (Observation), DigiTech Subject, Interpersonal Relationships (Observation), Ben Hyde (Observer / DHOS), Mr Igor (Teacher), Teaching & Learning (Observation) (+41 more)

### Community 2 - "Pitch Deck Build & Bugs"
Cohesion: 0.12
Nodes (4): C, e(), le(), t

### Community 4 - "TomSelect Item Selection"
Cohesion: 0.26
Nodes (17): Deck Slides Overflow/Clipping Bug (v0.11-v0.12), Deck PDF Export (working reference), Handoff Brief Deck v0.12 Broken (2026-05-29), Screenshot: Slide 1 Cover v0.12 (title/masthead distortion), Screenshot: Slide 3 Teacher Dashboard Bottom v0.12 (all 8 categories), Screenshot: Slide 3 Teacher Dashboard Top v0.12 (donut + categories), Screenshot: Slide 4 Department Dashboard Bottom v0.12 (footer overlap bug), Screenshot: Slide 4 Department Dashboard Top v0.12 (3 teachers, overlap) (+9 more)

### Community 5 - "Lesson Obs Script Manifest"
Cohesion: 0.12
Nodes (16): Current state · v0.27 shipped, awaiting iPad verification, Deploy workflow reminder (for v0.28 + beyond), Form architecture as of v0.27, Gotchas to anticipate, Handoff · Data-Representation R3 Evidence Form, Important Igor preferences (still apply, do not repeat past mistakes), Open architecture question for v0.28, Read these first (+8 more)

### Community 6 - "TomSelect Active Item Navigation"
Cohesion: 0.14
Nodes (13): Apps Script changes (either `apps-script/*.gs` or `Assets/R3/apps-script/*.gs`), Cache invalidation (R3 only, since v0.33), CLAUDE.md · Data-Representation, Coding discipline (Karpathy guidelines), Deploy chain, File map, Hard rules · do not break, How the pieces connect (+5 more)

### Community 7 - "TomSelect Option Browsing"
Cohesion: 0.14
Nodes (13): Acceptance criteria (definition of done), Critical IDs / URLs (filled in as work progresses), Phase 1 · Reorganize Lesson Observation form, Phase 2 · R3 Sheet creation + seeding, Phase 3 · R3 Apps Script project, Phase 4 · R3 deploy + teacher load, Phase 5 · R3 HTML form, Phase 6 · Deck update + version bump (+5 more)

### Community 8 - "TomSelect Item CRUD Operations"
Cohesion: 0.17
Nodes (11): 1. Deleted 28 admin/inspector "non-teachers" (DONE), 2. That deletion caused an incident (root cause understood), 3. Backfill: forward each inspector their missed records (IN PROGRESS), After backfill: the moderation + dashboard work, Handoff · R3 inspector note backfill + moderation/dashboard prep, Hard-won rules (do not violate), Identity / tooling (critical, learned this session), IMMEDIATE NEXT STEP: send the 30 queued forwards (NOT yet sent) (+3 more)

### Community 9 - "R3 Script Manifest"
Cohesion: 0.20
Nodes (9): enabledAdvancedServices, dependencies, exceptionLogging, oauthScopes, runtimeVersion, timeZone, webapp, access (+1 more)

### Community 10 - "Lesson Obs Clasp Config"
Cohesion: 0.22
Nodes (8): dependencies, exceptionLogging, oauthScopes, runtimeVersion, timeZone, webapp, access, executeAs

### Community 11 - "R3 Clasp Config"
Cohesion: 0.25
Nodes (7): filePushOrder, htmlExtensions, jsonExtensions, rootDir, scriptExtensions, scriptId, skipSubdirectories

### Community 12 - "TomSelect Focus & Loading"
Cohesion: 0.25
Nodes (7): filePushOrder, htmlExtensions, jsonExtensions, rootDir, scriptExtensions, scriptId, skipSubdirectories

### Community 13 - "TomSelect Dropdown State"
Cohesion: 0.17
Nodes (11): 1 · Inspector email backfill: CLOSED (morning), 2 · Job 0 SHIPPED: v0.41 → v0.44 (see git log / tags for full detail), 3 · Dashboard architecture grilling (grill-me): decisions LOCKED Q1-Q6, 4 · UI direction (decided, from the designcourse "Fable 5" video), 5 · RESUME POINT: continue grill-me at Q7, 6 · Jobs 1-3 (parked, still wanted, spec in the plan doc), Docs synced, Handoff · Job 0 shipped (v0.41-v0.44) + dashboard architecture grilling (resume at Q7) (+3 more)

### Community 14 - "TomSelect Item Creation"
Cohesion: 0.18
Nodes (10): Critical caveat · verification, Current git state (as of handoff), Handoff · Data-Representation deck (next session), Igor's communication preferences (read before responding to him), Open questions for Igor (ask before code changes), Read these in this order before doing anything, Sensitive data note, Suggested skills for next session (+2 more)

### Community 21 - "Project README"
Cohesion: 0.18
Nodes (10): Current state · v0.40 deployed, Data corrections made this session (one-cell Sheet edits), Form quick-link buttons (v0.38-v0.40, SHIPPED LIVE), Handoff · Data-Representation R3 Evidence (live inspection week), Hard-won rules (do not violate), New Sheet tab: "Observed Term 3 - Week 12" (gid 1743616402), Open / not done, Read these first (in order) (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (10): Accessibility checklist (must pass before shipping), Behaviour contract, CSS sketch, Deferred plan · custom selection picker for the R3 form, Failure history that led here, JS sketch (~80-100 lines for a reusable component), Sources / further reading, The architecture that works (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.20
Nodes (9): Current state · v0.37 deployed, Deploy quick-reference, Handoff · Data-Representation R3 Evidence Form, Hard-won lessons (do not repeat the mistakes), Open / not-yet-done items, Read these first (in order), Suggested skills for next session, The stuck-on-loading bug (root cause, fixed in v0.37) (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (8): Decisions already made (Dave + Brooke), Job 0 · Teacher-form fixes (R3 form / the copy a teacher receives), Job 1 · Change the Observed sheet from AVERAGE to BEST (lowest), Job 2 · Parse and clean "this spreadsheet" into the admin/Steve dashboard feed, Job 3 · Build the teacher-facing dashboard ("teacher's face" dashboard), Next jobs · Moderation change + dashboards, Open questions to confirm with Igor before building, Related / in-flight

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (9): Apps Script + Sheet, Cache invalidation (v0.33), Changelog · v0.30-v0.37, Edit / deploy workflow, Folder layout (v0.37), Full project context, Gmail filter (one-time), Live URL + access password (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (7): Confidence notes, Deployment / preview nuance, Goal, Open decisions, Part A · Backend (`Assets/R3/apps-script/02_doGet.gs`), Part B · Form (`Assets/R3/src/r3-evidence-form.html`), Phase 2 plan · in-form Observed / Not-yet-observed panels

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (7): Data-Representation · Teacher Observation Pitch, File map, Rating scale, Related, Status, Visibility, Worked example

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (5): Backup mail filter (one-time Gmail setup), Force-refresh the dropdowns after a Sheet edit, R3 Evidence · Google file links, Related, Sheet tabs (quick jump)

## Ambiguous Edges - Review These
- `Teacher Observation Pitch Deck (index.html)` → `Curtis All Portrait`  [AMBIGUOUS]
  SPEA Data Report/Curtis All.jpg · relation: conceptually_related_to
- `Teacher Observation Pitch Deck (index.html)` → `Deena AbuGeras Portrait`  [AMBIGUOUS]
  SPEA Data Report/Deena AbuGeras from DB Files.jpg · relation: conceptually_related_to
- `Teacher Observation Pitch Deck (index.html)` → `Gina Hanlon Portrait`  [AMBIGUOUS]
  SPEA Data Report/Gina Hanlon from DB Files (1).jpg · relation: conceptually_related_to
- `Teacher Observation Pitch Deck (index.html)` → `Hani Asad Portrait`  [AMBIGUOUS]
  SPEA Data Report/Hani Asad - DB Files.jpg · relation: conceptually_related_to
- `Teacher Observation Pitch Deck (index.html)` → `Lana Mosleh Portrait`  [AMBIGUOUS]
  SPEA Data Report/Lana Mosleh.jpg · relation: conceptually_related_to

## Knowledge Gaps
- **188 isolated node(s):** `allow`, `salt`, `scriptId`, `rootDir`, `scriptExtensions` (+183 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Teacher Observation Pitch Deck (index.html)` and `Curtis All Portrait`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Teacher Observation Pitch Deck (index.html)` and `Deena AbuGeras Portrait`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Teacher Observation Pitch Deck (index.html)` and `Gina Hanlon Portrait`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Teacher Observation Pitch Deck (index.html)` and `Hani Asad Portrait`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Teacher Observation Pitch Deck (index.html)` and `Lana Mosleh Portrait`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `ce` connect `TomSelect Plugin Hooks` to `Pitch Deck Build & Bugs`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `R3 Evidence Form Master Source` connect `AIS Observation Forms & Scripts` to `TomSelect Item Selection`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._