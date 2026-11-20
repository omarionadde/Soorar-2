import React, { useEffect, useState } from 'react';
import { Gift, KeyRound, Copy, Smartphone, CheckCircle2 } from 'lucide-react';
import { ChangePasswordModal } from './erp/ChangePasswordModal.tsx';

type Lang = 'so' | 'en';
const T = (lang: Lang, so: string, en: string) => (lang === 'so' ? so : en);

/** Customer portal: referral code + change password + payment submission statuses. */
export const CustomerAccountPanel: React.FC<{ lang: Lang; session: any; onTokenChange: (t: string) => void }> = ({ lang, session, onTokenChange }) => {
  const [me, setMe] = useState<any>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session?.token) return;
    fetch('/api/customer/me', { headers: { Authorization: `Bearer ${session.token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d))
      .catch(() => {});
  }, [session?.token]);

  if (!session?.token) {
    return (
      <div className="bg-white rounded-[16px] border border-slate-200 p-4 text-xs text-slate-600">
        {T(lang, 'Si aad u aragto koodhkaaga referral-ka oo aad u beddesho password-ka, fadlan ka bax oo mar kale gal.', 'To see your referral code and change your password, please sign out and sign in again.')}
      </div>
    );
  }

  const link = me?.referralCode ? `${window.location.origin}/?ref=${me.referralCode}` : '';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChangePasswordModal lang={lang} open={pwOpen} onClose={() => setPwOpen(false)} endpoint="/api/customer/change-password" token={session.token} onChanged={onTokenChange} />
      <div className="bg-white rounded-[16px] border border-slate-200 p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#00529E] uppercase"><Gift className="w-4 h-4 text-[#F1980A]" />{T(lang, 'Koodhkaaga Referral-ka', 'Your referral code')}</div>
        {me ? (
          <>
            <div className="flex items-center gap-2">
              <code className="px-3 py-2 rounded-[10px] bg-[#F2F5FA] font-mono-tabular text-lg font-bold tracking-widest text-[#0B1F3A]">{me.referralCode}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> {copied ? T(lang, 'La koobiyeeyay', 'Copied') : T(lang, 'Koobiyee link-ga', 'Copy link')}
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {T(lang, 'U dir saaxiibadaa. Marka ay ballansadaan iyagoo isticmaalaya koodhkaaga, SOORAR waxay ku siin kartaa dhimis', 'Share it with friends. When they book with your code, SOORAR can give you a discount')}
              {me.referralDiscountPct ? ` (${me.referralDiscountPct}%)` : ''}.
            </p>
            {me.referrals?.length > 0 && (
              <div className="text-xs text-slate-600">
                {T(lang, 'Dadka aad soo dirtay', 'People you referred')}: <b>{me.referrals.length}</b> · {T(lang, 'Abaalmarin la helay', 'Rewarded')}: <b>{me.referrals.filter((r: any) => r.status === 'Rewarded').length}</b>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-slate-400">…</div>
        )}
      </div>
      <div className="bg-white rounded-[16px] border border-slate-200 p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#00529E] uppercase"><KeyRound className="w-4 h-4 text-[#F1980A]" />{T(lang, 'Akoonka', 'Account')}</div>
        <button type="button" onClick={() => setPwOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white text-xs font-semibold cursor-pointer">
          <KeyRound className="w-4 h-4" /> {T(lang, 'Beddel Password', 'Change password')}
        </button>
        {me?.paymentSubmissions?.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">{T(lang, 'Lacagaha aad soo gudbisay', 'Your payment submissions')}</div>
            {me.paymentSubmissions.slice(0, 5).map((p: any) => (
              <div key={p.id} className="text-xs flex justify-between gap-2 bg-[#F2F5FA] rounded-[8px] px-2.5 py-1.5">
                <span className="font-mono-tabular">{p.bookingRef} · {p.method} · ${Number(p.amount).toFixed(2)}</span>
                <span className={`font-semibold ${p.status === 'Approved' ? 'text-emerald-700' : p.status === 'Rejected' ? 'text-rose-600' : 'text-[#C46F00]'}`}>
                  {p.status === 'Approved' ? T(lang, 'La xaqiijiyay', 'Confirmed') : p.status === 'Rejected' ? T(lang, 'La diiday', 'Rejected') : T(lang, 'Sugaya xaqiijin', 'Awaiting check')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const METHODS: Array<[string, string]> = [
  ['EVC Plus', 'pay_evc_number'],
  ['eDahab', 'pay_edahab_number'],
  ['Premier Wallet', 'pay_premier_number'],
];

/** Per-booking manual mobile-money payment: shows SOORAR numbers, captures the transaction reference. */
export const CustomerPaymentPanel: React.FC<{ lang: Lang; booking: any; settings: Record<string, string>; session?: any }> = ({ lang, booking, settings, session }) => {
  const available = METHODS.filter(([, k]) => String(settings?.[k] || '').trim());
  const inv = (booking.invoices || []).find((i: any) => i.status !== 'Paid') || booking.invoices?.[0];
  const due = inv ? Number(inv.balanceDue || 0) : Number(booking.quotedAmount || 0);
  const [method, setMethod] = useState(available[0]?.[0] || '');
  const [txn, setTxn] = useState('');
  const [amount, setAmount] = useState(due > 0 ? due.toFixed(2) : '');
  const [phone, setPhone] = useState(session?.phone || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  if (inv && inv.status === 'Paid') return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/public/payment-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) },
        body: JSON.stringify({ bookingRef: booking.referenceNumber, phone: phone || booking.customerPhone, invoiceId: inv?.id, method, transactionRef: txn, amount }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed');
      setTxn('');
      setMsg({ ok: true, text: T(lang, 'Waad ku mahadsan tahay! Lacagtaada waxay sugaysaa xaqiijinta SOORAR.', 'Thank you! Your payment is awaiting confirmation by SOORAR.') });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#F2F5FA] rounded-[14px] p-5 border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#00529E] uppercase">
          <Smartphone className="w-4 h-4 text-[#F1980A]" />
          {T(lang, 'Bixi lacagta (EVC Plus · eDahab · Premier Wallet)', 'Pay (EVC Plus · eDahab · Premier Wallet)')}
        </div>
        {due > 0 && <div className="text-xs text-slate-600">{inv ? `${inv.invoiceNumber} · ` : ''}{T(lang, 'Haraaga', 'Balance')}: <b className="font-mono-tabular">${due.toFixed(2)}</b></div>}
      </div>
      {available.length === 0 ? (
        <p className="text-xs text-slate-600">{T(lang, 'Lambarada lacag bixinta weli lama dejin. Fadlan la xiriir SOORAR.', 'Payment numbers are not set up yet. Please contact SOORAR.')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {available.map(([m, k]) => (
              <div key={m} className="bg-white rounded-[10px] border border-slate-200 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-500">{m}</div>
                <div className="font-mono-tabular font-bold text-[#0B1F3A]">{settings[k]}</div>
              </div>
            ))}
          </div>
          {settings.pay_account_name && <div className="text-[11px] text-slate-500">{T(lang, 'Magaca akoonka', 'Account name')}: <b>{settings.pay_account_name}</b></div>}
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-xs font-semibold cursor-pointer">
              <CheckCircle2 className="w-4 h-4" /> {T(lang, 'Waan bixiyay, soo gudbi lambarka xaqiijinta', 'I have paid, submit the reference')}
            </button>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end text-xs">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2.5 rounded-[10px] border border-slate-300 bg-white">
                {available.map(([m]) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={txn} onChange={(e) => setTxn(e.target.value)} placeholder={T(lang, 'Lambarka xaqiijinta (Ref)', 'Transaction reference')} className="px-3 py-2.5 rounded-[10px] border border-slate-300 bg-white font-mono-tabular sm:col-span-2" />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0" placeholder="USD" className="px-3 py-2.5 rounded-[10px] border border-slate-300 bg-white font-mono-tabular" />
              {!session?.token ? (
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={T(lang, 'Taleefanka ballanta', 'Booking phone')} className="px-3 py-2.5 rounded-[10px] border border-slate-300 bg-white font-mono-tabular" />
              ) : (
                <span />
              )}
              <button type="submit" disabled={busy} className="sm:col-span-5 py-2.5 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white font-semibold disabled:opacity-60 cursor-pointer">
                {busy ? '…' : T(lang, 'Soo gudbi', 'Submit')}
              </button>
            </form>
          )}
        </>
      )}
      {msg && <div className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</div>}
    </div>
  );
};
