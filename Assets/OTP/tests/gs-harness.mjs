#!/usr/bin/env node
/**
 * otp-v0.1 · Apps Script harness for Assets/R3/apps-script/*.gs
 *
 *   node Assets/OTP/tests/gs-harness.mjs
 *
 * Loads every .gs file into a single `vm` context (one shared global scope, the
 * way Apps Script itself runs them) behind stubs for SpreadsheetApp,
 * PropertiesService, CacheService, UrlFetchApp, MailApp, Utilities, Logger and
 * ContentService, then proves four things:
 *
 *   (a) an OTP submission appends ONE 26-cell row to "OTP Submissions" in the
 *       load-bearing column order, mails the OTP subject + viewer link, and
 *       mirrors to /rest/v1/rpc/ingest_otp as { payload: {...26 keys...} };
 *   (b) the R3 paths (submit, options, token lookup, status) are byte-identical
 *       to the SAME scenarios run against the untouched files from origin/main;
 *   (c) ?action=options&form=otp reads the 26-27 roster tabs, falls back to the
 *       R3 roster tabs when they do not exist, and never collides with the R3
 *       options cache, while ?action=options (no form) is baseline-identical;
 *   (d) a ?token=&form=otp lookup resolves from the OTP tab and reports
 *       form:'otp', while the same token with no form parameter still resolves
 *       from the R3 tab exactly as baseline.
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
  'next_step_1', 'next_step_2', 'next_step_3', 'record_token', 'evidence_pad_id'
];

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
  support_teachers_cas: 'Ms Fatima (CA)',
  otp_ref: 'SP1',
  otp_aspect: 'Facilitating better than expected progress',
  sp1_beginner: '',
  sp1_emerging: '2',
  sp1_good: '1,3',
  sp1_great: '',
  sp1_outstanding: '4',
  sp1_selected_text: 'Good 1: Pupils make progress | Good 3: Tasks are matched',
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
        if (url.indexOf('/rest/v1/rpc/') > -1) return makeResponse(200, '{"ok":true}');
        if (url.indexOf('/rest/v1/app_config') > -1) return makeResponse(200, '[]');
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
    return '';
  });
}

// 2026-09-03 deploy: the live tabs were renamed 'Teachers 25-26' / 'Inspectors 25-26'
// (the current code reads those); the un-suffixed names stay seeded so the
// origin/main baseline (which still reads 'Teachers' / 'Inspectors') sees the
// same rows and the byte-identity comparison stays meaningful.
const R3_TEACHERS_ROWS = [['name'], ['R3 Teacher One'], ['R3 Teacher Two']];
const R3_INSPECTORS_ROWS = [['Inspector', 'Email'], ['Dave Richards', 'dave.richards@ais.ae'], ['Hayden Ryan', 'hayden.ryan@ais.ae']];
const ROSTER_R3 = {
  Teachers: R3_TEACHERS_ROWS,
  Inspectors: R3_INSPECTORS_ROWS,
  'Teachers 25-26': R3_TEACHERS_ROWS,
  'Inspectors 25-26': R3_INSPECTORS_ROWS,
  Curriculum: [['Curriculum'], ['Australian'], ['Ministry']],
  Subjects: [
    ['Subject', 'Yes/No', 'Kindy', 'Primary', 'Secondary'],
    ['Maths', true, true, true, true],
    ['English', true, false, true, true]
  ]
};
const ROSTER_2627 = {
  'Teachers 26-27': [['name'], ['New Year Teacher A'], ['New Year Teacher B']],
  'Inspectors 26-27': [['Inspector', 'Email'], ['Dave Richards', 'dave.richards2627@ais.ae'], ['Brooke Pickett', 'brooke.pickett@ais.ae']]
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
  }
};

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

console.log('AIS Apps Script harness · otp-v0.1');
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

  eqJson(env.ctx.getOtpColumns(), EXPECTED_OTP_COLUMNS, 'getOtpColumns() is the 26-column contract, in order');
  ok(tab.length === 2, 'OTP Submissions holds exactly one header + ONE appended row', 'rows: ' + tab.length);
  eqJson(header, EXPECTED_OTP_COLUMNS, 'header row written in the load-bearing column order');
  ok(row.length === 26, 'appended row has 26 cells', 'cells: ' + row.length);
  ok(/^AIS-OTP-\d{8}-\d{6}$/.test(row[idx('record_id')]), 'record_id is a fresh AIS-OTP-YYYYMMDD-HHMMSS id', 'got: ' + row[idx('record_id')]);
  ok(/^[0-9a-f]{32}$/.test(row[idx('record_token')]), 'record_token is 32 hex chars', 'got: ' + row[idx('record_token')]);
  ok(row[idx('observer')] === OTP_PAYLOAD.inspector, 'observer column <- payload.inspector', 'got: ' + row[idx('observer')]);
  ok(row[idx('observation_date')] === OTP_PAYLOAD.date, 'observation_date column <- payload.date', 'got: ' + row[idx('observation_date')]);
  ok(row[idx('submitted_at')] === new Date(FIXED_MS).toISOString(), 'submitted_at stamped server-side');
  const fieldsOk = ['teacher', 'curriculum', 'room_number', 'time_in', 'subject', 'school', 'support_teachers_cas',
    'otp_ref', 'otp_aspect', 'sp1_beginner', 'sp1_emerging', 'sp1_good', 'sp1_great', 'sp1_outstanding',
    'sp1_selected_text', 'observer_comments', 'other_observations', 'next_step_1', 'next_step_2', 'next_step_3',
    'evidence_pad_id'].filter((k) => row[idx(k)] !== OTP_PAYLOAD[k]);
  eqJson(fieldsOk, [], 'every posted OTP field landed in its own column');
  ok(!dump.sheets['Submissions'], 'the R3 Submissions tab was never touched by an OTP post');
  eqJson(out, { success: true, id: row[idx('record_id')] }, 'response is { success:true, id } exactly like R3');

  ok(dump.mail.length === 1, 'exactly one backup email', 'count: ' + dump.mail.length);
  const mail = dump.mail[0] || {};
  ok(mail.subject === 'AIS OTP Progress · Jo Mare Kruger · 2026-09-02', 'email subject is the OTP subject', 'got: ' + mail.subject);
  ok(mail.to === 'admin.user@ais.ae', 'email goes to the backup mailbox', 'got: ' + mail.to);
  ok(mail.cc === 'dave.richards2627@ais.ae', 'observer CC resolved over the Inspectors 26-27 tab', 'got: ' + mail.cc);
  const viewerLink = 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-record.html?token=' + row[idx('record_token')];
  ok(String(mail.htmlBody).indexOf(viewerLink) > -1, 'email body carries the OTP viewer link (token only)', 'looked for: ' + viewerLink);
  const labelsMissing = ['Observer Comments', 'Other Observations', 'Next Steps / Support 1', 'Selected criteria', 'Support teachers / CAs']
    .filter((l) => String(mail.htmlBody).indexOf(l) < 0);
  eqJson(labelsMissing, [], 'email body lists the OTP columns with readable labels');

  const ingest = dump.fetches.filter((f) => f.url.endsWith('/rest/v1/rpc/ingest_otp'));
  ok(ingest.length === 1, 'exactly one Supabase mirror call, to /rest/v1/rpc/ingest_otp', 'urls: ' + JSON.stringify(dump.fetches.map((f) => f.url)));
  const body = JSON.parse((ingest[0] || {}).payload || '{}');
  eqJson(Object.keys(body), ['payload'], 'mirror body is { payload: ... }');
  eqJson(Object.keys(body.payload || {}), EXPECTED_OTP_COLUMNS, 'mirror payload carries the 26 columns, in order');
  eqJson(EXPECTED_OTP_COLUMNS.map((c) => body.payload[c]), row, 'mirror payload is a field-for-field copy of the Sheet row');
  ok((ingest[0] || {}).headers.apikey === SECRET, 'mirror authenticates with the service_role key from Script Properties');
  ok(dump.fetches.every((f) => f.url.indexOf('/rest/v1/rpc/ingest_r3') < 0), 'the R3 ingest RPC was never called for an OTP post');
}

/* (b) R3 parity ------------------------------------------------------------ */
section('(b) R3 paths byte-identical to origin/main baseline');
Object.keys(SCENARIOS).forEach((name) => {
  const a = JSON.stringify(runScenario(SRC_NEW, name));
  const b = JSON.stringify(runScenario(SRC_BASE, name));
  ok(a === b, 'scenario ' + name + ' identical (sheet rows + mail + fetches + logs + cache + response)',
    a === b ? '' : 'baseline: ' + b + '\n        current:  ' + a);
});

/* (c) options ------------------------------------------------------------- */
section('(c) ?action=options&form=otp roster tabs + cache isolation');
{
  const withNew = buildEnv(SRC_NEW, seedFull());
  const o1 = JSON.parse(withNew.ctx.doGet({ parameter: { action: 'options', form: 'otp' } }).getContent());
  eqJson(o1.options.teachers.map((t) => t.name), ['New Year Teacher A', 'New Year Teacher B'], 'teachers read from Teachers 26-27 when it exists');
  eqJson(o1.options.inspectors, ['Dave Richards', 'Brooke Pickett'], 'inspectors read from Inspectors 26-27 when it exists');
  eqJson(o1.options.curricula, ['Australian', 'Ministry'], 'curricula unchanged');
  eqJson(o1.options.subjects.map((s) => s.name), ['Maths', 'English'], 'subjects unchanged');
  eqJson(o1.options.schools, ['Kindy', 'Primary', 'Secondary'], 'schools unchanged');

  const noNew = buildEnv(SRC_NEW, seedR3Only());
  const o2 = JSON.parse(noNew.ctx.doGet({ parameter: { action: 'options', form: 'otp' } }).getContent());
  eqJson(o2.options.teachers.map((t) => t.name), ['R3 Teacher One', 'R3 Teacher Two'], 'teachers fall back to Teachers when 26-27 does not exist');
  eqJson(o2.options.inspectors, ['Dave Richards', 'Hayden Ryan'], 'inspectors fall back to Inspectors when 26-27 does not exist');

  const both = buildEnv(SRC_NEW, seedFull());
  both.ctx.doGet({ parameter: { action: 'options', form: 'otp' } });
  eqJson(Object.keys(both.state.cache), ['OTP_OPTIONS_v1'], 'the OTP options cache key is its own; the R3 key is untouched');
  both.ctx.doGet({ parameter: { action: 'options' } });
  eqJson(Object.keys(both.state.cache).sort(), ['OTP_OPTIONS_v1', 'R3_OPTIONS_v1'], 'both forms cache under separate keys, never colliding');
  const otpCached = JSON.parse(both.state.cache.OTP_OPTIONS_v1);
  const r3Cached = JSON.parse(both.state.cache.R3_OPTIONS_v1);
  ok(JSON.stringify(otpCached.teachers) !== JSON.stringify(r3Cached.teachers), 'the two cached option sets really do differ (no cross-read)');
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

section('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
