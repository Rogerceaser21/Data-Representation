/**
 * POST handler · receives a JSON form submission, appends a new row.
 *
 * Request body (Content-Type: text/plain, raw JSON):
 *   { teacher, subject, class, observer, position, date,
 *     "cm-1": "S", "cm-1-c": "...", ...,
 *     overall, "feedback-date", "sig-teacher", "sig-observer", "sig-date",
 *     (optional) submitted_at  → backdate the submission timestamp }
 *
 * Response:
 *   { success: true, id: "AIS-OBS-YYYYMMDD-HHMM" }
 *   { success: false, error: "..." }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ success: false, error: 'No request body' });
    }
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    const columns = getColumns();

    // First-run: create header row + freeze.
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, columns.length)
           .setFontWeight('bold')
           .setBackground('#143642')
           .setFontColor('#ffffff');
      sheet.setColumnWidths(1, columns.length, 140);
    }

    const submittedAt = data.submitted_at || new Date().toISOString();
    const recordId = data.record_id || generateRecordId(submittedAt);

    // Map by column name; tolerate hyphen / underscore keys.
    const row = columns.map(function(col) {
      if (col === 'record_id') return recordId;
      if (col === 'submitted_at') return submittedAt;
      if (col === 'observation_date') return data.date || data.observation_date || '';
      if (col === 'feedback_date')    return data['feedback-date']    || data.feedback_date    || '';
      if (col === 'sig_teacher')      return data['sig-teacher']      || data.sig_teacher      || '';
      if (col === 'sig_observer')     return data['sig-observer']     || data.sig_observer     || '';
      if (col === 'sig_date')         return data['sig-date']         || data.sig_date         || '';
      return data[col] != null ? data[col] : '';
    });

    sheet.appendRow(row);

    return jsonOut({ success: true, id: recordId });
  } catch (err) {
    return jsonOut({ success: false, error: String(err && err.message || err) });
  }
}

function generateRecordId(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = function(n) { return String(n).padStart(2, '0'); };
  return 'AIS-OBS-' + d.getFullYear() +
                       pad(d.getMonth() + 1) +
                       pad(d.getDate()) + '-' +
                       pad(d.getHours()) +
                       pad(d.getMinutes());
}
