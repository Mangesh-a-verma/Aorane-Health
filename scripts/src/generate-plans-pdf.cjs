const PDFDocument = require("pdfkit");
const fs = require("fs");

const OUT = "/home/runner/workspace/aorane-plans.pdf";

const TEAL = "#00B388";
const NAVY = "#0D1B2A";
const GRAY = "#6B7280";
const PURPLE = "#7C3AED";
const GREEN = "#10B981";
const AMBER = "#D97706";
const WHITE = "#FFFFFF";
const LGRAY = "#F9FAFB";
const LTEAL = "#E6F7F3";
const LPURP = "#F5F3FF";
const LGREEN = "#F0FDF4";
const LAMBER = "#FFFBEB";
const LNAVY = "#F3F4F6";

const doc = new PDFDocument({ size: "A4", margin: 30, bufferPages: true });
doc.pipe(fs.createWriteStream(OUT));

// ── HELPERS ──────────────────────────────────────────────

const PW = 595 - 60; // usable width (30 margin each side)

function hline(y, color = "#E5E7EB", w = 2) {
  doc.save().strokeColor(color).lineWidth(w).moveTo(30, y).lineTo(30 + PW, y).stroke().restore();
}

function fillRect(x, y, w, h, color) {
  doc.save().fillColor(color).rect(x, y, w, h).fill().restore();
}

function text(str, x, y, opts = {}) {
  doc.save();
  if (opts.color) doc.fillColor(opts.color);
  if (opts.bold) doc.font("Helvetica-Bold");
  else doc.font("Helvetica");
  doc.fontSize(opts.size || 8.5);
  doc.text(str, x, y, { lineBreak: false, ...opts });
  doc.restore();
}

// Draw a table with given columns, rows, starting y
// cols: [{width, label, bg, fg}]
// rows: [{cells: [{text, color, bold, bg, align}], bg}]
function drawTable(startY, cols, rows) {
  const rowH = 16;
  const headerH = 28;
  const x0 = 30;

  // Draw header
  let cx = x0;
  cols.forEach(col => {
    fillRect(cx, startY, col.width, headerH, col.bg || NAVY);
    doc.save().fillColor(col.fg || WHITE).font("Helvetica-Bold").fontSize(8);
    const lines = col.label.split("\n");
    const lineH = 9;
    const totalH = lines.length * lineH;
    const startTextY = startY + (headerH - totalH) / 2;
    lines.forEach((line, i) => {
      doc.text(line, cx + 2, startTextY + i * lineH, { width: col.width - 4, align: "center", lineBreak: false });
    });
    doc.restore();
    cx += col.width;
  });

  let y = startY + headerH;

  rows.forEach((row) => {
    // Check if page break needed
    if (y + rowH > doc.page.height - 40) {
      doc.addPage();
      y = 30;
    }

    const rh = row.height || rowH;
    cx = x0;

    // Row background
    if (row.sectionHeader) {
      fillRect(x0, y, PW, rh, row.bg || LGRAY);
      doc.save().fillColor(row.color || NAVY).font("Helvetica-Bold").fontSize(7.5);
      doc.text(row.label, x0 + 5, y + (rh - 7.5) / 2, { lineBreak: false });
      doc.restore();
    } else {
      cols.forEach((col, ci) => {
        const cell = row.cells[ci] || {};
        const bg = cell.bg || row.bg || WHITE;
        fillRect(cx, y, col.width, rh, bg);
        doc.save();
        doc.fillColor(cell.color || "#374151");
        doc.font(cell.bold ? "Helvetica-Bold" : "Helvetica").fontSize(cell.size || 8);
        const align = cell.align || (ci === 0 ? "left" : "center");
        const xOff = ci === 0 ? 5 : 2;
        doc.text(cell.text || "", cx + xOff, y + (rh - 8) / 2, { width: col.width - (xOff + 2), align, lineBreak: false });
        doc.restore();
        cx += col.width;
      });
    }

    // horizontal line
    doc.save().strokeColor("#E5E7EB").lineWidth(0.4)
      .moveTo(x0, y + rh).lineTo(x0 + PW, y + rh).stroke().restore();

    y += rh;
  });

  // outer border
  doc.save().strokeColor("#D1D5DB").lineWidth(0.5)
    .rect(x0, startY, PW, y - startY).stroke().restore();

  return y;
}

function tick(extra = {}) { return { text: "✓", color: TEAL, bold: true, align: "center", ...extra }; }
function cross(extra = {}) { return { text: "—", color: "#D1D5DB", align: "center", ...extra }; }
function val(v, color, extra = {}) { return { text: v, color, bold: true, align: "center", ...extra }; }

// ── PAGE 1: INDIVIDUAL PLANS ─────────────────────────────

// Header
doc.font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text("AORANE", 30, 30);
doc.font("Helvetica").fontSize(10).fillColor(TEAL).text("India Ka AI Health Coach", 30, 55);
doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text("Individual Plans Comparison", 30, 30, { align: "right" });
doc.font("Helvetica").fontSize(8).fillColor(GRAY).text("May 2026  |  aorane.com", 30, 47, { align: "right" });
hline(72, TEAL, 2);

const indCols = [
  { width: 168, label: "Feature", bg: NAVY, fg: WHITE },
  { width: 75, label: "FREE\n₹0 / month", bg: "#374151", fg: WHITE },
  { width: 85, label: "MAX ★\n₹199/month\n₹1,990/year", bg: TEAL, fg: WHITE },
  { width: 80, label: "PRO\n₹249/month\n₹2,490/year", bg: PURPLE, fg: WHITE },
  { width: 87, label: "FAMILY\n₹499/month\n₹4,990/year\n(4 members)", bg: GREEN, fg: WHITE },
];

const LG = LGRAY;

const indRows = [
  // FOOD
  { sectionHeader: true, label: "🥗  FOOD & NUTRITION", bg: LTEAL, color: TEAL },
  { cells: [{ text: "Food Logging (manual)" }, val("Unlimited", TEAL), val("Unlimited", TEAL), val("Unlimited", PURPLE), val("Unlimited", GREEN)] },
  { bg: LG, cells: [{ text: "AI Food Scan — Photo" }, cross(), val("10/day", TEAL), val("10/day", PURPLE), val("10/day", GREEN)] },
  { cells: [{ text: "AI Food Scan — Text" }, { text: "5/day", align: "center" }, val("10/day", TEAL), val("10/day", PURPLE), val("10/day", GREEN)] },
  { bg: LG, cells: [{ text: "Medical Report Scan (AI)" }, cross(), val("5/day", TEAL), val("5/day", PURPLE), val("5/day", GREEN)] },
  { cells: [{ text: "Nutrition: Cal, Protein, Carbs, Fat, Fiber" }, tick(), tick(), tick(), tick()] },
  { bg: LG, cells: [{ text: "Micronutrients: Calcium, Iron, B12, Vit C & D" }, cross(), tick(), tick(), tick()] },
  { cells: [{ text: "3000+ Indian Foods Database" }, tick(), tick(), tick(), tick()] },

  // AI COACHING
  { sectionHeader: true, label: "🤖  AI COACHING", bg: LPURP, color: PURPLE },
  { bg: LG, cells: [{ text: "AI Diet Plan" }, cross(), val("5/day", TEAL), val("5/day", PURPLE), val("5/day", GREEN)] },
  { cells: [{ text: "AI Health Coach & Tips" }, cross(), val("10/day", TEAL), val("10/day", PURPLE), val("10/day", GREEN)] },
  { bg: LG, cells: [{ text: "AI Meal Swap" }, cross(), val("20/day", TEAL), val("20/day", PURPLE), val("20/day", GREEN)] },
  { cells: [{ text: "Advanced AI Health Predictions" }, cross(), cross(), tick(), cross()] },
  { bg: LG, cells: [{ text: "Personalized Health Goals (AI)" }, cross(), cross(), tick(), cross()] },
  { cells: [{ text: "Stress & Burnout AI Monitoring" }, cross(), cross(), tick(), cross()] },

  // HEALTH TRACKING
  { sectionHeader: true, label: "💪  HEALTH TRACKING", bg: LAMBER, color: AMBER },
  { bg: LG, cells: [{ text: "Daily Health Score (100-point)" }, { text: "Basic", align: "center", color: GRAY }, tick(), tick(), tick()] },
  { cells: [{ text: "Health History" }, { text: "7 days", align: "center", color: GRAY }, val("Unlimited", TEAL), val("Unlimited", PURPLE), val("Unlimited", GREEN)] },
  { bg: LG, cells: [{ text: "Exercise Logging (MET calculation)" }, { text: "Basic", align: "center", color: GRAY }, tick(), tick(), tick()] },
  { cells: [{ text: "Water Tracker & Reminders" }, tick(), tick(), tick(), tick()] },
  { bg: LG, cells: [{ text: "Blood Sugar & BP Tracking" }, cross(), tick(), tick(), tick()] },
  { cells: [{ text: "Sleep Stage Analysis" }, cross(), tick(), tick(), tick()] },
  { bg: LG, cells: [{ text: "Medicine Schedules & Reminders" }, tick(), tick(), tick(), tick()] },
  { cells: [{ text: "Period Cycle Tracker" }, cross(), cross(), tick(), cross()] },
  { bg: LG, cells: [{ text: "BMI (Asia-Pacific Indian calibrated)" }, tick(), tick(), tick(), tick()] },
  { cells: [{ text: "Blood Emergency Network" }, tick(), tick(), tick(), tick()] },
  { bg: LG, cells: [{ text: "Wearable Sync (Phase 4 — Coming Soon)" }, cross(), { text: "Phase 4", align: "center", color: TEAL }, { text: "Phase 4", align: "center", color: PURPLE }, { text: "Phase 4", align: "center", color: GREEN }] },

  // FAMILY
  { sectionHeader: true, label: "👨‍👩‍👧‍👦  FAMILY FEATURES", bg: LGREEN, color: GREEN },
  { bg: LG, cells: [{ text: "Member Accounts" }, { text: "1", align: "center" }, { text: "1", align: "center" }, { text: "1", align: "center" }, val("4", GREEN)] },
  { cells: [{ text: "Family Health Dashboard" }, cross(), cross(), cross(), tick()] },
  { bg: LG, cells: [{ text: "Elderly Health Monitoring" }, cross(), cross(), cross(), tick()] },
  { cells: [{ text: "Family Wellness Challenges" }, cross(), cross(), cross(), tick()] },
  { bg: LG, cells: [{ text: "Single Billing for All Members" }, cross(), cross(), cross(), tick()] },

  // SUPPORT
  { sectionHeader: true, label: "🎧  SUPPORT & DATA", bg: LNAVY, color: NAVY },
  { cells: [{ text: "Offline Data Logging" }, tick(), tick(), tick(), tick()] },
  { bg: LG, cells: [{ text: "Community Forum Access" }, tick(), tick(), tick(), tick()] },
  { cells: [{ text: "Export Data (PDF & CSV)" }, cross(), cross(), tick(), cross()] },
  { bg: LG, cells: [{ text: "Support" }, { text: "Community", align: "center", color: GRAY }, { text: "Priority Email", align: "center", color: TEAL }, { text: "24/7 Priority", align: "center", color: PURPLE, bold: true }, { text: "Priority Email", align: "center", color: GREEN }] },
];

let endY = drawTable(78, indCols, indRows);

// Page 1 footer
hline(endY + 8, "#E5E7EB", 0.5);
doc.font("Helvetica").fontSize(7.5).fillColor(GRAY)
  .text("aorane.com  |  contact@aorane.com", 30, endY + 12)
  .text("Prices in INR. GST @18% extra on paid plans.", 30, endY + 12, { align: "right" });

// ── PAGE 2: BUSINESS PLANS ───────────────────────────────

doc.addPage();

doc.font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text("AORANE", 30, 30);
doc.font("Helvetica").fontSize(10).fillColor(TEAL).text("Business Wellness Platform", 30, 55);
doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text("Business Plans Comparison", 30, 30, { align: "right" });
doc.font("Helvetica").fontSize(8).fillColor(GRAY).text("May 2026  |  business.aorane.com", 30, 47, { align: "right" });
hline(72, TEAL, 2);

doc.font("Helvetica").fontSize(8.5).fillColor(GRAY)
  .text("For corporates, hospitals, gyms & organizations. Pricing is per employee seat per month.", 30, 76);
doc.font("Helvetica").fontSize(8).fillColor("#EF4444")
  .text("GST @18% applicable. Minimum seats: Starter = 20 seats, Growth = 51 seats.", 30, 88);

const bizCols = [
  { width: 225, label: "Feature", bg: NAVY, fg: WHITE },
  { width: 160, label: "STARTER\n₹199 / seat / month\n20 – 50 seats\nMin. ₹3,980/mo + GST", bg: TEAL, fg: WHITE },
  { width: 150, label: "GROWTH ★\n₹249 / seat / month\n51 – 250 seats\nMin. ₹12,699/mo + GST", bg: NAVY, fg: WHITE },
];

const bizRows = [
  // MEMBER APP
  { sectionHeader: true, label: "📱  MEMBER APP FEATURES (what every employee gets)", bg: LTEAL, color: TEAL },
  { cells: [{ text: "All Pro app features for every member" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Daily Health Score (100-point scale)" }, tick(), tick()] },
  { cells: [{ text: "AI Food Scanner (photo + text)" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Nutrition: Calories, Protein, Carbs, Fat, Fiber" }, tick(), tick()] },
  { cells: [{ text: "Micronutrients: Calcium, Iron, B12, Vit C & D (ICMR RDA 2024)" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Exercise Tracking (WHO MET-minutes)" }, tick(), tick()] },
  { cells: [{ text: "Smart Water Intake (activity-adjusted goals)" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Medicine Adherence (WHO protocol)" }, tick(), tick()] },
  { cells: [{ text: "Sleep Quality Monitoring (CDC/WHO 7–9 hrs)" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "BMI — Asia-Pacific Indian-calibrated norms" }, tick(), tick()] },
  { cells: [{ text: "Blood Group & Emergency Health Profiles" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "AI Health Coach, Diet Plan & Meal Swap" }, tick(), tick()] },
  { cells: [{ text: "3000+ Indian Foods Database" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Offline Data Logging" }, tick(), tick()] },

  // ADMIN / CRM
  { sectionHeader: true, label: "🏢  ADMIN / CRM DASHBOARD (organization features)", bg: LPURP, color: PURPLE },
  { cells: [{ text: "Real-time Team Health Dashboard" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Enrollment Code Management" }, tick(), tick()] },
  { cells: [{ text: "Employee Search & Filter" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Department-wise Analytics" }, tick(), tick()] },
  { cells: [{ text: "Monthly Health Reports (automated PDF)" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Exportable PDF Health Reports" }, tick(), tick()] },
  { cells: [{ text: "GST-ready Invoicing" }, tick(), tick()] },
  { bg: LG, cells: [{ text: "Advanced Analytics & Health Trends" }, cross(), tick()] },
  { cells: [{ text: "AI Burnout & Absenteeism Prediction" }, cross(), tick()] },
  { bg: LG, cells: [{ text: "Health Risk Alerts (early warning system)" }, cross(), tick()] },
  { cells: [{ text: "Custom Wellness Programs" }, cross(), tick()] },
  { bg: LG, cells: [{ text: "Weekly & Monthly Automated Reports" }, cross(), tick()] },
  { cells: [{ text: "Personalized Goals (Harris-Benedict BMR)" }, cross(), tick()] },
  { bg: LG, cells: [{ text: "5-Pillar Stress Assessment" }, cross(), tick()] },
  { bg: LG, cells: [{ text: "Member Bulk Management" }, cross(), tick()] },
  { cells: [{ text: "Custom Announcements to Members" }, cross(), tick()] },
  { bg: LG, cells: [{ text: "Business CRM (Leads, Pipeline, Tasks)" }, cross(), val("FREE ✓", GREEN)] },

  // SUPPORT
  { sectionHeader: true, label: "🎧  SUPPORT", bg: LNAVY, color: NAVY },
  { cells: [{ text: "Support Channel" }, { text: "Email Support", align: "center", color: TEAL }, { text: "Priority Support", align: "center", color: NAVY, bold: true }] },

  // PRICING SUMMARY
  { sectionHeader: true, label: "💰  PRICING SUMMARY", bg: NAVY, color: WHITE },
  { bg: LG, cells: [{ text: "Price per Seat / Month", bold: true }, val("₹199", TEAL, { size: 13 }), val("₹249", NAVY, { size: 13 })] },
  { cells: [{ text: "Seat Range" }, { text: "20 – 50 seats", align: "center" }, { text: "51 – 250 seats", align: "center" }] },
  { bg: LG, cells: [{ text: "Min. Monthly Billing (excl. GST)", bold: true }, val("₹3,980", TEAL), val("₹12,699", NAVY)] },
  { cells: [{ text: "Annual Price (per seat / year)" }, { text: "₹1,990/seat", align: "center", color: TEAL }, { text: "₹2,490/seat", align: "center", color: NAVY }] },
  { bg: LG, cells: [{ text: "GST" }, { text: "@18% extra", align: "center" }, { text: "@18% extra", align: "center" }] },
  { cells: [{ text: "GST Invoice" }, tick(), tick()] },
];

endY = drawTable(100, bizCols, bizRows);

// Page 2 footer
hline(endY + 8, "#E5E7EB", 0.5);
doc.font("Helvetica").fontSize(7.5).fillColor(GRAY)
  .text("business.aorane.com  |  contact@aorane.com", 30, endY + 12)
  .text("Enterprise (251+ seats) — Contact us for custom pricing.", 30, endY + 12, { align: "right" });
doc.font("Helvetica").fontSize(7).fillColor("#9CA3AF")
  .text("* All prices in INR. GST @18% applicable. Plans and pricing subject to change.", 30, endY + 22);

doc.end();
console.log("PDF saved to:", OUT);
