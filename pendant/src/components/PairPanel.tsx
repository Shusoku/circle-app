import React, { useState } from 'react';
import { Link2, Unlink } from 'lucide-react';
import type { LinkStatus } from '../live/useCircleLink';

interface PairPanelProps {
  status: LinkStatus;
  name?: string;
  onPair: (code: string) => Promise<string>;
  onUnpair: () => void;
}

// Small card under the logo: pair with the Circle phone app, or show who you're linked to.
export const PairPanel: React.FC<PairPanelProps> = ({ status, name, onPair, onUnpair }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'checking' || status === 'no-server') return null;

  const box = 'absolute top-24 left-5 z-30 w-64 rounded-2xl bg-slate-900/90 border border-slate-700/60 backdrop-blur-md p-3 text-xs text-slate-200 shadow-xl';

  if (status === 'live' || status === 'connecting') {
    return (
      <div className={box}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <span className="font-semibold">{status === 'live' ? `Linked to Circle as ${name}` : 'Reconnecting to Circle…'}</span>
        </div>
        <button onClick={onUnpair} className="mt-2 inline-flex items-center gap-1.5 text-slate-400 hover:text-white min-h-[32px]">
          <Unlink className="w-3.5 h-3.5" /> Unpair this pendant
        </button>
      </div>
    );
  }

  return (
    <form
      className={box}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try { await onPair(code.trim()); setCode(''); }
        catch (err) { setError(err instanceof Error ? err.message : 'Pairing failed'); }
        finally { setBusy(false); }
      }}
    >
      <div className="flex items-center gap-2 font-semibold"><Link2 className="w-4 h-4 text-sky-400" /> Pair with your Circle app</div>
      <p className="mt-1 text-slate-400 leading-relaxed">In the phone app, open Device and tap “Pair a wearable”. Enter the code here.</p>
      <div className="mt-2 flex gap-2">
        <label htmlFor="pairCode" className="sr-only">Pairing code</label>
        <input
          id="pairCode"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={6}
          placeholder="ABC234"
          autoComplete="off"
          className="min-w-0 flex-1 h-10 rounded-xl bg-slate-950 border border-slate-700 px-3 font-mono text-base tracking-widest text-white"
        />
        <button disabled={busy || code.length < 6} className="h-10 px-3 rounded-xl bg-sky-500 text-slate-950 font-semibold disabled:opacity-40">Pair</button>
      </div>
      {error && <p className="mt-2 text-rose-300">{error}</p>}
    </form>
  );
};
