import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Smartphone, RefreshCw } from 'lucide-react';
import { Api, Lang, tr, usd } from './types.ts';

export const PaymentReview: React.FC<{ lang: Lang; api: Api; onNotice: (m: string, k?: 'ok' | 'error') => void; onChanged?: () => void }> = ({ lang, api, onNotice, onChanged }) => {
  const [status, setStatus] = useState('Pending');
  const [rows, setRows] = useState<any[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api(`/api/admin/payment-submissions?status=${status}`);
      setRows(d.submissions || []);
      setPending(d.pendingCount || 0);
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);

  const approve = async (r: any) => {
    const amt = window.prompt(tr(lang, `Xaqiiji ${r.method} ref ${r.transactionRef}. Lacagta la helay (USD):`, `Approve ${r.method} ref ${r.transactionRef}. Amount received (USD):`), String(r.amount));
    if (amt === null) return;
    try {
      await api(`/api/admin/payment-submissions/${r.id}/approve`, { method: 'POST', body: JSON.stringify({ amount: amt }) });
      onNotice(tr(lang, 'Lacagta waa la xaqiijiyay oo biilka ayaa la cusbooneysiiyay', 'Payment approved and recorded on the invoice'));
      load();
      onChanged?.();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };
  const reject = async (r: any) => {
    const note = window.prompt(tr(lang, 'Sababta diidmada:', 'Reason for rejecting:'), '');
    if (note === null) return;
    try {
      await api(`/api/admin/payment-submissions/${r.id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
      onNotice(tr(lang, 'Waa la diiday', 'Rejected'));
      load();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  return (
    <div className="erp-card p-4 sm:p-5 space-y-3 border-l-4 !border-l-[#F1980A]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#F1980A]" />
          <h3 className="erp-h3">{tr(lang, 'Lacag sugaya xaqiijin', 'Payments awaiting verification')} {pending > 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-[#F1980A] text-white text-[11px]">{pending}</span>}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {['Pending', 'Approved', 'Rejected', 'all'].map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`erp-btn !py-1 !px-2.5 !text-xs ${status === s ? 'erp-btn-primary' : 'erp-btn-ghost'}`}>
              {s === 'Pending' ? tr(lang, 'Sugaya', 'Pending') : s === 'Approved' ? tr(lang, 'La oggolaaday', 'Approved') : s === 'Rejected' ? tr(lang, 'La diiday', 'Rejected') : tr(lang, 'Dhammaan', 'All')}
            </button>
          ))}
          <button type="button" onClick={load} className="erp-btn erp-btn-ghost !px-2" aria-label="Refresh"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>
      <p className="text-[11.5px] text-slate-500">
        {tr(lang, 'Macaamiishu waxay ku bixiyaan EVC Plus / eDahab / Premier Wallet lambarada Settings ku qoran, kadibna waxay soo gudbiyaan lambarka xaqiijinta. Hubi SMS-ka / app-ka ka hor intaadan oggolaan.', 'Customers pay to the numbers set in Settings, then submit the transaction reference. Check your SMS / wallet app before approving.')}
      </p>
      {rows.length === 0 ? (
        <div className="erp-empty">{tr(lang, 'Wax ma jiraan.', 'Nothing here.')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="py-2 px-3 text-left">{tr(lang, 'Taariikh', 'Date')}</th>
                <th className="py-2 px-3 text-left">{tr(lang, 'Ballan', 'Booking')}</th>
                <th className="py-2 px-3 text-left">{tr(lang, 'Macmiil', 'Customer')}</th>
                <th className="py-2 px-3 text-left">{tr(lang, 'Habka', 'Method')}</th>
                <th className="py-2 px-3 text-left">Ref</th>
                <th className="py-2 px-3 text-right">USD</th>
                <th className="py-2 px-3 text-left">{tr(lang, 'Xaalad', 'Status')}</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 px-3 text-xs whitespace-nowrap">{String(r.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                  <td className="py-2 px-3 font-mono-tabular text-xs font-bold text-[#00529E]">{r.bookingRef}{r.invoiceId ? ` · inv#${r.invoiceId}` : ''}</td>
                  <td className="py-2 px-3 text-xs">{r.customerName}<div className="text-slate-500">{r.payerPhone}</div></td>
                  <td className="py-2 px-3 text-xs">{r.method}</td>
                  <td className="py-2 px-3 font-mono-tabular text-xs">{r.transactionRef}</td>
                  <td className="py-2 px-3 text-right font-mono-tabular font-semibold">{usd(r.amount)}</td>
                  <td className="py-2 px-3 text-xs">{r.status}{r.reviewNote ? ` · ${r.reviewNote}` : ''}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    {r.status === 'Pending' && (
                      <>
                        <button type="button" onClick={() => approve(r)} className="erp-btn erp-btn-primary !py-1 !px-2 !text-xs"><CheckCircle2 className="w-3.5 h-3.5" />{tr(lang, 'Oggolow', 'Approve')}</button>{' '}
                        <button type="button" onClick={() => reject(r)} className="erp-btn erp-btn-danger !py-1 !px-2 !text-xs"><XCircle className="w-3.5 h-3.5" />{tr(lang, 'Diid', 'Reject')}</button>
                      </>
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
