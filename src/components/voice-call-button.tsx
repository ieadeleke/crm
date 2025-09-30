"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PhoneCall, PhoneOff } from "lucide-react";

declare global {
  interface Window { Twilio?: any }
}

export function VoiceCallButton({ phone, leadId, conferenceName, supervisor = false, label, className }: { phone?: string; leadId?: string; conferenceName?: string; supervisor?: boolean; label?: string; className?: string }) {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [sdkFailed, setSdkFailed] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const deviceRef = useRef<any>(null);
  const connRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        // Fetch token
        const base = process.env.NEXT_PUBLIC_API_BASE || "https://tradar-be.onrender.com/api/v1";
        const token = typeof window !== 'undefined' ? localStorage.getItem('agent_token') || '' : '';
        const tr = await fetch(`${base}/voice/token`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        const tj = await tr.json().catch(() => ({}));
        if (!tr.ok || !tj?.enabled || !tj?.token) { setEnabled(false); return; }
        setEnabled(true);
        // Load Twilio Voice SDK v2 if needed
        if (!window.Twilio?.Device) {
          await loadScript('https://sdk.twilio.com/js/voice/latest/twilio-voice.min.js');
        }
        if (!window.Twilio?.Device) { setEnabled(false); setSdkFailed(true); return; }
        const Twilio = window.Twilio;
        // Setup device
        deviceRef.current = new Twilio.Device(tj.token, { debug: false, codecPreferences: [ 'opus', 'pcmu' ] });
        // Mark ready when device registers (v2)
        deviceRef.current.on('registered', () => { if (!cancelled) setReady(true); });
        deviceRef.current.on('error', (_e: any) => { /* ignore; UI can fallback */ });
        deviceRef.current.on('connect', (_conn: any) => { if (!cancelled) setConnected(true); });
        deviceRef.current.on('disconnect', () => { if (!cancelled) setConnected(false); });
        // Refresh token when about to expire
        deviceRef.current.on('tokenWillExpire', async () => {
          try {
            const r = await fetch(`${base}/voice/token`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
            const j = await r.json().catch(() => ({}));
            if (j?.token) deviceRef.current.updateToken(j.token);
          } catch (_) { /* ignore */ }
        });
        // Register the device (ensures 'registered' event)
        try { await deviceRef.current.register(); } catch { /* outgoing may still work */ }
      } catch (_) {
        setEnabled(false);
        setSdkFailed(true);
      }
    }
    init();
    return () => { cancelled = true; try { deviceRef.current?.destroy?.(); } catch (_) {} };
  }, []);

  // Render button even if Twilio is not enabled to allow Zoiper option

  const call = async () => {
    if (!deviceRef.current || !ready) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (phone) params.To = String(phone || '').replace(/[^+0-9]/g, '');
      if (leadId) params.LeadId = leadId;
      if (conferenceName) params.ConferenceName = conferenceName;
      if (supervisor) params.Supervisor = '1';
      connRef.current = deviceRef.current.connect({ params });
    } catch (_) { /* ignore */ }
    setLoading(false);
  };
  const hangup = async () => {
    try { connRef.current?.disconnect?.(); deviceRef.current?.disconnectAll?.(); } catch (_) {}
  };

  const btnLabel = label || (supervisor ? (connected ? 'Leave' : 'Barge') : (connected ? 'Hang up' : 'Call'));
  const BtnIcon = connected ? PhoneOff : PhoneCall;
  const variant = connected ? 'destructive' : (supervisor ? 'secondary' : 'default');

  // Compute availability flags
  const twilioAvailable = enabled && !sdkFailed && ready;

  async function startZoiper() {
    try {
      let num = String(phone || '').replace(/[^+0-9]/g, '');
      if (!num && leadId) {
        // Fetch phone for this lead (authorized for super agent or assigned agent)
        const base = process.env.NEXT_PUBLIC_API_BASE || "https://tradar-be.onrender.com/api/v1";
        const t = typeof window !== 'undefined' ? localStorage.getItem('agent_token') || '' : '';
        const r = await fetch(`${base}/leads/${encodeURIComponent(leadId)}/phone`, { headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
        if (r.ok) {
          const j = await r.json().catch(()=>({}));
          num = String(j?.phone || '').replace(/[^+0-9]/g, '');
        }
      }
      if (!num) {
        toast.error('Phone number not available for this lead');
        return;
      }
      const link = `zoiper://call?number=${encodeURIComponent(num)}`;
      window.location.href = link;
    } catch (_) {
      toast.error('Failed to open Zoiper');
    }
  }

  return (
    <div className={`relative inline-block ${className || ''}`}>
      <Button
        variant={variant as any}
        disabled={loading}
        onClick={connected ? hangup : () => setMenuOpen((v) => !v)}
      >
        <BtnIcon size={16} /> {btnLabel}
      </Button>
      {!connected && !supervisor && menuOpen && (
        <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-slate-200 bg-white p-1 shadow-md">
          <button
            className={`block w-full rounded px-2 py-2 text-left text-sm hover:bg-slate-100 ${twilioAvailable ? '' : 'opacity-50 cursor-not-allowed'}`}
            onClick={() => { if (!twilioAvailable) return; setMenuOpen(false); call(); }}
          >
            Call with Twilio{!twilioAvailable ? ' (unavailable)' : ''}
          </button>
          <button
            className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-slate-100"
            onClick={() => { setMenuOpen(false); startZoiper(); }}
          >
            Call with Zoiper
          </button>
        </div>
      )}
    </div>
  );
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load script'));
    document.head.appendChild(s);
  });
}
