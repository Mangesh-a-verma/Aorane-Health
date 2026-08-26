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
