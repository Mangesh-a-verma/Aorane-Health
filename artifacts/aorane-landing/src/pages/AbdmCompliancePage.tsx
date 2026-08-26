import { Landmark, Info, Target, ListChecks, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, BulletList, Tag, InfoBox, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "status",   num: "01", title: "Current Status",              icon: Info,       accent: "#D97706" },
  { id: "why",      num: "02", title: "Why We're Publishing This",   icon: Target,     accent: "#0747A6" },
  { id: "alignment", num: "03", title: "Where We Already Align",     icon: ListChecks, accent: "#059669" },
  { id: "roadmap",  num: "04", title: "Roadmap",                     icon: Landmark,   accent: "#0747A6" },
  { id: "contact",  num: "05", title: "Contact Information",       icon: Mail,       accent: "#00B388" },
];

export default function AbdmCompliancePage() {
  return (
    <LegalLayout
      path="/abdm-compliance"
      title="ABDM / NDHM Compliance Note"
      metaDescription="AORANE and India's Ayushman Bharat Digital Mission (ABDM) — our current integration status and roadmap, stated honestly rather than as a certification claim."
      badge="India Digital Health Ecosystem"
      badgeIcon={Landmark}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#D97706">Not Yet Integrated</Tag>
        <Tag color="#0747A6">Roadmap Item</Tag>
      </>}
      sections={sections}
    >
      <SectionBlock {...sections[0]}>
        <InfoBox color="#D97706" bg="#fffbeb" border="#fde68a" badge="Read This First">
          Aorane is <strong>not currently registered or integrated</strong> with India's Ayushman Bharat Digital
          Mission (ABDM/NDHM) — we do not create or link ABHA (Ayushman Bharat Health Account) IDs, act as a
          registered Health Information Provider/User (HIP/HIU), or exchange data via the ABDM Health Information
          Exchange. This page states that plainly rather than implying a certification or integration that doesn't
          exist yet.
        </InfoBox>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <p>
          Hospital and government-adjacent partners evaluating Aorane (e.g. for a tender or partnership) reasonably
          ask about ABDM. Rather than staying silent, we're publishing our actual status and intent so that
          conversation starts from an accurate baseline.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <p>Independent of ABDM registration, several things Aorane has already built are consistent with ABDM's broader goals and would ease a future integration:</p>
        <BulletList items={[
          "Structured extraction of health data from uploaded medical reports (lab values, conditions) rather than only storing unstructured documents",
          "A consent-based data model — see our Privacy Policy and Cookie Policy — consistent with ABDM's Consent Manager framework's emphasis on purpose-specific, revocable consent",
          "India-first data handling practices — see our Security Practices page",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>ABDM integration is on our roadmap, not yet scheduled to a committed date. It would involve, at minimum:</p>
        <BulletList items={[
          "Registering as a Health Information Provider and/or User with ABDM",
          "Supporting ABHA ID creation/linking for users who want it",
          "Adopting the FHIR-based data exchange formats ABDM's Health Information Exchange requires",
          "A dedicated consent-collection flow compatible with ABDM's Consent Manager model",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>Evaluating Aorane for an ABDM-linked partnership or tender? Contact us at:</p>
        <ContactBlock email="business@aorane.in" />
      </SectionBlock>
    </LegalLayout>
  );
}
