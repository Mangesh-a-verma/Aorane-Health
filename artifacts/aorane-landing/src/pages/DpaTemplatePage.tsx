import { FileSignature, BookOpen, ListChecks, ShieldCheck, Users, Globe, AlertTriangle, XCircle, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, TemplateNotice, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "definitions",  num: "01", title: "Definitions",                    icon: BookOpen,     accent: "#0747A6" },
  { id: "scope",        num: "02", title: "Scope & Roles",                  icon: ListChecks,   accent: "#0747A6" },
  { id: "obligations",  num: "03", title: "Processor Obligations",          icon: ShieldCheck,  accent: "#059669" },
  { id: "subprocessing", num: "04", title: "Sub-processing",                icon: Users,        accent: "#0747A6" },
  { id: "transfers",    num: "05", title: "International Transfers",        icon: Globe,        accent: "#0747A6" },
  { id: "breach",       num: "06", title: "Data Breach Notification",       icon: AlertTriangle, accent: "#D97706" },
  { id: "deletion",     num: "07", title: "Deletion & Return of Data",      icon: XCircle,      accent: "#0747A6" },
  { id: "contact",      num: "08", title: "Contact Information",          icon: Mail,         accent: "#00B388" },
];

export default function DpaTemplatePage() {
  return (
    <LegalLayout
      path="/data-processing-agreement"
      title="Data Processing Agreement"
      metaDescription="AORANE Data Processing Agreement template — GDPR Article 28 / DPDP Act aligned terms governing how Aorane processes personal data on behalf of an enterprise customer."
      badge="GDPR Art. 28 & DPDP Aligned Template"
      badgeIcon={FileSignature}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#0747A6">B2B / Enterprise</Tag>
        <Tag color="#7C3AED">India Jurisdiction</Tag>
      </>}
      sections={sections}
    >
      <TemplateNotice docName="Data Processing Agreement (DPA)" />

      <SectionBlock {...sections[0]}>
        <p>
          This Data Processing Agreement ("DPA") forms part of the agreement between Aorane ("Processor") and the
          enterprise customer named in the applicable order form ("Controller"), and governs Aorane's processing of
          personal data on the Controller's behalf. Capitalized terms not defined here have the meaning given in the{" "}
          <a href="/terms" className="font-semibold text-blue-700 hover:underline">Terms of Service</a> or the
          Controller's Master Service Agreement.
        </p>
        <SubSection title="Key Terms">
          <BulletList items={[
            "\"Personal Data\" — any information relating to an identified or identifiable natural person processed by Aorane on the Controller's instructions",
            "\"Processing\" — any operation performed on Personal Data (collection, storage, use, disclosure, deletion)",
            "\"Sub-processor\" — a third party engaged by Aorane to process Personal Data, as listed on our Sub-processor List",
            "\"Data Protection Laws\" — the DPDP Act 2023 (India), and, where applicable to the Controller's users, the GDPR and equivalent laws",
          ]} />
        </SubSection>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <p>
          The Controller determines the purposes and means of processing its end-users'/employees' Personal Data
          submitted to the Aorane platform (e.g. via a corporate wellness enrollment). Aorane acts as Processor and
          processes that Personal Data solely to provide the Services and on the Controller's documented
          instructions, except where required to do otherwise by law.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <BulletList items={[
          "Process Personal Data only for the purposes set out in the underlying agreement and this DPA",
          "Ensure personnel authorized to process Personal Data are subject to confidentiality obligations",
          "Implement the technical and organizational measures described in our Security Practices page (encryption, access control, audit logging, rate limiting)",
          "Assist the Controller, at the Controller's reasonable cost, in responding to data subject access/deletion/correction requests relating to the Controller's end-users",
          "Make available information reasonably necessary to demonstrate compliance with this DPA, and allow for audits by the Controller or its appointed auditor on reasonable notice",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>
          The Controller authorizes Aorane to engage the sub-processors listed on our{" "}
          <a href="/sub-processors" className="font-semibold text-blue-700 hover:underline">Sub-processor List</a>.
          That public page lists infrastructure, payment, and communications sub-processors by name; AI/ML inference
          sub-processors are described there by category, and the current named list for that category is provided
          directly to the Controller on execution of this DPA and updated with notice. Aorane will:
        </p>
        <BulletList items={[
          "Impose data-protection obligations on each sub-processor no less protective than those in this DPA",
          "Remain liable to the Controller for a sub-processor's performance of its data-protection obligations",
          "Provide advance notice before adding a new sub-processor, giving the Controller an opportunity to object on reasonable data-protection grounds",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>
          Personal Data may be processed on servers located in India, the United States, or the European Union,
          depending on the sub-processor involved (see the Sub-processor List for each provider's region). Where a
          transfer requires a specific safeguard under applicable law (e.g. Standard Contractual Clauses for
          EU-originating data), the parties agree to execute the appropriate mechanism as a supplement to this DPA
          before that transfer occurs.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>
          Aorane will notify the Controller without undue delay, and in any event within <strong>72 hours</strong> of
          becoming aware, of any confirmed unauthorized access to, or disclosure of, Personal Data processed under
          this DPA, and will provide reasonably requested information to help the Controller meet its own regulatory
          notification obligations.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>
          On termination of the underlying agreement, Aorane will, at the Controller's choice, delete or return all
          Personal Data processed under this DPA within a commercially reasonable period, except where retention is
          required by applicable law — consistent with the retention terms in our{" "}
          <a href="/privacy" className="font-semibold text-blue-700 hover:underline">Privacy Policy</a>.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[7]}>
        <p>To request an executable, organization-named copy of this DPA, contact:</p>
        <ContactBlock email="legal@aorane.com" />
      </SectionBlock>
    </LegalLayout>
  );
}
