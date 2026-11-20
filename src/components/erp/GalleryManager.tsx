import React, { useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { compressImage } from '../../lib/imageCompress.ts';
import { MOGADISHU_DISTRICTS } from '../../constants/mogadishu.ts';
import { Api, Lang, tr } from './types.ts';

export const GalleryManager: React.FC<{ lang: Lang; api: Api; gallery: any[]; onNotice: (m: string, k?: 'ok' | 'error') => void; onChanged: () => void }> = ({ lang, api, gallery, onNotice, onChanged }) => {
  const [titleSo, setTitleSo] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [category, setCategory] = useState('homes');
  const [district, setDistrict] = useState('Hodan');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return onNotice(tr(lang, 'Dooro sawir', 'Choose a photo'), 'error');
    if (!titleSo && !titleEn) return onNotice(tr(lang, 'Geli cinwaan', 'Enter a title'), 'error');
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      await api('/api/admin/gallery/upload', { method: 'POST', body: JSON.stringify({ titleSo, titleEn, category, district, dataUrl }) });
      setTitleSo('');
      setTitleEn('');
      setFile(null);
      onNotice(tr(lang, 'Sawirka waa la geliyay', 'Photo uploaded'));
      onChanged();
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (g: any) => {
    if (!window.confirm(tr(lang, 'Ma tirtirtaa sawirkan?', 'Delete this photo?'))) return;
    try {
      await api(`/api/admin/gallery/${g.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  return (
    <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
      <h3 className="text-base font-bold text-[#0B1F3A]">{tr(lang, 'Sawirada Website-ka (Gallery)', 'Website gallery photos')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 items-end text-xs">
        <input placeholder={tr(lang, 'Cinwaan (Soomaali)', 'Title (Somali)')} value={titleSo} onChange={(e) => setTitleSo(e.target.value)} />
        <input placeholder={tr(lang, 'Cinwaan (English)', 'Title (English)')} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="homes">{tr(lang, 'Guryo', 'Homes')}</option>
          <option value="offices">{tr(lang, 'Xafiisyo', 'Offices')}</option>
          <option value="packing">{tr(lang, 'Baakadeyn', 'Packing')}</option>
          <option value="trucks">{tr(lang, 'Gaadiid', 'Trucks')}</option>
        </select>
        <select value={district} onChange={(e) => setDistrict(e.target.value)}>
          {MOGADISHU_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" />
        <button type="button" disabled={busy} onClick={upload} className="erp-btn erp-btn-accent justify-center"><Upload className="w-4 h-4" />{busy ? '…' : tr(lang, 'Geli', 'Upload')}</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {gallery.map((g) => (
          <div key={g.id} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            <img src={g.imageUrl} alt={g.titleEn || g.titleSo} loading="lazy" className="w-full h-28 object-cover" />
            <div className="p-2 text-[11px] leading-tight"><div className="font-semibold truncate">{lang === 'so' ? g.titleSo : g.titleEn}</div><div className="text-slate-500">{g.category} · {g.district}</div></div>
            <button type="button" onClick={() => remove(g)} className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-white/90 text-rose-600 shadow" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
