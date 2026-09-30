/**
 * Adullam Services — order inbox (Google Apps Script)
 * Every quote request from the website becomes a row in this Google Sheet
 * AND an email to you. Setup steps are in backend/SETUP.md.
 */
const OWNER_EMAIL = "anthonymichael054@gmail.com";   // where new-request emails are sent
const SHEET_NAME  = "Requests";
const HEADERS     = ["Date", "Name", "Contact", "Service", "Package", "Message", "Status", "Notes"];
const STATUSES    = ["New", "Contacted", "Quoted", "Paid", "In progress", "Delivered", "Lost"];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.website) return out({ ok: true });                       // honeypot: bots fill this, humans never see it
    const name = clean(d.name, 100), contact = clean(d.contact, 200), msg = clean(d.msg, 3000);
    if (!name || !contact || !msg) return out({ ok: false, error: "missing fields" });
    const service = clean(d.service, 100), pkg = clean(d.pkg, 100);

    const sh = sheet();
    sh.appendRow([new Date(), name, contact, service, pkg, msg, "New", ""]);

    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: "New request: " + service + " — " + name,
      body: "Name: " + name + "\nContact: " + contact + "\nService: " + service + " (" + pkg + ")\n\n" + msg +
            "\n\n— Open your sheet: " + SpreadsheetApp.getActiveSpreadsheet().getUrl()
    });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() { return out({ ok: true, service: "Adullam Services inbox is running" }); }

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
