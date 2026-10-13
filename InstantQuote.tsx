import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, MessageCircle, Send } from 'lucide-react';
import { MOGADISHU_DISTRICTS, buildWhatsAppUrl, trackWhatsAppClick } from '../constants/mogadishu.ts';
import { computeInstantQuote } from '../lib/instantQuote.ts';

interface Props {
  lang: 'so' | 'en';
  settings: Record<string, string>;
  whatsappDigits: string;
  whatsappLabel: string;
}

const T = (lang: 'so' | 'en', so: string, en: string) => (lang === 'so' ? so : en);

/** Public instant quote: admin-set pricing rules, captures every request as a CRM lead. */
export const InstantQuote: React.FC<Props> = ({ lang, settings, whatsappDigits, whatsappLabel }) => {
  const [moveType, setMoveType] = useState<'home' | 'office'>('home');
  const [rooms, setRooms] = useState(3);
  const [fromDistrict, setFromDistrict] = useState('Hodan');
  const [toDistrict, setToDistrict] = useState('Wadajir');
  const [floors, setFloors] = useState(1);
  const [hasLift, setHasLift] = useState(false);
  const [packing, setPacking] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+252 ');
  const [date, setDate] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    try {
      return localStorage.getItem('soorar_ref') || '';
    } catch {
      return '';
    }
  });
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const est = useMemo(
    () => computeInstantQuote({ moveType, rooms, fromDistrict, toDistrict, floors, hasLift, packing }, settings || {}),
    [moveType, rooms, fromDistrict, toDistrict, floors, hasLift, packing, settings]
  );

  const summary = `${moveType === 'office' ? T(lang, 'Xafiis', 'Office') : T(lang, 'Guri', 'Home')} · ${rooms} ${T(lang, 'qol', 'rooms')} · ${fromDistrict} → ${toDistrict} · ${T(lang, 'Dabaq', 'Floor')} ${floors}${hasLift ? ' (lift)' : ''}`;
  const waMsg =
    lang === 'so'
      ? `Asc SOORAR, waxaan isticmaalay Xisaabiyaha Qiimaha: ${summary}${est.priced ? `, Qiyaasta: $${est.low} – $${est.high}` : ''}. Waxaan rabaa qiimo rasmi ah.`
      : `Hello SOORAR, I used the Price Estimator: ${summary}${est.priced ? `, Estimated range: $${est.low} – $${est.high}` : ''}. I would like an official quote.`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!name.trim() || phone.replace(/[^0-9]/g, '').length < 7) {
      setErr(T(lang, 'Fadlan geli magacaaga iyo taleefan sax ah.', 'Please enter your name and a valid phone number.'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/public/instant-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, moveType, rooms, fromDistrict, toDistrict, floors, hasLift, packing, preferredDate: date, referralCode, honeypot }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed');
      setDone(d.leadCode);
    } catch (e2: any) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const sel = 'w-full px-3.5 py-2.5 rounded-[8px] bg-white border border-slate-300 text-xs font-medium';

  return (
    <div className="bg-[#F2F5FA] rounded-[20px] border border-slate-200 p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-7 space-y-5">
        <div className="flex items-center gap-2 text-[#00529E] font-bold text-sm">
          <Calculator className="w-5 h-5" />
          <span>{T(lang, 'Qiimo Degdeg ah (Instant Quote)', 'Instant quote')}</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600">{T(lang, 'Dooro xogta raridaada si aad u aragto qiyaasta isla hadda.', 'Pick your move details to see an estimate right away.')}</p>

        <div className="grid grid-cols-2 gap-2">
          {(['home', 'office'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMoveType(m)}
              className={`py-2.5 rounded-full text-xs font-semibold border cursor-pointer ${moveType === m ? 'bg-[#00529E] text-white border-[#00529E]' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              {m === 'home' ? T(lang, 'Guri', 'Home') : T(lang, 'Xafiis', 'Office')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {moveType === 'office' ? T(lang, 'Tirada qolalka xafiiska', 'Office rooms') : T(lang, 'Tirada Qolalka', 'Number of rooms')}:{' '}
              <span className="font-mono-tabular font-bold text-[#00529E]">{rooms}</span>
            </label>
            <input type="range" min={1} max={12} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className="w-full accent-[#00529E]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {T(lang, 'Dabaqyada jaranjarada', 'Floors of stairs')}: <span className="font-mono-tabular font-bold text-[#00529E]">{floors}</span>
            </label>
            <input type="range" min={0} max={10} value={floors} onChange={(e) => setFloors(Number(e.target.value))} className="w-full accent-[#00529E]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{T(lang, 'Degmada laga rarayo', 'From district')}</label>
            <select value={fromDistrict} onChange={(e) => setFromDistrict(e.target.value)} className={sel}>
              {MOGADISHU_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{T(lang, 'Degmada loo rarayo', 'To district')}</label>
            <select value={toDistrict} onChange={(e) => setToDistrict(e.target.value)} className={sel}>
              {MOGADISHU_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasLift} onChange={(e) => setHasLift(e.target.checked)} className="accent-[#00529E]" />
            <span>{T(lang, 'Wiish (Lift) ma leeyahay?', 'Is there a lift?')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={packing} onChange={(e) => setPacking(e.target.checked)} className="accent-[#00529E]" />
            <span>{T(lang, 'Baakadeyn & kartoonno', 'Packing & boxes')}</span>
          </label>
        </div>
      </div>

      <div className="lg:col-span-5 bg-[#0B1F3A] text-white rounded-[20px] p-6 md:p-8 space-y-4">
        <div className="text-center space-y-2">
          <div className="text-xs text-white/75">{T(lang, 'Qiyaasta Qiimaha', 'Estimated price range')}</div>
          {est.priced ? (
            <div className="text-4xl font-bold font-mono-tabular text-[#F1980A]">${est.low} – ${est.high}</div>
          ) : (
            <div className="text-lg font-bold text-[#F1980A]">{T(lang, 'Qiimaha waxaa lagu soo xaqiijin doonaa', 'Price will be confirmed')}</div>
          )}
          <p className="text-[11px] text-white/70">
            {est.priced
              ? T(lang, 'Qiyaas kaliya; qiimaha rasmiga ah waxaa lagu soo xaqiijin doonaa.', 'Estimate only; the final price will be confirmed.')
              : T(lang, 'Ka tag xogtaada, kooxdayada ayaa kula soo xiriiri doonta.', 'Leave your details and our team will contact you.')}
          </p>
        </div>

        {done ? (
          <div className="rounded-[14px] bg-white/10 p-4 text-center space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="font-semibold">{T(lang, 'Waad ku mahadsan tahay! Codsigaaga waa la helay.', 'Thank you! Your request was received.')}</div>
            <div className="text-xs text-white/70 font-mono-tabular">Ref: {done}</div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-2.5">
            <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={T(lang, 'Magacaaga *', 'Your name *')} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white text-[#0B1F3A] text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={T(lang, 'Taleefan *', 'Phone *')} inputMode="tel" className="w-full px-3.5 py-2.5 rounded-[10px] bg-white text-[#0B1F3A] text-sm font-mono-tabular" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] bg-white text-[#0B1F3A] text-xs" aria-label={T(lang, 'Taariikhda', 'Date')} />
              <input value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} placeholder={T(lang, 'Koodh referral', 'Referral code')} maxLength={20} className="w-full px-3 py-2.5 rounded-[10px] bg-white text-[#0B1F3A] text-xs font-mono-tabular" />
            </div>
            {err && <div className="text-xs text-rose-300">{err}</div>}
            <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer">
              <Send className="w-4 h-4" />
              {busy ? '…' : T(lang, 'Codso qiimo rasmi ah', 'Request official quote')}
            </button>
          </form>
        )}
        <a
          href={buildWhatsAppUrl(whatsappDigits, waMsg)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('price_estimator_whatsapp')}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          {whatsappLabel}
        </a>
      </div>
    </div>
  );
};
