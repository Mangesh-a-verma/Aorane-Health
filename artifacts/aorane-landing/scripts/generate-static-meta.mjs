// scripts/generate-static-meta.mjs
//
// Problem this solves: this is a client-side-only Vite/React SPA. All routes
// serve the exact same dist/public/index.html at the server level (see
// vercel.json's catch-all rewrite), and each page's <title>/<meta> tags are
// only set client-side via react-helmet-async AFTER the JS bundle loads and
// runs. Crawlers that don't execute JavaScript (Bing, LinkedIn's scraper,
// WhatsApp/Telegram link previews, many AI crawlers like GPTBot/PerplexityBot)
// never see the correct per-page title, description, or OG image — they only
// ever see the homepage's generic ones, no matter which URL was requested.
//
// Fix (without a full SSR migration): after `vite build`, for each known
// static route, copy the built index.html into a same-named subfolder and
// rewrite just the <title>/<meta name="description">/<meta property="og:*">/
// <link rel="canonical"> tags to match that page's real content (the same
// values already used in each page's <Helmet> block). vercel.json is updated
// to route each of these paths to its dedicated file instead of the generic
// catch-all. The React app underneath is untouched — once the JS bundle
// loads, react-helmet-async takes over exactly as before; this only fixes
// what non-JS crawlers see on first load.
//
// This does NOT prerender the actual page *body* content (that would require
// a real SSR/rendering pipeline) — it only fixes metadata (title, description,
// OG/Twitter tags, canonical URL), which is what search-result snippets and
// social share previews actually use.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist", "public");
const baseHtmlPath = join(distDir, "index.html");

if (!existsSync(baseHtmlPath)) {
  console.error("[generate-static-meta] dist/public/index.html not found — did `vite build` run first?");
  process.exit(1);
}

const baseHtml = readFileSync(baseHtmlPath, "utf-8");

// Route -> meta overrides. Keep these in sync with each page's <Helmet> block.
// Currency/price figures below must also stay in sync with src/lib/market.ts
// (ACTIVE_MARKET) — that file is the single source of truth for the app's
// active region/currency. When a new market launches, update market.ts first.
const routes = {
  "features": {
    title: "Features — AI Food Scanner, Stress & Vitals Tracking | AORANE",
    description: "Explore AORANE's powerful features: AI food scanner for Indian dishes, stress monitoring, sleep analysis, exercise tracking with MET, medical report scanning, and AI-powered health insights.",
    ogTitle: "AORANE Features — AI-Powered Health Tracking",
    ogDescription: "AI food scanner for Indian dishes, stress monitoring, sleep analysis, exercise tracking & AI-powered health insights. Everything you need for complete health management.",
  },
  "pricing": {
    title: "Pricing — Free & Premium Health Plans | AORANE",
    description: "AORANE pricing plans made for India. Free forever plan + Pro ₹199/mo + Max ₹249/mo + Family ₹499/mo. AI food scanner, diet plans, health insights. All prices inclusive of GST.",
    ogTitle: "AORANE Pricing — Affordable Health Plans for India",
    ogDescription: "Free forever + Pro ₹199/mo + Max ₹249/mo + Family ₹499/mo. AI features, offline logging & more. Start free, upgrade anytime.",
  },
  "about": {
    title: "About Aorane — India's AI Health Platform | Built for Bharat",
    description: "The story of Aorane — how we're building India's most comprehensive AI-powered health management platform. Our mission, values, and journey.",
    ogTitle: "About Aorane — India's AI Health Platform",
    ogDescription: "The story of Aorane — how we're building India's most comprehensive AI-powered health management platform.",
  },
  "careers": {
    title: "Careers at Aorane — Join the Health-Tech Team",
    description: "Join Aorane and help build India's most personal health platform. Open roles in Sales, Backend, and Frontend Development.",
    ogTitle: "Careers at Aorane",
    ogDescription: "Join Aorane and help build India's most personal health platform.",
  },
  "contact": {
    title: "Contact Aorane — Support & Business Enquiries",
    description: "Get in touch with Aorane — support, business inquiries, or general questions. We reply within 24 hours.",
    ogTitle: "Contact Aorane",
    ogDescription: "Get in touch with Aorane — support, business inquiries, or general questions.",
  },
  "privacy": {
    title: "Privacy Policy | AORANE",
    description: "AORANE Privacy Policy — how we collect, use and protect your health data. DPDPA 2023 compliant.",
    ogTitle: "Privacy Policy | AORANE",
    ogDescription: "AORANE Privacy Policy — how we collect, use and protect your health data.",
  },
  "terms": {
    title: "Terms of Service | AORANE",
    description: "AORANE Terms of Service — usage rules, subscription terms, medical disclaimer, and user responsibilities.",
    ogTitle: "Terms of Service | AORANE",
    ogDescription: "AORANE Terms of Service — usage rules, subscription terms, and user responsibilities.",
  },
  "medical-disclaimer": {
    title: "Medical Disclaimer | AORANE",
    description: "AORANE Medical Disclaimer — Aorane is not a medical device. Read important limitations about AI health insights, wellness tracking, and emergency guidance.",
    ogTitle: "Medical Disclaimer | AORANE",
    ogDescription: "AORANE is not a medical device. Read important limitations about AI health insights and wellness tracking.",
  },
  "cookie-policy": {
    title: "Cookie Policy | AORANE",
    description: "AORANE Cookie Policy — what cookies and similar technologies we use, the categories we offer, and how to manage your preferences.",
    ogTitle: "Cookie Policy | AORANE",
    ogDescription: "What cookies AORANE uses, the categories we offer, and how to manage your preferences.",
  },
  "refund-policy": {
    title: "Refund & Cancellation Policy | AORANE",
    description: "AORANE Refund, Cancellation & Delivery Policy — how to cancel your subscription, when refunds apply, and how our digital service is delivered.",
    ogTitle: "Refund & Cancellation Policy | AORANE",
    ogDescription: "How to cancel your Aorane subscription, when refunds apply, and how our digital service is delivered.",
  },
  "sub-processors": {
    title: "Sub-processor List | AORANE",
    description: "AORANE Sub-processor List — the third-party service providers we use to deliver the platform, per GDPR Article 28 and DPDP Act requirements.",
    ogTitle: "Sub-processor List | AORANE",
    ogDescription: "The third-party service providers Aorane uses to deliver the platform.",
  },
  "security": {
    title: "Security Practices | AORANE",
    description: "AORANE Security Practices — encryption, access control, audit logging, and how we protect your health data.",
    ogTitle: "Security Practices | AORANE",
    ogDescription: "How Aorane protects your data — encryption, access control, and audit logging.",
  },
  "data-processing-agreement": {
    title: "Data Processing Agreement | AORANE",
    description: "AORANE Data Processing Agreement template — GDPR Article 28 / DPDP Act aligned terms for enterprise customers.",
    ogTitle: "Data Processing Agreement | AORANE",
    ogDescription: "AORANE's standard DPA template for enterprise customers.",
  },
  "business-associate-agreement": {
    title: "Business Associate Agreement | AORANE",
    description: "AORANE Business Associate Agreement (BAA) template — HIPAA-aligned terms for U.S. Covered Entities.",
    ogTitle: "Business Associate Agreement | AORANE",
    ogDescription: "AORANE's HIPAA-aligned BAA template for U.S. healthcare customers.",
  },
  "sla": {
    title: "Service Level Agreement | AORANE",
    description: "AORANE Service Level Agreement template — uptime target, support response times, and service credit framework.",
    ogTitle: "Service Level Agreement | AORANE",
    ogDescription: "AORANE's enterprise uptime and support commitment framework.",
  },
  "master-service-agreement": {
    title: "Master Service Agreement | AORANE",
    description: "AORANE Master Service Agreement template — the base B2B contract governing enterprise Order Forms.",
    ogTitle: "Master Service Agreement | AORANE",
    ogDescription: "AORANE's base B2B contract template for enterprise Order Forms.",
  },
  "ai-disclosure": {
    title: "AI & Automated Processing Disclosure | AORANE",
    description: "AORANE AI Disclosure — where and how we use AI to process your health data, what it does and doesn't decide, and your right to human review.",
    ogTitle: "AI Disclosure | AORANE",
    ogDescription: "Where and how AORANE uses AI, and your right to human review.",
  },
  "accessibility": {
    title: "Accessibility Statement | AORANE",
    description: "AORANE Accessibility Statement — our WCAG 2.1 AA conformance target, what's implemented today, and known limitations.",
    ogTitle: "Accessibility Statement | AORANE",
    ogDescription: "AORANE's accessibility conformance target and known limitations.",
  },
  "careers-privacy": {
    title: "Careers Privacy Notice | AORANE",
    description: "AORANE Careers Privacy Notice — what information we collect from job applicants, how we use it, and how long we keep it.",
    ogTitle: "Careers Privacy Notice | AORANE",
    ogDescription: "How AORANE handles job applicant data.",
  },
  "vulnerability-disclosure": {
    title: "Vulnerability Disclosure Policy | AORANE",
    description: "AORANE Vulnerability Disclosure Policy — how to report a security issue in good faith, our safe-harbor commitment, and what to expect from us.",
    ogTitle: "Vulnerability Disclosure Policy | AORANE",
    ogDescription: "How to report a security issue to AORANE in good faith.",
  },
  "childrens-privacy": {
    title: "Children's Privacy Addendum | AORANE",
    description: "AORANE Children's Privacy Addendum — how minors' data is handled under the Family plan and institutional (school/college) enrollment.",
    ogTitle: "Children's Privacy Addendum | AORANE",
    ogDescription: "How AORANE handles minors' data — Family plan and institutional enrollment.",
  },
  "international-transfer-addendum": {
    title: "International Data Transfer Addendum | AORANE",
    description: "AORANE International Data Transfer Addendum — the Standard Contractual Clauses / UK IDTA mechanism we use for EU/UK-originating personal data.",
    ogTitle: "International Data Transfer Addendum | AORANE",
    ogDescription: "AORANE's SCC/UK IDTA mechanism for EU/UK personal data transfers.",
  },
  "abdm-compliance": {
    title: "ABDM / NDHM Compliance Note | AORANE",
    description: "AORANE and India's Ayushman Bharat Digital Mission (ABDM) — our current integration status and roadmap.",
    ogTitle: "ABDM / NDHM Compliance Note | AORANE",
    ogDescription: "AORANE's current ABDM/NDHM integration status and roadmap.",
  },
};

function injectMeta(html, route, meta) {
  const canonicalUrl = `https://aorane.com/${route}`;
  let out = html;
  out = out.replace(/<title>.*?<\/title>/s, `<title>${meta.title}</title>`);
  out = out.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${meta.description}" />`);
  out = out.replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${canonicalUrl}" />`);
  out = out.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${canonicalUrl}" />`);
  out = out.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${meta.ogTitle}" />`);
  out = out.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${meta.ogDescription}" />`);
  out = out.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${meta.ogTitle}" />`);
  out = out.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${meta.ogDescription}" />`);
  return out;
}

let count = 0;
for (const [route, meta] of Object.entries(routes)) {
  const outDir = join(distDir, route);
  mkdirSync(outDir, { recursive: true });
  const html = injectMeta(baseHtml, route, meta);
  writeFileSync(join(outDir, "index.html"), html, "utf-8");
  count++;
}

console.log(`[generate-static-meta] Generated ${count} route-specific index.html files with correct meta tags.`);
