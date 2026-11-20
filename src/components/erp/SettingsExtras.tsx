import React, { useEffect, useState } from 'react';
import { Smartphone, Calculator, Gift, DatabaseBackup, KeyRound, Search, ScrollText, Copy } from 'lucide-react';
import { MOGADISHU_DISTRICTS } from '../../constants/mogadishu.ts';
import { parseZones } from '../../lib/instantQuote.ts';
import { Api, Lang, tr } from './types.ts';

const PAY_KEYS: Array<[string, string, string]> = [
  ['pay_evc_number', 'Lambarka EVC Plus', 'EVC Plus number'],
  ['pay_edahab_number', 'Lambarka eDahab', 'eDahab number'],
  ['pay_premier_number', 'Lambarka Premier Wallet', 'Premier Wallet number'],
  ['pay_account_name', 'Magaca akoonka (sida ay u muuqato)', 'Account name shown to payer'],
];
const QUOTE_KEYS: Array<[string, string, string]> = [
  ['quote_base_home', 'Qiimaha aasaasiga · Guri (USD)', 'Base price · Home (USD)'],
  ['quote_base_office', 'Qiimaha aasaasiga · Xafiis (USD)', 'Base price · Office (USD)'],
  ['quote_per_room', 'Qol kasta (USD)', 'Per room (USD)'],
  ['quote_per_floor', 'Dabaq kasta oo jaranjaro ah (USD)', 'Per floor of stairs (USD)'],
  ['quote_diff_district', 'Degmo kale (USD, hal mar)', 'Different district (USD, flat)'],
  ['quote_per_zone', 'Aag kasta oo u dhexeeya (USD)', 'Per zone step (USD)'],
  ['quote_packing_fee', 'Baakadeynta (USD)', 'Packing fee (USD)'],
  ['quote_range_pct', 'Kala fogaanshaha qiyaasta (%)', 'Estimate range spread (%)'],
];

export const SettingsExtras: React.FC<{ lang: Lang; api: Api; settings: Record<string, string>; onSaved: () => void; onNotice: (m: string, k?: 'ok' | 'error') => void }> = ({
  lang,
  api,
  settings,
  onSaved,
  onNotice,
}) => {
  const [f, setF] = useState<Record<string, string>>({});
  const [zones, setZones] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [custQ, setCustQ] = useState('');
  const [custRows, setCustRows] = useState<any[]>([]);
  const [temp, setTemp] = useState<{ who: string; pw: string } | null>(null);
  const [logs, setLogs] = useState<any>({ rows: [], page: 1, pages: 1, total: 0 });
  const [logQ, setLogQ] = useState('');

  useEffect(() => {
    const init: Record<string, string> = {};
    [...PAY_KEYS, ...QUOTE_KEYS].forEach(([k]) => (init[k] = settings[k] ?? ''));
    init.referral_discount_pct = settings.referral_discount_pct ?? '';
    setF(init);
    const z = parseZones(settings.quote_district_zones);
    const zs: Record<string, string> = {};
    MOGADISHU_DISTRICTS.forEach((d) => (zs[d] = z[d] !== undefined ? String(z[d]) : ''));
    setZones(zs);
  }, [settings]);

  const save = async (keys: string[], label: string) => {
    setBusy(label);
    try {
      const payload: Record<string, string> = {};
      keys.forEach((k) => (payload[k] = String(f[k] ?? '').trim()));
      if (label === 'quote') {
        const z: Record<string, number> = {};
        Object.entries(zones).forEach(([d, v]) => {
          if (String(v).trim() !== '' && Number.isFinite(Number(v))) z[d] = Number(v);
        });
        payload.quote_district_zones = JSON.stringify(z);
      }
      await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ settings: payload }) });
      onNotice(tr(lang, 'Waa la kaydiyay', 'Saved'));
      onSaved();
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const findCustomers = async () => {
    try {
      const d = await api(`/api/admin/list/customers?pageSize=20&q=${encodeURIComponent(custQ)}`);
      setCustRows(d.rows || []);
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };
  const resetCustomer = async (c: any) => {
    if (!window.confirm(tr(lang, `Ma u samaysaa password ku-meel-gaar ah ${c.name}?`, `Issue a temporary password for ${c.name}?`))) return;
    try {
      const d = await api(`/api/admin/customers/${c.id}/reset-password`, { method: 'POST' });
      setTemp({ who: `${d.name} · ${d.phone}`, pw: d.tempPassword });
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  const loadLogs = async (page = 1) => {
    try {
      setLogs(await api(`/api/admin/list/activity-log?page=${page}&pageSize=25&q=${encodeURIComponent(logQ)}`));
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  const backup = async () => {
    setBusy('backup');
    try {
      const data = await api('/api/admin/backup');
      const total = data?.photos?.count || 0;
      const photosData: any[] = [];
      for (let off = 0; off < total; off += 10) {
        const page = await api(`/api/admin/backup/photos?offset=${off}&limit=10`);
        photosData.push(...(page.photos || []));
      }
      data.photosData = photosData;
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soorar-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      onNotice(tr(lang, 'Backup-ka waa la soo dejiyay', 'Backup downloaded'));
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const field = ([k, so, en]: [string, string, string], placeholder = '') => (
    <div key={k}>
      <label className="erp-label">{tr(lang, so, en)}</label>
      <input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={placeholder} className="w-full font-mono-tabular" />
    </div>
  );

  return (
    <div className="space-y-6">
      {temp && (
        <div className="erp-card p-4 border-l-4 !border-l-emerald-500">
          <div className="text-sm font-semibold">{tr(lang, 'Password ku-meel-gaar ah (hal mar ayuu muuqanayaa)', 'Temporary password (shown once)')}</div>
          <div className="text-xs text-slate-500">{temp.who}</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="px-3 py-2 rounded-lg bg-slate-100 font-mono-tabular text-lg tracking-wider">{temp.pw}</code>
            <button type="button" className="erp-btn erp-btn-ghost !px-2.5" onClick={() => navigator.clipboard?.writeText(temp.pw)} aria-label="Copy"><Copy className="w-4 h-4" /></button>
            <button type="button" className="erp-btn erp-btn-ghost !text-xs" onClick={() => setTemp(null)}>{tr(lang, 'Xir', 'Dismiss')}</button>
          </div>
          <div className="text-[11.5px] text-slate-500 mt-1.5">{tr(lang, 'U dir qofka si ammaan ah; ha beddelo marka uu galo (Beddel Password).', 'Share it privately; they should change it after signing in (Change password).')}</div>
        </div>
      )}

      <div className="erp-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-[#F1980A]" /><h3 className="erp-h3">{tr(lang, 'Lambarada lacag bixinta (EVC Plus / eDahab / Premier Wallet)', 'Payment numbers (EVC Plus / eDahab / Premier Wallet)')}</h3></div>
        <p className="text-xs text-slate-500">{tr(lang, 'Macaamiishu waxay arkaan lambaradan ballanta/biilka. Ka tag mid madhan haddii aadan isticmaalin.', 'Customers see these on their booking/invoice. Leave a field empty to hide that method.')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{PAY_KEYS.map((k) => field(k))}</div>
        <button type="button" disabled={busy === 'pay'} onClick={() => save(PAY_KEYS.map((k) => k[0]), 'pay')} className="erp-btn erp-btn-accent">{tr(lang, 'Kaydi lambarada', 'Save numbers')}</button>
      </div>

      <div className="erp-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2"><Calculator className="w-5 h-5 text-[#00529E]" /><h3 className="erp-h3">{tr(lang, 'Qiimaha degdegga ah ee website-ka (Instant quote)', 'Website instant-quote pricing')}</h3></div>
        <div className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3">
          {tr(
            lang,
            '⚠ Qiimayaashan waa meelo bannaan oo Admin-ku dejiyo. Inta “Qiimaha aasaasiga” madhan yahay, website-ku wuxuu muujinayaa “Qiimaha waxaa lagu soo xaqiijin doonaa” oo codsiga wuu kaydinayaa (Lead).',
            '⚠ These are placeholders for the admin to set. While the base price is empty the website shows “Qiimaha waxaa lagu soo xaqiijin doonaa” (price to be confirmed) and still captures the lead.'
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{QUOTE_KEYS.map((k) => field(k, k[0] === 'quote_range_pct' ? '15' : tr(lang, 'Dhig qiimaha', 'Set price')))}</div>
        <div>
          <div className="erp-label">{tr(lang, 'Aagagga degmooyinka (lambar: 1, 2, 3…). Farqiga u dhexeeya aagagga × “Aag kasta”.', 'District zones (number 1, 2, 3…). Zone difference × “Per zone step”.')}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {MOGADISHU_DISTRICTS.map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-xs">
                <span className="flex-1 truncate">{d}</span>
                <input type="number" min="0" value={zones[d] ?? ''} onChange={(e) => setZones({ ...zones, [d]: e.target.value })} className="!min-h-0 !py-1 w-14 text-xs" />
              </label>
            ))}
          </div>
        </div>
        <button type="button" disabled={busy === 'quote'} onClick={() => save(QUOTE_KEYS.map((k) => k[0]), 'quote')} className="erp-btn erp-btn-accent">{tr(lang, 'Kaydi qiimaha', 'Save pricing')}</button>
      </div>

      <div className="erp-card p-4 sm:p-6 space-y-3">
        <div className="flex items-center gap-2"><Gift className="w-5 h-5 text-[#F1980A]" /><h3 className="erp-h3">{tr(lang, 'Referral: dhimista (%)', 'Referral discount (%)')}</h3></div>
        <div className="flex items-end gap-2">
          <input type="number" min="0" max="100" value={f.referral_discount_pct ?? ''} onChange={(e) => setF({ ...f, referral_discount_pct: e.target.value })} placeholder="%" className="w-28" />
          <button type="button" disabled={busy === 'ref'} onClick={() => save(['referral_discount_pct'], 'ref')} className="erp-btn erp-btn-accent">{tr(lang, 'Kaydi', 'Save')}</button>
        </div>
      </div>

      <div className="erp-card p-4 sm:p-6 space-y-3">
        <div className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-[#00529E]" /><h3 className="erp-h3">{tr(lang, 'Dib u dejinta password-ka macmiilka', 'Reset a customer password')}</h3></div>
        <div className="flex gap-2">
          <input value={custQ} onChange={(e) => setCustQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && findCustomers()} placeholder={tr(lang, 'Magac ama taleefan', 'Name or phone')} className="flex-1" />
          <button type="button" onClick={findCustomers} className="erp-btn erp-btn-ghost"><Search className="w-4 h-4" />{tr(lang, 'Raadi', 'Search')}</button>
        </div>
        {custRows.length > 0 && (
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {custRows.map((c) => (
              <li key={c.id} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                <span>{c.name} <span className="text-xs text-slate-500 font-mono-tabular">{c.phone}</span> {!c.hasPassword && <span className="text-[11px] text-slate-400">({tr(lang, 'password ma laha', 'no password')})</span>}</span>
                <button type="button" onClick={() => resetCustomer(c)} className="erp-btn erp-btn-ghost !py-1 !px-2.5 !text-xs">{tr(lang, 'Password cusub', 'Reset')}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="erp-card p-4 sm:p-6 space-y-3">
        <div className="flex items-center gap-2"><DatabaseBackup className="w-5 h-5 text-[#00529E]" /><h3 className="erp-h3">Backup</h3></div>
        <p className="text-xs text-slate-500">
          {tr(
            lang,
            'Waxay soo dejinaysaa JSON buuxa oo ah dhammaan jadwalada (sawirada ku jira). Soo celinta (restore) looma baahna oo laguma darin nidaamka. Kaydi faylka meel ammaan ah: wuxuu ka kooban yahay xog shakhsi ah.',
            'Downloads a full JSON export of every table (photos included). Restore is not needed and is not built in. Store the file safely: it contains personal data.'
          )}
        </p>
        <button type="button" disabled={busy === 'backup'} onClick={backup} className="erp-btn erp-btn-primary"><DatabaseBackup className="w-4 h-4" />{busy === 'backup' ? tr(lang, 'Waa la diyaarinayaa…', 'Preparing…') : tr(lang, 'Soo deji Backup (JSON)', 'Download backup (JSON)')}</button>
      </div>

      <div className="erp-card p-4 sm:p-6 space-y-3">
        <div className="flex items-center gap-2"><ScrollText className="w-5 h-5 text-[#00529E]" /><h3 className="erp-h3">{tr(lang, 'Diiwaanka dhaqdhaqaaqa (dhammaan, bog-bog)', 'Full activity log (paginated)')}</h3></div>
        <div className="flex gap-2">
          <input value={logQ} onChange={(e) => setLogQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadLogs(1)} placeholder={tr(lang, 'Raadi…', 'Search…')} className="flex-1" />
          <button type="button" onClick={() => loadLogs(1)} className="erp-btn erp-btn-ghost">{tr(lang, 'Soo bandhig', 'Load')}</button>
        </div>
        {logs.rows.length > 0 && (
          <>
            <div className="divide-y divide-slate-100 text-xs border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
              {logs.rows.map((l: any) => (
                <div key={l.id} className="px-3 py-2 flex justify-between gap-3">
                  <div><b className="text-[#00529E]">{l.action}</b> — {l.details}</div>
                  <div className="shrink-0 text-slate-400 text-right">{l.actorEmail}<div>{String(l.createdAt || '').slice(0, 16).replace('T', ' ')}</div></div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{logs.total} · {tr(lang, 'Bog', 'Page')} {logs.page}/{logs.pages || 1}</span>
              <span className="flex gap-1.5">
                <button type="button" disabled={logs.page <= 1} onClick={() => loadLogs(logs.page - 1)} className="erp-btn erp-btn-ghost !py-1 !px-2.5 !text-xs">←</button>
                <button type="button" disabled={logs.page >= logs.pages} onClick={() => loadLogs(logs.page + 1)} className="erp-btn erp-btn-ghost !py-1 !px-2.5 !text-xs">→</button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
