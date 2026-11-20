import React, { useState } from 'react';
import {
  MOGADISHU_DISTRICTS,
  SERVICE_OPTIONS,
  buildWhatsAppUrl,
  trackWhatsAppClick,
} from '../constants/mogadishu.ts';
import {
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  Home,
  Building2,
  PackageCheck,
  Wrench,
  ShieldCheck,
  Upload,
} from 'lucide-react';

interface BookingFlowViewProps {
  lang: 'so' | 'en';
  t: any;
  preselectedService?: string;
  whatsappLinkDigits: string;
  onBookingCreated?: () => void;
}

export const BookingFlowView: React.FC<BookingFlowViewProps> = ({
  lang,
  t,
  preselectedService,
  whatsappLinkDigits,
  onBookingCreated,
}) => {
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<string[]>(
    preselectedService ? [preselectedService] : ['home']
  );
  const [fromDistrict, setFromDistrict] = useState('Hodan');
  const [fromAddress, setFromAddress] = useState('');
  const [fromFloor, setFromFloor] = useState(0);
  const [fromLift, setFromLift] = useState(false);

  const [toDistrict, setToDistrict] = useState('Wadajir');
  const [toAddress, setToAddress] = useState('');
  const [toFloor, setToFloor] = useState(0);
  const [toLift, setToLift] = useState(false);

  const [sizeDescription, setSizeDescription] = useState('3 Qol (Guri Dhexe)');
  const [largeItems, setLargeItems] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [preferredDate, setPreferredDate] = useState(tomorrowStr);
  const [preferredTime, setPreferredTime] = useState('08:00');
  const [flexibleDate, setFlexibleDate] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+252 ');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    try {
      return localStorage.getItem('soorar_ref') || '';
    } catch {
      return '';
    }
  });
  const [honeypot, setHoneypot] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [whatsappHandoffUrl, setWhatsappHandoffUrl] = useState<string>('');

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((item) => item !== id) : prev) : [...prev, id]
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg(lang === 'so' ? 'Sawirku waa inuu ka yaraadaa 4MB.' : 'Photo must be smaller than 4MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const validateStep = (currentStep: number): boolean => {
    setErrorMsg('');
    if (currentStep === 1 && selectedServices.length === 0) {
      setErrorMsg(lang === 'so' ? 'Fadlan dooro ugu yaraan hal adeeg.' : 'Please select at least one service.');
      return false;
    }
    if (currentStep === 4 && !sizeDescription.trim()) {
      setErrorMsg(
        lang === 'so'
          ? 'Fadlan qor cabbirka guriga ama xafiiska (tusaale: 3 Qol).'
          : 'Please enter your home or office size (e.g., 3 Rooms).'
      );
      return false;
    }
    if (currentStep === 5 && !preferredDate) {
      setErrorMsg(lang === 'so' ? 'Fadlan dooro taariikhda rarka.' : 'Please choose a preferred moving date.');
      return false;
    }
    if (currentStep === 6) {
      if (!customerName.trim() || customerName.trim().length < 2) {
        setErrorMsg(lang === 'so' ? 'Fadlan qor magacaaga oo buuxa.' : 'Please enter your full name.');
        return false;
      }
      const cleanPhone = customerPhone.replace(/\s+/g, '');
      if (cleanPhone.length < 7) {
        setErrorMsg(
          lang === 'so'
            ? 'Fadlan qor lambar taleefan oo sax ah (+252...).'
            : 'Please enter a valid Somali phone number (+252...).'
        );
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(6, s + 1));
    }
  };

  const handleBack = () => {
    setErrorMsg('');
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(6)) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          honeypot,
          customerName,
          customerPhone,
          customerEmail,
          services: selectedServices,
          fromDistrict,
          fromAddress,
          fromFloor,
          fromLift,
          toDistrict,
          toAddress,
          toFloor,
          toLift,
          sizeDescription,
          largeItems,
          photos: photoPreview ? [photoPreview] : [],
          preferredDate,
          preferredTime,
          flexibleDate,
          notes,
          referralCode: referralCode.trim() || undefined,
          language: lang,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save booking');
      }

      const ref = data.referenceNumber || 'SR-2026-0001';
      setSubmittedRef(ref);

      const serviceNamesSo = selectedServices
        .map((id) => SERVICE_OPTIONS.find((s) => s.id === id)?.labelSo.split(' (')[0] || id)
        .join(', ');
      const serviceNamesEn = selectedServices
        .map((id) => SERVICE_OPTIONS.find((s) => s.id === id)?.labelEn || id)
        .join(', ');

      const waMessage =
        lang === 'so'
          ? `Asc SOORAR, waxaan rabaa rar. Ref: ${ref}. Adeeg: ${serviceNamesSo}. Ka: ${fromDistrict}, dabaqa ${fromFloor}. U: ${toDistrict}, dabaqa ${toFloor}. Cabbirka: ${sizeDescription}. Taariikh: ${preferredDate}, ${preferredTime}. Magac: ${customerName}. Tel: ${customerPhone}.`
          : `Hello SOORAR, I would like to book a move. Ref: ${ref}. Service: ${serviceNamesEn}. From: ${fromDistrict}, floor ${fromFloor}. To: ${toDistrict}, floor ${toFloor}. Size: ${sizeDescription}. Date: ${preferredDate}, ${preferredTime}. Name: ${customerName}. Tel: ${customerPhone}.`;

      const url = buildWhatsAppUrl(whatsappLinkDigits, waMessage);
      setWhatsappHandoffUrl(url);
      trackWhatsAppClick('booking_submit_handoff');
      if (onBookingCreated) onBookingCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error submitting booking');
    } finally {
      setSubmitting(false);
    }
  };

  const getServiceIcon = (id: string) => {
    switch (id) {
      case 'home':
        return <Home className="w-5 h-5" />;
      case 'office':
        return <Building2 className="w-5 h-5" />;
      case 'packing':
        return <PackageCheck className="w-5 h-5" />;
      case 'assembly':
        return <Wrench className="w-5 h-5" />;
      default:
        return <ShieldCheck className="w-5 h-5" />;
    }
  };

  if (submittedRef) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white border border-slate-200 rounded-[20px] p-8 md:p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#0B1F3A]">{t.booking.thankYouTitle}</h2>
        <p className="text-slate-600 mt-2 text-sm md:text-base">
          {lang === 'so'
            ? 'Codsigaaga waa lagu keydiyay nidaamka SOORAR, waxaana wargelin loo diray xafiiska maamulka.'
            : 'Your booking has been saved to our database and our dispatch team has been notified by email.'}
        </p>

        <div className="mt-6 p-5 bg-[#F2F5FA] rounded-[14px] border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">{t.booking.refLabel}</div>
          <div className="text-3xl font-bold font-mono-tabular text-[#00529E] mt-1">{submittedRef}</div>
          <div className="text-xs text-slate-600 mt-2">
            {fromDistrict} → {toDistrict} · {preferredDate} ({preferredTime})
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <a
            href={whatsappHandoffUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('thank_you_whatsapp_button')}
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            {lang === 'so'
              ? 'Riix Halkan si aad WhatsApp ugu dirto Xogta Rarkaaga'
              : 'Open WhatsApp with Pre-Filled Booking Details'}
          </a>
          <p className="text-xs text-slate-500">
            {lang === 'so'
              ? 'Farriinta WhatsApp-ka waxay ku qoran tahay lambarkaaga tixraaca iyo faahfaahinta rarkaaga.'
              : 'Your WhatsApp message is pre-filled in your selected language with your Reference ID.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step Progress Header */}
      <div className="mb-8">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            t.booking.step1,
            t.booking.step2,
            t.booking.step3,
            t.booking.step4,
            t.booking.step5,
            t.booking.step6,
          ].map((label, index) => {
            const stepNum = index + 1;
            const active = step === stepNum;
            const completed = step > stepNum;
            return (
              <button
                key={stepNum}
                type="button"
                onClick={() => {
                  if (stepNum < step) setStep(stepNum);
                }}
                className={`text-left p-2.5 rounded-[8px] border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#00529E] text-white border-[#00529E]'
                    : completed
                    ? 'bg-[#F2F5FA] text-[#00529E] border-[#00529E]/30'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                <div className="text-xs font-semibold truncate">{label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-[20px] p-6 md:p-8"
      >
        {/* Honeypot anti-spam field */}
        <input
          type="text"
          name="company_website_honeypot"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />

        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-[8px] bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Service Type (Multi-select) */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-[#0B1F3A]">
              {lang === 'so'
                ? 'Dooro Adeegyada aad u Baahan Tahay (Waad dooran kartaa wax ka badan 1)'
                : 'Select the Moving Services You Need (Multi-select)'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {SERVICE_OPTIONS.map((opt) => {
                const isSelected = selectedServices.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleService(opt.id)}
                    className={`flex items-center gap-3.5 p-4 rounded-[14px] border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#00529E] bg-[#F2F5FA] text-[#0B1F3A] ring-2 ring-[#00529E]/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#00529E] text-white' : 'bg-[#F2F5FA] text-[#00529E]'
                      }`}
                    >
                      {getServiceIcon(opt.id)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {lang === 'so' ? opt.labelSo : opt.labelEn}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Moving From */}
        {step === 2 && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-[#0B1F3A]">{t.booking.step2}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.booking.district} *
                </label>
                <select
                  value={fromDistrict}
                  onChange={(e) => setFromDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
                >
                  {MOGADISHU_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.booking.floor}
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={fromFloor}
                  onChange={(e) => setFromFloor(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm font-mono-tabular focus:outline-none focus:border-[#00529E]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.booking.address}
              </label>
              <input
                type="text"
                placeholder={
                  lang === 'so'
                    ? 'Tusaale: Agagaarka Isbitaalka Digfeer, Jidka 30-ka'
                    : 'e.g., Near Digfeer Hospital, Maka Al-Mukarama Rd'
                }
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
              />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={fromLift}
                onChange={(e) => setFromLift(e.target.checked)}
                className="w-4 h-4 accent-[#00529E] rounded"
              />
              <span className="text-sm font-medium text-slate-700">{t.booking.hasLift}</span>
            </label>
          </div>
        )}

        {/* STEP 3: Moving To */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-[#0B1F3A]">{t.booking.step3}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.booking.district} *
                </label>
                <select
                  value={toDistrict}
                  onChange={(e) => setToDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
                >
                  {MOGADISHU_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.booking.floor}
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={toFloor}
                  onChange={(e) => setToFloor(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm font-mono-tabular focus:outline-none focus:border-[#00529E]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.booking.address}
              </label>
              <input
                type="text"
                placeholder={
                  lang === 'so'
                    ? 'Tusaale: Buulo Xuubey, Agagaarka Garoonka Diyaaradaha'
                    : 'e.g., Medina Gate, Airport Road'
                }
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
              />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={toLift}
                onChange={(e) => setToLift(e.target.checked)}
                className="w-4 h-4 accent-[#00529E] rounded"
              />
              <span className="text-sm font-medium text-slate-700">{t.booking.hasLift}</span>
            </label>
          </div>
        )}

        {/* STEP 4: Home/Office Size, Large Items & Optional Photo */}
        {step === 4 && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-[#0B1F3A]">{t.booking.step4}</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.booking.sizeLabel} *
              </label>
              <input
                type="text"
                value={sizeDescription}
                onChange={(e) => setSizeDescription(e.target.value)}
                placeholder={lang === 'so' ? '3 Qol, 5 Qol Fiilo, ama Xafiis 10 Miis' : '3 Rooms, 5-Room Villa, or 10-Desk Office'}
                className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.booking.largeItemsLabel}
              </label>
              <textarea
                rows={3}
                value={largeItems}
                onChange={(e) => setLargeItems(e.target.value)}
                placeholder={
                  lang === 'so'
                    ? 'Tusaale: 2 Armaajo Turki 6-albaab, 2 Sariirood, 1 Qaboojiye weyn, Fadhi 7-kursi...'
                    : 'e.g., 2 large 6-door wardrobes, king bed, double-door fridge, L-sofa...'
                }
                className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.booking.photoLabel}
              </label>
              <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-slate-300 rounded-[14px] bg-[#F2F5FA]/60 hover:bg-[#F2F5FA] cursor-pointer text-xs font-medium text-slate-600">
                <Upload className="w-4 h-4 text-[#00529E]" />
                <span>
                  {photoPreview
                    ? lang === 'so'
                      ? 'Sawir waa la doortay (Guji si aad u beddesho)'
                      : 'Photo attached (Click to replace)'
                    : lang === 'so'
                    ? 'Dooro sawirka alaabta (Ikhtiyaari)'
                    : 'Choose a photo of your furniture (Optional)'}
                </span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* STEP 5: Date & Time */}
        {step === 5 && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-[#0B1F3A]">{t.booking.step5}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.booking.dateLabel} *
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm font-mono-tabular focus:outline-none focus:border-[#00529E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.booking.timeLabel}
                </label>
                <select
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm font-mono-tabular focus:outline-none focus:border-[#00529E]"
                >
                  <option value="07:00">07:00 Subaxnimo (AM)</option>
                  <option value="08:00">08:00 Subaxnimo (AM)</option>
                  <option value="09:30">09:30 Subaxnimo (AM)</option>
                  <option value="11:00">11:00 Barqanimo (AM)</option>
                  <option value="14:00">14:00 Duhurnimo (PM)</option>
                  <option value="16:00">16:00 Galabnimo (PM)</option>
                  <option value="19:00">19:00 Habeennimo (Office Night Move)</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={flexibleDate}
                onChange={(e) => setFlexibleDate(e.target.checked)}
                className="w-4 h-4 accent-[#00529E] rounded"
              />
              <span className="text-sm font-medium text-slate-700">{t.booking.flexibleLabel}</span>
            </label>
          </div>
        )}

        {/* STEP 6: Customer Contact Info */}
        {step === 6 && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-[#0B1F3A]">{t.booking.step6}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.booking.nameLabel} *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Maxamed Cali Xasan"
                  className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.booking.phoneLabel} *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+252 61 500 0000"
                  className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm font-mono-tabular focus:outline-none focus:border-[#00529E]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.booking.emailLabel}
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="macmiil@tusaale.so"
                className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.booking.notesLabel}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm focus:outline-none focus:border-[#00529E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.booking.referralLabel}
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder={t.booking.referralPlaceholder}
                maxLength={20}
                className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm font-mono-tabular focus:outline-none focus:border-[#00529E]"
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.booking.back}
            </button>
          ) : (
            <div />
          )}

          {step < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {t.booking.next}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              <MessageCircle className="w-4 h-4" />
              {submitting ? '...' : t.booking.submit}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
