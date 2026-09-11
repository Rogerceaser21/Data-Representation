/**
 * GET handler · supports three modes:
 *
 *   1. ?id=AIS-R3-...           → returns one record from Submissions as JSON
 *   2. ?action=options          → returns Teachers/Inspectors/Curriculum/Subjects
 *                                 for populating dropdowns at form-load time
 *   3. no args                  → returns a status payload (sanity check)
 *
 * Response shapes:
 *   { success: true,  data: { record_id: ..., teacher: ..., ... } }
 *   { success: true,  options: { teachers: [...], inspectors: [...], ... } }
 *   { success: true,  status: 'ok', message: '...' }
 *   { success: false, error: '...' }
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};

    // otp-v0.1: the Progress in Lessons OTP form shares this endpoint and
    // stamps every request with form=otp. Dispatched BEFORE any R3 branch; a
    // request without that parameter behaves exactly as before.
    if (params.form === 'otp') return doGetOtp(params);

    if (params.action === 'options') {
      return jsonOut({ success: true, options: getDropdownOptions() });
    }

    // v0.53: one Evidence-Pad page for a locked record. Token-gated exactly
    // like the record fetch (hard rule 10); any non-match is a generic miss.
    if (params.action === 'pad_image') {
      return jsonOut(getPadImageForToken(params.token, params.name));
    }

    // v0.46: a record is fetched by its UNIQUE record_token. Accept either a
    // legacy ?id=...&token=... link or a token-only ?token=... link.
    if (params.token || params.id) {
      return jsonOut(getRecordById(params.id, params.token));
    }

    return jsonOut({
      success: true,
      status: 'ok',
      message: 'AIS R3 Evidence API · pass ?id=AIS-R3-... for a record, or ?action=options for dropdowns'
    });
  } catch (err) {
    return jsonOut({ success: false, error: String(err && err.message || err) });
  }
}

/**
 * Returns a locked record. v0.29: a record_token URL parameter is required;
 * it must match the token stored in the Sheet for that record. Without a
 * matching token the response is a generic "not found" so an attacker can't
 * distinguish "wrong token" from "no such id".
 *
 * Pre-v0.29 records have no token in their row, so they are not viewable via
 * this endpoint at all (acceptable: those were test submissions per Igor).
 */
// v0.46: look the record up by its UNIQUE record_token, NOT by record_id.
// record_id is minute-resolution (AIS-R3-YYYYMMDD-HHMM) and COLLIDES for
// submissions made in the same minute (17 such collisions during live inspection
// week). The old id-first scan returned the first twin and then failed its token
// check, so every later twin reported "Record not found" forever. The token (two
// concatenated UUIDs) is the real key, is unique per submission, and is already
// on every link; `id` is now just a display label and is ignored for matching.
// Security is unchanged: a record is only returned for an exact token match
// (hard rule 10), and a non-match returns the same generic "Record not found".
// Found by header NAME, so the record_token column's position is irrelevant
// (hard rule 1: never reorder the sheet).
function getRecordById(id, token) {
  const ss = SpreadsheetApp.openById(getSheetId());
  const sheet = ss.getSheetByName(SHEET_NAME_SUBMISSIONS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: 'Record not found' };
  }
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const tokenCol = headers.indexOf('record_token');
  const givenToken = String(token || '').trim();
  if (!givenToken || tokenCol < 0) {
    return { success: false, error: 'Record not found' };
  }

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][tokenCol] || '').trim() !== givenToken) continue;
    // matched by token — build and return this row
    // v0.41: Sheets auto-parses posted values into real date/time cells
    // ("08:40" → time on the 1899-12-30 epoch; observation_date → midnight
    // local). Raw Dates JSON-serialise as UTC ISO strings, which the form's
    // <input type=time> silently rejects (blank Time in/out) and <input
    // type=date> shifts a day. Format them in the sheet's timezone instead.
    const tz = ss.getSpreadsheetTimeZone();
    const record = {};
    headers.forEach(function(h, j) {
      var v = values[r][j];
      if (h === 'record_token') return;
      if (v instanceof Date) {
        v = v.getFullYear() < 1900
          ? Utilities.formatDate(v, tz, 'HH:mm')
          : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      }
      record[h] = v;
    });
    // v0.53: if the record carries an Evidence Pad, list its page names so the
    // record view can show per-field attachment pills (images themselves are
    // fetched one by one via ?action=pad_image, same token gate).
    const out = { success: true, data: record };
    const padCol = headers.indexOf('evidence_pad_id');
    const padId = padCol > -1 ? String(values[r][padCol] || '').trim() : '';
    if (padId) {
      try { out.pad_files = listPadFiles(padId); } catch (e) { /* record still loads */ }
    }
    return out;
  }
  return { success: false, error: 'Record not found' };
}

/**
 * v0.53: returns one pad page (base64 JPEG) for a locked record. The caller
 * must present the record's unique token; the requested name must be one of
 * that pad's own files. Every failure path returns the same generic miss so
 * nothing can be probed (mirrors getRecordById).
 */
function getPadImageForToken(token, name) {
  const miss = { success: false, error: 'Record not found' };
  const givenToken = String(token || '').trim();
  const wantName = String(name || '').trim();
  if (!givenToken || !/^[a-z0-9-]+\.jpg$/.test(wantName)) return miss;

  const ss = SpreadsheetApp.openById(getSheetId());
  const sheet = ss.getSheetByName(SHEET_NAME_SUBMISSIONS);
  // otp-v0.1: an absent or empty R3 tab must still let an OTP token through
  // to the OTP tab below (the OTP form reuses this same ?action=pad_image
  // shape and sends no form parameter). Same generic miss on failure.
  if (!sheet || sheet.getLastRow() < 2) return padImageFromOtpTab(ss, givenToken, wantName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const tokenCol = headers.indexOf('record_token');
  const padCol = headers.indexOf('evidence_pad_id');
  if (tokenCol < 0 || padCol < 0) return padImageFromOtpTab(ss, givenToken, wantName);

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][tokenCol] || '').trim() !== givenToken) continue;
    const padId = String(values[r][padCol] || '').trim();
    if (!padId || listPadFiles(padId).indexOf(wantName) < 0) return miss;
    const blob = fetchPadImageBytes(padId, wantName);
    if (!blob) return miss;
    return { success: true, mime: 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) };
  }
  // otp-v0.1: no R3 row owns this token, so try the OTP tab.
  return padImageFromOtpTab(ss, givenToken, wantName);
}

/**
 * v0.33: wrap the multi-tab read in CacheService. First call takes the
 * usual 4-5s to read sheets; subsequent calls return from in-memory cache
 * in ~100-200ms. Cache TTL = 5 minutes, plenty fresh for staff rosters
 * that change rarely. Run clearOptionsCache() from the editor after a
 * Sheet edit if you need the form to see the change immediately.
 */
const OPTIONS_CACHE_KEY = 'R3_OPTIONS_v1';
const OPTIONS_CACHE_TTL = 300;

function getDropdownOptions() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(OPTIONS_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through, refresh */ }
  }

  const ss = SpreadsheetApp.openById(getSheetId());
  const subjectsResult = readSubjectsTabRich(ss);

  const fresh = {
    teachers:   readTeachersTab(ss),
    inspectors: readInspectorsTab(ss).map(function(i) { return i.name; }),
    curricula:  readSingleColumnTab(ss, SHEET_NAME_CURRICULUM),
    subjects:   subjectsResult.subjects,
    schools:    subjectsResult.schools
  };

  try { cache.put(OPTIONS_CACHE_KEY, JSON.stringify(fresh), OPTIONS_CACHE_TTL); } catch (e) {}
  return fresh;
}

/** Clears the dropdown options cache. Run from the editor after a Sheet edit
 *  if you can't wait 5 minutes for natural expiry. */
function clearOptionsCache() {
  CacheService.getScriptCache().remove(OPTIONS_CACHE_KEY);
  CacheService.getScriptCache().remove(OPTIONS_CACHE_KEY_OTP);
  CacheService.getScriptCache().remove(TEACHER_EMAIL_CACHE_KEY);
  return 'cleared';
}

/**
 * Normalises a string so it can't break a CSS selector when Tom Select
 * uses it as a `[data-value="..."]` lookup. Substitutes straight ASCII
 * apostrophe + double quote with their typographic curly equivalents.
 *
 * U+2019 (right single quotation mark) and U+201D (right double) are
 * visually nearly identical to U+0027 and U+0022 but carry no special
 * meaning to CSS / HTML / JS string parsers.
 *
 * Discovered in v0.31 after a teacher row "Sana'a Albqa'een" tripped
 * iOS Safari's selector engine inside Tom Select.
 */
function safeForSelector(s) {
  return String(s == null ? '' : s)
    .replace(/'/g, '’')
    .replace(/"/g, '”');
}

/**
 * Subjects tab schema: header row A1='Subject', B1='Yes/No', C1='Kindy',
 * D1='Primary', E1='Secondary'. Each subject row has A=name, B=TRUE/FALSE
 * (active), C/D/E=TRUE/FALSE (per school).
 *
 * Returns { subjects: [{name, active, kindy, primary, secondary}], schools: ['Kindy','Primary','Secondary'] }
 * Schools list is read from the header row so the form auto-matches Sheet renames.
 */
function readSubjectsTabRich(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_SUBJECTS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { subjects: [], schools: ['Kindy', 'Primary', 'Secondary'] };
  }
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(1, 1, lastRow, 5).getValues();
  const header = values[0];
  const schools = [
    String(header[2] || 'Kindy').trim(),
    String(header[3] || 'Primary').trim(),
    String(header[4] || 'Secondary').trim()
  ];
  const isTruthy = function(v) {
    if (v === true) return true;
    var s = String(v).trim().toLowerCase();
    return s === 'true' || s === 'yes' || s === 'y' || s === '1';
  };
  const subjects = [];
  for (var r = 1; r < values.length; r++) {
    var name = safeForSelector(String(values[r][0] || '').trim());
    if (!name) continue;
    subjects.push({
      name: name,
      active:    isTruthy(values[r][1]),
      kindy:     isTruthy(values[r][2]),
      primary:   isTruthy(values[r][3]),
      secondary: isTruthy(values[r][4])
    });
  }
  return { subjects: subjects, schools: schools.map(safeForSelector) };
}

function readSingleColumnTab(ss, tabName) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  return values
    .map(function(r) { return safeForSelector(String(r[0]).trim()); })
    .filter(function(s) { return s.length > 0; });
}

/**
 * Inspectors tab schema (v0.31): [name, email]. Email is optional per
 * row; if blank, the inspector won't receive a submission copy.
 */
function readInspectorsTab(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_INSPECTORS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return values
    .map(function(r) {
      return {
        name:  safeForSelector(String(r[0] || '').trim()),
        email: String(r[1] || '').trim()
      };
    })
    .filter(function(i) { return i.name.length > 0; });
}

/**
 * Looks up an inspector's email by display name. Returns '' if no
 * matching row, or the row has no email set. Comparison is normalised
 * (same safeForSelector pass) so a submitted name with a curly
 * apostrophe matches a Sheet row with a straight one.
 */
function lookupInspectorEmail(ss, name) {
  const want = safeForSelector(String(name || '').trim()).toLowerCase();
  if (!want) return '';
  const rows = readInspectorsTab(ss);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name.toLowerCase() === want) return rows[i].email;
  }
  return '';
}

/**
 * Teachers tab schema: column A = name (display + submission value). Other
 * columns (Title, First Name, Family Name, Code, Email, Curriculum, ...) are
 * for downstream matrices and not read by the form.
 */
function readTeachersTab(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_TEACHERS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  return values
    .map(function(r) { return { name: safeForSelector(String(r[0]).trim()) }; })
    .filter(function(t) { return t.name.length > 0; });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * otp-v0.1 · GET side of the Progress in Lessons OTP form.
 *
 *   ?action=options&form=otp         → dropdowns: teachers from Teachers 26-27,
 *                                      observers from OTP Coaches 26-27
 *   ?action=pad_image&form=otp       → one Evidence Pad page, token-gated
 *   ?action=prev_next_steps&form=otp → otp-v0.9: a teacher's latest CLOSED lap
 *                                      in the current round (Next Steps only)
 *   ?token=...&form=otp              → one locked record (legacy ?id=&token= too)
 *
 * The R3 branches in doGet are untouched; this is reached only when the caller
 * sends form=otp.
 * ───────────────────────────────────────────────────────────────────────────── */
function doGetOtp(params) {
  if (params.action === 'options') {
    return jsonOut({ success: true, options: getOtpDropdownOptions() });
  }

  if (params.action === 'pad_image') {
    return jsonOut(getPadImageForToken(params.token, params.name));
  }

  if (params.action === 'prev_next_steps') {
    return jsonOut(getOtpPrevNextSteps(params.teacher));
  }

  if (params.token || params.id) {
    return jsonOut(getOtpRecord(params.id, params.token));
  }

  return jsonOut({
    success: true,
    status: 'ok',
    message: 'AIS OTP Progress API · pass ?token=...&form=otp for a record, or ?action=options&form=otp for dropdowns'
  });
}

/**
 * Separate cache key from the R3 options, so the two option sets can never
 * collide in CacheService. Same 5-minute TTL; clearOptionsCache clears both.
 */
const OPTIONS_CACHE_KEY_OTP = 'OTP_OPTIONS_v1';

function getOtpDropdownOptions() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(OPTIONS_CACHE_KEY_OTP);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through, refresh */ }
  }

  const ss = SpreadsheetApp.openById(getSheetId());
  const subjectsResult = readSubjectsTabRich(ss);

  const fresh = {
    teachers:   readTeachersFromSheet(getTabWithFallback(ss, SHEET_NAME_TEACHERS_2627, SHEET_NAME_TEACHERS)),
    inspectors: readOtpInspectors(ss).map(function(i) { return i.name; }),
    curricula:  readSingleColumnTab(ss, SHEET_NAME_CURRICULUM),
    subjects:   subjectsResult.subjects,
    schools:    subjectsResult.schools
  };

  try { cache.put(OPTIONS_CACHE_KEY_OTP, JSON.stringify(fresh), OPTIONS_CACHE_TTL); } catch (e) {}
  return fresh;
}

/** Teachers tab reader, given the tab (26-27 or the R3 fallback). Column A =
 *  name, exactly like readTeachersTab. */
function readTeachersFromSheet(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  return values
    .map(function(r) { return { name: safeForSelector(String(r[0]).trim()) }; })
    .filter(function(t) { return t.name.length > 0; });
}

/** Inspectors tab reader, given the tab. [name, email], exactly like
 *  readInspectorsTab. */
function readInspectorsFromSheet(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return values
    .map(function(r) {
      return {
        name:  safeForSelector(String(r[0] || '').trim()),
        email: String(r[1] || '').trim()
      };
    })
    .filter(function(i) { return i.name.length > 0; });
}

function readOtpInspectors(ss) {
  return readInspectorsFromSheet(ss.getSheetByName(SHEET_NAME_OTP_COACHES));
}

/**
 * Observer email for the submission CC, resolved over the OTP Coaches 26-27
 * tab (never the R3 inspector tab). Same normalised match as
 * lookupInspectorEmail, so a curly apostrophe still matches a straight one.
 */
function lookupOtpObserverEmail(ss, name) {
  const want = safeForSelector(String(name || '').trim()).toLowerCase();
  if (!want) return '';
  const rows = readOtpInspectors(ss);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name.toLowerCase() === want) return rows[i].email;
  }
  return '';
}

/**
 * otp-v0.9 · the teacher's OWN email, read from the Teachers 26-27 tab
 * (falling back to the R3 tab name like the roster read above) column F
 * (index 5, the reconciled roster's Email column). Cached 5 minutes, its own
 * key so it never collides with OPTIONS_CACHE_KEY_OTP / OPTIONS_CACHE_KEY;
 * cleared by clearOptionsCache() like the others.
 */
const TEACHER_EMAIL_CACHE_KEY = 'OTP_TEACHER_EMAILS_v1';

function readOtpTeacherEmails(ss) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(TEACHER_EMAIL_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through, refresh */ }
  }

  const sheet = getTabWithFallback(ss, SHEET_NAME_TEACHERS_2627, SHEET_NAME_TEACHERS);
  const fresh = [];
  if (sheet && sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    values.forEach(function(r) {
      const name = safeForSelector(String(r[0] || '').trim());
      if (name) fresh.push({ name: name, email: String(r[5] || '').trim() });
    });
  }

  try { cache.put(TEACHER_EMAIL_CACHE_KEY, JSON.stringify(fresh), OPTIONS_CACHE_TTL); } catch (e) {}
  return fresh;
}

/**
 * Teacher's email by display name, matched the same normalised way as
 * lookupOtpObserverEmail. Returns '' when the name isn't found or the row
 * carries no email.
 */
function lookupOtpTeacherEmail(ss, name) {
  const want = safeForSelector(String(name || '').trim()).toLowerCase();
  if (!want) return '';
  const rows = readOtpTeacherEmails(ss);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name.toLowerCase() === want) return rows[i].email;
  }
  return '';
}

/**
 * otp-v0.9 · a teacher's own coaching-continuity read: their latest CLOSED
 * lap in the CURRENT OTP round (a blank round on the row counts as current,
 * covering rows written before round-stamping existed), newest observation
 * date then submitted_at wins. Never the rubric states, notes, or any other
 * field: {success:true, found:true, lap, observation_date, observer,
 * next_step_1, next_step_2, next_step_3} or {success:true, found:false}.
 * Cached 60s per normalised teacher name; handleOtpUpdateOrClose
 * (01_doPost.gs) clears this teacher's key on every update/close so a
 * freshly closed lap is visible immediately.
 */
const PREV_STEPS_CACHE_PREFIX = 'OTP_PREV_STEPS_v1:';
const PREV_STEPS_CACHE_TTL = 60;

function prevStepsCacheKey(teacherName) {
  return PREV_STEPS_CACHE_PREFIX + safeForSelector(String(teacherName || '').trim()).toLowerCase();
}

function clearPrevNextStepsCache(teacherName) {
  CacheService.getScriptCache().remove(prevStepsCacheKey(teacherName));
}

function getOtpPrevNextSteps(teacherName) {
  const want = String(teacherName || '').trim().toLowerCase();
  const miss = { success: true, found: false };
  if (!want) return miss;

  const cache = CacheService.getScriptCache();
  const key = prevStepsCacheKey(teacherName);
  const cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through, refresh */ }
  }

  const ss = SpreadsheetApp.openById(getSheetId());
  const sheet = ss.getSheetByName(SHEET_NAME_OTP_SUBMISSIONS);
  if (!sheet || sheet.getLastRow() < 2) {
    try { cache.put(key, JSON.stringify(miss), PREV_STEPS_CACHE_TTL); } catch (e) {}
    return miss;
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const col = {};
  ['teacher', 'status', 'round', 'observation_date', 'submitted_at', 'observer',
   'lap', 'next_step_1', 'next_step_2', 'next_step_3'].forEach(function(h) {
    col[h] = headers.indexOf(h);
  });
  if (col.teacher < 0 || col.status < 0) {
    try { cache.put(key, JSON.stringify(miss), PREV_STEPS_CACHE_TTL); } catch (e) {}
    return miss;
  }

  const tz = ss.getSpreadsheetTimeZone();
  const cellText = function(v) {
    if (!(v instanceof Date)) return v == null ? '' : v;
    return v.getFullYear() < 1900
      ? Utilities.formatDate(v, tz, 'HH:mm')
      : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  };

  const currentRound = fetchCurrentOtpRound();
  var best = null;
  for (var r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[col.teacher] || '').trim().toLowerCase() !== want) continue;
    if (String(row[col.status] || '').trim() !== 'closed') continue;
    const rowRound = col.round > -1 ? String(row[col.round] || '').trim() : '';
    // A blank round on the row counts as current; an UNKNOWN current round
    // (the Supabase read failed) never excludes a row.
    if (rowRound !== '' && currentRound !== '' && rowRound !== currentRound) continue;
    if (!best) { best = row; continue; }
    const a = [cellText(row[col.observation_date]), cellText(row[col.submitted_at])];
    const b = [cellText(best[col.observation_date]), cellText(best[col.submitted_at])];
    if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) best = row;
  }

  const out = !best ? miss : {
    success: true,
    found: true,
    lap: best[col.lap],
    observation_date: cellText(best[col.observation_date]),
    observer: best[col.observer],
    next_step_1: best[col.next_step_1],
    next_step_2: best[col.next_step_2],
    next_step_3: best[col.next_step_3]
  };
  // Never cache a miss computed under an unknown round: the next call retries.
  if (best || currentRound !== '') {
    try { cache.put(key, JSON.stringify(out), PREV_STEPS_CACHE_TTL); } catch (e) {}
  }
  return out;
}

/**
 * Locked OTP record. Keys on the UNIQUE record_token found by header NAME
 * (hard rule 10), searching the OTP tab first and then the R3 Submissions tab,
 * so an OTP viewer link still resolves an R3 record if one is ever shared.
 * Any non-match returns the same generic "Record not found" as the R3 path.
 * The response carries `form` ('otp' or 'r3') so the viewer knows what it got.
 */
function getOtpRecord(id, token) {
  const givenToken = String(token || '').trim();
  if (!givenToken) return { success: false, error: 'Record not found' };

  const ss = SpreadsheetApp.openById(getSheetId());
  const tabs = [
    { name: SHEET_NAME_OTP_SUBMISSIONS, form: 'otp' },
    { name: SHEET_NAME_SUBMISSIONS,     form: 'r3'  }
  ];

  for (var t = 0; t < tabs.length; t++) {
    const hit = readRecordFromTab(ss, tabs[t].name, givenToken);
    if (hit) {
      hit.form = tabs[t].form;
      return hit;
    }
  }
  return { success: false, error: 'Record not found' };
}

/**
 * Reads one row from a tab by record_token (header NAME lookup, so column
 * position is irrelevant). Returns { success:true, data, pad_files? } or null
 * when the tab has no such token. Date cells are formatted in the Sheet's
 * timezone, same as getRecordById, so <input type=date|time> accept them.
 */
function readRecordFromTab(ss, tabName, givenToken) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const tokenCol = headers.indexOf('record_token');
  if (tokenCol < 0) return null;

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][tokenCol] || '').trim() !== givenToken) continue;
    const tz = ss.getSpreadsheetTimeZone();
    const record = {};
    headers.forEach(function(h, j) {
      var v = values[r][j];
      if (h === 'record_token') return;
      if (v instanceof Date) {
        v = v.getFullYear() < 1900
          ? Utilities.formatDate(v, tz, 'HH:mm')
          : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      }
      record[h] = v;
    });
    const out = { success: true, data: record };
    const padCol = headers.indexOf('evidence_pad_id');
    const padId = padCol > -1 ? String(values[r][padCol] || '').trim() : '';
    if (padId) {
      try { out.pad_files = listPadFiles(padId); } catch (e) { /* record still loads */ }
    }
    return out;
  }
  return null;
}

/**
 * Pad-page fallback for getPadImageForToken: same token gate, same generic
 * miss, over the OTP Submissions tab.
 */
function padImageFromOtpTab(ss, givenToken, wantName) {
  const miss = { success: false, error: 'Record not found' };
  const sheet = ss.getSheetByName(SHEET_NAME_OTP_SUBMISSIONS);
  if (!sheet || sheet.getLastRow() < 2) return miss;
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const tokenCol = headers.indexOf('record_token');
  const padCol = headers.indexOf('evidence_pad_id');
  if (tokenCol < 0 || padCol < 0) return miss;

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][tokenCol] || '').trim() !== givenToken) continue;
    const padId = String(values[r][padCol] || '').trim();
    if (!padId || listPadFiles(padId).indexOf(wantName) < 0) return miss;
    const blob = fetchPadImageBytes(padId, wantName);
    if (!blob) return miss;
    return { success: true, mime: 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) };
  }
  return miss;
}
