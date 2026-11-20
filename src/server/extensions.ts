/**
 * SOORAR ERP v2 extensions: password reset/change, crew mobile jobs, dispatch calendar,
 * photo storage (Postgres bytea), manual mobile-money payments, payroll, suppliers,
 * instant quote, referrals, profit reports, JSON backup and paginated lists.
 *
 * New tables use raw SQL through the shared pg pool (schema lives in src/db/schema-sql.ts).
 */
import type { Express, Request, Response, NextFunction } from 'express';
import { gzipSync } from 'zlib';
import { createPool } from '../db/index.ts';
import { requireAuth, requireAdmin, requireRoles, AuthRequest } from '../middleware/auth.ts';
import {
  hashPassword,
  verifyPassword,
  signStaffToken,
  signCustomerToken,
  verifyStaffToken,
  tokenMatchesPassword,
  generateTempPassword,
  signValue,
  verifySignedValue,
  safeEqual,
} from '../lib/security.ts';
import { isOwnerEmail } from '../db/users.ts';
import { computeInstantQuote } from '../lib/instantQuote.ts';
import { getPaymentProvider, PAYMENT_METHODS } from './payments.ts';

type Helpers = {
  logAdminActivity: (actorEmail: string, actorRole: string, action: string, entityType: string, entityId: string, details: string) => Promise<void>;
  checkRateLimit: (ip: string, maxRequests?: number, windowMs?: number) => boolean;
};

const pool = createPool();
const q = async (text: string, params: any[] = []) => (await pool.query(text, params)).rows as any[];
const camel = (r: any) => {
  if (!r) return r;
  const o: any = {};
  for (const [k, v] of Object.entries(r)) o[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  return o;
};
const camelAll = (rows: any[]) => rows.map(camel);
const money = (v: any) => Math.round((Number(v) || 0) * 100) / 100;
const todayMogadishu = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const digits = (s: any) => String(s || '').replace(/[^0-9]/g, '');

const OFFICE_ROLES = ['Manager', 'Branch Manager', 'Dispatcher', 'Sales / Customer Service', 'Crew Leader', 'Surveyor', 'Accountant', 'HR', 'Warehouse Keeper'];
const DISPATCH_ROLES = ['Manager', 'Branch Manager', 'Dispatcher'];
const FINANCE_ROLES = ['Manager', 'Accountant'];
const PAYROLL_ROLES = ['Manager', 'Accountant', 'HR'];
const SUPPLIER_ROLES = ['Manager', 'Warehouse Keeper', 'Accountant'];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

async function nextCodeSql(base: string, table: string, column: string) {
  const rows = await q(`SELECT "${column}" AS c FROM "${table}"`);
  const year = new Date().getFullYear();
  let max = 0;
  for (const r of rows) {
    const m = String(r.c || '').match(/-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${base}-${year}-${String(max + 1).padStart(4, '0')}`;
}

async function getSettings(): Promise<Record<string, string>> {
  const rows = await q('SELECT key, value FROM settings');
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return m;
}

// ---------------------------------------------------------------- photos
export function photoUrl(row: { id: number; kind: string }) {
  return row.kind === 'gallery' ? `/api/photos/${row.id}` : `/api/photos/${row.id}?s=${signValue('photo:' + row.id)}`;
}

async function savePhoto(entityType: string, entityId: number | null, kind: string, dataUrl: string, by: string, caption = '') {
  const m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) throw Object.assign(new Error('Sawirka waa inuu noqdaa JPG, PNG ama WEBP.'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) throw Object.assign(new Error('Sawir madhan.'), { status: 400 });
  if (buf.length > MAX_PHOTO_BYTES) throw Object.assign(new Error('Sawirku wuu ka weyn yahay 2MB. Fadlan yaree.'), { status: 413 });
  const mime = m[1] === 'image/jpg' ? 'image/jpeg' : m[1];
  const rows = await q(
    `INSERT INTO photos (entity_type, entity_id, kind, mime, data, size_bytes, caption, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, entity_type, entity_id, kind, mime, size_bytes, caption, uploaded_by, created_at`,
    [entityType, entityId, kind, mime, buf, buf.length, String(caption || '').slice(0, 300), by]
  );
  const r = camel(rows[0]);
  return { ...r, url: photoUrl(r) };
}

async function listPhotos(entityType: string, entityIds: number[]) {
  if (!entityIds.length) return [];
  const rows = await q(
    `SELECT id, entity_type, entity_id, kind, mime, size_bytes, caption, uploaded_by, created_at FROM photos
     WHERE entity_type = $1 AND entity_id = ANY($2::int[]) ORDER BY id ASC`,
    [entityType, entityIds]
  );
  return rows.map((r) => {
    const c = camel(r);
    return { ...c, url: photoUrl(c) };
  });
}

// ---------------------------------------------------------------- customer auth
export interface CustomerRequest extends Request {
  customer?: any;
}

export const requireCustomer = async (req: CustomerRequest, res: Response, next: NextFunction) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const payload = token ? verifyStaffToken(token) : null;
  if (!payload || !String(payload.uid).startsWith('cust:')) {
    return res.status(401).json({ error: 'Fadlan mar kale gal (login).', code: 'CUSTOMER_LOGIN' });
  }
  const id = Number(String(payload.uid).slice(5));
  const rows = await q('SELECT * FROM customers WHERE id = $1', [id]);
  if (!rows[0] || !tokenMatchesPassword(payload.pf, rows[0].password_hash || '')) {
    return res.status(401).json({ error: 'Fadlan mar kale gal (login).', code: 'CUSTOMER_LOGIN' });
  }
  req.customer = camel(rows[0]);
  next();
};

async function ensureReferralCode(customerId: number): Promise<string> {
  const rows = await q('SELECT referral_code FROM customers WHERE id = $1', [customerId]);
  if (rows[0]?.referral_code) return rows[0].referral_code;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 6; attempt++) {
    let code = 'SR';
    for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    try {
      const up = await q(`UPDATE customers SET referral_code = $1 WHERE id = $2 AND (referral_code IS NULL OR referral_code = '') RETURNING referral_code`, [code, customerId]);
      if (up[0]) return up[0].referral_code;
      const again = await q('SELECT referral_code FROM customers WHERE id = $1', [customerId]);
      if (again[0]?.referral_code) return again[0].referral_code;
    } catch {
      /* unique clash: retry */
    }
  }
  throw new Error('Could not create referral code');
}

/** Called by the public booking route when a referral code was entered. */
export async function linkReferral(bookingId: number, bookingCustomerId: number | null, rawCode: string) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return null;
  const refRows = await q(`SELECT id FROM customers WHERE upper(referral_code) = $1`, [code]);
  const referrer = refRows[0];
  if (!referrer || referrer.id === bookingCustomerId) return null;
  await q('UPDATE bookings SET referral_code = $1, referrer_customer_id = $2 WHERE id = $3', [code, referrer.id, bookingId]);
  const ins = await q(
    `INSERT INTO referrals (code, referrer_customer_id, referred_customer_id, referred_booking_id) VALUES ($1,$2,$3,$4) RETURNING id`,
    [code, referrer.id, bookingCustomerId, bookingId]
  );
  return ins[0]?.id || null;
}

// ---------------------------------------------------------------- crew helpers
const CANCELLED = ['Cancelled', 'Canceled', 'Lost'];

async function staffIdForUser(user: AuthRequest['user']): Promise<number | null> {
  if (!user?.id) return null;
  const rows = await q('SELECT staff_id, phone FROM users WHERE id = $1', [user.id]);
  if (rows[0]?.staff_id) return Number(rows[0].staff_id);
  const ph = digits(rows[0]?.phone);
  if (ph.length >= 7) {
    const st = await q('SELECT id, phone FROM staff');
    const m = st.find((s) => digits(s.phone).slice(-7) === ph.slice(-7));
    if (m) return Number(m.id);
  }
  return null;
}

function isAssigned(booking: any, staffId: number | null) {
  if (!staffId) return false;
  const ids = Array.isArray(booking.assigned_staff_ids) ? booking.assigned_staff_ids.map(Number) : [];
  return ids.includes(staffId);
}

const canManageAnyJob = (role?: string) => ['Admin', 'Super Admin', ...DISPATCH_ROLES].includes(role || '');

async function recordPaymentSql(opts: {
  invoiceId: number | null;
  bookingId: number | null;
  customerName: string;
  amount: number;
  method: string;
  paymentType: string;
  referenceCode: string;
  notes: string;
}) {
  const receiptNumber = await nextCodeSql('SR-RCP', 'payments', 'receipt_number');
  const ins = await q(
    `INSERT INTO payments (receipt_number, invoice_id, booking_id, customer_name, amount, payment_method, payment_type, reference_code, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [receiptNumber, opts.invoiceId, opts.bookingId, opts.customerName, money(opts.amount).toFixed(2), opts.method, opts.paymentType, opts.referenceCode, opts.notes]
  );
  if (opts.invoiceId) {
    const inv = (await q('SELECT * FROM invoices WHERE id = $1', [opts.invoiceId]))[0];
    if (inv) {
      const paid = money(Number(inv.amount_paid) + opts.amount);
      const bal = Math.max(0, money(Number(inv.total) - paid));
      await q('UPDATE invoices SET amount_paid = $1, balance_due = $2, status = $3 WHERE id = $4', [
        paid.toFixed(2),
        bal.toFixed(2),
        bal <= 0.01 ? 'Paid' : 'Partial',
        inv.id,
      ]);
    }
  }
  return camel(ins[0]);
}

// ---------------------------------------------------------------- payroll helpers
function periodBounds(period: string) {
  const [y, m] = period.split('-').map(Number);
  const start = `${period}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}

async function computePayroll(period: string) {
  const { start, end } = periodBounds(period);
  const [staffRows, entries, slips, jobs] = await Promise.all([
    q('SELECT * FROM staff ORDER BY id ASC'),
    q('SELECT * FROM payroll_entries WHERE period = $1 ORDER BY entry_date ASC, id ASC', [period]),
    q('SELECT * FROM payslips WHERE period = $1', [period]),
    q(`SELECT id, preferred_date, assigned_staff_ids, status FROM bookings WHERE preferred_date >= $1 AND preferred_date <= $2`, [start, end]),
  ]);
  return staffRows.map((s) => {
    const mine = entries.filter((e) => Number(e.staff_id) === Number(s.id));
    const sum = (t: string, f: 'days' | 'amount') => mine.filter((e) => e.entry_type === t).reduce((a, e) => a + Number(e[f] || 0), 0);
    const attendanceDays = sum('attendance', 'days');
    const jobDates = new Set(
      jobs
        .filter((j) => j.status === 'Completed' && Array.isArray(j.assigned_staff_ids) && j.assigned_staff_ids.map(Number).includes(Number(s.id)))
        .map((j) => j.preferred_date)
    );
    const daysWorked = attendanceDays > 0 ? attendanceDays : jobDates.size;
    const payType = s.pay_type === 'monthly' ? 'monthly' : 'daily';
    const baseRate = payType === 'monthly' ? Number(s.monthly_salary || 0) : Number(s.daily_rate || 0);
    const gross = payType === 'monthly' ? baseRate : baseRate * daysWorked;
    const bonuses = sum('bonus', 'amount');
    const advances = sum('advance', 'amount');
    const deductions = sum('deduction', 'amount');
    const net = gross + bonuses - advances - deductions;
    const slip = slips.find((p) => Number(p.staff_id) === Number(s.id));
    return {
      staff: camel(s),
      payType,
      baseRate: money(baseRate),
      attendanceDays,
      completedJobDays: jobDates.size,
      daysWorked,
      daysSource: attendanceDays > 0 ? 'attendance' : 'completed_jobs',
      gross: money(gross),
      bonuses: money(bonuses),
      advances: money(advances),
      deductions: money(deductions),
      net: money(net),
      entries: camelAll(mine),
      payslip: slip ? camel(slip) : null,
    };
  });
}

// ---------------------------------------------------------------- register
export function registerExtensions(app: Express, h: Helpers) {
  const actor = (req: AuthRequest) => req.user?.email || 'Admin';
  const role = (req: AuthRequest) => req.user?.role || 'Staff';
  const fail = (res: Response, e: any, msg: string) => {
    console.error(msg, e);
    res.status(e?.status || 500).json({ error: e?.status ? e.message : msg });
  };

  // ============ 1. PASSWORDS ============
  app.post('/api/account/change-password', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ error: 'Password-ka cusub waa inuu ahaadaa ugu yaraan 8 xaraf.' });
      const u = (await q('SELECT * FROM users WHERE id = $1', [req.user!.id]))[0];
      if (!u) return res.status(404).json({ error: 'User not found' });
      if (u.password_hash && !verifyPassword(String(currentPassword || ''), u.password_hash)) {
        return res.status(400).json({ error: 'Password-ka hadda jira waa khalad.' });
      }
      const hash = hashPassword(String(newPassword));
      await q('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, u.id]);
      await h.logAdminActivity(actor(req), role(req), 'PASSWORD_CHANGED', 'User', String(u.id), 'User changed own password');
      res.json({ success: true, token: signStaffToken(u.uid, hash) });
    } catch (e) {
      fail(res, e, 'Failed to change password.');
    }
  });

  app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const u = (await q('SELECT * FROM users WHERE id = $1', [Number(req.params.id)]))[0];
      if (!u) return res.status(404).json({ error: 'User not found' });
      if (isOwnerEmail(u.email) && !isOwnerEmail(req.user?.email)) {
        return res.status(403).json({ error: 'Password-ka milkiilaha kaliya isaga ayaa beddeli kara.' });
      }
      const temp = generateTempPassword(10);
      await q('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(temp), u.id]);
      await h.logAdminActivity(actor(req), 'Admin', 'USER_PASSWORD_RESET', 'User', String(u.id), `Temporary password issued for ${u.email}`);
      res.json({ tempPassword: temp, email: u.email });
    } catch (e) {
      fail(res, e, 'Failed to reset password.');
    }
  });

  app.post('/api/admin/customers/:id/reset-password', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const c = (await q('SELECT * FROM customers WHERE id = $1', [Number(req.params.id)]))[0];
      if (!c) return res.status(404).json({ error: 'Customer not found' });
      const temp = generateTempPassword(10);
      await q('UPDATE customers SET password_hash = $1 WHERE id = $2', [hashPassword(temp), c.id]);
      await h.logAdminActivity(actor(req), 'Admin', 'CUSTOMER_PASSWORD_RESET', 'Customer', String(c.id), `Temporary password issued for ${c.name} (${c.phone})`);
      res.json({ tempPassword: temp, phone: c.phone, name: c.name });
    } catch (e) {
      fail(res, e, 'Failed to reset password.');
    }
  });

  app.post('/api/customer/change-password', requireCustomer, async (req: CustomerRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ error: 'Password-ka cusub waa inuu ahaadaa ugu yaraan 8 xaraf.' });
      const c = req.customer;
      if (c.passwordHash && !verifyPassword(String(currentPassword || ''), c.passwordHash)) {
        return res.status(400).json({ error: 'Password-ka hadda jira waa khalad.' });
      }
      const hash = hashPassword(String(newPassword));
      await q('UPDATE customers SET password_hash = $1 WHERE id = $2', [hash, c.id]);
      res.json({ success: true, token: signCustomerToken(c.id, hash) });
    } catch (e) {
      fail(res, e, 'Failed to change password.');
    }
  });

  app.get('/api/customer/me', requireCustomer, async (req: CustomerRequest, res) => {
    try {
      const c = req.customer;
      const code = await ensureReferralCode(c.id);
      const refs = await q(
        `SELECT r.id, r.status, r.created_at, b.reference_number, b.customer_name FROM referrals r
         LEFT JOIN bookings b ON b.id = r.referred_booking_id WHERE r.referrer_customer_id = $1 ORDER BY r.id DESC LIMIT 50`,
        [c.id]
      );
      const subs = await q(
        `SELECT id, booking_ref, invoice_id, method, transaction_ref, amount, status, review_note, created_at FROM payment_submissions
         WHERE customer_id = $1 OR booking_id IN (SELECT id FROM bookings WHERE customer_id = $1) ORDER BY id DESC LIMIT 50`,
        [c.id]
      );
      const s = await getSettings();
      res.json({
        customer: { id: c.id, name: c.name, phone: c.phone, email: c.email },
        referralCode: code,
        referralDiscountPct: s.referral_discount_pct || '',
        referrals: refs.map((r) => ({ id: r.id, status: r.status, createdAt: r.created_at, bookingRef: r.reference_number, name: String(r.customer_name || '').split(' ')[0] })),
        paymentSubmissions: camelAll(subs),
      });
    } catch (e) {
      fail(res, e, 'Failed to load account.');
    }
  });

  // ============ 2. CREW MOBILE VIEW ============
  app.get('/api/crew/my-jobs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const staffId = await staffIdForUser(req.user);
      if (!staffId) return res.json({ linked: false, staff: null, jobs: [] });
      const today = todayMogadishu();
      const y = new Date(Date.now() + 3 * 3600_000 - 86400_000).toISOString().slice(0, 10);
      const rows = await q(
        `SELECT * FROM bookings WHERE assigned_staff_ids @> $1::jsonb
         AND status <> ALL($2::text[])
         AND (preferred_date >= $3 OR (status <> 'Completed' AND crew_status IN ('on_the_way','started')))
         ORDER BY preferred_date ASC, preferred_time ASC LIMIT 60`,
        [JSON.stringify([staffId]), CANCELLED, y]
      );
      const staffRow = (await q('SELECT * FROM staff WHERE id = $1', [staffId]))[0];
      const vehicles = await q('SELECT id, plate_number, name, driver_name FROM vehicles');
      const allStaff = await q('SELECT id, name, role, phone FROM staff');
      const photos = await listPhotos('booking', rows.map((r) => r.id));
      const jobs = rows.map((b) => {
        const v = vehicles.find((x) => x.id === b.assigned_vehicle_id);
        const ids = (b.assigned_staff_ids || []).map(Number);
        return {
          id: b.id,
          referenceNumber: b.reference_number,
          customerName: b.customer_name,
          customerPhone: b.customer_phone,
          services: b.services,
          fromDistrict: b.from_district,
          fromAddress: b.from_address,
          fromFloor: b.from_floor,
          fromLift: b.from_lift,
          toDistrict: b.to_district,
          toAddress: b.to_address,
          toFloor: b.to_floor,
          toLift: b.to_lift,
          sizeDescription: b.size_description,
          largeItems: b.large_items,
          notes: b.notes,
          preferredDate: b.preferred_date,
          preferredTime: b.preferred_time,
          status: b.status,
          crewStatus: b.crew_status || '',
          isToday: b.preferred_date === today,
          vehicle: v ? camel(v) : null,
          crew: allStaff.filter((s) => ids.includes(Number(s.id))).map(camel),
          photos: photos.filter((p) => p.entityId === b.id),
        };
      });
      res.json({ linked: true, today, staff: staffRow ? camel(staffRow) : null, jobs });
    } catch (e) {
      fail(res, e, 'Failed to load your jobs.');
    }
  });

  app.post('/api/crew/jobs/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const action = String(req.body?.action || '');
      const map: Record<string, { status?: string; note: string }> = {
        on_the_way: { note: 'Shaqaaluhu waxay ku jiraan jidka (On the way)' },
        started: { status: 'In progress', note: 'Shaqada waa la bilaabay (Started)' },
        completed: { status: 'Completed', note: 'Shaqada waa la dhammeeyay (Completed)' },
      };
      if (!map[action]) return res.status(400).json({ error: 'Invalid action' });
      const b = (await q('SELECT * FROM bookings WHERE id = $1', [Number(req.params.id)]))[0];
      if (!b) return res.status(404).json({ error: 'Booking not found' });
      const staffId = await staffIdForUser(req.user);
      if (!isAssigned(b, staffId) && !canManageAnyJob(req.user?.role)) return res.status(403).json({ error: 'Shaqadan laguuma qoondeyn.' });
      const history = Array.isArray(b.status_history) ? [...b.status_history] : [];
      const ts = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
      const newStatus = map[action].status || b.status;
      history.push({ status: newStatus, timestamp: ts, note: `${map[action].note} · ${req.user?.name || req.user?.email}` });
      await q('UPDATE bookings SET crew_status = $1, status = $2, status_history = $3::jsonb WHERE id = $4', [action, newStatus, JSON.stringify(history), b.id]);
      if (action === 'completed' && b.status !== 'Completed') {
        // Attendance for payroll: one day per assigned crew member for the job date (once per day).
        const ids: number[] = (b.assigned_staff_ids || []).map(Number);
        const period = String(b.preferred_date || todayMogadishu()).slice(0, 7);
        for (const sid of ids) {
          const exists = await q(`SELECT 1 FROM payroll_entries WHERE staff_id = $1 AND entry_type = 'attendance' AND entry_date = $2`, [sid, b.preferred_date]);
          if (!exists.length) {
            await q(`INSERT INTO payroll_entries (staff_id, period, entry_type, entry_date, days, note, created_by) VALUES ($1,$2,'attendance',$3,1,$4,'system')`, [
              sid,
              period,
              b.preferred_date,
              `Auto: ${b.reference_number}`,
            ]);
          }
          await q('UPDATE staff SET jobs_completed = jobs_completed + 1 WHERE id = $1', [sid]);
        }
      }
      await h.logAdminActivity(actor(req), role(req), 'CREW_STATUS', 'Booking', b.reference_number, map[action].note);
      res.json({ success: true, status: newStatus, crewStatus: action });
    } catch (e) {
      fail(res, e, 'Failed to update job.');
    }
  });

  app.post('/api/crew/jobs/:id/photos', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = (await q('SELECT * FROM bookings WHERE id = $1', [Number(req.params.id)]))[0];
      if (!b) return res.status(404).json({ error: 'Booking not found' });
      const staffId = await staffIdForUser(req.user);
      if (!isAssigned(b, staffId) && !canManageAnyJob(req.user?.role)) return res.status(403).json({ error: 'Shaqadan laguuma qoondeyn.' });
      const kind = req.body?.kind === 'after' ? 'after' : 'before';
      const photo = await savePhoto('booking', b.id, kind, req.body?.dataUrl, actor(req), req.body?.caption);
      res.status(201).json({ photo });
    } catch (e) {
      fail(res, e, 'Failed to upload photo.');
    }
  });

  // ============ 4. PHOTOS ============
  app.get('/api/photos/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = (await q('SELECT id, kind, mime, data FROM photos WHERE id = $1', [id]))[0];
      if (!r) return res.status(404).end();
      if (r.kind !== 'gallery' && !verifySignedValue('photo:' + id, String(req.query.s || ''))) return res.status(403).end();
      res.setHeader('Content-Type', r.mime || 'image/jpeg');
      res.setHeader('Cache-Control', r.kind === 'gallery' ? 'public, max-age=31536000, immutable' : 'private, max-age=86400');
      res.end(r.data);
    } catch (e) {
      console.error('photo', e);
      res.status(500).end();
    }
  });

  app.get('/api/admin/photos', requireAuth, async (req: AuthRequest, res) => {
    try {
      const entityType = String(req.query.entityType || '');
      const ids = String(req.query.entityId || '')
        .split(',')
        .map(Number)
        .filter(Boolean);
      res.json({ photos: await listPhotos(entityType, ids) });
    } catch (e) {
      fail(res, e, 'Failed to load photos.');
    }
  });

  app.post('/api/admin/photos', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { entityType, entityId, kind, dataUrl, caption } = req.body || {};
      const allowed = ['booking', 'damage_claim'];
      if (!allowed.includes(entityType)) return res.status(400).json({ error: 'Invalid entity type' });
      const k = ['before', 'after', 'damage', 'other'].includes(kind) ? kind : 'other';
      const photo = await savePhoto(entityType, Number(entityId) || null, k, dataUrl, actor(req), caption);
      await h.logAdminActivity(actor(req), role(req), 'PHOTO_UPLOADED', entityType, String(entityId), `${k} photo (${Math.round(photo.sizeBytes / 1024)} KB)`);
      res.status(201).json({ photo });
    } catch (e) {
      fail(res, e, 'Failed to upload photo.');
    }
  });

  app.delete('/api/admin/photos/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
    try {
      await q('DELETE FROM photos WHERE id = $1', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (e) {
      fail(res, e, 'Failed to delete photo.');
    }
  });

  app.post('/api/admin/gallery/upload', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
    try {
      const { titleSo, titleEn, category, district, dataUrl } = req.body || {};
      if (!titleSo && !titleEn) return res.status(400).json({ error: 'Cinwaanka sawirka geli.' });
      const photo = await savePhoto('gallery', null, 'gallery', dataUrl, actor(req), titleSo || titleEn);
      const g = await q(
        `INSERT INTO gallery (title_so, title_en, category, image_url, district) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [String(titleSo || titleEn), String(titleEn || titleSo), String(category || 'homes'), photo.url, String(district || 'Mogadishu')]
      );
      await q('UPDATE photos SET entity_id = $1 WHERE id = $2', [g[0].id, photo.id]);
      res.status(201).json({ item: camel(g[0]) });
    } catch (e) {
      fail(res, e, 'Failed to upload gallery photo.');
    }
  });

  app.delete('/api/admin/gallery/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
    try {
      const g = (await q('SELECT * FROM gallery WHERE id = $1', [Number(req.params.id)]))[0];
      if (!g) return res.status(404).json({ error: 'Not found' });
      await q('DELETE FROM gallery WHERE id = $1', [g.id]);
      const m = String(g.image_url || '').match(/^\/api\/photos\/(\d+)/);
      if (m) await q(`DELETE FROM photos WHERE id = $1 AND kind = 'gallery'`, [Number(m[1])]);
      res.json({ success: true });
    } catch (e) {
      fail(res, e, 'Failed to delete gallery item.');
    }
  });

  // ============ 3. DISPATCH CALENDAR ============
  app.get('/api/admin/dispatch', requireAuth, async (req: AuthRequest, res) => {
    try {
      const from = String(req.query.from || todayMogadishu()).slice(0, 10);
      const to = String(req.query.to || from).slice(0, 10);
      const rows = await q(
        `SELECT id, reference_number, customer_name, customer_phone, from_district, to_district, preferred_date, preferred_time,
                status, crew_status, assigned_staff_ids, assigned_vehicle_id, size_description
         FROM bookings WHERE preferred_date >= $1 AND preferred_date <= $2 AND status <> ALL($3::text[])
         ORDER BY preferred_date ASC, preferred_time ASC LIMIT 1000`,
        [from, to, CANCELLED]
      );
      const vehicles = await q('SELECT id, plate_number, name, status FROM vehicles ORDER BY id');
      const staffRows = await q('SELECT id, name, role, availability FROM staff ORDER BY id');
      const conflicts: any[] = [];
      const byDate: Record<string, any[]> = {};
      for (const b of rows) (byDate[b.preferred_date] ||= []).push(b);
      for (const [date, list] of Object.entries(byDate)) {
        const vMap: Record<number, string[]> = {};
        const sMap: Record<number, string[]> = {};
        for (const b of list) {
          if (b.assigned_vehicle_id) (vMap[b.assigned_vehicle_id] ||= []).push(b.reference_number);
          for (const sid of (b.assigned_staff_ids || []).map(Number)) (sMap[sid] ||= []).push(b.reference_number);
        }
        for (const [vid, refs] of Object.entries(vMap))
          if (refs.length > 1) conflicts.push({ date, type: 'vehicle', id: Number(vid), name: vehicles.find((v) => v.id === Number(vid))?.plate_number || vid, refs });
        for (const [sid, refs] of Object.entries(sMap))
          if (refs.length > 1) conflicts.push({ date, type: 'staff', id: Number(sid), name: staffRows.find((s) => s.id === Number(sid))?.name || sid, refs });
      }
      res.json({ from, to, bookings: camelAll(rows), vehicles: camelAll(vehicles), staff: camelAll(staffRows), conflicts });
    } catch (e) {
      fail(res, e, 'Failed to load dispatch calendar.');
    }
  });

  app.post('/api/admin/bookings/:id/assign', requireAuth, requireRoles(...DISPATCH_ROLES), async (req: AuthRequest, res) => {
    try {
      const b = (await q('SELECT * FROM bookings WHERE id = $1', [Number(req.params.id)]))[0];
      if (!b) return res.status(404).json({ error: 'Booking not found' });
      const staffIds: number[] = Array.isArray(req.body?.staffIds) ? req.body.staffIds.map(Number).filter(Boolean) : (b.assigned_staff_ids || []).map(Number);
      const vehicleId = req.body?.vehicleId === undefined ? b.assigned_vehicle_id : Number(req.body.vehicleId) || null;
      await q('UPDATE bookings SET assigned_staff_ids = $1::jsonb, assigned_vehicle_id = $2 WHERE id = $3', [JSON.stringify(staffIds), vehicleId, b.id]);
      const others = await q(
        `SELECT reference_number, assigned_staff_ids, assigned_vehicle_id FROM bookings WHERE preferred_date = $1 AND id <> $2 AND status <> ALL($3::text[])`,
        [b.preferred_date, b.id, CANCELLED]
      );
      const warnings: string[] = [];
      for (const o of others) {
        if (vehicleId && o.assigned_vehicle_id === vehicleId) warnings.push(`Gaariga waxaa horey loogu qabtay ${o.reference_number} isla maalintaas.`);
        const clash = staffIds.filter((s) => (o.assigned_staff_ids || []).map(Number).includes(s));
        if (clash.length) warnings.push(`${clash.length} shaqaale ayaa horey ugu jira ${o.reference_number} isla maalintaas.`);
      }
      await h.logAdminActivity(actor(req), role(req), 'BOOKING_ASSIGNED', 'Booking', b.reference_number, `Staff [${staffIds.join(',')}] vehicle ${vehicleId || '-'}`);
      res.json({ success: true, warnings });
    } catch (e) {
      fail(res, e, 'Failed to assign booking.');
    }
  });

  // ============ 5. MANUAL MOBILE-MONEY PAYMENTS ============
  app.post('/api/public/payment-submissions', async (req: CustomerRequest, res) => {
    try {
      if (!h.checkRateLimit('pay:' + (req.ip || 'x'), 6, 60_000)) return res.status(429).json({ error: 'Codsiyo badan. Fadlan sug daqiiqad.' });
      const { bookingRef, phone, invoiceId, method, transactionRef, amount } = req.body || {};
      if (!PAYMENT_METHODS.includes(method)) return res.status(400).json({ error: 'Dooro habka lacag bixinta (EVC Plus, eDahab, Premier Wallet).' });
      const txn = String(transactionRef || '').trim();
      const amt = money(amount);
      if (txn.length < 4) return res.status(400).json({ error: 'Geli lambarka xaqiijinta (transaction reference).' });
      if (!(amt > 0)) return res.status(400).json({ error: 'Geli lacagta aad bixisay.' });
      const b = (await q('SELECT * FROM bookings WHERE upper(reference_number) = $1', [String(bookingRef || '').trim().toUpperCase()]))[0];
      if (!b) return res.status(404).json({ error: 'Ballanta lama helin.' });

      // Ownership: a valid customer token for this booking, or the phone number on the booking.
      let customerId: number | null = null;
      const hdr = req.headers.authorization || '';
      const payload = hdr.startsWith('Bearer ') ? verifyStaffToken(hdr.slice(7).trim()) : null;
      if (payload && String(payload.uid).startsWith('cust:')) customerId = Number(String(payload.uid).slice(5));
      const phoneOk = digits(phone).length >= 7 && digits(b.customer_phone).slice(-7) === digits(phone).slice(-7);
      if (!(customerId && customerId === b.customer_id) && !phoneOk) return res.status(403).json({ error: 'Taleefanka kuma eka ballanta.' });

      const dupe = await q(`SELECT id FROM payment_submissions WHERE method = $1 AND upper(transaction_ref) = $2 AND status <> 'Rejected'`, [method, txn.toUpperCase()]);
      if (dupe.length) return res.status(409).json({ error: 'Lambarkan xaqiijinta horey ayaa loo soo gudbiyay.' });

      let invId: number | null = null;
      if (invoiceId) {
        const inv = (await q('SELECT id FROM invoices WHERE id = $1 AND booking_id = $2', [Number(invoiceId), b.id]))[0];
        invId = inv ? inv.id : null;
      }
      if (!invId) {
        const inv = (await q(`SELECT id FROM invoices WHERE booking_id = $1 AND status <> 'Paid' ORDER BY id DESC LIMIT 1`, [b.id]))[0];
        invId = inv ? inv.id : null;
      }
      const provider = getPaymentProvider(method);
      const verdict = await provider.verify({ method, transactionRef: txn, amount: amt, payerPhone: String(phone || ''), bookingRef: b.reference_number });
      const ins = await q(
        `INSERT INTO payment_submissions (booking_id, invoice_id, booking_ref, customer_id, customer_name, payer_phone, method, transaction_ref, amount, provider, provider_payload, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'Pending') RETURNING *`,
        [b.id, invId, b.reference_number, customerId || b.customer_id, b.customer_name, String(phone || b.customer_phone), method, txn, amt.toFixed(2), provider.id, JSON.stringify(verdict.payload || {})]
      );
      let sub = camel(ins[0]);
      if (verdict.status === 'Approved') {
        const p = await recordPaymentSql({ invoiceId: invId, bookingId: b.id, customerName: b.customer_name, amount: amt, method, paymentType: 'Mobile Money', referenceCode: txn, notes: `Auto-verified by ${provider.id}` });
        await q(`UPDATE payment_submissions SET status='Approved', payment_id=$1, reviewed_by=$2, reviewed_at=now() WHERE id=$3`, [p.id, provider.id, sub.id]);
        sub = { ...sub, status: 'Approved' };
      }
      await h.logAdminActivity(b.customer_phone, 'Customer', 'PAYMENT_SUBMITTED', 'Booking', b.reference_number, `${method} $${amt.toFixed(2)} ref ${txn} (awaiting verification)`);
      res.status(201).json({ submission: { id: sub.id, status: sub.status, method, amount: amt, transactionRef: txn } });
    } catch (e) {
      fail(res, e, 'Failed to submit payment.');
    }
  });

  app.get('/api/admin/payment-submissions', requireAuth, requireRoles(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    try {
      const status = String(req.query.status || 'Pending');
      const rows =
        status === 'all'
          ? await q('SELECT * FROM payment_submissions ORDER BY id DESC LIMIT 200')
          : await q('SELECT * FROM payment_submissions WHERE status = $1 ORDER BY id DESC LIMIT 200', [status]);
      const pending = (await q(`SELECT count(*)::int AS n FROM payment_submissions WHERE status = 'Pending'`))[0]?.n || 0;
      res.json({ submissions: camelAll(rows), pendingCount: pending });
    } catch (e) {
      fail(res, e, 'Failed to load payment submissions.');
    }
  });

  app.post('/api/admin/payment-submissions/:id/approve', requireAuth, requireRoles(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    try {
      const claimed = (await q(`UPDATE payment_submissions SET status = 'Processing' WHERE id = $1 AND status = 'Pending' RETURNING *`, [Number(req.params.id)]))[0];
      if (!claimed) return res.status(409).json({ error: 'Codsigan horey ayaa loo go’aamiyay.' });
      try {
        const amt = req.body?.amount ? money(req.body.amount) : money(claimed.amount);
        const p = await recordPaymentSql({
          invoiceId: claimed.invoice_id,
          bookingId: claimed.booking_id,
          customerName: claimed.customer_name || 'Customer',
          amount: amt,
          method: claimed.method,
          paymentType: 'Mobile Money',
          referenceCode: claimed.transaction_ref,
          notes: `Verified by ${actor(req)}${req.body?.note ? ' · ' + String(req.body.note) : ''}`,
        });
        await q(`UPDATE payment_submissions SET status='Approved', payment_id=$1, reviewed_by=$2, reviewed_at=now(), review_note=$3 WHERE id=$4`, [
          p.id,
          actor(req),
          String(req.body?.note || ''),
          claimed.id,
        ]);
        await h.logAdminActivity(actor(req), role(req), 'PAYMENT_APPROVED', 'Payment', p.receiptNumber, `${claimed.method} $${amt.toFixed(2)} ref ${claimed.transaction_ref} (${claimed.booking_ref})`);
        res.json({ success: true, payment: p });
      } catch (inner) {
        await q(`UPDATE payment_submissions SET status='Pending' WHERE id=$1`, [claimed.id]);
        throw inner;
      }
    } catch (e) {
      fail(res, e, 'Failed to approve payment.');
    }
  });

  app.post('/api/admin/payment-submissions/:id/reject', requireAuth, requireRoles(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    try {
      const r = (await q(`UPDATE payment_submissions SET status='Rejected', reviewed_by=$1, reviewed_at=now(), review_note=$2 WHERE id=$3 AND status='Pending' RETURNING *`, [
        actor(req),
        String(req.body?.note || ''),
        Number(req.params.id),
      ]))[0];
      if (!r) return res.status(409).json({ error: 'Codsigan horey ayaa loo go’aamiyay.' });
      await h.logAdminActivity(actor(req), role(req), 'PAYMENT_REJECTED', 'Booking', r.booking_ref, `${r.method} ref ${r.transaction_ref}: ${r.review_note}`);
      res.json({ success: true });
    } catch (e) {
      fail(res, e, 'Failed to reject payment.');
    }
  });

  // ============ 6. PAYROLL ============
  app.patch('/api/admin/staff/:id/pay', requireAuth, requireRoles(...PAYROLL_ROLES), async (req: AuthRequest, res) => {
    try {
      const { payType, dailyRate, monthlySalary } = req.body || {};
      const s = (await q('SELECT * FROM staff WHERE id = $1', [Number(req.params.id)]))[0];
      if (!s) return res.status(404).json({ error: 'Staff not found' });
      const up = await q('UPDATE staff SET pay_type = $1, daily_rate = $2, monthly_salary = $3 WHERE id = $4 RETURNING *', [
        payType === 'monthly' ? 'monthly' : 'daily',
        money(dailyRate ?? s.daily_rate).toFixed(2),
        money(monthlySalary ?? s.monthly_salary).toFixed(2),
        s.id,
      ]);
      res.json({ staff: camel(up[0]) });
    } catch (e) {
      fail(res, e, 'Failed to update pay settings.');
    }
  });

  app.get('/api/admin/payroll', requireAuth, requireRoles(...PAYROLL_ROLES), async (req: AuthRequest, res) => {
    try {
      const period = /^\d{4}-\d{2}$/.test(String(req.query.period)) ? String(req.query.period) : todayMogadishu().slice(0, 7);
      res.json({ period, rows: await computePayroll(period) });
    } catch (e) {
      fail(res, e, 'Failed to load payroll.');
    }
  });

  app.post('/api/admin/payroll/entries', requireAuth, requireRoles(...PAYROLL_ROLES), async (req: AuthRequest, res) => {
    try {
      const { staffId, entryType, entryDate, days, amount, note } = req.body || {};
      if (!['attendance', 'advance', 'deduction', 'bonus'].includes(entryType)) return res.status(400).json({ error: 'Invalid entry type' });
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(entryDate)) ? String(entryDate) : todayMogadishu();
      const period = date.slice(0, 7);
      const s = (await q('SELECT * FROM staff WHERE id = $1', [Number(staffId)]))[0];
      if (!s) return res.status(404).json({ error: 'Staff not found' });
      const paid = await q(`SELECT 1 FROM payslips WHERE staff_id = $1 AND period = $2 AND status = 'Paid'`, [s.id, period]);
      if (paid.length) return res.status(409).json({ error: 'Mushaharka bishan horey ayaa loo bixiyay.' });
      let expenseId: number | null = null;
      if (entryType === 'advance' && money(amount) > 0) {
        const ex = await q(`INSERT INTO expenses (category, description, amount, expense_date, recorded_by) VALUES ('Salaries',$1,$2,$3,$4) RETURNING id`, [
          `Horumarin (advance) · ${s.name} · ${period}`,
          money(amount).toFixed(2),
          date,
          actor(req),
        ]);
        expenseId = ex[0].id;
      }
      const ins = await q(
        `INSERT INTO payroll_entries (staff_id, period, entry_type, entry_date, days, amount, note, created_by, expense_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [s.id, period, entryType, date, entryType === 'attendance' ? Number(days || 1) : 0, money(amount).toFixed(2), String(note || ''), actor(req), expenseId]
      );
      res.status(201).json({ entry: camel(ins[0]) });
    } catch (e) {
      fail(res, e, 'Failed to save payroll entry.');
    }
  });

  app.delete('/api/admin/payroll/entries/:id', requireAuth, requireRoles(...PAYROLL_ROLES), async (req: AuthRequest, res) => {
    try {
      const e = (await q('SELECT * FROM payroll_entries WHERE id = $1', [Number(req.params.id)]))[0];
      if (!e) return res.status(404).json({ error: 'Not found' });
      const paid = await q(`SELECT 1 FROM payslips WHERE staff_id = $1 AND period = $2 AND status = 'Paid'`, [e.staff_id, e.period]);
      if (paid.length) return res.status(409).json({ error: 'Mushaharka bishan horey ayaa loo bixiyay.' });
      if (e.expense_id) await q('DELETE FROM expenses WHERE id = $1', [e.expense_id]);
      await q('DELETE FROM payroll_entries WHERE id = $1', [e.id]);
      res.json({ success: true });
    } catch (err) {
      fail(res, err, 'Failed to delete entry.');
    }
  });

  app.post('/api/admin/payroll/payslips/generate', requireAuth, requireRoles(...PAYROLL_ROLES), async (req: AuthRequest, res) => {
    try {
      const period = /^\d{4}-\d{2}$/.test(String(req.body?.period)) ? String(req.body.period) : todayMogadishu().slice(0, 7);
      const only: number[] = Array.isArray(req.body?.staffIds) ? req.body.staffIds.map(Number) : [];
      const rows = await computePayroll(period);
      let n = 0;
      for (const r of rows) {
        if (only.length && !only.includes(Number(r.staff.id))) continue;
        if (r.payslip?.status === 'Paid') continue;
        if (r.gross <= 0 && r.net <= 0 && !r.payslip) continue;
        if (r.payslip) {
          await q(
            `UPDATE payslips SET pay_type=$1, base_rate=$2, days_worked=$3, gross=$4, bonuses=$5, advances=$6, deductions=$7, net=$8 WHERE id=$9`,
            [r.payType, r.baseRate, r.daysWorked, r.gross, r.bonuses, r.advances, r.deductions, r.net, r.payslip.id]
          );
        } else {
          const num = await nextCodeSql('SR-PAY', 'payslips', 'payslip_number');
          await q(
            `INSERT INTO payslips (payslip_number, staff_id, period, pay_type, base_rate, days_worked, gross, bonuses, advances, deductions, net, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (staff_id, period) DO NOTHING`,
            [num, r.staff.id, period, r.payType, r.baseRate, r.daysWorked, r.gross, r.bonuses, r.advances, r.deductions, r.net, actor(req)]
          );
        }
        n++;
      }
      await h.logAdminActivity(actor(req), role(req), 'PAYSLIPS_GENERATED', 'Payroll', period, `${n} payslips generated/updated`);
      res.json({ success: true, count: n, rows: await computePayroll(period) });
    } catch (e) {
      fail(res, e, 'Failed to generate payslips.');
    }
  });

  app.post('/api/admin/payroll/payslips/:id/pay', requireAuth, requireRoles(...PAYROLL_ROLES), async (req: AuthRequest, res) => {
    try {
      const p = (await q(`UPDATE payslips SET status='Paid', paid_at=now() WHERE id=$1 AND status <> 'Paid' RETURNING *`, [Number(req.params.id)]))[0];
      if (!p) return res.status(409).json({ error: 'Warqaddan horey ayaa loo bixiyay ama lama helin.' });
      const s = (await q('SELECT name FROM staff WHERE id = $1', [p.staff_id]))[0];
      let expenseId: number | null = null;
      if (Number(p.net) > 0) {
        const ex = await q(`INSERT INTO expenses (category, description, amount, expense_date, recorded_by) VALUES ('Salaries',$1,$2,$3,$4) RETURNING id`, [
          `Mushahar ${p.period} · ${s?.name || 'Staff'} · ${p.payslip_number}`,
          Number(p.net).toFixed(2),
          todayMogadishu(),
          actor(req),
        ]);
        expenseId = ex[0].id;
      }
      await q('UPDATE payslips SET expense_id = $1 WHERE id = $2', [expenseId, p.id]);
      await h.logAdminActivity(actor(req), role(req), 'PAYSLIP_PAID', 'Payroll', p.payslip_number, `Net $${Number(p.net).toFixed(2)} to ${s?.name}`);
      res.json({ success: true });
    } catch (e) {
      fail(res, e, 'Failed to mark payslip as paid.');
    }
  });

  app.delete('/api/admin/payroll/payslips/:id', requireAuth, requireRoles(...PAYROLL_ROLES), async (req: AuthRequest, res) => {
    try {
      const r = await q(`DELETE FROM payslips WHERE id = $1 AND status <> 'Paid' RETURNING id`, [Number(req.params.id)]);
      if (!r.length) return res.status(409).json({ error: 'Warqad la bixiyay lama tirtiri karo.' });
      res.json({ success: true });
    } catch (e) {
      fail(res, e, 'Failed to delete payslip.');
    }
  });

  // ============ 7. SUPPLIERS ============
  app.post('/api/admin/suppliers', requireAuth, requireRoles(...SUPPLIER_ROLES), async (req: AuthRequest, res) => {
    try {
      const { companyName, contactPerson, phone, category, district, balanceUsd, status } = req.body || {};
      if (!companyName || !phone) return res.status(400).json({ error: 'Magaca shirkadda iyo taleefanka waa qasab.' });
      const code = await nextCodeSql('SUP', 'suppliers', 'supplier_code');
      const r = await q(
        `INSERT INTO suppliers (supplier_code, company_name, contact_person, phone, category, district, balance_usd, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [code, String(companyName).trim(), String(contactPerson || ''), String(phone).trim(), String(category || 'Packing Materials'), String(district || ''), money(balanceUsd).toFixed(2), status === 'Inactive' ? 'Inactive' : 'Active']
      );
      await h.logAdminActivity(actor(req), role(req), 'SUPPLIER_CREATED', 'Supplier', code, String(companyName));
      res.status(201).json({ supplier: camel(r[0]) });
    } catch (e) {
      fail(res, e, 'Failed to create supplier.');
    }
  });

  app.patch('/api/admin/suppliers/:id', requireAuth, requireRoles(...SUPPLIER_ROLES), async (req: AuthRequest, res) => {
    try {
      const s = (await q('SELECT * FROM suppliers WHERE id = $1', [Number(req.params.id)]))[0];
      if (!s) return res.status(404).json({ error: 'Supplier not found' });
      const b = req.body || {};
      const r = await q(
        `UPDATE suppliers SET company_name=$1, contact_person=$2, phone=$3, category=$4, district=$5, balance_usd=$6, status=$7 WHERE id=$8 RETURNING *`,
        [
          String(b.companyName ?? s.company_name),
          String(b.contactPerson ?? s.contact_person ?? ''),
          String(b.phone ?? s.phone),
          String(b.category ?? s.category),
          String(b.district ?? s.district ?? ''),
          money(b.balanceUsd ?? s.balance_usd).toFixed(2),
          String(b.status ?? s.status),
          s.id,
        ]
      );
      if (b.companyName && b.companyName !== s.company_name) {
        await q('UPDATE purchase_orders SET supplier_name = $1 WHERE supplier_id = $2', [String(b.companyName), s.id]);
      }
      res.json({ supplier: camel(r[0]) });
    } catch (e) {
      fail(res, e, 'Failed to update supplier.');
    }
  });

  app.delete('/api/admin/suppliers/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
    try {
      const s = (await q('SELECT * FROM suppliers WHERE id = $1', [Number(req.params.id)]))[0];
      if (!s) return res.status(404).json({ error: 'Supplier not found' });
      // Purchase orders keep the supplier name as history; only the link is cleared.
      await q('UPDATE purchase_orders SET supplier_id = NULL WHERE supplier_id = $1', [s.id]);
      await q('DELETE FROM suppliers WHERE id = $1', [s.id]);
      await h.logAdminActivity(actor(req), role(req), 'SUPPLIER_DELETED', 'Supplier', s.supplier_code, s.company_name);
      res.json({ success: true });
    } catch (e) {
      fail(res, e, 'Failed to delete supplier.');
    }
  });

  // ============ 8. INSTANT QUOTE (public) ============
  app.post('/api/public/instant-quote', async (req, res) => {
    try {
      if (!h.checkRateLimit('iq:' + (req.ip || 'x'), 6, 60_000)) return res.status(429).json({ error: 'Codsiyo badan. Fadlan sug daqiiqad.' });
      const b = req.body || {};
      if (b.honeypot) return res.status(400).json({ error: 'Spam detected.' });
      const name = String(b.name || '').trim();
      const phone = String(b.phone || '').trim();
      if (!name || digits(phone).length < 7) return res.status(400).json({ error: 'Fadlan geli magacaaga iyo taleefan sax ah.' });
      const input = {
        moveType: b.moveType === 'office' ? ('office' as const) : ('home' as const),
        rooms: Number(b.rooms) || 1,
        fromDistrict: String(b.fromDistrict || ''),
        toDistrict: String(b.toDistrict || ''),
        floors: Number(b.floors) || 0,
        hasLift: !!b.hasLift,
        packing: !!b.packing,
      };
      const settingsMap = await getSettings();
      const est = computeInstantQuote(input, settingsMap);
      const leadCode = await nextCodeSql('LD', 'leads', 'lead_code');
      const summary = [
        `Instant quote: ${input.moveType === 'office' ? 'Xafiis' : 'Guri'} · ${input.rooms} qol`,
        `${input.fromDistrict} → ${input.toDistrict}`,
        `Dabaq ${input.floors}${input.hasLift ? ' (wiish)' : ' (jaranjaro)'}`,
        `Baakadeyn: ${input.packing ? 'Haa' : 'Maya'}`,
        b.preferredDate ? `Taariikhda: ${String(b.preferredDate).slice(0, 10)}` : '',
        est.priced ? `Qiyaas: $${est.low} – $${est.high}` : 'Qiimo lama dejin (waa la soo xaqiijin doonaa)',
        b.referralCode ? `Referral: ${String(b.referralCode).toUpperCase().slice(0, 20)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      await q(
        `INSERT INTO leads (lead_code, customer_name, phone, email, source, district, move_type, estimated_volume_m3, stage, follow_up_date, notes)
         VALUES ($1,$2,$3,$4,'Website Instant Quote',$5,$6,$7,'New',$8,$9)`,
        [leadCode, name, phone, String(b.email || ''), input.fromDistrict || 'Hodan', input.moveType === 'office' ? 'Office Moving' : 'Home Moving', (input.rooms * 6).toFixed(2), todayMogadishu(), summary]
      );
      await h.logAdminActivity(phone, 'Customer', 'INSTANT_QUOTE_LEAD', 'Lead', leadCode, summary);
      res.status(201).json({ leadCode, estimate: est });
    } catch (e) {
      fail(res, e, 'Failed to submit quote request.');
    }
  });

  // ============ 9. REFERRALS ============
  app.get('/api/admin/referrals', requireAuth, requireRoles(...OFFICE_ROLES), async (req: AuthRequest, res) => {
    try {
      const rows = await q(
        `SELECT r.*, rc.name AS referrer_name, rc.phone AS referrer_phone, b.reference_number AS booking_ref, b.customer_name AS referred_name,
                b.customer_phone AS referred_phone, b.status AS booking_status, b.customer_id AS booking_customer_id
         FROM referrals r LEFT JOIN customers rc ON rc.id = r.referrer_customer_id LEFT JOIN bookings b ON b.id = r.referred_booking_id
         ORDER BY r.id DESC LIMIT 300`
      );
      const out = [];
      for (const r of rows) {
        const inv = await q(
          `SELECT i.id, i.invoice_number, i.customer_name, i.total, i.subtotal, i.discount, i.balance_due, i.status, i.booking_id FROM invoices i
           WHERE i.status <> 'Paid' AND (i.booking_id = $1 OR i.booking_id IN (SELECT id FROM bookings WHERE customer_id = $2)) ORDER BY i.id DESC LIMIT 10`,
          [r.referred_booking_id || 0, r.referrer_customer_id || 0]
        );
        out.push({ ...camel(r), openInvoices: camelAll(inv) });
      }
      const codes = (await q(`SELECT count(*)::int AS n FROM customers WHERE referral_code <> ''`))[0]?.n || 0;
      res.json({ referrals: out, customersWithCodes: codes });
    } catch (e) {
      fail(res, e, 'Failed to load referrals.');
    }
  });

  app.post('/api/admin/referrals/:id/reward', requireAuth, requireRoles(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    try {
      const r = (await q('SELECT * FROM referrals WHERE id = $1', [Number(req.params.id)]))[0];
      if (!r) return res.status(404).json({ error: 'Referral not found' });
      if (r.status === 'Rewarded') return res.status(409).json({ error: 'Dhimistan horey ayaa loo bixiyay.' });
      const s = await getSettings();
      const pct = Number(req.body?.pct ?? s.referral_discount_pct);
      if (!(pct > 0 && pct <= 100)) return res.status(400).json({ error: 'Dhig boqolkiiba dhimista (Settings → Referral %).' });
      const inv = (await q('SELECT * FROM invoices WHERE id = $1', [Number(req.body?.invoiceId)]))[0];
      if (!inv) return res.status(400).json({ error: 'Dooro biilka (invoice) dhimista la saarayo.' });
      if (inv.status === 'Paid') return res.status(400).json({ error: 'Biilkan waa la bixiyay.' });
      const disc = money((Number(inv.subtotal) * pct) / 100);
      const newDiscount = money(Number(inv.discount || 0) + disc);
      const newTotal = Math.max(0, money(Number(inv.subtotal) - newDiscount));
      const bal = Math.max(0, money(newTotal - Number(inv.amount_paid || 0)));
      await q('UPDATE invoices SET discount=$1, total=$2, balance_due=$3, status=$4 WHERE id=$5', [
        newDiscount.toFixed(2),
        newTotal.toFixed(2),
        bal.toFixed(2),
        bal <= 0.01 ? 'Paid' : Number(inv.amount_paid) > 0 ? 'Partial' : inv.status,
        inv.id,
      ]);
      await q(`UPDATE referrals SET status='Rewarded', discount_pct=$1, discount_amount=$2, discount_invoice_id=$3, rewarded_by=$4, rewarded_at=now() WHERE id=$5`, [
        pct,
        disc.toFixed(2),
        inv.id,
        actor(req),
        r.id,
      ]);
      await h.logAdminActivity(actor(req), role(req), 'REFERRAL_REWARDED', 'Invoice', inv.invoice_number, `${pct}% referral discount ($${disc.toFixed(2)})`);
      res.json({ success: true, discount: disc });
    } catch (e) {
      fail(res, e, 'Failed to apply referral discount.');
    }
  });

  // ============ 10. REPORTS ============
  app.get('/api/admin/reports/profit', requireAuth, requireRoles(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    try {
      const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from)) ? String(req.query.from) : '0000-01-01';
      const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to)) ? String(req.query.to) : '9999-12-31';
      const [bk, pays, invs, exps, fuel, staffRows, allDayBookings] = await Promise.all([
        q(`SELECT id, reference_number, customer_name, from_district, to_district, preferred_date, status, quoted_amount, assigned_staff_ids, assigned_vehicle_id
           FROM bookings WHERE preferred_date >= $1 AND preferred_date <= $2 AND status <> ALL($3::text[]) ORDER BY preferred_date DESC LIMIT 1000`, [from, to, CANCELLED]),
        q('SELECT booking_id, invoice_id, amount, paid_at FROM payments'),
        q('SELECT id, booking_id FROM invoices'),
        q('SELECT booking_id, amount, category, expense_date FROM expenses'),
        q(`SELECT vehicle_id, cost, log_date FROM vehicle_logs WHERE log_type ILIKE 'fuel%'`),
        q('SELECT id, daily_rate, monthly_salary, pay_type FROM staff'),
        q(`SELECT id, preferred_date, assigned_staff_ids, assigned_vehicle_id FROM bookings WHERE status <> ALL($1::text[])`, [CANCELLED]),
      ]);
      const invBooking: Record<number, number> = {};
      for (const i of invs) if (i.booking_id) invBooking[i.id] = i.booking_id;
      const dayIndex: Record<string, any[]> = {};
      for (const b of allDayBookings) (dayIndex[b.preferred_date] ||= []).push(b);
      const jobs = bk.map((b) => {
        const revenue = pays
          .filter((p) => p.booking_id === b.id || (!p.booking_id && p.invoice_id && invBooking[p.invoice_id] === b.id))
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const linkedExpenses = exps.filter((e) => e.booking_id === b.id).reduce((s, e) => s + Number(e.amount || 0), 0);
        const sameDay = dayIndex[b.preferred_date] || [];
        let fuelShare = 0;
        if (b.assigned_vehicle_id) {
          const vJobs = sameDay.filter((x) => x.assigned_vehicle_id === b.assigned_vehicle_id).length || 1;
          fuelShare = fuel.filter((f) => f.vehicle_id === b.assigned_vehicle_id && f.log_date === b.preferred_date).reduce((s, f) => s + Number(f.cost || 0), 0) / vJobs;
        }
        let payrollShare = 0;
        for (const sid of (b.assigned_staff_ids || []).map(Number)) {
          const s = staffRows.find((x) => x.id === sid);
          if (!s) continue;
          const dayCost = s.pay_type === 'monthly' ? Number(s.monthly_salary || 0) / 26 : Number(s.daily_rate || 0);
          const sJobs = sameDay.filter((x) => (x.assigned_staff_ids || []).map(Number).includes(sid)).length || 1;
          payrollShare += dayCost / sJobs;
        }
        const cost = linkedExpenses + fuelShare + payrollShare;
        return {
          id: b.id,
          ref: b.reference_number,
          customer: b.customer_name,
          date: b.preferred_date,
          route: `${b.from_district} → ${b.to_district}`,
          status: b.status,
          quoted: money(b.quoted_amount),
          revenue: money(revenue),
          linkedExpenses: money(linkedExpenses),
          fuelShare: money(fuelShare),
          payrollShare: money(payrollShare),
          cost: money(cost),
          profit: money(revenue - cost),
        };
      });
      const dist: Record<string, { district: string; from: number; to: number; total: number }> = {};
      for (const b of bk) {
        (dist[b.from_district] ||= { district: b.from_district, from: 0, to: 0, total: 0 }).from++;
        dist[b.from_district].total++;
        (dist[b.to_district] ||= { district: b.to_district, from: 0, to: 0, total: 0 }).to++;
        if (b.to_district !== b.from_district) dist[b.to_district].total++;
      }
      const months: Record<string, { month: string; revenue: number; expenses: number }> = {};
      const inRange = (d: string) => d >= from.slice(0, 7) && d <= to.slice(0, 7);
      for (const p of pays) {
        const m = new Date(p.paid_at || Date.now()).toISOString().slice(0, 7);
        if (!inRange(m)) continue;
        (months[m] ||= { month: m, revenue: 0, expenses: 0 }).revenue += Number(p.amount || 0);
      }
      for (const e of exps) {
        const m = String(e.expense_date || '').slice(0, 7);
        if (!m || !inRange(m)) continue;
        (months[m] ||= { month: m, revenue: 0, expenses: 0 }).expenses += Number(e.amount || 0);
      }
      const monthly = Object.values(months)
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-24)
        .map((m) => ({ ...m, revenue: money(m.revenue), expenses: money(m.expenses), net: money(m.revenue - m.expenses) }));
      res.json({
        from,
        to,
        jobs,
        totals: {
          revenue: money(jobs.reduce((s, j) => s + j.revenue, 0)),
          cost: money(jobs.reduce((s, j) => s + j.cost, 0)),
          profit: money(jobs.reduce((s, j) => s + j.profit, 0)),
        },
        topDistricts: Object.values(dist)
          .sort((a, b) => b.total - a.total)
          .slice(0, 12),
        monthly,
        method:
          'Revenue = payments linked to the booking (directly or via its invoice). Cost = expenses linked to the job + fuel logged for the assigned truck on the job date (split across that truck’s jobs that day) + crew day cost (daily rate, or monthly salary ÷ 26) split across each crew member’s jobs that day.',
      });
    } catch (e) {
      fail(res, e, 'Failed to build profit report.');
    }
  });

  // ============ 11. BACKUP ============
  const backupAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const supplied = String(req.headers['x-backup-token'] || '');
    const expected = process.env.BACKUP_TOKEN || '';
    if (supplied) {
      if (expected && safeEqual(supplied, expected)) {
        req.user = { uid: 'backup-script', email: 'backup-token', role: 'Admin' } as any;
        return next();
      }
      return res.status(401).json({ error: 'Invalid backup token' });
    }
    return requireAuth(req, res, () => requireAdmin(req, res, next));
  };

  const sendJson = (req: Request, res: Response, body: any, filename: string) => {
    const json = JSON.stringify(body);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    if (String(req.headers['accept-encoding'] || '').includes('gzip') && json.length > 2048) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.end(gzipSync(Buffer.from(json)));
    }
    res.end(json);
  };

  app.get('/api/admin/backup', backupAuth, async (req: AuthRequest, res) => {
    try {
      const tables = (
        await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`)
      ).map((r) => r.table_name as string);
      const out: Record<string, any[]> = {};
      for (const t of tables) {
        if (t === 'photos') {
          out[t] = await q('SELECT id, entity_type, entity_id, kind, mime, size_bytes, caption, uploaded_by, created_at FROM photos ORDER BY id');
        } else {
          out[t] = await q(`SELECT * FROM "${t.replace(/"/g, '')}"`);
        }
      }
      const photoStats = (await q('SELECT count(*)::int AS n, coalesce(sum(size_bytes),0)::bigint AS bytes FROM photos'))[0];
      await h.logAdminActivity(req.user?.email || 'backup', 'Admin', 'BACKUP_EXPORTED', 'System', 'backup', `${tables.length} tables`);
      sendJson(
        req,
        res,
        {
          app: 'SOORAR ERP',
          exportedAt: new Date().toISOString(),
          note: 'Full JSON export of every table. Restore is intentionally NOT built into the app (export only). Photo image bytes are exported separately in pages from /api/admin/backup/photos?offset=0&limit=10 (the Settings backup button merges them into this file).',
          tableCounts: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])),
          photos: { count: photoStats?.n || 0, totalBytes: Number(photoStats?.bytes || 0), endpoint: '/api/admin/backup/photos?offset=0&limit=10' },
          tables: out,
        },
        `soorar-backup-${todayMogadishu()}.json`
      );
    } catch (e) {
      fail(res, e, 'Backup failed.');
    }
  });

  app.get('/api/admin/backup/photos', backupAuth, async (req: AuthRequest, res) => {
    try {
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 10));
      const rows = await q('SELECT id, kind, mime, data FROM photos ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
      const total = (await q('SELECT count(*)::int AS n FROM photos'))[0]?.n || 0;
      sendJson(
        req,
        res,
        { offset, limit, total, photos: rows.map((r) => ({ id: r.id, kind: r.kind, mime: r.mime, base64: Buffer.from(r.data).toString('base64') })) },
        `soorar-photos-${offset}.json`
      );
    } catch (e) {
      fail(res, e, 'Photo backup failed.');
    }
  });

  // ============ 12. PAGINATED LISTS ============
  const LISTS: Record<string, { table: string; order: string; search: string[] }> = {
    bookings: { table: 'bookings', order: 'id DESC', search: ['reference_number', 'customer_name', 'customer_phone', 'from_district', 'to_district', 'status'] },
    customers: { table: 'customers', order: 'id DESC', search: ['name', 'phone', 'email'] },
    payments: { table: 'payments', order: 'id DESC', search: ['receipt_number', 'customer_name', 'payment_method', 'reference_code'] },
    'activity-log': { table: 'activity_log', order: 'id DESC', search: ['actor_email', 'action', 'entity_type', 'entity_id', 'details'] },
  };

  app.get('/api/admin/list/:entity', requireAuth, async (req: AuthRequest, res) => {
    try {
      const cfg = LISTS[String(req.params.entity)];
      if (!cfg) return res.status(404).json({ error: 'Unknown list' });
      if (['payments'].includes(String(req.params.entity)) && !['Admin', 'Super Admin', ...FINANCE_ROLES].includes(req.user?.role || '')) {
        return res.status(403).json({ error: 'Doorkaagu ma oggola tallaabadan.' });
      }
      if (req.params.entity === 'activity-log' && req.user?.role !== 'Admin') return res.status(403).json({ error: 'Admin kaliya.' });
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize) || 50));
      const term = String(req.query.q || '').trim();
      const where = term ? `WHERE ${cfg.search.map((c) => `coalesce("${c}"::text,'') ILIKE $1`).join(' OR ')}` : '';
      const params: any[] = term ? [`%${term}%`] : [];
      const total = (await q(`SELECT count(*)::int AS n FROM "${cfg.table}" ${where}`, params))[0]?.n || 0;
      let rows = await q(
        `SELECT * FROM "${cfg.table}" ${where} ORDER BY ${cfg.order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        params
      );
      if (cfg.table === 'customers') rows = rows.map(({ password_hash, ...rest }) => ({ ...rest, has_password: !!password_hash }));
      res.json({ rows: camelAll(rows), total, page, pageSize, pages: Math.ceil(total / pageSize) });
    } catch (e) {
      fail(res, e, 'Failed to load list.');
    }
  });

  // Link a login account to a crew/staff record (for "Shaqadayda Maanta").
  app.patch('/api/admin/users/:id/staff-link', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const staffId = Number(req.body?.staffId) || null;
      const r = await q('UPDATE users SET staff_id = $1 WHERE id = $2 RETURNING id, staff_id', [staffId, Number(req.params.id)]);
      if (!r.length) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true, staffId });
    } catch (e) {
      fail(res, e, 'Failed to link staff record.');
    }
  });

  // Link an expense to a job (profit per job).
  app.patch('/api/admin/expenses/:id/booking', requireAuth, requireRoles(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    try {
      const r = await q('UPDATE expenses SET booking_id = $1 WHERE id = $2 RETURNING id', [Number(req.body?.bookingId) || null, Number(req.params.id)]);
      if (!r.length) return res.status(404).json({ error: 'Expense not found' });
      res.json({ success: true });
    } catch (e) {
      fail(res, e, 'Failed to link expense.');
    }
  });
}
