/**
 * GET handler · returns one record as JSON when called with ?id=...
 *
 * No id → returns a tiny status payload (useful for sanity-check).
 *
 * Response shape:
 *   { success: true,  data: { record_id: ..., teacher: ..., ... } }
 *   { success: false, error: "Record not found" }
 */
function doGet(e) {
  try {
    const id = e && e.parameter && e.parameter.id;
    if (!id) {
      return jsonOut({ success: true, status: 'ok',
                       message: 'AIS Lesson Observation API · pass ?id=AIS-OBS-... to fetch a record' });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonOut({ success: false, error: 'No submissions yet' });
    }

    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idCol = headers.indexOf('record_id');
    if (idCol < 0) return jsonOut({ success: false, error: 'Schema mismatch · record_id column missing' });

    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idCol]) === String(id)) {
        const record = {};
        headers.forEach(function(h, j) { record[h] = values[r][j]; });
        return jsonOut({ success: true, data: record });
      }
    }
    return jsonOut({ success: false, error: 'Record not found · id=' + id });
  } catch (err) {
    return jsonOut({ success: false, error: String(err && err.message || err) });
  }
}
