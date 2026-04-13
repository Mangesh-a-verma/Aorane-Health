import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Shield, Calendar, Mail, Save, Eye, EyeOff, RefreshCw, AlertCircle } from "lucide-react";

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
  const [savingName, setSavingName] = useState(false);

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
    } catch (err: unknown) {
      const msg = (err as Error).message || "Failed to load profile";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSavingName(true);
    try {
      const r = await api.updateMyProfile({ fullName: fullName.trim() });
      setProfile((p) => p ? { ...p, fullName: r.admin.fullName } : p);
      if (authAdmin) login(localStorage.getItem("ap_token")!, { ...authAdmin, fullName: r.admin.fullName });
      toast({ title: "Profile updated successfully" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message || "Failed to update profile", variant: "destructive" });
    } finally {
      setSavingName(false);
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
      toast({ title: "Password changed successfully!" });
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

        {/* Profile Info Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#0077B6]/20 flex items-center justify-center">
              <User size={18} className="text-[#0077B6]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Account Information</h2>
              <p className="text-white/40 text-xs">Your admin profile details</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-white/40 text-xs flex items-center gap-1.5"><Mail size={11} /> Email</p>
              <p className="text-white text-sm font-medium">{profile?.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-white/40 text-xs flex items-center gap-1.5"><Shield size={11} /> Role</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#0077B6]/20 text-[#0077B6]">
                {profile?.role?.toUpperCase()}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-white/40 text-xs flex items-center gap-1.5"><Calendar size={11} /> Member Since</p>
              <p className="text-white text-sm">{fmt(profile?.createdAt ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-white/40 text-xs flex items-center gap-1.5"><Calendar size={11} /> Last Login</p>
              <p className="text-white text-sm">{fmt(profile?.lastLoginAt ?? null)}</p>
            </div>
          </div>
        </div>

        {/* Edit Name */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#1B998B]/20 flex items-center justify-center">
              <User size={18} className="text-[#1B998B]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Edit Name</h2>
              <p className="text-white/40 text-xs">Update your display name</p>
            </div>
          </div>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-white/60 text-xs font-medium">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1B998B]/50 focus:ring-1 focus:ring-[#1B998B]/30"
              />
            </div>
            <button
              type="submit"
              disabled={savingName || !fullName.trim() || fullName.trim() === profile?.fullName}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B998B] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#1B998B]/80 transition-colors"
            >
              <Save size={14} />
              {savingName ? "Saving..." : "Save Name"}
            </button>
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
              <Lock size={14} />
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
