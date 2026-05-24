/**
 * Helpers shared by doPost + doGet.
 */
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run once in the script editor after deploying under a new identity.
 * Touching SpreadsheetApp forces Google to surface the OAuth consent dialog
 * for the `spreadsheets` scope. Returns the sheet name on success.
 */
function forceAuth() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getName();
}
