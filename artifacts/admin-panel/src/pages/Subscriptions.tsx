import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { CreditCard, Plus, X, CheckCircle2, XCircle, Clock } from "lucide-react";

type Sub = {
  id: string; userId: string; plan: string; status: string;
  source: string; expiresAt: string | null; cancelledAt: string | null; createdAt: string;
};

const STATUS_COLOR: Record<string, string> = { active: "#10B981", cancelled: "#EF4444", expired: "#6B7280", pending: "#F59E0B" };
const STATUS_ICON: Record<string, React.ElementType> = { active: CheckCircle2, cancelled: XCircle, expired: Clock, pending: Clock };
const PLAN_COLOR: Record<string, string> = { free: "#6B7280", pro: "#0077B6", max: "#8B5CF6", family: "#10B981" };

export default function Subscriptions() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlan, setGrantPlan] = useState("pro");
  const [grantDays, setGrantDays] = useState("30");
  const [granting, setGranting] = useState(false);

  const load = () => {
    setLoading(true);
    api.subscriptions().then((r) => setSubs(r.subscriptions as Sub[])).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleGrant = async () => {
    if (!grantUserId.trim() || !grantPlan) return;
    setGranting(true);
    try {
      await api.grantSubscription(grantUserId.trim(), grantPlan, parseInt(grantDays));
      setGrantOpen(false); setGrantUserId(""); setGrantDays("30");
      load();
    } catch (e: unknown) {
      setErr((e as Error).message || "Failed");
    } finally { setGranting(false); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this subscription?")) return;
    try { await api.cancelSubscription(id); load(); } catch (e: unknown) { setErr((e as Error).message || "Failed"); }
  };

  const activeSubs = subs.filter(s => s.status === "active").length;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{activeSubs} active · {subs.length} total</p>
          </div>
          <button onClick={() => setGrantOpen(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Grant Subscription
          </button>
        </div>

        {err && <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 mb-4 text-sm flex items-center justify-between"><span>{err}</span><button onClick={() => setErr("")}><X size={14} /></button></div>}

        {/* Grant Modal */}
        {grantOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-foreground text-lg">Subscription Grant Karo</h2>
                <button onClick={() => setGrantOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">User ID</label>
                  <input value={grantUserId} onChange={e => setGrantUserId(e.target.value)} placeholder="User UUID daalo" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Plan</label>
                  <select value={grantPlan} onChange={e => setGrantPlan(e.target.value)} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="pro">Pro (₹199/mo)</option>
                    <option value="max">Max (₹249/mo)</option>
                    <option value="family">Family (₹299/mo)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Duration (days)</label>
                  <input value={grantDays} onChange={e => setGrantDays(e.target.value)} type="number" min="1" max="365" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <button onClick={handleGrant} disabled={granting || !grantUserId.trim()} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {granting ? "Granting..." : "Grant Karo"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-muted-foreground text-sm">Loading subscriptions...</div>
        ) : subs.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <CreditCard size={40} className="text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Koi subscriptions nahi</h3>
            <p className="text-muted-foreground text-sm">Abhi tak koi paid subscription nahi hai</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">User ID</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Plan</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Source</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Expires</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Created</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub, i) => {
                    const StatusIcon = STATUS_ICON[sub.status] || Clock;
                    const statusColor = STATUS_COLOR[sub.status] || "#6B7280";
                    const planColor = PLAN_COLOR[sub.plan] || "#6B7280";
                    return (
                      <tr key={sub.id} className={`border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground" title={sub.userId}>{sub.userId.slice(0, 8)}...</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize" style={{ backgroundColor: `${planColor}18`, color: planColor }}>
                            {sub.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5" style={{ color: statusColor }}>
                            <StatusIcon size={13} />
                            <span className="text-xs font-medium capitalize">{sub.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground text-xs capitalize">{sub.source?.replace(/_/g, " ")}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground text-xs">{sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("en-IN") : "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground text-xs">{new Date(sub.createdAt).toLocaleDateString("en-IN")}</span>
                        </td>
                        <td className="px-4 py-3">
                          {sub.status === "active" && (
                            <button onClick={() => handleCancel(sub.id)} className="text-destructive hover:text-destructive/80 text-xs font-medium transition-colors">Cancel</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
