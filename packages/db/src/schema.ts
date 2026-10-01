import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ────────────────────────────── Předregistrace a e-maily ────────────────────────────── */

export const preregistrations = pgTable(
  "preregistrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    ico: varchar("ico", { length: 8 }),
    companyName: text("company_name"),
    industry: text("industry"),
    establishmentsCount: smallint("establishments_count"),
    needs: text("needs").array().notNull().default(sql`'{}'::text[]`),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    /** hash IP + UA pro doložení souhlasu, ne samotná IP */
    consentEvidence: text("consent_evidence"),
    referralCode: varchar("referral_code", { length: 12 }).notNull(),
    referredBy: varchar("referred_by", { length: 12 }),
    confirmToken: varchar("confirm_token", { length: 64 }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribeToken: varchar("unsubscribe_token", { length: 64 }).notNull(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    locale: varchar("locale", { length: 5 }).notNull().default("cs"),
    utm: jsonb("utm").$type<Record<string, string>>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("prereg_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("prereg_referral_uq").on(t.referralCode),
    index("prereg_referred_by_idx").on(t.referredBy),
    index("prereg_created_idx").on(t.createdAt),
  ],
);

export const emailStatus = pgEnum("email_status", ["queued", "sending", "sent", "failed", "cancelled"]);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    to: varchar("to", { length: 254 }).notNull(),
    template: varchar("template", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** deduplikace, např. "prereg-confirm:<id>" */
    dedupeKey: varchar("dedupe_key", { length: 128 }),
    status: emailStatus("status").notNull().default("queued"),
    attempts: smallint("attempts").notNull().default(0),
    sendAfter: timestamp("send_after", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("email_dedupe_uq").on(t.dedupeKey),
    index("email_queue_idx").on(t.status, t.sendAfter),
  ],
);

/* ────────────────────────────── Uživatelé a účty ────────────────────────────── */

export const plan = pgEnum("plan", ["free", "premium", "partner"]);
export const role = pgEnum("member_role", ["owner", "cashier", "accountant"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    name: text("name"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(sql`lower(${t.email})`)],
);

/** Poplatník (podnikatel) nebo účetní kancelář. */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: varchar("kind", { length: 16 }).notNull().default("business"), // business | accountant
    name: text("name").notNull(),
    ico: varchar("ico", { length: 8 }),
    dic: varchar("dic", { length: 14 }),
    /** EIČ pro EET (CZ + 8–10 číslic; zpravidla DIČ) */
    eic: varchar("eic", { length: 12 }),
    plan: plan("plan").notNull().default("free"),
    planValidUntil: timestamp("plan_valid_until", { withTimezone: true }),
    /** obsah dokladu: hlavička, patička */
    receiptHeader: text("receipt_header"),
    receiptFooter: text("receipt_footer"),
    vatPayer: boolean("vat_payer").notNull().default(false),
    /** IBAN pro QR platby */
    iban: varchar("iban", { length: 34 }),
    /** mock = ukázkový režim bez FS | playground = testovací prostředí FS | production = ostrý provoz */
    eetMode: varchar("eet_mode", { length: 16 }).notNull().default("mock"),
    referredByAccountantId: uuid("referred_by_accountant_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_ico_idx").on(t.ico)],
);

export const memberships = pgTable(
  "memberships",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: role("role").notNull(),
    displayName: text("display_name"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.userId] })],
);

/**
 * Obsluha pokladny (vlastník a pokladní). Přihlašuje se PINem na registrovaném zařízení,
 * i bez internetu — proto je hash PBKDF2-SHA256 ověřitelný v prohlížeči (WebCrypto).
 * Formát pinHash: "pbkdf2-sha256$<iterace>$<salt b64>$<hash b64>".
 */
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: varchar("role", { length: 16 }).notNull().default("cashier"), // owner | cashier
    pinHash: text("pin_hash"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("staff_account_idx").on(t.accountId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash)],
);

export const loginTokens = pgTable(
  "login_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    redirectTo: text("redirect_to"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("login_tokens_email_idx").on(t.email)],
);

/* ────────────────────────────── EET: jednotky, pokladny, certifikáty ────────────────────────────── */

/** Typy evidenčních jednotek tak, jak je nabízí DIS+ (eet.gov.cz – Jak začít evidovat). */
export const unitType = pgEnum("unit_type", [
  "stala_provozovna",
  "mobilni_provozovna",
  "automat",
  "internetova_stranka",
  "dopravni_prostredek",
  "osoba",
]);

/** Evidenční jednotka oznámená v DIS+. */
export const evidenceUnits = pgTable(
  "evidence_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: unitType("type").notNull(),
    label: text("label").notNull(),
    /** id_jednotky přidělené Finanční správou v DIS+ (1–999 999 999) */
    fsUnitId: integer("fs_unit_id"),
    /** IČP z živnostenského rejstříku — jen informativně, NENÍ to id_jednotky */
    icp: varchar("icp", { length: 12 }),
    address: text("address"),
    active: boolean("active").notNull().default(true),
    /** datum poslední změny – připomínka oznámení změny */
    changedAt: timestamp("changed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("units_account_idx").on(t.accountId)],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").references(() => evidenceUnits.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** ID pokladního zařízení uváděné ve zprávě (id_pokl) */
    registerId: varchar("register_id", { length: 20 }).notNull(),
    /** prefix pořadových čísel tohoto zařízení, např. "P1-" */
    sequencePrefix: varchar("sequence_prefix", { length: 12 }).notNull().default(""),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("devices_token_uq").on(t.tokenHash),
    uniqueIndex("devices_register_uq").on(t.accountId, t.registerId),
  ],
);

/** Šifrovaný certifikát (envelope encryption: DEK šifrovaný master klíčem/KMS). */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    /** EIČ ze subjektu certifikátu */
    eic: varchar("eic", { length: 12 }),
    environment: varchar("environment", { length: 16 }).notNull().default("production"), // playground | production
    serialNumber: text("serial_number").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }).notNull(),
    storage: varchar("storage", { length: 16 }).notNull().default("server"), // server | device
    encryptedKey: bytea("encrypted_key"),
    encryptedDek: bytea("encrypted_dek"),
    keyVersion: varchar("key_version", { length: 32 }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("certs_account_idx").on(t.accountId)],
);

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** cena v haléřích */
    price: bigint("price", { mode: "number" }).notNull(),
    vatRate: smallint("vat_rate").notNull().default(0),
    color: varchar("color", { length: 16 }),
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [index("catalog_account_idx").on(t.accountId)],
);

export const saleStatus = pgEnum("sale_status", ["queued", "sending", "confirmed", "failed", "rejected", "not_required"]);

/** Evidovaná tržba. `id` generuje klient (UUID zprávy) – zaručuje idempotenci. */
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id),
    unitId: uuid("unit_id").references(() => evidenceUnits.id),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    /** id_pokl a porad_cis tak, jak byly odeslány */
    registerId: varchar("register_id", { length: 20 }).notNull(),
    fsUnitId: integer("fs_unit_id").notNull(),
    sequence: varchar("sequence", { length: 25 }).notNull(),
    soldAt: timestamp("sold_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    /** částky v haléřích */
    total: bigint("total", { mode: "number" }).notNull(),
    tip: bigint("tip", { mode: "number" }).notNull().default(0),
    discount: bigint("discount", { mode: "number" }).notNull().default(0),
    payments: jsonb("payments").$type<{ method: string; amount: number }[]>().notNull(),
    items: jsonb("items").$type<{ name: string; qty: number; unitPrice: number; vatRate: number }[]>(),
    vatBreakdown: jsonb("vat_breakdown").$type<Record<string, { base: number; vat: number }>>(),
    refundOf: uuid("refund_of"),
    /** částky datové zprávy (haléře): celk_trzba, urceno_cerp_zuct, cerp_zuct */
    evidencedTotal: bigint("evidenced_total", { mode: "number" }).notNull(),
    prepaymentAmount: bigint("prepayment_amount", { mode: "number" }).notNull().default(0),
    redeemedAmount: bigint("redeemed_amount", { mode: "number" }).notNull().default(0),
    status: saleStatus("status").notNull().default("queued"),
    mode: varchar("mode", { length: 16 }).notNull().default("test"),
    /** potvrzovací kód Finanční správy (POK) */
    confirmationCode: varchar("confirmation_code", { length: 39 }),
    /** uuid_zpravy posledního pokusu (každý pokus má nové) */
    lastMessageUuid: uuid("last_message_uuid"),
    firstSentAt: timestamp("first_sent_at", { withTimezone: true }),
    warnings: jsonb("warnings").$type<{ code: number; text: string }[]>(),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** kdy nejdřív zkusit další odeslání (backoff) */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sales_device_seq_uq").on(t.deviceId, t.sequence),
    index("sales_account_sold_idx").on(t.accountId, t.soldAt),
    index("sales_pending_idx").on(t.status, t.nextAttemptAt),
  ],
);

/* ────────────────────────────── Katalog firem (ARES) ────────────────────────────── */

export const eetRelevance = pgEnum("eet_relevance", ["likely", "possible", "unlikely"]);

export const firms = pgTable(
  "firms",
  {
    ico: varchar("ico", { length: 8 }).primaryKey(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    legalForm: varchar("legal_form", { length: 4 }),
    isNaturalPerson: boolean("is_natural_person").notNull().default(false),
    dic: varchar("dic", { length: 14 }),
    vatPayer: boolean("vat_payer").notNull().default(false),
    foundedAt: date("founded_at"),
    dissolvedAt: date("dissolved_at"),
    aresUpdatedAt: date("ares_updated_at"),
    street: text("street"),
    city: text("city"),
    cityCode: integer("city_code"),
    postalCode: varchar("postal_code", { length: 5 }),
    regionCode: smallint("region_code"),
    nace: text("nace").array().notNull().default(sql`'{}'::text[]`),
    eetRelevance: eetRelevance("eet_relevance").notNull().default("possible"),
    establishmentsCount: integer("establishments_count").notNull().default(0),
    /** vlastník ověřil profil */
    claimedAccountId: uuid("claimed_account_id"),
    profile: jsonb("profile").$type<{
      openingHours?: string;
      website?: string;
      paymentMethods?: string[];
      eetReady?: boolean;
      description?: string;
    }>(),
    /** stránku neindexovat (námitka, zaniklá firma…) */
    noindex: boolean("noindex").notNull().default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("firms_city_idx").on(t.cityCode),
    index("firms_region_idx").on(t.regionCode),
    index("firms_founded_idx").on(t.foundedAt),
    index("firms_nace_gin").using("gin", t.nace),
    index("firms_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const firmEstablishments = pgTable(
  "firm_establishments",
  {
    icp: varchar("icp", { length: 12 }).primaryKey(),
    ico: varchar("ico", { length: 8 })
      .notNull()
      .references(() => firms.ico, { onDelete: "cascade" }),
    name: text("name"),
    slug: varchar("slug", { length: 96 }).notNull(),
    street: text("street"),
    city: text("city"),
    cityCode: integer("city_code"),
    postalCode: varchar("postal_code", { length: 5 }),
    regionCode: smallint("region_code"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    trades: text("trades").array().notNull().default(sql`'{}'::text[]`),
    eetRelevance: eetRelevance("eet_relevance").notNull().default("possible"),
    startedAt: date("started_at"),
    endedAt: date("ended_at"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("est_ico_idx").on(t.ico), index("est_city_idx").on(t.cityCode)],
);

/** Námitky dle čl. 21 GDPR a žádosti o opravu údajů. */
export const objections = pgTable("objections", {
  id: uuid("id").primaryKey().defaultRandom(),
  ico: varchar("ico", { length: 8 }),
  icp: varchar("icp", { length: 12 }),
  name: text("name").notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("new"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Krátkodobá cache odpovědí ARES (šetří limity API a zrychluje kontrolu IČO). */
export const aresCache = pgTable("ares_cache", {
  key: varchar("key", { length: 64 }).primaryKey(),
  payload: jsonb("payload"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────── Účetní ────────────────────────────── */

export const accountantClients = pgTable(
  "accountant_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountantAccountId: uuid("accountant_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    ico: varchar("ico", { length: 8 }).notNull(),
    label: text("label"),
    clientAccountId: uuid("client_account_id").references(() => accounts.id, { onDelete: "set null" }),
    inviteToken: varchar("invite_token", { length: 64 }),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    /** ruční stav připravenosti, pokud klient nepoužívá naši pokladnu */
    manualStatus: jsonb("manual_status").$type<{
      disActivated?: boolean;
      unitsAnnounced?: boolean;
      certificate?: boolean;
      firstSale?: boolean;
    }>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("acc_clients_uq").on(t.accountantAccountId, t.ico)],
);
