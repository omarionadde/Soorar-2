/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import soTranslations from './locales/so.json';
import enTranslations from './locales/en.json';
import { SoorarLogo } from './components/SoorarLogo.tsx';
import { ResilientImage } from './components/ResilientImage.tsx';
import { BookingFlowView } from './components/BookingFlowView.tsx';
const AdminErpApp = React.lazy(() => import('./components/AdminErpApp.tsx').then((m) => ({ default: m.AdminErpApp })));
import { CustomerPortalView } from './components/CustomerPortalView.tsx';
import { InstantQuote } from './components/InstantQuote.tsx';
import {
  buildWhatsAppUrl,
  trackWhatsAppClick,
  MOGADISHU_DISTRICTS,
} from './constants/mogadishu.ts';
import { UserRound,
  MessageCircle,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  Truck,
  Home,
  Building2,
  PackageCheck,
  Wrench,
  Star,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Calculator,
  Menu,
  X,
} from 'lucide-react';

type PublicPage =
  | 'home'
  | 'services'
  | 'pricing'
  | 'about'
  | 'gallery'
  | 'reviews'
  | 'faq'
  | 'contact'
  | 'booking'
  | 'customer_portal'
  | 'privacy'
  | 'terms'
  | 'admin';

const HERO_IMG = '/src/assets/images/hero_soorar_movers_1791514402987.jpg';
const HOME_IMG = '/src/assets/images/service_home_moving_1791514415369.jpg';
const OFFICE_IMG = '/src/assets/images/service_office_moving_1791514425385.jpg';
const PACKING_IMG = '/src/assets/images/service_packing_assembly_1791514435681.jpg';
const FLEET_IMG = '/src/assets/images/about_soorar_fleet_1791514445536.jpg';

export default function App() {
  // English is the primary default language; Somali is second
  const [lang, setLang] = useState<'en' | 'so'>('en');
  const [page, setPage] = useState<PublicPage>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      return 'admin';
    }
    return 'home';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [preselectedService, setPreselectedService] = useState<string | undefined>(undefined);

  // Public site bootstrap data from PostgreSQL
  const [siteData, setSiteData] = useState<any>({
    services: [],
    faqs: [],
    reviews: [],
    gallery: [],
    settings: {},
  });

  // Price estimator state
  const [estRooms, setEstRooms] = useState(3);
  const [estFloors, setEstFloors] = useState(1);
  const [estHasLift, setEstHasLift] = useState(false);
  const [estZone, setEstZone] = useState<'same' | 'near' | 'far'>('near');
  const [estPacking, setEstPacking] = useState(true);
  const [estAssembly, setEstAssembly] = useState(false);
  const [estHeavy, setEstHeavy] = useState(false);

  // Gallery filter
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'homes' | 'offices' | 'packing' | 'trucks'>('all');

  // FAQ open index
  const [openFaqId, setOpenFaqId] = useState<number | null>(0);

  // Review submission form
  const [revName, setRevName] = useState('');
  const [revDistrict, setRevDistrict] = useState('Hodan');
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');
  const [revSubmitted, setRevSubmitted] = useState(false);

  // Contact form
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('+252 ');
  const [contactMsg, setContactMsg] = useState('');
  const [contactSent, setContactSent] = useState(false);

  // Live QR Staff ID Card Verification State (?verify_staff=SO-MOG-001)
  const [verifiedStaffInfo, setVerifiedStaffInfo] = useState<any | null>(null);
  const [verifyStaffLoading, setVerifyStaffLoading] = useState(false);

  const t = lang === 'so' ? soTranslations : enTranslations;

  const loadPublicData = useCallback(async () => {
    try {
      const res = await fetch('/api/public/bootstrap');
      if (res.ok) {
        const data = await res.json();
        setSiteData(data);
      }
    } catch (e) {
      console.error('Failed to fetch bootstrap data:', e);
    }
  }, []);

  useEffect(() => {
    loadPublicData();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode && /^[A-Za-z0-9]{4,20}$/.test(refCode)) {
        try {
          localStorage.setItem('soorar_ref', refCode.toUpperCase());
        } catch {
          /* ignore */
        }
      }
      const staffCode = params.get('verify_staff');
      if (staffCode) {
        setVerifyStaffLoading(true);
        fetch(`/api/public/verify-staff/${encodeURIComponent(staffCode)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d && d.verified) {
              setVerifiedStaffInfo(d);
            }
          })
          .catch(() => {})
          .finally(() => setVerifyStaffLoading(false));
      }
    }
  }, [loadPublicData]);

  const navigateTo = (target: PublicPage, serviceSlug?: string) => {
    if (serviceSlug) {
      setPreselectedService(serviceSlug);
    }
    setPage(target);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (page === 'admin') {
    return (
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-[3px] border-[#00529E]/20 border-t-[#00529E] animate-spin" />
          </div>
        }
      >
        <AdminErpApp lang={lang} onExitAdmin={() => navigateTo('home')} onRefreshPublic={loadPublicData} />
      </React.Suspense>
    );
  }

  const sMap = siteData.settings || {};
  const whatsappPhoneDisplay = sMap.whatsapp_phone || '+252 770 505 028';
  const whatsappDigits = sMap.whatsapp_link || '252770505028';
  const officeAddress =
    sMap.office_address || 'Jidka Maka Al-Mukarama, Agagaarka KM4, Degmada Hodan, Muqdisho';
  const officeEmail = sMap.office_email || 'info@soorar.so';

  // Calculate price estimator range
  const baseByRooms = estRooms * 38 + 45;
  const floorCharge = estHasLift ? estFloors * 5 : estFloors * 15;
  const zoneCharge = estZone === 'same' ? 0 : estZone === 'near' ? 25 : 55;
  const extrasCharge = (estPacking ? 45 : 0) + (estAssembly ? 40 : 0) + (estHeavy ? 35 : 0);
  const estLow = Math.round(baseByRooms + floorCharge + zoneCharge + extrasCharge);
  const estHigh = Math.round(estLow * 1.2);

  const estimatorWhatsappMsg =
    lang === 'so'
      ? `Asc SOORAR, waxaan isticmaalay Xisaabiyaha Qiimaha: ${estRooms} Qol, Dabaqa: ${estFloors}, Qiyaasta: $${estLow} – $${estHigh}. Waxaan rabaa qiimo rasmi ah.`
      : `Hello SOORAR, I used the Price Estimator: ${estRooms} Rooms, Floor: ${estFloors}, Estimated range: $${estLow} – $${estHigh}. I would like an official quote.`;

  const getServiceIcon = (iconName: string) => {
    switch (iconName) {
      case 'Home':
        return <Home className="w-6 h-6 text-[#00529E]" />;
      case 'Building2':
        return <Building2 className="w-6 h-6 text-[#00529E]" />;
      case 'PackageCheck':
        return <PackageCheck className="w-6 h-6 text-[#00529E]" />;
      case 'Wrench':
        return <Wrench className="w-6 h-6 text-[#00529E]" />;
      default:
        return <Truck className="w-6 h-6 text-[#00529E]" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0B1F3A]">
      {/* STICKY HEADER — Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single brand wordmark */}
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="cursor-pointer text-left focus:outline-none"
          >
            <SoorarLogo variant="color" />
          </button>

          {/* Zone 2: 5 clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-700">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className={`hover:text-[#00529E] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                page === 'home' ? 'text-[#00529E] underline underline-offset-8 decoration-2' : ''
              }`}
            >
              {t.nav.home}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('services')}
              className={`hover:text-[#00529E] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                page === 'services' ? 'text-[#00529E] underline underline-offset-8 decoration-2' : ''
              }`}
            >
              {t.nav.services}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('pricing')}
              className={`hover:text-[#00529E] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                page === 'pricing' ? 'text-[#00529E] underline underline-offset-8 decoration-2' : ''
              }`}
            >
              {t.nav.pricing}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('about')}
              className={`hover:text-[#00529E] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                page === 'about' ? 'text-[#00529E] underline underline-offset-8 decoration-2' : ''
              }`}
            >
              {t.nav.about}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('contact')}
              className={`hover:text-[#00529E] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                page === 'contact' ? 'text-[#00529E] underline underline-offset-8 decoration-2' : ''
              }`}
            >
              {t.nav.contact}
            </button>
          </nav>

          {/* Zone 3: Primary CTA Action */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-full p-0.5 shrink-0">
              {(['en', 'so'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                    lang === l ? 'bg-[#00529E] text-white' : 'text-slate-600 hover:text-[#0B1F3A]'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigateTo('customer_portal')}
              title="Login / Register"
              aria-label="Login / Register"
              className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-full border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                page === 'customer_portal'
                  ? 'border-[#00529E] bg-[#00529E] text-white'
                  : 'border-[#00529E]/30 text-[#00529E] hover:bg-[#00529E] hover:text-white'
              }`}
            >
              <UserRound className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'so' ? 'Gal' : 'Login'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('booking')}
              className="px-5 py-2.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.nav.bookNow}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-[#0B1F3A] hover:bg-[#F2F5FA] cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-3 pb-4 mt-3 border-t border-slate-100 flex flex-col gap-2 text-sm font-semibold">
            <button onClick={() => navigateTo('home')} className="py-2 text-left">{t.nav.home}</button>
            <button onClick={() => navigateTo('services')} className="py-2 text-left">{t.nav.services}</button>
            <button onClick={() => navigateTo('pricing')} className="py-2 text-left">{t.nav.pricing}</button>
            <button onClick={() => navigateTo('about')} className="py-2 text-left">{t.nav.about}</button>
            <button onClick={() => navigateTo('gallery')} className="py-2 text-left">{t.nav.gallery}</button>
            <button onClick={() => navigateTo('reviews')} className="py-2 text-left">{t.nav.reviews}</button>
            <button onClick={() => navigateTo('faq')} className="py-2 text-left">{t.nav.faq}</button>
            <button onClick={() => navigateTo('contact')} className="py-2 text-left">{t.nav.contact}</button>
            <button onClick={() => navigateTo('customer_portal')} className="py-2 text-left text-[#00529E] font-bold">
              {lang === 'so' ? 'Login / Register' : 'Login / Register'}
            </button>
          </div>
        )}
      </header>

      {/* MAIN PUBLIC PAGE ROUTER */}
      <main className="flex-1">
        {/* LIVE QR CODE STAFF VERIFICATION MODAL WHEN SCANNED (?verify_staff=SO-MOG-001) */}
        {(verifiedStaffInfo || verifyStaffLoading) && (
          <div className="fixed inset-0 z-50 bg-[#0B1F3A]/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-[24px] max-w-lg w-full overflow-hidden shadow-2xl border-2 border-[#00529E]">
              <div className="bg-gradient-to-r from-[#0B1F3A] via-[#00529E] to-[#0B1F3A] text-white p-6 flex items-center justify-between">
                <SoorarLogo variant="white" />
                <button
                  type="button"
                  onClick={() => {
                    setVerifiedStaffInfo(null);
                    if (typeof window !== 'undefined') {
                      window.history.replaceState({}, '', window.location.pathname);
                    }
                  }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {verifyStaffLoading ? (
                <div className="p-10 text-center text-sm font-semibold text-[#0B1F3A]">
                  Verifying SOORAR Official Staff Credentials...
                </div>
              ) : verifiedStaffInfo?.staff ? (
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="p-4 rounded-[14px] bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        OFFICIAL SOORAR VERIFIED IDENTITY ✓
                      </div>
                      <div className="text-sm font-bold text-emerald-950">
                        {lang === 'so'
                          ? 'Shaqaalahan waa mid rasmi ah oo ka diiwaangashan Shirkadda SOORAR'
                          : 'This specialist is an active, verified employee of SOORAR Mogadishu'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-[18px] overflow-hidden bg-gradient-to-br from-[#00529E] to-[#0B1F3A] text-white flex items-center justify-center text-2xl font-bold border-2 border-[#F1980A] shrink-0">
                      {verifiedStaffInfo.staff.photoUrl ? (
                        <img
                          src={verifiedStaffInfo.staff.photoUrl}
                          alt={verifiedStaffInfo.staff.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        verifiedStaffInfo.staff.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .slice(0, 2)
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase text-[#F1980A]">
                        {verifiedStaffInfo.staff.role}
                      </div>
                      <h3 className="text-2xl font-bold text-[#0B1F3A]">{verifiedStaffInfo.staff.name}</h3>
                      <div className="text-xs font-mono-tabular font-bold text-[#00529E] mt-0.5">
                        ID Badge: {verifiedStaffInfo.staff.idCardNumber}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-[#F2F5FA] p-4 rounded-[14px] border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Phone / Contact:</span>
                      <span className="font-mono-tabular font-bold text-[#0B1F3A]">
                        {verifiedStaffInfo.staff.phone}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Duty Status:</span>
                      <span className="font-bold text-emerald-700">{verifiedStaffInfo.staff.availability}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Verified Moves Completed:</span>
                      <span className="font-mono-tabular font-bold text-[#00529E]">
                        {verifiedStaffInfo.staff.jobsCompleted}+ Successful Moves
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Assigned Branch:</span>
                      <span className="font-semibold text-[#0B1F3A]">Hodan HQ · Mogadishu</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <a
                      href={buildWhatsAppUrl(
                        whatsappDigits,
                        `Asc SOORAR, waxaan QR Code ku xaqiijiyay shaqaalaha: ${verifiedStaffInfo.staff.name} (ID: ${verifiedStaffInfo.staff.idCardNumber}).`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {lang === 'so' ? 'La Xiriir Xarunta SOORAR' : 'Confirm via SOORAR WhatsApp'}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedStaffInfo(null);
                        if (typeof window !== 'undefined') {
                          window.history.replaceState({}, '', window.location.pathname);
                        }
                      }}
                      className="py-3 px-5 rounded-full bg-[#00529E] text-white text-xs font-bold cursor-pointer"
                    >
                      {lang === 'so' ? 'Xir (Close)' : 'Done'}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="h-3 w-full flex">
                <div className="w-3/4 bg-[#00529E]" />
                <div className="w-1/4 bg-[#F1980A]" />
              </div>
            </div>
          </div>
        )}
        {/* ========================================== */}
        {/* PAGE 1: HOME                               */}
        {/* ========================================== */}
        {page === 'home' && (
          <div>
            {/* HERO SECTION: Full-width photo, navy gradient scrim, headline, 2 buttons */}
            <section className="relative min-h-[540px] flex items-center bg-[#0B1F3A] text-white overflow-hidden">
              <div className="absolute inset-0">
                <ResilientImage
                  src={HERO_IMG}
                  alt="SOORAR moving crew in blue uniforms loading wrapped furniture into moving truck in Mogadishu"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0B1F3A]/95 via-[#0B1F3A]/80 to-[#0B1F3A]/40" />
              </div>

              <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-16 md:py-24 w-full">
                <div className="max-w-2xl space-y-5">
                  <p className="text-xs sm:text-sm font-semibold text-[#F1980A] tracking-wide">
                    SOORAR · {t.brand.secondary1}
                  </p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.12] text-balance">
                    {sMap.hero_headline_so && lang === 'so' ? sMap.hero_headline_so : t.hero.headline}
                  </h1>
                  <p className="text-base sm:text-lg text-white/90 leading-relaxed max-w-xl">
                    {t.hero.subheadline}
                  </p>

                  <div className="pt-3 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => navigateTo('booking')}
                      className="px-7 py-3.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white font-semibold text-sm sm:text-base transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t.hero.ctaQuote}
                    </button>
                    <a
                      href={buildWhatsAppUrl(
                        whatsappDigits,
                        lang === 'so'
                          ? 'Asc SOORAR, waxaan rabaa macluumaad iyo qiimo ku saabsan raridda.'
                          : 'Hello SOORAR, I would like a moving quote in Mogadishu.'
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackWhatsAppClick('hero_whatsapp_button')}
                      className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm sm:text-base transition-colors whitespace-nowrap shrink-0"
                    >
                      <MessageCircle className="w-5 h-5" />
                      {t.hero.ctaWhatsapp} ({whatsappPhoneDisplay})
                    </a>
                  </div>

                  <p className="text-xs text-white/75 pt-2">
                    {t.brand.noHiddenFees} · EVC Plus · Zaad · eDahab · Cash
                  </p>
                </div>
              </div>
            </section>

            {/* TRUST BAR: 4 Quantitative Columns */}
            <section className="bg-[#00529E] text-white py-8 px-4 sm:px-8">
              <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono-tabular">
                    {sMap.years_experience || '8+'}
                  </div>
                  <div className="text-xs sm:text-sm text-white/85 mt-0.5">{t.trust.expLabel}</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono-tabular">
                    {sMap.moves_completed || '2,450+'}
                  </div>
                  <div className="text-xs sm:text-sm text-white/85 mt-0.5">{t.trust.movesLabel}</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono-tabular">
                    {sMap.insured_handling || '100%'}
                  </div>
                  <div className="text-xs sm:text-sm text-white/85 mt-0.5">{t.trust.insuredLabel}</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold">
                    {t.trust.sameDayValue}
                  </div>
                  <div className="text-xs sm:text-sm text-white/85 mt-0.5">{t.trust.sameDayLabel}</div>
                </div>
              </div>
            </section>

            {/* SERVICES GRID: photo cards */}
            <section className="py-16 md:py-24 px-4 sm:px-8 max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-10 md:mb-14">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#F1980A]/10 text-[#C77A00] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F1980A]" />
                    {lang === 'so' ? 'Adeegyadayada' : 'What we do'}
                  </span>
                  <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-[#0B1F3A] leading-tight">
                    {lang === 'so' ? (<>Adeegyada Raridda <span className="text-[#00529E]">Muqdisho</span></>) : (<>Moving Services across <span className="text-[#00529E]">Mogadishu</span></>)}
                  </h2>
                  <p className="text-slate-600 text-sm sm:text-base mt-2">{t.brand.tagline}</p>
                </div>
                <button
                  onClick={() => navigateTo('services')}
                  className="self-start md:self-auto inline-flex items-center gap-2 rounded-full border border-[#00529E]/25 px-5 py-2.5 text-sm font-semibold text-[#00529E] hover:bg-[#00529E] hover:text-white transition-colors cursor-pointer"
                >
                  {lang === 'so' ? 'Dhammaan adeegyada' : 'All services'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {siteData.services.map((srv: any, index: number) => {
                  const slug = String(srv.slug || '');
                  const img = srv.imageUrl
                    || (slug.startsWith('office') ? OFFICE_IMG
                      : slug.startsWith('packing') || slug.startsWith('furniture') ? PACKING_IMG
                      : slug.startsWith('heavy') ? FLEET_IMG
                      : slug.startsWith('home') ? HOME_IMG : HERO_IMG);
                  const featured = index === 0;
                  return (
                    <article
                      key={srv.id}
                      className={`group relative overflow-hidden rounded-[22px] bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(11,31,58,0.04)] hover:shadow-[0_18px_40px_-12px_rgba(0,82,158,0.28)] hover:-translate-y-1 transition-all duration-300 flex flex-col ${featured ? 'lg:col-span-2' : ''}`}
                    >
                      <div className={`relative overflow-hidden ${featured ? 'h-56 sm:h-64' : 'h-48'}`}>
                        <ResilientImage
                          src={img}
                          alt={lang === 'so' ? srv.titleSo : srv.titleEn}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A]/85 via-[#0B1F3A]/25 to-transparent" />
                        <div className="absolute top-4 left-4 w-11 h-11 rounded-2xl bg-white/95 backdrop-blur flex items-center justify-center shadow-md">
                          {getServiceIcon(srv.iconName)}
                        </div>
                        <span className="absolute top-4 right-4 rounded-full bg-[#F1980A] text-white text-xs font-bold px-3 py-1.5 shadow-md">
                          {lang === 'so' ? srv.priceLabelSo : srv.priceLabelEn}
                        </span>
                        <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between">
                          <span className="text-white/90 text-[44px] leading-none font-bold tracking-tight">0{index + 1}</span>
                          {featured && (
                            <span className="hidden sm:inline-flex rounded-full bg-white/15 backdrop-blur text-white text-[11px] font-semibold px-3 py-1 border border-white/25">
                              {lang === 'so' ? 'Ugu dalbashada badan' : 'Most booked'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-5 sm:p-6 flex flex-col flex-1">
                        <h3 className="text-lg sm:text-xl font-bold text-[#0B1F3A] group-hover:text-[#00529E] transition-colors">
                          {lang === 'so' ? srv.titleSo : srv.titleEn}
                        </h3>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed flex-1">
                          {lang === 'so' ? srv.descSo : srv.descEn}
                        </p>
                        <div className="mt-5 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => navigateTo('booking', slug.split('-')[0])}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#00529E] hover:bg-[#003F7A] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 transition-colors cursor-pointer"
                          >
                            {lang === 'so' ? 'Ballanso' : 'Book now'}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateTo('services')}
                            className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#0B1F3A] cursor-pointer"
                          >
                            {lang === 'so' ? 'Faahfaahin' : 'Learn more'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* HOW IT WORKS: 5 Steps */}
            <section className="bg-[#F2F5FA] py-16 md:py-20 px-4 sm:px-8">
              <div className="max-w-7xl mx-auto">
                <div className="max-w-2xl mb-12">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#0B1F3A]">{t.howItWorks.title}</h2>
                  <p className="text-slate-600 text-sm sm:text-base mt-1.5">{t.howItWorks.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                  {[
                    { title: t.howItWorks.step1Title, desc: t.howItWorks.step1Desc },
                    { title: t.howItWorks.step2Title, desc: t.howItWorks.step2Desc },
                    { title: t.howItWorks.step3Title, desc: t.howItWorks.step3Desc },
                    { title: t.howItWorks.step4Title, desc: t.howItWorks.step4Desc },
                    { title: t.howItWorks.step5Title, desc: t.howItWorks.step5Desc },
                  ].map((s, idx) => (
                    <div key={idx} className="bg-white rounded-[14px] p-5 border border-slate-200">
                      <div className="text-xs font-mono-tabular font-bold text-[#F1980A] mb-2">
                        STEP 0{idx + 1}
                      </div>
                      <h3 className="text-base font-bold text-[#0B1F3A]">{s.title}</h3>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* WHY SOORAR: Safety, On time, Honesty, Expertise */}
            <section className="py-16 md:py-20 px-4 sm:px-8 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                  <div>
                    <p className="text-xs font-semibold text-[#00529E] uppercase tracking-wider">
                      {t.whySoorar.subtitle}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#0B1F3A] mt-1">
                      {t.whySoorar.title}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="p-5 rounded-[14px] bg-[#F2F5FA]">
                      <h3 className="font-bold text-base text-[#0B1F3A]">{t.whySoorar.safetyTitle}</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{t.whySoorar.safetyDesc}</p>
                    </div>
                    <div className="p-5 rounded-[14px] bg-[#F2F5FA]">
                      <h3 className="font-bold text-base text-[#0B1F3A]">{t.whySoorar.onTimeTitle}</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{t.whySoorar.onTimeDesc}</p>
                    </div>
                    <div className="p-5 rounded-[14px] bg-[#F2F5FA]">
                      <h3 className="font-bold text-base text-[#0B1F3A]">{t.whySoorar.honestyTitle}</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{t.whySoorar.honestyDesc}</p>
                    </div>
                    <div className="p-5 rounded-[14px] bg-[#F2F5FA]">
                      <h3 className="font-bold text-base text-[#0B1F3A]">{t.whySoorar.expertiseTitle}</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{t.whySoorar.expertiseDesc}</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="h-full rounded-[20px] overflow-hidden border border-slate-200">
                    <ResilientImage
                      src={FLEET_IMG}
                      alt="SOORAR uniformed blue moving crew and enclosed box trucks in Mogadishu"
                      className="w-full h-full min-h-[340px] object-cover"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* CUSTOMER REVIEWS PREVIEW */}
            <section className="bg-[#0B1F3A] text-white py-16 md:py-20 px-4 sm:px-8">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold">
                      {lang === 'so' ? 'Maxay Macaamiishu Ka Yiraahdeen SOORAR?' : 'What Mogadishu Families & Businesses Say'}
                    </h2>
                    <p className="text-white/75 text-sm mt-1">
                      {lang === 'so'
                        ? 'Faallooyin dhab ah oo ka yimid qoysaska iyo xafiisyada aan rarnay.'
                        : 'Verified testimonials from residential and corporate moves across Mogadishu.'}
                    </p>
                  </div>
                  <button
                    onClick={() => navigateTo('reviews')}
                    className="text-xs font-semibold text-[#F1980A] hover:underline cursor-pointer"
                  >
                    {lang === 'so' ? 'Arag Dhammaan ama Qor Faallo →' : 'Read All or Leave a Review →'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {siteData.reviews.slice(0, 4).map((rev: any) => (
                    <div
                      key={rev.id}
                      className="bg-white/5 border border-white/10 rounded-[14px] p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1 text-[#F1980A] mb-3">
                          {Array.from({ length: rev.rating || 5 }).map((_, idx) => (
                            <Star key={idx} className="w-4 h-4 fill-[#F1980A]" />
                          ))}
                        </div>
                        <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                          &ldquo;{lang === 'so' ? rev.commentSo : rev.commentEn}&rdquo;
                        </p>
                      </div>
                      <div className="mt-5 pt-3 border-t border-white/10 text-xs">
                        <div className="font-bold text-white">{rev.customerName}</div>
                        <div className="text-white/60 mt-0.5">
                          {rev.district} · {rev.serviceType}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* PHOTO GALLERY PREVIEW */}
            <section className="py-16 px-4 sm:px-8 max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-[#0B1F3A]">
                  {lang === 'so' ? 'Sawirrada Shaqadayada Muqdisho' : 'Recent Moves Across Mogadishu'}
                </h2>
                <button
                  onClick={() => navigateTo('gallery')}
                  className="text-xs font-semibold text-[#00529E] hover:underline cursor-pointer"
                >
                  {lang === 'so' ? 'Arag Sawirrada Oo Dhan →' : 'Explore Full Gallery →'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[HOME_IMG, OFFICE_IMG, PACKING_IMG, FLEET_IMG].map((img, i) => (
                  <div key={i} className="rounded-[14px] overflow-hidden border border-slate-200 h-56">
                    <ResilientImage
                      src={img}
                      alt="SOORAR Moving Crew in Mogadishu"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* FINAL CALL-TO-ACTION BAND */}
            <section className="bg-[#00529E] text-white py-14 px-4 sm:px-8">
              <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold">
                    {lang === 'so' ? 'Guri cusub? Annaga noo daa!' : 'Ready for a Smooth, Stress-Free Move?'}
                  </h2>
                  <p className="text-white/85 text-sm mt-1">
                    {lang === 'so'
                      ? 'Weydiiso qiimo bilaash ah ama nagala soo hadal WhatsApp hadda.'
                      : 'Request your free no-obligation quote or message our dispatch team on WhatsApp.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
                  <button
                    onClick={() => navigateTo('booking')}
                    className="px-6 py-3.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white font-semibold text-sm cursor-pointer"
                  >
                    {t.hero.ctaQuote}
                  </button>
                  <a
                    href={buildWhatsAppUrl(whatsappDigits, 'Asc SOORAR, waxaan rabaa rar.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsAppClick('bottom_cta_whatsapp')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp {whatsappPhoneDisplay}
                  </a>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 2: SERVICES                           */}
        {/* ========================================== */}
        {page === 'services' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 space-y-12">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-bold text-[#0B1F3A]">
                {lang === 'so' ? 'Adeegyada SOORAR ee Muqdisho' : 'Professional Moving & Packing Services'}
              </h1>
              <p className="text-slate-600 mt-2 text-sm sm:text-base">
                {t.brand.tagline} — {t.brand.noHiddenFees}
              </p>
            </div>

            <div className="space-y-8">
              {siteData.services.map((srv: any, index: number) => {
                const includedList: string[] = lang === 'so' ? srv.includedSo || [] : srv.includedEn || [];
                return (
                  <div
                    key={srv.id}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white rounded-[20px] border border-slate-200 p-6 md:p-8"
                  >
                    <div className="lg:col-span-5 rounded-[14px] overflow-hidden border border-slate-100 min-h-[240px]">
                      <ResilientImage
                        src={srv.imageUrl || HOME_IMG}
                        alt={lang === 'so' ? srv.titleSo : srv.titleEn}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="text-xs font-mono-tabular font-bold text-[#00529E]">
                          0{index + 1} · {lang === 'so' ? srv.priceLabelSo : srv.priceLabelEn}
                        </div>
                        <h2 className="text-2xl font-bold text-[#0B1F3A] mt-1">
                          {lang === 'so' ? srv.titleSo : srv.titleEn}
                        </h2>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                          {lang === 'so' ? srv.descSo : srv.descEn}
                        </p>

                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-bold text-[#0B1F3A]">
                            {lang === 'so' ? 'Waxaa ku jira adeeggan:' : 'What is included:'}
                          </div>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {includedList.map((inc, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{inc}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigateTo('booking', srv.slug.split('-')[0])}
                          className="px-6 py-2.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                        >
                          {lang === 'so' ? 'Ballanso Adeeggan' : 'Book This Service'}
                        </button>
                        <a
                          href={buildWhatsAppUrl(
                            whatsappDigits,
                            `Asc SOORAR, waxaan rabaa adeegga: ${lang === 'so' ? srv.titleSo : srv.titleEn}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackWhatsAppClick(`service_card_${srv.slug}`)}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#F2F5FA] hover:bg-slate-200 text-[#0B1F3A] text-xs font-semibold"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 3: PRICING & INTERACTIVE ESTIMATOR    */}
        {/* ========================================== */}
        {page === 'pricing' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 space-y-14">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-bold text-[#0B1F3A]">{t.pricing.title}</h1>
              <p className="text-slate-600 mt-2 text-sm sm:text-base">{t.pricing.subtitle}</p>
            </div>

            {/* 4 Package Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: t.pricing.pkgSmall, price: t.pricing.pkgSmallPrice, desc: t.pricing.pkgSmallDesc, crew: '2 Movers + Small Truck' },
                { name: t.pricing.pkgMedium, price: t.pricing.pkgMediumPrice, desc: t.pricing.pkgMediumDesc, crew: '4 Movers + 3.5T Box Truck' },
                { name: t.pricing.pkgLarge, price: t.pricing.pkgLargePrice, desc: t.pricing.pkgLargeDesc, crew: '6 Movers + 5T Villa Truck' },
                { name: t.pricing.pkgOffice, price: t.pricing.pkgOfficePrice, desc: t.pricing.pkgOfficeDesc, crew: 'Supervisor + Custom Fleet' },
              ].map((pkg, idx) => (
                <div
                  key={idx}
                  className="rounded-[20px] border border-slate-200 bg-white p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#00529E]">{pkg.crew}</div>
                    <h3 className="text-lg font-bold text-[#0B1F3A] mt-1">{pkg.name}</h3>
                    <div className="text-2xl font-bold font-mono-tabular text-[#F1980A] mt-3">
                      {pkg.price}
                    </div>
                    <p className="text-xs text-slate-600 mt-3 leading-relaxed">{pkg.desc}</p>
                  </div>
                  <button
                    onClick={() => navigateTo('booking')}
                    className="mt-6 w-full py-2.5 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white text-xs font-semibold cursor-pointer"
                  >
                    {t.nav.bookNow}
                  </button>
                </div>
              ))}
            </div>

            {/* Instant quote (admin-set pricing rules; every request becomes a CRM lead) */}
            <InstantQuote lang={lang} settings={sMap} whatsappDigits={whatsappDigits} whatsappLabel={t.pricing.sendEstimateWhatsapp} />
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 4: ABOUT SOORAR (COMPANY PROFILE 2026)*/}
        {/* ========================================== */}
        {page === 'about' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 space-y-16">
            {/* 01: Message from Management (Omar Ali Jama) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#F1980A]">
                  {lang === 'so' ? '01 · FARIINTA MAAMULKA' : '01 · MESSAGE FROM MANAGEMENT'}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#0B1F3A]">
                  {lang === 'so' ? 'Ku soo dhawoow SOORAR' : 'Welcome to SOORAR'}
                </h1>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                  {lang === 'so'
                    ? 'Guri ama xafiis cusub u guurid waa bilow cusub, laakiin badanaa waa culays: alaab badan, waqti yar, iyo walaac ah in wax jabaan ama lumaan. SOORAR waxaa loo aasaasay si aan culayskaas uga qaadno qoysaska iyo ganacsiyada Muqdisho.'
                    : 'Moving to a new home or office is a fresh start, but it is often a burden: lots of belongings, little time, and the worry that something will break or go missing. SOORAR was founded to lift that burden from the families and businesses of Mogadishu.'}
                </p>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                  {lang === 'so'
                    ? 'Magacayagu wuxuu ka yimid erayga "soo rar": na soo wac, annaga ayaa ku rarnaa. Kooxdeenu waxay alaabtaada u qabataa sidii ay tooda u qabanlahayeen, waxay timaadaa waqtiga la isku ogaaday, qiimuhuna waa mid cad oo aan lacag qarsoon lahayn.'
                    : 'Our name comes from the Somali "soo rar": call us and we move it. Our crew handles your belongings as if they were their own, arrives at the agreed time, and our prices are clear with no hidden fees.'}
                </p>
                <div className="pt-2 border-l-4 border-[#F1980A] pl-4">
                  <div className="font-bold text-base text-[#0B1F3A]">Omar Ali Jama</div>
                  <div className="text-xs text-slate-500">
                    {lang === 'so' ? 'Maamulaha, SOORAR' : 'Managing Director, SOORAR'}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 rounded-[20px] overflow-hidden border border-slate-200">
                <ResilientImage
                  src={FLEET_IMG}
                  alt="SOORAR Moving Team and Trucks in Mogadishu"
                  className="w-full h-96 object-cover"
                />
              </div>
            </div>

            {/* 03: Mission, Vision & 4 Core Values */}
            <div className="bg-[#0B1F3A] text-white rounded-[20px] p-8 sm:p-12 space-y-8">
              <div className="text-xs font-bold uppercase tracking-wider text-[#F1980A]">
                {lang === 'so'
                  ? '03 · HADAFKA, ARAGTIDA IYO QIYAMKA'
                  : '03 · MISSION, VISION AND VALUES'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#00529E] p-6 rounded-[14px] space-y-2">
                  <div className="text-xs font-bold uppercase text-[#F1980A]">
                    {lang === 'so' ? 'HADAFKA (MISSION)' : 'MISSION'}
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed">
                    {lang === 'so'
                      ? 'Inaan qoys kasta iyo ganacsi kasta oo Muqdisho ah u fududeyno guuritaanka, annagoo alaabtooda si ammaan ah, waqtigeeda, qiimo cadna ugu gaarsiinayna goobta cusub.'
                      : 'To make moving easy for every family and business in Mogadishu, delivering their belongings safely, on time and at a clear price.'}
                  </p>
                </div>
                <div className="bg-white/10 p-6 rounded-[14px] space-y-2 border border-white/10">
                  <div className="text-xs font-bold uppercase text-[#F1980A]">
                    {lang === 'so' ? 'ARAGTIDA (VISION)' : 'VISION'}
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed">
                    {lang === 'so'
                      ? 'Inaan noqonno shirkadda rarka ee ugu horreysa uguna kalsoonida badan Muqdisho, magac lagu garto ammaan iyo xirfad.'
                      : "To be Mogadishu's leading and most trusted moving company, a name known for safety and professionalism."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {[
                  {
                    num: '01',
                    titleSo: 'Ammaan',
                    titleEn: 'Safety',
                    descSo: 'Alaab kasta waa la duubaa, la calaameeyaa, si taxaddar leh ayaana loo qaadaa.',
                    descEn: 'Every item is wrapped, labelled and carried with care.',
                  },
                  {
                    num: '02',
                    titleSo: 'Waqti',
                    titleEn: 'Punctuality',
                    descSo: 'Waxaan nimaadnaa saacadda la isku ogaaday, shaqadana waxaan dhammeynaa sidii la qorsheeyay.',
                    descEn: 'We arrive at the agreed time and finish the job as planned.',
                  },
                  {
                    num: '03',
                    titleSo: 'Daacadnimo',
                    titleEn: 'Honesty',
                    descSo: 'Qiimo cad oo hore loo sheegay, lacag qarsoon ma jirto.',
                    descEn: 'Clear prices agreed upfront, no hidden fees.',
                  },
                  {
                    num: '04',
                    titleSo: 'Xirfad',
                    titleEn: 'Professionalism',
                    descSo: 'Koox tababaran, labis rasmi ah, iyo qalab casri ah.',
                    descEn: 'A trained crew, official uniforms and modern equipment.',
                  },
                ].map((v) => (
                  <div key={v.num} className="bg-white/5 border border-white/10 p-5 rounded-[14px] space-y-1.5">
                    <div className="text-xs font-mono-tabular font-bold text-[#F1980A]">{v.num}</div>
                    <div className="font-bold text-base">{lang === 'so' ? v.titleSo : v.titleEn}</div>
                    <p className="text-xs text-white/75 leading-relaxed">
                      {lang === 'so' ? v.descSo : v.descEn}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 09: Who We Serve & Districts We Serve + 10: Quality Promise */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-6 bg-[#F2F5FA] p-6 sm:p-8 rounded-[20px] space-y-4">
                <div className="text-xs font-bold uppercase text-[#F1980A]">
                  {lang === 'so' ? '09 · CIDDA AAN U ADEEGNO' : '09 · WHO WE SERVE'}
                </div>
                <h2 className="text-2xl font-bold text-[#0B1F3A]">
                  {lang === 'so' ? 'Qoysas iyo Ganacsiyo' : 'Families and Businesses'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-white p-4 rounded-[12px] border border-slate-200 space-y-1">
                    <div className="font-bold text-sm text-[#0B1F3A]">
                      {lang === 'so' ? 'Qoysaska (Families)' : 'Families'}
                    </div>
                    <p className="text-slate-600">
                      {lang === 'so'
                        ? 'Guryo, aqallo iyo villooyin. Guuritaan degan, carruurta iyo waalidiinta oo aan walaacin.'
                        : 'Apartments, houses and villas. A calm move, with no stress for children or parents.'}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-[12px] border border-slate-200 space-y-1">
                    <div className="font-bold text-sm text-[#0B1F3A]">
                      {lang === 'so' ? 'Ganacsiyada (Businesses)' : 'Businesses'}
                    </div>
                    <p className="text-slate-600">
                      {lang === 'so'
                        ? 'Xafiisyo, dukaamo iyo bakhaarro. Rar aan joojinayn shaqada maalinlaha ah.'
                        : "Offices, shops and warehouses. Moves that don't stop daily operations."}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-[12px] border border-slate-200 space-y-1">
                    <div className="font-bold text-sm text-[#0B1F3A]">
                      {lang === 'so' ? "Hay'adaha (Organisations)" : 'Organisations'}
                    </div>
                    <p className="text-slate-600">
                      {lang === 'so'
                        ? "NGO-yada, hay'adaha dowladda iyo kuwa caalamiga ah. Habraac nidaamsan iyo dukumiinti buuxa."
                        : 'NGOs, government and international agencies. Organised procedures and full documentation.'}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-[12px] border border-slate-200 space-y-1">
                    <div className="font-bold text-sm text-[#0B1F3A]">
                      {lang === 'so' ? 'Hoteelada & Dugsiyada' : 'Hotels and Schools'}
                    </div>
                    <p className="text-slate-600">
                      {lang === 'so'
                        ? 'Alaab badan, waqti cayiman. Qorshe gaar ah iyo koox ballaaran.'
                        : 'Lots of items, fixed deadlines. A dedicated plan and a larger crew.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 bg-[#00529E] text-white p-6 sm:p-8 rounded-[20px] space-y-4">
                <div className="text-xs font-bold uppercase text-[#F1980A]">
                  {lang === 'so' ? '10 · BALLANQAADKA TAYADA' : '10 · QUALITY PROMISE'}
                </div>
                <h2 className="text-2xl font-bold">
                  {lang === 'so' ? 'Ballanqaadkeena' : 'Our Promise'}
                </h2>
                <ul className="space-y-2.5 text-xs sm:text-sm">
                  {[
                    lang === 'so'
                      ? 'Liis alaabeed (inventory) ayaa la sameeyaa ka hor iyo kadib rarka'
                      : 'An inventory list is made before and after the move',
                    lang === 'so'
                      ? 'Alaabta jilicsan waxaa lagu duubaa buste iyo kartoon adag'
                      : 'Fragile items are wrapped in blankets and strong boxes',
                    lang === 'so'
                      ? 'Kartoon kasta waxaa lagu calaameeyaa qolka uu u socdo'
                      : 'Every box is labelled with its destination room',
                    lang === 'so'
                      ? 'Heshiis adeeg oo qoran iyo rasiid rasmi ah'
                      : 'A written service agreement and official receipt',
                    lang === 'so'
                      ? 'Macmiilka ayaa saxiixa dhammaystirka shaqada'
                      : 'The customer signs off on job completion',
                    lang === 'so'
                      ? 'Wixii dhibaato ah waxaa lagu xalliyaa si degdeg ah oo daacad ah'
                      : 'Any issue is resolved quickly and honestly',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#F1980A] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 5: FILTERABLE GALLERY                 */}
        {/* ========================================== */}
        {page === 'gallery' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#0B1F3A]">
                  {lang === 'so' ? 'Sawirrada Shaqadayada (Gallery)' : 'SOORAR Photo Gallery'}
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  {lang === 'so'
                    ? 'Guryaha, xafiisyada, xirxiridda iyo gaadiidka SOORAR ee Muqdisho.'
                    : 'Real moves across homes, offices, packing, and our enclosed truck fleet.'}
                </p>
              </div>

              {/* Interactive Filter Controls */}
              <div className="flex items-center gap-1 p-1 bg-[#F2F5FA] rounded-lg">
                {(['all', 'homes', 'offices', 'packing', 'trucks'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setGalleryFilter(cat)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors cursor-pointer ${
                      galleryFilter === cat ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {siteData.gallery
                .filter((g: any) => galleryFilter === 'all' || g.category === galleryFilter)
                .map((g: any) => (
                  <div
                    key={g.id}
                    className="rounded-[14px] overflow-hidden border border-slate-200 bg-white"
                  >
                    <div className="h-60 overflow-hidden">
                      <ResilientImage
                        src={g.imageUrl}
                        alt={lang === 'so' ? g.titleSo : g.titleEn}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="font-bold text-sm text-[#0B1F3A]">
                        {lang === 'so' ? g.titleSo : g.titleEn}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {g.district} · {g.category}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 6: REVIEWS & SUBMIT REVIEW            */}
        {/* ========================================== */}
        {page === 'reviews' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-4">
              <h1 className="text-3xl font-bold text-[#0B1F3A]">
                {lang === 'so' ? 'Faallooyinka Macaamiisha' : 'Customer Testimonials'}
              </h1>
              <div className="space-y-4">
                {siteData.reviews.map((rev: any) => (
                  <div key={rev.id} className="p-6 rounded-[14px] border border-slate-200 bg-white">
                    <div className="flex items-center gap-1 text-[#F1980A] mb-2">
                      {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-[#F1980A]" />
                      ))}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      &ldquo;{lang === 'so' ? rev.commentSo : rev.commentEn}&rdquo;
                    </p>
                    <div className="text-xs text-slate-500 mt-3 font-semibold">
                      {rev.customerName} · {rev.district} · {rev.serviceType}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!revName || !revComment) return;
                  await fetch('/api/public/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      customerName: revName,
                      district: revDistrict,
                      rating: revRating,
                      comment: revComment,
                    }),
                  });
                  setRevSubmitted(true);
                  setRevName('');
                  setRevComment('');
                }}
                className="bg-[#F2F5FA] p-6 rounded-[20px] border border-slate-200 space-y-4"
              >
                <h2 className="text-lg font-bold text-[#0B1F3A]">
                  {lang === 'so' ? 'Noo Qor Faallo Cusub' : 'Leave a Review'}
                </h2>
                {revSubmitted && (
                  <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold">
                    {lang === 'so'
                      ? 'Mahadsanid! Faalladaada waa la gudbiyay si maamulku u ansixiyo.'
                      : 'Thank you! Your review has been submitted for admin moderation.'}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.booking.nameLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={revName}
                    onChange={(e) => setRevName(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.booking.district}
                    </label>
                    <select
                      value={revDistrict}
                      onChange={(e) => setRevDistrict(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs"
                    >
                      {MOGADISHU_DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rating (1–5 ★)
                    </label>
                    <select
                      value={revRating}
                      onChange={(e) => setRevRating(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs"
                    >
                      <option value={5}>5 ★★★★★</option>
                      <option value={4}>4 ★★★★</option>
                      <option value={3}>3 ★★★</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'so' ? 'Faalladaada *' : 'Your Experience *'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={revComment}
                    onChange={(e) => setRevComment(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-full bg-[#00529E] text-white text-xs font-semibold cursor-pointer"
                >
                  {lang === 'so' ? 'Gudbi Faallada' : 'Submit Review'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 7: FAQ ACCORDION                      */}
        {/* ========================================== */}
        {page === 'faq' && (
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14 space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-[#0B1F3A]">
                {lang === 'so' ? "Su'aalaha Inta Badan La Isweydiiyo (FAQ)" : 'Frequently Asked Questions'}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {lang === 'so'
                  ? 'Qiimaha, habka lacag bixinta (EVC Plus / Zaad), damaanadda iyo degmooyinka Muqdisho.'
                  : 'Answers about pricing, EVC Plus / Zaad payments, damage protection, and Mogadishu coverage.'}
              </p>
            </div>

            <div className="space-y-3">
              {siteData.faqs.map((f: any, idx: number) => {
                const isOpen = openFaqId === idx;
                return (
                  <div key={f.id} className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? null : idx)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-[#0B1F3A] cursor-pointer"
                    >
                      <span>{lang === 'so' ? f.questionSo : f.questionEn}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-[#00529E] transition-transform shrink-0 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                        {lang === 'so' ? f.answerSo : f.answerEn}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 8: CONTACT & EMBEDDED MOGADISHU MAP   */}
        {/* ========================================== */}
        {page === 'contact' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-6 space-y-6">
              <h1 className="text-3xl font-bold text-[#0B1F3A]">
                {lang === 'so' ? 'Nala Soo Xiriir' : 'Contact SOORAR Mogadishu'}
              </h1>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-[#F1980A] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">WhatsApp & Telefoon</div>
                    <div className="font-mono-tabular text-slate-600">{whatsappPhoneDisplay}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#00529E] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Xafiiska Muqdisho</div>
                    <div className="text-slate-600">{officeAddress}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#00529E] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Saacadaha Shaqada</div>
                    <div className="text-slate-600">
                      {lang === 'so' ? sMap.working_hours_so : sMap.working_hours_en}
                    </div>
                  </div>
                </div>
              </div>

              {/* Embedded Map of Mogadishu */}
              <div className="rounded-[14px] overflow-hidden border border-slate-200 h-64">
                <iframe
                  title="SOORAR Mogadishu Office Map"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=45.2800%2C2.0150%2C45.3600%2C2.0650&layer=mapnik"
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="lg:col-span-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await fetch('/api/public/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: contactName,
                      phone: contactPhone,
                      message: contactMsg,
                    }),
                  });
                  setContactSent(true);
                  setContactName('');
                  setContactMsg('');
                }}
                className="bg-[#F2F5FA] p-6 md:p-8 rounded-[20px] border border-slate-200 space-y-4"
              >
                <h2 className="text-xl font-bold text-[#0B1F3A]">
                  {lang === 'so' ? 'Noo Soo Dir Farriin' : 'Send Us a Direct Message'}
                </h2>
                {contactSent && (
                  <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold">
                    {lang === 'so' ? 'Farriintaadii waa la diray!' : 'Your message has been received!'}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.booking.nameLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.booking.phoneLabel} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.booking.notesLabel} *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={contactMsg}
                    onChange={(e) => setContactMsg(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white font-semibold text-sm cursor-pointer"
                >
                  {lang === 'so' ? 'Dir Farriinta' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 9: BOOKING / GET A QUOTE              */}
        {/* ========================================== */}
        {page === 'booking' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
            <div className="max-w-3xl mx-auto mb-8">
              <h1 className="text-3xl font-bold text-[#0B1F3A]">{t.booking.title}</h1>
              <p className="text-slate-600 text-sm mt-1">{t.booking.subtitle}</p>
            </div>
            <BookingFlowView
              lang={lang}
              t={t}
              preselectedService={preselectedService}
              whatsappLinkDigits={whatsappDigits}
              onBookingCreated={loadPublicData}
            />
          </div>
        )}

        {/* ========================================== */}
        {/* PAGE 9B: UNIFIED LOGIN / REGISTER & PORTAL */}
        {/* ========================================== */}
        {page === 'customer_portal' && (
          <CustomerPortalView
            lang={lang}
            whatsappDigits={whatsappDigits}
            onGoToBooking={() => navigateTo('booking')}
            onRouteToStaffErp={() => navigateTo('admin')}
            siteSettings={sMap}
            companyAddress={officeAddress}
            companyPhone={whatsappPhoneDisplay}
            companyEmail={officeEmail}
          />
        )}

        {/* ========================================== */}
        {/* PAGE 10: LEGAL (PRIVACY & TERMS)           */}
        {/* ========================================== */}
        {(page === 'privacy' || page === 'terms') && (
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14 space-y-4">
            <h1 className="text-3xl font-bold text-[#0B1F3A]">
              {page === 'privacy' ? t.footer.privacy : t.footer.terms}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              SOORAR Moving Services Mogadishu (&ldquo;SOORAR&rdquo;) respects your privacy and handles all personal contact details, addresses, and inventory checklists strictly for fulfilling residential and commercial relocations across Mogadishu, Somalia.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              All moves include signed pickup and delivery inventory verification. Payments via EVC Plus, Zaad, eDahab, USD Cash, or Bank Transfer are issued an official SOORAR receipt.
            </p>
          </div>
        )}
      </main>

      {/* FLOATING WHATSAPP BUTTON ON EVERY PUBLIC PAGE */}
      <a
        href={buildWhatsAppUrl(
          whatsappDigits,
          lang === 'so'
            ? 'Asc SOORAR, waxaan u baahanahay caawinaad dhanka raridda ah.'
            : 'Hello SOORAR, I need help with a move in Mogadishu.'
        )}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick('floating_whatsapp_button')}
        aria-label="Chat on WhatsApp"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg font-semibold text-xs sm:text-sm transition-transform hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>

      {/* NAVY FOOTER WITH BLUE-ORANGE SIGNATURE STRIPE */}
      <footer className="bg-[#0B1F3A] text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          <div className="space-y-3">
            <SoorarLogo variant="white" />
            <p className="text-white/80 font-medium">{t.brand.tagline}</p>
            <p className="text-white/60">{t.brand.secondary1}</p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-sm text-white mb-2">{t.nav.services}</div>
            {siteData.services.map((s: any) => (
              <button
                key={s.id}
                onClick={() => navigateTo('services')}
                className="block text-white/75 hover:text-white cursor-pointer text-left"
              >
                {lang === 'so' ? s.titleSo : s.titleEn}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="font-bold text-sm text-white mb-2">{t.nav.contact}</div>
            <div className="text-white/80 font-mono-tabular">Tel / WhatsApp: {whatsappPhoneDisplay}</div>
            <div className="text-white/75">{officeAddress}</div>
            <div className="text-white/75">{officeEmail}</div>
            <div className="text-white/60 pt-1">
              {lang === 'so'
                ? 'Sabti ilaa Khamiis, 7:00 – 18:00'
                : 'Saturday to Thursday, 7:00 to 18:00'}
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-sm text-white mb-2">Social & Legal</div>
            <div className="flex items-center gap-3 text-white/80">
              <a href="#facebook" onClick={(e) => { e.preventDefault(); navigateTo('contact'); }} className="hover:text-[#F1980A]">Facebook</a>
              <span>·</span>
              <a href="#tiktok" onClick={(e) => { e.preventDefault(); navigateTo('contact'); }} className="hover:text-[#F1980A]">TikTok</a>
              <span>·</span>
              <a href="#instagram" onClick={(e) => { e.preventDefault(); navigateTo('contact'); }} className="hover:text-[#F1980A]">Instagram</a>
            </div>
            <div className="pt-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80 pb-1">
                <button onClick={() => navigateTo('gallery')} className="hover:text-[#F1980A] cursor-pointer">{t.nav.gallery}</button>
                <span className="text-white/30">·</span>
                <button onClick={() => navigateTo('reviews')} className="hover:text-[#F1980A] cursor-pointer">{t.nav.reviews}</button>
                <span className="text-white/30">·</span>
                <button onClick={() => navigateTo('faq')} className="hover:text-[#F1980A] cursor-pointer">{t.nav.faq}</button>
              </div>
              <button onClick={() => navigateTo('privacy')} className="block text-white/60 hover:text-white cursor-pointer">
                {t.footer.privacy}
              </button>
              <button onClick={() => navigateTo('terms')} className="block text-white/60 hover:text-white cursor-pointer">
                {t.footer.terms}
              </button>
              <button onClick={() => navigateTo('customer_portal')} className="block text-[#F1980A] hover:underline font-semibold cursor-pointer pt-1">
                {lang === 'so' ? 'Login / Register' : 'Login / Register'}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-4 sm:px-8 py-4 text-center text-xs text-white/60">
          © {new Date().getFullYear()} SOORAR. {t.footer.rights}
        </div>

        {/* Blue-Orange Signature Brand Stripe */}
        <div className="h-2.5 w-full flex">
          <div className="w-3/4 bg-[#00529E]" />
          <div className="w-1/4 bg-[#F1980A]" />
        </div>
      </footer>
    </div>
  );
}
