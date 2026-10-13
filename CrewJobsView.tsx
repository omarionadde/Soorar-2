import React, { useCallback, useEffect, useState } from 'react';
import { Phone, MapPin, Navigation, Truck, Users, RefreshCw, CheckCircle2, PlayCircle, Route, Clock } from 'lucide-react';
import { PhotoStrip } from './PhotoStrip.tsx';
import { Api, Lang, tr } from './types.ts';

const mapsSearch = (addr: string, district: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([addr, district, 'Mogadishu, Somalia'].filter(Boolean).join(', '))}`;
const mapsDir = (fromA: string, fromD: string, toA: string, toD: string) =>
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent([fromA, fromD, 'Mogadishu'].filter(Boolean).join(', '))}&destination=${encodeURIComponent(
    [toA, toD, 'Mogadishu'].filter(Boolean).join(', ')
  )}&travelmode=driving`;

const STEPS: Array<{ id: 'on_the_way' | 'started' | 'completed'; so: string; en: string; icon: any; cls: string }> = [
  { id: 'on_the_way', so: 'Waan ku jiraa jidka', en: 'On the way', icon: Route, cls: 'bg-[#00529E] hover:bg-[#00447F]' },
  { id: 'started', so: 'Waa la bilaabay', en: 'Started', icon: PlayCircle, cls: 'bg-[#F1980A] hover:bg-[#D9870A]' },
  { id: 'completed', so: 'Waa la dhammeeyay', en: 'Completed', icon: CheckCircle2, cls: 'bg-emerald-600 hover:bg-emerald-500' },
];
const order = (s: string) => ['', 'on_the_way', 'started', 'completed'].indexOf(s || '');

export const CrewJobsView: React.FC<{ lang: Lang; api: Api; userName: string; onNotice: (m: string, k?: 'ok' | 'error') => void }> = ({ lang, api, userName, onNotice }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api('/api/crew/my-jobs'));
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

  const setStatus = async (job: any, action: string) => {
    if (action === 'completed' && !window.confirm(tr(lang, 'Ma hubtaa in shaqada la dhammeeyay?', 'Mark this job as completed?'))) return;
    setBusy(job.id + action);
    try {
      await api(`/api/crew/jobs/${job.id}/status`, { method: 'POST', body: JSON.stringify({ action }) });
      onNotice(tr(lang, 'Xaaladda waa la cusbooneysiiyay', 'Status updated'));
      load();
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const jobs: any[] = data?.jobs || [];
  const today = jobs.filter((j) => j.isToday || j.crewStatus === 'started' || j.crewStatus === 'on_the_way');
  const upcoming = jobs.filter((j) => !today.includes(j));

  const Card = ({ j }: { j: any }) => (
    <div className="erp-card overflow-hidden">
      <div className="px-4 py-3 bg-[#0B1F3A] text-white flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono-tabular text-[11px] text-[#F1980A] font-bold">{j.referenceNumber}</div>
          <div className="text-sm font-semibold truncate">{j.customerName}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs flex items-center gap-1 justify-end"><Clock className="w-3.5 h-3.5" />{j.preferredTime}</div>
          <div className="text-[11px] text-white/70">{j.preferredDate}</div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <a href={`tel:${String(j.customerPhone).replace(/[^0-9+]/g, '')}`} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm">
          <Phone className="w-4 h-4" /> {tr(lang, 'Wac macmiilka', 'Call customer')} · {j.customerPhone}
        </a>
        <div className="grid grid-cols-1 gap-2 text-sm">
          <a href={mapsSearch(j.fromAddress, j.fromDistrict)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 p-3 rounded-xl bg-[#F4F6FA] border border-slate-200">
            <MapPin className="w-4 h-4 text-[#00529E] mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">{tr(lang, 'Laga qaadayo', 'Pickup')}</span>
              <span className="block font-medium">{[j.fromAddress, j.fromDistrict].filter(Boolean).join(', ')}</span>
              <span className="block text-[11px] text-slate-500">{tr(lang, 'Dabaq', 'Floor')} {j.fromFloor ?? 0}{j.fromLift ? ` · ${tr(lang, 'wiish', 'lift')}` : ''}</span>
            </span>
          </a>
          <a href={mapsSearch(j.toAddress, j.toDistrict)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 p-3 rounded-xl bg-[#F4F6FA] border border-slate-200">
            <MapPin className="w-4 h-4 text-[#F1980A] mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">{tr(lang, 'Loo qaadayo', 'Drop-off')}</span>
              <span className="block font-medium">{[j.toAddress, j.toDistrict].filter(Boolean).join(', ')}</span>
              <span className="block text-[11px] text-slate-500">{tr(lang, 'Dabaq', 'Floor')} {j.toFloor ?? 0}{j.toLift ? ` · ${tr(lang, 'wiish', 'lift')}` : ''}</span>
            </span>
          </a>
          <a href={mapsDir(j.fromAddress, j.fromDistrict, j.toAddress, j.toDistrict)} target="_blank" rel="noopener noreferrer" className="erp-btn erp-btn-ghost justify-center">
            <Navigation className="w-4 h-4 text-[#00529E]" /> {tr(lang, 'Jidka Google Maps', 'Directions in Google Maps')}
          </a>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {j.vehicle && <span className="inline-flex items-center gap-1"><Truck className="w-3.5 h-3.5" />{j.vehicle.plateNumber} · {j.vehicle.name}</span>}
          {j.crew?.length > 0 && <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{j.crew.map((c: any) => c.name).join(', ')}</span>}
        </div>
        {(j.sizeDescription || j.largeItems || j.notes) && (
          <div className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-xl p-2.5">{[j.sizeDescription, j.largeItems, j.notes].filter(Boolean).join(' · ')}</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {STEPS.map((s) => {
            const done = order(j.crewStatus) >= order(s.id);
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!!busy || done || j.status === 'Completed'}
                onClick={() => setStatus(j, s.id)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-colors disabled:cursor-default ${done ? 'bg-slate-300' : s.cls} ${busy === j.id + s.id ? 'opacity-60' : ''}`}
              >
                <Icon className="w-4 h-4" /> {tr(lang, s.so, s.en)} {done && '✓'}
              </button>
            );
          })}
        </div>
        <div className="pt-2 border-t border-slate-100">
          <PhotoStrip
            lang={lang}
            api={api}
            entityType="booking"
            entityId={j.id}
            uploadUrl={`/api/crew/jobs/${j.id}/photos`}
            initialPhotos={j.photos}
            compact
            kinds={[
              { id: 'before', label: tr(lang, 'Sawirada ka hor (Before)', 'Before photos') },
              { id: 'after', label: tr(lang, 'Sawirada ka dib (After)', 'After photos') },
            ]}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0B1F3A]">{tr(lang, 'Shaqadayda Maanta', 'My jobs today')}</h2>
          <div className="text-xs text-slate-500">{data?.staff?.name || userName}{data?.today ? ` · ${data.today}` : ''}</div>
        </div>
        <button type="button" onClick={load} className="erp-btn erp-btn-ghost !px-3" aria-label="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {data && !data.linked && (
        <div className="erp-empty">
          {tr(
            lang,
            'Akoonkaaga weli laguma xirin diiwaanka shaqaalaha. Admin-ka ha kugu xiro (Settings → Users → Shaqaale) ama ha isku mid noqdaan taleefannadu.',
            'Your login is not linked to a crew record yet. Ask the admin to link it (Settings → Users → Crew record) or use the same phone number.'
          )}
        </div>
      )}
      {data?.linked && jobs.length === 0 && <div className="erp-empty">{tr(lang, 'Shaqo laguuma qoondeyn maanta iyo maalmaha soo socda.', 'No jobs assigned for today or upcoming days.')}</div>}
      {today.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#C46F00]">{tr(lang, 'Maanta', 'Today')} ({today.length})</div>
          {today.map((j) => <React.Fragment key={j.id}>{Card({ j })}</React.Fragment>)}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{tr(lang, 'Soo socda', 'Upcoming')} ({upcoming.length})</div>
          {upcoming.map((j) => <React.Fragment key={j.id}>{Card({ j })}</React.Fragment>)}
        </div>
      )}
    </div>
  );
};
