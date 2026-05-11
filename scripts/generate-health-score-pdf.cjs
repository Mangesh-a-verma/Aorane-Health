const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../aorane-health-score-guide.pdf");
const LOGO = path.join(__dirname, "../artifacts/aorane-landing/public/logo-full.png");

const C = {
  primary:    "#0077B6",
  teal:       "#1B998B",
  orange:     "#E85D26",
  dark:       "#0D1B2A",
  text:       "#1A2332",
  muted:      "#64748B",
  light:      "#F0F7FF",
  border:     "#CBD5E1",
  white:      "#FFFFFF",
  green:      "#10B981",
  yellow:     "#F59E0B",
  red:        "#EF4444",
  purple:     "#8B5CF6",
  bg:         "#F8FAFC",
};

const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: "Aorane Health Score & Active Percentage Guide", Author: "Aorane Health" } });
doc.pipe(fs.createWriteStream(OUT));

const W = 595.28;
const H = 841.89;
const M = 40;
const IW = W - M * 2;

function hex2rgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

function fillRect(x, y, w, h, color, radius = 0) {
  if (radius > 0) {
    doc.roundedRect(x, y, w, h, radius).fill(color);
  } else {
    doc.rect(x, y, w, h).fill(color);
  }
}

function strokeRect(x, y, w, h, color, radius = 0, lw = 1) {
  doc.lineWidth(lw);
  if (radius > 0) {
    doc.roundedRect(x, y, w, h, radius).stroke(color);
  } else {
    doc.rect(x, y, w, h).stroke(color);
  }
}

function txt(text, x, y, opts = {}) {
  const { size = 10, color = C.text, font = "Helvetica", width, align = "left", opacity = 1 } = opts;
  doc.font(font).fontSize(size).fillColor(color).fillOpacity(opacity);
  const tOpts = { align };
  if (width) tOpts.width = width;
  doc.text(text, x, y, tOpts);
  doc.fillOpacity(1);
}

function sectionHeader(title, subtitle, y, color = C.primary) {
  fillRect(M, y, IW, 42, color, 10);
  txt(title, M + 16, y + 8, { size: 15, color: C.white, font: "Helvetica-Bold" });
  if (subtitle) txt(subtitle, M + 16, y + 26, { size: 8, color: C.white, opacity: 0.85 });
  return y + 50;
}

function pillBadge(label, x, y, bg, fg = C.white, w = 80) {
  fillRect(x, y, w, 18, bg, 9);
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(fg);
  doc.text(label, x, y + 4, { width: w, align: "center" });
}

function progressBar(x, y, w, pct, barColor, bgColor = C.border, h = 10, radius = 5) {
  fillRect(x, y, w, h, bgColor, radius);
  if (pct > 0) fillRect(x, y, Math.max(radius * 2, (pct / 100) * w), h, barColor, radius);
}

function componentCard(x, y, w, label, weight, score, color, icon, detail) {
  fillRect(x, y, w, 78, C.white, 8);
  strokeRect(x, y, w, 78, C.border, 8, 0.5);

  // Top color bar
  fillRect(x, y, w, 5, color, 8);
  doc.rect(x, y + 5 - 2, w, 2).fill(color); // flatten bottom corners of top bar

  // Icon circle
  fillRect(x + 10, y + 14, 28, 28, color + "20", 14);
  txt(icon, x + 14, y + 20, { size: 14 });

  // Label + weight
  txt(label, x + 44, y + 16, { size: 9, color: C.text, font: "Helvetica-Bold" });
  txt(`Weight: ${weight}%`, x + 44, y + 28, { size: 7.5, color: C.muted });

  // Progress bar
  const bw = w - 20;
  progressBar(x + 10, y + 50, bw, score, color, C.border, 8, 4);
  txt(`${score}/100`, x + 10 + bw + 4, y + 48, { size: 7, color });

  // Detail
  txt(detail, x + 10, y + 63, { size: 6.5, color: C.muted, width: w - 20 });
}

function gradeRow(grade, range, label, color, y) {
  fillRect(M, y, IW, 28, color + "12", 6);
  strokeRect(M, y, IW, 28, color + "40", 6, 0.5);

  fillRect(M + 8, y + 6, 32, 16, color, 4);
  txt(grade, M + 8, y + 8, { size: 11, color: C.white, font: "Helvetica-Bold", width: 32, align: "center" });

  txt(range, M + 50, y + 4, { size: 8, color: C.muted });
  txt(label, M + 50, y + 14, { size: 10, color: C.text, font: "Helvetica-Bold" });

  // mini bar
  const bw = 200;
  const pct = parseInt(range.split("–")[0] || range.replace("+","").replace("<","")) || 0;
  const clampPct = Math.min(100, pct);
  progressBar(W - M - bw - 10, y + 9, bw, clampPct, color, C.border, 10, 5);
  txt(`${range}`, W - M - 10, y + 8, { size: 7, color, align: "right", width: 10 });

  return y + 36;
}

// ══════════════════════════════════════════════════════
// PAGE 1 — COVER
// ══════════════════════════════════════════════════════

// Background gradient simulation
fillRect(0, 0, W, 320, C.primary);
fillRect(0, 280, W, 60, C.teal);
fillRect(0, 320, W, H - 320, C.bg);

// Decorative circles
doc.circle(W - 60, 80, 120).fillOpacity(0.06).fill(C.white).fillOpacity(1);
doc.circle(60, 240, 80).fillOpacity(0.04).fill(C.white).fillOpacity(1);
doc.circle(W - 20, 300, 60).fillOpacity(0.06).fill(C.white).fillOpacity(1);

// Logo
if (fs.existsSync(LOGO)) {
  doc.image(LOGO, M, 36, { width: 130, height: 50, fit: [130, 50] });
}

// Cover title
txt("Health Score &", M, 130, { size: 36, color: C.white, font: "Helvetica-Bold" });
txt("Active Percentage", M, 172, { size: 36, color: C.white, font: "Helvetica-Bold" });
txt("Complete Guide", M, 214, { size: 20, color: C.white, font: "Helvetica", opacity: 0.85 });

// Cover subtitle
txt("How Aorane calculates your daily health intelligence", M, 256, { size: 11, color: C.white, opacity: 0.75, width: 380 });

// Badge strip
const badges = [
  { label: "WHO 2020", color: C.teal },
  { label: "ICMR 2024", color: C.orange },
  { label: "Harris-Benedict", color: C.purple },
  { label: "Asia-Pacific BMI", color: C.green },
];
let bx = M;
badges.forEach(b => {
  fillRect(bx, 296, 90, 22, b.color + "30", 11);
  doc.rect(bx, 296, 90, 22).stroke(b.color + "60");
  txt(b.label, bx, 302, { size: 7.5, color: C.white, font: "Helvetica-Bold", width: 90, align: "center" });
  bx += 98;
});

// White content area starts at y=340
let cy = 345;

// Intro box
fillRect(M, cy, IW, 72, C.white, 10);
strokeRect(M, cy, IW, 72, C.border, 10, 0.5);
fillRect(M, cy, 5, 72, C.primary, 3);

txt("What is Aorane Health Score?", M + 18, cy + 10, { size: 13, color: C.text, font: "Helvetica-Bold" });
txt(
  "Aorane Health Score is a single number (0–100) that reflects your overall daily health status. It is computed using six scientifically validated pillars — Nutrition, Exercise, Hydration, Medicine Adherence, Sleep, and Body Wellness (BMI). Each pillar is benchmarked against WHO, ICMR, and CDC guidelines personalised to your age, gender, weight, height, goal, and health conditions.",
  M + 18, cy + 26, { size: 8.5, color: C.muted, width: IW - 30 }
);

cy += 82;

// Score visual
txt("HOW THE SCORE IS BUILT", M, cy, { size: 8, color: C.muted, font: "Helvetica-Bold", width: IW });
cy += 14;

// Composite formula visual
fillRect(M, cy, IW, 50, C.light, 8);
strokeRect(M, cy, IW, 50, C.primary + "30", 8, 0.5);

const parts = [
  { label: "Food", pct: "30%", color: C.green },
  { label: "Exercise", pct: "25%", color: C.primary },
  { label: "Water", pct: "15%", color: C.teal },
  { label: "Medicine", pct: "15%", color: C.purple },
  { label: "Sleep", pct: "10%", color: C.orange },
  { label: "BMI", pct: "5%", color: C.yellow },
];

const pw = IW / parts.length;
parts.forEach((p, i) => {
  const px = M + i * pw;
  const pct = parseInt(p.pct);
  const barH = (pct / 30) * 28;
  fillRect(px + pw/2 - 12, cy + 42 - barH, 24, barH, p.color, 4);
  txt(p.pct, px, cy + 6, { size: 8.5, color: p.color, font: "Helvetica-Bold", width: pw, align: "center" });
  txt(p.label, px, cy + 18, { size: 7, color: C.muted, width: pw, align: "center" });
});

cy += 60;

// Formula text
fillRect(M, cy, IW, 22, C.dark, 6);
txt("Score = (Food×0.30) + (Exercise×0.25) + (Water×0.15) + (Medicine×0.15) + (Sleep×0.10) + (BMI×0.05)",
  M, cy + 6, { size: 7.5, color: C.white, font: "Helvetica-Bold", width: IW, align: "center" });

cy += 32;

// ══════════════════════════════════════════════════════
// GRADE SYSTEM
// ══════════════════════════════════════════════════════
txt("GRADE SYSTEM", M, cy, { size: 8, color: C.muted, font: "Helvetica-Bold" });
cy += 12;

const grades = [
  { grade: "A+", range: "90–100", label: "Excellent — Peak Health Performance", color: C.green },
  { grade: "A",  range: "75–89",  label: "Very Good — Strong Daily Habits", color: C.teal },
  { grade: "B",  range: "60–74",  label: "Good — On the Right Track", color: C.primary },
  { grade: "C",  range: "45–59",  label: "Average — Room for Improvement", color: C.yellow },
  { grade: "D",  range: "30–44",  label: "Needs Improvement — Take Action", color: C.orange },
  { grade: "F",  range: "0–29",   label: "Critical — Act Now", color: C.red },
];

grades.forEach(g => {
  cy = gradeRow(g.grade, g.range, g.label, g.color, cy);
  cy += 2;
});

// Footer p1
fillRect(0, H - 28, W, 28, C.dark);
txt("Aorane Health Intelligence — Powered by WHO + ICMR + CDC Guidelines", 0, H - 20, { size: 7.5, color: C.white, opacity: 0.6, width: W, align: "center" });
txt("Page 1", W - M - 20, H - 20, { size: 7, color: C.white, opacity: 0.5 });

// ══════════════════════════════════════════════════════
// PAGE 2 — COMPONENT DETAILS
// ══════════════════════════════════════════════════════
doc.addPage({ size: "A4", margin: 0 });
fillRect(0, 0, W, H, C.bg);

// Header bar
fillRect(0, 0, W, 52, C.dark);
if (fs.existsSync(LOGO)) doc.image(LOGO, M, 8, { width: 80, height: 36, fit: [80, 36] });
txt("HEALTH SCORE COMPONENTS", W/2, 18, { size: 13, color: C.white, font: "Helvetica-Bold", width: 300, align: "center" });
txt("Detailed breakdown of all 6 scoring pillars", W/2, 34, { size: 8, color: C.white, opacity: 0.6, width: 300, align: "center" });

cy = 64;

// ── 1. NUTRITION ──────────────────────────────────────
cy = sectionHeader("🥗  Nutrition (Food Score)", "Weight: 30%  ·  Reference: ICMR Dietary Guidelines 2024", cy, C.green);

fillRect(M, cy, IW, 100, C.white, 8);
strokeRect(M, cy, IW, 100, C.border, 8, 0.5);

// Without micro data
const col1W = IW / 2 - 8;
fillRect(M + 8, cy + 8, col1W, 84, C.light, 6);
txt("Without Micronutrient Data", M + 16, cy + 14, { size: 8, color: C.primary, font: "Helvetica-Bold" });
const fItems1 = [
  { label: "Calories (ICMR goal-adjusted)", pct: 40, color: C.green },
  { label: "Protein (body weight × RDA)", pct: 35, color: C.primary },
  { label: "Meal Regularity (3 meals/day)", pct: 15, color: C.teal },
  { label: "Fiber (ICMR: 25–30g/day)", pct: 10, color: C.orange },
];
fItems1.forEach((f, i) => {
  const fy = cy + 28 + i * 16;
  progressBar(M + 16, fy, col1W - 16, f.pct * 2.5, f.color, C.border, 7, 3);
  txt(f.label, M + 16, fy + 9, { size: 6.5, color: C.muted, width: col1W - 20 });
  txt(`${f.pct}%`, M + 16 + col1W - 16, fy - 1, { size: 7, color: f.color, font: "Helvetica-Bold" });
});

// With micro data
const col2X = M + col1W + 16;
fillRect(col2X, cy + 8, col1W, 84, C.light, 6);
txt("With Micronutrient Data", col2X + 8, cy + 14, { size: 8, color: C.purple, font: "Helvetica-Bold" });
const fItems2 = [
  { label: "Calories", pct: 30, color: C.green },
  { label: "Protein", pct: 25, color: C.primary },
  { label: "Fiber", pct: 15, color: C.orange },
  { label: "Micronutrients", pct: 20, color: C.purple },
  { label: "Meal Regularity", pct: 10, color: C.teal },
];
fItems2.forEach((f, i) => {
  const fy = cy + 28 + i * 13;
  progressBar(col2X + 8, fy, col1W - 16, f.pct * 3, f.color, C.border, 6, 3);
  txt(f.label, col2X + 8, fy + 7, { size: 6, color: C.muted });
  txt(`${f.pct}%`, col2X + col1W - 8, fy - 1, { size: 7, color: f.color, font: "Helvetica-Bold" });
});

cy += 108;

// Calorie logic box
fillRect(M, cy, IW, 36, C.white, 6);
strokeRect(M, cy, IW, 36, C.border, 6, 0.5);
txt("🎯  Personalised Calorie Goal (Harris-Benedict BMR)", M + 10, cy + 6, { size: 8, color: C.text, font: "Helvetica-Bold" });
txt("BMR (Male) = 66 + (13.7 × weight kg) + (5 × height cm) − (6.8 × age)    |    BMR (Female) = 655 + (9.6 × W) + (1.8 × H) − (4.7 × age)", M + 10, cy + 18, { size: 7, color: C.muted, width: IW - 20 });
txt("Goal Adjustments: Weight Loss → −15%  |  Muscle Gain → +10%  |  Maintenance → TDEE", M + 10, cy + 27, { size: 7, color: C.muted, width: IW - 20 });

cy += 44;

// ── 2. EXERCISE ──────────────────────────────────────
cy = sectionHeader("🏃  Exercise Score", "Weight: 25%  ·  Reference: WHO Physical Activity Guidelines 2020", cy, C.primary);

fillRect(M, cy, IW, 52, C.white, 8);
strokeRect(M, cy, IW, 52, C.border, 8, 0.5);

txt("Daily Goal: 85.7 MET-min/day  (600 MET-min/week)", M + 12, cy + 10, { size: 9, color: C.primary, font: "Helvetica-Bold" });
txt("Score = (Actual MET-min ÷ 85.7) × 100   [capped at 100]", M + 12, cy + 24, { size: 8, color: C.text, font: "Helvetica-Bold" });
txt("MET values are assigned per exercise type and intensity. Higher intensity activities earn more MET-minutes per minute.", M + 12, cy + 36, { size: 7.5, color: C.muted, width: IW - 24 });

cy += 60;

// ── 3. HYDRATION ──────────────────────────────────────
cy = sectionHeader("💧  Hydration (Water Score)", "Weight: 15%  ·  Reference: WHO/ICMR Hydration Guidelines", cy, C.teal);

fillRect(M, cy, IW, 44, C.white, 8);
strokeRect(M, cy, IW, 44, C.border, 8, 0.5);

const hCols = [
  { label: "Men (Sedentary)", goal: "2500 ml", color: C.primary },
  { label: "Women (Sedentary)", goal: "2000 ml", color: C.teal },
  { label: "Moderately Active", goal: "+250 ml", color: C.orange },
  { label: "Very Active / Athlete", goal: "+500 ml", color: C.red },
];
hCols.forEach((h, i) => {
  const hx = M + i * (IW / 4) + 8;
  txt(h.label, hx, cy + 8, { size: 7, color: C.muted, width: IW/4 - 10 });
  txt(h.goal, hx, cy + 20, { size: 10, color: h.color, font: "Helvetica-Bold", width: IW/4 - 10 });
  txt("Score = Actual ÷ Goal × 100", hx, cy + 33, { size: 6, color: C.muted, width: IW/4 - 10 });
});

cy += 52;

// ── 4. MEDICINE ──────────────────────────────────────
cy = sectionHeader("💊  Medicine Adherence", "Weight: 15%  ·  Reference: WHO Adherence to Long-Term Therapies", cy, C.purple);

fillRect(M, cy, IW, 36, C.white, 8);
strokeRect(M, cy, IW, 36, C.border, 8, 0.5);
txt("Score = (Medicines Taken ÷ Medicines Scheduled) × 100", M + 12, cy + 10, { size: 9, color: C.text, font: "Helvetica-Bold" });
txt("If no medicines are scheduled → Score defaults to 75 (neutral, does not penalise non-medicated users).", M + 12, cy + 24, { size: 7.5, color: C.muted, width: IW - 24 });

cy += 44;

// ── 5. SLEEP ──────────────────────────────────────
cy = sectionHeader("😴  Sleep Score", "Weight: 10%  ·  Reference: CDC/WHO Sleep Guidelines", cy, C.orange);

fillRect(M, cy, IW, 44, C.white, 8);
strokeRect(M, cy, IW, 44, C.border, 8, 0.5);

const sleepData = [
  { range: "7–9 hrs", score: 100, color: C.green, label: "Optimal" },
  { range: "9–10 hrs", score: 80, color: C.teal, label: "Slightly Long" },
  { range: "6–7 hrs", score: 75, color: C.primary, label: "Slightly Short" },
  { range: "5–6 hrs", score: 45, color: C.yellow, label: "Short" },
  { range: ">10 hrs", score: 60, color: C.orange, label: "Too Long" },
  { range: "<5 hrs", score: 20, color: C.red, label: "Critical" },
];
const sW = IW / sleepData.length;
sleepData.forEach((s, i) => {
  const sx = M + i * sW + 4;
  pillBadge(s.range, sx, cy + 8, s.color, C.white, sW - 8);
  txt(`${s.score}/100`, sx, cy + 28, { size: 8, color: s.color, font: "Helvetica-Bold", width: sW - 8, align: "center" });
  txt(s.label, sx, cy + 38, { size: 6, color: C.muted, width: sW - 8, align: "center" });
});

cy += 52;

// ── 6. BMI ──────────────────────────────────────
cy = sectionHeader("⚖️  BMI / Body Wellness", "Weight: 5%  ·  Reference: WHO Asia-Pacific BMI Guidelines (lower thresholds for Indians)", cy, C.yellow);

fillRect(M, cy, IW, 44, C.white, 8);
strokeRect(M, cy, IW, 44, C.border, 8, 0.5);

const bmiData = [
  { range: "18.5–22.9", cat: "Normal", score: 100, color: C.green },
  { range: "23.0–24.9", cat: "Normal-High", score: 90, color: C.teal },
  { range: "17.0–18.4", cat: "Mild Under", score: 65, color: C.primary },
  { range: "25.0–27.4", cat: "Overweight", score: 65, color: C.yellow },
  { range: "27.5–30.0", cat: "Obese I", score: 45, color: C.orange },
  { range: "30.1–35.0", cat: "Obese II", score: 25, color: C.red },
];
const bW = IW / bmiData.length;
bmiData.forEach((b, i) => {
  const bx = M + i * bW + 4;
  fillRect(bx, cy + 8, bW - 8, 10, b.color, 3);
  txt(b.range, bx, cy + 10, { size: 6, color: C.white, font: "Helvetica-Bold", width: bW - 8, align: "center" });
  txt(b.cat, bx, cy + 22, { size: 6.5, color: C.muted, width: bW - 8, align: "center" });
  txt(`${b.score}/100`, bx, cy + 33, { size: 8, color: b.color, font: "Helvetica-Bold", width: bW - 8, align: "center" });
});

cy += 52;

// Footer p2
fillRect(0, H - 28, W, 28, C.dark);
txt("Aorane Health Intelligence — Powered by WHO + ICMR + CDC Guidelines", 0, H - 20, { size: 7.5, color: C.white, opacity: 0.6, width: W, align: "center" });
txt("Page 2", W - M - 20, H - 20, { size: 7, color: C.white, opacity: 0.5 });

// ══════════════════════════════════════════════════════
// PAGE 3 — ACTIVE %, MICRONUTRIENTS, HOW IT HELPS
// ══════════════════════════════════════════════════════
doc.addPage({ size: "A4", margin: 0 });
fillRect(0, 0, W, H, C.bg);

fillRect(0, 0, W, 52, C.dark);
if (fs.existsSync(LOGO)) doc.image(LOGO, M, 8, { width: 80, height: 36, fit: [80, 36] });
txt("ACTIVE PERCENTAGE & MICRONUTRIENTS", W/2, 18, { size: 13, color: C.white, font: "Helvetica-Bold", width: 340, align: "center" });
txt("How daily engagement and nutrient tracking works", W/2, 34, { size: 8, color: C.white, opacity: 0.6, width: 340, align: "center" });

cy = 64;

// ── ACTIVE PERCENTAGE ──────────────────────────────────
cy = sectionHeader("📊  What is Active Percentage?", "Measures your daily app engagement and health tracking consistency", cy, C.primary);

fillRect(M, cy, IW, 56, C.white, 8);
strokeRect(M, cy, IW, 56, C.border, 8, 0.5);

txt("Active Percentage tells you HOW CONSISTENTLY you are tracking your health each day. Unlike Health Score (which measures quality), Active % measures quantity — how many health categories you logged today vs. what was possible.", M + 12, cy + 8, { size: 8, color: C.muted, width: IW - 24 });
txt("It tracks 4 activity categories:", M + 12, cy + 32, { size: 8, color: C.text, font: "Helvetica-Bold" });

const cats = [
  { icon: "🥗", label: "Food Log", color: C.green },
  { icon: "💧", label: "Water Log", color: C.teal },
  { icon: "🏃", label: "Exercise Log", color: C.primary },
  { icon: "💊", label: "Medicine Log", color: C.purple },
];
cats.forEach((c, i) => {
  const cx2 = M + 120 + i * 105;
  fillRect(cx2, cy + 28, 96, 20, c.color + "15", 5);
  txt(`${c.icon} ${c.label}`, cx2 + 4, cy + 34, { size: 7.5, color: c.color, font: "Helvetica-Bold" });
});

cy += 64;

// Active % metrics
txt("THREE ACTIVE % METRICS YOU SEE IN THE APP", M, cy, { size: 8, color: C.muted, font: "Helvetica-Bold" });
cy += 12;

const metrics = [
  {
    title: "THIS WEEK %",
    formula: "Average normalized_pct of last 7 days",
    desc: "Shows how active you've been this week. Displayed as the main badge on your Scorecard card. Updates every day as you log.",
    color: C.primary,
    icon: "📅",
  },
  {
    title: "TODAY %",
    formula: "Today's normalized_pct from daily_activity_scores",
    desc: "How much health data have you logged today? Resets every midnight IST. Logs in any category increase this immediately.",
    color: C.teal,
    icon: "🌅",
  },
  {
    title: "OVERALL %",
    formula: "AVG of all days where app_opened = true",
    desc: "Your lifetime consistency score — cumulative average across all days you have used Aorane. Reflects your long-term habit strength.",
    color: C.orange,
    icon: "🏆",
  },
];

metrics.forEach((m, i) => {
  const mx = M + i * (IW/3 + 4);
  const mw = IW/3 - 2;
  fillRect(mx, cy, mw, 110, C.white, 8);
  strokeRect(mx, cy, mw, 110, C.border, 8, 0.5);
  fillRect(mx, cy, mw, 5, m.color, 8);
  doc.rect(mx, cy + 3, mw, 2).fill(m.color);

  txt(m.icon, mx + 10, cy + 14, { size: 18 });
  txt(m.title, mx + 10, cy + 38, { size: 9, color: m.color, font: "Helvetica-Bold", width: mw - 20 });
  txt(m.formula, mx + 10, cy + 52, { size: 6.5, color: C.muted, width: mw - 20 });
  txt(m.desc, mx + 10, cy + 68, { size: 7, color: C.text, width: mw - 20 });
});

cy += 118;

// Trend
fillRect(M, cy, IW, 30, C.dark + "08", 6);
strokeRect(M, cy, IW, 30, C.border, 6, 0.5);
txt("📈  Trend Detection:", M + 12, cy + 10, { size: 8, color: C.text, font: "Helvetica-Bold" });
txt("Improving", M + 120, cy + 6, { size: 7.5, color: C.green, font: "Helvetica-Bold" });
txt("→ This Week % is ≥5 pts higher than last week", M + 165, cy + 6, { size: 7.5, color: C.muted });
txt("Declining", M + 120, cy + 18, { size: 7.5, color: C.red, font: "Helvetica-Bold" });
txt("→ This Week % is ≥5 pts lower than last week  |  Stable → difference <5 pts", M + 165, cy + 18, { size: 7.5, color: C.muted });

cy += 38;

// ── MICRONUTRIENTS ──────────────────────────────────
cy = sectionHeader("🔬  Micronutrient Score (Inside Food Score)", "Composite of 5 key nutrients · Reference: ICMR RDA 2020 + WHO", cy, C.purple);

fillRect(M, cy, IW, 80, C.white, 8);
strokeRect(M, cy, IW, 80, C.border, 8, 0.5);

const micros = [
  { name: "Iron", weight: "30%", goal: "Male: 17mg  |  Female: 21mg  |  Anemia: 30mg", color: C.red },
  { name: "Calcium", weight: "25%", goal: "Adults: 600mg  |  Elderly: 800mg  |  Osteoporosis: 1000mg", color: C.orange },
  { name: "Vitamin B12", weight: "20%", goal: "2.4 mcg/day (WHO RDA — especially important for vegetarians)", color: C.purple },
  { name: "Vitamin C", weight: "15%", goal: "40 mg/day (ICMR RDA)", color: C.green },
  { name: "Vitamin D", weight: "10%", goal: "10 mcg/day adults  |  15 mcg elderly 60+", color: C.yellow },
];

micros.forEach((m, i) => {
  const my = cy + 8 + i * 14;
  fillRect(M + 8, my, 60, 12, m.color, 3);
  txt(m.name, M + 8, my + 2, { size: 7.5, color: C.white, font: "Helvetica-Bold", width: 60, align: "center" });
  fillRect(M + 74, my, 28, 12, m.color + "20", 3);
  txt(m.weight, M + 74, my + 2, { size: 7.5, color: m.color, font: "Helvetica-Bold", width: 28, align: "center" });
  txt(m.goal, M + 108, my + 2, { size: 7, color: C.muted, width: IW - 120 });
});

txt("Formula: (Iron×0.30) + (Calcium×0.25) + (B12×0.20) + (Vit C×0.15) + (Vit D×0.10) = Micronutrient Composite Score",
  M + 8, cy + 68, { size: 7, color: C.primary, font: "Helvetica-Bold", width: IW - 16 });

cy += 88;

// ── HOW IT HELPS ──────────────────────────────────────
cy = sectionHeader("💡  How Does This Help You?", "Real benefits of tracking your Aorane Health Score every day", cy, C.teal);

const benefits = [
  { icon: "🎯", title: "Personalised Targets", desc: "Your calorie goal, protein RDA, fiber target, and micronutrient needs are all calculated based on YOUR body — not generic averages. The same food gives different scores to different users based on their weight, age, and goal." },
  { icon: "📉", title: "Early Warning System", desc: "A declining Health Score or Active % trend alerts you before small habits turn into serious health issues. The Grade F (Critical) triggers urgent recommendations to act immediately." },
  { icon: "🏅", title: "Motivation Through Scores", desc: "Seeing your score improve day-by-day creates a powerful motivation loop. The This Week % badge on your card shows your recent consistency at a glance, encouraging you to maintain streaks." },
  { icon: "🔬", title: "Scientific Benchmarking", desc: "Every metric is compared against WHO 2020, ICMR 2024, and CDC guidelines. You are not just 'tracking data' — you are being evaluated against the same standards used by global health organisations." },
  { icon: "🩺", title: "Condition-Aware Scoring", desc: "If you have diabetes, your fiber goal is raised to 35g. If you are anaemic, iron target doubles. If you are elderly, protein and vitamin D targets increase. Your health conditions directly shape your score." },
  { icon: "📊", title: "Trend Visibility", desc: "The 7-day vs 14-day comparison shows if your habits are Improving, Stable, or Declining. This gives you actionable insight to course-correct before a bad week becomes a bad month." },
];

const bCols = 2;
const bW2 = IW / bCols - 6;
benefits.forEach((b, i) => {
  const bRow = Math.floor(i / bCols);
  const bCol = i % bCols;
  const bx = M + bCol * (bW2 + 12);
  const by = cy + bRow * 62;

  fillRect(bx, by, bW2, 56, C.white, 8);
  strokeRect(bx, by, bW2, 56, C.border, 8, 0.5);
  txt(b.icon, bx + 10, by + 12, { size: 16 });
  txt(b.title, bx + 36, by + 10, { size: 9, color: C.text, font: "Helvetica-Bold", width: bW2 - 44 });
  txt(b.desc, bx + 36, by + 22, { size: 7, color: C.muted, width: bW2 - 44 });
});

cy += Math.ceil(benefits.length / bCols) * 62 + 8;

// References box
fillRect(M, cy, IW, 48, C.dark, 8);
txt("📚  Scientific References", M + 12, cy + 8, { size: 9, color: C.white, font: "Helvetica-Bold" });
const refs = [
  "WHO Physical Activity Guidelines 2020  ·  ICMR Dietary Guidelines for Indians 2024  ·  ICMR RDA 2020",
  "CDC/WHO Sleep Recommendations  ·  WHO BMI Classification + Asia-Pacific Guidelines  ·  Harris-Benedict Equation (1919)",
  "WHO Adherence to Long-Term Therapies Report  ·  WHO/ICMR Hydration Guidelines",
];
refs.forEach((r, i) => {
  txt(r, M + 12, cy + 20 + i * 10, { size: 6.5, color: C.white, opacity: 0.7, width: IW - 24 });
});

// Footer p3
fillRect(0, H - 28, W, 28, C.dark);
txt("Aorane Health Intelligence — Powered by WHO + ICMR + CDC Guidelines", 0, H - 20, { size: 7.5, color: C.white, opacity: 0.6, width: W, align: "center" });
txt("Page 3", W - M - 20, H - 20, { size: 7, color: C.white, opacity: 0.5 });

doc.end();
console.log("PDF generated:", OUT);
