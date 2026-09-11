/**
 * POST handler · receives a JSON R3 evidence form submission, appends a row,
 * generates a per-record secret token, and emails a backup copy with the
 * locked-record URL to BACKUP_EMAIL_TO.
 *
 * Request body (Content-Type: text/plain, raw JSON):
 *   { teacher, curriculum, inspector, date, duration, ..., evidence_type,
 *     focus_context, j_attainment, j_attainment_c, ..., summary_strengths,
 *     summary_weakness, (optional) submitted_at }
 *
 * Response:
 *   { success: true, id: "AIS-R3-YYYYMMDD-HHMM" }
 *   { success: false, error: "..." }
 *
 * The token is NEVER returned to the form (the submitter is the inspector,
 * not the recipient). It lives only in the backend email + the Sheet.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ success: false, error: 'No request body' });
    }
    const data = JSON.parse(e.postData.contents);

    // v0.50: Evidence Pad extraction shares this endpoint (same simple-request
    // CORS path as submits). One page image per call; never touches the Sheet.
    if (data && data.action === 'extract_pad') return handlePadExtract(data);

    // otp-v0.1: the Progress in Lessons OTP form shares this endpoint. It is
    // dispatched BEFORE any R3 logic and writes its own tab; the R3 path below
    // is untouched (a request without form:'otp' behaves exactly as before).
    if (data && data.form === 'otp') return handleOtpPost(data);

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
    } else if (sheet.getLastColumn() < columns.length) {
      // v0.50: heal the header when columns were appended to getR3Columns()
      // (evidence_pad_id). Existing rows keep their positions; only the new
      // trailing header cells are written.
      const from = sheet.getLastColumn();
      sheet.getRange(1, from + 1, 1, columns.length - from)
           .setValues([columns.slice(from)])
           .setFontWeight('bold')
           .setBackground('#143642')
           .setFontColor('#ffffff');
    }

    const submittedAt = data.submitted_at || new Date().toISOString();
    const recordId = data.record_id || generateR3RecordId(submittedAt);
    const recordToken = generateRecordToken();

    data.record_token = recordToken;
    // v0.32: compute duration server-side from time_in / time_out (HH:MM).
    // Frontend no longer ships a duration field; override anything passed.
    data.duration = computeDurationMinutes(data.time_in, data.time_out);

    const row = columns.map(function(col) {
      if (col === 'record_id') return recordId;
      if (col === 'submitted_at') return submittedAt;
      if (col === 'observation_date') return data.date || data.observation_date || '';
      if (col === 'record_token') return recordToken;
      return data[col] != null ? data[col] : '';
    });

    sheet.appendRow(row);

    try {
      sendSubmissionEmail(ss, recordId, recordToken, submittedAt, data);
    } catch (mailErr) {
      Logger.log('Email send failed for ' + recordId + ': ' + mailErr.message);
    }

    // v0.47: dual-write into Supabase (Sheet stays source of truth; failure is
    // logged + swallowed so the inspector never sees an error). Idempotent on token.
    try {
      pushToSupabase(columns, data, recordId, recordToken, submittedAt);
    } catch (sbErr) {
      Logger.log('Supabase dual-write failed for ' + recordId + ': ' + sbErr.message);
    }

    return jsonOut({ success: true, id: recordId });
  } catch (err) {
    return jsonOut({ success: false, error: String(err && err.message || err) });
  }
}

// v0.46: include SECONDS. The old minute-resolution id collided when two
// observations were submitted in the same minute (live inspection week produced
// 17 such collisions). Lookups now key on the unique record_token so collisions
// are no longer load-bearing, but a unique-per-second id keeps the human-readable
// label clean and avoids two records ever showing the same "Record ID".
function generateR3RecordId(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = function(n) { return String(n).padStart(2, '0'); };
  return 'AIS-R3-' + d.getFullYear() +
                      pad(d.getMonth() + 1) +
                      pad(d.getDate()) + '-' +
                      pad(d.getHours()) +
                      pad(d.getMinutes()) +
                      pad(d.getSeconds());
}

/**
 * 32-char hex token (128 bits of entropy). Random bytes via Utilities.getUuid()
 * provide cryptographic quality without pulling in extra libraries.
 */
function generateRecordToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
}

/**
 * Returns the duration in whole minutes between two HH:MM 24-hour time
 * strings. Empty string if either input is missing or malformed, or if
 * end <= start (don't try to second-guess a typo).
 */
function computeDurationMinutes(timeIn, timeOut) {
  const m = function(s) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
    if (!match) return null;
    const h = parseInt(match[1], 10);
    const mi = parseInt(match[2], 10);
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return h * 60 + mi;
  };
  const a = m(timeIn);
  const b = m(timeOut);
  if (a == null || b == null) return '';
  const diff = b - a;
  if (diff <= 0) return '';
  return diff;
}

/**
 * Sends a single HTML email copy of the submission to BACKUP_EMAIL_TO,
 * CCing the selected inspector (if their row in the Inspectors tab has
 * an email in column B). Locked-record URL (id + token) is front and
 * centre in the body so admin and inspector share the same record.
 */
function sendSubmissionEmail(ss, recordId, recordToken, submittedAt, data) {
  const lockedUrl = FORM_PUBLIC_URL +
                    '?id=' + encodeURIComponent(recordId) +
                    '&token=' + encodeURIComponent(recordToken);

  const teacherName = String(data.teacher || '(no teacher)').trim();
  const subject = 'AIS R3 Evidence · ' + recordId + ' · ' + teacherName;

  const htmlBody = buildSubmissionHtml(recordId, lockedUrl, submittedAt, data);

  const inspectorEmail = lookupInspectorEmail(ss, data.inspector);
  const opts = {
    to: BACKUP_EMAIL_TO,
    subject: subject,
    htmlBody: htmlBody,
    name: 'AIS R3 Evidence'
  };
  if (inspectorEmail && inspectorEmail.indexOf('@') > -1) {
    opts.cc = inspectorEmail;
  }

  // v0.50: attach the Evidence Pad pages (fetched with the service key from the
  // private bucket) so the backup email carries the raw pad. Silent on failure;
  // the email still goes out without attachments.
  try {
    const padBlobs = fetchPadImages(data.evidence_pad_id);
    if (padBlobs.length) opts.attachments = padBlobs;
  } catch (padErr) {
    Logger.log('Pad attach failed: ' + padErr.message);
  }

  MailApp.sendEmail(opts);
}

function buildSubmissionHtml(recordId, lockedUrl, submittedAt, data) {
  const esc = function(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  const row = function(label, value) {
    return '<tr>' +
           '<td style="padding:6px 12px 6px 0;color:#6b7e85;font-size:13px;vertical-align:top;white-space:nowrap;">' + esc(label) + '</td>' +
           '<td style="padding:6px 0;color:#143642;font-size:14px;vertical-align:top;">' + esc(value) + '</td>' +
           '</tr>';
  };

  const sectionTitle = function(title) {
    return '<tr><td colspan="2" style="padding:18px 0 6px;border-bottom:1px solid #e3e2dc;color:#143642;font-weight:600;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">' + esc(title) + '</td></tr>';
  };

  const judgementRow = function(label, rating, comment) {
    return '<tr>' +
           '<td style="padding:6px 12px 6px 0;color:#6b7e85;font-size:13px;vertical-align:top;white-space:nowrap;">' + esc(label) + '</td>' +
           '<td style="padding:6px 0;color:#143642;font-size:14px;vertical-align:top;">' +
             '<strong>' + esc(rating || '—') + '</strong>' +
             (comment ? '<div style="margin-top:4px;color:#3a4f59;font-size:13px;">' + esc(comment) + '</div>' : '') +
           '</td>' +
           '</tr>';
  };

  const judgements = [
    ['Attainment',           'j_attainment'],
    ['Progress',             'j_progress'],
    ['Learning skills',      'j_learning_skills'],
    ['PSD / innovation',     'j_psd_innovation'],
    ['Teaching',             'j_teaching'],
    ['Assessment',           'j_assessment'],
    ['Curriculum',           'j_curriculum_judgement'],
    ['PCGs',                 'j_pcgs'],
    ['Leadership / mgmt',    'j_leadership_management'],
    ['Other',                'j_other']
  ];

  let html = '';
  html += '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#efece2;padding:24px;color:#143642;">';
  html += '  <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -8px rgba(20,54,66,0.18);">';
  html += '    <div style="background:#143642;color:#f2efe6;padding:20px 28px;">';
  html += '      <div style="font-size:12px;letter-spacing:0.32em;text-transform:uppercase;color:#FFBA14;font-weight:600;">AIS R3 Evidence</div>';
  html += '      <div style="font-size:22px;font-weight:600;margin-top:6px;">' + esc(recordId) + '</div>';
  html += '      <div style="font-size:13px;color:#cdd0e0;margin-top:4px;">' + esc(formatStampSafe(submittedAt)) + '</div>';
  html += '    </div>';
  html += '    <div style="padding:24px 28px;">';
  html += '      <div style="background:#fff8e1;border:1px solid #FFBA14;border-radius:8px;padding:16px;margin-bottom:20px;">';
  html += '        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d00;font-weight:700;margin-bottom:6px;">Locked record</div>';
  html += '        <div style="font-size:14px;color:#143642;">Open the locked record: <a href="' + esc(lockedUrl) + '" style="color:#143642;font-weight:700;text-decoration:underline;">Link</a></div>';
  html += '      </div>';
  html += '      <table style="width:100%;border-collapse:collapse;">';

  html += sectionTitle('Lesson context');
  html += row('Teacher',       data.teacher);
  html += row('Inspector',     data.inspector);
  html += row('Subject',       data.subject);
  html += row('School',        data.school);
  html += row('Curriculum',    data.curriculum);
  html += row('Date',          data.date || data.observation_date);
  html += row('Time in',       data.time_in);
  html += row('Time out',      data.time_out);
  html += row('Duration',      data.duration);
  html += row('Room',          data.room_number);
  html += row('Grade',         data.grade_class);
  html += row('Evidence type', data.evidence_type);

  html += sectionTitle('Cohort');
  html += row('Ability group', data.ability_group);
  html += row('Gender',        data.gender);
  html += row('On roll',       data.num_on_roll);
  html += row('Present',       data.present);
  html += row('SEN',           data.num_sen);
  html += row('G&T',           data.num_gt);
  html += row('Male',          data.num_male);
  html += row('Female',        data.num_female);
  html += row('Support staff', data.support_teachers_cas);

  html += sectionTitle('Focus / context');
  html += row('Focus', data.focus_context);

  html += sectionTitle('Judgements (1-6)');
  judgements.forEach(function(j) {
    html += judgementRow(j[0], data[j[1]], data[j[1] + '_c']);
  });

  html += sectionTitle('Summary');
  html += row('Strengths',      data.summary_strengths);
  html += row('Areas to develop', data.summary_weakness);
  html += row('Observer notes', data.observer_notes);

  html += '      </table>';
  html += '    </div>';
  html += '    <div style="background:#fafaf7;color:#6b7e85;padding:14px 28px;font-size:12px;text-align:center;letter-spacing:0.08em;">';
  html += '      Submitted to <strong>AIS R3 Evidence</strong> Google Sheet · token required to view locked record';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  return html;
}

function formatStampSafe(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return Utilities.formatDate(d, 'Asia/Dubai', 'EEE, d MMM yyyy · HH:mm') + ' (Dubai)';
  } catch (e) {
    return String(iso);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * otp-v0.1 · Progress in Lessons OTP submissions.
 *
 * Same shape as the R3 path above, on its own tab and its own 33-column schema:
 *   Sheet row first (source of truth)  →  backup email (CC the observer)
 *   →  Supabase mirror, each side effect inside its own try/catch so a failure
 *   is logged and swallowed and the observer never sees an error (rules 12/14).
 *
 * Called from doPost when the payload carries form:'otp'. Throwing here is safe:
 * doPost's own catch turns it into { success:false, error }, exactly like R3.
 * ───────────────────────────────────────────────────────────────────────────── */
function handleOtpPost(data) {
  const ss = SpreadsheetApp.openById(getSheetId());
  let sheet = ss.getSheetByName(SHEET_NAME_OTP_SUBMISSIONS);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME_OTP_SUBMISSIONS);

  const columns = getOtpColumns();

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columns.length)
         .setFontWeight('bold')
         .setBackground('#143642')
         .setFontColor('#ffffff');
    sheet.setColumnWidths(1, columns.length, 140);
  } else if (sheet.getLastColumn() < columns.length) {
    // Heal the header when columns are appended to getOtpColumns() later.
    // Existing rows keep their positions; only the new trailing header cells
    // are written (same rule as the R3 tab).
    const from = sheet.getLastColumn();
    sheet.getRange(1, from + 1, 1, columns.length - from)
         .setValues([columns.slice(from)])
         .setFontWeight('bold')
         .setBackground('#143642')
         .setFontColor('#ffffff');
  }

  // otp-v0.9: update / close an existing lap by its record_token, in place of
  // appending a new submission. Dispatched here, right after the header is
  // healed above so the row it edits already carries the 38-column contract.
  if (data && (data.action === 'update' || data.action === 'close') && data.record_token) {
    return handleOtpUpdateOrClose(ss, sheet, data);
  }

  const submittedAt = data.submitted_at || new Date().toISOString();
  const recordId = data.record_id || generateOtpRecordId(submittedAt);
  const recordToken = generateRecordToken();

  data.record_token = recordToken;
  // otp-v0.9: every new submission opens a fresh lap. status starts
  // 'observed'; lap is 1 plus however many earlier OTP rows (any status)
  // already belonged to this teacher (computeOtpLap, matched trimmed +
  // case-insensitive), so a second observation is Lap 2; round is the
  // current OTP round, fetched live so a later close can be matched back to
  // the round it was opened in.
  data.status = 'observed';
  data.lap = computeOtpLap(sheet, data.teacher);
  data.round = fetchCurrentOtpRound();

  // One mapping builds BOTH the Sheet row and the Supabase mirror, so the
  // mirror is a field-for-field copy of the row (hard rule 14).
  const record = buildOtpRecord(columns, data, recordId, recordToken, submittedAt);
  // otp-v0.5: `school` is derived from `grade` inside buildOtpRecord. The backup
  // email and the Supabase mirror both read `data`, so hand them the same value
  // the Sheet row carries.
  data.school = record.school;
  sheet.appendRow(columns.map(function(col) { return record[col]; }));

  try {
    sendOtpSubmissionEmail(ss, recordId, recordToken, submittedAt, data);
  } catch (mailErr) {
    Logger.log('OTP email send failed for ' + recordId + ': ' + mailErr.message);
  }

  // otp-v0.9: a plain-language copy to the teacher themselves (no edit link,
  // no rating, no rubric state). Silent when their Teachers 26-27 row carries
  // no email (hard rule 12).
  try {
    sendOtpTeacherEmail(ss, recordId, recordToken, submittedAt, data);
  } catch (mailErr) {
    Logger.log('OTP teacher email failed for ' + recordId + ': ' + mailErr.message);
  }

  try {
    pushOtpToSupabase(columns, data, recordId, recordToken, submittedAt);
  } catch (sbErr) {
    Logger.log('Supabase OTP dual-write failed for ' + recordId + ': ' + sbErr.message);
  }

  return jsonOut({ success: true, id: recordId });
}

/**
 * otp-v0.9 · 1 plus however many existing OTP rows (any status) already
 * belong to `teacherName`, matched trimmed and case-insensitively against the
 * sheet's own header row (so it works whether the tab was just healed or
 * not). Called BEFORE the new row is appended, so it never counts itself.
 */
function computeOtpLap(sheet, teacherName) {
  const want = String(teacherName || '').trim().toLowerCase();
  if (!want || sheet.getLastRow() < 2) return 1;
  const values = sheet.getDataRange().getValues();
  const teacherCol = values[0].indexOf('teacher');
  if (teacherCol < 0) return 1;
  let count = 0;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][teacherCol] || '').trim().toLowerCase() === want) count++;
  }
  return count + 1;
}

/**
 * otp-v0.9 · overwrites an existing lap's cells by record_token (action
 * 'update'), or the same plus status:'closed' + closed_at (action 'close').
 * Found by header NAME on the OTP tab only, never the R3 tab (hard rule 10).
 * A row already closed refuses BOTH actions with the same generic miss used
 * everywhere else (hard rule 12): a closed lap can never be reopened or
 * overwritten from here. record_id, submitted_at, record_token, lap and
 * round are never touched either way; a key absent from the payload leaves
 * its cell exactly as it was (so evidence_pad_id survives an edit that never
 * touches the pad). `school` is re-derived from a posted `grade`, the same
 * rule buildOtpRecord applies at submit (see otpUpdatableValue below).
 */
function handleOtpUpdateOrClose(ss, sheet, data) {
  const miss = { success: false, error: 'Record not found' };
  if (sheet.getLastRow() < 2) return jsonOut(miss);

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const tokenCol = headers.indexOf('record_token');
  const statusCol = headers.indexOf('status');
  if (tokenCol < 0) return jsonOut(miss);

  const wantToken = String(data.record_token || '').trim();
  var rowIdx = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][tokenCol] || '').trim() === wantToken) { rowIdx = r; break; }
  }
  if (rowIdx < 0) return jsonOut(miss);

  const currentStatus = statusCol > -1 ? String(values[rowIdx][statusCol] || '').trim() : '';
  if (currentStatus === 'closed') return jsonOut(miss);

  // Real Sheets pads every row out to the header width when it is read back;
  // guard the same way here in case this row predates a column appended
  // since it was written.
  while (values[rowIdx].length < headers.length) values[rowIdx].push('');

  const isClose = data.action === 'close';
  const LOCKED = { record_id: true, submitted_at: true, record_token: true, lap: true, round: true };

  headers.forEach(function(h, c) {
    if (LOCKED[h]) return;
    if (h === 'status') { values[rowIdx][c] = isClose ? 'closed' : 'observed'; return; }
    if (h === 'closed_at') { if (isClose) values[rowIdx][c] = new Date().toISOString(); return; }
    const resolved = otpUpdatableValue(h, data);
    if (resolved.present) values[rowIdx][c] = resolved.value;
  });

  sheet.getRange(rowIdx + 1, 1, 1, headers.length).setValues([values[rowIdx]]);

  const record = {};
  headers.forEach(function(h, c) { record[h] = values[rowIdx][c]; });

  try {
    pushOtpRowToSupabase(record);
  } catch (sbErr) {
    Logger.log('Supabase OTP re-push failed for ' + record.record_id + ': ' + sbErr.message);
  }

  if (isClose) {
    try {
      sendOtpCloseEmail(ss, record);
    } catch (mailErr) {
      Logger.log('OTP close email failed for ' + record.record_id + ': ' + mailErr.message);
    }
  }

  // Next observation of this teacher should see the just-closed lap
  // immediately, not after the 60s prev_next_steps cache TTL.
  try { clearPrevNextStepsCache(record.teacher); } catch (e) {}

  return jsonOut({ success: true, id: record.record_id, status: record.status });
}

/**
 * Per-column resolution for handleOtpUpdateOrClose: mirrors buildOtpRecord's
 * special cases (observer <- inspector/observer, observation_date <- date,
 * school derived from grade) but only for a column whose source key was
 * actually posted, so an update never wipes a cell the caller never sent.
 */
function otpUpdatableValue(col, data) {
  if (col === 'observer') {
    if (!('inspector' in data) && !('observer' in data)) return { present: false };
    return { present: true, value: data.inspector || data.observer || '' };
  }
  if (col === 'observation_date') {
    if (!('date' in data) && !('observation_date' in data)) return { present: false };
    return { present: true, value: data.date || data.observation_date || '' };
  }
  if (col === 'school') {
    if (!('grade' in data) && !('school' in data)) return { present: false };
    const derived = schoolForGrade(data.grade);
    return { present: true, value: derived || (data.school != null ? data.school : '') };
  }
  if (!(col in data)) return { present: false };
  return { present: true, value: data[col] != null ? data[col] : '' };
}

/**
 * Same generator as the R3 record id (second-resolution, so two submissions in
 * the same minute never share a label), with the OTP prefix.
 * Lookups still key on the unique record_token (hard rule 10).
 */
function generateOtpRecordId(iso) {
  return generateR3RecordId(iso).replace('AIS-R3-', 'AIS-OTP-');
}

/**
 * Resolves one OTP submission into an object keyed by Sheet column name.
 * `observer` comes from the form's `inspector` field (the OTP form is a copy of
 * the R3 master and still posts that key); `observation_date` from `date`.
 * otp-v0.5: `school` is derived from `grade` (schoolForGrade), so the Sheet row
 * and the Supabase mirror always agree with the year group that was observed.
 */
function buildOtpRecord(columns, data, recordId, recordToken, submittedAt) {
  const record = {};
  columns.forEach(function(col) {
    if (col === 'record_id') record[col] = recordId;
    else if (col === 'submitted_at') record[col] = submittedAt;
    else if (col === 'observer') record[col] = data.inspector || data.observer || '';
    else if (col === 'observation_date') record[col] = data.date || data.observation_date || '';
    else if (col === 'record_token') record[col] = recordToken;
    else if (col === 'school') record[col] = schoolForGrade(data.grade) || (data[col] != null ? data[col] : '');
    else record[col] = data[col] != null ? data[col] : '';
  });
  return record;
}

/**
 * otp-v0.5 · the sub-school a grade belongs to. Grade WINS over any school the
 * form posted: Pre-Kindy / Kindy -> Kindy, Prep and 1-6 -> Primary, 7-12 ->
 * Secondary. An empty or unrecognised grade returns '' so the caller keeps the
 * payload's own school (legacy rows and gradeless posts).
 */
function schoolForGrade(grade) {
  const g = String(grade == null ? '' : grade).trim();
  if (g === 'Pre-Kindy' || g === 'Kindy') return 'Kindy';
  if (g === 'Prep') return 'Primary';
  if (/^\d{1,2}$/.test(g)) {
    const n = parseInt(g, 10);
    if (n >= 1 && n <= 6) return 'Primary';
    if (n >= 7 && n <= 12) return 'Secondary';
  }
  return '';
}

/**
 * Backup copy of an OTP submission to BACKUP_EMAIL_TO, CCing the observer when
 * their row on the (26-27) Inspectors tab carries an email. The link is the
 * ungated OTP record viewer, keyed on the token alone (hard rule 10).
 */
function sendOtpSubmissionEmail(ss, recordId, recordToken, submittedAt, data) {
  const lockedUrl = RECORD_VIEWER_URL_OTP + '?token=' + encodeURIComponent(recordToken);
  // otp-v0.9: a form-side EDIT link (never sent to the teacher, see
  // sendOtpTeacherEmail) so admin/observer can jump straight into editing
  // this lap without hunting for the token.
  const editUrl = FORM_PUBLIC_URL_OTP + '?edit=' + encodeURIComponent(recordToken);

  const teacherName = String(data.teacher || '(no teacher)').trim();
  const obsDate = String(data.date || data.observation_date || '').trim();
  const subject = 'AIS OTP Progress · Lap ' + data.lap + ' · ' + teacherName + ' · ' + obsDate;

  const htmlBody = buildOtpSubmissionHtml(recordId, lockedUrl, editUrl, submittedAt, data);

  const observerEmail = lookupOtpObserverEmail(ss, data.inspector || data.observer);
  const opts = {
    to: BACKUP_EMAIL_TO,
    subject: subject,
    htmlBody: htmlBody,
    name: 'AIS OTP Progress'
  };
  if (observerEmail && observerEmail.indexOf('@') > -1) {
    opts.cc = observerEmail;
  }

  // Evidence Pad pages, same private-bucket fetch as R3. Silent on failure;
  // the email still goes out without attachments.
  try {
    const padBlobs = fetchPadImages(data.evidence_pad_id);
    if (padBlobs.length) opts.attachments = padBlobs;
  } catch (padErr) {
    Logger.log('OTP pad attach failed: ' + padErr.message);
  }

  MailApp.sendEmail(opts);
}

/**
 * otp-v0.9 · sends the teacher their own copy at submit time: no edit link,
 * no rating, no rubric state, just what was observed and that the observer
 * will meet them to agree next steps. Silent when the teacher's Teachers
 * 26-27 row (lookupOtpTeacherEmail, 02_doGet.gs) carries no email, or the
 * value there isn't an email at all (hard rule 12).
 */
function sendOtpTeacherEmail(ss, recordId, recordToken, submittedAt, data) {
  const teacherEmail = lookupOtpTeacherEmail(ss, data.teacher);
  if (!teacherEmail || teacherEmail.indexOf('@') < 0) return;

  const viewUrl = RECORD_VIEWER_URL_OTP + '?token=' + encodeURIComponent(recordToken);
  const observerName = String(data.inspector || data.observer || 'Your observer').trim();
  const obsDate = String(data.date || data.observation_date || '').trim();
  const subject = 'Your OTP Progress observation · Lap ' + data.lap + ' · ' + obsDate;

  const body = observerName + ' observed your lesson on ' + obsDate + '. You can read the observation here: ' +
               viewUrl + '. ' + observerName + ' will arrange a time to go through it with you and agree your next steps together.';

  MailApp.sendEmail({
    to: teacherEmail,
    subject: subject,
    htmlBody: '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#143642;font-size:14px;line-height:1.5;">' + body + '</div>',
    name: 'AIS OTP Progress'
  });
}

/**
 * otp-v0.9 · sent when a lap is closed: the agreed Next Steps, to the
 * teacher, CC the observer + the backup mailbox. View link only, the record
 * is locked now so no edit link. `record` is the full row (header -> value)
 * exactly as it now stands on the Sheet.
 */
function sendOtpCloseEmail(ss, record) {
  const teacherEmail = lookupOtpTeacherEmail(ss, record.teacher);
  if (!teacherEmail || teacherEmail.indexOf('@') < 0) return;

  const viewUrl = RECORD_VIEWER_URL_OTP + '?token=' + encodeURIComponent(record.record_token || '');
  const observerName = String(record.observer || 'your observer').trim();
  const teacherName = String(record.teacher || '(no teacher)').trim();
  const obsDate = String(record.observation_date || '').trim();
  const subject = 'OTP Progress · Lap ' + record.lap + ' closed · ' + teacherName + ' · ' + obsDate;

  const closedDate = formatStampSafe(record.closed_at);
  const s1 = String(record.next_step_1 || '').trim();
  const s2 = String(record.next_step_2 || '').trim();
  const s3 = String(record.next_step_3 || '').trim();
  const body = 'Lap ' + record.lap + ' was closed on ' + closedDate + '. Next Steps agreed with ' + observerName + ': ' +
               '1. ' + s1 + ' 2. ' + s2 + ' 3. ' + s3 + '. Full record: ' + viewUrl + '.';

  const opts = {
    to: teacherEmail,
    subject: subject,
    htmlBody: '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#143642;font-size:14px;line-height:1.5;">' + body + '</div>',
    name: 'AIS OTP Progress'
  };
  const observerEmail = lookupOtpObserverEmail(ss, record.observer);
  const cc = [];
  if (observerEmail && observerEmail.indexOf('@') > -1) cc.push(observerEmail);
  cc.push(BACKUP_EMAIL_TO);
  opts.cc = cc.join(',');

  MailApp.sendEmail(opts);
}

function buildOtpSubmissionHtml(recordId, lockedUrl, editUrl, submittedAt, data) {
  const esc = function(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  const row = function(label, value) {
    return '<tr>' +
           '<td style="padding:6px 12px 6px 0;color:#6b7e85;font-size:13px;vertical-align:top;white-space:nowrap;">' + esc(label) + '</td>' +
           '<td style="padding:6px 0;color:#143642;font-size:14px;vertical-align:top;">' + esc(value) + '</td>' +
           '</tr>';
  };

  const sectionTitle = function(title) {
    return '<tr><td colspan="2" style="padding:18px 0 6px;border-bottom:1px solid #e3e2dc;color:#143642;font-weight:600;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">' + esc(title) + '</td></tr>';
  };

  // otp-v0.6: a note row keeps the observer's line breaks (escaped first, so the
  // <br> is the only markup that survives).
  const noteRow = function(label, value) {
    return '<tr>' +
           '<td style="padding:6px 12px 6px 0;color:#6b7e85;font-size:13px;vertical-align:top;white-space:nowrap;">' + esc(label) + '</td>' +
           '<td style="padding:6px 0;color:#143642;font-size:14px;vertical-align:top;">' + esc(value).replace(/\r\n|\r|\n/g, '<br>') + '</td>' +
           '</tr>';
  };

  /**
   * otp-v0.6: the Criterion notes section, built from the posted sp1_notes JSON
   * ({ "<Level> <n>": "note" }). One row per note, ordered by level then
   * criterion number, labelled with the criterion's colour state read from the
   * sp1_present / sp1_partially_present / sp1_not_present lists ('Not assessed'
   * when it is in none of them). Returns '' (so the section is omitted whole)
   * when sp1_notes is empty, is not a JSON object, or holds no note text.
   */
  const criterionNoteRows = function() {
    let parsed;
    try { parsed = JSON.parse(String(data.sp1_notes || '')); } catch (e) { return ''; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';

    const LEVELS = ['Beginner', 'Emerging', 'Good', 'Great', 'Outstanding'];
    const rank = function(key) {
      const m = /^(Beginner|Emerging|Good|Great|Outstanding) (\d+)$/.exec(key);
      return m ? LEVELS.indexOf(m[1]) * 1000 + parseInt(m[2], 10) : 1000000;
    };
    const listHas = function(list, key) {
      return String(list == null ? '' : list).split(',').some(function(item) { return item.trim() === key; });
    };
    const stateOf = function(key) {
      if (listHas(data.sp1_present, key)) return 'Present';
      if (listHas(data.sp1_partially_present, key)) return 'Partially present';
      if (listHas(data.sp1_not_present, key)) return 'Not present';
      return 'Not assessed';
    };

    const keys = Object.keys(parsed)
      .filter(function(k) { return String(parsed[k] == null ? '' : parsed[k]).trim() !== ''; })
      .sort(function(a, b) { return rank(a) - rank(b); });
    if (!keys.length) return '';

    let out = sectionTitle('Criterion notes');
    keys.forEach(function(k) { out += noteRow(k + ' · ' + stateOf(k), parsed[k]); });
    return out;
  };

  let html = '';
  html += '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#efece2;padding:24px;color:#143642;">';
  html += '  <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -8px rgba(20,54,66,0.18);">';
  html += '    <div style="background:#143642;color:#f2efe6;padding:20px 28px;">';
  html += '      <div style="font-size:12px;letter-spacing:0.32em;text-transform:uppercase;color:#FFBA14;font-weight:600;">AIS OTP Progress</div>';
  html += '      <div style="font-size:22px;font-weight:600;margin-top:6px;">' + esc(recordId) + '</div>';
  html += '      <div style="font-size:13px;color:#cdd0e0;margin-top:4px;">' + esc(formatStampSafe(submittedAt)) + '</div>';
  html += '    </div>';
  html += '    <div style="padding:24px 28px;">';
  html += '      <div style="background:#fff8e1;border:1px solid #FFBA14;border-radius:8px;padding:16px;margin-bottom:20px;">';
  html += '        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d00;font-weight:700;margin-bottom:6px;">Locked record</div>';
  html += '        <div style="font-size:14px;color:#143642;">Open the locked record: <a href="' + esc(lockedUrl) + '" style="color:#143642;font-weight:700;text-decoration:underline;">Link</a></div>';
  html += '        <div style="font-size:14px;color:#143642;margin-top:6px;">Edit this record: <a href="' + esc(editUrl) + '" style="color:#143642;font-weight:700;text-decoration:underline;">Link</a></div>';
  html += '      </div>';
  html += '      <table style="width:100%;border-collapse:collapse;">';

  html += sectionTitle('Lesson context');
  html += row('Teacher',                data.teacher);
  html += row('Observer',               data.inspector || data.observer);
  html += row('Curriculum',             data.curriculum);
  html += row('Date',                   data.date || data.observation_date);
  html += row('Room number',            data.room_number);
  html += row('Time in',                data.time_in);
  html += row('Time out',               data.time_out);   // otp-v0.8
  html += row('Subject',                data.subject);
  html += row('School',                 data.school);
  html += row('Grade',                  data.grade);
  html += row('Support teachers / CAs', data.support_teachers_cas);

  html += sectionTitle('OTP reference');
  html += row('Reference',              data.otp_ref);
  html += row('Aspect',                 data.otp_aspect);
  html += row('Beginner',               data.sp1_beginner);
  html += row('Emerging',               data.sp1_emerging);
  html += row('Good',                   data.sp1_good);
  html += row('Great',                  data.sp1_great);
  html += row('Outstanding',            data.sp1_outstanding);
  html += row('Selected criteria',      data.sp1_selected_text);
  html += row('Present in lesson',      data.sp1_present);
  html += row('Partially present',      data.sp1_partially_present);
  html += row('Not present',            data.sp1_not_present);
  html += row('Not assessed (does not count)', data.sp1_not_seen);

  html += criterionNoteRows();

  html += sectionTitle('Observer notes');
  html += row('Observer Comments',      data.observer_comments);
  html += row('Other Observations',     data.other_observations);
  html += row('Next Steps / Support 1', data.next_step_1);
  html += row('Next Steps / Support 2', data.next_step_2);
  html += row('Next Steps / Support 3', data.next_step_3);

  html += '      </table>';
  html += '    </div>';
  html += '    <div style="background:#fafaf7;color:#6b7e85;padding:14px 28px;font-size:12px;text-align:center;letter-spacing:0.08em;">';
  html += '      Submitted to <strong>AIS OTP Progress</strong> Google Sheet · token required to view locked record';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  return html;
}
