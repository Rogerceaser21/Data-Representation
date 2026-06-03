/**
 * Helpers shared by doPost + doGet, plus the one-shot setup functions
 * that get run from the script editor during initial deployment.
 */

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run once in the script editor after the project is created.
 * Touching SpreadsheetApp forces Google to surface the OAuth consent dialog
 * for the spreadsheets scope. Returns the Sheet name on success.
 */
function forceAuth() {
  const ss = SpreadsheetApp.openById(getSheetId());
  return ss.getName();
}

/**
 * One-shot bootstrap: creates the "AIS R3 Evidence" Sheet, sets up the 5 tabs,
 * seeds the reference tabs, shares with igor.sesar@ais.ae, and stores the
 * SHEET_ID in script properties.
 *
 * Idempotent: if SHEET_ID is already set in properties, this function logs
 * the existing ID and exits without creating a duplicate.
 */
function bootstrap() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('SHEET_ID');

  if (existingId) {
    try {
      const ss = SpreadsheetApp.openById(existingId);
      Logger.log('SHEET_ID already set: ' + existingId);
      Logger.log('Sheet URL: ' + ss.getUrl());
      Logger.log('Sheet name: ' + ss.getName());
      return existingId;
    } catch (e) {
      Logger.log('Stored SHEET_ID was invalid (' + existingId + '), creating a fresh Sheet.');
    }
  }

  const ss = SpreadsheetApp.create('AIS R3 Evidence');
  const sheetId = ss.getId();

  // Rename the default Sheet1 to Submissions, then add the rest.
  ss.getSheets()[0].setName(SHEET_NAME_SUBMISSIONS);
  ss.insertSheet(SHEET_NAME_TEACHERS);
  ss.insertSheet(SHEET_NAME_INSPECTORS);
  ss.insertSheet(SHEET_NAME_CURRICULUM);
  ss.insertSheet(SHEET_NAME_SUBJECTS);
  ss.insertSheet(SHEET_NAME_ABILITY_GROUPS);
  ss.insertSheet(SHEET_NAME_GENDERS);

  seedReferenceTab(ss, SHEET_NAME_INSPECTORS,     'Inspector',     SEED_INSPECTORS);
  seedReferenceTab(ss, SHEET_NAME_CURRICULUM,     'Curriculum',    SEED_CURRICULUM);
  seedReferenceTab(ss, SHEET_NAME_SUBJECTS,       'Subject',       SEED_SUBJECTS);
  seedReferenceTab(ss, SHEET_NAME_ABILITY_GROUPS, 'Ability Group', SEED_ABILITY_GROUPS);
  seedReferenceTab(ss, SHEET_NAME_GENDERS,        'Gender',        SEED_GENDERS);
  seedTeachersHeader(ss);

  props.setProperty('SHEET_ID', sheetId);

  // Share with Igor so the file appears in his Drive too.
  try {
    DriveApp.getFileById(sheetId).addEditor('igor.sesar@ais.ae');
  } catch (e) {
    Logger.log('Could not share with igor.sesar@ais.ae automatically: ' + e.message);
  }

  Logger.log('Created Sheet: ' + ss.getName());
  Logger.log('SHEET_ID = ' + sheetId);
  Logger.log('URL: ' + ss.getUrl());
  return sheetId;
}

function seedReferenceTab(ss, tabName, headerLabel, values) {
  const sheet = ss.getSheetByName(tabName);
  const rows = [[headerLabel]].concat(values.map(function(v) { return [v]; }));
  sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 1)
       .setFontWeight('bold')
       .setBackground('#143642')
       .setFontColor('#ffffff');
  sheet.setColumnWidth(1, 240);
}

function seedTeachersHeader(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_TEACHERS);
  sheet.getRange(1, 1, 1, 2).setValues([['email', 'name']]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 2)
       .setFontWeight('bold')
       .setBackground('#143642')
       .setFontColor('#ffffff');
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 200);
}
