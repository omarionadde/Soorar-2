import React, { useCallback, useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Printer, RefreshCw } from 'lucide-react';
import type { PrintableDocData } from '../PrintableDocumentModal.tsx';
import { Api, Lang, tr, usd, todayMogadishu } from './types.ts';

export const ProfitReports: React.FC<{ lang: Lang; api: Api; onPrint: (d: PrintableDocData) => void; onNotice: (m: string, k?: 'ok' | 'error') => void }> = ({ lang, api, onPrint, onNotice }) => {
  const year = todayMogadishu().slice(0, 4);
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(todayMogadishu());
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setD(await api(`/api/admin/reports/profit?from=${from}&to=${to}`));
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);
  useEffect(() => {
    load();
  }, [load]);

  const print = () => {
    if (!d) return;
    onPrint({
      docType: 'REPORT',
      titleOverride: tr(lang, 'FAA’IIDADA SHAQOOYINKA', 'PROFIT PER JOB'),
      docNumber: `RPT-PROFIT-${to}`,
      date: todayMogadishu(),
      customerName: 'SOORAR',
      customerPhone: '',
      subtotal: String(d.totals.revenue),
      total: String(d.totals.profit),
      report: {
        period: `${from} → ${to}`,
        kpis: [
          { label: tr(lang, 'Dakhli', 'Revenue'), value: usd(d.totals.revenue) },
          { label: tr(lang, 'Kharash', 'Cost'), value: usd(d.totals.cost) },
          { label: tr(lang, 'Faa’iido', 'Profit'), value: usd(d.totals.profit) },
          { label: tr(lang, 'Shaqooyin', 'Jobs'), value: String(d.jobs.length) },
        ],
        tables: [
          {
            title: tr(lang, 'Faa’iidada shaqo kasta', 'Profit per job'),
            columns: ['Ref', tr(lang, 'Taariikh', 'Date'), tr(lang, 'Jidka', 'Route'), tr(lang, 'Dakhli', 'Revenue'), tr(lang, 'Kharash', 'Cost'), tr(lang, 'Faa’iido', 'Profit')],
            numericCols: [3, 4, 5],
            rows: d.jobs.map((j: any) => [j.ref, j.date, j.route, usd(j.revenue), usd(j.cost), usd(j.profit)]),
          },
          {
            title: tr(lang, 'Dakhliga iyo kharashka bille', 'Monthly revenue vs expenses'),
            columns: [tr(lang, 'Bisha', 'Month'), tr(lang, 'Dakhli', 'Revenue'), tr(lang, 'Kharash', 'Expenses'), tr(lang, 'Saafi', 'Net')],
            numericCols: [1, 2, 3],
            rows: d.monthly.map((m: any) => [m.month, usd(m.revenue), usd(m.expenses), usd(m.net)]),
          },
          {
            title: tr(lang, 'Degmooyinka ugu badan', 'Top districts'),
            columns: [tr(lang, 'Degmo', 'District'), tr(lang, 'Laga raray', 'From'), tr(lang, 'Loo raray', 'To'), tr(lang, 'Wadar', 'Total')],
            numericCols: [1, 2, 3],
            rows: d.topDistricts.map((x: any) => [x.district, x.from, x.to, x.total]),
          },
        ],
        notes: d.method,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="erp-card p-4 sm:p-5 flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h3 className="erp-h3">{tr(lang, 'Faa’iidada shaqo kasta · Degmooyinka · Bille', 'Profit per job · Districts · Monthly')}</h3>
          <div className="text-[11.5px] text-slate-500 mt-0.5">{tr(lang, 'Xisaabta: lacagaha shaqada − (kharashaadka ku xiran + shidaalka gaariga maalintaas + qaybta mushaharka shaqaalaha).', 'Job payments − (linked expenses + truck fuel that day + crew pay share).')}</div>
        </div>
        <div className="flex items-end gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" onClick={load} className="erp-btn erp-btn-ghost !px-2.5" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button type="button" onClick={print} className="erp-btn erp-btn-primary"><Printer className="w-4 h-4" />PDF</button>
        </div>
      </div>
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              [tr(lang, 'Dakhli (shaqooyin)', 'Job revenue'), usd(d.totals.revenue)],
              [tr(lang, 'Kharash (shaqooyin)', 'Job cost'), usd(d.totals.cost)],
              [tr(lang, 'Faa’iido', 'Profit'), usd(d.totals.profit)],
              [tr(lang, 'Shaqooyin', 'Jobs'), String(d.jobs.length)],
            ].map(([k, v]) => (
              <div key={k} className="erp-card p-4">
                <div className="text-xs text-slate-500">{k}</div>
                <div className="text-xl font-bold text-[#0B1F3A] font-mono-tabular">{v}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="erp-card p-4 lg:col-span-2">
              <div className="text-sm font-semibold mb-2">{tr(lang, 'Dakhliga vs kharashka bille', 'Monthly revenue vs expenses')}</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={d.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => usd(v)} />
                    <Legend />
                    <Bar dataKey="revenue" name={tr(lang, 'Dakhli', 'Revenue')} fill="#00529E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name={tr(lang, 'Kharash', 'Expenses')} fill="#F1980A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="erp-card p-4">
              <div className="text-sm font-semibold mb-2">{tr(lang, 'Degmooyinka ugu ballamaha badan', 'Top districts by bookings')}</div>
              {d.topDistricts.length === 0 ? (
                <div className="erp-empty">—</div>
              ) : (
                <div className="space-y-1.5">
                  {d.topDistricts.map((x: any) => (
                    <div key={x.district} className="text-xs">
                      <div className="flex justify-between"><span className="font-semibold">{x.district}</span><span className="font-mono-tabular">{x.total}</span></div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#00529E]" style={{ width: `${(x.total / d.topDistricts[0].total) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="erp-card overflow-x-auto">
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th className="py-2.5 px-3 text-left">Ref</th>
                  <th className="py-2.5 px-3 text-left">{tr(lang, 'Taariikh', 'Date')}</th>
                  <th className="py-2.5 px-3 text-left">{tr(lang, 'Jidka', 'Route')}</th>
                  <th className="py-2.5 px-3 text-right">{tr(lang, 'Qiimeyn', 'Quoted')}</th>
                  <th className="py-2.5 px-3 text-right">{tr(lang, 'Dakhli', 'Revenue')}</th>
                  <th className="py-2.5 px-3 text-right">{tr(lang, 'Kharash', 'Expenses')}</th>
                  <th className="py-2.5 px-3 text-right">{tr(lang, 'Shidaal', 'Fuel')}</th>
                  <th className="py-2.5 px-3 text-right">{tr(lang, 'Mushahar', 'Payroll')}</th>
                  <th className="py-2.5 px-3 text-right">{tr(lang, 'Faa’iido', 'Profit')}</th>
                </tr>
              </thead>
              <tbody>
                {d.jobs.map((j: any) => (
                  <tr key={j.id}>
                    <td className="py-2 px-3 font-mono-tabular text-xs font-bold text-[#00529E]">{j.ref}</td>
                    <td className="py-2 px-3 text-xs">{j.date}</td>
                    <td className="py-2 px-3 text-xs">{j.route}<div className="text-slate-500">{j.customer} · {j.status}</div></td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-xs">{usd(j.quoted)}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular">{usd(j.revenue)}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-xs">{usd(j.linkedExpenses)}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-xs">{usd(j.fuelShare)}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-xs">{usd(j.payrollShare)}</td>
                    <td className={`py-2 px-3 text-right font-mono-tabular font-bold ${j.profit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{usd(j.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
