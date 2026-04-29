// Aorane Platform — Full Project Structure PDF Generator
// Run: node scripts/generate-project-pdf.js

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "../exports/aorane-project-structure.pdf");
const doc = new PDFDocument({ size: "A4", margin: 45, bufferPages: true });
const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

// ─── Colors ────────────────────────────────────────────────────────────────────
const C = {
  brand:    "#E8622A",
  dark:     "#0A1628",
  navy:     "#0D2040",
  blue:     "#3B82F6",
  green:    "#10B981",
  purple:   "#8B5CF6",
  orange:   "#F59E0B",
  red:      "#EF4444",
  gray:     "#6B7280",
  lightGray:"#F3F4F6",
  white:    "#FFFFFF",
  text:     "#1F2937",
  muted:    "#9CA3AF",
  teal:     "#14B8A6",
  pink:     "#EC4899",
};

const W = doc.page.width - 90;  // usable width
const LEFT = 45;

// ─── Helpers ────────────────────────────────────────────────────────────────────
function newPage() { doc.addPage(); }

function sectionHeader(title, color = C.brand) {
  const y = doc.y;
  doc.rect(LEFT, y, W, 30).fill(color);
  doc.fillColor(C.white).fontSize(13).font("Helvetica-Bold")
    .text(title, LEFT + 12, y + 8, { width: W - 20 });
  doc.fillColor(C.text).font("Helvetica").fontSize(9);
  doc.moveDown(0.4);
}

function subHeader(title, color = C.blue) {
  doc.moveDown(0.3);
  const y = doc.y;
  doc.rect(LEFT, y, 4, 16).fill(color);
  doc.fillColor(color).fontSize(10.5).font("Helvetica-Bold")
    .text(title, LEFT + 10, y + 2);
  doc.fillColor(C.text).font("Helvetica").fontSize(9);
  doc.moveDown(0.3);
}

function badge(text, x, y, bgColor, textColor = C.white, w = 70) {
  doc.rect(x, y, w, 14).fill(bgColor);
  doc.fillColor(textColor).fontSize(7).font("Helvetica-Bold")
    .text(text, x + 3, y + 3, { width: w - 6, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor(C.text);
  return x + w + 4;
}

function pill(method, x, y) {
  const colors = { GET: C.green, POST: C.blue, PUT: C.orange, PATCH: C.purple, DELETE: C.red };
  const col = colors[method] || C.gray;
  doc.rect(x, y, 38, 12).fill(col);
  doc.fillColor(C.white).fontSize(6.5).font("Helvetica-Bold")
    .text(method, x + 2, y + 2.5, { width: 34, align: "center" });
  doc.font("Helvetica").fillColor(C.text).fontSize(9);
  return x + 42;
}

function routeRow(method, path, desc, indent = 0) {
  if (doc.y > 750) newPage();
  const y = doc.y;
  const startX = pill(method, LEFT + indent, y - 1);
  doc.fillColor(C.navy).fontSize(8).font("Courier")
    .text(path, startX, y, { width: 210 - indent });
  const pathLines = doc.heightOfString(path, { width: 210 - indent, fontSize: 8 });
  const rowY = y + Math.max(pathLines, 12);
  if (desc) {
    doc.fillColor(C.gray).fontSize(7.5).font("Helvetica")
      .text(desc, startX + 215 - indent, y, { width: W - 260 });
  }
  doc.y = rowY + 1;
}

function tableRow(cols, widths, isHeader = false, rowColor = null) {
  if (doc.y > 770) newPage();
  const y = doc.y;
  const h = 16;
  if (rowColor) doc.rect(LEFT, y, W, h).fill(rowColor);
  let x = LEFT;
  cols.forEach((col, i) => {
    doc.fillColor(isHeader ? C.white : C.text)
       .fontSize(isHeader ? 8 : 8)
       .font(isHeader ? "Helvetica-Bold" : "Helvetica")
       .text(String(col), x + 4, y + 4, { width: widths[i] - 6, ellipsis: true });
    x += widths[i];
  });
  doc.rect(LEFT, y, W, h).stroke("#E5E7EB");
  doc.y = y + h;
}

function twoCol(items, leftWidth = 240) {
  const rightX = LEFT + leftWidth + 12;
  const rightWidth = W - leftWidth - 12;
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);
  const startY = doc.y;
  let leftY = startY;
  let rightY = startY;

  leftItems.forEach(item => {
    if (leftY > 770) { newPage(); leftY = doc.y; rightY = doc.y; }
    doc.circle(LEFT + 5, leftY + 4, 2.5).fill(C.brand);
    doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
      .text(item, LEFT + 14, leftY, { width: leftWidth - 14 });
    leftY += doc.heightOfString(item, { width: leftWidth - 14, fontSize: 8.5 }) + 4;
  });

  rightItems.forEach(item => {
    if (rightY > 770) { newPage(); rightY = doc.y; }
    doc.circle(rightX + 5, rightY + 4, 2.5).fill(C.brand);
    doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
      .text(item, rightX + 14, rightY, { width: rightWidth - 14 });
    rightY += doc.heightOfString(item, { width: rightWidth - 14, fontSize: 8.5 }) + 4;
  });

  doc.y = Math.max(leftY, rightY) + 4;
}

function bullet(text, color = C.brand, indent = 0) {
  if (doc.y > 765) newPage();
  const y = doc.y;
  doc.circle(LEFT + indent + 5, y + 4, 2.5).fill(color);
  doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
    .text(text, LEFT + indent + 14, y, { width: W - indent - 14 });
  doc.moveDown(0.15);
}

function divider() {
  doc.moveDown(0.3);
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + W, doc.y).strokeColor("#E5E7EB").stroke();
  doc.moveDown(0.3);
}

function boxCard(title, items, x, y, w, h, color) {
  doc.rect(x, y, w, h).fill(color + "18").stroke(color + "66");
  doc.fillColor(color).fontSize(8.5).font("Helvetica-Bold")
    .text(title, x + 6, y + 5, { width: w - 12 });
  doc.fillColor(C.text).fontSize(7.5).font("Helvetica");
  items.forEach((item, i) => {
    doc.text("• " + item, x + 6, y + 18 + i * 11, { width: w - 12, ellipsis: true });
  });
}

function pageFooter(pageNum, total) {
  const footY = doc.page.height - 30;
  doc.rect(0, footY - 5, doc.page.width, 35).fill("#F9FAFB");
  doc.moveTo(LEFT, footY - 5).lineTo(doc.page.width - LEFT, footY - 5).strokeColor("#E5E7EB").stroke();
  doc.fillColor(C.muted).fontSize(8).font("Helvetica")
    .text("Aorane Health Platform — Confidential Technical Documentation", LEFT, footY + 3, { align: "left", width: W / 2 });
  doc.fillColor(C.muted).fontSize(8)
    .text(`Page ${pageNum} of ${total}`, LEFT, footY + 3, { align: "right", width: W });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 1 — COVER
// ═══════════════════════════════════════════════════════════════════════════════

// Background gradient simulation
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.dark);
doc.rect(0, 0, doc.page.width, 5).fill(C.brand);
doc.rect(0, doc.page.height - 5, doc.page.width, 5).fill(C.brand);

// Side accent
doc.rect(0, 0, 6, doc.page.height).fill(C.brand);

// Decorative circles
doc.circle(500, 100, 130).fill("#1a3358");
doc.circle(80, 680, 90).fill("#1a3358");
doc.circle(450, 620, 60).fill("#1a2a48");

// Logo area
doc.rect(LEFT + 10, 80, 52, 52).fill(C.brand).radius = 8;
doc.fillColor(C.white).fontSize(30).font("Helvetica-Bold").text("A", LEFT + 26, 90);

// Title
doc.fillColor(C.white).fontSize(38).font("Helvetica-Bold")
  .text("AORANE", LEFT + 75, 87);
doc.fillColor(C.brand).fontSize(16).font("Helvetica")
  .text("HEALTH", LEFT + 76, 128);

// Tagline
doc.fillColor("#94A3B8").fontSize(12).font("Helvetica")
  .text("AI-Powered Indian Health-Tech Platform", LEFT + 10, 165);

// Horizontal rule
doc.moveTo(LEFT + 10, 190).lineTo(LEFT + W - 10, 190).strokeColor(C.brand).lineWidth(1.5).stroke();
doc.lineWidth(1);

// Main title
doc.fillColor(C.white).fontSize(22).font("Helvetica-Bold")
  .text("Complete Project Architecture", LEFT + 10, 205);
doc.fillColor("#94A3B8").fontSize(12)
  .text("Technical Documentation & Structure Analysis", LEFT + 10, 232);

// Stats grid
const stats = [
  { v: "6", l: "Artifacts" },
  { v: "100+", l: "API Endpoints" },
  { v: "40+", l: "DB Tables" },
  { v: "5", l: "Languages" },
];
let sx = LEFT + 10;
stats.forEach(s => {
  doc.rect(sx, 275, 118, 68).fill("#1a3358");
  doc.rect(sx, 275, 118, 4).fill(C.brand);
  doc.fillColor(C.brand).fontSize(24).font("Helvetica-Bold")
    .text(s.v, sx + 10, 288, { width: 98, align: "center" });
  doc.fillColor("#94A3B8").fontSize(9).font("Helvetica")
    .text(s.l, sx + 10, 315, { width: 98, align: "center" });
  sx += 128;
});

// Architecture blocks
const blocks = [
  { t: "Mobile App", sub: "Expo React Native", col: C.green },
  { t: "Landing Page", sub: "React + Vite", col: C.blue },
  { t: "Admin Panel", sub: "React + Vite", col: C.orange },
  { t: "Business Portal", sub: "React + Vite", col: C.purple },
];
doc.fillColor(C.white).fontSize(11).font("Helvetica-Bold")
  .text("Platform Components", LEFT + 10, 365);
let bx = LEFT + 10;
blocks.forEach(b => {
  doc.rect(bx, 382, 118, 50).fill("#1a3358");
  doc.rect(bx, 382, 4, 50).fill(b.col);
  doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold")
    .text(b.t, bx + 10, 390, { width: 104 });
  doc.fillColor("#94A3B8").fontSize(7.5).font("Helvetica")
    .text(b.sub, bx + 10, 404, { width: 104 });
  bx += 128;
});

// API + DB box
doc.rect(LEFT + 10, 450, 240, 55).fill("#1a3358");
doc.rect(LEFT + 10, 450, 4, 55).fill(C.teal);
doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold")
  .text("API Server", LEFT + 20, 459);
doc.fillColor("#94A3B8").fontSize(7.5).font("Helvetica")
  .text("Express.js + Drizzle ORM", LEFT + 20, 473);
doc.fillColor("#94A3B8").fontSize(7.5)
  .text("Hosted on Render (Mumbai region)", LEFT + 20, 485);

doc.rect(LEFT + 262, 450, 240, 55).fill("#1a3358");
doc.rect(LEFT + 262, 450, 4, 55).fill(C.pink);
doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold")
  .text("Database", LEFT + 272, 459);
doc.fillColor("#94A3B8").fontSize(7.5).font("Helvetica")
  .text("Supabase PostgreSQL (Mumbai)", LEFT + 272, 473);
doc.fillColor("#94A3B8").fontSize(7.5)
  .text("40+ tables, Drizzle ORM migrations", LEFT + 272, 485);

// Tech stack row
const techs = ["TypeScript", "pnpm Monorepo", "NVIDIA AI", "Razorpay", "Resend", "Firebase"];
doc.fillColor(C.white).fontSize(11).font("Helvetica-Bold")
  .text("Technology Stack", LEFT + 10, 525);
let tx = LEFT + 10; let ty = 542;
techs.forEach((t, i) => {
  if (i === 3) { tx = LEFT + 10; ty = 560; }
  const tw = doc.widthOfString(t, { fontSize: 8 }) + 16;
  doc.rect(tx, ty, tw, 15).fill("#1a3358");
  doc.rect(tx, ty, 2, 15).fill(C.brand);
  doc.fillColor("#94A3B8").fontSize(8).font("Helvetica").text(t, tx + 6, ty + 3.5);
  tx += tw + 6;
});

// Deployment line
doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica")
  .text("Deployment: Render (API) • Vercel (Admin + Landing) • Expo EAS (Mobile)", LEFT + 10, 595);

// Date + version
doc.fillColor("#475569").fontSize(9).font("Helvetica")
  .text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}     Version: 1.0.0`, LEFT + 10, 630);

doc.fillColor("#1E293B").fontSize(8).font("Helvetica")
  .text("CONFIDENTIAL — For internal use only", LEFT + 10, 745, { width: W });

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 2 — TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(20).font("Helvetica-Bold").text("Table of Contents", LEFT, 18);
doc.fillColor(C.brand).fontSize(10).font("Helvetica").text("Aorane Platform — Technical Architecture", LEFT, 42);

doc.y = 80;
const toc = [
  ["1", "Project Overview & Mission", "3"],
  ["2", "System Architecture", "4"],
  ["3", "Technology Stack", "4"],
  ["4", "Deployment Infrastructure", "5"],
  ["5", "API Server — Complete Route Reference", "6"],
  ["  5.1", "Authentication (auth)", "6"],
  ["  5.2", "User Management (users)", "6"],
  ["  5.3", "Food & Nutrition (food)", "7"],
  ["  5.4", "Health Tracking (health, exercise, water, stress)", "7"],
  ["  5.5", "Medicine & Wearable", "8"],
  ["  5.6", "AI & Intelligence", "8"],
  ["  5.7", "Blood & Emergency", "9"],
  ["  5.8", "Business (B2B)", "9"],
  ["  5.9", "Payments & Revenue", "10"],
  ["  5.10","Admin Panel Routes", "10"],
  ["  5.11","Misc (Period, Family, Sessions, Support, WhatsApp)", "11"],
  ["6", "Database Schema", "12"],
  ["  6.1", "Users & Profiles", "12"],
  ["  6.2", "Health Tracking", "13"],
  ["  6.3", "Food & Nutrition", "13"],
  ["  6.4", "Business & Organizations", "14"],
  ["  6.5", "Revenue & Payments", "14"],
  ["  6.6", "Platform & Admin", "15"],
  ["  6.7", "Community & Emergency", "15"],
  ["  6.8", "Wearable & WhatsApp", "16"],
  ["7", "Mobile Application (Expo)", "17"],
  ["8", "Admin Panel", "18"],
  ["9", "Business Portal", "19"],
  ["10","Landing Website", "19"],
  ["11","Security Architecture", "20"],
  ["12","Data Flow Diagrams", "21"],
  ["13","Third-Party Integrations", "22"],
];

toc.forEach((row, i) => {
  if (doc.y > 760) newPage();
  const isMain = !row[0].startsWith("  ");
  const y = doc.y;
  if (isMain) {
    doc.rect(LEFT, y, W, 20).fill(i % 2 === 0 ? "#F9FAFB" : C.white);
    doc.fillColor(C.brand).fontSize(9.5).font("Helvetica-Bold")
      .text(row[0], LEFT + 5, y + 5, { width: 30 });
    doc.fillColor(C.text).fontSize(9.5).font("Helvetica-Bold")
      .text(row[1], LEFT + 38, y + 5, { width: W - 80 });
    doc.fillColor(C.brand).fontSize(9.5).font("Helvetica-Bold")
      .text(row[2], LEFT, y + 5, { width: W - 5, align: "right" });
    doc.y = y + 20;
  } else {
    doc.rect(LEFT, y, W, 16).fill(C.white);
    doc.fillColor(C.muted).fontSize(8.5).font("Helvetica")
      .text(row[0], LEFT + 5, y + 4, { width: 40 });
    doc.fillColor(C.gray).fontSize(8.5)
      .text(row[1], LEFT + 48, y + 4, { width: W - 90 });
    doc.fillColor(C.gray).fontSize(8.5)
      .text(row[2], LEFT, y + 4, { width: W - 5, align: "right" });
    doc.y = y + 16;
  }
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + W, doc.y).strokeColor("#F3F4F6").stroke();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 3 — PROJECT OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("1. Project Overview", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("Mission, Architecture & Platform Description", LEFT, 39);
doc.y = 75;

sectionHeader("What is Aorane?", C.dark);
doc.fillColor(C.text).fontSize(9).font("Helvetica")
  .text("Aorane is an AI-powered Indian health-tech platform that provides personalized health management for individual users and enterprise wellness solutions for organizations (corporates, hospitals, gyms). The platform combines real-time health tracking, AI-driven food analysis, stress management, blood bank coordination, emergency SOS, and B2B corporate wellness — all tailored for the Indian market with multilingual support (Hindi/English), Indian dietary patterns, and local health context.", LEFT, doc.y, { width: W, lineGap: 3 });
doc.moveDown(0.8);

sectionHeader("Platform Pillars", C.navy);
const pillars = [
  { icon: "📱", title: "Mobile Health App", desc: "Expo React Native app for individual users — food tracking, medicine reminders, stress monitoring, AI scan, health reports, scorecard" },
  { icon: "🏢", title: "B2B Business Portal", desc: "Web dashboard for organizations — employee enrollment, aggregate health analytics, wellness programs, billing management" },
  { icon: "⚙️", title: "Admin Panel", desc: "Internal ops tool — user management, revenue tracking, feature flags, AI config, ads, promo codes, support tickets, audit logs" },
  { icon: "🌐", title: "Landing Website", desc: "Public-facing marketing site — product features, pricing, business solutions, blogs, contact, careers" },
  { icon: "🔗", title: "API Server", desc: "Central Express.js backend — JWT auth, 100+ REST endpoints, Drizzle ORM, Redis caching, AI integrations, webhooks" },
  { icon: "🗄️", title: "Supabase Database", desc: "PostgreSQL on Supabase Mumbai — 40+ tables, migration-based schema, full-text search, real-time capabilities" },
];
pillars.forEach(p => {
  if (doc.y > 740) newPage();
  const y = doc.y;
  doc.rect(LEFT, y, W, 36).fill("#F9FAFB");
  doc.rect(LEFT, y, 3, 36).fill(C.brand);
  doc.fillColor(C.text).fontSize(9.5).font("Helvetica-Bold")
    .text(p.icon + "  " + p.title, LEFT + 10, y + 5, { width: 180 });
  doc.fillColor(C.gray).fontSize(8.5).font("Helvetica")
    .text(p.desc, LEFT + 10, y + 20, { width: W - 16 });
  doc.y = y + 40;
});

doc.moveDown(0.5);
sectionHeader("Target Users", C.dark);
twoCol([
  "Individual users seeking personal health tracking",
  "Corporate employees on company wellness programs",
  "Hospital patients & health-conscious professionals",
  "Gym members & fitness enthusiasts",
  "Families using shared health plans",
  "NGOs & schools running health programs",
  "Insurance companies monitoring member health",
  "Blood donors & emergency responders",
]);

doc.moveDown(0.5);
sectionHeader("Key Differentiators", C.navy);
twoCol([
  "AI-powered food scan from photo/text/voice",
  "Unique 12-digit Aorane ID for every user",
  "Indian food database with local nutritional data",
  "Hindi + English AI response generation",
  "Corporate B2B enrollment with seat-based billing",
  "Blood bank network with emergency SOS alerts",
  "Google Fit / wearable device integration",
  "WhatsApp bot for health check-ins",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 4 — SYSTEM ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("2. System Architecture & 3. Technology Stack", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("Component diagram, connections, and full tech stack", LEFT, 39);
doc.y = 72;

sectionHeader("System Architecture Diagram", C.dark);

// Draw architecture diagram
const archY = doc.y + 8;

// ── Client Layer ──
doc.rect(LEFT, archY, W, 20).fill("#EFF6FF");
doc.fillColor(C.blue).fontSize(8).font("Helvetica-Bold").text("CLIENT LAYER", LEFT + 4, archY + 6);

const clients = [
  { t: "Mobile App\n(Expo/iOS/Android)", col: C.green, x: LEFT + 2 },
  { t: "Admin Panel\n(React+Vite/Vercel)", col: C.orange, x: LEFT + 132 },
  { t: "Business Portal\n(React+Vite/Vercel)", col: C.purple, x: LEFT + 262 },
  { t: "Landing Site\n(React+Vite/Vercel)", col: C.blue, x: LEFT + 392 },
];
clients.forEach(c => {
  doc.rect(c.x, archY + 24, 124, 38).fill(c.col + "22").stroke(c.col + "88");
  doc.fillColor(c.col).fontSize(7.5).font("Helvetica-Bold")
    .text(c.t, c.x + 4, archY + 32, { width: 116, align: "center" });
});

// Arrows down
const arrowY = archY + 66;
[LEFT + 64, LEFT + 194, LEFT + 324, LEFT + 454].forEach(ax => {
  doc.moveTo(ax, arrowY).lineTo(ax, arrowY + 18).strokeColor(C.brand).lineWidth(1.2).stroke();
  doc.polygon([ax - 4, arrowY + 18], [ax + 4, arrowY + 18], [ax, arrowY + 24]).fill(C.brand);
});
doc.lineWidth(1);

// ── API Layer ──
const apiY = archY + 90;
doc.rect(LEFT, apiY, W, 44).fill(C.teal + "18").stroke(C.teal + "66");
doc.fillColor(C.teal).fontSize(8.5).font("Helvetica-Bold")
  .text("API SERVER  (Express.js on Render — aorane.onrender.com)", LEFT + 8, apiY + 6);
doc.fillColor(C.text).fontSize(7.5).font("Helvetica")
  .text("JWT Auth Middleware  •  Admin Auth  •  Business Auth  •  Rate Limiting  •  Redis Cache  •  Webhook Handlers  •  100+ Endpoints", LEFT + 8, apiY + 22, { width: W - 16 });
doc.fillColor(C.muted).fontSize(7)
  .text("Modules: auth • users • food • health • medicine • stress • water • exercise • wearable • period • family • blood • ai • business • payment • admin • suggestions • sessions • support • whatsapp • enquiries", LEFT + 8, apiY + 33, { width: W - 16 });

// Arrow down
const arrowY2 = apiY + 48;
doc.moveTo(LEFT + W / 2, arrowY2).lineTo(LEFT + W / 2, arrowY2 + 16).strokeColor(C.brand).lineWidth(1.2).stroke();
doc.polygon([LEFT + W / 2 - 4, arrowY2 + 16], [LEFT + W / 2 + 4, arrowY2 + 16], [LEFT + W / 2, arrowY2 + 22]).fill(C.brand);
doc.lineWidth(1);

// ── Data/Services Layer ──
const svcY = apiY + 72;
doc.rect(LEFT, svcY, W, 20).fill("#FEF3C7");
doc.fillColor(C.orange).fontSize(8).font("Helvetica-Bold").text("DATA & SERVICES LAYER", LEFT + 4, svcY + 6);

const svcs = [
  { t: "Supabase\nPostgreSQL\n(Mumbai)", col: C.pink },
  { t: "Redis\nCache\n(Upstash)", col: C.red },
  { t: "NVIDIA / Groq\nAI API\n(LLM + Vision)", col: C.purple },
  { t: "Razorpay\nPayments\n(UPI+Cards)", col: C.blue },
  { t: "Firebase\nAuth / FCM\n(Push Notif)", col: C.orange },
  { t: "Resend\nEmail\nService", col: C.green },
  { t: "Expo Push\nNotifications\n(EAS)", col: C.teal },
  { t: "WhatsApp\nBusiness\nAPI", col: C.green },
];
let svX = LEFT + 2;
const svW = Math.floor((W - 10) / svcs.length);
svcs.forEach(s => {
  doc.rect(svX, svcY + 24, svW, 46).fill(s.col + "15").stroke(s.col + "55");
  doc.fillColor(s.col).fontSize(7).font("Helvetica-Bold")
    .text(s.t, svX + 2, svcY + 30, { width: svW - 4, align: "center" });
  svX += svW + 1;
});

doc.y = svcY + 78;
divider();

// ── Tech Stack ──
sectionHeader("3. Technology Stack", C.navy);
doc.moveDown(0.2);

const stackCols = [W * 0.28, W * 0.38, W * 0.34];
tableRow(["Layer", "Technology", "Purpose"], stackCols, true, C.dark);
const stack = [
  ["Mobile App", "Expo SDK 52, React Native, TypeScript", "iOS + Android + Web"],
  ["Web Apps", "React 18, Vite 7, TypeScript, TailwindCSS", "Admin, Business, Landing"],
  ["API Server", "Node.js 20, Express.js, TypeScript", "REST API backend"],
  ["ORM", "Drizzle ORM + drizzle-kit", "DB schema & migrations"],
  ["Database", "PostgreSQL 15 via Supabase", "Primary data store"],
  ["Caching", "Redis via Upstash", "OTP, sessions, rate limits"],
  ["AI / LLM", "NVIDIA NIM (LLaMA 3.3 70B)", "Food scan, health tips, chat"],
  ["Auth", "JWT (access + refresh), bcrypt, Firebase", "Token-based multi-platform"],
  ["Payments", "Razorpay Orders + Subscriptions", "UPI, cards, autopay"],
  ["Email", "Resend API", "OTP, invoices, onboarding"],
  ["Push", "Expo Push + Firebase FCM", "Mobile notifications"],
  ["Wearable", "Google Fit OAuth2", "Steps, calories, heart rate"],
  ["Build", "pnpm workspaces, esbuild", "Monorepo + fast builds"],
  ["Deploy API", "Render (ap-south-1)", "Auto-deploy on git push"],
  ["Deploy Web", "Vercel", "CDN, serverless, preview URLs"],
  ["Monorepo", "pnpm workspace + TypeScript refs", "Shared code, type safety"],
];
stack.forEach((row, i) => tableRow(row, stackCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 5 — DEPLOYMENT INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("4. Deployment Infrastructure", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("Hosting, CI/CD, domains, and environment configuration", LEFT, 39);
doc.y = 72;

sectionHeader("Deployment Overview", C.dark);
const deplCols = [W * 0.22, W * 0.22, W * 0.30, W * 0.26];
tableRow(["Service", "Platform", "Domain / Region", "Auto-Deploy"], deplCols, true, C.dark);
const depl = [
  ["API Server", "Render", "aorane.onrender.com (Mumbai)", "✅ Git push to main"],
  ["Admin Panel", "Vercel", "admin.aorane.in", "✅ Git push to main"],
  ["Landing Page", "Vercel", "aorane.in", "✅ Git push to main"],
  ["Business Portal", "Vercel", "business.aorane.in", "✅ Git push to main"],
  ["Mobile App", "Expo EAS", "App Store + Play Store", "Manual EAS build"],
  ["Database", "Supabase", "ap-south-1 (Mumbai)", "Always-on managed"],
  ["Cache/Redis", "Upstash", "Global edge CDN", "Always-on managed"],
  ["Email", "Resend", "Global CDN", "API-based"],
  ["Domain", "aorane.in", "Cloudflare DNS", "Managed separately"],
];
depl.forEach((row, i) => tableRow(row, deplCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

doc.moveDown(0.6);
sectionHeader("Environment Variables & Secrets", C.navy);
const envCols = [W * 0.30, W * 0.25, W * 0.45];
tableRow(["Variable", "Used In", "Purpose"], envCols, true, C.navy);
const envs = [
  ["SUPABASE_DATABASE_URL", "API Server", "PostgreSQL connection string"],
  ["SUPABASE_URL", "API Server", "Supabase REST/realtime endpoint"],
  ["SUPABASE_ANON_KEY", "API Server", "Public Supabase API key"],
  ["SESSION_SECRET", "API Server", "JWT signing secret"],
  ["RAZORPAY_KEY_ID", "API Server", "Razorpay public key"],
  ["RAZORPAY_KEY_SECRET", "API Server", "Razorpay secret key"],
  ["RAZORPAY_WEBHOOK_SECRET", "API Server", "Webhook signature verification"],
  ["NVIDIA_API_KEY", "API Server", "NVIDIA NIM LLM API access"],
  ["RESEND_API_KEY", "API Server", "Email delivery via Resend"],
  ["GOOGLE_FIT_CLIENT_ID", "API Server", "Google Fit OAuth2 client"],
  ["GOOGLE_FIT_CLIENT_SECRET", "API Server", "Google Fit OAuth2 secret"],
  ["EXPO_TOKEN", "EAS Build", "Expo build & submission token"],
];
envs.forEach((row, i) => tableRow(row, envCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

doc.moveDown(0.6);
sectionHeader("Monorepo Structure", C.dark);
const tree = [
  "artifacts/aorane-mobile/     — Expo React Native mobile app",
  "artifacts/admin-panel/       — React+Vite admin dashboard (Vercel)",
  "artifacts/business-portal/   — React+Vite B2B portal (Vercel)",
  "artifacts/aorane-landing/    — React+Vite marketing site (Vercel)",
  "artifacts/api-server/        — Express.js backend (Render)",
  "lib/db/                      — Drizzle ORM schema + migrations (shared)",
  "lib/api-spec/                — OpenAPI specification",
  "lib/api-zod/                 — Generated Zod validation schemas",
  "lib/api-client-react/        — Generated React Query hooks",
  "scripts/                     — Utility scripts (seed, PDF gen)",
  "pnpm-workspace.yaml          — Workspace packages + catalog pins",
  "tsconfig.base.json           — Shared TypeScript strict config",
];
tree.forEach(t => {
  const y = doc.y;
  doc.rect(LEFT, y, W, 15).fill(t.startsWith("lib") ? "#EFF6FF" : t.startsWith("scripts") || t.startsWith("pnpm") || t.startsWith("ts") ? "#F9FAFB" : "#F0FDF4");
  doc.fillColor(C.navy).fontSize(8).font("Courier")
    .text(t, LEFT + 8, y + 3.5, { width: W - 12 });
  doc.y = y + 15;
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + W, doc.y).strokeColor("#E5E7EB").stroke();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES 6–10 — API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("5. API Server — Complete Route Reference", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("100+ REST endpoints across 22 modules", LEFT, 39);
doc.y = 72;

function moduleHeader(num, name, color, desc) {
  if (doc.y > 720) newPage();
  doc.moveDown(0.3);
  const y = doc.y;
  doc.rect(LEFT, y, W, 24).fill(color + "22").stroke(color + "55");
  doc.rect(LEFT, y, 4, 24).fill(color);
  doc.fillColor(color).fontSize(10).font("Helvetica-Bold")
    .text(`5.${num}  ${name}`, LEFT + 10, y + 4);
  doc.fillColor(C.gray).fontSize(8).font("Helvetica")
    .text(desc, LEFT + 10, y + 15, { width: W - 16 });
  doc.y = y + 28;
}

// 5.1 Auth
moduleHeader("1", "Authentication (auth.ts)", C.blue, "Mobile login via OTP (SMS/WhatsApp), Google OAuth, Firebase, PIN-based re-auth, refresh tokens");
[
  ["POST", "/auth/send-otp", "Send OTP to phone number (Firebase SMS or direct Twilio)"],
  ["POST", "/auth/send-otp-whatsapp", "Send OTP via WhatsApp"],
  ["POST", "/auth/verify-otp", "Verify OTP → returns access + refresh JWT"],
  ["POST", "/auth/send-email-otp", "Send OTP to email address"],
  ["POST", "/auth/verify-email-otp", "Verify email OTP"],
  ["POST", "/auth/google", "Google OAuth login (ID token exchange)"],
  ["POST", "/auth/firebase-login", "Firebase custom token login"],
  ["POST", "/auth/pin/set", "Set 4/6-digit security PIN"],
  ["POST", "/auth/pin/login", "Login with PIN (returns new JWT)"],
  ["POST", "/auth/refresh", "Refresh access token using refresh token"],
  ["POST", "/auth/logout", "Invalidate refresh token"],
  ["GET",  "/auth/me", "Get current authenticated user profile"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.2 Users
moduleHeader("2", "User Management (users.ts)", C.green, "Profiles, preferences, privacy, health goals, medical conditions, activity scores");
[
  ["GET",   "/users/profile", "Get full user profile with stats"],
  ["PATCH", "/users/profile", "Update profile (name, DOB, city, language, etc.)"],
  ["PATCH", "/users/onboarding/step", "Complete onboarding step (1–5)"],
  ["GET",   "/users/preferences", "Get app preferences (dark mode, reminders, etc.)"],
  ["PATCH", "/users/preferences", "Update preferences"],
  ["GET",   "/users/privacy", "Get privacy settings"],
  ["PATCH", "/users/privacy", "Update privacy settings"],
  ["POST",  "/users/health-goals", "Set health goals (weight loss, fitness, etc.)"],
  ["POST",  "/users/medical-conditions", "Add/update medical conditions"],
  ["GET",   "/users/scorecard", "Get Aorane ID card with QR code"],
  ["GET",   "/users/activity-score", "Get 7-day activity score breakdown"],
  ["GET",   "/users/search", "Search users by phone/Aorane ID (limited)"],
  ["POST",  "/users/push-token", "Register Expo push notification token"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.3 Food
moduleHeader("3", "Food & Nutrition (food.ts)", C.orange, "AI food scan, manual logging, history, favorites, weekly nutrition aggregates");
[
  ["POST",   "/food/scan", "AI-powered food scan (photo/text/voice input → nutrition)"],
  ["POST",   "/food/log", "Log a food entry manually or from scan"],
  ["GET",    "/food/logs", "Get food logs by date range"],
  ["DELETE", "/food/log/:id", "Delete a food log entry"],
  ["GET",    "/food/summary/:date", "Get daily nutrition summary for date"],
  ["GET",    "/food/weekly-nutrition", "Get 7-day nutrition totals + micronutrients"],
  ["GET",    "/food/search", "Search food items database"],
  ["GET",    "/food/history-search", "Search user's food history"],
  ["GET",    "/food/favorites", "Get user's favorite foods"],
  ["GET",    "/food/db-stats", "Stats on food database size"],
  ["POST",   "/food/weather-suggestions", "AI suggestions based on weather + location"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.4 Health
moduleHeader("4", "Health Tracking (health.ts, stress.ts, water logs)", C.teal, "Exercise, water, stress logs, daily & weekly health scores, predictions");
[
  ["POST",  "/health/exercise", "Log exercise session (type, duration, calories)"],
  ["GET",   "/health/exercise", "Get exercise history"],
  ["POST",  "/health/exercise/calculate", "Calculate calories for exercise"],
  ["POST",  "/health/water", "Log water intake (ml)"],
  ["GET",   "/health/water/:date", "Get water intake for date"],
  ["GET",   "/health/score/:date", "Get daily health score"],
  ["POST",  "/health/score/:date/compute", "Compute/refresh health score"],
  ["GET",   "/health/scores/history", "Health score history (30 days)"],
  ["GET",   "/health/weekly-activity", "Weekly activity summary"],
  ["GET",   "/stress/logs", "Get stress logs"],
  ["POST",  "/stress/log", "Log stress (PPG/mood/5-pillar)"],
  ["GET",   "/stress/today", "Today's stress summary"],
  ["GET",   "/stress/weekly", "Weekly stress trend"],
  ["GET",   "/stress/insight", "AI-generated stress insight"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.5 Medicine & Wearable
moduleHeader("5", "Medicine & Wearable (medicine.ts, wearable.ts)", C.purple, "Medicine schedules, reminders, logs; Google Fit OAuth, wearable data sync");
[
  ["POST",   "/medicine/schedule", "Create medicine schedule"],
  ["GET",    "/medicine/schedules", "Get all medicine schedules"],
  ["PATCH",  "/medicine/schedule/:id", "Update schedule (name, timing, dose)"],
  ["GET",    "/medicine/today", "Today's medicine reminders"],
  ["POST",   "/medicine/log", "Log medicine taken"],
  ["GET",    "/medicine/logs", "Get medicine logs"],
  ["GET",    "/wearable/providers", "List supported wearable providers"],
  ["GET",    "/wearable/oauth/google-fit/url", "Get Google Fit OAuth URL"],
  ["GET",    "/wearable/oauth/google-fit/callback", "OAuth callback handler"],
  ["GET",    "/wearable/connections", "Get connected wearables"],
  ["POST",   "/wearable/sync/:provider", "Sync data from wearable"],
  ["POST",   "/wearable/data/manual", "Manually add wearable data"],
  ["GET",    "/wearable/data", "Get synced wearable data"],
  ["DELETE", "/wearable/connections/:provider", "Disconnect wearable"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.6 AI
moduleHeader("6", "AI & Intelligence (ai.ts, intelligence.ts, suggestions.ts)", C.pink, "NVIDIA LLM-powered: diet plans, meal swaps, health chat, risk assessments, daily suggestions");
[
  ["POST",  "/ai/smart-scan", "AI food analysis from image/text/voice"],
  ["POST",  "/ai/diet-plan", "Generate personalized AI diet plan"],
  ["POST",  "/ai/meal-swap", "Suggest healthier meal alternatives"],
  ["POST",  "/ai/health-tip", "Generate contextual health tip"],
  ["GET",   "/health/intelligence/predict", "AI health risk prediction (cached)"],
  ["POST",  "/health/intelligence/predict/refresh", "Refresh AI health prediction"],
  ["GET",   "/health/intelligence/diet-chart", "Weekly AI-generated diet chart"],
  ["POST",  "/health/intelligence/diet-chart/refresh", "Refresh diet chart"],
  ["GET",   "/health/intelligence/exercise/met", "MET values for exercise types"],
  ["POST",  "/health/intelligence/exercise/calories", "Calculate calories from MET"],
  ["GET",   "/suggestions/daily", "AI daily suggestions (cached 24h)"],
  ["POST",  "/suggestions/refresh", "Force refresh daily suggestions"],
  ["GET",   "/notifications/settings", "Notification preferences"],
  ["PUT",   "/notifications/settings", "Update notification preferences"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.7 Blood & Emergency
moduleHeader("7", "Blood Bank & Emergency (blood.ts, accident-emergency.ts)", C.red, "Blood donor registration, emergency requests, donor matching, accident SOS, push alerts");
[
  ["POST",  "/blood/donor/register", "Register as blood donor"],
  ["POST",  "/blood/donor/verify-otp", "Verify donor OTP"],
  ["GET",   "/blood/request", "Search blood requests nearby"],
  ["POST",  "/blood/request", "Create emergency blood request"],
  ["POST",  "/blood/request/verify-otp", "OTP verification for blood request"],
  ["POST",  "/blood/request/:id/respond", "Donor responds to request"],
  ["POST",  "/blood/request/:id/flag", "Flag/resolve blood request"],
  ["POST",  "/blood/emergency/direct", "Direct blood emergency SOS"],
  ["POST",  "/blood/donation", "Log blood donation"],
  ["GET",   "/blood/donations", "Get donation history"],
  ["POST",  "/emergency/accident/sos", "Accident SOS trigger"],
  ["GET",   "/emergency/accident/history", "Accident alert history"],
  ["PATCH", "/emergency/accident/:id/cancel", "Cancel accident alert"],
  ["PATCH", "/emergency/accident/:id/resolve", "Resolve accident alert"],
  ["GET",   "/emergency/contacts", "Get emergency contacts"],
  ["POST",  "/emergency/contacts", "Add emergency contact"],
  ["DELETE","/emergency/contacts/:id", "Remove emergency contact"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.8 Business
moduleHeader("8", "Business / B2B (business.ts)", C.orange, "Organization registration, login, member enrollment, analytics, announcements, billing");
[
  ["POST",  "/business/register", "Register new organization"],
  ["POST",  "/business/login", "Organization admin login"],
  ["POST",  "/business/login/send-email-otp", "Send email OTP for login"],
  ["POST",  "/business/login/verify-otp", "Verify email OTP → JWT"],
  ["POST",  "/business/forgot-password", "Send password reset OTP"],
  ["POST",  "/business/forgot-password/verify", "Verify reset OTP + new password"],
  ["GET",   "/business/me", "Get organization details"],
  ["GET",   "/business/overview", "Overview stats (members, seats, usage)"],
  ["GET",   "/business/analytics", "Aggregate health analytics for org"],
  ["GET",   "/business/health-analytics", "Detailed health trend analytics"],
  ["GET",   "/business/members", "List all org members"],
  ["GET",   "/business/members/search", "Search members by name/ID"],
  ["GET",   "/business/members/suspended", "List suspended members"],
  ["GET",   "/business/members/:userId/detail", "Member health detail view"],
  ["GET",   "/business/members/:userId/stress", "Member stress trends"],
  ["POST",  "/business/enroll", "Enroll user via enrollment code"],
  ["GET",   "/business/enrollment-codes", "Get enrollment codes"],
  ["POST",  "/business/enrollment-codes", "Generate new enrollment code"],
  ["GET",   "/business/announcements", "Get org announcements"],
  ["POST",  "/business/announcements", "Post announcement to members"],
  ["PATCH", "/business/settings", "Update org settings"],
  ["PATCH", "/business/admin/password", "Change admin password"],
  ["GET",   "/business/billing/plans", "Get available plans"],
  ["GET",   "/business/billing/seat-plans", "Get seat-based pricing"],
  ["GET",   "/business/billing/subscription", "Get current subscription"],
  ["POST",  "/business/billing/order", "Create Razorpay order"],
  ["POST",  "/business/billing/verify", "Verify payment"],
  ["POST",  "/business/billing/subscription/create", "Create subscription"],
  ["POST",  "/business/billing/subscription/verify", "Verify subscription payment"],
  ["POST",  "/business/billing/seat-order", "Create seat upgrade order"],
  ["POST",  "/business/billing/seat-verify", "Verify seat payment"],
  ["GET",   "/business/billing/invoices", "Get billing invoices"],
  ["DELETE","/business/billing/subscription/cancel", "Cancel subscription"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.9 Payments
moduleHeader("9", "Payments & Revenue (payment.ts, webhook.ts)", C.green, "Razorpay orders, subscriptions, promo codes, checkout pages, webhook verification");
[
  ["POST",  "/payment/order", "Create one-time Razorpay order"],
  ["POST",  "/payment/verify", "Verify one-time payment signature"],
  ["POST",  "/payment/promo/validate", "Validate promo code"],
  ["GET",   "/payment/subscription", "Get current subscription status"],
  ["POST",  "/payment/subscription/create", "Create autopay subscription"],
  ["POST",  "/payment/subscription/verify", "Verify first subscription payment"],
  ["DELETE","/payment/subscription/cancel", "Cancel subscription"],
  ["GET",   "/payment/checkout/:orderId", "Server-rendered Razorpay checkout (mobile)"],
  ["GET",   "/payment/subscription-checkout/:id", "Server-rendered subscription checkout"],
  ["GET",   "/payment/rzp-callback", "Razorpay payment callback (GET)"],
  ["POST",  "/payment/rzp-callback", "Razorpay payment callback (POST)"],
  ["POST",  "/payment/subscription-rzp-callback", "Subscription callback (POST)"],
  ["GET",   "/payment/order-status", "Poll payment order status"],
  ["GET",   "/payment/razorpay-test", "Test Razorpay connectivity"],
  ["POST",  "/webhooks/razorpay", "Razorpay webhook (HMAC verified)"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.10 Admin
moduleHeader("10", "Admin Panel Routes (admin.ts, plans.ts, ads.ts)", C.dark, "User management, org management, revenue, feature flags, food DB, AI config, promo codes");
[
  ["POST",  "/admin/login", "Admin login (rate-limited, bcrypt)"],
  ["GET",   "/admin/me", "Get admin profile"],
  ["PATCH", "/admin/me", "Update admin profile"],
  ["POST",  "/admin/change-password", "Change admin password"],
  ["GET",   "/admin/overview", "Platform overview stats"],
  ["GET",   "/admin/analytics", "Detailed analytics (DAU, revenue, etc.)"],
  ["GET",   "/admin/users", "Paginated user list with profiles"],
  ["PATCH", "/admin/users/:id", "Update user (plan, ban, activate)"],
  ["GET",   "/admin/users/search", "Search users (UUID/phone/email/name)"],
  ["GET",   "/admin/organizations", "List all organizations"],
  ["PUT",   "/admin/organizations/:id", "Edit organization details"],
  ["DELETE","/admin/organizations/:id", "Delete organization"],
  ["PATCH", "/admin/organizations/:id/toggle-active", "Activate/deactivate org"],
  ["GET",   "/admin/subscriptions", "List all subscriptions"],
  ["PATCH", "/admin/subscriptions/:id/cancel", "Cancel user subscription"],
  ["GET",   "/admin/revenue", "Revenue breakdown (daily/monthly)"],
  ["GET",   "/admin/platform-costs", "Platform cost tracking"],
  ["GET",   "/admin/feature-flags", "List all feature flags"],
  ["POST",  "/admin/feature-flags", "Create feature flag"],
  ["PATCH", "/admin/feature-flags/:key", "Toggle/update feature flag"],
  ["GET",   "/admin/food-items", "Manage food items database"],
  ["GET",   "/admin/food-cache", "AI food scan cache entries"],
  ["POST",  "/admin/food-cache/:id/promote", "Promote cache entry to food DB"],
  ["POST",  "/admin/food-cache/:id/reject", "Reject cache entry"],
  ["GET",   "/admin/food-cache/stats", "Food cache statistics"],
  ["GET",   "/admin/food-cache/export", "Export food cache as CSV"],
  ["GET",   "/admin/promo-codes", "List promo codes"],
  ["GET",   "/admin/announcements", "List announcements"],
  ["POST",  "/admin/announcements", "Create platform announcement"],
  ["GET",   "/admin/support-tickets", "List support tickets"],
  ["PATCH", "/admin/support-tickets/:id", "Update ticket status"],
  ["GET",   "/admin/blood-requests", "View blood emergency requests"],
  ["PATCH", "/admin/blood-requests/:id", "Update blood request status"],
  ["GET",   "/admin/audit-logs", "Admin action audit trail"],
  ["GET",   "/admin/languages", "List supported languages"],
  ["GET",   "/admin/ai-config", "Get AI model configuration"],
  ["PUT",   "/admin/ai-config", "Update AI model config"],
  ["GET",   "/admin/settings/company", "Get company settings"],
  ["PUT",   "/admin/settings/company", "Update company settings"],
  ["GET",   "/admin/org-invoices", "List B2B org invoices"],
  ["GET",   "/plans", "Get plan pricing (public)"],
  ["PUT",   "/admin/plan-pricing/:planKey", "Update plan pricing"],
  ["POST",  "/admin/plan-pricing/reset", "Reset plan pricing to defaults"],
  ["GET",   "/admin/whatsapp/config", "WhatsApp bot config"],
  ["PUT",   "/admin/whatsapp/config", "Update WhatsApp bot config"],
  ["GET",   "/admin/whatsapp/stats", "WhatsApp message stats"],
  ["GET",   "/admin/whatsapp/templates", "WhatsApp message templates"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// 5.11 Misc
moduleHeader("11", "Misc: Period, Family, Sessions, Support, WhatsApp, Enquiries", C.gray, "Women's health, family groups, app sessions (DAU), help tickets, WhatsApp bot");
[
  ["POST",  "/period/log", "Log menstrual cycle data"],
  ["GET",   "/period/logs", "Get period history"],
  ["PATCH", "/period/log/:id", "Update period log"],
  ["GET",   "/family/group", "Get family group details"],
  ["POST",  "/family/group", "Create family group"],
  ["POST",  "/family/invite", "Invite member to family"],
  ["POST",  "/family/join", "Join family with invite code"],
  ["GET",   "/family/members", "List family members"],
  ["POST",  "/sessions/start", "Start app session"],
  ["POST",  "/sessions/heartbeat", "Session heartbeat (keep alive)"],
  ["POST",  "/sessions/end", "End app session"],
  ["GET",   "/sessions/me", "Get user's session history"],
  ["GET",   "/sessions/dau", "Daily active users count (admin)"],
  ["POST",  "/support/ticket", "Create support ticket"],
  ["GET",   "/support/tickets/mine", "Get user's own tickets"],
  ["POST",  "/whatsapp/subscribe", "Subscribe to WhatsApp health updates"],
  ["DELETE","/whatsapp/unsubscribe", "Unsubscribe from WhatsApp"],
  ["GET",   "/whatsapp/status", "Get WhatsApp subscription status"],
  ["GET",   "/whatsapp/webhook", "WhatsApp webhook verification"],
  ["POST",  "/whatsapp/webhook", "Receive WhatsApp messages"],
  ["GET",   "/whatsapp/subscription", "Get subscription details"],
  ["PUT",   "/whatsapp/preferences", "Update message preferences"],
  ["GET",   "/whatsapp/message-history", "Get message history"],
].forEach(r => routeRow(r[0], r[1], r[2]));

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE SCHEMA PAGES
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("6. Database Schema", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("PostgreSQL on Supabase — 40+ tables across 8 schema files using Drizzle ORM", LEFT, 39);
doc.y = 72;

function schemaSection(num, title, file, color, tables) {
  if (doc.y > 680) newPage();
  subHeader(`6.${num}  ${title}  (${file})`, color);
  const tCols = [W * 0.32, W * 0.68];
  tableRow(["Table Name", "Key Columns / Purpose"], tCols, true, color);
  tables.forEach((t, i) => tableRow(t, tCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));
  doc.moveDown(0.2);
}

schemaSection("1", "Users & Profiles", "users.ts", C.blue, [
  ["users", "id(uuid), phone, email, plan(free/pro/max/family), isActive, isBanned, createdAt"],
  ["user_auth_providers", "userId, provider(mobile/google/facebook/x), providerUid, email"],
  ["user_profiles", "userId, aoraneId(12-digit unique), fullName, DOB, gender, BMI, city, state, bloodGroup"],
  ["user_medical_conditions", "userId, condition, severity, diagnosedAt, notes"],
  ["user_health_goals", "userId, goalType(weight/fitness/etc), targetValue, currentValue, deadline"],
  ["user_preferences", "userId, languageCode, darkMode, waterGoalGlasses, calorieGoal, notification prefs"],
  ["user_privacy_settings", "userId, profileVisibility, shareHealthData, allowContact settings"],
  ["otp_store", "phone, hashedOtp, expiresAt — temporary OTP store with Redis backup"],
]);

schemaSection("2", "Health Tracking", "health-tracking.ts", C.green, [
  ["exercise_logs", "userId, exerciseType, durationMins, caloriesBurned(string), intensity, loggedAt"],
  ["water_logs", "userId, mlAmount, loggedAt, inputMethod(manual/wearable)"],
  ["medicine_schedules", "userId, medicineName, dosage, frequency, reminderTimes[], isActive"],
  ["medicine_logs", "userId, scheduleId, takenAt, skipped, snoozeCount"],
  ["stress_logs", "userId, stressType(ppg/mood/5pillar), score, mood, pillars{}, loggedAt"],
  ["period_logs", "userId, startDate, endDate, cycleLength, symptoms[], notes"],
  ["medical_reports", "userId, reportType, fileUrl, extractedData, uploadedAt"],
  ["daily_health_scores", "userId, date, score(0-100), breakdown{food,water,exercise,medicine,sleep}"],
  ["daily_suggestions", "userId, date, suggestions[], generatedBy(AI), language"],
  ["health_predictions", "userId, riskType, riskLevel, confidence, factors[], generatedAt"],
  ["weekly_diet_charts", "userId, weekStart, meals{}, macros{}, generatedAt"],
]);

schemaSection("3", "Food & Nutrition", "health-food.ts", C.orange, [
  ["food_items", "id, nameEn, nameHi, calories, protein, carbs, fat, calcium, vitaminC, vitaminB12, iron, fiber, mealTypes[], isVerified"],
  ["food_scan_cache", "query, imageHash, result{nutrients}, source, hitCount, lastHit — AI scan cache"],
  ["food_logs", "userId, foodItemId, foodNameEn, calories, protein, fat, carbs, vitaminC, calcium, vitaminB12, iron, servingSize, mealType, loggedAt, inputMethod"],
]);

schemaSection("4", "Business & Organizations", "business.ts", C.purple, [
  ["organizations", "id, name, orgType(corporate/hospital/gym/etc), contactEmail, city, state, totalSeats, usedSeats, plan, isActive"],
  ["org_admins", "id, orgId, email, hashedPassword, name, role — portal login credentials"],
  ["org_members", "userId, orgId, role, enrolledAt, isActive — links users to orgs"],
  ["enrollment_codes", "orgId, code, maxUses, usedCount, expiresAt, isActive"],
  ["org_payments", "orgId, amount, planType, seats, razorpayOrderId, status"],
  ["org_announcements", "orgId, title, body, targetRoles, sentAt"],
  ["insurance_api_keys", "orgId, provider, apiKey, isActive — for insurance integrations"],
]);

schemaSection("5", "Revenue & Payments", "revenue.ts", C.green, [
  ["subscriptions", "userId, plan, status, amount, expiresAt, razorpaySubscriptionId, autoRenew, promoUsed"],
  ["payments", "userId, amount, plan, status, razorpayOrderId, razorpayPaymentId, createdAt"],
  ["promo_codes", "code, discountPercent, maxUses, usedCount, expiresAt, isActive, createdBy"],
  ["plan_pricing", "planKey(free/pro/max/family), monthlyPrice, yearlyPrice, features[]"],
  ["referrals", "referrerId, refereeId, code, status, rewardGiven, createdAt"],
]);

schemaSection("6", "Platform & Admin", "platform.ts", C.dark, [
  ["push_tokens", "userId, token, platform(ios/android), isActive, lastSeenAt"],
  ["notifications", "userId, type, title, body, data{}, isRead, sentAt"],
  ["announcements", "title, body, targetPlan, targetOrgType, scheduledAt, sentAt — platform-wide"],
  ["feature_flags", "key, isEnabled, rolloutPercent, description, updatedAt"],
  ["ad_campaigns", "title, type(google/direct), imageUrl, targetUrl, budget, status, impressions, clicks"],
  ["admin_users", "email, hashedPassword, name, role, lastLoginAt"],
  ["admin_audit_logs", "adminId, action, targetType, targetId, changes{}, ip, createdAt"],
  ["ai_config", "provider, model, temperature, maxTokens, systemPrompt, isActive"],
  ["company_settings", "key, value — platform-wide configuration KV store"],
  ["enquiries", "name, email, phone, subject, message, status, createdAt"],
  ["app_sessions", "userId, sessionId, startedAt, endedAt, duration, platform, appVersion"],
]);

schemaSection("7", "Community & Emergency", "community.ts", C.red, [
  ["family_groups", "id, name, ownerId, inviteCode, maxMembers, createdAt"],
  ["family_members", "groupId, userId, role(owner/member), joinedAt"],
  ["blood_donors", "userId, bloodGroup, city, isAvailable, lastDonatedAt, donationCount, otpVerified"],
  ["blood_emergency_requests", "requesterId, bloodGroupNeeded, unitsNeeded, hospitalName, city, status, expiresAt"],
  ["blood_emergency_responses", "requestId, donorId, response(can_help/later/unavailable)"],
  ["blood_donations", "donorId, requestId, donatedAt, hospitalName, units"],
  ["accident_emergency_logs", "userId, lat, lng, status, contacts[], resolvedAt"],
  ["emergency_contacts", "userId, name, phone, relationship, notifyOnSOS"],
]);

schemaSection("8", "Wearable, Languages & WhatsApp", "wearable.ts + whatsapp.ts", C.teal, [
  ["wearable_connections", "userId, provider(google-fit), accessToken, refreshToken, lastSyncAt"],
  ["wearable_data", "userId, provider, dataType(steps/hr/calories), value, recordedAt"],
  ["offline_queue", "userId, action, payload, retryCount, createdAt — offline sync queue"],
  ["languages", "code, name, nativeName, isActive — supported UI/AI languages"],
  ["translations", "languageCode, key, value — i18n translation strings"],
  ["whatsapp_bot_config", "orgId, token, phoneNumberId, webhookSecret, isActive"],
  ["whatsapp_subscriptions", "userId, phone, status, preferences{}, subscribedAt"],
  ["whatsapp_message_logs", "userId, direction, type, content, timestamp, status"],
  ["whatsapp_templates", "name, language, components[], status — approved message templates"],
]);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE — MOBILE APP
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("7. Mobile Application (Expo React Native)", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("iOS + Android + Web • File-based routing (Expo Router) • TypeScript", LEFT, 39);
doc.y = 72;

sectionHeader("7.1 App Navigation Structure", C.dark);
doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
  .text("The mobile app uses Expo Router (file-based routing) with nested layouts. Authentication state controls routing between onboarding, auth, and main app flows.", LEFT, doc.y, { width: W });
doc.moveDown(0.5);

const mobileScreens = [
  { section: "ONBOARDING FLOW (app/(onboarding)/)", color: C.blue, screens: [
    ["index.tsx", "Welcome screen — Get started CTA, language selection"],
    ["physical.tsx", "Physical info — age, gender, height, weight"],
    ["lifestyle.tsx", "Lifestyle — activity level, sleep hours, food preference"],
    ["health.tsx", "Health history — existing conditions, medications"],
    ["goals.tsx", "Health goals — weight target, fitness objectives"],
    ["permissions.tsx", "Permissions — notifications, camera, location"],
  ]},
  { section: "AUTHENTICATION (app/(auth)/)", color: C.green, screens: [
    ["index.tsx", "Login screen — phone/email input with country code"],
    ["verify-otp.tsx", "OTP verification (SMS/WhatsApp/Email)"],
    ["setup-pin.tsx", "Set 4/6 digit security PIN"],
    ["verify-pin.tsx", "PIN login screen"],
  ]},
  { section: "MAIN TABS (app/(tabs)/)", color: C.brand, screens: [
    ["dashboard.tsx", "Home dashboard — score, today's summary, quick actions, announcements"],
    ["food.tsx", "Food logging — meal history, add entry, daily nutrition summary"],
    ["exercise.tsx", "Exercise tracking — log workout, weekly activity chart"],
    ["medicine.tsx", "Medicine reminders — schedules, today's doses, history"],
    ["scan.tsx", "AI Scanner — camera/gallery food scan, instant nutrition analysis"],
    ["profile.tsx", "User profile — Aorane ID, stats, settings, subscription"],
  ]},
  { section: "FEATURE SCREENS (app/)", color: C.purple, screens: [
    ["health-report.tsx", "Health report PDF — weekly/monthly, micronutrients, export"],
    ["scorecard.tsx", "Aorane ID card with QR code — shareable health identity"],
    ["intelligence.tsx", "AI health insights — risk predictions, diet chart, tips"],
    ["stress.tsx", "Stress management — log, trends, AI insights, breathing exercises"],
    ["water.tsx", "Water intake — log glasses, daily goal progress, reminders"],
    ["period.tsx", "Menstrual cycle tracker — calendar, symptoms, predictions"],
    ["wearable.tsx", "Wearable device — Google Fit connect, data sync, steps/HR"],
    ["blood.tsx", "Blood bank — donor registration, emergency requests, find donors"],
    ["family.tsx", "Family health — create group, invite members, shared plans"],
    ["medical-emergency.tsx", "Emergency SOS — accident alert with GPS, contacts notification"],
    ["upgrade.tsx", "Plan upgrade — Pro/Max/Family comparison and payment flow"],
    ["enrollment.tsx", "Corporate enrollment — enter org code, join company wellness"],
    ["suggestions.tsx", "Daily AI suggestions — personalized health tips & actions"],
    ["notification-settings.tsx", "Notification preferences — toggle each notification type"],
    ["help.tsx", "Help & support — FAQ, create ticket, contact info"],
    ["edit-profile.tsx", "Edit profile — update personal info, photo, language"],
    ["edit-work-profile.tsx", "Work profile — occupation, work city, stress at work"],
  ]},
];

mobileScreens.forEach(section => {
  if (doc.y > 660) newPage();
  subHeader(section.section, section.color);
  const cols = [W * 0.28, W * 0.72];
  tableRow(["File", "Description"], cols, true, section.color);
  section.screens.forEach((s, i) => tableRow(s, cols, false, i % 2 === 0 ? "#F9FAFB" : C.white));
  doc.moveDown(0.3);
});

doc.moveDown(0.3);
sectionHeader("7.2 Mobile App Libraries & Key Dependencies", C.navy);
twoCol([
  "expo-router — File-based navigation",
  "expo-camera — AI food scan camera",
  "expo-notifications — Push notification handling",
  "@tanstack/react-query — API data fetching & caching",
  "expo-secure-store — Secure token/PIN storage",
  "expo-location — GPS for blood/emergency features",
  "expo-image-picker — Gallery food image selection",
  "expo-file-system — PDF download & share",
  "expo-print — Health report PDF generation",
  "expo-sharing — Share reports via OS share sheet",
  "expo-av — Audio for voice food input",
  "react-native-reanimated — Smooth animations",
  "@react-native-async-storage — Local data persistence",
  "dayjs — Date/time formatting (Indian locale)",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE — ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("8. Admin Panel", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("React + Vite • Deployed on Vercel • admin.aorane.in • Login: admin@aorane.com", LEFT, 39);
doc.y = 72;

sectionHeader("8.1 Admin Panel Pages", C.dark);
const adminCols = [W * 0.28, W * 0.72];
tableRow(["Page (Component)", "Features & Capabilities"], adminCols, true, C.dark);
const adminPages = [
  ["Login.tsx", "Admin login with email/password, brute-force protected (10 attempts/15min), JWT session"],
  ["Dashboard.tsx", "Platform KPIs — total users, DAU, revenue, new signups, subscription breakdown, recent activity"],
  ["Users.tsx", "User list with Name/Email/Aorane ID columns, search (UUID/phone/email/name), toggle ban/activate, plan management"],
  ["Organizations.tsx", "B2B org management — list with stats, EditOrgModal (all fields), DeleteConfirmModal, toggle active/inactive"],
  ["Analytics.tsx", "Detailed platform analytics — charts for DAU, signups, food scans, payment trends, feature usage"],
  ["Revenue.tsx", "Revenue dashboard — daily/monthly breakdown, subscription vs one-time, promo code impact, org billing"],
  ["Subscriptions.tsx", "All subscriptions — filter by plan/status, cancel subscription, view payment history"],
  ["PlanPricing.tsx", "Plan price management — edit monthly/yearly pricing for free/pro/max/family plans"],
  ["Invoices.tsx", "Invoice list — user and org invoices, PDF generation, payment status tracking"],
  ["FeatureFlags.tsx", "Feature toggle — enable/disable features per plan or org type, rollout percentage control"],
  ["FoodItems.tsx", "Food database management — CRUD for Indian food items, nutritional data editor"],
  ["AIFoodDiscovery.tsx", "AI scan cache — review auto-discovered foods, promote to DB or reject, export CSV"],
  ["AIConfig.tsx", "AI model configuration — provider, model name, temperature, max tokens, system prompt"],
  ["PromoCodes.tsx", "Promo code management — create/edit/expire codes, discount %, usage tracking"],
  ["Announcements.tsx", "Platform announcements — create targeted announcements by plan or org type"],
  ["AdsManager.tsx", "Ad campaign management — Google/direct ads, budget tracking, impressions/clicks"],
  ["FeatureFlags.tsx", "Feature flag management — per-plan feature toggles with rollout percentages"],
  ["Languages.tsx", "Language management — supported AI/UI languages, enable/disable, add translations"],
  ["BloodRequests.tsx", "Blood emergency monitoring — view active requests, update status, admin resolution"],
  ["SupportTickets.tsx", "Customer support — ticket list, assign, update status, internal notes"],
  ["Enquiries.tsx", "Business enquiries — from landing page contact form, status management"],
  ["AuditLogs.tsx", "Admin action audit trail — who did what, when, IP address, change diff"],
  ["Branding.tsx", "Platform branding — logo, colors, company name for white-label"],
  ["PlatformCosts.tsx", "Cost tracking — API costs, hosting, external services usage"],
  ["UpcomingFeatures.tsx", "Roadmap management — planned features, status, priority"],
  ["Profile.tsx", "Admin profile — update name, email, change password"],
];
adminPages.forEach((p, i) => tableRow(p, adminCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

doc.moveDown(0.5);
sectionHeader("8.2 Admin Panel Architecture", C.navy);
twoCol([
  "Vite 7 + React 18 + TypeScript",
  "Tailwind CSS for styling",
  "React Query for API state",
  "JWT auth stored in localStorage",
  "Dark mode toggle (system preference sync)",
  "Auto-logout after 30 min inactivity",
  "Role-based access (super-admin / ops)",
  "Audit trail for all destructive actions",
  "Responsive layout with sidebar navigation",
  "Toast notifications for all API operations",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE — BUSINESS PORTAL + LANDING
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("9. Business Portal   10. Landing Website", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("B2B org dashboard • React+Vite • Deployed on Vercel", LEFT, 39);
doc.y = 72;

sectionHeader("9. Business Portal (business.aorane.in)", C.purple);
const bpCols = [W * 0.28, W * 0.72];
tableRow(["Page", "Features"], bpCols, true, C.purple);
const bpPages = [
  ["Landing.tsx", "Marketing page for businesses — features, pricing, CTA for registration"],
  ["Register.tsx", "Organization registration — name, type, email, password, contact details"],
  ["Login.tsx", "Business admin login — email + password or OTP, JWT session"],
  ["Verify.tsx", "Email verification for new org registration"],
  ["AuthRedirect.tsx", "Handles redirect after OAuth flows"],
  ["Dashboard.tsx", "Org overview — total members, seat usage, active plans, health score distribution"],
  ["Members.tsx", "Employee list — search, filter by plan/status, individual health overview, suspend"],
  ["EnrollmentCodes.tsx", "Manage enrollment codes — generate, set expiry, usage tracking, share link"],
  ["Analytics.tsx", "Aggregate health analytics — trend charts, BMI distribution, step count averages"],
  ["Communications.tsx", "Org announcements — create targeted messages for all/specific members"],
  ["Billing.tsx", "Billing management — current plan, seat count, payment history, upgrade options"],
  ["Settings.tsx", "Org settings — name, contact, GSTIN, city, industry, password change"],
  ["not-found.tsx", "404 page for invalid routes"],
];
bpPages.forEach((p, i) => tableRow(p, bpCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

doc.moveDown(0.5);
sectionHeader("B2B Enrollment Flow", C.navy);
const flowSteps = [
  "Organization registers on business.aorane.in",
  "Admin generates enrollment codes (capacity-limited)",
  "Codes shared with employees via email/chat",
  "Employee enters code in mobile app → Enrollment screen",
  "API validates code → links user to org → upgrades plan",
  "Employee now has Pro/Max plan funded by their organization",
  "Org analytics aggregate employee health data (anonymized)",
  "Org pays per-seat billing on Razorpay subscription",
];
flowSteps.forEach((step, i) => {
  const y = doc.y;
  doc.rect(LEFT, y, 24, 18).fill(C.purple);
  doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold")
    .text(String(i + 1), LEFT + 8, y + 4);
  doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
    .text(step, LEFT + 30, y + 4, { width: W - 30 });
  doc.y = y + 22;
});

doc.moveDown(0.6);
sectionHeader("10. Landing Website (aorane.in)", C.blue);
const landingCols = [W * 0.28, W * 0.72];
tableRow(["Page", "Content"], landingCols, true, C.blue);
const landingPages = [
  ["LandingPage.tsx", "Hero section, platform stats, key features overview, app store download CTAs"],
  ["FeaturesPage.tsx", "Detailed feature list — AI scan, health tracking, blood bank, B2B, wearable"],
  ["PricingPage.tsx", "Plan comparison table — Free / Pro / Max / Family with feature matrix"],
  ["BusinessPage.tsx", "B2B landing — corporate wellness value prop, case studies, org plan pricing"],
  ["AboutPage.tsx", "About Aorane — mission, team, vision for Indian health-tech"],
  ["ContactPage.tsx", "Contact form (enquiries table), email, office address"],
  ["PrivacyPage.tsx", "Privacy policy — data collection, storage, sharing, deletion rights"],
  ["TermsPage.tsx", "Terms of service — usage rules, subscription terms, cancellation policy"],
  ["CareersPage.tsx", "Jobs page — open positions, team culture, apply CTA"],
  ["ComingSoonPage.tsx", "Coming soon placeholder for unannounced features"],
];
landingPages.forEach((p, i) => tableRow(p, landingCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE — SECURITY
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("11. Security Architecture", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("Authentication, authorization, encryption, and security hardening", LEFT, 39);
doc.y = 72;

sectionHeader("11.1 Authentication System", C.dark);
const secCols = [W * 0.30, W * 0.70];
tableRow(["Layer", "Implementation"], secCols, true, C.dark);
const secRows = [
  ["User Auth (Mobile)", "JWT access token (15min) + refresh token (30 days). OTP via SMS/WhatsApp/Email for login"],
  ["PIN Auth (Mobile)", "4/6 digit PIN stored bcrypt-hashed in DB. Quick re-auth without OTP"],
  ["Google OAuth", "Firebase ID token verified server-side, mapped to user account"],
  ["Firebase Auth", "Custom token flow for seamless Google/Firebase login"],
  ["Business Auth", "Email + password (bcrypt) or email OTP for org portal login"],
  ["Admin Auth", "Email + bcrypt password, JWT, rate-limited (10 attempts/15 min)"],
  ["Token Storage", "Expo SecureStore on mobile (hardware keychain). Never localStorage"],
  ["Token Refresh", "Silent refresh on 401 response. Interceptor pattern in API client"],
];
secRows.forEach((r, i) => tableRow(r, secCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

doc.moveDown(0.5);
sectionHeader("11.2 API Security Measures", C.navy);
twoCol([
  "All user routes: requireAuth middleware (JWT verify)",
  "All admin routes: requireAdmin (separate admin JWT)",
  "All business routes: requireBusinessAuth (org JWT)",
  "Rate limiting on auth endpoints (Redis-backed)",
  "Admin login: 10 attempts per 15 min per email",
  "OTP: time-limited (5 min expiry), single-use, hashed",
  "SQL injection: Drizzle ORM parameterized queries only",
  "XSS: safePlanLabel() whitelist + escapeJs() in templates",
  "CORS: configured per environment (production restricts origins)",
  "Webhook: Razorpay HMAC-SHA256 signature verification",
  "Helmet.js security headers on all responses",
  "Request body size limits to prevent DoS",
], 230);

doc.moveDown(0.5);
sectionHeader("11.3 Data Security", C.dark);
twoCol([
  "Passwords: bcrypt (12 rounds) — never stored plain",
  "OTPs: SHA-256 hashed in DB + Redis TTL expiry",
  "Secrets: All in Render/Vercel env vars (never in code)",
  "DB connection: SSL enabled for Supabase PostgreSQL",
  "Health data: userId-scoped, no cross-user data leaks",
  "Push tokens: stored per user, invalidated on logout",
  "File uploads: Supabase storage with signed URLs",
  "Audit trail: every admin action logged with IP + changes",
  "Phone numbers: never logged in plain text in application logs",
  "Payment: Razorpay handles card data (PCI-DSS compliant)",
], 230);

doc.moveDown(0.5);
sectionHeader("11.4 Infrastructure Security", C.navy);
twoCol([
  "HTTPS everywhere — Render, Vercel, Supabase",
  "TLS 1.2+ enforced on all endpoints",
  "Supabase Row-Level Security (RLS) policies",
  "Render private network for DB connections",
  "No direct DB port exposure — only via app layer",
  "GitHub Actions CI — no deployment without passing checks",
  "Dependency audit: 0 critical vulnerabilities",
  "SAST scan: XSS/SQLi issues fixed in payment + admin",
  "Secret scan (HoundDog): 0 hardcoded secrets",
  "google-services.json: Firebase keys restricted by SHA",
], 230);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE — DATA FLOW
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("12. Data Flow Diagrams", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("Key user journeys and data flows through the platform", LEFT, 39);
doc.y = 72;

function flowDiagram(title, steps, color) {
  if (doc.y > 660) newPage();
  subHeader(title, color);
  const stepW = Math.floor((W - (steps.length - 1) * 10) / steps.length);
  const startX = LEFT;
  const y = doc.y;

  steps.forEach((step, i) => {
    const x = startX + i * (stepW + 10);
    doc.rect(x, y, stepW, 40).fill(color + "18").stroke(color + "66");
    doc.rect(x, y, stepW, 5).fill(color);
    doc.fillColor(color).fontSize(7).font("Helvetica-Bold")
      .text(String(i + 1), x + 3, y + 8);
    doc.fillColor(C.text).fontSize(7).font("Helvetica")
      .text(step, x + 4, y + 20, { width: stepW - 8, align: "center" });
    if (i < steps.length - 1) {
      doc.moveTo(x + stepW + 1, y + 20).lineTo(x + stepW + 9, y + 20)
         .strokeColor(color).lineWidth(1.5).stroke();
      doc.polygon([x + stepW + 7, y + 17], [x + stepW + 7, y + 23], [x + stepW + 10, y + 20]).fill(color);
      doc.lineWidth(1);
    }
  });
  doc.y = y + 48;
}

flowDiagram("User Registration & Onboarding Flow", [
  "App Open\n(new user)", "Phone input\n+ OTP send", "OTP verify\n+ JWT issued", "Onboarding\n(5 steps)", "Profile\ncreated", "Aorane ID\ngenerated", "Dashboard\nloaded"
], C.blue);

flowDiagram("AI Food Scan Flow", [
  "User takes\nphoto", "Image sent\nto API", "NVIDIA LLM\nanalyzes", "Nutrition\nextracted", "Cache\nstored", "User logs\nmeal", "Score\nupdated"
], C.orange);

flowDiagram("Payment & Subscription Flow", [
  "User selects\nplan", "Promo code\n(optional)", "Razorpay\norder created", "Browser\ncheckout page", "Payment\ncompleted", "Webhook\nverified", "Plan\nactivated"
], C.green);

flowDiagram("Corporate B2B Enrollment Flow", [
  "Org registers\non portal", "Enrollment\ncode created", "Code shared\nwith employee", "Employee\nenters code", "Seat\nallocated", "Plan\nupgraded", "Analytics\nupdated"
], C.purple);

flowDiagram("Blood Emergency Flow", [
  "SOS\ntriggered", "Blood group\ndetected", "Compatible\ndonors found", "Push alerts\nto donors", "Donor\nresponds", "Contact\nshared", "Donation\nlogged"
], C.red);

flowDiagram("Health Score Computation Flow", [
  "Daily logs\n(food/water)", "Exercise &\nmedicine", "Score\nformula run", "Breakdown\nstored", "Daily chart\nupdated", "AI tip\ngenerated", "User\nnotified"
], C.teal);

flowDiagram("Accident Emergency SOS Flow", [
  "SOS button\npressed", "GPS location\ncaptured", "Emergency\ncontacts alerted", "Nearby hospitals\npinged", "Admin\nnotified", "Status\ntracked", "Resolved\n& logged"
], C.brand);

doc.moveDown(0.4);
sectionHeader("12.1 Data Architecture Summary", C.dark);
doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
  .text("All data is user-scoped at the database level — every table query includes a userId WHERE clause enforced by middleware. Health data never crosses between users. B2B analytics are aggregated server-side with user PII stripped before sending to org dashboards. Admin-level data access is gated behind a separate auth token and audit-logged.", LEFT, doc.y, { width: W, lineGap: 3 });

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE — THIRD-PARTY INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, 60).fill(C.dark);
doc.rect(0, 0, 6, 60).fill(C.brand);
doc.fillColor(C.white).fontSize(18).font("Helvetica-Bold").text("13. Third-Party Integrations", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("External services, APIs, and platform integrations", LEFT, 39);
doc.y = 72;

sectionHeader("13.1 Integration Summary", C.dark);
const intCols = [W * 0.18, W * 0.18, W * 0.17, W * 0.47];
tableRow(["Service", "Provider", "Purpose", "Implementation"], intCols, true, C.dark);
const integrations = [
  ["AI / LLM", "NVIDIA NIM", "Food analysis, health tips, diet charts, chat", "NVIDIA_API_KEY → callAI() in lib/ai.ts using LLaMA 3.3 70B"],
  ["Payments", "Razorpay", "UPI, cards, autopay subscriptions, B2B billing", "RAZORPAY_KEY_ID/SECRET → createOrder(), createSubscription(), webhooks"],
  ["Email", "Resend", "OTP emails, invoices, onboarding, alerts", "RESEND_API_KEY → resend.emails.send() for all transactional email"],
  ["Push Notifications", "Expo + Firebase", "Mobile push alerts for health reminders, SOS", "Expo Push API + FCM for Android, APNs for iOS"],
  ["Auth (Google)", "Firebase", "Google Sign-In for mobile and web auth", "Firebase ID token verification server-side"],
  ["SMS OTP", "Firebase SMS", "Phone number verification at login", "Firebase Auth phone verification flow"],
  ["Wearable", "Google Fit", "Steps, heart rate, calories from wearables", "OAuth2 GOOGLE_FIT_CLIENT_ID/SECRET → /wearable/oauth/google-fit"],
  ["WhatsApp", "WhatsApp Business API", "Health check-ins, OTP, blood emergency alerts", "Webhook + message templates via Meta Business API"],
  ["Database", "Supabase", "PostgreSQL + storage + realtime (Mumbai region)", "SUPABASE_DATABASE_URL + SUPABASE_ANON_KEY"],
  ["Cache / Redis", "Upstash Redis", "OTP storage, rate limiting, session cache, AI cache", "REDIS_URL via ioredis client in lib/redis.ts"],
  ["CI/CD API", "GitHub", "Source control, auto-deploy triggers for Render/Vercel", "GitHub integration with Render + Vercel webhooks"],
  ["Domain / DNS", "Cloudflare", "DNS, CDN, DDoS protection for aorane.in", "Cloudflare proxied DNS for all subdomains"],
  ["App Distribution", "Expo EAS", "Mobile app builds, OTA updates, store submissions", "EXPO_TOKEN for EAS build + submit commands"],
];
integrations.forEach((r, i) => tableRow(r, intCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

doc.moveDown(0.6);
sectionHeader("13.2 AI Integration Details (NVIDIA NIM)", C.purple);
doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
  .text("The platform uses NVIDIA's NIM API with the LLaMA 3.3 70B Instruct model for all AI features. The AI module (artifacts/api-server/src/lib/ai.ts) provides a unified callAI() function with rate limiting, error handling, and response caching via Redis.", LEFT, doc.y, { width: W, lineGap: 3 });
doc.moveDown(0.4);

const aiFeatures = [
  ["Food Scan (smart-scan)", "Photo/text/voice → nutrition breakdown (calories, protein, fat, carbs, micronutrients) with Indian food knowledge"],
  ["Diet Plan Generator", "Based on BMI, goals, food preferences, medical conditions → 7-day meal plan with Indian foods"],
  ["Meal Swap", "Suggest healthier alternatives to logged meals with similar calories but better nutrition profile"],
  ["Health Tips", "Contextual daily health tips based on user's health data, Indian seasons, and current metrics"],
  ["Stress Insights", "Analyze stress patterns over 30 days → personalized insight with actionable recommendations"],
  ["Health Predictions", "Risk assessment for lifestyle diseases (diabetes, hypertension) based on BMI, exercise, diet trends"],
  ["Weekly Diet Chart", "Full weekly structured meal plan with recipes, prep time, and nutrient targets"],
  ["Daily Suggestions", "Morning AI-generated health checklist — water goal, step target, meal suggestions, reminders"],
];
const aiCols = [W * 0.25, W * 0.75];
tableRow(["AI Feature", "How It Works"], aiCols, true, C.purple);
aiFeatures.forEach((r, i) => tableRow(r, aiCols, false, i % 2 === 0 ? "#F9FAFB" : C.white));

doc.moveDown(0.6);
sectionHeader("13.3 Razorpay Payment Integration", C.green);
twoCol([
  "One-time orders for Pro/Max/Family plan purchase",
  "Auto-recurring subscriptions (monthly autopay via UPI mandate)",
  "B2B seat-based billing for organizations",
  "Server-rendered checkout pages for mobile browser",
  "HMAC-SHA256 webhook verification (webhooks/razorpay)",
  "Promo code validation with discount application",
  "Refund processing via admin panel",
  "Test mode / Live mode toggle via isLiveMode()",
  "Family plan with up to 5 member accounts",
  "Subscription lifecycle: active → cancelled → expired",
], 240);

// ═══════════════════════════════════════════════════════════════════════════════
// Final page — Summary
// ═══════════════════════════════════════════════════════════════════════════════
newPage();
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.dark);
doc.rect(0, 0, 6, doc.page.height).fill(C.brand);
doc.rect(0, 0, doc.page.width, 5).fill(C.brand);
doc.rect(0, doc.page.height - 5, doc.page.width, 5).fill(C.brand);

doc.circle(500, 200, 120).fill("#1a3358");
doc.circle(60, 500, 80).fill("#1a3358");

doc.fillColor(C.white).fontSize(26).font("Helvetica-Bold")
  .text("Platform Summary", LEFT + 10, 80);
doc.fillColor(C.brand).fontSize(12).font("Helvetica")
  .text("Aorane Health — Complete Technical Overview", LEFT + 10, 115);
doc.moveTo(LEFT + 10, 135).lineTo(LEFT + W - 10, 135).strokeColor(C.brand).lineWidth(1.5).stroke();
doc.lineWidth(1);

const summaryStats = [
  { label: "API Endpoints", value: "100+", col: C.blue },
  { label: "Database Tables", value: "40+", col: C.green },
  { label: "Mobile Screens", value: "25+", col: C.purple },
  { label: "Admin Pages", value: "26", col: C.orange },
  { label: "Business Pages", value: "13", col: C.pink },
  { label: "DB Schema Files", value: "8", col: C.teal },
];
let statX = LEFT + 10; let statRow = 0;
summaryStats.forEach((s, i) => {
  if (i === 3) { statX = LEFT + 10; statRow = 1; }
  const sy = 150 + statRow * 80;
  doc.rect(statX, sy, 155, 65).fill("#1a3358");
  doc.rect(statX, sy, 155, 4).fill(s.col);
  doc.fillColor(s.col).fontSize(28).font("Helvetica-Bold")
    .text(s.value, statX + 8, sy + 12, { width: 139, align: "center" });
  doc.fillColor("#94A3B8").fontSize(9).font("Helvetica")
    .text(s.label, statX + 8, sy + 46, { width: 139, align: "center" });
  statX += 165;
});

doc.fillColor(C.white).fontSize(11).font("Helvetica-Bold")
  .text("Infrastructure at a Glance", LEFT + 10, 320);
const infra = [
  "API Server  →  Express.js on Render (ap-south-1, Mumbai)",
  "Admin Panel  →  React+Vite on Vercel",
  "Business Portal  →  React+Vite on Vercel",
  "Landing Website  →  React+Vite on Vercel",
  "Mobile App  →  Expo React Native (iOS + Android + Web)",
  "Database  →  Supabase PostgreSQL (Mumbai, 40+ tables)",
  "Cache  →  Upstash Redis (global edge)",
  "AI  →  NVIDIA NIM LLaMA 3.3 70B",
  "Payments  →  Razorpay (orders + subscriptions + webhooks)",
  "Email  →  Resend (transactional)",
];
infra.forEach(item => {
  const y = doc.y;
  doc.circle(LEFT + 14, y + 5, 3).fill(C.brand);
  doc.fillColor("#94A3B8").fontSize(9).font("Helvetica").text(item, LEFT + 22, y, { width: W - 22 });
  doc.y = y + 14;
});

doc.fillColor("#475569").fontSize(9).font("Helvetica")
  .text(`Document generated on ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`, LEFT + 10, 630, { width: W });
doc.fillColor("#1E293B").fontSize(8)
  .text("AORANE HEALTH TECHNOLOGIES — CONFIDENTIAL — DO NOT DISTRIBUTE", LEFT + 10, 660, { width: W, align: "center" });

// ═══════════════════════════════════════════════════════════════════════════════
// Add page numbers and footers to all pages
// ═══════════════════════════════════════════════════════════════════════════════
const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  if (i > 0 && i < totalPages - 1) {
    pageFooter(i + 1, totalPages);
  }
}

doc.end();
stream.on("finish", () => {
  console.log(`✅ PDF generated: ${OUTPUT}`);
  console.log(`   Size: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
  console.log(`   Pages: ${totalPages}`);
});
stream.on("error", err => console.error("❌ Error:", err));
