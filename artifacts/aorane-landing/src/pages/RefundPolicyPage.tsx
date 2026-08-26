import { RefreshCw, CreditCard, Ban, Truck, Clock, AlertTriangle, Mail } from "lucide-react";
import {
  LegalLayout, SectionBlock, SubSection, BulletList, Tag, WarningBox, ContactBlock,
  type LegalSectionMeta,
} from "@/components/legal/LegalLayout";

const sections: LegalSectionMeta[] = [
  { id: "scope",        num: "01", title: "Scope",                       icon: RefreshCw,   accent: "#0747A6" },
  { id: "cancellation", num: "02", title: "Cancelling Your Subscription", icon: Ban,         accent: "#0747A6" },
  { id: "refunds",      num: "03", title: "Refund Eligibility",          icon: CreditCard,  accent: "#0747A6" },
  { id: "timelines",    num: "04", title: "Refund Timelines",            icon: Clock,       accent: "#0747A6" },
  { id: "delivery",     num: "05", title: "Delivery of Services",        icon: Truck,       accent: "#059669" },
  { id: "disputes",     num: "06", title: "Billing Disputes",            icon: AlertTriangle, accent: "#D97706" },
  { id: "contact",      num: "07", title: "Contact Information",        icon: Mail,        accent: "#00B388" },
];

export default function RefundPolicyPage() {
  return (
    <LegalLayout
      path="/refund-policy"
      title="Refund & Cancellation Policy"
      metaDescription="AORANE Refund, Cancellation & Delivery Policy — how to cancel your subscription, when refunds apply, and how our digital service is delivered."
      badge="Consumer Protection (E-Commerce) Rules 2020 Aligned"
      badgeIcon={RefreshCw}
      lastUpdated="August 2026"
      heroTags={<>
        <Tag color="#00B388">Digital Subscription Service</Tag>
        <Tag color="#0747A6">India Jurisdiction</Tag>
      </>}
      sections={sections}
    >
      <SectionBlock {...sections[0]}>
        <p>
          This policy explains how cancellations and refunds work for Aorane's paid subscriptions, and how our
          digital service is delivered. It supplements — and does not replace — Section 8 ("Subscriptions, Billing &
          Cancellations") of our{" "}
          <a href="/terms" className="font-semibold text-blue-700 hover:underline">Terms of Service</a>. Where the two
          differ, this page reflects our current, more detailed practice.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[1]}>
        <p>You may cancel your Aorane subscription at any time, at no additional charge:</p>
        <BulletList items={[
          "In-app: Account → Subscription → Cancel Subscription",
          "Via the app store you subscribed through (Google Play Store or Apple App Store) if you purchased there",
          "By emailing support@aorane.com with your registered account email",
        ]} />
        <p className="text-xs text-gray-500 mt-2 italic">
          Cancelling stops future renewals. It does not, by itself, refund the current billing period — see Refund
          Eligibility below.
        </p>
      </SectionBlock>

      <SectionBlock {...sections[2]}>
        <SubSection title="3.1 — General Rule">
          <p>Subscription fees are non-refundable once a billing period has started, except in the circumstances below or where required by applicable law.</p>
        </SubSection>
        <SubSection title="3.2 — Refunds We Do Provide">
          <BulletList items={[
            "A duplicate charge caused by a payment or billing system error on our side",
            "A charge taken after you had already successfully cancelled",
            "A material, verified service failure that made the paid features unusable for an extended period",
          ]} />
        </SubSection>
        <SubSection title="3.3 — Refunds We Do Not Provide">
          <BulletList items={[
            "Partial-month or partial-year refunds for early cancellation",
            "Refunds for not using the app during an active billing period",
            "Refunds requested after 7 days from the charge date, except where required by law",
          ]} />
        </SubSection>
        <WarningBox>
          If you subscribed via the Google Play Store or Apple App Store, that store's own refund policy and process
          applies to the purchase, and refunds must be requested through the store — Aorane cannot directly reverse
          an app-store charge.
        </WarningBox>
      </SectionBlock>

      <SectionBlock {...sections[3]}>
        <p>Where a refund is approved:</p>
        <BulletList items={[
          "We confirm the decision by email within 5 business days of your request",
          "Approved refunds are issued to the original payment method via Razorpay (or the relevant app store) within 7–10 business days of approval",
          "Bank/card processing after that point is outside our control and depends on your bank or payment provider",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[4]}>
        <p>
          Aorane is a purely digital, subscription-based software service — there is no physical product and nothing
          is shipped. Access to paid features is delivered instantly and electronically:
        </p>
        <BulletList items={[
          "Paid features unlock in your account immediately after successful payment confirmation",
          "If a payment succeeds but paid features don't unlock within a few minutes, contact support@aorane.com with your payment reference — no separate 'delivery' step exists to fail independently of payment",
          "There is no shipping charge, delivery address, or courier timeline applicable to any Aorane plan",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[5]}>
        <p>If you believe you were charged incorrectly, contact us before disputing the charge with your bank — most billing issues are resolved faster this way:</p>
        <BulletList items={[
          "Email support@aorane.com with your registered email, the amount, and the approximate charge date",
          "We investigate and respond within 5 business days",
          "If unresolved, either party may pursue the dispute-resolution process in Section 13 of the Terms of Service",
        ]} />
      </SectionBlock>

      <SectionBlock {...sections[6]}>
        <p>Questions about a charge, cancellation, or refund? Contact us at:</p>
        <ContactBlock />
      </SectionBlock>
    </LegalLayout>
  );
}
