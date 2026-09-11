#!/usr/bin/env node
/**
 * otp-v0.6 · Apps Script harness for Assets/R3/apps-script/*.gs
 *
 *   node Assets/OTP/tests/gs-harness.mjs
 *
 * Loads every .gs file into a single `vm` context (one shared global scope, the
 * way Apps Script itself runs them) behind stubs for SpreadsheetApp,
 * PropertiesService, CacheService, UrlFetchApp, MailApp, Utilities, Logger and
 * ContentService, then proves four things:
 *
 *   (a) an OTP submission appends ONE 33-cell row to "OTP Submissions" in the
 *       load-bearing column order, mails the OTP subject + viewer link, and
 *       mirrors to /rest/v1/rpc/ingest_otp as { payload: {...33 keys...} };
 *   (b) the R3 paths (submit, options, token lookup, status) are byte-identical
 *       to the SAME scenarios run against the untouched files from origin/main;
 *   (c) ?action=options&form=otp reads Teachers 26-27 + OTP Coaches 26-27 (a
 *       missing coaches tab = an empty observer list), and never collides with the R3
 *       options cache, while ?action=options (no form) is baseline-identical;
 *   (d) a ?token=&form=otp lookup resolves from the OTP tab and reports
 *       form:'otp', while the same token with no form parameter still resolves
 *       from the R3 tab exactly as baseline;
 *   (f) otp-v0.5: `school` is DERIVED from the posted `grade` and grade wins,
 *       on the Sheet row, on the Supabase mirror and in the backup email;
 *   (g) otp-v0.6: `sp1_notes` (JSON) + `rubric_version` are columns 32 and 33,
 *       written exactly as posted; the backup email says "Not assessed (does
 *       not count)" and carries a "Criterion notes" section (level order, state
 *       per criterion, omitted when there is nothing to show); a v0.5-shaped
 *       31-cell row still reads back;
 *   (h) otp-v0.6: the pad extractor accepts `sp1_<level>_<n>_note` targets and
 *       names the criterion in the prompt, while rejecting malformed ones.
 *
 * Determinism: TZ is pinned to UTC, `new Date()` is frozen, and
 * Utilities.getUuid() is a counter, so the modified run and the baseline run
 * produce comparable output. No dependencies; node builtins only.
 */
process.env.TZ = 'UTC';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const GS_DIR = path.join(REPO, 'Assets', 'R3', 'apps-script');
const GS_FILES = fs.readdirSync(GS_DIR).filter((f) => f.endsWith('.gs')).sort();

const FIXED_MS = Date.UTC(2026, 8, 3, 9, 41, 7);   // 2026-09-03T09:41:07Z
const SHEET_ID = 'STUB_SHEET_ID';
const SECRET = 'STUB_SERVICE_ROLE_KEY';

/* ── the contract under test (from the brief, not from the code) ───────────── */
const EXPECTED_OTP_COLUMNS = [
  'record_id', 'submitted_at', 'teacher', 'curriculum', 'observer',
  'observation_date', 'room_number', 'time_in', 'subject', 'school',
  'support_teachers_cas', 'otp_ref', 'otp_aspect',
  'sp1_beginner', 'sp1_emerging', 'sp1_good', 'sp1_great', 'sp1_outstanding',
  'sp1_selected_text', 'observer_comments', 'other_observations',
  'next_step_1', 'next_step_2', 'next_step_3', 'record_token', 'evidence_pad_id',
  'sp1_present', 'sp1_partially_present', 'sp1_not_present',
  'sp1_not_seen', 'grade', 'sp1_notes', 'rubric_version',
  'time_out',   // otp-v0.8, column 34
  'status', 'closed_at', 'lap', 'round'   // otp-v0.9, columns 35-38
];

// otp-v0.9 · the coaching-lifecycle round, as fetch CurrentOtpRound (05_Supabase.gs)
// resolves it via the stubbed get_current_round_otp RPC below.
const OTP_CURRENT_ROUND = 'OTP Term 1 26-27';
const OTP_OTHER_ROUND = 'OTP Term 3 25-26';

// otp-v0.6 · the note fixture is deliberately NOT in level order, carries a
// newline and an HTML-meaningful character, and includes one criterion nobody
// coloured (Great 5), so the email section proves ordering, escaping and the
// "Not assessed" state in one pass.
const OTP_NOTES = {
  'Good 3': 'Pace slipped in the middle third.\nRecovered after the timer.',
  'Emerging 2': 'Pupils waited for a prompt <every time>.',
  'Great 5': 'No colour on this one, just a note.',
  'Outstanding 4': 'Applied prior learning unprompted.'
};
const OTP_NOTES_JSON = JSON.stringify(OTP_NOTES);

const OTP_PAYLOAD = {
  form: 'otp',
  teacher: 'Jo Mare Kruger',
  curriculum: 'Australian',
  inspector: 'Dave Richards',
  date: '2026-09-02',
  room_number: 'S-204',
  time_in: '09:15',
  subject: 'Maths',
  school: 'Secondary',
  grade: '9',
  support_teachers_cas: 'Ms Fatima (CA)',
  otp_ref: 'SP1',
  otp_aspect: 'Facilitating better than expected progress',
  sp1_beginner: '',
  sp1_emerging: '2:not present',
  sp1_good: '1:present, 3:partially present',
  sp1_great: '',
  sp1_outstanding: '4:present',
  sp1_selected_text: 'Emerging 2 (Not present): Pupils need adult prompts to move on | Good 1 (Present): Pupils make progress | Good 3 (Partially present): Tasks are matched | Outstanding 4 (Present): Pupils independently apply prior learning',
  sp1_present: 'Good 1, Outstanding 4',
  sp1_partially_present: 'Good 3',
  sp1_not_present: 'Emerging 2',
  sp1_not_seen: 'Beginner 1, Beginner 2, Emerging 1, Good 2, Great 1, Great 2, Great 5, Outstanding 1',
  sp1_notes: OTP_NOTES_JSON,
  rubric_version: 'sp1-v2',
  time_out: '10:55',   // otp-v0.8
  observer_comments: 'Strong start, retrieval routine embedded.',
  other_observations: 'Display used as a working wall.',
  next_step_1: 'Plan a stretch task for the top table.',
  next_step_2: 'Share success criteria before the task.',
  next_step_3: '',
  evidence_pad_id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
};

const R3_PAYLOAD = {
  teacher: 'Jo Mare Kruger',
  curriculum: 'Australian',
  inspector: 'Dave Richards',
  date: '2026-09-02',
  room_number: 'S-204',
  grade_class: '9B',
  time_in: '09:15',
  time_out: '10:00',
  subject: 'Maths',
  school: 'Secondary',
  ability_group: 'Mixed',
  gender: 'Mixed',
  present: '24',
  support_teachers_cas: 'Ms Fatima (CA)',
  num_sen: '2', num_gt: '3', num_on_roll: '26', num_male: '13', num_female: '13',
  evidence_type: 'Lesson observation',
  focus_context: 'Progress in lessons',
  j_attainment: '4', j_attainment_c: 'Secure',
  j_progress: '5', j_progress_c: 'Better than expected',
  j_learning_skills: '4', j_learning_skills_c: '',
  j_psd_innovation: '4', j_psd_innovation_c: '',
  j_teaching: '5', j_teaching_c: 'Well paced',
  j_assessment: '4', j_assessment_c: '',
  j_curriculum_judgement: '4', j_curriculum_judgement_c: '',
  j_pcgs: '4', j_pcgs_c: '',
  j_leadership_management: '4', j_leadership_management_c: '',
  j_other: '', j_other_c: '',
  summary_strengths: 'Retrieval routine embedded.',
  summary_weakness: 'Stretch the top table.',
  observer_notes: 'Working wall in use.',
  evidence_pad_id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
};

const SHARED_TOKEN = 'ffeeddccbbaa99887766554433221100';

/* ── stubbed Google Apps Script environment ───────────────────────────────── */
function makeRange(sheet, r, c, nr, nc) {
  const range = {
    setValues(vals) {
      for (let i = 0; i < nr; i++) {
        const ri = r - 1 + i;
        while (sheet._data.length <= ri) sheet._data.push([]);
        const row = sheet._data[ri];
        for (let j = 0; j < nc; j++) {
          const ci = c - 1 + j;
          while (row.length <= ci) row.push('');
          row[ci] = vals[i][j];
        }
      }
      return range;
    },
    getValues() {
      const out = [];
      for (let i = 0; i < nr; i++) {
        const row = sheet._data[r - 1 + i] || [];
        const o = [];
        for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
        out.push(o);
      }
      return out;
    },
    setFontWeight() { return range; },
    setBackground() { return range; },
    setFontColor() { return range; }
  };
  return range;
}

function makeSheet(name, data) {
  const sheet = {
    _name: name,
    _data: (data || []).map((r) => r.slice()),
    getName() { return name; },
    getLastRow() { return sheet._data.length; },
    getLastColumn() { return sheet._data.reduce((m, r) => Math.max(m, r.length), 0); },
    setFrozenRows() { return sheet; },
    setColumnWidths() { return sheet; },
    setColumnWidth() { return sheet; },
    appendRow(row) { sheet._data.push(row.slice()); return sheet; },
    getDataRange() { return { getValues() { return sheet._data.map((r) => r.slice()); } }; },
    getRange(r, c, nr, nc) { return makeRange(sheet, r, c, nr, nc); }
  };
  return sheet;
}

function makeResponse(code, text) {
  return {
    getResponseCode() { return code; },
    getContentText() { return text; },
    getBlob() {
      const blob = { _name: '', getBytes() { return [0, 1, 2]; }, setName(n) { blob._name = n; return blob; } };
      return blob;
    }
  };
}

function buildEnv(source, seed) {
  const state = { sheets: {}, mail: [], fetches: [], logs: [], cache: {}, props: { SHEET_ID, SUPABASE_SECRET_KEY: SECRET } };
  Object.entries(seed || {}).forEach(([name, rows]) => { state.sheets[name] = makeSheet(name, rows); });

  let uuidN = 0;
  const pad2 = (n) => String(n).padStart(2, '0');
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  class FrozenDate extends Date {
    constructor(...args) { if (args.length === 0) super(FIXED_MS); else super(...args); }
    static now() { return FIXED_MS; }
  }

  const spreadsheet = {
    getId() { return SHEET_ID; },
    getName() { return 'AIS R3 Evidence'; },
    getUrl() { return 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit'; },
    getSpreadsheetTimeZone() { return 'Asia/Dubai'; },
    getSheets() { return Object.values(state.sheets); },
    getSheetByName(name) { return state.sheets[name] || null; },
    insertSheet(name) { state.sheets[name] = makeSheet(name, []); return state.sheets[name]; }
  };

  const sandbox = {
    console,
    JSON,
    Date: FrozenDate,
    SpreadsheetApp: {
      openById() { return spreadsheet; },
      create(name) { return spreadsheet; }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(k) { return Object.prototype.hasOwnProperty.call(state.props, k) ? state.props[k] : null; },
          setProperty(k, v) { state.props[k] = v; return this; }
        };
      }
    },
    CacheService: {
      getScriptCache() {
        return {
          get(k) { return Object.prototype.hasOwnProperty.call(state.cache, k) ? state.cache[k] : null; },
          put(k, v) { state.cache[k] = v; },
          remove(k) { delete state.cache[k]; }
        };
      }
    },
    UrlFetchApp: {
      fetch(url, opts) {
        const o = opts || {};
        state.fetches.push({
          url,
          method: o.method || 'get',
          contentType: o.contentType || '',
          headers: o.headers || {},
          payload: o.payload || ''
        });
        if (url.indexOf('/storage/v1/object/list/') > -1) return makeResponse(200, '[]');
        // otp-v0.9 · the round RPC PostgREST would return the bare scalar as a
        // JSON string. state.forceRoundFailure lets a scenario prove the
        // failure path (round stamped '', nothing else fails).
        if (url.indexOf('/rest/v1/rpc/get_current_round_otp') > -1) {
          return state.forceRoundFailure ? makeResponse(500, 'error') : makeResponse(200, JSON.stringify(OTP_CURRENT_ROUND));
        }
        if (url.indexOf('/rest/v1/rpc/') > -1) return makeResponse(200, '{"ok":true}');
        if (url.indexOf('/rest/v1/app_config') > -1) return makeResponse(200, '[]');
        // otp-v0.6 · pad extraction. One transcribed item, no target: the
        // targeted path stamps the page's own target, the classify path filters
        // it out (exactly as a real untargeted item without a target would be).
        if (url.indexOf('api.anthropic.com') > -1) {
          return makeResponse(200, JSON.stringify({
            content: [{ type: 'text', text: JSON.stringify({ items: [{ text: 'transcribed note' }] }) }]
          }));
        }
        return makeResponse(200, '{}');
      }
    },
    MailApp: {
      sendEmail(opts) {
        state.mail.push({
          to: opts.to, cc: opts.cc || '', subject: opts.subject, name: opts.name,
          htmlBody: opts.htmlBody,
          attachments: (opts.attachments || []).map((b) => b._name)
        });
      }
    },
    GmailApp: { sendEmail(to, subject, body, opts) { state.mail.push({ to, subject, body, opts }); } },
    DriveApp: { getFileById() { return { addEditor() { return this; } }; } },
    Logger: { log(m) { state.logs.push(String(m)); } },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        const out = { _text: text, _mime: '', setMimeType(m) { out._mime = m; return out; }, getContent() { return out._text; } };
        return out;
      }
    },
    HtmlService: { createHtmlOutput(h) { return { getContent() { return h; } }; } },
    Utilities: {
      getUuid() {
        uuidN += 1;
        const h = uuidN.toString(16).padStart(32, '0');
        return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
      },
      base64Encode(bytes) { return Buffer.from(bytes).toString('base64'); },
      formatDate(d, tz, fmt) {
        const off = tz === 'Asia/Dubai' ? 4 * 60 : 0;
        const t = new Date(d.getTime() + off * 60000);
        const map = {
          EEE: DAYS[t.getUTCDay()], yyyy: String(t.getUTCFullYear()), MMM: MONS[t.getUTCMonth()],
          MM: pad2(t.getUTCMonth() + 1), dd: pad2(t.getUTCDate()), HH: pad2(t.getUTCHours()),
          mm: pad2(t.getUTCMinutes()), d: String(t.getUTCDate())
        };
        return fmt.replace(/EEE|yyyy|MMM|MM|dd|HH|mm|d/g, (tok) => map[tok]);
      }
    }
  };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(source, ctx, { filename: 'apps-script-bundle.gs' });

  return {
    ctx,
    state,
    dump() {
      const sheets = {};
      Object.keys(state.sheets).sort().forEach((k) => { sheets[k] = state.sheets[k]._data; });
      return { sheets, mail: state.mail, fetches: state.fetches, logs: state.logs, cache: state.cache };
    }
  };
}

/* ── sources: working tree vs origin/main baseline ────────────────────────── */
function readSources(dir) {
  return GS_FILES.map((f) => '/* ===== ' + f + ' ===== */\n' + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
}

const BASE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'otp-baseline-'));
GS_FILES.forEach((f) => {
  const buf = execSync('git show origin/main:Assets/R3/apps-script/' + f, { cwd: REPO, maxBuffer: 1 << 28 });
  fs.writeFileSync(path.join(BASE_DIR, f), buf);
});

const SRC_NEW = readSources(GS_DIR);
const SRC_BASE = readSources(BASE_DIR);

/* ── seeds ────────────────────────────────────────────────────────────────── */
const R3_COLUMNS = (() => {
  const probe = buildEnv(SRC_BASE, {});
  return probe.ctx.getR3Columns();
})();

function r3Row(token) {
  return R3_COLUMNS.map((c) => {
    if (c === 'record_token') return token;
    if (c === 'record_id') return 'AIS-R3-20260601-101500';
    if (c === 'teacher') return 'Existing R3 Teacher';
    if (c === 'observation_date') return '2026-06-01';
    if (c === 'evidence_pad_id') return '';
    return '';
  });
}

function otpRow(token) {
  return EXPECTED_OTP_COLUMNS.map((c) => {
    if (c === 'record_token') return token;
    if (c === 'record_id') return 'AIS-OTP-20260901-081500';
    if (c === 'teacher') return 'Existing OTP Teacher';
    if (c === 'observer') return 'Dave Richards';
    if (c === 'observation_date') return '2026-09-01';
    if (c === 'evidence_pad_id') return '';
    if (c === 'grade') return '11';
    if (c === 'sp1_not_seen') return 'Beginner 1, Great 2';
    if (c === 'sp1_notes') return '{"Good 1":"Seen on the working wall."}';
    if (c === 'rubric_version') return 'sp1-v2';
    if (c === 'status') return 'observed';
    if (c === 'lap') return 1;
    if (c === 'round') return OTP_CURRENT_ROUND;
    return '';
  });
}

/** Real Sheets pads every row out to the widest column when it is read back. */
function padRow(row, width) {
  const out = row.slice();
  while (out.length < width) out.push('');
  return out;
}

// 2026-09-10 (@23): the code reads 'Teachers 26-27' / 'R3 Inspectors 26-27'. The
// 25-26 and un-suffixed names stay seeded with the SAME rows so an origin/main
// baseline that still reads an older name sees identical data and the R3
// byte-identity comparison stays meaningful.
// otp-v0.9: column F (index 5) carries the teacher's own email, read by
// lookupOtpTeacherEmail for the new submit-time teacher email (email B) and
// the close email (email C). 'Jo Mare Kruger' (OTP_PAYLOAD's teacher) is
// seeded here WITH an email so the positive email-B/email-C paths have a
// real match; the other two rows stay email-less for the "no email -> no
// email" cases.
const R3_TEACHERS_ROWS = [
  ['name', 'title', 'first_name', 'family_name', 'code', 'email'],
  ['R3 Teacher One', '', '', '', '', ''],
  ['R3 Teacher Two', '', '', '', '', ''],
  ['Jo Mare Kruger', '', '', '', '', 'jo.marekruger@ais.ae']
];
const R3_INSPECTORS_ROWS = [['Inspector', 'Email'], ['Dave Richards', 'dave.richards@ais.ae'], ['Hayden Ryan', 'hayden.ryan@ais.ae']];
const ROSTER_R3 = {
  Teachers: R3_TEACHERS_ROWS,
  Inspectors: R3_INSPECTORS_ROWS,
  'Teachers 25-26': R3_TEACHERS_ROWS,
  'Inspectors 25-26': R3_INSPECTORS_ROWS,
  'Teachers 26-27': R3_TEACHERS_ROWS,
  'R3 Inspectors 26-27': R3_INSPECTORS_ROWS,
  Curriculum: [['Curriculum'], ['Australian'], ['Ministry']],
  Subjects: [
    ['Subject', 'Yes/No', 'Kindy', 'Primary', 'Secondary'],
    ['Maths', true, true, true, true],
    ['English', true, false, true, true]
  ]
};
const ROSTER_2627 = {
  'OTP Coaches 26-27': [['Inspector', 'Email'], ['Dave Richards', 'dave.richards2627@ais.ae'], ['Brooke Pickett', 'brooke.pickett@ais.ae']]
};
const seedFull = () => JSON.parse(JSON.stringify({ ...ROSTER_R3, ...ROSTER_2627 }));
const seedR3Only = () => JSON.parse(JSON.stringify(ROSTER_R3));
const seedRecords = () => JSON.parse(JSON.stringify({
  ...ROSTER_R3,
  Submissions: [R3_COLUMNS, r3Row(SHARED_TOKEN)],
  'OTP Submissions': [EXPECTED_OTP_COLUMNS, otpRow(SHARED_TOKEN)]
}));

/* ── scenarios (run identically against both sources) ─────────────────────── */
const SCENARIOS = {
  r3_submit: {
    seed: seedFull,
    run: (env) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(R3_PAYLOAD) } }).getContent())
  },
  r3_options_no_form: {
    seed: seedFull,
    run: (env) => JSON.parse(env.ctx.doGet({ parameter: { action: 'options' } }).getContent())
  },
  r3_token_no_form: {
    seed: seedRecords,
    run: (env) => JSON.parse(env.ctx.doGet({ parameter: { token: SHARED_TOKEN } }).getContent())
  },
  r3_legacy_id_token: {
    seed: seedRecords,
    run: (env) => JSON.parse(env.ctx.doGet({ parameter: { id: 'AIS-R3-20260601-101500', token: SHARED_TOKEN } }).getContent())
  },
  r3_status: {
    seed: seedFull,
    run: (env) => JSON.parse(env.ctx.doGet({ parameter: {} }).getContent())
  },
  r3_pad_image: {
    seed: seedRecords,
    run: (env) => JSON.parse(env.ctx.doGet({ parameter: { action: 'pad_image', token: SHARED_TOKEN, name: 'page-1.jpg' } }).getContent())
  },
  r3_bad_token: {
    seed: seedRecords,
    run: (env) => JSON.parse(env.ctx.doGet({ parameter: { token: '00000000000000000000000000000000' } }).getContent())
  },
  // otp-v0.6 · every target that existed before the note targets must behave
  // byte-identically, prompt bytes included (the request payload is in the dump).
  pad_extract_r3_target: {
    seed: seedFull,
    run: (env) => extractPad(env, { target: 'summary_strengths' }).res
  },
  pad_extract_otp_target: {
    seed: seedFull,
    run: (env) => extractPad(env, { target: 'observer_comments' }).res
  },
  pad_extract_no_target: {
    seed: seedFull,
    run: (env) => extractPad(env, {}).res
  }
};

/**
 * Posts ONE pad page through doPost's extract route with the Anthropic key
 * stubbed in, and returns the response plus the prompt that was actually sent.
 */
function extractPad(env, extra) {
  env.ctx.getAnthropicKey = () => 'STUB_ANTHROPIC_KEY';
  const body = Object.assign({ action: 'extract_pad', image: 'QUJD' }, extra);
  const res = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  const call = env.state.fetches.filter((f) => f.url.indexOf('api.anthropic.com') > -1).pop() || {};
  const sent = JSON.parse(call.payload || '{}');
  const prompt = (((sent.messages || [{}])[0] || {}).content || [])
    .filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { res, prompt, sent };
}

function runScenario(source, name) {
  const spec = SCENARIOS[name];
  const env = buildEnv(source, spec.seed());
  const result = spec.run(env);
  return { result, ...env.dump() };
}

/* ── assertions ───────────────────────────────────────────────────────────── */
let pass = 0;
let fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else { fail += 1; console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + detail)); }
}
function eqJson(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  ok(a === b, label, a === b ? '' : 'expected: ' + b + '\n        actual:   ' + a);
}
function section(t) { console.log('\n' + t); }

/** The value cell of one `label` row in a buildOtpSubmissionHtml table. */
function mailRowValue(html, label) {
  const s = String(html);
  const at = s.indexOf('>' + label + '</td>');
  if (at < 0) return null;
  const td = s.indexOf('<td', at);
  if (td < 0) return null;
  const open = s.indexOf('>', td);
  const close = s.indexOf('</td>', open);
  if (open < 0 || close < 0) return null;
  return s.slice(open + 1, close);
}

/** The [label, value] pairs of one section of a buildOtpSubmissionHtml table. */
function mailSectionRows(html, title) {
  const s = String(html);
  const at = s.indexOf('>' + title + '</td>');
  if (at < 0) return null;
  const rest = s.slice(at);
  const next = rest.indexOf('colspan="2"', 1);
  const body = next > -1 ? rest.slice(0, next) : rest;
  const re = /<td style="padding:6px 12px 6px 0;[^"]*">([^<]*)<\/td><td[^>]*>([\s\S]*?)<\/td>/g;
  const out = [];
  let m;
  while ((m = re.exec(body))) out.push([m[1], m[2]]);
  return out;
}

console.log('AIS Apps Script harness · otp-v0.6');
console.log('files: ' + GS_FILES.join(', '));
console.log('baseline: origin/main (' + execSync('git rev-parse --short origin/main', { cwd: REPO }).toString().trim() + ') -> ' + BASE_DIR);

/* (a) OTP submission ------------------------------------------------------- */
section('(a) OTP submission · row + email + Supabase mirror');
{
  const env = buildEnv(SRC_NEW, seedFull());
  const out = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(OTP_PAYLOAD) } }).getContent());
  const dump = env.dump();
  const tab = dump.sheets['OTP Submissions'] || [];
  const header = tab[0] || [];
  const row = tab[1] || [];
  const idx = (c) => EXPECTED_OTP_COLUMNS.indexOf(c);

  eqJson(env.ctx.getOtpColumns(), EXPECTED_OTP_COLUMNS, 'getOtpColumns() is the 38-column contract, in order');
  eqJson(EXPECTED_OTP_COLUMNS.slice(33), ['time_out', 'status', 'closed_at', 'lap', 'round'], 'status, closed_at, lap and round are columns 35-38 (appended, hard rule 1)');
  ok(EXPECTED_OTP_COLUMNS.length === 38 && EXPECTED_OTP_COLUMNS[37] === 'round', 'round is column 38 (otp-v0.9)');
  ok(tab.length === 2, 'OTP Submissions holds exactly one header + ONE appended row', 'rows: ' + tab.length);
  eqJson(header, EXPECTED_OTP_COLUMNS, 'header row written in the load-bearing column order');
  ok(row.length === 38, 'appended row has 38 cells', 'cells: ' + row.length);
  ok(/^AIS-OTP-\d{8}-\d{6}$/.test(row[idx('record_id')]), 'record_id is a fresh AIS-OTP-YYYYMMDD-HHMMSS id', 'got: ' + row[idx('record_id')]);
  ok(/^[0-9a-f]{32}$/.test(row[idx('record_token')]), 'record_token is 32 hex chars', 'got: ' + row[idx('record_token')]);
  ok(row[idx('observer')] === OTP_PAYLOAD.inspector, 'observer column <- payload.inspector', 'got: ' + row[idx('observer')]);
  ok(row[idx('observation_date')] === OTP_PAYLOAD.date, 'observation_date column <- payload.date', 'got: ' + row[idx('observation_date')]);
  ok(row[idx('submitted_at')] === new Date(FIXED_MS).toISOString(), 'submitted_at stamped server-side');
  ok(row[idx('status')] === 'observed', 'a fresh submission stamps status "observed" (otp-v0.9)', 'got: ' + row[idx('status')]);
  ok(row[idx('closed_at')] === '', 'a fresh submission leaves closed_at empty (otp-v0.9)', 'got: ' + JSON.stringify(row[idx('closed_at')]));
  ok(row[idx('lap')] === 1, 'the first submission for a teacher is Lap 1 (otp-v0.9)', 'got: ' + row[idx('lap')]);
  ok(row[idx('round')] === OTP_CURRENT_ROUND, 'round is stamped live from get_current_round_otp (otp-v0.9)', 'got: ' + row[idx('round')]);
  const fieldsOk = ['teacher', 'curriculum', 'room_number', 'time_in', 'subject', 'school', 'support_teachers_cas',
    'otp_ref', 'otp_aspect', 'sp1_beginner', 'sp1_emerging', 'sp1_good', 'sp1_great', 'sp1_outstanding',
    'sp1_selected_text', 'observer_comments', 'other_observations', 'next_step_1', 'next_step_2', 'next_step_3',
    'evidence_pad_id', 'sp1_present', 'sp1_partially_present', 'sp1_not_present',
    'sp1_not_seen', 'grade', 'sp1_notes', 'rubric_version', 'time_out'].filter((k) => row[idx(k)] !== OTP_PAYLOAD[k]);
  eqJson(fieldsOk, [], 'every posted OTP field landed in its own column');
  ok(!dump.sheets['Submissions'], 'the R3 Submissions tab was never touched by an OTP post');
  eqJson(out, { success: true, id: row[idx('record_id')] }, 'response is { success:true, id } exactly like R3');

  // otp-v0.9: submit now sends TWO emails — the backup (A, with Lap N and an
  // edit link) and the teacher's own copy (B, view link only). 'Jo Mare
  // Kruger' has an email seeded in Teachers 26-27, so both fire.
  ok(dump.mail.length === 2, 'submit sends the backup email AND the teacher email (otp-v0.9)', 'count: ' + dump.mail.length);
  const mail = dump.mail[0] || {};
  ok(mail.subject === 'AIS OTP Progress · Lap 1 · Jo Mare Kruger · 2026-09-02', 'email A subject carries Lap 1 (otp-v0.9)', 'got: ' + mail.subject);
  ok(mail.to === 'admin.user@ais.ae', 'email A goes to the backup mailbox', 'got: ' + mail.to);
  ok(mail.cc === 'dave.richards2627@ais.ae', 'observer CC resolved over the OTP Coaches 26-27 tab', 'got: ' + mail.cc);
  const viewerLink = 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-record.html?token=' + row[idx('record_token')];
  const editLink = 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-progress-form.html?edit=' + row[idx('record_token')];
  ok(String(mail.htmlBody).indexOf(viewerLink) > -1, 'email A body carries the OTP viewer link (token only)', 'looked for: ' + viewerLink);
  ok(String(mail.htmlBody).indexOf(editLink) > -1, 'email A body carries the edit link (otp-v0.9)', 'looked for: ' + editLink);

  const mailB = dump.mail[1] || {};
  ok(mailB.to === 'jo.marekruger@ais.ae', 'email B goes to the teacher (otp-v0.9)', 'got: ' + mailB.to);
  ok(mailB.subject === 'Your OTP Progress observation · Lap 1 · 2026-09-02', 'email B subject carries Lap 1 (otp-v0.9)', 'got: ' + mailB.subject);
  ok(String(mailB.htmlBody).indexOf(viewerLink) > -1, 'email B carries the view link (otp-v0.9)', 'looked for: ' + viewerLink);
  ok(String(mailB.htmlBody).indexOf('?edit=') < 0, 'email B never carries an edit link (otp-v0.9)');
  ok(!mailB.cc, 'email B has no CC (teacher only)', 'got: ' + JSON.stringify(mailB.cc));

  const labelsMissing = ['Observer Comments', 'Other Observations', 'Next Steps / Support 1', 'Selected criteria', 'Support teachers / CAs',
    'Present in lesson', 'Partially present', 'Not present', 'Not assessed (does not count)', 'Grade', 'Time out']
    .filter((l) => String(mail.htmlBody).indexOf(l) < 0);
  eqJson(labelsMissing, [], 'email body lists the OTP columns with readable labels');

  const ingest = dump.fetches.filter((f) => f.url.endsWith('/rest/v1/rpc/ingest_otp'));
  ok(ingest.length === 1, 'exactly one Supabase mirror call, to /rest/v1/rpc/ingest_otp', 'urls: ' + JSON.stringify(dump.fetches.map((f) => f.url)));
  const body = JSON.parse((ingest[0] || {}).payload || '{}');
  eqJson(Object.keys(body), ['payload'], 'mirror body is { payload: ... }');
  eqJson(Object.keys(body.payload || {}), EXPECTED_OTP_COLUMNS, 'mirror payload carries the 38 columns, in order');
  eqJson(EXPECTED_OTP_COLUMNS.map((c) => body.payload[c]), row, 'mirror payload is a field-for-field copy of the Sheet row (status/lap/round included)');
  ok((ingest[0] || {}).headers.apikey === SECRET, 'mirror authenticates with the service_role key from Script Properties');
  ok(dump.fetches.every((f) => f.url.indexOf('/rest/v1/rpc/ingest_r3') < 0), 'the R3 ingest RPC was never called for an OTP post');
  ok(dump.fetches.some((f) => f.url.indexOf('/rest/v1/rpc/get_current_round_otp') > -1), 'submit fetched the current OTP round (otp-v0.9)');
}

/* (b) R3 parity ------------------------------------------------------------ */
section('(b) R3 paths byte-identical to origin/main baseline');
Object.keys(SCENARIOS).forEach((name) => {
  const runNew = runScenario(SRC_NEW, name);
  const runBase = runScenario(SRC_BASE, name);
  const a = JSON.stringify(runNew);
  const b = JSON.stringify(runBase);
  ok(a === b, 'scenario ' + name + ' identical (sheet rows + mail + fetches + logs + cache + response)',
    a === b ? '' : 'baseline: ' + b + '\n        current:  ' + a);
  // Guard against a vacuous pass: an extract scenario that never reached the
  // model (a stub that failed on BOTH sides) would compare equal and prove
  // nothing about the prompt bytes.
  if (name.indexOf('pad_extract') === 0) {
    const reached = (dump) => (dump.fetches || []).some((f) => f.url.indexOf('api.anthropic.com') > -1);
    ok(reached(runNew) && reached(runBase), 'scenario ' + name + ' really called the model on BOTH sources (prompt bytes compared)',
      'new: ' + reached(runNew) + ' baseline: ' + reached(runBase));
  }
});

/* (c) options ------------------------------------------------------------- */
section('(c) ?action=options&form=otp roster tabs + cache isolation');
{
  const withNew = buildEnv(SRC_NEW, seedFull());
  const o1 = JSON.parse(withNew.ctx.doGet({ parameter: { action: 'options', form: 'otp' } }).getContent());
  eqJson(o1.options.teachers.map((t) => t.name), ['R3 Teacher One', 'R3 Teacher Two', 'Jo Mare Kruger'], 'teachers read from Teachers 26-27 (the same tab R3 reads)');
  eqJson(o1.options.inspectors, ['Dave Richards', 'Brooke Pickett'], 'observers read from OTP Coaches 26-27, not the R3 inspector tab');
  eqJson(o1.options.curricula, ['Australian', 'Ministry'], 'curricula unchanged');
  eqJson(o1.options.subjects.map((s) => s.name), ['Maths', 'English'], 'subjects unchanged');
  eqJson(o1.options.schools, ['Kindy', 'Primary', 'Secondary'], 'schools unchanged');

  const noNew = buildEnv(SRC_NEW, seedR3Only());
  const o2 = JSON.parse(noNew.ctx.doGet({ parameter: { action: 'options', form: 'otp' } }).getContent());
  eqJson(o2.options.teachers.map((t) => t.name), ['R3 Teacher One', 'R3 Teacher Two', 'Jo Mare Kruger'], 'teachers still read from Teachers 26-27 when the coaches tab is missing');
  eqJson(o2.options.inspectors, [], 'no OTP Coaches 26-27 tab -> empty observer list, NEVER the R3 inspectors');

  const both = buildEnv(SRC_NEW, seedFull());
  both.ctx.doGet({ parameter: { action: 'options', form: 'otp' } });
  eqJson(Object.keys(both.state.cache), ['OTP_OPTIONS_v1'], 'the OTP options cache key is its own; the R3 key is untouched');
  both.ctx.doGet({ parameter: { action: 'options' } });
  eqJson(Object.keys(both.state.cache).sort(), ['OTP_OPTIONS_v1', 'R3_OPTIONS_v1'], 'both forms cache under separate keys, never colliding');
  const otpCached = JSON.parse(both.state.cache.OTP_OPTIONS_v1);
  const r3Cached = JSON.parse(both.state.cache.R3_OPTIONS_v1);
  ok(JSON.stringify(otpCached.inspectors) !== JSON.stringify(r3Cached.inspectors), 'the two cached option sets really do differ (OTP coaches vs R3 inspectors, no cross-read)');
  both.ctx.clearOptionsCache();
  eqJson(Object.keys(both.state.cache), [], 'clearOptionsCache() clears BOTH keys');
}

/* (d) token lookup -------------------------------------------------------- */
section('(d) token lookup · form=otp vs no form');
{
  const env = buildEnv(SRC_NEW, seedRecords());
  const otp = JSON.parse(env.ctx.doGet({ parameter: { token: SHARED_TOKEN, form: 'otp' } }).getContent());
  ok(otp.success === true, 'form=otp lookup succeeds');
  ok(otp.form === 'otp', 'form=otp lookup reports form:"otp"', 'got: ' + otp.form);
  ok(otp.data.teacher === 'Existing OTP Teacher', 'form=otp lookup read the OTP Submissions tab', 'got: ' + otp.data.teacher);
  ok(!('record_token' in otp.data), 'the token is never echoed back in the record');
  ok(otp.data.grade === '11', 'the record carries grade (otp-v0.5)', 'got: ' + otp.data.grade);
  ok(otp.data.sp1_not_seen === 'Beginner 1, Great 2', 'the record carries sp1_not_seen (otp-v0.5)', 'got: ' + otp.data.sp1_not_seen);

  const legacy = JSON.parse(env.ctx.doGet({ parameter: { id: 'AIS-OTP-20260901-081500', token: SHARED_TOKEN, form: 'otp' } }).getContent());
  eqJson(legacy, otp, 'the legacy ?id=&token=&form=otp shape resolves the same record');

  const missing = JSON.parse(env.ctx.doGet({ parameter: { token: 'deadbeef' + '0'.repeat(24), form: 'otp' } }).getContent());
  eqJson(missing, { success: false, error: 'Record not found' }, 'a wrong token returns the same generic miss (hard rule 10)');
  const noToken = JSON.parse(env.ctx.doGet({ parameter: { id: 'AIS-OTP-20260901-081500', form: 'otp' } }).getContent());
  eqJson(noToken, { success: false, error: 'Record not found' }, 'an id without a token is never enough');

  const r3Only = buildEnv(SRC_NEW, JSON.parse(JSON.stringify({ ...ROSTER_R3, Submissions: [R3_COLUMNS, r3Row(SHARED_TOKEN)] })));
  const fallback = JSON.parse(r3Only.ctx.doGet({ parameter: { token: SHARED_TOKEN, form: 'otp' } }).getContent());
  ok(fallback.success === true && fallback.form === 'r3', 'form=otp falls back to the R3 tab and reports form:"r3"', JSON.stringify(fallback).slice(0, 160));

  const bare = JSON.parse(env.ctx.doGet({ parameter: { token: SHARED_TOKEN } }).getContent());
  ok(bare.data.teacher === 'Existing R3 Teacher', 'the same token with NO form parameter still resolves via the R3 tab', 'got: ' + bare.data.teacher);
  ok(!('form' in bare), 'a no-form response is unchanged (no added field), matching baseline byte for byte');

  // Skeptic-found defect (2026-09-03): the pad-image lookup used to return a
  // miss before reaching the OTP tab whenever the R3 Submissions tab was
  // absent or header-only. The OTP form sends no form parameter on
  // ?action=pad_image, so an OTP pad must resolve in both of those states.
  const padIdx = EXPECTED_OTP_COLUMNS.indexOf('evidence_pad_id');
  const otpPadRow = otpRow(SHARED_TOKEN); otpPadRow[padIdx] = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  for (const [label, seed] of [
    ['R3 Submissions tab ABSENT', { ...ROSTER_R3, 'OTP Submissions': [EXPECTED_OTP_COLUMNS, otpPadRow] }],
    ['R3 Submissions tab header-only', { ...ROSTER_R3, Submissions: [R3_COLUMNS], 'OTP Submissions': [EXPECTED_OTP_COLUMNS, otpPadRow] }]
  ]) {
    const padEnv = buildEnv(SRC_NEW, JSON.parse(JSON.stringify(seed)));
    padEnv.ctx.listPadFiles = () => ['page-1.jpg'];
    padEnv.ctx.fetchPadImageBytes = () => ({ getBytes: () => [1, 2, 3] });
    const img = JSON.parse(padEnv.ctx.doGet({ parameter: { action: 'pad_image', token: SHARED_TOKEN, name: 'page-1.jpg' } }).getContent());
    ok(img.success === true && img.mime === 'image/jpeg', 'pad_image resolves an OTP pad with the ' + label + ' (no form param)', JSON.stringify(img).slice(0, 120));
    const wrong = JSON.parse(padEnv.ctx.doGet({ parameter: { action: 'pad_image', token: 'deadbeef' + '0'.repeat(24), name: 'page-1.jpg' } }).getContent());
    eqJson(wrong, { success: false, error: 'Record not found' }, 'pad_image wrong token still a generic miss with the ' + label);
  }
}

/* (e) header heal ---------------------------------------------------------- */
section('(e) header heal · an older OTP tab gains exactly the new trailing columns');
{
  const staleRow = (cols) => cols.map((c) => {
    if (c === 'record_token') return '11223344556677889900aabbccddeeff';
    if (c === 'record_id') return 'AIS-OTP-20260801-070000';
    if (c === 'teacher') return 'Old OTP Teacher';
    if (c === 'observer') return 'Hayden Ryan';
    if (c === 'observation_date') return '2026-08-01';
    return '';
  });

  const heal = (width) => {
    const OLD_OTP_COLUMNS = EXPECTED_OTP_COLUMNS.slice(0, width);
    const OLD_OTP_ROW = staleRow(OLD_OTP_COLUMNS);
    const env = buildEnv(SRC_NEW, JSON.parse(JSON.stringify({
      ...ROSTER_R3,
      'OTP Submissions': [OLD_OTP_COLUMNS, OLD_OTP_ROW]
    })));
    env.ctx.doPost({ postData: { contents: JSON.stringify(OTP_PAYLOAD) } });
    return { OLD_OTP_ROW, tab: env.dump().sheets['OTP Submissions'] || [] };
  };

  // a v0.1 tab is 26 columns wide, so it gains 12 cells
  // (otp-v0.2's 3 + otp-v0.5's 2 + otp-v0.6's 2 + otp-v0.8's 1 + otp-v0.9's 4)
  const v1 = heal(26);
  ok(v1.tab.length === 3, 'v0.1 tab: header + the untouched old row + the new appended row', 'rows: ' + v1.tab.length);
  eqJson(v1.tab[0], EXPECTED_OTP_COLUMNS, 'v0.1 header healed to the 38-column contract, in order');
  eqJson((v1.tab[0] || []).slice(26),
    ['sp1_present', 'sp1_partially_present', 'sp1_not_present', 'sp1_not_seen', 'grade', 'sp1_notes', 'rubric_version',
     'time_out', 'status', 'closed_at', 'lap', 'round'],
    'the 12 new header cells land in positions 27-38');
  eqJson(v1.tab[1], v1.OLD_OTP_ROW, 'the pre-existing v0.1 row keeps its original 26 cells untouched');
  ok((v1.tab[2] || []).length === 38, 'the row appended to the healed v0.1 tab has 38 cells', 'cells: ' + (v1.tab[2] || []).length);

  // a v0.2 tab is 29 columns wide, so it gains otp-v0.5's 2 + otp-v0.6's 2 + otp-v0.8's 1 + otp-v0.9's 4
  const v2 = heal(29);
  ok(v2.tab.length === 3, 'v0.2 tab: header + the untouched old row + the new appended row', 'rows: ' + v2.tab.length);
  eqJson(v2.tab[0], EXPECTED_OTP_COLUMNS, 'v0.2 header healed to the 38-column contract, in order');
  eqJson((v2.tab[0] || []).slice(29), ['sp1_not_seen', 'grade', 'sp1_notes', 'rubric_version', 'time_out', 'status', 'closed_at', 'lap', 'round'],
    'exactly the 9 new header cells land in positions 30-38');
  eqJson(v2.tab[1], v2.OLD_OTP_ROW, 'the pre-existing v0.2 row keeps its original 29 cells untouched');
  ok((v2.tab[2] || []).length === 38, 'the row appended to the healed v0.2 tab has 38 cells', 'cells: ' + (v2.tab[2] || []).length);

  // otp-v0.8: a v0.6/v0.7 tab is 33 columns wide, so it gains time_out + otp-v0.9's 4
  const v6 = heal(33);
  ok(v6.tab.length === 3, 'v0.6 tab: header + the untouched old row + the new appended row', 'rows: ' + v6.tab.length);
  eqJson(v6.tab[0], EXPECTED_OTP_COLUMNS, 'v0.6 header healed to the 38-column contract, in order');
  eqJson((v6.tab[0] || []).slice(33), ['time_out', 'status', 'closed_at', 'lap', 'round'], 'exactly the 5 new header cells land in positions 34-38');
  eqJson(v6.tab[1], v6.OLD_OTP_ROW, 'the pre-existing v0.6 row keeps its original 33 cells untouched');
  ok((v6.tab[2] || []).length === 38, 'the row appended to the healed v0.6 tab has 38 cells', 'cells: ' + (v6.tab[2] || []).length);
  ok(v6.tab[2] && v6.tab[2][33] === '10:55', 'the new row carries time_out in column 34', 'got: ' + (v6.tab[2] || [])[33]);

  // a otp-v0.5 tab is 31 columns wide, so it gains otp-v0.6's 2 + otp-v0.8's 1 + otp-v0.9's 4
  const v5 = heal(31);
  ok(v5.tab.length === 3, 'v0.5 tab: header + the untouched old row + the new appended row', 'rows: ' + v5.tab.length);
  eqJson(v5.tab[0], EXPECTED_OTP_COLUMNS, 'v0.5 header healed to the 38-column contract, in order');
  eqJson((v5.tab[0] || []).slice(31), ['sp1_notes', 'rubric_version', 'time_out', 'status', 'closed_at', 'lap', 'round'],
    'exactly the 7 new header cells land in positions 32-38');
  eqJson(v5.tab[1], v5.OLD_OTP_ROW, 'the pre-existing v0.5 row keeps its original 31 cells untouched');
  ok((v5.tab[2] || []).length === 38, 'the row appended to the healed v0.5 tab has 38 cells', 'cells: ' + (v5.tab[2] || []).length);

  // otp-v0.9: a v0.8 tab is 34 columns wide, so it gains EXACTLY the four new
  // lifecycle cells (status, closed_at, lap, round), and the new row carries
  // them stamped (status observed, lap 1, round live).
  const v8 = heal(34);
  ok(v8.tab.length === 3, 'v0.8 tab: header + the untouched old row + the new appended row', 'rows: ' + v8.tab.length);
  eqJson(v8.tab[0], EXPECTED_OTP_COLUMNS, 'v0.8 header healed to the 38-column contract, in order');
  eqJson((v8.tab[0] || []).slice(34), ['status', 'closed_at', 'lap', 'round'], 'exactly the 4 new header cells land in positions 35-38 (otp-v0.9)');
  eqJson(v8.tab[1], v8.OLD_OTP_ROW, 'the pre-existing v0.8 row keeps its original 34 cells untouched');
  ok((v8.tab[2] || []).length === 38, 'the row appended to the healed v0.8 tab has 38 cells', 'cells: ' + (v8.tab[2] || []).length);
  ok(v8.tab[2] && v8.tab[2][34] === 'observed' && v8.tab[2][36] === 1, 'the new row carries status "observed" and lap 1 in columns 35 and 37',
    JSON.stringify([(v8.tab[2] || [])[34], (v8.tab[2] || [])[36]]));
}

/* (f) school derived from grade ------------------------------------------- */
section('(f) otp-v0.5 · school is DERIVED from grade, and grade wins');
{
  const post = (over) => {
    const env = buildEnv(SRC_NEW, seedFull());
    env.ctx.doPost({ postData: { contents: JSON.stringify({ ...OTP_PAYLOAD, ...over }) } });
    const dump = env.dump();
    return { row: (dump.sheets['OTP Submissions'] || [])[1] || [], dump };
  };
  const schoolIdx = EXPECTED_OTP_COLUMNS.indexOf('school');
  const gradeIdx = EXPECTED_OTP_COLUMNS.indexOf('grade');

  // a payload whose own school contradicts its grade: grade wins everywhere
  const wrong = post({ school: 'Primary', grade: '9' });
  ok(wrong.row[schoolIdx] === 'Secondary', 'grade "9" beats a wrong payload school ("Primary") in the Sheet row', 'got: ' + wrong.row[schoolIdx]);

  const ingest = wrong.dump.fetches.filter((f) => f.url.endsWith('/rest/v1/rpc/ingest_otp'));
  const mirror = JSON.parse((ingest[0] || {}).payload || '{}').payload || {};
  ok(mirror.school === 'Secondary', 'the Supabase mirror carries the DERIVED school', 'got: ' + mirror.school);
  ok(mirror.grade === '9', 'the Supabase mirror carries the posted grade', 'got: ' + mirror.grade);

  const html = (wrong.dump.mail[0] || {}).htmlBody || '';
  ok(mailRowValue(html, 'School') === 'Secondary', 'the backup email School row shows the DERIVED school', 'got: ' + mailRowValue(html, 'School'));
  ok(mailRowValue(html, 'Grade') === '9', 'the backup email Grade row shows the posted grade', 'got: ' + mailRowValue(html, 'Grade'));
  ok(mailRowValue(html, 'Not assessed (does not count)') === OTP_PAYLOAD.sp1_not_seen,
    'the backup email Not assessed row shows the posted sp1_not_seen', 'got: ' + mailRowValue(html, 'Not assessed (does not count)'));

  // every branch of the mapping, each posted with a contradicting school
  [
    ['Pre-Kindy', 'Secondary', 'Kindy'],
    ['Kindy',     'Secondary', 'Kindy'],
    ['Prep',      'Secondary', 'Primary'],
    ['6',         'Secondary', 'Primary'],
    ['7',         'Primary',   'Secondary'],
    ['12',        'Primary',   'Secondary']
  ].forEach(([grade, posted, expected]) => {
    const out = post({ grade, school: posted });
    ok(out.row[schoolIdx] === expected,
      'grade "' + grade + '" -> school "' + expected + '" (payload said "' + posted + '")', 'got: ' + out.row[schoolIdx]);
    ok(out.row[gradeIdx] === grade, 'grade "' + grade + '" stored verbatim in its own column', 'got: ' + out.row[gradeIdx]);
  });

  const gradeless = post({ grade: '', school: 'Primary' });
  ok(gradeless.row[schoolIdx] === 'Primary', 'an empty grade keeps the payload school (legacy / gradeless posts)', 'got: ' + gradeless.row[schoolIdx]);
  ok(gradeless.row[gradeIdx] === '', 'an empty grade is stored as an empty cell', 'got: ' + gradeless.row[gradeIdx]);

  // a STALE otp-v0.4 tab (cached form) posts WITHOUT the two new keys at all
  const stale = { ...OTP_PAYLOAD };
  delete stale.grade;
  delete stale.sp1_not_seen;
  const staleEnv = buildEnv(SRC_NEW, seedFull());
  staleEnv.ctx.doPost({ postData: { contents: JSON.stringify(stale) } });
  const staleDump = staleEnv.dump();
  const staleRow = (staleDump.sheets['OTP Submissions'] || [])[1] || [];
  const notSeenIdx = EXPECTED_OTP_COLUMNS.indexOf('sp1_not_seen');
  ok(staleRow.length === 38, 'a stale otp-v0.4 payload (grade and sp1_not_seen keys absent) still appends a 38-cell row', 'cells: ' + staleRow.length);
  ok(staleRow[schoolIdx] === OTP_PAYLOAD.school, 'a stale payload keeps its posted school', 'got: ' + staleRow[schoolIdx]);
  ok(staleRow[gradeIdx] === '' && staleRow[notSeenIdx] === '', 'the two new cells are empty strings for a stale payload',
    'grade: ' + JSON.stringify(staleRow[gradeIdx]) + ' not_seen: ' + JSON.stringify(staleRow[notSeenIdx]));
  ok((staleDump.mail || []).length === 2, 'a stale payload still sends the backup email and the teacher email', 'mails: ' + (staleDump.mail || []).length);
  ok((staleDump.fetches || []).some((f) => f.url.endsWith('/rest/v1/rpc/ingest_otp')), 'a stale payload still calls the Supabase mirror');
}

/* (g) otp-v0.6 notes columns + Criterion notes email section --------------- */
section('(g) otp-v0.6 · sp1_notes + rubric_version, and the Criterion notes email section');
{
  const postOtp = (over) => {
    const env = buildEnv(SRC_NEW, seedFull());
    env.ctx.doPost({ postData: { contents: JSON.stringify({ ...OTP_PAYLOAD, ...over }) } });
    const dump = env.dump();
    return { row: (dump.sheets['OTP Submissions'] || [])[1] || [], dump, html: (dump.mail[0] || {}).htmlBody || '' };
  };
  const notesIdx = EXPECTED_OTP_COLUMNS.indexOf('sp1_notes');
  const versionIdx = EXPECTED_OTP_COLUMNS.indexOf('rubric_version');

  const full = postOtp({});
  ok(full.row[notesIdx] === OTP_NOTES_JSON, 'sp1_notes lands in its column as the exact JSON string posted', 'got: ' + JSON.stringify(full.row[notesIdx]));
  ok(full.row[versionIdx] === 'sp1-v2', 'rubric_version lands in its column as posted', 'got: ' + full.row[versionIdx]);
  const mirror = JSON.parse((full.dump.fetches.filter((f) => f.url.endsWith('/rest/v1/rpc/ingest_otp'))[0] || {}).payload || '{}').payload || {};
  ok(mirror.sp1_notes === OTP_NOTES_JSON && mirror.rubric_version === 'sp1-v2',
    'the Supabase mirror carries both new values verbatim (05_Supabase.gs unchanged)', JSON.stringify([mirror.sp1_notes, mirror.rubric_version]));

  ok(full.html.indexOf('Not seen (does not count)') < 0, 'the old "Not seen (does not count)" email label is gone');

  const noteRows = mailSectionRows(full.html, 'Criterion notes') || [];
  eqJson(noteRows.map((r) => r[0]),
    ['Emerging 2 · Not present', 'Good 3 · Partially present', 'Great 5 · Not assessed', 'Outstanding 4 · Present'],
    'Criterion notes: one row per note, level order then n, state read from the colour lists');
  eqJson(noteRows.map((r) => r[1]),
    ['Pupils waited for a prompt &lt;every time&gt;.',
     'Pace slipped in the middle third.<br>Recovered after the timer.',
     'No colour on this one, just a note.',
     'Applied prior learning unprompted.'],
    'note values are HTML-escaped and their newlines render as <br>');

  const posRef = full.html.indexOf('>OTP reference</td>');
  const posNotes = full.html.indexOf('>Criterion notes</td>');
  const posObs = full.html.indexOf('>Observer notes</td>');
  ok(posRef > -1 && posRef < posNotes && posNotes < posObs,
    'Criterion notes sits after the OTP reference section and before Observer notes', [posRef, posNotes, posObs].join(' / '));

  const empty = postOtp({ sp1_notes: '' });
  ok(empty.html.indexOf('Criterion notes') < 0, 'the whole section is omitted when sp1_notes is empty');
  ok(empty.row[notesIdx] === '', 'an empty sp1_notes is stored as an empty cell');
  const broken = postOtp({ sp1_notes: '{not json' });
  ok(broken.html.indexOf('Criterion notes') < 0, 'the whole section is omitted when sp1_notes is not valid JSON');
  ok(broken.row[notesIdx] === '{not json', 'an unparseable sp1_notes is still stored verbatim (the Sheet never loses data)');
  const blankNotes = postOtp({ sp1_notes: '{"Good 3":"   "}' });
  ok(blankNotes.html.indexOf('Criterion notes') < 0, 'the section is omitted when the JSON holds no note text');

  // a cached otp-v0.5 form during deploy skew posts neither new key
  const staleEnv6 = buildEnv(SRC_NEW, seedFull());
  const stale6 = { ...OTP_PAYLOAD };
  delete stale6.sp1_notes;
  delete stale6.rubric_version;
  staleEnv6.ctx.doPost({ postData: { contents: JSON.stringify(stale6) } });
  const stale6Dump = staleEnv6.dump();
  const stale6Row = (stale6Dump.sheets['OTP Submissions'] || [])[1] || [];
  ok(stale6Row.length === 38, 'a stale otp-v0.5 payload still appends a 38-cell row', 'cells: ' + stale6Row.length);
  ok(stale6Row[notesIdx] === '' && stale6Row[versionIdx] === '', 'the two new cells are empty strings for a stale payload',
    JSON.stringify([stale6Row[notesIdx], stale6Row[versionIdx]]));
  ok(String((stale6Dump.mail[0] || {}).htmlBody).indexOf('Criterion notes') < 0, 'a stale payload sends the email with no Criterion notes section');

  // A v0.5-shaped row (31 cells) under the healed 33-column header still reads
  // back. NB real Sheets pads ragged rows out to the widest column on read and
  // this harness's getValues() stub does not, so the padding is modelled here.
  const LEGACY_TOKEN = '99887766554433221100ffeeddccbbaa';
  const legacyEnv = buildEnv(SRC_NEW, JSON.parse(JSON.stringify({
    ...ROSTER_R3,
    'OTP Submissions': [EXPECTED_OTP_COLUMNS, padRow(otpRow(LEGACY_TOKEN).slice(0, 31), EXPECTED_OTP_COLUMNS.length)]
  })));
  const legacy = JSON.parse(legacyEnv.ctx.doGet({ parameter: { token: LEGACY_TOKEN, form: 'otp' } }).getContent());
  ok(legacy.success === true && legacy.data.teacher === 'Existing OTP Teacher',
    'a 31-cell otp-v0.5 row still reads back under the 33-column header', JSON.stringify(legacy).slice(0, 140));
  ok(legacy.data.grade === '11' && legacy.data.sp1_not_seen === 'Beginner 1, Great 2', 'the legacy row keeps its own otp-v0.5 values');
  ok(legacy.data.sp1_notes === '' && legacy.data.rubric_version === '',
    'the two new fields read back as empty strings on a legacy row', JSON.stringify([legacy.data.sp1_notes, legacy.data.rubric_version]));

  // a v0.6 row returns both new fields, mapped by header name (02_doGet.gs unchanged)
  const freshEnv = buildEnv(SRC_NEW, seedRecords());
  const fresh = JSON.parse(freshEnv.ctx.doGet({ parameter: { token: SHARED_TOKEN, form: 'otp' } }).getContent());
  ok(fresh.data.sp1_notes === '{"Good 1":"Seen on the working wall."}', 'the record fetch returns sp1_notes by header', 'got: ' + fresh.data.sp1_notes);
  ok(fresh.data.rubric_version === 'sp1-v2', 'the record fetch returns rubric_version by header', 'got: ' + fresh.data.rubric_version);

  // the pad-page name gate accepts a criterion-note page (02_doGet.gs unchanged)
  const padIdx = EXPECTED_OTP_COLUMNS.indexOf('evidence_pad_id');
  const notePadRow = otpRow(SHARED_TOKEN); notePadRow[padIdx] = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const padEnv = buildEnv(SRC_NEW, JSON.parse(JSON.stringify({ ...ROSTER_R3, 'OTP Submissions': [EXPECTED_OTP_COLUMNS, notePadRow] })));
  padEnv.ctx.listPadFiles = () => ['sp1-good-3-note-1.jpg'];
  padEnv.ctx.fetchPadImageBytes = () => ({ getBytes: () => [1, 2, 3] });
  const noteImg = JSON.parse(padEnv.ctx.doGet({ parameter: { action: 'pad_image', token: SHARED_TOKEN, name: 'sp1-good-3-note-1.jpg' } }).getContent());
  ok(noteImg.success === true && noteImg.mime === 'image/jpeg',
    'the pad_image name gate accepts a criterion-note page (sp1-good-3-note-1.jpg)', JSON.stringify(noteImg).slice(0, 120));
  const badName = JSON.parse(padEnv.ctx.doGet({ parameter: { action: 'pad_image', token: SHARED_TOKEN, name: 'sp1_good_3_note-1.jpg' } }).getContent());
  eqJson(badName, { success: false, error: 'Record not found' }, 'the name gate still rejects a name outside [a-z0-9-]+.jpg');
}

/* (h) otp-v0.6 pad extraction targets -------------------------------------- */
section('(h) otp-v0.6 · pad extraction accepts sp1_<level>_<n>_note targets');
{
  const CRITERION = 'Lesson pace is well managed with planned strategies to support appropriate pace implemented.';
  const fieldLine = (ctx) => 'This whole page belongs to ONE form field: the observer\'s note about the OTP criterion "' + ctx + '".';
  const run = (extra) => extractPad(buildEnv(SRC_NEW, seedFull()), extra);

  const good = run({ target: 'sp1_good_3_note', context: CRITERION });
  eqJson(good.res, { success: true, items: [{ target: 'sp1_good_3_note', text: 'transcribed note' }] },
    'a note target is accepted and the item is stamped with the page target');
  ok(good.prompt.indexOf(fieldLine(CRITERION)) > -1, 'the targeted prompt names the criterion in the field line', good.prompt.split('\n')[3]);
  ok(good.sent.output_config.format.schema.properties.items.items.required.join() === 'text',
    'a note page uses the transcription-only schema (no target for the model to guess)');

  const noCtx = run({ target: 'sp1_beginner_1_note' });
  ok(noCtx.prompt.indexOf(fieldLine('sp1_beginner_1_note')) > -1, 'a note target with no context falls back to the target name');

  const messy = run({ target: 'sp1_great_8_note', context: '  He said "go" ' + 'x'.repeat(500) + '  ' });
  const quoted = /ONE form field: the observer's note about the OTP criterion "([^"]*)"\./.exec(messy.prompt);
  ok(!!quoted, 'a messy context still yields exactly one quoted criterion span');
  const ctxOut = quoted ? quoted[1] : '';
  ok(ctxOut.length <= 400, 'the criterion context is capped at 400 chars', 'len: ' + ctxOut.length);
  ok(ctxOut.indexOf('"') < 0, 'double quotes are stripped from the criterion context');
  ok(ctxOut.slice(0, 11) === 'He said go ', 'the context is trimmed and otherwise verbatim', JSON.stringify(ctxOut.slice(0, 20)));

  const n19 = run({ target: 'sp1_outstanding_19_note', context: CRITERION });
  ok(n19.res.items.length === 1 && n19.res.items[0].target === 'sp1_outstanding_19_note', 'n up to 19 is accepted', JSON.stringify(n19.res));

  ['sp1_good_99_note', 'sp1_x_1_note', '../etc', 'sp1_good_20_note', 'sp1_good_0_note'].forEach((bad) => {
    const out = run({ target: bad, context: CRITERION });
    ok(out.prompt.indexOf('This whole page belongs to ONE form field:') < 0,
      'target "' + bad + '" is rejected: the classify prompt is used, not a targeted one');
    eqJson(out.res, { success: true, items: [] }, 'target "' + bad + '" never reaches the response items');
  });

  const legacyTarget = run({ target: 'observer_comments', context: CRITERION });
  ok(legacyTarget.prompt.indexOf('This whole page belongs to ONE form field: Observer Comments.') > -1,
    'an existing target keeps its own label line, context ignored');

  // Skeptic-found defect (2026-09-09): note support is additive everywhere in
  // this file except three lines inside the SHARED handlePadExtract (a widened
  // target predicate, twice, and the prompt argument). Prove mechanically that
  // those three add ONLY note targets: for every pre-v0.6 target and a set of
  // junk values, the new predicate answers exactly what main's expression
  // answered, the prompt argument is the target itself, and the prompt bytes
  // come from main's own untouched function.
  const newCtx = buildEnv(SRC_NEW, seedFull()).ctx;
  const baseCtx = buildEnv(SRC_BASE, seedFull()).ctx;
  const constOf = (ctx, name) => vm.runInContext(name, ctx);
  const PRE_V06 = constOf(baseCtx, 'PAD_EXTRACT_TARGETS').slice();
  ok(PRE_V06.length === 9, 'main lists nine pad targets', 'count: ' + PRE_V06.length);
  eqJson(constOf(newCtx, 'PAD_EXTRACT_TARGETS'), PRE_V06,
    'PAD_EXTRACT_TARGETS is untouched, so the classify schema enum still offers only those nine');
  const PROBES = PRE_V06.concat(['', 0, false, null, undefined, 'observer_notes ', 'sp1_good_99_note', 'sp1_x_1_note', '../etc']);
  let agree = true; let sameArg = true; let samePrompt = true;
  PROBES.forEach((t) => {
    if (newCtx.isPadExtractTarget(t) !== (PRE_V06.indexOf(String(t || '')) > -1)) agree = false;
    if (newCtx.padExtractPromptField(t, CRITERION) !== String(t == null ? '' : t)) sameArg = false;
    if (newCtx.padExtractTargetedPrompt(t) !== baseCtx.padExtractTargetedPrompt(t)) samePrompt = false;
  });
  ok(agree, 'the widened target predicate answers exactly as main for every non-note value');
  ok(sameArg, 'a non-note target reaches padExtractTargetedPrompt unchanged');
  ok(samePrompt, 'padExtractTargetedPrompt returns main bytes for every non-note value');
  ok(newCtx.isPadExtractTarget('sp1_good_3_note') === true && PRE_V06.indexOf('sp1_good_3_note') < 0,
    'the ONLY values the predicate adds are the note targets');
}

/** Posts an OTP submission (OTP_PAYLOAD, overridden) and returns the newly
 * appended row array. Used by the otp-v0.9 lifecycle sections below. */
function submitOtpRow(env, over) {
  env.ctx.doPost({ postData: { contents: JSON.stringify({ ...OTP_PAYLOAD, ...over }) } });
  const tab = env.dump().sheets['OTP Submissions'] || [];
  return tab[tab.length - 1];
}

/* (i) otp-v0.9 · lap increments per teacher; round-fetch failure ---------- */
section('(i) otp-v0.9 · lap increments per teacher (case-insensitive); a round-fetch failure stamps round ""');
{
  const idx = (c) => EXPECTED_OTP_COLUMNS.indexOf(c);
  const env = buildEnv(SRC_NEW, seedFull());
  submitOtpRow(env, {});
  const second = submitOtpRow(env, { teacher: 'JO MARE KRUGER' });   // same teacher, different case
  const tab = env.dump().sheets['OTP Submissions'] || [];
  ok(tab.length === 3, 'two submissions for the same teacher append two rows', 'rows: ' + tab.length);
  ok(tab[1][idx('lap')] === 1, 'the first submission is Lap 1', 'got: ' + tab[1][idx('lap')]);
  ok(second[idx('lap')] === 2, 'the second submission (different-case teacher name) is Lap 2', 'got: ' + second[idx('lap')]);

  const otherEnv = buildEnv(SRC_NEW, seedFull());
  const otherRow = submitOtpRow(otherEnv, { teacher: 'Someone Else' });
  ok(otherRow[idx('lap')] === 1, 'a different teacher still starts at Lap 1', 'got: ' + otherRow[idx('lap')]);

  const failEnv = buildEnv(SRC_NEW, seedFull());
  failEnv.state.forceRoundFailure = true;
  const failOut = JSON.parse(failEnv.ctx.doPost({ postData: { contents: JSON.stringify(OTP_PAYLOAD) } }).getContent());
  const failRow = (failEnv.dump().sheets['OTP Submissions'] || [])[1] || [];
  ok(failOut.success === true, 'submit still succeeds when the round RPC fails', JSON.stringify(failOut));
  ok(failRow[idx('round')] === '', 'a failed round fetch stamps round as an empty string (hard rule 12)', 'got: ' + JSON.stringify(failRow[idx('round')]));
  ok(failRow[idx('status')] === 'observed' && failRow[idx('lap')] === 1, 'status and lap are unaffected by a round-fetch failure',
    JSON.stringify([failRow[idx('status')], failRow[idx('lap')]]));
}

/* (j) otp-v0.9 · update overwrites only posted keys ----------------------- */
section('(j) otp-v0.9 · update overwrites only posted keys; status/lap/round/ids untouched');
{
  const idx = (c) => EXPECTED_OTP_COLUMNS.indexOf(c);
  const env = buildEnv(SRC_NEW, seedFull());
  const beforeRow = submitOtpRow(env, {});
  const token = beforeRow[idx('record_token')];

  const updateOut = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'update', record_token: token,
    observer_comments: 'Updated after the coaching chat.',
    next_step_1: 'Try cold-call in the first ten minutes.',
    grade: '3'   // OTP_PAYLOAD posted grade '9' (Secondary); '3' should re-derive school to Primary
  }) } }).getContent());
  const tab = env.dump().sheets['OTP Submissions'];
  ok(tab.length === 2, 'update overwrites the existing row in place, no new row is appended', 'rows: ' + tab.length);
  const afterRow = tab[1];

  eqJson(updateOut, { success: true, id: beforeRow[idx('record_id')], status: 'observed' }, 'update response is {success:true, id, status:"observed"}');
  ok(afterRow[idx('observer_comments')] === 'Updated after the coaching chat.', 'a posted key overwrites its cell', 'got: ' + afterRow[idx('observer_comments')]);
  ok(afterRow[idx('next_step_1')] === 'Try cold-call in the first ten minutes.', 'a second posted key overwrites its own cell', 'got: ' + afterRow[idx('next_step_1')]);
  ok(afterRow[idx('grade')] === '3', 'grade overwrites when posted', 'got: ' + afterRow[idx('grade')]);
  ok(afterRow[idx('school')] === 'Primary', 'school is RE-DERIVED from the posted grade on update (grade 3 -> Primary)', 'got: ' + afterRow[idx('school')]);

  ok(afterRow[idx('evidence_pad_id')] === OTP_PAYLOAD.evidence_pad_id, 'evidence_pad_id (absent from the update payload) survives untouched', 'got: ' + afterRow[idx('evidence_pad_id')]);
  ok(afterRow[idx('sp1_beginner')] === beforeRow[idx('sp1_beginner')], 'an untouched rubric column keeps its original value', 'got: ' + afterRow[idx('sp1_beginner')]);
  ok(afterRow[idx('teacher')] === beforeRow[idx('teacher')], 'teacher (absent from the update payload) is untouched', 'got: ' + afterRow[idx('teacher')]);

  ok(afterRow[idx('record_id')] === beforeRow[idx('record_id')], 'record_id is never touched by an update', 'got: ' + afterRow[idx('record_id')]);
  ok(afterRow[idx('submitted_at')] === beforeRow[idx('submitted_at')], 'submitted_at is never touched by an update');
  ok(afterRow[idx('record_token')] === token, 'record_token is never touched by an update');
  ok(afterRow[idx('lap')] === beforeRow[idx('lap')], 'lap is never touched by an update');
  ok(afterRow[idx('round')] === beforeRow[idx('round')], 'round is never touched by an update');
  ok(afterRow[idx('status')] === 'observed', 'status stays "observed" after an update', 'got: ' + afterRow[idx('status')]);
  ok(afterRow[idx('closed_at')] === '', 'closed_at stays empty after an update', 'got: ' + JSON.stringify(afterRow[idx('closed_at')]));

  const ingest = env.dump().fetches.filter((f) => f.url.endsWith('/rest/v1/rpc/ingest_otp'));
  ok(ingest.length === 2, 'update triggers a second Supabase mirror call (submit + update)', 'count: ' + ingest.length);
  const mirrorAfter = JSON.parse((ingest[1] || {}).payload || '{}').payload || {};
  eqJson(EXPECTED_OTP_COLUMNS.map((c) => mirrorAfter[c]), afterRow, 'the update re-push mirrors the FULL row, field for field');

  ok(env.dump().mail.length === 2, 'a plain update sends no extra email beyond the original submit A + B', 'count: ' + env.dump().mail.length);
}

/* (k) otp-v0.9 · close sets status closed + closed_at, sends email C ------ */
section('(k) otp-v0.9 · close sets status closed + closed_at and sends email C with the three steps + view link');
{
  const idx = (c) => EXPECTED_OTP_COLUMNS.indexOf(c);
  const env = buildEnv(SRC_NEW, seedFull());
  const beforeRow = submitOtpRow(env, {});
  const token = beforeRow[idx('record_token')];

  const closePayload = {
    form: 'otp', action: 'close', record_token: token,
    next_step_1: 'Cold-call every ten minutes.',
    next_step_2: 'Share success criteria up front.',
    next_step_3: 'Revisit in three weeks'
  };
  const closeOut = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(closePayload) } }).getContent());
  const afterRow = env.dump().sheets['OTP Submissions'][1];

  eqJson(closeOut, { success: true, id: beforeRow[idx('record_id')], status: 'closed' }, 'close response is {success:true, id, status:"closed"}');
  ok(afterRow[idx('status')] === 'closed', 'status is "closed" after close', 'got: ' + afterRow[idx('status')]);
  ok(afterRow[idx('closed_at')] === new Date(FIXED_MS).toISOString(), 'closed_at is stamped server-side', 'got: ' + afterRow[idx('closed_at')]);
  ok(afterRow[idx('next_step_1')] === closePayload.next_step_1, 'a posted key (next_step_1) is applied on close too', 'got: ' + afterRow[idx('next_step_1')]);
  ok(afterRow[idx('lap')] === beforeRow[idx('lap')] && afterRow[idx('round')] === beforeRow[idx('round')], 'lap/round are untouched by close');

  const mail = env.dump().mail;
  ok(mail.length === 3, 'close sends a third email (C), beyond the submit-time A + B', 'count: ' + mail.length);
  const emailC = mail[2];
  const viewUrl = 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-record.html?token=' + token;
  ok(emailC.to === 'jo.marekruger@ais.ae', 'email C goes to the teacher', 'got: ' + emailC.to);
  ok(emailC.subject === 'OTP Progress · Lap 1 closed · Jo Mare Kruger · 2026-09-02', 'email C subject names the closed lap', 'got: ' + emailC.subject);
  ok(String(emailC.htmlBody).indexOf('1. ' + closePayload.next_step_1) > -1 &&
     String(emailC.htmlBody).indexOf('2. ' + closePayload.next_step_2) > -1 &&
     String(emailC.htmlBody).indexOf('3. ' + closePayload.next_step_3) > -1,
     'email C body carries all three Next Steps, numbered', emailC.htmlBody);
  ok(String(emailC.htmlBody).indexOf(viewUrl) > -1, 'email C carries the view link', 'looked for: ' + viewUrl);
  ok(String(emailC.htmlBody).indexOf('?edit=') < 0, 'email C never carries an edit link (record is locked)');
  ok(emailC.cc.indexOf('dave.richards2627@ais.ae') > -1 && emailC.cc.indexOf('admin.user@ais.ae') > -1,
    'email C CCs the observer and the backup mailbox', 'got: ' + emailC.cc);

  const ingest = env.dump().fetches.filter((f) => f.url.endsWith('/rest/v1/rpc/ingest_otp'));
  ok(ingest.length === 2, 'close triggers a second Supabase mirror call (submit + close)', 'count: ' + ingest.length);
  const mirrorAfter = JSON.parse((ingest[1] || {}).payload || '{}').payload || {};
  ok(mirrorAfter.status === 'closed' && mirrorAfter.closed_at === afterRow[idx('closed_at')], 'the close re-push mirror carries status closed + closed_at');
}

/* (l) otp-v0.9 · update/close on an already-closed row is refused --------- */
section('(l) otp-v0.9 · update and close on an already-closed row are refused; the row is unchanged');
{
  const idx = (c) => EXPECTED_OTP_COLUMNS.indexOf(c);
  const env = buildEnv(SRC_NEW, seedFull());
  const beforeRow = submitOtpRow(env, {});
  const token = beforeRow[idx('record_token')];

  env.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'close', record_token: token,
    next_step_1: 'A', next_step_2: 'B', next_step_3: 'C'
  }) } });
  const closedRow = env.dump().sheets['OTP Submissions'][1].slice();
  const mailCountAfterClose = env.dump().mail.length;
  const fetchCountAfterClose = env.dump().fetches.length;

  const updateAttempt = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'update', record_token: token, observer_comments: 'Should never land.'
  }) } }).getContent());
  eqJson(updateAttempt, { success: false, error: 'Record not found' }, 'an update on a closed row gets the generic miss (hard rule 12)');

  const closeAttempt = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'close', record_token: token, next_step_1: 'Z'
  }) } }).getContent());
  eqJson(closeAttempt, { success: false, error: 'Record not found' }, 'a second close on an already-closed row gets the generic miss');

  const finalRow = env.dump().sheets['OTP Submissions'][1];
  eqJson(finalRow, closedRow, 'the row is byte-for-byte unchanged after both refused attempts');
  ok(env.dump().mail.length === mailCountAfterClose, 'no new email is sent on a refused update/close', 'got: ' + env.dump().mail.length);
  ok(env.dump().fetches.length === fetchCountAfterClose, 'no new Supabase call is made on a refused update/close', 'got: ' + env.dump().fetches.length);

  const wrongToken = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'update', record_token: 'deadbeef' + '0'.repeat(24), observer_comments: 'x'
  }) } }).getContent());
  eqJson(wrongToken, { success: false, error: 'Record not found' }, 'update with an unknown record_token gets the same generic miss');
}

/* (m) otp-v0.9 · prev_next_steps ------------------------------------------ */
section('(m) otp-v0.9 · prev_next_steps: not found / found / round filter / cache invalidation');
{
  const idx = (c) => EXPECTED_OTP_COLUMNS.indexOf(c);

  const emptyEnv = buildEnv(SRC_NEW, seedFull());
  const miss = JSON.parse(emptyEnv.ctx.doGet({ parameter: { action: 'prev_next_steps', teacher: 'Jo Mare Kruger', form: 'otp' } }).getContent());
  eqJson(miss, { success: true, found: false }, 'no OTP rows at all -> found:false, no error');

  const env = buildEnv(SRC_NEW, seedFull());
  const row1 = submitOtpRow(env, { date: '2026-09-01' });
  env.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'close', record_token: row1[idx('record_token')],
    next_step_1: 'Lap 1 step one', next_step_2: 'Lap 1 step two', next_step_3: 'Lap 1 step three'
  }) } });
  const row2 = submitOtpRow(env, { date: '2026-09-08' });   // Lap 2, same teacher, later date
  env.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'close', record_token: row2[idx('record_token')],
    next_step_1: 'Lap 2 step one', next_step_2: 'Lap 2 step two', next_step_3: 'Lap 2 step three'
  }) } });

  const found = JSON.parse(env.ctx.doGet({ parameter: { action: 'prev_next_steps', teacher: 'jo mare kruger', form: 'otp' } }).getContent());
  ok(found.success === true && found.found === true, 'a teacher with closed laps is found (case-insensitive)', JSON.stringify(found));
  ok(found.lap === 2, 'the LATEST closed lap wins (Lap 2, later observation_date)', 'got: ' + found.lap);
  eqJson([found.next_step_1, found.next_step_2, found.next_step_3],
    ['Lap 2 step one', 'Lap 2 step two', 'Lap 2 step three'], 'the three Next Steps come from the winning lap');
  ok(found.observer === OTP_PAYLOAD.inspector, 'observer is carried', 'got: ' + found.observer);
  ok(found.observation_date === '2026-09-08', 'observation_date is carried', 'got: ' + found.observation_date);
  const sp1Keys = Object.keys(found).filter((k) => k.indexOf('sp1_') === 0);
  eqJson(sp1Keys, [], 'the response carries no sp1_* keys');

  // round filter: a closed row from ANOTHER round is skipped even though newer;
  // a BLANK round counts as current. Both seeded directly (never through
  // submit, so they can carry a round an ordinary submit would never write),
  // mirroring the direct-seed pattern used by section (e)'s header-heal tests.
  const roundEnv = buildEnv(SRC_NEW, seedFull());
  const currentRow = submitOtpRow(roundEnv, { date: '2026-09-01' });
  roundEnv.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'close', record_token: currentRow[idx('record_token')],
    next_step_1: 'Current round step', next_step_2: '', next_step_3: ''
  }) } });
  const rTab = roundEnv.dump().sheets['OTP Submissions'];

  const otherRoundRow = otpRow('11112222333344445555666677778888');
  otherRoundRow[idx('teacher')] = OTP_PAYLOAD.teacher;
  otherRoundRow[idx('observation_date')] = '2026-09-09';   // newer than the current-round lap
  otherRoundRow[idx('status')] = 'closed';
  otherRoundRow[idx('round')] = OTP_OTHER_ROUND;
  otherRoundRow[idx('next_step_1')] = 'Wrong round step';
  rTab.push(otherRoundRow);
  // seeded directly (not through close), so clear the 60s cache by hand,
  // exactly what handleOtpUpdateOrClose would have done for a real close.
  roundEnv.ctx.clearPrevNextStepsCache(OTP_PAYLOAD.teacher);

  const roundFiltered = JSON.parse(roundEnv.ctx.doGet({ parameter: { action: 'prev_next_steps', teacher: OTP_PAYLOAD.teacher, form: 'otp' } }).getContent());
  ok(roundFiltered.found === true && roundFiltered.next_step_1 === 'Current round step',
    'a closed row from ANOTHER round is skipped even though it is newer', JSON.stringify(roundFiltered));

  const blankRoundRow = otpRow('99998888777766665555444433332222');
  blankRoundRow[idx('teacher')] = OTP_PAYLOAD.teacher;
  blankRoundRow[idx('observation_date')] = '2026-09-10';   // newer than both above
  blankRoundRow[idx('status')] = 'closed';
  blankRoundRow[idx('round')] = '';
  blankRoundRow[idx('next_step_1')] = 'Blank round step';
  rTab.push(blankRoundRow);
  roundEnv.ctx.clearPrevNextStepsCache(OTP_PAYLOAD.teacher);

  const blankWins = JSON.parse(roundEnv.ctx.doGet({ parameter: { action: 'prev_next_steps', teacher: OTP_PAYLOAD.teacher, form: 'otp' } }).getContent());
  ok(blankWins.found === true && blankWins.next_step_1 === 'Blank round step',
    'a blank round counts as the current round and, being newest, wins', JSON.stringify(blankWins));

  // cache: handleOtpUpdateOrClose clears the teacher's key on every close, so
  // the very next lookup sees a freshly closed lap without waiting the 60s TTL.
  const cacheEnv = buildEnv(SRC_NEW, seedFull());
  const cRow = submitOtpRow(cacheEnv, {});
  cacheEnv.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'close', record_token: cRow[idx('record_token')],
    next_step_1: 'First close', next_step_2: '', next_step_3: ''
  }) } });
  const first = JSON.parse(cacheEnv.ctx.doGet({ parameter: { action: 'prev_next_steps', teacher: OTP_PAYLOAD.teacher, form: 'otp' } }).getContent());
  ok(first.next_step_1 === 'First close', 'prev_next_steps reflects the just-closed lap');
  ok(Object.keys(cacheEnv.state.cache).some((k) => k.indexOf('OTP_PREV_STEPS_v1:') === 0), 'the lookup is cached under its own key prefix');

  const secondCloseRow = submitOtpRow(cacheEnv, { date: '2026-09-15' });
  cacheEnv.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'close', record_token: secondCloseRow[idx('record_token')],
    next_step_1: 'Second close', next_step_2: '', next_step_3: ''
  }) } });
  const afterSecond = JSON.parse(cacheEnv.ctx.doGet({ parameter: { action: 'prev_next_steps', teacher: OTP_PAYLOAD.teacher, form: 'otp' } }).getContent());
  ok(afterSecond.next_step_1 === 'Second close', 'closing a new lap clears the cache, so the very next lookup sees it immediately (no 60s wait)');
}

/* (n) otp-v0.9 · a stale (pre-lifecycle) OTP row still reads through GET -- */
section('(n) otp-v0.9 · a stale 34-cell OTP row still reads through the record GET, new fields blank');
{
  const idx = (c) => EXPECTED_OTP_COLUMNS.indexOf(c);
  const STALE_TOKEN = '55446677889900112233445566778899';
  const staleEnv = buildEnv(SRC_NEW, JSON.parse(JSON.stringify({
    ...ROSTER_R3,
    'OTP Submissions': [EXPECTED_OTP_COLUMNS, padRow(otpRow(STALE_TOKEN).slice(0, 34), EXPECTED_OTP_COLUMNS.length)]
  })));
  const stale = JSON.parse(staleEnv.ctx.doGet({ parameter: { token: STALE_TOKEN, form: 'otp' } }).getContent());
  ok(stale.success === true && stale.data.teacher === 'Existing OTP Teacher',
    'a pre-otp-v0.9 34-cell row still reads back under the 38-column header', JSON.stringify(stale).slice(0, 140));
  ok(stale.data.status === '' && stale.data.closed_at === '' && stale.data.lap === '' && stale.data.round === '',
    'the four new lifecycle fields read back as empty strings on a legacy row',
    JSON.stringify([stale.data.status, stale.data.closed_at, stale.data.lap, stale.data.round]));

  // a legacy row's blank status cell ('' !== 'closed') means update/close still
  // treat it as open, not refuse it as "already closed".
  const updated = JSON.parse(staleEnv.ctx.doPost({ postData: { contents: JSON.stringify({
    form: 'otp', action: 'update', record_token: STALE_TOKEN, observer_comments: 'Now on the new schema.'
  }) } }).getContent());
  ok(updated.success === true && updated.status === 'observed', 'a legacy (blank-status) row can be updated; it is treated as open, not closed',
    JSON.stringify(updated));
}

section('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
