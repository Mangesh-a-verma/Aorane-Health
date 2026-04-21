import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type Announcement } from "@/lib/api";
import { Send, Megaphone, Bell, Info, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const TYPES = [
  { value: "announcement", label: "Announcement", icon: Megaphone, color: "#0077B6" },
  { value: "alert",        label: "Alert",        icon: AlertTriangle, color: "#F59E0B" },
  { value: "reminder",     label: "Reminder",     icon: Bell,         color: "#10B981" },
  { value: "info",         label: "Info",         icon: Info,         color: "#6366F1" },
];

function typeIcon(type: string) {
  const found = TYPES.find(t => t.value === type);
  const Icon = found?.icon || Megaphone;
  return <Icon size={16} style={{ color: found?.color || "#0077B6" }} />;
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Communications() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({ title: "", body: "", type: "announcement" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.getAnnouncements().then(d => setAnnouncements(d.announcements)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { setError("Title and message are required"); return; }
    setSending(true); setError(""); setSuccess("");
    try {
      const d = await api.createAnnouncement(form);
      setAnnouncements(prev => [d.announcement, ...prev]);
      setSuccess(`Announcement sent to ${d.announcement.sentCount} members`);
      setForm({ title: "", body: "", type: "announcement" });
    } catch (e) { setError((e as Error).message || "Failed to send"); }
    finally { setSending(false); }
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Hero */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="pill-chip bg-primary/10 text-primary uppercase">
                <Megaphone size={11} /> Member Outreach
              </span>
            </div>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">Communications</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Send announcements and updates to your members instantly.</p>
          </div>
          <div className="rounded-2xl bg-card border border-border px-5 py-3 flex items-center gap-3">
            <Send size={16} className="text-primary" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sent</div>
              <div className="kpi-number text-2xl text-foreground">{announcements.length}</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Compose */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="text-sm font-display font-bold text-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Send size={14} className="text-primary" /> New Message
              </h2>
              {success && (
                <div className="mb-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                  <p className="text-emerald-700 text-xs">{success}</p>
                </div>
              )}
              {error && (
                <div className="mb-3 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-destructive text-xs">{error}</p>
                </div>
              )}
              <form onSubmit={handleSend} className="space-y-3.5">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => set("type", t.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                          form.type === t.value
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <t.icon size={13} style={{ color: form.type === t.value ? "#0077B6" : t.color }} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Title</label>
                  <input
                    value={form.title}
                    onChange={e => set("title", e.target.value)}
                    placeholder="Message title..."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Message</label>
                  <textarea
                    value={form.body}
                    onChange={e => set("body", e.target.value)}
                    placeholder="Write your message to members..."
                    rows={5}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-full text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
                  {sending ? "Sending..." : "Send to All Members"}
                </button>
              </form>
            </div>
          </div>

          {/* History */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-2xl">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wider">Message History</h2>
                <span className="pill-chip bg-muted text-muted-foreground tabular-nums">{announcements.length}</span>
              </div>
              {loading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/50 animate-pulse rounded-xl" />)}
                </div>
              ) : announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Megaphone size={24} className="text-muted-foreground/50" />
                  </div>
                  <p className="font-display font-semibold text-foreground">No messages sent yet</p>
                  <p className="text-muted-foreground text-xs mt-1">Your announcements will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {announcements.map(a => (
                    <div key={a.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          {typeIcon(a.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-display font-semibold text-foreground text-sm truncate">{a.title}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <Clock size={11} /> {relTime(a.createdAt)}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.body}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="pill-chip bg-muted text-muted-foreground capitalize">{a.type}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">Sent to {a.sentCount} members</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
