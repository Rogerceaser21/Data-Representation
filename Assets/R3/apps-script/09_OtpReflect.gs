/**
 * otp-v0.14 · the Teacher Reflection + Plan flow's Apps Script side (contract
 * section 4, ~/Developer/claudex-runs/otp-v0.14/CONTRACT.md).
 *
 * Supabase (migrate_27_otp_reflections.sql) holds the teacher's answers in
 * otp_reflections (one row per record_token+part) and mints teacher_token
 * inside otp_write, only when the client posts reflection_flow:true. This
 * file:
 *
 *   handleOtpReflectMirror(data)   doPost route for
 *                                  { form:'otp', action:'reflect_mirror',
 *                                  record_token }: otp-reflect (edge function)
 *                                  calls this after otp_reflect_write succeeds.
 *   healOtpReflections_()          the reflections half of the heal sweep
 *                                  (healOtpMirror, 08_OtpMirror.gs): sweeps
 *                                  otp_reflections_unmirrored.
 *
 * Both read Supabase's CURRENT state for the token (otp_reflection_for_mirror),
 * never the payload, so two mirrors arriving out of order both settle on the
 * same result: for every reflection part NOT YET mirrored (mirrored_at null,
 * which also means neither email stamp is set, mark_reflection_mirrored sets
 * all three together) they
 *   1. write or update ONE row per (record_id, part) on the "OTP Reflections"
 *      tab (never a duplicate on a second mirror of the same part),
 *   2. send ONE E2 "thank you" email to the teacher covering every pending
 *      part that still owes its teacher stamp, and ONE E4 "answers received"
 *      email to the coach covering every pending part that still owes its
 *      coach stamp (a Close Lap that lands with Part 1 still owed can hand
 *      the teacher both parts to send in one go, so both can be pending
 *      together; a lap opened normally sends Part 1 alone, then Part 2 alone
 *      after Close Lap; a part whose Sheet row already exists, e.g. a prior
 *      run that wrote the row then died before MailApp, still owes whichever
 *      stamp is still blank on it, and gets it here rather than being marked
 *      mirrored unsent),
 *   3. mark_reflection_mirrored per part with whichever stamp is now set
 *      (already on the row, or just sent).
 *
 * E1 (the submit-time invite) and E3 (the close-time Next Steps + plan
 * invite) replace sendOtpTeacherEmail / sendOtpCloseEmail (01_doPost.gs) when
 * the record carries a teacher_token; see those functions for the branch. A
 * record without a token is completely untouched by this file: every legacy
 * email stays byte-identical (hard rule per the contract).
 *
 * Hard rule 12 throughout: nothing here ever throws its way back to a
 * caller that would surface an error to a teacher or coach; every Supabase
 * call and every MailApp.sendEmail sits in its own try/catch, logged and
 * swallowed on failure.
 */

const OTP_REFLECT_RPC_FOR_MIRROR = '/rest/v1/rpc/otp_reflection_for_mirror';
const OTP_REFLECT_RPC_MARK       = '/rest/v1/rpc/mark_reflection_mirrored';
const OTP_REFLECT_RPC_UNMIRRORED = '/rest/v1/rpc/otp_reflections_unmirrored';
const OTP_REFLECT_RPC_STATE      = '/rest/v1/rpc/otp_reflect_state';
const SHEET_NAME_OTP_REFLECTIONS = 'OTP Reflections';
const OTP_REFLECT_HEAL_BATCH     = 5;   // tokens per run; mirrors OTP_HEAL_BATCH's reasoning

// The question wording is exact (contract section 3); reused here for the
// coach email (E4) and the teacher invite's three-question box (E1).
const OTP_REFLECT_QUESTIONS = {
  q1: 'How did the lesson go? What worked, and what did not?',
  q2: 'Where was student progress?',
  q3: 'Is there anything your coach should know before you meet?',
  q4: 'What challenges do you expect?',
  q5: 'What are your own ideas to overcome them?',
  q6: 'How will you put them in place, and from when?',
  q7: 'What support do you need and who would be most likely to provide it?',
  q8: 'What change in student learning do you expect, and by when?'
};

/** The "OTP Reflections" tab's column order (17 columns). Append-only. */
function getOtpReflectionColumns() {
  return [
    'record_id', 'lap', 'teacher', 'observer', 'part', 'submitted_at',
    'q1', 'q2_level', 'q2_comment', 'q3',
    'q4', 'q5', 'q6', 'q7', 'q8',
    'teacher_emailed_at', 'coach_emailed_at'
  ];
}

/** The OTP Reflections tab with its header row present, same styling as getOtpSheetWithHeader_. */
function getOtpReflectionsSheetWithHeader_(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME_OTP_REFLECTIONS);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME_OTP_REFLECTIONS);
  const columns = getOtpReflectionColumns();
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columns.length)
         .setFontWeight('bold')
         .setBackground('#143642')
         .setFontColor('#ffffff');
    sheet.setColumnWidths(1, columns.length, 140);
  } else if (sheet.getLastColumn() < columns.length) {
    const from = sheet.getLastColumn();
    sheet.getRange(1, from + 1, 1, columns.length - from)
         .setValues([columns.slice(from)])
         .setFontWeight('bold')
         .setBackground('#143642')
         .setFontColor('#ffffff');
  }
  return sheet;
}

/** { rowIdx } (0-based data index, -1 = none) for the row matching record_id + part. */
function findOtpReflectionRow_(sheet, recordId, part) {
  if (sheet.getLastRow() < 2) return { rowIdx: -1 };
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('record_id');
  const partCol = headers.indexOf('part');
  if (idCol < 0 || partCol < 0) return { rowIdx: -1 };
  const wantId = String(recordId || '').trim();
  const wantPart = Number(part);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol] || '').trim() === wantId && Number(values[r][partCol]) === wantPart) {
      return { rowIdx: r };
    }
  }
  return { rowIdx: -1 };
}

/** One "OTP Reflections" row for `reflection` ({part, answers, submitted_at, ...}), keyed by column name. */
function otpReflectionRowValues_(record, reflection) {
  const a = (reflection && reflection.answers) || {};
  const part = Number(reflection.part);
  const blank = function(v) { return v == null ? '' : v; };
  return {
    record_id: record.record_id,
    lap: record.lap,
    teacher: record.teacher,
    observer: record.observer,
    part: part,
    submitted_at: reflection.submitted_at,
    q1: part === 1 ? blank(a.q1) : '',
    q2_level: part === 1 ? blank(a.q2_level) : '',
    q2_comment: part === 1 ? blank(a.q2_comment) : '',
    q3: part === 1 ? blank(a.q3) : '',
    q4: part === 2 ? blank(a.q4) : '',
    q5: part === 2 ? blank(a.q5) : '',
    q6: part === 2 ? blank(a.q6) : '',
    q7: part === 2 ? blank(a.q7) : '',
    q8: part === 2 ? blank(a.q8) : '',
    teacher_emailed_at: '',
    coach_emailed_at: ''
  };
}

/** Writes or updates ONE row per (record_id, part); never a duplicate on a second mirror. */
function upsertOtpReflectionRow_(sheet, record, reflection) {
  const headers = getOtpReflectionColumns();
  const values = otpReflectionRowValues_(record, reflection);
  const rowValues = headers.map(function(h) { return values[h] != null ? values[h] : ''; });
  const found = findOtpReflectionRow_(sheet, record.record_id, reflection.part);
  if (found.rowIdx < 0) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(found.rowIdx + 1, 1, 1, headers.length).setValues([rowValues]);
  }
}

/** Fills teacher_emailed_at / coach_emailed_at on an existing reflection row, leaving a blank arg untouched. */
function setOtpReflectionRowStamps_(sheet, recordId, part, teacherAt, coachAt) {
  const headers = getOtpReflectionColumns();
  const found = findOtpReflectionRow_(sheet, recordId, part);
  if (found.rowIdx < 0) return;
  const tCol = headers.indexOf('teacher_emailed_at') + 1;
  const cCol = headers.indexOf('coach_emailed_at') + 1;
  if (tCol > 0 && teacherAt) sheet.getRange(found.rowIdx + 1, tCol, 1, 1).setValues([[teacherAt]]);
  if (cCol > 0 && coachAt) sheet.getRange(found.rowIdx + 1, cCol, 1, 1).setValues([[coachAt]]);
}

/** Reads teacher_emailed_at / coach_emailed_at off an existing reflection row ('' for either if absent or no row). */
function readOtpReflectionRowStamps_(sheet, recordId, part) {
  const headers = getOtpReflectionColumns();
  const found = findOtpReflectionRow_(sheet, recordId, part);
  if (found.rowIdx < 0) return { teacherEmailedAt: '', coachEmailedAt: '' };
  const tCol = headers.indexOf('teacher_emailed_at');
  const cCol = headers.indexOf('coach_emailed_at');
  const row = sheet.getRange(found.rowIdx + 1, 1, 1, headers.length).getValues()[0];
  return {
    teacherEmailedAt: tCol >= 0 ? String(row[tCol] || '') : '',
    coachEmailedAt: cCol >= 0 ? String(row[cCol] || '') : ''
  };
}

/**
 * Supabase's CURRENT state for one record_token (otp_reflection_for_mirror,
 * service key): { found, record (incl. teacher_token), reflections, links }.
 * Throws on a transport/HTTP failure (caller decides what that means); a
 * clean {found:false} answer returns null.
 */
function fetchOtpReflectionForMirror_(recordToken) {
  const secret = getSupabaseSecret();
  if (!secret) throw new Error('SUPABASE_SECRET_KEY not set');
  const resp = UrlFetchApp.fetch(SUPABASE_URL + OTP_REFLECT_RPC_FOR_MIRROR, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'apikey': secret, 'Authorization': 'Bearer ' + secret },
    payload: JSON.stringify({ p_record_token: recordToken }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) throw new Error('otp_reflection_for_mirror HTTP ' + resp.getResponseCode());
  const out = JSON.parse(resp.getContentText());
  return out && out.found ? out : null;
}

/** mark_reflection_mirrored (service key). True when a row was updated. */
function markReflectionMirrored_(recordToken, part, teacherAt, coachAt) {
  const secret = getSupabaseSecret();
  if (!secret) { Logger.log('OTP reflect mirror: SUPABASE_SECRET_KEY not set, cannot mark'); return false; }
  const resp = UrlFetchApp.fetch(SUPABASE_URL + OTP_REFLECT_RPC_MARK, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'apikey': secret, 'Authorization': 'Bearer ' + secret },
    payload: JSON.stringify({
      p_record_token: recordToken, p_part: part,
      p_teacher_at: teacherAt || null, p_coach_at: coachAt || null
    }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    Logger.log('OTP reflect mirror: mark_reflection_mirrored HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText());
    return false;
  }
  var out = {};
  try { out = JSON.parse(resp.getContentText()); } catch (e) {}
  return !!(out && Number(out.marked) > 0);
}

/**
 * otp_reflect_state (service key): {found, ..., view_unlocked, ...} for one
 * teacher_token, or null on a miss or a fetch failure. Used only by E3 to
 * decide whether Part 1 has already been sent (the close email carries a
 * view link only when it has).
 */
function fetchOtpReflectState_(teacherToken) {
  const secret = getSupabaseSecret();
  if (!secret) return null;
  try {
    const resp = UrlFetchApp.fetch(SUPABASE_URL + OTP_REFLECT_RPC_STATE, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'apikey': secret, 'Authorization': 'Bearer ' + secret },
      payload: JSON.stringify({ p_teacher_token: teacherToken }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return null;
    const out = JSON.parse(resp.getContentText());
    return out && out.found ? out : null;
  } catch (e) {
    Logger.log('OTP reflect state: fetch failed: ' + e.message);
    return null;
  }
}

/**
 * The {reflect, view} link pair for a record. `record._links` (set by
 * mirrorOtpTokenFromSupabase_, 08_OtpMirror.gs) is used when present; the
 * legacy direct-close fallback path (handleOtpUpdateOrCloseLocked_,
 * 01_doPost.gs) never sets it, so this falls back to a live
 * otp_record_for_mirror read (a for_mirror function, per the contract: no
 * link URL is ever hard-coded here). Returns null when neither is available,
 * so the caller can skip sending rather than build a broken link.
 */
function otpLinksFor_(record) {
  if (record && record._links && record._links.reflect && record._links.view) return record._links;
  try {
    const cur = fetchOtpRecordForMirror_(String((record && record.record_token) || '').trim());
    if (cur && cur.links && cur.links.reflect && cur.links.view) return cur.links;
  } catch (e) {
    Logger.log('OTP reflect links: live fetch failed for ' + (record && record.record_id) + ': ' + e.message);
  }
  return null;
}

/** The teacher's own display name's first word ("there" when it is blank). */
function otpFirstName_(fullName) {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

/* ── the AIS canonical email template (~/.claude/skills/ais-email/template.html),
 * inlined with cid: images (E1/E2/E3 only; E4 to the coach stays the existing
 * plain style). ───────────────────────────────────────────────────────────── */

function otpReflectEmailEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildOtpReflectEmailHtml_(heading, eyebrowText, bodyBlocksHtml) {
  const esc = otpReflectEmailEsc_;
  const year = new Date().getFullYear();
  var html = '';
  html += '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
  html += '<html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type" /><meta name="x-apple-disable-message-reformatting" /><title>' + esc(heading) + '</title>';
  html += '<style type="text/css">@import url(\'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap\');body,table,td,div,p,span,a,h1,h2,h3,h4,h5,h6,strong,b,i,em{font-family:Poppins,Arial,sans-serif;}</style>';
  html += '<!--[if mso]><style type="text/css">body, table, td, div, p, span, a, h1, h2, h3, h4, h5, h6 { font-family: Poppins, Arial, sans-serif !important; }</style><![endif]-->';
  html += '</head><body style="background-color:#F5F3FF;font-family:Poppins,sans-serif;padding-top:40px;padding-bottom:40px;margin:0;">';
  html += '<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFFFF;max-width:640px;margin-left:auto;margin-right:auto;border:none;border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;"><tbody><tr style="width:100%"><td style="padding:48px 24px;">';
  html += '<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;"><tbody><tr><td><img src="cid:ais_header" alt="AIS" width="144" height="56" style="height:56px;width:auto;object-fit:contain;" /></td></tr></tbody></table>';
  html += '<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;"><tbody><tr><td><h1 style="font-size:24px;font-weight:600;color:#09090B;margin:0;line-height:32px;font-family:Poppins,sans-serif;">' + esc(heading) + '</h1></td></tr></tbody></table>';
  html += '<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;"><tbody><tr><td><p style="font-size:14px;color:#8B5CF6;margin:0;line-height:20px;font-family:Poppins,sans-serif;font-weight:500;letter-spacing:0.2px;">' + esc(eyebrowText) + '</p></td></tr></tbody></table>';
  html += bodyBlocksHtml;
  html += '<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;"><tbody><tr><td><p style="font-size:16px;color:#3F3F46;line-height:24px;margin:0;font-family:Poppins,sans-serif;font-weight:400;">Kind regards,<br>AIS OTP Progress</p></td></tr></tbody></table>';
  html += '<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:0;"><tbody><tr><td><img src="cid:ais_signature" alt="AIS - Australian International School" width="592" style="max-width:100%;height:auto;display:block;" /></td></tr></tbody></table>';
  html += '</td></tr></tbody></table>';
  html += '<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;margin-left:auto;margin-right:auto;"><tbody><tr><td style="padding:24px 24px 32px 24px;text-align:left;vertical-align:middle;"><p style="font-size:12px;color:#71717A;line-height:18px;margin:0;font-family:Poppins,sans-serif;font-weight:400;opacity:0.72;"><span style="color:#71717A;opacity:0.72;">&copy; ' + year + ' AIS. All rights reserved.</span></p></td></tr></tbody></table>';
  html += '</body></html>';
  return html;
}

function otpEmailParaBlock_(text, opts) {
  opts = opts || {};
  const esc = otpReflectEmailEsc_;
  const color = opts.purpleBold ? '#8B5CF6' : '#3F3F46';
  const weight = opts.purpleBold ? '700' : '400';
  return '<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;"><tbody><tr><td><p style="font-size:16px;color:' + color + ';line-height:24px;margin:0;font-family:Poppins,sans-serif;font-weight:' + weight + ';">' + esc(text) + '</p></td></tr></tbody></table>';
}

/** A purple highlight box of numbered lines (the three questions on E1, the Next Steps on E3). */
function otpEmailNumberedBoxBlock_(items) {
  const esc = otpReflectEmailEsc_;
  const rows = items.map(function(text, i) {
    return '<p style="font-family:Poppins,sans-serif;font-size:15px;color:#3F3F46;margin:0 0 8px"><b style="color:#8B5CF6">' + (i + 1) + '</b>&nbsp; ' + esc(text) + '</p>';
  }).join('');
  return '<table width="100%" role="presentation" style="margin-bottom:20px"><tbody><tr><td style="background:#F5F3FF;border-left:4px solid #8B5CF6;border-radius:4px;padding:14px 16px">' + rows + '</td></tr></tbody></table>';
}

function otpEmailButtonBlock_(label, url) {
  const esc = otpReflectEmailEsc_;
  return '<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;"><tbody><tr><td align="left"><a href="' + esc(url) + '" style="background-color:#8B5CF6;color:#FFFFFF;text-decoration:none;padding:11px 20px;border-radius:6px;font-family:Poppins,Arial,sans-serif;font-size:15px;font-weight:600;display:inline-block;line-height:20px;">' + esc(label) + '</a></td></tr></tbody></table>';
}

/** A plain inline text link, not a button (E3's secondary "Your observation:" line). */
function otpEmailTextLinkBlock_(label, url) {
  const esc = otpReflectEmailEsc_;
  return '<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;"><tbody><tr><td><p style="font-size:16px;color:#3F3F46;line-height:24px;margin:0;font-family:Poppins,sans-serif;font-weight:400;"><a href="' + esc(url) + '" style="color:#143642;font-weight:700;text-decoration:underline;">' + esc(label) + '</a></p></td></tr></tbody></table>';
}

const OTP_EMAIL_HEADER_IMG_URL    = 'https://rogerceaser21.github.io/Data-Representation/Assets/brand/email/ais_header_framed.png';
const OTP_EMAIL_SIGNATURE_IMG_URL = 'https://rogerceaser21.github.io/Data-Representation/Assets/brand/email/Secondary.png';

/** One brand image blob, or null on any fetch failure (hard rule 12: never fails the send). */
function fetchOtpBrandImageBlob_(url) {
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;
    return resp.getBlob();
  } catch (e) {
    Logger.log('OTP reflect email: image fetch failed for ' + url + ': ' + e.message);
    return null;
  }
}

/** { ais_header, ais_signature } inlineImages map; a failed fetch simply omits that key. */
function otpReflectEmailImages_() {
  const images = {};
  const header = fetchOtpBrandImageBlob_(OTP_EMAIL_HEADER_IMG_URL);
  if (header) images.ais_header = header;
  const signature = fetchOtpBrandImageBlob_(OTP_EMAIL_SIGNATURE_IMG_URL);
  if (signature) images.ais_signature = signature;
  return images;
}

/**
 * E1 · the submit-time invite, replacing sendOtpTeacherEmail's legacy copy
 * when the record carries a teacher_token. Same subject formula as the
 * legacy copy (contract: "subject unchanged"). No view link, no record
 * token anywhere.
 */
function sendOtpReflectInviteEmail_(ss, teacherEmail, teacherToken, data) {
  const links = otpLinksFor_(data);
  if (!links) { Logger.log('OTP reflect invite: no links for ' + (data && data.record_id)); return false; }

  const observerName = String(data.inspector || data.observer || 'Your observer').trim();
  const obsDate = String(data.date || data.observation_date || '').trim();
  const subjectArea = String(data.subject || '').trim();
  const eyebrow = 'OTP · Observation ' + data.lap + ' · ' + obsDate;
  const subject = 'AIS OTP Observation ' + data.lap + ' · ' + obsDate;

  var blocks = '';
  blocks += otpEmailParaBlock_('Hi ' + otpFirstName_(data.teacher) + ',');
  blocks += otpEmailParaBlock_(observerName + ' observed your ' + subjectArea + ' lesson on ' + obsDate + '. Before you meet, please answer three short questions about how you felt the lesson went. It takes about five minutes.');
  blocks += otpEmailParaBlock_('Your coach\'s notes open for you as soon as you send your answers.', { purpleBold: true });
  blocks += otpEmailNumberedBoxBlock_([OTP_REFLECT_QUESTIONS.q1, OTP_REFLECT_QUESTIONS.q2, OTP_REFLECT_QUESTIONS.q3]);
  blocks += otpEmailButtonBlock_('Reflect on your lesson', links.reflect + '?t=' + encodeURIComponent(teacherToken));

  MailApp.sendEmail({
    to: teacherEmail,
    subject: subject,
    htmlBody: buildOtpReflectEmailHtml_('Reflect on your lesson', eyebrow, blocks),
    name: 'AIS OTP Progress',
    inlineImages: otpReflectEmailImages_()
  });
  return true;
}

/**
 * E3 · the close-time Next Steps + plan invite, replacing sendOtpCloseEmail's
 * legacy copy when the record carries a teacher_token. Same To/CC/subject as
 * the legacy copy. The view link only appears once Part 1 has been sent
 * (otp_reflect_state's view_unlocked); a state-fetch failure is treated the
 * same as "not sent yet" (no broken link, hard rule 12).
 */
function sendOtpReflectCloseEmail_(ss, record, teacherToken) {
  const teacherEmail = lookupOtpTeacherEmail(ss, record.teacher);
  if (!teacherEmail || teacherEmail.indexOf('@') < 0) return false;
  const links = otpLinksFor_(record);
  if (!links) { Logger.log('OTP reflect close: no links for ' + record.record_id); return false; }

  const observerName = String(record.observer || 'your observer').trim();
  const teacherName = String(record.teacher || '(no teacher)').trim();
  const obsDate = String(record.observation_date || '').trim();
  const closedDate = formatStampSafe(record.closed_at);
  const eyebrow = 'OTP · Observation ' + record.lap + ' · ' + obsDate;
  const subject = 'AIS OTP Observation ' + record.lap + ' · ' + teacherName + ' · ' + obsDate;

  const s1 = String(record.next_step_1 || '').trim();
  const s2 = String(record.next_step_2 || '').trim();
  const s3 = String(record.next_step_3 || '').trim();

  var blocks = '';
  blocks += otpEmailParaBlock_('Hi ' + otpFirstName_(record.teacher) + ',');
  blocks += otpEmailParaBlock_('Observation ' + record.lap + ' was closed on ' + closedDate + '.');
  blocks += otpEmailParaBlock_('Next Steps agreed with ' + observerName + ':');
  blocks += otpEmailNumberedBoxBlock_([s1, s2, s3]);
  blocks += otpEmailParaBlock_('Please plan how you will put these in place. It takes about ten minutes.');
  blocks += otpEmailButtonBlock_('Plan your next steps', links.reflect + '?t=' + encodeURIComponent(teacherToken));

  const state = fetchOtpReflectState_(teacherToken);
  const part1Sent = !!(state && state.view_unlocked);
  if (part1Sent) {
    blocks += otpEmailParaBlock_('Your observation:');
    blocks += otpEmailTextLinkBlock_('Click here to view.', links.view + '?t=' + encodeURIComponent(teacherToken));
  } else {
    blocks += otpEmailParaBlock_('Your observation opens once you send your answers, including the three questions from before.');
  }

  const opts = {
    to: teacherEmail,
    subject: subject,
    htmlBody: buildOtpReflectEmailHtml_('Plan your next steps', eyebrow, blocks),
    name: 'AIS OTP Progress',
    inlineImages: otpReflectEmailImages_()
  };
  const observerEmail = lookupOtpObserverEmail(ss, record.observer);
  const cc = [];
  if (observerEmail && observerEmail.indexOf('@') > -1) cc.push(observerEmail);
  cc.push(BACKUP_EMAIL_TO);
  opts.cc = cc.join(',');

  MailApp.sendEmail(opts);
  return true;
}

/**
 * E2 · the thank-you sent once a part (or both, when Close Lap handed the
 * teacher Part 1 and Part 2 together) is mirrored. `parts` are the pending
 * reflection rows this mirror is processing (each {part, answers,
 * submitted_at, ...}); Part 2 wording wins whenever Part 2 is among them
 * (alone or together with Part 1), matching the contract's "Part 2 (or both
 * at once after close)" wording.
 */
function sendOtpReflectThankYouEmail_(ss, record, links, parts) {
  const teacherEmail = lookupOtpTeacherEmail(ss, record.teacher);
  if (!teacherEmail || teacherEmail.indexOf('@') < 0) return false;
  const resolvedLinks = (links && links.view) ? links : otpLinksFor_(record);
  if (!resolvedLinks) { Logger.log('OTP reflect thank-you: no links for ' + record.record_id); return false; }

  const teacherToken = String(record.teacher_token || '').trim();
  const observerName = String(record.observer || 'Your observer').trim();
  const obsDate = String(record.observation_date || '').trim();
  const eyebrow = 'OTP · Observation ' + record.lap + ' · ' + obsDate;
  const subject = 'AIS OTP Observation ' + record.lap + ' · ' + obsDate;
  const hasPart2 = parts.some(function(p) { return Number(p.part) === 2; });

  var blocks = '';
  blocks += otpEmailParaBlock_('Hi ' + otpFirstName_(record.teacher) + ',');
  if (hasPart2) {
    blocks += otpEmailParaBlock_('Thank you for sending your plan. Here is your observation.');
  } else {
    blocks += otpEmailParaBlock_('Thank you for sending your reflection. Your observation is now open for you.');
  }
  blocks += otpEmailButtonBlock_('Click here to view.', resolvedLinks.view + '?t=' + encodeURIComponent(teacherToken));
  if (!hasPart2) {
    blocks += otpEmailParaBlock_(observerName + ' will arrange a time to go through it with you and agree your next steps together.');
  }

  MailApp.sendEmail({
    to: teacherEmail,
    subject: subject,
    htmlBody: buildOtpReflectEmailHtml_('Thank you. Here is your observation', eyebrow, blocks),
    name: 'AIS OTP Progress',
    inlineImages: otpReflectEmailImages_()
  });
  return true;
}

/**
 * E4 · the coach's copy of the answers, sent alongside E2. Plain style like
 * the existing coach emails (sendOtpCloseEmail's legacy body), not the
 * canonical template. `parts` are the same pending reflections E2 covers.
 */
function sendOtpReflectCoachEmail_(ss, record, parts) {
  const observerEmail = lookupOtpObserverEmail(ss, record.observer);
  if (!observerEmail || observerEmail.indexOf('@') < 0) return false;

  const hasPart1 = parts.some(function(p) { return Number(p.part) === 1; });
  const hasPart2 = parts.some(function(p) { return Number(p.part) === 2; });
  const suffix = hasPart1 && hasPart2 ? 'Reflection and plan received' : (hasPart2 ? 'Plan received' : 'Reflection received');
  const teacherName = String(record.teacher || '(no teacher)').trim();
  const subject = 'AIS OTP Observation ' + record.lap + ' · ' + teacherName + ' · ' + suffix;

  const esc = otpReflectEmailEsc_;
  const qa = function(label, value) {
    return '<p style="margin:0 0 12px;"><b>' + esc(label) + '</b><br>' + esc(value).replace(/\r\n|\r|\n/g, '<br>') + '</p>';
  };

  var body = '';
  parts.slice().sort(function(a, b) { return Number(a.part) - Number(b.part); }).forEach(function(p) {
    const answers = p.answers || {};
    if (Number(p.part) === 1) {
      body += qa(OTP_REFLECT_QUESTIONS.q1, answers.q1);
      var q2 = String(answers.q2_level || '').trim();
      var q2Comment = String(answers.q2_comment || '').trim();
      body += qa(OTP_REFLECT_QUESTIONS.q2, 'Level: ' + q2 + (q2Comment ? '. Comment: ' + q2Comment : ''));
      body += qa(OTP_REFLECT_QUESTIONS.q3, answers.q3);
    } else {
      body += qa(OTP_REFLECT_QUESTIONS.q4, answers.q4);
      body += qa(OTP_REFLECT_QUESTIONS.q5, answers.q5);
      body += qa(OTP_REFLECT_QUESTIONS.q6, answers.q6);
      body += qa(OTP_REFLECT_QUESTIONS.q7, answers.q7);
      body += qa(OTP_REFLECT_QUESTIONS.q8, answers.q8);
    }
  });

  const recordToken = String(record.record_token || '').trim();
  const link = '<a href="' + esc(RECORD_VIEWER_URL_OTP + '?token=' + encodeURIComponent(recordToken)) + '" style="color:#143642;font-weight:700;text-decoration:underline;">Click here to view.</a>';
  body += '<p style="margin:0;">Full record:<br>' + link + '</p>';

  MailApp.sendEmail({
    to: observerEmail,
    cc: BACKUP_EMAIL_TO,
    subject: subject,
    htmlBody: '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#143642;font-size:14px;line-height:1.5;">' + body + '</div>',
    name: 'AIS OTP Progress'
  });
  return true;
}

/** doPost route for { form:'otp', action:'reflect_mirror', record_token }. */
function handleOtpReflectMirror(data) {
  const token = String((data && data.record_token) || '').trim();
  if (!otpTokenOk_(token)) return jsonOut({ success: false, error: 'bad record' });
  const out = mirrorOtpReflectionsFromSupabase_(token);
  if (!out) return jsonOut({ success: false, error: 'Record not found' });
  return jsonOut({ success: true, mirrored: out.mirrored, parts: out.parts });
}

/**
 * Mirrors every not-yet-mirrored reflection part of one record_token: tab
 * row(s), E2 + E4, then mark_reflection_mirrored per part. Returns
 * { mirrored, parts } (mirrored counts parts successfully marked), or null
 * when Supabase has no such record.
 *
 * Every pending part is decided ON ITS OWN CURRENT STAMPS, whether its Sheet
 * row is brand new (stamps blank) or already exists (stamps read off the
 * row): a part still needs E2 when its teacher stamp is empty, still needs
 * E4 when its coach stamp is empty. ONE E2 covers every part that needs it
 * and ONE E4 covers every part that needs it, so two parts landing together
 * (fresh, heal, or a fresh part alongside a stuck existing one) still get
 * exactly one of each (skeptic-found, 2026-09-25: the previous split between
 * "reallyPending" and "already has a row" meant an existing-but-unmarked row
 * with BOTH stamps still empty, e.g. a run that wrote the row then died
 * before MailApp, was marked mirrored on heal without ever sending E2 or E4).
 * A part whose stamp is already set is never re-emailed, only re-marked
 * (idempotent: mark_reflection_mirrored fills a stamp only when it is null).
 *
 * `allowMarkExisting` (default false): when a part's Sheet row already
 * exists at lock time, an ordinary mirror call (the reflect_mirror doPost
 * route, fired the moment a submit lands) drops it entirely, assuming a
 * same-moment racer (the edge function's waitUntil, or a retried POST) is
 * already finishing that exact part. The heal sweep passes true: by the
 * time otp_reflections_unmirrored lists a part (mirror_pending_since older
 * than OTP_HEAL_OLDER_THAN_S), any genuine racer has long since finished or
 * failed, so an existing row is heal's to finish, sending whatever it still
 * owes and never rewriting the row's answers.
 */
function mirrorOtpReflectionsFromSupabase_(token, allowMarkExisting) {
  const cur = fetchOtpReflectionForMirror_(token);
  if (!cur) return null;
  const record = cur.record;
  const links = cur.links || {};
  const pending = (cur.reflections || []).filter(function(r) { return !r.mirrored_at; });
  const out = { mirrored: 0, parts: [] };
  if (!pending.length) return out;

  const ss = SpreadsheetApp.openById(getSheetId());
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var items = [];   // one entry per part this call handles: { reflection, isNew, teacherEmailedAt, coachEmailedAt, needTeacher, needCoach }
  var teacherStampAt = '';
  var coachStampAt = '';
  try {
    const sheet = getOtpReflectionsSheetWithHeader_(ss);
    pending.forEach(function(r) {
      const found = findOtpReflectionRow_(sheet, record.record_id, r.part);
      if (found.rowIdx < 0) {
        items.push({ reflection: r, isNew: true, teacherEmailedAt: '', coachEmailedAt: '' });
      } else if (allowMarkExisting) {
        const stamps = readOtpReflectionRowStamps_(sheet, record.record_id, r.part);
        items.push({ reflection: r, isNew: false, teacherEmailedAt: stamps.teacherEmailedAt, coachEmailedAt: stamps.coachEmailedAt });
      }
      // else (ordinary call, row already exists): dropped, not re-mirrored,
      // not re-marked; a same-moment racer owns finishing it.
    });
    if (!items.length) return out;

    items.forEach(function(item) {
      item.needTeacher = !item.teacherEmailedAt;
      item.needCoach = !item.coachEmailedAt;
      if (item.isNew) upsertOtpReflectionRow_(sheet, record, item.reflection);
    });

    const needTeacherParts = items.filter(function(item) { return item.needTeacher; }).map(function(item) { return item.reflection; });
    const needCoachParts = items.filter(function(item) { return item.needCoach; }).map(function(item) { return item.reflection; });

    if (needTeacherParts.length) {
      try {
        if (sendOtpReflectThankYouEmail_(ss, record, links, needTeacherParts)) teacherStampAt = new Date().toISOString();
      } catch (mailErr) {
        Logger.log('OTP reflect mirror: thank-you email failed for ' + token + ': ' + mailErr.message);
      }
    }
    if (needCoachParts.length) {
      try {
        if (sendOtpReflectCoachEmail_(ss, record, needCoachParts)) coachStampAt = new Date().toISOString();
      } catch (mailErr) {
        Logger.log('OTP reflect mirror: coach email failed for ' + token + ': ' + mailErr.message);
      }
    }

    items.forEach(function(item) {
      const t = item.needTeacher && teacherStampAt ? teacherStampAt : null;
      const c = item.needCoach && coachStampAt ? coachStampAt : null;
      if (t || c) setOtpReflectionRowStamps_(sheet, record.record_id, item.reflection.part, t, c);
    });
  } finally {
    lock.releaseLock();
  }

  items.forEach(function(item) {
    const finalTeacherAt = item.teacherEmailedAt || (item.needTeacher && teacherStampAt ? teacherStampAt : null);
    const finalCoachAt = item.coachEmailedAt || (item.needCoach && coachStampAt ? coachStampAt : null);
    try {
      if (markReflectionMirrored_(token, item.reflection.part, finalTeacherAt || null, finalCoachAt || null)) {
        out.mirrored++;
        out.parts.push(item.reflection.part);
      }
    } catch (e) {
      Logger.log('OTP reflect mirror: mark failed for ' + token + ' part ' + item.reflection.part + ': ' + e.message);
    }
  });

  return out;
}

/**
 * The reflections half of healOtpMirror (08_OtpMirror.gs): every
 * (record_token, part) Supabase still lists as unmirrored is mirrored now,
 * batched by distinct token (one mirror call processes every pending part
 * for that token). Returns a summary object (also logged).
 */
function healOtpReflections_() {
  const secret = getSupabaseSecret();
  if (!secret) return { success: false, error: 'SUPABASE_SECRET_KEY not set' };
  const resp = UrlFetchApp.fetch(SUPABASE_URL + OTP_REFLECT_RPC_UNMIRRORED, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'apikey': secret, 'Authorization': 'Bearer ' + secret },
    payload: JSON.stringify({ p_older_than_seconds: OTP_HEAL_OLDER_THAN_S }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    Logger.log('OTP reflect heal: otp_reflections_unmirrored HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText());
    return { success: false, error: 'otp_reflections_unmirrored HTTP ' + resp.getResponseCode() };
  }
  var items = [];
  try { items = JSON.parse(resp.getContentText()) || []; } catch (e) {}
  if (!items.length) return { success: true, pending: 0, healed: 0, failed: 0 };

  const tokens = [];
  items.forEach(function(it) {
    const t = String((it && it.record_token) || '').trim();
    if (t && tokens.indexOf(t) === -1) tokens.push(t);
  });
  const batch = tokens.slice(0, OTP_REFLECT_HEAL_BATCH);
  var healed = 0, failed = 0;
  batch.forEach(function(token) {
    try {
      const out = mirrorOtpReflectionsFromSupabase_(token, true);
      if (out && out.mirrored > 0) healed += out.mirrored; else failed++;
    } catch (e) {
      failed++;
      Logger.log('OTP reflect heal: ' + token + ' failed: ' + e.message);
    }
  });
  const summary = { success: true, pending: items.length, healed: healed, failed: failed };
  Logger.log('OTP reflect heal: ' + JSON.stringify(summary));
  return summary;
}
