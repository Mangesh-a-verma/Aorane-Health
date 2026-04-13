import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Platform, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { DS } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { Mail, Phone, MapPin, MessageCircle, ChevronLeft, HelpCircle, Clock, Shield } from "lucide-react-native";

const CONTACT_EMAIL = "support@aorane.com";
const CONTACT_PHONE = "+917307826291";
const CONTACT_PHONE_DISPLAY = "+91 73078 26291";
const ADDRESS = "Indra Nagar, Near Lekhraj Metro,\nLucknow, Uttar Pradesh 226016";

const FAQS = [
  { q: "OTP nahi aa raha?", a: "Apna number check karo. OTP 5 minute mein expire hota hai. Problems ho to support@aorane.com pe email karo." },
  { q: "Health score calculate kaise hota hai?", a: "Aapka score 5 cheezein se banta hai: food, exercise, water, sleep, aur stress. Roz update hota hai." },
  { q: "Data safe hai?", a: "Haan. 256-bit encryption aur India ka DPDP Act 2023 — aapka data sirf aapka hai." },
  { q: "Plan upgrade kaise karein?", a: "Profile → Upgrade Plan pe jao. UPI, card, net banking sab accept hote hain." },
  { q: "Account delete karna ho?", a: "support@aorane.com pe email karo, 7 working days mein delete ho jayega." },
];

function openLink(url: string) {
  Linking.canOpenURL(url).then(ok => {
    if (ok) Linking.openURL(url);
    else Alert.alert("Error", "Link open nahi ho saka");
  });
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={s.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: DS.color.bgSoft }]} />

      {/* Header */}
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
          <Text style={s.headerSub}>Hum yahan hain aapki madad ke liye</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact Options */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Hamse Sampark Karo</Text>

          {/* Email */}
          <TouchableOpacity
            style={s.contactCard}
            onPress={() => openLink(`mailto:${CONTACT_EMAIL}?subject=AORANE App Support`)}
            activeOpacity={0.8}
          >
            <LinearGradient colors={[DS.color.primary + "20", DS.color.primary + "08"]} style={s.contactIcon}>
              <Mail size={22} color={DS.color.primary} strokeWidth={2} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>Email Support</Text>
              <Text style={s.contactValue}>{CONTACT_EMAIL}</Text>
              <Text style={s.contactHint}>Reply milega 24 ghante mein</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={DS.color.muted} />
          </TouchableOpacity>

          {/* Phone */}
          <TouchableOpacity
            style={[s.contactCard, { marginTop: 10 }]}
            onPress={() => openLink(`tel:${CONTACT_PHONE}`)}
            activeOpacity={0.8}
          >
            <LinearGradient colors={[DS.color.green + "20", DS.color.green + "08"]} style={s.contactIcon}>
              <Phone size={22} color={DS.color.green} strokeWidth={2} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>Phone / WhatsApp</Text>
              <Text style={s.contactValue}>{CONTACT_PHONE_DISPLAY}</Text>
              <Text style={s.contactHint}>Mon–Sat, 10 AM – 6 PM</Text>
            </View>
            <Ionicons name="call-outline" size={16} color={DS.color.muted} />
          </TouchableOpacity>

          {/* WhatsApp */}
          <TouchableOpacity
            style={[s.contactCard, { marginTop: 10 }]}
            onPress={() => openLink(`https://wa.me/917307826291?text=Hello AORANE Support`)}
            activeOpacity={0.8}
          >
            <View style={[s.contactIcon, { backgroundColor: "#25D36620" }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>WhatsApp</Text>
              <Text style={s.contactValue}>{CONTACT_PHONE_DISPLAY}</Text>
              <Text style={s.contactHint}>Message bhejo, jaldi reply milega</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={DS.color.muted} />
          </TouchableOpacity>

          {/* Chat Coming Soon */}
          <View style={[s.contactCard, { marginTop: 10, opacity: 0.6 }]}>
            <View style={[s.contactIcon, { backgroundColor: DS.color.purple + "20" }]}>
              <MessageCircle size={22} color={DS.color.purple} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>Live Chat</Text>
              <Text style={s.contactValue}>Coming Soon</Text>
              <Text style={s.contactHint}>App ke andar hi chat milega jald hi</Text>
            </View>
            <View style={s.comingSoonBadge}>
              <Text style={s.comingSoonText}>Soon</Text>
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Hamare Office</Text>
          <TouchableOpacity
            style={s.addressCard}
            onPress={() => openLink("https://maps.google.com/?q=Indra+Nagar+Lekhraj+Metro+Lucknow")}
            activeOpacity={0.85}
          >
            <MapPin size={20} color={DS.color.orange} strokeWidth={2} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.addressText}>{ADDRESS}</Text>
              <Text style={[s.contactHint, { marginTop: 4 }]}>Maps pe dekhne ke liye tap karo</Text>
            </View>
            <Ionicons name="map-outline" size={16} color={DS.color.muted} />
          </TouchableOpacity>
        </View>

        {/* Support Hours */}
        <View style={[s.section]}>
          <View style={s.hoursCard}>
            <Clock size={18} color={DS.color.sky} strokeWidth={2} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.contactLabel, { marginBottom: 4 }]}>Support Hours</Text>
              <Text style={s.hoursText}>Monday – Saturday: 10:00 AM – 6:00 PM</Text>
              <Text style={s.hoursText}>Sunday: Closed (Email ke liye check karte hain)</Text>
            </View>
          </View>
        </View>

        {/* FAQs */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Aksar Puche Jane Wale Sawaal</Text>
          {FAQS.map((faq, i) => (
            <View key={i} style={[s.faqCard, i > 0 && { marginTop: 8 }]}>
              <Text style={s.faqQ}>Q: {faq.q}</Text>
              <Text style={s.faqA}>{faq.a}</Text>
            </View>
          ))}
        </View>

        {/* Privacy note */}
        <View style={[s.section, { marginBottom: 0 }]}>
          <View style={s.privacyNote}>
            <Shield size={15} color={DS.color.green} strokeWidth={2} />
            <Text style={s.privacyText}>
              Aapka data 100% private hai. DPDP Act 2023 compliant. Koi bhi data bina permission ke share nahi hoga.
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
    fontSize: 13,
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
  faqQ: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.text,
    marginBottom: 6,
  },
  faqA: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: DS.color.muted,
    lineHeight: 19,
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
