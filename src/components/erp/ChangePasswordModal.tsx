import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { Lang, tr } from './types.ts';

interface Props {
  lang: Lang;
  open: boolean;
  onClose: () => void;
  /** Endpoint + bearer token (staff: /api/account/change-password, customer: /api/customer/change-password). */
  endpoint: string;
  token: string;
  /** Called with the new session token (old one stops working after a password change). */
  onChanged: (newToken: string) => void;
}

export const ChangePasswordModal: React.FC<Props> = ({ lang, open, onClose, endpoint, token, onChanged }) => {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: tr(lang, 'Password-ka cusub waa inuu ahaadaa ugu yaraan 8 xaraf.', 'New password must be at least 8 characters.') });
    if (pw !== pw2) return setMsg({ ok: false, text: tr(lang, 'Labada password isma laha.', 'Passwords do not match.') });
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: cur, newPassword: pw }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed');
      onChanged(d.token);
      setCur('');
      setPw('');
      setPw2('');
      setMsg({ ok: true, text: tr(lang, 'Password-ka waa la beddelay.', 'Password changed.') });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-[#0B1F3A]/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-[#0B1F3A]">
            <KeyRound className="w-5 h-5 text-[#F1980A]" /> {tr(lang, 'Beddel Password', 'Change password')}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-slate-600">
          {tr(lang, 'Password-ka hadda', 'Current password')}
          <input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {tr(lang, 'Password cusub (ugu yaraan 8)', 'New password (min 8)')}
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {tr(lang, 'Ku celi password-ka cusub', 'Repeat new password')}
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" />
        </label>
        {msg && <div className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</div>}
        <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-[#00529E] hover:bg-[#00447F] text-white text-sm font-semibold disabled:opacity-60">
          {busy ? '…' : tr(lang, 'Kaydi', 'Save')}
        </button>
      </form>
    </div>
  );
};
