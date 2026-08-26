import { FileSignature, Gauge, LifeBuoy, Wrench, AlertTriangle, Ban, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, InfoBox, TemplateNotice, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "scope",      num: "01", title: "Scope",                     icon: Gauge,      accent: "#0747A6" },
  { id: "uptime",     num: "02", title: "Uptime Target",              icon: Gauge,      accent: "#059669" },
  { id: "support",    num: "03", title: "Support Response Times",     icon: LifeBuoy,   accent: "#0747A6" },
  { id: "maintenance", num: "04", title: "Scheduled Maintenance",     icon: Wrench,     accent: "#0747A6" },
  { id: "credits",    num: "05", title: "Service Credits",            icon: AlertTriangle, accent: "#D97706" },
  { id: "exclusions", num: "06", title: "Exclusions",                 icon: Ban,        accent: "#0747A6" },
  { id: "contact",    num: "07", title: "Contact Information",       icon: Mail,       accent: "#00B388" },
];

export default function SlaTemplatePage() {
  return (
    <LegalLayout
      path="/sla"
      title="Service Level Agreement"
      metaDescription="AORANE Service Level Agreement template — uptime target, support response times, and service credit framework for enterprise customers."
      badge="Enterprise Uptime Commitment Template"
      badgeIcon={FileSignature}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#0747A6">B2B / Enterprise</Tag>
        <Tag color="#7C3AED">Attached to Order Form</Tag>
      </>}
      sections={sections}
    >
      <TemplateNotice docName="Service Level Agreement (SLA)" />

      <SectionBlock {...sections[0]}>
        <p>
          This Service Level Agreement ("SLA") describes the framework Aorane uses to commit to service availability
          and support responsiveness for enterprise customers. The specific uptime percentage, support tier, and any
          service credits that actually apply to your organization are set out in your signed Order Form or Master
          Service Agreement — this page describes the structure, not a standing guarantee to every account.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <InfoBox badge="Standard Enterprise Target">
          Unless a different figure is stated in your Order Form, Aorane's standard enterprise target is{" "}
          <strong>99.5% monthly uptime</strong> for the core API and web application, excluding scheduled maintenance
          and the exclusions below. This is a target we design and operate toward — not a claim of a historical
          uptime track record, which we will share with prospective enterprise customers on request.
        </InfoBox>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <p>Support response targets, by severity, for enterprise customers with an active support plan:</p>
        <div className="mt-3 rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left">
                <th className="px-4 py-2.5 font-semibold">Severity</th>
                <th className="px-4 py-2.5 font-semibold">Definition</th>
                <th className="px-4 py-2.5 font-semibold">First Response Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2.5 font-semibold text-gray-800">Critical</td>
                <td className="px-4 py-2.5 text-gray-600">Service completely unavailable for all users</td>
                <td className="px-4 py-2.5 text-gray-500">4 business hours</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-semibold text-gray-800">High</td>
                <td className="px-4 py-2.5 text-gray-600">Major feature unusable, no workaround</td>
                <td className="px-4 py-2.5 text-gray-500">1 business day</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-semibold text-gray-800">Normal</td>
                <td className="px-4 py-2.5 text-gray-600">Minor issue or question, workaround available</td>
                <td className="px-4 py-2.5 text-gray-500">2 business days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2 italic">Business hours: Monday–Saturday, 10:00–19:00 IST, excluding Indian public holidays, unless your Order Form specifies otherwise.</p>
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>Aorane will provide at least 48 hours' advance notice, by email, of scheduled maintenance expected to affect availability. Scheduled maintenance windows are excluded from uptime calculations.</p>
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>Where your Order Form includes service credits for missing the committed uptime target, credits are calculated as a percentage of the affected month's fees, following the tiers stated in that Order Form. Service credits are the customer's sole and exclusive remedy for a missed uptime commitment, and must be requested in writing within 30 days of the qualifying incident.</p>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>The uptime target and any service credits do not apply to unavailability caused by:</p>
        <BulletList items={[
          "Scheduled maintenance with advance notice as described above",
          "Force majeure events outside Aorane's reasonable control",
          "A third-party sub-processor's outage (see our Sub-processor List), to the extent Aorane could not reasonably have prevented it",
          "Customer's own misuse, unauthorized third-party integrations, or actions outside the intended use of the Services",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>To negotiate SLA terms for your organization, contact:</p>
        <ContactBlock email="business@aorane.in" />
      </SectionBlock>
    </LegalLayout>
  );
}
