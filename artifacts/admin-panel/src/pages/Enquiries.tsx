import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type Enquiry } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Building2, MessageSquare, Loader2, RefreshCw, Trash2, Inbox, Briefcase, FileText, User, Bell, CalendarDays, Users, AlertTriangle } from "lucide-react";

const TYPE_LABEL: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  expert:         { label: "Talk to Expert",  color: "#0077B6", icon: MessageSquare },
  investor_deck:  { label: "Investor Deck",   color: "#8B5CF6", icon: FileText },
  general:        { label: "General",         color: "#6b7280", icon: Inbox },
  notify_me:      { label: "Notify Me Lead",  color: "#E85D26", icon: Bell },
};
const STATUS_COLOR: Record<string, string> = { new: "#F59E0B", contacted: "#0077B6", closed: "#10B981" };

function parseNotifyMeta(message?: string | null): { age?: string; gender?: string; feature?: string } {
  if (!message) return {};
  try { return JSON.parse(message); } catch { return {}; }
}

export default function EnquiriesPage() {
  const [list, setList] = useState<Enquiry[]>([]);
  const [stats, setStats] = useState({ total: 0, newCount: 0, contactedCount: 0, closedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [rowUpdating, setRowUpdating] = useState<Record<string, boolean>>({});
  const [rowDeleting, setRowDeleting] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.enquiries({ status: statusFilter || undefined, type: typeFilter || undefined });
      setList(data.enquiries ?? []);
      setStats(data.stats ?? { total: 0, newCount: 0, contactedCount: 0, closedCount: 0 });
    } catch (e: unknown) {
      const msg = (e as Error).message || "Failed to load enquiries";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, typeFilter]);

  const updateStatus = async (id: string, status: "new" | "contacted" | "closed") => {
    setRowUpdating(r => ({ ...r, [id]: true }));
    try {
      await api.updateEnquiry(id, status);
      setList((l) => l.map((e) => (e.id === id ? { ...e, status } : e)));
      if (selected?.id === id) setSelected({ ...selected, status });
      toast({ title: "Updated", description: `Marked as ${status}` });
    } catch {
      toast({ title: "Error", description: "Status update failed. Please retry.", variant: "destructive" });
    } finally {
      setRowUpdating(r => { const n = { ...r }; delete n[id]; return n; });
    }
  };

  const remove = async (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm;
    setDeleteConfirm(null);
    setRowDeleting(r => ({ ...r, [id]: true }));
    try {
      await api.deleteEnquiry(id);
      setList((l) => l.filter((e) => e.id !== id));
      if (selected?.id === id) setSelected(null);
      toast({ title: "Deleted", description: "Enquiry removed successfully" });
    } catch {
      toast({ title: "Error", description: "Delete failed. Please retry.", variant: "destructive" });
    } finally {
      setRowDeleting(r => { const n = { ...r }; delete n[id]; return n; });
    }
  };

  const notifyLeadsCount = list.filter((e) => e.type === "notify_me").length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Enquiries & Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">Talk-to-Expert, Notify Me leads, Investor Deck downloads & general queries</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2 text-sm hover:bg-muted/40">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">
            <span>{error}</span>
            <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold hover:underline shrink-0">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total",       value: stats.total,          color: "#6b7280" },
            { label: "New",         value: stats.newCount,       color: "#F59E0B" },
            { label: "Contacted",   value: stats.contactedCount, color: "#0077B6" },
            { label: "Closed",      value: stats.closedCount,    color: "#10B981" },
            { label: "Notify Leads", value: notifyLeadsCount,    color: "#E85D26" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
              <div className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">All Types</option>
            <option value="notify_me">Notify Me Leads</option>
            <option value="expert">Talk to Expert</option>
            <option value="investor_deck">Investor Deck</option>
            <option value="general">General</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{list.length} result{list.length !== 1 ? "s" : ""}</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 size={28} className="text-primary animate-spin" /></div>
        ) : list.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-16 text-center">
            <Inbox size={48} className="text-muted-foreground/40 mx-auto mb-3" />
            <div className="text-muted-foreground">No enquiries yet</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              {list.map((e) => {
                const meta = TYPE_LABEL[e.type] || TYPE_LABEL.general;
                const Icon = meta.icon;
                const isSelected = selected?.id === e.id;
                const notifyMeta = e.type === "notify_me" ? parseNotifyMeta(e.message) : null;
                return (
                  <div
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className={`bg-card border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-sm ${isSelected ? "border-primary/50 shadow-sm" : "border-border"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}15` }}>
                        <Icon size={18} style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-sm truncate">{e.name}</div>
                          <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: STATUS_COLOR[e.status] }}>{e.status}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-medium" style={{ color: meta.color }}>{meta.label}</span>
                          {" · "}{e.email}
                          {e.mobile ? ` · ${e.mobile}` : ""}
                        </div>
                        {notifyMeta && (
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {notifyMeta.age && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">Age: {notifyMeta.age}</span>}
                            {notifyMeta.gender && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{notifyMeta.gender}</span>}
                            {notifyMeta.feature && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">{notifyMeta.feature}</span>}
                          </div>
                        )}
                        {!notifyMeta && e.message && <div className="text-xs text-muted-foreground mt-2 line-clamp-2">{e.message}</div>}
                        <div className="text-[10px] text-muted-foreground/70 mt-1.5">{new Date(e.createdAt).toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail */}
            <div className="lg:col-span-1">
              {selected ? (
                <div className="bg-card border border-border rounded-2xl p-5 sticky top-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: STATUS_COLOR[selected.status] }}>{selected.status}</span>
                    <button
                      onClick={() => remove(selected.id)}
                      disabled={!!rowDeleting[selected.id]}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 p-1.5 rounded-lg disabled:opacity-50"
                    >
                      {rowDeleting[selected.id] ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                  <div className="font-bold text-lg">{selected.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: (TYPE_LABEL[selected.type] || TYPE_LABEL.general).color }}>
                    {TYPE_LABEL[selected.type]?.label || selected.type}
                  </div>

                  <div className="space-y-2 mt-4 text-sm">
                    <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-primary hover:underline"><Mail size={13} />{selected.email}</a>
                    {selected.mobile && <a href={`tel:${selected.mobile}`} className="flex items-center gap-2 text-primary hover:underline"><Phone size={13} />{selected.mobile}</a>}
                    {selected.city && <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={13} />{selected.city}</div>}
                    {selected.accountType && <div className="flex items-center gap-2 text-muted-foreground"><User size={13} />{selected.accountType}</div>}
                    {selected.companyName && <div className="flex items-center gap-2 text-muted-foreground"><Building2 size={13} />{selected.companyName}</div>}
                    {selected.source && <div className="flex items-center gap-2 text-muted-foreground"><Briefcase size={13} />Source: {selected.source}</div>}
                  </div>

                  {/* Notify Me Extra Info */}
                  {selected.type === "notify_me" && (() => {
                    const nm = parseNotifyMeta(selected.message);
                    return (Object.keys(nm).length > 0) ? (
                      <div className="mt-4">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Lead Details</div>
                        <div className="bg-orange-50 rounded-xl p-3 space-y-1.5">
                          {nm.age && <div className="flex items-center gap-2 text-sm"><CalendarDays size={13} className="text-orange-500" /><span className="font-medium">Age:</span> {nm.age}</div>}
                          {nm.gender && <div className="flex items-center gap-2 text-sm"><Users size={13} className="text-orange-500" /><span className="font-medium">Gender:</span> {nm.gender}</div>}
                          {nm.feature && <div className="flex items-center gap-2 text-sm"><Bell size={13} className="text-orange-500" /><span className="font-medium">Feature:</span> {nm.feature}</div>}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {selected.type !== "notify_me" && selected.message && (
                    <div className="mt-4">
                      <div className="text-xs font-medium text-muted-foreground mb-1.5">Message</div>
                      <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">{selected.message}</div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                    Submitted {new Date(selected.createdAt).toLocaleString("en-IN")}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(["new", "contacted", "closed"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selected.id, s)}
                        disabled={selected.status === s || !!rowUpdating[selected.id]}
                        className="text-xs font-medium py-2 rounded-lg border border-border disabled:opacity-100 disabled:text-white hover:bg-muted/40 flex items-center justify-center gap-1"
                        style={selected.status === s ? { background: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] } : {}}
                      >
                        {rowUpdating[selected.id] && selected.status !== s && (
                          <Loader2 size={10} className="animate-spin" />
                        )}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
                  Select an enquiry to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Delete Enquiry?</p>
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
