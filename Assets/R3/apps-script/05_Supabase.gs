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
