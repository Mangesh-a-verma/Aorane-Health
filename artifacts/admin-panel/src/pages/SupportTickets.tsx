import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { adminRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Search, Filter, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface Ticket {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  aorane_id?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:        { label: "Open",        color: "bg-blue-100 text-blue-700",   icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700", icon: <AlertCircle className="w-3 h-3" /> },
  resolved:    { label: "Resolved",    color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  closed:      { label: "Closed",      color: "bg-gray-100 text-gray-600",   icon: <XCircle className="w-3 h-3" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: "Low",    color: "bg-gray-100 text-gray-600" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-600" },
  high:   { label: "High",   color: "bg-orange-100 text-orange-700" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SupportTickets() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => adminRequest<{ tickets: Ticket[]; total: number }>("/admin/support-tickets"),
    refetchInterval: 30_000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      adminRequest(`/admin/support-tickets/${id}`, { method: "PATCH", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Ticket updated", description: "Changes saved successfully." });
      setSelected(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update ticket.", variant: "destructive" }),
  });

  const tickets = data?.tickets || [];
  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.subject.toLowerCase().includes(q) || t.user_name?.toLowerCase().includes(q) || t.user_email?.toLowerCase().includes(q) || t.aorane_id?.includes(q);
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  };

  function openTicket(t: Ticket) {
    setSelected(t);
    setNewStatus(t.status);
    setNewPriority(t.priority);
    setAdminNotes(t.admin_notes || "");
  }

  function handleUpdate() {
    if (!selected) return;
    updateMut.mutate({ id: selected.id, payload: { status: newStatus, priority: newPriority, admin_notes: adminNotes } });
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <MessageSquare className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
            <p className="text-sm text-gray-500">Manage user complaints and help requests</p>
          </div>
          <div className="ml-auto flex gap-2">
            {["all", "open", "in_progress", "resolved"].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filterStatus === s ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s as keyof typeof counts] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by subject, name, email, or Aorane ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tickets table */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading tickets...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tickets found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Subject</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Priority</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(t => {
                  const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
                  const pc = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.normal;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{t.user_name || "Unknown"}</div>
                        <div className="text-xs text-gray-400">{t.user_email || t.user_phone || "—"}</div>
                        {t.aorane_id && <div className="text-xs text-orange-500 font-mono">{t.aorane_id}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="font-medium text-gray-800 truncate">{t.subject}</div>
                        <div className="text-xs text-gray-400 truncate">{t.message}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-gray-600 text-xs">{t.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${pc.color}`}>
                          {pc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" onClick={() => openTicket(t)}>View</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ticket Detail</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{selected.user_name || "Unknown User"}</span>
                  {selected.aorane_id && <span className="text-xs text-orange-500 font-mono bg-orange-50 px-2 py-0.5 rounded">{selected.aorane_id}</span>}
                </div>
                <div className="text-xs text-gray-500">{selected.user_email || selected.user_phone || "No contact"}</div>
                <div className="text-xs text-gray-400">Submitted: {formatDate(selected.created_at)}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Subject</div>
                <div className="font-medium text-gray-800">{selected.subject}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Message</div>
                <div className="text-sm text-gray-700 bg-gray-50 rounded p-3 leading-relaxed">{selected.message}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Status</div>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Priority</div>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Admin Notes</div>
                <Textarea
                  placeholder="Add internal notes about this ticket..."
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={updateMut.isPending} className="bg-orange-500 hover:bg-orange-600 text-white">
                  {updateMut.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
