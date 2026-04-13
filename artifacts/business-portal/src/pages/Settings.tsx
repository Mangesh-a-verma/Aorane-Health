import React, { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Building2, User, Shield, LogOut, MapPin, Mail, Phone,
  Edit2, Save, X, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2
} from "lucide-react";

const ORG_TYPE_LABELS: Record<string, string> = {
  corporate: "Corporate", hospital: "Hospital / Clinic", gym: "Gym & Fitness",
  insurance: "Insurance", ngo: "NGO / Nonprofit", yoga: "Yoga / Wellness",
  school: "School / College", other: "Organization",
};

function Alert({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium mb-4 ${
      type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"
        : "bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400"
    }`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
    </div>
  );
}

export default function Settings() {
  const { admin, org, logout, setOrg } = useAuth();

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

  const inputCls = "w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:border-primary transition-all";

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Organization aur account manage karein</p>
        </div>

        {/* Admin Profile */}
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2.5 mb-4">
            <User size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Admin Profile</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0077B6] to-[#1B998B] flex items-center justify-center text-white font-bold text-xl">
              {admin?.fullName?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <div className="font-semibold text-foreground">{admin?.fullName}</div>
              <div className="text-muted-foreground text-sm capitalize">{admin?.role} · {org?.name}</div>
              <div className="text-muted-foreground/60 text-xs mt-0.5">{org?.contactEmail}</div>
            </div>
          </div>
        </div>

        {/* Organization Details */}
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Building2 size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Organization Details</h2>
            </div>
            {!editingOrg ? (
              <button
                onClick={() => { setEditingOrg(true); setOrgMsg(null); }}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg transition-all font-medium"
              >
                <Edit2 size={13} /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleOrgCancel} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border transition-all">
                  <X size={13} /> Cancel
                </button>
                <button
                  onClick={handleOrgSave}
                  disabled={orgLoading}
                  className="flex items-center gap-1 text-xs text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-all font-medium disabled:opacity-50"
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
                { label: "Organization Name", key: "name", icon: Building2 },
                { label: "Contact Email", key: "contactEmail", icon: Mail, type: "email" },
                { label: "Phone Number", key: "contactPhone", icon: Phone },
                { label: "City", key: "city", icon: MapPin },
                { label: "State", key: "state", icon: MapPin },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs text-muted-foreground font-medium mb-1">{label}</label>
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
                <div key={label} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <Icon size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-foreground">{value || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Change Password */}
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Lock size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Change Password</h2>
            </div>
            {!editingPwd && (
              <button
                onClick={() => { setEditingPwd(true); setPwdMsg(null); }}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg transition-all font-medium"
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
                  <label className="block text-xs text-muted-foreground font-medium mb-1">{label}</label>
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
                  className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border transition-all"
                >
                  <X size={13} /> Cancel
                </button>
                <button
                  onClick={handlePwdSave}
                  disabled={pwdLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white bg-primary hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {pwdLoading ? <Loader2 size={15} className="animate-spin" /> : <><Save size={14} /> Save Password</>}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Password change karein apni account security ke liye</p>
          )}
        </div>

        {/* Security Info */}
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2.5 mb-4">
            <Shield size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Account Security</h2>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Organization Code</span>
              <span className="font-mono text-sm font-bold text-primary tracking-widest">{org?.orgCode || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Total Seats</span>
              <span className="text-sm font-semibold text-foreground">{org?.usedSeats || 0} / {org?.totalSeats || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="text-sm font-semibold text-foreground capitalize">{org?.plan || "free"}</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-red-500 border border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 transition-all"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </Layout>
  );
}
