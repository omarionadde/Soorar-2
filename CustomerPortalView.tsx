import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  UserCheck,
  CheckCircle2,
  Clock,
  MessageCircle,
  Search,
  LogOut,
  UserPlus,
  LogIn,
  ClipboardCheck,
  ArrowRight,
  FileText,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { buildWhatsAppUrl, trackWhatsAppClick } from '../constants/mogadishu.ts';
import { PrintableDocumentModal, PrintableDocData } from './PrintableDocumentModal.tsx';
import { CustomerAccountPanel, CustomerPaymentPanel } from './CustomerExtras.tsx';

interface CustomerPortalViewProps {
  lang: 'so' | 'en';
  whatsappDigits: string;
  onGoToBooking: () => void;
  onRouteToStaffErp: () => void;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  /** Public site settings (payment numbers etc.) */
  siteSettings?: Record<string, string>;
}

const PROGRESS_STEPS = [
  { key: 'New', labelSo: 'Codsi Cusub (New)', labelEn: 'Request Received' },
  { key: 'Quoted', labelSo: 'Qiimeyn La Diray (Quoted)', labelEn: 'Quote Issued' },
  { key: 'Confirmed', labelSo: 'La Xaqiijiyay (Confirmed)', labelEn: 'Booking Confirmed' },
  { key: 'In progress', labelSo: 'Rariddu Way Socotaa (In Progress)', labelEn: 'Move In Progress' },
  { key: 'Completed', labelSo: 'Waa La Dhammaystiray (Completed)', labelEn: 'Move Completed' },
];

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  lang,
  whatsappDigits,
  onGoToBooking,
  onRouteToStaffErp,
  companyAddress = 'Jidka Maka Al-Mukarama, Agagaarka KM4, Degmada Hodan, Muqdisho',
  companyPhone = '+252 770 505 028',
  companyEmail = 'info@soorar.so',
  siteSettings = {},
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [customerSession, setCustomerSession] = useState<any | null>(() => {
    try {
      const saved = sessionStorage.getItem('soorar_customer_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Unified Login inputs (Supports both Customer & Staff/Admin)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Customer Self-Register inputs
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('+252 ');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regType, setRegType] = useState<'family' | 'business' | 'NGO'>('family');

  // Quick Ref lookup
  const [quickRefInput, setQuickRefInput] = useState('SR-2026-0002');

  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackedBookings, setTrackedBookings] = useState<any[]>([]);
  const [printDoc, setPrintDoc] = useState<PrintableDocData | null>(null);

  const fetchTrackedMoves = useCallback(async (custId?: number, phone?: string, refCode?: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (custId) params.set('customerId', String(custId));
      if (phone) params.set('phone', phone);
      if (refCode) params.set('ref', refCode);

      const res = await fetch(`/api/public/customer/tracking?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tracking');
      setTrackedBookings(data.bookings || []);
    } catch (e: any) {
      setErrorMsg(e.message || 'Error fetching move progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (customerSession) {
      fetchTrackedMoves(customerSession.id, customerSession.phone);
    }
  }, [customerSession, fetchTrackedMoves]);

  // UNIFIED LOGIN HANDLER: Auto-routes Staff/Admin to ERP and Customer to Customer Portal
  const handleUnifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/unified-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      if (data.accountType === 'staff') {
        // Save staff session and automatically open the Staff/Admin ERP!
        sessionStorage.setItem(
          'soorar_staff_session',
          JSON.stringify({ token: data.token, user: data.user })
        );
        onRouteToStaffErp();
        return;
      }

      // Otherwise it is a Customer account -> open Customer Portal & Live Move Tracker!
      setCustomerSession(data.customer);
      sessionStorage.setItem('soorar_customer_user', JSON.stringify(data.customer));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          email: regEmail,
          password: regPassword,
          customerType: regType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setCustomerSession(data.customer);
      sessionStorage.setItem('soorar_customer_user', JSON.stringify(data.customer));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('soorar_customer_user');
    setCustomerSession(null);
    setTrackedBookings([]);
  };

  const getStepIndex = (status: string) => {
    const idx = PROGRESS_STEPS.findIndex((s) => s.key.toLowerCase() === (status || '').toLowerCase());
    return idx === -1 ? 0 : idx;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-10">
      <PrintableDocumentModal
        doc={printDoc}
        onClose={() => setPrintDoc(null)}
        companyAddress={companyAddress}
        companyPhone={companyPhone}
        companyEmail={companyEmail}
      />

      {/* Header Banner */}
      <div className="bg-[#0B1F3A] text-white rounded-[20px] p-6 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#F1980A]">
            {lang === 'so'
              ? 'BOGGA SOO GALIDDA MIDEYSAN (UNIFIED LOGIN & REGISTER)'
              : 'UNIFIED SIGN IN & CUSTOMER REGISTRATION'}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold">
            {customerSession
              ? lang === 'so'
                ? `Ku Soo Dhawoow, ${customerSession.name}`
                : `Welcome Back, ${customerSession.name}`
              : lang === 'so'
              ? 'Soo Gal Akoonkaaga (Login) ama Samayso Akoon Cusub (Register)'
              : 'Sign In to Your Account or Register as a New Customer'}
          </h1>
          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            {lang === 'so'
              ? 'Haddii akoonkaagu yahay Macmiil waxaa kuu kacaya qaybta la-socodka rarka, baabuurka kuu shaqeynaya iyo dukumiintiyadaada. Haddii aad tahay Shaqaale ama Maamul waxaa si toos ah kuugu kacaya nidaamka shaqada (ERP).'
              : 'Sign in with a single login: Customer accounts automatically open your live truck & move tracker, while Staff and Management accounts automatically open the ERP workspace.'}
          </p>
        </div>

        {customerSession && (
          <div className="bg-white/10 border border-white/15 rounded-[14px] p-4 shrink-0 text-xs space-y-2">
            <div className="font-bold text-sm text-white">{customerSession.name}</div>
            <div className="font-mono-tabular text-white/80">{customerSession.phone}</div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-[#F1980A] hover:underline font-semibold cursor-pointer pt-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              {lang === 'so' ? 'Ka Bax Akoonka' : 'Sign Out'}
            </button>
          </div>
        )}
      </div>

      {customerSession && (
        <CustomerAccountPanel
          lang={lang}
          session={customerSession}
          onTokenChange={(token) => {
            const next = { ...customerSession, token };
            sessionStorage.setItem('soorar_customer_user', JSON.stringify(next));
            setCustomerSession(next);
          }}
        />
      )}

      {/* Unified Auth Gate or Quick Reference Search if not logged in */}
      {!customerSession && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white rounded-[20px] border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
            {/* Login / Register Switch */}
            <div className="flex items-center gap-1.5 p-1.5 bg-[#F2F5FA] rounded-[12px]">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setErrorMsg('');
                }}
                className={`flex-1 py-3 px-4 rounded-[10px] text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  authTab === 'login' ? 'bg-[#00529E] text-white shadow-xs' : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                <LogIn className="w-4 h-4" />
                {lang === 'so' ? 'Login (Macaamiisha & Shaqaalaha)' : 'Login (Customers & Staff)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setErrorMsg('');
                }}
                className={`flex-1 py-3 px-4 rounded-[10px] text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  authTab === 'register' ? 'bg-[#F1980A] text-white shadow-xs' : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                {lang === 'so' ? 'Register (Samayso Akoon Macmiil)' : 'Register (New Customer)'}
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-[8px] bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {errorMsg}
              </div>
            )}

            {authTab === 'login' && (
              <form onSubmit={handleUnifiedLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'so'
                      ? 'Lambarka Taleefanka (+252) ama Email-ka *'
                      : 'Phone Number (+252) or Email Address *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Telefoon ama Email"
                    className="w-full px-3.5 py-3 rounded-[10px] border border-slate-300 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'so' ? 'Furaha Sirta (Password) *' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-3 rounded-[10px] border border-slate-300 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  {loading
                    ? '...'
                    : lang === 'so'
                    ? 'Soo Gal (Login)'
                    : 'Sign In Now'}
                </button>

              </form>
            )}

            {authTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="p-3 rounded-[10px] bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  {lang === 'so'
                    ? 'FIIRO GAAR AH: Macaamiishu halkan ayay ka samaysan karaan akoonkooda (Register). Shaqaalaha iyo Maamulka waxaa akoonkooda u abuuraya Admin-ka oo keliya.'
                    : 'NOTE: Customers can self-register here. Staff and Management accounts are provisioned exclusively by the Admin inside the ERP.'}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'so' ? 'Magacaaga oo Saddexan *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Maxamed Cali Xasan"
                    className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === 'so' ? 'Taleefanka (+252) *' : 'Phone (+252) *'}
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+252 61 500 0000"
                      className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === 'so' ? 'Nooca Macmiilka' : 'Customer Type'}
                    </label>
                    <select
                      value={regType}
                      onChange={(e) => setRegType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm"
                    >
                      <option value="family">{lang === 'so' ? 'Qoys / Guri (Family)' : 'Family / Residential'}</option>
                      <option value="business">{lang === 'so' ? 'Ganacsi / Shirkad' : 'Business / Corporate'}</option>
                      <option value="NGO">{lang === 'so' ? "Hay'ad (NGO)" : 'NGO / Organization'}</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email (Ikhtiyaari)
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@example.so"
                      className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === 'so' ? 'Samayso Password *' : 'Create Password *'}
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 rounded-[8px] border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  {loading
                    ? '...'
                    : lang === 'so'
                    ? 'Register — Samayso Akoonka Macaamiisha'
                    : 'Register — Create Customer Account'}
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Instant Reference Tracker */}
          <div className="lg:col-span-5 bg-[#F2F5FA] rounded-[20px] border border-slate-200 p-6 sm:p-8 space-y-5">
            <h2 className="text-lg font-bold text-[#0B1F3A]">
              {lang === 'so'
                ? 'Raadi Rarkaaga Lambarka Tixraaca (Ref #)'
                : 'Quick Track by Booking Reference Number'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {lang === 'so'
                ? 'Geli lambarka tixraaca ballantaada (tusaale SR-2026-0002 ama SR-2026-0001) si aad isla hadda u aragto baabuurka kuu shaqeynaya, halka shaqadu marayso, iyo warqadahaaga rasmiga ah (Invoice, Quotation, Heshiiska Adeegga).'
                : 'Enter your booking reference number (e.g., SR-2026-0002 or SR-2026-0001) to view your assigned truck, job progress, and official printable documents.'}
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={quickRefInput}
                  onChange={(e) => setQuickRefInput(e.target.value)}
                  placeholder="SR-2026-0002"
                  className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchTrackedMoves(undefined, undefined, quickRefInput)}
                className="px-6 py-2.5 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {lang === 'so' ? 'Raadi' : 'Track'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE JOB, TRUCK TRACKING & OFFICIAL DOCUMENTS */}
      {trackedBookings.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B1F3A]">
              {lang === 'so'
                ? `Xogta Rarkaaga, Gaariga & Dukumiintiyada Rasmiga ah (${trackedBookings.length})`
                : `Your Active Moves, Assigned Truck & Official Documents (${trackedBookings.length})`}
            </h2>
            <button
              onClick={onGoToBooking}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F1980A] hover:underline cursor-pointer"
            >
              {lang === 'so' ? '+ Dalbo Rarid Cusub' : '+ Book Another Move'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {trackedBookings.map((b: any) => {
            const currentStepIdx = getStepIndex(b.status);
            const vehicle = b.assignedVehicle;
            const crew: any[] = b.assignedCrew || [];
            const checklist: any[] = b.checklist || [];
            const quotedVal = String(b.quotedAmount || '250.00');

            return (
              <div
                key={b.id}
                className="bg-white rounded-[20px] border border-slate-200 overflow-hidden shadow-xs space-y-6 p-6 sm:p-8"
              >
                {/* Top Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
                  <div>
                    <div className="text-xs font-mono-tabular font-bold text-[#00529E]">
                      REF: {b.referenceNumber} · {b.preferredDate} ({b.preferredTime})
                    </div>
                    <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">
                      {b.fromDistrict} (Dabaqa {b.fromFloor}) → {b.toDistrict} (Dabaqa {b.toFloor})
                    </h3>
                    <div className="text-xs text-slate-600 mt-1">
                      {b.sizeDescription} · {b.largeItems}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">
                      {lang === 'so' ? 'Qiimaha Rarka:' : 'Quoted Price:'}
                    </div>
                    <div className="text-2xl font-bold font-mono-tabular text-[#F1980A]">
                      ${Number(quotedVal).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* 1. LIVE 5-STAGE JOB PROGRESS STEPPER */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'so'
                      ? '1. Heerka Shaqadu Marayso (Live Job Status)'
                      : '1. Live Job Progress Tracker'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                    {PROGRESS_STEPS.map((st, idx) => {
                      const done = idx <= currentStepIdx;
                      const isCurrent = idx === currentStepIdx;
                      return (
                        <div
                          key={st.key}
                          className={`p-3.5 rounded-[12px] border transition-colors ${
                            isCurrent
                              ? 'bg-[#00529E] text-white border-[#00529E]'
                              : done
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-[#F2F5FA] border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono-tabular font-bold mb-1">
                            <span>0{idx + 1}</span>
                            {done && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div className="text-xs font-bold leading-snug">
                            {lang === 'so' ? st.labelSo : st.labelEn}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. ASSIGNED TRUCK (BAABUURKA SHAQEYNAYA) & ASSIGNED CREW */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {/* Assigned Vehicle Card */}
                  <div className="bg-[#F2F5FA] rounded-[14px] p-5 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#00529E] uppercase">
                        <Truck className="w-4 h-4 text-[#F1980A]" />
                        <span>
                          {lang === 'so'
                            ? '2. Baabuurka Kuu Shaqeynaya (Assigned Truck)'
                            : '2. Assigned Moving Truck'}
                        </span>
                      </div>
                      {vehicle && (
                        <span className="text-xs font-mono-tabular font-bold text-emerald-700">
                          {vehicle.status}
                        </span>
                      )}
                    </div>

                    {vehicle ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between bg-white p-3 rounded-[8px] border border-slate-200">
                          <div>
                            <div className="text-slate-500">Taargada Gaariga (Plate #):</div>
                            <div className="text-base font-bold font-mono-tabular text-[#0B1F3A]">
                              {vehicle.plateNumber}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-slate-500">Nooca & Mugga:</div>
                            <div className="font-semibold text-[#00529E]">{vehicle.name}</div>
                            <div className="text-slate-600">{vehicle.capacity}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1 text-slate-700">
                          <span>
                            <strong>Darawalka Gaariga (Driver):</strong> {vehicle.driverName || 'Xuseen Cali Nuur'}
                          </span>
                          <span className="font-mono-tabular text-[#00529E] font-semibold">
                            {vehicle.lastGpsPingAt || 'Live GPS Active'}
                          </span>
                        </div>

                        {/* Live Mogadishu GPS Map Embed & Telemetry Bar */}
                        <div className="mt-3 rounded-[10px] overflow-hidden border border-slate-200 bg-white">
                          <div className="bg-[#0B1F3A] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              <span className="font-bold text-emerald-400">LIVE GPS:</span>
                              <span className="truncate">
                                {vehicle.currentLocationLabel || 'Jidka Maka Al-Mukarama · KM4, Hodan'}
                              </span>
                            </div>
                            <div className="font-mono-tabular text-white/80">
                              {vehicle.speedKmh ?? 38} km/h · ({vehicle.currentLat || '2.0371'}, {vehicle.currentLng || '45.3182'})
                            </div>
                          </div>
                          <iframe
                            title={`Live GPS Map for ${vehicle.plateNumber}`}
                            src={`https://maps.google.com/maps?q=${vehicle.currentLat || '2.0371'},${vehicle.currentLng || '45.3182'}&z=14&output=embed`}
                            className="w-full h-44 border-0"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 py-3">
                        {lang === 'so'
                          ? 'Gaarigaaga waa la diyaarinayaa, dhawaan ayaa lagu soo qori doonaa taargada.'
                          : 'Your enclosed moving truck is being dispatched and will appear here shortly.'}
                      </div>
                    )}
                  </div>

                  {/* Assigned Moving Crew Card */}
                  <div className="bg-[#F2F5FA] rounded-[14px] p-5 border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#00529E] uppercase">
                      <UserCheck className="w-4 h-4 text-[#F1980A]" />
                      <span>
                        {lang === 'so'
                          ? '3. Kooxda Shaqada & Kormeeraha (Assigned Crew)'
                          : '3. Assigned Moving Crew & Supervisor'}
                      </span>
                    </div>

                    {crew.length > 0 ? (
                      <div className="space-y-2">
                        {crew.map((member: any) => (
                          <div
                            key={member.id}
                            className="bg-white p-2.5 rounded-[8px] border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-[#0B1F3A]">{member.name}</span>{' '}
                              <span className="text-[#00529E] uppercase font-semibold">({member.role})</span>
                            </div>
                            <div className="font-mono-tabular text-slate-600">{member.phone}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 py-3">
                        {lang === 'so'
                          ? 'Kooxda xirfadlayaasha ah waa laguu qoondeynayaa.'
                          : 'Uniformed moving crew members are being assigned to your job.'}
                      </div>
                    )}
                  </div>
                </div>

                {b.status !== 'Cancelled' && <CustomerPaymentPanel lang={lang} booking={b} settings={siteSettings} session={customerSession} />}

                {/* 3. OFFICIAL SOORAR PRINTABLE DOCUMENTS SUITE FOR THIS CUSTOMER */}
                <div className="bg-[#0B1F3A] text-white rounded-[14px] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#F1980A] uppercase">
                      <FileText className="w-4 h-4" />
                      <span>
                        {lang === 'so'
                          ? '4. Dukumiintiyada Rasmiga ah ee Shaqadaada (Daabac / PDF - SO & EN)'
                          : '4. Official SOORAR Documents for Your Move (Print / PDF in SO & EN)'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPrintDoc({
                          docType: 'BOOKING_FORM',
                          docNumber: b.referenceNumber,
                          date: b.preferredDate,
                          customerName: b.customerName,
                          customerPhone: b.customerPhone,
                          bookingRef: b.referenceNumber,
                          fromDistrict: b.fromDistrict,
                          fromAddress: b.fromAddress,
                          fromFloor: b.fromFloor,
                          toDistrict: b.toDistrict,
                          toAddress: b.toAddress,
                          toFloor: b.toFloor,
                          moveDate: b.preferredDate,
                          moveTime: b.preferredTime,
                          servicesList: b.services,
                          vehiclePlate: vehicle?.plateNumber,
                          vehicleName: vehicle?.name,
                          crewNames: crew.map((c: any) => c.name),
                          subtotal: quotedVal,
                          total: quotedVal,
                          notes: `${b.sizeDescription} · ${b.largeItems || ''}`,
                        })
                      }
                      className="p-2.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-left text-xs cursor-pointer transition-colors"
                    >
                      <div className="font-mono-tabular text-[10px] text-[#F1980A] font-bold">04 · FOOMKA</div>
                      <div className="font-bold text-white mt-0.5">Foomka Ballanta</div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPrintDoc({
                          docType: 'QUOTE',
                          docNumber: `QT-${b.referenceNumber.slice(-4)}`,
                          date: b.preferredDate,
                          customerName: b.customerName,
                          customerPhone: b.customerPhone,
                          bookingRef: b.referenceNumber,
                          fromDistrict: b.fromDistrict,
                          toDistrict: b.toDistrict,
                          lineItems: [
                            {
                              description: `${b.sizeDescription} (${b.fromDistrict} → ${b.toDistrict}) — Gaariga, Shaqaalaha & Duubista`,
                              qty: 1,
                              unitPrice: Number(quotedVal),
                              total: Number(quotedVal),
                            },
                          ],
                          subtotal: quotedVal,
                          total: quotedVal,
                        })
                      }
                      className="p-2.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-left text-xs cursor-pointer transition-colors"
                    >
                      <div className="font-mono-tabular text-[10px] text-[#F1980A] font-bold">02 · QIIMEYN</div>
                      <div className="font-bold text-white mt-0.5">Quotation</div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPrintDoc({
                          docType: 'SERVICE_AGREEMENT',
                          docNumber: `AG-${b.referenceNumber.slice(-4)}`,
                          date: b.preferredDate,
                          customerName: b.customerName,
                          customerPhone: b.customerPhone,
                          bookingRef: b.referenceNumber,
                          fromDistrict: b.fromDistrict,
                          toDistrict: b.toDistrict,
                          moveDate: b.preferredDate,
                          moveTime: b.preferredTime,
                          vehiclePlate: vehicle?.plateNumber,
                          vehicleName: vehicle?.name,
                          subtotal: quotedVal,
                          total: quotedVal,
                        })
                      }
                      className="p-2.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-left text-xs cursor-pointer transition-colors"
                    >
                      <div className="font-mono-tabular text-[10px] text-[#F1980A] font-bold">06 · HESHIISKA</div>
                      <div className="font-bold text-white mt-0.5">Heshiiska Adeegga</div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPrintDoc({
                          docType: 'INVENTORY_CHECKLIST',
                          docNumber: `INV-LIST-${b.referenceNumber.slice(-4)}`,
                          date: b.preferredDate,
                          customerName: b.customerName,
                          customerPhone: b.customerPhone,
                          bookingRef: b.referenceNumber,
                          fromDistrict: b.fromDistrict,
                          toDistrict: b.toDistrict,
                          inventoryItems:
                            checklist.length > 0
                              ? checklist
                              : [
                                  {
                                    boxNumber: 'BOX-01',
                                    itemName: b.largeItems || 'Alaabta Guriga & Kartoonnada',
                                    quantity: 1,
                                    conditionBefore: 'Good - Wrapped',
                                    conditionAfter: 'Good - Verified',
                                  },
                                ],
                          subtotal: quotedVal,
                          total: quotedVal,
                          pickupSignature: b.pickupSignature,
                          deliverySignature: b.deliverySignature,
                        })
                      }
                      className="p-2.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-left text-xs cursor-pointer transition-colors"
                    >
                      <div className="font-mono-tabular text-[10px] text-[#F1980A] font-bold">05 · LIISKA</div>
                      <div className="font-bold text-white mt-0.5">Liiska Alaabta</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const inv = b.invoices?.[0];
                        setPrintDoc({
                          docType: 'INVOICE',
                          docNumber: inv?.invoiceNumber || `INV-${b.referenceNumber.slice(-4)}`,
                          date: b.preferredDate,
                          customerName: b.customerName,
                          customerPhone: b.customerPhone,
                          bookingRef: b.referenceNumber,
                          fromDistrict: b.fromDistrict,
                          toDistrict: b.toDistrict,
                          lineItems: [
                            {
                              description: `Adeegga Raridda SOORAR (${b.fromDistrict} → ${b.toDistrict})`,
                              qty: 1,
                              unitPrice: Number(inv?.totalUsd || quotedVal),
                              total: Number(inv?.totalUsd || quotedVal),
                            },
                          ],
                          subtotal: String(inv?.subtotalUsd || quotedVal),
                          total: String(inv?.totalUsd || quotedVal),
                          amountPaid: String(inv?.amountPaidUsd || '0.00'),
                          balanceDue: String(inv?.balanceDueUsd || quotedVal),
                        });
                      }}
                      className="p-2.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-left text-xs cursor-pointer transition-colors"
                    >
                      <div className="font-mono-tabular text-[10px] text-[#F1980A] font-bold">01 · INVOICE</div>
                      <div className="font-bold text-white mt-0.5">Qaansheegad / Biil</div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPrintDoc({
                          docType: 'JOB_COMPLETION',
                          docNumber: `DONE-${b.referenceNumber.slice(-4)}`,
                          date: b.preferredDate,
                          customerName: b.customerName,
                          customerPhone: b.customerPhone,
                          bookingRef: b.referenceNumber,
                          fromDistrict: b.fromDistrict,
                          toDistrict: b.toDistrict,
                          vehiclePlate: vehicle?.plateNumber,
                          vehicleName: vehicle?.name,
                          subtotal: quotedVal,
                          total: quotedVal,
                          deliverySignature: b.deliverySignature || b.customerName,
                        })
                      }
                      className="p-2.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-left text-xs cursor-pointer transition-colors"
                    >
                      <div className="font-mono-tabular text-[10px] text-[#F1980A] font-bold">07 · XAQIIJIN</div>
                      <div className="font-bold text-white mt-0.5">Xaqiijinta Shaqada</div>
                    </button>
                  </div>
                </div>

                {/* 4. INVENTORY CHECKLIST & STATUS TIMELINE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] mb-2">
                      <ClipboardCheck className="w-4 h-4 text-[#00529E]" />
                      <span>
                        {lang === 'so'
                          ? 'Liiska Hubinta Alaabta (Inventory Checklist)'
                          : 'Item & Box Condition Checklist'}
                      </span>
                    </div>
                    {checklist.length > 0 ? (
                      <div className="space-y-1.5 text-xs">
                        {checklist.map((it: any) => (
                          <div
                            key={it.id}
                            className="p-2.5 rounded bg-[#F2F5FA] flex items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-mono-tabular font-bold text-[#00529E]">
                                [{it.boxNumber || 'ITEM'}]
                              </span>{' '}
                              <span className="font-semibold">{it.itemName}</span>
                            </div>
                            <span className="text-emerald-700 font-semibold shrink-0">
                              {it.conditionAfter}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {lang === 'so'
                          ? 'Liiska alaabta iyo kartoonnada waxaa la buuxinayaa maalinta rarka.'
                          : 'Detailed box & furniture checklist is recorded upon pickup.'}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] mb-2">
                      <Clock className="w-4 h-4 text-[#F1980A]" />
                      <span>
                        {lang === 'so' ? 'Taariikhda Dhaqdhaqaaqa Rarka' : 'Live Status History'}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {(b.statusHistory || []).map((h: any, i: number) => (
                        <div
                          key={i}
                          className="p-2.5 rounded bg-[#F2F5FA] flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-bold text-[#0B1F3A]">{h.status}</span>
                            {h.note && <span className="text-slate-600"> — {h.note}</span>}
                          </div>
                          <span className="font-mono-tabular text-slate-400 shrink-0">{h.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Direct WhatsApp Dispatch Button */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {lang === 'so'
                      ? 'Ma u baahan tahay inaad la hadasho kormeeraha rarkaaga?'
                      : 'Need to speak directly with your move supervisor?'}
                  </div>
                  <a
                    href={buildWhatsAppUrl(
                      whatsappDigits,
                      `Asc SOORAR, waxaan rabaa inaan wax ka weydiiyo rarkayga Ref: ${b.referenceNumber} (${b.customerName}).`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsAppClick('customer_portal_whatsapp')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {lang === 'so' ? 'Kala Hadal WhatsApp' : 'Chat with Dispatch on WhatsApp'}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
