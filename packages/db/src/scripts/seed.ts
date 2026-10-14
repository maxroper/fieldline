/**
 * Demo seed: Harbor Coast Mechanical, a Costa Mesa commercial HVAC company, plus an empty second company
 * to show the tenant boundary. Dates are relative to today so the dispatch board is always populated.
 * Idempotent: running it on a seeded database does nothing.
 */
import { companyDay, newId, newToken, type CompanySettings } from "@fieldline/shared";
import { sql } from "drizzle-orm";
import { withBypass, type Db, type Tx } from "../core";
import * as s from "../schema";

const TZ = "America/Los_Angeles";

function dayOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return companyDay(d, TZ);
}

/** ISO instant for a local Pacific time on a given day. The seed assumes daylight time (UTC-7); off by an hour in winter, which is fine for demo data. */
function at(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00-07:00`).toISOString();
}

const settings: CompanySettings = {
  costRates: [
    { name: "Journeyman", rate: 64 },
    { name: "Apprentice", rate: 34 },
    { name: "Driver", rate: 30 },
  ],
  nonContractRates: [
    { name: "Journeyman", rate: 195 },
    { name: "Apprentice", rate: 120 },
    { name: "Driver", rate: 90 },
  ],
  contractRates: [
    { name: "Journeyman", rate: 185 },
    { name: "Apprentice", rate: 110 },
    { name: "Driver", rate: 85 },
  ],
  nonContractMargin: [
    { upTo: 25, divisor: 0.5 },
    { upTo: 100, divisor: 0.6 },
    { upTo: 500, divisor: 0.7 },
    { upTo: null, divisor: 0.8 },
  ],
  contractMargin: [
    { upTo: 100, divisor: 0.65 },
    { upTo: null, divisor: 0.8 },
  ],
  miscPercent: 1,
  vehicleAmount: 125,
  vehicleHours: 8,
  defaultQuoteMargin: 40,
  salesTaxPercent: 7.75,
  billTravelSeparately: true,
  documents: {
    from: "Harbor Coast Mechanical · 1740 Monrovia Ave, Costa Mesa, CA 92627 · 714-555-0100 · CSLB C-20 1087432",
    terms: "This quote is good for 30 days. The price covers the work described on the quote. Extra work is quoted before it starts. Work begins after this page is signed and returned. Payment is due on completion unless the account already has terms.",
    signatureBlock: "Signature ______________________________\n\nPrinted name ___________________________\n\nDate ___________________________________",
  },
  compliance: { refrigerantLogRequiredOverLbs: 15, permitTrackingJobTypes: ["quoted"], warrantyReminderDays: 60 },
};

export async function seed(db: Db): Promise<void> {
  const existing = await withBypass(db, (tx) => tx.select({ id: s.orgs.id }).from(s.orgs).limit(1));
  if (existing.length) {
    console.log("seed: database already has data, nothing to do");
    return;
  }
  await withBypass(db, async (tx) => {
    await seedHarborCoast(tx);
    await tx.insert(s.orgs).values({ id: newId(), name: "Second company (empty)", city: "Irvine" });
  });
  console.log("seed: Harbor Coast Mechanical seeded");
}

async function seedHarborCoast(tx: Tx) {
  const today = dayOffset(0);
  const d = (n: number) => dayOffset(n);
  const orgId = newId();
  await tx.insert(s.orgs).values({
    id: orgId,
    name: "Harbor Coast Mechanical",
    city: "Costa Mesa",
    phone: "714-555-0100",
    email: "office@harborcoastmech.example",
    address: "1740 Monrovia Ave, Costa Mesa, CA 92627",
    license: "C-20 · 1087432",
    settings,
  });

  // Teams and people
  const costaMesa = newId();
  const irvine = newId();
  await tx.insert(s.teams).values([
    { id: costaMesa, orgId, name: "Costa Mesa", isHome: true },
    { id: irvine, orgId, name: "Irvine" },
  ]);
  const u = {
    admin: newId(), supervisor: newId(), james: newId(), service: newId(), billing: newId(),
    marcus: newId(), elena: newId(), andre: newId(), priya: newId(), diego: newId(), hannah: newId(), luis: newId(), naomi: newId(),
  };
  await tx.insert(s.users).values([
    { id: u.admin, orgId, name: "Max Roper", email: "admin@harborcoast.example", role: "admin", title: "Owner", homeTeamId: costaMesa },
    { id: u.supervisor, orgId, name: "Supervisor", email: "supervisor@harborcoast.example", role: "supervisor", title: "Service manager", homeTeamId: costaMesa },
    { id: u.james, orgId, name: "James Reynolds", email: "james@harborcoast.example", role: "dispatcher", title: "Dispatcher", homeTeamId: costaMesa, phone: "714-555-0101" },
    { id: u.service, orgId, name: "Customer service", email: "service@harborcoast.example", role: "customer_service", title: "CSR", homeTeamId: irvine },
    { id: u.billing, orgId, name: "Billing", email: "billing@harborcoast.example", role: "billing", title: "Billing", homeTeamId: costaMesa },
    { id: u.marcus, orgId, name: "Marcus Hale", email: "marcus@harborcoast.example", role: "tech", title: "Lead · journeyman", teamId: costaMesa, phone: "714-555-0111" },
    { id: u.elena, orgId, name: "Elena Cruz", email: "elena@harborcoast.example", role: "tech", title: "Journeyman", teamId: costaMesa, phone: "714-555-0112" },
    { id: u.andre, orgId, name: "Andre Walsh", email: "andre@harborcoast.example", role: "tech", title: "Journeyman", teamId: costaMesa, phone: "714-555-0113" },
    { id: u.priya, orgId, name: "Priya Shah", email: "priya@harborcoast.example", role: "tech", title: "Journeyman", teamId: costaMesa, phone: "714-555-0114" },
    { id: u.diego, orgId, name: "Diego Ramos", email: "diego@harborcoast.example", role: "tech", title: "Apprentice", teamId: irvine, phone: "949-555-0115" },
    { id: u.hannah, orgId, name: "Hannah Cho", email: "hannah@harborcoast.example", role: "tech", title: "Journeyman", teamId: irvine, phone: "949-555-0116" },
    { id: u.luis, orgId, name: "Luis Ortega", email: "luis@harborcoast.example", role: "tech", title: "Lead · journeyman", teamId: irvine, phone: "949-555-0117" },
    { id: u.naomi, orgId, name: "Naomi Brooks", email: "naomi@harborcoast.example", role: "tech", title: "Apprentice", teamId: irvine, phone: "949-555-0118" },
  ]);
  await tx.insert(s.userOffDays).values([{ id: newId(), orgId, userId: u.luis, date: d(2), note: "PTO" }]);

  // Customers, sites, equipment
  type SiteSeed = { customer: string; site: string; address: string; city: string; contact: string; phone: string; contract?: boolean; lat: number; lng: number; access?: string; primary?: string; backup?: string; ap?: string };
  const siteSeeds: SiteSeed[] = [
    { customer: "Barranca Medical Partners", site: "Irvine Med Offices · Suite 200", address: "4600 Barranca Pkwy, Irvine, CA 92604", city: "Irvine", contact: "Dr. Lena Park", phone: "949-555-0142", contract: true, lat: 33.6855, lng: -117.8208, access: "Check in at reception. No work in exam rooms during patient hours (8–5). Roof access through Suite 230 corridor; ladder key at reception.", primary: "marcus", backup: "elena", ap: "Rosa Delgado · 949-555-0171" },
    { customer: "Harbor & Main Kitchen", site: "Harbor & Main Kitchen", address: "1890 Harbor Blvd, Costa Mesa, CA 92627", city: "Costa Mesa", contact: "Tony Reyes", phone: "714-555-0188", lat: 33.6604, lng: -117.9173, access: "Back door off the alley; ask for Tony. Lunch rush 11:30–1:30, no roof work then.", primary: "andre" },
    { customer: "Newport Plaza Retail", site: "Newport Plaza Retail", address: "1200 Newport Center Dr, Newport Beach, CA 92660", city: "Newport Beach", contact: "Kim Alvarez", phone: "949-555-0133", contract: true, lat: 33.6165, lng: -117.8747, primary: "andre", backup: "priya" },
    { customer: "Bristol Court Offices", site: "Bristol Court Offices", address: "3151 Bristol St, Costa Mesa, CA 92626", city: "Costa Mesa", contact: "Dana Whitfield", phone: "714-555-0150", contract: true, lat: 33.6853, lng: -117.8862, access: "Roof hatch key with the building engineer, 2nd floor.", primary: "andre", backup: "marcus" },
    { customer: "Warner Business Park", site: "Warner Business Park · Bldg 3", address: "2501 W Warner Ave, Bldg 3, Santa Ana, CA 92704", city: "Santa Ana", contact: "Yolanda Ruiz", phone: "714-555-0163", contract: true, lat: 33.7156, lng: -117.9107, access: "Check in at the front desk first. Roof hatch key at the desk; gate code 4471#.", primary: "marcus", backup: "elena" },
    { customer: "Jamboree Corporate", site: "Jamboree Corporate", address: "2 Jamboree Rd, Irvine, CA 92602", city: "Irvine", contact: "Front desk", phone: "949-555-0120", lat: 33.7002, lng: -117.8311, primary: "marcus" },
    { customer: "Balboa Bay Offices", site: "Balboa Bay Offices · Tower 2", address: "1601 Bayside Dr, Newport Beach, CA 92625", city: "Newport Beach", contact: "Pat Nguyen", phone: "949-555-0177", lat: 33.6093, lng: -117.8862, primary: "elena" },
    { customer: "Oak Creek Professional", site: "Oak Creek Professional", address: "6400 Oak Canyon, Irvine, CA 92618", city: "Irvine", contact: "Sam Patel", phone: "949-555-0158", lat: 33.6666, lng: -117.7726, primary: "elena", backup: "hannah" },
    { customer: "Santa Ana Gym", site: "Santa Ana Gym", address: "2200 E 4th St, Santa Ana, CA 92705", city: "Santa Ana", contact: "Brooke Nguyen", phone: "714-555-0199", contract: true, lat: 33.7465, lng: -117.8412, primary: "priya" },
    { customer: "Irvine Center Clinics", site: "Irvine Center Clinics", address: "18 Technology Dr, Irvine, CA 92618", city: "Irvine", contact: "Dr. Omar Haddad", phone: "949-555-0126", contract: true, lat: 33.6534, lng: -117.7523, access: "Server room on the 2nd floor; badge from the office manager.", primary: "priya", backup: "hannah" },
    { customer: "Tustin Auto Center", site: "Tustin Auto Center · Service bays", address: "28 Auto Center Dr, Tustin, CA 92782", city: "Tustin", contact: "Gabe Ortiz", phone: "714-555-0144", lat: 33.7286, lng: -117.7948, primary: "priya" },
    { customer: "Costa Mesa Library", site: "Costa Mesa Library", address: "1855 Park Ave, Costa Mesa, CA 92627", city: "Costa Mesa", contact: "Facilities", phone: "714-555-0190", lat: 33.6519, lng: -117.9142, primary: "priya" },
    { customer: "17th Street Market", site: "17th Street Market", address: "1800 E 17th St, Santa Ana, CA 92705", city: "Santa Ana", contact: "Chris Dalton", phone: "714-555-0136", lat: 33.7542, lng: -117.8518, primary: "elena" },
    { customer: "Adams Avenue Plaza", site: "Adams Avenue Plaza", address: "3033 Adams Ave, Costa Mesa, CA 92626", city: "Costa Mesa", contact: "R. Castillo", phone: "714-555-0128", contract: true, lat: 33.6726, lng: -117.9031, primary: "marcus" },
    { customer: "Newport Coast HOA", site: "Newport Coast HOA · Bldg C", address: "100 Newport Coast Dr, Newport Coast, CA 92657", city: "Newport Coast", contact: "HOA manager", phone: "949-555-0109", lat: 33.5963, lng: -117.8306, primary: "elena" },
    { customer: "Huntington Harbour Dental", site: "Huntington Harbour Dental", address: "16889 Algonquin St, Huntington Beach, CA 92649", city: "Huntington Beach", contact: "Dr. Mia Chen", phone: "562-555-0147", lat: 33.7214, lng: -118.0596 },
  ];
  const techByKey: Record<string, string> = { marcus: u.marcus, elena: u.elena, andre: u.andre, priya: u.priya, diego: u.diego, hannah: u.hannah, luis: u.luis, naomi: u.naomi };
  const customerIds: Record<string, string> = {};
  const siteIds: Record<string, string> = {};
  for (const seedRow of siteSeeds) {
    let customerId = customerIds[seedRow.customer];
    if (!customerId) {
      customerId = newId();
      customerIds[seedRow.customer] = customerId;
      const [apName, apPhone] = (seedRow.ap ?? ` · `).split(" · ");
      await tx.insert(s.customers).values({
        id: customerId,
        orgId,
        name: seedRow.customer,
        phone: seedRow.phone,
        email: `ap@${seedRow.customer.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
        billingAddress: seedRow.address,
        apContactName: apName?.trim() ?? "",
        apContactPhone: apPhone?.trim() ?? "",
        contract: Boolean(seedRow.contract),
        creditLimit: seedRow.contract ? 15000 : 5000,
        accountManagerId: u.james,
        invoiceDelivery: "email",
        invoiceEmails: [`ap@${seedRow.customer.toLowerCase().replace(/[^a-z]+/g, "")}.example`],
        portalEnabled: seedRow.customer === "Barranca Medical Partners",
        portalToken: seedRow.customer === "Barranca Medical Partners" ? "barranca" : null,
        cardOnFile: seedRow.customer === "Barranca Medical Partners" ? { brand: "Visa", last4: "4242", providerId: "pm_demo" } : null,
      });
    }
    const siteId = newId();
    siteIds[seedRow.site] = siteId;
    await tx.insert(s.sites).values({
      id: siteId,
      orgId,
      customerId,
      name: seedRow.site,
      address: seedRow.address,
      city: seedRow.city,
      contact: seedRow.contact,
      contactPhone: seedRow.phone,
      accessNotes: seedRow.access ?? "",
      primaryTechId: seedRow.primary ? techByKey[seedRow.primary] : null,
      backupTechId: seedRow.backup ? techByKey[seedRow.backup] : null,
      lat: seedRow.lat,
      lng: seedRow.lng,
    });
  }
  // A second site for the medical customer
  const irvineMed100 = newId();
  siteIds["Irvine Med Offices · Suite 100"] = irvineMed100;
  await tx.insert(s.sites).values({ id: irvineMed100, orgId, customerId: customerIds["Barranca Medical Partners"]!, name: "Irvine Med Offices · Suite 100", address: "4600 Barranca Pkwy, Suite 100, Irvine, CA 92604", city: "Irvine", contact: "Dr. Lena Park", contactPhone: "949-555-0142", primaryTechId: u.marcus, lat: 33.6855, lng: -117.8208 });

  const site = (name: string) => siteIds[name]!;
  const customerOf = (name: string) => customerIds[name]!;

  const eq: Record<string, string> = {};
  const addUnit = async (key: string, siteName: string, row: Partial<typeof s.equipment.$inferInsert> & { tag: string }) => {
    const id = newId();
    eq[key] = id;
    await tx.insert(s.equipment).values({ id, orgId, siteId: site(siteName), kind: "Rooftop package unit", refrigerant: "R-410A", source: "manual", stage: "active", qrCode: `HC-${row.tag.replace(/\s+/g, "")}-${key.slice(0, 4)}`, ...row });
  };
  await addUnit("rtu1", "Irvine Med Offices · Suite 200", { tag: "RTU-1", make: "Carrier", model: "48TC", serial: "4818A4051", tons: 7.5, chargeLbs: 18.5, installYear: 2023, warrantyPartsUntil: `${new Date().getFullYear() + 7}-03-01`, locationNote: "Roof, NE corner" });
  await addUnit("rtu2", "Irvine Med Offices · Suite 200", { tag: "RTU-2", make: "Carrier", model: "48TC", serial: "4818A4052", tons: 7.5, chargeLbs: 18.5, installYear: 2023, warrantyPartsUntil: `${new Date().getFullYear() + 7}-03-01`, locationNote: "Roof, over suite 200" });
  await addUnit("rtu3", "Irvine Med Offices · Suite 200", { tag: "RTU-3", make: "Trane", model: "YSC120", serial: "21241N8FJ", tons: 10, chargeLbs: 24, installYear: 2016, locationNote: "Roof, center" });
  await addUnit("rtu4", "Irvine Med Offices · Suite 100", { tag: "RTU-4", make: "Carrier", model: "48HC", serial: "4817B1190", tons: 10, chargeLbs: 22, installYear: 2019, locationNote: "Roof, SW corner" });
  await addUnit("mau1", "Harbor & Main Kitchen", { tag: "MAU-1", kind: "Make-up air unit", make: "Captive-Aire", model: "A2-D.250", serial: "CA19-77231", tons: null, chargeLbs: null, refrigerant: "", installYear: 2019, locationNote: "Roof over the kitchen line" });
  await addUnit("np3", "Newport Plaza Retail", { tag: "RTU-3", make: "Lennox", model: "LGH120", serial: "5617L02771", tons: 10, chargeLbs: 21, installYear: 2017 });
  for (let i = 1; i <= 4; i++) await addUnit(`bc${i}`, "Bristol Court Offices", { tag: `RTU-${i}`, make: "Carrier", model: "48HC", serial: `4820C19${40 + i}`, tons: 10, chargeLbs: 22, installYear: 2020 });
  for (let i = 1; i <= 4; i++) await addUnit(`wb${i}`, "Warner Business Park · Bldg 3", { tag: `RTU-${i}`, make: "Carrier", model: "48HC", serial: `4819W33${10 + i}`, tons: 10, chargeLbs: 22, installYear: i === 1 ? 2024 : 2019, warrantyPartsUntil: i === 1 ? `${new Date().getFullYear() + 8}-01-01` : null });
  await addUnit("gym1", "Santa Ana Gym", { tag: "RTU-1", make: "Trane", model: "TSC150", serial: "19181G44A", tons: 12.5, chargeLbs: 30, installYear: 2018 });
  await addUnit("clinic1", "Irvine Center Clinics", { tag: "CRAC-1", kind: "Server room unit", make: "Liebert", model: "PDX", serial: "L2021-0431", tons: 3, chargeLbs: 9, installYear: 2021 });
  await addUnit("tustin1", "Tustin Auto Center · Service bays", { tag: "RTU-2", make: "Daikin", model: "DPS120", serial: "D1709-9921", tons: 10, chargeLbs: 20, installYear: 2017 });

  // Agreements
  const agreementIds: Record<string, string> = {};
  const addAgreement = async (key: string, customer: string, siteName: string, tier: "gold" | "silver" | "bronze", amount: number, units: string[], responseHours: number, billing: (typeof s.agreements.$inferInsert)["billingMethod"]) => {
    const id = newId();
    agreementIds[key] = id;
    await tx.insert(s.agreements).values({ id, orgId, customerId: customerOf(customer), siteId: site(siteName), tier, name: `${tier[0]!.toUpperCase()}${tier.slice(1)} agreement`, status: "active", startsOn: `${new Date().getFullYear()}-03-01`, endsOn: `${new Date().getFullYear() + 1}-02-28`, autoRenew: true, billingMethod: billing, amount, visitAmount: Math.round(amount / 2), visitsPerYear: 2, responseHours, includedServices: ["Spring and fall tune-up", "Filters each visit", "Priority scheduling", tier === "gold" ? "No overtime rates" : "10% off repairs"] });
    if (units.length) await tx.insert(s.agreementAssets).values(units.map((k) => ({ id: newId(), orgId, agreementId: id, equipmentId: eq[k]! })));
    await tx.insert(s.agreementVisits).values([
      { id: newId(), orgId, agreementId: id, season: "spring", dueOn: `${new Date().getFullYear()}-04-15`, status: "done" },
      { id: newId(), orgId, agreementId: id, season: "fall", dueOn: `${new Date().getFullYear()}-10-15`, status: key === "bristol" || key === "warner" ? "scheduled" : "unscheduled" },
    ]);
  };
  await addAgreement("bristol", "Bristol Court Offices", "Bristol Court Offices", "gold", 7680, ["bc1", "bc2", "bc3", "bc4"], 4, "monthly_card");
  await addAgreement("irvineMed", "Barranca Medical Partners", "Irvine Med Offices · Suite 200", "gold", 7680, ["rtu1", "rtu2", "rtu3"], 4, "monthly_card");
  await addAgreement("warner", "Warner Business Park", "Warner Business Park · Bldg 3", "silver", 5200, ["wb1", "wb2", "wb3", "wb4"], 8, "annual_invoice");
  await addAgreement("gym", "Santa Ana Gym", "Santa Ana Gym", "silver", 1900, ["gym1"], 8, "annual_invoice");
  await addAgreement("clinics", "Irvine Center Clinics", "Irvine Center Clinics", "gold", 2400, ["clinic1"], 4, "pre_billed");
  await addAgreement("plaza", "Adams Avenue Plaza", "Adams Avenue Plaza", "bronze", 1500, [], 24, "on_demand");

  // Work orders. Numbers and the day's shape match the review mockup.
  const wo: Record<number, string> = {};
  type Wo = { n: number; site: string; title: string; desc?: string; type?: "service" | "maintenance" | "quoted"; billing?: "tm" | "nte" | "quoted"; pri?: "urgent" | "normal" | "low"; tech?: string; day?: number; start?: number; hours?: number; status?: "open" | "closed" | "billed"; techStatus?: "en_route" | "on_site" | "paused" | "done"; eq?: string; nte?: number; quoted?: number; warranty?: boolean; parts?: boolean; ret?: boolean; note?: string; caller?: string; callerPhone?: string; agreement?: string; followUp?: s.FollowUp };
  const list: Wo[] = [
    // today
    { n: 1049, site: "Adams Avenue Plaza", title: "Quarterly PM", type: "maintenance", tech: "marcus", day: 0, start: 450, hours: 2, status: "closed", techStatus: "done", agreement: "plaza" },
    { n: 1052, site: "17th Street Market", title: "Walk-in cooler compressor", desc: "Walk-in cooler at 48°F. Compressor short cycling.", billing: "nte", nte: 2400, tech: "elena", day: 0, start: 450, hours: 3, status: "closed", techStatus: "done" },
    { n: 1058, site: "Irvine Med Offices · Suite 200", title: "Warranty coil leak, suite 200", desc: "Customer reports water on the ceiling tile under RTU-2. Unit still cooling.", tech: "marcus", day: 0, start: 600, hours: 2, techStatus: "on_site", eq: "rtu2", warranty: true, note: "Check in at the front desk, suite 200. Roof hatch key at the security desk. Dr. Park wants photos of the coil before and after. Bill labor T&M at the Gold rate; parts go on the Carrier warranty claim.", caller: "Dr. Lena Park", callerPhone: "949-555-0142", agreement: "irvineMed" },
    { n: 1061, site: "Jamboree Corporate", title: "Thermostat swap, suite 310", tech: "marcus", day: 0, start: 780, hours: 2 },
    { n: 1059, site: "Balboa Bay Offices · Tower 2", title: "RTU-2 no cooling", desc: "No cooling on the 4th floor since this morning.", pri: "urgent", tech: "elena", day: 0, start: 660, hours: 2, techStatus: "en_route" },
    { n: 1067, site: "Oak Creek Professional", title: "Condensate drain backing up", tech: "elena", day: 0, start: 840, hours: 2 },
    { n: 1050, site: "Bristol Court Offices", title: "Fall PM, 4 RTUs", type: "maintenance", tech: "andre", day: 0, start: 480, hours: 4, techStatus: "on_site", agreement: "bristol" },
    { n: 1063, site: "Newport Plaza Retail", title: "RTU-3 low charge, need return", desc: "RTU-3 low on charge; leak suspected at the condenser coil.", tech: "andre", day: 0, start: 780, hours: 1, parts: true, eq: "np3", followUp: { reason: "parts", date: d(1), note: "Johnstone PO 118 · coil due tomorrow", part: "Condenser coil", expectedDate: d(1) } },
    { n: 1068, site: "Warner Business Park · Bldg 3", title: "Compressor amp draw high", tech: "andre", day: 0, start: 870, hours: 2.5, eq: "wb2" },
    { n: 1047, site: "Santa Ana Gym", title: "Belt and bearings", type: "maintenance", tech: "priya", day: 0, start: 420, hours: 2, status: "closed", techStatus: "done", eq: "gym1" },
    { n: 1057, site: "Irvine Center Clinics", title: "Server room no cooling", desc: "CRAC unit tripping; server room at 84°F.", pri: "urgent", tech: "priya", day: 0, start: 570, hours: 2, techStatus: "on_site", eq: "clinic1", agreement: "clinics" },
    { n: 1062, site: "Tustin Auto Center · Service bays", title: "Replace condenser fan motor", type: "quoted", billing: "quoted", quoted: 1840, tech: "priya", day: 0, start: 750, hours: 2, eq: "tustin1" },
    { n: 1065, site: "Costa Mesa Library", title: "Economizer stuck open", tech: "priya", day: 0, start: 900, hours: 1.5 },
    // open queue (unassigned)
    { n: 1055, site: "Harbor & Main Kitchen", title: "Kitchen too hot, dining room 84°", desc: "Make-up air unit tripping on high limit. Dining room reads 84° on a lunch service day.", pri: "urgent", eq: "mau1", caller: "Tony Reyes", callerPhone: "714-555-0188" },
    { n: 1071, site: "Newport Coast HOA · Bldg C", title: "Replace condenser fan motor, bldg C", type: "quoted", billing: "quoted", quoted: 1840, followUp: { reason: "approved", date: null, note: "Quote approved; waiting for a date from the HOA", part: "", expectedDate: null } },
    { n: 1064, site: "Irvine Med Offices · Suite 100", title: "Economizer actuator on RTU-4", eq: "rtu4", parts: true, followUp: { reason: "parts", date: d(1), note: "Johnstone PO 118 · expected tomorrow", part: "Economizer actuator", expectedDate: d(1) } },
    { n: 1066, site: "Santa Ana Gym", title: "Fall PM, 6 RTUs", type: "maintenance", hours: 4, agreement: "gym" },
    { n: 1069, site: "Huntington Harbour Dental", title: "Thermostat keeps resetting", pri: "low" },
    // tomorrow and later this week
    { n: 1135, site: "Warner Business Park · Bldg 3", title: "Fall PM, 4 RTUs", type: "maintenance", tech: "marcus", day: 1, start: 420, hours: 4, agreement: "warner", note: "Yolanda wants the belt on RTU-3 looked at; it squealed Monday. Park behind Bldg 3, roof hatch key at the front desk." },
    { n: 1137, site: "Tustin Auto Center · Service bays", title: "Quoted: condenser fan motor install", type: "quoted", billing: "quoted", quoted: 1840, tech: "andre", day: 1, start: 480, hours: 5 },
    { n: 1138, site: "Oak Creek Professional", title: "Quarterly filter change", type: "maintenance", tech: "priya", day: 1, start: 480, hours: 3 },
    { n: 1140, site: "Costa Mesa Library", title: "Chiller pump seal", tech: "marcus", day: 2, start: 480, hours: 6 },
    { n: 1141, site: "17th Street Market", title: "Case lighting ballast", tech: "elena", day: 2, start: 480, hours: 4 },
    { n: 1142, site: "Costa Mesa Library", title: "Chiller pump, day 2", tech: "andre", day: 2, start: 480, hours: 10 },
    // earlier this week and last week (closed, some billed)
    { n: 1040, site: "Irvine Med Offices · Suite 200", title: "RTU-1 blower motor and VFD", desc: "Blower motor seized; VFD fault F-12.", tech: "marcus", day: -6, start: 480, hours: 6, status: "billed", techStatus: "done", eq: "rtu1" },
    { n: 1041, site: "Harbor & Main Kitchen", title: "Fall PM", type: "maintenance", tech: "andre", day: -5, start: 480, hours: 2, status: "billed", techStatus: "done" },
    { n: 1127, site: "Balboa Bay Offices · Tower 2", title: "RTU-1 contactor", tech: "marcus", day: -1, start: 450, hours: 6, status: "closed", techStatus: "done" },
    { n: 1126, site: "Santa Ana Gym", title: "Spring PM follow-up", type: "maintenance", tech: "priya", day: -1, start: 420, hours: 4, status: "closed", techStatus: "done" },
    { n: 1125, site: "Jamboree Corporate", title: "Suite 400 zone damper", tech: "andre", day: -1, start: 480, hours: 8, status: "closed", techStatus: "done" },
    { n: 1124, site: "Jamboree Corporate", title: "Lobby thermostat", tech: "elena", day: -1, start: 480, hours: 3, status: "closed", techStatus: "done" },
    { n: 1053, site: "Santa Ana Gym", title: "Locker room exhaust fan", tech: "andre", day: -2, start: 600, hours: 2, status: "open", techStatus: "done", ret: true, followUp: { reason: "return", date: d(1), note: "Need a 1/2 hp motor; return Thursday", part: "Exhaust fan motor", expectedDate: d(1) } },
  ];
  const techStatusAtFor = (status?: string) => (status === "on_site" ? at(today, "10:02") : status === "en_route" ? at(today, "10:31") : status === "done" ? at(today, "09:30") : null);
  for (const w of list) {
    const id = newId();
    wo[w.n] = id;
    const sid = site(w.site);
    const siteRow = siteSeeds.find((x) => x.site === w.site);
    const customerName = siteRow?.customer ?? "Barranca Medical Partners";
    await tx.insert(s.workOrders).values({
      id,
      orgId,
      number: w.n,
      trip: 1,
      customerId: customerOf(customerName),
      siteId: sid,
      equipmentId: w.eq ? eq[w.eq] ?? null : null,
      title: w.title,
      description: w.desc ?? "",
      callType: w.type ?? "service",
      billingType: w.billing ?? (w.type === "quoted" ? "quoted" : "tm"),
      nteAmount: w.nte ?? null,
      quotedAmount: w.quoted ?? null,
      priority: w.pri ?? "normal",
      status: w.status ?? "open",
      techStatus: w.techStatus ?? null,
      techStatusAt: techStatusAtFor(w.techStatus),
      assignedTechId: w.tech ? techByKey[w.tech] ?? null : null,
      scheduledFor: w.day === undefined ? null : d(w.day),
      startMinute: w.start ?? null,
      allocatedHours: w.hours ?? null,
      dispatchNote: w.note ?? "",
      needReturn: Boolean(w.ret),
      waitingOnParts: Boolean(w.parts),
      warranty: Boolean(w.warranty),
      callerName: w.caller ?? "",
      callerPhone: w.callerPhone ?? "",
      signatureRequired: w.type === "maintenance" || Boolean(w.quoted),
      followUp: w.followUp ?? null,
      agreementId: w.agreement ? agreementIds[w.agreement] ?? null : null,
      trackingToken: newToken(8),
      closedAt: w.status === "closed" || w.status === "billed" ? at(d(w.day ?? 0), "16:00") : null,
      createdBy: u.james,
      workPerformed: w.status === "closed" || w.status === "billed" ? "Completed as described. Unit tested and running." : "",
      createdAt: at(d(Math.min(w.day ?? 0, 0) - 1), "16:12"),
    });
  }
  // Attach scheduled agreement visits to their work orders
  for (const [key, number] of [["bristol", 1050], ["warner", 1135]] as const) {
    await tx.update(s.agreementVisits).set({ workOrderId: wo[number]!, status: "scheduled" }).where(sql`${s.agreementVisits.agreementId} = ${agreementIds[key]!} and ${s.agreementVisits.season} = 'fall'`);
  }

  // Notes and notifications
  await tx.insert(s.notes).values([
    { id: newId(), orgId, workOrderId: wo[1058]!, userId: u.service, kind: "note", body: "Dr. Park called again, water now dripping into exam room 3, patients moved. Added here instead of a duplicate WO.", createdAt: at(today, "10:12") },
    { id: newId(), orgId, workOrderId: wo[1058]!, userId: u.marcus, kind: "note", body: "On site. Coil is sweating at the header; looks like a braze joint. Photos taken.", createdAt: at(today, "10:20") },
    { id: newId(), orgId, workOrderId: wo[1055]!, userId: u.service, kind: "note", body: "Tony says the dining room hit 84° by 11:30 yesterday. Third call this month.", createdAt: at(d(-1), "11:40") },
  ]);
  await tx.insert(s.notifications).values([
    { id: newId(), orgId, userId: u.marcus, workOrderId: wo[1135]!, kind: "assignment", body: "1135 Warner Business Park added tomorrow 7:00 (Fall PM, 4 RTUs).", createdAt: at(today, "09:12") },
  ]);

  // Time entries: yesterday for the timesheets, today's running clocks
  const yesterday = d(-1);
  const te = async (tech: string, number: number | null, kind: "labor" | "travel" | "meal" | "rest", date: string, start: string, stop: string | null, extra: Partial<typeof s.timeEntries.$inferInsert> = {}) =>
    tx.insert(s.timeEntries).values({ id: newId(), orgId, techId: techByKey[tech]!, workOrderId: number ? wo[number] ?? null : null, kind, date, startedAt: at(date, start), stoppedAt: stop ? at(date, stop) : null, hours: 0, source: "clock", gpsVerified: true, ...extra });
  await te("marcus", 1127, "travel", yesterday, "07:08", "07:36");
  await te("marcus", 1127, "labor", yesterday, "07:36", "12:04");
  await te("marcus", null, "rest", yesterday, "09:45", "09:55");
  await te("marcus", null, "meal", yesterday, "12:04", "12:34");
  await te("marcus", 1127, "labor", yesterday, "12:34", "14:25");
  await te("marcus", 1049, "travel", yesterday, "14:25", "14:46");
  await te("marcus", 1049, "labor", yesterday, "14:46", "16:33");
  await te("marcus", null, "travel", yesterday, "16:33", "16:53", { source: "manual", gpsVerified: false, edited: true, hours: 0.33 });
  await te("elena", 1124, "travel", yesterday, "07:30", "07:55");
  await te("elena", 1124, "labor", yesterday, "07:55", "11:00");
  await te("elena", null, "meal", yesterday, "11:00", "11:30");
  await te("elena", 1127, "labor", yesterday, "11:45", "15:40");
  await te("andre", 1125, "travel", yesterday, "07:15", "07:45");
  await te("andre", 1125, "labor", yesterday, "07:45", "12:30");
  await te("andre", null, "meal", yesterday, "12:30", "13:00");
  await te("andre", 1125, "labor", yesterday, "13:00", "16:45");
  await te("priya", 1126, "travel", yesterday, "06:40", "07:00");
  await te("priya", 1126, "labor", yesterday, "07:00", "11:10");
  await te("priya", null, "meal", yesterday, "12:40", "13:10");
  await te("priya", 1126, "labor", yesterday, "13:10", "15:30");
  // today
  await te("marcus", 1049, "travel", today, "07:08", "07:30");
  await te("marcus", 1049, "labor", today, "07:30", "09:28");
  await te("marcus", 1058, "labor", today, "09:31", null, { arrivedAt: at(today, "10:02") });
  await te("elena", 1052, "travel", today, "07:05", "07:30");
  await te("elena", 1052, "labor", today, "07:30", "10:25");
  await te("elena", 1059, "travel", today, "10:31", null);
  await te("andre", 1050, "travel", today, "07:35", "07:58");
  await te("andre", 1050, "labor", today, "07:58", null, { arrivedAt: at(today, "07:58") });
  await te("priya", 1047, "travel", today, "06:35", "06:58");
  await te("priya", 1047, "labor", today, "06:58", "09:05");
  await te("priya", 1057, "labor", today, "09:20", null, { arrivedAt: at(today, "09:41") });
  await tx.insert(s.timesheets).values([
    { id: newId(), orgId, techId: u.marcus, date: yesterday, status: "submitted", submittedAt: at(yesterday, "16:52") },
    { id: newId(), orgId, techId: u.elena, date: yesterday, status: "submitted", submittedAt: at(yesterday, "15:45") },
    { id: newId(), orgId, techId: u.andre, date: yesterday, status: "submitted", submittedAt: at(yesterday, "16:50") },
    { id: newId(), orgId, techId: u.priya, date: yesterday, status: "submitted", submittedAt: at(yesterday, "15:35"), missedMeal: true, mealReason: "customer_emergency" },
  ]);
  await tx.insert(s.techLocations).values([
    { id: newId(), orgId, techId: u.marcus, lat: 33.6855, lng: -117.8208, accuracyM: 12, recordedAt: at(today, "10:40") },
    { id: newId(), orgId, techId: u.elena, lat: 33.63, lng: -117.88, accuracyM: 20, recordedAt: at(today, "10:40") },
    { id: newId(), orgId, techId: u.andre, lat: 33.6853, lng: -117.8862, accuracyM: 10, recordedAt: at(today, "10:39") },
    { id: newId(), orgId, techId: u.priya, lat: 33.6534, lng: -117.7523, accuracyM: 15, recordedAt: at(today, "10:38") },
  ]);

  // Pricebook and scope templates
  const pb: Record<string, string> = {};
  const items: [string, string, string, string, number, number, number, number | null, number | null][] = [
    ["RP-101", "Replace condenser fan motor, 1/3 hp", "Repairs › Refrigeration", "Motor, capacitor, test run. Parts and labor warranty 1 year.", 240, 2, 684, 812, 1160],
    ["RP-102", "Replace blower motor and belt", "Repairs › Airflow", "Motor, belt, pulley alignment.", 310, 2.5, 890, 1040, 1420],
    ["RP-110", "Find and repair refrigerant leak, recharge R-410A up to 5 lb", "Repairs › Refrigeration", "Electronic leak search, braze repair, evacuation, recharge.", 160, 3, 920, 1240, 1890],
    ["RP-120", "Replace expansion valve (TXV), 5 ton", "Repairs › Refrigeration", "TXV, filter drier, recover and recharge.", 285, 3.5, 1180, 1420, 2260],
    ["RP-121", "Replace scroll compressor, 5 ton R-410A", "Repairs › Refrigeration", "Compressor, contactor, drier, recover, recharge, start-up.", 1850, 6, 4380, 4980, 5900],
    ["RP-130", "Replace contactor and capacitor", "Repairs › Electrical", "Contactor, dual-run capacitor, amp check.", 68, 1, 296, 348, null],
    ["RP-140", "Replace economizer actuator", "Repairs › Controls", "Actuator, linkage, calibration.", 210, 2, 760, 910, null],
    ["RP-141", "Replace commercial thermostat", "Repairs › Controls", "Programmable thermostat, wiring, setup.", 145, 1.5, 480, 620, 880],
    ["RP-150", "Clear condensate drain and treat", "Repairs › Airflow", "Blow out drain, pan treatment, float switch check.", 25, 1, 210, 268, null],
    ["PM-201", "Rooftop unit tune-up, per unit", "Maintenance", "Filters, belts, coils rinse, refrigerant check, electrical, controls.", 40, 1.25, 190, 240, 320],
    ["IAQ-301", "MERV 13 filtration upgrade, per unit", "Materials", "Rack and filters.", 180, 1, 420, null, null],
    ["IAQ-302", "UV coil light", "Materials", "UV-C lamp at the evaporator coil.", 260, 1, 640, null, null],
    ["LB-401", "Journeyman labor, per hour", "Labor", "", 0, 1, 195, null, null],
    ["LB-402", "Apprentice labor, per hour", "Labor", "", 0, 1, 120, null, null],
  ];
  for (const [code, name, category, description, partsCost, laborHours, good, better, best] of items) {
    const id = newId();
    pb[code] = id;
    await tx.insert(s.pricebookItems).values({ id, orgId, code, name, category, description, partsCost, laborHours, priceGood: good, priceBetter: better, priceBest: best, marginPercent: 40, timesUsed: Math.floor(Math.random() * 20) });
  }
  const templateNames = ["Replace motor", "Replace compressor", "Replace condenser fan", "Replace blower", "Replace contactor", "Replace capacitor", "Replace filter drier", "Replace expansion valve", "Replace evaporator coil", "Replace condenser coil", "Repair refrigerant leak", "Recover and recharge", "Replace thermostat", "Replace economizer", "Replace gas valve", "Replace heat exchanger", "Replace belts and bearings", "PM deficiency", "Clean coils", "Repair condensate drain"];
  await tx.insert(s.scopeTemplates).values(templateNames.map((name, i) => ({ id: newId(), orgId, name, scope: `${name} on the unit named on this quote. Recover refrigerant where required, replace with new parts, test and verify operation, and leave the roof clean.`, laborHours: [4, 8, 3, 4, 1, 1, 2, 4, 8, 8, 4, 3, 1.5, 3, 3, 6, 2, 2, 2, 1][i] ?? 2 })));

  // Quotes
  const q = async (number: number, siteName: string, customer: string, title: string, status: (typeof s.quotes.$inferInsert)["status"], extra: Partial<typeof s.quotes.$inferInsert>, options: { tier: "good" | "better" | "best" | "single"; name: string; description: string; price: number; cost: number; recommended?: boolean; included: string[] }[], lines: { description: string; quantity: number; unitCost: number; code?: string }[]) => {
    const id = newId();
    await tx.insert(s.quotes).values({ id, orgId, number, customerId: customerOf(customer), siteId: site(siteName), scope: title, status, marginPercent: 40, approvalToken: newToken(8), createdBy: u.james, labor: { journeymanHours: 7.5, apprenticeHours: 7.5, driverHours: 0.8, journeymanRate: 64, apprenticeRate: 34, driverRate: 30 }, ...extra });
    let selected: string | null = null;
    for (const [i, o] of options.entries()) {
      const oid = newId();
      if (o.recommended) selected = oid;
      await tx.insert(s.quoteOptions).values({ id: oid, orgId, quoteId: id, tier: o.tier, name: o.name, description: o.description, price: o.price, cost: o.cost, financingMonthly: Math.round(o.price / 36), isRecommended: Boolean(o.recommended), included: o.included, sort: i });
    }
    if (selected) await tx.update(s.quotes).set({ selectedOptionId: selected }).where(sql`${s.quotes.id} = ${id}`);
    await tx.insert(s.quoteLines).values(lines.map((l, i) => ({ id: newId(), orgId, quoteId: id, kind: "material", description: l.description, quantity: l.quantity, unitCost: l.unitCost, pricebookItemId: l.code ? pb[l.code] ?? null : null, sort: i })));
    return id;
  };
  await q(2041, "Irvine Med Offices · Suite 100", "Barranca Medical Partners", "RTU-4 economizer and controls", "viewed", { equipmentId: eq["rtu4"]!, workOrderId: wo[1040]!, reason: "service", problemText: "RTU-4 over Suite 100 has a failed economizer actuator and ten-year-old controls.", sentAt: at(d(-6), "15:10"), viewedAt: at(d(-1), "16:12"), viewCount: 3, followUpDate: d(1), followUpKind: "quote_sent", contactName: "Dr. Lena Park", contactPhone: "949-555-0142" }, [
    { tier: "good", name: "Repair", description: "Replace the economizer actuator and linkage, recalibrate, 1-year parts and labor warranty.", price: 1640, cost: 980, included: ["Economizer actuator", "Linkage and calibration", "1-year warranty"] },
    { tier: "better", name: "Repair and air quality", description: "Everything in Good, plus MERV 13 filtration, a UV coil light and a controls tune-up. 2-year warranty.", price: 3420, cost: 2052, recommended: true, included: ["Everything in Good", "MERV 13 filtration", "UV coil light", "Controls tune-up", "2-year warranty"] },
    { tier: "best", name: "Replace RTU-4", description: "New Carrier 48HC 10-ton with economizer and smart controls, crane and permit included. 10-year parts warranty.", price: 16900, cost: 11200, included: ["New 10-ton unit", "Crane and permit", "Title 24 tests", "10-year parts warranty"] },
  ], [
    { description: "Economizer actuator, Belimo", quantity: 1, unitCost: 210, code: "RP-140" },
    { description: "MERV 13 filter rack and filters", quantity: 1, unitCost: 180, code: "IAQ-301" },
    { description: "UV coil light", quantity: 1, unitCost: 260, code: "IAQ-302" },
    { description: "Controls, misc", quantity: 1, unitCost: 550 },
  ]);
  await q(2043, "Irvine Med Offices · Suite 200", "Barranca Medical Partners", "Drain pan and UV light, RTU-2", "draft", { equipmentId: eq["rtu2"]!, workOrderId: wo[1058]!, reason: "service", problemText: "Found on 1058: drain pan corroded, recommend UV light at the coil." }, [{ tier: "single", name: "Drain pan and UV light", description: "Replace the drain pan and add a UV coil light.", price: 1180, cost: 690, included: ["Drain pan", "UV coil light"] }], [{ description: "Drain pan, Carrier", quantity: 1, unitCost: 240 }, { description: "UV coil light", quantity: 1, unitCost: 260, code: "IAQ-302" }]);
  await q(2044, "Harbor & Main Kitchen", "Harbor & Main Kitchen", "MAU-1 high limit and blower", "draft", { equipmentId: eq["mau1"]!, workOrderId: wo[1055]!, reason: "service" }, [{ tier: "good", name: "Repair", description: "High limit switch and blower motor.", price: 2840, cost: 1700, included: ["High limit", "Blower motor"] }], [{ description: "Blower motor", quantity: 1, unitCost: 310, code: "RP-102" }]);
  await q(2038, "Santa Ana Gym", "Santa Ana Gym", "Replace RTU-1 compressor", "approved", { equipmentId: eq["gym1"]!, reason: "service", sentAt: at(d(-14), "10:00"), approvedAt: at(d(-9), "08:30") }, [{ tier: "single", name: "Compressor replacement", description: "", price: 5900, cost: 3450, included: [] }], [{ description: "Scroll compressor 12.5 ton", quantity: 1, unitCost: 2400, code: "RP-121" }]);
  await q(2039, "Costa Mesa Library", "Costa Mesa Library", "Economizer repair", "sent", { reason: "service", sentAt: at(d(-4), "09:00"), followUpDate: d(2) }, [{ tier: "single", name: "Economizer repair", description: "", price: 910, cost: 540, included: [] }], [{ description: "Actuator", quantity: 1, unitCost: 210, code: "RP-140" }]);
  await q(2040, "Newport Plaza Retail", "Newport Plaza Retail", "Condenser coil, RTU-3", "sent", { equipmentId: eq["np3"]!, workOrderId: wo[1063]!, reason: "service", sentAt: at(d(-3), "14:00") }, [{ tier: "single", name: "Condenser coil", description: "", price: 3980, cost: 2410, included: [] }], [{ description: "Condenser coil, Lennox", quantity: 1, unitCost: 1650 }]);
  await q(2042, "Tustin Auto Center · Service bays", "Tustin Auto Center", "Condenser fan motor", "approved", { equipmentId: eq["tustin1"]!, reason: "service", sentAt: at(d(-8), "11:00"), approvedAt: at(d(-5), "09:10"), createdWorkOrderId: wo[1062]! }, [{ tier: "single", name: "Fan motor", description: "", price: 1840, cost: 1100, included: [] }], [{ description: "Condenser fan motor 1/3 hp", quantity: 1, unitCost: 240, code: "RP-101" }]);

  // Vendors, warehouses, inventory, purchase orders
  const vendorIds: Record<string, string> = {};
  for (const [name, city] of [["Johnstone Supply", "Santa Ana"], ["Ferguson HVAC", "Irvine"], ["Carrier Enterprise", "Anaheim"], ["Grainger", "Costa Mesa"], ["US Air Conditioning Distributors", "Santa Ana"], ["Winsupply", "Orange"]] as const) {
    const id = newId();
    vendorIds[name] = id;
    await tx.insert(s.vendors).values({ id, orgId, name, city, phone: "714-555-02" + String(Object.keys(vendorIds).length).padStart(2, "0") });
  }
  const wh: Record<string, string> = {};
  for (const [key, name, kind, tech, target] of [["main", "Main · Costa Mesa", "main", null, 20000], ["irvine", "Irvine shop", "main", null, 8000], ["van12", "Van 12", "vehicle", "marcus", 5500], ["van7", "Van 7", "vehicle", "elena", 5500], ["van9", "Van 9", "vehicle", "andre", 5500], ["van3", "Van 3", "vehicle", "priya", 5500], ["van5", "Van 5", "vehicle", "diego", 4500], ["van8", "Van 8", "vehicle", "hannah", 4500]] as const) {
    const id = newId();
    wh[key] = id;
    await tx.insert(s.warehouses).values({ id, orgId, name, kind, techId: tech ? techByKey[tech] ?? null : null, targetValue: target });
  }
  const cat: Record<string, string> = {};
  for (const [slug, name] of [["refrigerant", "Refrigerant"], ["motors", "Motors"], ["controls", "Controls"], ["filters", "Filters"], ["electrical", "Electrical"], ["fittings", "Fittings & copper"], ["belts", "Belts & bearings"], ["misc", "Misc"]] as const) {
    const id = newId();
    cat[slug] = id;
    await tx.insert(s.inventoryCategories).values({ id, orgId, slug, name });
  }
  const sku: Record<string, string> = {};
  const skus: [string, string, string, number][] = [
    ["BLT-B48", "Belt B48", "belts", 14], ["BLT-A42", "Belt A42", "belts", 11], ["CAP-45-5", "Capacitor 45/5 µF 440 V", "electrical", 24], ["CAP-35-5", "Capacitor 35/5 µF 440 V", "electrical", 21],
    ["FLT-16252", "Filter 16x25x2 MERV 8", "filters", 9], ["FLT-20252", "Filter 20x25x2 MERV 8", "filters", 10], ["CON-40-24", "Contactor 40 A 2P 24 V", "electrical", 38],
    ["R410-25", "R-410A cylinder 25 lb", "refrigerant", 390], ["IGN-HSI", "Hot surface igniter", "controls", 42], ["TSTAT-COM", "Thermostat, commercial", "controls", 145],
    ["MTR-13-CF", "Condenser fan motor 1/3 hp", "motors", 240], ["MTR-34-BL", "Blower motor 3/4 hp", "motors", 310], ["DRN-TAB", "Drain pan tablets, 6", "misc", 12], ["FUS-30", "Fuse 30 A, 3", "electrical", 9],
  ];
  for (const [code, name, c, cost] of skus) {
    const id = newId();
    sku[code] = id;
    await tx.insert(s.inventoryItems).values({ id, orgId, sku: code, name, categoryId: cat[c]!, unitCost: cost });
  }
  const stockRows: typeof s.inventoryStock.$inferInsert[] = [];
  for (const van of ["van12", "van7", "van9", "van3"]) {
    const low = van === "van3";
    stockRows.push(
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["BLT-B48"]!, onHand: low ? 0 : 3, min: 1, max: 4 },
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["CAP-45-5"]!, onHand: low ? 1 : 5, min: 3, max: 8 },
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["FLT-16252"]!, onHand: low ? 4 : 18, min: 8, max: 24 },
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["FLT-20252"]!, onHand: 16, min: 12, max: 36 },
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["CAP-35-5"]!, onHand: 5, min: 3, max: 8 },
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["CON-40-24"]!, onHand: 3, min: 2, max: 6 },
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["R410-25"]!, onHand: 1, min: 1, max: 2 },
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["IGN-HSI"]!, onHand: 2, min: 2, max: 4 },
      { id: newId(), orgId, warehouseId: wh[van]!, itemId: sku["TSTAT-COM"]!, onHand: 1, min: 1, max: 3 },
    );
  }
  for (const code of Object.keys(sku)) stockRows.push({ id: newId(), orgId, warehouseId: wh["main"]!, itemId: sku[code]!, onHand: 20, min: 6, max: 40 });
  await tx.insert(s.inventoryStock).values(stockRows);
  await tx.insert(s.inventoryTxns).values([
    { id: newId(), orgId, warehouseId: wh["main"]!, categoryId: cat["motors"]!, itemId: sku["MTR-13-CF"]!, kind: "po_receipt", amount: 480, quantity: 2, description: "PO 117 Carrier Enterprise", userId: u.james, date: d(-3) },
    { id: newId(), orgId, warehouseId: wh["van12"]!, categoryId: cat["electrical"]!, itemId: sku["CAP-45-5"]!, kind: "used_on_wo", amount: -24, quantity: -1, workOrderId: wo[1127]!, description: "Capacitor on 1127", userId: u.marcus, date: yesterday },
    { id: newId(), orgId, warehouseId: wh["van3"]!, categoryId: cat["belts"]!, itemId: sku["BLT-B48"]!, kind: "used_on_wo", amount: -14, quantity: -1, workOrderId: wo[1047]!, description: "Belt on 1047", userId: u.priya, date: today },
  ]);
  await tx.insert(s.truckParts).values([
    { id: newId(), orgId, workOrderId: wo[1127]!, warehouseId: wh["van12"]!, itemId: sku["CAP-45-5"]!, categoryId: cat["electrical"]!, description: "Capacitor 45/5 µF 440 V", quantity: 1, unitCost: 24, addedBy: u.marcus },
    { id: newId(), orgId, workOrderId: wo[1047]!, warehouseId: wh["van3"]!, itemId: sku["BLT-B48"]!, categoryId: cat["belts"]!, description: "Belt B48", quantity: 1, unitCost: 14, addedBy: u.priya },
    { id: newId(), orgId, workOrderId: wo[1052]!, warehouseId: wh["van7"]!, itemId: sku["CON-40-24"]!, categoryId: cat["electrical"]!, description: "Contactor 40 A 2P 24 V", quantity: 1, unitCost: 38, addedBy: u.elena },
  ]);
  const po = async (number: number, vendor: string, number_wo: number | null, status: (typeof s.purchaseOrders.$inferInsert)["status"], extra: Partial<typeof s.purchaseOrders.$inferInsert>, lines: { description: string; quantity: number; unitCost: number; receivedQty?: number; code?: string }[]) => {
    const id = newId();
    await tx.insert(s.purchaseOrders).values({ id, orgId, number, vendorId: vendorIds[vendor] ?? null, vendorName: vendor, workOrderId: number_wo ? wo[number_wo] ?? null : null, status, orderedAt: at(d(-2), "09:00"), createdBy: u.james, ...extra });
    if (lines.length) await tx.insert(s.poLines).values(lines.map((l, i) => ({ id: newId(), orgId, purchaseOrderId: id, description: l.description, quantity: l.quantity, unitCost: l.unitCost, receivedQty: l.receivedQty ?? 0, inventoryItemId: l.code ? sku[l.code] ?? null : null, sort: i })));
  };
  await po(115, "Grainger", 1040, "invoiced", { receivedAt: at(d(-5), "14:00"), vendorInvoiceNumber: "G-4471821", vendorInvoiceDate: d(-4), vendorInvoiceAmount: 612.4 }, [{ description: "VFD 2 hp 460 V", quantity: 1, unitCost: 540, receivedQty: 1 }, { description: "Belt B50", quantity: 2, unitCost: 16, receivedQty: 2 }]);
  await po(116, "Carrier Enterprise", 1040, "received", { receivedAt: at(d(-5), "15:00") }, [{ description: "Blower motor 1 hp, Carrier", quantity: 1, unitCost: 410, receivedQty: 1, code: "MTR-34-BL" }]);
  await po(117, "Carrier Enterprise", null, "received", { shipTo: "inventory", warehouseId: wh["main"]!, receivedAt: at(d(-3), "10:00") }, [{ description: "Condenser fan motor 1/3 hp", quantity: 2, unitCost: 240, receivedQty: 2, code: "MTR-13-CF" }]);
  await po(118, "Johnstone Supply", 1063, "partial", { equipmentId: eq["np3"]!, expectedDate: d(1) }, [{ description: "TXV, Sporlan OVE-5-C", quantity: 1, unitCost: 186.4, receivedQty: 1 }, { description: "Condenser coil, Lennox LGH120", quantity: 1, unitCost: 1650, receivedQty: 0 }, { description: "Economizer actuator, Belimo", quantity: 1, unitCost: 210, receivedQty: 0 }]);
  await po(119, "Ferguson HVAC", 1055, "issued", { lumpSum: true, lumpSumAmount: 540, remindAt: at(today, "11:00") }, []);
  await po(120, "Carrier Enterprise", 1058, "issued", { equipmentId: eq["rtu2"]! }, [{ description: "Evaporator coil, 48TC (warranty)", quantity: 1, unitCost: 0 }]);
  await po(121, "Johnstone Supply", 1058, "received", { lumpSum: true, lumpSumAmount: 86.2, receivedAt: at(today, "10:30") }, []);

  // Invoices and payments
  const inv = async (number: number, woNumber: number, amount: number, daysAgo: number, status: (typeof s.invoices.$inferInsert)["status"], customer: string, lines: s.FrozenLine[]) => {
    const id = newId();
    const billedOn = d(-daysAgo);
    await tx.insert(s.invoices).values({ id, orgId, number, workOrderId: wo[woNumber]!, customerId: customerOf(customer), status, billedAt: at(billedOn, "17:00"), dueDate: d(30 - daysAgo), amount, snapshot: { lines, subtotal: amount, tax: 0, total: amount, taxKind: "sales", nteAmount: null, travelSeparate: true }, paymentToken: newToken(8), createdBy: u.billing });
    return id;
  };
  const inv742 = await inv(742, 1041, 1186, 2, "billed", "Harbor & Main Kitchen", [{ id: "l1", kind: "flat", description: "Fall PM, 2 units", quantity: 1, rate: 1186, amount: 1186 }]);
  const inv731 = await inv(731, 1040, 3124, 44, "billed", "Barranca Medical Partners", [{ id: "l1", kind: "labor", description: "Labor, 6 hours", quantity: 6, rate: 185, amount: 1110 }, { id: "l2", kind: "material", description: "VFD and blower motor", quantity: 1, rate: 1890, amount: 1890 }, { id: "l3", kind: "vehicle", description: "Vehicle charge", quantity: 1, rate: 125, amount: 125 }]);
  await tx.insert(s.payments).values([{ id: newId(), orgId, invoiceId: inv742, customerId: customerOf("Harbor & Main Kitchen"), amount: 400, method: "check", reference: "4471", receivedAt: at(d(-1), "09:00"), createdBy: u.billing }]);
  void inv731;

  // Messages and automations
  const yolanda = customerOf("Warner Business Park");
  await tx.insert(s.messages).values([
    { id: newId(), orgId, customerId: yolanda, workOrderId: wo[1135]!, channel: "sms", direction: "out", fromAddress: "+17145550100", toAddress: "+17145550163", body: `Harbor Coast Mechanical: Hi Yolanda, Marcus Hale is scheduled at Warner Business Park Bldg 3 tomorrow 7:00–11:00 for the fall maintenance visit (WO 1135). Reply C to confirm or call 714-555-0100.`, automated: true, template: "confirmation", status: "delivered", createdAt: at(d(-1), "16:05") },
    { id: newId(), orgId, customerId: yolanda, workOrderId: wo[1135]!, channel: "sms", direction: "in", fromAddress: "+17145550163", toAddress: "+17145550100", body: "C", status: "received", createdAt: at(d(-1), "16:11") },
    { id: newId(), orgId, customerId: customerOf("Barranca Medical Partners"), workOrderId: wo[1058]!, channel: "sms", direction: "out", fromAddress: "+17145550100", toAddress: "+19495550142", body: "Harbor Coast Mechanical: Marcus is on the way to Irvine Med Offices, ETA 10:05. Track: fieldline.app/t/8f2k", automated: true, template: "on_my_way", status: "delivered", createdAt: at(today, "09:31") },
    { id: newId(), orgId, customerId: customerOf("Barranca Medical Partners"), workOrderId: wo[1058]!, channel: "sms", direction: "in", fromAddress: "+19495550142", toAddress: "+17145550100", body: "Thank you. Please have him check in at suite 200 reception, exam room 3 is dripping now.", status: "received", createdAt: at(today, "09:40") },
    { id: newId(), orgId, customerId: customerOf("Jamboree Corporate"), workOrderId: wo[1061]!, channel: "sms", direction: "out", fromAddress: "+17145550100", toAddress: "+19495550120", body: "Harbor Coast Mechanical: Marcus is scheduled at Jamboree Corporate today 1:00–3:00 for the suite 310 thermostat.", automated: true, template: "confirmation", status: "failed", error: "Landline, cannot receive SMS", createdAt: at(today, "08:00") },
  ]);
  await tx.insert(s.automations).values([
    { id: newId(), orgId, key: "confirmation", enabled: true, config: { hoursBefore: 18 }, sentCount: 142 },
    { id: newId(), orgId, key: "on_my_way", enabled: true, config: {}, sentCount: 388 },
    { id: newId(), orgId, key: "review_request", enabled: true, config: { delayHours: 2, link: "https://g.page/r/demo/review" }, sentCount: 61 },
    { id: newId(), orgId, key: "quote_followup", enabled: true, config: { cadenceDays: [2, 6, 10] }, sentCount: 37 },
    { id: newId(), orgId, key: "permit_warranty", enabled: true, config: {}, sentCount: 9 },
    { id: newId(), orgId, key: "pm_due", enabled: false, config: { weeksBefore: 3 }, sentCount: 0 },
    { id: newId(), orgId, key: "missed_call", enabled: false, config: {}, sentCount: 0 },
  ]);

  // Compliance: checklist templates and results, refrigerant log, permit, warranty claim
  const pmTemplate = newId();
  const safetyTemplate = newId();
  await tx.insert(s.checklistTemplates).values([
    { id: pmTemplate, orgId, name: "PM inspection", kind: "pm_inspection", requiredBeforeComplete: true, trigger: { callTypes: ["maintenance"] }, items: [
      { key: "filters", label: "Filters replaced" }, { key: "belts", label: "Belts and pulleys" }, { key: "coils", label: "Coils rinsed" }, { key: "refrigerant", label: "Refrigerant pressures and superheat" },
      { key: "electrical", label: "Electrical connections and amp draws" }, { key: "controls", label: "Thermostat and controls" }, { key: "drain", label: "Condensate drain clear" }, { key: "economizer", label: "Economizer operation" },
    ] },
    { id: safetyTemplate, orgId, name: "Roof safety", kind: "safety", requiredBeforeComplete: false, trigger: {}, items: [{ key: "ladder", label: "Ladder tied off" }, { key: "fall", label: "Fall protection within 6 ft of an edge" }, { key: "lockout", label: "Lockout on the disconnect" }, { key: "weather", label: "Weather and wind checked" }] },
  ]);
  await tx.insert(s.checklistResults).values([{ id: newId(), orgId, workOrderId: wo[1050]!, templateId: pmTemplate, techId: u.andre, items: [{ key: "filters", result: "pass" }, { key: "belts", result: "flag", note: "RTU-3 belt cracked, added to quote" }, { key: "coils", result: "pass" }, { key: "refrigerant", result: "pass" }, { key: "electrical", result: "pass" }, { key: "controls", result: "pass" }, { key: "drain", result: "pass" }] }]);
  await tx.insert(s.refrigerantLogs).values([{ id: newId(), orgId, workOrderId: wo[1058]!, equipmentId: eq["rtu2"]!, techId: u.marcus, techCert: "EPA 608 Universal", refrigerantType: "R-410A", lbsAdded: 2.5, lbsRecovered: 0, cylinderId: "118-A", leakCheck: "failed", leakRatePercent: 13.5, fullChargeLbs: 18.5, notes: "Leak at the evaporator header braze joint; repair under warranty, recheck in 10 days.", loggedAt: at(today, "10:35") }]);
  await tx.insert(s.permits).values([{ id: newId(), orgId, workOrderId: wo[1137]!, siteId: site("Tustin Auto Center · Service bays"), jurisdiction: "City of Tustin", permitNumber: "", status: "needed", tests: {}, notes: "Mechanical permit for the motor is not required; left as a reminder to confirm with the city." }]);
  await tx.insert(s.warrantyClaims).values([{ id: newId(), orgId, equipmentId: eq["rtu2"]!, workOrderId: wo[1058]!, manufacturer: "Carrier", registeredOn: `${new Date().getFullYear() - 3}-03-14`, claimStatus: "open", claimNumber: "", partsReturnBy: d(30), notes: "Evaporator coil leak at the header. Parts under warranty to " + (new Date().getFullYear() + 7) + "; labor not covered." }]);

  // Follow-up items of the new kinds
  await tx.insert(s.followUpItems).values([
    { id: newId(), orgId, kind: "review_request", status: "open", title: "Review request · Adams Avenue Plaza (1049)", detail: "Sends 2 hours after completion unless skipped.", dueOn: today, customerId: customerOf("Adams Avenue Plaza"), workOrderId: wo[1049]! },
    { id: newId(), orgId, kind: "eta_text_failed", status: "open", title: "ETA text failed · Jamboree Corporate (1061)", detail: "Landline on file. Add a mobile number or call the front desk.", dueOn: today, customerId: customerOf("Jamboree Corporate"), workOrderId: wo[1061]! },
    { id: newId(), orgId, kind: "warranty_registration", status: "open", title: "Register RTU-1 at Warner Business Park with Carrier", detail: "Installed this year; registration window closes in 18 days for the 10-year parts warranty.", dueOn: d(18), customerId: yolanda, relatedId: eq["wb1"]! },
    { id: newId(), orgId, kind: "permit_final", status: "open", title: "Permit final · Tustin Auto Center (1137)", detail: "Confirm with the City of Tustin whether the motor swap needs a permit.", dueOn: d(3), customerId: customerOf("Tustin Auto Center"), workOrderId: wo[1137]! },
  ]);

  // Counters
  await tx.insert(s.counters).values([
    { orgId, key: "work_order", value: 1142 },
    { orgId, key: "quote", value: 2044 },
    { orgId, key: "purchase_order", value: 121 },
    { orgId, key: "invoice", value: 742 },
    { orgId, key: "credit", value: 3 },
  ]);
}

/** Alias used by the browser demo. */
export const seedDemo = seed;
