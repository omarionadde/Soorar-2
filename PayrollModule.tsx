import React, { useCallback, useEffect, useState } from 'react';
import { Printer, CheckCircle2, Plus, Trash2, RefreshCw, Wallet } from 'lucide-react';
import type { PrintableDocData } from '../PrintableDocumentModal.tsx';
import { Api, Lang, tr, usd, todayMogadishu } from './types.ts';

const TYPES: Record<string, [string, string]> = {
  attendance: ['Maalmo shaqo', 'Days worked'],
  advance: ['Horumarin (advance)', 'Advance'],
  deduction: ['Goyn (deduction)', 'Deduction'],
  bonus: ['Gunno (bonus)', 'Bonus'],
};

export const PayrollModule: React.FC<{ lang: Lang; api: Api; onPrint: (d: PrintableDocData) => void; onNotice: (m: string, k?: 'ok' | 'error') => void; onChanged?: () => void }> = ({
  lang,
  api,
  onPrint,
  onNotice,
  onChanged,
}) => {
  const [period, setPeriod] = useState(todayMogadishu().slice(0, 7));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [form, setForm] = useState({ staffId: '', entryType: 'attendance', entryDate: todayMogadishu(), days: '1', amount: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api(`/api/admin/payroll?period=${period}`);
      setRows(d.rows || []);
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  useEffect(() => {
    load();
  }, [load]);

  const savePay = async (r: any, patch: any) => {
    try {
      await api(`/api/admin/staff/${r.staff.id}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ payType: r.payType, dailyRate: r.staff.dailyRate, monthlySalary: r.staff.monthlySalary, ...patch }),
      });
      load();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  const addEntry = async () => {
    if (!form.staffId) return onNotice(tr(lang, 'Dooro shaqaalaha', 'Choose a staff member'), 'error');
    try {
      await api('/api/admin/payroll/entries', { method: 'POST', body: JSON.stringify({ ...form, staffId: Number(form.staffId) }) });
      setForm({ ...form, amount: '', note: '' });
      onNotice(tr(lang, 'Waa la kaydiyay', 'Saved'));
      if (form.entryDate.slice(0, 7) !== period) setPeriod(form.entryDate.slice(0, 7));
      else load();
      if (form.entryType === 'advance') onChanged?.();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  const delEntry = async (id: number) => {
    if (!window.confirm(tr(lang, 'Ma tirtirtaa?', 'Delete?'))) return;
    try {
      await api(`/api/admin/payroll/entries/${id}`, { method: 'DELETE' });
      load();
      onChanged?.();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  const generate = async () => {
    try {
      const d = await api('/api/admin/payroll/payslips/generate', { method: 'POST', body: JSON.stringify({ period }) });
      setRows(d.rows || []);
      onNotice(tr(lang, `${d.count} warqadood mushahar ayaa la diyaariyay`, `${d.count} payslips generated`));
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  const pay = async (r: any) => {
    if (!r.payslip) return;
    if (!window.confirm(tr(lang, `Ma bixisay ${usd(r.payslip.net)} ${r.staff.name}? Waxaa loo diiwaangelin doonaa kharash (Salaries).`, `Mark ${usd(r.payslip.net)} to ${r.staff.name} as paid? It will be recorded as a Salaries expense.`))) return;
    try {
      await api(`/api/admin/payroll/payslips/${r.payslip.id}/pay`, { method: 'POST' });
      onNotice(tr(lang, 'Mushaharka waa la bixiyay', 'Payslip marked paid'));
      load();
      onChanged?.();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  const print = (r: any) => {
    const p = r.payslip || r;
    const n = (k: string) => Number(p[k] ?? r[k] ?? 0);
    onPrint({
      docType: 'REPORT',
      titleOverride: tr(lang, 'WARQADDA MUSHAHARKA', 'PAYSLIP'),
      docNumber: r.payslip?.payslipNumber || `DRAFT-${r.staff.id}-${period}`,
      date: todayMogadishu(),
      customerName: r.staff.name,
      customerPhone: r.staff.phone || '',
      subtotal: String(n('gross')),
      total: String(n('net')),
      report: {
        period: `${tr(lang, 'Bisha', 'Period')} ${period} · ${r.staff.name} (${r.staff.role}) · ID ${r.staff.idCardNumber || '-'}`,
        kpis: [
          { label: tr(lang, 'Mushaharka guud', 'Gross pay'), value: usd(n('gross')) },
          { label: tr(lang, 'Horumarin', 'Advances'), value: usd(n('advances')) },
          { label: tr(lang, 'Goyn', 'Deductions'), value: usd(n('deductions')) },
          { label: tr(lang, 'Lacagta la bixinayo', 'Net pay'), value: usd(n('net')) },
        ],
        tables: [
          {
            title: tr(lang, 'Faahfaahinta mushaharka', 'Pay breakdown'),
            columns: [tr(lang, 'Sharaxaad', 'Description'), tr(lang, 'Tirada', 'Qty'), tr(lang, 'Qiimaha', 'Rate'), tr(lang, 'Wadarta', 'Amount')],
            numericCols: [1, 2, 3],
            rows: [
              r.payType === 'monthly'
                ? [tr(lang, 'Mushahar bil ah', 'Monthly salary'), 1, usd(r.baseRate), usd(n('gross'))]
                : [tr(lang, 'Maalmo shaqo', 'Days worked'), String(r.payslip?.daysWorked ?? r.daysWorked), usd(r.baseRate), usd(n('gross'))],
              [tr(lang, 'Gunno', 'Bonuses'), '', '', usd(n('bonuses'))],
              [tr(lang, 'Horumarin (laga jarayo)', 'Advances (deducted)'), '', '', `-${usd(n('advances'))}`],
              [tr(lang, 'Goyn kale', 'Other deductions'), '', '', `-${usd(n('deductions'))}`],
              [tr(lang, 'LACAGTA LA BIXINAYO', 'NET PAY'), '', '', usd(n('net'))],
            ],
          },
          {
            title: tr(lang, 'Diiwaanka bisha', 'Entries this month'),
            columns: [tr(lang, 'Taariikh', 'Date'), tr(lang, 'Nooca', 'Type'), tr(lang, 'Maalmo', 'Days'), tr(lang, 'Lacag', 'Amount'), tr(lang, 'Faallo', 'Note')],
            numericCols: [2, 3],
            rows: (r.entries || []).map((e: any) => [e.entryDate, TYPES[e.entryType]?.[lang === 'so' ? 0 : 1] || e.entryType, e.entryType === 'attendance' ? String(Number(e.days)) : '', e.entryType === 'attendance' ? '' : usd(e.amount), e.note || '']),
          },
        ],
        notes: `${tr(lang, 'Xaaladda', 'Status')}: ${r.payslip?.status === 'Paid' ? tr(lang, 'LA BIXIYAY', 'PAID') : tr(lang, 'Qabyo (lama bixin)', 'Draft (unpaid)')}${r.payslip?.paidAt ? ' · ' + String(r.payslip.paidAt).slice(0, 10) : ''}. ${tr(lang, 'Saxiixa shaqaalaha: ____________   Saxiixa maamulka: ____________', 'Employee signature: ____________   Management signature: ____________')}`,
      },
    });
  };

  const totals = rows.reduce((a, r) => ({ gross: a.gross + r.gross, net: a.net + (r.payslip ? Number(r.payslip.net) : r.net) }), { gross: 0, net: 0 });

  return (
    <div className="space-y-5">
      <div className="erp-card p-4 sm:p-5 flex flex-wrap items-end gap-3 justify-between">
        <div className="flex items-end gap-3">
          <div>
            <label className="erp-label">{tr(lang, 'Bisha', 'Month')}</label>
            <input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
          </div>
          <button type="button" onClick={load} className="erp-btn erp-btn-ghost !px-2.5" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="text-sm text-slate-600">
          {tr(lang, 'Guud', 'Gross')}: <b>{usd(totals.gross)}</b> · {tr(lang, 'La bixinayo', 'Net')}: <b className="text-[#00529E]">{usd(totals.net)}</b>
        </div>
        <button type="button" onClick={generate} className="erp-btn erp-btn-primary"><Wallet className="w-4 h-4" />{tr(lang, 'Samee warqadaha mushaharka', 'Generate payslips')}</button>
      </div>

      <div className="erp-card p-4 sm:p-5 space-y-3">
        <h3 className="erp-h3">{tr(lang, 'Ku dar maalmo shaqo / horumarin / goyn / gunno', 'Add attendance / advance / deduction / bonus')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 items-end">
          <select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="sm:col-span-2">
            <option value="">{tr(lang, '— Shaqaalaha —', '— Staff —')}</option>
            {rows.map((r) => <option key={r.staff.id} value={r.staff.id}>{r.staff.name} ({r.staff.role})</option>)}
          </select>
          <select value={form.entryType} onChange={(e) => setForm({ ...form, entryType: e.target.value })}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v[lang === 'so' ? 0 : 1]}</option>)}
          </select>
          <input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
          {form.entryType === 'attendance' ? (
            <input type="number" step="0.5" min="0" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} placeholder={tr(lang, 'Maalmo', 'Days')} />
          ) : (
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="USD" />
          )}
          <button type="button" onClick={addEntry} className="erp-btn erp-btn-accent justify-center"><Plus className="w-4 h-4" />{tr(lang, 'Ku dar', 'Add')}</button>
          <input className="sm:col-span-6" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={tr(lang, 'Faallo (ikhtiyaari)', 'Note (optional)')} />
        </div>
        <p className="text-[11.5px] text-slate-500">
          {tr(
            lang,
            'Horumarinta waxaa isla markiiba loo diiwaangeliyaa kharash (Salaries); marka mushaharka la bixiyo lacagta saafiga ah ayaa kharash loo qoraa. Haddii maalmo shaqo aan la gelin, waxaa la xisaabiyaa maalmaha shaqooyinka la dhammeeyay ee loo qoondeeyay.',
            'Advances are recorded as a Salaries expense immediately; paying a payslip records the net amount. If no attendance is entered, days worked = days with completed jobs the person was assigned to.'
          )}
        </p>
      </div>

      <div className="erp-card overflow-x-auto">
        <table style={{ minWidth: 1050 }}>
          <thead>
            <tr>
              <th className="py-2.5 px-3 text-left">{tr(lang, 'Shaqaalaha', 'Staff')}</th>
              <th className="py-2.5 px-3 text-left">{tr(lang, 'Nooca mushaharka', 'Pay type')}</th>
              <th className="py-2.5 px-3 text-left">{tr(lang, 'Qiimaha', 'Rate')}</th>
              <th className="py-2.5 px-3 text-right">{tr(lang, 'Maalmo', 'Days')}</th>
              <th className="py-2.5 px-3 text-right">{tr(lang, 'Guud', 'Gross')}</th>
              <th className="py-2.5 px-3 text-right">{tr(lang, 'Horumarin', 'Adv.')}</th>
              <th className="py-2.5 px-3 text-right">{tr(lang, 'Goyn', 'Ded.')}</th>
              <th className="py-2.5 px-3 text-right">{tr(lang, 'Saafi', 'Net')}</th>
              <th className="py-2.5 px-3 text-left">{tr(lang, 'Xaalad', 'Status')}</th>
              <th className="py-2.5 px-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.staff.id}>
                <tr>
                  <td className="py-2 px-3">
                    <button type="button" className="font-semibold text-left hover:underline" onClick={() => setOpen(open === r.staff.id ? null : r.staff.id)}>{r.staff.name}</button>
                    <div className="text-[11px] text-slate-500">{r.staff.role} · {r.entries.length} {tr(lang, 'diiwaan', 'entries')}</div>
                  </td>
                  <td className="py-2 px-3">
                    <select value={r.payType} onChange={(e) => savePay(r, { payType: e.target.value })} className="!min-h-0 !py-1 text-xs">
                      <option value="daily">{tr(lang, 'Maalinle', 'Daily rate')}</option>
                      <option value="monthly">{tr(lang, 'Bille', 'Monthly salary')}</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      key={`${r.staff.id}-${r.payType}-${r.baseRate}`}
                      type="number"
                      step="0.01"
                      defaultValue={r.payType === 'monthly' ? r.staff.monthlySalary : r.staff.dailyRate}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (Number(v) !== Number(r.baseRate)) savePay(r, r.payType === 'monthly' ? { monthlySalary: v } : { dailyRate: v });
                      }}
                      className="!min-h-0 !py-1 w-24 text-xs font-mono-tabular"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-mono-tabular" title={r.daysSource === 'attendance' ? 'attendance' : 'completed jobs'}>
                    {r.daysWorked}{r.daysSource !== 'attendance' && <span className="text-[10px] text-slate-400"> *</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono-tabular">{usd(r.gross)}</td>
                  <td className="py-2 px-3 text-right font-mono-tabular">{usd(r.advances)}</td>
                  <td className="py-2 px-3 text-right font-mono-tabular">{usd(r.deductions + 0)}</td>
                  <td className="py-2 px-3 text-right font-mono-tabular font-bold text-[#00529E]">{usd(r.payslip ? r.payslip.net : r.net)}</td>
                  <td className="py-2 px-3 text-xs">
                    {r.payslip ? (
                      r.payslip.status === 'Paid' ? <span className="text-emerald-700 font-semibold">✓ {tr(lang, 'La bixiyay', 'Paid')}</span> : <span className="text-[#C46F00] font-semibold">{tr(lang, 'Qabyo', 'Draft')}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => print(r)} className="erp-btn erp-btn-ghost !py-1 !px-2 !text-xs"><Printer className="w-3.5 h-3.5" /></button>{' '}
                    {r.payslip && r.payslip.status !== 'Paid' && (
                      <button type="button" onClick={() => pay(r)} className="erp-btn erp-btn-primary !py-1 !px-2 !text-xs"><CheckCircle2 className="w-3.5 h-3.5" />{tr(lang, 'Bixi', 'Pay')}</button>
                    )}
                  </td>
                </tr>
                {open === r.staff.id && (
                  <tr>
                    <td colSpan={10} className="!bg-[#FAFBFD] px-3 py-2">
                      {r.entries.length === 0 ? (
                        <div className="text-xs text-slate-500">{tr(lang, 'Diiwaan ma jiro bishan.', 'No entries this month.')}</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {r.entries.map((e: any) => (
                            <span key={e.id} className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1">
                              {e.entryDate} · {TYPES[e.entryType]?.[lang === 'so' ? 0 : 1]} · {e.entryType === 'attendance' ? `${Number(e.days)}d` : usd(e.amount)} {e.note && `· ${e.note}`}
                              {r.payslip?.status !== 'Paid' && (
                                <button type="button" onClick={() => delEntry(e.id)} className="text-rose-600" aria-label="Delete"><Trash2 className="w-3 h-3" /></button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-slate-500">* {tr(lang, 'Maalmaha waxaa laga soo qaaday shaqooyinka la dhammeeyay.', 'Days taken from completed assigned jobs.')}</div>
    </div>
  );
};
