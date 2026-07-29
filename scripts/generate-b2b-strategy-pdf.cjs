// Aorane B2B Marketing Strategy PDF
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "../exports/aorane-b2b-strategy.pdf");
const doc = new PDFDocument({ size: "A4", margin: 45, bufferPages: true });
doc.pipe(fs.createWriteStream(OUTPUT));

const C = {
  brand: "#E8622A", dark: "#0A1628", navy: "#0D2040",
  blue: "#3B82F6", green: "#10B981", purple: "#8B5CF6",
  orange: "#F59E0B", red: "#EF4444", gray: "#6B7280",
  white: "#FFFFFF", text: "#1F2937", muted: "#9CA3AF",
  teal: "#14B8A6", pink: "#EC4899", yellow: "#FCD34D",
};
const W = doc.page.width - 90;
const LEFT = 45;

function np() { doc.addPage(); }
function sec(title, col = C.dark) {
  if (doc.y > 730) np();
  doc.moveDown(0.3);
  const y = doc.y;
  doc.rect(LEFT, y, W, 28).fill(col);
  doc.fillColor(C.white).fontSize(12).font("Helvetica-Bold").text(title, LEFT + 12, y + 8, { width: W - 20 });
  doc.fillColor(C.text).font("Helvetica").fontSize(9);
  doc.moveDown(0.3);
}
function sub(title, col = C.blue) {
  if (doc.y > 740) np();
  doc.moveDown(0.3);
  const y = doc.y;
  doc.rect(LEFT, y, 4, 16).fill(col);
  doc.fillColor(col).fontSize(10).font("Helvetica-Bold").text(title, LEFT + 10, y + 2);
  doc.fillColor(C.text).font("Helvetica").fontSize(9);
  doc.moveDown(0.2);
}
function bul(txt, col = C.brand, ind = 0) {
  if (doc.y > 768) np();
  const y = doc.y;
  doc.circle(LEFT + ind + 6, y + 4.5, 2.8).fill(col);
  doc.fillColor(C.text).fontSize(8.5).font("Helvetica").text(txt, LEFT + ind + 15, y, { width: W - ind - 15 });
  doc.moveDown(0.15);
}
function num(n, txt, col = C.brand) {
  if (doc.y > 765) np();
  const y = doc.y;
  doc.rect(LEFT, y, 22, 17).fill(col);
  doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold").text(String(n), LEFT + 7, y + 4);
  doc.fillColor(C.text).fontSize(8.5).font("Helvetica").text(txt, LEFT + 28, y + 2, { width: W - 28 });
  doc.y = y + 20;
}
function tRow(cols, widths, isH = false, bg = null) {
  if (doc.y > 770) np();
  const y = doc.y; const h = 17;
  if (bg) doc.rect(LEFT, y, W, h).fill(bg);
  let x = LEFT;
  cols.forEach((c, i) => {
    doc.fillColor(isH ? C.white : C.text).fontSize(isH ? 8 : 8)
      .font(isH ? "Helvetica-Bold" : "Helvetica")
      .text(String(c), x + 4, y + 4, { width: widths[i] - 6, ellipsis: true });
    x += widths[i];
  });
  doc.rect(LEFT, y, W, h).stroke("#E5E7EB");
  doc.y = y + h;
}
function box(title, lines, x, y, w, h, col) {
  doc.rect(x, y, w, h).fill(col + "15").stroke(col + "60");
  doc.rect(x, y, w, 16).fill(col);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text(title, x + 5, y + 4, { width: w - 10 });
  doc.fillColor(C.text).fontSize(7.5).font("Helvetica");
  lines.forEach((l, i) => doc.text("• " + l, x + 5, y + 20 + i * 11, { width: w - 10, ellipsis: true }));
}
function promptBox(title, prompt, col = C.purple) {
  if (doc.y > 700) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 14).fill(col);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("🤖 AI PROMPT: " + title, LEFT + 6, y + 3, { width: W - 10 });
  doc.y = y + 16;
  const py = doc.y;
  doc.rect(LEFT, py, W, doc.heightOfString(prompt, { width: W - 16, fontSize: 8 }) + 14).fill(col + "12");
  doc.fillColor("#1a1a2e").fontSize(8).font("Courier").text(prompt, LEFT + 8, py + 6, { width: W - 16 });
  doc.y = py + doc.heightOfString(prompt, { width: W - 16, fontSize: 8 }) + 18;
}
function divider() {
  doc.moveDown(0.2);
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + W, doc.y).strokeColor("#E5E7EB").stroke();
  doc.moveDown(0.2);
}

// ═══ COVER ═══════════════════════════════════════════════════════
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.dark);
doc.rect(0, 0, 6, doc.page.height).fill(C.blue);
doc.rect(0, 0, doc.page.width, 5).fill(C.blue);
doc.circle(480, 150, 140).fill("#0d2040");
doc.circle(100, 650, 90).fill("#0d2040");

doc.fillColor(C.blue).fontSize(11).font("Helvetica-Bold").text("AORANE HEALTH PLATFORM", LEFT + 10, 80);
doc.fillColor(C.white).fontSize(34).font("Helvetica-Bold").text("B2B Marketing", LEFT + 10, 100);
doc.fillColor(C.brand).fontSize(34).font("Helvetica-Bold").text("Strategy 2025", LEFT + 10, 140);
doc.moveTo(LEFT + 10, 185).lineTo(LEFT + W - 10, 185).strokeColor(C.blue).lineWidth(2).stroke(); doc.lineWidth(1);
doc.fillColor("#94A3B8").fontSize(12).font("Helvetica").text("Zero-Cost Growth Playbook for Corporate Wellness Sales", LEFT + 10, 198);

const coverStats = [
  { v: "B2B", l: "Revenue Focus", col: C.blue },
  { v: "₹0", l: "Marketing Budget", col: C.green },
  { v: "10", l: "Strategies Inside", col: C.orange },
  { v: "90", l: "Day Roadmap", col: C.purple },
];
let cx = LEFT + 10;
coverStats.forEach(s => {
  doc.rect(cx, 235, 118, 60).fill("#1a3358");
  doc.rect(cx, 235, 118, 4).fill(s.col);
  doc.fillColor(s.col).fontSize(22).font("Helvetica-Bold").text(s.v, cx + 5, 250, { width: 108, align: "center" });
  doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica").text(s.l, cx + 5, 278, { width: 108, align: "center" });
  cx += 128;
});

doc.fillColor(C.white).fontSize(11).font("Helvetica-Bold").text("Who Should Read This", LEFT + 10, 320);
const who = ["Founders / Co-founders", "Sales team", "Growth & marketing", "Business development"];
who.forEach((w, i) => {
  doc.circle(LEFT + 20 + i * 128, 360, 4).fill(C.blue);
  doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica").text(w, LEFT + 10 + i * 128, 366, { width: 115, align: "center" });
});

doc.fillColor("#94A3B8").fontSize(9).font("Helvetica")
  .text("Target: Corporates • Hospitals • Gyms • NGOs • Schools • Insurance Companies", LEFT + 10, 410);
doc.fillColor("#475569").fontSize(8).font("Helvetica")
  .text(`Version 1.0  •  ${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}  •  INTERNAL USE ONLY`, LEFT + 10, 720);

// ═══ PAGE 2: ICP + CHANNELS ═══════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.blue);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("1. Ideal Customer Profile (ICP) & Target Channels", LEFT, 15);
doc.fillColor(C.blue).fontSize(9).font("Helvetica").text("Kisse baat karni hai, kahan milenge, kya bolna hai", LEFT, 37);
doc.y = 68;

sec("1.1 Who is Your B2B Buyer?", C.navy);
const buyers = [
  { title: "IT / Tech Companies (50–5000 employees)", col: C.blue, why: "Employee health benefits mandatory, WFH stress high, budget hai", contact: "HR Manager, VP HR, Chief People Officer", pain: "Employee burnout, attrition, high insurance premiums" },
  { title: "Manufacturing Companies (Factory + Admin staff)", col: C.green, why: "Physical health critical, ESIC/insurance already spending", contact: "Factory Manager, HR Director, MD/CEO", pain: "Workplace accidents, absenteeism, low productivity" },
  { title: "Hospitals & Clinics (Staff wellness)", col: C.red, why: "Doctor/nurse burnout highest in India, credibility lends authority", contact: "Hospital Administrator, HR, Medical Director", pain: "Staff stress, irregular meals, long shifts — need tracking" },
  { title: "Gyms & Fitness Centers (Member health tracking)", col: C.orange, why: "Members want data, gyms want retention", contact: "Owner/Founder, Operations Manager", pain: "Member churn after 3 months, no health data to show value" },
  { title: "Schools & Universities (Student + Staff)", col: C.purple, why: "Mental health + physical health both priority post-COVID", contact: "Principal, Student Affairs, HR", pain: "Student stress, lack of nutrition data for hostels" },
  { title: "Insurance Companies (Health monitoring)", col: C.teal, why: "They pay claims — preventive data = premium reduction", contact: "Head of Health Products, CTO, Chief Actuary", pain: "High claims, no real-time health data on policyholders" },
];
buyers.forEach(b => {
  if (doc.y > 700) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 54).fill(b.col + "10").stroke(b.col + "50");
  doc.rect(LEFT, y, 4, 54).fill(b.col);
  doc.fillColor(b.col).fontSize(9).font("Helvetica-Bold").text(b.title, LEFT + 10, y + 4, { width: W - 16 });
  doc.fillColor(C.text).fontSize(8).font("Helvetica").text("👤 Contact: " + b.contact, LEFT + 10, y + 18, { width: W - 16 });
  doc.text("💡 Why buy: " + b.why, LEFT + 10, y + 30, { width: (W - 16) / 2 });
  doc.text("😣 Pain point: " + b.pain, LEFT + W / 2 + 5, y + 30, { width: (W - 16) / 2 });
  doc.y = y + 58;
});

// ═══ PAGE 3: LINKEDIN STRATEGY ═══════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill("#0A66C2");
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("2. LinkedIn — Primary B2B Channel (Zero Cost)", LEFT, 15);
doc.fillColor("#60A5FA").fontSize(9).font("Helvetica").text("Sabse powerful zero-cost B2B channel — HR aur CXO yahan milte hain", LEFT, 37);
doc.y = 68;

sec("2.1 LinkedIn Profile Optimization (Day 1 Action)", "#0A66C2");
[
  "Founder/CEO ka profile — 'Building India's Corporate Wellness Platform @Aorane' headline likho",
  "Banner image: 'Aorane — Your Company's Health Partner' with company logo (Canva se free)",
  "About section: Start with '1 in 3 Indian employees suffers from work-related health problems...' hook",
  "Featured section: Add company demo video + one-pager PDF link",
  "Experience: Aorane Health Technologies — Founder, mention B2B traction even if early",
  "Skills: Corporate Wellness, Employee Health, HR Tech, Digital Health India — 5 minimum",
].forEach(b => bul(b));

sec("2.2 Content Strategy (3 posts per week, ZERO cost)", "#0A66C2");
sub("Post Type 1: Educational (Mon/Wed) — Gets most shares", "#0A66C2");
[
  "Format: '5 things HR managers don't know about employee health costs' → List post",
  "Format: Data post — 'Did you know? Indian employees lose 14 days/year to preventable illness'",
  "Format: Before/After — 'What happens when company tracks employee steps: [case study]'",
  "Use carousel format (PDF slides) — LinkedIn carousels get 3x more reach than text posts",
].forEach(b => bul(b, "#0A66C2", 10));

sub("Post Type 2: Story/Proof (Friday) — Gets most DMs", C.green);
[
  "'We enrolled our first corporate client last week. Here's exactly what we said in the sales call...'",
  "'An HR manager asked us — how is Aorane different from HealthifyMe? Here's our answer:'",
  "'3 months after using Aorane, employees of [Company X] showed 23% drop in sick leaves'",
].forEach(b => bul(b, C.green, 10));

doc.moveDown(0.3);
promptBox("LinkedIn Carousel Post (5 slides) — Copy karke ChatGPT mein paste karo",
`Act as a LinkedIn content expert for Indian B2B health-tech.
Create a 5-slide carousel for Aorane Health targeting HR Managers.
Topic: "5 ways poor employee health is costing your company money"

For each slide:
- Slide number + punchy headline (max 8 words)
- 2-3 bullet points with India-specific statistics
- Visual suggestion (what image/icon to use)

Style: Professional, data-driven, Hindi-English mix (Hinglish okay for relatable tone)
CTA on last slide: "DM us for a free 30-day corporate trial"
Company: Aorane Health — AI-powered employee wellness platform`);

sub("2.3 LinkedIn DM Outreach Script (Cold Outreach)", C.orange);
doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
  .text("Har din 10 HR managers ko yeh message bhejo — connection accept hone ke baad:", LEFT, doc.y, { width: W });
doc.moveDown(0.2);
const y3 = doc.y;
doc.rect(LEFT, y3, W, 90).fill("#FFF7ED").stroke(C.orange + "60");
doc.fillColor(C.text).fontSize(8.5).font("Helvetica").text(
`Hi [Name], aapka [Company] mein employee wellness pe kaam dekha — impressive!

We are building Aorane — India's first AI-powered corporate wellness platform. We track employee health (food, exercise, stress, medicines) and give HR teams aggregate analytics.

Quick question: Does [Company] currently measure employee health data beyond leaves/insurance?

Happy to share a 5-min demo — no sales pitch, just showing the product. Interested?`, LEFT + 8, y3 + 8, { width: W - 16, lineGap: 3 });
doc.y = y3 + 95;

sec("2.4 LinkedIn Company Page Strategy", "#0A66C2");
[
  "Company page banao: Aorane Health Technologies, Industry: Health, Wellness & Fitness",
  "Weekly 1 post from company page + employees like/comment karo for reach boost",
  "Join LinkedIn Groups: HR Professionals India, Corporate Wellness India, Employee Benefits India",
  "Post in these groups: same content, but adapt for community format",
  "Follow + engage with HR influencers: Rituraj Tyagi, Sumit Kumar, etc. — comment meaningful insights",
].forEach(b => bul(b));

// ═══ PAGE 4: EMAIL OUTREACH ═══════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.green);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("3. Cold Email Outreach (Zero Cost)", LEFT, 15);
doc.fillColor("#6EE7B7").fontSize(9).font("Helvetica").text("HR emails find karo aur yeh sequence follow karo — response rate 8-15% expected", LEFT, 37);
doc.y = 68;

sec("3.1 Where to Find HR Emails (Free Tools)", C.green);
const emailSources = [
  ["LinkedIn (Free tier)", "HR Manager search karo by company size + industry. Company + HR Name se email guess karo"],
  ["Hunter.io", "Free 25 searches/month. Company domain daalo → HR email milega"],
  ["Apollo.io", "Free 50 contacts/month. Filter: India, 50-500 employees, HR titles"],
  ["Naukri.com/LinkedIn Jobs", "Companies jo hiring kar rahi hain HR ke liye — unka budget hai"],
  ["Startup lists", "YourStory, Inc42, Tracxn — funded startups ki HR list google karo"],
  ["Google: site:linkedin.com/in 'HR Manager' 'Pune'", "Free LinkedIn scraping technique"],
];
const eCols = [W * 0.28, W * 0.72];
tRow(["Source", "How to Use"], eCols, true, C.green);
emailSources.forEach((r, i) => tRow(r, eCols, false, i % 2 === 0 ? "#F0FDF4" : C.white));

doc.moveDown(0.5);
sec("3.2 Email Sequence (3-Touch, 7 Days Apart)", C.navy);

sub("Email 1: The Hook (Day 1)", C.blue);
const eY1 = doc.y;
doc.rect(LEFT, eY1, W, 95).fill("#EFF6FF").stroke(C.blue + "50");
doc.fillColor(C.text).fontSize(8).font("Helvetica").text(
`Subject: Quick question about [Company] employee health, [First Name]

Hi [First Name],

Found your profile as HR leader at [Company] — quick question:

Does your company currently track how many employees skip lunch, sit for 8+ hours, or are sleep-deprived?

Most companies don't — until sick leave costs hit ₹2-5 lakh/month.

We built Aorane — an AI platform that helps HR teams get aggregate health data without invading employee privacy. Companies using us see 20% drop in stress-related absenteeism in 90 days.

Free 30-day pilot for your team (up to 50 employees)?

[Your Name] | Aorane Health | aorane.in`, LEFT + 8, eY1 + 6, { width: W - 16, lineGap: 3 });
doc.y = eY1 + 100;

sub("Email 2: The Value Add (Day 8 — if no reply)", C.orange);
const eY2 = doc.y;
doc.rect(LEFT, eY2, W, 75).fill("#FFF7ED").stroke(C.orange + "50");
doc.fillColor(C.text).fontSize(8).font("Helvetica").text(
`Subject: Free resource: Corporate wellness ROI calculator for Indian companies

Hi [First Name], following up from last week.

Sharing something useful: We built a simple calculator that estimates your company's annual cost due to poor employee health. Takes 2 min → [link to calculator or simple sheet]

Most companies discover ₹8-12L/year in hidden productivity loss.

If the number surprises you, happy to show you how Aorane addresses this. 15-min call?

P.S. We're offering free onboarding to our first 10 corporate clients — 3 spots left.`, LEFT + 8, eY2 + 6, { width: W - 16, lineGap: 3 });
doc.y = eY2 + 80;

sub("Email 3: The Breakup (Day 15 — if still no reply)", C.red);
const eY3 = doc.y;
doc.rect(LEFT, eY3, W, 60).fill("#FEF2F2").stroke(C.red + "50");
doc.fillColor(C.text).fontSize(8).font("Helvetica").text(
`Subject: Closing your file, [First Name]

Hi [First Name], last email from me.

If employee wellness isn't a priority right now, totally understood. I'll stop reaching out.

But if timing changes — or if you see 3+ employees calling in sick in one week — we're at hello@aorane.in.

Wishing [Company] team great health!
[Your Name]

P.S. Our free pilot is open until [date].`, LEFT + 8, eY3 + 6, { width: W - 16, lineGap: 3 });
doc.y = eY3 + 65;

doc.moveDown(0.3);
promptBox("Email Personalization — ChatGPT prompt",
`I'm doing cold email outreach to HR managers at Indian companies for Aorane Health — a B2B employee wellness app.

Company I'm targeting: [COMPANY NAME]
Industry: [INDUSTRY]
Company size: [SIZE]
HR contact name: [NAME]

Write a personalized cold email (150 words max) that:
1. Opens with a specific insight about their industry's health challenges
2. Connects it to Aorane's value proposition
3. Asks ONE yes/no question
4. Has a soft CTA for a 15-min demo

Tone: Professional but conversational, India-specific context, no fluff`);

// ═══ PAGE 5: WHATSAPP + OFFLINE ════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.teal);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("4. WhatsApp B2B Outreach + Offline Networking", LEFT, 15);
doc.fillColor("#99F6E4").fontSize(9).font("Helvetica").text("India mein B2B deals WhatsApp pe close hoti hain — LinkedIn se bhi zyada", LEFT, 37);
doc.y = 68;

sec("4.1 WhatsApp B2B Outreach Strategy", C.teal);
[
  "WhatsApp Business account banao: Aorane Health | Corporate Wellness | aorane.in",
  "Profile photo: Clean logo, professional. Status: 'Helping companies track employee health | Free 30-day trial'",
  "Quick Replies setup karo: /demo, /pricing, /trial — instant response templates",
  "Broadcast list (not group) banao of HR contacts — 256 max per list (GDPR compliant — people opted in from LinkedIn)",
].forEach(b => bul(b));

sub("WhatsApp Message Templates (3 variants)", C.teal);
const waY = doc.y;
doc.rect(LEFT, waY, W / 3 - 5, 90).fill("#E0FDF4").stroke(C.teal + "50");
doc.fillColor(C.teal).fontSize(8).font("Helvetica-Bold").text("Template A: Quick Intro", LEFT + 4, waY + 4);
doc.fillColor(C.text).fontSize(7.5).font("Helvetica").text(
`Hi [Name], Rohit from Aorane here (connected on LinkedIn).

We help companies track employee health with AI. No hardware needed — just a mobile app.

Can I send our 1-min demo video?`, LEFT + 4, waY + 16, { width: W / 3 - 14 });

doc.rect(LEFT + W / 3 + 2, waY, W / 3 - 5, 90).fill("#EFF6FF").stroke(C.blue + "50");
doc.fillColor(C.blue).fontSize(8).font("Helvetica-Bold").text("Template B: After Demo", LEFT + W / 3 + 6, waY + 4);
doc.fillColor(C.text).fontSize(7.5).font("Helvetica").text(
`Hi [Name], thanks for watching the demo!

Quick question: How many employees does [Company] have?

We customize the trial pilot based on company size. Just need 2 answers to set up your free account.`, LEFT + W / 3 + 6, waY + 16, { width: W / 3 - 14 });

doc.rect(LEFT + 2 * W / 3 + 4, waY, W / 3 - 8, 90).fill("#FFF7ED").stroke(C.orange + "50");
doc.fillColor(C.orange).fontSize(8).font("Helvetica-Bold").text("Template C: Follow-up", LEFT + 2 * W / 3 + 8, waY + 4);
doc.fillColor(C.text).fontSize(7.5).font("Helvetica").text(
`Hi [Name], following up on our conversation.

We have 2 free pilot slots left this month. Once these fill up, next batch starts March.

Shall I reserve one for [Company]? No commitment needed.`, LEFT + 2 * W / 3 + 8, waY + 16, { width: W / 3 - 14 });
doc.y = waY + 96;

sec("4.2 Offline Networking (Zero Cost, High ROI)", C.navy);
sub("Events to attend (free or low cost)", C.orange);
[
  "NASSCOM HR Summit, People Matters Great Place to Work — booth nahi, just attend as delegate",
  "CII (Confederation of Indian Industry) local chapter events — HR roundtables free mein join karo",
  "SHRM India events — free webinars + networking. Sign up as 'HR technology solution provider'",
  "Local startup meetups (YourStory, Inc42 events) — lots of funded startup HRs attend",
  "BNI (Business Network International) — free visitor pass ke saath attend karo, 30+ business owners milenge",
  "Chamber of Commerce meetings (FICCI, ASSOCHAM) — free regional events, direct CEO access",
].forEach(b => bul(b, C.orange));

sub("One-Page Leave-Behind (Print karo — Canva free)", C.blue);
[
  "A4 size — Company logo top, '30-Day Free Corporate Wellness Pilot' headline",
  "3 key stats: average sick leave cost / employee productivity loss / Aorane ROI",
  "QR code: link to demo video or business portal signup page",
  "Contact: WhatsApp number + email. Print 50 copies — ₹50 cost at any print shop",
].forEach(b => bul(b, C.blue));

doc.moveDown(0.3);
promptBox("Canva One-Pager Design Brief — Paste this in Canva AI or give to freelancer",
`Design a professional A4 one-pager for Aorane Health (B2B corporate wellness platform).

Style: Clean, corporate, trust-inspiring. Primary color: #E8622A (orange), Accent: #0A1628 (navy)
Font: Modern sans-serif (Poppins or Inter)

Content blocks:
1. Header: Aorane logo + tagline "AI-Powered Employee Wellness"
2. Problem: 3 stats about Indian employee health costs (icons + numbers)
3. Solution: How Aorane works (3 steps with icons: Install → Track → Insights)
4. Results: "Companies see 20% less absenteeism, 35% better employee health scores"
5. Pricing: "Free 30-day pilot for up to 50 employees"
6. CTA: QR code + WhatsApp + Email

Make it look like a Deloitte/McKinsey health report — premium, data-first`);

// ═══ PAGE 6: REFERRAL + PARTNERSHIPS ══════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.purple);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("5. Referral Programs & Strategic Partnerships", LEFT, 15);
doc.fillColor("#C4B5FD").fontSize(9).font("Helvetica").text("Best B2B leads woh hain jo doosre companies se aate hain — trust already built hota hai", LEFT, 37);
doc.y = 68;

sec("5.1 Client Referral Program (B2B)", C.purple);
[
  "For every corporate client who refers another company → 1 month free added to their subscription",
  "Dedicated Referral Dashboard: client apna referral link share kare, track conversions",
  "Partner Badge: 'Aorane Wellness Partner' certificate company ke HR team ko milega — shareable on LinkedIn",
  "Case study banaoge referrer company ki — free PR for them, credibility for you",
].forEach(b => bul(b, C.purple));

sec("5.2 Partnership Channels (Zero Cost, High Leverage)", C.navy);
const partners = [
  { t: "HR Consultants & Payroll Firms", d: "ADP, Keka, Razorpay Payroll, Darwinbox, greytHR. Yeh already HR teams ke saath kaam karte hain. Reseller agreement do — unhe 20% commission. Woh apne existing clients ko Aorane recommend karenge.", col: C.blue },
  { t: "Corporate Insurance Brokers", d: "Group health insurance brokers (Plum, Nova Benefits, Loop Health). Unke clients already wellness mein invest kar rahe hain. White-label ya referral deal karo.", col: C.green },
  { t: "CA & CFO Network", d: "CAs apne corporate clients ko tax-saving tools suggest karte hain. Employee wellness expenses tax-deductible hain India mein. Yeh angle use karo — Aorane = tax benefit.", col: C.orange },
  { t: "Co-Working Spaces", d: "WeWork India, Awfis, Smartworks — inke member companies HR services dhundhti hain. Partner banke inke monthly newsletter mein jagah pao.", col: C.teal },
  { t: "Startup Accelerators (YC India, Antler, Sequoia Surge)", d: "Portfolio companies ko free tier do. 1 accelerator mein 20-50 startups hain — sab ek saath trial users ban jaate hain.", col: C.pink },
];
partners.forEach(p => {
  if (doc.y > 720) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 42).fill(p.col + "10").stroke(p.col + "40");
  doc.rect(LEFT, y, 4, 42).fill(p.col);
  doc.fillColor(p.col).fontSize(9).font("Helvetica-Bold").text(p.t, LEFT + 10, y + 4, { width: W - 16 });
  doc.fillColor(C.text).fontSize(8).font("Helvetica").text(p.d, LEFT + 10, y + 16, { width: W - 16 });
  doc.y = y + 46;
});

sec("5.3 Government & CSR Angle", C.teal);
[
  "National Health Mission / Ayushman Bharat: Government programs ke saath align karo — credibility free mein milti hai",
  "CSR opportunity: Companies jo 2% CSR spend karte hain, unhe 'employee health is CSR' angle do",
  "Startup India recognition: DPIIT startup recognition lelo — kuch corporates prefer certified startups",
  "GEM Portal registration: Sarkari hospitals aur PSUs ke liye — government procurement ka rasta",
].forEach(b => bul(b, C.teal));

// ═══ PAGE 7: CONTENT + VIDEO ══════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.orange);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("6. Content Marketing — Videos & Graphics (Zero Cost Tools)", LEFT, 15);
doc.fillColor("#FED7AA").fontSize(9).font("Helvetica").text("Kahan banao, kaise banao, har tool free mein kaam karta hai", LEFT, 37);
doc.y = 68;

sec("6.1 Free Tools Arsenal", C.dark);
const toolCols = [W * 0.22, W * 0.22, W * 0.56];
tRow(["Tool", "Free Limit", "Use For"], toolCols, true, C.dark);
const tools = [
  ["Canva.com", "Unlimited free", "Carousels, one-pagers, social graphics, presentations, thumbnails"],
  ["CapCut (app)", "Unlimited free", "Short video editing, AI captions, B-roll, music — best for Reels/Shorts"],
  ["Lumen5.com", "5 videos/month", "Turn blog posts/text into animated video with AI — demo videos"],
  ["D-ID.com", "5 free credits", "AI avatar videos — professional presenter without camera shoot"],
  ["HeyGen.com", "1 free video/month", "AI spokesperson video for product demo — very professional"],
  ["Veed.io", "Basic free", "Video captions, resize for different platforms, subtitles"],
  ["Pexels/Unsplash", "Unlimited free", "Stock photos and videos for graphics and presentations"],
  ["Google Slides", "Unlimited free", "Investor deck, demo deck, client presentation"],
  ["ChatGPT (free)", "Unlimited (GPT-4o-mini)", "All copywriting, email sequences, scripts, social posts"],
  ["Claude.ai (free)", "Limited daily", "Longer content, strategy documents, email personalization"],
  ["Ideogram.ai", "Free tier", "AI-generated branded images, infographics, custom visuals"],
  ["Remove.bg", "5 free/month", "Background remove from product screenshots for clean graphics"],
];
tools.forEach((r, i) => tRow(r, toolCols, false, i % 2 === 0 ? "#FFFBEB" : C.white));

doc.moveDown(0.5);
sec("6.2 B2B Demo Video Script (Record on phone, edit in CapCut)", C.orange);
sub("3-minute product demo video structure", C.orange);
[
  "00:00–00:20: Hook — 'Do you know how much your company loses because employees don't track their health?'",
  "00:20–00:50: Problem — 3 stats about Indian corporate health (absenteeism, stress, insurance costs)",
  "00:50–01:40: Product Demo — Screen recording of Aorane app (employee side) + admin analytics",
  "01:40–02:20: Business Portal Demo — Show HR manager dashboard, aggregate health data, enrollment codes",
  "02:20–02:50: Proof — Any numbers you have (beta users, test data, or industry benchmarks)",
  "02:50–03:00: CTA — 'Free 30-day pilot. DM us or visit business.aorane.in'",
].forEach(b => bul(b, C.orange));

promptBox("Video Script Generation — ChatGPT prompt for B2B demo video",
`Write a 3-minute video script for Aorane Health — a B2B corporate wellness platform.

Audience: HR Managers and CEOs at Indian companies (50-500 employees)
Platform: LinkedIn video + YouTube
Tone: Professional, data-driven, trustworthy, conversational

Script structure:
1. Hook (20 sec): Start with a shocking India-specific statistic about employee health costs
2. Problem (30 sec): Paint the pain of not having employee health data
3. Solution Demo (60 sec): Describe what to show on screen while narrating Aorane's features
4. Benefits for HR (30 sec): What HR gets — aggregate data, no employee privacy concerns
5. Social Proof (20 sec): Placeholder for testimonial or data point
6. Clear CTA (20 sec): Free trial, WhatsApp, website

Include: [ON SCREEN] directions for each section
Make it feel like a McKinsey presentation meets a startup pitch`);

promptBox("Canva Carousel Post — 7 slides for LinkedIn (B2B)",
`Create content for a 7-slide LinkedIn carousel for HR managers in India.

Topic: "The Hidden Cost of Ignoring Employee Health: A CFO's Perspective"
Company: Aorane Health — AI corporate wellness platform

Each slide:
- Slide 1: Hook — Shocking stat or question (make them stop scrolling)
- Slides 2-5: One insight per slide with India-specific data (sources: WHO, CII, FICCI)
- Slide 6: How Aorane solves this (simple 3-step visual description)
- Slide 7: CTA — Free 30-day pilot offer with urgency

For each slide provide:
1. Headline text (max 8 words)
2. Body text (max 25 words)  
3. Visual/icon suggestion
4. Color suggestion (use brand colors: #E8622A orange, #0A1628 navy)

Style: Premium, data-first, like a BCG infographic`);

// ═══ PAGE 8: 90-DAY B2B ROADMAP ══════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.green);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("7. 90-Day B2B Launch Roadmap", LEFT, 15);
doc.fillColor("#6EE7B7").fontSize(9).font("Helvetica").text("Day by day kya karna hai — zero budget mein pehla corporate client kaise milega", LEFT, 37);
doc.y = 68;

const phases = [
  {
    title: "PHASE 1: Foundation (Days 1–30)", col: C.blue,
    tasks: [
      "Week 1: LinkedIn profile optimize + company page banao. 50 HR contacts connect karo per day",
      "Week 1: Canva se B2B one-pager banao (print + digital). Demo video record karo (3 min, screen record)",
      "Week 2: Cold email sequence set up (Apollo.io free). First 100 HR emails bhejo",
      "Week 2: WhatsApp Business setup + 5 message templates ready",
      "Week 3: Business portal demo account banao — real data ke saath (test company se)",
      "Week 3: LinkedIn pe 3 posts publish karo (educational, story, data)",
      "Week 4: 5 warm outreach — founders network se HR intro maango",
      "Week 4: First paid discovery call — even if free pilot — just get a company on board",
      "Target by Day 30: 1 corporate pilot signed (even free), 5 interested companies in pipeline",
    ]
  },
  {
    title: "PHASE 2: Traction (Days 31–60)", col: C.orange,
    tasks: [
      "Focus on pilot company: Make their HR manager a hero. Weekly reports. WhatsApp updates",
      "Document everything: Screenshots, health improvement data, HR feedback — case study material",
      "Referral ask: 'Do you know 2 other HR managers who face similar challenges?'",
      "LinkedIn: Post pilot progress (anonymized) — 'Week 3 update: Company X employees logged 4000 meals'",
      "Cold outreach: Scale to 500 companies total. Follow up on non-replies (Email 2 + Email 3)",
      "Partner outreach: Contact 3 HR consultants, 2 insurance brokers for referral agreement",
      "Attend 1 offline networking event. Have printed one-pagers ready",
      "Target by Day 60: 3-5 companies actively piloting. 1 paid conversion attempt",
    ]
  },
  {
    title: "PHASE 3: Revenue (Days 61–90)", col: C.green,
    tasks: [
      "Convert pilot companies: Present 30-day health improvement data → justify ₹X/employee/month",
      "Case study publish karo (with company permission) on LinkedIn — huge credibility boost",
      "Press outreach: YourStory, Inc42, Economic Times Startup — 'Corporate wellness startup Aorane signs 3 companies'",
      "Pricing experiment: Test ₹50/employee/month vs ₹99/employee/month to find sweet spot",
      "Scale outreach: Hire 1 part-time intern (₹5000/month) for LinkedIn outreach + email",
      "Insurance broker meeting: Propose white-label or referral deal to Loop Health / Plum",
      "Target by Day 90: ₹50,000–1,00,000 MRR from B2B. 5+ paying companies. Pipeline of 20+",
    ]
  },
];

phases.forEach(phase => {
  if (doc.y > 650) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 20).fill(phase.col);
  doc.fillColor(C.white).fontSize(10).font("Helvetica-Bold").text(phase.title, LEFT + 8, y + 5, { width: W - 16 });
  doc.y = y + 24;
  phase.tasks.forEach((t, i) => {
    const ty = doc.y;
    doc.rect(LEFT, ty, 20, 14).fill(phase.col + "33");
    doc.fillColor(phase.col).fontSize(7.5).font("Helvetica-Bold").text(String(i + 1), LEFT + 7, ty + 3);
    doc.fillColor(C.text).fontSize(8).font("Helvetica").text(t, LEFT + 24, ty + 2, { width: W - 24 });
    doc.y = ty + 16;
  });
  doc.moveDown(0.3);
});

sec("7.1 B2B KPIs to Track Weekly", C.navy);
const kpiCols = [W * 0.35, W * 0.25, W * 0.20, W * 0.20];
tRow(["Metric", "Week 4 Target", "Month 2 Target", "Month 3 Target"], kpiCols, true, C.navy);
const kpis = [
  ["LinkedIn connections (HR)", "200", "500", "1000"],
  ["Cold emails sent", "100", "400", "800"],
  ["Discovery calls booked", "3", "10", "20"],
  ["Active pilots", "1", "5", "10"],
  ["Paying companies", "0", "1-2", "5+"],
  ["MRR (B2B)", "₹0", "₹20,000", "₹75,000+"],
  ["Referrals received", "1", "3", "8"],
];
kpis.forEach((r, i) => tRow(r, kpiCols, false, i % 2 === 0 ? "#F0FDF4" : C.white));

// ═══ PAGE 9: PRICING ══════════════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.pink);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("8. B2B Pricing Strategy & Objection Handling", LEFT, 15);
doc.fillColor("#FBCFE8").fontSize(9).font("Helvetica").text("Kaise price karo, kya jawaab do jab woh zyada price bole", LEFT, 37);
doc.y = 68;

sec("8.1 Recommended B2B Pricing Tiers", C.dark);
const priceCols = [W * 0.22, W * 0.18, W * 0.18, W * 0.42];
tRow(["Tier", "Per Employee/Month", "Min. Seats", "What's Included"], priceCols, true, C.dark);
const prices = [
  ["Starter", "₹99", "10", "App access, basic tracking, weekly email report to HR"],
  ["Growth", "₹149", "25", "All tracking + AI food scan, monthly analytics dashboard, announcements"],
  ["Enterprise", "₹199", "100+", "All features + custom onboarding, dedicated support, API access, GSTIN invoice"],
  ["Free Pilot", "₹0 (30 days)", "Up to 50", "Full Growth features — for initial company acquisition only"],
];
prices.forEach((r, i) => tRow(r, priceCols, false, i % 2 === 0 ? "#FFF1F2" : C.white));

doc.moveDown(0.5);
sec("8.2 Common Objections & Responses", C.navy);
const objections = [
  {
    q: '"We already have a gym subscription / insurance — why pay again?"',
    a: "Insurance pays after illness. Aorane prevents it. Gym subscription tracks attendance — Aorane tracks actual health outcomes. Insurance companies are actually partnering with us because prevention reduces their claims.",
  },
  {
    q: '"Our employees won\'t use it / privacy concerns"',
    a: "Employees see their own data only. HR sees only aggregate, anonymized data — no individual stats. We use the same privacy model as Google Fit. And employee adoption averages 73% when company makes it part of wellness benefit, not a mandate.",
  },
  {
    q: '"We\'re a small company — this is not for us"',
    a: "Our Starter plan works from 10 employees — ₹990/month total. One employee's sick day costs ₹3,000–5,000 in lost productivity. We'll pay for ourselves in the first avoided sick day.",
  },
  {
    q: '"Can you show me data that this works?"',
    a: "Fair question — we're early. That's exactly why we offer a free 30-day pilot. You measure your own before/after. We give you the dashboard. No obligation. Worst case — you lose nothing.",
  },
  {
    q: '"We need to discuss with leadership / need approval"',
    a: "Absolutely — we can schedule a 20-min deck walkthrough for you + your CHRO/MD. I'll send a one-page ROI summary you can share internally. What's the best time this week?",
  },
];
objections.forEach(o => {
  if (doc.y > 710) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 12).fill(C.red + "15");
  doc.fillColor(C.red).fontSize(8).font("Helvetica-BoldOblique").text("❓ " + o.q, LEFT + 6, y + 2, { width: W - 10 });
  doc.y = y + 14;
  const ay = doc.y;
  doc.rect(LEFT, ay, W, doc.heightOfString(o.a, { width: W - 16, fontSize: 8 }) + 10).fill(C.green + "10");
  doc.rect(LEFT, ay, 3, doc.heightOfString(o.a, { width: W - 16, fontSize: 8 }) + 10).fill(C.green);
  doc.fillColor(C.text).fontSize(8).font("Helvetica").text("✅ " + o.a, LEFT + 8, ay + 4, { width: W - 16 });
  doc.y = ay + doc.heightOfString(o.a, { width: W - 16, fontSize: 8 }) + 14;
});

// ═══ FINAL PAGE ═══════════════════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.dark);
doc.rect(0, 0, 6, doc.page.height).fill(C.blue);
doc.circle(480, 150, 130).fill("#0d2040");
doc.circle(80, 600, 80).fill("#0d2040");

doc.fillColor(C.white).fontSize(24).font("Helvetica-Bold").text("B2B Strategy Summary", LEFT + 10, 80);
doc.fillColor(C.blue).fontSize(12).font("Helvetica").text("Yaad rakhne wali 5 cheezein", LEFT + 10, 112);
doc.moveTo(LEFT + 10, 128).lineTo(LEFT + W - 10, 128).strokeColor(C.blue).lineWidth(1.5).stroke(); doc.lineWidth(1);

const reminders = [
  { n: "1", t: "B2B mein speed nahi, trust matter karta hai", d: "Ek company ko 3 calls lagenge close karne mein. Normal hai. Pipeline bharo, follow-up systematic karo.", col: C.blue },
  { n: "2", t: "Pehla client sabse important hai", d: "Free do agar zaroori ho. Unka success story hi aapki marketing hai agla 6 months tak.", col: C.green },
  { n: "3", t: "LinkedIn + WhatsApp = India ka B2B pipeline", d: "Email response rates India mein low hain. WhatsApp pe reply rate 60%+ hai. Wahan focus karo.", col: C.orange },
  { n: "4", t: "ROI language bolo, wellness language nahi", d: "HR ko 'sick leave reduction' bolna > 'employee wellness'. CFO ko '₹X saved' bolna > 'health tracking'.", col: C.purple },
  { n: "5", t: "90 din mein 5 companies = viable business proof", d: "5 paying companies at ₹149/employee × 30 employees = ₹22,350/month. Enough to hire 1 person.", col: C.teal },
];
reminders.forEach((r, i) => {
  const y = 148 + i * 80;
  doc.rect(LEFT + 10, y, W - 10, 72).fill("#1a3358");
  doc.rect(LEFT + 10, y, 4, 72).fill(r.col);
  doc.rect(LEFT + 10, y, 36, 72).fill(r.col + "30");
  doc.fillColor(r.col).fontSize(22).font("Helvetica-Bold").text(r.n, LEFT + 16, y + 22);
  doc.fillColor(C.white).fontSize(10).font("Helvetica-Bold").text(r.t, LEFT + 54, y + 10, { width: W - 60 });
  doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica").text(r.d, LEFT + 54, y + 28, { width: W - 60 });
});

doc.fillColor("#475569").fontSize(8.5).font("Helvetica")
  .text("Aorane Health — B2B Marketing Strategy v1.0 — Confidential", LEFT + 10, 555, { width: W, align: "center" });

// ─── page numbers ─────────────────────────────────────────────────
const total = doc.bufferedPageRange().count;
for (let i = 1; i < total - 1; i++) {
  doc.switchToPage(i);
  const fy = doc.page.height - 28;
  doc.rect(0, fy - 4, doc.page.width, 32).fill("#F9FAFB");
  doc.moveTo(LEFT, fy - 4).lineTo(doc.page.width - LEFT, fy - 4).strokeColor("#E5E7EB").stroke();
  doc.fillColor(C.muted).fontSize(7.5).font("Helvetica")
    .text("Aorane Health — B2B Marketing Strategy — Confidential", LEFT, fy + 4, { width: W / 2 });
  doc.fillColor(C.muted).fontSize(7.5).text(`${i + 1} / ${total}`, LEFT, fy + 4, { width: W, align: "right" });
}

doc.end();
doc.on("end", () => {});

const s = require("fs").createWriteStream;
// stream already piped above — just wait for close event already set
process.stdout.write("");
