import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Truck, Users, X, RefreshCw } from 'lucide-react';
import { Api, Lang, tr, todayMogadishu, addDays } from './types.ts';

const DAY_SO = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimco', 'Sabti'];
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DispatchCalendar: React.FC<{ lang: Lang; api: Api; canAssign: boolean; onNotice: (m: string, k?: 'ok' | 'error') => void; onChanged?: () => void }> = ({
  lang,
  api,
  canAssign,
  onNotice,
  onChanged,
}) => {
  const [mode, setMode] = useState<'day' | 'week'>('week');
  const [by, setBy] = useState<'vehicle' | 'staff'>('vehicle');
  const [anchor, setAnchor] = useState(todayMogadishu());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [editStaff, setEditStaff] = useState<number[]>([]);
  const [editVehicle, setEditVehicle] = useState<number | ''>('');

  const days = useMemo(() => {
    if (mode === 'day') return [anchor];
    const d = new Date(anchor + 'T00:00:00Z').getUTCDay(); // week starts Saturday (Somali work week)
    const start = addDays(anchor, -((d + 1) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [mode, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api(`/api/admin/dispatch?from=${days[0]}&to=${days[days.length - 1]}`));
    } catch (e: any) {
      onNotice(e.message, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(',')]);

  useEffect(() => {
    load();
  }, [load]);

  const bookings: any[] = data?.bookings || [];
  const vehicles: any[] = data?.vehicles || [];
  const staff: any[] = data?.staff || [];
  const conflicts: any[] = data?.conflicts || [];
  const rows = by === 'vehicle' ? vehicles.map((v) => ({ id: v.id, label: v.plateNumber, sub: v.name })) : staff.map((s) => ({ id: s.id, label: s.name, sub: s.role }));
  const inRow = (b: any, rowId: number | null) =>
    by === 'vehicle'
      ? rowId === null
        ? !b.assignedVehicleId
        : b.assignedVehicleId === rowId
      : rowId === null
      ? !(b.assignedStaffIds || []).length
      : (b.assignedStaffIds || []).map(Number).includes(rowId);
  const isConflict = (date: string, rowId: number) => conflicts.some((c) => c.date === date && c.type === by && c.id === rowId);

  const openEdit = (b: any) => {
    setEdit(b);
    setEditStaff((b.assignedStaffIds || []).map(Number));
    setEditVehicle(b.assignedVehicleId || '');
  };

  const saveEdit = async () => {
    try {
      const d = await api(`/api/admin/bookings/${edit.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ staffIds: editStaff, vehicleId: editVehicle || null }),
      });
      if (d.warnings?.length) onNotice(`⚠ ${d.warnings.join(' ')}`, 'error');
      else onNotice(tr(lang, 'Qoondeynta waa la kaydiyay', 'Assignment saved'));
      setEdit(null);
      load();
      onChanged?.();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  const chip = (b: any, conflict: boolean) => (
    <button
      key={b.id}
      type="button"
      onClick={() => canAssign && openEdit(b)}
      className={`w-full text-left rounded-lg px-2 py-1.5 text-[11px] leading-tight border ${
        conflict ? 'bg-rose-50 border-rose-300 text-rose-800' : b.status === 'Completed' ? 'bg-emerald-50 border-emerald-200' : 'bg-[#EEF4FB] border-[#C9DBF0]'
      } ${canAssign ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}
    >
      <div className="font-mono-tabular font-bold text-[#00529E]">{b.referenceNumber} · {b.preferredTime}</div>
      <div className="truncate">{b.customerName}</div>
      <div className="truncate text-slate-500">{b.fromDistrict} → {b.toDistrict}</div>
    </button>
  );

  const label = (d: string) => {
    const w = new Date(d + 'T00:00:00Z').getUTCDay();
    return `${(lang === 'so' ? DAY_SO : DAY_EN)[w]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;
  };

  return (
    <div className="space-y-4">
      <div className="erp-card p-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5">
          <button type="button" className="erp-btn erp-btn-ghost !px-2.5" onClick={() => setAnchor(addDays(anchor, mode === 'day' ? -1 : -7))} aria-label="Prev"><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} className="!min-h-0 !py-1.5 text-sm" />
          <button type="button" className="erp-btn erp-btn-ghost !px-2.5" onClick={() => setAnchor(addDays(anchor, mode === 'day' ? 1 : 7))} aria-label="Next"><ChevronRight className="w-4 h-4" /></button>
          <button type="button" className="erp-btn erp-btn-ghost !text-xs" onClick={() => setAnchor(todayMogadishu())}>{tr(lang, 'Maanta', 'Today')}</button>
        </div>
        <div className="flex items-center gap-1.5">
          {(['day', 'week'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`erp-btn !text-xs ${mode === m ? 'erp-btn-primary' : 'erp-btn-ghost'}`}>{m === 'day' ? tr(lang, 'Maalin', 'Day') : tr(lang, 'Toddobaad', 'Week')}</button>
          ))}
          <span className="w-px h-6 bg-slate-200 mx-1" />
          <button type="button" onClick={() => setBy('vehicle')} className={`erp-btn !text-xs ${by === 'vehicle' ? 'erp-btn-accent' : 'erp-btn-ghost'}`}><Truck className="w-3.5 h-3.5" />{tr(lang, 'Gaadiid', 'Vehicles')}</button>
          <button type="button" onClick={() => setBy('staff')} className={`erp-btn !text-xs ${by === 'staff' ? 'erp-btn-accent' : 'erp-btn-ghost'}`}><Users className="w-3.5 h-3.5" />{tr(lang, 'Shaqaale', 'Staff')}</button>
          <button type="button" onClick={load} className="erp-btn erp-btn-ghost !px-2.5" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="erp-card p-4 border-l-4 !border-l-rose-500 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-rose-700 text-sm"><AlertTriangle className="w-4 h-4" />{tr(lang, 'Isku dhac: hal gaari/shaqaale laba ballan isla maalin', 'Double-booking: same vehicle/staff on two jobs the same day')}</div>
          {conflicts.map((c, i) => (
            <div key={i} className="text-xs text-slate-700">
              {c.date} · {c.type === 'vehicle' ? tr(lang, 'Gaariga', 'Vehicle') : tr(lang, 'Shaqaalaha', 'Staff')} <b>{c.name}</b> → {c.refs.join(', ')}
            </div>
          ))}
        </div>
      )}

      <div className="erp-card overflow-x-auto">
        <table className="w-full" style={{ minWidth: mode === 'week' ? 980 : 420 }}>
          <thead>
            <tr>
              <th className="py-2.5 px-3 text-left w-44">{by === 'vehicle' ? tr(lang, 'Gaariga', 'Vehicle') : tr(lang, 'Shaqaalaha', 'Staff')}</th>
              {days.map((d) => (
                <th key={d} className={`py-2.5 px-2 text-left ${d === todayMogadishu() ? '!text-[#00529E]' : ''}`}>{label(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows, { id: null as any, label: tr(lang, 'Aan la qoondeyn', 'Unassigned'), sub: '' }].map((r) => (
              <tr key={String(r.id)}>
                <td className="py-2 px-3 align-top">
                  <div className="font-semibold text-[13px]">{r.label}</div>
                  <div className="text-[11px] text-slate-500">{r.sub}</div>
                </td>
                {days.map((d) => {
                  const list = bookings.filter((b) => b.preferredDate === d && inRow(b, r.id));
                  const conflict = r.id !== null && isConflict(d, r.id);
                  return (
                    <td key={d} className={`py-2 px-1.5 align-top ${conflict ? '!bg-rose-50/60' : ''}`}>
                      <div className="space-y-1">
                        {conflict && <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{tr(lang, 'Laba jeer', 'Double-booked')}</div>}
                        {list.map((b) => chip(b, conflict))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canAssign && <div className="text-xs text-slate-500">{tr(lang, 'Qoondeynta waxaa samayn kara Admin, Manager iyo Dispatcher.', 'Only Admin, Manager and Dispatcher can assign.')}</div>}

      {edit && (
        <div className="fixed inset-0 z-[75] bg-[#0B1F3A]/60 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono-tabular text-xs font-bold text-[#00529E]">{edit.referenceNumber} · {edit.preferredDate} {edit.preferredTime}</div>
                <div className="font-semibold">{edit.customerName}</div>
              </div>
              <button type="button" onClick={() => setEdit(null)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <label className="erp-label">{tr(lang, 'Gaariga', 'Vehicle')}</label>
            <select value={editVehicle} onChange={(e) => setEditVehicle(Number(e.target.value) || '')} className="erp-input">
              <option value="">{tr(lang, '— Aan la qoondeyn —', '— Unassigned —')}</option>
              {vehicles.map((v) => {
                const busy = bookings.some((b) => b.id !== edit.id && b.preferredDate === edit.preferredDate && b.assignedVehicleId === v.id);
                return <option key={v.id} value={v.id}>{v.plateNumber} — {v.name}{busy ? ` ⚠ ${tr(lang, 'mashquul', 'busy')}` : ''}</option>;
              })}
            </select>
            <div className="erp-label !mt-3">{tr(lang, 'Shaqaalaha', 'Crew')}</div>
            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {staff.map((s) => {
                const busy = bookings.some((b) => b.id !== edit.id && b.preferredDate === edit.preferredDate && (b.assignedStaffIds || []).map(Number).includes(s.id));
                return (
                  <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={editStaff.includes(s.id)} onChange={(e) => setEditStaff(e.target.checked ? [...editStaff, s.id] : editStaff.filter((x) => x !== s.id))} />
                    <span className="flex-1">{s.name} <span className="text-xs text-slate-500">({s.role})</span></span>
                    {busy && <span className="text-[11px] font-semibold text-rose-600">⚠ {tr(lang, 'mashquul', 'busy')}</span>}
                  </label>
                );
              })}
            </div>
            <button type="button" onClick={saveEdit} className="erp-btn erp-btn-primary w-full justify-center">{tr(lang, 'Kaydi qoondeynta', 'Save assignment')}</button>
          </div>
        </div>
      )}
    </div>
  );
};
