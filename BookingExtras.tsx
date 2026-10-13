import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { PhotoStrip } from './PhotoStrip.tsx';
import { Api, Lang, tr } from './types.ts';

/** Crew assignment + before/after photos inside the booking detail panel. */
export const BookingExtras: React.FC<{
  lang: Lang;
  api: Api;
  booking: any;
  staff: any[];
  allBookings: any[];
  canAssign: boolean;
  canDeletePhotos: boolean;
  onNotice: (m: string, k?: 'ok' | 'error') => void;
  onChanged: () => void;
}> = ({ lang, api, booking, staff, allBookings, canAssign, canDeletePhotos, onNotice, onChanged }) => {
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => setSel((booking.assignedStaffIds || []).map(Number)), [booking.id, booking.assignedStaffIds]);
  const dirty = JSON.stringify([...sel].sort()) !== JSON.stringify([...(booking.assignedStaffIds || []).map(Number)].sort());

  const save = async () => {
    try {
      const d = await api(`/api/admin/bookings/${booking.id}/assign`, { method: 'POST', body: JSON.stringify({ staffIds: sel }) });
      if (d.warnings?.length) onNotice(`⚠ ${d.warnings.join(' ')}`, 'error');
      else onNotice(tr(lang, 'Shaqaalaha waa la qoondeeyay', 'Crew assigned'));
      onChanged();
    } catch (e: any) {
      onNotice(e.message, 'error');
    }
  };

  return (
    <div className="space-y-3">
      {canAssign && (
        <div className="pt-3 border-t border-slate-100">
          <div className="text-xs font-semibold text-[#0B1F3A] mb-1.5 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[#00529E]" />{tr(lang, 'Shaqaalaha loo qoondeeyay', 'Assigned crew')}</div>
          <div className="flex flex-wrap gap-1.5">
            {staff.map((s) => {
              const on = sel.includes(s.id);
              const busy = allBookings.some(
                (b) => b.id !== booking.id && b.preferredDate === booking.preferredDate && !['Cancelled', 'Lost'].includes(b.status) && (b.assignedStaffIds || []).map(Number).includes(s.id)
              );
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSel(on ? sel.filter((x) => x !== s.id) : [...sel, s.id])}
                  className={`px-2.5 py-1 rounded-full text-[11.5px] border ${on ? 'bg-[#00529E] text-white border-[#00529E]' : 'bg-white border-slate-300 text-slate-700'} ${busy ? '!border-rose-400' : ''}`}
                  title={busy ? tr(lang, 'Isla maalintaas shaqo kale ayuu leeyahay', 'Already on another job that day') : ''}
                >
                  {s.name}{busy ? ' ⚠' : ''}
                </button>
              );
            })}
          </div>
          {dirty && <button type="button" onClick={save} className="erp-btn erp-btn-primary !py-1.5 !text-xs mt-2">{tr(lang, 'Kaydi shaqaalaha', 'Save crew')}</button>}
        </div>
      )}
      <div className="pt-3 border-t border-slate-100">
        <PhotoStrip
          lang={lang}
          api={api}
          entityType="booking"
          entityId={booking.id}
          canDelete={canDeletePhotos}
          kinds={[
            { id: 'before', label: tr(lang, 'Sawirada ka hor', 'Before photos') },
            { id: 'after', label: tr(lang, 'Sawirada ka dib', 'After photos') },
          ]}
        />
      </div>
    </div>
  );
};
