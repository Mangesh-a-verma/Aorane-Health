import { ShieldCheck, Lock, KeyRound, UserCog, FileClock, ShieldAlert, Server, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, InfoBox, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "overview",     num: "01", title: "Security Overview",           icon: ShieldCheck, accent: "#059669" },
  { id: "transit",      num: "02", title: "Encryption in Transit & at Rest", icon: Lock,     accent: "#0747A6" },
  { id: "auth",         num: "03", title: "Authentication & Passwords",  icon: KeyRound,    accent: "#0747A6" },
  { id: "access",       num: "04", title: "Access Control (RBAC)",       icon: UserCog,     accent: "#0747A6" },
  { id: "audit",        num: "05", title: "Audit Logging & Monitoring",  icon: FileClock,   accent: "#0747A6" },
  { id: "hardening",    num: "06", title: "Application Hardening",       icon: ShieldAlert, accent: "#0747A6" },
  { id: "infra",        num: "07", title: "Infrastructure & Hosting",    icon: Server,      accent: "#0747A6" },
  { id: "disclosure",   num: "08", title: "Reporting a Vulnerability",   icon: ShieldAlert, accent: "#D97706" },
  { id: "contact",      num: "09", title: "Contact Information",       icon: Mail,        accent: "#00B388" },
];

// Every claim on this page must be true of the current codebase — this is a
// trust/security page shown to enterprise buyers, not marketing copy. If a
// practice described here changes or is removed from the code, update this
// page in the same change.

export default function SecurityPage() {
  return (
    <LegalLayout
      path="/security"
      title="Security Practices"
      metaDescription="AORANE Security Practices — encryption, access control, audit logging, and how we protect your health data. No SOC 2/ISO 27001 certification yet; practices are described as implemented."
      badge="How We Protect Your Data"
      badgeIcon={ShieldCheck}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#059669">RBAC Enforced</Tag>
        <Tag color="#0747A6">Audit Logged</Tag>
        <Tag color="#7C3AED">AES-256-GCM</Tag>
      </>}
      sections={sections}
    >
      <SectionBlock {...sections[0]}>
        <p>
          This page describes the concrete technical and organizational measures Aorane has implemented to protect
          your data. We are not yet SOC 2 or ISO 27001 certified — the practices below are described honestly as
          implemented today, not as a certification claim, and this page is updated whenever they change.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <SubSection title="In Transit">
          <p>All traffic to Aorane's web apps and API runs over HTTPS/TLS. The API enforces a CORS allowlist restricted to our own domains, rejecting requests from unrecognized origins.</p>
        </SubSection>
        <SubSection title="At Rest">
          <p>Sensitive configuration secrets (e.g. per-feature AI provider API keys stored via Admin Panel) are encrypted at rest with AES-256-GCM, using a random IV per value and authenticated-tag verification on decrypt, so tampered ciphertext fails loudly instead of silently returning garbage.</p>
        </SubSection>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <BulletList items={[
          "Passwords are hashed with bcrypt — never stored or logged in plaintext",
          "Session and API access use signed JWTs, with separate secrets for user, admin, and business-portal tokens",
          "In staging and production, the server refuses to start unless all required JWT secrets are set to real, non-default values — there is no insecure fallback outside local development",
          "Login attempts are rate-limited per email and per IP address to slow credential-stuffing and brute-force attempts",
          "Admin login takes the same amount of time whether the email exists or not, so response timing can't be used to enumerate valid admin accounts",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>The Admin Panel enforces role-based access control with two tiers:</p>
        <BulletList items={[
          "Admin — day-to-day operational access",
          "Super Admin — required for destructive or sensitive actions: deleting an organization, granting custom pricing/discounts, managing subscriptions, changing platform/company settings, AI configuration, and plan features",
        ]} />
        <p className="mt-2">A request for a super-admin-only action from a regular admin account is rejected server-side — this is enforced in the API, not just hidden in the UI.</p>
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>
          Destructive and sensitive admin operations (deletions, pricing/discount overrides, subscription grants,
          settings changes) write an audit-log entry recording who performed the action and what changed. This gives
          us — and, on request, an enterprise customer investigating an incident — a record to review rather than
          having to reconstruct events after the fact.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <BulletList items={[
          "Security headers are set via Helmet on every API response",
          "A global rate limiter applies to all API traffic, with tighter limits on authentication endpoints specifically",
          "Request bodies are size-limited to reduce the impact of malformed or abusive payloads",
          "Marketing/analytics events pass through a privacy filter that strips health, medical, and PII-shaped fields before they ever reach Google/Meta/LinkedIn/Clarity — see our Cookie Policy",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>Infrastructure providers and their role are listed in full on our <a href="/sub-processors" className="font-semibold text-blue-700 hover:underline">Sub-processor List</a>. In summary:</p>
        <BulletList items={[
          "API hosted on Render; web front-ends on Vercel",
          "Database is managed PostgreSQL via Supabase",
          "Payment processing is handled by Razorpay — we never store raw card numbers ourselves",
          "Secrets (database URLs, JWT secrets, API keys) are set as environment variables in the hosting platform's dashboard, never committed to source control",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[7]}>
        <InfoBox color="#D97706" bg="#fffbeb" border="#fde68a" badge="Found a security issue?">
          We welcome responsible disclosure. Please report suspected vulnerabilities privately before any public
          disclosure, and avoid accessing, modifying, or deleting data that isn't yours while testing.
        </InfoBox>
        <SubSection title="How to Report">
          <p>Email <a href="mailto:security@aorane.com" className="font-semibold text-blue-700 hover:underline">security@aorane.com</a> with a description and, if possible, steps to reproduce. We aim to acknowledge reports within 3 business days. See our full <a href="/vulnerability-disclosure" className="font-semibold text-blue-700 hover:underline">Vulnerability Disclosure Policy</a> for our safe-harbor commitment and testing ground rules.</p>
        </SubSection>
      </SectionBlock>

      <SectionBlock {...sections[8]}>
        <p>Questions about our security practices, or need documentation for a vendor security review? Contact us at:</p>
        <ContactBlock email="security@aorane.com" />
      </SectionBlock>
    </LegalLayout>
  );
}
