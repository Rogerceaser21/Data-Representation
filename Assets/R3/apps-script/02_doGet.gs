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
      return jsonOut(getRecordById(params.id));
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

function getRecordById(id) {
  const ss = SpreadsheetApp.openById(getSheetId());
  const sheet = ss.getSheetByName(SHEET_NAME_SUBMISSIONS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: false, error: 'No submissions yet' };
  }
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('record_id');
  if (idCol < 0) return { success: false, error: 'Schema mismatch · record_id column missing' };

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      const record = {};
      headers.forEach(function(h, j) { record[h] = values[r][j]; });
      return { success: true, data: record };
    }
  }
  return { success: false, error: 'Record not found · id=' + id };
}

function getDropdownOptions() {
  const ss = SpreadsheetApp.openById(getSheetId());
  const subjectsResult = readSubjectsTabRich(ss);

  return {
    teachers:   readTeachersTab(ss),
    inspectors: readSingleColumnTab(ss, SHEET_NAME_INSPECTORS),
    curricula:  readSingleColumnTab(ss, SHEET_NAME_CURRICULUM),
    subjects:   subjectsResult.subjects,
    schools:    subjectsResult.schools
  };
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
    var name = String(values[r][0] || '').trim();
    if (!name) continue;
    subjects.push({
      name: name,
      active:    isTruthy(values[r][1]),
      kindy:     isTruthy(values[r][2]),
      primary:   isTruthy(values[r][3]),
      secondary: isTruthy(values[r][4])
    });
  }
  return { subjects: subjects, schools: schools };
}

function readSingleColumnTab(ss, tabName) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  return values.map(function(r) { return String(r[0]).trim(); }).filter(function(s) { return s.length > 0; });
}

/**
 * Teachers tab schema: [email, name]. Returns objects so the form can search
 * by either field.
 */
function readTeachersTab(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_TEACHERS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return values
    .map(function(r) { return { email: String(r[0]).trim(), name: String(r[1]).trim() }; })
    .filter(function(t) { return t.email.length > 0; });
}
