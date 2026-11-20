import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { MOGADISHU_DISTRICTS } from '../../constants/mogadishu.ts';
import { Api, Lang, tr, usd } from './types.ts';

const CATS = ['Packing Materials', 'Fuel Station', 'Garage / Spare Parts', 'Subcontract Trucks', 'Office Supplies', 'Other'];
const empty = { companyName: '', contactPerson: '', phone: '+252 ', category: 'Packing Materials', district: 'Hodan', balanceUsd: '0', status: 'Active' };

export const SuppliersManager: React.FC<{ lang: Lang; api: Api; suppliers: any[]; purchaseOrders: any[]; canDelete: boolean; onNotice: (m: string, k?: 'ok' | 'error') => void; onChanged: () => void }> = ({
  lang,
  api,
  suppliers,
  purchaseOrders,
  canDelete,
  onNotice,
  onChanged,
}) => {
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  const save = async () => {
    if (!form.companyName || !form.phone) return onNotice(tr(lang, 'Magaca iyo taleefanka waa qasab', 'Name and phone are required'), 'error');
    try {
      if (editId) await api(`/api/admin/suppliers/${editId}`, { method: 'PATCH', body: JSON.stringify(form) });
      else await api('/api/admin/suppliers', { method: 'POST', body: JSON.stringify(form) });
      setForm(empty);
      setEditId(null);
      onChanged();
      onNotice(tr(lang, 'Alaab-keenaha waa la kaydiyay', 'Supplier saved'));
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };
  const remove = async (s: any) => {
    if (!window.confirm(tr(lang, `Ma tirtirtaa ${s.companyName}? Dalabyadii hore magaca ayay hayn doonaan.`, `Delete ${s.companyName}? Past POs keep the name.`))) return;
    try {
      await api(`/api/admin/suppliers/${s.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };
  const poStats = (s: any) => {
    const list = purchaseOrders.filter((p) => p.supplierId === s.id || (!p.supplierId && p.supplierName === s.companyName));
    return { n: list.length, total: list.reduce((a, p) => a + Number(p.totalUsd || 0), 0) };
  };

  return (
    <div className="erp-card p-4 sm:p-5 space-y-4">
      <h3 className="erp-h3">{tr(lang, 'Alaab-keenayaasha (Suppliers)', 'Suppliers')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 items-end">
        <input className="lg:col-span-2" placeholder={tr(lang, 'Magaca shirkadda *', 'Company name *')} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        <input placeholder={tr(lang, 'Qofka xiriirka', 'Contact person')} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
        <input placeholder={tr(lang, 'Taleefan *', 'Phone *')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="font-mono-tabular" />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {[...new Set([...CATS, form.category])].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
          {[...new Set([...MOGADISHU_DISTRICTS, form.district || 'Hodan'])].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="number" step="0.01" placeholder={tr(lang, 'Deyn (USD)', 'Balance USD')} value={form.balanceUsd} onChange={(e) => setForm({ ...form, balanceUsd: e.target.value })} />
        <div className="flex gap-1.5">
          <button type="button" onClick={save} className="erp-btn erp-btn-accent flex-1 justify-center">{editId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editId ? tr(lang, 'Kaydi', 'Save') : tr(lang, 'Ku dar', 'Add')}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(empty); }} className="erp-btn erp-btn-ghost !px-2.5" aria-label="Cancel"><X className="w-4 h-4" /></button>}
        </div>
      </div>
      {suppliers.length === 0 ? (
        <div className="erp-empty">{tr(lang, 'Weli alaab-keene lama gelin.', 'No suppliers yet.')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="py-2 px-3 text-left">Code</th>
                <th className="py-2 px-3 text-left">{tr(lang, 'Shirkadda', 'Company')}</th>
                <th className="py-2 px-3 text-left">{tr(lang, 'Xiriir', 'Contact')}</th>
                <th className="py-2 px-3 text-left">{tr(lang, 'Nooca', 'Category')}</th>
                <th className="py-2 px-3 text-right">{tr(lang, 'Dalabyo (PO)', 'POs')}</th>
                <th className="py-2 px-3 text-right">{tr(lang, 'Deyn', 'Balance')}</th>
                <th className="py-2 px-3 text-left">{tr(lang, 'Xaalad', 'Status')}</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => {
                const st = poStats(s);
                return (
                  <tr key={s.id}>
                    <td className="py-2 px-3 font-mono-tabular text-xs">{s.supplierCode}</td>
                    <td className="py-2 px-3 font-semibold">{s.companyName}<div className="text-[11px] text-slate-500 font-normal">{s.district}</div></td>
                    <td className="py-2 px-3 text-xs">{s.contactPerson}<div className="font-mono-tabular">{s.phone}</div></td>
                    <td className="py-2 px-3 text-xs">{s.category}</td>
                    <td className="py-2 px-3 text-right text-xs font-mono-tabular">{st.n} · {usd(st.total)}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular">{usd(s.balanceUsd)}</td>
                    <td className="py-2 px-3 text-xs">
                      <button type="button" className="hover:underline" onClick={async () => { await api(`/api/admin/suppliers/${s.id}`, { method: 'PATCH', body: JSON.stringify({ status: s.status === 'Active' ? 'Inactive' : 'Active' }) }); onChanged(); }}>
                        {s.status}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => { setEditId(s.id); setForm({ companyName: s.companyName, contactPerson: s.contactPerson || '', phone: s.phone, category: s.category, district: s.district || '', balanceUsd: s.balanceUsd, status: s.status }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-[#00529E]" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                      {canDelete && <button type="button" onClick={() => remove(s)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
