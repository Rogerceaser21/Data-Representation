#!/usr/bin/env node
/**
 * otp-v0.14 T4 · Apps Script proof for the Teacher Reflection + Plan flow
 * (contract section 4, ~/Developer/claudex-runs/otp-v0.14/CONTRACT.md), in
 * the same compact mocking style as gs-stamps-harness.mjs.
 *
 *   node Assets/OTP/tests/gs-reflect-harness.mjs
 *
 * Covers: a record WITHOUT a teacher_token behaves byte-identically to
 * otp-v0.13 (proven both by substring checks AND by a real dump-for-dump
 * comparison against the otp-v0.13 (origin/main) sources themselves, same
 * technique as gs-harness.mjs section (b)); E1 (submit invite), E2
 * (thank-you, incl. that its button really targets links.view), E3 (close +
 * plan invite, with and without Part 1 sent) and E4 (coach copy) content,
 * incl. that no teacher-facing email ever prints the record_token; the "OTP
 * Reflections" tab row write + update (no duplicate on a second mirror of
 * the same part); email stamps written to the tab and via
 * mark_reflection_mirrored; the heal sweep (otp_reflections_unmirrored); a
 * concurrent-mirror race under the script lock (no double-send); teacher_token
 * is LOCKED against a client-posted submit/update/close value; and a
 * brand-image fetch failure never blocks the send.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const GS = path.join(REPO, 'Assets', 'R3', 'apps-script');
const TOKEN_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';      // record_token
const TEACHER_TOKEN_A = 'dddddddddddddddddddddddddddddd1';  // teacher_token
const results = [];

// otp-v0.14 T4 · the exact files this harness loads (see makeEnv below); also
// used to build the otp-v0.13 baseline bundle for the byte-identical legacy
// comparison (section a').
const GS_REFLECT_FILES = ['00_Config.gs', '01_doPost.gs', '03_helpers.gs', '05_Supabase.gs', '08_OtpMirror.gs', '09_OtpReflect.gs'];

/**
 * The otp-v0.13 (origin/main) source of each file in GS_REFLECT_FILES, keyed
 * by filename. 09_OtpReflect.gs has no origin/main counterpart (it did not
 * exist at otp-v0.13), so it loads as an empty file, same as gs-harness.mjs's
 * baseline bundle: it contributes nothing, which is exactly what it did
 * before this branch existed, and every legacy call path in this harness
 * (sendOtpTeacherEmail, sendOtpCloseEmail, mirrorOtpRecord_) never reaches it.
 */
function readBaselineSources() {
  const out = {};
  for (const file of GS_REFLECT_FILES) {
    try {
      out[file] = execSync('git show origin/main:Assets/R3/apps-script/' + file, { cwd: REPO, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch (e) {
      out[file] = '';
    }
  }
  return out;
}
const BASE_SOURCES = readBaselineSources();

function response(code, body, isBlob) {
  const out = { getResponseCode: () => code, getContentText: () => body };
  if (isBlob) out.getBlob = () => ({ __blob: true, bytes: String(body || '').length });
  return out;
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

// reflectionForMirror's default links (below); pulled out so the E2 tests can
// assert the thank-you button really targets links.view, not links.reflect.
const MIRROR_REFLECT_LINK = 'https://example.test/otp-reflect.html';
const MIRROR_VIEW_LINK = 'https://example.test/otp-record.html';

/** { found, record, reflections, links } as otp_reflection_for_mirror would answer. */
function reflectionForMirror(record, reflections, links) {
  return {
    found: true,
    record,
    reflections: reflections || [],
    links: links || { reflect: MIRROR_REFLECT_LINK, view: MIRROR_VIEW_LINK }
  };
}

/** Asserts an E2 mail's "Click here to view." button targets links.view + ?t=<teacher_token>, never links.reflect. */
function assertE2ViewButton(mail) {
  const viewHref = 'href="' + MIRROR_VIEW_LINK + '?t=' + TEACHER_TOKEN_A + '"';
  const reflectHref = 'href="' + MIRROR_REFLECT_LINK + '?t=' + TEACHER_TOKEN_A + '"';
  assert.ok(mail.htmlBody.includes(viewHref), 'E2 button targets links.view + ?t=<teacher_token>: looked for ' + viewHref);
  assert.ok(!mail.htmlBody.includes(reflectHref), 'E2 button never points at links.reflect');
}

function baseRecord(extra) {
  return {
    record_id: 'AIS-OTP-20260918-101112', record_token: TOKEN_A, teacher_token: TEACHER_TOKEN_A,
    teacher: 'Jo Mare Kruger', observer: 'Dave Richards', observation_date: '2026-09-18',
    subject: 'Maths', grade: '9', status: 'observed', lap: 1, closed_at: '',
    next_step_1: '', next_step_2: '', next_step_3: '',
    // mirrorOtpTokenFromSupabase_ attaches this from otp_record_for_mirror's
    // own links before calling mirrorOtpRecord_ (08_OtpMirror.gs); tests that
    // call mirrorOtpRecord_/sendOtp*Email directly supply the same shape so
    // they exercise the real mirror path without a live otp_record_for_mirror
    // fetch (b3/b4 below delete this to prove the live fallback instead).
    _links: { reflect: 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-reflect.html', view: 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-record.html' },
    ...extra
  };
}

function makeEnv(options = {}) {
  const state = {
    props: { SHEET_ID: 'stub-sheet', SUPABASE_SECRET_KEY: 'stub-secret', ...(options.props || {}) },
    fetches: [], mail: [], logs: [], cache: {}, lockAcquires: 0,
    coachEmail: options.coachEmail === undefined ? 'coach@example.test' : options.coachEmail,
    teacherEmail: options.teacherEmail === undefined ? 'teacher@example.test' : options.teacherEmail,
    forMirror: options.forMirror,                 // { found:false } or reflectionForMirror(...) result, for otp_reflection_for_mirror
    recordForMirror: options.recordForMirror,     // otp_record_for_mirror result, for otpLinksFor_'s live fallback
    reflectState: options.reflectState === undefined ? { found: true, view_unlocked: false } : options.reflectState,
    unmirrored: options.unmirrored || [],
    imagesFail: !!options.imagesFail,
    markCode: options.markCode || 200
  };
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) { const s = makeSheet(name); sheets.set(name, s); return s; },
    getSpreadsheetTimeZone() { return 'UTC'; }
  };
  const lock = { waitLock() { state.lockAcquires += 1; }, releaseLock() {} };
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
    LockService: { getScriptLock() { return lock; } },
    CacheService: { getScriptCache() { return {
      get(k) { return state.cache[k] || null; }, put(k, v) { state.cache[k] = v; }, remove(k) { delete state.cache[k]; }
    }; } },
    UrlFetchApp: { fetch(url, opts = {}) {
      state.fetches.push({ url, payload: opts.payload || '' });
      if (url.includes('otp_reflection_for_mirror')) {
        return response(200, JSON.stringify(state.forMirror || { found: false }));
      }
      if (url.includes('mark_reflection_mirrored')) {
        return response(state.markCode, state.markCode === 200 ? JSON.stringify({ marked: 1 }) : 'failure');
      }
      if (url.includes('otp_reflections_unmirrored')) {
        return response(200, JSON.stringify(state.unmirrored));
      }
      if (url.includes('otp_reflect_state')) {
        return response(200, JSON.stringify(state.reflectState));
      }
      if (url.includes('otp_record_for_mirror')) {
        return response(200, JSON.stringify(state.recordForMirror || { found: false }));
      }
      if (url.includes('get_current_round_otp')) return response(200, JSON.stringify('OTP Term 1 26-27'));
      if (url.includes('ingest_otp')) return response(200, JSON.stringify({ success: true }));
      if (url.includes('stamp_otp_emailed')) return response(200, JSON.stringify({ success: true, stamped: 1 }));
      if (url.includes('ais_header_framed.png') || url.includes('Secondary.png')) {
        return state.imagesFail ? response(404, 'not found') : response(200, 'PNGBYTES', true);
      }
      return response(200, '{}');
    } },
    MailApp: { sendEmail(opts) { state.mail.push({ ...opts }); } },
    GmailApp: { sendEmail() {} },
    Logger: { log(message) { state.logs.push(String(message)); } },
    Utilities: {
      getUuid() { return '12345678-1234-1234-1234-123456789abc'; },
      formatDate(d, tz, format) {
        const dt = new Date(d);
        if (isNaN(dt)) return String(d);
        const x = dt.toISOString();
        if (format === 'yyyyMMdd-HHmmss') return x.slice(0, 10).replaceAll('-', '') + '-' + x.slice(11, 19).replaceAll(':', '');
        return 'Fri, 18 Sep 2026 · 10:11';   // stand-in for formatStampSafe's EEE, d MMM yyyy · HH:mm
      }
    },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput(text) {
      return { _text: text, setMimeType() { return this; }, getContent() { return this._text; } };
    } },
    Session: { getScriptTimeZone() { return 'UTC'; } }
  };
  vm.createContext(context);
  // sources (optional): a { filename: code } map overriding the disk read,
  // used by the byte-identical baseline comparison below (section a') to run
  // the SAME scenario against the otp-v0.13 sources instead of the current
  // working tree.
  for (const file of GS_REFLECT_FILES) {
    const code = options.sources ? (options.sources[file] || '') : fs.readFileSync(path.join(GS, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  }
  context.lookupOtpObserverEmail = () => state.coachEmail;
  context.lookupOtpTeacherEmail = () => state.teacherEmail;
  context.fetchPadImages = () => [];
  return { context, state, spreadsheet, sheet() { return context.getOtpSheetWithHeader_(spreadsheet); } };
}

function output(value) { return JSON.parse(value.getContent()); }
// A function called DIRECTLY on env.context (not through doPost/jsonOut) returns
// an object built inside the vm realm; deepEqual against an outer-realm literal
// fails on prototype identity alone even when every value matches. Round-trip
// through JSON (both ends run in THIS module's own realm) to compare plainly.
function toPlain(v) { return JSON.parse(JSON.stringify(v)); }
function check(name, fn) { fn(); results.push(name); }
function mailTo(state, addr) { return state.mail.find((m) => m.to === addr); }

/* ── (a) legacy: a record with NO teacher_token is byte-identical to otp-v0.13 ── */

check('a1 sendOtpTeacherEmail legacy body/subject/link unchanged when teacher_token is blank', () => {
  const env = makeEnv();
  const data = { teacher: 'Jo Mare Kruger', inspector: 'Dave Richards', date: '2026-09-18', lap: 1, teacher_token: '' };
  const sent = env.context.sendOtpTeacherEmail(env.spreadsheet, 'AIS-OTP-20260918-101112', TOKEN_A, '2026-09-18T10:11:12.345Z', data);
  assert.equal(sent, true);
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.equal(mail.subject, 'AIS OTP Observation 1 · 2026-09-18');
  assert.ok(mail.htmlBody.includes('otp-record.html?token=' + TOKEN_A));
  assert.ok(!mail.htmlBody.includes('cid:ais_header'), 'legacy body never uses the canonical template');
  assert.equal(mail.inlineImages, undefined);
});

check('a2 sendOtpCloseEmail legacy body/CC/subject unchanged when teacher_token is blank', () => {
  const env = makeEnv();
  const record = { teacher: 'Jo Mare Kruger', observer: 'Dave Richards', observation_date: '2026-09-18', lap: 1,
    record_token: TOKEN_A, teacher_token: '', closed_at: '2026-09-18T10:11:12.345Z',
    next_step_1: 'Step one', next_step_2: 'Step two', next_step_3: 'Step three' };
  env.context.sendOtpCloseEmail(env.spreadsheet, record);
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail, 'legacy close email sent');
  assert.equal(mail.subject, 'AIS OTP Observation 1 · Jo Mare Kruger · 2026-09-18');
  assert.ok(mail.htmlBody.includes('otp-record.html?token=' + TOKEN_A));
  assert.ok(mail.htmlBody.includes('1. Step one'));
  assert.ok(!mail.htmlBody.includes('cid:ais_header'));
  assert.equal(mail.cc, 'coach@example.test,admin.user@ais.ae');
});

check('a3 mirrorOtpRecord_ on a no-token record sends the legacy teacher email, not E1', () => {
  const env = makeEnv(); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, baseRecord({ teacher_token: '' }));
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail && !mail.htmlBody.includes('cid:ais_header'));
});

/* ── (a') the same legacy calls, dumped and compared BYTE FOR BYTE against
 * the real otp-v0.13 (origin/main) sources, not just substring checks. This
 * is what actually proves "byte-identical" per the contract: a1-a3 above
 * only assert a few chosen fragments stayed put, so a change elsewhere in the
 * body (e.g. a wording tweak, a missing line) would pass them silently but
 * fails here. ────────────────────────────────────────────────────────────── */

/** mail array after mirrorOtpRecord_ appends a fresh no-token record (the full submit-time flow: backup + teacher email + stamps). */
function legacySubmitDump(sources) {
  const env = makeEnv({ sources });
  const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, baseRecord({ teacher_token: '' }));
  return env.state.mail;
}
/** mail array after sendOtpTeacherEmail's legacy (no-token) copy. */
function legacyTeacherDump(sources) {
  const env = makeEnv({ sources });
  const data = { teacher: 'Jo Mare Kruger', inspector: 'Dave Richards', date: '2026-09-18', lap: 1, teacher_token: '' };
  env.context.sendOtpTeacherEmail(env.spreadsheet, 'AIS-OTP-20260918-101112', TOKEN_A, '2026-09-18T10:11:12.345Z', data);
  return env.state.mail;
}
/** mail array after sendOtpCloseEmail's legacy (no-token) copy. */
function legacyCloseDump(sources) {
  const env = makeEnv({ sources });
  const record = { teacher: 'Jo Mare Kruger', observer: 'Dave Richards', observation_date: '2026-09-18', lap: 1,
    record_token: TOKEN_A, teacher_token: '', closed_at: '2026-09-18T10:11:12.345Z',
    next_step_1: 'Step one', next_step_2: 'Step two', next_step_3: 'Step three' };
  env.context.sendOtpCloseEmail(env.spreadsheet, record);
  return env.state.mail;
}

check("a4 legacy submit (backup + teacher email) is byte-identical to otp-v0.13's own sources", () => {
  const cur = JSON.stringify(legacySubmitDump(undefined));
  const base = JSON.stringify(legacySubmitDump(BASE_SOURCES));
  assert.ok(cur.length > 20, 'the current run really produced mail (not a vacuous empty-vs-empty pass)');
  assert.equal(cur, base);
});

check("a5 legacy sendOtpTeacherEmail is byte-identical to otp-v0.13's own sources", () => {
  const cur = JSON.stringify(legacyTeacherDump(undefined));
  const base = JSON.stringify(legacyTeacherDump(BASE_SOURCES));
  assert.ok(cur.length > 20, 'the current run really produced mail (not a vacuous empty-vs-empty pass)');
  assert.equal(cur, base);
});

check("a6 legacy sendOtpCloseEmail is byte-identical to otp-v0.13's own sources", () => {
  const cur = JSON.stringify(legacyCloseDump(undefined));
  const base = JSON.stringify(legacyCloseDump(BASE_SOURCES));
  assert.ok(cur.length > 20, 'the current run really produced mail (not a vacuous empty-vs-empty pass)');
  assert.equal(cur, base);
});

/* ── (b) E1 · the submit-time invite ─────────────────────────────────────── */

check('b1 E1: heading, subject, three questions, reflect button, no view link or token text', () => {
  const env = makeEnv(); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, baseRecord());
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail, 'E1 sent');
  assert.equal(mail.subject, 'AIS OTP Observation 1 · 2026-09-18');
  assert.ok(mail.htmlBody.includes('Reflect on your lesson'));
  assert.ok(mail.htmlBody.includes('How did the lesson go? What worked, and what did not?'));
  assert.ok(mail.htmlBody.includes('Where was student progress?'));
  assert.ok(mail.htmlBody.includes('Is there anything your coach should know before you meet?'));
  assert.ok(mail.htmlBody.includes('otp-reflect.html?t=' + TEACHER_TOKEN_A));
  assert.ok(!mail.htmlBody.includes('otp-record.html'), 'E1 carries no view link');
  assert.ok(!mail.htmlBody.includes(TOKEN_A), 'E1 never prints the record_token');
  assert.equal(mail.name, 'AIS OTP Progress');
});

check('b2 E1 uses the canonical template (cid images) and sends inlineImages', () => {
  const env = makeEnv(); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, baseRecord());
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail.htmlBody.includes('cid:ais_header') && mail.htmlBody.includes('cid:ais_signature'));
  assert.ok(mail.inlineImages && mail.inlineImages.ais_header && mail.inlineImages.ais_signature);
});

check('b3 E1 falls back to a live otp_record_for_mirror read when _links is missing', () => {
  const env = makeEnv({ recordForMirror: { found: true, record: {}, links: { reflect: 'https://x.test/reflect.html', view: 'https://x.test/view.html' } } });
  const data = baseRecord();
  delete data._links;
  const sent = env.context.sendOtpReflectInviteEmail_(env.spreadsheet, 'teacher@example.test', TEACHER_TOKEN_A, data);
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail.htmlBody.includes('https://x.test/reflect.html?t=' + TEACHER_TOKEN_A));
});

check('b4 E1 is silent (no send, no throw) when links cannot be resolved at all', () => {
  const env = makeEnv({ recordForMirror: { found: false } });
  const data = baseRecord(); delete data._links;
  env.context.sendOtpReflectInviteEmail_(env.spreadsheet, 'teacher@example.test', TEACHER_TOKEN_A, data);
  assert.equal(env.state.mail.length, 0);
});

/* ── (c) E3 · close-time Next Steps + plan invite ────────────────────────── */

check('c1 E3 (Part 1 not sent yet): Next Steps, plan button, no view link, "opens once you send" line', () => {
  const env = makeEnv({ reflectState: { found: true, view_unlocked: false } }); const sheet = env.sheet();
  const record = baseRecord({ status: 'closed', closed_at: '2026-09-18T10:11:12.345Z',
    next_step_1: 'Plan a stretch task', next_step_2: 'Share success criteria', next_step_3: 'Cold-call more' });
  env.context.sendOtpCloseEmail(env.spreadsheet, record);
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail, 'E3 sent');
  assert.equal(mail.subject, 'AIS OTP Observation 1 · Jo Mare Kruger · 2026-09-18');
  assert.ok(mail.htmlBody.includes('Plan your next steps'));
  assert.ok(mail.htmlBody.includes('otp-reflect.html?t=' + TEACHER_TOKEN_A) || mail.htmlBody.includes('reflect.html?t=' + TEACHER_TOKEN_A));
  assert.ok(mail.htmlBody.includes('1'));
  assert.ok(mail.htmlBody.includes('Plan a stretch task'));
  assert.ok(mail.htmlBody.includes('Share success criteria'));
  assert.ok(mail.htmlBody.includes('Cold-call more'));
  assert.ok(mail.htmlBody.includes('Your observation opens once you send your answers'));
  assert.ok(!mail.htmlBody.includes('otp-record.html') && !mail.htmlBody.includes('view.html'), 'no view link before Part 1');
  assert.ok(!mail.htmlBody.includes(TOKEN_A), 'E3 never prints the record_token');
  assert.equal(mail.cc, 'coach@example.test,admin.user@ais.ae');
});

check('c2 E3 (Part 1 already sent): carries "Your observation:" + a view link', () => {
  const env = makeEnv({ reflectState: { found: true, view_unlocked: true } });
  const record = baseRecord({ status: 'closed', closed_at: '2026-09-18T10:11:12.345Z',
    next_step_1: 'A', next_step_2: 'B', next_step_3: 'C' });
  env.context.sendOtpCloseEmail(env.spreadsheet, record);
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail.htmlBody.includes('Your observation:'));
  assert.ok(mail.htmlBody.includes('otp-record.html?t=' + TEACHER_TOKEN_A) || mail.htmlBody.includes('view.html?t=' + TEACHER_TOKEN_A));
  assert.ok(!mail.htmlBody.includes('opens once you send'));
});

check('c3 a state-fetch failure (500) is treated as Part 1 not sent, no broken link', () => {
  const env = makeEnv({ reflectState: null }); // simulate fetchOtpReflectState_ HTTP failure path
  env.context.UrlFetchApp = env.context.UrlFetchApp; // no-op; state.reflectState null -> mock still 200s with 'null'
  env.state.reflectState = null;
  const record = baseRecord({ status: 'closed', closed_at: '2026-09-18T10:11:12.345Z', next_step_1: 'A', next_step_2: 'B', next_step_3: 'C' });
  env.context.sendOtpCloseEmail(env.spreadsheet, record);
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail.htmlBody.includes('Your observation opens once you send your answers'));
});

/* ── (d) reflect_mirror: tab row, E2, E4, stamps, no duplicates ─────────── */

function part1(overrides) {
  return { part: 1, submitted_at: '2026-09-18T09:00:00.000Z', mirrored_at: null,
    answers: { q1: 'Went well', q2_level: 'Good', q2_comment: 'Nice pace', q3: 'Nothing extra' }, ...overrides };
}
function part2(overrides) {
  return { part: 2, submitted_at: '2026-09-18T11:00:00.000Z', mirrored_at: null,
    answers: { q4: 'Time', q5: 'Pair work', q6: 'Next week', q7: 'A TA', q8: 'Faster starts by half term' }, ...overrides };
}

check('d1 Part 1 alone: doPost route mirrors one row, sends E2 (Part 1 wording) + E4 (Reflection received), marks the part', () => {
  const record = baseRecord();
  const env = makeEnv({ forMirror: reflectionForMirror(record, [part1()]) });
  const out = output(env.context.doPost({ postData: { contents: JSON.stringify({ form: 'otp', action: 'reflect_mirror', record_token: TOKEN_A }) } }));
  assert.deepEqual(out, { success: true, mirrored: 1, parts: [1] });

  const sheet = env.spreadsheet.getSheetByName('OTP Reflections');
  assert.ok(sheet, 'OTP Reflections tab created');
  assert.equal(sheet._data.length, 2, 'header + one row');
  const headers = sheet._data[0];
  assert.deepEqual(headers, ['record_id', 'lap', 'teacher', 'observer', 'part', 'submitted_at', 'q1', 'q2_level', 'q2_comment', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'teacher_emailed_at', 'coach_emailed_at']);
  const row = sheet._data[1];
  assert.equal(row[headers.indexOf('record_id')], record.record_id);
  assert.equal(row[headers.indexOf('part')], 1);
  assert.equal(row[headers.indexOf('q1')], 'Went well');
  assert.equal(row[headers.indexOf('q4')], '', 'Part 1 row carries no Part 2 answers');
  assert.match(row[headers.indexOf('teacher_emailed_at')], /^2026-/);
  assert.match(row[headers.indexOf('coach_emailed_at')], /^2026-/);

  const teacherMail = mailTo(env.state, 'teacher@example.test');
  assert.ok(teacherMail.htmlBody.includes('Thank you for sending your reflection. Your observation is now open for you.'));
  assert.ok(teacherMail.htmlBody.includes('will arrange a time to go through it with you and agree your next steps together.'));
  assert.ok(!teacherMail.htmlBody.includes(TOKEN_A), 'E2 never prints the record_token');
  assertE2ViewButton(teacherMail);

  const coachMail = mailTo(env.state, 'coach@example.test');
  assert.ok(coachMail.subject.includes('Reflection received'));
  assert.ok(coachMail.htmlBody.includes('How did the lesson go? What worked, and what did not?'));
  assert.ok(coachMail.htmlBody.includes('Level: Good. Comment: Nice pace'));
  assert.ok(!coachMail.htmlBody.includes('What challenges do you expect?'), 'Part 2 questions absent from a Part-1-only E4');
  assert.ok(coachMail.htmlBody.includes('token=' + TOKEN_A), 'E4 carries the coach-only record_token link');

  const markCalls = env.state.fetches.filter((f) => f.url.includes('mark_reflection_mirrored'));
  assert.equal(markCalls.length, 1);
  const body = JSON.parse(markCalls[0].payload);
  assert.equal(body.p_part, 1); assert.match(body.p_teacher_at, /^2026-/); assert.match(body.p_coach_at, /^2026-/);
});

check('d2 Part 2 alone owed (Part 1 already mirrored): E2 uses Part 2 wording, E4 says "Plan received"', () => {
  const record = baseRecord({ status: 'closed', closed_at: '2026-09-18T12:00:00.000Z' });
  const env = makeEnv({ forMirror: reflectionForMirror(record, [part1({ mirrored_at: '2026-09-18T09:05:00.000Z' }), part2()]) });
  env.context.handleOtpReflectMirror({ record_token: TOKEN_A });
  const teacherMail = mailTo(env.state, 'teacher@example.test');
  assert.ok(teacherMail.htmlBody.includes('Thank you for sending your plan. Here is your observation.'));
  assert.ok(!teacherMail.htmlBody.includes('will arrange a time to go through it'));
  assertE2ViewButton(teacherMail);
  const coachMail = mailTo(env.state, 'coach@example.test');
  assert.ok(coachMail.subject.includes('Plan received'));
  assert.ok(coachMail.htmlBody.includes('What challenges do you expect?'));
  assert.ok(!coachMail.htmlBody.includes('How did the lesson go?'), 'Part 1 questions absent from a Part-2-only E4');

  const sheet = env.spreadsheet.getSheetByName('OTP Reflections');
  assert.equal(sheet._data.length, 2, 'the already-mirrored Part 1 is never re-written');
  const markCalls = env.state.fetches.filter((f) => f.url.includes('mark_reflection_mirrored'));
  assert.equal(markCalls.length, 1);
  assert.equal(JSON.parse(markCalls[0].payload).p_part, 2);
});

check('d3 both parts land together (Close Lap handed over Part 1 + Part 2 unsent): ONE E2, ONE E4, both rows, "and plan" subject', () => {
  const record = baseRecord({ status: 'closed', closed_at: '2026-09-18T12:00:00.000Z' });
  const env = makeEnv({ forMirror: reflectionForMirror(record, [part1(), part2()]) });
  const out = env.context.mirrorOtpReflectionsFromSupabase_(TOKEN_A);
  assert.equal(out.mirrored, 2); assert.deepEqual(toPlain(out.parts).sort(), [1, 2]);

  const teacherMails = env.state.mail.filter((m) => m.to === 'teacher@example.test');
  assert.equal(teacherMails.length, 1, 'exactly one E2 covering both parts');
  assert.ok(teacherMails[0].htmlBody.includes('Thank you for sending your plan. Here is your observation.'));
  assertE2ViewButton(teacherMails[0]);

  const coachMails = env.state.mail.filter((m) => m.to === 'coach@example.test');
  assert.equal(coachMails.length, 1, 'exactly one E4 covering both parts');
  assert.ok(coachMails[0].subject.includes('Reflection and plan received'));
  assert.ok(coachMails[0].htmlBody.includes('How did the lesson go?') && coachMails[0].htmlBody.includes('What challenges do you expect?'));

  const sheet = env.spreadsheet.getSheetByName('OTP Reflections');
  assert.equal(sheet._data.length, 3, 'header + Part 1 row + Part 2 row');
});

check('d4 a second mirror of an already-mirrored part is a no-op: no duplicate row, no re-send', () => {
  const record = baseRecord();
  const mirroredPart1 = part1({ mirrored_at: '2026-09-18T09:05:00.000Z', teacher_emailed_at: '2026-09-18T09:05:00.000Z', coach_emailed_at: '2026-09-18T09:05:00.000Z' });
  const env = makeEnv({ forMirror: reflectionForMirror(record, [mirroredPart1]) });
  const out = env.context.mirrorOtpReflectionsFromSupabase_(TOKEN_A);
  assert.deepEqual(toPlain(out), { mirrored: 0, parts: [] });
  assert.equal(env.state.mail.length, 0);
  assert.equal(env.spreadsheet.getSheetByName('OTP Reflections'), null, 'no tab is even created when nothing is pending');
});

check('d5 upsertOtpReflectionRow_ updates the SAME row (no duplicate) when called twice for one part', () => {
  const env = makeEnv(); const sheet = env.context.getOtpReflectionsSheetWithHeader_(env.spreadsheet);
  const record = baseRecord();
  env.context.upsertOtpReflectionRow_(sheet, record, part1());
  env.context.upsertOtpReflectionRow_(sheet, record, part1({ answers: { q1: 'Revised answer', q2_level: 'Great', q2_comment: '', q3: 'x' } }));
  assert.equal(sheet._data.length, 2, 'header + exactly one row, not two');
  const headers = sheet._data[0];
  assert.equal(sheet._data[1][headers.indexOf('q1')], 'Revised answer');
});

check('d6 a mail failure for one side still stamps the other and marks with only that stamp', () => {
  const record = baseRecord();
  const env = makeEnv({ forMirror: reflectionForMirror(record, [part1()]), teacherEmail: '' }); // no teacher email on file -> E2 silently skipped
  env.context.mirrorOtpReflectionsFromSupabase_(TOKEN_A);
  const coachMail = mailTo(env.state, 'coach@example.test');
  assert.ok(coachMail, 'E4 still sent');
  const markCalls = env.state.fetches.filter((f) => f.url.includes('mark_reflection_mirrored'));
  const body = JSON.parse(markCalls[0].payload);
  assert.equal(body.p_teacher_at, null); assert.match(body.p_coach_at, /^2026-/);
  const sheet = env.spreadsheet.getSheetByName('OTP Reflections');
  const headers = sheet._data[0];
  assert.equal(sheet._data[1][headers.indexOf('teacher_emailed_at')], '');
  assert.match(sheet._data[1][headers.indexOf('coach_emailed_at')], /^2026-/);
});

check('d7 reflect_mirror on an unknown token answers the generic miss, no Sheet or mail activity', () => {
  const env = makeEnv({ forMirror: { found: false } });
  const out = output(env.context.doPost({ postData: { contents: JSON.stringify({ form: 'otp', action: 'reflect_mirror', record_token: TOKEN_A }) } }));
  assert.deepEqual(out, { success: false, error: 'Record not found' });
  assert.equal(env.state.mail.length, 0);
});

check('d8 a non-canonical record_token is rejected before any Supabase call', () => {
  const env = makeEnv();
  const out = output(env.context.doPost({ postData: { contents: JSON.stringify({ form: 'otp', action: 'reflect_mirror', record_token: 'not-a-token' }) } }));
  assert.deepEqual(out, { success: false, error: 'bad record' });
  assert.equal(env.state.fetches.length, 0);
});

check('d9 a concurrent mirror that already wrote the row under the lock (a stale pre-lock Supabase read) is never re-mirrored', () => {
  const record = baseRecord();
  // Supabase's pre-lock read still shows Part 1 pending (mirrored_at:null),
  // exactly as it would while a second, overlapping call (the edge function's
  // waitUntil plus the heal sweep, or a retried POST) is mid-flight: it wrote
  // the "OTP Reflections" row for Part 1 but has not yet called
  // mark_reflection_mirrored. This call must lose the race gracefully, not
  // resend E2/E4.
  const env = makeEnv({ forMirror: reflectionForMirror(record, [part1()]) });
  const sheet = env.context.getOtpReflectionsSheetWithHeader_(env.spreadsheet);
  env.context.upsertOtpReflectionRow_(sheet, record, part1());
  const out = env.context.mirrorOtpReflectionsFromSupabase_(TOKEN_A);
  assert.deepEqual(toPlain(out), { mirrored: 0, parts: [] }, 'the part someone else already wrote is dropped, not re-mirrored');
  assert.equal(env.state.mail.length, 0, 'no duplicate E2 or E4');
  assert.equal(sheet._data.length, 2, 'still header + exactly one row for the part, never duplicated');
  const markCalls = env.state.fetches.filter((f) => f.url.includes('mark_reflection_mirrored'));
  assert.equal(markCalls.length, 0, 'a part this call never actually mirrored is never marked by this call either');
});

/* ── (e) heal sweep ───────────────────────────────────────────────────────── */

check('e1 healOtpMirror also sweeps otp_reflections_unmirrored, batched by distinct token', () => {
  const recordX = baseRecord({ record_id: 'AIS-OTP-X', record_token: 'e'.repeat(32), teacher_token: 'f'.repeat(32) });
  const env = makeEnv({
    unmirrored: [{ record_token: 'e'.repeat(32), part: 1 }, { record_token: 'e'.repeat(32), part: 2 }],
    forMirror: reflectionForMirror(recordX, [part1({ mirrored_at: null }), part2({ mirrored_at: null })])
  });
  const summary = env.context.healOtpMirror();
  assert.equal(summary.success, true);
  assert.ok(summary.reflections, 'a reflections sub-summary is present');
  assert.equal(summary.reflections.pending, 2);
  assert.equal(summary.reflections.healed, 2, 'both parts of the one distinct token healed in one mirror call');
  const sheet = env.spreadsheet.getSheetByName('OTP Reflections');
  assert.equal(sheet._data.length, 3);
});

check('e2 a reflections sweep failure (bad RPC) never blocks the main OTP sweep, and is reported under its own key', () => {
  const env = makeEnv();
  // The main sweep (otp_unmirrored) succeeds with nothing pending; only the
  // reflections RPC (otp_reflections_unmirrored) 500s.
  const realFetch = env.context.UrlFetchApp.fetch;
  env.context.UrlFetchApp = { fetch(url, opts) {
    if (url.includes('otp_reflections_unmirrored')) { env.state.fetches.push({ url, payload: opts.payload || '' }); return response(500, 'boom'); }
    return realFetch(url, opts);
  } };
  const summary = env.context.healOtpMirror();
  assert.equal(summary.success, true, 'the main OTP sweep is unaffected');
  assert.equal(summary.reflections.success, false);
  assert.ok(String(summary.reflections.error).includes('500'));
});

check('e3 SUPABASE_SECRET_KEY missing: both sweeps report the same clean failure, no throw', () => {
  const env = makeEnv({ props: { SUPABASE_SECRET_KEY: '' } });
  const summary = env.context.healOtpMirror();
  assert.equal(summary.success, false);
  assert.equal(summary.reflections.success, false);
});

check('e4 a mark failure on first mirror leaves the row written but unmarked; a later heal marks it without rewriting the row or resending mail (skeptic-found, 2026-09-25)', () => {
  const record = baseRecord();
  // First mirror: the row write + both emails go through, but
  // mark_reflection_mirrored 500s (a transient failure, or the execution
  // dying between the row write and the mark).
  const env = makeEnv({ forMirror: reflectionForMirror(record, [part1()]), markCode: 500 });
  const first = env.context.mirrorOtpReflectionsFromSupabase_(TOKEN_A);
  assert.deepEqual(toPlain(first), { mirrored: 0, parts: [] }, 'the mark call failed, so nothing counts as mirrored yet');
  const sheet = env.spreadsheet.getSheetByName('OTP Reflections');
  assert.equal(sheet._data.length, 2, 'the row was written despite the mark failure');
  assert.equal(env.state.mail.length, 2, 'E2 + E4 sent once, on the write that actually happened');
  const headers = sheet._data[0];
  const stampedTeacherAt = sheet._data[1][headers.indexOf('teacher_emailed_at')];
  assert.match(stampedTeacherAt, /^2026-/, 'sheet stamps were written even though the mark call failed');

  // Supabase still lists Part 1 as unmirrored (the mark never landed); a
  // later heal (mirror_pending_since now old enough) must finish it: mark
  // succeeds, but never rewrite the row or resend E2/E4.
  env.state.markCode = 200;
  env.state.unmirrored = [{ record_token: TOKEN_A, part: 1 }];
  const summary = env.context.healOtpMirror();
  assert.equal(summary.reflections.healed, 1, 'the stuck part is healed');
  assert.equal(summary.reflections.failed, 0);
  assert.equal(sheet._data.length, 2, 'still exactly one row, never duplicated');
  assert.equal(env.state.mail.length, 2, 'no resend: E2/E4 total stays at 2, not 4');
  const markCalls = env.state.fetches.filter((f) => f.url.includes('mark_reflection_mirrored'));
  assert.equal(markCalls.length, 2, 'one failed mark attempt from the first mirror, one successful mark attempt from the heal');
  const lastMarkBody = JSON.parse(markCalls[markCalls.length - 1].payload);
  assert.equal(lastMarkBody.p_part, 1);
  assert.match(lastMarkBody.p_teacher_at, /^2026-/, 'the heal marks using the stamps already recorded on the row, not a fresh timestamp');
});

check('e5 allowMarkExisting stays OFF for an ordinary (non-heal) mirror call: d9’s race-drop behaviour is unchanged', () => {
  const record = baseRecord();
  const env = makeEnv({ forMirror: reflectionForMirror(record, [part1()]) });
  const sheet = env.context.getOtpReflectionsSheetWithHeader_(env.spreadsheet);
  env.context.upsertOtpReflectionRow_(sheet, record, part1());
  const out = env.context.mirrorOtpReflectionsFromSupabase_(TOKEN_A);
  assert.deepEqual(toPlain(out), { mirrored: 0, parts: [] }, 'an ordinary call still defers to a same-moment racer, no allowMarkExisting');
  assert.equal(env.state.mail.length, 0);
  const markCalls = env.state.fetches.filter((f) => f.url.includes('mark_reflection_mirrored'));
  assert.equal(markCalls.length, 0, 'an ordinary reflect_mirror call never marks a part it did not itself write');
});

/* ── (f) a brand-image fetch failure never blocks the send ─────────────── */

check('f1 image fetch failure: E1 still sends, cid markup stays (broken image, not a broken email)', () => {
  const env = makeEnv({ imagesFail: true }); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, baseRecord());
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail, 'E1 still sent on an image fetch failure');
  assert.ok(mail.htmlBody.includes('cid:ais_header'));
  assert.deepEqual(toPlain(mail.inlineImages), {}, 'no image blobs attached when both fetches fail');
});

check('f2 image fetch failure: reflect_mirror’s E2 still sends', () => {
  const record = baseRecord();
  const env = makeEnv({ forMirror: reflectionForMirror(record, [part1()]), imagesFail: true });
  env.context.mirrorOtpReflectionsFromSupabase_(TOKEN_A);
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail, 'E2 still sent on an image fetch failure');
});

/* ── (g) getOtpColumns() carries teacher_token as column 41 ─────────────── */

check('g1 getOtpColumns() is 41 columns, teacher_token last', () => {
  const env = makeEnv();
  const all = env.context.getOtpColumns();
  assert.equal(all.length, 41);
  assert.equal(all[40], 'teacher_token');
});

/* ── (h) teacher_token is LOCKED: never set by a client field, never touched
 * by update/close (skeptic-found defect, 2026-09-25) ────────────────────── */

const ATTACKER_TOKEN_1 = 'c'.repeat(32);
const ATTACKER_TOKEN_2 = '9'.repeat(32);

check('h1 a fresh OTP submit ignores a client-posted teacher_token (buildOtpRecord never copies it)', () => {
  const env = makeEnv();
  const payload = { form: 'otp', teacher: 'Jo Mare Kruger', inspector: 'Dave Richards', date: '2026-09-18', teacher_token: ATTACKER_TOKEN_1 };
  const out = output(env.context.doPost({ postData: { contents: JSON.stringify(payload) } }));
  assert.equal(out.success, true);
  const sheet = env.spreadsheet.getSheetByName('OTP Submissions');
  const headers = sheet._data[0];
  assert.equal(sheet._data[1][headers.indexOf('teacher_token')], '', 'a client-posted teacher_token never lands on the Sheet row');
  const ingest = env.state.fetches.filter((f) => f.url.includes('ingest_otp'));
  assert.equal(ingest.length, 1);
  const mirrored = JSON.parse(ingest[0].payload).payload;
  assert.equal(mirrored.teacher_token, '', 'the Supabase mirror payload carries no client-supplied teacher_token either');
});

check('h4 a fresh OTP submit with a client-posted teacher_token still sends the teacher the LEGACY email, not E1 (skeptic-found defect, 2026-09-25)', () => {
  const env = makeEnv();
  const payload = { form: 'otp', teacher: 'Jo Mare Kruger', inspector: 'Dave Richards', date: '2026-09-18', teacher_token: ATTACKER_TOKEN_1 };
  const out = output(env.context.doPost({ postData: { contents: JSON.stringify(payload) } }));
  assert.equal(out.success, true);
  const mail = mailTo(env.state, 'teacher@example.test');
  assert.ok(mail, 'the teacher receives an email at all (the pre-fix bug sent none: otpLinksFor_ found no links for the empty record_token and E1 silently returned false)');
  assert.equal(mail.subject, 'AIS OTP Observation 1 · 2026-09-18', 'legacy subject formula');
  assert.ok(mail.htmlBody.includes('otp-record.html?token='), 'legacy body carries the view-link URL');
  assert.ok(!mail.htmlBody.includes('cid:ais_header'), 'never the E1 branded template');
  assert.equal(mail.inlineImages, undefined, 'never E1 inline images');
});

check('h2 action:update never overwrites an existing teacher_token, even when the client posts a different one', () => {
  const env = makeEnv(); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, baseRecord({ teacher_token: TEACHER_TOKEN_A }));
  const payload = { form: 'otp', action: 'update', record_token: TOKEN_A, teacher_token: ATTACKER_TOKEN_2 };
  const out = output(env.context.doPost({ postData: { contents: JSON.stringify(payload) } }));
  assert.equal(out.success, true);
  const headers = sheet._data[0];
  assert.equal(sheet._data[1][headers.indexOf('teacher_token')], TEACHER_TOKEN_A, 'update never overwrites the locked teacher_token');
});

check('h3 action:close never blanks an existing teacher_token, even when the client posts an empty one', () => {
  const env = makeEnv(); const sheet = env.sheet();
  env.context.mirrorOtpRecord_(env.spreadsheet, sheet, baseRecord({ teacher_token: TEACHER_TOKEN_A }));
  const payload = { form: 'otp', action: 'close', record_token: TOKEN_A, teacher_token: '', next_step_1: 'A', next_step_2: 'B', next_step_3: 'C' };
  const out = output(env.context.doPost({ postData: { contents: JSON.stringify(payload) } }));
  assert.equal(out.success, true);
  const headers = sheet._data[0];
  assert.equal(sheet._data[1][headers.indexOf('teacher_token')], TEACHER_TOKEN_A, 'close never blanks the locked teacher_token');
});

console.log('gs-reflect-harness: PASS (' + results.length + '/' + results.length + ')');
for (const result of results) console.log('PASS ' + result);
