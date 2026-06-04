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
    const recordToken = generateRecordToken();

    data.record_token = recordToken;

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

/**
 * 32-char hex token (128 bits of entropy). Random bytes via Utilities.getUuid()
 * provide cryptographic quality without pulling in extra libraries.
 */
function generateRecordToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
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
  html += '        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d00;font-weight:700;margin-bottom:6px;">Locked record URL · forward to teacher</div>';
  html += '        <a href="' + esc(lockedUrl) + '" style="color:#143642;font-size:13px;word-break:break-all;text-decoration:underline;">' + esc(lockedUrl) + '</a>';
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
