import { Cookie, Settings2, BarChart3, Megaphone, ShieldCheck, ListChecks, RefreshCw, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, InfoBox, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "what",        num: "01", title: "What Cookies Are",              icon: Cookie,      accent: "#0747A6" },
  { id: "categories",  num: "02", title: "Categories We Use",             icon: ListChecks,  accent: "#0747A6" },
  { id: "necessary",   num: "03", title: "Strictly Necessary",            icon: ShieldCheck, accent: "#059669" },
  { id: "analytics",   num: "04", title: "Analytics Cookies",             icon: BarChart3,   accent: "#0747A6" },
  { id: "marketing",   num: "05", title: "Marketing Cookies",             icon: Megaphone,   accent: "#0747A6" },
  { id: "preferences", num: "06", title: "Preference Cookies",            icon: Settings2,   accent: "#0747A6" },
  { id: "manage",      num: "07", title: "Managing Your Choice",          icon: Settings2,   accent: "#059669" },
  { id: "changes",     num: "08", title: "Changes to This Policy",        icon: RefreshCw,   accent: "#0747A6" },
  { id: "contact",     num: "09", title: "Contact Information",          icon: Mail,        accent: "#00B388" },
];

// Kept in sync with the real consent categories and destinations wired up
// in lib/analytics/src (consent.ts + destinations/ga4.ts, meta.ts, clarity.ts,
// linkedin.ts) — this page must never describe a category or vendor the
// code doesn't actually use, and must be updated if that list changes.

export default function CookiePolicyPage() {
  return (
    <LegalLayout
      path="/cookie-policy"
      title="Cookie Policy"
      metaDescription="AORANE Cookie Policy — what cookies and similar technologies we use, the categories we offer, and how to manage your preferences."
      badge="DPDPA 2023 & GDPR Aligned"
      badgeIcon={Cookie}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#059669">Off by Default</Tag>
        <Tag color="#0747A6">4 Categories</Tag>
        <Tag color="#7C3AED">You Choose</Tag>
      </>}
      sections={sections}
    >
      <SectionBlock {...sections[0]}>
        <p>
          Cookies are small text files placed on your device when you visit a website. Aorane also uses similar
          browser-storage technologies (such as <code>localStorage</code>) to remember your preferences. This policy
          explains what we use, why, and how you can control it — it should be read alongside our{" "}
          <a href="/privacy" className="font-semibold text-blue-700 hover:underline">Privacy Policy</a>.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <p>
          When you first visit aorane.com, a consent banner asks you to choose. Only <strong>Strictly Necessary</strong> is
          on by default — <strong>Analytics</strong>, <strong>Marketing</strong>, and <strong>Preferences</strong> all start switched
          off until you actively opt in, and your choice is stored on your device so we don't ask again on every visit.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <InfoBox badge="Always On">
          Required for the site to function — session integrity, security, and load-balancing. We currently set no
          separate tracking cookie in this category; it exists so all four categories are described consistently and
          so any future strictly-functional cookie is automatically covered by this disclosure.
        </InfoBox>
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>Loaded only after you accept Analytics. Used to understand aggregate traffic and usage patterns — never to identify you personally, and never combined with your in-app health data.</p>
        <SubSection title="Providers">
          <BulletList items={[
            "Google Analytics 4 (GA4) — page views, traffic sources, aggregate usage",
            "Microsoft Clarity — anonymized session/heatmap analytics",
          ]} />
        </SubSection>
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>Loaded only after you accept Marketing. Used to measure the effectiveness of our own campaigns — never to sell your data to third parties.</p>
        <SubSection title="Providers">
          <BulletList items={[
            "Meta (Facebook/Instagram) Pixel — campaign attribution and retargeting",
            "LinkedIn Insight Tag — B2B campaign attribution",
          ]} />
        </SubSection>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>Remembers non-essential choices you make on the site (e.g. UI preferences) across visits. Loaded only after you accept this category.</p>
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>You can change your mind at any time:</p>
        <BulletList items={[
          "Use the cookie banner shown on your first visit to Accept All or allow Necessary only",
          "Clear your browser's site data for aorane.com to reset your choice and see the banner again",
          "Most browsers let you block or delete cookies entirely in their privacy settings — note this may affect site functionality",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[7]}>
        <p>We may update this Cookie Policy as our use of cookies changes. Material changes will be reflected here with an updated date, and — where required by law — a fresh consent prompt.</p>
      </SectionBlock>

      <SectionBlock {...sections[8]}>
        <p>Questions about cookies or your choices? Contact us at:</p>
        <ContactBlock />
      </SectionBlock>
    </LegalLayout>
  );
}
