import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  Calendar,
  CreditCard,
  Users,
  Truck,
  AlertCircle,
  Wallet,
  TrendingUp,
  MessageCircle,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';

/** Executive dashboard built only from real ERP data (no placeholder numbers). */
interface Props {
  lang: 'so' | 'en';
  userName: string;
  bookings: any[];
  payments: any[];
  expenses: any[];
  invoices: any[];
  leads: any[];
  staff: any[];
  vehicles: any[];
  logs: any[];
  go: (module: any) => void;
  confirmWaUrl: (b: any) => string;
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const dayKey = (v: any) => (v ? String(v).slice(0, 10) : '');
const monthKey = (v: any) => (v ? String(v).slice(0, 7) : '');

export const STATUS_STYLE: Record<string, string> = {
  New: 'bg-blue-50 text-[#00529E] ring-blue-200',
  Quoted: 'bg-amber-50 text-amber-700 ring-amber-200',
  Confirmed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'In progress': 'bg-orange-50 text-[#C46F00] ring-orange-200',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Unpaid: 'bg-rose-50 text-rose-700 ring-rose-200',
  Partial: 'bg-amber-50 text-amber-700 ring-amber-200',
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Suspended: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLE[status] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
    {status}
  </span>
);

export const ErpDashboard: React.FC<Props> = ({ lang, userName, bookings, payments, expenses, invoices, leads, staff, vehicles, logs, go, confirmWaUrl }) => {
  const so = lang === 'so';
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const lastMonth = prev.toISOString().slice(0, 7);

  const sum = (arr: any[], f: string) => arr.reduce((s, x) => s + Number(x[f] || 0), 0);
  const payDate = (p: any) => p.paidAt || p.createdAt;
  const revMonth = sum(payments.filter((p) => monthKey(payDate(p)) === thisMonth), 'amount');
  const revLast = sum(payments.filter((p) => monthKey(payDate(p)) === lastMonth), 'amount');
  const expMonth = sum(expenses.filter((e) => monthKey(e.expenseDate || e.createdAt) === thisMonth), 'amount');
  const unpaid = invoices.filter((i) => i.status !== 'Paid');
  const unpaidTotal = sum(unpaid, 'balanceDue');
  const openJobs = bookings.filter((b) => !['Completed', 'Cancelled'].includes(b.status));
  const newJobs = bookings.filter((b) => b.status === 'New');
  const upcoming = [...openJobs]
    .filter((b) => (b.preferredDate || '') >= today)
    .sort((a, b) => String(a.preferredDate + a.preferredTime).localeCompare(String(b.preferredDate + b.preferredTime)))
    .slice(0, 6);
  const delta = revLast > 0 ? ((revMonth - revLast) / revLast) * 100 : null;

  const chart = useMemo(() => {
    const out: Array<{ date: string; income: number }> = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        income: payments.filter((p) => dayKey(payDate(p)) === iso).reduce((s, p) => s + Number(p.amount || 0), 0),
      });
    }
    return out;
  }, [payments]);
  const total30 = chart.reduce((s, d) => s + d.income, 0);

  const statusCounts = ['New', 'Quoted', 'Confirmed', 'In progress', 'Completed', 'Cancelled'].map((s) => ({
    s,
    n: bookings.filter((b) => b.status === s).length,
  }));
  const maxStatus = Math.max(1, ...statusCounts.map((x) => x.n));

  const kpis = [
    { label: so ? 'Dakhliga bishan' : 'Revenue this month', value: usd(revMonth), icon: Wallet, tone: 'bg-[#00529E]', sub: delta === null ? (so ? 'Bishii hore: ' : 'Last month: ') + usd(revLast) : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}% ${so ? 'marka la barbardhigo bishii hore' : 'vs last month'}`, to: 'payments' },
    { label: so ? 'Shaqooyin furan' : 'Open jobs', value: String(openJobs.length), icon: ClipboardList, tone: 'bg-[#0B1F3A]', sub: `${newJobs.length} ${so ? 'cusub oo sugaya' : 'new awaiting action'}`, to: 'bookings' },
    { label: so ? 'Biilal aan la bixin' : 'Unpaid balance', value: usd(unpaidTotal), icon: AlertCircle, tone: 'bg-[#F1980A]', sub: `${unpaid.length} ${so ? 'biil' : 'invoices'}`, to: 'quotes_invoices' },
    { label: so ? 'Faa’iidada bishan' : 'Profit this month', value: usd(revMonth - expMonth), icon: TrendingUp, tone: 'bg-emerald-600', sub: `${so ? 'Kharash' : 'Expenses'}: ${usd(expMonth)}`, to: 'reports' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
            {so ? 'Soo dhawoow' : 'Welcome back'}, {userName.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString(so ? 'so-SO' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => go('bookings')} className="erp-btn erp-btn-primary">
            <Calendar className="w-4 h-4" /> {so ? 'Ballamaha' : 'Bookings'}
          </button>
          <button type="button" onClick={() => go('reports')} className="erp-btn erp-btn-ghost">
            {so ? 'Warbixin' : 'Reports'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <button key={k.label} type="button" onClick={() => go(k.to)} className="erp-card p-4 sm:p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 leading-tight">{k.label}</span>
              <span className={`w-9 h-9 rounded-xl ${k.tone} text-white flex items-center justify-center shrink-0`}>
                <k.icon className="w-[18px] h-[18px]" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#0B1F3A] mt-2 tabular-nums">{k.value}</div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">{k.sub}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="erp-card p-5 lg:col-span-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="erp-h3">{so ? 'Lacagaha la helay (30 maalmood)' : 'Payments received (30 days)'}</h3>
              <div className="text-2xl font-bold text-[#00529E] mt-1 tabular-nums">{usd(total30)}</div>
            </div>
            <button type="button" onClick={() => go('payments')} className="erp-link">
              {so ? 'Eeg dhammaan' : 'View all'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-56 mt-3">
            {total30 === 0 ? (
              <div className="erp-empty h-full">{so ? 'Wali lacag lama diiwaangelin 30-kii maalmood ee la soo dhaafay.' : 'No payments recorded in the last 30 days yet.'}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="srRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00529E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00529E" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} minTickGap={24} />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(2)}`, so ? 'Lacag' : 'Income']} contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="income" stroke="#00529E" strokeWidth={2.5} fill="url(#srRev)" activeDot={{ r: 5, fill: '#F1980A', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="erp-card p-5 lg:col-span-4">
          <h3 className="erp-h3">{so ? 'Xaaladda ballamaha' : 'Bookings by status'}</h3>
          <div className="mt-4 space-y-3">
            {statusCounts.map(({ s, n }) => (
              <div key={s}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">{s}</span>
                  <span className="font-semibold text-[#0B1F3A] tabular-nums">{n}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${s === 'Completed' ? 'bg-emerald-500' : s === 'Cancelled' ? 'bg-slate-300' : s === 'New' ? 'bg-[#00529E]' : 'bg-[#F1980A]'}`} style={{ width: `${(n / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 text-center">
            <div><div className="text-lg font-bold tabular-nums">{leads.length}</div><div className="text-[11px] text-slate-500">Leads</div></div>
            <div><div className="text-lg font-bold tabular-nums">{staff.length}</div><div className="text-[11px] text-slate-500">{so ? 'Shaqaale' : 'Staff'}</div></div>
            <div><div className="text-lg font-bold tabular-nums">{vehicles.filter((v) => v.status === 'Available').length}/{vehicles.length}</div><div className="text-[11px] text-slate-500">{so ? 'Gaari diyaar' : 'Trucks free'}</div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="erp-card lg:col-span-7 overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="erp-h3">{so ? 'Rarida soo socota' : 'Upcoming moves'}</h3>
            <button type="button" onClick={() => go('bookings')} className="erp-link">{so ? 'Dhammaan' : 'All'} <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          {upcoming.length === 0 ? (
            <div className="erp-empty mx-5 mb-5">{so ? 'Ma jiraan rar soo socda.' : 'No upcoming moves scheduled.'}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((b) => (
                <li key={b.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-12 text-center shrink-0">
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">{new Date(b.preferredDate).toLocaleDateString('en-GB', { month: 'short' })}</div>
                    <div className="text-lg font-bold text-[#0B1F3A] leading-none">{String(b.preferredDate).slice(8, 10)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#0B1F3A] truncate">{b.customerName}</div>
                    <div className="text-xs text-slate-500 truncate">{b.fromDistrict} → {b.toDistrict} · {b.preferredTime} · {b.referenceNumber}</div>
                  </div>
                  <StatusBadge status={b.status} />
                  <a href={confirmWaUrl(b)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 hover:bg-emerald-100">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="erp-card lg:col-span-5 overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="erp-h3">{so ? 'Dhaqdhaqaaqa dambe' : 'Recent activity'}</h3>
            <button type="button" onClick={() => go('settings')} className="erp-link">{so ? 'Audit' : 'Audit log'} <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          {logs.length === 0 ? (
            <div className="erp-empty mx-5 mb-5">{so ? 'Wali dhaqdhaqaaq ma jiro.' : 'No activity yet.'}</div>
          ) : (
            <ul className="px-5 pb-4 space-y-3 max-h-80 overflow-y-auto">
              {logs.slice(0, 8).map((l) => (
                <li key={l.id} className="flex gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F1980A] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-[#0B1F3A] leading-snug line-clamp-2">{l.details || l.action}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{l.actorEmail} · {l.createdAt ? new Date(l.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: so ? 'Macaamiil cusub' : 'Add customer', to: 'customers' },
          { icon: CreditCard, label: so ? 'Diiwaangeli lacag' : 'Record payment', to: 'payments' },
          { icon: Truck, label: so ? 'Gaadiidka' : 'Fleet', to: 'vehicles' },
          { icon: ClipboardList, label: so ? 'Qiimeyn cusub' : 'New quote', to: 'quotes_invoices' },
        ].map((a) => (
          <button key={a.label} type="button" onClick={() => go(a.to)} className="erp-card p-4 flex items-center gap-3 hover:border-[#00529E]/40 cursor-pointer">
            <span className="w-9 h-9 rounded-xl bg-[#00529E]/10 text-[#00529E] flex items-center justify-center"><a.icon className="w-[18px] h-[18px]" /></span>
            <span className="text-sm font-semibold text-[#0B1F3A]">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
