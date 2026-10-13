import express from 'express';
import path from 'path';
import { db, ensureSchema } from './src/db/index.ts';
import {
  users,
  customers,
  bookings,
  bookingItems,
  quotes,
  invoices,
  invoiceItems,
  payments,
  staff,
  vehicles,
  vehicleLogs,
  expenses,
  reviews,
  services,
  faqs,
  gallery,
  settings,
  activityLog,
  leads,
  packingMaterials,
  storageUnits,
  suppliers,
  purchaseOrders,
  damageClaims,
  ledgerAccounts,
  journalEntries,
} from './src/db/schema.ts';
import { ensureSeeded } from './src/db/seed.ts';
import { requireAuth, requireAdmin, requireRoles, AuthRequest } from './src/middleware/auth.ts';
import { ensureOwnersActive, isOwnerEmail } from './src/db/users.ts';
import { hashPassword, verifyPassword, needsRehash, signStaffToken, isHashed, signCustomerToken } from './src/lib/security.ts';
import { registerExtensions, linkReferral } from './src/server/extensions.ts';
import { desc, eq, asc, count } from 'drizzle-orm';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));
app.disable('x-powered-by');
app.set('trust proxy', true);

// Upgrade any legacy plaintext staff passwords to scrypt hashes (runs once per instance).
let legacyMigration: Promise<void> | undefined;
function migrateLegacyPasswords() {
  if (!legacyMigration) {
    legacyMigration = (async () => {
      const all = await db.select().from(users);
      for (const u of all) {
        if (u.passwordHash && !isHashed(u.passwordHash)) {
          await db.update(users).set({ passwordHash: hashPassword(u.passwordHash) }).where(eq(users.id, u.id));
        }
      }
      await ensureOwnersActive();
    })().catch((e) => {
      console.error('Legacy password migration failed:', e);
      legacyMigration = undefined;
    });
  }
  return legacyMigration;
}

// Never send password hashes to the browser.
const publicUser = (u: any) => {
  if (!u) return u;
  const { passwordHash, ...rest } = u;
  return { ...rest, hasPassword: !!passwordHash };
};

// Make sure the database schema exists/is upgraded before any API call.
app.use('/api', async (_req, res, next) => {
  try {
    await ensureSchema();
    await migrateLegacyPasswords();
    next();
  } catch (err) {
    console.error('Database not ready:', err);
    res.status(503).json({ error: 'Database not ready' });
  }
});

// Simple in-memory rate limiter for public form submissions
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxRequests = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}


// Sequential document numbers (e.g. SR-INV-2026-0007) that never collide after deletions.
function nextCode(base: string, existing: Array<string | null | undefined>) {
  const year = new Date().getFullYear();
  let max = 0;
  for (const c of existing) {
    const m = String(c || '').match(/-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${base}-${year}-${String(max + 1).padStart(4, '0')}`;
}

async function logAdminActivity(actorEmail: string, actorRole: string, action: string, entityType: string, entityId: string, details: string) {
  try {
    await db.insert(activityLog).values({
      actorEmail,
      actorRole,
      action,
      entityType,
      entityId,
      details,
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

// v2 ERP extensions (crew, dispatch, photos, payments, payroll, suppliers, quotes, referrals, reports, backup)
registerExtensions(app, { logAdminActivity, checkRateLimit });

// ==========================================
// SEO ROUTES (sitemap.xml & robots.txt)
// ==========================================
app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const pages = ['', '/services', '/pricing', '/about', '/gallery', '/reviews', '/faq', '/contact', '/booking', '/privacy', '/terms'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${baseUrl}${p}</loc>
    <changefreq>weekly</changefreq>
    <priority>${p === '' ? '1.0' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
  res.type('application/xml').send(xml);
});

// ==========================================
// PUBLIC API ROUTES
// ==========================================
app.get('/api/public/bootstrap', async (_req, res) => {
  try {
    await ensureSeeded();
    const [allServices, allFaqs, approvedReviews, allGallery, allSettings] = await Promise.all([
      db.select().from(services).orderBy(asc(services.sortOrder)),
      db.select().from(faqs).orderBy(asc(faqs.sortOrder)),
      db.select().from(reviews).where(eq(reviews.status, 'Approved')).orderBy(desc(reviews.id)),
      db.select().from(gallery).orderBy(desc(gallery.id)),
      db.select().from(settings),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      settingsMap[s.key] = s.value;
    }

    res.json({
      services: allServices,
      faqs: allFaqs,
      reviews: approvedReviews,
      gallery: allGallery,
      settings: settingsMap,
    });
  } catch (error) {
    console.error('Public bootstrap failed:', error);
    res.status(500).json({ error: 'Failed to load public site data.' });
  }
});

// Public Booking Submission
app.post('/api/public/bookings', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip, 10, 60_000)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }

    const {
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
      photos,
      preferredDate,
      preferredTime,
      flexibleDate,
      notes,
      language,
      referralCode,
    } = req.body;

    // Honeypot spam protection
    if (honeypot) {
      return res.status(400).json({ error: 'Spam detected.' });
    }

    if (!customerName || !customerPhone || !fromDistrict || !toDistrict || !preferredDate) {
      return res.status(400).json({ error: 'Missing required booking fields.' });
    }

    // Generate reference number like SR-2026-0005
    const existingBookings = await db.select().from(bookings);
    const referenceNumber = nextCode('SR', existingBookings.map((b) => b.referenceNumber));

    // Create or find customer
    let customerId: number | null = null;
    const phoneDigits = String(customerPhone).replace(/[^0-9]/g, '');
    const knownCustomer = (await db.select().from(customers)).find(
      (c) => phoneDigits.length >= 7 && c.phone.replace(/[^0-9]/g, '').slice(-9) === phoneDigits.slice(-9)
    );
    const insertedCustomer = knownCustomer
      ? [knownCustomer]
      : await db
      .insert(customers)
      .values({
        name: String(customerName).trim(),
        phone: String(customerPhone).trim(),
        email: customerEmail ? String(customerEmail).trim() : '',
        customerType: Array.isArray(selectedServices) && selectedServices.includes('office') ? 'business' : 'family',
        notes: `Created from online booking ${referenceNumber}`,
      })
      .returning();

    if (insertedCustomer[0]) {
      customerId = insertedCustomer[0].id;
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const created = await db
      .insert(bookings)
      .values({
        referenceNumber,
        customerId,
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: customerEmail ? String(customerEmail).trim() : '',
        services: Array.isArray(selectedServices) && selectedServices.length > 0 ? selectedServices : ['home'],
        fromDistrict: String(fromDistrict),
        fromAddress: fromAddress ? String(fromAddress) : '',
        fromFloor: Number(fromFloor) || 0,
        fromLift: Boolean(fromLift),
        toDistrict: String(toDistrict),
        toAddress: toAddress ? String(toAddress) : '',
        toFloor: Number(toFloor) || 0,
        toLift: Boolean(toLift),
        sizeDescription: sizeDescription ? String(sizeDescription) : '',
        largeItems: largeItems ? String(largeItems) : '',
        photos: Array.isArray(photos) ? photos : [],
        preferredDate: String(preferredDate),
        preferredTime: preferredTime ? String(preferredTime) : '08:00',
        flexibleDate: Boolean(flexibleDate),
        notes: notes ? String(notes) : '',
        status: 'New',
        language: language === 'en' ? 'en' : 'so',
        statusHistory: [{ status: 'New', timestamp: nowStr, note: 'Submitted via online booking form' }],
      })
      .returning();

    if (referralCode && created[0]) {
      try {
        await linkReferral(created[0].id, customerId, String(referralCode));
      } catch (e) {
        console.error('Referral link failed:', e);
      }
    }

    await logAdminActivity(
      customerEmail || customerPhone,
      'Customer',
      'NEW_BOOKING_SUBMITTED',
      'Booking',
      referenceNumber,
      `New move booking from ${fromDistrict} to ${toDistrict} on ${preferredDate} (Admin Email Notification queued)`
    );

    res.status(201).json({
      booking: created[0],
      referenceNumber,
      adminEmailNotified: true,
    });
  } catch (error) {
    console.error('Failed to create booking:', error);
    res.status(500).json({ error: 'Failed to submit booking. Please try again.' });
  }
});

// Public Review Submission (Moderated in Admin)
app.post('/api/public/reviews', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip, 5, 60_000)) {
      return res.status(429).json({ error: 'Too many requests.' });
    }
    const { honeypot, customerName, district, serviceType, rating, comment } = req.body;
    if (honeypot) {
      return res.status(400).json({ error: 'Spam detected.' });
    }
    if (!customerName || !comment) {
      return res.status(400).json({ error: 'Name and review comment are required.' });
    }

    const created = await db
      .insert(reviews)
      .values({
        customerName: String(customerName).trim(),
        district: district ? String(district).trim() : 'Mogadishu',
        serviceType: serviceType ? String(serviceType) : 'Home Moving',
        rating: Math.min(5, Math.max(1, Number(rating) || 5)),
        commentSo: String(comment).trim(),
        commentEn: String(comment).trim(),
        status: 'Pending', // Moderated in Admin
      })
      .returning();

    res.status(201).json({ review: created[0] });
  } catch (error) {
    console.error('Failed to submit review:', error);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// Public Contact Form
app.post('/api/public/contact', async (req, res) => {
  try {
    const { honeypot, name, phone, email, message } = req.body;
    if (honeypot) {
      return res.status(400).json({ error: 'Spam detected.' });
    }
    if (!name || !phone || !message) {
      return res.status(400).json({ error: 'Name, phone, and message are required.' });
    }
    await logAdminActivity(
      email || phone,
      'Visitor',
      'CONTACT_MESSAGE',
      'Contact',
      phone,
      `${name} (${phone}): ${message}`
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Failed to submit contact form:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// ==========================================
// CUSTOMER SELF-REGISTRATION, LOGIN & LIVE JOB/TRUCK TRACKING
// ==========================================
app.post('/api/public/customer/register', async (req, res) => {
  try {
    const { name, phone, email, password, customerType } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Magaca, taleefanka iyo furaha (password) waa qasab.' });
    }

    const cleanPhone = String(phone).trim();
    const allCusts = await db.select().from(customers);
    const existing = allCusts.find(
      (c) =>
        c.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, '') ||
        (email && c.email && c.email.toLowerCase() === String(email).trim().toLowerCase())
    );

    let customerRecord;
    if (existing) {
      const updated = await db
        .update(customers)
        .set({
          name: String(name).trim(),
          email: email ? String(email).trim() : existing.email,
          passwordHash: hashPassword(String(password)),
          customerType: customerType || existing.customerType,
        })
        .where(eq(customers.id, existing.id))
        .returning();
      customerRecord = updated[0];
    } else {
      const created = await db
        .insert(customers)
        .values({
          name: String(name).trim(),
          phone: cleanPhone,
          email: email ? String(email).trim() : '',
          passwordHash: hashPassword(String(password)),
          customerType: customerType || 'family',
          notes: 'Customer self-registered via Customer Portal',
        })
        .returning();
      customerRecord = created[0];
    }

    await logAdminActivity(
      customerRecord.email || customerRecord.phone,
      'Customer',
      'CUSTOMER_SELF_REGISTERED',
      'Customer',
      String(customerRecord.id),
      `Customer ${customerRecord.name} (${customerRecord.phone}) created their own account`
    );

    res.status(201).json({
      customer: {
        id: customerRecord.id,
        name: customerRecord.name,
        phone: customerRecord.phone,
        email: customerRecord.email,
        customerType: customerRecord.customerType,
        token: signCustomerToken(customerRecord.id, customerRecord.passwordHash),
      },
    });
  } catch (error) {
    console.error('Customer registration failed:', error);
    res.status(500).json({ error: 'Diiwaangelintu ma suurtogalin. Fadlan isku day mar kale.' });
  }
});

app.post('/api/public/customer/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Fadlan geli taleefanka/email-ka iyo password-ka.' });
    }

    await ensureSeeded();
    const cleanId = String(identifier).trim().toLowerCase().replace(/\s+/g, '');
    const allCusts = await db.select().from(customers);
    const found = allCusts.find(
      (c) =>
        c.phone.replace(/\s+/g, '').toLowerCase() === cleanId ||
        (cleanId.replace(/[^0-9]/g, '').length >= 7 && c.phone.replace(/[^0-9]/g, '').endsWith(cleanId.replace(/[^0-9]/g, ''))) ||
        (c.email && c.email.toLowerCase() === cleanId)
    );

    if (!found || !found.passwordHash || !verifyPassword(String(password), found.passwordHash)) {
      return res.status(401).json({ error: 'Taleefanka ama Password-ka waa khalad.' });
    }

    res.json({
      customer: {
        id: found.id,
        name: found.name,
        phone: found.phone,
        email: found.email,
        customerType: found.customerType,
        token: signCustomerToken(found.id, found.passwordHash),
      },
    });
  } catch (error) {
    console.error('Customer login failed:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/api/public/customer/tracking', async (req, res) => {
  try {
    await ensureSeeded();
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const phone = req.query.phone ? String(req.query.phone).replace(/\s+/g, '') : '';
    const ref = req.query.ref ? String(req.query.ref).trim().toUpperCase() : '';

    const [allBookings, allVehicles, allStaff, allItems, allInvoices, allQuotes] = await Promise.all([
      db.select().from(bookings).orderBy(desc(bookings.id)),
      db.select().from(vehicles),
      db.select().from(staff),
      db.select().from(bookingItems),
      db.select().from(invoices),
      db.select().from(quotes),
    ]);

    const matchedBookings = allBookings.filter((b) => {
      if (ref && b.referenceNumber.toUpperCase() === ref) return true;
      if (customerId && b.customerId === customerId) return true;
      if (
        phone &&
        phone.length >= 6 &&
        b.customerPhone.replace(/\s+/g, '').includes(phone.slice(-7))
      ) {
        return true;
      }
      return false;
    });

    const enriched = matchedBookings.map((b) => {
      const assignedVehicle = allVehicles.find((v) => v.id === b.assignedVehicleId) || null;
      const staffIds = Array.isArray(b.assignedStaffIds) ? b.assignedStaffIds : [];
      const assignedCrew = allStaff.filter((s) => staffIds.includes(s.id));
      const checklist = allItems.filter((it) => it.bookingId === b.id);
      const bookingInvoices = allInvoices.filter((inv) => inv.bookingId === b.id);
      const bookingQuotes = allQuotes.filter((q) => q.bookingId === b.id);

      return {
        ...b,
        assignedVehicle,
        assignedCrew,
        checklist,
        invoices: bookingInvoices,
        quotes: bookingQuotes,
      };
    });

    res.json({ bookings: enriched });
  } catch (error) {
    console.error('Error loading customer tracking:', error);
    res.status(500).json({ error: 'Failed to load tracking info.' });
  }
});

// ==========================================
// PUBLIC STAFF ID CARD QR VERIFICATION ENDPOINT
// ==========================================
app.get('/api/public/verify-staff/:idCard', async (req, res) => {
  try {
    await ensureSeeded();
    const rawCode = decodeURIComponent(String(req.params.idCard || '')).trim().toLowerCase();
    const allStaffMembers = await db.select().from(staff);
    const matched =
      allStaffMembers.find(
        (s) =>
          (s.idCardNumber || '').toLowerCase() === rawCode
      );

    if (!matched) {
      return res.status(404).json({ verified: false, error: 'Staff ID not found in SOORAR registry.' });
    }

    res.json({
      verified: true,
      company: 'SOORAR Home & Office Moving Services · Mogadishu, Somalia',
      hotline: '+252 770 505 028',
      verifiedAt: new Date().toISOString(),
      staff: {
        id: matched.id,
        name: matched.name,
        role: matched.role,
        phone: matched.phone,
        idCardNumber: matched.idCardNumber,
        photoUrl: matched.photoUrl || '',
        availability: matched.availability,
        jobsCompleted: matched.jobsCompleted,
        branch: 'Mogadishu HQ (Maka Al-Mukarama Road, Hodan)',
        status: 'ACTIVE & VERIFIED SOORAR SPECIALIST',
      },
    });
  } catch (error) {
    console.error('Error verifying staff ID:', error);
    res.status(500).json({ verified: false, error: 'Verification error.' });
  }
});

// ==========================================
// UNIFIED LOGIN (SINGLE LOGIN FOR CUSTOMERS & STAFF/ADMIN)
// ==========================================
app.post('/api/public/unified-login', async (req, res) => {
  try {
    await ensureSeeded();
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Fadlan geli Email/Taleefan iyo Password-ka.' });
    }

    const cleanInput = String(identifier).trim().toLowerCase();
    const cleanPhoneDigits = cleanInput.replace(/[^0-9]/g, '');

    // 1. First check if the user is a Staff / Manager / Accountant / Admin in `users`
    const allSysUsers = await db.select().from(users);
    const matchedStaff = allSysUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanInput ||
        (u.phone && u.phone.replace(/\s+/g, '').toLowerCase() === cleanInput.replace(/\s+/g, '')) ||
        (cleanPhoneDigits.length >= 7 && u.phone && u.phone.replace(/[^0-9]/g, '').endsWith(cleanPhoneDigits.slice(-7)))
    );

    if (matchedStaff && matchedStaff.passwordHash && verifyPassword(String(password), matchedStaff.passwordHash)) {
      if (matchedStaff.status !== 'Active') {
        return res.status(403).json({ error: 'Akoonkan shaqaalaha waa la xiray (Suspended). La xiriir Admin-ka.' });
      }
      let storedHash = matchedStaff.passwordHash;
      if (needsRehash(storedHash)) {
        storedHash = hashPassword(String(password));
        await db.update(users).set({ passwordHash: storedHash }).where(eq(users.id, matchedStaff.id));
      }
      const token = signStaffToken(matchedStaff.uid, storedHash);
      return res.json({
        accountType: 'staff',
        token,
        user: {
          id: matchedStaff.id,
          uid: matchedStaff.uid,
          email: matchedStaff.email,
          name: matchedStaff.name,
          phone: matchedStaff.phone,
          role: matchedStaff.role,
        },
      });
    }

    // 2. Otherwise check if the user is a Customer in `customers`
    const allCusts = await db.select().from(customers);
    const matchedCustomer = allCusts.find(
      (c) =>
        c.phone.replace(/\s+/g, '').toLowerCase() === cleanInput.replace(/\s+/g, '') ||
        (cleanPhoneDigits.length >= 7 && c.phone.replace(/[^0-9]/g, '').endsWith(cleanPhoneDigits.slice(-7))) ||
        (c.email && c.email.toLowerCase() === cleanInput)
    );

    if (matchedCustomer && matchedCustomer.passwordHash && verifyPassword(String(password), matchedCustomer.passwordHash)) {
      return res.json({
        accountType: 'customer',
        customer: {
          id: matchedCustomer.id,
          name: matchedCustomer.name,
          phone: matchedCustomer.phone,
          email: matchedCustomer.email,
          customerType: matchedCustomer.customerType,
          token: signCustomerToken(matchedCustomer.id, matchedCustomer.passwordHash),
        },
      });
    }

    return res.status(401).json({
      error: 'Email-ka/Taleefanka ama Password-ka waa khalad. Haddii aad tahay macmiil cusub fadlan guji Register.',
    });
  } catch (error) {
    console.error('Unified login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ==========================================
// ADMIN-PROVISIONED STAFF / MANAGER LOGIN
// ==========================================
app.post('/api/admin/staff-login', async (req, res) => {
  try {
    await ensureSeeded();
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ error: 'Fadlan geli Email/Tel iyo Password.' });
    }

    const cleanInput = String(emailOrPhone).trim().toLowerCase();
    const allSysUsers = await db.select().from(users);
    const found = allSysUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanInput ||
        (u.phone && u.phone.replace(/\s+/g, '') === cleanInput.replace(/\s+/g, ''))
    );

    if (!found || !found.passwordHash || !verifyPassword(String(password), found.passwordHash)) {
      return res.status(401).json({
        error: 'Xogta login-ka waa khalad. Shaqaalaha iyo Maamulka waxaa akoonkooda abuura Admin-ka.',
      });
    }

    if (found.status !== 'Active') {
      return res.status(403).json({ error: 'Akoonkan waa la xiray (Suspended). La xiriir Admin-ka.' });
    }

    let storedHash = found.passwordHash;
    if (needsRehash(storedHash)) {
      storedHash = hashPassword(String(password));
      await db.update(users).set({ passwordHash: storedHash }).where(eq(users.id, found.id));
    }
    const token = signStaffToken(found.uid, storedHash);
    res.json({
      token,
      user: {
        id: found.id,
        uid: found.uid,
        email: found.email,
        name: found.name,
        phone: found.phone,
        role: found.role,
      },
    });
  } catch (error) {
    console.error('Staff login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ==========================================
// PROTECTED ADMIN ERP API ROUTES
// ==========================================
app.get('/api/admin/erp-data', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const meRows = await db.select().from(users).where(eq(users.uid, req.user!.uid));
    const currentUser = publicUser(meRows[0]);
    // Large lists are capped (newest first); full history via /api/admin/list/:entity (paginated).
    const clampLimit = (v: any, d: number) => Math.max(10, Math.min(5000, Number(v) || d));
    const listLimit = clampLimit(req.query.limit, 1000);
    const logLimit = clampLimit(req.query.logLimit, 80);

    const [
      allUsers,
      allCustomers,
      allBookings,
      allBookingItems,
      allQuotes,
      allInvoices,
      allInvoiceItems,
      allPayments,
      allStaff,
      allVehicles,
      allVehicleLogs,
      allExpenses,
      allReviews,
      allServices,
      allFaqs,
      allGallery,
      allSettings,
      allLogs,
      allLeads,
      allPackingMaterials,
      allStorageUnits,
      allSuppliers,
      allPurchaseOrders,
      allDamageClaims,
      allLedgerAccounts,
      allJournalEntries,
    ] = await Promise.all([
      db.select().from(users).orderBy(asc(users.id)),
      db.select().from(customers).orderBy(desc(customers.id)).limit(listLimit),
      db.select().from(bookings).orderBy(desc(bookings.id)).limit(listLimit),
      db.select().from(bookingItems).orderBy(asc(bookingItems.id)),
      db.select().from(quotes).orderBy(desc(quotes.id)),
      db.select().from(invoices).orderBy(desc(invoices.id)),
      db.select().from(invoiceItems).orderBy(asc(invoiceItems.id)),
      db.select().from(payments).orderBy(desc(payments.id)).limit(listLimit),
      db.select().from(staff).orderBy(asc(staff.id)),
      db.select().from(vehicles).orderBy(asc(vehicles.id)),
      db.select().from(vehicleLogs).orderBy(desc(vehicleLogs.id)),
      db.select().from(expenses).orderBy(desc(expenses.id)),
      db.select().from(reviews).orderBy(desc(reviews.id)),
      db.select().from(services).orderBy(asc(services.sortOrder)),
      db.select().from(faqs).orderBy(asc(faqs.sortOrder)),
      db.select().from(gallery).orderBy(desc(gallery.id)),
      db.select().from(settings),
      db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(logLimit),
      db.select().from(leads).orderBy(desc(leads.id)),
      db.select().from(packingMaterials).orderBy(asc(packingMaterials.id)),
      db.select().from(storageUnits).orderBy(asc(storageUnits.id)),
      db.select().from(suppliers).orderBy(asc(suppliers.id)),
      db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.id)),
      db.select().from(damageClaims).orderBy(desc(damageClaims.id)),
      db.select().from(ledgerAccounts).orderBy(asc(ledgerAccounts.accountCode)),
      db.select().from(journalEntries).orderBy(desc(journalEntries.id)),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      settingsMap[s.key] = s.value;
    }

    res.json({
      currentUser,
      users: allUsers.map(publicUser),
      customers: allCustomers.map(publicUser),
      bookings: allBookings,
      bookingItems: allBookingItems,
      quotes: allQuotes,
      invoices: allInvoices,
      invoiceItems: allInvoiceItems,
      payments: allPayments,
      staff: allStaff,
      vehicles: allVehicles,
      vehicleLogs: allVehicleLogs,
      expenses: allExpenses,
      reviews: allReviews,
      services: allServices,
      faqs: allFaqs,
      gallery: allGallery,
      settings: settingsMap,
      activityLog: allLogs,
      meta: await (async () => {
        const counts = await Promise.all(
          [bookings, customers, payments, activityLog].map((t) => db.select({ n: count() }).from(t).then((r) => Number(r[0]?.n || 0)))
        );
        const [nb, nc, np, nl] = counts;
        return {
          listLimit,
          logLimit,
          totals: { bookings: nb, customers: nc, payments: np, activityLog: nl },
          truncated: { bookings: nb > listLimit, customers: nc > listLimit, payments: np > listLimit, activityLog: nl > logLimit },
        };
      })(),
      leads: allLeads,
      packingMaterials: allPackingMaterials,
      storageUnits: allStorageUnits,
      suppliers: allSuppliers,
      purchaseOrders: allPurchaseOrders,
      damageClaims: allDamageClaims,
      ledgerAccounts: allLedgerAccounts,
      journalEntries: allJournalEntries,
    });
  } catch (error) {
    console.error('Failed to load ERP data:', error);
    res.status(500).json({ error: 'Failed to load ERP dashboard data.' });
  }
});

// Update Booking (Status, Team, Vehicle, Quoted Amount, Signatures, Notes)
app.patch('/api/admin/bookings/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const existing = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!existing[0]) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { status, assignedStaffIds, assignedVehicleId, quotedAmount, notes, pickupSignature, deliverySignature } = req.body;
    const history = Array.isArray(existing[0].statusHistory) ? [...existing[0].statusHistory] : [];
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    if (status && status !== existing[0].status) {
      history.push({
        status,
        timestamp: nowStr,
        note: `Updated by ${req.user?.email || 'Admin'}`,
      });
    }

    const updated = await db
      .update(bookings)
      .set({
        status: status ?? existing[0].status,
        assignedStaffIds: assignedStaffIds !== undefined ? assignedStaffIds : existing[0].assignedStaffIds,
        assignedVehicleId: assignedVehicleId !== undefined ? assignedVehicleId : existing[0].assignedVehicleId,
        quotedAmount: quotedAmount !== undefined ? String(quotedAmount) : existing[0].quotedAmount,
        notes: notes !== undefined ? notes : existing[0].notes,
        pickupSignature: pickupSignature !== undefined ? pickupSignature : existing[0].pickupSignature,
        deliverySignature: deliverySignature !== undefined ? deliverySignature : existing[0].deliverySignature,
        statusHistory: history,
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    await logAdminActivity(
      req.user?.email || 'Admin',
      'Admin',
      'BOOKING_UPDATED',
      'Booking',
      existing[0].referenceNumber,
      `Booking status/assignment updated (${status || existing[0].status})`
    );

    res.json({ booking: updated[0] });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking.' });
  }
});

// Add Inventory Checklist Item
app.post('/api/admin/booking-items', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { bookingId, itemName, boxNumber, quantity, conditionBefore, conditionAfter, notes } = req.body;
    const created = await db
      .insert(bookingItems)
      .values({
        bookingId: Number(bookingId),
        itemName: String(itemName),
        boxNumber: boxNumber ? String(boxNumber) : '',
        quantity: Number(quantity) || 1,
        conditionBefore: conditionBefore ? String(conditionBefore) : 'Good',
        conditionAfter: conditionAfter ? String(conditionAfter) : 'Good',
        notes: notes ? String(notes) : '',
      })
      .returning();
    res.status(201).json({ item: created[0] });
  } catch (error) {
    console.error('Error adding checklist item:', error);
    res.status(500).json({ error: 'Failed to add checklist item.' });
  }
});

// Update Inventory Checklist Item
app.patch('/api/admin/booking-items/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { conditionBefore, conditionAfter, notes } = req.body;
    const updated = await db
      .update(bookingItems)
      .set({
        conditionBefore,
        conditionAfter,
        notes,
      })
      .where(eq(bookingItems.id, id))
      .returning();
    res.json({ item: updated[0] });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(500).json({ error: 'Failed to update checklist item.' });
  }
});

// Create Quote & Optionally Convert to Invoice
app.post('/api/admin/quotes', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { bookingId, customerName, customerPhone, lineItems, discount, convertToInvoice } = req.body;
    const existingQuotes = await db.select().from(quotes);
    const quoteNumber = nextCode('SR-Q', existingQuotes.map((q) => q.quoteNumber));

    const items = Array.isArray(lineItems) ? lineItems : [];
    const subtotalNum = items.reduce((acc: number, item: any) => acc + Number(item.total || 0), 0);
    const discountNum = Number(discount) || 0;
    const totalNum = Math.max(0, subtotalNum - discountNum);

    const createdQuote = await db
      .insert(quotes)
      .values({
        quoteNumber,
        bookingId: bookingId ? Number(bookingId) : null,
        customerName: String(customerName),
        customerPhone: String(customerPhone),
        lineItems: items,
        subtotal: subtotalNum.toFixed(2),
        discount: discountNum.toFixed(2),
        total: totalNum.toFixed(2),
        status: convertToInvoice ? 'Converted' : 'Sent',
      })
      .returning();

    if (bookingId) {
      await db
        .update(bookings)
        .set({
          quotedAmount: totalNum.toFixed(2),
          status: 'Quoted',
        })
        .where(eq(bookings.id, Number(bookingId)));
    }

    let createdInvoice = null;
    if (convertToInvoice && createdQuote[0]) {
      const existingInvoices = await db.select().from(invoices);
      const invoiceNumber = nextCode('SR-INV', existingInvoices.map((i) => i.invoiceNumber));
      const invRes = await db
        .insert(invoices)
        .values({
          invoiceNumber,
          bookingId: bookingId ? Number(bookingId) : null,
          quoteId: createdQuote[0].id,
          customerName: String(customerName),
          customerPhone: String(customerPhone),
          subtotal: subtotalNum.toFixed(2),
          discount: discountNum.toFixed(2),
          total: totalNum.toFixed(2),
          amountPaid: '0.00',
          balanceDue: totalNum.toFixed(2),
          status: 'Unpaid',
          dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        })
        .returning();
      createdInvoice = invRes[0];

      if (createdInvoice && items.length > 0) {
        await db.insert(invoiceItems).values(
          items.map((it: any) => ({
            invoiceId: createdInvoice!.id,
            description: String(it.description),
            category: String(it.category || 'service'),
            quantity: Number(it.qty) || 1,
            unitPrice: Number(it.unitPrice || 0).toFixed(2),
            total: Number(it.total || 0).toFixed(2),
          }))
        );
      }
    }

    await logAdminActivity(
      req.user?.email || 'Admin',
      'Admin',
      'QUOTE_CREATED',
      'Quote',
      quoteNumber,
      `Created quote ${quoteNumber} for ${customerName} ($${totalNum.toFixed(2)})`
    );

    res.status(201).json({ quote: createdQuote[0], invoice: createdInvoice });
  } catch (error) {
    console.error('Error creating quote:', error);
    res.status(500).json({ error: 'Failed to create quote.' });
  }
});

// Convert Existing Quote to Invoice
app.post('/api/admin/quotes/:id/convert', requireAuth, async (req: AuthRequest, res) => {
  try {
    const quoteId = Number(req.params.id);
    const found = await db.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!found[0]) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const q = found[0];
    const existingInvoices = await db.select().from(invoices);
    const invoiceNumber = nextCode('SR-INV', existingInvoices.map((i) => i.invoiceNumber));

    const invRes = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        bookingId: q.bookingId,
        quoteId: q.id,
        customerName: q.customerName,
        customerPhone: q.customerPhone,
        subtotal: q.subtotal,
        discount: q.discount,
        total: q.total,
        amountPaid: '0.00',
        balanceDue: q.total,
        status: 'Unpaid',
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      })
      .returning();

    await db.update(quotes).set({ status: 'Converted' }).where(eq(quotes.id, q.id));

    await logAdminActivity(
      req.user?.email || 'Admin',
      'Admin',
      'QUOTE_CONVERTED_TO_INVOICE',
      'Invoice',
      invoiceNumber,
      `Converted ${q.quoteNumber} to ${invoiceNumber}`
    );

    res.status(201).json({ invoice: invRes[0] });
  } catch (error) {
    console.error('Error converting quote to invoice:', error);
    res.status(500).json({ error: 'Failed to convert quote.' });
  }
});

// Record Payment (EVC Plus, Zaad, eDahab, Cash, Bank Transfer)
app.post('/api/admin/payments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { invoiceId, bookingId, customerName, amount, paymentMethod, paymentType, referenceCode, notes } = req.body;
    const existingPayments = await db.select().from(payments);
    const receiptNumber = nextCode('SR-RCP', existingPayments.map((p) => p.receiptNumber));
    const amtNum = Number(amount) || 0;

    const created = await db
      .insert(payments)
      .values({
        receiptNumber,
        invoiceId: invoiceId ? Number(invoiceId) : null,
        bookingId: bookingId ? Number(bookingId) : null,
        customerName: String(customerName),
        amount: amtNum.toFixed(2),
        paymentMethod: String(paymentMethod || 'EVC Plus'),
        paymentType: String(paymentType || 'Deposit'),
        referenceCode: referenceCode ? String(referenceCode) : '',
        notes: notes ? String(notes) : '',
      })
      .returning();

    if (invoiceId) {
      const invFound = await db.select().from(invoices).where(eq(invoices.id, Number(invoiceId)));
      if (invFound[0]) {
        const inv = invFound[0];
        const newPaid = Number(inv.amountPaid) + amtNum;
        const newBalance = Math.max(0, Number(inv.total) - newPaid);
        const newStatus = newBalance <= 0.01 ? 'Paid' : 'Partial';
        await db
          .update(invoices)
          .set({
            amountPaid: newPaid.toFixed(2),
            balanceDue: newBalance.toFixed(2),
            status: newStatus,
          })
          .where(eq(invoices.id, inv.id));
      }
    }

    await logAdminActivity(
      req.user?.email || 'Admin',
      'Accountant',
      'PAYMENT_RECORDED',
      'Payment',
      receiptNumber,
      `Recorded $${amtNum.toFixed(2)} via ${paymentMethod} from ${customerName}`
    );

    res.status(201).json({ payment: created[0] });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
});

// Add / Update Customer
app.post('/api/admin/customers', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, phone, email, customerType, notes } = req.body;
    const created = await db
      .insert(customers)
      .values({
        name: String(name),
        phone: String(phone),
        email: email ? String(email) : '',
        customerType: customerType ? String(customerType) : 'family',
        notes: notes ? String(notes) : '',
      })
      .returning();
    res.status(201).json({ customer: created[0] });
  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({ error: 'Failed to add customer.' });
  }
});

// Edit / Delete Customer
app.patch('/api/admin/customers/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, email, customerType, notes } = req.body;
    const set: any = {};
    if (name !== undefined) set.name = String(name).trim();
    if (phone !== undefined) set.phone = String(phone).trim();
    if (email !== undefined) set.email = String(email).trim();
    if (customerType !== undefined) set.customerType = String(customerType);
    if (notes !== undefined) set.notes = String(notes);
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });
    const updated = await db.update(customers).set(set).where(eq(customers.id, id)).returning();
    if (!updated[0]) return res.status(404).json({ error: 'Customer not found' });
    res.json({ customer: publicUser(updated[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer.' });
  }
});

app.delete('/api/admin/customers/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const linked = await db.select().from(bookings).where(eq(bookings.customerId, id));
    if (linked.length) {
      return res.status(409).json({ error: `Macmiilkan ${linked.length} ballan ayaa ku xiran — lama tirtiri karo.` });
    }
    const gone = await db.delete(customers).where(eq(customers.id, id)).returning();
    await logAdminActivity(req.user?.email || 'Admin', req.user?.role || 'Admin', 'CUSTOMER_DELETED', 'Customer', String(id), `Deleted customer ${gone[0]?.name || id}`);
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete customer.' });
  }
});

// Delete quote (no invoice yet) / invoice (no payments)
app.delete('/api/admin/quotes/:id', requireAuth, requireRoles('Admin', 'Manager', 'Accountant'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const inv = await db.select().from(invoices).where(eq(invoices.quoteId, id));
    if (inv.length) return res.status(409).json({ error: 'Qiimeyntan biil ayaa laga sameeyay — marka hore tirtir biilka.' });
    await db.delete(quotes).where(eq(quotes.id, id));
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete quote.' });
  }
});

app.delete('/api/admin/invoices/:id', requireAuth, requireRoles('Admin', 'Manager', 'Accountant'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const pays = await db.select().from(payments).where(eq(payments.invoiceId, id));
    if (pays.length) return res.status(409).json({ error: 'Biilkan lacag ayaa ku xiran — marka hore tirtir lacag-bixinta.' });
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    const gone = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    if (gone[0]?.quoteId) await db.update(quotes).set({ status: 'Sent' }).where(eq(quotes.id, gone[0].quoteId));
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
});

// Add Staff & Record Attendance
app.post('/api/admin/staff', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, role, phone, dailyRate, idCardNumber, photoUrl, availability } = req.body;
    const created = await db
      .insert(staff)
      .values({
        name: String(name),
        role: String(role || 'mover'),
        phone: String(phone),
        dailyRate: Number(dailyRate || 25).toFixed(2),
        idCardNumber: String(idCardNumber || 'SO-MOG-NEW'),
        photoUrl: photoUrl ? String(photoUrl) : '',
        availability: String(availability || 'Available'),
        jobsCompleted: 0,
      })
      .returning();
    res.status(201).json({ staff: created[0] });
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ error: 'Failed to add staff member.' });
  }
});

app.patch('/api/admin/staff/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(staff).where(eq(staff.id, id));
    if (!existing[0]) return res.status(404).json({ error: 'Staff not found' });

    const { name, role, phone, dailyRate, idCardNumber, photoUrl, availability, attendanceEntry } = req.body;
    const currentLog = Array.isArray(existing[0].attendanceLog) ? [...existing[0].attendanceLog] : [];
    let jobsCount = existing[0].jobsCompleted;
    if (attendanceEntry) {
      currentLog.unshift(attendanceEntry);
      jobsCount += 1;
    }

    const updated = await db
      .update(staff)
      .set({
        name: name !== undefined ? String(name) : existing[0].name,
        role: role !== undefined ? String(role) : existing[0].role,
        phone: phone !== undefined ? String(phone) : existing[0].phone,
        dailyRate: dailyRate !== undefined ? Number(dailyRate).toFixed(2) : existing[0].dailyRate,
        idCardNumber: idCardNumber !== undefined ? String(idCardNumber) : existing[0].idCardNumber,
        photoUrl: photoUrl !== undefined ? String(photoUrl) : existing[0].photoUrl,
        availability: availability ?? existing[0].availability,
        attendanceLog: currentLog,
        jobsCompleted: jobsCount,
      })
      .where(eq(staff.id, id))
      .returning();
    res.json({ staff: updated[0] });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff.' });
  }
});

app.delete('/api/admin/staff/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(staff).where(eq(staff.id, id));
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete staff member.' });
  }
});

// Vehicles & Fuel/Maintenance Logs
app.post('/api/admin/vehicles', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { plateNumber, name, capacity, driverName, status } = req.body;
    const created = await db
      .insert(vehicles)
      .values({
        plateNumber: String(plateNumber),
        name: String(name),
        capacity: String(capacity),
        driverName: driverName ? String(driverName) : '',
        status: String(status || 'Available'),
      })
      .returning();
    res.status(201).json({ vehicle: created[0] });
  } catch (error) {
    console.error('Error adding vehicle:', error);
    res.status(500).json({ error: 'Failed to add vehicle.' });
  }
});

// Live Driver GPS Broadcast & Checkpoint Update
app.patch('/api/admin/vehicles/:id/gps', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { currentLat, currentLng, currentLocationLabel, speedKmh, status } = req.body;
    const existing = await db.select().from(vehicles).where(eq(vehicles.id, id));
    if (!existing[0]) return res.status(404).json({ error: 'Vehicle not found' });

    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const updated = await db
      .update(vehicles)
      .set({
        currentLat: currentLat ? String(currentLat) : existing[0].currentLat,
        currentLng: currentLng ? String(currentLng) : existing[0].currentLng,
        currentLocationLabel: currentLocationLabel
          ? String(currentLocationLabel)
          : existing[0].currentLocationLabel,
        speedKmh: speedKmh !== undefined ? Number(speedKmh) : existing[0].speedKmh,
        status: status ? String(status) : existing[0].status,
        lastGpsPingAt: `Live · ${nowTime}`,
      })
      .where(eq(vehicles.id, id))
      .returning();

    res.json({ vehicle: updated[0] });
  } catch (error) {
    console.error('Error updating vehicle GPS:', error);
    res.status(500).json({ error: 'Failed to update GPS location.' });
  }
});

app.post('/api/admin/vehicle-logs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { vehicleId, logType, cost, litersOrDetails, logDate } = req.body;
    const created = await db
      .insert(vehicleLogs)
      .values({
        vehicleId: Number(vehicleId),
        logType: String(logType || 'Fuel'),
        cost: Number(cost || 0).toFixed(2),
        litersOrDetails: String(litersOrDetails),
        logDate: String(logDate || new Date().toISOString().slice(0, 10)),
        recordedBy: req.user?.email || 'Admin',
      })
      .returning();
    res.status(201).json({ log: created[0] });
  } catch (error) {
    console.error('Error adding vehicle log:', error);
    res.status(500).json({ error: 'Failed to add vehicle log.' });
  }
});

// Expenses
app.post('/api/admin/expenses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category, description, amount, expenseDate, receiptUrl, bookingId } = req.body;
    const created = await db
      .insert(expenses)
      .values({
        category: String(category || 'Fuel'),
        description: String(description),
        amount: Number(amount || 0).toFixed(2),
        expenseDate: String(expenseDate || new Date().toISOString().slice(0, 10)),
        receiptUrl: receiptUrl ? String(receiptUrl) : '',
        recordedBy: req.user?.email || 'Admin',
        bookingId: bookingId ? Number(bookingId) : null,
      })
      .returning();

    await logAdminActivity(
      req.user?.email || 'Admin',
      'Accountant',
      'EXPENSE_LOGGED',
      'Expense',
      String(created[0]?.id || ''),
      `${category}: $${Number(amount || 0).toFixed(2)} - ${description}`
    );

    res.status(201).json({ expense: created[0] });
  } catch (error) {
    console.error('Error logging expense:', error);
    res.status(500).json({ error: 'Failed to record expense.' });
  }
});

// CMS: Services Update
app.patch('/api/admin/services/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { titleSo, titleEn, descSo, descEn, basePrice, priceLabelSo, priceLabelEn } = req.body;
    const updated = await db
      .update(services)
      .set({
        titleSo,
        titleEn,
        descSo,
        descEn,
        basePrice: String(basePrice),
        priceLabelSo,
        priceLabelEn,
      })
      .where(eq(services.id, id))
      .returning();
    res.json({ service: updated[0] });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service.' });
  }
});

// CMS: FAQ Create
app.post('/api/admin/faqs', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    const { questionSo, questionEn, answerSo, answerEn, category } = req.body;
    const created = await db
      .insert(faqs)
      .values({
        questionSo: String(questionSo),
        questionEn: String(questionEn),
        answerSo: String(answerSo),
        answerEn: String(answerEn),
        category: String(category || 'general'),
      })
      .returning();
    res.status(201).json({ faq: created[0] });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ error: 'Failed to add FAQ.' });
  }
});

// CMS: Review Moderation (Approve / Hide)
app.patch('/api/admin/reviews/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const updated = await db
      .update(reviews)
      .set({ status: String(status) })
      .where(eq(reviews.id, id))
      .returning();
    res.json({ review: updated[0] });
  } catch (error) {
    console.error('Error moderating review:', error);
    res.status(500).json({ error: 'Failed to moderate review.' });
  }
});

// CMS: Gallery Add
app.post('/api/admin/gallery', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    const { titleSo, titleEn, category, imageUrl, district } = req.body;
    const created = await db
      .insert(gallery)
      .values({
        titleSo: String(titleSo),
        titleEn: String(titleEn),
        category: String(category || 'homes'),
        imageUrl: String(imageUrl),
        district: String(district || 'Mogadishu'),
      })
      .returning();
    res.status(201).json({ item: created[0] });
  } catch (error) {
    console.error('Error adding gallery photo:', error);
    res.status(500).json({ error: 'Failed to add gallery photo.' });
  }
});

// Settings & Templates Update
app.post('/api/admin/settings', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const updates: Record<string, string> = req.body.settings || {};
    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(settings)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: String(value), updatedAt: new Date() },
        });
    }

    await logAdminActivity(
      req.user?.email || 'Admin',
      'Admin',
      'SETTINGS_UPDATED',
      'Settings',
      'GLOBAL',
      'Updated company settings & WhatsApp templates'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// Admin Creates Staff / Manager / Accountant User Account
app.post('/api/admin/users', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required to create a staff/admin user.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf.' });
    }
    const dupe = (await db.select().from(users)).find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (dupe) return res.status(409).json({ error: 'Email-kan akoon ayaa horey ugu jira.' });

    const cleanEmail = String(email).trim().toLowerCase();
    const uid = `staff-${Date.now()}`;

    const created = await db
      .insert(users)
      .values({
        uid,
        name: String(name).trim(),
        email: cleanEmail,
        phone: phone ? String(phone).trim() : '',
        passwordHash: hashPassword(String(password)),
        role: String(role || 'Staff'),
        status: 'Active',
      })
      .returning();

    await logAdminActivity(
      req.user?.email || 'Admin',
      'Admin',
      'STAFF_USER_CREATED_BY_ADMIN',
      'User',
      cleanEmail,
      `Admin created ${role || 'Staff'} user account for ${name} (${cleanEmail})`
    );

    res.status(201).json({ user: publicUser(created[0]) });
  } catch (error) {
    console.error('Error creating staff/manager user:', error);
    res.status(500).json({ error: 'Failed to create user account.' });
  }
});

// User Role / Status / Password Update (RBAC: Admin, Manager, Staff, Accountant)
app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(users).where(eq(users.id, id));
    if (!existing[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { role, status, password } = req.body;
    if (password && String(password).length < 8) {
      return res.status(400).json({ error: 'Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf.' });
    }
    if ((existing[0].uid === req.user!.uid || isOwnerEmail(existing[0].email)) && ((status && status !== 'Active') || (role && role !== 'Admin'))) {
      return res.status(400).json({ error: 'Ma xiri kartid ama hoos u dhigi kartid akoonkaaga.' });
    }
    const updated = await db
      .update(users)
      .set({
        role: role !== undefined ? String(role) : existing[0].role,
        status: status !== undefined ? String(status) : existing[0].status,
        passwordHash: password ? hashPassword(String(password)) : existing[0].passwordHash,
      })
      .where(eq(users.id, id))
      .returning();

    await logAdminActivity(
      req.user?.email || 'Admin',
      'Admin',
      'USER_ACCOUNT_UPDATED',
      'User',
      String(id),
      `Updated user ${existing[0].email} (Role: ${role || existing[0].role}, Status: ${status || existing[0].status})`
    );

    res.json({ user: publicUser(updated[0]) });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// ====================================================
// ENTERPRISE ERP ENDPOINTS (LEADS, STOCK, STORAGE, SUPPLIERS, CLAIMS, ACCOUNTING)
// ====================================================

// 1. CRM Leads Pipeline
app.post('/api/admin/leads', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { customerName, phone, email, source, district, moveType, estimatedVolumeM3, stage, followUpDate, notes } = req.body;
    const all = await db.select().from(leads);
    const leadCode = nextCode('LD', all.map((x) => x.leadCode));
    const created = await db
      .insert(leads)
      .values({
        leadCode,
        customerName: String(customerName),
        phone: String(phone),
        email: email ? String(email) : '',
        source: String(source || 'WhatsApp'),
        district: String(district || 'Hodan'),
        moveType: String(moveType || 'Home Moving'),
        estimatedVolumeM3: Number(estimatedVolumeM3 || 20).toFixed(2),
        stage: String(stage || 'New'),
        followUpDate: followUpDate ? String(followUpDate) : new Date().toISOString().slice(0, 10),
        notes: notes ? String(notes) : '',
      })
      .returning();
    res.status(201).json({ lead: created[0] });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead.' });
  }
});

app.patch('/api/admin/leads/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { stage, lostReason, notes } = req.body;
    const existing = await db.select().from(leads).where(eq(leads.id, id));
    if (!existing[0]) return res.status(404).json({ error: 'Lead not found' });
    const updated = await db
      .update(leads)
      .set({
        stage: stage ?? existing[0].stage,
        lostReason: lostReason ?? existing[0].lostReason,
        notes: notes ?? existing[0].notes,
      })
      .where(eq(leads.id, id))
      .returning();
    res.json({ lead: updated[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update lead.' });
  }
});

// 2. Packing Materials & Stock Movements
app.post('/api/admin/packing-materials', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sku, nameEn, nameSo, category, unit, qtyAvailable, reorderLevel, unitCostUsd, supplierName } = req.body;
    const created = await db
      .insert(packingMaterials)
      .values({
        sku: String(sku || `MAT-${Date.now().toString().slice(-4)}`),
        nameEn: String(nameEn),
        nameSo: String(nameSo || nameEn),
        category: String(category || 'Boxes'),
        unit: String(unit || 'pcs'),
        qtyAvailable: Number(qtyAvailable || 0),
        reorderLevel: Number(reorderLevel || 20),
        unitCostUsd: Number(unitCostUsd || 2).toFixed(2),
        supplierName: String(supplierName || 'Mogadishu Packaging Co.'),
      })
      .returning();
    res.status(201).json({ material: created[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add packing material.' });
  }
});

app.patch('/api/admin/packing-materials/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { deltaQty } = req.body;
    const existing = await db.select().from(packingMaterials).where(eq(packingMaterials.id, id));
    if (!existing[0]) return res.status(404).json({ error: 'Material not found' });
    const nextQty = Math.max(0, existing[0].qtyAvailable + Number(deltaQty || 0));
    const updated = await db
      .update(packingMaterials)
      .set({ qtyAvailable: nextQty, updatedAt: new Date() })
      .where(eq(packingMaterials.id, id))
      .returning();
    res.json({ material: updated[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update material stock.' });
  }
});

// 3. Warehouse & Storage Bays
app.post('/api/admin/storage-units', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { unitCode, sizeM3, monthlyRateUsd, status, customerName, customerPhone, startDate, endDate, storedItemsSummary } = req.body;
    const created = await db
      .insert(storageUnits)
      .values({
        unitCode: String(unitCode),
        sizeM3: Number(sizeM3 || 30),
        monthlyRateUsd: Number(monthlyRateUsd || 150).toFixed(2),
        status: String(status || 'Occupied'),
        customerName: String(customerName || ''),
        customerPhone: String(customerPhone || ''),
        contractNumber: `STR-2026-${Date.now().toString().slice(-3)}`,
        startDate: String(startDate || new Date().toISOString().slice(0, 10)),
        endDate: String(endDate || '2027-01-01'),
        storedItemsSummary: String(storedItemsSummary || ''),
        barcodeTag: `SR-QR-${Date.now().toString().slice(-4)}`,
      })
      .returning();
    res.status(201).json({ unit: created[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create storage unit.' });
  }
});

// 4. Suppliers & Purchase Orders
app.post('/api/admin/purchase-orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { supplierName: rawSupplierName, supplierId, itemsSummary, totalUsd } = req.body;
    let supplierName = rawSupplierName;
    let linkedSupplierId: number | null = null;
    if (supplierId) {
      const sup = await db.select().from(suppliers).where(eq(suppliers.id, Number(supplierId)));
      if (sup[0]) {
        supplierName = sup[0].companyName;
        linkedSupplierId = sup[0].id;
      }
    } else if (supplierName) {
      const sup = (await db.select().from(suppliers)).find((x) => x.companyName === String(supplierName));
      if (sup) linkedSupplierId = sup.id;
    }
    if (!supplierName || !itemsSummary) return res.status(400).json({ error: 'Dooro alaab-keenaha oo qor alaabta.' });
    const all = await db.select().from(purchaseOrders);
    const poNumber = nextCode('PO', all.map((x) => x.poNumber));
    const created = await db
      .insert(purchaseOrders)
      .values({
        poNumber,
        supplierId: linkedSupplierId,
        supplierName: String(supplierName),
        itemsSummary: String(itemsSummary),
        totalUsd: Number(totalUsd || 0).toFixed(2),
        status: 'Approved',
        orderDate: new Date().toISOString().slice(0, 10),
      })
      .returning();
    res.status(201).json({ po: created[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create purchase order.' });
  }
});

// 5. Damage Claims & Quality Control
app.post('/api/admin/damage-claims', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { bookingRef, customerName, customerPhone, itemAffected, description, responsibleCrew, estimatedDamageUsd } = req.body;
    const all = await db.select().from(damageClaims);
    const claimNumber = nextCode('CLM', all.map((x) => x.claimNumber));
    const created = await db
      .insert(damageClaims)
      .values({
        claimNumber,
        bookingRef: String(bookingRef || 'SR-2026-0001'),
        customerName: String(customerName),
        customerPhone: String(customerPhone || '+252'),
        itemAffected: String(itemAffected),
        description: String(description),
        responsibleCrew: String(responsibleCrew || 'Team Alpha'),
        estimatedDamageUsd: Number(estimatedDamageUsd || 0).toFixed(2),
        compensationUsd: '0.00',
        status: 'Investigating',
        incidentDate: new Date().toISOString().slice(0, 10),
      })
      .returning();
    res.status(201).json({ claim: created[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit damage claim.' });
  }
});

app.patch('/api/admin/damage-claims/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, compensationUsd, resolutionNotes } = req.body;
    const existing = await db.select().from(damageClaims).where(eq(damageClaims.id, id));
    if (!existing[0]) return res.status(404).json({ error: 'Claim not found' });
    const updated = await db
      .update(damageClaims)
      .set({
        status: status ?? existing[0].status,
        compensationUsd: compensationUsd !== undefined ? Number(compensationUsd).toFixed(2) : existing[0].compensationUsd,
        resolutionNotes: resolutionNotes ?? existing[0].resolutionNotes,
      })
      .where(eq(damageClaims.id, id))
      .returning();
    res.json({ claim: updated[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update damage claim.' });
  }
});

// 6. Double-Entry Journal Entries
app.post('/api/admin/journal-entries', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { referenceDoc, description, debitAccount, creditAccount, amountUsd } = req.body;
    const all = await db.select().from(journalEntries);
    const entryNumber = nextCode('JE', all.map((x) => x.entryNumber));
    const created = await db
      .insert(journalEntries)
      .values({
        entryNumber,
        entryDate: new Date().toISOString().slice(0, 10),
        referenceDoc: String(referenceDoc || 'MANUAL'),
        description: String(description),
        debitAccount: String(debitAccount),
        creditAccount: String(creditAccount),
        amountUsd: Number(amountUsd || 0).toFixed(2),
        postedBy: req.user?.email || 'Accountant',
      })
      .returning();
    res.status(201).json({ entry: created[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post journal entry.' });
  }
});

// ====================================================
// UNIVERSAL EDIT & DELETE ENDPOINTS FOR ALL MODULES
// ====================================================
app.delete('/api/admin/leads/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    await db.delete(leads).where(eq(leads.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

app.delete('/api/admin/bookings/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const linkedPayments = await db.select().from(payments).where(eq(payments.bookingId, id));
    if (linkedPayments.length) {
      return res.status(409).json({ error: 'Ballantan lacag ayaa ku xiran — lama tirtiri karo. U beddel "Cancelled".' });
    }
    const linkedInvoices = await db.select().from(invoices).where(eq(invoices.bookingId, id));
    for (const inv of linkedInvoices) {
      const invPays = await db.select().from(payments).where(eq(payments.invoiceId, inv.id));
      if (invPays.length) {
        return res.status(409).json({ error: 'Biilka ballantan lacag ayaa ku xiran — lama tirtiri karo. U beddel "Cancelled".' });
      }
    }
    for (const inv of linkedInvoices) {
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
      await db.delete(invoices).where(eq(invoices.id, inv.id));
    }
    await db.update(quotes).set({ bookingId: null }).where(eq(quotes.bookingId, id));
    await db.delete(bookingItems).where(eq(bookingItems.bookingId, id));
    const gone = await db.delete(bookings).where(eq(bookings.id, id)).returning();
    await logAdminActivity(req.user?.email || 'Admin', req.user?.role || 'Admin', 'BOOKING_DELETED', 'Booking', String(id), `Deleted booking ${gone[0]?.referenceNumber || id}`);
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

app.delete('/api/admin/booking-items/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    await db.delete(bookingItems).where(eq(bookingItems.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete checklist item' });
  }
});

app.patch('/api/admin/vehicles/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(vehicles).where(eq(vehicles.id, id));
    if (!existing[0]) return res.status(404).json({ error: 'Vehicle not found' });
    const { plateNumber, name, capacity, driverName, status } = req.body;
    const updated = await db
      .update(vehicles)
      .set({
        plateNumber: plateNumber ?? existing[0].plateNumber,
        name: name ?? existing[0].name,
        capacity: capacity ?? existing[0].capacity,
        driverName: driverName ?? existing[0].driverName,
        status: status ?? existing[0].status,
      })
      .where(eq(vehicles.id, id))
      .returning();
    res.json({ vehicle: updated[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

app.delete('/api/admin/vehicles/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(vehicleLogs).where(eq(vehicleLogs.vehicleId, id));
    await db.delete(vehicles).where(eq(vehicles.id, id));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

app.delete('/api/admin/packing-materials/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    await db.delete(packingMaterials).where(eq(packingMaterials.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

app.patch('/api/admin/storage-units/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(storageUnits).where(eq(storageUnits.id, id));
    if (!existing[0]) return res.status(404).json({ error: 'Storage unit not found' });
    const { unitCode, sizeM3, monthlyRateUsd, status, customerName, customerPhone, storedItemsSummary } = req.body;
    const updated = await db
      .update(storageUnits)
      .set({
        unitCode: unitCode ?? existing[0].unitCode,
        sizeM3: sizeM3 !== undefined ? Number(sizeM3) : existing[0].sizeM3,
        monthlyRateUsd: monthlyRateUsd !== undefined ? Number(monthlyRateUsd).toFixed(2) : existing[0].monthlyRateUsd,
        status: status ?? existing[0].status,
        customerName: customerName ?? existing[0].customerName,
        customerPhone: customerPhone ?? existing[0].customerPhone,
        storedItemsSummary: storedItemsSummary ?? existing[0].storedItemsSummary,
      })
      .where(eq(storageUnits.id, id))
      .returning();
    res.json({ unit: updated[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update storage unit' });
  }
});

app.delete('/api/admin/storage-units/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    await db.delete(storageUnits).where(eq(storageUnits.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete storage unit' });
  }
});

app.delete('/api/admin/purchase-orders/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
});

app.delete('/api/admin/damage-claims/:id', requireAuth, requireRoles('Admin', 'Manager'), async (req: AuthRequest, res) => {
  try {
    await db.delete(damageClaims).where(eq(damageClaims.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete damage claim' });
  }
});

app.delete('/api/admin/expenses/:id', requireAuth, requireRoles('Admin', 'Manager', 'Accountant'), async (req: AuthRequest, res) => {
  try {
    await db.delete(expenses).where(eq(expenses.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

app.delete('/api/admin/payments/:id', requireAuth, requireRoles('Admin', 'Manager', 'Accountant'), async (req: AuthRequest, res) => {
  try {
    const gone = await db.delete(payments).where(eq(payments.id, Number(req.params.id))).returning();
    const p = gone[0];
    if (p?.invoiceId) {
      // Reverse the payment on its invoice.
      const invFound = await db.select().from(invoices).where(eq(invoices.id, p.invoiceId));
      if (invFound[0]) {
        const inv = invFound[0];
        const newPaid = Math.max(0, Number(inv.amountPaid) - Number(p.amount));
        const newBalance = Math.max(0, Number(inv.total) - newPaid);
        await db
          .update(invoices)
          .set({ amountPaid: newPaid.toFixed(2), balanceDue: newBalance.toFixed(2), status: newBalance <= 0.01 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Unpaid' })
          .where(eq(invoices.id, inv.id));
      }
    }
    if (p) await logAdminActivity(req.user?.email || 'Admin', req.user?.role || 'Admin', 'PAYMENT_DELETED', 'Payment', p.receiptNumber, `Deleted payment ${p.receiptNumber} ($${p.amount})`);
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const target = await db.select().from(users).where(eq(users.id, Number(req.params.id)));
    if (Number(req.params.id) === req.user!.id || isOwnerEmail(target[0]?.email)) {
      return res.status(400).json({ error: 'Akoonkan lama tirtiri karo (owner).' });
    }
    await db.delete(users).where(eq(users.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SOORAR server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
