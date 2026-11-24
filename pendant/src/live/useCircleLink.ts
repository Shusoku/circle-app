// Links the virtual pendant to a Circle account through the Circle server.
// Without a server (opened on its own, or in AI Studio) it stays in demo mode.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LinkFriend {
  id: string;
  name: string;
  initials: string;
  band: string;
  area: string;
  last: string;
  miles: number | null;
  meters: number | null;
  bearing: number | null;
}

export interface LinkState {
  me: { id: string; name: string };
  friends: LinkFriend[];
  selected: string | null;
  arrow: boolean;
  dest: { name: string } | null;
  target: { kind: 'friend' | 'dest'; id: string; name: string; meters: number | null; bearing: number | null; band: string } | null;
  emergency: { state: 'idle' | 'pending' | 'sent'; countdown?: number; reason?: string };
  alerts: { id: string; name: string }[];
}

export type LinkStatus = 'checking' | 'no-server' | 'unpaired' | 'connecting' | 'live';

const TOKEN_KEY = 'circle.pendant.token';
const read = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const write = (v: string | null) => { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage off */ } };

export function useCircleLink(onEvent: (message: string, kind?: string) => void) {
  const [status, setStatus] = useState<LinkStatus>('checking');
  const [state, setState] = useState<LinkState | null>(null);
  const [token, setToken] = useState<string | null>(read);
  const ws = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Is there a Circle server behind this page?
  useEffect(() => {
    if (!/^https?:$/.test(location.protocol)) { setStatus('no-server'); return; }
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setStatus(j?.app === 'circle' ? (read() ? 'connecting' : 'unpaired') : 'no-server'))
      .catch(() => setStatus('no-server'));
  }, []);

  useEffect(() => {
    if (!token || status === 'checking' || status === 'no-server' || status === 'unpaired') return;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    const open = () => {
      const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.current = sock;
      sock.onopen = () => { retry = 0; sock.send(JSON.stringify({ type: 'auth', token })); };
      sock.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === 'state') { setState(m.state); setStatus('live'); }
        else if (m.type === 'ping' || m.type === 'toast' || m.type === 'alert') onEventRef.current(m.message, m.type === 'ping' ? m.kind : m.type);
        else if (m.type === 'gesture-result' && m.muted) onEventRef.current('Their raid blocking muted that ping', 'muted');
        else if (m.type === 'error') onEventRef.current(m.error, 'error');
      };
      sock.onclose = (ev) => {
        if (closed) return;
        if (ev.code === 4001) { write(null); setToken(null); setState(null); setStatus('unpaired'); return; }
        setStatus('connecting');
        timer = setTimeout(open, Math.min(10000, 500 * 2 ** retry++));
      };
    };
    open();
    return () => { closed = true; clearTimeout(timer); ws.current?.close(); };
  }, [token, status === 'checking' || status === 'no-server' || status === 'unpaired']);

  const send = useCallback((m: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m));
  }, []);

  const pair = useCallback(async (code: string) => {
    const r = await fetch('/api/devices/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Pairing failed');
    write(j.token);
    setToken(j.token);
    setStatus('connecting');
    return j.user.name as string;
  }, []);

  const unpair = useCallback(() => {
    write(null);
    setToken(null);
    setState(null);
    ws.current?.close();
    setStatus('unpaired');
  }, []);

  return {
    status,
    state,
    live: status === 'live' && !!state,
    pair,
    unpair,
    select: (friendId: string) => send({ type: 'select', friendId }),
    arrow: (on: boolean) => send({ type: 'arrow', on }),
    gesture: (kind: 'double' | 'triple') => send({ type: 'gesture', kind }),
    vitals: (hr: number, stress: number) => send({ type: 'vitals', hr, stress }),
    sos: () => send({ type: 'sos' }),
    cancel: () => send({ type: 'cancel' }),
    safe: () => send({ type: 'safe' }),
    dispatchNow: () => send({ type: 'dispatch' }),
  };
}
