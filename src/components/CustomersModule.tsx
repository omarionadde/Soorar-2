import React, { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, X, MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '../constants/mogadishu.ts';

interface Props {
  lang: 'so' | 'en';
  customers: any[];
  bookings: any[];
  payments: any[];
  canDelete: boolean;
  api: (url: string, opts?: RequestInit) => Promise<any>;
  refresh: () => void;
  notify: (msg: string, kind?: 'ok' | 'error') => void;
}

const EMPTY = { name: '', phone: '+252 ', email: '', customerType: 'family', notes: '' };

export const CustomersModule: React.FC<Props> = ({ lang, customers, bookings, payments, canDelete, api, refresh, notify }) => {
  const so = lang === 'so';
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [form, setForm] = useState<any>(null); // null = closed
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers
      .filter((c) => type === 'all' || c.customerType === type)
      .filter((c) => !term || [c.name, c.phone, c.email, c.notes].some((v) => String(v || '').toLowerCase().includes(term)))
      .map((c) => {
        const jobs = bookings.filter((b) => b.customerId === c.id);
        const paid = payments
          .filter((p) => jobs.some((b) => b.id === p.bookingId) || (p.customerName || '').toLowerCase() === (c.name || '').toLowerCase())
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        return { ...c, jobs: jobs.length, paid };
      });
  }, [customers, bookings, payments, q, type]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.phone.replace(/[^0-9]/g, '').length < 7) {
      notify(so ? 'Fadlan geli magac iyo taleefan sax ah.' : 'Enter a name and a valid phone.', 'error');
      return;
    }
    setBusy(true);
    try {
      const body = JSON.stringify({ name: form.name, phone: form.phone, email: form.email, customerType: form.customerType, notes: form.notes });
      if (form.id) await api(`/api/admin/customers/${form.id}`, { method: 'PATCH', body });
      else await api('/api/admin/customers', { method: 'POST', body });
      notify(form.id ? (so ? 'Macmiilka waa la cusboonaysiiyay' : 'Customer updated') : so ? 'Macmiil cusub waa la daray' : 'Customer added');
      setForm(null);
      refresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: any) => {
    if (!window.confirm(so ? `Ma tirtiraysaa ${c.name}?` : `Delete ${c.name}?`)) return;
    try {
      await api(`/api/admin/customers/${c.id}`, { method: 'DELETE' });
      notify(so ? 'Waa la tirtiray' : 'Deleted');
      refresh();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={so ? 'Raadi magac, taleefan…' : 'Search name, phone…'} className="w-full !pl-9 pr-3" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3">
          <option value="all">{so ? 'Dhammaan' : 'All types'}</option>
          <option value="family">{so ? 'Qoys' : 'Family'}</option>
          <option value="business">{so ? 'Ganacsi' : 'Business'}</option>
          <option value="ngo">NGO</option>
        </select>
        <button type="button" onClick={() => setForm({ ...EMPTY })} className="erp-btn erp-btn-primary">
          <Plus className="w-4 h-4" /> {so ? 'Macmiil cusub' : 'New customer'}
        </button>
      </div>

      {form && (
        <form onSubmit={save} className="erp-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="erp-h3">{form.id ? (so ? 'Wax ka beddel macmiilka' : 'Edit customer') : so ? 'Macmiil cusub' : 'New customer'}</h3>
            <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs font-medium">{so ? 'Magaca *' : 'Name *'}<input className="w-full px-3 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="text-xs font-medium">{so ? 'Taleefan *' : 'Phone *'}<input className="w-full px-3 mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></label>
            <label className="text-xs font-medium">Email<input className="w-full px-3 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="text-xs font-medium">{so ? 'Nooca' : 'Type'}
              <select className="w-full px-3 mt-1" value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
                <option value="family">{so ? 'Qoys' : 'Family'}</option>
                <option value="business">{so ? 'Ganacsi' : 'Business'}</option>
                <option value="ngo">NGO</option>
              </select>
            </label>
            <label className="text-xs font-medium sm:col-span-2 lg:col-span-4">{so ? 'Faahfaahin' : 'Notes'}<textarea className="w-full px-3 mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="erp-btn erp-btn-ghost">{so ? 'Jooji' : 'Cancel'}</button>
            <button type="submit" disabled={busy} className="erp-btn erp-btn-primary">{busy ? '…' : so ? 'Kaydi' : 'Save'}</button>
          </div>
        </form>
      )}

      <div className="erp-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
          {rows.length} {so ? 'macmiil' : 'customers'}
        </div>
        {rows.length === 0 ? (
          <div className="erp-empty m-5">{so ? 'Macmiil lama helin.' : 'No customers found.'}</div>
        ) : (
          <div>
            <table className="text-left">
              <thead>
                <tr>
                  <th className="py-3 px-4">{so ? 'Magaca' : 'Name'}</th>
                  <th className="py-3 px-4">{so ? 'Taleefan' : 'Phone'}</th>
                  <th className="py-3 px-4">{so ? 'Nooca' : 'Type'}</th>
                  <th className="py-3 px-4 text-right">{so ? 'Ballamo' : 'Jobs'}</th>
                  <th className="py-3 px-4 text-right">{so ? 'La bixiyay' : 'Paid'}</th>
                  <th className="py-3 px-4 text-right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0B1F3A]">{c.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[260px]">{c.email || c.notes}</div>
                    </td>
                    <td className="py-3 px-4 tabular-nums whitespace-nowrap">{c.phone}</td>
                    <td className="py-3 px-4 capitalize">{c.customerType}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{c.jobs}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700">${c.paid.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-1">
                        <a href={buildWhatsAppUrl(c.phone, `Asc ${c.name}, `)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"><MessageCircle className="w-4 h-4" /></a>
                        <button type="button" title={so ? 'Beddel' : 'Edit'} onClick={() => setForm({ ...EMPTY, ...c })} className="p-2 rounded-lg text-[#00529E] hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                        {canDelete && (
                          <button type="button" title={so ? 'Tirtir' : 'Delete'} onClick={() => remove(c)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
