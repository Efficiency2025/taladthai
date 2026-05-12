/**
 * Google Apps Script — Talad Thai 30th Anniversary Check-in Backend
 *
 * Deploy as Web App:
 * 1. Open Google Apps Script editor (Extensions > Apps Script)
 * 2. Paste this code into Code.gs
 * 3. Deploy > New deployment > Web app
 * 4. Set "Execute as" = Me, "Who has access" = Anyone
 * 5. Copy the URL and update .env (VITE_APPS_SCRIPT_URL)
 *
 * Sheet ID: 1sbtG0yhkKOgkA6big8dZhxZu0nG2-ykADN5kglBkymQ
 *
 * IMPORTANT: After updating this file, you must create a NEW deployment
 * (Deploy > Manage deployments > New version) for changes to take effect.
 */

const SHEET_ID = '1sbtG0yhkKOgkA6big8dZhxZu0nG2-ykADN5kglBkymQ';
const PARTICIPANT_SHEET = 'รายชื่อ';
const BOOTH_SHEET = 'บูธลงทะเบียน';
const STATUS_COL = 7;       // Column G — สถานะการเข้างาน
const TIMESTAMP_COL = 8;    // Column H — เวลาอนุมัติ

/**
 * Handle all GET requests.
 * Supports:
 *   - ?action=approve&row=N  → approve row N
 *   - ?check=N               → check status of row N
 *   - (no params)            → fetch all rows + booth mapping
 */
function doGet(e) {
  var params = e.parameter;

  // Approve via GET (avoids CORS preflight issues)
  if (params.action === 'approve' && params.row) {
    var rowIndex = parseInt(params.row);
    if (!rowIndex || rowIndex < 2) {
      return jsonResponse({ success: false, message: 'Invalid row index' });
    }
    return approveRow(rowIndex);
  }

  // Single-row status check
  if (params.check) {
    return checkRow(parseInt(params.check));
  }

  // Fetch all rows + booth mapping
  return fetchAll();
}

/**
 * Handle POST requests (kept for backward compatibility).
 */
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var rowIndex = body.rowIndex;

  if (!rowIndex || rowIndex < 2) {
    return jsonResponse({ success: false, message: 'Invalid row index' });
  }

  return approveRow(rowIndex);
}

/**
 * Fetch all participant rows and booth mapping as JSON.
 * Auto-creates status/timestamp headers if missing.
 */
function fetchAll() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // --- Participants ---
  var participantSheet = ss.getSheetByName(PARTICIPANT_SHEET);
  ensureStatusHeaders(participantSheet);

  var data = participantSheet.getDataRange().getValues();
  var headers = data[0];
  var participants = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    participants.push(row);
  }

  // --- Booth Mapping ---
  var boothMapping = fetchBoothMapping(ss);

  return jsonResponse({
    participants: participants,
    boothMapping: boothMapping
  });
}

/**
 * Fetch booth/zone mapping from the บูธลงทะเบียน tab.
 * @param {Spreadsheet} ss - the spreadsheet instance
 * @returns {Array} array of booth mapping objects
 */
function fetchBoothMapping(ss) {
  var boothSheet = ss.getSheetByName(BOOTH_SHEET);
  if (!boothSheet) return [];

  var data = boothSheet.getDataRange().getValues();
  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    result.push(row);
  }

  return result;
}

/**
 * Ensure status and timestamp headers exist in columns G & H.
 * Auto-creates them on first run so the sheet doesn't need manual setup.
 * @param {Sheet} sheet - the participant sheet
 */
function ensureStatusHeaders(sheet) {
  var statusHeader = sheet.getRange(1, STATUS_COL).getValue();
  if (!statusHeader) {
    sheet.getRange(1, STATUS_COL).setValue('สถานะการเข้างาน');
  }
  var timestampHeader = sheet.getRange(1, TIMESTAMP_COL).getValue();
  if (!timestampHeader) {
    sheet.getRange(1, TIMESTAMP_COL).setValue('เวลาอนุมัติ');
  }
}

/**
 * Check status of a single row.
 */
function checkRow(rowIndex) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(PARTICIPANT_SHEET);
  var status = sheet.getRange(rowIndex, STATUS_COL).getValue();
  var approvedAt = sheet.getRange(rowIndex, TIMESTAMP_COL).getValue();

  return jsonResponse({
    status: status || 'รออนุมัติเข้างาน',
    approvedAt: approvedAt ? approvedAt.toString() : ''
  });
}

/**
 * Approve a row — with server-side guard against race conditions.
 */
function approveRow(rowIndex) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // Wait up to 10 seconds

  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(PARTICIPANT_SHEET);
    var currentStatus = sheet.getRange(rowIndex, STATUS_COL).getValue();

    // Server-side guard: check if already approved
    if (currentStatus === 'อนุมัติแล้ว') {
      var existingTimestamp = sheet.getRange(rowIndex, TIMESTAMP_COL).getValue();
      return jsonResponse({
        success: false,
        alreadyApproved: true,
        approvedAt: existingTimestamp ? existingTimestamp.toString() : ''
      });
    }

    // Approve
    var now = new Date();
    var timestamp = Utilities.formatDate(now, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');

    sheet.getRange(rowIndex, STATUS_COL).setValue('อนุมัติแล้ว');
    sheet.getRange(rowIndex, TIMESTAMP_COL).setValue(timestamp);

    return jsonResponse({
      success: true,
      alreadyApproved: false,
      approvedAt: timestamp
    });

  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper to return a JSON response.
 * @param {Object|Array} data - data to serialize
 * @returns {TextOutput}
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
