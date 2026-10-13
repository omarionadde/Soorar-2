# SOORAR — Professional Home & Office Moving Website & Admin ERP (Mogadishu, Somalia)

**Tagline (Somali):** *"Rarid xirfad leh, Muqdisho oo dhan."*  
**Tagline (English):** *"Professional moving across all of Mogadishu."*  
**WhatsApp & Phone:** `+252 770 505 028` (`https://wa.me/252770505028`)

## 1. Overview

SOORAR is a bilingual (Somali default `SO` / English `EN`) public website, 6-step moving quote & booking engine with instant WhatsApp hand-off, and a 12-module role-based Admin ERP system backed by PostgreSQL (Cloud SQL + Drizzle ORM) and Firebase Authentication.

### Key Highlights
- **Brand Identity:** Primary Blue (`#0151B9`), Accent Orange (`#FC7C00`), Dark Navy (`#0B1F3A`), Light Background (`#F2F5FA`), Poppins & JetBrains Mono tabular typography, custom house-joined-to-moving-truck SVG logo (never includes the word "COMPANY").
- **Public Pages (10 Views):**
  1. **Home:** Hero with Mogadishu moving crew photography, 4-metric Trust Bar, 5 Services Cards, 5-step "How it Works", "Why SOORAR", Customer Reviews, Gallery Preview, and CTA band.
  2. **Services:** Detailed breakdowns of Home Moving, Office Moving, Packing, Furniture Disassembly/Assembly, and Heavy Items.
  3. **Pricing & Estimator:** 4 transparent package cards + interactive room/floor/lift/zone price calculator with WhatsApp hand-off.
  4. **About:** The story of *"Soo rar"*, mission, vision, and fleet photography.
  5. **Gallery:** Filterable photography across `homes`, `offices`, `packing`, and `trucks`.
  6. **Reviews:** Verified customer reviews + moderated public review submission form.
  7. **FAQ:** Bilingual accordion covering EVC Plus / Zaad / eDahab payments, 100% insured handling, and Mogadishu districts.
  8. **Contact:** Direct WhatsApp, phone, office hours, embedded Mogadishu map, and contact form.
  9. **6-Step Booking Engine:** Multi-select services, Mogadishu district dropdowns (Hodan, Wadajir, Dharkenley, Hawl-Wadaag, Waberi, Yaqshid, Karaan, Shibis, Bondhere, Abdiaziz, Hamar Weyne, Hamar Jajab, Shangani, Wardhigley, Heliwaa, Kaxda, Garasbaley, Daynile, Other), floor/lift selectors, optional photo upload, reference number generation (`SR-2026-XXXX`), and pre-filled WhatsApp message in Somali or English.
  10. **Legal:** Privacy Policy and Terms of Service.
- **Admin ERP (`/admin` or "Maamulka (ERP)"):**
  1. **Dashboard:** KPIs, weekly bookings chart, monthly revenue, and services breakdown.
  2. **Bookings & Calendar:** Searchable/filterable table + Schedule Calendar view + 1-click WhatsApp templates (*Send Quote*, *Send Confirmation*, *Send Thank-You + Review Request*).
  3. **Customers:** Family, Business, and NGO profiles with total spend.
  4. **Quotes & Invoices:** Line-item builder, 1-click conversion to Invoice, and branded printable PDF export with SOORAR logo and blue-orange footer stripe.
  5. **Payments:** Record EVC Plus, Zaad, eDahab, Cash, and Bank Transfer deposits/balances with printable PDF receipts.
  6. **Staff:** Movers, drivers, and supervisors with daily rates, ID card numbers, and job attendance logging.
  7. **Vehicles:** Enclosed trucks with plate numbers, capacities, and fuel/maintenance cost logs.
  8. **Inventory Checklist:** Per-booking item & box condition tracking (before pickup & after delivery) + digital customer signatures.
  9. **Expenses:** Track Fuel, Maintenance, Salaries, Materials, and Office costs.
  10. **Reports:** Financial profit summary + CSV/Excel export & PDF print.
  11. **Content Management (CMS):** Edit services, prices, and moderate customer reviews without code.
  12. **Settings & Audit Log:** Company info, bilingual WhatsApp message templates, RBAC role switcher (`Admin`, `Manager`, `Staff`, `Accountant`), and security activity log.

## 2. Database & Setup Instructions

- **Database Schema:** Defined in `src/db/schema.ts` using Drizzle ORM (`postgresql` dialect) with 18 relational tables.
- **Database Connection:** Configured in `src/db/index.ts` using the `pg` connection pool (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`).
- **Auto-Seeding:** On first startup, `src/db/seed.ts` automatically populates Mogadishu services, FAQs, reviews, staff, vehicles, and sample bookings (`SR-2026-0001` through `SR-2026-0004`).
- **Running Locally:**
  ```bash
  npm install
  npm run dev
  ```
