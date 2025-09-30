"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AssignLeadModal } from "@/components/assign-lead-modal";
import { StatusBadge } from "@/components/status-badge";
import { PlatformBadge } from "@/components/platform-badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { api } from "@/lib/api";
import { VoiceCallButton } from "@/components/voice-call-button";
import { PhoneCall } from "lucide-react";
import { toast } from "sonner";

export default function LeadDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [lead, setLead] = useState<any | null>(null);
  const [role, setRole] = useState<'agent'|'super_agent'|null>(null);
  const [openAssign, setOpenAssign] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget] = useState<string>("");
  const [calls, setCalls] = useState<any[]>([]);
  const [callData, setCallData] = useState<{ outcome?: string; notes?: string }>({ outcome: '', notes: '' });
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const conferenceName = `lead-${id}`;
  const hasActive = calls.some((c:any) => !c.endedAt && (!c.callStatus || ["initiated","ringing","answered","in-progress","queued"].includes(String(c.callStatus))));

  function maskPhone(p?: string) {
    const s = String(p || '').replace(/\D+/g, '');
    if (!s) return '—';
    const last = s.slice(-4);
    return `••••••${last}`;
  }

  async function load() {
    try {
      const l = await api.getLead(id);
      setLead(l);
      setStatus(l.status || '');
      try { setCalls(await api.listLeadCalls(id)); } catch(_) { setCalls([]); }
    } catch (e:any) {
      setErr(e?.message || 'Failed to load');
    }
  }

  useEffect(() => { if (id) load(); }, [id]);
  useEffect(() => {
    api.getMe().then(async (m)=>{
      setRole(m.role as any);
      if (m.role === 'super_agent') {
        try {
          const cfgs = await api.listIntegrationConfigs();
          setTargets(cfgs.filter((c:any)=>c.enabled).map((c:any)=>c.platform));
        } catch(_) {}
      }
    }).catch(()=>setRole(null));
  }, []);
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

  if (err) return <div className="text-red-600">{err}</div>;
  if (!lead) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Lead</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge value={lead.status} />
            {role === 'super_agent' && (
              <>
                <Button className="py-2" variant="secondary" onClick={()=>setOpenAssign(true)}>Assign</Button>
                <Button className="py-2" variant="ghost" onClick={async ()=>{ try { await api.autoAssignLead(id); toast.success('Auto-assigned'); await load(); } catch (e:any) { toast.error(e?.message || 'Failed'); } }}>Auto-Assign</Button>
              </>
            )}
            {(role === 'agent' || role === 'super_agent') && (
              <VoiceCallButton leadId={id} conferenceName={conferenceName} />
            )}
            {role === 'super_agent' && voiceEnabled && hasActive && (
              <VoiceCallButton supervisor conferenceName={conferenceName} label="Barge" />
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><div className="text-xs text-gray-500">Name</div><div>{lead.name || '—'}</div></div>
          <div><div className="text-xs text-gray-500">Email</div><div>{lead.email || '—'}</div></div>
          <div><div className="text-xs text-gray-500">Phone</div><div>{role === 'super_agent' ? (lead.phone || '—') : maskPhone(lead.phone)}</div></div>
          <div><div className="text-xs text-gray-500">Company</div><div>{lead.company || '—'}</div></div>
          <div><div className="text-xs text-gray-500">Platform</div><div><PlatformBadge source={lead.source} /></div></div>
          <div><div className="text-xs text-gray-500">Assigned Agent</div><div>{lead.assignedAgent ? lead.assignedAgent.name : '—'}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Status</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Set status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">new</SelectItem>
                <SelectItem value="contacted">contacted</SelectItem>
                <SelectItem value="qualified">qualified</SelectItem>
                <SelectItem value="unqualified">unqualified</SelectItem>
                <SelectItem value="converted">converted</SelectItem>
                <SelectItem value="archived">archived</SelectItem>
              </SelectContent>
            </Select>
            <Button className="py-2" onClick={async ()=>{
              try { await api.updateLead(id, { status }); toast.success('Status updated'); await load(); } catch (e:any) { toast.error(e?.message || 'Failed'); }
            }}>Save</Button>
          </div>
        </CardHeader>
      </Card>

      {role === 'super_agent' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Manual Sync</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="w-60"><SelectValue placeholder="Choose integration" /></SelectTrigger>
                <SelectContent>
                  {targets.map((t)=> (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button className="py-2" disabled={!target} onClick={async ()=>{
                try { await api.syncLead(id, target); toast.success('Sync queued'); } catch (e:any) { toast.error(e?.message || 'Failed to sync'); }
              }}>Sync</Button>
            </div>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Call History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Status</TH>
                <TH>Outcome</TH>
                <TH>Notes</TH>
                <TH>Agent</TH>
              </TR>
            </THead>
            <TBody>
              {calls.map((c:any) => (
                <TR key={c._id}>
                  <TD>{new Date(c.startedAt || c.timestamp).toLocaleString()}</TD>
                  <TD>{c.callStatus || '—'}{c.durationSeconds != null ? ` (${c.durationSeconds}s)` : ''}</TD>
                  <TD>{c.outcome || '—'}</TD>
                  <TD>{c.notes || '—'}</TD>
                  <TD>{c.agent?.name || '—'}</TD>
                </TR>
              ))}
              {calls.length === 0 && (
                <TR><TD colSpan={4}><div className="text-sm text-gray-500">No calls yet.</div></TD></TR>
              )}
            </TBody>
          </Table>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="md:col-span-1">
              <Input placeholder="Outcome (e.g., Answered, No answer)" value={callData.outcome || ''} onChange={(e)=>setCallData(d=>({ ...d, outcome: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Input placeholder="Notes" value={callData.notes || ''} onChange={(e)=>setCallData(d=>({ ...d, notes: e.target.value }))} />
            </div>
            <div className="md:col-span-1 flex justify-end">
              <Button className="py-2" onClick={async ()=>{
                try { await api.addLeadCall(id, { outcome: callData.outcome, notes: callData.notes }); setCallData({ outcome: '', notes: '' }); await load(); } catch(e:any) { /* non-fatal */ }
              }}>Log Call</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(lead.notes || []).length === 0 && <div className="text-sm text-gray-500">No notes yet.</div>}
            {lead.notes?.map((n:any, i:number) => (
              <div key={i} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString()}</div>
                <div className="whitespace-pre-wrap">{n.text}</div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Add a note" value={note} onChange={(e)=>setNote(e.target.value)} />
              <Button className="py-2" onClick={async ()=>{
                if (!note.trim()) return;
                try { await api.addLeadNote(id, note.trim()); setNote(''); await load(); } catch (e:any) { toast.error(e?.message || 'Failed'); }
              }}>Add</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AssignLeadModal open={openAssign} onOpenChange={setOpenAssign} leadId={id} onAssigned={load} />
    </div>
  );
}
