import { Network, Server, Database, CreditCard, MessageSquare, Brain, BarChart3, Cloud, RefreshCw, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, Tag, InfoBox, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "intro",     num: "01", title: "About This List",         icon: Network,      accent: "#0747A6" },
  { id: "infra",     num: "02", title: "Hosting & Database",      icon: Server,       accent: "#0747A6" },
  { id: "payments",  num: "03", title: "Payments & Billing",      icon: CreditCard,   accent: "#0747A6" },
  { id: "comms",     num: "04", title: "Communications",         icon: MessageSquare, accent: "#0747A6" },
  { id: "ai",        num: "05", title: "AI Providers",           icon: Brain,        accent: "#059669" },
  { id: "identity",  num: "06", title: "Identity & Device Data", icon: Database,     accent: "#0747A6" },
  { id: "analytics", num: "07", title: "Analytics & Marketing",  icon: BarChart3,    accent: "#0747A6" },
  { id: "changes",   num: "08", title: "Notice of New Sub-processors", icon: RefreshCw, accent: "#0747A6" },
  { id: "contact",   num: "09", title: "Contact Information",   icon: Mail,         accent: "#00B388" },
];

type Row = { name: string; purpose: string; location: string };
function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="mt-3 rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-left">
            <th className="px-4 py-2.5 font-semibold">Sub-processor</th>
            <th className="px-4 py-2.5 font-semibold">Purpose</th>
            <th className="px-4 py-2.5 font-semibold">Location</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{r.name}</td>
              <td className="px-4 py-2.5 text-gray-600">{r.purpose}</td>
              <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{r.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Kept in sync with the providers actually wired up in
// artifacts/api-server/.env.example and lib/analytics/src/destinations —
// this page must only ever list a vendor that is genuinely integrated.

export default function SubprocessorsPage() {
  return (
    <LegalLayout
      path="/sub-processors"
      title="Sub-processor List"
      metaDescription="AORANE Sub-processor List — the third-party service providers we use to deliver the platform, per GDPR Article 28 and DPDP Act requirements."
      badge="GDPR Art. 28 & DPDP Aligned"
      badgeIcon={Network}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#0747A6">Enterprise Due-Diligence</Tag>
        <Tag color="#059669">Updated as Vendors Change</Tag>
      </>}
      sections={sections}
    >
      <SectionBlock {...sections[0]}>
        <p>
          A "sub-processor" is a third-party service provider that Aorane engages to process personal data on our
          behalf in order to deliver the Services described in our{" "}
          <a href="/terms" className="font-semibold text-blue-700 hover:underline">Terms of Service</a>. This page lists
          every sub-processor currently in use, organized by function. It supplements our{" "}
          <a href="/privacy" className="font-semibold text-blue-700 hover:underline">Privacy Policy</a> and is provided
          for enterprise customers, auditors, and anyone conducting data-protection due diligence.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <Table rows={[
          { name: "Render", purpose: "Application hosting for the API server", location: "Singapore region" },
          { name: "Vercel", purpose: "Static hosting/CDN for web front-ends", location: "Global CDN" },
          { name: "Supabase", purpose: "Managed PostgreSQL database", location: "As provisioned per project" },
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <Table rows={[
          { name: "Razorpay", purpose: "Payment processing, subscription billing", location: "India" },
          { name: "Google Play Billing", purpose: "Android in-app subscription billing", location: "Google (Global)" },
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <Table rows={[
          { name: "Twilio", purpose: "SMS / WhatsApp OTP delivery", location: "Global" },
          { name: "Fast2SMS", purpose: "SMS OTP delivery (India)", location: "India" },
          { name: "Resend", purpose: "Transactional email delivery", location: "Global" },
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <InfoBox badge="Health Data & AI Processing">
          Food photographs, medical report text, and wellness inputs may be sent to one of the AI providers below to
          generate insights. We do not use your data to train these providers' foundation models — see Section 4 of
          our Privacy Policy.
        </InfoBox>
        <div className="mt-3">
          <Table rows={[
            { name: "Google Gemini", purpose: "Food-photo analysis, medical report extraction, wellness insights", location: "Google (Global)" },
            { name: "OpenAI", purpose: "AI-generated wellness insights (selected features)", location: "Global" },
            { name: "Anthropic", purpose: "AI-generated wellness insights (selected features)", location: "Global" },
            { name: "NVIDIA", purpose: "AI model inference (selected features)", location: "Global" },
          ]} />
        </div>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <Table rows={[
          { name: "Firebase (Google)", purpose: "Mobile app authentication and push notifications", location: "Google (Global)" },
          { name: "Google Fit", purpose: "Wearable/activity data sync (with your explicit permission)", location: "Google (Global)" },
          { name: "OpenWeather", purpose: "Weather data for wellness recommendations", location: "Global" },
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>Loaded only when you grant the relevant cookie consent category — see our <a href="/cookie-policy" className="font-semibold text-blue-700 hover:underline">Cookie Policy</a> for details.</p>
        <div className="mt-3">
          <Table rows={[
            { name: "Google Analytics 4", purpose: "Aggregate website/app usage analytics", location: "Google (Global)" },
            { name: "Microsoft Clarity", purpose: "Anonymized session/heatmap analytics", location: "Microsoft (Global)" },
            { name: "Meta Pixel", purpose: "Marketing campaign attribution", location: "Meta (Global)" },
            { name: "LinkedIn Insight Tag", purpose: "B2B marketing campaign attribution", location: "LinkedIn (Global)" },
          ]} />
        </div>
      </SectionBlock>

      <SectionBlock {...sections[7]}>
        <SubSection title="For Enterprise / B2B Customers">
          <p>
            If you are a party to a Data Processing Agreement with Aorane, we will provide advance notice of any new
            sub-processor added to this list, consistent with the notice period agreed in that DPA, and you may object
            through the process described there.
          </p>
        </SubSection>
        <SubSection title="For All Other Users">
          <p>This page is updated whenever our sub-processor list changes; check back periodically for the current list.</p>
        </SubSection>
      </SectionBlock>

      <SectionBlock {...sections[8]}>
        <p>Questions about a specific sub-processor or want a signed Data Processing Agreement? Contact us at:</p>
        <ContactBlock email="legal@aorane.com" />
      </SectionBlock>
    </LegalLayout>
  );
}
