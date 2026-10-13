import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Printer, X, MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl, trackWhatsAppClick } from '../constants/mogadishu.ts';
import '../print-docs.css';

/* ------------------------------------------------------------------
   SOORAR official printable documents (A4), built to match the brand
   templates 01–12 (Invoice, Quotation, Receipt, Booking form, Inventory,
   Service agreement, Job completion, Letterhead, Price list, Staff
   contract, Staff ID card) plus Reports, PO, Damage claim, Storage.
   ------------------------------------------------------------------ */

export interface PrintableReportData {
  period?: string;
  kpis?: Array<{ label: string; value: string }>;
  tables?: Array<{ title: string; columns: string[]; rows: Array<Array<string | number>>; numericCols?: number[] }>;
  notes?: string;
}

export interface PrintableDocData {
  docType:
    | 'QUOTE'
    | 'INVOICE'
    | 'RECEIPT'
    | 'BOOKING_FORM'
    | 'INVENTORY_CHECKLIST'
    | 'SERVICE_AGREEMENT'
    | 'JOB_COMPLETION'
    | 'LETTERHEAD'
    | 'FEEDBACK_FORM'
    | 'PRICE_LIST'
    | 'STAFF_CONTRACT'
    | 'STAFF_ID_CARD'
    | 'PURCHASE_ORDER'
    | 'DAMAGE_REPORT'
    | 'STORAGE_CONTRACT'
    | 'REPORT';
  docNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  bookingRef?: string;
  fromDistrict?: string;
  fromAddress?: string;
  fromFloor?: number;
  fromLift?: boolean;
  toDistrict?: string;
  toAddress?: string;
  toFloor?: number;
  toLift?: boolean;
  moveDate?: string;
  moveTime?: string;
  servicesList?: string[];
  vehiclePlate?: string;
  vehicleName?: string;
  crewNames?: string[];
  pickupSignature?: string;
  deliverySignature?: string;
  lineItems?: Array<{ description: string; category?: string; qty: number; unitPrice: number; total: number }>;
  inventoryItems?: Array<{
    itemName: string;
    boxNumber?: string;
    quantity: number;
    conditionBefore: string;
    conditionAfter: string;
    roomLabel?: string;
  }>;
  staffMember?: {
    name: string;
    role: string;
    phone: string;
    idCardNumber: string;
    dailyRateUsd: string;
    photoUrl?: string;
  };
  subtotal: string;
  discount?: string;
  total: string;
  amountPaid?: string;
  balanceDue?: string;
  paymentMethod?: string;
  referenceCode?: string;
  notes?: string;
  /** Letterhead extras */
  recipient?: string;
  subject?: string;
  /** Report payload (docType REPORT) */
  report?: PrintableReportData;
  /** Optional title override (e.g. a report name) */
  titleOverride?: string;
}

interface PrintableDocumentModalProps {
  doc: PrintableDocData | null;
  onClose: () => void;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
}

type L = 'so' | 'en';
const LOGO = '/brand/soorar-logo.png';
const LOGO_WHITE = '/brand/soorar-logo-white.png';

/* ---------------------------- helpers ---------------------------- */
const money = (v: any) => {
  const n = Number(v);
  if (v === undefined || v === null || v === '' || Number.isNaN(n)) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const t = (lang: L, so: string, en: string) => (lang === 'so' ? so : en);
const floorTxt = (lang: L, f?: number, lift?: boolean) =>
  f === undefined || f === null ? '' : `${t(lang, 'Dabaq', 'Floor')} ${f}${lift ? t(lang, ' (wiish)', ' (lift)') : ''}`;
const joinParts = (...p: Array<string | undefined | false>) => p.filter(Boolean).join(', ');

function addYear(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function enWords(n: number): string {
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + EN_ONES[n % 10] : '');
  if (n < 1000) return EN_ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + enWords(n % 100) : '');
  if (n < 1_000_000) return enWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + enWords(n % 1000) : '');
  return enWords(Math.floor(n / 1_000_000)) + ' million' + (n % 1_000_000 ? ' ' + enWords(n % 1_000_000) : '');
}
const SO_ONES = ['eber', 'kow', 'laba', 'saddex', 'afar', 'shan', 'lix', 'toddoba', 'siddeed', 'sagaal'];
const SO_TENS = ['', 'toban', 'labaatan', 'soddon', 'afartan', 'konton', 'lixdan', 'toddobaatan', 'siddeetan', 'sagaashan'];
function soWords(n: number): string {
  if (n < 10) return SO_ONES[n];
  if (n < 100) return SO_TENS[Math.floor(n / 10)] + (n % 10 ? ' iyo ' + SO_ONES[n % 10] : '');
  if (n < 1000) {
    const h = Math.floor(n / 100);
    return (h === 1 ? 'boqol' : SO_ONES[h] + ' boqol') + (n % 100 ? ' iyo ' + soWords(n % 100) : '');
  }
  if (n < 1_000_000) {
    const k = Math.floor(n / 1000);
    return (k === 1 ? 'kun' : soWords(k) + ' kun') + (n % 1000 ? ' iyo ' + soWords(n % 1000) : '');
  }
  return soWords(Math.floor(n / 1_000_000)) + ' milyan' + (n % 1_000_000 ? ' iyo ' + soWords(n % 1_000_000) : '');
}
function amountInWords(v: any, lang: L) {
  const n = Number(v);
  if (!n || Number.isNaN(n)) return '';
  const dollars = Math.floor(n);
  const cents = Math.round((n - dollars) * 100);
  if (lang === 'so') return `${soWords(dollars)} doollar${cents ? ` iyo ${soWords(cents)} senti` : ''}`;
  const w = enWords(dollars);
  return `${w.charAt(0).toUpperCase() + w.slice(1)} dollars${cents ? ` and ${enWords(cents)} cents` : ''}`;
}

const methodIs = (pm: string | undefined, key: 'cash' | 'evc' | 'edahab' | 'bank') => {
  const s = String(pm || '').toLowerCase();
  if (key === 'cash') return s.includes('cash') || s.includes('caddaan');
  if (key === 'evc') return s.includes('evc') || s.includes('zaad') || s.includes('hormuud');
  if (key === 'edahab') return s.includes('dahab');
  return s.includes('bank') || s.includes('bang') || s.includes('transfer');
};

/* ---------------------------- primitives ---------------------------- */
const Check: React.FC<{ on?: boolean; children: React.ReactNode }> = ({ on, children }) => (
  <span className="sr-check">
    <span className={`b ${on ? 'on' : ''}`} />
    {children}
  </span>
);

const F: React.FC<{ k: string; v?: React.ReactNode; className?: string }> = ({ k, v, className = '' }) => (
  <div className={`sr-f ${className}`}>
    <div className="v">{v ?? ''}</div>
    <div className="k">{k}</div>
  </div>
);

const Meta: React.FC<{ rows: Array<[string, React.ReactNode]> }> = ({ rows }) => (
  <div className="sr-meta">
    {rows.map(([k, v], i) => (
      <div className="r" key={i}>
        <div className="k">{k}</div>
        <div className="v">{v}</div>
      </div>
    ))}
  </div>
);

const Signatures: React.FC<{ lang: L; left?: string; right?: string; leftName?: string; rightName?: string }> = ({
  lang,
  left,
  right,
  leftName,
  rightName,
}) => (
  <>
  <div className="sr-sigspace" />
  <div className="sr-sigs">
    <div className="sr-sig">
      <div className="k">{left || t(lang, 'Saxiixa macmiilka', 'Client signature')}</div>
      <div className="line" />
      <div className="k2">{t(lang, 'Magaca & taariikhda', 'Name & date')}</div>
      <div className="line">{leftName}</div>
    </div>
    <div className="sr-sig">
      <div className="k">{right || t(lang, 'Saxiixa SOORAR', 'SOORAR signature')}</div>
      <div className="line" />
      <div className="k2">{t(lang, 'Magaca & taariikhda', 'Name & date')}</div>
      <div className="line">{rightName}</div>
    </div>
  </div>
  </>
);

const PaymentChecks: React.FC<{ lang: L; pm?: string; row?: boolean }> = ({ lang, pm, row }) => (
  <div className={`sr-checks ${row ? 'row' : ''}`}>
    <Check on={methodIs(pm, 'cash')}>{row ? 'Cash' : t(lang, 'Lacag caddaan (Cash)', 'Cash')}</Check>
    <Check on={methodIs(pm, 'edahab')}>eDahab</Check>
    <Check on={methodIs(pm, 'evc')}>EVC Plus</Check>
    <Check on={methodIs(pm, 'bank')}>{t(lang, 'Bangi', 'Bank')}</Check>
  </div>
);

const Page: React.FC<{
  lang: L;
  phone: string;
  title?: string;
  sub?: React.ReactNode;
  meta?: Array<[string, React.ReactNode]>;
  children: React.ReactNode;
  watermark?: boolean;
  bare?: boolean;
}> = ({ lang, phone, title, sub, meta, children, watermark, bare }) => (
  <div className="sr-page">
    <div className="sr-topbar">
      <i className="o" />
      <i className="b" />
    </div>
    {bare ? (
      children
    ) : (
      <div className="sr-body">
        <div className="sr-head">
          <img className="logo" src={LOGO} alt="SOORAR" />
          <div className="sr-company">
            <div className="n">SOORAR</div>
            <div className="l">{t(lang, 'Rarid Guryo & Xafiisyo', 'Home & Office Moving')}</div>
            <div className="l">WhatsApp {phone}</div>
            <div className="l">{t(lang, 'Muqdisho, Soomaaliya', 'Mogadishu, Somalia')}</div>
          </div>
        </div>
        {title && (
          <div className="sr-titlerow">
            <div className="sr-title">
              <h1>{title}</h1>
              {sub && <div className="sub">{sub}</div>}
              <div className="ul" />
            </div>
            {meta && <Meta rows={meta} />}
          </div>
        )}
        {watermark && <img className="sr-watermark" src={LOGO} alt="" />}
        {children}
      </div>
    )}
    <div className="sr-footer">
      <span className="s">{t(lang, 'Rarid xirfad leh, Muqdisho oo dhan.', 'Professional moving across all of Mogadishu.')}</span>
      <span className="c">
        WhatsApp {phone} &nbsp;•&nbsp; {t(lang, 'Muqdisho, Soomaaliya', 'Mogadishu, Somalia')}
      </span>
    </div>
  </div>
);

/* Pads a list to a minimum number of rows so the printed form keeps its blank lines. */
function padRows<T>(rows: T[], min: number): Array<T | null> {
  const out: Array<T | null> = [...rows];
  while (out.length < min) out.push(null);
  return out;
}

/* ---------------------------- templates ---------------------------- */
interface TplProps {
  doc: PrintableDocData;
  lang: L;
  phone: string;
  qr?: string;
}

const LineItemsTable: React.FC<TplProps & { minRows: number }> = ({ doc, lang, minRows }) => (
  <table className="sr-table">
    <thead>
      <tr>
        <th style={{ width: '9mm' }}>#</th>
        <th>{t(lang, 'Sharaxaadda adeegga / alaabta', 'Description of service / items')}</th>
        <th className="num" style={{ width: '16mm' }}>{t(lang, 'Tirada', 'Qty')}</th>
        <th className="num" style={{ width: '26mm' }}>{t(lang, 'Qiimaha', 'Unit price')}</th>
        <th className="num" style={{ width: '28mm' }}>{t(lang, 'Wadarta', 'Amount')}</th>
      </tr>
    </thead>
    <tbody>
      {padRows(doc.lineItems || [], minRows).map((it, i) => (
        <tr key={i}>
          <td className="idx">{i + 1}</td>
          <td>{it?.description}</td>
          <td className="num">{it ? it.qty : ''}</td>
          <td className="num">{it ? money(it.unitPrice) : ''}</td>
          <td className="num">{it ? money(it.total) : ''}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const InvoiceTpl: React.FC<TplProps> = ({ doc, lang, phone }) => (
  <Page
    lang={lang}
    phone={phone}
    title="INVOICE"
    sub={t(lang, 'Biil lacag bixin', 'Payment request')}
    meta={[
      ['Invoice No.', doc.docNumber],
      [t(lang, 'Taariikhda', 'Date'), doc.date],
      [t(lang, 'Mudada bixinta', 'Due date'), doc.moveDate || ''],
    ]}
  >
    <div className="sr-sec">{t(lang, 'Biilka loo diray', 'Bill to')}</div>
    <div className="sr-grid c2">
      <F k={t(lang, 'Magaca macmiilka', 'Client name')} v={doc.customerName} />
      <F k={t(lang, 'Laga raray (Ka)', 'Moved from')} v={joinParts(doc.fromDistrict, doc.fromAddress)} />
      <F k={t(lang, 'Taleefanka', 'Phone')} v={doc.customerPhone} />
      <F k={t(lang, 'Loo raray (Ku)', 'Moved to')} v={joinParts(doc.toDistrict, doc.toAddress)} />
      <F k={t(lang, 'Taariikhda rarka', 'Moving date')} v={doc.moveDate} />
      <F k={t(lang, 'Nooca adeegga', 'Service type')} v={(doc.servicesList || []).join(', ') || doc.bookingRef} />
    </div>
    <LineItemsTable doc={doc} lang={lang} phone={phone} minRows={9} />
    <div className="sr-bottom">
      <div>
        <div className="sr-sec" style={{ marginTop: '2mm' }}>{t(lang, 'Habka lacag bixinta', 'Payment method')}</div>
        <PaymentChecks lang={lang} pm={doc.paymentMethod} />
        <div className="sr-f" style={{ marginTop: '2mm' }}>
          <div className="v">{doc.referenceCode || ''}</div>
          <div className="k">{t(lang, 'Lambarka lacagta loo diro', 'Payment account number')}</div>
        </div>
        <div className="sr-small" style={{ marginTop: '3mm', fontWeight: 600 }}>{t(lang, 'Fiiro gaar ah', 'Notes')}</div>
        <div className="sr-box" style={{ marginTop: '1mm' }}>{doc.notes || ''}</div>
      </div>
      <div className="sr-totals">
        <div className="r"><span className="k">{t(lang, 'Wadarta hoose', 'Subtotal')}</span><span className="v">{money(doc.subtotal)}</span></div>
        <div className="r"><span className="k">{t(lang, 'Qiimo dhimis', 'Discount')}</span><span className="v">{Number(doc.discount) ? '-' + money(doc.discount) : ''}</span></div>
        <div className="r"><span className="k">{t(lang, 'Canshuur / kale', 'Tax / other')}</span><span className="v" /></div>
        <div className="pill"><span>{t(lang, 'WADARTA', 'TOTAL')}</span><span>{money(doc.total)}</span></div>
        <div className="r"><span className="k">{t(lang, 'La bixiyay', 'Amount paid')}</span><span className="v">{money(doc.amountPaid)}</span></div>
        <div className="r"><span className="k">{t(lang, 'Haraaga', 'Balance due')}</span><span className="v">{money(doc.balanceDue)}</span></div>
      </div>
    </div>
    <Signatures lang={lang} leftName={doc.customerName} />
  </Page>
);

const SERVICE_KEYS = [
  { k: 'home', so: 'Rarid guri', en: 'Home move', m: ['home', 'guri', 'villa', 'apartment'] },
  { k: 'office', so: 'Rarid xafiis', en: 'Office move', m: ['office', 'xafiis'] },
  { k: 'assembly', so: 'Furfurid & xerxeris', en: 'Dismantle & assembly', m: ['assembl', 'furfur', 'xerxer', 'dismantl'] },
  { k: 'heavy', so: 'Alaab culus', en: 'Heavy items', m: ['heavy', 'culus', 'safe', 'piano'] },
  { k: 'packing', so: 'Baakadeyn', en: 'Packing', m: ['pack', 'baakad'] },
];
const hasService = (list: string[] | undefined, m: string[]) =>
  (list || []).some((s) => m.some((x) => String(s).toLowerCase().includes(x)));

const QuoteTpl: React.FC<TplProps> = ({ doc, lang, phone }) => {
  const deposit = Number(doc.total) ? Math.round(Number(doc.total) * 0.3) : 0;
  return (
    <Page
      lang={lang}
      phone={phone}
      title={t(lang, 'QIIMEYN', 'QUOTATION')}
      sub={lang === 'so' ? <>Quotation &nbsp;•&nbsp; Qiimaha la filayo ee adeegga</> : 'Estimated cost of service'}
      meta={[
        ['Quotation No.', doc.docNumber],
        [t(lang, 'Taariikhda', 'Date'), doc.date],
        [t(lang, 'Ansax ilaa', 'Valid until'), (() => { const d = new Date(doc.date); if (Number.isNaN(d.getTime())) return ''; d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })()],
      ]}
    >
      <div className="sr-sec">{t(lang, 'Macmiilka', 'Client')}</div>
      <div className="sr-grid c2">
        <F k={t(lang, 'Magaca', 'Name')} v={doc.customerName} />
        <F k={t(lang, 'Taleefanka', 'Phone')} v={doc.customerPhone} />
        <F k={t(lang, 'Ka (degmada, dabaqa)', 'From (district, floor)')} v={joinParts(doc.fromDistrict, floorTxt(lang, doc.fromFloor, doc.fromLift))} />
        <F k={t(lang, 'Ku (degmada, dabaqa)', 'To (district, floor)')} v={joinParts(doc.toDistrict, floorTxt(lang, doc.toFloor, doc.toLift))} />
      </div>
      <div className="sr-sec">{t(lang, 'Adeegga', 'Service')}</div>
      <div className="sr-checks row">
        {SERVICE_KEYS.map((s) => (
          <Check key={s.k} on={hasService(doc.servicesList, s.m) || hasService((doc.lineItems || []).map((l) => l.description), s.m)}>
            {t(lang, s.so, s.en)}
          </Check>
        ))}
      </div>
      <div className="sr-grid c3" style={{ marginTop: '2mm' }}>
        <F k={t(lang, 'Cabbirka (tusaale: 3 qol)', 'Size (e.g. 3 rooms)')} v={doc.notes && doc.notes.length < 40 ? doc.notes : ''} />
        <F k={t(lang, 'Taariikhda la rabo', 'Preferred date')} v={doc.moveDate} />
        <F k={t(lang, 'Gaari / shaqaale', 'Trucks / crew')} v={doc.vehiclePlate || ''} />
      </div>
      <LineItemsTable doc={doc} lang={lang} phone={phone} minRows={7} />
      <div className="sr-bottom">
        <div>
          <div className="sr-sec" style={{ marginTop: '2mm' }}>{t(lang, 'Shuruudaha', 'Terms')}</div>
          <div style={{ fontSize: '8pt', lineHeight: 1.55, color: '#1F2D45' }}>
            • {t(lang, 'Qiimeyntani waxay ansax tahay 7 maalmood.', 'This quotation is valid for 7 days.')}<br />
            • {t(lang, 'Ballanta waxaa lagu xaqiijiyaa deposit.', 'A deposit is required to confirm the booking.')}<br />
            • {t(lang, 'Alaab dheeraad ah ama dabaq kale qiimaha wuu beddeli karaa.', 'Extra items or floors may change the price.')}<br />
            • {t(lang, 'Haraaga waxaa la bixiyaa marka shaqada la dhammeeyo.', 'The balance is paid when the job is completed.')}
          </div>
        </div>
        <div className="sr-totals">
          <div className="r"><span className="k">{t(lang, 'Wadarta hoose', 'Subtotal')}</span><span className="v">{money(doc.subtotal)}</span></div>
          <div className="r"><span className="k">{t(lang, 'Qiimo dhimis', 'Discount')}</span><span className="v">{Number(doc.discount) ? '-' + money(doc.discount) : ''}</span></div>
          <div className="pill"><span>{t(lang, 'QIIMAHA GUUD', 'TOTAL ESTIMATE')}</span><span>{money(doc.total)}</span></div>
          <div className="r"><span className="k">{t(lang, 'Deposit loo baahan yahay', 'Deposit required')}</span><span className="v">{deposit ? money(deposit) : ''}</span></div>
        </div>
      </div>
      <Signatures lang={lang} left={t(lang, 'Ogolaanshaha macmiilka', 'Client approval')} leftName={doc.customerName} />
    </Page>
  );
};

const ReceiptCopy: React.FC<TplProps> = ({ doc, lang, phone }) => (
  <div className="sr-receipt">
    <div className="rh">
      <img className="logo" src={LOGO} alt="SOORAR" />
      <div className="t">
        <h1>{t(lang, 'RASIID', 'RECEIPT')}</h1>
        <div className="sub">{lang === 'so' ? 'Receipt • Caddeyn lacag qabasho' : 'Proof of payment received'}</div>
      </div>
      <div className="c">
        WhatsApp {phone}
        <br />
        {t(lang, 'Muqdisho, Soomaaliya', 'Mogadishu, Somalia')}
      </div>
    </div>
    <div className="sr-grid c2" style={{ marginTop: '4mm' }}>
      <F k={t(lang, 'Taariikhda', 'Date')} v={doc.date} />
      <F k={t(lang, 'Rasiid No.', 'Receipt No.')} v={doc.docNumber} />
      <F className="span2" k={t(lang, 'Waxaa laga helay (magaca macmiilka)', 'Received from (client name)')} v={joinParts(doc.customerName, doc.customerPhone)} />
      <F k={t(lang, 'Lacagta ($)', 'Amount ($)')} v={<b>{money(doc.total)}</b>} />
      <F k={t(lang, 'Lacagta oo qoraal ah', 'Amount in words')} v={amountInWords(doc.total, lang)} />
      <F className="span2" k={t(lang, 'Ujeeddada (tusaale: deposit rarid guri, Invoice No.)', 'For (e.g. home move deposit, Invoice No.)')} v={joinParts(doc.notes, doc.bookingRef, doc.referenceCode && `Ref ${doc.referenceCode}`)} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2.5mm', gap: '8mm' }}>
      <PaymentChecks lang={lang} pm={doc.paymentMethod} row />
      <div className="sr-f" style={{ width: '45mm' }}>
        <div className="v">{doc.balanceDue !== undefined ? money(doc.balanceDue) : ''}</div>
        <div className="k">{t(lang, 'Haraaga ($)', 'Balance ($)')}</div>
      </div>
    </div>
    <div className="sr-f" style={{ width: '60mm', marginTop: '3mm' }}>
      <div className="v" />
      <div className="k">{t(lang, 'Saxiixa qaataha (SOORAR)', 'Received by (SOORAR)')}</div>
    </div>
    <div className="thanks">{t(lang, 'Mahadsanid! Rarid xirfad leh, Muqdisho oo dhan.', 'Thank you! Professional moving across all of Mogadishu.')}</div>
  </div>
);

const ReceiptTpl: React.FC<TplProps> = (p) => (
  <div className="sr-page">
    <div className="sr-topbar"><i className="o" /><i className="b" /></div>
    <ReceiptCopy {...p} />
    <div className="sr-cut"><span>✂ {t(p.lang, 'halkan ka jar', 'cut here')}</span></div>
    <div className="sr-topbar" style={{ marginTop: '4mm' }}><i className="o" /><i className="b" /></div>
    <ReceiptCopy {...p} />
    <div className="sr-topbar"><i className="o" /><i className="b" /></div>
  </div>
);

const BookingTpl: React.FC<TplProps> = ({ doc, lang, phone }) => {
  const S = doc.servicesList || [];
  const svc = [
    { so: 'Rarid guri', en: 'Home move', m: ['home', 'guri', 'villa', 'apartment'] },
    { so: 'Rarid xafiis', en: 'Office move', m: ['office', 'xafiis'] },
    { so: 'Furfurid', en: 'Dismantling', m: ['furfur', 'dismantl', 'assembl'] },
    { so: 'Xerxeris', en: 'Assembly', m: ['xerxer', 'assembl'] },
    { so: 'Alaab culus', en: 'Heavy items', m: ['heavy', 'culus'] },
    { so: 'Baakadeyn', en: 'Packing', m: ['pack', 'baakad'] },
    { so: 'Kaydin', en: 'Storage', m: ['storage', 'kayd'] },
    { so: 'Nadiifin', en: 'Cleaning', m: ['clean', 'nadiif'] },
  ];
  return (
    <Page
      lang={lang}
      phone={phone}
      title={t(lang, 'FOOMKA BALLANTA', 'BOOKING FORM')}
      sub={lang === 'so' ? <>Booking form &nbsp;•&nbsp; Diiwaangelinta shaqada rarka</> : 'Register a new moving job'}
      meta={[
        [t(lang, 'Ballan No.', 'Booking No.'), doc.bookingRef || doc.docNumber],
        [t(lang, 'Taariikhda', 'Date'), doc.date],
      ]}
    >
      <div className="sr-sec">{t(lang, 'Macluumaadka macmiilka', 'Client information')}</div>
      <div className="sr-grid c2">
        <F k={t(lang, 'Magaca oo buuxa', 'Full name')} v={doc.customerName} />
        <F k={t(lang, 'Taleefanka / WhatsApp', 'Phone / WhatsApp')} v={doc.customerPhone} />
        <F k={t(lang, 'Taleefan kale', 'Alternative phone')} />
        <F k={t(lang, 'Sidee noo ogaatay? (Facebook, TikTok, saaxiib...)', 'How did you hear about us? (Facebook, TikTok, friend...)')} />
      </div>
      <div className="sr-sec">{t(lang, 'Faahfaahinta rarka', 'Move details')}</div>
      <div className="sr-grid c3">
        <F k={t(lang, 'Taariikhda', 'Date')} v={doc.moveDate} />
        <F k={t(lang, 'Saacadda', 'Time')} v={doc.moveTime} />
        <F k={t(lang, 'Cabbirka (qolal)', 'Size (rooms)')} v={(doc.notes || '').split('·')[0]} />
      </div>
      <div className="sr-grid" style={{ gridTemplateColumns: '3fr 1fr' }}>
        <F k={t(lang, 'Ka: cinwaanka / degmada', 'From: address / district')} v={joinParts(doc.fromAddress, doc.fromDistrict)} />
        <F k={t(lang, 'Dabaqa', 'Floor')} v={floorTxt(lang, doc.fromFloor, doc.fromLift)} />
        <F k={t(lang, 'Ku: cinwaanka / degmada', 'To: address / district')} v={joinParts(doc.toAddress, doc.toDistrict)} />
        <F k={t(lang, 'Dabaqa', 'Floor')} v={floorTxt(lang, doc.toFloor, doc.toLift)} />
      </div>
      <div className="sr-sec">{t(lang, 'Adeegyada la rabo', 'Services required')}</div>
      <div className="sr-checks" style={{ gridTemplateColumns: 'repeat(4, 1fr)', width: '100%' }}>
        {svc.map((s) => (
          <Check key={s.en} on={hasService(S, s.m)}>{t(lang, s.so, s.en)}</Check>
        ))}
      </div>
      <div className="sr-small" style={{ marginTop: '3mm' }}>
        {t(lang, 'Alaab gaar ah (muraayad, TV, safe, piano, qalab xafiis...)', 'Special items (glass, TV, safe, piano, office equipment...)')}
      </div>
      <div className="sr-box" style={{ marginTop: '1mm', minHeight: '18mm' }}>{(doc.notes || '').split('·').slice(1).join('·').trim()}</div>
      <div className="sr-sec">{t(lang, 'Lacagta', 'Payment')}</div>
      <div className="sr-grid c3">
        <F k={t(lang, 'Qiimaha la isku afgartay ($)', 'Agreed price ($)')} v={Number(doc.total) ? money(doc.total) : ''} />
        <F k={t(lang, 'Deposit la bixiyay ($)', 'Deposit paid ($)')} v={Number(doc.amountPaid) ? money(doc.amountPaid) : ''} />
        <F k={t(lang, 'Haraaga ($)', 'Balance ($)')} v={Number(doc.balanceDue) ? money(doc.balanceDue) : ''} />
      </div>
      <F
        k={t(lang, 'Kooxda loo diray (shaqaalaha & gaariga)', 'Assigned team (crew & truck)')}
        v={joinParts((doc.crewNames || []).join(', '), doc.vehiclePlate && `${doc.vehiclePlate}${doc.vehicleName ? ' · ' + doc.vehicleName : ''}`)}
      />
      <Signatures lang={lang} leftName={doc.customerName} />
    </Page>
  );
};

const InventoryTpl: React.FC<TplProps> = ({ doc, lang, phone }) => (
  <Page
    lang={lang}
    phone={phone}
    title={t(lang, 'LIISKA ALAABTA', 'INVENTORY CHECKLIST')}
    sub={lang === 'so' ? <>Inventory checklist &nbsp;•&nbsp; Xaaladda alaabta ka hor iyo ka dib rarka</> : 'Item condition before and after the move'}
    meta={[
      [t(lang, 'Ballan No.', 'Booking No.'), doc.bookingRef || doc.docNumber],
      [t(lang, 'Taariikhda', 'Date'), doc.date],
    ]}
  >
    <div className="sr-grid c2" style={{ marginTop: '3mm' }}>
      <F k={t(lang, 'Magaca macmiilka', 'Client name')} v={doc.customerName} />
      <F k={t(lang, 'Taariikhda rarka', 'Moving date')} v={doc.moveDate} />
    </div>
    <table className="sr-table compact">
      <thead>
        <tr>
          <th style={{ width: '9mm' }}>#</th>
          <th>{t(lang, 'Alaabta', 'Item')}</th>
          <th className="num" style={{ width: '13mm' }}>{t(lang, 'Tirada', 'Qty')}</th>
          <th style={{ width: '22mm' }}>{t(lang, 'Qolka', 'Room')}</th>
          <th style={{ width: '26mm' }}>{t(lang, 'Xaalad ka hor', 'Before')}</th>
          <th style={{ width: '26mm' }}>{t(lang, 'Xaalad ka dib', 'After')}</th>
          <th style={{ width: '22mm' }}>{t(lang, 'Fiiro', 'Notes')}</th>
        </tr>
      </thead>
      <tbody>
        {padRows(doc.inventoryItems || [], 20).slice(0, 26).map((it, i) => (
          <tr key={i}>
            <td className="idx">{i + 1}</td>
            <td>{it?.itemName}</td>
            <td className="num">{it ? it.quantity : ''}</td>
            <td>{it?.roomLabel || ''}</td>
            <td>{it?.conditionBefore}</td>
            <td>{it?.conditionAfter}</td>
            <td>{it?.boxNumber || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="sr-small" style={{ marginTop: '2mm' }}>
      {t(lang, 'Furaha xaaladda:  W = Wanaagsan   X = Xoqan   J = Jaban   M = Maqan', 'Condition key:  G = Good   S = Scratched   B = Broken   M = Missing')}
    </div>
    <Signatures
      lang={lang}
      left={t(lang, 'Macmiilka (waan hubiyay)', 'Client (checked & confirmed)')}
      right={t(lang, 'Madaxa kooxda SOORAR', 'SOORAR team leader')}
      leftName={doc.deliverySignature || doc.pickupSignature || doc.customerName}
    />
  </Page>
);

const AGREEMENT: Record<L, Array<[string, string]>> = {
  so: [
    ['Adeegga', 'SOORAR waxay qabanaysaa rarida alaabta ku qoran liiska alaabta, laga bilaabo cinwaanka “Ka” ilaa cinwaanka “Ku”, taariikhda iyo saacadda la isku afgartay.'],
    ['Lacag bixinta', 'Deposit-ka ayaa ballanta xaqiijiya. Haraaga waxaa la bixiyaa isla maalinta marka shaqada la dhammeeyo, cash, EVC Plus, eDahab ama bangi.'],
    ['Baajinta ballanta', 'Haddii macmiilku baajiyo 24 saac ka hor, deposit-ka waa loo celinayaa. Ka dib 24 saac, deposit-ku ma soo noqonayo.'],
    ['Mas’uuliyadda', 'SOORAR waxay si taxaddar leh u xamili doontaa alaabta. Haddii alaab ay ku dhaawacanto khalad shaqaalaha, SOORAR ayaa dayactiraysa ama magdhow ka bixinaysa, marka lagu xaqiijiyo liiska alaabta.'],
    ['Alaabta gaarka ah', 'Lacag, dahab, dukumentiyo muhiim ah iyo alaab aad qiimo u leh waa inuu macmiilku isagu qaado. SOORAR mas’uul kama aha haddii aan si gaar ah loogu sheegin.'],
    ['Isbeddel', 'Alaab dheeraad ah, dabaq, ama meel kale oo lagu daro maalinta rarka waxay keeni kartaa qiimo dheeraad ah oo hore loo sheego.'],
    ['Cabashada', 'Cabasho kasta waa in la soo sheegaa 48 saac gudahood marka shaqada la dhammeeyo, WhatsApp +252 770 505 028.'],
  ],
  en: [
    ['Service', 'SOORAR will move the items listed in the inventory checklist from the “From” address to the “To” address on the agreed date and time.'],
    ['Payment', 'The deposit confirms the booking. The balance is paid on the same day once the job is completed, by cash, EVC Plus, eDahab or bank transfer.'],
    ['Cancellation', 'If the client cancels at least 24 hours in advance, the deposit is refunded. Cancellations within 24 hours are non-refundable.'],
    ['Liability', 'SOORAR will handle all items with care. If an item is damaged through the crew’s fault, SOORAR will repair it or pay compensation, as verified against the inventory checklist.'],
    ['Valuables', 'Cash, gold, important documents and high-value items must be carried by the client. SOORAR is not responsible for them unless specifically declared.'],
    ['Changes', 'Extra items, floors or stops added on moving day may incur an additional charge, which will be communicated in advance.'],
    ['Complaints', 'Any complaint must be reported within 48 hours of job completion via WhatsApp +252 770 505 028.'],
  ],
};

const Clauses: React.FC<{ items: Array<[string, string]>; lang: L }> = ({ items, lang }) => (
  <div className="sr-clauses">
    {items.map(([h, p], i) => (
      <div className="c" key={i}>
        <b>{i + 1}. {h}</b>
        <p>{p}</p>
      </div>
    ))}
    <div className="sr-agree">{t(lang, 'Labada dhinac waxay ogolaadeen shuruudaha kor ku xusan.', 'Both parties agree to the terms stated above.')}</div>
  </div>
);

const AgreementTpl: React.FC<TplProps> = ({ doc, lang, phone }) => (
  <Page
    lang={lang}
    phone={phone}
    title={t(lang, 'HESHIISKA ADEEGGA', 'SERVICE AGREEMENT')}
    sub={lang === 'so' ? <>Service agreement &nbsp;•&nbsp; Heshiis u dhexeeya SOORAR iyo macmiilka</> : 'Agreement between SOORAR and the client'}
    meta={[
      [t(lang, 'Heshiis No.', 'Agreement No.'), doc.docNumber],
      [t(lang, 'Taariikhda', 'Date'), doc.date],
    ]}
  >
    <div className="sr-grid c2" style={{ marginTop: '4mm' }}>
      <F k={t(lang, 'Macmiilka (magaca)', 'Client name')} v={doc.customerName} />
      <F k={t(lang, 'Taleefanka', 'Phone')} v={doc.customerPhone} />
      <F k={t(lang, 'Ka', 'From')} v={joinParts(doc.fromDistrict, doc.fromAddress, floorTxt(lang, doc.fromFloor, doc.fromLift))} />
      <F k={t(lang, 'Ku', 'To')} v={joinParts(doc.toDistrict, doc.toAddress, floorTxt(lang, doc.toFloor, doc.toLift))} />
    </div>
    <div className="sr-grid c3">
      <F k={t(lang, 'Taariikhda rarka', 'Moving date')} v={joinParts(doc.moveDate, doc.moveTime)} />
      <F k={t(lang, 'Qiimaha guud ($)', 'Total price ($)')} v={Number(doc.total) ? money(doc.total) : ''} />
      <F k="Deposit ($)" v={Number(doc.amountPaid) ? money(doc.amountPaid) : ''} />
    </div>
    <Clauses items={AGREEMENT[lang]} lang={lang} />
    <Signatures lang={lang} leftName={doc.customerName} />
  </Page>
);

const CompletionTpl: React.FC<TplProps> = ({ doc, lang, phone }) => {
  const items = lang === 'so'
    ? ['Alaabta oo dhan way timid (liiska alaabta waa la hubiyay)', 'Alaabta waxaa la dhigay qolalkii la rabay', 'Sariiraha iyo armaajooyinka waa la xerxeray', 'Wasakhda iyo baakadaha waa la qaaday', 'Wax dhaawac ah ma jiro']
    : ['All items delivered (inventory checklist verified)', 'Items placed in the requested rooms', 'Beds and wardrobes reassembled', 'Packaging and debris removed', 'No damage'];
  const rates = lang === 'so'
    ? ['5 Aad u fiican', '4 Fiican', '3 Caadi', '2 Liita', '1 Aad u liita']
    : ['5 Excellent', '4 Good', '3 Average', '2 Poor', '1 Very poor'];
  const delivered = !!doc.deliverySignature;
  return (
    <Page
      lang={lang}
      phone={phone}
      title={t(lang, 'XAQIIJINTA SHAQADA', 'JOB COMPLETION')}
      sub={lang === 'so' ? <>Job completion &nbsp;•&nbsp; Caddeynta in rarka si guul leh loo dhammeeyay</> : 'Confirmation that the move was completed successfully'}
      meta={[
        [t(lang, 'Ballan No.', 'Booking No.'), doc.bookingRef || doc.docNumber],
        [t(lang, 'Taariikhda', 'Date'), doc.date],
      ]}
    >
      <div className="sr-grid c2" style={{ marginTop: '4mm' }}>
        <F k={t(lang, 'Macmiilka', 'Client')} v={doc.customerName} />
        <F k={t(lang, 'Cinwaanka cusub', 'New address')} v={joinParts(doc.toDistrict, doc.toAddress)} />
      </div>
      <div className="sr-grid c3">
        <F k={t(lang, 'Saacadda bilowga', 'Start time')} v={doc.moveTime} />
        <F k={t(lang, 'Saacadda dhammaadka', 'End time')} />
        <F k={t(lang, 'Madaxa kooxda', 'Team leader')} v={(doc.crewNames || [])[0]} />
      </div>
      <div className="sr-sec">{t(lang, 'Hubinta', 'Checklist')}</div>
      <div style={{ display: 'grid', rowGap: '1.8mm' }}>
        {items.map((s) => (
          <Check key={s} on={delivered}>{s}</Check>
        ))}
      </div>
      <div className="sr-small" style={{ marginTop: '3mm' }}>
        {t(lang, 'Haddii dhaawac jiro, sharax (alaabta, xaaladda, sawir la qaaday?)', 'If there is any damage, describe it (item, condition, photo taken?)')}
      </div>
      <div className="sr-box" style={{ marginTop: '1mm', minHeight: '17mm' }} />
      <div className="sr-sec">{t(lang, 'Sidee u qiimeysaa adeeggeena?', 'How would you rate our service?')}</div>
      <div className="sr-checks row">{rates.map((r) => <Check key={r}>{r}</Check>)}</div>
      <div className="sr-small" style={{ marginTop: '2.5mm' }}>
        {t(lang, 'Faallo (waxaan u isticmaali karnaa baraha bulshada haddii aad ogolaato)', 'Comments (we may share on social media with your permission)')}
      </div>
      <div className="sr-box" style={{ marginTop: '1mm', minHeight: '17mm' }}>{doc.notes || ''}</div>
      <div style={{ marginTop: '2.5mm' }}><Check>{t(lang, 'Waan ogolaaday in faalladayda la daabaco', 'I agree my review may be published')}</Check></div>
      <div className="sr-f" style={{ width: '60mm', marginTop: '2mm' }}>
        <div className="v">{doc.amountPaid ? money(doc.amountPaid) : ''}</div>
        <div className="k">{t(lang, 'Haraaga waa la bixiyay ($)', 'Balance paid ($)')}</div>
      </div>
      <Signatures lang={lang} leftName={doc.deliverySignature || doc.customerName} />
    </Page>
  );
};

const LetterheadTpl: React.FC<TplProps> = ({ doc, lang, phone }) => (
  <Page lang={lang} phone={phone} watermark>
    <div style={{ borderTop: '0.25mm solid #C9D3E1', marginTop: '5mm' }} />
    <div className="sr-grid" style={{ gridTemplateColumns: '2fr 1fr', marginTop: '3mm' }}>
      <F k={t(lang, 'Tixraac / Ref.', 'Ref.')} v={doc.docNumber} />
      <F k={t(lang, 'Taariikhda', 'Date')} v={doc.date} />
    </div>
    <F k={t(lang, 'Ku socota', 'To')} v={doc.recipient || doc.customerName} />
    <F k={t(lang, 'Ujeeddo', 'Subject')} v={doc.subject || ''} />
    <div style={{ marginTop: '6mm', fontSize: '9.6pt', lineHeight: 1.65, color: '#1F2D45', whiteSpace: 'pre-line', position: 'relative' }}>
      {doc.notes || ''}
    </div>
    <div style={{ marginTop: 'auto', paddingBottom: '8mm', width: '62mm' }}>
      <div className="sr-sig">
        <div className="line" />
        <div className="k2">{t(lang, 'Saxiix & shaambad', 'Signature & stamp')}</div>
      </div>
    </div>
  </Page>
);

const PRICE_ROWS: Record<L, Array<[string, string]>> = {
  so: [
    ['Rarid guri', 'Qol 1 / studio'], ['Rarid guri', '2 qol'], ['Rarid guri', '3 qol'], ['Rarid guri', '4 qol iyo ka badan'],
    ['Rarid xafiis', 'Xafiis yar (1-5 miis)'], ['Rarid xafiis', 'Xafiis weyn (6+ miis)'], ['Furfurid & xerxeris', 'Sariir ama armaajo kasta'],
    ['Baakadeyn', 'Qol kasta (kartoon + cajalad)'], ['Alaab culus', 'Safe, piano, firiij weyn'], ['Gaari keliya', 'Saacaddii, darawal la socdo'],
    ['Shaqaale dheeraad ah', 'Qof kasta, maalintii'], ['Dabaq sare', 'Dabaq kasta oo aan wiish lahayn'], ['Rarid magaalada dibaddeeda', 'Km kasta ama safar'],
  ],
  en: [
    ['Home move', '1 room / studio'], ['Home move', '2 rooms'], ['Home move', '3 rooms'], ['Home move', '4+ rooms'],
    ['Office move', 'Small office (1-5 desks)'], ['Office move', 'Large office (6+ desks)'], ['Dismantle & assembly', 'Per bed or wardrobe'],
    ['Packing', 'Per room (boxes + tape)'], ['Heavy items', 'Safe, piano, large fridge'], ['Truck only', 'Per hour, with driver'],
    ['Extra crew', 'Per person, per day'], ['Upper floor', 'Per floor without lift'], ['Out-of-town move', 'Per km or trip'],
  ],
};

const PriceListTpl: React.FC<TplProps> = ({ doc, lang, phone }) => {
  const rows: Array<[string, string, string, string]> = (doc.lineItems && doc.lineItems.length
    ? doc.lineItems.map((l) => [l.category || l.description, l.category ? l.description : '', l.unitPrice ? money(l.unitPrice) : '', ''] as [string, string, string, string])
    : PRICE_ROWS[lang].map(([a, b]) => [a, b, '', ''] as [string, string, string, string]));
  return (
    <Page
      lang={lang}
      phone={phone}
      title={t(lang, 'LIISKA QIIMAHA', 'PRICE LIST')}
      sub={lang === 'so' ? <>Price list &nbsp;•&nbsp; Qiimaha adeegyada SOORAR</> : 'SOORAR service prices'}
      meta={[
        ['Version', doc.docNumber],
        [t(lang, 'Taariikhda', 'Date'), doc.date],
        [t(lang, 'Ansax ilaa', 'Valid until'), addYear(doc.date)],
      ]}
    >
      <table className="sr-table">
        <thead>
          <tr>
            <th style={{ width: '40mm' }}>{t(lang, 'Adeegga', 'Service')}</th>
            <th>{t(lang, 'Faahfaahin', 'Details')}</th>
            <th className="num" style={{ width: '28mm' }}>{t(lang, 'Qiimaha ($)', 'Price ($)')}</th>
            <th style={{ width: '26mm' }}>{t(lang, 'Fiiro', 'Notes')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{r[0]}</td>
              <td>{r[1]}</td>
              <td className="num">{r[2]}</td>
              <td>{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sr-box" style={{ marginTop: '6mm', fontSize: '8pt', lineHeight: 1.6 }}>
        <div className="sr-sec" style={{ margin: '0 0 1mm' }}>{t(lang, 'Xusuus', 'Note')}</div>
        • {t(lang, 'Qiimaha kama dambaysta ah waxaa lagu go’aamiyaa qiimeyn (quotation) ka dib marka alaabta la arko.', 'The final price is set by a quotation after the items are seen.')}
        <br />• {t(lang, 'Ballanta waxaa lagu xaqiijiyaa deposit. Lacag bixin: Cash, EVC Plus, eDahab, Bangi.', 'Bookings are confirmed with a deposit. Payment: Cash, EVC Plus, eDahab, Bank.')}
        <br />• {t(lang, 'Qiimo bilaash ah: WhatsApp', 'Free quote: WhatsApp')} {phone}.
      </div>
    </Page>
  );
};

const CONTRACT: Record<L, Array<[string, string]>> = {
  so: [
    ['Muddada tijaabada', 'Shaqaaluhu wuxuu galayaa muddo tijaabo ah oo ah ________ bilood. Muddadaas gudaheed labada dhinac midkood ayaa joojin kara heshiiska ogeysiis 3 maalmood ah.'],
    ['Saacadaha shaqada', 'Shaqadu waxay ku xiran tahay ballamaha macaamiisha. Saacadaha caadiga ah waa ________ ilaa ________, maalmaha ________.'],
    ['Mushaharka', 'Mushaharka waxaa la bixiyaa maalinta ________ ee bil kasta, EVC Plus, eDahab ama cash. Shaqo dheeraad ah waxaa lagu bixiyaa heshiis.'],
    ['Waajibaadka', 'Shaqaaluhu wuxuu si taxaddar leh u xamilayaa alaabta macmiilka, xiranayaa shaagadda SOORAR, imanayaa waqtiga, kuna dhaqmayaa edeb.'],
    ['Daacadnimada & sirta', 'Xatooyo, dhaawac ula kac ah, ama macluumaadka macmiilka oo la faafiyo waxay keenaysaa joojin degdeg ah iyo tallaabo sharci ah.'],
    ['Ammaanka', 'Shaqaaluhu wuxuu raacayaa tilmaamaha ammaanka ee qaadista alaabta culus. SOORAR waxay bixinaysaa qalabka shaqada.'],
    ['Fasaxa', 'Fasax waa in la codsadaa ugu yaraan 3 maalmood ka hor, marka laga reebo xaalad degdeg ah.'],
    ['Joojinta heshiiska', 'Ka dib muddada tijaabada, dhinac kasta wuxuu joojin karaa heshiiska ogeysiis 14 maalmood ah.'],
  ],
  en: [
    ['Probation period', 'The employee starts with a probation period of ________ months. During this period either party may end the contract with 3 days’ notice.'],
    ['Working hours', 'Work depends on client bookings. Normal hours are ________ to ________, on ________.'],
    ['Salary', 'Salary is paid on day ________ of each month by EVC Plus, eDahab or cash. Extra work is paid by agreement.'],
    ['Duties', 'The employee handles client property with care, wears the SOORAR uniform, arrives on time and behaves respectfully.'],
    ['Honesty & confidentiality', 'Theft, deliberate damage or sharing client information leads to immediate termination and legal action.'],
    ['Safety', 'The employee follows safety instructions for lifting heavy items. SOORAR provides the work equipment.'],
    ['Leave', 'Leave must be requested at least 3 days in advance, except in emergencies.'],
    ['Termination', 'After probation, either party may end the contract with 14 days’ notice.'],
  ],
};

const roleIsDaily = (r: string) => /mover|helper|daily|maalin/i.test(r);

const StaffContractTpl: React.FC<TplProps> = ({ doc, lang, phone }) => {
  const s = doc.staffMember!;
  return (
    <Page
      lang={lang}
      phone={phone}
      title={t(lang, 'HESHIISKA SHAQADA', 'EMPLOYMENT CONTRACT')}
      sub={lang === 'so' ? <>Employment contract &nbsp;•&nbsp; SOORAR iyo shaqaalaha</> : 'Between SOORAR and the employee'}
      meta={[
        [t(lang, 'Heshiis No.', 'Contract No.'), doc.docNumber],
        [t(lang, 'Taariikhda', 'Date'), doc.date],
      ]}
    >
      <div className="sr-grid c2" style={{ marginTop: '4mm' }}>
        <F k={t(lang, 'Magaca shaqaalaha oo buuxa', 'Employee full name')} v={s.name} />
        <F k={t(lang, 'Lambarka aqoonsiga (ID / baasaboor)', 'ID / passport number')} v={s.idCardNumber} />
      </div>
      <div className="sr-grid c3">
        <F k={t(lang, 'Taleefanka', 'Phone')} v={s.phone} />
        <F k={t(lang, 'Degmada / cinwaanka', 'District / address')} />
        <F k={t(lang, 'Qof xiriir degdeg ah', 'Emergency contact')} />
        <F k={t(lang, 'Jagada (tusaale: rare, darawal)', 'Position (e.g. mover, driver)')} v={s.role} />
        <F k={t(lang, 'Taariikhda bilowga', 'Start date')} v={doc.date} />
        <F k={t(lang, 'Mushaharka ($)', 'Salary ($)')} v={s.dailyRateUsd ? `${money(s.dailyRateUsd)} / ${t(lang, 'maalin', 'day')}` : ''} />
      </div>
      <div className="sr-sec">{t(lang, 'Nooca shaqada', 'Type of employment')}</div>
      <div className="sr-checks row">
        <Check on={!roleIsDaily(s.role)}>{t(lang, 'Waqti buuxa', 'Full time')}</Check>
        <Check>{t(lang, 'Waqti dhiman', 'Part time')}</Check>
        <Check on={roleIsDaily(s.role)}>{t(lang, 'Maalinle (shaqo kasta)', 'Daily (per job)')}</Check>
        <Check>{t(lang, 'Tijaabo', 'Probation')}</Check>
      </div>
      <Clauses items={CONTRACT[lang]} lang={lang} />
      <Signatures
        lang={lang}
        left={t(lang, 'Saxiixa shaqaalaha', 'Employee signature')}
        right={t(lang, 'Saxiixa maamulka SOORAR', 'SOORAR management signature')}
        leftName={s.name}
      />
    </Page>
  );
};

const IdCardTpl: React.FC<TplProps & { side: 'both' | 'front' | 'back' }> = ({ doc, lang, phone, qr, side }) => {
  const s = doc.staffMember!;
  const front = (
    <div className="sr-card">
      <div className="top"><img src={LOGO_WHITE} alt="SOORAR" /></div>
      <div className="strip" />
      <div className="photo">{s.photoUrl ? <img src={s.photoUrl} alt={s.name} /> : t(lang, 'SAWIR', 'PHOTO')}</div>
      <div className="nm">{s.name}</div>
      <div className="rl">{s.role}</div>
      <div className="hr" />
      <div className="idn">ID No.<b>{s.idCardNumber}</b></div>
      <div className="band">{t(lang, 'SHAQAALAHA SOORAR', 'SOORAR STAFF')}</div>
    </div>
  );
  const back = (
    <div className="sr-card back">
      <img className="wm" src={LOGO_WHITE} alt="" />
      <div className="qr">{qr ? <img src={qr} alt="QR" /> : null}</div>
      <div className="scan">{t(lang, 'Iska sawir si aad u xaqiijiso', 'Scan to verify this card')}</div>
      <div className="txt">{t(lang, 'Kaarkan waa hanti SOORAR. Haddii aad hesho, fadlan noo soo celi.', 'This card is SOORAR property. If found, please return it to us.')}</div>
      <div className="lb">WhatsApp</div>
      <div className="vl">{phone}</div>
      <div className="lb">{t(lang, 'Goobta', 'Location')}</div>
      <div className="vl" style={{ fontWeight: 400 }}>{t(lang, 'Muqdisho, Soomaaliya', 'Mogadishu, Somalia')}</div>
      <div className="lb">{t(lang, 'Ansax ilaa', 'Valid until')}</div>
      <div className="vl">{addYear(doc.date)}</div>
      <div className="sl">{t(lang, 'Rarid xirfad leh, Muqdisho oo dhan.', 'Professional moving across all of Mogadishu.')}</div>
      <div className="bar" />
    </div>
  );
  return (
    <div className="sr-page">
      <div className="sr-topbar"><i className="o" /><i className="b" /></div>
      <div className="sr-idsheet">
        <div className="sr-head">
          <img className="logo" src={LOGO} alt="SOORAR" style={{ height: '16mm' }} />
          <div className="sr-company">
            <div className="n">{t(lang, 'KAARKA SHAQAALAHA', 'STAFF ID CARD')}</div>
            <div className="l">{s.name} · {s.idCardNumber}</div>
            <div className="l">CR80 · 54 × 85.6 mm</div>
          </div>
        </div>
        <div className="sr-idrow">
          {side !== 'back' && (
            <div className="sr-idwrap"><div className="cap">{t(lang, 'Bogga hore', 'Front')}</div>{front}</div>
          )}
          {side !== 'front' && (
            <div className="sr-idwrap"><div className="cap">{t(lang, 'Bogga dambe', 'Back')}</div>{back}</div>
          )}
        </div>
        <div className="sr-small" style={{ textAlign: 'center', marginTop: '8mm' }}>
          {t(lang, 'Ku daabac 100% (Actual size). Ka jar xariiqda kaarka, ku dheji labada dhinac, kadibna laminate garee.', 'Print at 100% (actual size). Cut along the card edge, glue front and back together, then laminate.')}
        </div>
      </div>
      <div className="sr-footer">
        <span className="s">{t(lang, 'Rarid xirfad leh, Muqdisho oo dhan.', 'Professional moving across all of Mogadishu.')}</span>
        <span className="c">WhatsApp {phone} &nbsp;•&nbsp; {t(lang, 'Muqdisho, Soomaaliya', 'Mogadishu, Somalia')}</span>
      </div>
    </div>
  );
};

const GenericFinanceTpl: React.FC<TplProps & { title: string; sub: React.ReactNode; partyLabel: string }> = ({ doc, lang, phone, title, sub, partyLabel }) => (
  <Page
    lang={lang}
    phone={phone}
    title={title}
    sub={sub}
    meta={[
      ['No.', doc.docNumber],
      [t(lang, 'Taariikhda', 'Date'), doc.date],
      ...(doc.bookingRef ? ([[t(lang, 'Ballan No.', 'Booking No.'), doc.bookingRef]] as Array<[string, string]>) : []),
    ]}
  >
    <div className="sr-sec">{partyLabel}</div>
    <div className="sr-grid c2">
      <F k={t(lang, 'Magaca', 'Name')} v={doc.customerName} />
      <F k={t(lang, 'Taleefanka', 'Phone')} v={doc.customerPhone} />
    </div>
    <LineItemsTable doc={doc} lang={lang} phone={phone} minRows={doc.lineItems && doc.lineItems.length > 6 ? doc.lineItems.length : 6} />
    <div className="sr-bottom">
      <div>
        <div className="sr-small" style={{ marginTop: '2mm', fontWeight: 600 }}>{t(lang, 'Faahfaahin', 'Details')}</div>
        <div className="sr-box" style={{ marginTop: '1mm', minHeight: '26mm' }}>{doc.notes || ''}</div>
      </div>
      <div className="sr-totals">
        <div className="r"><span className="k">{t(lang, 'Wadarta hoose', 'Subtotal')}</span><span className="v">{money(doc.subtotal)}</span></div>
        <div className="r"><span className="k">{t(lang, 'Qiimo dhimis', 'Discount')}</span><span className="v">{Number(doc.discount) ? '-' + money(doc.discount) : ''}</span></div>
        <div className="pill"><span>{t(lang, 'WADARTA', 'TOTAL')}</span><span>{money(doc.total)}</span></div>
        {doc.amountPaid !== undefined && <div className="r"><span className="k">{t(lang, 'La bixiyay', 'Paid')}</span><span className="v">{money(doc.amountPaid)}</span></div>}
        {doc.balanceDue !== undefined && <div className="r"><span className="k">{t(lang, 'Haraaga', 'Balance')}</span><span className="v">{money(doc.balanceDue)}</span></div>}
      </div>
    </div>
    <Signatures lang={lang} left={partyLabel} leftName={doc.customerName} />
  </Page>
);

const StorageTpl: React.FC<TplProps> = ({ doc, lang, phone }) => (
  <Page
    lang={lang}
    phone={phone}
    title={t(lang, 'HESHIISKA KAYDINTA', 'STORAGE AGREEMENT')}
    sub={lang === 'so' ? <>Storage agreement &nbsp;•&nbsp; Kaydinta alaabta bakhaarka SOORAR</> : 'Secure storage at the SOORAR warehouse'}
    meta={[
      [t(lang, 'Heshiis No.', 'Agreement No.'), doc.docNumber],
      [t(lang, 'Taariikhda', 'Date'), doc.date],
    ]}
  >
    <div className="sr-grid c2" style={{ marginTop: '4mm' }}>
      <F k={t(lang, 'Macmiilka (magaca)', 'Client name')} v={doc.customerName} />
      <F k={t(lang, 'Taleefanka', 'Phone')} v={doc.customerPhone} />
      <F className="span2" k={t(lang, 'Qaybta / alaabta la kaydiyay', 'Bay / stored items')} v={doc.notes} />
      <F k={t(lang, 'Kirada bishii ($)', 'Monthly fee ($)')} v={money(doc.total)} />
      <F k={t(lang, 'Taariikhda bilowga', 'Start date')} v={doc.date} />
    </div>
    <Clauses
      lang={lang}
      items={lang === 'so'
        ? [
            ['Kaydinta', 'SOORAR waxay alaabta ku kaydinaysaa bakhaar ammaan ah oo la ilaaliyo, alaab kastana waxaa lagu dhejinayaa calaamad (tag).'],
            ['Lacag bixinta', 'Kirada waxaa la bixiyaa bil kasta horteed, cash, EVC Plus, eDahab ama bangi.'],
            ['Alaabta mamnuuca ah', 'Hub, walxo qarxa, cunto qudhmi karta ama alaab sharci darro ah lama kaydin karo.'],
            ['Qaadashada', 'Alaabta waxaa la qaadan karaa ogeysiis 24 saac ah, iyadoo la keeno rasiidka iyo aqoonsiga.'],
            ['Mas’uuliyadda', 'SOORAR waxay mas’uul ka tahay alaabta ku qoran liiska marka ay ku dhaawacanto khalad shaqaalaha.'],
          ]
        : [
            ['Storage', 'SOORAR stores the items in a secure, guarded warehouse; every item is tagged.'],
            ['Payment', 'The monthly fee is paid in advance by cash, EVC Plus, eDahab or bank transfer.'],
            ['Prohibited items', 'Weapons, explosives, perishable food or illegal goods cannot be stored.'],
            ['Collection', 'Items can be collected with 24 hours’ notice, on presenting the receipt and ID.'],
            ['Liability', 'SOORAR is liable for listed items damaged through the crew’s fault.'],
          ]}
    />
    <Signatures lang={lang} leftName={doc.customerName} />
  </Page>
);

const ReportTpl: React.FC<TplProps> = ({ doc, lang, phone }) => {
  const r = doc.report || {};
  return (
    <Page
      lang={lang}
      phone={phone}
      title={doc.titleOverride || t(lang, 'WARBIXIN', 'REPORT')}
      sub={lang === 'so' ? <>Report &nbsp;•&nbsp; {r.period || 'Warbixinta hawlaha SOORAR'}</> : r.period || 'SOORAR operations report'}
      meta={[
        ['Ref.', doc.docNumber],
        [t(lang, 'Taariikhda', 'Date'), doc.date],
      ]}
    >
      {r.kpis && r.kpis.length > 0 && (
        <div className="sr-kpis">
          {r.kpis.slice(0, 8).map((k, i) => (
            <div className="sr-kpi" key={i}><div className="k">{k.label}</div><div className="v">{k.value}</div></div>
          ))}
        </div>
      )}
      {(r.tables || []).map((tb, ti) => (
        <div key={ti}>
          <div className="sr-sec">{tb.title}</div>
          <table className="sr-table compact" style={{ marginTop: '1mm' }}>
            <thead>
              <tr>{tb.columns.map((c, i) => <th key={i} className={tb.numericCols?.includes(i) ? 'num' : ''}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {tb.rows.length === 0 ? (
                <tr><td colSpan={tb.columns.length} style={{ color: '#6B7A90' }}>{t(lang, 'Xog ma jirto', 'No records')}</td></tr>
              ) : (
                tb.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j} className={tb.numericCols?.includes(j) ? 'num' : ''}>{cell}</td>)}</tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ))}
      {r.notes && <div className="sr-box" style={{ marginTop: '4mm' }}>{r.notes}</div>}
      <div style={{ marginTop: 'auto', paddingBottom: '6mm', paddingTop: '4mm', width: '62mm' }}>
        <div className="sr-sig"><div className="line" /><div className="k2">{t(lang, 'Saxiixa maamulka SOORAR', 'SOORAR management signature')}</div></div>
      </div>
    </Page>
  );
};

/** Splits long report tables across several A4 pages. */
function splitReport(doc: PrintableDocData): PrintableDocData[] {
  const r = doc.report;
  if (!r || !r.tables) return [doc];
  const ROWS_FIRST = 26;
  const ROWS_NEXT = 34;
  const pages: PrintableDocData[] = [];
  let current: PrintableReportData = { ...r, tables: [] };
  let budget = ROWS_FIRST - (r.kpis?.length ? 5 : 0);
  for (const tb of r.tables) {
    let rows = [...tb.rows];
    let first = true;
    do {
      if (budget < 5) {
        pages.push({ ...doc, report: current });
        current = { period: r.period, tables: [] };
        budget = ROWS_NEXT;
      }
      const take = rows.splice(0, Math.max(1, budget - 3));
      current.tables!.push({ ...tb, title: first ? tb.title : `${tb.title} (…)`, rows: take });
      budget -= take.length + 3;
      first = false;
    } while (rows.length);
  }
  pages.push({ ...doc, report: { ...current, notes: r.notes } });
  return pages;
}

export const DocPages: React.FC<{ doc: PrintableDocData; lang: L; phone: string; qr?: string; side: 'both' | 'front' | 'back' }> = ({ doc, lang, phone, qr, side }) => {
  const p = { doc, lang, phone, qr };
  switch (doc.docType) {
    case 'INVOICE':
      return <InvoiceTpl {...p} />;
    case 'QUOTE':
      return <QuoteTpl {...p} />;
    case 'RECEIPT':
      return <ReceiptTpl {...p} />;
    case 'BOOKING_FORM':
      return <BookingTpl {...p} />;
    case 'INVENTORY_CHECKLIST':
      return <InventoryTpl {...p} />;
    case 'SERVICE_AGREEMENT':
      return <AgreementTpl {...p} />;
    case 'JOB_COMPLETION':
    case 'FEEDBACK_FORM':
      return <CompletionTpl {...p} />;
    case 'LETTERHEAD':
      return <LetterheadTpl {...p} />;
    case 'PRICE_LIST':
      return <PriceListTpl {...p} />;
    case 'STAFF_CONTRACT':
      return doc.staffMember ? <StaffContractTpl {...p} /> : <LetterheadTpl {...p} />;
    case 'STAFF_ID_CARD':
      return doc.staffMember ? <IdCardTpl {...p} side={side} /> : <LetterheadTpl {...p} />;
    case 'PURCHASE_ORDER':
      return <GenericFinanceTpl {...p} title={t(lang, 'DALAB IIBSI', 'PURCHASE ORDER')} sub={lang === 'so' ? <>Purchase order &nbsp;•&nbsp; Dalabka agabka SOORAR</> : 'SOORAR procurement order'} partyLabel={t(lang, 'Shirkadda alaabta keenaysa', 'Supplier')} />;
    case 'DAMAGE_REPORT':
      return <GenericFinanceTpl {...p} title={t(lang, 'WARBIXINTA DHAAWACA', 'DAMAGE CLAIM')} sub={lang === 'so' ? <>Damage claim &nbsp;•&nbsp; Cabashada iyo magdhowga alaabta</> : 'Item damage claim and resolution'} partyLabel={t(lang, 'Macmiilka', 'Client')} />;
    case 'STORAGE_CONTRACT':
      return <StorageTpl {...p} />;
    case 'REPORT':
      return <>{splitReport(doc).map((d, i) => <ReportTpl key={i} {...p} doc={d} />)}</>;
    default:
      return <LetterheadTpl {...p} />;
  }
};

const DOC_LABEL: Record<string, [string, string]> = {
  INVOICE: ['Invoice', 'Invoice'],
  QUOTE: ['Qiimeyn', 'Quotation'],
  RECEIPT: ['Rasiid', 'Receipt'],
  BOOKING_FORM: ['Foomka Ballanta', 'Booking form'],
  INVENTORY_CHECKLIST: ['Liiska Alaabta', 'Inventory checklist'],
  SERVICE_AGREEMENT: ['Heshiiska Adeegga', 'Service agreement'],
  JOB_COMPLETION: ['Xaqiijinta Shaqada', 'Job completion'],
  FEEDBACK_FORM: ['Xaqiijinta Shaqada', 'Job completion'],
  LETTERHEAD: ['Warqadda Rasmiga', 'Letterhead'],
  PRICE_LIST: ['Liiska Qiimaha', 'Price list'],
  STAFF_CONTRACT: ['Heshiiska Shaqada', 'Employment contract'],
  STAFF_ID_CARD: ['Kaarka Shaqaalaha', 'Staff ID card'],
  PURCHASE_ORDER: ['Dalab Iibsi', 'Purchase order'],
  DAMAGE_REPORT: ['Warbixinta Dhaawaca', 'Damage claim'],
  STORAGE_CONTRACT: ['Heshiiska Kaydinta', 'Storage agreement'],
  REPORT: ['Warbixin', 'Report'],
};

/* ---------------------------- modal ---------------------------- */
export const PrintableDocumentModal: React.FC<PrintableDocumentModalProps> = ({ doc, onClose, companyPhone }) => {
  const [docLang, setDocLang] = useState<L>('so');
  const [side, setSide] = useState<'both' | 'front' | 'back'>('both');
  const [qr, setQr] = useState<string>('');
  const [scale, setScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const phone = companyPhone || '+252 770 505 028';

  // QR code for staff ID cards (generated locally, links to the public verify page)
  useEffect(() => {
    setQr('');
    if (doc?.docType !== 'STAFF_ID_CARD' || !doc.staffMember) return;
    const url = `${window.location.origin}/?verify_staff=${encodeURIComponent(doc.staffMember.idCardNumber)}`;
    QRCode.toDataURL(url, { margin: 0, width: 360, color: { dark: '#0B1F3A', light: '#FFFFFF' }, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [doc]);

  // Only the document is printed while the modal is open.
  useEffect(() => {
    if (!doc) return;
    document.body.classList.add('sr-printing');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('sr-printing');
      window.removeEventListener('keydown', onKey);
    };
  }, [doc, onClose]);

  // Fit the A4 preview to the screen width (phones).
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const A4 = 794; // 210mm at 96dpi
    const update = () => setScale(Math.min(1, (el.clientWidth - 16) / A4));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  if (!doc) return null;

  const label = DOC_LABEL[doc.docType] || ['Dukumenti', 'Document'];
  const whatsappSummary =
    doc.docType === 'QUOTE'
      ? `Asc ${doc.customerName}, waa kan Qiimeynta rarkaaga ee SOORAR (${doc.docNumber}). Qiimaha guud: $${doc.total}.`
      : doc.docType === 'INVOICE'
      ? `Asc ${doc.customerName}, waa kan biilka SOORAR (${doc.docNumber}). Wadarta: $${doc.total}, La bixiyay: $${doc.amountPaid || '0.00'}, Haraaga: $${doc.balanceDue || doc.total}.`
      : doc.docType === 'RECEIPT'
      ? `Asc ${doc.customerName}, mahadsanid. Rasiidka SOORAR (${doc.docNumber}): $${doc.total} (${doc.paymentMethod || 'EVC Plus'}).`
      : `Asc ${doc.customerName}, waa kan dukumentiga SOORAR: ${label[0]} — ${doc.docNumber}.`;
  const waUrl = buildWhatsAppUrl(doc.customerPhone || phone, whatsappSummary);
  const pages = <DocPages doc={doc} lang={docLang} phone={phone} qr={qr} side={side} />;
  const pageCount = doc.docType === 'REPORT' ? splitReport(doc).length : 1;

  const doPrint = (s?: 'both' | 'front' | 'back') => {
    if (s) setSide(s);
    setTimeout(() => window.print(), 150);
  };

  return (
    <>
      <div className="no-print fixed inset-0 z-[60] bg-[#0B1F3A]/85 backdrop-blur-sm flex flex-col">
        <div className="bg-[#0B1F3A] text-white px-3 sm:px-5 py-2.5 flex flex-wrap items-center gap-2 justify-between border-b border-white/10">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-[#F1980A] font-semibold">{label[docLang === 'so' ? 0 : 1]}</div>
            <div className="text-sm font-semibold truncate">{doc.docNumber}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-white/10 rounded-lg p-0.5">
              {(['so', 'en'] as L[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setDocLang(l)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${docLang === l ? 'bg-[#00529E] text-white' : 'text-white/75'}`}
                >
                  {l === 'so' ? 'Soomaali' : 'English'}
                </button>
              ))}
            </div>
            {doc.docType === 'STAFF_ID_CARD' && (
              <div className="inline-flex bg-white/10 rounded-lg p-0.5">
                {(['both', 'front', 'back'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${side === s ? 'bg-[#F1980A] text-white' : 'text-white/75'}`}
                  >
                    {s === 'both' ? t(docLang, 'Labada', 'Both') : s === 'front' ? t(docLang, 'Hore', 'Front') : t(docLang, 'Dambe', 'Back')}
                  </button>
                ))}
              </div>
            )}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick(`admin_doc_${doc.docType.toLowerCase()}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <button
              type="button"
              onClick={() => doPrint()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F1980A] hover:bg-[#d9870a] text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> {t(docLang, 'Daabac / PDF', 'Print / PDF')}
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-white/10 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div ref={previewRef} className="flex-1 overflow-auto">
          <div className="sr-preview">
            <div
              className="sr-scale-box"
              style={{ width: 794 * scale, height: 1123 * scale * pageCount + (pageCount - 1) * 16 * scale }}
            >
              <div className="sr-scale sr-doc" style={{ transform: `scale(${scale})`, width: 794, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pages}
              </div>
            </div>
          </div>
        </div>
      </div>
      {createPortal(<div className="sr-print-root sr-doc">{pages}</div>, document.body)}
    </>
  );
};
