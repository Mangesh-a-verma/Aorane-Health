import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { adminRequest } from "@/lib/api";
import { FileText, Search, Download, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";

interface OrgInvoice {
  id: string;
  orgId: string;
  orgName: string;
  orgEmail: string;
  plan: string;
  seats: number | null;
  amount: string;
  currency: string;
  status: string;
  paymentType: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle size={11} /> Paid
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
      <Clock size={11} /> Pending
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
      <XCircle size={11} /> {status}
    </span>
  );
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<OrgInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchInvoices = () => {
    setLoading(true);
    setError("");
    adminRequest<{ invoices: OrgInvoice[] }>("/admin/org-invoices")
      .then((d) => setInvoices(d.invoices || []))
      .catch(() => setError("Failed to load invoices"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInvoices(); }, []);

  const filtered = invoices.filter((inv) => {
    const matchQ = !query ||
      inv.orgName.toLowerCase().includes(query.toLowerCase()) ||
      inv.orgEmail.toLowerCase().includes(query.toLowerCase()) ||
      (inv.razorpayPaymentId || "").toLowerCase().includes(query.toLowerCase());
    const matchS = statusFilter === "all" || inv.status === statusFilter;
    return matchQ && matchS;
  });

  const totalRevenue = invoices.filter(i => i.status === "success").reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const paidCount = invoices.filter(i => i.status === "success").length;
  const pendingCount = invoices.filter(i => i.status === "pending").length;

  function exportCsv() {
    const header = "Invoice,Org,Email,Plan,Seats,Amount,Status,Payment ID,Date";
    const rows = filtered.map((inv, i) => [
      `AOR-${String(i + 1).padStart(4, "0")}`,
      `"${inv.orgName}"`,
      inv.orgEmail,
      inv.plan,
      inv.seats ?? "",
      inv.amount,
      inv.status,
      inv.razorpayPaymentId || "",
      new Date(inv.createdAt).toLocaleDateString("en-IN"),
    ].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aorane-business-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              Business Invoices
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">All organization payment records</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchInvoices}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-emerald-600">{formatINR(totalRevenue)}</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Paid Invoices</div>
            <div className="text-2xl font-bold text-foreground">{paidCount}</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search org, email, payment ID..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">All Status</option>
            <option value="success">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Organization</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((inv, i) => (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        AOR-{String(i + 1).padStart(4, "0")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inv.orgName}</div>
                        <div className="text-xs text-muted-foreground">{inv.orgEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium capitalize">{inv.plan}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.seats ? `${inv.seats} seats` : "—"}
                          {inv.paymentType ? ` · ${inv.paymentType}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatINR(Number(inv.amount || 0))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3">
                        {inv.razorpayPaymentId ? (
                          <span className="font-mono text-xs text-muted-foreground">{inv.razorpayPaymentId.slice(0, 20)}...</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {inv.expiresAt && (
                          <div className="text-[10px] text-muted-foreground/60">
                            Expires: {new Date(inv.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
              Showing {filtered.length} of {invoices.length} invoices
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
