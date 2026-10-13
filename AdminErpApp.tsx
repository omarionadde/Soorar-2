import React, { useState, useEffect, useCallback } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { PrintableDocumentModal, PrintableDocData } from './PrintableDocumentModal.tsx';
import { buildWhatsAppUrl, trackWhatsAppClick, MOGADISHU_DISTRICTS } from '../constants/mogadishu.ts';
import { ErpDashboard, StatusBadge } from './ErpDashboard.tsx';
import { CustomersModule } from './CustomersModule.tsx';
import { ReportsModule } from './ReportsModule.tsx';
import { DocumentsHub } from './DocumentsHub.tsx';
import { CrewJobsView } from './erp/CrewJobsView.tsx';
import { DispatchCalendar } from './erp/DispatchCalendar.tsx';
import { PayrollModule } from './erp/PayrollModule.tsx';
import { PaymentReview } from './erp/PaymentReview.tsx';
import { SuppliersManager } from './erp/SuppliersManager.tsx';
import { ReferralsModule } from './erp/ReferralsModule.tsx';
import { ProfitReports } from './erp/ProfitReports.tsx';
import { SettingsExtras } from './erp/SettingsExtras.tsx';
import { GalleryManager } from './erp/GalleryManager.tsx';
import { BookingExtras } from './erp/BookingExtras.tsx';
import { PhotoStrip } from './erp/PhotoStrip.tsx';
import { ChangePasswordModal } from './erp/ChangePasswordModal.tsx';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  CreditCard,
  UserCheck,
  Truck,
  ClipboardCheck,
  Receipt,
  BarChart3,
  FileEdit,
  Settings,
  LogOut,
  MessageCircle,
  Printer,
  Plus,
  Search,
  CheckCircle2,
  ArrowLeft,
  Download,
  Shield,
  Navigation,
  MapPin,
  Radio,
  Package,
  Warehouse,
  ShoppingCart,
  AlertTriangle,
  BookOpen,
  Briefcase,
  Calculator,
  FolderKanban,
  ShieldCheck,
  TrendingUp,
  Menu,
  X,
  RefreshCw,
  Trash2,
  KeyRound,
  CalendarDays,
  Wallet,
  Gift,
  Smartphone,
  Camera,
} from 'lucide-react';

interface AdminErpAppProps {
  lang: 'so' | 'en';
  onExitAdmin: () => void;
  onRefreshPublic: () => void;
}

type ErpModule =
  | 'dashboard'
  | 'my_jobs'
  | 'dispatch'
  | 'payroll'
  | 'referrals'
  | 'crm_leads'
  | 'bookings'
  | 'survey_calculator'
  | 'customers'
  | 'quotes_invoices'
  | 'payments'
  | 'staff'
  | 'vehicles'
  | 'inventory'
  | 'packing_stock'
  | 'warehouse_storage'
  | 'suppliers_po'
  | 'damage_claims'
  | 'accounting_ledger'
  | 'expenses'
  | 'reports'
  | 'documents_hub'
  | 'cms'
  | 'settings';

const NOT_APPROVED_MSG = 'Akoonkaaga lama ogolaan. Admin-ka SOORAR ha kuu fasaxo.';

export const AdminErpApp: React.FC<AdminErpAppProps> = ({ lang, onExitAdmin, onRefreshPublic }) => {
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [staffSession, setStaffSession] = useState<{ token: string; user: any } | null>(() => {
    try {
      const saved = localStorage.getItem('soorar_staff_session') || sessionStorage.getItem('soorar_staff_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [staffLoginEmail, setStaffLoginEmail] = useState('');
  const [staffLoginPassword, setStaffLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'error' } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [userTempPw, setUserTempPw] = useState<{ who: string; pw: string } | null>(null);
  const [claimPhotosOpen, setClaimPhotosOpen] = useState<number | null>(null);
  const crewDefaultApplied = React.useRef(false);

  // Admin Create New User (Staff/Manager/Accountant) state
  const [createUserName, setCreateUserName] = useState('');
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserPhone, setCreateUserPhone] = useState('+252 61 ');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [createUserRole, setCreateUserRole] = useState<'Manager' | 'Staff' | 'Accountant' | 'Admin'>('Staff');

  const [erpData, setErpData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [activeModule, setActiveModule] = useState<ErpModule>('dashboard');
  const [activeRoleView, setActiveRoleView] = useState<string>('Admin');
  const [activeBranch, setActiveBranch] = useState<string>('All Branches (Mogadishu HQ + Hodan + Wadajir)');

  // Enterprise ERP Module States (Leads, Survey Calculator, Stock, Storage, Suppliers, Claims, Accounting)
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('+252 61 ');
  const [newLeadSource, setNewLeadSource] = useState('WhatsApp');
  const [newLeadDistrict, setNewLeadDistrict] = useState('Hodan');
  const [newLeadMoveType, setNewLeadMoveType] = useState('Home Moving');
  const [newLeadVol, setNewLeadVol] = useState('22');

  // Volume (m3) Surveyor Calculator State
  const [surveyRoomCounts, setSurveyRoomCounts] = useState<Record<string, number>>({
    'King Bed & Mattress (2.8 m³)': 2,
    '3-Door Turkish Wardrobe (3.2 m³)': 2,
    'L-Shape Living Room Sofa (3.5 m³)': 1,
    'Dining Table + 6 Chairs (2.4 m³)': 1,
    'Double-Door Refrigerator (1.4 m³)': 1,
    'Washing Machine / Cooker (0.9 m³)': 2,
    'Office Desk & Executive Chair (1.6 m³)': 0,
    'Heavy Iron Safe / Generator (1.8 m³)': 0,
    'Standard Moving Cartons (0.15 m³)': 20,
  });
  const [surveyDistanceKm, setSurveyDistanceKm] = useState(8);
  const [surveyFloorsNoLift, setSurveyFloorsNoLift] = useState(2);

  // Packing Stock Form State
  const [newMatNameEn, setNewMatNameEn] = useState('');
  const [newMatNameSo, setNewMatNameSo] = useState('');
  const [newMatCategory, setNewMatCategory] = useState('Boxes');
  const [newMatQty, setNewMatQty] = useState('100');
  const [newMatCost, setNewMatCost] = useState('1.80');

  // Storage Unit Form State
  const [newBayCode, setNewBayCode] = useState('BAY-A04');
  const [newBaySize, setNewBaySize] = useState('30');
  const [newBayRate, setNewBayRate] = useState('150');
  const [newBayCustomer, setNewBayCustomer] = useState('');
  const [newBayPhone, setNewBayPhone] = useState('+252 61 ');
  const [newBayItems, setNewBayItems] = useState('');

  // Purchase Order Form State
  const [poSupplier, setPoSupplier] = useState('Mogadishu Packaging & Cartons Co.');
  const [poItems, setPoItems] = useState('');
  const [poTotal, setPoTotal] = useState('');

  // Damage Claim Form State
  const [claimBookingRef, setClaimBookingRef] = useState('SR-2026-0001');
  const [claimCustomer, setClaimCustomer] = useState('');
  const [claimItem, setClaimItem] = useState('');
  const [claimDesc, setClaimDesc] = useState('');
  const [claimEstUsd, setClaimEstUsd] = useState('35');

  // Journal Entry Form State
  const [jeDesc, setJeDesc] = useState('');
  const [jeDebit, setJeDebit] = useState('1020 · EVC Plus / Mobile Money Wallet');
  const [jeCredit, setJeCredit] = useState('4010 · Home & Villa Moving Revenue');
  const [jeAmount, setJeAmount] = useState('');

  // Bookings state
  const [bookingSearch, setBookingSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [bookingViewMode, setBookingViewMode] = useState<'table' | 'calendar'>('table');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  // Printable document modal
  const [printDoc, setPrintDoc] = useState<PrintableDocData | null>(null);

  // Quote builder state
  const [quoteBookingId, setQuoteBookingId] = useState<string>('');
  const [quoteCustomerName, setQuoteCustomerName] = useState('');
  const [quoteCustomerPhone, setQuoteCustomerPhone] = useState('+252 ');
  const [quoteDiscount, setQuoteDiscount] = useState('0');
  const [quoteConvertImmediately, setQuoteConvertImmediately] = useState(true);
  const [quoteLines, setQuoteLines] = useState([
    { description: 'Gaari Xiran 5-Ton (Enclosed Moving Truck)', category: 'truck', qty: 1, unitPrice: 120, total: 120 },
    { description: 'Kooxda Raridda (Uniformed Moving Crew)', category: 'crew', qty: 4, unitPrice: 25, total: 100 },
    { description: 'Kartoonno & Duubista (Packing Materials)', category: 'packing', qty: 1, unitPrice: 45, total: 45 },
  ]);

  // Payment form state
  const [payInvoiceId, setPayInvoiceId] = useState<string>('');
  const [payCustomerName, setPayCustomerName] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('EVC Plus');
  const [payType, setPayType] = useState('Deposit');
  const [payRefCode, setPayRefCode] = useState('');

  // Inventory checklist form
  const [invBookingId, setInvBookingId] = useState<number>(1);
  const [newItemName, setNewItemName] = useState('');
  const [newBoxNumber, setNewBoxNumber] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newCondBefore, setNewCondBefore] = useState('Good - Wrapped');
  const [newCondAfter, setNewCondAfter] = useState('Good - Delivered');
  const [pickupSigInput, setPickupSigInput] = useState('');
  const [deliverySigInput, setDeliverySigInput] = useState('');

  // Staff / Vehicle / Expense quick forms + Full Edit/Delete & Staff Photo Upload
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('mover');
  const [newStaffPhone, setNewStaffPhone] = useState('+252 61 ');
  const [newStaffRate, setNewStaffRate] = useState('25');
  const [newStaffIdCard, setNewStaffIdCard] = useState('SO-MOG-');
  const [newStaffPhotoUrl, setNewStaffPhotoUrl] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);

  // Add / Edit Vehicle state
  const [newVehiclePlate, setNewVehiclePlate] = useState('MOG-');
  const [newVehicleName, setNewVehicleName] = useState('');
  const [newVehicleCapacity, setNewVehicleCapacity] = useState('5-Ton Enclosed Moving Truck (32 m³)');
  const [newVehicleDriver, setNewVehicleDriver] = useState('');
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);

  // Edit Lead state
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);

  const [newLogVehicleId, setNewLogVehicleId] = useState<number>(1);
  const [newLogType, setNewLogType] = useState('Fuel');
  const [newLogCost, setNewLogCost] = useState('');
  const [newLogDetails, setNewLogDetails] = useState('');

  const [expCategory, setExpCategory] = useState('Fuel');
  const [expDesc, setExpDesc] = useState('');
  const [expBookingId, setExpBookingId] = useState('');
  const [expAmount, setExpAmount] = useState('');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const getBearerToken = useCallback(async () => {
    if (staffSession?.token) return staffSession.token;
    if (fbUser) return await fbUser.getIdToken();
    return null;
  }, [fbUser, staffSession]);

  const fetchErpData = useCallback(async () => {
    const token = await getBearerToken();
    if (!token) return;
    setLoadingData(true);
    try {
      setLoadError('');
      const res = await fetch('/api/admin/erp-data', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        const body = await res.json().catch(() => ({}));
        await forceSignOut(res.status === 403 ? NOT_APPROVED_MSG : body.error || 'Session-kii wuu dhacay. Fadlan mar kale gal.');
        return;
      }
      if (!res.ok) throw new Error('Xogta lama soo saari karo. Fadlan isku day mar kale.');
      const data = await res.json();
      if (!data.currentUser || data.currentUser.status !== 'Active') {
        await forceSignOut(NOT_APPROVED_MSG);
        return;
      }
      setErpData(data);
      setSettingsForm(data.settings || {});
      setActiveRoleView(data.currentUser.role as any);
      if (!crewDefaultApplied.current) {
        crewDefaultApplied.current = true;
        if (['Driver', 'Mover / Helper', 'Crew Leader'].includes(data.currentUser.role)) setActiveModule('my_jobs');
      }
      if (data.bookings?.[0] && !selectedBooking) {
        setSelectedBooking(data.bookings[0]);
        setInvBookingId(data.bookings[0].id);
        setPickupSigInput(data.bookings[0].pickupSignature || '');
        setDeliverySigInput(data.bookings[0].deliverySignature || '');
      }
    } catch (e: any) {
      console.error(e);
      setLoadError(e?.message || 'Network error');
    } finally {
      setLoadingData(false);
    }
  }, [getBearerToken, selectedBooking, staffSession]);

  useEffect(() => {
    if (fbUser || staffSession) {
      fetchErpData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, staffSession]);

  // Any failed save/delete anywhere in the ERP shows a clear error toast instead of failing silently.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e?.reason?.message || String(e?.reason || 'Error');
      if (msg === NOT_APPROVED_MSG) return;
      showNotice(msg, 'error');
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      setAuthError(err?.message || 'Sign-in failed');
    }
  };

  const handleStaffCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoginBusy(true);
    try {
      const res = await fetch('/api/admin/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrPhone: staffLoginEmail,
          password: staffLoginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('soorar_staff_session', JSON.stringify(data));
      setStaffLoginPassword('');
      setStaffSession(data);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid credentials');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem('soorar_staff_session');
    sessionStorage.removeItem('soorar_staff_session');
    setStaffSession(null);
    setErpData(null);
    setLoadError('');
    await signOut(auth).catch(() => {});
  };

  // Rejected / suspended / expired: drop every session and show the reason on the login screen.
  const forceSignOut = async (message: string) => {
    await handleSignOut();
    setAuthError(message);
  };

  const authedFetch = async (url: string, options: RequestInit = {}) => {
    const token = await getBearerToken();
    if (!token) throw new Error('Not signed in');
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || data?.code === 'NOT_APPROVED') {
      await forceSignOut(res.status === 401 ? 'Session-kii wuu dhacay. Fadlan mar kale gal.' : NOT_APPROVED_MSG);
      throw new Error(NOT_APPROVED_MSG);
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const showNotice = (msg: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ msg, kind });
    window.clearTimeout((showNotice as any)._t);
    (showNotice as any)._t = window.setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3500);
  };

  const allBookings = erpData?.bookings || [];
  const allCustomers = erpData?.customers || [];
  const allQuotes = erpData?.quotes || [];
  const allInvoices = erpData?.invoices || [];
  const allPayments = erpData?.payments || [];
  const allStaff = erpData?.staff || [];
  const allVehicles = erpData?.vehicles || [];
  const allVehicleLogs = erpData?.vehicleLogs || [];
  const allBookingItems = erpData?.bookingItems || [];
  const allExpenses = erpData?.expenses || [];
  const allReviews = erpData?.reviews || [];
  const allServices = erpData?.services || [];
  const allFaqs = erpData?.faqs || [];
  const allGallery = erpData?.gallery || [];
  const allUsers = erpData?.users || [];
  const allLogs = erpData?.activityLog || [];
  const allLeads = erpData?.leads || [];
  const allPackingMaterials = erpData?.packingMaterials || [];
  const allStorageUnits = erpData?.storageUnits || [];
  const allSuppliers = erpData?.suppliers || [];
  const allPurchaseOrders = erpData?.purchaseOrders || [];
  const allDamageClaims = erpData?.damageClaims || [];
  const allLedgerAccounts = erpData?.ledgerAccounts || [];
  const allJournalEntries = erpData?.journalEntries || [];
  const sMap = erpData?.settings || {};

  // Surveyor Volume & Pricing Engine Calculation
  const itemUnitVolumes: Record<string, number> = {
    'King Bed & Mattress (2.8 m³)': 2.8,
    '3-Door Turkish Wardrobe (3.2 m³)': 3.2,
    'L-Shape Living Room Sofa (3.5 m³)': 3.5,
    'Dining Table + 6 Chairs (2.4 m³)': 2.4,
    'Double-Door Refrigerator (1.4 m³)': 1.4,
    'Washing Machine / Cooker (0.9 m³)': 0.9,
    'Office Desk & Executive Chair (1.6 m³)': 1.6,
    'Heavy Iron Safe / Generator (1.8 m³)': 1.8,
    'Standard Moving Cartons (0.15 m³)': 0.15,
  };
  const totalSurveyVolumeM3 = Object.entries(surveyRoomCounts).reduce(
    (sum, [k, qty]) => sum + (itemUnitVolumes[k] || 1) * Number(qty || 0),
    0
  );
  const recommendedTruck =
    totalSurveyVolumeM3 <= 12
      ? 'Small Van / Mini-Truck (Up to 12 m³)'
      : totalSurveyVolumeM3 <= 24
      ? '3.5-Ton Enclosed Box Truck (Up to 24 m³)'
      : totalSurveyVolumeM3 <= 38
      ? '5-Ton Villa Box Truck (Up to 38 m³)'
      : '10-Ton Heavy Commercial Truck (40+ m³)';
  const recommendedCrewCount = Math.max(2, Math.min(8, Math.ceil(totalSurveyVolumeM3 / 5.5)));
  const recommendedBoxesCount = Math.ceil(totalSurveyVolumeM3 * 1.4);
  const calculatedSurveyPriceUsd = Math.round(
    65 + totalSurveyVolumeM3 * 6.5 + surveyDistanceKm * 2.5 + surveyFloorsNoLift * 15
  );

  // Metrics Calculation
  const totalRevenue = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const totalExpenses = allExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const unpaidInvoices = allInvoices.filter((inv: any) => inv.status !== 'Paid');
  const unpaidTotal = unpaidInvoices.reduce((sum: number, inv: any) => sum + Number(inv.balanceDue || 0), 0);
  const newBookingsCount = allBookings.filter((b: any) => b.status === 'New').length;


  const currentUser = erpData?.currentUser;
  const isApproved = currentUser?.status === 'Active';
  const isAdmin = currentUser?.role === 'Admin';
  const displayName = currentUser?.name || currentUser?.email || '';
  const so = lang === 'so';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex flex-col items-center justify-center gap-4 p-6">
        <img src="/brand/soorar-logo.png" alt="SOORAR" className="h-14 w-auto" />
        <div className="w-8 h-8 rounded-full border-[3px] border-[#00529E]/20 border-t-[#00529E] animate-spin" />
      </div>
    );
  }

  if (!fbUser && !staffSession) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] lg:grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between bg-[#0B1F3A] text-white p-12 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1.5 flex"><span className="w-1/4 bg-[#F1980A]" /><span className="flex-1 bg-[#00529E]" /></div>
          <img src="/brand/soorar-logo-white.png" alt="SOORAR" className="h-16 w-auto self-start" />
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              {so ? 'Nidaamka maamulka SOORAR' : 'SOORAR operations system'}
            </h2>
            <p className="text-white/70 mt-3 max-w-md text-sm leading-relaxed">
              {so
                ? 'Ballamaha, qiimeynta, biilasha, lacagaha, shaqaalaha iyo gaadiidka — hal meel, si ammaan ah.'
                : 'Bookings, quotes, invoices, payments, staff and fleet — in one secure place.'}
            </p>
          </div>
          <p className="text-[#F1980A] italic font-semibold text-sm">Rarid xirfad leh, Muqdisho oo dhan.</p>
        </div>

        <div className="min-h-screen lg:min-h-0 flex flex-col justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-8">
              <img src="/brand/soorar-logo.png" alt="SOORAR" className="h-12 w-auto lg:hidden" />
              <button type="button" onClick={onExitAdmin} className="ml-auto text-sm font-medium text-slate-500 hover:text-[#00529E] inline-flex items-center gap-1.5 cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> {so ? 'Bogga hore' : 'Website'}
              </button>
            </div>

            <h1 className="text-2xl font-bold text-[#0B1F3A]">{so ? 'Gal akoonkaaga' : 'Sign in'}</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              {so
                ? 'Akoonnada shaqaalaha waxaa abuura Admin-ka SOORAR oo keliya.'
                : 'Staff accounts are created by the SOORAR admin only.'}
            </p>

            {authError && (
              <div role="alert" className="mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium flex gap-2.5">
                <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleStaffCredentialLogin} className="mt-6 space-y-4">
              <div>
                <label className="erp-label">{so ? 'Email ama taleefan' : 'Email or phone'}</label>
                <input type="text" required autoComplete="username" value={staffLoginEmail} onChange={(e) => setStaffLoginEmail(e.target.value)} placeholder="name@soorar.so" className="erp-input" />
              </div>
              <div>
                <label className="erp-label">Password</label>
                <input type="password" required autoComplete="current-password" value={staffLoginPassword} onChange={(e) => setStaffLoginPassword(e.target.value)} placeholder="••••••••" className="erp-input" />
              </div>
              <button type="submit" disabled={loginBusy} className="erp-btn erp-btn-primary w-full justify-center py-3 text-[15px]">
                {loginBusy ? (so ? 'Waa la hubinayaa…' : 'Checking…') : so ? 'Gal' : 'Sign in'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <span className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">{so ? 'AMA' : 'OR'}</span>
              <span className="flex-1 h-px bg-slate-200" />
            </div>

            <button type="button" onClick={handleGoogleSignIn} className="erp-btn erp-btn-ghost w-full justify-center py-3">
              <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              {so ? 'Ku gal Google (Admin)' : 'Sign in with Google (Admin)'}
            </button>
            <p className="text-xs text-slate-400 mt-3 text-center">
              {so
                ? 'Google waxaa loo oggol yahay oo keliya akoonnada uu Admin-ku ansixiyay.'
                : 'Google sign-in only works for accounts the admin has approved.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <img src="/brand/soorar-logo.png" alt="SOORAR" className="h-14 w-auto" />
        {loadError ? (
          <>
            <p className="text-sm text-rose-600 font-medium max-w-sm">{loadError}</p>
            <button type="button" onClick={() => fetchErpData()} className="erp-btn erp-btn-primary">{so ? 'Isku day mar kale' : 'Retry'}</button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full border-[3px] border-[#00529E]/20 border-t-[#00529E] animate-spin" />
            <p className="text-sm text-slate-500">{so ? 'Akoonka waa la hubinayaa…' : 'Verifying your account…'}</p>
          </>
        )}
        <button type="button" onClick={handleSignOut} className="text-xs text-slate-400 hover:text-rose-600 underline cursor-pointer">
          {so ? 'Ka bax' : 'Sign out'}
        </button>
      </div>
    );
  }
  // Role-based navigation items (Full 19-Module Enterprise Moving ERP)
  const allRoles = [
    'Admin',
    'Super Admin',
    'Manager',
    'Branch Manager',
    'Sales / Customer Service',
    'Surveyor',
    'Dispatcher',
    'Crew Leader',
    'Driver',
    'Mover / Helper',
    'Accountant',
    'Warehouse Keeper',
    'HR',
    'Staff',
  ];

  const navItems: Array<{ id: ErpModule; label: string; icon: any; roles: string[] }> = [
    { id: 'dashboard', label: '1. Executive Dashboard', icon: LayoutDashboard, roles: allRoles },
    { id: 'my_jobs', label: 'Shaqadayda Maanta', icon: Smartphone, roles: ['Crew Leader', 'Driver', 'Mover / Helper', 'Staff'] },
    { id: 'dispatch', label: 'Dispatch calendar', icon: CalendarDays, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Dispatcher', 'Crew Leader'] },
    { id: 'payroll', label: 'Payroll', icon: Wallet, roles: ['Admin', 'Super Admin', 'Manager', 'Accountant', 'HR'] },
    { id: 'referrals', label: 'Referrals', icon: Gift, roles: ['Admin', 'Super Admin', 'Manager', 'Sales / Customer Service', 'Accountant'] },
    { id: 'crm_leads', label: '2. CRM & Leads Pipeline', icon: Briefcase, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Sales / Customer Service', 'Surveyor'] },
    { id: 'bookings', label: '3. Dispatch & Job Orders', icon: Calendar, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Sales / Customer Service', 'Dispatcher', 'Crew Leader', 'Driver', 'Mover / Helper', 'Staff'] },
    { id: 'survey_calculator', label: '4. Survey & Volume (m³) Engine', icon: Calculator, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Surveyor', 'Sales / Customer Service'] },
    { id: 'quotes_invoices', label: '5. Quotes & Invoices', icon: FileText, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Sales / Customer Service', 'Accountant'] },
    { id: 'payments', label: '6. Payments (EVC/Zaad/eDahab)', icon: CreditCard, roles: ['Admin', 'Super Admin', 'Manager', 'Accountant'] },
    { id: 'staff', label: '7. Crew, HR & Driver Console', icon: UserCheck, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Dispatcher', 'Crew Leader', 'Driver', 'Mover / Helper', 'HR', 'Staff'] },
    { id: 'vehicles', label: '8. Fleet & Live GPS Radar', icon: Truck, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Dispatcher', 'Driver', 'Staff'] },
    { id: 'inventory', label: '9. Room Checklist & Sign-Off', icon: ClipboardCheck, roles: ['Admin', 'Super Admin', 'Manager', 'Surveyor', 'Crew Leader', 'Driver', 'Staff'] },
    { id: 'packing_stock', label: '10. Packing Materials Stock', icon: Package, roles: ['Admin', 'Super Admin', 'Manager', 'Warehouse Keeper', 'Dispatcher'] },
    { id: 'warehouse_storage', label: '11. Warehouse & Storage Bays', icon: Warehouse, roles: ['Admin', 'Super Admin', 'Manager', 'Warehouse Keeper', 'Accountant'] },
    { id: 'suppliers_po', label: '12. Suppliers & Purchase Orders', icon: ShoppingCart, roles: ['Admin', 'Super Admin', 'Manager', 'Warehouse Keeper', 'Accountant'] },
    { id: 'damage_claims', label: '13. Damage Claims & Quality', icon: AlertTriangle, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Crew Leader', 'Accountant'] },
    { id: 'accounting_ledger', label: '14. Accounting & General Ledger', icon: BookOpen, roles: ['Admin', 'Super Admin', 'Accountant'] },
    { id: 'expenses', label: '15. Job Costing & Expenses', icon: Receipt, roles: ['Admin', 'Super Admin', 'Manager', 'Accountant'] },
    { id: 'customers', label: '16. Customer Profiles (CRM)', icon: Users, roles: ['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Sales / Customer Service', 'Accountant'] },
    { id: 'documents_hub', label: '17. Official SOORAR Docs (15)', icon: FolderKanban, roles: allRoles },
    { id: 'reports', label: '18. Analytics & CSV/PDF Export', icon: BarChart3, roles: ['Admin', 'Super Admin', 'Manager', 'Accountant'] },
    { id: 'cms', label: '19. Website CMS & Reviews', icon: FileEdit, roles: ['Admin', 'Super Admin', 'Manager'] },
    { id: 'settings', label: '20. Settings, RBAC & Audit', icon: Settings, roles: ['Admin', 'Super Admin'] },
  ];

  const visibleNavItems = navItems.filter(
    (item) => item.roles.includes(activeRoleView) || activeRoleView === 'Admin' || activeRoleView === 'Super Admin'
  );

  // Filtered bookings
  const filteredBookings = allBookings.filter((b: any) => {
    const matchesSearch =
      b.referenceNumber.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.customerName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.customerPhone.toLowerCase().includes(bookingSearch.toLowerCase());
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    const matchesDistrict =
      districtFilter === 'All' || b.fromDistrict === districtFilter || b.toDistrict === districtFilter;
    return matchesSearch && matchesStatus && matchesDistrict;
  });

  // WhatsApp Template Builders for Booking Detail
  const getQuoteWhatsAppUrl = (b: any) => {
    const price = b.quotedAmount && Number(b.quotedAmount) > 0 ? b.quotedAmount : '180';
    const tpl =
      b.language === 'en'
        ? sMap.tpl_quote_en ||
          'Thank you. Your moving quote is $__, which includes the truck, professional crew, and protective wrapping.'
        : sMap.tpl_quote_so ||
          'Mahadsanid. Qiimaha rarkaagu waa $__, waxaa ku jira gaariga, shaqaalaha iyo duubista.';
    const msg = `Asc ${b.customerName} (${b.referenceNumber}) — ` + tpl.replace('__', String(price));
    return buildWhatsAppUrl(b.customerPhone, msg);
  };

  const getConfirmWhatsAppUrl = (b: any) => {
    const tpl =
      b.language === 'en'
        ? sMap.tpl_confirm_en ||
          'Your booking is confirmed for __ at __. Our crew supervisor will call you 30 minutes before arrival.'
        : sMap.tpl_confirm_so ||
          'Ballantaada waa la xaqiijiyay: __, saacadda __. Kooxdu waxay ku soo wacaysaa 30 daqiiqo ka hor.';
    const parts = tpl.split('__');
    const msg =
      parts.length >= 3
        ? `Asc ${b.customerName} (${b.referenceNumber}) — ${parts[0]}${b.preferredDate}${parts[1]}${b.preferredTime}${parts[2]}`
        : `Asc ${b.customerName}, Ballantaada waa la xaqiijiyay: ${b.preferredDate}, saacadda ${b.preferredTime}. Kooxdu waxay ku soo wacaysaa 30 daqiiqo ka hor.`;
    return buildWhatsAppUrl(b.customerPhone, msg);
  };

  const getThankYouWhatsAppUrl = (b: any) => {
    const tpl =
      b.language === 'en'
        ? sMap.tpl_thanks_en || 'Blessed new home! Please take a moment to leave us a short review.'
        : sMap.tpl_thanks_so || 'Guri cusub oo barakaysan! Fadlan noo qor faallo gaaban.';
    const msg = `Asc ${b.customerName} (${b.referenceNumber}) — ${tpl}`;
    return buildWhatsAppUrl(b.customerPhone, msg);
  };

  // ---- Branded document builders (real data from the linked booking / invoice) ----
  const allInvoiceItems = erpData?.invoiceItems || [];
  const isoDay = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const bookingDocFields = (bookingId?: number | null) => {
    const bk = allBookings.find((x: any) => x.id === bookingId);
    if (!bk) return {};
    const veh = allVehicles.find((v: any) => v.id === bk.assignedVehicleId);
    const crew = (bk.assignedStaffIds || []).map((sid: number) => allStaff.find((m: any) => m.id === sid)?.name).filter(Boolean);
    return {
      bookingRef: bk.referenceNumber,
      fromDistrict: bk.fromDistrict,
      fromAddress: bk.fromAddress,
      fromFloor: bk.fromFloor,
      fromLift: bk.fromLift,
      toDistrict: bk.toDistrict,
      toAddress: bk.toAddress,
      toFloor: bk.toFloor,
      toLift: bk.toLift,
      moveDate: bk.preferredDate,
      moveTime: bk.preferredTime,
      servicesList: bk.services || [],
      vehiclePlate: veh?.plateNumber,
      vehicleName: veh?.name,
      crewNames: crew,
      pickupSignature: bk.pickupSignature,
      deliverySignature: bk.deliverySignature,
    };
  };
  const openQuoteDoc = (q: any) =>
    setPrintDoc({
      docType: 'QUOTE',
      docNumber: q.quoteNumber,
      date: isoDay(q.createdAt),
      customerName: q.customerName,
      customerPhone: q.customerPhone,
      ...bookingDocFields(q.bookingId),
      lineItems: q.lineItems,
      subtotal: q.subtotal,
      discount: q.discount,
      total: q.total,
    });
  const openInvoiceDoc = (inv: any) =>
    setPrintDoc({
      docType: 'INVOICE',
      docNumber: inv.invoiceNumber,
      date: isoDay(inv.createdAt),
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      ...bookingDocFields(inv.bookingId),
      lineItems: (() => {
        const rows = allInvoiceItems
          .filter((it: any) => it.invoiceId === inv.id)
          .map((it: any) => ({ description: it.description, qty: Number(it.quantity || 1), unitPrice: Number(it.unitPrice || 0), total: Number(it.total || 0) }));
        if (rows.length) return rows;
        const q = allQuotes.find((x: any) => x.bookingId && x.bookingId === inv.bookingId && Array.isArray(x.lineItems) && x.lineItems.length);
        if (q) return q.lineItems.map((l: any) => ({ description: l.description, qty: Number(l.qty || l.quantity || 1), unitPrice: Number(l.unitPrice || 0), total: Number(l.total || 0) }));
        const bk = allBookings.find((b: any) => b.id === inv.bookingId);
        const desc = bk ? `Adeegga rarka ${bk.referenceNumber}${(bk.services || []).length ? ' — ' + (bk.services || []).join(', ') : ''}` : 'Adeegga rarka (moving service)';
        return [{ description: desc, qty: 1, unitPrice: Number(inv.subtotal || inv.total || 0), total: Number(inv.subtotal || inv.total || 0) }];
      })(),
      paymentMethod: (allPayments.filter((p: any) => p.invoiceId === inv.id).slice(-1)[0] || {}).paymentMethod,
      referenceCode: (allPayments.filter((p: any) => p.invoiceId === inv.id).slice(-1)[0] || {}).referenceCode,
      notes: inv.notes,
      subtotal: inv.subtotal,
      discount: inv.discount,
      total: inv.total,
      amountPaid: inv.amountPaid,
      balanceDue: inv.balanceDue,
      moveDate: inv.dueDate || bookingDocFields(inv.bookingId).moveDate,
    } as any);
  const openReceiptDoc = (p: any) => {
    const inv = allInvoices.find((i: any) => i.id === p.invoiceId);
    const bk = allBookings.find((x: any) => x.id === (p.bookingId || inv?.bookingId));
    setPrintDoc({
      docType: 'RECEIPT',
      docNumber: p.receiptNumber,
      date: isoDay(p.paidAt),
      customerName: p.customerName,
      customerPhone: inv?.customerPhone || bk?.customerPhone || '',
      bookingRef: [inv?.invoiceNumber, bk?.referenceNumber].filter(Boolean).join(' · '),
      subtotal: p.amount,
      total: p.amount,
      balanceDue: inv ? inv.balanceDue : undefined,
      paymentMethod: p.paymentMethod,
      referenceCode: p.referenceCode,
      notes: [p.paymentType, p.notes].filter(Boolean).join(' — '),
    });
  };
  const openBookingDoc = (type: 'BOOKING_FORM' | 'SERVICE_AGREEMENT' | 'INVENTORY_CHECKLIST' | 'JOB_COMPLETION', bk: any) => {
    const paid = allPayments.filter((p: any) => p.bookingId === bk.id).reduce((t: number, p: any) => t + Number(p.amount || 0), 0);
    const quoted = Number(bk.quotedAmount || 0);
    const prefix = { BOOKING_FORM: 'BF', SERVICE_AGREEMENT: 'AG', INVENTORY_CHECKLIST: 'INV', JOB_COMPLETION: 'JC' }[type];
    setPrintDoc({
      docType: type,
      docNumber: `${prefix}-${bk.referenceNumber}`,
      date: new Date().toISOString().slice(0, 10),
      customerName: bk.customerName,
      customerPhone: bk.customerPhone,
      ...bookingDocFields(bk.id),
      inventoryItems: allBookingItems
        .filter((i: any) => i.bookingId === bk.id)
        .map((i: any) => ({ itemName: i.itemName, boxNumber: i.boxNumber, quantity: i.quantity, conditionBefore: i.conditionBefore, conditionAfter: i.conditionAfter, roomLabel: i.notes })),
      subtotal: quoted ? String(quoted) : '',
      total: quoted ? String(quoted) : '',
      amountPaid: paid ? String(paid) : '',
      balanceDue: quoted ? String(Math.max(0, quoted - paid)) : '',
      notes: [bk.sizeDescription, bk.largeItems].filter(Boolean).join(' · '),
    });
  };
  const confirmDelete = async (label: string, url: string) => {
    if (!window.confirm((lang === 'so' ? 'Ma hubtaa inaad tirtirto ' : 'Delete ') + label + '?')) return;
    try {
      await authedFetch(url, { method: 'DELETE' });
      showNotice(lang === 'so' ? 'Waa la tirtiray' : 'Deleted');
      fetchErpData();
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };
  const canManage = ['Admin', 'Manager'].includes(erpData?.currentUser?.role);
  const canFinance = ['Admin', 'Manager', 'Accountant'].includes(erpData?.currentUser?.role);

  // Export Reports to CSV
  const handleExportCsv = () => {
    const headers = ['Reference', 'Customer', 'Phone', 'From', 'To', 'Date', 'Status', 'QuotedUSD'];
    const rows = allBookings.map((b: any) => [
      b.referenceNumber,
      `"${b.customerName}"`,
      `"${b.customerPhone}"`,
      b.fromDistrict,
      b.toDistrict,
      b.preferredDate,
      b.status,
      b.quotedAmount,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SOORAR_ERP_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const navGroups: Array<{ title: string; ids: ErpModule[] }> = [
    { title: so ? 'Hawlaha' : 'Operations', ids: ['my_jobs', 'dashboard', 'bookings', 'dispatch', 'crm_leads', 'survey_calculator', 'inventory'] },
    { title: so ? 'Iibka & Maaliyadda' : 'Sales & Finance', ids: ['customers', 'referrals', 'quotes_invoices', 'payments', 'expenses', 'payroll', 'accounting_ledger', 'reports'] },
    { title: so ? 'Kheyraadka' : 'Resources', ids: ['staff', 'vehicles', 'packing_stock', 'warehouse_storage', 'suppliers_po', 'damage_claims'] },
    { title: so ? 'Maamulka' : 'Admin', ids: ['documents_hub', 'cms', 'settings'] },
  ];
  const NAV_LABELS: Record<string, [string, string]> = {
    dashboard: ['Dashboard', 'Dashboard'],
    my_jobs: ['Shaqadayda Maanta', 'My jobs today'],
    dispatch: ['Jadwalka Dispatch', 'Dispatch calendar'],
    payroll: ['Mushaharka', 'Payroll'],
    referrals: ['Referral-ka', 'Referrals'],
    bookings: ['Ballamaha & Shaqooyinka', 'Bookings & Jobs'],
    crm_leads: ['Leads (CRM)', 'Leads (CRM)'],
    survey_calculator: ['Qiimeynta mugga (m³)', 'Survey & volume'],
    inventory: ['Liiska alaabta', 'Inventory checklist'],
    customers: ['Macaamiisha', 'Customers'],
    quotes_invoices: ['Qiimeyn & Biilal', 'Quotes & Invoices'],
    payments: ['Lacag bixinta', 'Payments'],
    expenses: ['Kharashaadka', 'Expenses'],
    accounting_ledger: ['Xisaabaadka', 'Accounting'],
    reports: ['Warbixinno', 'Reports'],
    staff: ['Shaqaalaha & ID', 'Staff & ID cards'],
    vehicles: ['Gaadiidka', 'Fleet'],
    packing_stock: ['Agabka baakadeynta', 'Packing stock'],
    warehouse_storage: ['Bakhaarka', 'Storage'],
    suppliers_po: ['Alaab-keenayaal', 'Suppliers & POs'],
    damage_claims: ['Cabashooyinka', 'Damage claims'],
    documents_hub: ['Dukumentiyada', 'Documents'],
    cms: ['Website-ka', 'Website CMS'],
    settings: ['Settings & Users', 'Settings & Users'],
  };
  const navLabel = (id: string) => (NAV_LABELS[id] ? NAV_LABELS[id][so ? 0 : 1] : id);
  const navIcon = (id: string) => navItems.find((n) => n.id === id)?.icon || LayoutDashboard;
  const canSee = (id: ErpModule) => visibleNavItems.some((n) => n.id === id);
  const pendingUsers = allUsers.filter((u: any) => u.status !== 'Active').length;
  const goModule = (id: ErpModule) => {
    if (!canSee(id)) return;
    setActiveModule(id);
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };
  const initials = (displayName || 'S')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="erp-app min-h-screen bg-[#F4F6FA] text-[#0B1F3A] lg:flex">
      <PrintableDocumentModal
        doc={printDoc}
        onClose={() => setPrintDoc(null)}
        companyAddress={sMap.office_address || 'Muqdisho, Soomaaliya'}
        companyPhone={sMap.whatsapp_phone || '+252 770 505 028'}
        companyEmail={sMap.office_email || ''}
      />

      {staffSession?.token && (
        <ChangePasswordModal
          lang={lang}
          open={pwModalOpen}
          onClose={() => setPwModalOpen(false)}
          endpoint="/api/account/change-password"
          token={staffSession.token}
          onChanged={(t) => {
            const next = { ...staffSession, token: t };
            localStorage.setItem('soorar_staff_session', JSON.stringify(next));
            sessionStorage.removeItem('soorar_staff_session');
            setStaffSession(next);
          }}
        />
      )}
      {navOpen && <div className="no-print fixed inset-0 z-40 bg-[#0B1F3A]/50 lg:hidden" onClick={() => setNavOpen(false)} />}

      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-50 h-[100dvh] w-[268px] shrink-0 bg-[#0B1F3A] text-white flex flex-col transition-transform duration-200 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-1 flex shrink-0"><span className="w-1/4 bg-[#F1980A]" /><span className="flex-1 bg-[#00529E]" /></div>
        <div className="px-5 h-16 flex items-center justify-between shrink-0 border-b border-white/10">
          <img src="/brand/soorar-logo-white.png" alt="SOORAR" className="h-9 w-auto" />
          <button type="button" onClick={() => setNavOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/10" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((g) => {
            const ids = g.ids.filter(canSee);
            if (!ids.length) return null;
            return (
              <div key={g.title}>
                <div className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/40">{g.title}</div>
                <div className="space-y-0.5">
                  {ids.map((id) => {
                    const Icon = navIcon(id);
                    const active = activeModule === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => goModule(id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors cursor-pointer ${
                          active ? 'bg-[#00529E] text-white shadow-sm' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-[#F1980A]' : 'text-white/45'}`} />
                        <span className="truncate flex-1 text-left">{navLabel(id)}</span>
                        {id === 'settings' && pendingUsers > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#F1980A] text-[11px] font-bold text-white flex items-center justify-center">{pendingUsers}</span>
                        )}
                        {id === 'bookings' && newBookingsCount > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-white/15 text-[11px] font-semibold flex items-center justify-center">{newBookingsCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.05]">
            <div className="w-9 h-9 rounded-full bg-[#F1980A] text-white text-sm font-bold flex items-center justify-center shrink-0">{initials}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{displayName}</div>
              <div className="text-[11px] text-white/50 truncate">{currentUser?.role}</div>
            </div>
            <button type="button" onClick={handleSignOut} title={so ? 'Ka bax' : 'Sign out'} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-rose-500/30 cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <button type="button" onClick={onExitAdmin} className="mt-2 w-full text-xs text-white/50 hover:text-white py-1.5 cursor-pointer">
            ← {so ? 'Website-ka' : 'Public website'}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80">
          <div className="h-16 px-3 sm:px-6 flex items-center gap-3">
            <button type="button" onClick={() => setNavOpen(true)} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-slate-100" aria-label="Menu">
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] sm:text-base font-semibold text-[#0B1F3A] truncate">{navLabel(activeModule)}</div>
              <div className="hidden sm:block text-xs text-slate-400 truncate">SOORAR · {so ? 'Rarid Guryo & Xafiisyo' : 'Home & Office Moving'}</div>
            </div>
            <div className="hidden md:block relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder={so ? 'Raadi ballan, macmiil, taleefan…' : 'Search bookings, customers…'}
                value={bookingSearch}
                onChange={(e) => {
                  setBookingSearch(e.target.value);
                  if (activeModule !== 'bookings') setActiveModule('bookings');
                }}
                className="erp-input !pl-9 !py-2"
              />
            </div>
            <button type="button" onClick={() => fetchErpData()} title={so ? 'Cusboonaysii' : 'Refresh'} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer">
              <RefreshCw className={`w-[18px] h-[18px] ${loadingData ? 'animate-spin text-[#00529E]' : ''}`} />
            </button>
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-[#00529E] text-white text-sm font-bold flex items-center justify-center">{initials}</div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-[#0B1F3A] max-w-[160px] truncate">{displayName}</div>
                <div className="text-[11px] font-semibold text-[#C46F00]">{currentUser?.role}</div>
              </div>
            </div>
            {staffSession?.token && (
              <button type="button" onClick={() => setPwModalOpen(true)} title={so ? 'Beddel Password' : 'Change password'} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer">
                <KeyRound className="w-[18px] h-[18px]" />
              </button>
            )}
            <button type="button" onClick={handleSignOut} title={so ? 'Ka bax' : 'Sign out'} className="p-2.5 rounded-xl hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer">
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </header>

        <main className="p-3 sm:p-6 flex-1 space-y-6 max-w-[1500px] w-full mx-auto">
          {!canSee(activeModule) && (
            <div className="erp-card p-8 text-center text-sm text-slate-500">{so ? 'Qaybtan looma oggola doorkaaga.' : 'Your role does not have access to this section.'}</div>
          )}
          {activeModule === 'dashboard' && (
            <ErpDashboard
              lang={lang}
              userName={displayName}
              bookings={allBookings}
              payments={allPayments}
              expenses={allExpenses}
              invoices={allInvoices}
              leads={allLeads}
              staff={allStaff}
              vehicles={allVehicles}
              logs={allLogs}
              go={(m: ErpModule) => goModule(m)}
              confirmWaUrl={getConfirmWhatsAppUrl}
            />
          )}

          {erpData?.meta && Object.values(erpData.meta.truncated || {}).some(Boolean) && (
            <div className="erp-card p-3 text-xs text-slate-600 border-l-4 !border-l-[#00529E]">
              {so
                ? `Liisaska waaweyn waxaa la soo bandhigay ${erpData.meta.listLimit} kii ugu dambeeyay (ballamo ${erpData.meta.totals.bookings}, macaamiil ${erpData.meta.totals.customers}, lacag-bixin ${erpData.meta.totals.payments}). Raadinta buuxda: /api/admin/list.`
                : `Large lists show the newest ${erpData.meta.listLimit} records (bookings ${erpData.meta.totals.bookings}, customers ${erpData.meta.totals.customers}, payments ${erpData.meta.totals.payments}). Full history is paginated via /api/admin/list.`}
            </div>
          )}
          {activeModule === 'my_jobs' && canSee('my_jobs') && (
            <CrewJobsView lang={lang} api={authedFetch} userName={displayName} onNotice={showNotice} />
          )}
          {activeModule === 'dispatch' && canSee('dispatch') && (
            <DispatchCalendar
              lang={lang}
              api={authedFetch}
              canAssign={['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Dispatcher'].includes(currentUser?.role)}
              onNotice={showNotice}
              onChanged={fetchErpData}
            />
          )}
          {activeModule === 'payroll' && canSee('payroll') && (
            <PayrollModule lang={lang} api={authedFetch} onPrint={(d) => setPrintDoc(d)} onNotice={showNotice} onChanged={fetchErpData} />
          )}
          {activeModule === 'referrals' && canSee('referrals') && (
            <ReferralsModule
              lang={lang}
              api={authedFetch}
              defaultPct={sMap.referral_discount_pct || ''}
              canReward={['Admin', 'Super Admin', 'Manager', 'Accountant'].includes(currentUser?.role)}
              onNotice={showNotice}
              onChanged={fetchErpData}
            />
          )}

          {/* MODULE 2: CRM & LEADS PIPELINE */}
          {activeModule === 'crm_leads' && (
            <div className="space-y-6">
              <div className="bg-[#0B1F3A] text-white p-6 rounded-[16px] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#F1980A]">
                    MODULE 2 · OMNI-CHANNEL CRM & LEADS PIPELINE
                  </div>
                  <h3 className="text-xl font-bold mt-0.5">
                    Mogadishu Moving Leads (WhatsApp · Website · Phone · Walk-In · TikTok · Facebook)
                  </h3>
                  <p className="text-xs text-white/80 mt-1">
                    Track prospects from New → Contacted → Survey Scheduled → Quoted → Won / Lost with 1-click WhatsApp follow-up.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('survey_calculator')}
                  className="px-4 py-2.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-xs font-bold cursor-pointer"
                >
                  Open Volume (m³) Surveyor →
                </button>
              </div>

              {/* Add New Lead Form */}
              <div className="bg-white p-5 rounded-[14px] border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Lead Name / Org *</label>
                  <input
                    type="text"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    placeholder="e.g., Hodan Family / NGO"
                    className="w-full px-3 py-2 rounded border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Phone / WhatsApp *</label>
                  <input
                    type="text"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Lead Source</label>
                  <select
                    value={newLeadSource}
                    onChange={(e) => setNewLeadSource(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-300"
                  >
                    <option value="WhatsApp">WhatsApp (+252 770 505 028)</option>
                    <option value="Website Form">Website Booking Form</option>
                    <option value="Phone Call">Direct Phone Call</option>
                    <option value="Facebook">Facebook Page</option>
                    <option value="TikTok">TikTok Video</option>
                    <option value="Walk-in">Hodan Office Walk-In</option>
                    <option value="Referral">Client Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Mogadishu District</label>
                  <select
                    value={newLeadDistrict}
                    onChange={(e) => setNewLeadDistrict(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-300"
                  >
                    {MOGADISHU_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Est. Volume (m³)</label>
                  <input
                    type="number"
                    value={newLeadVol}
                    onChange={(e) => setNewLeadVol(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newLeadName) return;
                    await authedFetch('/api/admin/leads', {
                      method: 'POST',
                      body: JSON.stringify({
                        customerName: newLeadName,
                        phone: newLeadPhone,
                        source: newLeadSource,
                        district: newLeadDistrict,
                        moveType: newLeadMoveType,
                        estimatedVolumeM3: newLeadVol,
                        stage: 'New',
                      }),
                    });
                    setNewLeadName('');
                    fetchErpData();
                    showNotice('New CRM Lead added to pipeline!');
                  }}
                  className="py-2 px-4 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white font-semibold cursor-pointer"
                >
                  + Add Lead
                </button>
              </div>

              {/* Pipeline Stages Board */}
              <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F2F5FA] text-slate-600">
                      <th className="py-3 px-4">Lead Code</th>
                      <th className="py-3 px-4">Prospect / Organization</th>
                      <th className="py-3 px-4">Source & District</th>
                      <th className="py-3 px-4">Est. Volume</th>
                      <th className="py-3 px-4">Pipeline Stage</th>
                      <th className="py-3 px-4 text-right">Instant Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allLeads.map((ld: any) => (
                      <tr key={ld.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono-tabular font-bold text-[#00529E]">{ld.leadCode}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#0B1F3A]">{ld.customerName}</div>
                          <div className="font-mono-tabular text-slate-500">{ld.phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#0B1F3A]">{ld.source}</span> · {ld.district}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular font-semibold">{ld.estimatedVolumeM3} m³</td>
                        <td className="py-3 px-4">
                          <select
                            value={ld.stage}
                            onChange={async (e) => {
                              await authedFetch(`/api/admin/leads/${ld.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ stage: e.target.value }),
                              });
                              fetchErpData();
                              showNotice(`Lead ${ld.leadCode} moved to ${e.target.value}`);
                            }}
                            className="px-2.5 py-1 rounded border border-slate-300 font-bold text-[#00529E]"
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Survey Scheduled">Survey Scheduled</option>
                            <option value="Quoted">Quoted</option>
                            <option value="Won">Won ✓</option>
                            <option value="Lost">Lost</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <a
                            href={buildWhatsAppUrl(
                              ld.phone,
                              `Asc ${ld.customerName}, waa shirkadda raridda guryaha iyo xafiisyada ee SOORAR (${ld.leadCode}). Waxaan diyaar u nahay qiimeynta rarkaaga (${ld.district}).`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold"
                          >
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={async () => {
                              await authedFetch(`/api/admin/leads/${ld.id}`, { method: 'DELETE' });
                              fetchErpData();
                              showNotice(`Deleted lead ${ld.leadCode}`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-bold cursor-pointer transition-colors"
                          >
                            ✕ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 4: SURVEY & VOLUME (M3) CALCULATOR ENGINE */}
          {activeModule === 'survey_calculator' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs font-bold uppercase text-[#F1980A]">
                      MODULE 3 & 4 · ON-SITE / VIDEO SURVEYOR & CUBIC METER (m³) PRICING ENGINE
                    </div>
                    <h3 className="text-lg font-bold text-[#0B1F3A]">
                      Room-by-Room Furniture Volume Calculator & Automatic Truck/Crew Recommender
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteLines([
                        {
                          description: `Recommended Fleet: ${recommendedTruck} (${totalSurveyVolumeM3.toFixed(1)} m³)`,
                          category: 'truck',
                          qty: 1,
                          unitPrice: Math.round(calculatedSurveyPriceUsd * 0.5),
                          total: Math.round(calculatedSurveyPriceUsd * 0.5),
                        },
                        {
                          description: `Uniformed SOORAR Moving Crew (${recommendedCrewCount} Specialists)`,
                          category: 'crew',
                          qty: recommendedCrewCount,
                          unitPrice: 25,
                          total: recommendedCrewCount * 25,
                        },
                        {
                          description: `Protective Packing & Cartons (${recommendedBoxesCount} Boxes + Wrap)`,
                          category: 'packing',
                          qty: 1,
                          unitPrice: Math.max(25, calculatedSurveyPriceUsd - Math.round(calculatedSurveyPriceUsd * 0.5) - recommendedCrewCount * 25),
                          total: Math.max(25, calculatedSurveyPriceUsd - Math.round(calculatedSurveyPriceUsd * 0.5) - recommendedCrewCount * 25),
                        },
                      ]);
                      setActiveModule('quotes_invoices');
                      showNotice('Survey calculation loaded into Official Quote Builder!');
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-xs font-bold cursor-pointer"
                  >
                    Transfer to Official Quote (${calculatedSurveyPriceUsd}) →
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="text-xs font-bold text-slate-600 uppercase">
                      Select Furniture & Room Inventory Quantities:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(surveyRoomCounts).map(([itemLabel, count]) => (
                        <div
                          key={itemLabel}
                          className="p-3 rounded-[10px] bg-[#F2F5FA] border border-slate-200 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-semibold text-[#0B1F3A]">{itemLabel}</span>
                          <input
                            type="number"
                            min={0}
                            value={count}
                            onChange={(e) =>
                              setSurveyRoomCounts({
                                ...surveyRoomCounts,
                                [itemLabel]: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-16 px-2 py-1 rounded bg-white border border-slate-300 text-center font-mono-tabular font-bold"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Mogadishu Route Distance (km)
                        </label>
                        <input
                          type="number"
                          value={surveyDistanceKm}
                          onChange={(e) => setSurveyDistanceKm(Number(e.target.value) || 1)}
                          className="w-full px-3 py-2 rounded border border-slate-300 text-xs font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Stair Flights Without Elevator
                        </label>
                        <input
                          type="number"
                          value={surveyFloorsNoLift}
                          onChange={(e) => setSurveyFloorsNoLift(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded border border-slate-300 text-xs font-mono-tabular"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Auto-Calculated Output Panel */}
                  <div className="lg:col-span-5 bg-[#0B1F3A] text-white rounded-[16px] p-6 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="text-xs font-bold uppercase text-[#F1980A]">
                        AUTOMATIC SURVEY ENGINE RECOMMENDATION
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-[12px] bg-white/10">
                          <div className="text-[11px] text-white/70">Total Cubic Volume</div>
                          <div className="text-2xl font-bold font-mono-tabular text-[#F1980A]">
                            {totalSurveyVolumeM3.toFixed(1)} m³
                          </div>
                        </div>
                        <div className="p-3.5 rounded-[12px] bg-white/10">
                          <div className="text-[11px] text-white/70">Estimated Tariff</div>
                          <div className="text-2xl font-bold font-mono-tabular text-emerald-400">
                            ${calculatedSurveyPriceUsd}.00
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-[12px] bg-white/5 border border-white/10 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/70">Recommended Truck:</span>
                          <span className="font-bold text-white">{recommendedTruck}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Recommended Crew Size:</span>
                          <span className="font-bold text-[#F1980A]">{recommendedCrewCount} Uniformed Movers</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Packing Boxes Needed:</span>
                          <span className="font-bold font-mono-tabular">{recommendedBoxesCount} Cartons + Wrap</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setPrintDoc({
                          docType: 'QUOTE',
                          docNumber: `QT-SURV-${Date.now().toString().slice(-4)}`,
                          date: new Date().toISOString().slice(0, 10),
                          customerName: 'Mogadishu Survey Client',
                          customerPhone: '+252 61 500 0000',
                          lineItems: [
                            {
                              description: `${recommendedTruck} (${totalSurveyVolumeM3.toFixed(1)} m³ Volume)`,
                              qty: 1,
                              unitPrice: Math.round(calculatedSurveyPriceUsd * 0.6),
                              total: Math.round(calculatedSurveyPriceUsd * 0.6),
                            },
                            {
                              description: `Crew (${recommendedCrewCount} Movers) & ${recommendedBoxesCount} Cartons`,
                              qty: 1,
                              unitPrice: calculatedSurveyPriceUsd - Math.round(calculatedSurveyPriceUsd * 0.6),
                              total: calculatedSurveyPriceUsd - Math.round(calculatedSurveyPriceUsd * 0.6),
                            },
                          ],
                          subtotal: String(calculatedSurveyPriceUsd),
                          total: String(calculatedSurveyPriceUsd),
                        })
                      }
                      className="w-full py-3 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" /> Print Official 02 · Survey Quotation PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 2: BOOKINGS & CALENDAR */}
          {activeModule === 'bookings' && (
            <div className="space-y-6">
              {/* Filter & View Bar */}
              <div className="bg-white p-4 rounded-[14px] border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search Ref, Name, Phone..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-[8px] border border-slate-300 text-xs"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-[8px] border border-slate-300 text-xs"
                  >
                    <option value="All">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Quoted">Quoted</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="In progress">In progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  <select
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-[8px] border border-slate-300 text-xs"
                  >
                    <option value="All">All Mogadishu Districts</option>
                    {MOGADISHU_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Table vs Calendar Toggle */}
                <div className="flex items-center gap-1 p-1 bg-[#F2F5FA] rounded-[8px]">
                  <button
                    onClick={() => setBookingViewMode('table')}
                    className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                      bookingViewMode === 'table' ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    onClick={() => setBookingViewMode('calendar')}
                    className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                      bookingViewMode === 'calendar' ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Schedule / Calendar View
                  </button>
                </div>
              </div>

              {bookingViewMode === 'calendar' ? (
                <div className="bg-white p-6 rounded-[14px] border border-slate-200">
                  <h3 className="text-base font-bold text-[#0B1F3A] mb-4">
                    Dispatch Schedule by Date & Time Slot
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBookings.map((b: any) => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBooking(b)}
                        className="p-4 rounded-[14px] border border-slate-200 hover:border-[#00529E] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs font-mono-tabular">
                          <span className="font-bold text-[#00529E]">{b.preferredDate} · {b.preferredTime}</span>
                          <span className="font-semibold text-[#0B1F3A]">{b.status}</span>
                        </div>
                        <div className="font-bold text-sm mt-2">{b.customerName}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {b.fromDistrict} (Floor {b.fromFloor}) → {b.toDistrict} (Floor {b.toFloor})
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
                          Ref: {b.referenceNumber} · ${Number(b.quotedAmount || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Bookings List Table */}
                  <div className="lg:col-span-7 bg-white rounded-[14px] border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-[#F2F5FA]/60 text-slate-500">
                            <th className="py-3 px-3.5">Ref</th>
                            <th className="py-3 px-3.5">Customer</th>
                            <th className="py-3 px-3.5">From → To</th>
                            <th className="py-3 px-3.5">Date</th>
                            <th className="py-3 px-3.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredBookings.map((b: any) => (
                            <tr
                              key={b.id}
                              onClick={() => setSelectedBooking(b)}
                              className={`cursor-pointer transition-colors ${
                                selectedBooking?.id === b.id ? 'bg-[#F2F5FA]' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3 px-3.5 font-mono-tabular font-bold text-[#00529E]">
                                {b.referenceNumber}
                              </td>
                              <td className="py-3 px-3.5">
                                <div className="font-semibold text-[#0B1F3A]">{b.customerName}</div>
                                <div className="text-slate-500 font-mono-tabular">{b.customerPhone}</div>
                              </td>
                              <td className="py-3 px-3.5 text-slate-700">
                                {b.fromDistrict} → {b.toDistrict}
                              </td>
                              <td className="py-3 px-3.5 font-mono-tabular">{b.preferredDate}</td>
                              <td className="py-3 px-3.5 font-semibold">{b.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Selected Booking Detail Inspector & One-Click WhatsApp Templates */}
                  <div className="lg:col-span-5 bg-white rounded-[14px] border border-slate-200 p-5 space-y-5">
                    {selectedBooking ? (
                      <>
                        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                          <div>
                            <div className="text-xs text-slate-500 font-mono-tabular">
                              {selectedBooking.referenceNumber}
                            </div>
                            <h3 className="text-lg font-bold text-[#0B1F3A]">
                              {selectedBooking.customerName}
                            </h3>
                            <div className="text-xs font-mono-tabular text-slate-600">
                              {selectedBooking.customerPhone} · {selectedBooking.customerEmail}
                            </div>
                          </div>
                          {activeRoleView !== 'Staff' && (
                            <select
                              value={selectedBooking.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                const res = await authedFetch(`/api/admin/bookings/${selectedBooking.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: newStatus }),
                                });
                                setSelectedBooking(res.booking);
                                fetchErpData();
                                showNotice(`Status updated to ${newStatus}`);
                              }}
                              className="px-3 py-1.5 rounded-[8px] border border-slate-300 text-xs font-bold text-[#00529E]"
                            >
                              <option value="New">New</option>
                              <option value="Quoted">Quoted</option>
                              <option value="Confirmed">Confirmed</option>
                              <option value="In progress">In progress</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          )}
                        </div>

                        {/* Route & Move Details */}
                        <div className="grid grid-cols-2 gap-3 text-xs bg-[#F2F5FA] p-3.5 rounded-[8px]">
                          <div>
                            <div className="text-slate-500">From (Ka):</div>
                            <div className="font-semibold text-[#0B1F3A]">
                              {selectedBooking.fromDistrict} (Floor {selectedBooking.fromFloor}, Lift: {selectedBooking.fromLift ? 'Yes' : 'No'})
                            </div>
                            <div className="text-slate-600">{selectedBooking.fromAddress}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">To (U):</div>
                            <div className="font-semibold text-[#0B1F3A]">
                              {selectedBooking.toDistrict} (Floor {selectedBooking.toFloor}, Lift: {selectedBooking.toLift ? 'Yes' : 'No'})
                            </div>
                            <div className="text-slate-600">{selectedBooking.toAddress}</div>
                          </div>
                        </div>

                        <div className="text-xs space-y-1.5">
                          <div>
                            <span className="text-slate-500">Size:</span>{' '}
                            <span className="font-semibold">{selectedBooking.sizeDescription}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Large Items:</span>{' '}
                            <span>{selectedBooking.largeItems || 'Standard household furniture'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Services:</span>{' '}
                            <span className="font-semibold">{(selectedBooking.services || []).join(' · ')}</span>
                          </div>
                          {selectedBooking.notes && (
                            <div>
                              <span className="text-slate-500">Customer Notes:</span>{' '}
                              <span className="italic">{selectedBooking.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Assign Vehicle & Quoted Price */}
                        {activeRoleView !== 'Staff' && (
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Assigned Truck
                              </label>
                              <select
                                value={selectedBooking.assignedVehicleId || ''}
                                onChange={async (e) => {
                                  const vId = Number(e.target.value) || null;
                                  const res = await authedFetch(`/api/admin/bookings/${selectedBooking.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ assignedVehicleId: vId }),
                                  });
                                  setSelectedBooking(res.booking);
                                  fetchErpData();
                                  showNotice('Truck assigned');
                                }}
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs"
                              >
                                <option value="">Unassigned</option>
                                {allVehicles.map((v: any) => (
                                  <option key={v.id} value={v.id}>
                                    {v.plateNumber} — {v.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Quoted Amount (USD)
                              </label>
                              <input
                                type="number"
                                value={selectedBooking.quotedAmount || '0'}
                                onChange={(e) =>
                                  setSelectedBooking({ ...selectedBooking, quotedAmount: e.target.value })
                                }
                                onBlur={async () => {
                                  await authedFetch(`/api/admin/bookings/${selectedBooking.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ quotedAmount: selectedBooking.quotedAmount }),
                                  });
                                  fetchErpData();
                                  showNotice('Quote amount saved');
                                }}
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs font-mono-tabular"
                              />
                            </div>
                          </div>
                        )}

                        {/* 3 Required WhatsApp Template Buttons */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <div className="text-xs font-bold text-[#0B1F3A]">
                            Instant WhatsApp Customer Actions ({selectedBooking.language === 'en' ? 'EN' : 'SO'}):
                          </div>
                          <a
                            href={getQuoteWhatsAppUrl(selectedBooking)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackWhatsAppClick('admin_send_quote_whatsapp')}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white text-xs font-semibold transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Send Quote on WhatsApp (${Number(selectedBooking.quotedAmount || 180).toFixed(0)})
                          </a>
                          <a
                            href={getConfirmWhatsAppUrl(selectedBooking)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackWhatsAppClick('admin_send_confirmation_whatsapp')}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Send Confirmation on WhatsApp
                          </a>
                          <a
                            href={getThankYouWhatsAppUrl(selectedBooking)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackWhatsAppClick('admin_send_thankyou_whatsapp')}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-xs font-semibold transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Send Thank-You + Review Request
                          </a>
                        </div>

                        <BookingExtras
                          lang={lang}
                          api={authedFetch}
                          booking={allBookings.find((b: any) => b.id === selectedBooking.id) || selectedBooking}
                          staff={allStaff}
                          allBookings={allBookings}
                          canAssign={['Admin', 'Super Admin', 'Manager', 'Branch Manager', 'Dispatcher'].includes(currentUser?.role)}
                          canDeletePhotos={canManage}
                          onNotice={showNotice}
                          onChanged={async () => {
                            await fetchErpData();
                          }}
                        />

                        {/* Official SOORAR documents for this booking (real data only) */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <div className="text-xs font-semibold text-[#0B1F3A]">
                            {lang === 'so' ? 'Dukumentiyada ballantan' : 'Documents for this booking'}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-[12px]">
                            {([
                              ['BOOKING_FORM', '04 · Foomka Ballanta'],
                              ['SERVICE_AGREEMENT', '06 · Heshiiska Adeegga'],
                              ['INVENTORY_CHECKLIST', '05 · Liiska Alaabta'],
                              ['JOB_COMPLETION', '07 · Xaqiijinta Shaqada'],
                            ] as const).map(([type, label]) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => openBookingDoc(type, selectedBooking)}
                                className="py-2 px-2.5 rounded-lg bg-[#F4F6FA] hover:bg-slate-200 font-medium text-left text-[#0B1F3A] flex items-center gap-1.5 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-[#00529E] shrink-0" />
                                <span className="truncate">{label}</span>
                              </button>
                            ))}
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              onClick={async () => {
                                await confirmDelete(selectedBooking.referenceNumber, `/api/admin/bookings/${selectedBooking.id}`);
                                setSelectedBooking(null);
                              }}
                              className="w-full mt-1 erp-btn erp-btn-danger justify-center !py-2 !text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> {lang === 'so' ? 'Tirtir ballantan' : 'Delete booking'}
                            </button>
                          )}
                        </div>

                        {/* Status History Log */}
                        <div className="pt-3 border-t border-slate-100">
                          <div className="text-xs font-bold text-slate-600 mb-2">Status History</div>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto text-[11px]">
                            {(selectedBooking.statusHistory || []).map((h: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-slate-600">
                                <span className="font-semibold text-[#0B1F3A]">{h.status}</span>
                                <span className="font-mono-tabular text-slate-400">{h.timestamp}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-500 py-8 text-center">
                        Select a booking row to inspect details and send WhatsApp templates.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODULE 3: CUSTOMERS */}
          {activeModule === 'customers' && (
            <CustomersModule lang={lang} customers={allCustomers} bookings={allBookings} payments={allPayments} canDelete={canManage} api={authedFetch} refresh={fetchErpData} notify={showNotice} />
          )}

          {/* MODULE 4: QUOTES & INVOICES */}
          {activeModule === 'quotes_invoices' && (
            <div className="space-y-6">
              {/* Create Quote Builder */}
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Create Official Quote / Convert to Branded Invoice
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Link Booking</label>
                    <select
                      value={quoteBookingId}
                      onChange={(e) => {
                        const bId = e.target.value;
                        setQuoteBookingId(bId);
                        const found = allBookings.find((x: any) => String(x.id) === bId);
                        if (found) {
                          setQuoteCustomerName(found.customerName);
                          setQuoteCustomerPhone(found.customerPhone);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-[8px] border border-slate-300 text-xs"
                    >
                      <option value="">Select Booking (Optional)</option>
                      {allBookings.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.referenceNumber} — {b.customerName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={quoteCustomerName}
                      onChange={(e) => setQuoteCustomerName(e.target.value)}
                      placeholder="Client or NGO Name"
                      className="w-full px-3 py-2 rounded-[8px] border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Phone (+252)</label>
                    <input
                      type="text"
                      value={quoteCustomerPhone}
                      onChange={(e) => setQuoteCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-[8px] border border-slate-300 text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Discount ($)</label>
                    <input
                      type="number"
                      value={quoteDiscount}
                      onChange={(e) => setQuoteDiscount(e.target.value)}
                      className="w-full px-3 py-2 rounded-[8px] border border-slate-300 text-xs font-mono-tabular"
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-slate-600">
                    Line Items (Truck · Crew · Packing Materials · Extra Floors · Heavy Items)
                  </div>
                  {quoteLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => {
                          const copy = [...quoteLines];
                          copy[idx].description = e.target.value;
                          setQuoteLines(copy);
                        }}
                        className="col-span-6 px-3 py-1.5 rounded border border-slate-300 text-xs"
                      />
                      <input
                        type="number"
                        value={line.qty}
                        onChange={(e) => {
                          const copy = [...quoteLines];
                          copy[idx].qty = Number(e.target.value) || 1;
                          copy[idx].total = copy[idx].qty * copy[idx].unitPrice;
                          setQuoteLines(copy);
                        }}
                        className="col-span-2 px-3 py-1.5 rounded border border-slate-300 text-xs font-mono-tabular"
                      />
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const copy = [...quoteLines];
                          copy[idx].unitPrice = Number(e.target.value) || 0;
                          copy[idx].total = copy[idx].qty * copy[idx].unitPrice;
                          setQuoteLines(copy);
                        }}
                        className="col-span-2 px-3 py-1.5 rounded border border-slate-300 text-xs font-mono-tabular"
                      />
                      <div className="col-span-2 text-right font-mono-tabular text-xs font-bold">
                        ${line.total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setQuoteLines([
                        ...quoteLines,
                        { description: 'Extra Floor / Heavy Item Handling', category: 'floors', qty: 1, unitPrice: 30, total: 30 },
                      ])
                    }
                    className="text-xs font-semibold text-[#00529E] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line Item
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quoteConvertImmediately}
                      onChange={(e) => setQuoteConvertImmediately(e.target.checked)}
                      className="accent-[#00529E]"
                    />
                    Also generate official Invoice immediately
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!quoteCustomerName.trim()) {
                        showNotice('Please enter customer name');
                        return;
                      }
                      await authedFetch('/api/admin/quotes', {
                        method: 'POST',
                        body: JSON.stringify({
                          bookingId: quoteBookingId || null,
                          customerName: quoteCustomerName,
                          customerPhone: quoteCustomerPhone,
                          lineItems: quoteLines,
                          discount: quoteDiscount,
                          convertToInvoice: quoteConvertImmediately,
                        }),
                      });
                      fetchErpData();
                      showNotice('Quote & Invoice generated!');
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Quote & Generate PDF
                  </button>
                </div>
              </div>

              {/* Invoices & Quotes List */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 font-bold text-sm">
                    Quotes ({allQuotes.length})
                  </div>
                  <div className="divide-y divide-slate-100">
                    {allQuotes.map((q: any) => (
                      <div key={q.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-mono-tabular font-bold text-[#00529E]">{q.quoteNumber}</div>
                          <div className="font-semibold text-[#0B1F3A]">{q.customerName}</div>
                          <div className="text-slate-500 font-mono-tabular">Total: ${q.total} · {q.status}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openQuoteDoc(q)}
                            className="px-3 py-1.5 rounded-full bg-[#F2F5FA] hover:bg-slate-200 text-[#0B1F3A] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" /> PDF
                          </button>
                          {q.status !== 'Converted' && (
                            <button
                              onClick={async () => {
                                await authedFetch(`/api/admin/quotes/${q.id}/convert`, { method: 'POST' });
                                fetchErpData();
                                showNotice('Converted to Invoice!');
                              }}
                              className="px-3 py-1.5 rounded-full bg-[#00529E] text-white font-semibold cursor-pointer"
                            >
                              Convert
                            </button>
                          )}
                          {canFinance && q.status !== 'Converted' && (
                            <button type="button" title="Delete" onClick={() => confirmDelete(q.quoteNumber, `/api/admin/quotes/${q.id}`)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 font-bold text-sm">
                    Invoices ({allInvoices.length})
                  </div>
                  <div className="divide-y divide-slate-100">
                    {allInvoices.map((inv: any) => (
                      <div key={inv.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-mono-tabular font-bold text-[#0B1F3A]">{inv.invoiceNumber}</div>
                          <div className="font-semibold">{inv.customerName}</div>
                          <div className="font-mono-tabular text-slate-600">
                            Total: ${inv.total} · Paid: ${inv.amountPaid} ·{' '}
                            <span className="text-[#F1980A] font-semibold">Balance: ${inv.balanceDue}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={inv.status} />
                          <button
                            onClick={() => openInvoiceDoc(inv)}
                            className="px-3 py-1.5 rounded-full bg-[#00529E] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" /> Invoice PDF
                          </button>
                          {canFinance && Number(inv.amountPaid) === 0 && (
                            <button type="button" title="Delete" onClick={() => confirmDelete(inv.invoiceNumber, `/api/admin/invoices/${inv.id}`)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 5: PAYMENTS (EVC Plus, Zaad, eDahab, Cash, Bank Transfer) */}
          {activeModule === 'payments' && (
            <div className="space-y-6">
              {canFinance && <PaymentReview lang={lang} api={authedFetch} onNotice={showNotice} onChanged={fetchErpData} />}
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Record Payment (EVC Plus · Zaad · eDahab · Cash · Bank Transfer)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <select
                    value={payInvoiceId}
                    onChange={(e) => {
                      setPayInvoiceId(e.target.value);
                      const found = allInvoices.find((i: any) => String(i.id) === e.target.value);
                      if (found) {
                        setPayCustomerName(found.customerName);
                        setPayAmount(found.balanceDue);
                      }
                    }}
                    className="px-3 py-2 rounded-[8px] border border-slate-300 text-xs"
                  >
                    <option value="">Select Invoice</option>
                    {allInvoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {inv.customerName} (Bal: ${inv.balanceDue})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={payCustomerName}
                    onChange={(e) => setPayCustomerName(e.target.value)}
                    className="px-3 py-2 rounded-[8px] border border-slate-300 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Amount USD"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="px-3 py-2 rounded-[8px] border border-slate-300 text-xs font-mono-tabular"
                  />
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="px-3 py-2 rounded-[8px] border border-slate-300 text-xs"
                  >
                    <option value="EVC Plus">EVC Plus</option>
                    <option value="Zaad">Zaad</option>
                    <option value="eDahab">eDahab</option>
                    <option value="Cash">Cash (USD)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                  <select
                    value={payType}
                    onChange={(e) => setPayType(e.target.value)}
                    className="px-3 py-2 rounded-[8px] border border-slate-300 text-xs"
                  >
                    <option value="Deposit">Deposit (Carbuun)</option>
                    <option value="Balance">Balance (Haraa)</option>
                    <option value="Full">Full Payment</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    placeholder="Transaction Ref (e.g., EVC-884912)"
                    value={payRefCode}
                    onChange={(e) => setPayRefCode(e.target.value)}
                    className="w-64 px-3 py-2 rounded-[8px] border border-slate-300 text-xs font-mono-tabular"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!payCustomerName || !payAmount) return;
                      await authedFetch('/api/admin/payments', {
                        method: 'POST',
                        body: JSON.stringify({
                          invoiceId: payInvoiceId || null,
                          customerName: payCustomerName,
                          amount: payAmount,
                          paymentMethod: payMethod,
                          paymentType: payType,
                          referenceCode: payRefCode,
                        }),
                      });
                      setPayAmount('');
                      setPayRefCode('');
                      fetchErpData();
                      showNotice('Payment recorded & Receipt generated!');
                    }}
                    className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Record Payment
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 font-bold text-sm">
                  Payment Receipts Ledger
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F2F5FA]/60 text-slate-500">
                      <th className="py-3 px-4">Receipt #</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4 text-right">PDF Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allPayments.map((p: any) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4 font-mono-tabular font-bold text-[#00529E]">
                          {p.receiptNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold">{p.customerName}</td>
                        <td className="py-3 px-4">{p.paymentMethod}</td>
                        <td className="py-3 px-4">{p.paymentType}</td>
                        <td className="py-3 px-4 font-mono-tabular font-bold text-emerald-700">
                          ${p.amount}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openReceiptDoc(p)}
                              className="px-3 py-1 rounded-full bg-[#F2F5FA] hover:bg-slate-200 text-[#0B1F3A] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" /> Receipt PDF
                            </button>
                            {canFinance && (
                              <button type="button" title="Delete" onClick={() => confirmDelete(p.receiptNumber, `/api/admin/payments/${p.id}`)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 6: STAFF, CREW & DRIVER MOBILE DISPATCH CONSOLE */}
          {activeModule === 'staff' && (
            <div className="space-y-6">
              {/* Driver & Crew Field Dispatch Header */}
              <div className="bg-[#0B1F3A] text-white rounded-[16px] p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#F1980A]">
                    CREW, SUPERVISOR & DRIVER WORKSPACE
                  </div>
                  <h3 className="text-xl font-bold">
                    Driver & Field Crew Quick-Action Console (Maamulka Shaqaalaha & Darawalada)
                  </h3>
                  <p className="text-xs text-white/80 max-w-2xl">
                    Designed for fast 1-tap use on any smartphone: Drivers and Supervisors can update job progress, broadcast live truck GPS, and print official SOORAR ID badges and employment contracts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('vehicles')}
                  className="px-4 py-2.5 rounded-full bg-[#F1980A] hover:bg-[#D9870A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Open Live Truck GPS Radar
                </button>
              </div>

              {/* Active Jobs Field Board for Drivers & Crew (1-Tap Status & GPS) */}
              <div className="bg-white p-5 rounded-[14px] border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#0B1F3A]">
                    Active Field Jobs — 1-Tap Driver & Supervisor Progress Control
                  </h4>
                  <span className="text-xs text-slate-500">
                    Instant sync with Customer Portal
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allBookings.slice(0, 4).map((job: any) => {
                    const assignedTruck = allVehicles.find((v: any) => v.id === job.assignedVehicleId);
                    return (
                      <div
                        key={job.id}
                        className="p-4 rounded-[12px] bg-[#F2F5FA] border border-slate-200 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-tabular font-bold text-[#00529E]">
                            {job.referenceNumber} · {job.preferredDate} ({job.preferredTime})
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#00529E] text-white font-bold text-[11px]">
                            {job.status}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-[#0B1F3A]">
                          {job.customerName} ({job.customerPhone})
                        </div>
                        <div className="text-slate-600">
                          <strong>Route:</strong> {job.fromDistrict} (Floor {job.fromFloor}) → {job.toDistrict} (Floor {job.toFloor})
                        </div>
                        {assignedTruck && (
                          <div className="text-[#00529E] font-semibold flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-[#F1980A]" />
                            <span>
                              {assignedTruck.plateNumber} ({assignedTruck.name}) — Driver: {assignedTruck.driverName}
                            </span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await authedFetch(`/api/admin/bookings/${job.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  status: 'Confirmed',
                                  note: 'Driver & Crew Dispatched',
                                }),
                              });
                              fetchErpData();
                              showNotice(`${job.referenceNumber}: Crew Dispatched`);
                            }}
                            className="py-1.5 px-2 rounded bg-white hover:bg-[#00529E] hover:text-white border border-slate-300 font-bold text-[11px] cursor-pointer transition-colors"
                          >
                            1. Dispatched
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await authedFetch(`/api/admin/bookings/${job.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  status: 'In progress',
                                  note: 'Truck Loading & En Route (Live GPS Active)',
                                }),
                              });
                              fetchErpData();
                              showNotice(`${job.referenceNumber}: Move In Progress`);
                            }}
                            className="py-1.5 px-2 rounded bg-[#F1980A] text-white font-bold text-[11px] cursor-pointer transition-colors"
                          >
                            2. In Progress
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await authedFetch(`/api/admin/bookings/${job.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  status: 'Completed',
                                  note: 'All items delivered & placed in rooms',
                                }),
                              });
                              fetchErpData();
                              showNotice(`${job.referenceNumber}: Job Completed!`);
                            }}
                            className="py-1.5 px-2 rounded bg-emerald-600 text-white font-bold text-[11px] cursor-pointer transition-colors"
                          >
                            3. Completed ✓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {activeRoleView !== 'Staff' && (
                <div className="bg-white p-6 rounded-[18px] border border-slate-200/90 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                        {editingStaffId
                          ? `Edit Staff Member (#${editingStaffId}) — Photo, Role & ID Card`
                          : 'Add New Staff Member (With ID Photo Upload & QR Code)'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Upload a staff portrait photo from your device or paste an image URL to print on their ISO CR80 ID Card.
                      </p>
                    </div>
                    {editingStaffId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStaffId(null);
                          setNewStaffName('');
                          setNewStaffPhone('+252 61 ');
                          setNewStaffRate('25');
                          setNewStaffIdCard('SO-MOG-');
                          setNewStaffPhotoUrl('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        placeholder="e.g., Cabdullaahi Maxamed"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Role *</label>
                      <select
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                      >
                        <option value="supervisor">Supervisor / Crew Leader</option>
                        <option value="driver">Driver (Darawal)</option>
                        <option value="mover">Mover / Carpenter</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Phone *</label>
                      <input
                        type="text"
                        value={newStaffPhone}
                        onChange={(e) => setNewStaffPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Daily Rate ($)</label>
                      <input
                        type="number"
                        value={newStaffRate}
                        onChange={(e) => setNewStaffRate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">ID Card Number *</label>
                      <input
                        type="text"
                        value={newStaffIdCard}
                        onChange={(e) => setNewStaffIdCard(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular font-bold text-[#00529E]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Upload ID Photo</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setNewStaffPhotoUrl(reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="w-full text-[11px] file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-[#00529E]/10 file:text-[#00529E] file:font-bold cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                      {newStaffPhotoUrl && (
                        <img
                          src={newStaffPhotoUrl}
                          alt="Staff Preview"
                          className="w-11 h-11 rounded-xl object-cover border-2 border-[#00529E]"
                        />
                      )}
                      <input
                        type="text"
                        placeholder="Or paste Staff Portrait Image URL (https://...)"
                        value={newStaffPhotoUrl}
                        onChange={(e) => setNewStaffPhotoUrl(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!newStaffName) return;
                        if (editingStaffId) {
                          await authedFetch(`/api/admin/staff/${editingStaffId}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              name: newStaffName,
                              role: newStaffRole,
                              phone: newStaffPhone,
                              dailyRate: newStaffRate,
                              idCardNumber: newStaffIdCard,
                              photoUrl: newStaffPhotoUrl,
                            }),
                          });
                          showNotice(`Updated staff member ${newStaffName}!`);
                        } else {
                          await authedFetch('/api/admin/staff', {
                            method: 'POST',
                            body: JSON.stringify({
                              name: newStaffName,
                              role: newStaffRole,
                              phone: newStaffPhone,
                              dailyRate: newStaffRate,
                              idCardNumber: newStaffIdCard,
                              photoUrl: newStaffPhotoUrl,
                            }),
                          });
                          showNotice(`Added staff member ${newStaffName} with ID Card!`);
                        }
                        setEditingStaffId(null);
                        setNewStaffName('');
                        setNewStaffPhotoUrl('');
                        fetchErpData();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#00529E] hover:bg-[#00447F] text-white text-xs font-extrabold cursor-pointer shadow-sm"
                    >
                      {editingStaffId ? '✓ Save Staff Changes' : '+ Add Staff Member'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allStaff.map((member: any) => (
                  <div
                    key={member.id}
                    className="bg-white p-5 rounded-[18px] border border-slate-200/90 shadow-xs space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-[#00529E] to-[#0B1F3A] text-white font-bold flex items-center justify-center shrink-0 border-2 border-[#00529E] shadow-xs">
                            {member.photoUrl ? (
                              <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg">
                                {member.name
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .join('')
                                  .slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-[#0B1F3A]">{member.name}</div>
                            <div className="text-xs text-[#F1980A] font-bold uppercase">{member.role}</div>
                            <div className="text-[11px] font-mono-tabular font-bold text-[#00529E] mt-0.5">
                              ID: {member.idCardNumber}
                            </div>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                          {member.availability}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 font-mono-tabular bg-[#F3F6FD] p-3 rounded-xl">
                        <div>Tel: {member.phone}</div>
                        <div>Daily Rate: ${member.dailyRate}/day · Jobs Done: {member.jobsCompleted}</div>
                      </div>

                      {/* Edit, Delete & Attendance Row */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaffId(member.id);
                            setNewStaffName(member.name);
                            setNewStaffRole(member.role);
                            setNewStaffPhone(member.phone);
                            setNewStaffRate(String(member.dailyRate));
                            setNewStaffIdCard(member.idCardNumber);
                            setNewStaffPhotoUrl(member.photoUrl || '');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-[#00529E] text-slate-700 hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          ✎ Edit / Photo
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await authedFetch(`/api/admin/staff/${member.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                attendanceEntry: {
                                  jobRef: allBookings[0]?.referenceNumber || 'SR-2026-0001',
                                  date: new Date().toISOString().slice(0, 10),
                                  status: 'Present',
                                },
                              }),
                            });
                            fetchErpData();
                            showNotice(`Marked attendance for ${member.name}`);
                          }}
                          className="py-1.5 px-2 rounded-lg bg-[#F3F6FD] hover:bg-slate-200 text-[#0B1F3A] text-[11px] font-bold cursor-pointer"
                        >
                          + Attendance
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await authedFetch(`/api/admin/staff/${member.id}`, {
                              method: 'DELETE',
                            });
                            fetchErpData();
                            showNotice(`Deleted staff member ${member.name}`);
                          }}
                          className="py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          ✕ Delete
                        </button>
                      </div>
                    </div>

                    {/* Print ID Card (Front + Back), Contract & Live QR Verification */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setPrintDoc({
                            docType: 'STAFF_ID_CARD',
                            docNumber: member.idCardNumber || `SO-MOG-0${member.id}`,
                            date: new Date().toISOString().slice(0, 10),
                            customerName: member.name,
                            customerPhone: member.phone,
                            staffMember: {
                              name: member.name,
                              role: member.role,
                              phone: member.phone,
                              idCardNumber: member.idCardNumber,
                              dailyRateUsd: String(member.dailyRate),
                              photoUrl: member.photoUrl || '',
                            },
                            subtotal: String(member.dailyRate),
                            total: String(member.dailyRate),
                          })
                        }
                        className="py-2 px-2 rounded-lg bg-[#00529E] hover:bg-[#00447F] text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Printer className="w-3 h-3" /> Print ID Card
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPrintDoc({
                            docType: 'STAFF_CONTRACT',
                            docNumber: `EMP-2026-0${member.id}`,
                            date: new Date().toISOString().slice(0, 10),
                            customerName: member.name,
                            customerPhone: member.phone,
                            staffMember: {
                              name: member.name,
                              role: member.role,
                              phone: member.phone,
                              idCardNumber: member.idCardNumber,
                              dailyRateUsd: String(member.dailyRate),
                              photoUrl: member.photoUrl || '',
                            },
                            subtotal: String(member.dailyRate),
                            total: String(member.dailyRate),
                          })
                        }
                        className="py-2 px-2 rounded-lg bg-[#F1980A]/15 hover:bg-[#F1980A] text-[#F1980A] hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Printer className="w-3 h-3" /> 11 · Contract
                      </button>
                      <a
                        href={`${window.location.origin}/?verify_staff=${encodeURIComponent(member.idCardNumber || `SO-MOG-00${member.id}`)}`}
                        className="py-2 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <ShieldCheck className="w-3 h-3" /> Verify QR
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE 7: VEHICLES, LIVE GPS FLEET RADAR & DRIVER BEACON */}
          {activeModule === 'vehicles' && (
            <div className="space-y-6">
              {/* Live GPS Fleet Command Banner */}
              <div className="bg-[#0B1F3A] text-white rounded-[16px] p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F1980A]">
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>SOORAR LIVE GPS FLEET TELEMETRY · MOGADISHU</span>
                  </div>
                  <h3 className="text-xl font-bold">
                    Real-Time Truck GPS Tracking & Driver Smartphone Beacon
                  </h3>
                  <p className="text-xs text-white/80 max-w-2xl">
                    Every driver can broadcast their live smartphone GPS coordinates (HTML5 Geolocation) or update their Mogadishu district checkpoint in 1 click — immediately updating the customer&apos;s live map!
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {allVehicles.length} Trucks Online
                  </span>
                </div>
              </div>

              {/* Add / Edit Truck Form */}
              <div className="bg-white p-5 rounded-[16px] border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-[#0B1F3A]">
                    {editingVehicleId
                      ? `Edit Truck (#${editingVehicleId})`
                      : 'Add New Moving Truck to SOORAR Fleet'}
                  </h4>
                  {editingVehicleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVehicleId(null);
                        setNewVehiclePlate('MOG-');
                        setNewVehicleName('');
                        setNewVehicleDriver('');
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Plate Number *</label>
                    <input
                      type="text"
                      value={newVehiclePlate}
                      onChange={(e) => setNewVehiclePlate(e.target.value)}
                      placeholder="MOG-5920-B"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Truck Name / Model *</label>
                    <input
                      type="text"
                      value={newVehicleName}
                      onChange={(e) => setNewVehicleName(e.target.value)}
                      placeholder="SOORAR-4 (Isuzu Box)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Capacity / Type</label>
                    <select
                      value={newVehicleCapacity}
                      onChange={(e) => setNewVehicleCapacity(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    >
                      <option value="3.5-Ton Enclosed Box Truck (22 m³)">3.5-Ton Box Truck (22 m³)</option>
                      <option value="5-Ton Enclosed Moving Truck (32 m³)">5-Ton Villa Truck (32 m³)</option>
                      <option value="10-Ton Commercial Heavy Truck (55 m³)">10-Ton Commercial (55 m³)</option>
                      <option value="Rapid Pickup Van (10 m³)">Rapid Pickup Van (10 m³)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Assigned Driver</label>
                    <input
                      type="text"
                      value={newVehicleDriver}
                      onChange={(e) => setNewVehicleDriver(e.target.value)}
                      placeholder="Driver Name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newVehiclePlate || !newVehicleName) return;
                      if (editingVehicleId) {
                        await authedFetch(`/api/admin/vehicles/${editingVehicleId}`, {
                          method: 'PATCH',
                          body: JSON.stringify({
                            plateNumber: newVehiclePlate,
                            name: newVehicleName,
                            capacity: newVehicleCapacity,
                            driverName: newVehicleDriver,
                          }),
                        });
                        showNotice(`Updated truck ${newVehiclePlate}`);
                      } else {
                        await authedFetch('/api/admin/vehicles', {
                          method: 'POST',
                          body: JSON.stringify({
                            plateNumber: newVehiclePlate,
                            name: newVehicleName,
                            capacity: newVehicleCapacity,
                            driverName: newVehicleDriver,
                            status: 'Available',
                          }),
                        });
                        showNotice(`Added truck ${newVehiclePlate} to fleet!`);
                      }
                      setEditingVehicleId(null);
                      setNewVehicleName('');
                      setNewVehicleDriver('');
                      fetchErpData();
                    }}
                    className="py-2 px-4 rounded-xl bg-[#00529E] hover:bg-[#00447F] text-white font-bold cursor-pointer"
                  >
                    {editingVehicleId ? '✓ Save Truck' : '+ Add Truck'}
                  </button>
                </div>
              </div>

              {/* Fleet Cards with Live GPS Map & 1-Click Driver GPS Broadcast */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {allVehicles.map((v: any) => (
                  <div
                    key={v.id}
                    className="bg-white rounded-[16px] border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between"
                  >
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-md bg-[#00529E]/10 font-mono-tabular font-bold text-xs text-[#00529E]">
                          {v.plateNumber}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            v.status === 'Available'
                              ? 'bg-emerald-50 text-emerald-700'
                              : v.status === 'On Job'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-base text-[#0B1F3A]">{v.name}</div>
                        <div className="text-xs text-slate-500">{v.capacity}</div>
                      </div>

                      <div className="p-3 rounded-[10px] bg-[#F2F5FA] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Assigned Driver:</span>
                          <span className="font-bold text-[#0B1F3A]">{v.driverName || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Live Speed & Ping:</span>
                          <span className="font-mono-tabular font-semibold text-emerald-700">
                            {v.speedKmh ?? 35} km/h · {v.lastGpsPingAt || 'Live'}
                          </span>
                        </div>
                        <div className="pt-1 text-[#00529E] font-semibold flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#F1980A] shrink-0" />
                          <span className="truncate">
                            {v.currentLocationLabel || 'Jidka Maka Al-Mukarama · KM4'}
                          </span>
                        </div>
                      </div>

                      {/* Embedded Live Google Map for this Truck */}
                      <div className="rounded-[10px] overflow-hidden border border-slate-200 h-40 bg-slate-100">
                        <iframe
                          title={`GPS Map ${v.plateNumber}`}
                          src={`https://maps.google.com/maps?q=${v.currentLat || '2.0371'},${v.currentLng || '45.3182'}&z=14&output=embed`}
                          className="w-full h-full border-0"
                          loading="lazy"
                        />
                      </div>

                      {/* Driver Quick Checkpoint & Smartphone GPS Broadcast Controls */}
                      <div className="pt-2 space-y-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase">
                          Update Truck District / Road Checkpoint:
                        </label>
                        <select
                          value={v.currentLocationLabel || ''}
                          onChange={async (e) => {
                            const selectedLabel = e.target.value;
                            const presets: Record<string, { lat: string; lng: string; speed: number }> = {
                              'Jidka Maka Al-Mukarama · KM4, Hodan': { lat: '2.0371', lng: '45.3182', speed: 38 },
                              'Degmada Wadajir · Buulo Xuubey (En Route)': { lat: '2.0258', lng: '45.3014', speed: 44 },
                              'Degmada Cabdicasiis · Liido Road': { lat: '2.0492', lng: '45.3418', speed: 25 },
                              'Degmada Karaan · Jidka Warshadaha': { lat: '2.0615', lng: '45.3560', speed: 40 },
                              'Degmada Dharkenley · Suuqa Boocle': { lat: '2.0190', lng: '45.2840', speed: 32 },
                              'Degmada Xamar Weyne · Via Roma': { lat: '2.0335', lng: '45.3435', speed: 20 },
                            };
                            const coords = presets[selectedLabel] || { lat: '2.0371', lng: '45.3182', speed: 0 };
                            await authedFetch(`/api/admin/vehicles/${v.id}/gps`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                currentLat: coords.lat,
                                currentLng: coords.lng,
                                currentLocationLabel: selectedLabel,
                                speedKmh: 0,
                                status: 'On Job',
                              }),
                            });
                            fetchErpData();
                            showNotice(`Live GPS updated for ${v.plateNumber}`);
                          }}
                          className="w-full px-2.5 py-2 rounded-[8px] border border-slate-300 text-xs font-medium"
                        >
                          <option value="Jidka Maka Al-Mukarama · KM4, Hodan">
                            Jidka Maka Al-Mukarama · KM4, Hodan
                          </option>
                          <option value="Degmada Wadajir · Buulo Xuubey (En Route)">
                            Degmada Wadajir · Buulo Xuubey (En Route)
                          </option>
                          <option value="Degmada Cabdicasiis · Liido Road">
                            Degmada Cabdicasiis · Liido Road
                          </option>
                          <option value="Degmada Karaan · Jidka Warshadaha">
                            Degmada Karaan · Jidka Warshadaha
                          </option>
                          <option value="Degmada Dharkenley · Suuqa Boocle">
                            Degmada Dharkenley · Suuqa Boocle
                          </option>
                          <option value="Degmada Xamar Weyne · Via Roma">
                            Degmada Xamar Weyne · Via Roma
                          </option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            if (!('geolocation' in navigator)) {
                              showNotice(lang === 'so' ? 'Telefoonkan GPS ma taageero.' : 'This device has no GPS support.', 'error');
                            } else {
                              navigator.geolocation.getCurrentPosition(
                                async (pos) => {
                                  const lat = pos.coords.latitude.toFixed(4);
                                  const lng = pos.coords.longitude.toFixed(4);
                                  await authedFetch(`/api/admin/vehicles/${v.id}/gps`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      currentLat: lat,
                                      currentLng: lng,
                                      currentLocationLabel: `Driver Live GPS (${lat}, ${lng})`,
                                      speedKmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
                                      status: 'On Job',
                                    }),
                                  });
                                  fetchErpData();
                                  showNotice(`Broadcasted live phone GPS for ${v.plateNumber}!`);
                                },
                                (err) => {
                                  showNotice(
                                    lang === 'so'
                                      ? `GPS-ka telefoonka lama heli karo (${err.message}). Fadlan oggolow Location.`
                                      : `Could not read phone GPS (${err.message}). Please allow location access.`,
                                    'error'
                                  );
                                },
                                { enableHighAccuracy: true, timeout: 15000 }
                              );
                            }
                          }}
                          className="w-full py-2 px-3 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-[#F1980A]" />
                          Broadcast My Phone GPS Now
                        </button>

                        {/* Edit & Delete Truck Row */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVehicleId(v.id);
                              setNewVehiclePlate(v.plateNumber);
                              setNewVehicleName(v.name);
                              setNewVehicleCapacity(v.capacity);
                              setNewVehicleDriver(v.driverName || '');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-[#00529E] text-slate-700 hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            ✎ Edit Truck
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await authedFetch(`/api/admin/vehicles/${v.id}`, { method: 'DELETE' });
                              fetchErpData();
                              showNotice(`Removed truck ${v.plateNumber}`);
                            }}
                            className="py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            ✕ Delete Truck
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white p-5 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-[#0B1F3A]">Record Truck Fuel or Maintenance Log</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <select
                    value={newLogVehicleId}
                    onChange={(e) => setNewLogVehicleId(Number(e.target.value))}
                    className="px-3 py-2 rounded border border-slate-300 text-xs"
                  >
                    {allVehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} — {v.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newLogType}
                    onChange={(e) => setNewLogType(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 text-xs"
                  >
                    <option value="Fuel">Fuel (Diesel)</option>
                    <option value="Maintenance">Maintenance / Service</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Cost USD"
                    value={newLogCost}
                    onChange={(e) => setNewLogCost(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 text-xs font-mono-tabular"
                  />
                  <input
                    type="text"
                    placeholder="Liters or Service Details"
                    value={newLogDetails}
                    onChange={(e) => setNewLogDetails(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newLogCost || !newLogDetails) return;
                      await authedFetch('/api/admin/vehicle-logs', {
                        method: 'POST',
                        body: JSON.stringify({
                          vehicleId: newLogVehicleId,
                          logType: newLogType,
                          cost: newLogCost,
                          litersOrDetails: newLogDetails,
                        }),
                      });
                      setNewLogCost('');
                      setNewLogDetails('');
                      fetchErpData();
                      showNotice('Vehicle log saved!');
                    }}
                    className="px-4 py-2 rounded-full bg-[#00529E] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Log
                  </button>
                </div>

                <div className="divide-y divide-slate-100 pt-2">
                  {allVehicleLogs.map((log: any) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-[#00529E]">{log.logType}</span> — {log.litersOrDetails}
                      </div>
                      <div className="font-mono-tabular">
                        <span className="font-bold text-[#0B1F3A]">${log.cost}</span> · {log.logDate}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 8: INVENTORY CHECKLIST & SIGNATURES */}
          {activeModule === 'inventory' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-[#0B1F3A]">
                      Per-Booking Inventory Checklist & Condition Sign-Off
                    </h3>
                    <p className="text-xs text-slate-500">
                      Track box numbers, item condition before pickup and after delivery, and customer digital sign-off.
                    </p>
                  </div>
                  <select
                    value={invBookingId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setInvBookingId(id);
                      const found = allBookings.find((b: any) => b.id === id);
                      if (found) {
                        setPickupSigInput(found.pickupSignature || '');
                        setDeliverySigInput(found.deliverySignature || '');
                      }
                    }}
                    className="px-3.5 py-2 rounded-[8px] border border-slate-300 text-xs font-semibold"
                  >
                    {allBookings.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.referenceNumber} — {b.customerName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Add Checklist Item */}
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 pt-2">
                  <input
                    type="text"
                    placeholder="Item Name (e.g., Turkish Wardrobe)"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 rounded border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Box # (BOX-01)"
                    value={newBoxNumber}
                    onChange={(e) => setNewBoxNumber(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 text-xs font-mono-tabular"
                  />
                  <input
                    type="text"
                    placeholder="Condition Before"
                    value={newCondBefore}
                    onChange={(e) => setNewCondBefore(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Condition After"
                    value={newCondAfter}
                    onChange={(e) => setNewCondAfter(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newItemName) return;
                      await authedFetch('/api/admin/booking-items', {
                        method: 'POST',
                        body: JSON.stringify({
                          bookingId: invBookingId,
                          itemName: newItemName,
                          boxNumber: newBoxNumber,
                          quantity: newItemQty,
                          conditionBefore: newCondBefore,
                          conditionAfter: newCondAfter,
                        }),
                      });
                      setNewItemName('');
                      setNewBoxNumber('');
                      fetchErpData();
                      showNotice('Checklist item added!');
                    }}
                    className="px-4 py-2 rounded-full bg-[#00529E] text-white text-xs font-semibold cursor-pointer"
                  >
                    + Add Item
                  </button>
                </div>

                {/* Checklist Table */}
                <table className="w-full text-left border-collapse text-xs mt-4">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F2F5FA]/60 text-slate-500">
                      <th className="py-2.5 px-3">Box / Tag #</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">Condition at Pickup</th>
                      <th className="py-2.5 px-3">Condition at Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allBookingItems
                      .filter((item: any) => item.bookingId === invBookingId)
                      .map((item: any) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#00529E]">
                            {item.boxNumber || 'ITEM'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">{item.itemName}</td>
                          <td className="py-2.5 px-3 font-mono-tabular">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-slate-700">{item.conditionBefore}</td>
                          <td className="py-2.5 px-3 text-emerald-700 font-semibold">{item.conditionAfter}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {/* Digital Signatures at Pickup & Delivery */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div className="p-4 rounded-[14px] bg-[#F2F5FA] space-y-2">
                    <label className="block text-xs font-bold text-[#0B1F3A]">
                      Customer Pickup Signature (Saxiixa Qaadista)
                    </label>
                    <input
                      type="text"
                      placeholder="Type full name to sign pickup..."
                      value={pickupSigInput}
                      onChange={(e) => setPickupSigInput(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs italic font-semibold"
                    />
                  </div>
                  <div className="p-4 rounded-[14px] bg-[#F2F5FA] space-y-2">
                    <label className="block text-xs font-bold text-[#0B1F3A]">
                      Customer Delivery Signature (Saxiixa Dejinta)
                    </label>
                    <input
                      type="text"
                      placeholder="Type full name to sign delivery..."
                      value={deliverySigInput}
                      onChange={(e) => setDeliverySigInput(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs italic font-semibold"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      await authedFetch(`/api/admin/bookings/${invBookingId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          pickupSignature: pickupSigInput,
                          deliverySignature: deliverySigInput,
                        }),
                      });
                      fetchErpData();
                      showNotice('Customer pickup & delivery signatures saved!');
                    }}
                    className="px-5 py-2 rounded-full bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Customer Signatures
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 10: PACKING MATERIALS & STOCK INVENTORY */}
          {activeModule === 'packing_stock' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Packing Materials & Consumables Stock (Boxes, Bubble Wrap, Stretch Film, Tape, Blankets, Straps)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  <input
                    type="text"
                    placeholder="Item Name (English)"
                    value={newMatNameEn}
                    onChange={(e) => setNewMatNameEn(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Magaca (Af-Soomaali)"
                    value={newMatNameSo}
                    onChange={(e) => setNewMatNameSo(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <select
                    value={newMatCategory}
                    onChange={(e) => setNewMatCategory(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  >
                    <option value="Boxes">Boxes (Kartoonno)</option>
                    <option value="Bubble Wrap">Bubble Wrap (Xumbo)</option>
                    <option value="Stretch Film">Stretch Film (Baco Duubis)</option>
                    <option value="Tape">Packing Tape (Xirmo)</option>
                    <option value="Blankets">Moving Blankets (Bustayaal)</option>
                    <option value="Straps">Cargo Straps & Tools</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Initial Stock Qty"
                    value={newMatQty}
                    onChange={(e) => setNewMatQty(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newMatNameEn) return;
                      await authedFetch('/api/admin/packing-materials', {
                        method: 'POST',
                        body: JSON.stringify({
                          nameEn: newMatNameEn,
                          nameSo: newMatNameSo || newMatNameEn,
                          category: newMatCategory,
                          qtyAvailable: newMatQty,
                          unitCostUsd: newMatCost,
                        }),
                      });
                      setNewMatNameEn('');
                      setNewMatNameSo('');
                      fetchErpData();
                      showNotice('Packing material SKU added to warehouse!');
                    }}
                    className="px-4 py-2 rounded-full bg-[#00529E] text-white font-semibold cursor-pointer"
                  >
                    + Add Stock SKU
                  </button>
                </div>

                <table className="w-full text-left border-collapse text-xs mt-4">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F2F5FA] text-slate-600">
                      <th className="py-3 px-3">SKU</th>
                      <th className="py-3 px-3">Material Name (EN / SO)</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">In Stock</th>
                      <th className="py-3 px-3">Unit Cost</th>
                      <th className="py-3 px-3 text-right">Issue / Return Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allPackingMaterials.map((m: any) => (
                      <tr key={m.id}>
                        <td className="py-3 px-3 font-mono-tabular font-bold text-[#00529E]">{m.sku}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#0B1F3A]">{m.nameEn}</div>
                          <div className="text-slate-500">{m.nameSo}</div>
                        </td>
                        <td className="py-3 px-3">{m.category}</td>
                        <td className="py-3 px-3 font-mono-tabular font-bold">
                          <span className={m.qtyAvailable <= m.reorderLevel ? 'text-red-600' : 'text-emerald-700'}>
                            {m.qtyAvailable} {m.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono-tabular">${m.unitCostUsd}</td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await authedFetch(`/api/admin/packing-materials/${m.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ deltaQty: -10 }),
                              });
                              fetchErpData();
                              showNotice(`Issued 10 ${m.unit} of ${m.nameEn} to job`);
                            }}
                            className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold cursor-pointer"
                          >
                            -10 Issue to Job
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await authedFetch(`/api/admin/packing-materials/${m.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ deltaQty: 25 }),
                              });
                              fetchErpData();
                              showNotice(`Restocked +25 ${m.unit} of ${m.nameEn}`);
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold cursor-pointer"
                          >
                            +25 Restock
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await authedFetch(`/api/admin/packing-materials/${m.id}`, {
                                method: 'DELETE',
                              });
                              fetchErpData();
                              showNotice(`Deleted SKU ${m.sku}`);
                            }}
                            className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 11: WAREHOUSE & STORAGE MANAGEMENT */}
          {activeModule === 'warehouse_storage' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  SOORAR Mogadishu Warehouse & Storage Bays (Short & Long-Term Storage Contracts)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  <input
                    type="text"
                    placeholder="Bay Code (e.g., BAY-B02)"
                    value={newBayCode}
                    onChange={(e) => setNewBayCode(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                  />
                  <input
                    type="text"
                    placeholder="Customer / Organization"
                    value={newBayCustomer}
                    onChange={(e) => setNewBayCustomer(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Phone (+252)"
                    value={newBayPhone}
                    onChange={(e) => setNewBayPhone(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                  />
                  <input
                    type="text"
                    placeholder="Stored Items Summary"
                    value={newBayItems}
                    onChange={(e) => setNewBayItems(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newBayCode || !newBayCustomer) return;
                      await authedFetch('/api/admin/storage-units', {
                        method: 'POST',
                        body: JSON.stringify({
                          unitCode: newBayCode,
                          sizeM3: newBaySize,
                          monthlyRateUsd: newBayRate,
                          status: 'Occupied',
                          customerName: newBayCustomer,
                          customerPhone: newBayPhone,
                          storedItemsSummary: newBayItems,
                        }),
                      });
                      setNewBayCustomer('');
                      setNewBayItems('');
                      fetchErpData();
                      showNotice('Warehouse storage bay assigned!');
                    }}
                    className="px-4 py-2 rounded-full bg-[#00529E] text-white font-semibold cursor-pointer"
                  >
                    + Assign Storage Bay
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                  {allStorageUnits.map((u: any) => (
                    <div key={u.id} className="p-4 rounded-[14px] bg-[#F2F5FA] border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tabular font-bold text-sm text-[#00529E]">{u.unitCode}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          {u.status} · {u.sizeM3} m³
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#0B1F3A]">{u.customerName || 'Available Bay'}</div>
                      <div className="text-slate-600">{u.storedItemsSummary || 'Ready for palletized furniture'}</div>
                      <div className="font-mono-tabular text-slate-500">
                        Rate: <strong>${u.monthlyRateUsd}/month</strong> · QR: {u.barcodeTag}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPrintDoc({
                            docType: 'STORAGE_CONTRACT',
                            docNumber: u.contractNumber || `STR-${u.unitCode}`,
                            date: u.startDate || '2026-10-10',
                            customerName: u.customerName || 'SOORAR Storage Client',
                            customerPhone: u.customerPhone || '+252',
                            subtotal: String(u.monthlyRateUsd),
                            total: String(u.monthlyRateUsd),
                            notes: `Bay ${u.unitCode} (${u.sizeM3} m³) — ${u.storedItemsSummary} · Tag: ${u.barcodeTag}`,
                          })
                        }
                        className="w-full py-1.5 rounded bg-white border border-slate-300 font-semibold text-[#0B1F3A] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#00529E]" /> Print Storage Contract PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 12: SUPPLIERS & PURCHASE ORDERS */}
          {activeModule === 'suppliers_po' && (
            <div className="space-y-6">
              <SuppliersManager
                lang={lang}
                api={authedFetch}
                suppliers={allSuppliers}
                purchaseOrders={allPurchaseOrders}
                canDelete={canManage}
                onNotice={showNotice}
                onChanged={fetchErpData}
              />
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Suppliers & Official Purchase Orders (Packing Materials, Fuel Stations, Garages, Subcontract Trucks)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <select
                    value={poSupplier}
                    onChange={(e) => setPoSupplier(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  >
                    {allSuppliers.map((s: any) => (
                      <option key={s.id} value={s.companyName}>
                        {s.companyName} ({s.category})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Order Items (e.g., 300 5-Ply Boxes & 20 Rolls Wrap)"
                    value={poItems}
                    onChange={(e) => setPoItems(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 rounded border border-slate-300"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Total USD"
                      value={poTotal}
                      onChange={(e) => setPoTotal(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!poItems || !poTotal) return;
                        await authedFetch('/api/admin/purchase-orders', {
                          method: 'POST',
                          body: JSON.stringify({
                            supplierName: poSupplier,
                            itemsSummary: poItems,
                            totalUsd: poTotal,
                          }),
                        });
                        setPoItems('');
                        setPoTotal('');
                        fetchErpData();
                        showNotice('Official Purchase Order issued!');
                      }}
                      className="px-4 py-2 rounded-full bg-[#F1980A] text-white font-semibold shrink-0 cursor-pointer"
                    >
                      + Issue PO
                    </button>
                  </div>
                </div>

                <table className="w-full text-left border-collapse text-xs mt-4">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F2F5FA] text-slate-600">
                      <th className="py-3 px-4">PO Number</th>
                      <th className="py-3 px-4">Supplier (Mogadishu)</th>
                      <th className="py-3 px-4">Items Ordered</th>
                      <th className="py-3 px-4">Total USD</th>
                      <th className="py-3 px-4 text-right">Official PO PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allPurchaseOrders.map((po: any) => (
                      <tr key={po.id}>
                        <td className="py-3 px-4 font-mono-tabular font-bold text-[#00529E]">{po.poNumber}</td>
                        <td className="py-3 px-4 font-bold">{po.supplierName}</td>
                        <td className="py-3 px-4">{po.itemsSummary}</td>
                        <td className="py-3 px-4 font-mono-tabular font-bold">${po.totalUsd}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setPrintDoc({
                                docType: 'PURCHASE_ORDER',
                                docNumber: po.poNumber,
                                date: po.orderDate,
                                customerName: po.supplierName,
                                customerPhone: '+252 61 550 1122',
                                lineItems: [
                                  {
                                    description: po.itemsSummary,
                                    qty: 1,
                                    unitPrice: Number(po.totalUsd),
                                    total: Number(po.totalUsd),
                                  },
                                ],
                                subtotal: String(po.totalUsd),
                                total: String(po.totalUsd),
                              })
                            }
                            className="px-3 py-1 rounded-full bg-[#F2F5FA] hover:bg-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3 text-[#00529E]" /> Print PO PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 13: DAMAGE CLAIMS & QUALITY CONTROL */}
          {activeModule === 'damage_claims' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Damage Claims, Incident Investigation & Customer Quality Resolution
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  <input
                    type="text"
                    placeholder="Booking Ref (SR-2026-0001)"
                    value={claimBookingRef}
                    onChange={(e) => setClaimBookingRef(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                  />
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={claimCustomer}
                    onChange={(e) => setClaimCustomer(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Affected Item (e.g., Mirror)"
                    value={claimItem}
                    onChange={(e) => setClaimItem(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Incident & Resolution Notes"
                    value={claimDesc}
                    onChange={(e) => setClaimDesc(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!claimCustomer || !claimItem) return;
                      await authedFetch('/api/admin/damage-claims', {
                        method: 'POST',
                        body: JSON.stringify({
                          bookingRef: claimBookingRef,
                          customerName: claimCustomer,
                          itemAffected: claimItem,
                          description: claimDesc,
                          estimatedDamageUsd: claimEstUsd,
                        }),
                      });
                      setClaimCustomer('');
                      setClaimItem('');
                      setClaimDesc('');
                      fetchErpData();
                      showNotice('Incident report logged for quality resolution!');
                    }}
                    className="px-4 py-2 rounded-full bg-[#00529E] text-white font-semibold cursor-pointer"
                  >
                    + Log Incident
                  </button>
                </div>

                <table className="w-full text-left border-collapse text-xs mt-4">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F2F5FA] text-slate-600">
                      <th className="py-3 px-4">Claim #</th>
                      <th className="py-3 px-4">Booking & Client</th>
                      <th className="py-3 px-4">Item & Description</th>
                      <th className="py-3 px-4">Compensation</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Report PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allDamageClaims.map((c: any) => (
                      <React.Fragment key={c.id}>
                      <tr>
                        <td className="py-3 px-4 font-mono-tabular font-bold text-[#00529E]">{c.claimNumber}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold">{c.customerName}</div>
                          <div className="font-mono-tabular text-slate-500">{c.bookingRef}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#0B1F3A]">{c.itemAffected}</div>
                          <div className="text-slate-500">{c.description}</div>
                        </td>
                        <td className="py-3 px-4 font-mono-tabular font-bold text-emerald-700">
                          ${c.compensationUsd}
                        </td>
                        <td className="py-3 px-4 font-bold">{c.status}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setPrintDoc({
                                docType: 'DAMAGE_REPORT',
                                docNumber: c.claimNumber,
                                date: c.incidentDate,
                                customerName: c.customerName,
                                customerPhone: c.customerPhone || '+252',
                                bookingRef: c.bookingRef,
                                subtotal: String(c.compensationUsd || c.estimatedDamageUsd),
                                total: String(c.compensationUsd || c.estimatedDamageUsd),
                                notes: `${c.itemAffected}: ${c.description} — Resolution: ${c.resolutionNotes || 'Handled by SOORAR Quality Team'}`,
                              })
                            }
                            className="px-3 py-1 rounded-full bg-[#F2F5FA] hover:bg-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" /> Print Claim PDF
                          </button>{' '}
                          <button
                            type="button"
                            onClick={() => setClaimPhotosOpen(claimPhotosOpen === c.id ? null : c.id)}
                            className="px-3 py-1 rounded-full bg-[#F2F5FA] hover:bg-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Camera className="w-3 h-3 text-[#00529E]" /> {lang === 'so' ? 'Sawirro' : 'Photos'}
                          </button>
                        </td>
                      </tr>
                      {claimPhotosOpen === c.id && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 !bg-[#FAFBFD]">
                            <PhotoStrip
                              lang={lang}
                              api={authedFetch}
                              entityType="damage_claim"
                              entityId={c.id}
                              canDelete={canManage}
                              kinds={[{ id: 'damage', label: lang === 'so' ? 'Sawirada dhaawaca' : 'Damage photos' }]}
                            />
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 14: DOUBLE-ENTRY ACCOUNTING & GENERAL LEDGER */}
          {activeModule === 'accounting_ledger' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Chart of Accounts (USD / SOS) & Double-Entry General Ledger
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                  {allLedgerAccounts.map((acc: any) => (
                    <div key={acc.id} className="p-3.5 rounded-[12px] bg-[#F2F5FA] border border-slate-200">
                      <div className="flex justify-between text-[11px] font-mono-tabular text-slate-500">
                        <span>GL #{acc.accountCode}</span>
                        <span className="font-bold uppercase text-[#00529E]">{acc.accountType}</span>
                      </div>
                      <div className="font-bold text-[#0B1F3A] mt-1">{acc.accountName}</div>
                      <div className="text-lg font-bold font-mono-tabular text-emerald-700 mt-1">
                        ${Number(acc.balanceUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Post Manual Journal Entry */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  <input
                    type="text"
                    placeholder="Journal Description"
                    value={jeDesc}
                    onChange={(e) => setJeDesc(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Debit Account"
                    value={jeDebit}
                    onChange={(e) => setJeDebit(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Credit Account"
                    value={jeCredit}
                    onChange={(e) => setJeCredit(e.target.value)}
                    className="px-3 py-2 rounded border border-slate-300"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="USD"
                      value={jeAmount}
                      onChange={(e) => setJeAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!jeDesc || !jeAmount) return;
                        await authedFetch('/api/admin/journal-entries', {
                          method: 'POST',
                          body: JSON.stringify({
                            description: jeDesc,
                            debitAccount: jeDebit,
                            creditAccount: jeCredit,
                            amountUsd: jeAmount,
                          }),
                        });
                        setJeDesc('');
                        setJeAmount('');
                        fetchErpData();
                        showNotice('Double-entry journal posted!');
                      }}
                      className="px-4 py-2 rounded-full bg-[#00529E] text-white font-semibold shrink-0 cursor-pointer"
                    >
                      Post JE
                    </button>
                  </div>
                </div>

                <table className="w-full text-left border-collapse text-xs mt-4">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F2F5FA] text-slate-600">
                      <th className="py-2.5 px-3">JE #</th>
                      <th className="py-2.5 px-3">Date & Ref</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Debit (DR)</th>
                      <th className="py-2.5 px-3">Credit (CR)</th>
                      <th className="py-2.5 px-3 text-right">Amount USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allJournalEntries.map((je: any) => (
                      <tr key={je.id}>
                        <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#00529E]">{je.entryNumber}</td>
                        <td className="py-2.5 px-3 font-mono-tabular">
                          {je.entryDate} · {je.referenceDoc}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{je.description}</td>
                        <td className="py-2.5 px-3 text-emerald-700">{je.debitAccount}</td>
                        <td className="py-2.5 px-3 text-[#00529E]">{je.creditAccount}</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">${je.amountUsd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 17: OFFICIAL SOORAR DOCUMENTS HUB (ALL 15 BILINGUAL TEMPLATES) */}
          {activeModule === 'documents_hub' && (
            <DocumentsHub lang={lang} staff={allStaff} services={allServices} onOpen={(d) => setPrintDoc(d)} />
          )}

          {/* MODULE 9: EXPENSES */}
          {activeModule === 'expenses' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-[14px] border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3">
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="px-3 py-2 rounded border border-slate-300 text-xs"
                >
                  <option value="Fuel">Fuel (Shidaal)</option>
                  <option value="Maintenance">Maintenance (Cilad-bixin)</option>
                  <option value="Salaries">Salaries (Mushahar)</option>
                  <option value="Materials">Materials (Kartoonno & Xumbo)</option>
                  <option value="Office">Office (Xafiiska)</option>
                </select>
                <input
                  type="text"
                  placeholder="Expense Description"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="px-3 py-2 rounded border border-slate-300 text-xs"
                />
                <input
                  type="number"
                  placeholder="Amount USD"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="px-3 py-2 rounded border border-slate-300 text-xs font-mono-tabular"
                />
                <select value={expBookingId} onChange={(e) => setExpBookingId(e.target.value)} className="px-3 py-2 rounded border border-slate-300 text-xs" title={lang === 'so' ? 'Ku xir shaqo (faa’iidada shaqada)' : 'Link to a job (profit per job)'}>
                  <option value="">{lang === 'so' ? '— Shaqo (ikhtiyaari) —' : '— Job (optional) —'}</option>
                  {allBookings.slice(0, 200).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.referenceNumber} · {b.customerName}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!expDesc || !expAmount) return;
                    await authedFetch('/api/admin/expenses', {
                      method: 'POST',
                      body: JSON.stringify({
                        category: expCategory,
                        description: expDesc,
                        amount: expAmount,
                        bookingId: expBookingId || null,
                      }),
                    });
                    setExpDesc('');
                    setExpAmount('');
                    setExpBookingId('');
                    fetchErpData();
                    showNotice('Expense recorded!');
                  }}
                  className="px-4 py-2 rounded-full bg-[#F1980A] text-white text-xs font-semibold cursor-pointer"
                >
                  + Log Expense
                </button>
              </div>

              <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F2F5FA]/60 text-slate-500">
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allExpenses.map((e: any) => (
                      <tr key={e.id}>
                        <td className="py-3 px-4 font-bold text-[#00529E]">{e.category}</td>
                        <td className="py-3 px-4">{e.description}</td>
                        <td className="py-3 px-4 font-mono-tabular">{e.expenseDate}</td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-bold text-red-600">
                          -${e.amount}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {canFinance && (
                            <button type="button" title="Delete" onClick={() => confirmDelete(e.description, `/api/admin/expenses/${e.id}`)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 10: REPORTS & EXPORT */}
          {activeModule === 'reports' && (
            <div className="space-y-6">
              <ReportsModule lang={lang} bookings={allBookings} payments={allPayments} expenses={allExpenses} invoices={allInvoices} onPrint={(d) => setPrintDoc(d)} />
              {canFinance && <ProfitReports lang={lang} api={authedFetch} onPrint={(d) => setPrintDoc(d)} onNotice={showNotice} />}
            </div>
          )}

          {/* MODULE 11: CONTENT MANAGEMENT (CMS) */}
          {activeModule === 'cms' && (
            <div className="space-y-6">
              <GalleryManager lang={lang} api={authedFetch} gallery={allGallery} onNotice={showNotice} onChanged={() => { fetchErpData(); onRefreshPublic(); }} />
              {/* Edit Services & Prices */}
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Edit Services & Base Prices (Somali & English)
                </h3>
                <div className="space-y-4">
                  {allServices.map((srv: any) => (
                    <div key={srv.id} className="p-4 rounded-[14px] bg-[#F2F5FA] grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                      <div>
                        <div className="font-bold text-xs text-[#0B1F3A]">{srv.titleSo}</div>
                        <div className="text-xs text-slate-500">{srv.titleEn}</div>
                      </div>
                      <input
                        type="text"
                        defaultValue={srv.priceLabelSo}
                        onBlur={async (e) => {
                          await authedFetch(`/api/admin/services/${srv.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ ...srv, priceLabelSo: e.target.value }),
                          });
                          onRefreshPublic();
                          showNotice('Service updated!');
                        }}
                        className="px-3 py-1.5 rounded bg-white border border-slate-300 text-xs"
                      />
                      <input
                        type="number"
                        defaultValue={srv.basePrice}
                        onBlur={async (e) => {
                          await authedFetch(`/api/admin/services/${srv.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ ...srv, basePrice: e.target.value }),
                          });
                          onRefreshPublic();
                          showNotice('Service price updated!');
                        }}
                        className="px-3 py-1.5 rounded bg-white border border-slate-300 text-xs font-mono-tabular"
                      />
                      <div className="text-xs text-emerald-700 font-semibold">Auto-saves on blur</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews Moderation */}
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Customer Reviews Moderation (Approve / Hide)
                </h3>
                <div className="divide-y divide-slate-100">
                  {allReviews.map((r: any) => (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="font-bold text-[#0B1F3A]">
                          {r.customerName} ({r.district}) — {r.rating}★
                        </div>
                        <div className="text-slate-600 mt-0.5">{r.commentSo}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-slate-500">{r.status}</span>
                        <button
                          onClick={async () => {
                            const next = r.status === 'Approved' ? 'Hidden' : 'Approved';
                            await authedFetch(`/api/admin/reviews/${r.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: next }),
                            });
                            fetchErpData();
                            onRefreshPublic();
                            showNotice(`Review ${next}`);
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#00529E] text-white font-semibold cursor-pointer"
                        >
                          {r.status === 'Approved' ? 'Hide' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 12: SETTINGS, USER CREATION (ADMIN ONLY), WHATSAPP TEMPLATES & AUDIT LOG */}
          {activeModule === 'settings' && (
            <div className="space-y-6">
              {userTempPw && (
                <div className="erp-card p-4 border-l-4 !border-l-emerald-500">
                  <div className="text-sm font-semibold">{so ? 'Password ku-meel-gaar ah (hal mar ayuu muuqanayaa)' : 'Temporary password (shown once)'}</div>
                  <div className="text-xs text-slate-500">{userTempPw.who}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="px-3 py-2 rounded-lg bg-slate-100 font-mono-tabular text-lg tracking-wider">{userTempPw.pw}</code>
                    <button type="button" className="erp-btn erp-btn-ghost !text-xs" onClick={() => navigator.clipboard?.writeText(userTempPw.pw)}>{so ? 'Koobiyee' : 'Copy'}</button>
                    <button type="button" className="erp-btn erp-btn-ghost !text-xs" onClick={() => setUserTempPw(null)}>{so ? 'Xir' : 'Dismiss'}</button>
                  </div>
                  <div className="text-[11.5px] text-slate-500 mt-1.5">{so ? 'U dir si ammaan ah; ha beddelo marka uu galo (Beddel Password).' : 'Share privately; they should change it after signing in (Change password).'}</div>
                </div>
              )}
              {allUsers.some((u: any) => u.status !== 'Active') && (
                <div className="erp-card p-4 sm:p-5 border-l-4 !border-l-[#F1980A]">
                  <h3 className="erp-h3">{lang === 'so' ? 'Akoonno sugaya ogolaansho' : 'Accounts waiting for approval'}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === 'so'
                      ? 'Qof kasta oo Google ku soo galay oo aan ahayn milkiilaha wuxuu halkan ku sugayaa ilaa aad fasaxdo. Ha fasaxin qof aadan aqoon.'
                      : 'Anyone who signed in with Google (other than the owners) waits here until you approve them. Do not approve people you do not know.'}
                  </p>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {allUsers.filter((u: any) => u.status !== 'Active').map((u: any) => (
                      <li key={u.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{u.name || u.email}</div>
                          <div className="text-xs text-slate-500 truncate">{u.email} · {u.role}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await authedFetch(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Active' }) });
                                fetchErpData();
                                showNotice(lang === 'so' ? `${u.email} waa la fasaxay` : `${u.email} approved`);
                              } catch (e: any) {
                                showNotice(e.message, 'error');
                              }
                            }}
                            className="erp-btn erp-btn-primary !py-1.5 !text-xs"
                          >
                            {lang === 'so' ? 'Fasax' : 'Approve'}
                          </button>
                          <button type="button" onClick={() => confirmDelete(u.email, `/api/admin/users/${u.id}`)} className="erp-btn erp-btn-danger !py-1.5 !text-xs">
                            {lang === 'so' ? 'Tirtir' : 'Remove'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* ADMIN-ONLY: Create Staff / Manager / Accountant User Accounts */}
              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-[#0B1F3A]">
                    Abuurista User-rada Shaqaalaha & Maamulka (Admin-Only User Provisioning)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Shaqaalaha iyo Maamulka iyagu akoon ma samaysan karaan — Admin-ka oo keliya ayaa halkan uga abuuraya Email, Tel, Role iyo Password ay ku soo galaan nidaamka. (Macaamiishu iyagaa bogga hore ka samaysta akoonkooda).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Magaca (Full Name) *</label>
                    <input
                      type="text"
                      value={createUserName}
                      onChange={(e) => setCreateUserName(e.target.value)}
                      placeholder="Axmed Cali"
                      className="w-full px-3 py-2 rounded border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Email-ka Login-ka *</label>
                    <input
                      type="email"
                      value={createUserEmail}
                      onChange={(e) => setCreateUserEmail(e.target.value)}
                      placeholder="axmed@soorar.so"
                      className="w-full px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Taleefanka (+252)</label>
                    <input
                      type="text"
                      value={createUserPhone}
                      onChange={(e) => setCreateUserPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Doorka (Role) *</label>
                    <select
                      value={createUserRole}
                      onChange={(e) => setCreateUserRole(e.target.value as any)}
                      className="w-full px-3 py-2 rounded border border-slate-300 font-semibold text-[#00529E]"
                    >
                      <option value="Staff">Staff (Shaqaale)</option>
                      <option value="Driver">Driver (Darawal) · mobile</option>
                      <option value="Mover / Helper">Mover / Helper (Xamaal) · mobile</option>
                      <option value="Crew Leader">Crew Leader (Madaxa kooxda) · mobile</option>
                      <option value="Dispatcher">Dispatcher</option>
                      <option value="HR">HR</option>
                      <option value="Manager">Manager (Maamule)</option>
                      <option value="Accountant">Accountant (Xisaabiye)</option>
                      <option value="Admin">Admin (Maamulka Guud)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Password-ka *</label>
                    <input
                      type="text"
                      value={createUserPassword}
                      onChange={(e) => setCreateUserPassword(e.target.value)}
                      placeholder="min. 8"
                      className="w-full px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!createUserName || !createUserEmail || !createUserPassword) {
                        showNotice('Fadlan buuxi Magaca, Email-ka iyo Password-ka');
                        return;
                      }
                      await authedFetch('/api/admin/users', {
                        method: 'POST',
                        body: JSON.stringify({
                          name: createUserName,
                          email: createUserEmail,
                          phone: createUserPhone,
                          role: createUserRole,
                          password: createUserPassword,
                        }),
                      });
                      setCreateUserName('');
                      setCreateUserEmail('');
                      setCreateUserPassword('');
                      fetchErpData();
                      showNotice('Akoonka shaqaalaha/maamulka waa la abuuray!');
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#00529E] hover:bg-[#00447F] text-white text-xs font-semibold cursor-pointer"
                  >
                    + Abuur User-ka Shaqaalaha / Maamulka
                  </button>
                </div>

                {/* Existing System Users Table */}
                <div className="pt-3 border-t border-slate-100 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-[#F2F5FA]/60 text-slate-500">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Login Email / Phone</th>
                        <th className="py-2.5 px-3">Role (RBAC)</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Manage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allUsers.map((u: any) => (
                        <tr key={u.id}>
                          <td className="py-2.5 px-3 font-semibold text-[#0B1F3A]">{u.name || u.email}</td>
                          <td className="py-2.5 px-3 font-mono-tabular">
                            {u.email} {u.phone ? `· ${u.phone}` : ''}
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={u.role}
                              onChange={async (e) => {
                                await authedFetch(`/api/admin/users/${u.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ role: e.target.value }),
                                });
                                fetchErpData();
                                showNotice(`Updated role for ${u.email}`);
                              }}
                              className="px-2 py-1 rounded border border-slate-300 font-semibold text-[#00529E]"
                            >
                              <option value="Admin">Admin</option>
                              <option value="Manager">Manager</option>
                              <option value="Staff">Staff</option>
                              <option value="Accountant">Accountant</option>
                              <option value="Driver">Driver</option>
                              <option value="Mover / Helper">Mover / Helper</option>
                              <option value="Crew Leader">Crew Leader</option>
                              <option value="Dispatcher">Dispatcher</option>
                              <option value="HR">HR</option>
                              {!['Admin', 'Manager', 'Staff', 'Accountant', 'Driver', 'Mover / Helper', 'Crew Leader', 'Dispatcher', 'HR'].includes(u.role) && <option value={u.role}>{u.role}</option>}
                            </select>
                            <select
                              value={u.staffId || ''}
                              title={lang === 'so' ? 'Ku xir diiwaanka shaqaalaha (Shaqadayda Maanta)' : 'Link to crew record (My jobs)'}
                              onChange={async (e) => {
                                try {
                                  await authedFetch(`/api/admin/users/${u.id}/staff-link`, { method: 'PATCH', body: JSON.stringify({ staffId: Number(e.target.value) || null }) });
                                  fetchErpData();
                                  showNotice(lang === 'so' ? 'Waa la xiray' : 'Linked');
                                } catch (err: any) {
                                  showNotice(err.message, 'error');
                                }
                              }}
                              className="mt-1 block px-2 py-1 rounded border border-slate-300 text-[11px] max-w-[170px]"
                            >
                              <option value="">{lang === 'so' ? '— Shaqaale (crew) —' : '— Crew record —'}</option>
                              {allStaff.map((st: any) => <option key={st.id} value={st.id}>{st.name}</option>)}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={u.status || 'Active'} />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              {u.id !== currentUser?.id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const nextStatus = u.status === 'Active' ? 'Suspended' : 'Active';
                                    try {
                                      await authedFetch(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
                                      fetchErpData();
                                      showNotice(nextStatus === 'Active' ? (lang === 'so' ? `${u.email} waa la fasaxay` : `${u.email} approved`) : (lang === 'so' ? `${u.email} waa la xiray` : `${u.email} suspended`));
                                    } catch (e: any) {
                                      showNotice(e.message, 'error');
                                    }
                                  }}
                                  className={`erp-btn !py-1.5 !px-3 !text-xs ${u.status === 'Active' ? 'erp-btn-danger' : 'erp-btn-primary'}`}
                                >
                                  {u.status === 'Active' ? (lang === 'so' ? 'Xir' : 'Suspend') : lang === 'so' ? 'Fasax (Activate)' : 'Approve'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm(lang === 'so' ? `Ma u samaysaa password ku-meel-gaar ah ${u.email}? Kii hore wuu shaqayn waayayaa.` : `Issue a temporary password for ${u.email}? The old one stops working.`)) return;
                                  try {
                                    const d = await authedFetch(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' });
                                    setUserTempPw({ who: d.email, pw: d.tempPassword });
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  } catch (e: any) {
                                    showNotice(e.message, 'error');
                                  }
                                }}
                                className="erp-btn erp-btn-ghost !py-1.5 !px-3 !text-xs"
                              >
                                <KeyRound className="w-3.5 h-3.5" /> {lang === 'so' ? 'Reset Password' : 'Reset password'}
                              </button>
                              {u.id !== currentUser?.id && (
                                <button type="button" title="Delete" onClick={() => confirmDelete(u.email, `/api/admin/users/${u.id}`)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[14px] border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Company Info, WhatsApp Templates & Future Cloud API Config
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">WhatsApp & Phone</label>
                    <input
                      type="text"
                      value={settingsForm.whatsapp_phone || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp_phone: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-300 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Mogadishu Office Address</label>
                    <input
                      type="text"
                      value={settingsForm.office_address || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, office_address: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-300"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-600 mb-1">
                      Somali Quote WhatsApp Template
                    </label>
                    <input
                      type="text"
                      value={settingsForm.tpl_quote_so || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, tpl_quote_so: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-300"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-600 mb-1">
                      Somali Confirmation WhatsApp Template
                    </label>
                    <input
                      type="text"
                      value={settingsForm.tpl_confirm_so || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, tpl_confirm_so: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-300"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await authedFetch('/api/admin/settings', {
                      method: 'POST',
                      body: JSON.stringify({ settings: settingsForm }),
                    });
                    onRefreshPublic();
                    showNotice('Settings & WhatsApp templates saved!');
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#F1980A] text-white text-xs font-semibold cursor-pointer"
                >
                  Save All Settings
                </button>
              </div>

              <SettingsExtras lang={lang} api={authedFetch} settings={sMap} onSaved={() => { fetchErpData(); onRefreshPublic(); }} onNotice={showNotice} />

              {/* Admin Audit Log */}
              <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 font-bold text-sm">
                  Security Audit Log (Admin & System Actions)
                </div>
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto text-xs">
                  {allLogs.map((l: any) => (
                    <div key={l.id} className="px-6 py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-bold text-[#00529E]">{l.action}</span> — {l.details}
                      </div>
                      <div className="font-mono-tabular text-slate-400 shrink-0">
                        {l.actorEmail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className="no-print fixed z-[70] bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 max-w-[92vw]">
          <div
            role="status"
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
              toast.kind === 'error' ? 'bg-rose-600' : 'bg-[#0B1F3A]'
            }`}
          >
            {toast.kind === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-[#F1980A]" />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
};
