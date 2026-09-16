/**
 * otp-v0.10 · Reference sync: Sheet -> Supabase, once a day.
 *
 * The OTP form (and later R3) reads its dropdown lists from Supabase
 * (get_form_options RPC, migrate_18_otp_reference.sql) instead of the
 * ?action=options endpoint, because Apps Script answers in 3-5 s with spikes
 * up to 95 s and Supabase answers in well under a second. The Google Sheet
 * stays the MASTER for these lists: Igor edits the tabs here, and this file
 * mirrors five tabs into the Supabase table ref_lists, one tab at a time,
 * replaced wholesale (upsert_reference RPC, service key from Script
 * Properties, the same SUPABASE_SECRET_KEY the dual-write uses).
 *
 *   syncReferenceToSupabase()      the trigger target: pushes only tabs whose
 *                                  content hash changed since the last push
 *   syncReferenceNow()             editor button: pushes every tab, ignores hashes
 *   installReferenceSyncTrigger()  run ONCE from the editor: installs the daily
 *                                  06:30 Asia/Dubai time trigger (idempotent)
 *
 * Tabs mirrored (Supabase tab key <- Sheet tab), read exactly like the
 * options readers in 02_doGet.gs (header row skipped, column A, blanks dropped):
 *   teachers      <- SHEET_NAME_TEACHERS_2627 (falls back to SHEET_NAME_TEACHERS)
 *   otp_coaches   <- SHEET_NAME_OTP_COACHES
 *   r3_inspectors <- SHEET_NAME_INSPECTORS
 *   curriculum    <- SHEET_NAME_CURRICULUM
 *   subjects      <- SHEET_NAME_SUBJECTS (A name, B active, C-E per school)
 *   schools       <- SHEET_NAME_SUBJECTS header C1:E1
 * Names go up as they are in the Sheet; get_form_options applies the same
 * safeForSelector quote substitution the endpoint applies.
 *
 * db/sync_reference.mjs (Mac side, via gws) is the same logic for a manual
 * run and for the proof diff against the live options payload.
 */

const REFERENCE_RPC_PATH = '/rest/v1/rpc/upsert_reference';
const REFERENCE_HASH_PREFIX = 'REF_SYNC_HASH_';
const REFERENCE_TRIGGER_HANDLER = 'syncReferenceToSupabase';

function readReferenceTabs_() {
  const ss = SpreadsheetApp.openById(getSheetId());
  const namesOf = function(sheet) {
    if (!sheet || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
      .map(function(r) { return { name: String(r[0] == null ? '' : r[0]).trim() }; })
      .filter(function(t) { return t.name.length > 0; });
  };
  const truthy = function(v) {
    if (v === true) return true;
    return /^(true|yes|y|1)$/i.test(String(v == null ? '' : v).trim());
  };

  const subjSheet = ss.getSheetByName(SHEET_NAME_SUBJECTS);
  var subjects = [], schools = [{ name: 'Kindy' }, { name: 'Primary' }, { name: 'Secondary' }];
  if (subjSheet && subjSheet.getLastRow() >= 1) {
    const values = subjSheet.getRange(1, 1, subjSheet.getLastRow(), 5).getValues();
    const header = values[0];
    schools = [
      { name: String(header[2] || 'Kindy').trim() },
      { name: String(header[3] || 'Primary').trim() },
      { name: String(header[4] || 'Secondary').trim() }
    ];
    subjects = values.slice(1)
      .filter(function(r) { return String(r[0] == null ? '' : r[0]).trim().length > 0; })
      .map(function(r) {
        return {
          name: String(r[0]).trim(),
          meta: { active: truthy(r[1]), kindy: truthy(r[2]), primary: truthy(r[3]), secondary: truthy(r[4]) }
        };
      });
  }

  return {
    teachers:      namesOf(getTabWithFallback(ss, SHEET_NAME_TEACHERS_2627, SHEET_NAME_TEACHERS)),
    otp_coaches:   namesOf(ss.getSheetByName(SHEET_NAME_OTP_COACHES)),
    r3_inspectors: namesOf(ss.getSheetByName(SHEET_NAME_INSPECTORS)),
    curriculum:    namesOf(ss.getSheetByName(SHEET_NAME_CURRICULUM)),
    subjects:      subjects,
    schools:       schools
  };
}

function referenceHash_(rows) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(rows), Utilities.Charset.UTF_8);
  return bytes.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function pushReferenceTab_(secret, tab, rows) {
  const resp = UrlFetchApp.fetch(SUPABASE_URL + REFERENCE_RPC_PATH, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'apikey': secret, 'Authorization': 'Bearer ' + secret },
    payload: JSON.stringify({ p_tab: tab, p_rows: rows }),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300) throw new Error('upsert_reference ' + tab + ' HTTP ' + code + ': ' + text);
  var out = {};
  try { out = JSON.parse(text); } catch (e) {}
  if (!out.success) throw new Error('upsert_reference ' + tab + ': ' + (out.error || text));
  return out.rows;
}

/**
 * Pushes the tabs whose content changed since the last successful push
 * (SHA-256 of the rows, kept in Script Properties). `force` pushes all.
 * Returns a one-line summary; every tab is independent, so one failing tab
 * never blocks the others, and a failed tab keeps its old hash (retried next run).
 */
function syncReference_(force) {
  const secret = getSupabaseSecret();
  if (!secret) throw new Error('SUPABASE_SECRET_KEY not set in Script Properties');
  const props = PropertiesService.getScriptProperties();
  const tabs = readReferenceTabs_();
  const summary = [];
  Object.keys(tabs).forEach(function(tab) {
    const rows = tabs[tab];
    const hash = referenceHash_(rows);
    const key = REFERENCE_HASH_PREFIX + tab;
    if (!force && props.getProperty(key) === hash) { summary.push(tab + ': unchanged'); return; }
    if (!rows.length && props.getProperty(key)) {
      // a renamed or emptied tab: keep the mirror as it was (upsert_reference refuses too)
      summary.push(tab + ': EMPTY on the Sheet, mirror kept'); return;
    }
    try {
      const n = pushReferenceTab_(secret, tab, rows);
      props.setProperty(key, hash);
      summary.push(tab + ': pushed ' + n);
    } catch (e) {
      summary.push(tab + ': FAILED ' + e.message);
    }
  });
  const line = 'reference sync ' + (force ? '(forced) ' : '') + summary.join(' · ');
  Logger.log(line);
  return line;
}

function syncReferenceToSupabase() { return syncReference_(false); }
function syncReferenceNow()        { return syncReference_(true); }

/** Installs the daily 06:30 Asia/Dubai trigger once (removes any duplicate first). */
function installReferenceSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === REFERENCE_TRIGGER_HANDLER) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(REFERENCE_TRIGGER_HANDLER)
    .timeBased()
    .inTimezone('Asia/Dubai')
    .atHour(6)
    .nearMinute(30)
    .everyDays(1)
    .create();
  return 'installed: ' + REFERENCE_TRIGGER_HANDLER + ' daily 06:30 Asia/Dubai';
}
