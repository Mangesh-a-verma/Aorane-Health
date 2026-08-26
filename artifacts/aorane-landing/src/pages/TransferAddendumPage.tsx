import { Globe, FileSignature, ListChecks, ShieldCheck, Scale, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, InfoBox, TemplateNotice, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "purpose",   num: "01", title: "Purpose",                      icon: Globe,       accent: "#0747A6" },
  { id: "mechanism", num: "02", title: "Transfer Mechanism",           icon: ListChecks,  accent: "#0747A6" },
  { id: "module",    num: "03", title: "Applicable Module",            icon: FileSignature, accent: "#0747A6" },
  { id: "safeguards", num: "04", title: "Additional Safeguards",       icon: ShieldCheck, accent: "#059669" },
  { id: "precedence", num: "05", title: "Precedence",                  icon: Scale,       accent: "#0747A6" },
  { id: "contact",   num: "06", title: "Contact Information",        icon: Mail,        accent: "#00B388" },
];

export default function TransferAddendumPage() {
  return (
    <LegalLayout
      path="/international-transfer-addendum"
      title="International Data Transfer Addendum"
      metaDescription="AORANE International Data Transfer Addendum — the Standard Contractual Clauses / UK IDTA mechanism we use for EU/UK-originating personal data, as a supplement to our DPA."
      badge="EU SCCs & UK IDTA Template"
      badgeIcon={Globe}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#0747A6">EU/UK Customers</Tag>
        <Tag color="#7C3AED">Supplements the DPA</Tag>
      </>}
      sections={sections}
    >
      <TemplateNotice docName="International Data Transfer Addendum" />

      <SectionBlock {...sections[0]}>
        <p>
          This addendum applies where personal data originating in the European Economic Area or the United Kingdom
          is transferred to Aorane (established in India) or onward to a sub-processor outside the EEA/UK, and no
          adequacy decision covers that transfer. It supplements our{" "}
          <a href="/data-processing-agreement" className="font-semibold text-blue-700 hover:underline">Data Processing Agreement</a>{" "}
          and applies only where the Controller's Order Form or DPA execution confirms it is needed.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <p>
          For transfers subject to the EU GDPR, the parties agree to the European Commission's Standard Contractual
          Clauses (Commission Implementing Decision (EU) 2021/914 of 4 June 2021, "EU SCCs"). For transfers subject
          to the UK GDPR, the parties agree to the UK International Data Transfer Addendum ("UK IDTA") issued by the
          UK Information Commissioner's Office, or the EU SCCs as modified by the UK Addendum, at the Controller's
          election.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <p>Given Aorane's role as Processor for enterprise/Business Portal customers, <strong>Module Two (Controller to Processor)</strong> of the EU SCCs applies by default. Where Aorane's own sub-processor sits outside the EEA/UK, Module Three (Processor to Processor) is incorporated for that onward transfer, consistent with the sub-processor authorization in the DPA.</p>
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>In addition to the SCCs/IDTA text itself, Aorane applies the technical and organizational measures described in our <a href="/security" className="font-semibold text-blue-700 hover:underline">Security Practices</a> page to data covered by this addendum — encryption in transit, access controls, and audit logging — as supplementary measures consistent with the CJEU's Schrems II guidance on transfer risk assessment.</p>
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>In the event of a conflict between this addendum and the DPA or the underlying services agreement on a matter of international transfer, this addendum controls to the extent necessary to satisfy EU/UK GDPR Chapter V.</p>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>To execute this addendum alongside your DPA, contact:</p>
        <ContactBlock email="legal@aorane.com" />
      </SectionBlock>
    </LegalLayout>
  );
}
