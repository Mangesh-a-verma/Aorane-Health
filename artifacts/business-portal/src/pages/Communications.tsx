import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type Announcement } from "@/lib/api";
import { Send, Megaphone, Bell, Info, AlertTriangle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardShell, EmptyState, NeuCard, PageHeader } from "@/components/portal/primitives";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "announcement", label: "Announcement", icon: Megaphone, tone: "tone-primary" },
  { value: "alert",        label: "Alert",        icon: AlertTriangle, tone: "tone-amber" },
  { value: "reminder",     label: "Reminder",     icon: Bell,         tone: "tone-mint" },
  { value: "info",         label: "Info",         icon: Info,         tone: "tone-lavender" },
];

function typeIcon(type: string) {
  const found = TYPES.find(t => t.value === type);
  const Icon = found?.icon || Megaphone;
  return <Icon size={16} />;
}

function typeTone(type: string) {
  return TYPES.find(t => t.value === type)?.tone || "tone-primary";
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="People"
          title="Communications"
          description="Send announcements and updates to your members instantly."
          actions={<Badge variant="soft"><Send size={11} /> {announcements.length} sent</Badge>}
        />

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Compose */}
          <div className="lg:col-span-2">
            <CardShell title="New Message" contentClassName="space-y-3.5">
              {success && (
                <NeuCard variant="flat" className="flex items-center gap-2 p-3 tone-mint">
                  <CheckCircle size={15} className="shrink-0" />
                  <p className="text-xs">{success}</p>
                </NeuCard>
              )}
              {error && (
                <NeuCard variant="flat" className="p-3 tone-danger">
                  <p className="text-xs">{error}</p>
                </NeuCard>
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
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                          form.type === t.value ? "neu text-primary" : "neu-flat text-muted-foreground",
                        )}
                      >
                        <t.icon size={13} />
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
                    className="w-full neu-inset rounded-xl px-3.5 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Message</label>
                  <textarea
                    value={form.body}
                    onChange={e => set("body", e.target.value)}
                    placeholder="Write your message to members..."
                    rows={5}
                    className="w-full neu-inset rounded-xl px-3.5 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground resize-none"
                  />
                </div>
                <Button type="submit" variant="brand" className="w-full" disabled={sending}>
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? "Sending..." : "Send to All Members"}
                </Button>
              </form>
            </CardShell>
          </div>

          {/* History */}
          <div className="lg:col-span-3">
            <CardShell
              title="Message History"
              action={<Badge variant="outline">{announcements.length}</Badge>}
              contentClassName="p-0"
            >
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 neu-inset-sm animate-pulse rounded-2xl" />)}
                </div>
              ) : announcements.length === 0 ? (
                <EmptyState icon={<Megaphone />} title="No messages sent yet" description="Your announcements will appear here" />
              ) : (
                <div className="space-y-3">
                  {announcements.map(a => (
                    <NeuCard key={a.id} variant="flat" className="p-4">
                      <div className="flex items-start gap-3">
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", typeTone(a.type))}>
                          {typeIcon(a.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-foreground text-sm truncate">{a.title}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <Clock size={11} /> {relTime(a.createdAt)}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.body}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="capitalize">{a.type}</Badge>
                            <span className="text-[10px] text-muted-foreground tabular-nums">Sent to {a.sentCount} members</span>
                          </div>
                        </div>
                      </div>
                    </NeuCard>
                  ))}
                </div>
              )}
            </CardShell>
          </div>
        </div>
      </div>
    </Layout>
  );
}
