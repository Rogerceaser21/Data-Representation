#!/usr/bin/env node
/** Focused Apps Script proof for otp-v0.11 email stamps and R7. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const GS = path.join(REPO, 'Assets', 'R3', 'apps-script');
const TOKEN_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TOKEN_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ROUND = 'OTP Term 1 26-27';
const OLD_ROUND = 'OTP Term 3 25-26';
const results = [];

function response(code, body) {
  return { getResponseCode: () => code, getContentText: () => body };
}

function makeSheet(name) {
  const sheet = {
    name, _data: [],
    getLastRow() { return this._data.length; },
    getLastColumn() { return this._data.reduce((n, row) => Math.max(n, row.length), 0); },
    getDataRange() { return range(this, 1, 1, this.getLastRow(), this.getLastColumn()); },
    getRange(r, c, nr = 1, nc = 1) { return range(this, r, c, nr, nc); },
    appendRow(values) { this._data.push(values.slice()); return this; },
    setFrozenRows() { return this; }, setColumnWidths() { return this; }
  };
  return sheet;
}

function range(sheet, r, c, nr, nc) {
  const out = {
    setValues(values) {
      for (let i = 0; i < nr; i += 1) {
        const ri = r - 1 + i;
        while (sheet._data.length <= ri) sheet._data.push([]);
        const row = sheet._data[ri];
        for (let j = 0; j < nc; j += 1) {
          const ci = c - 1 + j;
          while (row.length <= ci) row.push('');
          row[ci] = values[i][j];
        }
      }
      return out;
    },
    getValues() {
      return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
        const row = sheet._data[r - 1 + i] || [];
        return row[c - 1 + j] === undefined ? '' : row[c - 1 + j];
      }));
    },
    setFontWeight() { return out; }, setBackground() { return out; }, setFontColor() { return out; }
  };
  return out;
}

function makeEnv(options = {}) {
  const state = {
    props: { SHEET_ID: 'stub-sheet', SUPABASE_SECRET_KEY: 'stub-secret', ...(options.props || {}) },
    fetches: [], mail: [], logs: [], cache: {}, lockAcquires: 0, ingestCode: options.ingestCode || 200,
    roundFailure: !!options.roundFailure,
    coachEmail: options.coachEmail === undefined ? 'coach@example.test' : options.coachEmail,
    teacherEmail: options.teacherEmail === undefined ? 'teacher@example.test' : options.teacherEmail
  };
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) { const s = makeSheet(name); sheets.set(name, s); return s; },
    getSpreadsheetTimeZone() { return 'UTC'; }
  };
  const lock = { waitLock() {}, releaseLock() {} };
  class FixedDate extends Date {
    constructor(value) { super(value === undefined ? '2026-09-18T10:11:12.345Z' : value); }
    static now() { return Date.parse('2026-09-18T10:11:12.345Z'); }
  }
  const context = {
    console, JSON, Math, RegExp, String, Number, Boolean, Object, Array, Error, Date: FixedDate,
    encodeURIComponent, decodeURIComponent, parseInt, isNaN,
    SpreadsheetApp: { openById() { return spreadsheet; } },
    PropertiesService: { getScriptProperties() { return {
      getProperty(k) { return Object.hasOwn(state.props, k) ? state.props[k] : null; },
      setProperty(k, v) { state.props[k] = v; return this; }
    }; } },
    LockService: { getScriptLock() { state.lockAcquires += 1; return lock; } },
    CacheService: { getScriptCache() { return {
      get(k) { return state.cache[k] || null; }, put(k, v) { state.cache[k] = v; }, remove(k) { delete state.cache[k]; }
    }; } },
    UrlFetchApp: { fetch(url, opts = {}) {
      state.fetches.push({ url, payload: opts.payload || '' });
      if (url.includes('get_current_round_otp')) return state.roundFailure ? response(500, 'failure') : response(200, JSON.stringify(ROUND));
      if (url.includes('otp_record_for_mirror')) return response(200, JSON.stringify({ found: false }));
      if (url.includes('ingest_otp')) return response(state.ingestCode, state.ingestCode === 200 ? JSON.stringify({ success: true }) : 'failure');
      if (url.includes('stamp_otp_emailed')) return response(200, JSON.stringify({ success: true, stamped: 1 }));
      return response(200, '{}');
    } },
    MailApp: { sendEmail(opts) { state.mail.push({ ...opts }); } },
    GmailApp: { sendEmail() {} },
    Logger: { log(message) { state.logs.push(String(message)); } },
    Utilities: {
      getUuid() { return '12345678-1234-1234-1234-123456789abc'; },
      formatDate(d, tz, format) {
        const x = new Date(d).toISOString();
        if (format === 'yyyyMMdd-HHmmss') return x.slice(0, 10).replaceAll('-', '') + '-' + x.slice(11, 19).replaceAll(':', '');
        return x;
      }
    },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput(text) {
      return { _text: text, setMimeType() { return this; }, getContent() { return this._text; } };
    } },
    Session: { getScriptTimeZone() { return 'UTC'; } }
  };
  vm.createContext(context);
  for (const file of ['00_Config.gs', '01_doPost.gs', '02_doGet.gs', '03_helpers.gs', '05_Supabase.gs', '08_OtpMirror.gs', '09_OtpReflect.gs']) {
    vm.runInContext(fs.readFileSync(path.join(GS, file), 'utf8'), context, { filename: file });
  }
  context.lookupOtpObserverEmail = () => state.coachEmail;
  context.lookupOtpTeacherEmail = () => state.teacherEmail;
  context.fetchPadImages = () => [];
  return { context, state, spreadsheet, sheet() { return context.getOtpSheetWithHeader_(spreadsheet); } };
}

function payload(extra = {}) {
  return {
    form: 'otp', teacher: 'Teacher One', inspector: 'Coach One', date: '2026-09-18',
    subject: 'Maths', grade: '9', time_in: '09:00', time_out: '10:00', ...extra
  };
}

function mirrorRecord(token, extra = {}) {
  return {
    record_id: 'AIS-OTP-20260918-101112', submitted_at: '2026-09-18T10:11:12.345Z',
    record_token: token, teacher: 'Teacher One', observer: 'Coach One', observation_date: '2026-09-18',
    status: 'observed', lap: 1, round: ROUND, ...extra
  };
}

function appendRecord(sheet, record) {
  const headers = sheet._data[0];
  sheet.appendRow(headers.map((header) => record[header] == null ? '' : record[header]));
}

function output(value) { return JSON.parse(value.getContent()); }
function stampCalls(state) { return state.fetches.filter((f) => f.url.includes('stamp_otp_emailed')); }
function check(name, fn) { fn(); results.push(name); }

check('a mirror append stamps coach and teacher and calls the stamp RPC once', () => {
  const env = makeEnv(); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, mirrorRecord(TOKEN_A));
  const headers = sheet._data[0]; const row = sheet._data[1]; const calls = stampCalls(env.state);
  assert.match(row[headers.indexOf('coach_emailed_at')], /^2026-09-18T10:11:12\.345Z$/);
  assert.match(row[headers.indexOf('teacher_emailed_at')], /^2026-09-18T10:11:12\.345Z$/);
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].payload);
  assert.match(body.p_coach_at, /^2026-/); assert.match(body.p_teacher_at, /^2026-/);
});

check('b no coach roster email leaves coach stamp blank while backup remains mailed', () => {
  const env = makeEnv({ coachEmail: '' }); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, mirrorRecord(TOKEN_A));
  const headers = sheet._data[0]; const row = sheet._data[1]; const body = JSON.parse(stampCalls(env.state)[0].payload);
  assert.equal(row[headers.indexOf('coach_emailed_at')], '');
  assert.match(row[headers.indexOf('teacher_emailed_at')], /^2026-/);
  assert.equal(env.state.mail.some((m) => m.to === 'admin.user@ais.ae'), true);
  assert.equal(body.p_coach_at, null);
});

check('c no teacher roster email leaves teacher stamp blank', () => {
  const env = makeEnv({ teacherEmail: '' }); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, mirrorRecord(TOKEN_A));
  const headers = sheet._data[0]; const row = sheet._data[1]; const body = JSON.parse(stampCalls(env.state)[0].payload);
  assert.equal(row[headers.indexOf('teacher_emailed_at')], '');
  assert.equal(body.p_teacher_at, null);
});

check('d mirror overwrite preserves a non-empty Sheet stamp when record stamps are empty', () => {
  const env = makeEnv(); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, mirrorRecord(TOKEN_A));
  const headers = sheet._data[0]; const before = sheet._data[1].slice();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, mirrorRecord(TOKEN_A, { coach_emailed_at: '', teacher_emailed_at: '', subject: 'Science' }));
  assert.equal(sheet._data[1][headers.indexOf('coach_emailed_at')], before[headers.indexOf('coach_emailed_at')]);
  assert.equal(sheet._data[1][headers.indexOf('teacher_emailed_at')], before[headers.indexOf('teacher_emailed_at')]);
});

check('e post payloads cannot set or replace server-only stamps', () => {
  const env = makeEnv(); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, mirrorRecord(TOKEN_A));
  const headers = sheet._data[0]; const c = headers.indexOf('coach_emailed_at'); const t = headers.indexOf('teacher_emailed_at');
  const before = [sheet._data[1][c], sheet._data[1][t]];
  env.context.handleOtpUpdateOrClose(env.spreadsheet, sheet, payload({ action: 'update', record_token: TOKEN_A, coach_emailed_at: 'forged', teacher_emailed_at: 'forged' }));
  assert.deepEqual([sheet._data[1][c], sheet._data[1][t]], before);
  const built = env.context.buildOtpRecord(headers, payload({ coach_emailed_at: 'forged', teacher_emailed_at: 'forged' }), 'id', TOKEN_B, 'now');
  assert.equal(built.coach_emailed_at, ''); assert.equal(built.teacher_emailed_at, '');
  const submitEnv = makeEnv({ coachEmail: '', teacherEmail: '' }); const submitSheet = submitEnv.sheet();
  submitEnv.context.handleOtpPost(payload({ coach_emailed_at: 'forged', teacher_emailed_at: 'forged' }));
  assert.equal(submitSheet._data[1][submitSheet._data[0].indexOf('coach_emailed_at')], '');
  assert.equal(submitSheet._data[1][submitSheet._data[0].indexOf('teacher_emailed_at')], '');
});

check('f fallback stamps only after successful ingest_otp', () => {
  const env = makeEnv(); env.context.handleOtpPost(payload());
  const ingest = env.state.fetches.findIndex((f) => f.url.includes('ingest_otp'));
  const stamp = env.state.fetches.findIndex((f) => f.url.includes('stamp_otp_emailed'));
  assert.ok(ingest > -1 && stamp > ingest);
  const failed = makeEnv({ ingestCode: 500 }); failed.context.handleOtpPost(payload());
  assert.equal(stampCalls(failed.state).length, 0);
});

check('g R7 blocks a different open token without a row, email, or write RPC', () => {
  const env = makeEnv({ props: { OTP_BLOCK_OPEN_REQUIRED: 'true' } }); const sheet = env.sheet();
  appendRecord(sheet, mirrorRecord(TOKEN_A, { lap: 7, record_id: 'OPEN-7' }));
  const blocked = output(env.context.handleOtpPost(payload({ record_token: 'legacy-token' })));
  assert.deepEqual(blocked, { success: false, error: 'open_observation', lap: 7, id: 'OPEN-7' });
  assert.equal(sheet.getLastRow(), 2); assert.equal(env.state.mail.length, 0);
  assert.equal(env.state.fetches.some((f) => f.url.includes('ingest_otp') || f.url.includes('stamp_otp_emailed')), false);
  const same = output(env.context.handleOtpPost(payload({ record_token: TOKEN_A, round: ROUND })));
  assert.equal(same.success, true);
  const control = makeEnv(); const controlSheet = control.sheet();
  control.context.mirrorOtpRecord_(control.spreadsheet, controlSheet, mirrorRecord(TOKEN_A));
  const made = output(control.context.handleOtpPost(payload({ record_token: TOKEN_B, round: ROUND })));
  assert.equal(made.success, true); assert.equal(controlSheet.getLastRow(), 3);
});

check('i R7 allows an old-round open row when the current round is known', () => {
  const env = makeEnv({ props: { OTP_BLOCK_OPEN_REQUIRED: 'true' } }); const sheet = env.sheet();
  appendRecord(sheet, mirrorRecord(TOKEN_A, { round: OLD_ROUND, lap: 4, record_id: 'OLD-4' }));
  const made = output(env.context.handleOtpPost(payload({ record_token: 'legacy-token' })));
  assert.equal(made.success, true); assert.equal(sheet.getLastRow(), 3); assert.equal(env.state.mail.length, 2);
});

check('j R7 uses the newest Sheet round when the current-round lookup fails', () => {
  const allowed = makeEnv({ props: { OTP_BLOCK_OPEN_REQUIRED: 'true' }, roundFailure: true }); const allowedSheet = allowed.sheet();
  appendRecord(allowedSheet, mirrorRecord(TOKEN_A, { round: OLD_ROUND, lap: 2, record_id: 'OLD-2' }));
  appendRecord(allowedSheet, mirrorRecord('cccccccccccccccccccccccccccccccc', { round: ROUND, status: 'closed', lap: 3, record_id: 'CURRENT-CLOSED' }));
  const made = output(allowed.context.handleOtpPost(payload({ record_token: 'legacy-token' })));
  assert.equal(made.success, true); assert.equal(allowedSheet.getLastRow(), 4);

  const blocked = makeEnv({ props: { OTP_BLOCK_OPEN_REQUIRED: 'true' }, roundFailure: true }); const blockedSheet = blocked.sheet();
  appendRecord(blockedSheet, mirrorRecord(TOKEN_A, { round: OLD_ROUND, lap: 2, record_id: 'OLD-2' }));
  appendRecord(blockedSheet, mirrorRecord('cccccccccccccccccccccccccccccccc', { round: ROUND, lap: 3, record_id: 'CURRENT-3' }));
  const denied = output(blocked.context.handleOtpPost(payload({ record_token: 'legacy-token' })));
  assert.deepEqual(denied, { success: false, error: 'open_observation', lap: 3, id: 'CURRENT-3' });
  assert.equal(blockedSheet.getLastRow(), 3); assert.equal(blocked.state.mail.length, 0);
});

check('k an ungated submit acquires only the original append lock', () => {
  const env = makeEnv(); env.context.handleOtpPost(payload({ record_token: 'legacy-token' }));
  assert.equal(env.state.lockAcquires, 1);
});

check('h a 38-header Sheet gains only the trailing headers (otp-v0.14: 41 columns, teacher_token last)', () => {
  const env = makeEnv(); const all = env.context.getOtpColumns();
  assert.equal(all.length, 41);
  assert.equal(all[38], 'coach_emailed_at'); assert.equal(all[39], 'teacher_emailed_at'); assert.equal(all[40], 'teacher_token');
  const legacy = env.spreadsheet.insertSheet('OTP Submissions');
  legacy._data = [all.slice(0, 38), Array.from({ length: 38 }, (_, i) => 'cell-' + (i + 1))];
  env.context.getOtpSheetWithHeader_(env.spreadsheet);
  assert.deepEqual(legacy._data[0], all);
  assert.deepEqual(legacy._data[1].slice(0, 38), Array.from({ length: 38 }, (_, i) => 'cell-' + (i + 1)));
});

console.log('gs-stamps-harness: PASS (' + results.length + '/11)');
for (const result of results) console.log('PASS ' + result);
