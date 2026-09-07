/**
 * AIS R3 Evidence Form Web App · Config
 *
 * SHEET_ID is stored in PropertiesService (not hardcoded) so the
 * bootstrap() function in 03_helpers.gs can create the Sheet and
 * register the ID without requiring a code change + redeploy.
 *
 * To set up a fresh deployment: open this script in the editor,
 * run bootstrap() once. It creates the Sheet, seeds the reference
 * tabs, and writes the SHEET_ID into script properties.
 */

const SHEET_NAME_SUBMISSIONS = 'Submissions';
const SHEET_NAME_TEACHERS    = 'Teachers 25-26';   // otp-v0.1 deploy 2026-09-03: tab renamed; 26-27 copy is read by the OTP form
const SHEET_NAME_INSPECTORS  = 'Inspectors 25-26'; // otp-v0.1 deploy 2026-09-03: tab renamed; 26-27 copy is read by the OTP form
const SHEET_NAME_CURRICULUM  = 'Curriculum';
const SHEET_NAME_SUBJECTS    = 'Subjects';

const SEED_INSPECTORS = ['Dave Richards', 'Hayden Ryan', 'Brooke Pickett'];
const SEED_CURRICULUM = ['Australian', 'Ministry'];
const SEED_SUBJECTS   = ['Maths', 'English', 'Science', 'Arabic', 'Islamic'];

/**
 * The 6 AIS staff Google Workspace Groups that contain potential R3 observees.
 * Lifted from TRS IRL Project / Google Script Email Trigger / 00_Config.gs.
 */
const TEACHER_GROUPS = [
  'secondary@ais.ae',
  'lsas@ais.ae',
  'jsc@ais.ae',
  'jsm@ais.ae',
  'kindy@ais.ae',
  'ecc@ais.ae'
];

/**
 * Reads the SHEET_ID from PropertiesService. Throws a clear error if not set
 * so doPost / doGet / buildTeacherSheet fail loudly instead of silently
 * writing to the wrong place.
 */
function getSheetId() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) {
    throw new Error('SHEET_ID is not set. Open this script in the editor and run bootstrap() first.');
  }
  return id;
}

/**
 * Column layout for the Submissions tab. Wide-and-flat: every judgement gets
 * a rating column (1-6) AND a comment column.
 *
 * Order is load-bearing once the header row is written. To add columns,
 * append at the end. Never reorder or insert in the middle.
 */
function getR3Columns() {
  const header = [
    'record_id', 'submitted_at',
    'teacher', 'curriculum', 'inspector', 'observation_date',
    'duration', 'room_number', 'grade_class',
    'time_in', 'time_out', 'subject', 'ability_group',
    'gender', 'present', 'support_teachers_cas',
    'num_sen', 'num_gt', 'num_on_roll', 'num_male', 'num_female',
    'evidence_type', 'focus_context'
  ];

  const judgementCategories = [
    'attainment', 'progress', 'learning_skills', 'psd_innovation',
    'teaching', 'assessment', 'curriculum_judgement', 'pcgs',
    'leadership_management', 'other'
  ];

  const judgementCols = [];
  judgementCategories.forEach(function(cat) {
    judgementCols.push('j_' + cat);
    judgementCols.push('j_' + cat + '_c');
  });

  // v0.50: evidence_pad_id appended (Evidence Pad · links the row to the pad
  // pages stored in the private Supabase bucket). Append-only, per the rule above.
  const tail = ['summary_strengths', 'summary_weakness', 'observer_notes', 'school', 'record_token', 'evidence_pad_id'];

  return header.concat(judgementCols, tail);
}

/**
 * Mailbox that receives an email-on-submit copy of every record, plus the
 * locked-record URL with token. Acts as the off-Sheet backup (v0.29).
 */
const BACKUP_EMAIL_TO = 'admin.user@ais.ae';

/**
 * Public URL where the encrypted form is served. Used to construct the
 * locked-record URL in the email body. No trailing query string.
 */
const FORM_PUBLIC_URL = 'https://rogerceaser21.github.io/Data-Representation/Assets/R3/r3-evidence-form.html';

/**
 * Supabase dual-write target (v0.47). Every submission is mirrored into the
 * dashboard's Supabase project via the ingest_r3 RPC, idempotent on record_token.
 * The project ref/URL is NOT secret (it ships in the dashboard). The service_role
 * key IS secret: it is read from Script Properties, never hardcoded here.
 *
 * One-time setup: Project Settings > Script Properties > add
 *   SUPABASE_SECRET_KEY = <the service_role / secret key>
 */
const SUPABASE_URL = 'https://rfbetrcevtmisknndpgg.supabase.co';
const INGEST_RPC_PATH = '/rest/v1/rpc/ingest_r3';

function getSupabaseSecret() {
  return PropertiesService.getScriptProperties().getProperty('SUPABASE_SECRET_KEY');
}

/**
 * Evidence Pad (v0.50): private Supabase Storage bucket holding the pad pages
 * (JPEG) + ink vectors (JSON) per pad id. Written by the form (anon INSERT-only
 * policy), read back here with the service key for the backup-email attachments.
 */
const PAD_BUCKET = 'evidence-pads';

/**
 * Anthropic API key for the Evidence Pad extraction (v0.50). Lives in Supabase
 * app_config under 'anthropic_api_key' (RLS-locked, no anon path exposes it;
 * seeded/rotated by ~/AIS-Data-Dashboard/db/seed_anthropic_key.mjs) so no
 * Script Property has to be set by hand. Fetched with the service key and
 * cached for an hour. Returns null when unavailable (extraction then reports
 * a silent failure; the form degrades to typing/Scribble).
 */
function getAnthropicKey() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('ANTHROPIC_API_KEY');
  if (cached) return cached;
  const secret = getSupabaseSecret();
  if (!secret) return null;
  const resp = UrlFetchApp.fetch(
    SUPABASE_URL + '/rest/v1/app_config?select=value&key=eq.anthropic_api_key',
    { headers: { apikey: secret, Authorization: 'Bearer ' + secret }, muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) return null;
  const rows = JSON.parse(resp.getContentText());
  const key = rows && rows[0] && rows[0].value;
  if (key) cache.put('ANTHROPIC_API_KEY', key, 3600);
  return key || null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * otp-v0.1 · Progress in Lessons OTP form (Lesson Observation WHOLE SCHOOL,
 * Observation against the Outstanding Teacher Profile).
 *
 * A THIRD form on the SAME script project and the SAME Sheet as R3. It writes
 * its own tab with its own column schema; nothing below changes an R3 constant.
 * ───────────────────────────────────────────────────────────────────────────── */

const SHEET_NAME_OTP_SUBMISSIONS = 'OTP Submissions';

/**
 * 26-07 roster tabs. Igor creates these later; until they exist the OTP form
 * silently reads the R3 roster tabs instead (getTabWithFallback), so the form
 * never shows an empty dropdown or an error (hard rule 12).
 */
const SHEET_NAME_TEACHERS_2627   = 'Teachers 26-27';
const SHEET_NAME_INSPECTORS_2627 = 'Inspectors 26-27';

/**
 * Returns the preferred tab, or the fallback tab when the preferred one does
 * not exist yet. Returns null when neither exists (callers already treat a
 * missing tab as "no options", never as an error).
 */
function getTabWithFallback(ss, preferred, fallback) {
  const wanted = ss.getSheetByName(preferred);
  if (wanted) return wanted;
  return ss.getSheetByName(fallback);
}

/**
 * Column layout for the OTP Submissions tab (29 columns).
 *
 * Order is load-bearing once the header row is written (hard rule 1). To add
 * columns, append at the end. Never reorder or insert in the middle.
 *
 * `observer` holds the person who observed: the form still posts that field as
 * `inspector` (it is a copy of the R3 master), the Sheet calls it observer.
 * There is no time_out, so no duration column.
 */
function getOtpColumns() {
  return [
    'record_id', 'submitted_at',
    'teacher', 'curriculum', 'observer', 'observation_date',
    'room_number', 'time_in', 'subject', 'school', 'support_teachers_cas',
    'otp_ref', 'otp_aspect',
    'sp1_beginner', 'sp1_emerging', 'sp1_good', 'sp1_great', 'sp1_outstanding',
    'sp1_selected_text',
    'observer_comments', 'other_observations',
    'next_step_1', 'next_step_2', 'next_step_3',
    'record_token', 'evidence_pad_id',
    // otp-v0.2: sp1_present / sp1_partially_present / sp1_not_present hold
    // the rubric chips' colour state, grouped by criterion. Append-only, per
    // the rule above.
    'sp1_present', 'sp1_partially_present', 'sp1_not_present'
  ];
}

/**
 * Public URL where the encrypted OTP form is served, and the ungated
 * record-link-only viewer teachers receive. The backup email links the VIEWER
 * (token only); the form URL is here for parity with FORM_PUBLIC_URL.
 */
const FORM_PUBLIC_URL_OTP   = 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-progress-form.html';
const RECORD_VIEWER_URL_OTP = 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-record.html';

/**
 * Supabase dual-write target for OTP submissions (hard rule 14: Sheet first,
 * mirror inside its own try/catch, idempotent server-side on record_token).
 * Same project + same service_role secret as the R3 bridge; different RPC.
 */
const INGEST_RPC_PATH_OTP = '/rest/v1/rpc/ingest_otp';
