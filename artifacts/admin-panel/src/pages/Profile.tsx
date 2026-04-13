import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Shield, Calendar, Mail, Save, Eye, EyeOff, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

type AdminProfile = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export default function Profile() {
  const { admin: authAdmin, login } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await api.getMyProfile();
      setProfile(r.admin);
      setFullName(r.admin.fullName);
      setEmail(r.admin.email);
    } catch (err: unknown) {
      const msg = (err as Error).message || "Failed to load profile";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const infoChanged =
    fullName.trim() !== (profile?.fullName ?? "") ||
    email.trim().toLowerCase() !== (profile?.email ?? "").toLowerCase();

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Full name cannot be empty", variant: "destructive" }); return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({ title: "Please enter a valid email address", variant: "destructive" }); return;
    }
    setSavingInfo(true);
    try {
      const updates: { fullName?: string; email?: string } = {};
      if (fullName.trim() !== profile?.fullName) updates.fullName = fullName.trim();
      if (email.trim().toLowerCase() !== profile?.email?.toLowerCase()) updates.email = email.trim();

      const r = await api.updateMyProfile(updates);
      setProfile((p) => p ? { ...p, fullName: r.admin.fullName, email: r.admin.email } : p);
      setFullName(r.admin.fullName);
      setEmail(r.admin.email);

      const token = localStorage.getItem("ap_token");
      if (authAdmin && token) {
        login(token, { ...authAdmin, fullName: r.admin.fullName });
      }
      toast({ title: "Profile updated successfully!" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message || "Failed to update profile", variant: "destructive" });
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Please fill all password fields", variant: "destructive" }); return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords do not match", variant: "destructive" }); return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return;
    }
    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast({ title: "Password changed successfully! Please login again if needed." });
    } catch (err: unknown) {
      toast({ title: (err as Error).message || "Failed to change password", variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  }

  function fmt(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }

  function getInitials(name: string) {
    return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2) || "A";
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-64 gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Loading profile...</p>
        </div>
      </Layout>
    );
  }

  if (loadError) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <div>
              <h2 className="text-white font-semibold mb-1">Failed to load profile</h2>
              <p className="text-white/40 text-sm">{loadError}</p>
              <p className="text-white/30 text-xs mt-2">Server may be starting up — try again in a moment</p>
            </div>
            <button
              onClick={loadProfile}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-white/50 text-sm mt-1">Manage your admin account details and password</p>
        </div>

        {/* Avatar + Account Summary Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0"
                 style={{ background: "linear-gradient(135deg,#0077B6,#1B998B)" }}>
              {getInitials(profile?.fullName ?? "A")}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-lg truncate">{profile?.fullName}</h2>
              <p className="text-white/50 text-sm truncate">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#0077B6]/20 text-[#0077B6]">
                  <Shield size={10} className="mr-1" />
                  {profile?.role?.toUpperCase()}
                </span>
                <span className="text-white/30 text-xs">
                  <Calendar size={10} className="inline mr-1" />
                  Since {fmt(profile?.createdAt ?? null)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-white/6 grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <p className="text-white/35 text-xs">Last Login</p>
              <p className="text-white text-sm">{fmt(profile?.lastLoginAt ?? null)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-white/35 text-xs">Admin ID</p>
              <p className="text-white/60 text-xs font-mono truncate">{profile?.id}</p>
            </div>
          </div>
        </div>

        {/* Edit Name + Email Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#1B998B]/20 flex items-center justify-center">
              <User size={18} className="text-[#1B998B]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Edit Profile Info</h2>
              <p className="text-white/40 text-xs">Update your name and email address</p>
            </div>
          </div>
          <form onSubmit={handleSaveInfo} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-white/60 text-xs font-medium">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1B998B]/50 focus:ring-1 focus:ring-[#1B998B]/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
                <Mail size={11} /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1B998B]/50 focus:ring-1 focus:ring-[#1B998B]/30"
              />
            </div>
            <button
              type="submit"
              disabled={savingInfo || !fullName.trim() || !infoChanged}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B998B] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#1B998B]/80 transition-colors"
            >
              {savingInfo ? (
                <><div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <><Save size={14} /> Save Changes</>
              )}
            </button>
            {!infoChanged && !savingInfo && (
              <p className="text-white/30 text-xs flex items-center gap-1.5">
                <CheckCircle2 size={11} /> Profile is up to date
              </p>
            )}
          </form>
        </div>

        {/* Change Password */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/20 flex items-center justify-center">
              <Lock size={18} className="text-[#EF4444]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Change Password</h2>
              <p className="text-white/40 text-xs">Use a strong password with 8+ characters</p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {[
              { label: "Current Password", value: currentPassword, setter: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
              { label: "New Password", value: newPassword, setter: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v) },
              { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
            ].map(({ label, value, setter, show, toggle }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-white/60 text-xs font-medium">{label}</label>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#EF4444]/50 focus:ring-1 focus:ring-[#EF4444]/30"
                  />
                  <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EF4444] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#EF4444]/80 transition-colors"
            >
              {changingPassword ? (
                <><div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> Changing...</>
              ) : (
                <><Lock size={14} /> Change Password</>
              )}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
