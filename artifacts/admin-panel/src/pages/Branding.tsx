import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Palette, FileImage, BarChart3, Save, RefreshCw,
  Globe, Phone, Mail, MapPin, Tag, Upload, Eye, Link2, FileText,
  CheckCircle2, Loader2, Twitter, Linkedin, Instagram, Youtube, Facebook, Smartphone, Apple,
} from "lucide-react";

type CompanySettings = {
  companyName: string; companyLogoUrl: string | null; tagline: string | null;
  website: string | null; supportPhone: string | null; supportEmail: string | null;
  address: string | null; primaryColor: string; accentColor: string;
  scorecardShowQr: boolean; scorecardShowBloodGroup: boolean; scorecardShowBmi: boolean;
  scorecardShowActivePercent: boolean; scorecardBgGradientFrom: string;
  scorecardBgGradientTo: string; reportHeaderText: string | null;
  reportFooterText: string | null; reportLogoUrl: string | null;
  weeklyReportEnabled: boolean; monthlyReportEnabled: boolean;
  socialTwitter: string | null; socialLinkedin: string | null;
  socialInstagram: string | null; socialYoutube: string | null; socialFacebook: string | null;
  investorDeckUrl: string | null;
  androidPlayStoreUrl: string | null; iosAppStoreUrl: string | null;
};

const DEFAULTS: CompanySettings = {
  companyName: "Aorane", companyLogoUrl: null, tagline: "Your Health, In Your Hands",
  website: "aorane.com", supportPhone: "+917307826291", supportEmail: "support@aorane.com", address: "Indra Nagar, Near Lekhraj Metro, Lucknow, Uttar Pradesh 226016",
  primaryColor: "#0077B6", accentColor: "#00B896",
  scorecardShowQr: true, scorecardShowBloodGroup: true, scorecardShowBmi: true,
  scorecardShowActivePercent: true, scorecardBgGradientFrom: "#023E8A", scorecardBgGradientTo: "#1B998B",
  reportHeaderText: null, reportFooterText: null, reportLogoUrl: null,
  weeklyReportEnabled: true, monthlyReportEnabled: true,
  socialTwitter: null, socialLinkedin: null, socialInstagram: null, socialYoutube: null, socialFacebook: null,
  investorDeckUrl: null,
  androidPlayStoreUrl: "https://play.google.com/store/apps/details?id=in.aorane.app", iosAppStoreUrl: null,
};

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={17} className="text-primary" />
      </div>
      <div>
        <div className="font-semibold text-foreground text-sm">{title}</div>
        <div className="text-muted-foreground text-xs mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{label}</span>
      <button onClick={() => onChange(!checked)}
        className={`w-10 h-5.5 relative rounded-full transition-all ${checked ? "bg-primary" : "bg-muted"}`}
        style={{ minWidth: 40, height: 22 }}>
        <span className={`absolute top-0.5 transition-all w-5 h-5 bg-white rounded-full shadow-sm ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export default function BrandingPage() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getCompanySettings();
      setSettings({ ...DEFAULTS, ...data.settings });
    } catch { }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateCompanySettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "Settings saved!", description: "Company branding updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to save settings. Please try again.", variant: "destructive" });
    }
    setSaving(false);
  };

  const set = (key: keyof CompanySettings, val: unknown) => setSettings((s) => ({ ...s, [key]: val }));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={28} className="text-primary animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Branding & Templates</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure company name, logo and report templates — reflects on all user scorecards and reports.
            </p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── COMPANY IDENTITY ── */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionHeader icon={Building2} title="Company Identity"
              desc="Name, logo and basic info — shown in scorecard footer and reports" />
            <div className="space-y-4">
              <Field label="Company Name *">
                <Input value={settings.companyName} onChange={(v) => set("companyName", v)} placeholder="e.g. Aorane" />
              </Field>
              <Field label="Tagline">
                <Input value={settings.tagline || ""} onChange={(v) => set("tagline", v)} placeholder="e.g. Your Health, In Your Hands" />
              </Field>
              <Field label="Company Logo URL">
                <Input value={settings.companyLogoUrl || ""} onChange={(v) => set("companyLogoUrl", v || null)} placeholder="https://yourcompany.com/logo.png" />
                {settings.companyLogoUrl && (
                  <div className="mt-2 p-3 bg-muted/40 rounded-lg flex items-center gap-3">
                    <img src={settings.companyLogoUrl} alt="Logo preview" className="h-10 w-10 object-contain rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-xs text-muted-foreground">Logo preview</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Link2 size={10} />
                  Any publicly accessible image URL (PNG/SVG recommended)
                </p>
              </Field>
              <Field label="Website">
                <Input value={settings.website || ""} onChange={(v) => set("website", v || null)} placeholder="aorane.com" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Support Phone">
                  <Input value={settings.supportPhone || ""} onChange={(v) => set("supportPhone", v || null)} placeholder="+91 98765 43210" />
                </Field>
                <Field label="Support Email">
                  <Input value={settings.supportEmail || ""} onChange={(v) => set("supportEmail", v || null)} placeholder="support@aorane.in" />
                </Field>
              </div>
              <Field label="Address (for reports)">
                <textarea value={settings.address || ""} onChange={(e) => set("address", e.target.value || null)}
                  placeholder="123, Health Tower, Mumbai, Maharashtra - 400001"
                  rows={2}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none" />
              </Field>
            </div>
          </div>

          {/* ── SOCIAL MEDIA ── */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionHeader icon={Globe} title="Social Media URLs"
              desc="Public links — shown in landing page & business portal footer. Leave blank to hide that icon." />
            <div className="space-y-3">
              <Field label={<><Twitter size={12} className="inline mr-1" />Twitter / X</>}>
                <Input value={settings.socialTwitter || ""} onChange={(v) => set("socialTwitter", v || null)} placeholder="https://twitter.com/aorane" />
              </Field>
              <Field label={<><Linkedin size={12} className="inline mr-1" />LinkedIn</>}>
                <Input value={settings.socialLinkedin || ""} onChange={(v) => set("socialLinkedin", v || null)} placeholder="https://linkedin.com/company/aorane" />
              </Field>
              <Field label={<><Instagram size={12} className="inline mr-1" />Instagram</>}>
                <Input value={settings.socialInstagram || ""} onChange={(v) => set("socialInstagram", v || null)} placeholder="https://instagram.com/aorane" />
              </Field>
              <Field label={<><Youtube size={12} className="inline mr-1" />YouTube</>}>
                <Input value={settings.socialYoutube || ""} onChange={(v) => set("socialYoutube", v || null)} placeholder="https://youtube.com/@aorane" />
              </Field>
              <Field label={<><Facebook size={12} className="inline mr-1" />Facebook</>}>
                <Input value={settings.socialFacebook || ""} onChange={(v) => set("socialFacebook", v || null)} placeholder="https://facebook.com/aorane" />
              </Field>
            </div>
          </div>

          {/* ── MARKETING & MOBILE INSTALL ── */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionHeader icon={FileText} title="Marketing & Mobile Install"
              desc="Investor deck PDF link & mobile app store URLs — used by Pricing CTA and Business Portal." />
            <div className="space-y-4">
              <Field label="Investor Deck URL (PDF)">
                <Input value={settings.investorDeckUrl || ""} onChange={(v) => set("investorDeckUrl", v || null)} placeholder="https://drive.google.com/file/d/.../view" />
                <p className="text-xs text-muted-foreground mt-1.5">Leads will be captured first, then redirected to this URL for download.</p>
              </Field>
              <Field label={<><Smartphone size={12} className="inline mr-1" />Android — Play Store URL</>}>
                <Input value={settings.androidPlayStoreUrl || ""} onChange={(v) => set("androidPlayStoreUrl", v || null)} placeholder="https://play.google.com/store/apps/details?id=in.aorane.app" />
              </Field>
              <Field label={<><Apple size={12} className="inline mr-1" />iOS — App Store URL (leave blank if Coming Soon)</>}>
                <Input value={settings.iosAppStoreUrl || ""} onChange={(v) => set("iosAppStoreUrl", v || null)} placeholder="https://apps.apple.com/app/idXXXXXXXX" />
              </Field>
            </div>
          </div>

          {/* ── BRAND COLORS ── */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <SectionHeader icon={Palette} title="Brand Colors"
                desc="Primary aur accent color — scorecard gradient pe use hoga" />
              <div className="space-y-4">
                <Field label="Primary Color">
                  <div className="flex gap-3 items-center">
                    <input type="color" value={settings.primaryColor}
                      onChange={(e) => set("primaryColor", e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                    <Input value={settings.primaryColor} onChange={(v) => set("primaryColor", v)} placeholder="#0077B6" />
                  </div>
                </Field>
                <Field label="Accent Color">
                  <div className="flex gap-3 items-center">
                    <input type="color" value={settings.accentColor}
                      onChange={(e) => set("accentColor", e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                    <Input value={settings.accentColor} onChange={(v) => set("accentColor", v)} placeholder="#00B896" />
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Scorecard Gradient: Start">
                    <div className="flex gap-2 items-center">
                      <input type="color" value={settings.scorecardBgGradientFrom}
                        onChange={(e) => set("scorecardBgGradientFrom", e.target.value)}
                        className="w-9 h-9 rounded-lg border border-border cursor-pointer shrink-0" />
                      <Input value={settings.scorecardBgGradientFrom} onChange={(v) => set("scorecardBgGradientFrom", v)} placeholder="#023E8A" />
                    </div>
                  </Field>
                  <Field label="Scorecard Gradient: End">
                    <div className="flex gap-2 items-center">
                      <input type="color" value={settings.scorecardBgGradientTo}
                        onChange={(e) => set("scorecardBgGradientTo", e.target.value)}
                        className="w-9 h-9 rounded-lg border border-border cursor-pointer shrink-0" />
                      <Input value={settings.scorecardBgGradientTo} onChange={(v) => set("scorecardBgGradientTo", v)} placeholder="#1B998B" />
                    </div>
                  </Field>
                </div>
                {/* Live Preview */}
                <div className="rounded-xl overflow-hidden h-12"
                  style={{ background: `linear-gradient(135deg, ${settings.scorecardBgGradientFrom}, ${settings.scorecardBgGradientTo})` }}>
                  <div className="h-full flex items-center px-4">
                    <span className="text-white font-bold text-sm tracking-widest opacity-90">{settings.companyName.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SCORECARD SETTINGS ── */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <SectionHeader icon={Eye} title="Scorecard Fields"
                desc="Choose which fields are visible on the user's scorecard card" />
              <div className="divide-y divide-border">
                <Toggle checked={settings.scorecardShowQr} onChange={(v) => set("scorecardShowQr", v)} label="Show Play Store QR Code" />
                <Toggle checked={settings.scorecardShowBloodGroup} onChange={(v) => set("scorecardShowBloodGroup", v)} label="Show Blood Group" />
                <Toggle checked={settings.scorecardShowBmi} onChange={(v) => set("scorecardShowBmi", v)} label="Show BMI" />
                <Toggle checked={settings.scorecardShowActivePercent} onChange={(v) => set("scorecardShowActivePercent", v)} label="Show Active Percentage" />
              </div>
            </div>
          </div>

          {/* ── REPORT SETTINGS ── */}
          <div className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
            <SectionHeader icon={BarChart3} title="Health Report Templates"
              desc="Configure header, footer and branding for weekly and monthly reports. Reports will be generated in medical report style." />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="divide-y divide-border">
                  <Toggle checked={settings.weeklyReportEnabled} onChange={(v) => set("weeklyReportEnabled", v)} label="Enable Weekly Reports" />
                  <Toggle checked={settings.monthlyReportEnabled} onChange={(v) => set("monthlyReportEnabled", v)} label="Enable Monthly Reports" />
                </div>
                <Field label="Report Logo URL (optional — overrides Company Logo)">
                  <Input value={settings.reportLogoUrl || ""} onChange={(v) => set("reportLogoUrl", v || null)} placeholder="Leave blank to use Company Logo" />
                </Field>
              </div>
              <div className="space-y-4">
                <Field label="Report Header Text">
                  <textarea value={settings.reportHeaderText || ""}
                    onChange={(e) => set("reportHeaderText", e.target.value || null)}
                    placeholder={`${settings.companyName}\n${settings.website || "aorane.com"}\nConfidential Health Report`}
                    rows={4}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none" />
                  <p className="text-xs text-muted-foreground mt-1">Shown at the top of the report. Leave blank for auto-generated.</p>
                </Field>
              </div>
              <div className="space-y-4">
                <Field label="Report Footer Text">
                  <textarea value={settings.reportFooterText || ""}
                    onChange={(e) => set("reportFooterText", e.target.value || null)}
                    placeholder={`This report is generated by ${settings.companyName}.\nFor queries: ${settings.supportEmail || settings.supportPhone || settings.website || "aorane.com"}`}
                    rows={4}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none" />
                  <p className="text-xs text-muted-foreground mt-1">Shown at the bottom of the report. Leave blank for auto-generated.</p>
                </Field>

                {/* Report preview hint */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <FileText size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-amber-700 dark:text-amber-400 text-xs font-medium">Custom Template Coming Soon</p>
                      <p className="text-amber-600/80 dark:text-amber-500/80 text-xs mt-0.5">
                        You will soon be able to upload your own PDF/image template. For now, auto-generated medical report format is used with your company branding applied.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Save */}
        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-primary text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save All Changes"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
