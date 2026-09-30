/**
 * Adullam Services — order inbox + admin API (Google Apps Script)
 *  - Website form  -> new row in the "Requests" tab + email to you
 *  - /admin page   -> lists / updates / deletes requests (password protected)
 * Setup steps are in backend/SETUP.md.
 */
const OWNER_EMAIL    = "anthonymichael054@gmail.com";   // where new-request emails are sent
const ADMIN_PASSWORD = "j7xj-J59V-rJty-VHZA";                     // <<< CHOOSE A LONG PASSWORD before deploying (admin is disabled until you change it)
const SHEET_NAME     = "Requests";
const HEADERS        = ["Date", "Name", "Contact", "Service", "Package", "Message", "Status", "Notes", "Amount", "ID"];
const STATUSES       = ["New", "Contacted", "Quoted", "Paid", "In progress", "Delivered", "Lost"];
const COL = { DATE: 1, NAME: 2, CONTACT: 3, SERVICE: 4, PKG: 5, MSG: 6, STATUS: 7, NOTES: 8, AMOUNT: 9, ID: 10 };

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const action = d.action || "submit";                 // the public website form sends no action
    if (action === "submit") return submit(d);
    const auth = checkPassword(d.pw);
    if (auth !== "ok") return out({ ok: false, error: auth });
    if (action === "list")   return out({ ok: true, rows: listRows(), statuses: STATUSES });
    if (action === "update") return out(updateRow(d));
    if (action === "delete") return out(deleteRow(d.id));
    return out({ ok: false, error: "unknown action" });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() { return out({ ok: true, service: "Adullam Services inbox is running" }); }

/* ---------- public: new request from the website ---------- */
function submit(d) {
  if (d.website) return out({ ok: true });                // honeypot: bots fill this, humans never see it
  const name = clean(d.name, 100), contact = clean(d.contact, 200), msg = clean(d.msg, 3000);
  if (!name || !contact || !msg) return out({ ok: false, error: "missing fields" });
  const service = clean(d.service, 100), pkg = clean(d.pkg, 100);
  sheet().appendRow([new Date(), name, contact, service, pkg, msg, "New", "", "", Utilities.getUuid()]);
  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: "New request: " + service + " — " + name,
    body: "Name: " + name + "\nContact: " + contact + "\nService: " + service + " (" + pkg + ")\n\n" + msg +
          "\n\n— Sheet: " + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  });
  return out({ ok: true });
}

/* ---------- admin ---------- */
function checkPassword(pw) {
  if (ADMIN_PASSWORD === "CHANGE-ME" || String(ADMIN_PASSWORD).length < 8) return "admin-not-configured";
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get("fails") || 0);
  if (fails >= 10) return "locked";                       // 10 wrong tries = locked for 15 minutes
  if (String(pw || "") !== ADMIN_PASSWORD) { cache.put("fails", String(fails + 1), 900); return "wrong-password"; }
  cache.remove("fails");
  return "ok";
}

function listRows() {
  const sh = sheet(), last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const rows = [];
  vals.forEach((r, i) => {
    if (!r[COL.NAME - 1] && !r[COL.MSG - 1]) return;      // skip blank rows
    let id = r[COL.ID - 1];
    if (!id) { id = Utilities.getUuid(); sh.getRange(i + 2, COL.ID).setValue(id); }   // rows added by hand get an ID
    rows.push({
      id: id, date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      name: r[COL.NAME - 1], contact: r[COL.CONTACT - 1], service: r[COL.SERVICE - 1], pkg: r[COL.PKG - 1],
      msg: r[COL.MSG - 1], status: r[COL.STATUS - 1] || "New", notes: r[COL.NOTES - 1], amount: r[COL.AMOUNT - 1]
    });
  });
  return rows.reverse();                                  // newest first
}

function findRow(id) {
  if (!id) return null;
  const sh = sheet();
  const cell = sh.getRange(1, COL.ID, Math.max(sh.getLastRow(), 1), 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return cell ? cell.getRow() : null;
}

function updateRow(d) {
  const row = findRow(d.id);
  if (!row) return { ok: false, error: "not found" };
  const sh = sheet();
  if (d.status !== undefined) {
    if (STATUSES.indexOf(d.status) < 0) return { ok: false, error: "bad status" };
    sh.getRange(row, COL.STATUS).setValue(d.status);
  }
  if (d.notes !== undefined)  sh.getRange(row, COL.NOTES).setValue(clean(d.notes, 2000));
  if (d.amount !== undefined) { const n = parseFloat(d.amount); sh.getRange(row, COL.AMOUNT).setValue(isNaN(n) ? "" : n); }
  return { ok: true };
}

function deleteRow(id) {
  const row = findRow(id);
  if (!row) return { ok: false, error: "not found" };
  sheet().deleteRow(row);
  return { ok: true };
}

/* ---------- helpers ---------- */
/** Gets (or creates) the Requests tab with headers, Status dropdown and colours. */
function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#8b5cf6").setFontColor("#ffffff");
    sh.setFrozenRows(1);
    sh.getRange("A:A").setNumberFormat("dd mmm yyyy HH:mm");
    sh.getRange("F:F").setWrap(true);
    sh.setColumnWidth(6, 420);
    sh.getRange("G2:G2000").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
    const colours = { "New": "#fde68a", "Contacted": "#bfdbfe", "Quoted": "#ddd6fe", "Paid": "#bbf7d0", "In progress": "#fed7aa", "Delivered": "#86efac", "Lost": "#e5e7eb" };
    sh.setConditionalFormatRules(Object.keys(colours).map(s =>
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(colours[s]).setRanges([sh.getRange("G2:G2000")]).build()));
  } else if (!sh.getRange(1, COL.AMOUNT).getValue()) {
    // sheet made by the older script (8 columns): add the Amount and ID headers
    sh.getRange(1, COL.AMOUNT, 1, 2).setValues([["Amount", "ID"]]).setFontWeight("bold").setBackground("#8b5cf6").setFontColor("#ffffff");
  }
  return sh;
}

/** Stops spreadsheet formulas being injected through the form (=, +, -, @ at the start). */
function clean(v, max) {
  let s = String(v == null ? "" : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
