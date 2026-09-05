import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type Department, type DepartmentsResponse } from "@/lib/api";
import { Building2, Plus, Pencil, Trash2, Users, AlertCircle, Loader2, EyeOff, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardShell, EmptyState, NeuCard, PageHeader, PrivacyNote } from "@/components/portal/primitives";

function DepartmentRow({
  dept, onRename, onDelete, busy,
}: {
  dept: Department;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (dept: Department) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dept.name);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const name = draft.trim();
    if (!name || name === dept.name) { setEditing(false); setDraft(dept.name); return; }
    setSaving(true);
    try { await onRename(dept.id, name); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-3 py-3 px-3 -mx-3 rounded-xl hover:bg-secondary/50 transition-colors">
      <div className="neu-inset-sm rounded-xl p-2 shrink-0">
        <Building2 size={15} className="text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") { setEditing(false); setDraft(dept.name); } }}
              maxLength={60}
              autoFocus
              aria-label={`Rename ${dept.name}`}
              className="neu-inset rounded-lg px-3 py-1.5 text-sm font-medium text-foreground bg-transparent flex-1 min-w-0"
            />
            <Button variant="ghost" size="icon-sm" onClick={() => void save()} disabled={saving} aria-label="Save name">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(false); setDraft(dept.name); }} aria-label="Cancel rename">
              <X size={15} />
            </Button>
          </div>
        ) : (
          <>
            <div className="text-sm font-semibold text-foreground truncate">{dept.name}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Users size={10} />
              {dept.memberCount} member{dept.memberCount === 1 ? "" : "s"}
            </div>
          </>
        )}
      </div>

      {!editing && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} disabled={busy} aria-label={`Rename ${dept.name}`}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(dept)} disabled={busy} aria-label={`Remove ${dept.name}`}>
            <Trash2 size={14} className="text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Departments() {
  const [data, setData] = useState<DepartmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    api.getDepartments()
      .then(setData)
      .catch((e) => setError((e as Error).message || "Failed to load departments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) { setAddError("Enter a department name"); return; }
    setAdding(true); setAddError("");
    try {
      const res = await api.createDepartment(name);
      setShowAdd(false); setNewName("");
      if (res.reactivated) setError(`"${res.department.name}" already existed and has been restored.`);
      load();
    } catch (e) {
      setAddError((e as Error).message || "Failed to add department");
    } finally { setAdding(false); }
  };

  const handleRename = async (id: string, name: string) => {
    setBusy(true); setError("");
    try { await api.updateDepartment(id, { name }); load(); }
    catch (e) { setError((e as Error).message || "Failed to rename department"); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true); setError("");
    try {
      const res = await api.deleteDepartment(pendingDelete.id);
      setPendingDelete(null);
      if (res.movedMembers > 0) setError(res.message);
      load();
    } catch (e) {
      setError((e as Error).message || "Failed to remove department");
    } finally { setDeleting(false); }
  };

  const active = (data?.departments ?? []).filter((d) => d.isActive);
  const needsDepartment = data?.unassigned.needsDepartment ?? 0;
  const declined = data?.unassigned.declined ?? 0;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="People"
          title="Departments"
          description="The list employees choose from when they join. Keeping it a fixed list is what makes department analytics comparable."
          actions={<Button variant="brand" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Department</Button>}
        />

        {error && (
          <div className="neu-inset rounded-2xl px-4 py-3 flex items-start gap-2 text-sm">
            <AlertCircle size={15} className="text-primary shrink-0 mt-0.5" />
            <span className="text-foreground">{error}</span>
            <Button variant="ghost" size="icon-sm" className="ml-auto shrink-0" onClick={() => setError("")} aria-label="Dismiss">
              <X size={14} />
            </Button>
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NeuCard className="p-4 sm:p-5">
            <p className="truncate text-xs font-medium text-muted-foreground">Departments</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{active.length}</p>
          </NeuCard>
          <NeuCard className="p-4 sm:p-5">
            <p className="truncate text-xs font-medium text-muted-foreground">Need a department</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{needsDepartment}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Their department is not on the list yet</p>
          </NeuCard>
          <NeuCard className="p-4 sm:p-5">
            <p className="truncate text-xs font-medium text-muted-foreground flex items-center gap-1">
              <EyeOff size={11} /> Chose not to say
            </p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{declined}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Cannot be reassigned</p>
          </NeuCard>
        </section>

        <CardShell
          title="Department list"
          description="Employees pick from this list during onboarding — they cannot type their own."
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 neu-flat rounded-xl animate-pulse" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title="No departments yet"
              description="Add the departments your organization uses — Sales, Engineering, HR — and employees will choose from them as they join."
              action={<Button variant="neu" onClick={() => setShowAdd(true)}><Plus size={15} /> Add First Department</Button>}
            />
          ) : (
            <div className="divide-y divide-border/60">
              {active.map((d) => (
                <DepartmentRow key={d.id} dept={d} onRename={handleRename} onDelete={setPendingDelete} busy={busy} />
              ))}
            </div>
          )}
        </CardShell>

        <PrivacyNote>
          Departments group health data into org-level averages only. A member who chose not to share
          their department, or not to contribute to company aggregates, is excluded from those averages
          entirely — not merely hidden from them.
        </PrivacyNote>
      </div>

      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) { setNewName(""); setAddError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>
              Names are case-insensitive, so "Sales" and "sales" cannot both exist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
              placeholder="e.g. Engineering"
              maxLength={60}
              autoFocus
              aria-label="Department name"
              className="neu-inset w-full rounded-xl px-4 py-2.5 text-sm text-foreground bg-transparent"
            />
            {addError && <p className="text-xs text-destructive">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="brand" onClick={() => void handleAdd()} disabled={adding || !newName.trim()}>
              {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove "{pendingDelete?.name}"?</DialogTitle>
            <DialogDescription>
              {pendingDelete && pendingDelete.memberCount > 0
                ? `${pendingDelete.memberCount} member${pendingDelete.memberCount === 1 ? "" : "s"} will need a new department. Their health data stays theirs; only the grouping changes.`
                : "No members are in this department."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="brand" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
