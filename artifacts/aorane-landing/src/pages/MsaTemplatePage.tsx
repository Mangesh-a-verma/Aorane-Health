import { FileSignature, BookOpen, FileText, CreditCard, Lock, Scale, XCircle, Gavel, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, TemplateNotice, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "structure",   num: "01", title: "Agreement Structure",       icon: BookOpen,  accent: "#0747A6" },
  { id: "orderforms",  num: "02", title: "Order Forms",               icon: FileText,  accent: "#0747A6" },
  { id: "fees",        num: "03", title: "Fees & Payment",            icon: CreditCard, accent: "#0747A6" },
  { id: "ip",          num: "04", title: "Intellectual Property",     icon: Lock,      accent: "#0747A6" },
  { id: "confidentiality", num: "05", title: "Confidentiality",       icon: Lock,      accent: "#0747A6" },
  { id: "liability",   num: "06", title: "Warranties & Liability",    icon: Scale,     accent: "#0747A6" },
  { id: "termination", num: "07", title: "Term & Termination",        icon: XCircle,   accent: "#0747A6" },
  { id: "disputes",    num: "08", title: "Governing Law & Disputes",  icon: Gavel,     accent: "#0747A6" },
  { id: "contact",     num: "09", title: "Contact Information",      icon: Mail,      accent: "#00B388" },
];

export default function MsaTemplatePage() {
  return (
    <LegalLayout
      path="/master-service-agreement"
      title="Master Service Agreement"
      metaDescription="AORANE Master Service Agreement template — the base B2B contract governing enterprise Order Forms, fees, IP, confidentiality, and liability."
      badge="B2B Base Contract Template"
      badgeIcon={FileSignature}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#0747A6">Enterprise / Corporate Wellness</Tag>
        <Tag color="#7C3AED">India Jurisdiction</Tag>
      </>}
      sections={sections}
    >
      <TemplateNotice docName="Master Service Agreement (MSA)" />

      <SectionBlock {...sections[0]}>
        <p>
          This Master Service Agreement ("MSA") sets out the general terms that apply to every Order Form executed
          between Aorane and an enterprise customer ("Customer") for access to the Aorane Business Portal and related
          services. Where a Data Processing Agreement or Business Associate Agreement is also executed, those
          documents govern data-protection matters specifically and take precedence over this MSA on that subject.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <p>
          Each specific engagement — the number of licensed employee seats, pricing, term length, and any custom
          features — is set out in a separate Order Form referencing this MSA. In case of conflict between an Order
          Form and this MSA on commercial terms (price, seat count, term), the Order Form controls.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <BulletList items={[
          "Fees are as stated in the applicable Order Form and are due per the payment terms specified there",
          "Unless otherwise agreed, invoices are payable within 30 days of the invoice date",
          "Late payments may accrue interest at the maximum rate permitted by applicable law",
          "Fees are exclusive of applicable taxes (e.g. GST), which the Customer is responsible for unless it provides a valid tax exemption",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>
          Aorane retains all rights, title, and interest in the Aorane platform, including its software, AI models,
          and underlying technology. The Customer retains ownership of its own data and content uploaded to the
          platform. Aorane grants the Customer a limited, non-exclusive, non-transferable license to access and use
          the Services during the term of the applicable Order Form, solely for the Customer's internal business
          purposes.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>
          Each party will protect the other's confidential information with at least the same degree of care it uses
          for its own confidential information of similar nature, and will not disclose it to third parties except as
          needed to perform this Agreement, as required by law, or with the disclosing party's written consent. This
          obligation survives termination of this Agreement for 3 years, or indefinitely for information that
          constitutes a trade secret.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <SubSection title="6.1 — Warranty">
          <p>Aorane warrants that the Services will perform materially in accordance with their documentation. This warranty does not extend to issues caused by the Customer's misuse, unauthorized modification, or third-party integrations.</p>
        </SubSection>
        <SubSection title="6.2 — Disclaimer">
          <p>Except as expressly stated in this MSA, the Services are provided "as is," and Aorane disclaims all other warranties, express or implied, including merchantability and fitness for a particular purpose, to the maximum extent permitted by law.</p>
        </SubSection>
        <SubSection title="6.3 — Limitation of Liability">
          <p>Except for breaches of confidentiality, IP infringement, or a party's indemnification obligations, neither party's aggregate liability under this Agreement will exceed the fees paid or payable by the Customer in the 12 months preceding the claim. Neither party is liable for indirect, incidental, or consequential damages.</p>
        </SubSection>
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>
          This MSA remains in effect as long as at least one Order Form referencing it is active. Either party may
          terminate an Order Form for the other party's uncured material breach on 30 days' written notice. On
          termination, the Customer's data is handled per the Data Processing Agreement (if executed) or our{" "}
          <a href="/privacy" className="font-semibold text-blue-700 hover:underline">Privacy Policy</a>.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[7]}>
        <p>
          This MSA is governed by the laws of India. The parties will first attempt good-faith resolution of any
          dispute; unresolved disputes will be subject to the exclusive jurisdiction of the competent courts in India,
          or resolved by binding arbitration where the parties' Order Form so specifies.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[8]}>
        <p>To request an Order Form or discuss enterprise terms, contact:</p>
        <ContactBlock email="business@aorane.in" />
      </SectionBlock>
    </LegalLayout>
  );
}
