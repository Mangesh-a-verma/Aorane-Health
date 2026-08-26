import { FileSignature, BookOpen, ShieldCheck, Users, AlertTriangle, XCircle, Info, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, InfoBox, TemplateNotice, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "applicability", num: "01", title: "When This Applies",          icon: Info,         accent: "#D97706" },
  { id: "definitions",   num: "02", title: "Definitions",                icon: BookOpen,     accent: "#0747A6" },
  { id: "permitted",     num: "03", title: "Permitted Uses of PHI",      icon: ShieldCheck,  accent: "#059669" },
  { id: "safeguards",    num: "04", title: "Safeguards",                 icon: ShieldCheck,  accent: "#0747A6" },
  { id: "subcontractors", num: "05", title: "Subcontractors",            icon: Users,        accent: "#0747A6" },
  { id: "breach",        num: "06", title: "Breach Notification",        icon: AlertTriangle, accent: "#D97706" },
  { id: "termination",   num: "07", title: "Termination & Data Return",  icon: XCircle,      accent: "#0747A6" },
  { id: "contact",       num: "08", title: "Contact Information",       icon: Mail,         accent: "#00B388" },
];

export default function BaaTemplatePage() {
  return (
    <LegalLayout
      path="/business-associate-agreement"
      title="Business Associate Agreement"
      metaDescription="AORANE Business Associate Agreement (BAA) template — HIPAA-aligned terms for U.S. Covered Entities engaging Aorane to process Protected Health Information."
      badge="HIPAA-Aligned Template — U.S. Customers"
      badgeIcon={FileSignature}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#D97706">U.S. HIPAA Only</Tag>
        <Tag color="#0747A6">Enterprise / Hospital</Tag>
      </>}
      sections={sections}
    >
      <TemplateNotice docName="Business Associate Agreement (BAA)" />

      <SectionBlock {...sections[0]}>
        <InfoBox color="#D97706" bg="#fffbeb" border="#fde68a" badge="Read Before Relying On This">
          Aorane's primary operations are governed by India's DPDP Act 2023 — see our standard{" "}
          <a href="/privacy" className="font-semibold hover:underline">Privacy Policy</a>. This BAA template applies
          <strong> only</strong> where a U.S. HIPAA Covered Entity or Business Associate engages Aorane to process
          Protected Health Information ("PHI") on its behalf under a specific signed agreement — it is not
          automatically in effect for any customer, and Aorane does not represent itself as HIPAA-certified absent
          such a signed agreement and the accompanying technical controls for that engagement.
        </InfoBox>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <BulletList items={[
          "\"Covered Entity\" — the HIPAA-regulated healthcare provider, health plan, or clearinghouse engaging Aorane",
          "\"Business Associate\" — Aorane, when performing a function involving PHI on the Covered Entity's behalf",
          "\"PHI\" — Protected Health Information as defined at 45 CFR § 160.103",
          "\"Breach\" — as defined at 45 CFR § 164.402",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <p>Aorane will use or disclose PHI only:</p>
        <BulletList items={[
          "As necessary to perform the services described in the underlying services agreement",
          "As required by law",
          "For Aorane's proper management and administration, or to carry out its legal responsibilities, subject to the safeguards in this Agreement",
        ]} />
        <p className="mt-2">Aorane will not use or disclose PHI in a manner that would violate HIPAA if done by the Covered Entity directly, and will not sell PHI or use it for marketing without authorization.</p>
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>Aorane will implement administrative, physical, and technical safeguards consistent with the HIPAA Security Rule, including the measures described on our <a href="/security" className="font-semibold text-blue-700 hover:underline">Security Practices</a> page (encryption at rest and in transit for the relevant data stores, role-based access control, audit logging of access to sensitive records, and rate-limited, authenticated access to all systems handling PHI).</p>
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>Where Aorane engages a subcontractor that will have access to PHI, Aorane will enter into a written agreement with that subcontractor imposing restrictions and conditions on the PHI at least as stringent as those in this Agreement. Current sub-processors are listed on our <a href="/sub-processors" className="font-semibold text-blue-700 hover:underline">Sub-processor List</a>.</p>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>Aorane will report to the Covered Entity any Breach of unsecured PHI without unreasonable delay, and in no case later than <strong>60 days</strong> after discovery, consistent with 45 CFR § 164.410, including the information reasonably available to allow the Covered Entity to meet its own notification obligations under the Breach Notification Rule.</p>
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>Upon termination of the underlying services agreement, Aorane will, at the Covered Entity's election, return or destroy all PHI it holds, except where retention is required by law — in which case Aorane will continue to protect that PHI under the terms of this Agreement for as long as it is retained.</p>
      </SectionBlock>

      <SectionBlock {...sections[7]}>
        <p>To discuss a BAA for a U.S. healthcare engagement, contact:</p>
        <ContactBlock email="legal@aorane.com" />
      </SectionBlock>
    </LegalLayout>
  );
}
