/**
 * POST handler · receives a JSON R3 evidence form submission, appends a row.
 *
 * Request body (Content-Type: text/plain, raw JSON):
 *   { teacher, curriculum, inspector, date, duration, ..., evidence_type,
 *     focus_context, j_attainment, j_attainment_c, ..., summary_strengths,
 *     summary_weakness, (optional) submitted_at }
 *
 * Response:
 *   { success: true, id: "AIS-R3-YYYYMMDD-HHMM" }
 *   { success: false, error: "..." }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ success: false, error: 'No request body' });
    }
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.openById(getSheetId());
    let sheet = ss.getSheetByName(SHEET_NAME_SUBMISSIONS);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME_SUBMISSIONS);

    const columns = getR3Columns();

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
    const recordId = data.record_id || generateR3RecordId(submittedAt);

    const row = columns.map(function(col) {
      if (col === 'record_id') return recordId;
      if (col === 'submitted_at') return submittedAt;
      if (col === 'observation_date') return data.date || data.observation_date || '';
      return data[col] != null ? data[col] : '';
    });

    sheet.appendRow(row);

    return jsonOut({ success: true, id: recordId });
  } catch (err) {
    return jsonOut({ success: false, error: String(err && err.message || err) });
  }
}

function generateR3RecordId(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = function(n) { return String(n).padStart(2, '0'); };
  return 'AIS-R3-' + d.getFullYear() +
                      pad(d.getMonth() + 1) +
                      pad(d.getDate()) + '-' +
                      pad(d.getHours()) +
                      pad(d.getMinutes());
}
