// Rollback-wrapped dry run of a migration file. NOTHING is ever committed.
//
//   node db/dryrun.mjs db/migrate_14_otp.sql
//
// Connects exactly like db/q.mjs (session pooler, creds from the gitignored env file, never
// printed). Opens BEGIN, executes the migration with its own top-level `begin;` / `commit;` lines
// STRIPPED (the strip approach, not savepoints: the file's own commit would end our transaction and
// make the whole run real), runs the read-back checks below, prints them as JSON, then ROLLBACKs.
// Exits non-zero if any expectation fails (the rollback still runs).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
const { Client } = pg;

const FILE = process.argv[2];
if (!FILE) { console.error('usage: node db/dryrun.mjs <file.sql>'); process.exit(2); }
const SQL_PATH = path.resolve(FILE);

const env = {};
for (const raw of readFileSync(process.env.HOME + '/AIS-Data-Dashboard/supabase_AIS-Data-Dashboard.env', 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const i = line.indexOf('=');
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const ref = JSON.stringify(env).match(/([a-z0-9]{20})\.supabase\.co/)[1];

// ---- strip the file's own transaction framing (whole-line `begin;` / `commit;` only; the
// `begin` / `end $$;` inside plpgsql bodies are never a bare line ending in a semicolon) ----
const rawSql = readFileSync(SQL_PATH, 'utf8');
let nBegin = 0, nCommit = 0;
const sql = rawSql.split('\n').filter((l) => {
  if (/^\s*begin\s*;\s*$/i.test(l))  { nBegin++;  return false; }
  if (/^\s*commit\s*;\s*$/i.test(l)) { nCommit++; return false; }
  return true;
}).join('\n');

const failures = [];
const check = (name, pass, detail) => {
  if (!pass) failures.push(`${name}${detail ? ' :: ' + detail : ''}`);
  return pass;
};

const FAKE = {
  record_id: 'AIS-OTP-20260903-121500',
  submitted_at: '2026-09-03 12:15:00',
  teacher: 'Abdullah Obeed',
  curriculum: 'British',
  observer: 'Dave Richards',
  observation_date: '2026-09-03',
  room_number: 'S-204',
  time_in: '09:15',
  subject: 'Mathematics',
  school: 'Secondary',
  support_teachers_cas: '',
  otp_ref: 'SP1',
  otp_aspect: 'Facilitating better than expected progress',
  sp1_beginner: '',
  sp1_emerging: '2,3',
  sp1_good: '1,4',
  sp1_great: '',
  sp1_outstanding: '',
  sp1_selected_text: 'Most pupils make better than expected progress against their starting points.',
  observer_comments: 'DRY RUN ONLY. This transaction is rolled back.',
  other_observations: 'DRY RUN ONLY. This transaction is rolled back.',
  next_step_1: 'Sharpen the questioning sequence in the first ten minutes.',
  next_step_2: 'Plan the stretch task before the lesson, not during it.',
  next_step_3: 'Check books mid lesson, not only at the end.',
  record_token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  evidence_pad_id: '',
};

const client = new Client({
  host: 'aws-1-ap-south-1.pooler.supabase.com', port: 5432, user: `postgres.${ref}`,
  password: env.SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false },
});
await client.connect();

const out = { file: path.basename(SQL_PATH), stripped: { begin: nBegin, commit: nCommit } };
const q = async (text, params) => (await client.query(text, params)).rows;

await client.query('begin');
try {
  check('file has exactly one top-level begin; and one commit;', nBegin === 1 && nCommit === 1,
        `begin=${nBegin} commit=${nCommit}`);
  check('payload has all 26 getOtpColumns keys', Object.keys(FAKE).length === 26,
        `${Object.keys(FAKE).length} keys`);
  check('record_token is 32 hex', /^[0-9a-f]{32}$/.test(FAKE.record_token), FAKE.record_token);

  // ---------------- apply (inside our transaction) ----------------
  await client.query(sql);
  out.applied = true;

  // ---------------- 1) the otp criterion row ----------------
  out.otp_criterion = await q(
    `select code, label, source_form, sef_strand, scale_min, scale_max, sort_order
       from criteria where source_form = 'otp' order by code`);
  const crit = out.otp_criterion[0];
  check('exactly one otp criterion', out.otp_criterion.length === 1, JSON.stringify(out.otp_criterion));
  check('otp criterion is otp_sp1 on the 1-5 scale at sort 1',
        crit && crit.code === 'otp_sp1' && crit.scale_min === 1 && crit.scale_max === 5 && crit.sort_order === 1,
        JSON.stringify(crit));
  check('otp criterion label', crit && crit.label ===
        'SP1 Student Progress · Facilitating better than expected progress', crit && crit.label);

  // ---------------- 2) app_config rounds ----------------
  out.app_config_rounds = await q(
    `select key, value from app_config where key in ('current_round','current_round_otp') order by key`);
  const cfg = Object.fromEntries(out.app_config_rounds.map((r) => [r.key, r.value]));
  check("current_round_otp seeded as 'OTP Term 1 26-27'", cfg.current_round_otp === 'OTP Term 1 26-27',
        cfg.current_round_otp);
  check("current_round untouched ('Apple Pencil Test Round')", cfg.current_round === 'Apple Pencil Test Round',
        cfg.current_round);

  // ---------------- 3) security model + grants ----------------
  out.prosecdef = await q(
    `select p.proname, p.prosecdef
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('get_current_round','get_current_round_otp','admin_set_setting','ingest_otp','ingest_r3','get_raw_snapshot')
      order by p.proname`);
  const secdef = Object.fromEntries(out.prosecdef.map((r) => [r.proname, r.prosecdef]));
  for (const fn of ['get_current_round_otp', 'admin_set_setting', 'ingest_otp'])
    check(`${fn} is SECURITY DEFINER`, secdef[fn] === true, String(secdef[fn]));

  out.grants = await q(
    `select routine_name, grantee, privilege_type
       from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name in ('get_current_round','get_current_round_otp','admin_set_setting','ingest_otp','ingest_r3','get_raw_snapshot')
      order by routine_name, grantee`);
  const granteesOf = (fn) => out.grants.filter((g) => g.routine_name === fn).map((g) => g.grantee).sort();
  const nonOwner = (fn) => granteesOf(fn).filter((g) => g !== 'postgres');
  out.grantees = Object.fromEntries(
    ['get_current_round', 'get_current_round_otp', 'admin_set_setting', 'ingest_otp', 'ingest_r3', 'get_raw_snapshot']
      .map((fn) => [fn, granteesOf(fn)]));
  check('get_current_round_otp grantees match get_current_round',
        JSON.stringify(granteesOf('get_current_round_otp')) === JSON.stringify(granteesOf('get_current_round')),
        `${JSON.stringify(granteesOf('get_current_round_otp'))} vs ${JSON.stringify(granteesOf('get_current_round'))}`);
  check('get_current_round_otp readable by anon', nonOwner('get_current_round_otp').includes('anon'),
        JSON.stringify(nonOwner('get_current_round_otp')));
  check('admin_set_setting still anon + authenticated',
        JSON.stringify(nonOwner('admin_set_setting')) === JSON.stringify(['anon', 'authenticated']),
        JSON.stringify(nonOwner('admin_set_setting')));
  check('ingest_otp granted to service_role ONLY (no anon)',
        JSON.stringify(nonOwner('ingest_otp')) === JSON.stringify(['service_role']),
        JSON.stringify(nonOwner('ingest_otp')));

  // ---------------- 4) roster columns ----------------
  out.roster_columns = await q(
    `select table_name, column_name, data_type, is_nullable, column_default
       from information_schema.columns
      where table_schema = 'public' and column_name = 'roster'
        and table_name in ('teachers','inspectors')
      order by table_name`);
  check('roster exists on both teachers and inspectors', out.roster_columns.length === 2,
        JSON.stringify(out.roster_columns));
  check("roster is text not null default '2025-26' on both",
        out.roster_columns.every((c) => c.data_type === 'text' && c.is_nullable === 'NO'
          && String(c.column_default).includes('2025-26')),
        JSON.stringify(out.roster_columns));
  out.roster_backfill = await q(
    `select (select count(*)::int from teachers   where roster = '2025-26') teachers_2025_26,
            (select count(*)::int from inspectors where roster = '2025-26') inspectors_2025_26`);

  // ---------------- 5) ingest_otp, first call ----------------
  out.ingest_call_1 = (await q(`select public.ingest_otp($1::jsonb) as r`, [JSON.stringify(FAKE)]))[0].r;
  check('ingest_otp success', out.ingest_call_1.success === true, JSON.stringify(out.ingest_call_1));
  check('ingest_otp teacher_linked', out.ingest_call_1.teacher_linked === true, JSON.stringify(out.ingest_call_1));
  check("ingest_otp round = 'OTP Term 1 26-27'", out.ingest_call_1.round === 'OTP Term 1 26-27',
        String(out.ingest_call_1.round));

  out.assessment_row = await q(
    `select a.type, a.round, a.source, a.record_id, a.source_ref, a.occurred_on, a.subject,
            a.assessor_name, (a.teacher_id is not null) as teacher_linked,
            (a.assessor_id is not null) as inspector_linked,
            a.content->>'sp1_good' as sp1_good, a.content->>'otp_ref' as otp_ref
       from assessments a where a.source_ref = $1`, [FAKE.record_token]);
  const row = out.assessment_row[0];
  check('one assessment row for the token', out.assessment_row.length === 1, JSON.stringify(out.assessment_row));
  check("assessment is type=otp source=otp_sheet", row && row.type === 'otp' && row.source === 'otp_sheet',
        JSON.stringify(row));
  check('assessment round + record_id + source_ref',
        row && row.round === 'OTP Term 1 26-27' && row.record_id === FAKE.record_id
          && row.source_ref === FAKE.record_token, JSON.stringify(row));
  check("content->>'sp1_good' round-trips", row && row.sp1_good === FAKE.sp1_good, row && row.sp1_good);
  check('inspector linked from observer', row && row.inspector_linked === true, JSON.stringify(row));

  out.scores_for_row = (await q(
    `select count(*)::int as n from scores s
       join assessments a on a.id = s.assessment_id where a.source_ref = $1`, [FAKE.record_token]))[0];
  check('v0.1 writes NO scores rows', out.scores_for_row.n === 0, JSON.stringify(out.scores_for_row));

  // ---------------- 6) idempotency: same payload again ----------------
  out.ingest_call_2 = (await q(`select public.ingest_otp($1::jsonb) as r`, [JSON.stringify(FAKE)]))[0].r;
  check('second call also succeeds', out.ingest_call_2.success === true, JSON.stringify(out.ingest_call_2));
  check('second call returns the SAME assessment_id',
        out.ingest_call_2.assessment_id === out.ingest_call_1.assessment_id,
        `${out.ingest_call_1.assessment_id} vs ${out.ingest_call_2.assessment_id}`);
  out.otp_row_count_after_2_calls = (await q(
    `select count(*)::int as n from assessments where type = 'otp'`))[0];
  check('still exactly one otp assessment after two identical calls',
        out.otp_row_count_after_2_calls.n === 1, JSON.stringify(out.otp_row_count_after_2_calls));

  // ---------------- 7) get_current_round_otp ----------------
  out.get_current_round_otp = (await q(`select public.get_current_round_otp() as v`))[0].v;
  check("get_current_round_otp() = 'OTP Term 1 26-27'", out.get_current_round_otp === 'OTP Term 1 26-27',
        String(out.get_current_round_otp));
  out.get_current_round = (await q(`select public.get_current_round() as v`))[0].v;
  check('get_current_round() unchanged', out.get_current_round === 'Apple Pencil Test Round',
        String(out.get_current_round));

  // ---------------- 8) snapshot guard: the OTP row must not reach the dashboard ----------------
  out.snapshot_guard = (await q(
    `with s as (select public.get_raw_snapshot() as j)
     select (select count(*)::int from jsonb_array_elements((select j from s)->'assessments') e
              where e->>'type' = 'otp') as otp_in_snapshot,
            jsonb_array_length((select j from s)->'assessments') as assessments_n,
            jsonb_array_length((select j from s)->'scores')      as scores_n`))[0];
  check('get_raw_snapshot exposes ZERO otp assessments', out.snapshot_guard.otp_in_snapshot === 0,
        JSON.stringify(out.snapshot_guard));
  check('get_raw_snapshot still returns the 321 r3 assessments', out.snapshot_guard.assessments_n === 321,
        JSON.stringify(out.snapshot_guard));

  // ---------------- 9) admin_set_setting whitelist ----------------
  out.admin_set_setting_probe = {
    otp_key_allowed: (await q(
      `select public.admin_set_setting('AvasIgor','current_round_otp','OTP DRYRUN PROBE') as r`))[0].r,
    r3_key_allowed: (await q(
      `select public.admin_set_setting('AvasIgor','current_round','DRYRUN PROBE') as r`))[0].r,
    junk_key_rejected: (await q(
      `select public.admin_set_setting('AvasIgor','admin_password_hash','nope') as r`))[0].r,
    bad_password_rejected: (await q(
      `select public.admin_set_setting('wrong-password','current_round_otp','nope') as r`))[0].r,
  };
  const p = out.admin_set_setting_probe;
  check('admin_set_setting accepts current_round_otp', p.otp_key_allowed.success === true,
        JSON.stringify(p.otp_key_allowed));
  check('admin_set_setting still accepts current_round', p.r3_key_allowed.success === true,
        JSON.stringify(p.r3_key_allowed));
  check('admin_set_setting rejects admin_password_hash',
        p.junk_key_rejected.success === false && p.junk_key_rejected.error === 'key not allowed',
        JSON.stringify(p.junk_key_rejected));
  check('admin_set_setting rejects a bad password',
        p.bad_password_rejected.success === false && p.bad_password_rejected.error === 'bad password',
        JSON.stringify(p.bad_password_rejected));
} catch (e) {
  out.error = String(e.message || e);
  failures.push('EXCEPTION :: ' + out.error);
} finally {
  await client.query('rollback');
  out.rolled_back = true;
  await client.end();
}

out.checks_failed = failures;
out.verdict = failures.length === 0 ? 'PASS (rolled back, nothing committed)' : 'FAIL';
console.log(JSON.stringify(out, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
