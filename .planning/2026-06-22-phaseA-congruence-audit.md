# Phase A . Congruence audit + reference map (Snapshot claims vs live R3 data)

**Generated:** 2026-06-22 . **Round:** R3 June 26 . **Basis:** live Supabase, deduped to distinct lessons mirroring the dashboard's snapAgg() exactly (teacher + date + subject area, best evidence wins).

This audit cross-references every Snapshot Story claim (summaries, bullets, and the quantified Insight claims) against the written evidence on the live June R3 submissions, re-derives every number, maps each claim to its source lessons with a supporting quote, and flags any mismatch with the real number. References never name a teacher (subject area, phase, date, quote and the locked R3 record link only). Observer abbreviations read as: SS = Student, T = Teacher, S to S = Student-to-Student dialogue; BEP / BtE = Better Than Expected progress; AMA = Above More Able; CFU = Check For Understanding.

## Live numbers (now)
| Phase | Lessons | Teachers | Avg progress | Distribution | Strengths written | Develop written |
|---|---|---|---|---|---|---|
| Primary & Kindy | 48 | 46 | 3.2093 (Good) | O 2 / VG 9 / G 13 / A 16 / W 3 / VW 0 | 43 | 41 |
| Secondary | 62 | 58 | 3.2364 (Good) | O 6 / VG 12 / G 12 / A 20 / W 4 / VW 4 | 62 | 56 |
| Whole sweep | 110 | 104 | 3.2245 (Good) | O 8 / VG 21 / G 25 / A 36 / W 7 / VW 4 | 105 | 97 |

All 110 June submissions are linked to a teacher (0 unlinked), so none are invisible to the Snapshot. The Eman Dakhel duplicate that was deleted from the Sheet still has three submissions in Supabase, but they share teacher + date + subject so snapAgg already collapses them to one lesson (no inflation).

## Headline verdict
**43 claims audited. 39 congruent. 4 flagged.** Secondary matches the baked copy almost exactly. The big quantified Insight claims all hold: six Outstanding vs Primary's two (exact), four co-observed Very Weak lessons (exact), "about 20 of the 40" challenge-the-able (well supported), "about 23 of the 62" collaboration (well supported, read 21 to 25), "no Very Weak and only three at Weak" in Primary (exact).

## Flags (real number shown; nothing rewritten)

**1. pk_str_evidence** (primary_kindy / evidence)
> Drawn from the written evidence on 42 of 47 lessons.

- Live data is now 43 of 48 (the round is still receiving late submissions; the most recent landed 2026-06-22 12:22 for a real 06-08..06-11 lesson). The baked "42 of 47" is the frozen 06-19 figure. The Story gauge/distribution already compute live (48 PK lessons), so the prose is the only stale part. Recommend refreshing to "43 of 48" or formally freezing the round.

**2. pk_dev_evidence** (primary_kindy / evidence)
> Drawn from the written evidence on 40 of 47 lessons.

- Live data is now 41 of 48 (same late-submission cause as the strengths evidence base). Recommend refreshing to "41 of 48" or freezing the round.

**3. pk_dev_i1** (primary_kindy / insight)
> The ceiling, not the floor, is the issue. Challenge for the most able is the dominant development note (about 20 of the 40), while almost none mention behaviour or engagement (just one), so moving Acceptable to Good here is about raising the top, not rescuing the bottom.

- The "about 20" challenge count is well supported. The contrast holds. But "(just one)" understates it slightly on a plain-mention reading: about five PK lessons mention engagement in passing, though only one (PK33) makes it the development point. Behaviour (conduct/disruption) is essentially absent. Also the denominator 40 is now 41 live. Suggest keeping the point; optionally reword "(just one)" to "(only one as the main point)".

**4. sec_dev_i2** (secondary / insight)
> The challenge gap runs in opposite directions by subject: Islamic and Arabic are asked to stretch the top while English, Humanities and Science are asked to lift the tail, so a single school-wide differentiation target would miss both.

- Supported as a tendency, not an absolute. There are counter-examples (e.g. Engineering SEC58 and Science also ask to "extend students who can demonstrate BTE", Arabic SEC0 also asks for lower-attainer scaffolding). Keep the claim but it is a lean, not a clean split.

> Root cause of the Primary denominator flags: the round is still accepting late submissions (the most recent landed 2026-06-22 12:22 for a real 06-08..06-11 lesson), so live Primary & Kindy is now 48 lessons where the 06-19 copy says 47. The Story's gauge, distribution and count-ups already read live (they show 48), so only the frozen prose denominators are stale; the board is momentarily self-inconsistent until the prose is refreshed or the round is frozen. Secondary is unchanged.

## Claim-by-claim map
Each claim lists its verdict, how it was calculated where relevant, and its supporting references (area . date . progress word . quote . record id).

### Primary & Kindy . What is working

**summary** . congruent . `pk_str_summary`
> Calm, well-routined classrooms with strong relationships and visible scaffolds, so children know exactly what to do.
- Mathematics . 2026-06-11 . Acceptable . "Learning routines and relationships are excellent. Clarity of instruction is high with students knowing exactly what they need to do" . `AIS-R3-20260611-1221`
- Arabic . 2026-06-10 . Very Good . "Clear instructions and expectations established strong classroom routines and enabled students to work confidently and independently" . `AIS-R3-20260610-1027`
- English . 2026-06-10 . Very Good . "Supports/checklists in place that were differentiated for different groups of students. Established routines around marking and feedback" . `AIS-R3-20260610-1224`

**evidence** . FLAG . `pk_str_evidence`
> Drawn from the written evidence on 42 of 47 lessons.

_How calculated:_ Count of Primary & Kindy lessons (deduped by teacher + date + subject area, best evidence wins) carrying a non-empty written strengths note.

_Flag:_ Live data is now 43 of 48 (the round is still receiving late submissions; the most recent landed 2026-06-22 12:22 for a real 06-08..06-11 lesson). The baked "42 of 47" is the frozen 06-19 figure. The Story gauge/distribution already compute live (48 PK lessons), so the prose is the only stale part. Recommend refreshing to "43 of 48" or formally freezing the round.
- English . 2026-06-10 . Very Good . "Supports/checklists in place that were differentiated for different groups of students" . `AIS-R3-20260610-1224`

**bullet** . congruent . `pk_str_b1`
> Routines, relationships and behaviour for learning are consistently strong
- Digital Technologies . 2026-06-10 . Acceptable . "Behaviour for learning is highly developed and indicates strong routines and excellent relationships" . `AIS-R3-20260610-0857`
- Mathematics . 2026-06-11 . Acceptable . "Learning routines and relationships are excellent" . `AIS-R3-20260611-1221`

**bullet** . congruent . `pk_str_b2`
> Clear instructions; children know what is expected and follow it
- Mathematics . 2026-06-11 . Acceptable . "students knowing exactly what they need to do and flawlessly following T requests" . `AIS-R3-20260611-1221`
- English . 2026-06-10 . Acceptable . "Teacher Clarity is high - students know what is expected of them" . `AIS-R3-20260610-1016`

**bullet** . congruent . `pk_str_b3`
> Differentiation and scaffolds in place (sentence stems, helping words, checklists)
- Sciences . 2026-06-09 . Very Good . "Sentence stems to support lower ability students" . `AIS-R3-20260609-1402`
- Arabic . 2026-06-10 . Acceptable . "one group received TA support, another was provided with helping words" . `AIS-R3-20260610-1355`
- English . 2026-06-10 . Very Good . "Supports/checklists in place that were differentiated for different groups of students" . `AIS-R3-20260610-1224`

**bullet** . congruent . `pk_str_b4`
> Purposeful questioning and turn-and-talk dialogue
- Arabic NA . 2026-06-08 . Good . "The use of role-play, turn-and-talk activities, and follow-up questions increased opportunities for spoken language, discussion, and dialogue" . `AIS-R3-20260608-1405`
- Arabic . 2026-06-10 . Acceptable . "The use of Turn and Talk increased peer discussion, collaboration, and academic dialogue" . `AIS-R3-20260622-162232`

**bullet** . congruent . `pk_str_b5`
> Activating prior knowledge and modelling with gradual release
- Arabic . 2026-06-11 . Acceptable . "Modelling with a gradual release of responsibility supported students in moving from guided practice to independent work" . `AIS-R3-20260611-1216`
- Arabic . 2026-06-10 . Acceptable . "Questioning at the beginning of the lesson activated prior knowledge and prepared students well for the writing task" . `AIS-R3-20260610-1355`

**insight** . congruent . `pk_str_i1`
> Self-assessment is the quiet star. Where children used checklists or self-monitoring they paced themselves and progress was visible to the inspector; it shows up in only a handful of classes, so it is a small, copyable practice with room to spread.

_How calculated:_ Self-assessment, self-monitoring checklists or peer review named as a strength in 3 to 4 of the 48 Primary & Kindy lessons ("a handful").
- English . 2026-06-10 . Acceptable . "students are provided with a check list that allows them to self assess and continues the communication of high expectations" . `AIS-R3-20260610-1016`
- English . 2026-06-10 . Acceptable . "Checklist for students to monitor progress" . `AIS-R3-20260610-1205`
- Mathematics . 2026-06-11 . Acceptable . "Students complete the task and then peer mark their work discussing anything that they don’t agree on" . `AIS-R3-20260611-0900`

**insight** . congruent . `pk_str_i2`
> The strength is consistency, not peaks. Almost every lesson clears a solid bar, with no lesson rated Very Weak and only three at Weak, so quality here is broad and dependable rather than reliant on a few stars.

_How calculated:_ Primary & Kindy progress distribution (deduped lessons): Outstanding 2, Very Good 9, Good 13, Acceptable 16, Weak 3, Very Weak 0. "No Very Weak and only three at Weak" matches exactly. The three Weak lessons are referenced.
- Sciences . 2026-06-08 . Weak . "Teacher knows students well and uses effective strategies to maintain a calm classroom environment" . `AIS-R3-20260608-1347`
- Mathematics . 2026-06-10 . Weak . "Some probing questions to extend students" . `AIS-R3-20260610-1111`
- Mathematics . 2026-06-08 . Weak . "The teacher used quick checks for understanding, such as thumbs up/thumbs down, to gauge students’ confidence" . `AIS-R3-20260608-1141`

**insight** . congruent . `pk_str_i3`
> Establishing each child’s starting point is already a strength in Science, and it is the single most useful move to export to the subjects where it is the most common gap.

_How calculated:_ Starting-point establishment appears as a Science strength (PK21); the mirror gap recurs in Arabic development notes asking for tasks "planned from students’ individual starting points" (PK15, PK39, PK45).
- Sciences . 2026-06-08 . Weak . "A starting point of knowledge about the thermometer was established at the beginning of the lesson" . `AIS-R3-20260608-1347`
- Sciences . 2026-06-08 . Weak . "Starting point for students effectively established through targeted questioning added to spider diagram" . `AIS-R3-20260608-1347`

### Primary & Kindy . Where to focus next

**summary** . congruent . `pk_dev_summary`
> Progress is capped at the top more than it is missing at the bottom; the dominant need is stretching the most able.
- Mathematics . 2026-06-08 . Acceptable . "Insufficiently challenged" . `AIS-R3-20260608-1247`
- Mathematics . 2026-06-08 . Weak . "Higher-attaining students were not consistently challenged, as some repeated tasks they could already complete" . `AIS-R3-20260608-1141`
- Arabic . 2026-06-09 . Very Good . "High-achieving students should be further challenged through extension tasks and deeper questioning" . `AIS-R3-20260609-1155`

**evidence** . FLAG . `pk_dev_evidence`
> Drawn from the written evidence on 40 of 47 lessons.

_How calculated:_ Count of Primary & Kindy lessons (deduped) carrying a non-empty written areas-to-develop note.

_Flag:_ Live data is now 41 of 48 (same late-submission cause as the strengths evidence base). Recommend refreshing to "41 of 48" or freezing the round.
- Mathematics . 2026-06-08 . Weak . "Providing extension tasks, using these students in class discussion, and increasing accountability" . `AIS-R3-20260608-1141`

**bullet** . congruent . `pk_dev_b1`
> Extend and challenge the more able; too many capable children repeat what they can already do
- Mathematics . 2026-06-08 . Weak . "some repeated tasks they could already complete" . `AIS-R3-20260608-1141`
- Mathematics . 2026-06-11 . Good . "A large minority of students were not challenged to complete a task that they couldn’t already do" . `AIS-R3-20260611-1154`

**bullet** . congruent . `pk_dev_b2`
> Move beyond one task for all; undifferentiated tasks limit progress for some groups
- Mathematics . 2026-06-11 . Acceptable . "All students doing the same task limiting BEP for most groups" . `AIS-R3-20260611-0900`
- Mathematics . 2026-06-10 . Weak . "Undifferentiated activity" . `AIS-R3-20260610-1111`

**bullet** . congruent . `pk_dev_b3`
> Intervene earlier and more deliberately with the middle and lower groups
- Arabic NA . 2026-06-08 . Good . "targeted intervention for the middle-attaining group could improve the quality of their work" . `AIS-R3-20260608-1405`
- Arabic . 2026-06-10 . Acceptable . "Some students required additional scaffolding and targeted support to access the learning successfully" . `AIS-R3-20260610-1355`

**bullet** . congruent . `pk_dev_b4`
> Reduce teacher talk in places and hand more of the thinking to children
- English . 2026-06-11 . Acceptable . "Student led discussion Teacher talk" . `AIS-R3-20260611-0932`
- Mathematics . 2026-06-08 . Good . "Less teacher talk" . `AIS-R3-20260608-0921`

**bullet** . congruent . `pk_dev_b5`
> Reclaim lost time at set-up and for early finishers
- Sciences . 2026-06-08 . Weak . "Resources not prepared and set up prior to the start of the lesson meaning too much time spent by students waiting" . `AIS-R3-20260608-1347`
- Arabic . 2026-06-10 . Very Good . "Some learning time was lost while students waited for work to be checked" . `AIS-R3-20260610-1020`

**insight** . FLAG . `pk_dev_i1`
> The ceiling, not the floor, is the issue. Challenge for the most able is the dominant development note (about 20 of the 40), while almost none mention behaviour or engagement (just one), so moving Acceptable to Good here is about raising the top, not rescuing the bottom.

_How calculated:_ Challenge / stretch-the-able is the development theme in about 20 of the Primary & Kindy lessons with a written note (19 explicit, ~23 including the closely related "same task for all caps progress" notes). Behaviour or engagement as the primary development point: one lesson (PK33).

_Flag:_ The "about 20" challenge count is well supported. The contrast holds. But "(just one)" understates it slightly on a plain-mention reading: about five PK lessons mention engagement in passing, though only one (PK33) makes it the development point. Behaviour (conduct/disruption) is essentially absent. Also the denominator 40 is now 41 live. Suggest keeping the point; optionally reword "(just one)" to "(only one as the main point)".
- Mathematics . 2026-06-08 . Acceptable . "Insufficiently challenged" . `AIS-R3-20260608-1247`
- Mathematics . 2026-06-11 . Good . "A large minority of students were not challenged to complete a task that they couldn’t already do" . `AIS-R3-20260611-1154`
- Arabic . 2026-06-11 . n/a . "Maintenance of engagement from students is inconsistent" . `AIS-R3-20260611-1229`

**insight** . congruent . `pk_dev_i2`
> One root cause links several fixes: a check for understanding surfaces a gap, then the whole class receives the same next step anyway. The shift needed is reactive teaching becoming responsive, not more planning.
- Mathematics . 2026-06-11 . Good . "CFU established that student weakness was in missing pattern elements ... T should have adjusted task/teaching to fill this gap in understanding / skill" . `AIS-R3-20260611-1154`
- Mathematics . 2026-06-08 . Weak . "Response to students misunderstanding was same for all students. How could this have been more targeted just for those students that needed it" . `AIS-R3-20260608-1141`

**insight** . congruent . `pk_dev_i3`
> Some Acceptable ratings reflect lesson type, not teaching. Assessment-style lessons recur with "hard to see progress in a single lesson", so the headline average slightly understates the teaching on show.
- English . 2026-06-10 . Very Good . "Assessment task can be difficult to determine progress within lesson" . `AIS-R3-20260610-1224`
- English . 2026-06-10 . Acceptable . "Not the type of lesson to determine progress within a lesson" . `AIS-R3-20260610-1205`
- English . 2026-06-10 . Good . "Assessment lesson. Progress judgement required discussion with students and reflection of books. Not really a weakness" . `AIS-R3-20260610-0932`

### Secondary . What is working

**summary** . congruent . `sec_str_summary`
> Collaboration, dialogue and higher-order questioning, with students who can talk confidently about their own learning.
- Arabic . 2026-06-11 . Acceptable . "Peer discussion and dialogue (Turn & Talk, Peer check & feedback) were effectively used ... The use of follow-up questions deepened students’ understanding" . `AIS-R3-20260611-1148`
- Islamic . 2026-06-09 . Very Good . "Group work and collaboration encouraged active participation ... higher-order thinking questions deepened students' understanding" . `AIS-R3-20260609-1454`
- Sciences . 2026-06-08 . Acceptable . "Each student knows what they are working on and why. They understand their next steps" . `AIS-R3-20260608-1254`

**evidence** . congruent . `sec_str_evidence`
> Drawn from the written evidence on all 62 lessons.

_How calculated:_ All 62 deduped Secondary lessons carry a written strengths note. Matches exactly.
- English . 2026-06-08 . Acceptable . "Effective questioning promoted higher-order thinking and encouraged meaningful discussions" . `AIS-R3-20260608-0908`

**bullet** . congruent . `sec_str_b1`
> Collaboration, dialogue and discussion (turn-and-talk, peer review)
- Arabic . 2026-06-11 . Good . "High student-student dialogue Student autonomy/pair work is high Ability for students to peer evaluate is high" . `AIS-R3-20260611-1106`
- Social Studies . 2026-06-09 . Acceptable . "Group work provided opportunities for meaningful class discussion and collaboration" . `AIS-R3-20260609-1327`

**bullet** . congruent . `sec_str_b2`
> High engagement and on-task investment
- Mathematics . 2026-06-10 . Acceptable . "Student engagement is high with almost all students actively participating / investing in their learning" . `AIS-R3-20260610-1227`
- Sciences . 2026-06-09 . Acceptable . "Highly engaging task, all students involved" . `AIS-R3-20260609-1003`

**bullet** . congruent . `sec_str_b3`
> Effective, higher-order questioning
- English . 2026-06-08 . Acceptable . "Effective questioning promoted higher-order thinking and encouraged meaningful discussions" . `AIS-R3-20260608-0908`
- Islamic . 2026-06-08 . Good . "Effective use of follow-up questions challenged students to justify their thinking and extend their responses" . `AIS-R3-20260608-1122`

**bullet** . congruent . `sec_str_b4`
> Clear instructions and expectations
- English . 2026-06-08 . Acceptable . "Clear instructions and explicit expectations helped students understand what was required of them" . `AIS-R3-20260608-0908`
- English . 2026-06-09 . Acceptable . "Clear instructions and expectations Accountability for group work" . `AIS-R3-20260609-1100`

**bullet** . congruent . `sec_str_b5`
> Individualised goals with visible next steps
- Sciences . 2026-06-08 . Acceptable . "Each student knows what they are working on and why. They understand their next steps" . `AIS-R3-20260608-1254`
- Arts . 2026-06-09 . Acceptable . "Students know where they are up to with their learning and what their next steps are to improve" . `AIS-R3-20260609-1241`

**insight** . congruent . `sec_str_i1`
> Secondary has a real top end: six lessons reached Outstanding for progress, three times Primary's two, so the phase has exemplars to learn from in-house rather than from outside.

_How calculated:_ Secondary lessons at Outstanding (progress = 1): 6. Primary & Kindy: 2. Matches "six ... three times Primary's two" exactly.
- Mathematics . 2026-06-10 . Outstanding . "TS dialogue is well focussed to maximise T impact on S progress in the lesson ... allows students to progress on an almost individualised pathway" . `AIS-R3-20260610-1321`
- Arts . 2026-06-09 . Outstanding . "S-S feedback facilitates BtE progress as part of the creative process ... high levels of creativity, collaboration and support" . `AIS-R3-20260609-1245`

**insight** . congruent . `sec_str_i2`
> Students can articulate their own learning because individualised goals and next steps recur as a strength; this is the foundation any group-work fix can build on.
- Sciences . 2026-06-08 . Acceptable . "Each student knows what they are working on and why. They understand their next steps" . `AIS-R3-20260608-1254`
- Humanities . 2026-06-09 . Good . "Each student had individualized goals based on their feedback they were working towards" . `AIS-R3-20260609-0920`

**insight** . congruent . `sec_str_i3`
> The strengths are remarkably consistent across very different subjects (Islamic, English, Arts and Science all share clarity, questioning and engagement), so the phase has a shared professional language to build on.
- Islamic . 2026-06-08 . Good . "Clear instructions and explicit explanations ensured that students understood ... resulting in purposeful engagement" . `AIS-R3-20260608-1122`
- English . 2026-06-08 . Acceptable . "Clear instructions and explicit expectations ... Effective questioning promoted higher-order thinking" . `AIS-R3-20260608-0908`
- Sciences . 2026-06-10 . Very Good . "Skilled questioning from the teacher to each group of students to highlight their understanding" . `AIS-R3-20260610-1432`

### Secondary . Where to focus next

**summary** . congruent . `sec_dev_summary`
> More polarised than Primary; a leading fix is giving group work real structure and accountability.
- English . 2026-06-08 . Acceptable . "Group work requires a clearer structure and defined roles to ensure that all students contribute equally and remain accountable" . `AIS-R3-20260608-0908`
- Social Studies . 2026-06-09 . Acceptable . "Group work lacked structure and clear roles, which reduced student accountability" . `AIS-R3-20260609-1327`

**evidence** . congruent . `sec_dev_evidence`
> Drawn from the written evidence on 56 of 62 lessons.

_How calculated:_ 56 of 62 deduped Secondary lessons carry a written areas-to-develop note. Matches exactly.
- Social Studies . 2026-06-09 . Acceptable . "Clearer time management and pacing were needed" . `AIS-R3-20260609-1327`

**bullet** . congruent . `sec_dev_b1`
> Give group work structure, roles and accountability (a leading fix)
- English . 2026-06-08 . Acceptable . "Group work requires a clearer structure and defined roles ... Introduce more structured collaborative protocols" . `AIS-R3-20260608-0908`
- English . 2026-06-08 . Very Good . "Group work was not fully aligned with the task because the number of students did not match the group roles ... which reduced accountability" . `AIS-R3-20260608-0942`

**bullet** . congruent . `sec_dev_b2`
> Make student-to-student dialogue purposeful, not just present
- QCE Physical Education . 2026-06-09 . Good . "S-S dialogue is unstructured and doesn’t offer as much to S progress as students may be capable of" . `AIS-R3-20260609-1510`
- Humanities . 2026-06-08 . Very Weak . "Limited use of SS dialogue" . `AIS-R3-20260608-1225`

**bullet** . congruent . `sec_dev_b3`
> Stretch high-achievers further, especially in Islamic and Arabic
- Islamic . 2026-06-09 . Very Good . "The level of challenge for high-achieving students could be increased ... Additional extension tasks would further stretch their thinking" . `AIS-R3-20260609-1454`
- Arabic . 2026-06-11 . Acceptable . "Greater focus is needed on extending the learning of higher-achieving students to ensure they are consistently challenged" . `AIS-R3-20260611-1148`

**bullet** . congruent . `sec_dev_b4`
> Targeted intervention for a small group of lower-attainers
- Sciences . 2026-06-08 . Acceptable . "One significant group making no progress More teacher intervention required" . `AIS-R3-20260608-1257`
- Humanities . 2026-06-08 . Acceptable . "Further support/intervention was required to move more students along with progress" . `AIS-R3-20260608-1434`

**bullet** . congruent . `sec_dev_b5`
> Make progress visible and evidenced in books and within the lesson
- English . 2026-06-08 . Outstanding . "Progress evidence is difficult to find. Exercise books do not adequately support/provide evidence for progress in lessons" . `AIS-R3-20260608-1105`
- Mathematics . 2026-06-08 . Very Good . "Difficult to tell if all groups were making BEP" . `AIS-R3-20260608-0927`

**insight** . congruent . `sec_dev_i1`
> Group work sits on both sides of the ledger at once: collaboration and dialogue lead the strengths (about 23 of the 62 lessons), yet giving group work clear roles and accountability is a leading fix. The swing factor is structure, not collaboration, so one planning routine would move many lessons.

_How calculated:_ Collaboration / dialogue a leading strength in about 23 of 62 lessons (read count 21 to 25). Group-work structure/accountability a leading development note in about 6 lessons (SEC3, SEC23, SEC27, SEC43, SEC47, SEC57). SEC23 and SEC43 appear on both sides, the "swing factor is structure" finding.
- Social Studies . 2026-06-09 . Acceptable . "Group work provided opportunities for meaningful class discussion and collaboration [strength] ... Group work lacked structure and clear roles, which reduced student accountability [develop]" . `AIS-R3-20260609-1327`
- English . 2026-06-08 . Acceptable . "Group work requires a clearer structure and defined roles" . `AIS-R3-20260608-0908`

**insight** . FLAG . `sec_dev_i2`
> The challenge gap runs in opposite directions by subject: Islamic and Arabic are asked to stretch the top while English, Humanities and Science are asked to lift the tail, so a single school-wide differentiation target would miss both.

_How calculated:_ Islamic/Arabic develop notes skew to stretching high-achievers (SEC0, SEC2, SEC3, SEC24, SEC37, SEC60). English/Humanities/Science skew to intervention for lower-attainers (SEC12, SEC19, SEC29, SEC43, SEC56).

_Flag:_ Supported as a tendency, not an absolute. There are counter-examples (e.g. Engineering SEC58 and Science also ask to "extend students who can demonstrate BTE", Arabic SEC0 also asks for lower-attainer scaffolding). Keep the claim but it is a lean, not a clean split.
- Islamic . 2026-06-09 . Very Good . "The level of challenge for high-achieving students could be increased" . `AIS-R3-20260609-1454`
- Arabic . 2026-06-11 . Acceptable . "extending the learning of higher-achieving students to ensure they are consistently challenged" . `AIS-R3-20260611-1148`
- English . 2026-06-08 . Outstanding . "Could place teacher with the lower students to accelerate their learning" . `AIS-R3-20260608-0903`
- Sciences . 2026-06-08 . Acceptable . "One significant group making no progress More teacher intervention required" . `AIS-R3-20260608-1257`

**insight** . congruent . `sec_dev_i3`
> The weak end is short and specific, not diffuse. There are four Very Weak progress lessons, and each is a single lesson that two inspectors independently both rated Very Weak, so the tail is a concrete, fixable shortlist rather than a broad quality problem.

_How calculated:_ Four Secondary lessons at Very Weak (progress = 6): English (06-08), Humanities x2 (06-08), Arts (06-08). Each was co-observed by two inspectors who BOTH scored 6 (verified: every Very Weak lesson shows two observations, scores [6, 6]).
- Arts . 2026-06-08 . Very Weak . "Students unsupervised Students not on task Difficult to identify any progress in learning or skills" . `AIS-R3-20260608-1440`
- Humanities . 2026-06-08 . Very Weak . "Lack of teacher monitoring of student progress and performance - Lack of teacher scaffolding or agency" . `AIS-R3-20260608-1239`
- Humanities . 2026-06-08 . Very Weak . "Limited opportunities for peer to peer dialogue or open ended questions impacting opportunities for BEP for almost all students" . `AIS-R3-20260608-1225`

### Compare

**insight** . congruent . `cmp_0`
> Same average, different shape. Both phases land on Good (Primary and Kindy 3.2, Secondary 3.2), but Secondary is polarised, with six Outstanding lessons and four Very Weak, while Primary and Kindy has none rated Very Weak and clusters tightly in the Good to Acceptable band. Read the averages alone and they look identical; read the spread and they call for different moves.

_How calculated:_ Average progress (best per teacher, then mean): Primary & Kindy 3.21, Secondary 3.24, both round to 3.2 = Good. Secondary distribution: 6 Outstanding, 4 Very Weak. Primary & Kindy: 0 Very Weak, bulk in Good and Acceptable.
- Arts . 2026-06-08 . Very Weak . "Students unsupervised Students not on task [a Very Weak lesson]" . `AIS-R3-20260608-1440`
- Mathematics . 2026-06-11 . Acceptable . "almost all, achieving the task without further teaching or support [a calm, mid-band Primary lesson]" . `AIS-R3-20260611-1221`

**insight** . congruent . `cmp_1`
> The same ceiling effect appears in both phases: the calmest, most individualised lessons are the ones where the able are not extended or progress is hardest to see. Across both, the biggest single development theme is challenge for the most able, not remediation, which points to raising the top rather than rescuing the bottom.
- Mathematics . 2026-06-08 . Weak . "Higher-attaining students were not consistently challenged, as some repeated tasks they could already complete" . `AIS-R3-20260608-1141`
- Islamic . 2026-06-09 . Very Good . "The level of challenge for high-achieving students could be increased" . `AIS-R3-20260609-1454`

**insight** . congruent . `cmp_2`
> Effort should land in different places. Primary and Kindy will gain most from a shared "plan from each child’s starting point" and self-assessment routine; Secondary will gain most from a group-work structure routine and from closing a short, concrete list of weak-progress lessons. Neither needs a behaviour or engagement drive, both already score those as strengths.
- Arabic . 2026-06-11 . Good . "Learning tasks need to be planned from students’ individual starting points to ensure better differentiation" . `AIS-R3-20260611-1045`
- English . 2026-06-08 . Acceptable . "Group work requires a clearer structure and defined roles" . `AIS-R3-20260608-0908`
