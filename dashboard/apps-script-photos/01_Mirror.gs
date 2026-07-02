// syncPhotos(): the daily mirror. Idempotent (Drive md5 vs teachers.photo_md5); per-file
// failures are logged and skipped so one bad file never blocks the rest; deletions propagate
// (teacher whose Drive photo is gone loses photo_url + the storage object). Safe to run
// manually from the editor after a big photo drop ("run now").
function syncPhotos() {
  var t0 = Date.now();
  var files = listDrivePhotos_();
  var byStem = {};
  files.forEach(function (f) { var k = norm_(f.stem); if (!(k in byStem)) byStem[k] = f; });

  var teachers = sbGet_('/rest/v1/teachers?select=id,full_name,photo_url,photo_md5,photo_ref&status=eq.active&limit=1000');
  var aliases = sbGet_('/rest/v1/photo_alias?select=drive_name,teacher_id&limit=1000');
  var aliasFile = {};
  aliases.forEach(function (a) { var f = byStem[norm_(a.drive_name)]; if (f) aliasFile[a.teacher_id] = f; });

  var stats = { uploaded: 0, kept: 0, cleared: 0, nophoto: 0, failed: 0 };
  teachers.forEach(function (t) {
    try {
      var file = byStem[norm_(t.full_name)] || aliasFile[t.id] || null;
      if (!file) {
        if (t.photo_ref || t.photo_url) { clearPhoto_(t); stats.cleared++; }
        else stats.nophoto++;
        return;
      }
      if (t.photo_url && t.photo_md5 === file.md5) { stats.kept++; return; }
      var blob = fetchPhoto_(file);
      var up = UrlFetchApp.fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + t.id + '.jpg', {
        method: 'post',
        contentType: 'image/jpeg',
        headers: { Authorization: 'Bearer ' + getSupabaseSecret(), 'x-upsert': 'true' },
        payload: blob.getBytes(),
        muteHttpExceptions: true,
      });
      if (up.getResponseCode() >= 300) throw new Error('storage ' + up.getResponseCode() + ': ' + up.getContentText().slice(0, 120));
      var url = SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + t.id + '.jpg?v=' + String(file.md5).slice(0, 8);
      sbPatch_('/rest/v1/teachers?id=eq.' + t.id, {
        photo_url: url, photo_md5: file.md5, photo_ref: file.id,
        photo_updated_at: new Date().toISOString(),
      });
      stats.uploaded++;
    } catch (e) {
      stats.failed++;
      console.error('photo sync failed for ' + t.full_name + ': ' + e);
    }
  });
  console.log('syncPhotos done in ' + Math.round((Date.now() - t0) / 1000) + 's: ' + JSON.stringify(stats));
  return stats;
}

// ---------- Drive ----------

function listDrivePhotos_() {
  var out = [];
  PHOTO_FOLDERS.forEach(function (folder) {
    var pageToken = null;
    do {
      var res = Drive.Files.list({
        q: '"' + folder.id + '" in parents and trashed=false',
        fields: 'nextPageToken, files(id,name,md5Checksum,mimeType,size,thumbnailLink)',
        pageSize: 1000,
        pageToken: pageToken,
      });
      (res.files || []).forEach(function (f) {
        if (!/image\/(jpeg|png|webp)/.test(f.mimeType || '')) return;
        out.push({ id: f.id, name: f.name, md5: f.md5Checksum, size: Number(f.size || 0),
                   thumbnailLink: f.thumbnailLink, stem: stemOf_(f.name) });
      });
      pageToken = res.nextPageToken;
    } while (pageToken);
  });
  return out;   // folder order = priority; byStem first-wins keeps DB Files ahead of Staff extras
}

// Raw bytes for normal headshots; oversized files go through the Drive thumbnail at width 400
// (Apps Script has no image resizing). thumbnailLink is short-lived and needs no extra auth.
function fetchPhoto_(file) {
  if (file.size > RAW_MAX_BYTES && file.thumbnailLink) {
    var thumbUrl = file.thumbnailLink.replace(/=s\d+[^&]*$/, '=s400');
    var r = UrlFetchApp.fetch(thumbUrl, { muteHttpExceptions: true });
    if (r.getResponseCode() < 300) return r.getBlob();
  }
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media&supportsAllDrives=true', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('drive fetch ' + res.getResponseCode());
  return res.getBlob();
}

// ---------- Supabase ----------

function sbGet_(pathq) {
  var key = getSupabaseSecret();
  var res = UrlFetchApp.fetch(SUPABASE_URL + pathq, {
    headers: { apikey: key, Authorization: 'Bearer ' + key },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('supabase GET ' + res.getResponseCode() + ' ' + pathq);
  return JSON.parse(res.getContentText());
}

function sbPatch_(pathq, body) {
  var key = getSupabaseSecret();
  var res = UrlFetchApp.fetch(SUPABASE_URL + pathq, {
    method: 'patch', contentType: 'application/json',
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'return=minimal' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('supabase PATCH ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 120));
}

function clearPhoto_(t) {
  UrlFetchApp.fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + t.id + '.jpg', {
    method: 'delete', headers: { Authorization: 'Bearer ' + getSupabaseSecret() }, muteHttpExceptions: true,
  });
  sbPatch_('/rest/v1/teachers?id=eq.' + t.id, {
    photo_url: null, photo_md5: null, photo_ref: null, photo_updated_at: new Date().toISOString(),
  });
}

// ---------- name matching (MUST stay identical to db/photo_match.mjs + db/photo_mirror.mjs) ----------

// "Steve McLuckie-AUISDGstudentextra105.jpg" -> "Steve McLuckie"
function stemOf_(filename) {
  return filename.replace(/\.(jpe?g|png|webp)$/i, '').replace(/-AUISDG.*$/i, '').trim();
}

// lowercase, diacritics stripped, apostrophes vanish (Sana'a -> sanaa), other punctuation -> space
function norm_(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '')
    .toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
}
