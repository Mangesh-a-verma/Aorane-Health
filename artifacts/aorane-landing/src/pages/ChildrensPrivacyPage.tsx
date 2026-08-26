import { Baby, Users, School, ShieldCheck, Trash2, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, InfoBox, WarningBox, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "eligibility", num: "01", title: "Age Eligibility",              icon: Baby,        accent: "#D97706" },
  { id: "family",      num: "02", title: "Family Plan & Dependents",     icon: Users,       accent: "#0747A6" },
  { id: "schools",     num: "03", title: "Schools, Colleges & Institutional Enrollment", icon: School, accent: "#D97706" },
  { id: "rights",      num: "04", title: "A Parent/Guardian's Rights",   icon: ShieldCheck, accent: "#059669" },
  { id: "deletion",    num: "05", title: "Requesting Deletion",          icon: Trash2,      accent: "#0747A6" },
  { id: "contact",     num: "06", title: "Contact Information",        icon: Mail,        accent: "#00B388" },
];

export default function ChildrensPrivacyPage() {
  return (
    <LegalLayout
      path="/childrens-privacy"
      title="Children's Privacy Addendum"
      metaDescription="AORANE Children's Privacy Addendum — how minors' data is handled under the Family plan and institutional (school/college) enrollment, and a parent or guardian's rights."
      badge="DPDP Act Sec. 9 & COPPA-Aligned"
      badgeIcon={Baby}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#D97706">No Direct Accounts Under 18</Tag>
        <Tag color="#0747A6">Guardian-Controlled</Tag>
      </>}
      sections={sections}
    >
      <SectionBlock {...sections[0]}>
        <InfoBox color="#D97706" bg="#fffbeb" border="#fde68a" badge="Core Rule">
          Aorane's Services require account holders to be at least 18 years old — see Section 5.1 of our{" "}
          <a href="/terms" className="font-semibold hover:underline">Terms of Service</a>. Aorane does not knowingly
          allow anyone under 18 to independently create and control their own account. Where a minor's data appears
          on the platform at all, it is because an adult (a parent/guardian, or an enrolling institution acting under
          the terms of Section 3 below) added it on the minor's behalf.
        </InfoBox>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <p>
          Where an 18+ account holder uses Family Account functionality to add health/profile information for a
          minor dependent, that information is controlled by the adult account holder, not the minor. By adding a
          dependent's data, the account holder represents that they are the dependent's parent or legal guardian, or
          otherwise have lawful authority and the dependent's (or the dependent's guardian's) consent to do so — see
          Section 5.3 of our Terms of Service.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <p>
          Aorane Business is marketed to organizations including schools and colleges for aggregate wellness
          monitoring. Where an enrolling institution's population includes anyone under 18:
        </p>
        <BulletList items={[
          "The enrolling institution — not Aorane — is responsible for obtaining verifiable parental/guardian consent before enrolling a student under 18, consistent with Section 9 of India's DPDP Act",
          "The institution warrants, as part of its enrollment agreement with Aorane, that it has obtained and can produce evidence of that consent on request",
          "Aorane does not use behavioral tracking or targeted advertising directed at any user it has been informed is under 18, consistent with DPDP Act Section 9(3)",
        ]} />
        <WarningBox>
          This addendum documents the contractual allocation of that consent obligation. It does not, by itself,
          verify that any specific institution has actually collected guardian consent — that verification currently
          happens at the institution's enrollment process, not through an in-product age-gate or consent-capture
          step in Aorane Business. An institution enrolling minors should have its own verifiable consent process in
          place before doing so.
        </WarningBox>
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>If you are a parent or guardian and believe your child's information has been added to Aorane (via a Family plan or an institutional enrollment) you have the right to:</p>
        <BulletList items={[
          "Request access to what information was collected about your child",
          "Request correction of inaccurate information",
          "Request deletion of your child's information",
          "Refuse further collection or use of your child's information",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>To request deletion of a minor's data, a parent/guardian (or the enrolling institution, on the guardian's behalf) can contact us directly — we do not require the minor themselves to initiate the request.</p>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>Questions about a minor's data on Aorane, or to make a request as a parent/guardian, contact us at:</p>
        <ContactBlock email="privacy@aorane.com" />
      </SectionBlock>
    </LegalLayout>
  );
}
