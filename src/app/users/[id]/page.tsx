"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ReassignModal } from "@/components/reassign-modal";
import { api } from "@/lib/api";

export default function UserDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<'agent'|'super_agent'|null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const d = await api.getUser(id);
      setData(d);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    }
  }

  useEffect(() => { if (id) load(); }, [id]);
  useEffect(() => { api.getMe().then(m=>setRole(m.role as any)).catch(()=>setRole(null)); }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div>Loading...</div>;

  const { user, calls, chats } = data;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Basic Info</CardTitle>
          {role === 'super_agent' && (
            <Button className="py-2" onClick={() => setOpen(true)}>Reassign</Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><div className="text-xs text-gray-500">Name</div><div>{user.name}</div></div>
          {role === 'super_agent' && (<div><div className="text-xs text-gray-500">Email</div><div>{user.email}</div></div>)}
          {role === 'super_agent' && (<div><div className="text-xs text-gray-500">Phone</div><div>{user.phone || '—'}</div></div>)}
          <div><div className="text-xs text-gray-500">Assigned Agent</div><div>{user.assignedAgent ? user.assignedAgent.name : '—'}</div></div>
          {user.originalPassword && (
            <div className="md:col-span-2"><div className="text-xs text-gray-500">Original Password</div><div className="font-mono">{user.originalPassword}</div></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Call History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Outcome</TH>
                <TH>Notes</TH>
                <TH>Agent</TH>
              </TR>
            </THead>
            <TBody>
              {calls.map((c: any) => (
                <TR key={c._id}>
                  <TD>{new Date(c.timestamp).toLocaleString()}</TD>
                  <TD>{c.outcome || '—'}</TD>
                  <TD>{c.notes || '—'}</TD>
                  <TD>{c.agent?.name || '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <ReassignModal open={open} onOpenChange={setOpen} userId={id} onAssigned={load} />
    </div>
  );
}
