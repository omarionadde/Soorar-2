import React, { useState } from 'react';
import { Printer, FileText } from 'lucide-react';
import type { PrintableDocData } from './PrintableDocumentModal.tsx';

interface Props {
  lang: 'so' | 'en';
  staff: any[];
  services: any[];
  onOpen: (doc: PrintableDocData) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const blank = (docType: PrintableDocData['docType'], extra: Partial<PrintableDocData> = {}): PrintableDocData => ({
  docType,
  docNumber: '',
  date: today(),
  customerName: '',
  customerPhone: '',
  subtotal: '',
  total: '',
  ...extra,
});

/** Official SOORAR templates: blank forms for hand-filling, plus price list, letterhead and staff documents. */
export const DocumentsHub: React.FC<Props> = ({ lang, staff, services, onOpen }) => {
  const so = lang === 'so';
  const [staffId, setStaffId] = useState<string>(staff[0]?.id ? String(staff[0].id) : '');
  const [letter, setLetter] = useState({ ref: '', to: '', subject: '', body: '' });
  const member = staff.find((m) => String(m.id) === staffId);
  const staffDoc = (type: 'STAFF_ID_CARD' | 'STAFF_CONTRACT') =>
    member &&
    onOpen(
      blank(type, {
        docNumber: type === 'STAFF_ID_CARD' ? member.idCardNumber : `HS-${member.idCardNumber}`,
        customerName: member.name,
        customerPhone: member.phone,
        staffMember: { name: member.name, role: member.role, phone: member.phone, idCardNumber: member.idCardNumber, dailyRateUsd: String(member.dailyRate || ''), photoUrl: member.photoUrl || '' },
      })
    );

  const forms: Array<{ code: string; type: PrintableDocData['docType']; so: string; en: string }> = [
    { code: '01', type: 'INVOICE', so: 'Invoice (biil)', en: 'Invoice' },
    { code: '02', type: 'QUOTE', so: 'Qiimeyn', en: 'Quotation' },
    { code: '03', type: 'RECEIPT', so: 'Rasiid (2 nuqul)', en: 'Receipt (2 copies)' },
    { code: '04', type: 'BOOKING_FORM', so: 'Foomka Ballanta', en: 'Booking form' },
    { code: '05', type: 'INVENTORY_CHECKLIST', so: 'Liiska Alaabta', en: 'Inventory checklist' },
    { code: '06', type: 'SERVICE_AGREEMENT', so: 'Heshiiska Adeegga', en: 'Service agreement' },
    { code: '07', type: 'JOB_COMPLETION', so: 'Xaqiijinta Shaqada', en: 'Job completion' },
    { code: '13', type: 'DAMAGE_REPORT', so: 'Warbixinta Dhaawaca', en: 'Damage claim' },
    { code: '14', type: 'PURCHASE_ORDER', so: 'Dalab Iibsi', en: 'Purchase order' },
    { code: '15', type: 'STORAGE_CONTRACT', so: 'Heshiiska Kaydinta', en: 'Storage agreement' },
  ];

  return (
    <div className="space-y-5">
      <div className="erp-card p-5">
        <h3 className="erp-h3">{so ? 'Foomamka rasmiga ah ee SOORAR' : 'Official SOORAR forms'}</h3>
        <p className="text-xs text-slate-500 mt-1">
          {so
            ? 'Foom madhan oo diyaar u ah in gacanta lagu buuxiyo. Dukumentiyada leh xogta macmiilka waxaa laga daabacaa ballanta, qiimeynta, biilka ama lacag-bixinta.'
            : 'Blank forms ready to fill by hand. Documents with customer data print from the booking, quote, invoice or payment itself.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mt-4">
          {forms.map((f) => (
            <button key={f.code} type="button" onClick={() => onOpen(blank(f.type))} className="p-3 rounded-xl border border-slate-200 hover:border-[#00529E] hover:bg-blue-50/40 text-left flex items-center gap-3 cursor-pointer">
              <span className="w-9 h-9 rounded-lg bg-[#00529E]/10 text-[#00529E] text-xs font-bold flex items-center justify-center shrink-0">{f.code}</span>
              <span className="text-sm font-medium text-[#0B1F3A] leading-tight">{so ? f.so : f.en}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="erp-card p-5 space-y-3">
          <h3 className="erp-h3">10 · {so ? 'Liiska Qiimaha' : 'Price list'}</h3>
          <p className="text-xs text-slate-500">{so ? 'Waxaa laga qaadanayaa adeegyada iyo qiimayaasha CMS-ka.' : 'Built from the services and prices in the Website CMS.'}</p>
          <button
            type="button"
            onClick={() =>
              onOpen(
                blank('PRICE_LIST', {
                  docNumber: `V${new Date().getFullYear()}.${new Date().getMonth() + 1}`,
                  lineItems: services.map((s: any) => ({
                    category: so ? s.titleSo : s.titleEn,
                    description: (so ? s.priceLabelSo : s.priceLabelEn) || (so ? s.descSo : s.descEn) || '',
                    qty: 1,
                    unitPrice: Number(s.basePrice || 0),
                    total: Number(s.basePrice || 0),
                  })),
                })
              )
            }
            className="erp-btn erp-btn-primary w-full justify-center"
          >
            <Printer className="w-4 h-4" /> {so ? 'Daabac liiska qiimaha' : 'Print price list'}
          </button>
          <button type="button" onClick={() => onOpen(blank('PRICE_LIST', { lineItems: [] }))} className="erp-btn erp-btn-ghost w-full justify-center">
            {so ? 'Foom madhan' : 'Blank template'}
          </button>
        </div>

        <div className="erp-card p-5 space-y-3">
          <h3 className="erp-h3">11 · 12 · {so ? 'Shaqaalaha' : 'Staff documents'}</h3>
          {staff.length === 0 ? (
            <div className="erp-empty">{so ? 'Marka hore ku dar shaqaale.' : 'Add a staff member first.'}</div>
          ) : (
            <>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full px-3">
                {staff.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name} · {m.idCardNumber}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => staffDoc('STAFF_ID_CARD')} className="erp-btn erp-btn-primary justify-center"><Printer className="w-4 h-4" /> ID card</button>
                <button type="button" onClick={() => staffDoc('STAFF_CONTRACT')} className="erp-btn erp-btn-ghost justify-center">{so ? 'Heshiis' : 'Contract'}</button>
              </div>
            </>
          )}
        </div>

        <div className="erp-card p-5 space-y-2.5">
          <h3 className="erp-h3">08 · {so ? 'Warqadda Rasmiga' : 'Letterhead'}</h3>
          <input value={letter.ref} onChange={(e) => setLetter({ ...letter, ref: e.target.value })} placeholder={so ? 'Tixraac (Ref.)' : 'Ref.'} className="w-full px-3" />
          <input value={letter.to} onChange={(e) => setLetter({ ...letter, to: e.target.value })} placeholder={so ? 'Ku socota' : 'To'} className="w-full px-3" />
          <input value={letter.subject} onChange={(e) => setLetter({ ...letter, subject: e.target.value })} placeholder={so ? 'Ujeeddo' : 'Subject'} className="w-full px-3" />
          <textarea value={letter.body} onChange={(e) => setLetter({ ...letter, body: e.target.value })} rows={4} placeholder={so ? 'Qoraalka warqadda…' : 'Letter text…'} className="w-full px-3" />
          <button
            type="button"
            onClick={() => onOpen(blank('LETTERHEAD', { docNumber: letter.ref, recipient: letter.to, subject: letter.subject, notes: letter.body }))}
            className="erp-btn erp-btn-primary w-full justify-center"
          >
            <FileText className="w-4 h-4" /> {so ? 'Fur warqadda' : 'Open letter'}
          </button>
        </div>
      </div>
    </div>
  );
};
