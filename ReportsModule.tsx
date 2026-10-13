import React, { useMemo, useState } from 'react';
import { Printer, Download } from 'lucide-react';
import type { PrintableDocData } from './PrintableDocumentModal.tsx';

interface Props {
  lang: 'so' | 'en';
  bookings: any[];
  payments: any[];
  expenses: any[];
  invoices: any[];
  onPrint: (doc: PrintableDocData) => void;
}

type Period = 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom';
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const d10 = (v: any) => (v ? String(v).slice(0, 10) : '');

function range(p: Period, from: string, to: string): [string, string] {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === 'this_month') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)];
  if (p === 'last_month') return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))];
  if (p === 'this_year') return [`${now.getFullYear()}-01-01`, iso(now)];
  if (p === 'custom') return [from || '0000-01-01', to || '9999-12-31'];
  return ['0000-01-01', '9999-12-31'];
}

function downloadCsv(name: string, header: string[], rows: Array<Array<string | number>>) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ReportsModule: React.FC<Props> = ({ lang, bookings, payments, expenses, invoices, onPrint }) => {
  const so = lang === 'so';
  const [period, setPeriod] = useState<Period>('this_month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [a, b] = range(period, from, to);
  const inRange = (v: any) => {
    const d = d10(v);
    return d >= a && d <= b;
  };

  const r = useMemo(() => {
    const P = payments.filter((p) => inRange(p.paidAt || p.createdAt));
    const E = expenses.filter((e) => inRange(e.expenseDate || e.createdAt));
    const B = bookings.filter((x) => inRange(x.preferredDate || x.createdAt));
    const revenue = P.reduce((s, p) => s + Number(p.amount || 0), 0);
    const cost = E.reduce((s, e) => s + Number(e.amount || 0), 0);
    const completed = B.filter((x) => x.status === 'Completed');
    const unpaid = invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + Number(i.balanceDue || 0), 0);
    const group = <T,>(arr: T[], key: (x: T) => string, val: (x: T) => number) => {
      const m = new Map<string, { n: number; v: number }>();
      for (const x of arr) {
        const k = key(x) || '—';
        const cur = m.get(k) || { n: 0, v: 0 };
        cur.n += 1;
        cur.v += val(x);
        m.set(k, cur);
      }
      return [...m.entries()].sort((p, q) => q[1].v - p[1].v || q[1].n - p[1].n);
    };
    return {
      P, E, B, revenue, cost, completed, unpaid,
      byMethod: group(P, (p: any) => p.paymentMethod, (p: any) => Number(p.amount || 0)),
      byCategory: group(E, (e: any) => e.category, (e: any) => Number(e.amount || 0)),
      byDistrict: group(B, (x: any) => x.fromDistrict, (x: any) => Number(x.quotedAmount || 0)),
      byStatus: group(B, (x: any) => x.status, () => 1),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, expenses, bookings, invoices, a, b]);

  const periodLabel =
    period === 'all' ? (so ? 'Dhammaan waqtiga' : 'All time') : `${a === '0000-01-01' ? '…' : a} → ${b === '9999-12-31' ? '…' : b}`;

  const kpis = [
    { label: so ? 'Dakhli' : 'Revenue', value: usd(r.revenue) },
    { label: so ? 'Kharash' : 'Expenses', value: usd(r.cost) },
    { label: so ? 'Faa’iido' : 'Net profit', value: usd(r.revenue - r.cost) },
    { label: so ? 'Ballamo' : 'Bookings', value: String(r.B.length) },
    { label: so ? 'La dhammeeyay' : 'Completed', value: String(r.completed.length) },
    { label: so ? 'Celcelis lacag' : 'Avg payment', value: usd(r.P.length ? r.revenue / r.P.length : 0) },
    { label: so ? 'Lacag-bixin' : 'Payments', value: String(r.P.length) },
    { label: so ? 'Biilal furan' : 'Unpaid (all)', value: usd(r.unpaid) },
  ];

  const printReport = () => {
    const now = new Date().toISOString().slice(0, 10);
    onPrint({
      docType: 'REPORT',
      docNumber: `RPT-${now.replace(/-/g, '')}`,
      date: now,
      customerName: 'SOORAR',
      customerPhone: '',
      subtotal: String(r.revenue),
      total: String(r.revenue - r.cost),
      titleOverride: so ? 'WARBIXIN MAALIYADEED' : 'FINANCIAL REPORT',
      report: {
        period: periodLabel,
        kpis,
        tables: [
          { title: so ? 'Dakhliga habka lacag bixinta' : 'Revenue by payment method', columns: [so ? 'Habka' : 'Method', so ? 'Tirada' : 'Count', so ? 'Lacagta' : 'Amount'], numericCols: [1, 2], rows: r.byMethod.map(([k, v]) => [k, v.n, usd(v.v)]) },
          { title: so ? 'Kharashka qaybaha' : 'Expenses by category', columns: [so ? 'Qaybta' : 'Category', so ? 'Tirada' : 'Count', so ? 'Lacagta' : 'Amount'], numericCols: [1, 2], rows: r.byCategory.map(([k, v]) => [k, v.n, usd(v.v)]) },
          { title: so ? 'Ballamaha degmooyinka' : 'Bookings by district', columns: [so ? 'Degmada' : 'District', so ? 'Ballamo' : 'Jobs', so ? 'Qiimaha la sheegay' : 'Quoted'], numericCols: [1, 2], rows: r.byDistrict.map(([k, v]) => [k, v.n, usd(v.v)]) },
          { title: so ? 'Ballamaha' : 'Bookings', columns: ['Ref', so ? 'Macmiil' : 'Client', so ? 'Jidka' : 'Route', so ? 'Taariikh' : 'Date', 'Status', so ? 'Qiimo' : 'Quoted'], numericCols: [5], rows: r.B.map((x: any) => [x.referenceNumber, x.customerName, `${x.fromDistrict} → ${x.toDistrict}`, x.preferredDate, x.status, usd(Number(x.quotedAmount || 0))]) },
          { title: so ? 'Lacagaha la helay' : 'Payments received', columns: [so ? 'Rasiid' : 'Receipt', so ? 'Macmiil' : 'Client', so ? 'Habka' : 'Method', so ? 'Taariikh' : 'Date', so ? 'Lacag' : 'Amount'], numericCols: [4], rows: r.P.map((p: any) => [p.receiptNumber, p.customerName, p.paymentMethod, d10(p.paidAt), usd(Number(p.amount || 0))]) },
          { title: so ? 'Kharashaadka' : 'Expenses', columns: [so ? 'Qaybta' : 'Category', so ? 'Faahfaahin' : 'Description', so ? 'Taariikh' : 'Date', so ? 'Lacag' : 'Amount'], numericCols: [3], rows: r.E.map((e: any) => [e.category, e.description, d10(e.expenseDate), usd(Number(e.amount || 0))]) },
        ],
      },
    });
  };

  const Table: React.FC<{ title: string; head: string[]; rows: Array<Array<React.ReactNode>>; num?: number[] }> = ({ title, head, rows, num = [] }) => (
    <div className="erp-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 erp-h3">{title}</div>
      {rows.length === 0 ? (
        <div className="erp-empty m-4">{so ? 'Xog ma jirto muddadan.' : 'No records in this period.'}</div>
      ) : (
        <div>
          <table className="text-left">
            <thead><tr>{head.map((h, i) => <th key={i} className={`py-2.5 px-4 ${num.includes(i) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className={`py-2.5 px-4 ${num.includes(j) ? 'text-right tabular-nums' : ''}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="erp-card p-4 sm:p-5 flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium">{so ? 'Muddada' : 'Period'}
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="block px-3 mt-1">
              <option value="this_month">{so ? 'Bishan' : 'This month'}</option>
              <option value="last_month">{so ? 'Bishii hore' : 'Last month'}</option>
              <option value="this_year">{so ? 'Sannadkan' : 'This year'}</option>
              <option value="all">{so ? 'Dhammaan' : 'All time'}</option>
              <option value="custom">{so ? 'Taariikh gaar ah' : 'Custom range'}</option>
            </select>
          </label>
          {period === 'custom' && (
            <>
              <label className="text-xs font-medium">{so ? 'Laga bilaabo' : 'From'}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block px-3 mt-1" /></label>
              <label className="text-xs font-medium">{so ? 'Ilaa' : 'To'}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block px-3 mt-1" /></label>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadCsv(`SOORAR_bookings_${a}_${b}.csv`, ['Reference', 'Customer', 'Phone', 'From', 'To', 'Date', 'Status', 'Quoted USD'], r.B.map((x: any) => [x.referenceNumber, x.customerName, x.customerPhone, x.fromDistrict, x.toDistrict, x.preferredDate, x.status, x.quotedAmount]))} className="erp-btn erp-btn-ghost">
            <Download className="w-4 h-4" /> CSV {so ? 'ballamo' : 'bookings'}
          </button>
          <button type="button" onClick={() => downloadCsv(`SOORAR_payments_${a}_${b}.csv`, ['Receipt', 'Customer', 'Method', 'Type', 'Reference', 'Date', 'Amount USD'], r.P.map((p: any) => [p.receiptNumber, p.customerName, p.paymentMethod, p.paymentType, p.referenceCode, d10(p.paidAt), p.amount]))} className="erp-btn erp-btn-ghost">
            <Download className="w-4 h-4" /> CSV {so ? 'lacagaha' : 'payments'}
          </button>
          <button type="button" onClick={printReport} className="erp-btn erp-btn-accent">
            <Printer className="w-4 h-4" /> {so ? 'Daabac warbixinta' : 'Print report'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={k.label} className="erp-card p-4" style={{ borderTop: `3px solid ${i % 2 ? '#F1980A' : '#00529E'}` }}>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{k.label}</div>
            <div className="text-xl font-bold text-[#0B1F3A] mt-1 tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Table title={so ? 'Dakhliga habka lacag bixinta' : 'Revenue by method'} head={[so ? 'Habka' : 'Method', '#', so ? 'Lacag' : 'Amount']} num={[1, 2]} rows={r.byMethod.map(([k, v]) => [k, v.n, usd(v.v)])} />
        <Table title={so ? 'Kharashka qaybaha' : 'Expenses by category'} head={[so ? 'Qaybta' : 'Category', '#', so ? 'Lacag' : 'Amount']} num={[1, 2]} rows={r.byCategory.map(([k, v]) => [k, v.n, usd(v.v)])} />
        <Table title={so ? 'Ballamaha degmooyinka' : 'Bookings by district'} head={[so ? 'Degmada' : 'District', '#', so ? 'Qiimo' : 'Quoted']} num={[1, 2]} rows={r.byDistrict.map(([k, v]) => [k, v.n, usd(v.v)])} />
      </div>
      <Table title={so ? 'Lacagaha la helay' : 'Payments received'} head={[so ? 'Rasiid' : 'Receipt', so ? 'Macmiil' : 'Client', so ? 'Habka' : 'Method', so ? 'Taariikh' : 'Date', so ? 'Lacag' : 'Amount']} num={[4]} rows={r.P.map((p: any) => [p.receiptNumber, p.customerName, p.paymentMethod, d10(p.paidAt), usd(Number(p.amount || 0))])} />
    </div>
  );
};
