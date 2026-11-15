/**
 * Volunteer application backend (Google Apps Script).
 *
 * What it does on every submission:
 *   1. Adds a row to a Google Sheet ("Volunteer Applications (test)").
 *   2. Saves a JSON copy of the full application in a Drive folder
 *      ("Volunteer Applications (test)").
 *   3. Emails the script owner a short notice (name and role only).
 *
 * The Sheet and folder are created automatically the first time it runs.
 * Run setup() once from the editor to authorize it and see the links.
 */

var NAME = 'Volunteer Applications (test)';
var NOTIFY_OWNER = true;
var MAX_BODY = 60000;           // characters; rejects oversized posts
var MIN_FILL_MS = 4000;         // anything faster than this is treated as a bot

var COLUMNS = [
  ['Submitted', 'submittedAt'], ['ID', 'id'], ['Roles', 'roles'],
  ['First name', 'firstName'], ['Last name', 'lastName'], ['Email', 'email'], ['Phone', 'phone'],
  ['Text opt-in', 'smsOptIn'], ['Address', 'address'], ['City', 'city'], ['Zip', 'zip'],
  ['Birth year', 'birthYear'], ['Sex', 'sex'],
  ['Basketball knowledge', 'knowledge'], ['Shirt size', 'shirtSize'], ['Shirt style', 'shirtStyle'],
  ['Attends church', 'attendsChurch'], ['Church name', 'churchName'], ['Served before', 'servedBefore'],
  ['Children', 'children'], ['Divisions', 'divisions'], ['No division preference', 'divisionNoPreference'],
  ['Referee time', 'refereeTime'], ['Full-court games', 'refereeFullCourt'],
  ['Cannot practice', 'cannotPractice'], ['Wednesday 4:30', 'wednesday430'],
  ['No conflicts', 'noConflicts'], ['Prefers early', 'preferEarly'], ['Prefers Friday', 'preferFriday'],
  ['Faith answer', 'faithAnswer'], ['Faith statement', 'faithStatement']
];

function doGet() {
  return json_({ ok: true, status: 'running' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var raw = (e && e.postData && e.postData.contents) || '';
    if (!raw || raw.length > MAX_BODY) return json_({ ok: false, error: 'Bad request' });

    var d = JSON.parse(raw);
    if (d.website) return json_({ ok: true, id: 'N/A' });                  // honeypot filled
    if (typeof d.elapsedMs === 'number' && d.elapsedMs < MIN_FILL_MS) return json_({ ok: true, id: 'N/A' });

    var err = validate_(d);
    if (err) return json_({ ok: false, error: err });

    // ignore a double-click or retry from the same email within 2 minutes
    var cache = CacheService.getScriptCache();
    var key = 'sub:' + String(d.email).toLowerCase();
    var seen = cache.get(key);
    if (seen) return json_({ ok: true, id: seen });

    var store = ensureStorage_();
    var id = Utilities.getUuid().slice(0, 8).toUpperCase();
    d.id = id;
    d.submittedAt = new Date();

    var sheet = store.ss.getSheets()[0];
    sheet.appendRow(COLUMNS.map(function (c) { return cell_(d[c[1]]); }));

    var fileName = id + ' - ' + safeName_(d.lastName) + ', ' + safeName_(d.firstName) + '.json';
    var copy = JSON.parse(JSON.stringify(d));
    copy.website = undefined; copy.elapsedMs = undefined;
    store.folder.createFile(fileName, JSON.stringify(copy, null, 2), MimeType.PLAIN_TEXT);

    cache.put(key, id, 120);

    if (NOTIFY_OWNER) {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
        'New volunteer application: ' + d.firstName + ' ' + d.lastName,
        'Role(s): ' + (d.roles || []).join(', ') + '\nReference: ' + id +
        '\n\nSheet: ' + store.ss.getUrl() + '\nFolder: ' + store.folder.getUrl());
    }
    return json_({ ok: true, id: id });
  } catch (ex) {
    console.error(ex);
    return json_({ ok: false, error: 'Server error' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/** Run this once from the editor. It authorizes the script and creates the Sheet and folder. */
function setup() {
  var store = ensureStorage_();
  Logger.log('Sheet:  ' + store.ss.getUrl());
  Logger.log('Folder: ' + store.folder.getUrl());
}

// ---------- helpers ----------

function ensureStorage_() {
  var props = PropertiesService.getScriptProperties();
  var ss, folder;

  var ssId = props.getProperty('SHEET_ID');
  if (ssId) { try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; } }
  var folderId = props.getProperty('FOLDER_ID');
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = null; } }

  if (!folder) {
    folder = DriveApp.createFolder(NAME);
    props.setProperty('FOLDER_ID', folder.getId());
  }
  if (!ss) {
    ss = SpreadsheetApp.create(NAME);
    props.setProperty('SHEET_ID', ss.getId());
    var sh = ss.getSheets()[0];
    sh.setName('Applications');
    sh.appendRow(COLUMNS.map(function (c) { return c[0]; }));
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    DriveApp.getFileById(ss.getId()).moveTo(folder);   // keep the Sheet in the same folder
  }
  return { ss: ss, folder: folder };
}

function validate_(d) {
  if (!d || typeof d !== 'object') return 'Bad request';
  if (!d.firstName || !d.lastName) return 'Name is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email || ''))) return 'Valid email is required';
  if (!Array.isArray(d.roles) || d.roles.length === 0) return 'Choose a role';
  if (Array.isArray(d.cannotPractice) && d.cannotPractice.length > 10) return 'Too many practice conflicts';
  return null;
}

// Turn any value into a safe Sheet cell. A leading = + - @ would otherwise run as a formula.
function cell_(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v;
  if (Array.isArray(v)) {
    v = v.map(function (x) {
      return (x && typeof x === 'object') ? Object.keys(x).map(function (k) { return k + ': ' + x[k]; }).join(', ') : String(x);
    }).join('; ');
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  v = String(v).slice(0, 2000);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function safeName_(s) { return String(s || '').replace(/[^\w\- ]/g, '').slice(0, 40); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
