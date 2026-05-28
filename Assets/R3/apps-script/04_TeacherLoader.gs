/**
 * Pulls all members across the 6 AIS staff Workspace Groups (see
 * TEACHER_GROUPS in 00_Config.gs), looks up each one's first/last name
 * via the Admin SDK Directory API, and writes [email, name] rows to
 * the Teachers tab.
 *
 * Run from the script editor after bootstrap(). First run triggers
 * the admin.directory.* OAuth consent dialog.
 *
 * Pattern lifted from TRS IRL Project / Google Script Email Trigger /
 * 06_EmailResolver.gs · loadStaffEmails().
 *
 * Requires:
 *   - AdminDirectory advanced service enabled in appsscript.json
 *   - oauthScopes: admin.directory.group.member.readonly + admin.directory.user.readonly
 *   - Script owner must be a Workspace admin
 */
function buildTeacherSheet() {
  const ss = SpreadsheetApp.openById(getSheetId());
  const sheet = ss.getSheetByName(SHEET_NAME_TEACHERS);
  if (!sheet) throw new Error('Teachers tab missing · run bootstrap() first');

  const emails = loadStaffEmails();
  Logger.log('Loaded ' + emails.size + ' unique emails across ' + TEACHER_GROUPS.length + ' groups');

  const rows = [];
  const seen = {};
  emails.forEach(function(email) {
    if (seen[email]) return;
    seen[email] = true;
    const name = lookupDisplayName(email);
    rows.push([email, name]);
  });

  // Sort alphabetically by display name for predictable dropdown ordering.
  rows.sort(function(a, b) {
    return String(a[1]).toLowerCase().localeCompare(String(b[1]).toLowerCase());
  });

  // Clear data rows below the header, then write fresh data.
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }
  Logger.log('Wrote ' + rows.length + ' teachers to ' + SHEET_NAME_TEACHERS + ' tab');
  return rows.length;
}

/**
 * Returns a Set<string> of lowercase email addresses for actual USERS pulled
 * from all TEACHER_GROUPS, recursing into any nested groups. Groups-as-members
 * are NOT included as rows themselves; only their flattened user membership is.
 */
function loadStaffEmails() {
  const users = new Set();
  const visitedGroups = new Set();
  TEACHER_GROUPS.forEach(function(groupKey) {
    walkGroup(groupKey, users, visitedGroups);
  });
  return users;
}

function walkGroup(groupKey, users, visitedGroups) {
  const key = String(groupKey).toLowerCase();
  if (visitedGroups.has(key)) return;
  visitedGroups.add(key);

  let pageToken;
  do {
    try {
      const resp = AdminDirectory.Members.list(groupKey, {
        maxResults: 200,
        pageToken: pageToken
      });
      (resp.members || []).forEach(function(m) {
        if (!m || !m.email) return;
        const email = String(m.email).toLowerCase();
        const type = m.type || 'USER';
        if (type === 'GROUP') {
          walkGroup(email, users, visitedGroups);
        } else if (type === 'USER') {
          users.add(email);
        }
        // Other types (CUSTOMER, EXTERNAL) are intentionally skipped.
      });
      pageToken = resp.nextPageToken;
    } catch (e) {
      Logger.log('Failed to read group ' + groupKey + ': ' + e.message);
      pageToken = null;
    }
  } while (pageToken);
}

/**
 * Look up a single user's display name from the Directory. Falls back to
 * a humanised local-part if the directory call fails or returns nothing.
 */
function lookupDisplayName(email) {
  try {
    const user = AdminDirectory.Users.get(email);
    if (user && user.name && user.name.fullName) {
      return user.name.fullName;
    }
    if (user && user.name && (user.name.givenName || user.name.familyName)) {
      return [user.name.givenName, user.name.familyName].filter(Boolean).join(' ');
    }
  } catch (e) {
    Logger.log('Directory lookup failed for ' + email + ': ' + e.message);
  }
  return humaniseLocalPart(email);
}

function humaniseLocalPart(email) {
  const local = String(email).split('@')[0];
  return local
    .split(/[._-]+/)
    .filter(function(p) { return p.length > 0; })
    .map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1); })
    .join(' ');
}
