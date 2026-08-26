import { Briefcase, Database, Target, Users, Clock, Scale, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "scope",      num: "01", title: "Scope",                        icon: Briefcase, accent: "#0747A6" },
  { id: "collection", num: "02", title: "Information We Collect",       icon: Database,  accent: "#0747A6" },
  { id: "use",        num: "03", title: "How We Use It",                icon: Target,    accent: "#0747A6" },
  { id: "sharing",    num: "04", title: "Who Sees It",                  icon: Users,     accent: "#0747A6" },
  { id: "retention",  num: "05", title: "Retention",                    icon: Clock,     accent: "#0747A6" },
  { id: "rights",     num: "06", title: "Your Rights",                  icon: Scale,     accent: "#059669" },
  { id: "contact",    num: "07", title: "Contact Information",         icon: Mail,      accent: "#00B388" },
];

export default function CareersPrivacyPage() {
  return (
    <LegalLayout
      path="/careers-privacy"
      title="Careers Privacy Notice"
      metaDescription="AORANE Careers Privacy Notice — what information we collect from job applicants, how we use it, and how long we keep it."
      badge="For Job Applicants"
      badgeIcon={Briefcase}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#0747A6">Applicants Only</Tag>
        <Tag color="#059669">DPDP & GDPR Aligned</Tag>
      </>}
      sections={sections}
    >
      <SectionBlock {...sections[0]}>
        <p>
          This notice applies specifically to individuals who apply for a role at Aorane through our{" "}
          <a href="/careers" className="font-semibold text-blue-700 hover:underline">Careers page</a>. It is separate
          from our main <a href="/privacy" className="font-semibold text-blue-700 hover:underline">Privacy Policy</a>,
          which covers Aorane's health-tracking users, because the data, purpose, and retention period for a job
          application are different.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <BulletList items={[
          "Name, email address, and phone number",
          "The role you're applying for",
          "A link to your portfolio, LinkedIn, or GitHub profile (we don't currently accept file uploads on the form itself)",
          "Your cover letter / message to us",
          "If shortlisted: a resume/CV you send us directly, and any notes from interview conversations",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <BulletList items={[
          "Evaluating your application against the role's requirements",
          "Contacting you about your application, scheduling interviews, and following up",
          "Internal record-keeping of our hiring process",
        ]} />
        <p className="mt-2 text-xs text-gray-500 italic">We do not use applicant data for marketing, and do not run it through the AI features used by Aorane's health-tracking product.</p>
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>Your application is visible to the hiring team members involved in evaluating candidates for that role. We do not sell or share applicant data with third parties for their own purposes.</p>
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <SubSection title="If you're not hired">
          <p>We retain application data for up to 12 months after a hiring decision, in case a similar role opens and we'd like to reach out — unless you ask us to delete it sooner (see Your Rights below).</p>
        </SubSection>
        <SubSection title="If you're hired">
          <p>Application data becomes part of your employment record, retained per our internal HR record-keeping requirements and applicable labor law.</p>
        </SubSection>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>You can ask us to access, correct, or delete the application data we hold about you, or withdraw your application, at any time by contacting us below.</p>
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>Questions about your application or this notice? Contact us at:</p>
        <ContactBlock email="careers@aorane.com" />
      </SectionBlock>
    </LegalLayout>
  );
}
