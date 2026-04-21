import React, { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Building2, User, Shield, LogOut, MapPin, Mail, Phone,
  Edit2, Save, X, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Settings as SettingsIcon
} from "lucide-react";

const ORG_TYPE_LABELS: Record<string, string> = {
  corporate: "Corporate", hospital: "Hospital / Clinic", gym: "Gym & Fitness",
  insurance: "Insurance", ngo: "NGO / Nonprofit", yoga: "Yoga / Wellness",
  school: "School / College", other: "Organization",
};

function Alert({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium mb-4 ${
      type === "success"
        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
        : "bg-destructive/10 border border-destructive/20 text-destructive"
    }`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
    </div>
  );
}

export default function Settings() {
  const { admin, org, logout, setOrg, isPaidActive } = useAuth();

  const [editingOrg, setEditingOrg] = useState(false);
  const [orgForm, setOrgForm] = useState({
    name: org?.name || "",
    contactEmail: org?.contactEmail || "",
    contactPhone: org?.contactPhone || "",
    city: org?.city || "",
    state: org?.state || "",
  });
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgMsg, setOrgMsg] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [editingPwd, setEditingPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleOrgSave = async () => {
    setOrgLoading(true);
    setOrgMsg(null);
    try {
      const res = await api.updateSettings(orgForm);
      setOrg(res.org);
      setOrgMsg({ type: "success", msg: "Organization details updated successfully!" });
      setEditingOrg(false);
    } catch (e: unknown) {
      setOrgMsg({ type: "error", msg: (e as Error).message || "Failed to update" });
    } finally {
      setOrgLoading(false);
    }
  };

  const handleOrgCancel = () => {
    setOrgForm({
      name: org?.name || "",
      contactEmail: org?.contactEmail || "",
      contactPhone: org?.contactPhone || "",
      city: org?.city || "",
      state: org?.state || "",
    });
    setEditingOrg(false);
    setOrgMsg(null);
  };

  const handlePwdSave = async () => {
    if (!pwdForm.current || !pwdForm.next) { setPwdMsg({ type: "error", msg: "Please fill all fields" }); return; }
    if (pwdForm.next.length < 6) { setPwdMsg({ type: "error", msg: "New password must be at least 6 characters" }); return; }
    if (pwdForm.next !== pwdForm.confirm) { setPwdMsg({ type: "error", msg: "Passwords do not match" }); return; }
    setPwdLoading(true);
    setPwdMsg(null);
    try {
      await api.changePassword(pwdForm.current, pwdForm.next);
      setPwdMsg({ type: "success", msg: "Password changed successfully!" });
      setPwdForm({ current: "", next: "", confirm: "" });
      setEditingPwd(false);
    } catch (e: unknown) {
      setPwdMsg({ type: "error", msg: (e as Error).message || "Failed to change password" });
    } finally {
      setPwdLoading(false);
    }
  };

  const inputCls = "w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {/* Hero */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="pill-chip bg-primary/10 text-primary uppercase">
              <SettingsIcon size={11} /> Account
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Manage your organization and account settings.</p>
        </div>

        {/* Admin Profile */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wider">Admin Profile</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-primary flex items-center justify-center text-white font-display font-bold text-xl shadow-md ring-4 ring-card">
              {admin?.fullName?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold text-foreground truncate">{admin?.fullName}</div>
              <div className="text-muted-foreground text-sm capitalize">{admin?.role} · {org?.name}</div>
              <div className="text-muted-foreground/70 text-xs mt-0.5">{org?.contactEmail}</div>
            </div>
          </div>
        </div>

        {/* Organization Details */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wider">Organization Details</h2>
            </div>
            {!editingOrg ? (
              <button
                onClick={() => { setEditingOrg(true); setOrgMsg(null); }}
                className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-all font-semibold"
              >
                <Edit2 size={13} /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleOrgCancel} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border transition-all">
                  <X size={13} /> Cancel
                </button>
                <button
                  onClick={handleOrgSave}
                  disabled={orgLoading}
                  className="flex items-center gap-1 text-xs text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-full transition-all font-semibold disabled:opacity-50"
                >
                  {orgLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                </button>
              </div>
            )}
          </div>

          {orgMsg && <Alert type={orgMsg.type} msg={orgMsg.msg} />}

          {editingOrg ? (
            <div className="space-y-3">
              {[
                { label: "Organization Name", key: "name" },
                { label: "Contact Email", key: "contactEmail", type: "email" },
                { label: "Phone Number", key: "contactPhone" },
                { label: "City", key: "city" },
                { label: "State", key: "state" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</label>
                  <input
                    type={type || "text"}
                    value={orgForm[key as keyof typeof orgForm]}
                    onChange={e => setOrgForm(f => ({ ...f, [key]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { icon: Building2, label: "Name", value: org?.name },
                { icon: Building2, label: "Type", value: ORG_TYPE_LABELS[org?.orgType || ""] },
                { icon: Mail, label: "Contact Email", value: org?.contactEmail },
                { icon: Phone, label: "Phone", value: org?.contactPhone || "Not provided" },
                { icon: MapPin, label: "Location", value: [org?.city, org?.state].filter(Boolean).join(", ") || "Not provided" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-foreground">{value || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Change Password */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-primary" />
              <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wider">Change Password</h2>
            </div>
            {!editingPwd && (
              <button
                onClick={() => { setEditingPwd(true); setPwdMsg(null); }}
                className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-all font-semibold"
              >
                <Edit2 size={13} /> Change
              </button>
            )}
          </div>

          {pwdMsg && <Alert type={pwdMsg.type} msg={pwdMsg.msg} />}

          {editingPwd ? (
            <div className="space-y-3">
              {[
                { label: "Current Password", key: "current" as const },
                { label: "New Password", key: "next" as const },
                { label: "Confirm New Password", key: "confirm" as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</label>
                  <div className="relative">
                    <input
                      type={showPwd[key] ? "text" : "password"}
                      value={pwdForm[key]}
                      onChange={e => setPwdForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder="••••••••"
                      className={inputCls + " pr-10"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(s => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPwd[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setEditingPwd(false); setPwdForm({ current: "", next: "", confirm: "" }); setPwdMsg(null); }}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-full text-sm text-muted-foreground hover:text-foreground border border-border transition-all"
                >
                  <X size={13} /> Cancel
                </button>
                <button
                  onClick={handlePwdSave}
                  disabled={pwdLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-sm text-primary-foreground bg-primary hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {pwdLoading ? <Loader2 size={15} className="animate-spin" /> : <><Save size={14} /> Save Password</>}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Change your password to keep your account secure.</p>
          )}
        </div>

        {/* Security Info */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wider">Account Security</h2>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Organization Code</span>
              {isPaidActive ? (
                <span className="font-mono-data text-sm font-bold text-primary tracking-widest">{org?.orgCode || "—"}</span>
              ) : (
                <span className="pill-chip bg-amber-50 text-amber-700">Activate plan to view</span>
              )}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Total Seats</span>
              <span className="text-sm font-display font-semibold text-foreground tabular-nums">{org?.usedSeats || 0} / {org?.totalSeats || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="pill-chip bg-primary/10 text-primary capitalize">{org?.plan || "free"}</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm text-destructive border border-destructive/30 hover:bg-destructive/5 transition-all"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </Layout>
  );
}
