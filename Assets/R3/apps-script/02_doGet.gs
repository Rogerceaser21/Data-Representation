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

    if (params.action === 'options') {
      return jsonOut({ success: true, options: getDropdownOptions() });
    }

    if (params.id) {
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
function getRecordById(id, token) {
  const ss = SpreadsheetApp.openById(getSheetId());
  const sheet = ss.getSheetByName(SHEET_NAME_SUBMISSIONS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: 'Record not found' };
  }
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('record_id');
  const tokenCol = headers.indexOf('record_token');
  if (idCol < 0) return { success: false, error: 'Schema mismatch · record_id column missing' };

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      const storedToken = tokenCol >= 0 ? String(values[r][tokenCol] || '').trim() : '';
      const givenToken = String(token || '').trim();
      if (!storedToken || !givenToken || storedToken !== givenToken) {
        return { success: false, error: 'Record not found' };
      }
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
      return { success: true, data: record };
    }
  }
  return { success: false, error: 'Record not found' };
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
