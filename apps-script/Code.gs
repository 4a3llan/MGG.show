/**
 * Backend: Google Apps Script web app for the "Men Gher Ghesh" season 2 sign-up form.
 *
 * Setup: paste this file into Extensions > Apps Script INSIDE the Google Sheet,
 * run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). The sheet itself stays private.
 *
 * Registration window (Cairo time, YYYY-MM-DD, both ends inclusive).
 * Can be overridden without redeploying via Project Settings > Script properties
 * (REG_START / REG_END / MIN_AGE / MAX_AGE / SHEET_ID).
 */
const REG_START = "2026-10-29";
const REG_END   = "2027-01-29";

const MIN_AGE = 10;   // inclusive
const MAX_AGE = 16;   // inclusive (someone who turned 16 and is not yet 17 is accepted)

const TZ = "Africa/Cairo";
const SHEET_NAME = "التسجيلات";
const GOVERNORATE = "الشرقية";   // fixed value written to the governorate column

// Column order must never change: the duplicate check reads column E (student phone).
const HEADERS = [
  "رقم التسجيل", "الاسم", "السن", "المرحلة الدراسية",
  "هاتف الطالب", "هاتف ولي الأمر", "العنوان", "تاريخ التسجيل",
  "حالة التسجيل", "تاريخ الميلاد", "المحافظة", "المنطقة"
];
const COL_PHONE = 5;                 // E
const TEXT_COLS = [2, 5, 6, 7, 8, 10, 11, 12];   // stored as plain text (keeps leading zeros, blocks formulas)

const CACHE_SECONDS = 21600;         // idempotency keys live for 6 hours

function cfg(key, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v !== null && v !== "" ? v : fallback;
}

/** Run once manually: grants permissions and prepares the sheet. */
function setup() {
  const sh = ensureSheet();
  Logger.log("Sheet ready: " + sh.getParent().getName() + " / " + sh.getName());
}

/** GET returns only the registration status. It never exposes registrant data. */
function doGet(e) {
  const st = regStatus();
  st.ok = true;
  st.minAge = Number(cfg("MIN_AGE", MIN_AGE));
  st.maxAge = Number(cfg("MAX_AGE", MAX_AGE));
  return out(st);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);   // serialize concurrent submissions
    if (!e || !e.postData || !e.postData.contents) return out({ ok: false, error: "no_data" });

    let d;
    try { d = JSON.parse(e.postData.contents); } catch (_) { return out({ ok: false, error: "bad_json" }); }

    const err = validate(d);
    if (err) return out({ ok: false, error: err });

    return out(saveRegistration(d));
  } catch (x) {
    console.error(x);
    return out({ ok: false, error: "server" });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Writes one validated registration. Caller must hold the script lock.
 * Retrying the same request (same "rid") returns the original id instead of a duplicate error.
 */
function saveRegistration(d) {
  const sh = ensureSheet();
  const cache = CacheService.getScriptCache();
  const rid = typeof d.rid === "string" && /^[\w-]{8,64}$/.test(d.rid) ? "rid:" + d.rid : "";

  if (rid) {
    const prev = cache.get(rid);
    if (prev) return { ok: true, id: prev, repeated: true };
  }

  const last = sh.getLastRow();
  const phone = String(d.phone);
  const phones = last > 1
    ? sh.getRange(2, COL_PHONE, last - 1, 1).getValues().flat().map(p => String(p).replace(/^'/, "").trim())
    : [];
  if (phones.indexOf(phone) !== -1) return { ok: false, error: "duplicate" };

  const today = todayCairo();
  const age = ageOn(d.birth, today);
  const id = "MGG2-" + String(last).padStart(4, "0");
  const row = last + 1;
  const rng = sh.getRange(row, 1, 1, HEADERS.length);

  const fmt = HEADERS.map((_, i) => (TEXT_COLS.indexOf(i + 1) !== -1 ? "@" : "General"));
  rng.setNumberFormats([fmt]);
  rng.setValues([[
    id, clean(d.name), age, "",
    phone, String(d.parent), clean(d.address),
    Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"),
    "جديد", d.birth, GOVERNORATE, clean(d.area)
  ]]);
  SpreadsheetApp.flush();   // success is reported only after the write is committed

  // Read the row back so a silent write failure can never be reported as success.
  const saved = sh.getRange(row, 1, 1, 1).getValue();
  if (String(saved) !== id) return { ok: false, error: "server" };

  if (rid) cache.put(rid, id, CACHE_SECONDS);
  return { ok: true, id: id };
}

function getSpreadsheet() {
  const id = cfg("SHEET_ID", "");
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No spreadsheet: create the script from inside the sheet or set SHEET_ID");
  return ss;
}

function ensureSheet() {
  const ss = getSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  } else {
    // Upgrade an older sheet: fill only missing header cells, never touch data.
    const cur = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    HEADERS.forEach((h, i) => { if (!cur[i]) sh.getRange(1, i + 1).setValue(h); });
  }
  return sh;
}

function todayCairo() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
}

function regStatus() {
  const s = String(cfg("REG_START", REG_START));
  const e = String(cfg("REG_END", REG_END));
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(s) || !re.test(e) || s > e) return { open: false, reason: "not_configured" };
  const t = todayCairo();
  if (t < s) return { open: false, reason: "not_started", start: s, end: e };
  if (t > e) return { open: false, reason: "ended", start: s, end: e };
  return { open: true, start: s, end: e };
}

// Full years between two yyyy-MM-dd dates.
function ageOn(birth, today) {
  const b = birth.split("-").map(Number);
  const t = today.split("-").map(Number);
  let a = t[0] - b[0];
  if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) a--;
  return a;
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

// Arabic-Indic digits to ASCII digits.
function digits(s) {
  return String(s).replace(/[٠-٩]/g, c => "٠١٢٣٤٥٦٧٨٩".indexOf(c));
}

/** Server-side validation. The front end is never trusted. Returns "" when valid. */
function validate(d) {
  const phoneRe = /^01[0125]\d{8}$/;
  const lettersRe = /^[\u0621-\u063A\u0641-\u064A\u064B-\u0652\u0671a-zA-Z\s]+$/;

  if (!d || typeof d !== "object") return "server";
  if (d.website) return "bot";

  const st = regStatus();
  if (!st.open) return "closed:" + st.reason;

  if (typeof d.name !== "string" || d.name.trim().split(/\s+/).length < 3 || d.name.length > 80 || !lettersRe.test(d.name.trim())) return "name";
  if (typeof d.birth !== "string" || !validDate(d.birth)) return "birth";

  const today = todayCairo();
  if (d.birth > today) return "birth";

  const age = ageOn(d.birth, today);
  const lo = Number(cfg("MIN_AGE", MIN_AGE));
  const hi = Number(cfg("MAX_AGE", MAX_AGE));
  if (age < lo || age > hi) return "age";

  d.phone = digits(d.phone);
  d.parent = digits(d.parent);
  if (!phoneRe.test(d.phone) || !phoneRe.test(d.parent) || d.phone === d.parent) return "phone";

  if (typeof d.area !== "string" || d.area.trim().length < 2 || d.area.length > 60) return "area";
  if (typeof d.address !== "string" || d.address.trim().length < 10 || d.address.length > 300) return "address";
  if (d.agree !== true) return "agree";
  return "";
}

// Trims text and neutralizes spreadsheet formula injection (=, +, -, @ at the start).
function clean(s) {
  s = String(s).replace(/\s+/g, " ").trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run from the editor to verify the sheet wiring WITHOUT deploying.
 * Writes one clearly fake row, checks every column, then deletes it.
 * Reads the log via View > Logs (or Execution log).
 */
function selfTest() {
  const sh = ensureSheet();
  const before = sh.getLastRow();
  const res = saveRegistration({
    name: "اختبار تجريبي للنظام", birth: "2013-01-15", phone: "01000000000", parent: "01111111111",
    area: "منطقة تجريبية", address: "عنوان تجريبي للاختبار فقط", agree: true, rid: "selftest-" + Date.now()
  });
  Logger.log("save result: " + JSON.stringify(res));
  if (!res.ok) return;
  const row = sh.getRange(sh.getLastRow(), 1, 1, HEADERS.length).getValues()[0];
  HEADERS.forEach((h, i) => Logger.log(h + " => " + row[i]));
  sh.deleteRow(sh.getLastRow());
  Logger.log("test row deleted. rows before/after: " + before + "/" + sh.getLastRow());
  Logger.log("registration status: " + JSON.stringify(regStatus()));
}
