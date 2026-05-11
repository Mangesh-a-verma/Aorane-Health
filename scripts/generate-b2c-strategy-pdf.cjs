// Aorane B2C Marketing Strategy PDF
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "../exports/aorane-b2c-strategy.pdf");
const doc = new PDFDocument({ size: "A4", margin: 45, bufferPages: true });
doc.pipe(fs.createWriteStream(OUTPUT));

const C = {
  brand: "#E8622A", dark: "#0A1628", navy: "#0D2040",
  blue: "#3B82F6", green: "#10B981", purple: "#8B5CF6",
  orange: "#F59E0B", red: "#EF4444", gray: "#6B7280",
  white: "#FFFFFF", text: "#1F2937", muted: "#9CA3AF",
  teal: "#14B8A6", pink: "#EC4899", yellow: "#FCD34D",
  insta: "#E1306C", yt: "#FF0000", wa: "#25D366", tt: "#000000",
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
function promptBox(title, prompt, col = C.purple) {
  if (doc.y > 690) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 14).fill(col);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("🤖 AI PROMPT: " + title, LEFT + 6, y + 3, { width: W - 10 });
  doc.y = y + 16;
  const py = doc.y;
  const h = doc.heightOfString(prompt, { width: W - 16, fontSize: 8 }) + 14;
  doc.rect(LEFT, py, W, h).fill(col + "12");
  doc.fillColor("#1a1a2e").fontSize(8).font("Courier").text(prompt, LEFT + 8, py + 6, { width: W - 16 });
  doc.y = py + h + 4;
}
function divider() {
  doc.moveDown(0.2);
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + W, doc.y).strokeColor("#E5E7EB").stroke();
  doc.moveDown(0.2);
}
function platformBadge(name, color, x, y, w = 110) {
  doc.rect(x, y, w, 22).fill(color);
  doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold").text(name, x + 6, y + 6, { width: w - 12, align: "center" });
  return x + w + 6;
}

// ═══ COVER ═══════════════════════════════════════════════════════
doc.rect(0, 0, doc.page.width, doc.page.height).fill("#0a1628");
doc.rect(0, 0, 6, doc.page.height).fill(C.brand);
doc.rect(0, 0, doc.page.width, 5).fill(C.brand);
doc.circle(480, 200, 150).fill("#1a2a48");
doc.circle(60, 600, 100).fill("#1a2a48");
doc.circle(420, 680, 70).fill("#112036");

doc.fillColor(C.brand).fontSize(11).font("Helvetica-Bold").text("AORANE HEALTH PLATFORM", LEFT + 10, 80);
doc.fillColor(C.white).fontSize(34).font("Helvetica-Bold").text("B2C Marketing", LEFT + 10, 100);
doc.fillColor(C.brand).fontSize(34).font("Helvetica-Bold").text("Strategy 2025", LEFT + 10, 140);
doc.moveTo(LEFT + 10, 185).lineTo(LEFT + W - 10, 185).strokeColor(C.brand).lineWidth(2).stroke(); doc.lineWidth(1);
doc.fillColor("#94A3B8").fontSize(12).font("Helvetica")
  .text("Instagram • YouTube Shorts • WhatsApp • Reddit • Community Growth Playbook", LEFT + 10, 198);

const coverStats = [
  { v: "B2C", l: "Growth Focus", col: C.brand },
  { v: "₹0", l: "Budget Needed", col: C.green },
  { v: "12", l: "Channels Inside", col: C.purple },
  { v: "10K+", l: "First User Target", col: C.orange },
];
let cx = LEFT + 10;
coverStats.forEach(s => {
  doc.rect(cx, 235, 118, 60).fill("#1a3358");
  doc.rect(cx, 235, 118, 4).fill(s.col);
  doc.fillColor(s.col).fontSize(22).font("Helvetica-Bold").text(s.v, cx + 5, 250, { width: 108, align: "center" });
  doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica").text(s.l, cx + 5, 278, { width: 108, align: "center" });
  cx += 128;
});

doc.fillColor(C.white).fontSize(11).font("Helvetica-Bold").text("Target Platforms", LEFT + 10, 320);
let px = LEFT + 10;
[["Instagram", C.insta], ["YouTube", C.yt], ["WhatsApp", C.wa], ["LinkedIn", "#0A66C2"]].forEach(([n, c]) => {
  px = platformBadge(n, c, px, 340);
});
px = LEFT + 10;
[["Reddit", "#FF4500"], ["Twitter/X", "#1DA1F2"], ["Quora", "#B92B27"], ["Telegram", "#0088cc"]].forEach(([n, c]) => {
  px = platformBadge(n, c, px, 368);
});

doc.fillColor("#94A3B8").fontSize(9).font("Helvetica")
  .text("Target Audience: Urban Indians 22–42 • Health-conscious professionals • Fitness beginners • Working parents", LEFT + 10, 415);
doc.fillColor("#475569").fontSize(8).font("Helvetica")
  .text(`Version 1.0  •  ${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}  •  INTERNAL USE ONLY`, LEFT + 10, 720);

// ═══ PAGE 2: AUDIENCE + PERSONAS ══════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.brand);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("1. Target Audience & User Personas", LEFT, 15);
doc.fillColor(C.brand).fontSize(9).font("Helvetica").text("Exactly kisko target karna hai — unki language mein, unke channels pe", LEFT, 37);
doc.y = 68;

sec("1.1 Primary User Personas", C.dark);
const personas = [
  {
    name: "Raj — The Urban Professional (Primary Target)",
    age: "28–35", city: "Bangalore/Pune/Hyderabad/Delhi NCR",
    pain: "Eats outside 2x daily, sitting job, high stress, puts on weight easily, 'I'll start tomorrow' mindset",
    want: "Easy food tracking without counting calories manually. Wants to know if dal-makhani is healthy",
    channel: "Instagram (Reels), YouTube Shorts, WhatsApp from friends",
    hook: "'Scan your thali and know exactly what you ate — in 5 seconds'",
    col: C.blue
  },
  {
    name: "Priya — The Health-Conscious Mom (Strong Secondary)",
    age: "30–40", city: "Tier-1/2 cities, working mother",
    pain: "Worried about family nutrition, kids eating junk, husband skipping medicines, no time for doctor visits",
    want: "Family health tracking in one app, medicine reminders, kids nutrition",
    channel: "WhatsApp groups, Instagram, YouTube",
    hook: "'Track your entire family's health from one app — medicines, meals, everything'",
    col: C.pink
  },
  {
    name: "Arjun — The Fitness Beginner (Growth Segment)",
    age: "22–30", city: "All tier-1 cities, gym-going",
    pain: "Goes to gym but doesn't track nutrition. Doesn't know if he's eating enough protein",
    want: "Food tracking + exercise logging + progress — simple, not like MyFitnessPal (too complex)",
    channel: "YouTube fitness channels, Instagram gym content, Reddit r/india fitness",
    hook: "'Your complete fitness tracker — made for Indian diet, not American gym culture'",
    col: C.green
  },
  {
    name: "Sunita — The Blood Donor / NGO Worker (Community Angle)",
    age: "25–45", city: "Across India",
    pain: "Wants to donate blood but no easy system. Sees blood emergency requests on social media",
    want: "Be part of a network that helps in emergencies — health identity + donor card",
    channel: "WhatsApp groups, Facebook, Twitter/X for emergency share",
    hook: "'Register as blood donor. Get your Aorane Health ID. Be a hero when it matters.'",
    col: C.red
  },
];
personas.forEach(p => {
  if (doc.y > 690) np();
  const y = doc.y;
  const h = 80;
  doc.rect(LEFT, y, W, h).fill(p.col + "08").stroke(p.col + "40");
  doc.rect(LEFT, y, W, 16).fill(p.col + "30");
  doc.fillColor(p.col).fontSize(9).font("Helvetica-Bold").text(p.name, LEFT + 8, y + 4, { width: W - 16 });
  const cols = [{ label: "Age", val: p.age }, { label: "City", val: p.city }, { label: "Channel", val: p.channel }];
  cols.forEach((c, i) => {
    doc.fillColor(C.gray).fontSize(7.5).font("Helvetica-Bold").text(c.label + ":", LEFT + 8 + i * 170, y + 22);
    doc.fillColor(C.text).fontSize(7.5).font("Helvetica").text(c.val, LEFT + 35 + i * 170, y + 22, { width: 130, ellipsis: true });
  });
  doc.fillColor(C.red + "cc").fontSize(7.5).font("Helvetica-Bold").text("Pain:", LEFT + 8, y + 36);
  doc.fillColor(C.text).fontSize(7.5).font("Helvetica").text(p.pain, LEFT + 35, y + 36, { width: W - 40 });
  doc.fillColor(C.green + "cc").fontSize(7.5).font("Helvetica-Bold").text("Hook:", LEFT + 8, y + 53);
  doc.fillColor(C.text).fontSize(7.5).font("Helvetica-BoldOblique").text(p.hook, LEFT + 35, y + 53, { width: W - 40 });
  doc.y = y + h + 5;
});

// ═══ PAGE 3: INSTAGRAM STRATEGY ═══════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.insta);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("2. Instagram Strategy (Primary Channel)", LEFT, 15);
doc.fillColor("#FBCFE8").fontSize(9).font("Helvetica").text("Reels se viral growth • Carousel se saves • Stories se engagement • Zero budget", LEFT, 37);
doc.y = 68;

sec("2.1 Content Pillars (What to Post)", C.insta);
const pillars = [
  { name: "🍽️ Food Scan Demos (40% of content)", col: C.orange, items: ["Before/After thali scan — '200 cal ya 800?' reveal", "Street food scan series — 'Woh vada pav actually kitna healthy hai?'", "Office lunch scan series — 'Canteen food reality check'", "Sabzi/roti/dal nutrition — 'Ghar ka khaana health meter'"] },
  { name: "💡 Indian Health Facts (30% of content)", col: C.blue, items: ["'Why masala chai is actually healthier than you think'", "Myths vs Facts — 'Ghee bad hai? Science kya kehti hai'", "Micro-nutrition — 'Iron ki kami? Yeh 5 Indian foods khao'", "Seasonal tips — 'Monsoon mein yeh mat khao — yeh khao'"] },
  { name: "📊 Transformation Stories (20% of content)", col: C.green, items: ["User health journey (with permission or created persona)", "30-day challenge results — before/after health score", "Family story — 'Humne poore family ka health track kiya 1 month'", "Blood donor story — 'Mein Aorane se joined, 3 months baad pehli donation'"] },
  { name: "🎯 Product Feature Highlights (10% of content)", col: C.purple, items: ["Aorane ID card reveal — 'Mera health passport ready hai'", "Health score reveal — weekly score ke saath 'kya lagta hai?'", "Feature tutorial Reels — 30-sec feature walkthroughs", "B2B angle — 'Did you know your company can track your team?'"] },
];
pillars.forEach(p => {
  if (doc.y > 710) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 14).fill(p.col + "25");
  doc.rect(LEFT, y, 4, 14 + p.items.length * 12 + 4).fill(p.col);
  doc.fillColor(p.col).fontSize(8.5).font("Helvetica-Bold").text(p.name, LEFT + 10, y + 3, { width: W - 20 });
  doc.y = y + 16;
  p.items.forEach(item => {
    doc.fillColor(C.text).fontSize(8).font("Helvetica").text("→ " + item, LEFT + 14, doc.y, { width: W - 20 });
    doc.y += 12;
  });
  doc.moveDown(0.3);
});

sec("2.2 Reel Formats (Copy This Formula)", C.insta);
sub("Hook Formula for Every Reel (First 2 seconds decide everything)", C.brand);
[
  "SHOCK: 'Yeh biryani tumhe 1200 calories de rahi hai — ek step bhi nahi chalo barabar'",
  "QUESTION: 'Kya tumhe pata hai aaj tumne kitna protein khaya? 90% Indians ko nahi pata'",
  "REVEAL: '[Plate photo] → Scan karte hain → Nutrition reveal' — curiosity gap",
  "CHALLENGE: '7 din ka health challenge — join karo aaj. Comment '7' agar interested ho'",
].forEach(b => bul(b, C.brand, 8));

doc.moveDown(0.3);
promptBox("Instagram Reel Script (30 seconds) — Food Scan Demo",
`Write a 30-second Instagram Reel script for Aorane Health app.
Topic: AI Food Scan feature — scanning a plate of chole bhature

The Reel should have:
- 0-2 sec: Hook line (shocking stat about chole bhature calories)
- 2-15 sec: Screen recording narration (describe what to show on screen while scanning)
- 15-25 sec: Nutrition reveal moment + reaction + explanation
- 25-30 sec: CTA — "Link in bio to download free"

Style: Conversational, Hinglish (60% Hindi, 40% English), friendly tone like talking to a friend
Include: Suggested on-screen text overlays and emoji placements
Include: Background music suggestion (trending audio type)
Target: Urban Indian 22-35 year olds`);

promptBox("Instagram Carousel — 8 slides (Health Myth Busting)", C.green,
`Create an 8-slide Instagram carousel for Aorane Health.
Topic: "8 Indian food myths that are ruining your health"

For each slide:
- Myth statement (bold, surprising — make people disagree first)
- The truth (with explanation based on Indian diet science)
- Relevant Indian food example
- Visual suggestion (what photo/illustration to show)

Slide 8: CTA — "Track your Indian diet with Aorane AI" + Download prompt

Style: High contrast design, orange (#E8622A) and dark navy (#0A1628), minimal text, BIG typography
Make myths controversial enough to generate saves and shares`);

// ═══ PAGE 4: YOUTUBE SHORTS + REELS ═══════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.yt);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("3. YouTube Shorts + Long-Form Strategy", LEFT, 15);
doc.fillColor("#FCA5A5").fontSize(9).font("Helvetica").text("India ka 2nd biggest search engine — health queries yahan sabse zyada aate hain", LEFT, 37);
doc.y = 68;

sec("3.1 YouTube Shorts (0–60 sec) — 3 per week target", C.yt);
const shortIdeas = [
  "\"I scanned every meal for 7 days — yeh hua\" → Personal experiment format. Highest watch time.",
  "\"Yeh 5 cheezein khao, diabetes risk 40% kum karo\" → Tips format. High search traffic.",
  "\"Street food scan series\" → Ep 1: Golgappa, Ep 2: Vada Pav, Ep 3: Pav Bhaji — serial content = subscribers",
  "\"Ek mahine mein 4kg kaise kamaya — bina gym\" → Transformation mini-series. Very high CTR.",
  "\"Blood group B+ ke liye best Indian diet\" → Niche targeting. Very shareable in own community.",
  "\"App demo: 30 second health report\" → Product discovery. Converts viewers to downloads.",
  "\"90% Indians iron deficient hain — yeh khao\" → Educational hook with Indian solution",
];
shortIdeas.forEach(b => bul(b, C.yt));

sec("3.2 Long-Form YouTube (8–15 min) — 2 per month target", C.dark);
const longFormIdeas = [
  { t: "\"Mein 30 din tak Aorane use kiya — honest review\"", d: "Founder ka personal journey video. Shows authenticity, drives downloads. 8-10 min." },
  { t: "\"India ka complete health tracking guide 2025\"", d: "SEO gold. Ranks for 'health tracking app India', 'best health app India'. 12-15 min." },
  { t: "\"Corporate wellness kya hota hai — HR Manager guide\"", d: "B2B awareness via B2C channel. HRs also watch YouTube. 10 min." },
  { t: "\"Blood donation in India — Complete guide 2025\"", d: "Targets Aorane blood bank feature. High social sharing. Evergreen content." },
  { t: "\"Indian diet aur weight loss — science based guide\"", d: "High search volume. Positions Aorane as health authority. 15 min." },
];
longFormIdeas.forEach(l => {
  if (doc.y > 740) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 28).fill("#FEF2F2").stroke(C.yt + "40");
  doc.fillColor(C.yt).fontSize(8.5).font("Helvetica-Bold").text(l.t, LEFT + 8, y + 4, { width: W - 16 });
  doc.fillColor(C.gray).fontSize(8).font("Helvetica").text(l.d, LEFT + 8, y + 16, { width: W - 16 });
  doc.y = y + 32;
});

sec("3.3 YouTube SEO Strategy (Organic Discovery)", C.green);
sub("Hindi keywords to target in titles/descriptions", C.green);
[
  '"Health app India" (18K monthly searches) — "Best free health app India 2025"',
  '"Indian diet plan" (45K monthly searches) — tie every video to Indian food',
  '"Blood donation near me" (22K monthly) — Blood bank feature content',
  '"Calorie count Indian food" (12K monthly) — Food scan demo videos',
  '"Weight loss for Indians" (55K monthly) — Transformation content',
  '"Health tracking app Hindi" — underserved, low competition',
].forEach(b => bul(b, C.green, 8));

doc.moveDown(0.3);
promptBox("YouTube Short Script (60 seconds) — Transformation hook",
`Write a 60-second YouTube Short script for Aorane Health app.
Topic: "Mein 30 din tak apna Indian khana track kiya — yeh hua"

Script must have:
- 0-5 sec: Visual hook — show before/after body change or health score
- 5-20 sec: The story — what I was doing wrong before
- 20-45 sec: How Aorane helped — show specific features (AI scan, health score, suggestions)
- 45-55 sec: 30-day result — what changed concretely
- 55-60 sec: CTA — download link + comment question

Language: 70% Hindi, 30% English (pure Hinglish)
Tone: Genuine, like a friend sharing advice — NOT salesy
Add: [B-ROLL] suggestions at each point
Add: Thumbnail text suggestion (max 5 words, Hindi or Hinglish)`);

// ═══ PAGE 5: WHATSAPP + TELEGRAM ══════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.wa);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("4. WhatsApp & Telegram Growth (Highest Conversion)", LEFT, 15);
doc.fillColor("#6EE7B7").fontSize(9).font("Helvetica").text("India mein 500M+ WhatsApp users — aapka most powerful B2C channel", LEFT, 37);
doc.y = 68;

sec("4.1 WhatsApp B2C Strategy", C.wa);
sub("WhatsApp Status as Content Channel (Free, No Algorithm)", C.wa);
[
  "Daily health tip WhatsApp Status — short text + image (Canva se 5 min mein banao)",
  "Food scan result share karo — 'Aaj ka lunch scan: Dosa 280 cal, healthy tha!'",
  "Countdown status during health challenges — '3 days left to join 7-day clean eating'",
  "Behind-the-scenes — app development updates, new features preview",
  "Poll status — 'Aaj kya khaoge? A) Roti-dal B) Rice-rajma' → engage and educate",
].forEach(b => bul(b, C.wa));

sub("WhatsApp Community Strategy (New WhatsApp Feature)", C.green);
[
  "Aorane Health Community banao — up to 5000 members",
  "Sub-groups within community: Weight Loss, Fitness, Family Health, Blood Donors",
  "Daily health tip at 7AM + evening activity reminder at 6PM",
  "Weekly health challenges posted in community — screenshot results",
  "Weekly live Q&A on WhatsApp Community — health questions answer karo",
  "Community mein link dalte raho YouTube/Instagram content ka",
].forEach(b => bul(b, C.green));

sub("WhatsApp Referral Mechanism (Viral Growth Engine)", C.blue);
[
  "In-app referral: 'Invite a friend → both get 1 month free Pro trial'",
  "Referral message pre-written: 'Yaar mein Aorane use kar raha hoon health track karne ke liye. Teri bhi photo scan karta hai. Try karo free mein: [link]'",
  "Family plan upsell: 'Add family members → they get free until you upgrade to Family plan'",
  "Blood donor referral: 'Invite 3 blood donors → get premium Donor badge on Aorane ID'",
].forEach(b => bul(b, C.blue));

sec("4.2 Telegram Channel Strategy", "#0088cc");
[
  "Telegram channel: 'Aorane Health Daily Tips' — push health content to subscribers",
  "Daily automated tip (use our own WhatsApp bot to also send to Telegram)",
  "Exclusive Telegram content: Early access to new features, beta testing invites",
  "Telegram group for power users — feedback, bugs, feature requests",
  "Cross-promote: WhatsApp → Telegram → Instagram → YouTube (content repurposing funnel)",
].forEach(b => bul(b, "#0088cc"));

promptBox("WhatsApp Health Tip Series — 7-day content calendar (ChatGPT)",
`Create a 7-day WhatsApp health tip content calendar for Aorane Health app.

Each day's content should include:
1. Main message (max 60 words, Hinglish)
2. Image description (for Canva design brief)
3. 1 engagement hook (question or poll idea)
4. Relevant Aorane feature to mention casually

Topics to cover across the week:
- Monday: Week motivation + health goal setting
- Tuesday: Indian food nutrition fact
- Wednesday: Hydration reminder + science
- Thursday: Exercise tip (Indian context — walking, yoga)
- Friday: Weekend healthy eating guide
- Saturday: Family health tip
- Sunday: Weekly reflection + Aorane score check-in

Tone: Warm, encouraging, like a knowledgeable friend. Hindi-first.`);

// ═══ PAGE 6: REDDIT + QUORA + COMMUNITIES ═════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill("#FF4500");
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("5. Reddit, Quora & Online Communities", LEFT, 15);
doc.fillColor("#FED7AA").fontSize(9).font("Helvetica").text("Free organic discovery — Indians actively search for health solutions here", LEFT, 37);
doc.y = 68;

sec("5.1 Reddit Strategy (r/india + health subreddits)", "#FF4500");
sub("Subreddits to be active in", "#FF4500");
const subreddits = [
  ["r/india", "1.3M members", "Indian lifestyle posts — health, food, urban issues. Share stories, NOT ads."],
  ["r/bangalore / r/mumbai etc", "200K–500K each", "City-specific health challenges. Blood donor posts here very viral."],
  ["r/IndianFood", "180K members", "Share nutrition insights from AI scans. Educational posts only."],
  ["r/diet", "500K members", "Indian diet advice posts. Answer questions, mention Aorane naturally."],
  ["r/loseit", "3.7M members", "Weight loss community. Indian-specific tips stand out here."],
  ["r/ADHD_India / r/anxiety_india", "Small but growing", "Mental health + stress content. Aorane's stress tracking fits here."],
  ["r/medicaladvice (informational only)", "Massive", "Never diagnose — share Aorane as tracking tool, not medical device."],
];
const redCols = [W * 0.28, W * 0.18, W * 0.54];
tRow(["Subreddit", "Size", "Strategy"], redCols, true, "#FF4500");
subreddits.forEach((r, i) => tRow(r, redCols, false, i % 2 === 0 ? "#FFF7F0" : C.white));

sub("Reddit Post Formats That Work", C.brand);
[
  "Story post: 'I tracked every Indian meal for 30 days — here's what I learned' (long, honest, share results with screenshots)",
  "Question answer: 'Asked Aorane AI what's healthiest at McDonald's India — the answer surprised me'",
  "Community help: 'Blood type O+ donors in Bangalore needed — Aorane connect kar sakta hai' (genuine, not spammy)",
  "Debate starter: 'Is ghee healthier than refined oil? I got AI to analyze — interesting results'",
  "NEVER spam or self-promote directly — get banned. Always provide value first, mention Aorane as tool.",
].forEach(b => bul(b, "#FF4500"));

sec("5.2 Quora Strategy (High SEO Value)", "#B92B27");
sub("High-value questions to answer (search these exact queries)", "#B92B27");
const quoraQs = [
  '"Best health app for Indians" — Answer comprehensively, mention Aorane at end',
  '"How to track calories in Indian food?" — Detailed answer + Aorane scan feature mention',
  '"Best blood donor app in India 2025" — Direct answer, Aorane is relevant',
  '"How to reduce stress naturally India" — Full answer + Aorane stress tracking at end',
  '"Corporate wellness companies India" — B2B angle answer + business.aorane.in',
  '"Is HealthifyMe worth it?" — Compare objectively, show where Aorane is different',
  '"How to maintain health records digitally India" — Aorane ID + health report feature',
];
quoraQs.forEach(b => bul(b, "#B92B27"));

sec("5.3 Niche Community Platforms", C.purple);
const communities = [
  { name: "ShareChat / Moj (Hindi users)", strategy: "Health content in pure Hindi — massive Tier-2 reach, almost no health app competition yet" },
  { name: "Josh (Short video)", strategy: "Same Reels repurposed in Hindi — healthy Indian food content, motivational health" },
  { name: "Koo (Twitter alternative)", strategy: "Health discussions in Hindi — doctors, nutritionists respond here" },
  { name: "Facebook Groups (Indian Health)", strategy: "'Indian Weight Loss Journey' (2M members), 'Healthy India' groups — share posts, answer questions" },
  { name: "Discord Servers (Young Indians)", strategy: "Gaming + study servers — young urban users, surprise health content angle works here" },
  { name: "Substack / Newsletter swap", strategy: "Partner with Indian health newsletters (Healthshots, Possible, etc.) for cross-promotion" },
];
communities.forEach(c => {
  if (doc.y > 755) np();
  const y = doc.y;
  doc.rect(LEFT, y, W * 0.32, 22).fill(C.purple + "20").stroke(C.purple + "40");
  doc.fillColor(C.purple).fontSize(8.5).font("Helvetica-Bold").text(c.name, LEFT + 6, y + 6, { width: W * 0.32 - 10 });
  doc.fillColor(C.text).fontSize(8).font("Helvetica").text(c.strategy, LEFT + W * 0.32 + 6, y + 6, { width: W * 0.66 });
  doc.y = y + 26;
});

// ═══ PAGE 7: SEO + INFLUENCER ══════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.teal);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("6. SEO + Micro-Influencer Strategy (Zero Cost)", LEFT, 15);
doc.fillColor("#99F6E4").fontSize(9).font("Helvetica").text("Long-term organic growth engine — works while you sleep", LEFT, 37);
doc.y = 68;

sec("6.1 App Store Optimization (ASO) — Must Do First", C.teal);
[
  "Title: 'Aorane: AI Health & Diet Tracker' (keyword-first)",
  "Subtitle: 'Indian Food Scanner, Blood Bank, Health Score' (3 keyword clusters)",
  "Description: First 3 lines most important — lead with AI food scan for Indian meals",
  "Screenshots: Show Aorane ID card (unique), food scan result, health score — in order",
  "Preview video: 30-sec demo — food scan → health score → Aorane ID reveal",
  "Keywords field: 'indian diet tracker, health app hindi, calorie counter india, blood donor app'",
  "Ratings: Ask first 100 users explicitly for 5-star review in WhatsApp community",
].forEach(b => bul(b, C.teal));

sec("6.2 Micro-Influencer Outreach (Barter/Zero Cost)", C.orange);
doc.fillColor(C.text).fontSize(8.5).font("Helvetica")
  .text("Mega influencers cost ₹5-20 lakh per post. Micro-influencers (5K–100K followers) give better ROI for zero cost through barter:", LEFT, doc.y, { width: W });
doc.moveDown(0.3);

const influencerTypes = [
  { type: "Fitness Micro-influencers (10K–50K followers)", col: C.orange, where: "Instagram, YouTube", offer: "Free Pro account for 6 months in exchange for 3 honest review posts/reels", find: "Search '#IndianFitness #FitIndia #IndianDiet' on Instagram — DM top 50 profiles under 50K" },
  { type: "Mom bloggers / Parenting accounts", col: C.pink, where: "Instagram, YouTube, Blogs", offer: "Free Family plan + feature their family story on Aorane social media", find: "'Indian mom blogger' on YouTube, '#IndianMomLife' on Instagram" },
  { type: "Nutritionists / Dietitians (verified = trust)", col: C.green, where: "Instagram, Practo listings", offer: "Free Pro + help them create client tracking system using Aorane", find: "Search 'nutritionist india' on Instagram, Practo practitioner list" },
  { type: "Blood donor NGOs / Community leaders", col: C.red, where: "WhatsApp, Facebook, Twitter", offer: "Free platform to manage their blood donor community + social media shoutout", find: "Sankalp India Foundation, IIT blood donation clubs, NCC, NSS groups" },
  { type: "Startup / Tech content creators", col: C.blue, where: "YouTube, LinkedIn, Twitter", offer: "'India's first AI health platform' story angle — they love startup stories", find: "Nikhil Kamath ecosystem content, Wint Wealth audience — educated, urban" },
];
influencerTypes.forEach(inf => {
  if (doc.y > 710) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 50).fill(inf.col + "08").stroke(inf.col + "40");
  doc.rect(LEFT, y, 4, 50).fill(inf.col);
  doc.fillColor(inf.col).fontSize(9).font("Helvetica-Bold").text(inf.type, LEFT + 10, y + 4, { width: W - 16 });
  doc.fillColor(C.gray).fontSize(7.5).font("Helvetica").text("Platform: " + inf.where + "  |  ", LEFT + 10, y + 17);
  doc.fillColor(C.text).fontSize(7.5).text("Offer: " + inf.offer, LEFT + 10, y + 29, { width: W - 20 });
  doc.fillColor(C.text).fontSize(7.5).text("Find them: " + inf.find, LEFT + 10, y + 40, { width: W - 20 });
  doc.y = y + 54;
});

doc.moveDown(0.3);
promptBox("Micro-Influencer DM Script — Instagram/Email",
`Write a DM script to send to fitness micro-influencers on Instagram for Aorane Health.

Context:
- They have 15K–40K followers in Indian fitness/health niche
- We want them to try Aorane for free and share honest experience
- We're offering: Free Pro account (₹999/month value) for 6 months

The DM should:
1. Open by acknowledging their specific content (leave a [SPECIFIC CONTENT COMPLIMENT] placeholder)
2. Be honest about being a startup — not pretend to be big
3. Explain the barter clearly in 2 sentences
4. Make the ask super easy (just "try it for free, post if you like it")
5. Include a soft deadline (5 slots left this month)
Length: Under 120 words. No marketing buzzwords. Feel like a genuine human message.`);

// ═══ PAGE 8: VIRAL CAMPAIGNS ══════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.purple);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("7. Viral Campaigns & Challenges (Organic Amplification)", LEFT, 15);
doc.fillColor("#C4B5FD").fontSize(9).font("Helvetica").text("Campaigns jo apne aap share hon — bina ek rupee kharch kiye", LEFT, 37);
doc.y = 68;

sec("7.1 Campaign Ideas (Ready to Execute)", C.purple);
const campaigns = [
  {
    name: "#AoraneIDChallenge — Share Your Health Passport",
    desc: "Users apna Aorane ID card screenshot share karein Instagram/Twitter pe. 'Mera Health Passport ready hai — tera kab?' Viral because everyone loves showing off unique IDs.",
    mechanic: "Download → Get unique Aorane ID → Screenshot card → Post with hashtag → Tag 3 friends",
    platform: "Instagram, Twitter/X", col: C.brand
  },
  {
    name: "#ScanYourThali — Indian Food Transparency Movement",
    desc: "Daily thali ka AI scan result share karo. 'Aaj ka lunch: 650 cal, 28g protein. Kya lag raha hai?' Creates UGC and positions Aorane as authority on Indian nutrition.",
    mechanic: "Scan meal → Share result screenshot → Hashtag + tag Aorane → Win weekly prize (free Pro month)",
    platform: "Instagram Reels, WhatsApp Status", col: C.orange
  },
  {
    name: "#30DinKiZindagi — 30-Day Health Transformation",
    desc: "30-day public health challenge. Daily app se check-in. Har din ek task (water, steps, scan meals). Weekly community leaderboard. Creates habit + public accountability.",
    mechanic: "Join challenge → Daily Aorane check-in → Weekly health score milestone → Share wins",
    platform: "WhatsApp Community, Instagram, YouTube", col: C.green
  },
  {
    name: "#BloodHero — Donor Registration Drive",
    desc: "Blood donor registration + awareness campaign. Partner with colleges, NCC, hospitals. 'Register as donor, get Blood Hero badge on Aorane ID.' Emotionally resonant — goes viral naturally.",
    mechanic: "Register on Aorane → Complete profile → Get Blood Hero verified badge → Share certificate",
    platform: "Twitter/X, WhatsApp, LinkedIn", col: C.red
  },
  {
    name: "#AoraneFamily — Family Health Challenge",
    desc: "Invite family members to track health together. 'Hamare family ne 1 hafte mein 14,000 steps liye — tumhari family ne?' Creates organic word-of-mouth within families.",
    mechanic: "Create family group → 7-day step challenge → Share family leaderboard screenshot",
    platform: "WhatsApp, Instagram, Facebook", col: C.blue
  },
];
campaigns.forEach(camp => {
  if (doc.y > 700) np();
  const y = doc.y;
  doc.rect(LEFT, y, W, 58).fill(camp.col + "08").stroke(camp.col + "40");
  doc.rect(LEFT, y, W, 14).fill(camp.col + "25");
  doc.fillColor(camp.col).fontSize(9).font("Helvetica-Bold").text(camp.name, LEFT + 8, y + 3, { width: W - 16 });
  doc.fillColor(C.text).fontSize(8).font("Helvetica").text(camp.desc, LEFT + 8, y + 18, { width: W - 16 });
  doc.fillColor(camp.col).fontSize(7.5).font("Helvetica-Bold").text("Flow: ", LEFT + 8, y + 40);
  doc.fillColor(C.text).fontSize(7.5).font("Helvetica").text(camp.mechanic, LEFT + 30, y + 40, { width: W * 0.6 });
  doc.fillColor(C.gray).fontSize(7.5).text("Platform: " + camp.platform, LEFT + W * 0.65, y + 40);
  doc.y = y + 62;
});

// ═══ PAGE 9: CONTENT CALENDAR ══════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.brand);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("8. Weekly Content Calendar & Production System", LEFT, 15);
doc.fillColor("#FED7AA").fontSize(9).font("Helvetica").text("Ek person bhi yeh manage kar sakta hai — 2-3 hours per day", LEFT, 37);
doc.y = 68;

sec("8.1 Weekly Content Schedule", C.dark);
const calendar = [
  ["Monday", "LinkedIn post (educational, B2B angle)", "Instagram Story (health tip)", "WhatsApp Status", "Email/DM outreach: 10 contacts"],
  ["Tuesday", "Instagram Reel (food scan demo)", "YouTube Short upload", "Reddit post (r/india or relevant sub)", ""],
  ["Wednesday", "LinkedIn carousel (7 slides)", "Instagram carousel repurpose", "Quora answer (2 health questions)", "WhatsApp Community tip"],
  ["Thursday", "YouTube Short (health fact)", "Instagram Story (poll/Q&A)", "Twitter/X thread (3 tweets)", "Influencer DM: 5 new"],
  ["Friday", "Instagram Reel (transformation/story)", "LinkedIn story post", "Reddit comment engagement", "Week review + next week plan"],
  ["Saturday", "Behind-the-scenes Story (app update)", "WhatsApp Community engagement", "Reply to all comments/DMs", "Batch create next week content"],
  ["Sunday", "Rest / Batch filming day", "Schedule posts for week", "Community Q&A", "Analytics review"],
];
const calCols = [W * 0.14, W * 0.26, W * 0.22, W * 0.22, W * 0.16];
tRow(["Day", "Primary Platform", "Secondary", "Community", "Outreach"], calCols, true, C.dark);
calendar.forEach((r, i) => tRow(r, calCols, false, i % 2 === 0 ? "#FFFBEB" : C.white));

doc.moveDown(0.5);
sec("8.2 Content Production System (Solo / 2-Person Team)", C.navy);
sub("Tool Stack (All Free)", C.blue);
const toolStack = [
  ["Record", "Phone camera (any decent Android/iPhone)", "Natural light, simple background"],
  ["Edit video", "CapCut app (free)", "Auto captions, trending sounds, speed ramps"],
  ["Graphics", "Canva.com (free)", "Pre-made templates — customize with brand colors"],
  ["Write captions", "ChatGPT (free)", "Paste our prompts from this PDF"],
  ["Schedule posts", "Meta Business Suite (free)", "Schedule Instagram + Facebook posts"],
  ["Analytics", "Instagram Insights (free)", "Check top posts, best time to post"],
  ["Research trends", "Instagram Reels trending audio", "Use trending audio for +40% reach"],
];
const toolCols = [W * 0.20, W * 0.30, W * 0.50];
tRow(["Task", "Tool (Free)", "Quick Tip"], toolCols, true, C.navy);
toolStack.forEach((r, i) => tRow(r, toolCols, false, i % 2 === 0 ? "#EFF6FF" : C.white));

doc.moveDown(0.4);
sec("8.3 Batch Content Creation System", C.dark);
[
  "Sunday = Batch day: 4-5 Reels script karo, film karo, edit karo — week ka content ek din mein",
  "30 Canva templates banao ek baar — phir sirf text/image change karo har post ke liye",
  "1 long YouTube video = 5 Shorts + 3 Instagram clips + 2 LinkedIn posts = maximum output",
  "Repurposing rule: Har piece of content 4 platforms pe 4 formats mein jaye — waste nothing",
  "User-generated content collect karo — screenshot + story tag = free content",
].forEach(b => bul(b));

promptBox("Batch Content Brief — 1 month Instagram content in one prompt",
`Act as a content strategist for Aorane Health — AI-powered Indian health app.

Create a 30-day Instagram content calendar with these constraints:
- Budget: ₹0 (no paid ads, no paid creators)
- Team: 1 person, max 2 hours/day for content
- Goal: 1000 followers in 30 days from 0

For each week (7 days), provide:
1. Theme for the week
2. 3 Reels ideas (hook + 3 key points + CTA)
3. 2 Carousel ideas (topic + 6 slide outline)
4. 2 Story ideas (interactive — poll/quiz/Q&A)

Rules:
- All content must be Indian-specific (food, context, language)
- Hinglish is preferred over pure English
- Every Reel must start with a controversial or surprising Indian health fact
- At least 2 pieces per week should mention Aorane naturally (not as an ad)`);

// ═══ PAGE 10: 90-DAY ROADMAP B2C ══════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, 55).fill(C.dark);
doc.rect(0, 0, 6, 55).fill(C.green);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("9. 90-Day B2C Growth Roadmap", LEFT, 15);
doc.fillColor("#6EE7B7").fontSize(9).font("Helvetica").text("Zero se 10,000 users ka realistic plan — platform by platform", LEFT, 37);
doc.y = 68;

const b2cPhases = [
  {
    title: "PHASE 1: Foundations (Days 1–30) — Build presence, 500 users target",
    col: C.blue,
    tasks: [
      "Day 1-3: Instagram, YouTube, WhatsApp Business account setup + profile optimization",
      "Day 4-7: Canva se 30 templates banao (10 educational, 10 food scan, 10 motivational)",
      "Day 8-14: Film 8 Reels in one batch session — food scan demos + health facts",
      "Day 15: WhatsApp Community launch + invite all contacts manually (50+ seed members)",
      "Day 16-20: Reddit + Quora accounts setup. First 5 helpful answers on health questions",
      "Day 21-25: Contact 20 micro-influencers with barter offer. 2-3 confirmations expected",
      "Day 26-28: #ScanYourThali campaign launch — seed it with your own posts first",
      "Day 29-30: Analyze first month data. Top 3 performing content types identify karo.",
      "Target: 500 downloads, 1000 Instagram followers, 300 WhatsApp community members",
    ]
  },
  {
    title: "PHASE 2: Momentum (Days 31–60) — 2,500 users target",
    col: C.orange,
    tasks: [
      "Micro-influencer content goes live — amplify with your own reshares and engagement",
      "Double down on whatever worked in Phase 1 — data-driven content decisions",
      "#30DinKiZindagi challenge launch — WhatsApp Community + Instagram",
      "YouTube channel — first long-form video publish (8-10 min honest review)",
      "Referral mechanic in-app activate: 'Invite 2 friends → 1 month free Pro'",
      "Reddit campaign: Share 30-day transformation story (genuine data from beta users)",
      "First PR attempt: Submit Aorane story to YourStory, Entrackr, Inc42 (free submissions)",
      "Target: 2500 downloads, 3000 Instagram, 1000+ WhatsApp community",
    ]
  },
  {
    title: "PHASE 3: Acceleration (Days 61–90) — 10,000 users target",
    col: C.green,
    tasks: [
      "#AoraneIDChallenge launch — coordinate with micro-influencers to post same day",
      "Blood Donor campaign — partner with 1 college blood donation club for credibility",
      "First press release or startup story accepted by YourStory or Inc42",
      "Paid boost (optional, ₹2000-5000): Boost 1 viral Reel to 22-35 age urban India",
      "Family plan upsell campaign — 'Invite family, track together' content series",
      "Corporate angle: Some individual users will be from corporates — offer them org enrollment",
      "App update announcement campaign — new feature Reel always gets high reach",
      "Target: 10,000 downloads, 8K Instagram, 3K WhatsApp community, 200 Pro subscribers",
    ]
  },
];
b2cPhases.forEach(phase => {
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

sec("9.1 B2C KPIs to Track Weekly", C.navy);
const kpiCols = [W * 0.35, W * 0.22, W * 0.22, W * 0.21];
tRow(["Metric", "Month 1 Target", "Month 2 Target", "Month 3 Target"], kpiCols, true, C.navy);
const b2cKpis = [
  ["App Downloads", "500", "2,500", "10,000"],
  ["Instagram Followers", "1,000", "3,000", "8,000"],
  ["WhatsApp Community", "300", "1,000", "3,000"],
  ["YouTube Subscribers", "100", "400", "1,500"],
  ["Weekly Active Users (WAU)", "200", "1,000", "4,000"],
  ["Pro Subscribers (paid)", "10", "50", "200"],
  ["Referral installs", "50", "300", "1,500"],
  ["UGC posts (#AoraneID etc)", "20", "100", "500"],
];
b2cKpis.forEach((r, i) => tRow(r, kpiCols, false, i % 2 === 0 ? "#F0FDF4" : C.white));

// ═══ FINAL PAGE ═══════════════════════════════════════════════════
np();
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.dark);
doc.rect(0, 0, 6, doc.page.height).fill(C.brand);
doc.circle(480, 200, 150).fill("#1a2a48");
doc.circle(60, 620, 90).fill("#1a2a48");

doc.fillColor(C.white).fontSize(24).font("Helvetica-Bold").text("B2C Strategy Summary", LEFT + 10, 80);
doc.fillColor(C.brand).fontSize(12).font("Helvetica").text("Yaad rakhne wali 6 cheezein", LEFT + 10, 112);
doc.moveTo(LEFT + 10, 128).lineTo(LEFT + W - 10, 128).strokeColor(C.brand).lineWidth(1.5).stroke(); doc.lineWidth(1);

const reminders = [
  { t: "Algorithm nahi, human connection target karo", d: "Viral karne ki koshish mat karo — genuine problem solve karo Indian users ke liye. Virality follows.", col: C.blue },
  { t: "AI food scan = aapka biggest B2C hook", d: "Yeh feature show karo har video mein. 'Indian thali ka AI scan' — koi nahi karta yeh aur yahi aapka moat hai.", col: C.orange },
  { t: "Hindi mein bolo, dil se bolo", d: "Pure English content India mein Tier-2 tak nahi pohunchta. Hinglish + genuine tone = 3x engagement.", col: C.green },
  { t: "Community > Followers", d: "1000 engaged WhatsApp community members > 50,000 passive Instagram followers. Build the community first.", col: C.purple },
  { t: "Batch banao, consistent raho", d: "Ek viral post nahi chahiye — 30 consistent posts chahiye. Consistency beats virality in long term.", col: C.teal },
  { t: "B2C users B2B leads bhi hain", d: "Har ek individual user potentially ek HR manager ya company founder hai. Mobile se corporate path.", col: C.brand },
];
reminders.forEach((r, i) => {
  const y = 148 + i * 72;
  doc.rect(LEFT + 10, y, W - 10, 64).fill("#1a3358");
  doc.rect(LEFT + 10, y, 4, 64).fill(r.col);
  doc.fillColor(r.col).fontSize(9.5).font("Helvetica-Bold").text(r.t, LEFT + 22, y + 8, { width: W - 28 });
  doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica").text(r.d, LEFT + 22, y + 26, { width: W - 28 });
  doc.fillColor(r.col + "50").fontSize(36).font("Helvetica-Bold").text(String(i + 1), LEFT + W - 38, y + 14);
});

doc.fillColor("#475569").fontSize(8.5).font("Helvetica")
  .text("Aorane Health — B2C Marketing Strategy v1.0 — Confidential", LEFT + 10, 590, { width: W, align: "center" });

// ─── page numbers ─────────────────────────────────────────────────
const total = doc.bufferedPageRange().count;
for (let i = 1; i < total - 1; i++) {
  doc.switchToPage(i);
  const fy = doc.page.height - 28;
  doc.rect(0, fy - 4, doc.page.width, 32).fill("#F9FAFB");
  doc.moveTo(LEFT, fy - 4).lineTo(doc.page.width - LEFT, fy - 4).strokeColor("#E5E7EB").stroke();
  doc.fillColor(C.muted).fontSize(7.5).font("Helvetica")
    .text("Aorane Health — B2C Marketing Strategy — Confidential", LEFT, fy + 4, { width: W / 2 });
  doc.fillColor(C.muted).fontSize(7.5).text(`${i + 1} / ${total}`, LEFT, fy + 4, { width: W, align: "right" });
}

doc.end();
