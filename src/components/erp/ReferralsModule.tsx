import React, { useCallback, useEffect, useState } from 'react';
import { Gift, RefreshCw } from 'lucide-react';
import { Api, Lang, tr, usd } from './types.ts';

export const ReferralsModule: React.FC<{ lang: Lang; api: Api; defaultPct: string; canReward: boolean; onNotice: (m: string, k?: 'ok' | 'error') => void; onChanged?: () => void }> = ({
  lang,
  api,
  defaultPct,
  canReward,
  onNotice,
  onChanged,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [codes, setCodes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<Record<number, string>>({});
  const [pct, setPct] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api('/api/admin/referrals');
      setRows(d.referrals || []);
      setCodes(d.customersWithCodes || 0);
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const reward = async (r: any) => {
    const invoiceId = pick[r.id] || r.openInvoices?.[0]?.id;
    const p = pct[r.id] ?? defaultPct;
    if (!invoiceId) return onNotice(tr(lang, 'Biil furan (invoice) lama helin. Marka hore samee biil.', 'No open invoice found. Create an invoice first.'), 'error');
    if (!(Number(p) > 0)) return onNotice(tr(lang, 'Dhig boqolkiiba dhimista (Settings ama halkan).', 'Set the discount % (Settings or here).'), 'error');
    try {
      const d = await api(`/api/admin/referrals/${r.id}/reward`, { method: 'POST', body: JSON.stringify({ invoiceId: Number(invoiceId), pct: Number(p) }) });
      onNotice(tr(lang, `Dhimis ${usd(d.discount)} ayaa la saaray biilka`, `Discount of ${usd(d.discount)} applied to the invoice`));
      load();
      onChanged?.();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="erp-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Gift className="w-6 h-6 text-[#F1980A]" />
          <div>
            <h3 className="erp-h3">{tr(lang, 'Referral-ka macaamiisha', 'Customer referrals')}</h3>
            <div className="text-xs text-slate-500">
              {tr(lang, `${codes} macmiil ayaa leh koodh. Dhimista caadiga: ${defaultPct || '—'}% (Settings).`, `${codes} customers have a code. Default discount: ${defaultPct || '—'}% (Settings).`)}
            </div>
          </div>
        </div>
        <button type="button" onClick={load} className="erp-btn erp-btn-ghost !px-2.5" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {rows.length === 0 ? (
        <div className="erp-empty">{tr(lang, 'Weli referral lama helin. Macaamiishu koodhkooda waxay ka helaan Customer Portal-ka.', 'No referrals yet. Customers find their code in the Customer Portal.')}</div>
      ) : (
        <div className="erp-card overflow-x-auto">
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th className="py-2.5 px-3 text-left">{tr(lang, 'Taariikh', 'Date')}</th>
                <th className="py-2.5 px-3 text-left">{tr(lang, 'Qofka soo diray', 'Referrer')}</th>
                <th className="py-2.5 px-3 text-left">{tr(lang, 'Macmiilka cusub / ballan', 'New customer / booking')}</th>
                <th className="py-2.5 px-3 text-left">{tr(lang, 'Xaalad', 'Status')}</th>
                <th className="py-2.5 px-3 text-left">{tr(lang, 'Sii dhimis', 'Give discount')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 px-3 text-xs">{String(r.createdAt || '').slice(0, 10)}</td>
                  <td className="py-2 px-3 text-sm font-semibold">{r.referrerName}<div className="text-[11px] font-normal text-slate-500 font-mono-tabular">{r.referrerPhone} · {r.code}</div></td>
                  <td className="py-2 px-3 text-sm">{r.referredName || '—'}<div className="text-[11px] text-slate-500 font-mono-tabular">{r.bookingRef} · {r.bookingStatus}</div></td>
                  <td className="py-2 px-3 text-xs">
                    {r.status === 'Rewarded' ? <span className="text-emerald-700 font-semibold">✓ {Number(r.discountPct)}% · {usd(r.discountAmount)}</span> : <span className="text-[#C46F00] font-semibold">{tr(lang, 'Sugaya', 'Pending')}</span>}
                  </td>
                  <td className="py-2 px-3">
                    {r.status !== 'Rewarded' && canReward && (
                      <div className="flex items-center gap-1.5">
                        <select value={pick[r.id] || r.openInvoices?.[0]?.id || ''} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })} className="!min-h-0 !py-1 text-xs max-w-[220px]">
                          {(r.openInvoices || []).length === 0 && <option value="">{tr(lang, 'Biil furan ma jiro', 'No open invoice')}</option>}
                          {(r.openInvoices || []).map((i: any) => (
                            <option key={i.id} value={i.id}>{i.invoiceNumber} · {i.customerName} · {usd(i.total)}</option>
                          ))}
                        </select>
                        <input type="number" min="1" max="100" value={pct[r.id] ?? defaultPct} onChange={(e) => setPct({ ...pct, [r.id]: e.target.value })} className="!min-h-0 !py-1 w-16 text-xs" placeholder="%" />
                        <button type="button" onClick={() => reward(r)} className="erp-btn erp-btn-accent !py-1 !px-2.5 !text-xs">{tr(lang, 'Sii', 'Apply')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
