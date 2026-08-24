import React, { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Building2, User, LogOut, MapPin, Mail, Phone,
  Edit2, Save, X, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, CardShell, NeuCard, PageHeader } from "@/components/portal/primitives";

const ORG_TYPE_LABELS: Record<string, string> = {
  corporate: "Corporate", hospital: "Hospital / Clinic", gym: "Gym & Fitness",
  insurance: "Insurance", ngo: "NGO / Nonprofit", yoga: "Yoga / Wellness",
  school: "School / College", other: "Organization",
};

function Alert({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <NeuCard variant="flat" className={`flex items-center gap-2 px-4 py-3 text-sm font-medium mb-4 ${type === "success" ? "tone-mint" : "tone-danger"}`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
    </NeuCard>
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

  const inputCls = "w-full neu-inset rounded-xl px-3.5 py-2.5 text-sm bg-transparent focus:outline-none";

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="Configuration"
          title="Settings"
          description="Manage your organization and account settings."
        />

        <Tabs defaultValue="organization">
          <TabsList className="neu-inset h-auto flex-wrap gap-1 rounded-2xl p-1.5 bg-transparent">
            <TabsTrigger value="organization" className="rounded-xl px-4 py-2">
              <Building2 className="mr-2 size-4" /> Organization
            </TabsTrigger>
            <TabsTrigger value="account" className="rounded-xl px-4 py-2">
              <User className="mr-2 size-4" /> Account
            </TabsTrigger>
          </TabsList>

          {/* Organization */}
          <TabsContent value="organization" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
              <CardShell
                title="Organization Details"
                action={
                  !editingOrg ? (
                    <Button variant="neu" size="sm" onClick={() => { setEditingOrg(true); setOrgMsg(null); }}>
                      <Edit2 size={13} /> Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button variant="neu" size="sm" onClick={handleOrgCancel}><X size={13} /> Cancel</Button>
                      <Button variant="brand" size="sm" onClick={handleOrgSave} disabled={orgLoading}>
                        {orgLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                      </Button>
                    </div>
                  )
                }
              >
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
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg tone-primary mt-0.5">
                          <Icon size={14} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{label}</div>
                          <div className="text-sm font-medium text-foreground">{value || "—"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardShell>

              <div className="space-y-5">
                <NeuCard variant="glass" className="p-6">
                  <Avatar name={org?.name || "?"} tone="lavender" size="lg" />
                  <h3 className="mt-4 text-base font-semibold text-foreground">{org?.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{ORG_TYPE_LABELS[org?.orgType || ""]}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {org?.isVerified && <Badge variant="success">Verified</Badge>}
                    <Badge variant="soft" className="capitalize">{org?.plan || "free"}</Badge>
                  </div>
                </NeuCard>

                <CardShell title="Account Security" contentClassName="space-y-2.5">
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Organization Code</span>
                    {isPaidActive ? (
                      <span className="font-mono-data text-sm font-bold text-primary tracking-widest">{org?.orgCode || "—"}</span>
                    ) : (
                      <Badge variant="warning">Activate plan to view</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Total Seats</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{org?.usedSeats || 0} / {org?.totalSeats || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <Badge variant="soft" className="capitalize">{org?.plan || "free"}</Badge>
                  </div>
                </CardShell>
              </div>
            </div>
          </TabsContent>

          {/* Account */}
          <TabsContent value="account" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
              <div className="space-y-5">
                <CardShell title="Change Password" action={
                  !editingPwd && (
                    <Button variant="neu" size="sm" onClick={() => { setEditingPwd(true); setPwdMsg(null); }}>
                      <Edit2 size={13} /> Change
                    </Button>
                  )
                }>
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
                        <Button variant="neu" onClick={() => { setEditingPwd(false); setPwdForm({ current: "", next: "", confirm: "" }); setPwdMsg(null); }}>
                          <X size={13} /> Cancel
                        </Button>
                        <Button variant="brand" className="flex-1" onClick={handlePwdSave} disabled={pwdLoading}>
                          {pwdLoading ? <Loader2 size={15} className="animate-spin" /> : <><Save size={14} /> Save Password</>}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Change your password to keep your account secure.</p>
                  )}
                </CardShell>

                <Button variant="neu" className="w-full text-destructive" onClick={logout}>
                  <LogOut size={16} /> Sign Out
                </Button>
              </div>

              <NeuCard variant="glass" className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar name={admin?.fullName || "?"} size="lg" />
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{admin?.fullName}</div>
                    <div className="text-muted-foreground text-sm capitalize">{admin?.role}</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/60 space-y-1.5">
                  <p className="text-xs text-muted-foreground">{org?.name}</p>
                  <p className="text-xs text-muted-foreground/70">{org?.contactEmail}</p>
                </div>
              </NeuCard>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
