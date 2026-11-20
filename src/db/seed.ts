import { db } from './index.ts';
import {
  services,
  faqs,
  reviews,
  gallery,
  staff,
  vehicles,
  vehicleLogs,
  customers,
  bookings,
  bookingItems,
  quotes,
  invoices,
  invoiceItems,
  payments,
  expenses,
  settings,
  activityLog,
} from './schema.ts';
import { count } from 'drizzle-orm';

const HERO_IMG = '/src/assets/images/hero_soorar_movers_1791514402987.jpg';
const HOME_IMG = '/src/assets/images/service_home_moving_1791514415369.jpg';
const OFFICE_IMG = '/src/assets/images/service_office_moving_1791514425385.jpg';
const PACKING_IMG = '/src/assets/images/service_packing_assembly_1791514435681.jpg';
const FLEET_IMG = '/src/assets/images/about_soorar_fleet_1791514445536.jpg';

export async function ensureSeeded() {
  try {
    const existingServices = await db.select({ value: count() }).from(services);
    if (existingServices[0] && existingServices[0].value > 0) {
      return;
    }

    // 1. Seed Services (5 core services)
    await db.insert(services).values([
      {
        slug: 'home-moving',
        titleSo: 'Raridda Guryaha (Hal qol ilaa Fiilo)',
        titleEn: 'Home Moving (One Room to a Villa)',
        descSo: 'Waxaan si ammaan ah oo degdeg ah u rarnaa guryaha yar-yar, dabaqyada iyo fiilooyinka waaweyn ee dhammaan degmooyinka Muqdisho.',
        descEn: 'Safe, careful, and organized residential moving from single rooms and apartments to full family villas across all Mogadishu districts.',
        includedSo: [
          'Gaari xiran oo nadiif ah oo alaabta roobka iyo boorka ka celinaya',
          'Koox xirfadlayaal ah oo tababaran oo xiran dharka buluugga ah ee SOORAR',
          'Duubista alaabta jilicsan (bustayaal gaar ah iyo bacda xumbada)',
          'Raridda iyo dejinta qol-qol loo dhigayo guriga cusub',
        ],
        includedEn: [
          'Clean enclosed moving truck protecting items from dust and weather',
          'Uniformed SOORAR moving crew trained in safe lifting',
          'Protective furniture blankets and stretch-wrapping included',
          'Loading, transport, and room-by-room placement at your new home',
        ],
        basePrice: '120.00',
        priceLabelSo: 'Laga bilaabo $120',
        priceLabelEn: 'Starting from $120',
        imageUrl: HOME_IMG,
        iconName: 'Home',
        sortOrder: 1,
      },
      {
        slug: 'office-moving',
        titleSo: 'Raridda Xafiisyada & Shirkadaha',
        titleEn: 'Office & Commercial Moving',
        descSo: 'Rarid xirfad leh oo loogu talagalay xafiisyada, bangiyada, hay’adaha (NGOs) iyo goobaha ganacsiga. Waxaan sidoo kale shaqeynaa habeenkii iyo maalmaha fasaxa.',
        descEn: 'Structured commercial relocation for offices, NGOs, clinics, and businesses. Night and weekend moves available to ensure zero downtime.',
        includedSo: [
          'Summadaynta iyo habaynta miisaska, kuraasta iyo faylasha muhiimka ah',
          'Xirxiridda kombiyuutarada, mashiinnada daabacaadda iyo qalabka IT-ga',
          'Rarid habeenkii ama Jimcaha si shaqadaadu uusan hakad u gelin',
          'Kormeeraha mashruuca oo goobta jooga bilow ilaa dhammaad',
        ],
        includedEn: [
          'Department labeling for desks, ergonomic chairs, and archive files',
          'Anti-static bubble protection for computers, servers, and printers',
          'Evening and Friday weekend scheduling for zero business disruption',
          'Dedicated on-site supervisor coordinating the entire move',
        ],
        basePrice: '250.00',
        priceLabelSo: 'Laga bilaabo $250',
        priceLabelEn: 'Starting from $250',
        imageUrl: OFFICE_IMG,
        iconName: 'Building2',
        sortOrder: 2,
      },
      {
        slug: 'packing',
        titleSo: 'Xirxiridda & Duubista Alaabta',
        titleEn: 'Professional Packing & Wrapping',
        descSo: 'Kartoonno adag, bacda xumbada (bubble wrap), sharooto tayo leh iyo warqadaha summadda qolalka si weelka jilicsan uusan waxba u gaarin.',
        descEn: 'Heavy-duty corrugated boxes, multi-layer bubble wrap, protective foam, and room-by-room color labeling for dishes, glass, and valuables.',
        includedSo: [
          'Kartoonno cusub oo cabbirro kala duwan leh (yar, dhexe, weyn)',
          'Bacda xumbada (Bubble wrap) ee muraayadaha, TV-yada iyo weelka jikada',
          'Qorista iyo summadaynta kartoon kasta qolka uu ku socdo',
          'Furidda kartoonnada iyo habaynta marka la geeyo guriga cusub',
        ],
        includedEn: [
          'Double-walled moving boxes in small, medium, and wardrobe sizes',
          'Bubble wrap and corner guards for TVs, mirrors, and kitchenware',
          'Clear bilingual room-by-room inventory labeling on every box',
          'Optional unpacking and carton removal at your destination',
        ],
        basePrice: '60.00',
        priceLabelSo: 'Laga bilaabo $60',
        priceLabelEn: 'Starting from $60',
        imageUrl: PACKING_IMG,
        iconName: 'PackageCheck',
        sortOrder: 3,
      },
      {
        slug: 'furniture-assembly',
        titleSo: 'Furfuridda & Xirxiridda Jiifka & Armaajooyinka',
        titleEn: 'Furniture Disassembly & Assembly',
        descSo: 'Farsamo-yaqaanno khibrad u leh furfuridda iyo dib-u-xiridda sariiraha, armaajooyinka waaweyn, miisaska shirarka iyo daahyada.',
        descEn: 'Skilled carpenters and technicians to carefully dismantle and reassemble master beds, sliding wardrobes, dining sets, and executive desks.',
        includedSo: [
          'Farsamo-yaqaanno wata qalab casri ah oo dhammaystiran',
          'ururinta boolasha iyo biraha yaryar bac summadaysan dhexdeeda',
          'Dib-u-dhisidda sariiraha, armaajooyinka Turki/Shiine iyo miisaska',
          'Hubinta adkaanta iyo dheelitirka alaabta ka hor intaan la tegin',
        ],
        includedEn: [
          'Experienced carpenters with complete power and hand toolkits',
          'Secure hardware pouch tagging for all screws, bolts, and hinges',
          'Full reassembly of imported Turkish/Chinese wardrobes and bed frames',
          'Leveling and structural alignment check in your new rooms',
        ],
        basePrice: '50.00',
        priceLabelSo: 'Laga bilaabo $50',
        priceLabelEn: 'Starting from $50',
        imageUrl: PACKING_IMG,
        iconName: 'Wrench',
        sortOrder: 4,
      },
      {
        slug: 'heavy-items',
        titleSo: 'Raridda Alaabta Culus',
        titleEn: 'Heavy & Specialty Items Transport',
        descSo: 'Qaboojiyeyaasha waaweyn, qasnadaha birta ah (safes), matoorrada korontada, mashiinnada jimicsiga iyo qalabka warshadaha.',
        descEn: 'Specialized lifting gear, ramps, and heavy-duty dollies for large refrigerators, security safes, generators, gym equipment, and medical machines.',
        includedSo: [
          'Suumanka wax lagu qaado, biraha rullaluistuyada iyo jaranjarooyinka gaariga',
          'Koox xoog leh oo u tababaran jaranjarooyinka dhaadheer',
          'Ilaalinta sagxadda guriga iyo darbiyada inta la rarayo',
          'Gaadiid awood u leh miisaanka culus oo leh xبالo adag',
        ],
        includedEn: [
          'Heavy-duty lifting straps, stair-climbing dollies, and loading ramps',
          'Specialized crew trained for narrow staircases and high floors',
          'Floor runner mats and doorframe padding to prevent scratches',
          'Reinforced load securing inside our box trucks',
        ],
        basePrice: '80.00',
        priceLabelSo: 'Laga bilaabo $80',
        priceLabelEn: 'Starting from $80',
        imageUrl: HERO_IMG,
        iconName: 'ShieldCheck',
        sortOrder: 5,
      },
    ]);

    // 2. Seed FAQs
    await db.insert(faqs).values([
      {
        questionSo: 'Sidee loo xisaabiyaa qiimaha raridda?',
        questionEn: 'How is the moving price calculated?',
        answerSo: 'Qiimuhu wuxuu ku xiran yahay cabbirka guriga ama xafiiska (tirada qolalka), dabaqa laga rarayo iyo kan la geynayo, haddii wiish (lift) jiro, fogaanta labada degmo, iyo adeegyada dheeriga ah sida kartoonnada ama furfuridda armaajooyinka. Qiimo qarsoon ma jiro.',
        answerEn: 'Our transparent pricing is based on home/office size (number of rooms), floor levels at pickup and drop-off, lift availability, distance between Mogadishu districts, and optional packing or assembly services. There are zero hidden fees.',
        category: 'pricing',
        sortOrder: 1,
      },
      {
        questionSo: 'Habkee ayaan ku bixin karaa lacagta?',
        questionEn: 'What payment methods do you accept?',
        answerSo: 'Waxaan aqbalnaa EVC Plus, Zaad, eDahab, lacag caddaan ah (Cash), iyo xawaalad bangi (Bank Transfer) oo loogu talagalay shirkadaha iyo hay’adaha.',
        answerEn: 'We accept EVC Plus, Zaad, eDahab, USD Cash, and corporate Bank Transfers (with official tax invoices and receipts).',
        category: 'payment',
        sortOrder: 2,
      },
      {
        questionSo: 'Ka warran haddii alaab wax gaarto inta lagu jiro raridda?',
        questionEn: 'What is your damage protection and insurance policy?',
        answerSo: '100% mas’uuliyad iyo damaanad ayaan qaadnaa. Alaab kasta waxaa lagu duubaa bustayaal iyo bacda xumbada, waxaana la qoraa liiska hubinta (Inventory Checklist) ka hor iyo ka dib. Haddii cilad dhacdo mas’uuliyaddeeda SOORAR ayaa leh.',
        answerEn: 'Every move is covered by our 100% insured handling commitment. We wrap all furniture in heavy blankets and bubble wrap, and inspect every item on a signed pickup/delivery checklist. Any damage caused by our crew is repaired or compensated.',
        category: 'safety',
        sortOrder: 3,
      },
      {
        questionSo: 'Imisa maalmood ka hor ayaan qabsan karaa ballanta?',
        questionEn: 'How far in advance should I book my move?',
        answerSo: 'Waxaan kugula talineynaa 1 ilaa 3 maalmood ka hor si aad u hesho waqtiga kuugu habboon, laakiin sidoo kale waxaan bixinaa adeeg isla maalintaas ah (Same-day service) haddii gaadiid bannaan yahay.',
        answerEn: 'We recommend booking 1 to 3 days in advance for preferred morning slots, though we also offer same-day emergency moving across Mogadishu subject to truck availability.',
        category: 'booking',
        sortOrder: 4,
      },
      {
        questionSo: 'Saacadaha shaqada iyo maalmaha aad furan tihiin waa kuwee?',
        questionEn: 'What are your working hours and days?',
        answerSo: 'Xafiiskeenna iyo kooxuhuba waxay shaqeeyaan Sabti ilaa Khamiis, 7:00 subaxnimo ilaa 18:00 fiidnimo. Raridda xafiisyada ee habeenkii ama Jimcaha waa la qabanqaabin karaa marka hore laguugu ballamo.',
        answerEn: 'Our standard operating hours are Saturday to Thursday, 7:00 AM to 6:00 PM (18:00). Night moves and Friday relocations for offices can be scheduled upon request.',
        category: 'hours',
        sortOrder: 5,
      },
      {
        questionSo: 'Degmooyinka Muqdisho oo dhan ma ka shaqeysiin?',
        questionEn: 'Which areas of Mogadishu do you cover?',
        answerSo: 'Haa! Waxaan ka shaqeynaa dhammaan 17-ka degmo ee Muqdisho iyo deegaannada ku xeeran sida Hodan, Wadajir, Dharkenley, Waberi, Hawl-Wadaag, Kaxda, Garasbaley, Dayniile, Cabdicasiis, Kaaraan, Yaaqshiid iyo Heliwaa.',
        answerEn: 'Yes! We cover all districts of Mogadishu and surrounding corridors including Hodan, Wadajir, Dharkenley, Waberi, Hawl-Wadaag, Kaxda, Garasbaley, Daynile, Abdiaziz, Karaan, Yaqshid, Shibis, and Heliwaa.',
        category: 'areas',
        sortOrder: 6,
      },
    ]);

    // 3. Seed Reviews
    await db.insert(reviews).values([
      {
        customerName: 'Aamina Maxamed Cali',
        district: 'Hodan → Wadajir',
        serviceType: 'Home Moving',
        rating: 5,
        commentSo: 'Maasha Allaah! Kooxda SOORAR waxay noo rareen guri 5 qol ah oo ku yaal Hodan una guuray Wadajir. Armaajooyinka Turki-ga ah sidii ay ahaayeen ka fiican ayay noogu xireen, hal koob xitaa nagama jabin.',
        commentEn: 'Mashallah! The SOORAR crew moved our 5-room home from Hodan to Wadajir. They disassembled and reassembled our Turkish wardrobes flawlessly and not a single glass broke.',
        status: 'Approved',
      },
      {
        customerName: 'Eng. Cabdiraxmaan Nuur (Horumar Tech)',
        district: 'Waberi → KM4 Hodan',
        serviceType: 'Office Moving',
        rating: 5,
        commentSo: 'Xafiiskeenna oo ka koobnaa 25 miis iyo kombiyuutarro badan ayay habeen Khamiis ah noo rareen. Sabtidii markii shaqaaluhu yimaadeen wax walba way diyaarsanaayeen. Xirfad sare!',
        commentEn: 'They relocated our 25-desk technology office on a Thursday evening. By Saturday morning every monitor and archive box was in place. True professionalism in Mogadishu.',
        status: 'Approved',
      },
      {
        customerName: 'Dr. Fartuun Xasan',
        district: 'Kaxda → Degmada Cabdicasiis',
        serviceType: 'Packing & Villa Move',
        rating: 5,
        commentSo: 'Waqtiga ay ballameen 7:00 subaxnimo ayay albaabka taagnaayeen. Qiimaha ay ii sheegeen bilowgii wax dheeri ah kama dalbanin. Aad ayaan ugu faraxsanahay adeeggooda.',
        commentEn: 'They arrived right at 7:00 AM as promised. They honored the exact quote with zero hidden charges and wrapped every piece of furniture with care.',
        status: 'Approved',
      },
      {
        customerName: 'Maxamuud Warsame',
        district: 'Dharkenley → Garasbaley',
        serviceType: 'Furniture Assembly',
        rating: 5,
        commentSo: 'Farsamo-yaqaannada SOORAR waa dad edeb badan oo shaqadooda yaqaanna. Sariiraha iyo qaboojiyaha weyn dabaqa 3aad ayay si fudud uga soo dejiyeen.',
        commentEn: 'Polite, uniformed, and skilled team. They brought our heavy double-door fridge and bedroom sets down from the 3rd floor without a scratch.',
        status: 'Approved',
      },
    ]);

    // 4. Seed Gallery
    await db.insert(gallery).values([
      {
        titleSo: 'Raridda Fiilo Casri ah – Degmada Hodan',
        titleEn: 'Modern Villa Relocation – Hodan District',
        category: 'homes',
        imageUrl: HOME_IMG,
        district: 'Hodan',
      },
      {
        titleSo: 'Raridda Xafiiska Shirkadda – Waberi',
        titleEn: 'Corporate Office Move – Waberi',
        category: 'offices',
        imageUrl: OFFICE_IMG,
        district: 'Waberi',
      },
      {
        titleSo: 'Xirxiridda Kartoonnada & Weelka Jilicsan',
        titleEn: 'Protective Bubble Wrapping & Box Labeling',
        category: 'packing',
        imageUrl: PACKING_IMG,
        district: 'Wadajir',
      },
      {
        titleSo: 'Gaadiidka Xiran & Kooxda SOORAR',
        titleEn: 'SOORAR Enclosed Trucks & Uniformed Crew',
        category: 'trucks',
        imageUrl: FLEET_IMG,
        district: 'Mogadishu',
      },
      {
        titleSo: 'Raridda fadhiga oo duuban – Cabdicasiis',
        titleEn: 'Wrapped Sofa Loading – Abdiaziz',
        category: 'homes',
        imageUrl: HERO_IMG,
        district: 'Abdiaziz',
      },
    ]);

    // 5. Seed Staff
    await db.insert(staff).values([
      {
        name: 'Cabdullaahi Maxamed Xasan',
        role: 'supervisor',
        phone: '+252 61 544 1122',
        dailyRate: '35.00',
        idCardNumber: 'SO-MOG-1042',
        photoUrl: FLEET_IMG,
        availability: 'Available',
        jobsCompleted: 148,
        attendanceLog: [
          { jobRef: 'SR-2026-0001', date: '2026-10-08', status: 'Present' },
          { jobRef: 'SR-2026-0002', date: '2026-10-07', status: 'Present' },
        ],
      },
      {
        name: 'Xuseen Cali Nuur',
        role: 'driver',
        phone: '+252 61 588 3344',
        dailyRate: '30.00',
        idCardNumber: 'SO-MOG-1089',
        photoUrl: HERO_IMG,
        availability: 'Available',
        jobsCompleted: 132,
        attendanceLog: [
          { jobRef: 'SR-2026-0001', date: '2026-10-08', status: 'Present' },
        ],
      },
      {
        name: 'Mustaf Axmed Faarax',
        role: 'mover',
        phone: '+252 61 522 9900',
        dailyRate: '22.00',
        idCardNumber: 'SO-MOG-1120',
        photoUrl: HOME_IMG,
        availability: 'On Job',
        jobsCompleted: 96,
        attendanceLog: [
          { jobRef: 'SR-2026-0003', date: '2026-10-08', status: 'Present' },
        ],
      },
      {
        name: 'Yacquub Cumar Geedi',
        role: 'mover',
        phone: '+252 61 577 6611',
        dailyRate: '25.00',
        idCardNumber: 'SO-MOG-1154',
        photoUrl: PACKING_IMG,
        availability: 'Available',
        jobsCompleted: 110,
        attendanceLog: [],
      },
      {
        name: 'Daahir Cabdi Shire',
        role: 'driver',
        phone: '+252 61 599 1234',
        dailyRate: '30.00',
        idCardNumber: 'SO-MOG-1198',
        photoUrl: FLEET_IMG,
        availability: 'Available',
        jobsCompleted: 84,
        attendanceLog: [],
      },
    ]);

    // 6. Seed Vehicles
    const insertedVehicles = await db.insert(vehicles).values([
      {
        plateNumber: 'MOG-A-4021',
        name: 'Isuzu NPR Box Truck #1 (Fiilo)',
        capacity: '5.0 Ton Enclosed Box',
        driverName: 'Xuseen Cali Nuur',
        status: 'Available',
      },
      {
        plateNumber: 'MOG-B-7719',
        name: 'Isuzu NKR Box Truck #2 (Dhexe)',
        capacity: '3.5 Ton Enclosed Box',
        driverName: 'Daahir Cabdi Shire',
        status: 'On Job',
      },
      {
        plateNumber: 'MOG-C-2190',
        name: 'Hyundai Mighty H350 #3 (Degdeg)',
        capacity: '2.5 Ton City Mover',
        driverName: 'Cabdullaahi Maxamed Xasan',
        status: 'Available',
      },
    ]).returning();

    if (insertedVehicles[0]) {
      await db.insert(vehicleLogs).values([
        {
          vehicleId: insertedVehicles[0].id,
          logType: 'Fuel',
          cost: '45.00',
          litersOrDetails: '38 Liters Diesel – Total Station KM4',
          logDate: '2026-10-06',
          recordedBy: 'Xuseen Cali Nuur',
        },
        {
          vehicleId: insertedVehicles[1].id,
          logType: 'Maintenance',
          cost: '85.00',
          litersOrDetails: 'Oil change, brake pad check & tire alignment',
          logDate: '2026-10-03',
          recordedBy: 'Admin',
        },
      ]);
    }

    // 7. Seed Customers
    const insertedCustomers = await db.insert(customers).values([
      {
        name: 'Aamina Maxamed Cali',
        phone: '+252 61 511 2233',
        email: 'aamina.cali@example.so',
        customerType: 'family',
        notes: '5-room villa move from Hodan to Wadajir. Very happy with wardrobe assembly.',
        totalSpent: '320.00',
      },
      {
        name: 'Horumar Tech Solutions',
        phone: '+252 61 599 8877',
        email: 'ops@horumartech.so',
        customerType: 'business',
        notes: 'Corporate client in Waberi / KM4. Prefers Thursday evening moves.',
        totalSpent: '580.00',
      },
      {
        name: 'Somali Relief & Care NGO',
        phone: '+252 61 533 4455',
        email: 'logistics@somalirelief.org',
        customerType: 'NGO',
        notes: 'Requires official PDF invoices and bank transfer receipts.',
        totalSpent: '850.00',
      },
      {
        name: 'Cabdikariim Xasan Rooble',
        phone: '+252 770 601 234',
        email: 'abdikarim@example.com',
        customerType: 'family',
        notes: 'Moving 3-bedroom apartment from Hawl-Wadaag to Kaxda.',
        totalSpent: '185.00',
      },
    ]).returning();

    // 8. Seed Bookings
    const insertedBookings = await db.insert(bookings).values([
      {
        referenceNumber: 'SR-2026-0001',
        customerId: insertedCustomers[0]?.id,
        customerName: 'Aamina Maxamed Cali',
        customerPhone: '+252 61 511 2233',
        customerEmail: 'aamina.cali@example.so',
        services: ['home', 'packing', 'assembly'],
        fromDistrict: 'Hodan',
        fromAddress: 'Agagaarka Digfeer, Jidka 30-ka',
        fromFloor: 2,
        fromLift: false,
        toDistrict: 'Wadajir',
        toAddress: 'Buulo Xuubey, Villa #14',
        toFloor: 0,
        toLift: false,
        sizeDescription: '5 Qol (Fiilo Dhexe)',
        largeItems: '2 Armaajo Turki 6-albaab, 1 Qaboojiye LG weyn, 3 Sariirood, Fadhiga 7-qof',
        photos: [HOME_IMG],
        preferredDate: '2026-10-08',
        preferredTime: '08:00',
        flexibleDate: false,
        notes: 'Fadlan keena kartoonno dheeri ah oo weelka jikada lagu rido.',
        status: 'Completed',
        assignedStaffIds: [1, 2, 4],
        assignedVehicleId: insertedVehicles[0]?.id,
        quotedAmount: '320.00',
        language: 'so',
        statusHistory: [
          { status: 'New', timestamp: '2026-10-05 09:15', note: 'Booking submitted online' },
          { status: 'Quoted', timestamp: '2026-10-05 10:00', note: 'Quote $320 sent via WhatsApp' },
          { status: 'Confirmed', timestamp: '2026-10-06 14:20', note: 'Deposit paid via EVC Plus' },
          { status: 'Completed', timestamp: '2026-10-08 15:45', note: 'All items delivered & signed' },
        ],
        pickupSignature: 'Aamina M. Cali (Signed)',
        deliverySignature: 'Aamina M. Cali (Signed)',
      },
      {
        referenceNumber: 'SR-2026-0002',
        customerId: insertedCustomers[1]?.id,
        customerName: 'Horumar Tech Solutions',
        customerPhone: '+252 61 599 8877',
        customerEmail: 'ops@horumartech.so',
        services: ['office', 'packing', 'heavy'],
        fromDistrict: 'Waberi',
        fromAddress: 'Maka Al-Mukarama, Dabka',
        fromFloor: 3,
        fromLift: true,
        toDistrict: 'Hodan',
        toAddress: 'KM4, Dhismaha Premier Tower, Dabaqa 4',
        toFloor: 4,
        toLift: true,
        sizeDescription: 'Xafiis 25 Shaqaale (8 Qol)',
        largeItems: '25 Miis & Kursi, 1 Server Rack, 1 Qasnad Bir ah (250kg), 2 Mashiinka Daabacaadda',
        photos: [OFFICE_IMG],
        preferredDate: '2026-10-09',
        preferredTime: '07:30',
        flexibleDate: true,
        notes: 'Waxaan rabnaa in server-ka iyo kombiyuutarada lagu duubo bacda xumbada.',
        status: 'Confirmed',
        assignedStaffIds: [1, 2, 3],
        assignedVehicleId: insertedVehicles[0]?.id,
        quotedAmount: '580.00',
        language: 'so',
        statusHistory: [
          { status: 'New', timestamp: '2026-10-07 11:00', note: 'Submitted via website' },
          { status: 'Quoted', timestamp: '2026-10-07 12:30', note: 'Official quote SR-Q-2026-0002 issued' },
          { status: 'Confirmed', timestamp: '2026-10-08 09:00', note: 'Confirmed for tomorrow morning' },
        ],
      },
      {
        referenceNumber: 'SR-2026-0003',
        customerId: insertedCustomers[3]?.id,
        customerName: 'Cabdikariim Xasan Rooble',
        customerPhone: '+252 770 601 234',
        customerEmail: 'abdikarim@example.com',
        services: ['home', 'assembly'],
        fromDistrict: 'Hawl-Wadaag',
        fromAddress: 'Bakaaraha, Jidka 1aad',
        fromFloor: 1,
        fromLift: false,
        toDistrict: 'Kaxda',
        toAddress: 'Xaafadda Cusub, Jidka Laamiga',
        toFloor: 0,
        toLift: false,
        sizeDescription: '3 Qol (Guri Qoys)',
        largeItems: '1 Sariir Master ah, 1 Armaajo 4-albaab, 1 Fadhi Carbeed, Qaboojiye dhexe',
        photos: [],
        preferredDate: '2026-10-10',
        preferredTime: '09:00',
        flexibleDate: true,
        notes: 'Armaajada waa in la furfuro ka hor intaan la rarin.',
        status: 'New',
        assignedStaffIds: [3],
        assignedVehicleId: insertedVehicles[1]?.id,
        quotedAmount: '185.00',
        language: 'so',
        statusHistory: [
          { status: 'New', timestamp: '2026-10-08 16:30', note: 'New booking awaiting WhatsApp quote' },
        ],
      },
      {
        referenceNumber: 'SR-2026-0004',
        customerId: insertedCustomers[2]?.id,
        customerName: 'Somali Relief & Care NGO',
        customerPhone: '+252 61 533 4455',
        customerEmail: 'logistics@somalirelief.org',
        services: ['office', 'packing', 'assembly', 'heavy'],
        fromDistrict: 'Shangaani',
        fromAddress: 'Agagaarka Dekedda hore',
        fromFloor: 2,
        fromLift: false,
        toDistrict: 'Wadajir',
        toAddress: 'Airport Road, Medina Gate Compound',
        toFloor: 1,
        toLift: true,
        sizeDescription: 'Xafiis Weyn (12 Qol + Kaydka)',
        largeItems: '40 Miis, 60 Kartoon oo Faylal ah, 2 Matoor yar, 3 Qasnadood',
        photos: [OFFICE_IMG, PACKING_IMG],
        preferredDate: '2026-10-12',
        preferredTime: '07:00',
        flexibleDate: false,
        notes: 'Fadlan soo dira warqadda qiimaha (PDF Quote) si xafiiska maaliyadda u ansixiyo.',
        status: 'Quoted',
        assignedStaffIds: [1, 2, 4, 5],
        assignedVehicleId: insertedVehicles[0]?.id,
        quotedAmount: '850.00',
        language: 'en',
        statusHistory: [
          { status: 'New', timestamp: '2026-10-08 08:10', note: 'NGO relocation request' },
          { status: 'Quoted', timestamp: '2026-10-08 11:45', note: 'Quote $850 sent' },
        ],
      },
    ]).returning();

    // 9. Seed Booking Items (Inventory Checklist)
    if (insertedBookings[0]) {
      await db.insert(bookingItems).values([
        {
          bookingId: insertedBookings[0].id,
          itemName: 'Armaajo Turki 6-Albaab (Master Bedroom Wardrobe)',
          boxNumber: 'FURN-01',
          quantity: 2,
          conditionBefore: 'Good - No scratches',
          conditionAfter: 'Good - Reassembled & leveled',
          notes: 'Bolts packed in labeled pouch #1',
        },
        {
          bookingId: insertedBookings[0].id,
          itemName: 'Fadhiga Saloonka 7-Qof (L-Shape Sofa Set)',
          boxNumber: 'FURN-02',
          quantity: 1,
          conditionBefore: 'Good - Wrapped in double layer',
          conditionAfter: 'Good - Placed in main hall',
          notes: 'Stretch-film and moving blankets used',
        },
        {
          bookingId: insertedBookings[0].id,
          itemName: 'Kartoonnada Weelka Jikada (Fragile Kitchen Boxes)',
          boxNumber: 'BOX-01 to BOX-12',
          quantity: 12,
          conditionBefore: 'Sealed with bubble wrap',
          conditionAfter: 'Intact - 0 breakage',
          notes: 'Labeled JIKO / KITCHEN',
        },
        {
          bookingId: insertedBookings[0].id,
          itemName: 'Qaboojiye LG Double-Door (Refrigerator)',
          boxNumber: 'APP-01',
          quantity: 1,
          conditionBefore: 'Working, upright transport',
          conditionAfter: 'Delivered upright, undamaged',
          notes: 'Advised to wait 2 hours before plugging in',
        },
      ]);
    }

    // 10. Seed Quotes & Invoices & Payments
    if (insertedBookings[0] && insertedBookings[1]) {
      const insertedQuotes = await db.insert(quotes).values([
        {
          quoteNumber: 'SR-Q-2026-0001',
          bookingId: insertedBookings[0].id,
          customerName: 'Aamina Maxamed Cali',
          customerPhone: '+252 61 511 2233',
          lineItems: [
            { description: 'Gaari Xiran 5-Ton (Hodan → Wadajir)', category: 'truck', qty: 1, unitPrice: 120, total: 120 },
            { description: 'Kooxda Raridda (4 Xirfadle)', category: 'crew', qty: 4, unitPrice: 25, total: 100 },
            { description: 'Kartoonno & Bacda Xumbada (Packing Materials)', category: 'packing', qty: 1, unitPrice: 50, total: 50 },
            { description: 'Furfuridda & Xiridda 2 Armaajo + 3 Sariirood', category: 'assembly', qty: 1, unitPrice: 60, total: 60 },
          ],
          subtotal: '330.00',
          discount: '10.00',
          total: '320.00',
          status: 'Converted',
        },
        {
          quoteNumber: 'SR-Q-2026-0002',
          bookingId: insertedBookings[1].id,
          customerName: 'Horumar Tech Solutions',
          customerPhone: '+252 61 599 8877',
          lineItems: [
            { description: '2x Gaari Xiran 5-Ton (Waberi → KM4)', category: 'truck', qty: 2, unitPrice: 130, total: 260 },
            { description: 'Kooxda Raridda Xafiiska (6 Xirfadle)', category: 'crew', qty: 6, unitPrice: 30, total: 180 },
            { description: 'Duubista IT-ga & Kartoonnada Faylasha', category: 'packing', qty: 1, unitPrice: 80, total: 80 },
            { description: 'Raridda Qasnadda Birta Culus (250kg Safe)', category: 'heavy', qty: 1, unitPrice: 60, total: 60 },
          ],
          subtotal: '580.00',
          discount: '0.00',
          total: '580.00',
          status: 'Accepted',
        },
      ]).returning();

      const insertedInvoices = await db.insert(invoices).values([
        {
          invoiceNumber: 'SR-INV-2026-0001',
          bookingId: insertedBookings[0].id,
          quoteId: insertedQuotes[0]?.id,
          customerName: 'Aamina Maxamed Cali',
          customerPhone: '+252 61 511 2233',
          subtotal: '330.00',
          discount: '10.00',
          total: '320.00',
          amountPaid: '320.00',
          balanceDue: '0.00',
          status: 'Paid',
          dueDate: '2026-10-08',
        },
        {
          invoiceNumber: 'SR-INV-2026-0002',
          bookingId: insertedBookings[1].id,
          quoteId: insertedQuotes[1]?.id,
          customerName: 'Horumar Tech Solutions',
          customerPhone: '+252 61 599 8877',
          subtotal: '580.00',
          discount: '0.00',
          total: '580.00',
          amountPaid: '250.00',
          balanceDue: '330.00',
          status: 'Partial',
          dueDate: '2026-10-10',
        },
      ]).returning();

      if (insertedInvoices[0]) {
        await db.insert(invoiceItems).values([
          { invoiceId: insertedInvoices[0].id, description: 'Gaari Xiran 5-Ton (Hodan → Wadajir)', category: 'truck', quantity: 1, unitPrice: '120.00', total: '120.00' },
          { invoiceId: insertedInvoices[0].id, description: 'Kooxda Raridda (4 Xirfadle)', category: 'crew', quantity: 4, unitPrice: '25.00', total: '100.00' },
          { invoiceId: insertedInvoices[0].id, description: 'Kartoonno & Bacda Xumbada', category: 'packing', quantity: 1, unitPrice: '50.00', total: '50.00' },
          { invoiceId: insertedInvoices[0].id, description: 'Furfuridda & Xiridda Armaajooyinka', category: 'assembly', quantity: 1, unitPrice: '60.00', total: '60.00' },
        ]);
      }

      await db.insert(payments).values([
        {
          receiptNumber: 'SR-RCP-2026-0001',
          invoiceId: insertedInvoices[0]?.id,
          bookingId: insertedBookings[0].id,
          customerName: 'Aamina Maxamed Cali',
          amount: '100.00',
          paymentMethod: 'EVC Plus',
          paymentType: 'Deposit',
          referenceCode: 'EVC-8849201',
          notes: 'Carbuun (Deposit) la bixiyay markii ballanta la qabsaday',
        },
        {
          receiptNumber: 'SR-RCP-2026-0002',
          invoiceId: insertedInvoices[0]?.id,
          bookingId: insertedBookings[0].id,
          customerName: 'Aamina Maxamed Cali',
          amount: '220.00',
          paymentMethod: 'EVC Plus',
          paymentType: 'Balance',
          referenceCode: 'EVC-8859104',
          notes: 'Haraaga oo la dhammaystiray markii alaabta la dejiyay',
        },
        {
          receiptNumber: 'SR-RCP-2026-0003',
          invoiceId: insertedInvoices[1]?.id,
          bookingId: insertedBookings[1].id,
          customerName: 'Horumar Tech Solutions',
          amount: '250.00',
          paymentMethod: 'Bank Transfer',
          paymentType: 'Deposit',
          referenceCode: 'PREMIER-BT-9921',
          notes: '50% corporate deposit received',
        },
      ]);
    }

    // 11. Seed Expenses
    await db.insert(expenses).values([
      {
        category: 'Fuel',
        description: 'Shidaalka 2-da Gaari ee Isuzu (65 Liters Diesel)',
        amount: '78.00',
        expenseDate: '2026-10-07',
        recordedBy: 'Admin',
      },
      {
        category: 'Materials',
        description: '100 Kartoon oo adag, 10 Rool oo Bubble Wrap ah & 24 Sharooto',
        amount: '165.00',
        expenseDate: '2026-10-05',
        recordedBy: 'Admin',
      },
      {
        category: 'Salaries',
        description: 'Mushaharka Maalinlaha ee Kooxda Shaqada (SR-2026-0001)',
        amount: '112.00',
        expenseDate: '2026-10-08',
        recordedBy: 'Admin',
      },
      {
        category: 'Maintenance',
        description: 'Badelidda Saliidda & Fiiltarka Isuzu MOG-B-7719',
        amount: '85.00',
        expenseDate: '2026-10-03',
        recordedBy: 'Admin',
      },
      {
        category: 'Office',
        description: 'Internet-ka Xafiiska (Hormuud Fiber) & Biyaha',
        amount: '60.00',
        expenseDate: '2026-10-01',
        recordedBy: 'Admin',
      },
    ]);

    // 12. Seed Settings
    await db.insert(settings).values([
      { key: 'company_name', value: 'SOORAR' },
      { key: 'tagline_so', value: 'Rarid xirfad leh, Muqdisho oo dhan.' },
      { key: 'tagline_en', value: 'Professional moving across all of Mogadishu.' },
      { key: 'hero_headline_so', value: 'Guri cusub? Annaga noo daa!' },
      { key: 'hero_headline_en', value: 'Moving to a new home? Leave it to us!' },
      { key: 'secondary_tagline_so', value: 'Gurigaaga, gacmo ammaan ah.' },
      { key: 'secondary_tagline_en', value: 'Your home, in safe hands.' },
      { key: 'whatsapp_phone', value: '+252 770 505 028' },
      { key: 'whatsapp_link', value: '252770505028' },
      { key: 'office_address', value: 'Jidka Maka Al-Mukarama, Agagaarka KM4, Degmada Hodan, Muqdisho, Soomaaliya' },
      { key: 'office_email', value: 'info@soorar.so' },
      { key: 'domain', value: 'soorar.so' },
      { key: 'working_hours_so', value: 'Sabti ilaa Khamiis, 7:00 subaxnimo – 18:00 fiidnimo' },
      { key: 'working_hours_en', value: 'Saturday to Thursday, 7:00 AM to 18:00 PM' },
      { key: 'years_experience', value: '8+' },
      { key: 'moves_completed', value: '2,450+' },
      { key: 'insured_handling', value: '100%' },
      { key: 'invoice_prefix', value: 'SR-2026-' },
      { key: 'tpl_quote_so', value: 'Mahadsanid. Qiimaha rarkaagu waa $__, waxaa ku jira gaariga, shaqaalaha iyo duubista.' },
      { key: 'tpl_quote_en', value: 'Thank you. Your moving quote is $__, which includes the truck, professional crew, and protective wrapping.' },
      { key: 'tpl_confirm_so', value: 'Ballantaada waa la xaqiijiyay: __, saacadda __. Kooxdu waxay ku soo wacaysaa 30 daqiiqo ka hor.' },
      { key: 'tpl_confirm_en', value: 'Your booking is confirmed for __ at __. Our crew supervisor will call you 30 minutes before arrival.' },
      { key: 'tpl_thanks_so', value: 'Guri cusub oo barakaysan! Fadlan noo qor faallo gaaban.' },
      { key: 'tpl_thanks_en', value: 'Blessed new home! Please take a moment to leave us a short review.' },
      { key: 'whatsapp_cloud_api_enabled', value: 'false' },
      { key: 'whatsapp_cloud_phone_id', value: '' },
    ]);

    // 13. Seed Activity Log
    await db.insert(activityLog).values([
      {
        actorEmail: 'samiiryare23@gmail.com',
        actorRole: 'Admin',
        action: 'SYSTEM_SEEDED',
        entityType: 'System',
        entityId: 'INIT',
        details: 'Initial SOORAR database seeded with Mogadishu services, fleet, staff, and sample bookings.',
      },
    ]);
  } catch (error) {
    console.error('Error seeding SOORAR database:', error);
  }
}
