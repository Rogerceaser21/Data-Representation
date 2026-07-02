// One-shot OAuth consent: run this first in the editor and click through the consent screen.
function forceAuth() {
  Drive.Files.list({ pageSize: 1 });                       // drive.readonly + advanced service
  UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/', { muteHttpExceptions: true });  // external_request
  PropertiesService.getScriptProperties();
  console.log('auth OK');
}

// Read-only wiring check before the first sync: secret set, Supabase reachable, Drive visible.
function checkSetup() {
  var key = getSupabaseSecret();
  if (key.slice(0, 3) !== 'eyJ') {
    console.warn('SUPABASE_SECRET_KEY does not look like the legacy service_role JWT (must start "eyJ"; sb_secret_ keys cannot work from Apps Script)');
  }
  var rows = sbGet_('/rest/v1/teachers?select=id&limit=1');
  var files = listDrivePhotos_();
  console.log('setup OK: supabase reachable (' + rows.length + ' row) · drive photos visible: ' + files.length);
}

// Daily trigger at ~03:00 script timezone (Asia/Dubai). Re-runnable: clears its own duplicates.
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncPhotos') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncPhotos').timeBased().everyDays(1).atHour(3).create();
  console.log('daily trigger installed (03:00)');
}
