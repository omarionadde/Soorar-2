import React, { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import { compressImage } from '../../lib/imageCompress.ts';
import { Api, Lang, tr } from './types.ts';

interface Props {
  lang: Lang;
  api: Api;
  entityType: 'booking' | 'damage_claim';
  entityId: number;
  kinds: Array<{ id: string; label: string }>;
  canDelete?: boolean;
  /** Use the crew upload endpoint (assigned crew) instead of the admin one. */
  uploadUrl?: string;
  initialPhotos?: any[];
  compact?: boolean;
}

export const PhotoStrip: React.FC<Props> = ({ lang, api, entityType, entityId, kinds, canDelete, uploadUrl, initialPhotos, compact }) => {
  const [photos, setPhotos] = useState<any[]>(initialPhotos || []);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [view, setView] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (initialPhotos) {
      setPhotos(initialPhotos);
      return;
    }
    let live = true;
    api(`/api/admin/photos?entityType=${entityType}&entityId=${entityId}`)
      .then((d) => live && setPhotos(d.photos || []))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const upload = async (kind: string, files: FileList | null) => {
    if (!files || !files.length) return;
    setErr('');
    setBusy(kind);
    try {
      for (const f of Array.from(files).slice(0, 6)) {
        const dataUrl = await compressImage(f);
        const d = await api(uploadUrl || '/api/admin/photos', {
          method: 'POST',
          body: JSON.stringify({ entityType, entityId, kind, dataUrl }),
        });
        setPhotos((p) => [...p, d.photo]);
      }
    } catch (e: any) {
      setErr(e.message || 'Upload failed');
    } finally {
      setBusy('');
      const el = inputs.current[kind];
      if (el) el.value = '';
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm(tr(lang, 'Ma tirtirtaa sawirkan?', 'Delete this photo?'))) return;
    await api(`/api/admin/photos/${id}`, { method: 'DELETE' });
    setPhotos((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-2">
      {kinds.map((k) => {
        const list = photos.filter((p) => p.kind === k.id);
        return (
          <div key={k.id}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="text-[12px] font-semibold text-slate-600">
                {k.label} <span className="text-slate-400 font-normal">({list.length})</span>
              </div>
              <label className={`erp-btn erp-btn-ghost !py-1.5 !px-3 !text-xs ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                <Camera className="w-3.5 h-3.5 text-[#00529E]" />
                {busy === k.id ? tr(lang, 'Waa la gelinayaa…', 'Uploading…') : tr(lang, 'Sawir geli', 'Add photo')}
                <input
                  ref={(el) => {
                    inputs.current[k.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  capture={compact ? 'environment' : undefined}
                  multiple
                  className="hidden"
                  onChange={(e) => upload(k.id, e.target.files)}
                />
              </label>
            </div>
            {list.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {list.map((p) => (
                  <div key={p.id} className="relative shrink-0">
                    <img
                      src={p.url}
                      alt={k.label}
                      loading="lazy"
                      onClick={() => setView(p.url)}
                      className={`${compact ? 'w-20 h-20' : 'w-24 h-24'} object-cover rounded-xl border border-slate-200 cursor-zoom-in bg-slate-100`}
                    />
                    {canDelete && (
                      <button type="button" onClick={() => remove(p.id)} className="absolute top-1 right-1 p-1 rounded-lg bg-white/90 text-rose-600 shadow" aria-label="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11.5px] text-slate-400">{tr(lang, 'Sawir weli lama gelin.', 'No photos yet.')}</div>
            )}
          </div>
        );
      })}
      {err && <div className="text-xs text-rose-600">{err}</div>}
      {view && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setView(null)}>
          <button type="button" className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
          <img src={view} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
};
