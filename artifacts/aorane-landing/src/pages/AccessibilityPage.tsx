import { Accessibility, Target, ListChecks, AlertTriangle, Keyboard, RefreshCw, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, BulletList, Tag, InfoBox, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "commitment", num: "01", title: "Our Commitment",              icon: Accessibility, accent: "#059669" },
  { id: "standard",   num: "02", title: "Conformance Target",          icon: Target,        accent: "#0747A6" },
  { id: "measures",   num: "03", title: "What We've Built In",         icon: ListChecks,    accent: "#0747A6" },
  { id: "keyboard",   num: "04", title: "Keyboard & Screen Readers",   icon: Keyboard,      accent: "#0747A6" },
  { id: "known",      num: "05", title: "Known Limitations",           icon: AlertTriangle, accent: "#D97706" },
  { id: "feedback",   num: "06", title: "Feedback & Ongoing Work",     icon: RefreshCw,     accent: "#0747A6" },
  { id: "contact",    num: "07", title: "Contact Information",       icon: Mail,          accent: "#00B388" },
];

export default function AccessibilityPage() {
  return (
    <LegalLayout
      path="/accessibility"
      title="Accessibility Statement"
      metaDescription="AORANE Accessibility Statement — our WCAG 2.1 AA conformance target, what's implemented today, known limitations, and how to report an accessibility issue."
      badge="WCAG 2.1 AA Target"
      badgeIcon={Accessibility}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#059669">Ongoing Effort</Tag>
        <Tag color="#0747A6">Feedback Welcome</Tag>
      </>}
      sections={sections}
    >
      <SectionBlock {...sections[0]}>
        <p>
          Aorane is a health platform, and health tools should be usable by everyone, including people who use
          assistive technology. This statement describes where we are today — honestly, including what still needs
          work — rather than a certification claim.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <InfoBox>
          Our target is <strong>WCAG 2.1 Level AA</strong>. We are working toward this target across the website,
          web app, and mobile app; we are not yet independently audited or certified against it.
        </InfoBox>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <BulletList items={[
          "Semantic HTML structure and heading hierarchy on informational pages",
          "Visible focus states on interactive controls",
          "Color choices checked for reasonable contrast against their background on new pages we build",
          "Alt text on meaningful images; decorative graphics are marked so screen readers skip them",
          "Responsive layouts that support browser zoom and text resizing without breaking layout",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>
          Core navigation and forms (sign-in, subscription checkout, contact/careers forms) are operable via
          keyboard. If you find a control that traps keyboard focus or an interactive element unreachable without a
          mouse, please report it — see Feedback below.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>Known gaps we're actively working through:</p>
        <BulletList items={[
          "Some data visualizations (charts, graphs) in the dashboard do not yet have a complete text-equivalent alternative for screen-reader users",
          "Some third-party embedded components (payment checkout, certain interactive charts) inherit accessibility limitations from their upstream vendor rather than being fully under our control",
          "Not all pages have undergone a full manual screen-reader pass (NVDA/VoiceOver) — automated checks catch a meaningful subset of issues but not all of them",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>This statement is updated as we make progress and as new pages/features ship. If a specific screen or flow doesn't work with your assistive technology, tell us exactly where — that's the fastest way for us to prioritize a fix.</p>
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>Found an accessibility barrier, or need this content in an alternative format? Contact us at:</p>
        <ContactBlock />
      </SectionBlock>
    </LegalLayout>
  );
}
