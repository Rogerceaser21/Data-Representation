/**
 * Supabase dual-write bridge (v0.47).
 *
 * Mirrors one R3 submission into the dashboard's Supabase project (assessments +
 * scores) via the ingest_r3 RPC. Called by doPost AFTER the Sheet append: the
 * Google Sheet is the source of truth, so a Supabase failure never loses data and
 * never surfaces to the inspector. Idempotent server-side on record_token, so a
 * retry can never duplicate. Any missed record is healed by db/backfill_r3.mjs.
 *
 * The payload is built from the SAME column mapping as the Sheet row, so the
 * Supabase `content` snapshot is a field-for-field mirror of the Sheet.
 *
 * Auth: the service_role secret key (bypasses RLS to write), read from Script
 * Properties (SUPABASE_SECRET_KEY); never hardcoded. If the property is missing,
 * the bridge no-ops with a log line instead of throwing.
 */
function pushToSupabase(columns, data, recordId, recordToken, submittedAt) {
  const secret = getSupabaseSecret();
  if (!secret) {
    Logger.log('Supabase dual-write skipped: SUPABASE_SECRET_KEY not set in Script Properties');
    return;
  }

  // Rebuild the row as an object keyed by column name, using the exact same
  // resolution rules as 01_doPost.gs so the mirror matches the Sheet row.
  const record = {};
  columns.forEach(function(col) {
    if (col === 'record_id') record[col] = recordId;
    else if (col === 'submitted_at') record[col] = submittedAt;
    else if (col === 'observation_date') record[col] = data.date || data.observation_date || '';
    else if (col === 'record_token') record[col] = recordToken;
    else record[col] = data[col] != null ? data[col] : '';
  });

  const resp = UrlFetchApp.fetch(SUPABASE_URL + INGEST_RPC_PATH, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': secret,
      'Authorization': 'Bearer ' + secret
    },
    payload: JSON.stringify({ payload: record }),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    Logger.log('Supabase ingest_r3 HTTP ' + code + ' for ' + recordId + ': ' + resp.getContentText());
    return;
  }
  Logger.log('Supabase ingest_r3 ok for ' + recordId + ': ' + resp.getContentText());
}

/**
 * otp-v0.1 · the same bridge for a Progress in Lessons OTP submission, into the
 * ingest_otp RPC. Called by handleOtpPost AFTER the Sheet append, inside its own
 * try/catch: the Sheet stays the source of truth, a failure is logged and
 * swallowed, and the RPC is idempotent server-side on record_token so a retry
 * can never duplicate (hard rule 14).
 *
 * The payload is built by buildOtpRecord, the SAME mapping that produced the
 * Sheet row, so the mirror is a field-for-field copy.
 */
function pushOtpToSupabase(columns, data, recordId, recordToken, submittedAt) {
  const record = buildOtpRecord(columns, data, recordId, recordToken, submittedAt);
  postOtpRecordToSupabase(record);
}

/**
 * otp-v0.9 · re-push for an update/close (handleOtpUpdateOrClose, 01_doPost.gs):
 * the row has already been written to the Sheet by then, so the caller hands
 * this the FULL row already resolved header -> value, rather than a partial
 * post body needing buildOtpRecord's submit-time derivations. Shares the same
 * HTTP call as pushOtpToSupabase above; pushOtpToSupabase's own signature is
 * unchanged, still used only by the submit path.
 */
function pushOtpRowToSupabase(record) {
  postOtpRecordToSupabase(record);
}

/**
 * The actual ingest_otp HTTP call, shared by pushOtpToSupabase (submit) and
 * pushOtpRowToSupabase (update/close re-push). `record` is a plain object
 * keyed by Sheet column name, already resolved to its final values.
 */
function postOtpRecordToSupabase(record) {
  const secret = getSupabaseSecret();
  if (!secret) {
    Logger.log('Supabase OTP dual-write skipped: SUPABASE_SECRET_KEY not set in Script Properties');
    return;
  }

  const resp = UrlFetchApp.fetch(SUPABASE_URL + INGEST_RPC_PATH_OTP, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': secret,
      'Authorization': 'Bearer ' + secret
    },
    payload: JSON.stringify({ payload: record }),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    Logger.log('Supabase ingest_otp HTTP ' + code + ' for ' + record.record_id + ': ' + resp.getContentText());
    return;
  }
  Logger.log('Supabase ingest_otp ok for ' + record.record_id + ': ' + resp.getContentText());
}

/**
 * otp-v0.9 · the current OTP round label, read live via the anon RPC
 * get_current_round_otp (the same one the form's admin cog reads with the
 * publishable key; the round is not secret). Stamped onto every new
 * submission's `round` column so a later close can be matched back to the
 * round it was opened in (getOtpPrevNextSteps, 02_doGet.gs). Apps Script's
 * UrlFetchApp has no client-settable request timeout, so the "few seconds"
 * this call is expected to take is not an enforced cap; the try/catch and
 * muteHttpExceptions below are what guarantee this never blocks or throws:
 * any failure (network, non-200, a body that isn't the expected JSON string)
 * returns '' and nothing else fails (hard rule 12).
 */
function fetchCurrentOtpRound() {
  try {
    const resp = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/get_current_round_otp', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_PUBLISHABLE_KEY
      },
      payload: '{}',
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return '';
    const parsed = JSON.parse(resp.getContentText());
    return typeof parsed === 'string' ? parsed : '';
  } catch (e) {
    return '';
  }
}
