// AIS Teacher Photo Mirror · Config
// Drive staff headshots -> Supabase Storage (bucket teacher-photos), daily time-trigger.
// Decision record: Data-Representation/.planning/2026-07-02-teacher-portal-DECISIONS.md (6+7).
// Runs under admin.user@ais.ae. Matching is DETERMINISTIC: exact normalised full_name or a
// photo_alias row. Fuzzy discovery + the match report live in ~/AIS-Data-Dashboard/db/photo_match.mjs.

var SUPABASE_URL = 'https://rfbetrcevtmisknndpgg.supabase.co';
var BUCKET = 'teacher-photos';

// Source folders in priority order (first match wins). YB Files ignored on purpose (big yearbook shots).
var PHOTO_FOLDERS = [
  { id: '1cMl0Y2xLbYm4OhMOZpNLy0hJUNIJGSvu', label: 'DB Files' },
  { id: '1L-MIYhf_nnaFffShCwaYtsA4rEQWh9Uk', label: 'Staff/Database' },
  { id: '1lwr8lmCgLH2pQCAbWUXC1vYVNdNU3eXo', label: 'Staff (loose)' },
];

// Files bigger than this are fetched via the Drive thumbnail (=s400) instead of raw bytes,
// since Apps Script cannot resize images itself. The DB Files headshots are ~60-100KB raw.
var RAW_MAX_BYTES = 300000;

// MUST be the legacy service_role JWT (eyJ..., ~219 chars). sb_secret_ keys DO NOT work from
// Apps Script: UrlFetchApp sends a browser-like User-Agent that Supabase rejects for secret
// keys (same constraint as the R3 ingest bridge, CLAUDE.md hard rule 14).
// Set once: Editor > Project Settings > Script Properties > SUPABASE_SECRET_KEY.
function getSupabaseSecret() {
  var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SECRET_KEY');
  if (!key) throw new Error('Script property SUPABASE_SECRET_KEY is not set');
  return key;
}
