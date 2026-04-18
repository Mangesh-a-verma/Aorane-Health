import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Platform, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { DS } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { Mail, MessageCircle, ChevronLeft, HelpCircle, Clock, Shield, MapPin, ChevronDown, ChevronUp } from "lucide-react-native";

const CONTACT_EMAIL = "support@aorane.com";
const WHATSAPP_URL = "https://wa.me/917307826291?text=Hello%20Aorane%20Support%2C%20I%20need%20help.";
const ADDRESS = "Indra Nagar, Near Lekhraj Metro,\nLucknow, Uttar Pradesh 226016";

const FAQS = [
  {
    q: "Not receiving OTP?",
    a: "Double-check your phone number. OTP expires in 5 minutes. If the issue persists, reach out on WhatsApp or email support@aorane.com.",
  },
  {
    q: "How is the health score calculated?",
    a: "Your score is based on 5 factors — food, exercise, water, sleep, and stress. It updates daily and tracks your overall progress.",
  },
  {
    q: "Is my data safe?",
    a: "Absolutely. We use 256-bit encryption and comply with India's DPDP Act 2023. Your data is yours alone — we never share it with anyone.",
  },
  {
    q: "How do I upgrade my plan?",
    a: "Go to Profile → Upgrade Plan. We accept UPI, debit card, credit card, and net banking.",
  },
  {
    q: "How do I delete my account?",
    a: "Email support@aorane.com. Your account will be permanently deleted within 7 working days.",
  },
  {
    q: "How do I add family members?",
    a: "Go to Profile → Family Health and add members using an invite code. Up to 6 people can be in one group.",
  },
];

function openLink(url: string) {
  Linking.canOpenURL(url).then(ok => {
    if (ok) Linking.openURL(url);
    else Alert.alert("Error", "Could not open the link. Please try again.");
  });
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity onPress={() => setOpen(!open)} style={s.faqCard} activeOpacity={0.8}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={s.faqIcon}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: DS.color.primary }}>Q</Text>
        </View>
        <Text style={[s.faqQ, { flex: 1 }]}>{q}</Text>
        {open
          ? <ChevronUp size={16} color={DS.color.muted} strokeWidth={2} />
          : <ChevronDown size={16} color={DS.color.muted} strokeWidth={2} />
        }
      </View>
      {open && (
        <View style={s.faqAnswer}>
          <Text style={s.faqA}>{a}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;

  return (
    <View style={s.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: DS.color.bgSoft }]} />

      <LinearGradient
        colors={[DS.color.primary, DS.color.green]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: topPad + 12 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#FFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <HelpCircle size={28} color="#FFF" strokeWidth={2} style={{ marginBottom: 6 }} />
          <Text style={s.headerTitle}>Help & Support</Text>
          <Text style={s.headerSub}>We're here — quick responses guaranteed</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact Us */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contact Us</Text>

          {/* Email */}
          <TouchableOpacity
            style={s.contactCard}
            onPress={() => openLink(`mailto:${CONTACT_EMAIL}?subject=Aorane App Support`)}
            activeOpacity={0.8}
          >
            <LinearGradient colors={[DS.color.primary + "20", DS.color.primary + "08"]} style={s.contactIcon}>
              <Mail size={22} color={DS.color.primary} strokeWidth={2} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>Email Us</Text>
              <Text style={s.contactValue}>{CONTACT_EMAIL}</Text>
              <Text style={s.contactHint}>Response within 24 hours</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={DS.color.muted} />
          </TouchableOpacity>

          {/* WhatsApp — number visible only in WhatsApp chat, not here */}
          <TouchableOpacity
            style={[s.contactCard, { marginTop: 10 }]}
            onPress={() => openLink(WHATSAPP_URL)}
            activeOpacity={0.8}
          >
            <View style={[s.contactIcon, { backgroundColor: "#25D36620" }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>Message on WhatsApp</Text>
              <Text style={s.contactValue}>WhatsApp Support</Text>
              <Text style={s.contactHint}>Chat directly — quick response guaranteed</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={DS.color.muted} />
          </TouchableOpacity>

          {/* Live Chat — Coming Soon */}
          <View style={[s.contactCard, { marginTop: 10, opacity: 0.55 }]}>
            <View style={[s.contactIcon, { backgroundColor: DS.color.purple + "20" }]}>
              <MessageCircle size={22} color={DS.color.purple} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>Live Chat</Text>
              <Text style={s.contactValue}>Coming Soon</Text>
              <Text style={s.contactHint}>In-app live chat — coming soon</Text>
            </View>
            <View style={s.comingSoonBadge}>
              <Text style={s.comingSoonText}>Soon</Text>
            </View>
          </View>
        </View>

        {/* Our Office */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Our Office</Text>
          <TouchableOpacity
            style={s.addressCard}
            onPress={() => openLink("https://maps.google.com/?q=Indra+Nagar+Lekhraj+Metro+Lucknow")}
            activeOpacity={0.85}
          >
            <MapPin size={20} color={DS.color.orange} strokeWidth={2} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.addressText}>{ADDRESS}</Text>
              <Text style={[s.contactHint, { marginTop: 4 }]}>Tap to view on map</Text>
            </View>
            <Ionicons name="map-outline" size={16} color={DS.color.muted} />
          </TouchableOpacity>
        </View>

        {/* Support Hours */}
        <View style={s.section}>
          <View style={s.hoursCard}>
            <Clock size={18} color={DS.color.sky} strokeWidth={2} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.contactLabel, { marginBottom: 4 }]}>Support Hours</Text>
              <Text style={s.hoursText}>Monday – Saturday: 10 AM – 6 PM</Text>
              <Text style={s.hoursText}>Sunday: Closed (we check emails)</Text>
            </View>
          </View>
        </View>

        {/* FAQs */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
          {FAQS.map((faq, i) => (
            <View key={i} style={i > 0 ? { marginTop: 8 } : {}}>
              <FaqItem q={faq.q} a={faq.a} />
            </View>
          ))}
        </View>

        {/* Data safety note */}
        <View style={[s.section, { marginBottom: 0 }]}>
          <View style={s.privacyNote}>
            <Shield size={15} color={DS.color.green} strokeWidth={2} />
            <Text style={s.privacyText}>
              Your data is 100% secure. We fully comply with the DPDP Act 2023. No information is ever shared without your consent.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.color.bgCard,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: DS.color.border,
  },
  contactIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  contactLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.text,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: DS.color.primary,
    marginBottom: 2,
  },
  contactHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: DS.color.muted,
  },
  comingSoonBadge: {
    backgroundColor: DS.color.purple + "20",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.purple,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: DS.color.bgCard,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: DS.color.border,
  },
  addressText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: DS.color.text,
    lineHeight: 22,
  },
  hoursCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: DS.color.sky + "12",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: DS.color.sky + "25",
  },
  hoursText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: DS.color.text,
    lineHeight: 20,
  },
  faqCard: {
    backgroundColor: DS.color.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: DS.color.border,
  },
  faqIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: DS.color.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  faqQ: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.text,
  },
  faqAnswer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: DS.color.border,
    paddingLeft: 32,
  },
  faqA: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: DS.color.muted,
    lineHeight: 20,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: DS.color.green + "10",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: DS.color.green + "25",
    marginBottom: 16,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: DS.color.muted,
    lineHeight: 18,
  },
});
