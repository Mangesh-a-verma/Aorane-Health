import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type EnrollmentCode } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { QrCode, Plus, Copy, Check, Clock, Users, AlertCircle, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardShell, EmptyState, NeuCard, PageHeader, ProgressBar } from "@/components/portal/primitives";
import { cn } from "@/lib/utils";

function CodeCard({ code }: { code: EnrollmentCode }) {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date(code.expiresAt) < new Date();
  const isFull = code.usedSeats >= code.totalSeats;
  const pct = Math.min(100, (code.usedSeats / code.totalSeats) * 100);
  const barTone: "primary" | "amber" = pct >= 70 ? "amber" : "primary";

  const copyCode = () => {
    navigator.clipboard.writeText(code.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <NeuCard className={cn("p-5", (isExpired || isFull) && "opacity-60")}>
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="font-mono-data text-2xl font-bold text-foreground tracking-widest">{code.code}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {isExpired && <Badge variant="danger">Expired</Badge>}
            {isFull && !isExpired && <Badge variant="warning">Full</Badge>}
            {!isExpired && !isFull && <Badge variant="success" className="capitalize">{code.planType}</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={copyCode} aria-label="Copy code">
          {copied ? <Check size={16} className="text-[oklch(0.68_0.12_162)]" /> : <Copy size={16} />}
        </Button>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5 text-muted-foreground">
          <span className="flex items-center gap-1"><Users size={11} /> {code.usedSeats}/{code.totalSeats} used</span>
          <span className="font-mono-data tabular-nums">{pct.toFixed(0)}%</span>
        </div>
        <ProgressBar value={pct} tone={barTone} className={pct >= 90 ? "[&>div]:bg-destructive" : ""} />
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock size={11} />
        <span>Expires {new Date(code.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
    </NeuCard>
  );
}

export default function EnrollmentCodes() {
  const { isPaidActive, subscriptionLoading } = useAuth();
  const [codes, setCodes] = useState<EnrollmentCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ planType: "basic", totalSeats: "20", validityDays: "365" });

  const fetchCodes = () => {
    setLoading(true);
    api.getCodes().then((r) => setCodes(r.codes)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      await api.createCode({
        planType: form.planType,
        totalSeats: parseInt(form.totalSeats),
        validityDays: parseInt(form.validityDays),
      });
      setShowModal(false);
      fetchCodes();
    } catch (err) {
      setError((err as Error).message || "Failed to create code");
    } finally {
      setCreating(false);
    }
  };

  const activeCount = codes.filter((c) => new Date(c.expiresAt) >= new Date() && c.usedSeats < c.totalSeats).length;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="Growth"
          title="Enrollment Codes"
          description="Generate codes to invite members to your organization."
          actions={
            !subscriptionLoading && !isPaidActive ? (
              <Badge variant="outline"><Lock size={12} /> Requires Active Plan</Badge>
            ) : (
              <Button variant="brand" onClick={() => setShowModal(true)} disabled={subscriptionLoading}>
                <Plus size={16} /> New Code
              </Button>
            )
          }
        />

        <section className="grid grid-cols-2 sm:w-1/2 gap-4">
          <NeuCard className="p-4 sm:p-5">
            <p className="truncate text-xs font-medium text-muted-foreground">Total Codes</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{codes.length}</p>
          </NeuCard>
          <NeuCard className="p-4 sm:p-5">
            <p className="truncate text-xs font-medium text-muted-foreground">Active</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{activeCount}</p>
          </NeuCard>
        </section>

        <CardShell title="Enrollment Codes" description="Share a code with employees so they can self-enroll.">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="neu-flat rounded-2xl p-5 animate-pulse">
                  <div className="h-7 bg-muted rounded mb-3 w-3/4" />
                  <div className="h-2 bg-muted rounded mb-2" />
                  <div className="h-2 bg-muted rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : codes.length === 0 ? (
            <EmptyState
              icon={<QrCode />}
              title="No enrollment codes created yet"
              description="Click the New Code button to create your first enrollment code."
              action={
                isPaidActive ? (
                  <Button variant="neu" onClick={() => setShowModal(true)}><Plus size={15} /> Create First Code</Button>
                ) : !subscriptionLoading ? (
                  <Button variant="neu" asChild>
                    <a href="/billing"><Lock size={14} /> Activate Plan to Create Codes</a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {codes.map((code) => <CodeCard key={code.id} code={code} />)}
            </div>
          )}
        </CardShell>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Enrollment Code</DialogTitle>
            <DialogDescription>Configure invitation details</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-start gap-2 text-destructive tone-danger rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Plan Type</label>
              <div className="grid grid-cols-3 gap-2">
                {["basic", "premium", "enterprise"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setForm((f) => ({ ...f, planType: p }))}
                    className={cn(
                      "py-2 px-3 rounded-xl text-sm font-medium capitalize transition-all",
                      form.planType === p ? "neu text-primary" : "neu-flat text-muted-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Total Seats</label>
              <input
                type="number"
                value={form.totalSeats}
                onChange={(e) => setForm((f) => ({ ...f, totalSeats: e.target.value }))}
                min="1"
                className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm bg-transparent focus:outline-none font-mono-data"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Validity</label>
              <div className="grid grid-cols-4 gap-2">
                {["30", "90", "180", "365"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setForm((f) => ({ ...f, validityDays: d }))}
                    className={cn(
                      "py-2 rounded-xl text-sm transition-all",
                      form.validityDays === d ? "neu text-primary font-semibold" : "neu-flat text-muted-foreground",
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <Button variant="brand" className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 size={16} className="animate-spin" /> : "Create Enrollment Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
