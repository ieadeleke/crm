"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { PlatformBadge } from "@/components/platform-badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PhoneCall, StickyNote } from "lucide-react";
import { VoiceCallButton } from "@/components/voice-call-button";
import { LeadQuickNoteModal } from "@/components/lead-quick-note-modal";

type LeadRow = { id: string; name?: string; email?: string; phone?: string; status?: string; source?: string; assignedAgent?: { id: string; name: string } };

export default function LeadsPage() {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<'agent'|'super_agent'|null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);

  // Create modal
  const [openNew, setOpenNew] = useState(false);
  const [newData, setNewData] = useState<any>({ name: "", email: "", phone: "", company: "", source: "", tags: "" });

  // Import modal
  const [openImport, setOpenImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteLeadId, setNoteLeadId] = useState<string | null>(null);

  const filters = useMemo(() => ({ q: query.trim(), status: status || undefined, source: source || undefined }), [query, status, source]);

  async function load(nextPage?: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listLeadsPaged({ ...filters, page: nextPage ?? page, limit });
      setRows(data.leads || []);
      setTotal(data.total || 0);
      setPage(data.page || (nextPage ?? 1));
      setLimit(data.limit || 20);
    } catch (e:any) {
      setError(e?.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { api.getMe().then(m=>{ setRole(m.role as any); setMeId(m.id); }).catch(()=>{ setRole(null); setMeId(null); }); }, []);
  useEffect(() => { api.listLeadSources().then(setSources).catch(()=>setSources([])); }, []);
  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || "https://tradar-be.onrender.com/api/v1";
        const token = typeof window !== 'undefined' ? localStorage.getItem('agent_token') || '' : '';
        const r = await fetch(`${base}/voice/token`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        const j = await r.json().catch(()=>({}));
        setVoiceEnabled(!!j?.enabled);
      } catch (_) { setVoiceEnabled(false); }
    })();
  }, []);

  function maskPhone(p?: string) {
    const s = String(p || '').replace(/\D+/g, '');
    if (!s) return '—';
    const last = s.slice(-4);
    return `••••••${last}`;
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Leads</CardTitle>
        {role === 'super_agent' && (
          <div className="flex gap-2">
            <Link href="/leads/integrations" className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Integrations</Link>
            <Button className="py-2" variant="secondary" onClick={()=>setOpenImport(true)}>Import CSV</Button>
            <Button className="py-2" onClick={()=>setOpenNew(true)}>New Lead</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input placeholder="Search name, email, phone" value={query} onChange={(e)=>setQuery(e.target.value)} />
          <Select value={status || undefined} onValueChange={(v)=>setStatus(v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">new</SelectItem>
              <SelectItem value="contacted">contacted</SelectItem>
              <SelectItem value="qualified">qualified</SelectItem>
              <SelectItem value="unqualified">unqualified</SelectItem>
              <SelectItem value="converted">converted</SelectItem>
              <SelectItem value="archived">archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source || undefined} onValueChange={(v)=>setSource(v)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All platforms" /></SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="py-2" variant="ghost" onClick={()=>load(1)}>Apply</Button>
        </div>
        {loading ? (
          <div className="p-4 text-sm">Loading...</div>
        ) : error ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Phone</TH>
                <TH>Status</TH>
                <TH>Source</TH>
                <TH>Assigned</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <Link href={`/leads/${l.id}`} className="text-gray-900 underline-offset-2 hover:underline">
                      {l.name || '—'}
                    </Link>
                  </TD>
                  <TD>{l.email || '—'}</TD>
                  <TD>{role === 'super_agent' ? (l.phone || '—') : maskPhone(l.phone)}</TD>
                  <TD><StatusBadge value={l.status} /></TD>
                  <TD><PlatformBadge source={l.source} /></TD>
                  <TD>{l.assignedAgent ? l.assignedAgent.name : '—'}</TD>
                  <TD className="space-x-2 whitespace-nowrap">
                    <Link href={`/leads/${l.id}`} className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">View</Link>
                    {role === 'super_agent' && !l.assignedAgent && (
                      <button
                        className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={async ()=>{ try { await api.autoAssignLead(l.id); toast.success('Auto-assigned'); await load(page); } catch (e:any) { toast.error(e?.message || 'Failed'); } }}
                      >Auto-Assign</button>
                    )}
                    {role === 'agent' && meId && l.assignedAgent && (l as any).assignedAgent.id === meId && (
                      <VoiceCallButton leadId={l.id} conferenceName={`lead-${l.id}`} />
                    )}
                    {role === 'agent' && meId && l.assignedAgent && (l as any).assignedAgent.id === meId && (
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                        title="Log feedback"
                        onClick={()=>{ setNoteLeadId(l.id); setNoteOpen(true); }}
                      >
                        <StickyNote size={16} /> Note
                      </button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 pb-4">
        <div className="text-xs text-gray-600">Page {page} of {Math.max(1, Math.ceil(total / Math.max(1, limit)))}</div>
        <div className="flex items-center gap-2">
          <Button className="py-2" variant="secondary" disabled={page <= 1} onClick={async ()=>{ const np = Math.max(1, page-1); setPage(np); await load(np); }}>Prev</Button>
          <Button className="py-2" variant="secondary" disabled={page >= Math.ceil(total / Math.max(1, limit))} onClick={async ()=>{ const np = page + 1; setPage(np); await load(np); }}>Next</Button>
        </div>
      </div>

      {/* New Lead Dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogTitle>New Lead</DialogTitle>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500">Name</label>
              <Input value={newData.name} onChange={e=>setNewData((d:any)=>({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Email</label>
              <Input type="email" value={newData.email} onChange={e=>setNewData((d:any)=>({ ...d, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Phone</label>
              <Input value={newData.phone} onChange={e=>setNewData((d:any)=>({ ...d, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Company</label>
              <Input value={newData.company} onChange={e=>setNewData((d:any)=>({ ...d, company: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Source</label>
              <Input value={newData.source} onChange={e=>setNewData((d:any)=>({ ...d, source: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500">Tags (comma-separated)</label>
              <Input value={newData.tags} onChange={e=>setNewData((d:any)=>({ ...d, tags: e.target.value }))} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button className="py-2" variant="secondary" onClick={()=>setOpenNew(false)}>Cancel</Button>
              <Button className="py-2" onClick={async ()=>{
                try {
                  const payload = { ...newData, tags: String(newData.tags||'').split(',').map((t:string)=>t.trim()).filter(Boolean) };
                  await api.createLead(payload);
                  toast.success('Lead created');
                  setOpenNew(false);
                  setNewData({ name: "", email: "", phone: "", company: "", source: "", tags: "" });
                  await load();
                } catch (e:any) {
                  toast.error(e?.message || 'Failed to create lead');
                }
              }}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={openImport} onOpenChange={setOpenImport}>
        <DialogContent>
          <DialogTitle>Import Leads CSV</DialogTitle>
          <div className="mt-3 space-y-3">
            <div className="text-xs text-gray-600">Headers: firstName,lastName,name,email,phone,company,source,tags</div>
            <input type="file" accept=".csv,text/csv" onChange={(e)=>setCsvFile(e.target.files?.[0] || null)} />
            <div className="flex justify-end gap-2">
              <Button className="py-2" variant="secondary" onClick={()=>setOpenImport(false)}>Cancel</Button>
              <Button className="py-2" disabled={!csvFile} onClick={async ()=>{
                if (!csvFile) return;
                const form = new FormData();
                form.append('file', csvFile);
                try {
                  const res = await api.importLeadsCsv(form);
                  toast.success(`Imported ${res.createdCount} leads; ${res.duplicateCount} duplicates`);
                  setOpenImport(false);
                  setCsvFile(null);
                  await load();
                } catch (e:any) {
                  toast.error(e?.message || 'Import failed');
                }
              }}>Upload</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <LeadQuickNoteModal open={noteOpen} onOpenChange={setNoteOpen} leadId={noteLeadId || ''} onSaved={()=>load(page)} />
    </Card>
  );
}
