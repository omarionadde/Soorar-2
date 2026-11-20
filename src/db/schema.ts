import { pgTable, serial, text, integer, numeric, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').default(''),
  phone: text('phone').default(''),
  passwordHash: text('password_hash').default(''),
  role: text('role').default('Admin').notNull(), // Admin, Manager, Staff, Accountant
  status: text('status').default('Active').notNull(), // Active, Suspended
  staffId: integer('staff_id'), // linked crew/staff record (for the crew mobile view)
  createdAt: timestamp('created_at').defaultNow(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').default(''),
  passwordHash: text('password_hash').default(''),
  customerType: text('customer_type').default('family').notNull(), // family, business, NGO
  notes: text('notes').default(''),
  totalSpent: numeric('total_spent', { precision: 10, scale: 2 }).default('0.00'),
  referralCode: text('referral_code').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  referenceNumber: text('reference_number').notNull().unique(), // e.g., SR-2026-0001
  customerId: integer('customer_id').references(() => customers.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email').default(''),
  services: jsonb('services').$type<string[]>().notNull(), // ['home', 'packing', etc.]
  fromDistrict: text('from_district').notNull(),
  fromAddress: text('from_address').default(''),
  fromFloor: integer('from_floor').default(0),
  fromLift: boolean('from_lift').default(false),
  toDistrict: text('to_district').notNull(),
  toAddress: text('to_address').default(''),
  toFloor: integer('to_floor').default(0),
  toLift: boolean('to_lift').default(false),
  sizeDescription: text('size_description').default(''), // e.g. 3 Rooms / Medium Villa
  largeItems: text('large_items').default(''),
  photos: jsonb('photos').$type<string[]>().default([]),
  preferredDate: text('preferred_date').notNull(),
  preferredTime: text('preferred_time').default('08:00'),
  flexibleDate: boolean('flexible_date').default(false),
  notes: text('notes').default(''),
  status: text('status').default('New').notNull(), // New, Quoted, Confirmed, In progress, Completed, Cancelled
  assignedStaffIds: jsonb('assigned_staff_ids').$type<number[]>().default([]),
  assignedVehicleId: integer('assigned_vehicle_id'),
  quotedAmount: numeric('quoted_amount', { precision: 10, scale: 2 }).default('0.00'),
  language: text('language').default('so'),
  statusHistory: jsonb('status_history').$type<Array<{ status: string; timestamp: string; note?: string }>>().default([]),
  pickupSignature: text('pickup_signature').default(''),
  deliverySignature: text('delivery_signature').default(''),
  crewStatus: text('crew_status').default(''), // on_the_way | started | completed
  referralCode: text('referral_code').default(''),
  referrerCustomerId: integer('referrer_customer_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bookingItems = pgTable('booking_items', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id).notNull(),
  itemName: text('item_name').notNull(),
  boxNumber: text('box_number').default(''),
  quantity: integer('quantity').default(1).notNull(),
  conditionBefore: text('condition_before').default('Good').notNull(),
  conditionAfter: text('condition_after').default('Good').notNull(),
  notes: text('notes').default(''),
});

export const quotes = pgTable('quotes', {
  id: serial('id').primaryKey(),
  quoteNumber: text('quote_number').notNull().unique(),
  bookingId: integer('booking_id').references(() => bookings.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  lineItems: jsonb('line_items').$type<Array<{ description: string; category: string; qty: number; unitPrice: number; total: number }>>().notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 10, scale: 2 }).default('0.00'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  status: text('status').default('Sent').notNull(), // Draft, Sent, Accepted, Converted
  createdAt: timestamp('created_at').defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  bookingId: integer('booking_id').references(() => bookings.id),
  quoteId: integer('quote_id').references(() => quotes.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 10, scale: 2 }).default('0.00'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).default('0.00').notNull(),
  balanceDue: numeric('balance_due', { precision: 10, scale: 2 }).notNull(),
  status: text('status').default('Unpaid').notNull(), // Unpaid, Partial, Paid
  dueDate: text('due_date').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.id).notNull(),
  description: text('description').notNull(),
  category: text('category').default('service'), // truck, crew, packing, floors, heavy, discount
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  receiptNumber: text('receipt_number').notNull().unique(),
  invoiceId: integer('invoice_id').references(() => invoices.id),
  bookingId: integer('booking_id').references(() => bookings.id),
  customerName: text('customer_name').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(), // EVC Plus, Zaad, eDahab, Cash, Bank Transfer
  paymentType: text('payment_type').default('Deposit').notNull(), // Deposit, Balance, Full
  referenceCode: text('reference_code').default(''),
  notes: text('notes').default(''),
  paidAt: timestamp('paid_at').defaultNow(),
});

export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(), // driver, mover, supervisor
  phone: text('phone').notNull(),
  dailyRate: numeric('daily_rate', { precision: 10, scale: 2 }).notNull(),
  idCardNumber: text('id_card_number').notNull(),
  photoUrl: text('photo_url').default(''),
  availability: text('availability').default('Available').notNull(), // Available, On Job, Off Duty
  jobsCompleted: integer('jobs_completed').default(0).notNull(),
  attendanceLog: jsonb('attendance_log').$type<Array<{ jobRef: string; date: string; status: string }>>().default([]),
  payType: text('pay_type').default('daily'), // daily | monthly
  monthlySalary: numeric('monthly_salary', { precision: 10, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  plateNumber: text('plate_number').notNull().unique(),
  name: text('name').notNull(),
  capacity: text('capacity').notNull(), // e.g., 3.5 Ton Box Truck, 5 Ton Villa Truck
  driverName: text('driver_name').default(''),
  status: text('status').default('Available').notNull(), // Available, On Job, Maintenance
  currentLat: text('current_lat').default('2.0371'),
  currentLng: text('current_lng').default('45.3182'),
  currentLocationLabel: text('current_location_label').default('Jidka Maka Al-Mukarama · KM4, Hodan'),
  speedKmh: integer('speed_kmh').default(0),
  lastGpsPingAt: text('last_gps_ping_at').default('Live Now'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vehicleLogs = pgTable('vehicle_logs', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  logType: text('log_type').notNull(), // Fuel, Maintenance
  cost: numeric('cost', { precision: 10, scale: 2 }).notNull(),
  litersOrDetails: text('liters_or_details').notNull(),
  logDate: text('log_date').notNull(),
  recordedBy: text('recorded_by').default('Admin'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(), // Fuel, Maintenance, Salaries, Materials, Office
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  expenseDate: text('expense_date').notNull(),
  receiptUrl: text('receipt_url').default(''),
  recordedBy: text('recorded_by').default('Admin'),
  bookingId: integer('booking_id'), // optional link to a job (profit per job)
  createdAt: timestamp('created_at').defaultNow(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  district: text('district').default('Hodan'),
  serviceType: text('service_type').default('Home Moving'),
  rating: integer('rating').default(5).notNull(),
  commentSo: text('comment_so').notNull(),
  commentEn: text('comment_en').notNull(),
  status: text('status').default('Approved').notNull(), // Pending, Approved, Hidden
  createdAt: timestamp('created_at').defaultNow(),
});

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  titleSo: text('title_so').notNull(),
  titleEn: text('title_en').notNull(),
  descSo: text('desc_so').notNull(),
  descEn: text('desc_en').notNull(),
  includedSo: jsonb('included_so').$type<string[]>().notNull(),
  includedEn: jsonb('included_en').$type<string[]>().notNull(),
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  priceLabelSo: text('price_label_so').default(''),
  priceLabelEn: text('price_label_en').default(''),
  imageUrl: text('image_url').default(''),
  iconName: text('icon_name').default('Truck'),
  sortOrder: integer('sort_order').default(1),
});

export const faqs = pgTable('faqs', {
  id: serial('id').primaryKey(),
  questionSo: text('question_so').notNull(),
  questionEn: text('question_en').notNull(),
  answerSo: text('answer_so').notNull(),
  answerEn: text('answer_en').notNull(),
  category: text('category').default('general'),
  sortOrder: integer('sort_order').default(1),
});

export const gallery = pgTable('gallery', {
  id: serial('id').primaryKey(),
  titleSo: text('title_so').notNull(),
  titleEn: text('title_en').notNull(),
  category: text('category').notNull(), // homes, offices, packing, trucks
  imageUrl: text('image_url').notNull(),
  district: text('district').default('Mogadishu'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').default('Admin'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').default(''),
  details: text('details').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// ====================================================
// ENTERPRISE ERP MODULES (19-MODULE FULL OPERATIONS)
// ====================================================

export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  leadCode: text('lead_code').notNull().unique(),
  customerName: text('customer_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').default(''),
  source: text('source').default('WhatsApp').notNull(), // Website Form, WhatsApp, Phone Call, Walk-in, Facebook, TikTok, Referral
  district: text('district').default('Hodan').notNull(),
  moveType: text('move_type').default('Home Moving').notNull(),
  estimatedVolumeM3: numeric('estimated_volume_m3', { precision: 10, scale: 2 }).default('18.00'),
  stage: text('stage').default('New').notNull(), // New, Contacted, Survey Scheduled, Quoted, Won, Lost
  lostReason: text('lost_reason').default(''),
  followUpDate: text('follow_up_date').default(''),
  assignedTo: text('assigned_to').default('Sales / Customer Service'),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const packingMaterials = pgTable('packing_materials', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameSo: text('name_so').notNull(),
  category: text('category').default('Boxes').notNull(), // Boxes, Bubble Wrap, Stretch Film, Tape, Blankets, Straps, Tools
  unit: text('unit').default('pcs').notNull(),
  qtyAvailable: integer('qty_available').default(0).notNull(),
  reorderLevel: integer('reorder_level').default(20).notNull(),
  unitCostUsd: numeric('unit_cost_usd', { precision: 10, scale: 2 }).default('1.50').notNull(),
  supplierName: text('supplier_name').default('Mogadishu Packaging Co.'),
  storageLocation: text('storage_location').default('Mogadishu HQ Warehouse - A1'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const storageUnits = pgTable('storage_units', {
  id: serial('id').primaryKey(),
  unitCode: text('unit_code').notNull().unique(), // BAY-A01, BAY-A02
  sizeM3: integer('size_m3').default(25).notNull(),
  monthlyRateUsd: numeric('monthly_rate_usd', { precision: 10, scale: 2 }).default('120.00').notNull(),
  status: text('status').default('Available').notNull(), // Available, Occupied, Reserved, Maintenance
  customerName: text('customer_name').default(''),
  customerPhone: text('customer_phone').default(''),
  contractNumber: text('contract_number').default(''),
  startDate: text('start_date').default(''),
  endDate: text('end_date').default(''),
  storedItemsSummary: text('stored_items_summary').default(''),
  barcodeTag: text('barcode_tag').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  supplierCode: text('supplier_code').notNull().unique(),
  companyName: text('company_name').notNull(),
  contactPerson: text('contact_person').default(''),
  phone: text('phone').notNull(),
  category: text('category').default('Packing Materials').notNull(), // Packing Materials, Fuel Station, Spare Parts & Garage, Truck Rental
  district: text('district').default('Bakara / Howlwadaag'),
  balanceUsd: numeric('balance_usd', { precision: 10, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  poNumber: text('po_number').notNull().unique(), // PO-2026-0001
  supplierName: text('supplier_name').notNull(),
  itemsSummary: text('items_summary').notNull(),
  totalUsd: numeric('total_usd', { precision: 10, scale: 2 }).notNull(),
  status: text('status').default('Approved').notNull(), // Requested, Approved, Received, Paid
  orderDate: text('order_date').notNull(),
  supplierId: integer('supplier_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const damageClaims = pgTable('damage_claims', {
  id: serial('id').primaryKey(),
  claimNumber: text('claim_number').notNull().unique(), // CLM-2026-0001
  bookingRef: text('booking_ref').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').default(''),
  itemAffected: text('item_affected').notNull(),
  description: text('description').notNull(),
  responsibleCrew: text('responsible_crew').default(''),
  estimatedDamageUsd: numeric('estimated_damage_usd', { precision: 10, scale: 2 }).default('0.00').notNull(),
  compensationUsd: numeric('compensation_usd', { precision: 10, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('Reported').notNull(), // Reported, Investigating, Approved, Rejected, Compensated
  incidentDate: text('incident_date').notNull(),
  resolutionNotes: text('resolution_notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ledgerAccounts = pgTable('ledger_accounts', {
  id: serial('id').primaryKey(),
  accountCode: text('account_code').notNull().unique(), // 1010, 1020, 4010, 5010
  accountName: text('account_name').notNull(),
  accountType: text('account_type').notNull(), // Asset, Liability, Equity, Revenue, Expense
  currency: text('currency').default('USD').notNull(),
  balanceUsd: numeric('balance_usd', { precision: 12, scale: 2 }).default('0.00').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  entryNumber: text('entry_number').notNull().unique(), // JE-2026-0001
  entryDate: text('entry_date').notNull(),
  referenceDoc: text('reference_doc').default(''), // INV, RCPT, EXP, PO
  description: text('description').notNull(),
  debitAccount: text('debit_account').notNull(),
  creditAccount: text('credit_account').notNull(),
  amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  postedBy: text('posted_by').default('Accountant'),
  createdAt: timestamp('created_at').defaultNow(),
});

