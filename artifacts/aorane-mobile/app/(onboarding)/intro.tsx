import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Linking, Image, Platform, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DocKey = 'terms' | 'privacy' | 'medical'; // New add
const LINKS: Record<DocKey, string> = {
  terms:    'https://aorane.com/terms',
  privacy:  'https://aorane.com/privacy',
  medical:  'https://aorane.com/medical-disclaimer',
};

const DOCS: {
  key: DocKey;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    key: 'terms',
    label: 'Terms of Service',
    description: 'Usage rules, billing, and user responsibilities',
    icon: '📄',
  },
  {
    key: 'privacy',
    label: 'Privacy Policy',
    description: 'How we collect, use, and protect your health data',
    icon: '🔒',
  },
  {
    key: 'medical',
    label: 'Medical Disclaimer',
    description: 'AI limitations and healthcare advisory notices',
    icon: '⚕️',
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const [accepted, setAccepted] = useState<Record<DocKey, boolean>>({
    terms: false,
    privacy: false,
    medical: false
  });

  const allAccepted = DOCS.every((d) => accepted[d.key]);

  const toggle = (key: DocKey) =>
    setAccepted((prev) => ({ ...prev, [key]: !prev[key] }));

  const openLink = (url: string) => Linking.openURL(url);

  const handleContinue = async () => {
    if (!allAccepted) return;
    try {
      await AsyncStorage.setItem('hasSeenIntro', 'true');
      router.replace('/(auth)/login');
    } catch (e) {
      console.error('Failed to save intro state', e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F8FF" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Logo ── */}
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/images/aorane-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* ── Sanskrit tagline ── */}
        <Text style={styles.sanskrit}>स्वस्थस्य स्वास्थ्य रक्षणं</Text>

        {/* ── Heading ── */}
        <Text style={styles.heading}>Before you begin</Text>
        <Text style={styles.subheading}>
          Please review and accept the following documents to continue using Aorane.
        </Text>

        {/* ── Consent cards ── */}
        <View style={styles.cardsWrap}>
          {DOCS.map((doc) => {
            const checked = accepted[doc.key];
            return (
              <View key={doc.key} style={[styles.card, checked && styles.cardChecked]}>
                {/* Tap whole row to toggle */}
                <TouchableOpacity
                  style={styles.cardRow}
                  activeOpacity={0.75}
                  onPress={() => toggle(doc.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`Accept ${doc.label}`}
                >
                  {/* Checkbox */}
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                    {checked && <Text style={styles.tick}>✓</Text>}
                  </View>

                  {/* Text block */}
                  <View style={styles.cardText}>
                    <Text style={styles.cardLabel}>I agree to the</Text>
                    <Text style={[styles.cardTitle, checked && styles.cardTitleChecked]}>
                      {doc.icon}  {doc.label}
                    </Text>
                    <Text style={styles.cardDesc}>{doc.description}</Text>
                  </View>
                </TouchableOpacity>

                {/* Read link — separate touch target */}
                <TouchableOpacity
                  style={styles.readBtn}
                  onPress={() => openLink(LINKS[doc.key])}
                  accessibilityRole="link"
                  accessibilityLabel={`Read ${doc.label}`}
                >
                  <Text style={styles.readText}>Read →</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ── Notice box ── */}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>⚠️  Health &amp; AI Notice</Text>
          <Text style={styles.noticeBody}>
            Aorane provides AI-powered wellness insights for informational purposes only. It is not a medical device and does not provide diagnosis or treatment. In an emergency, call{' '}
            <Text style={styles.emergencyNum}>112</Text>.
          </Text>
        </View>
      </ScrollView>

      {/* ── Fixed footer ── */}
      <View style={styles.footer}>
        {/* Progress pills */}
        <View style={styles.pills}>
          {DOCS.map((d) => (
            <View
              key={d.key}
              style={[styles.pill, accepted[d.key] && styles.pillActive]}
            />
          ))}
        </View>

        <Text style={styles.pillLabel}>
          {DOCS.filter((d) => accepted[d.key]).length} of {DOCS.length} accepted
        </Text>

        <TouchableOpacity
          style={[styles.btn, allAccepted ? styles.btnActive : styles.btnDisabled]}
          disabled={!allAccepted}
          onPress={handleContinue}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !allAccepted }}
        >
          <Text style={styles.btnText}>
            {allAccepted ? 'Continue  →' : 'Accept all to continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const BLUE   = '#1E4FD8';
const BLUE_L = '#EEF3FF';
const BLUE_M = '#3B82F6';
const NAVY   = '#0F2151';
const MUTED  = '#64748B';
const BORDER = '#D9E4F5';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F8FF',
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 24 : 36,
    paddingBottom: 160,
  },

  /* Logo */
  logoWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 160,
    height: 52,
  },

  /* Sanskrit */
  sanskrit: {
    textAlign: 'center',
    fontSize: 12,
    color: MUTED,
    letterSpacing: 0.3,
    marginBottom: 28,
  },

  /* Heading */
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: NAVY,
    textAlign: 'center',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  /* Cards */
  cardsWrap: {
    gap: 14,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  cardChecked: {
    borderColor: BLUE_M,
    backgroundColor: '#F0F6FF',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },

  /* Checkbox */
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C3D4EF',
    backgroundColor: '#F8FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  checkboxOn: {
    backgroundColor: BLUE_M,
    borderColor: BLUE_M,
  },
  tick: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },

  /* Card text */
  cardText: { flex: 1 },
  cardLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 3,
  },
  cardTitleChecked: {
    color: BLUE,
  },
  cardDesc: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
  },

  /* Read link */
  readBtn: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  readText: {
    fontSize: 13,
    fontWeight: '700',
    color: BLUE_M,
  },

  /* Notice */
  notice: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  emergencyNum: {
    fontWeight: '800',
    color: '#DC2626',
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F4F8FF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },

  /* Progress pills */
  pills: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 6,
  },
  pill: {
    height: 4,
    width: 32,
    borderRadius: 99,
    backgroundColor: '#D1DCF0',
  },
  pillActive: {
    backgroundColor: BLUE_M,
  },
  pillLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: MUTED,
    marginBottom: 12,
  },

  /* Button */
  btn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: BLUE,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  btnDisabled: {
    backgroundColor: '#B8C7E0',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});