const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const XLSX = require("xlsx");

const app = express();
app.use(helmet());
app.use(express.json({ limit: "5kb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Persistent disk path on Render will be set via XLSX_PATH env var.
// Locally it will use /data/Registration.xlsx
const XLSX_PATH =
  process.env.XLSX_PATH || path.join(__dirname, "data", "Registration.xlsx");

const EMAIL_COL_NAME = process.env.EMAIL_COL_NAME || "Email Address";
const ATTENDANCE_COL = process.env.ATTENDANCE_COL || "Attendance";
const ATTENDANCE_TIME_COL = process.env.ATTENDANCE_TIME_COL || "Attendance Time";
const PASSCODE = process.env.PASSCODE || "CHANGE_ME_PASSCODE";

function requirePasscodeFromQuery(req, res, next) {
  const pass = (req.query?.p || "").toString().trim();
  if (!pass || pass !== PASSCODE) {
    return res.status(403).send("Forbidden");
  }
  next();
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

  const pass =
    (req.headers["x-passcode"] || "").toString().trim() ||
    (req.body?.passcode || "").toString().trim();

  if (!pass || pass !== PASSCODE) {
    return res.status(403).json({ ok: false, message: "Invalid passcode." });
  }
  next();
}

// ✅ Seed workbook copy (important for Render persistent disk)
function ensureWorkbookExists() {
  const seedPath = path.join(__dirname, "data", "Registration.xlsx");

  // If XLSX_PATH points to a disk location and the file doesn't exist yet,
  // copy the seed workbook there once.
  if (!fs.existsSync(XLSX_PATH)) {
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Missing seed workbook at ${seedPath}`);
    }
    fs.mkdirSync(path.dirname(XLSX_PATH), { recursive: true });
    fs.copyFileSync(seedPath, XLSX_PATH);
    console.log("Seed workbook copied to:", XLSX_PATH);
  }
}
ensureWorkbookExists();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
// Admin page (simple)
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Download updated workbook (protected)
app.get("/admin/download", requirePasscodeFromQuery, (req, res) => {
  if (!fs.existsSync(XLSX_PATH)) return res.status(404).send("File not found.");
  res.download(XLSX_PATH, "Registration.xlsx");
});

// ✅ Passcode required for attendance check + write-back
app.post("/api/check", requirePasscode, (req, res) => {
  const emailInput = normalizeEmail(req.body?.email);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailInput)) {
    return res.status(400).json({
      ok: false,
      message: "Please enter a valid email address."
    });
  }

  if (!fs.existsSync(XLSX_PATH)) {
    return res.status(500).json({
      ok: false,
      message: "Registration database not found on server."
    });
  }

  const workbook = XLSX.readFile(XLSX_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  if (!rows.length) {
    return res.status(500).json({ ok: false, message: "Registration database is empty." });
  }

  let foundIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowEmail = normalizeEmail(rows[i][EMAIL_COL_NAME]);
    if (rowEmail && rowEmail === emailInput) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) {
    return res.json({ ok: true, found: false, message: "❌ Email not registered." });
  }

  const now = new Date().toISOString();
  const alreadyMarked = String(rows[foundIndex][ATTENDANCE_COL] || "").trim().toLowerCase() === "yes";

  rows[foundIndex][ATTENDANCE_COL] = "Yes";
  rows[foundIndex][ATTENDANCE_TIME_COL] = now;

  const newWorksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
  workbook.Sheets[sheetName] = newWorksheet;

  XLSX.writeFile(workbook, XLSX_PATH);

  return res.json({
    ok: true,
    found: true,
    alreadyMarked,
    message: alreadyMarked
      ? "✅ Registration confirmed (attendance already recorded)."
      : "✅ Registration confirmed and attendance recorded."
  });
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



