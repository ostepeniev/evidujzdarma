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
    /** doklad souhlasu: „souhlas:<verze textu>“ (B Дрібне 10); starší záznamy mají hash IP + UA */
    consentEvidence: text("consent_evidence"),
    referralCode: varchar("referral_code", { length: 12 }).notNull(),
    referredBy: varchar("referred_by", { length: 12 }),
    /** SHA-256 potvrzovacího tokenu – token sám je jen v e-mailu (B Дрібне 9) */
    confirmTokenHash: varchar("confirm_token_hash", { length: 64 }).notNull(),
    /** kdy byl potvrzovací odkaz vydán – nepotvrzený platí 30 dní */
    confirmTokenIssuedAt: timestamp("confirm_token_issued_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** SHA-256 odhlašovacího tokenu ze starších e-mailů; nové odkazy jsou podepsané (HMAC id), bez uloženého tokenu */
    unsubscribeTokenHash: varchar("unsubscribe_token_hash", { length: 64 }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    locale: varchar("locale", { length: 5 }).notNull().default("cs"),
    utm: jsonb("utm").$type<Record<string, string>>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("prereg_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("prereg_referral_uq").on(t.referralCode),
    index("prereg_confirm_hash_idx").on(t.confirmTokenHash),
    index("prereg_unsub_hash_idx").on(t.unsubscribeTokenHash),
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
    /** kdy řádek zabral odesílač – „sending“ starší 10 min se vrací do fronty (B Дрібне 18) */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
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
    /** verze obchodních podmínek, se kterou uživatel souhlasil, a kdy (R2.5) */
    termsVersion: varchar("terms_version", { length: 16 }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
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
    /** POK na dokladu – podle FS dobrovolné */
    receiptShowPok: boolean("receipt_show_pok").notNull().default(true),
    vatPayer: boolean("vat_payer").notNull().default(false),
    /** IBAN pro QR platby */
    iban: varchar("iban", { length: 34 }),
    /** mock = ukázkový režim bez FS | playground = testovací prostředí FS | production = ostrý provoz */
    eetMode: varchar("eet_mode", { length: 16 }).notNull().default("mock"),
    /** kdy se režim naposledy změnil – tržba v jiném režimu prodaná po tomto čase jde do karantény (R5.1) */
    eetModeChangedAt: timestamp("eet_mode_changed_at", { withTimezone: true }).notNull().defaultNow(),
    referredByAccountantId: uuid("referred_by_accountant_id"),
    /** účet zrušen vlastníkem – data cron smaže po 30 dnech (podmínky čl. 11.3) */
    closedAt: timestamp("closed_at", { withTimezone: true }),
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
    /** SHA-256 nonce z cookie prohlížeče, který o odkaz požádal (R3.7) */
    nonceHash: varchar("nonce_hash", { length: 64 }),
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
    /** AAD šifrovaného klíče: 1 = jen účet (starší záznamy), 2 = účet + prostředí (A Дрібне 3) */
    aadVersion: smallint("aad_version").notNull().default(1),
    /** vydavatel – podle něj se určuje prostředí (Playground / ostrý), ne podle formuláře (R1.9) */
    issuer: text("issuer"),
    /** kdy certifikát prošel ověřovacím odesláním (overeni) – bez toho nelze přepnout na ostrý provoz */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("certs_account_idx").on(t.accountId),
    /** nejvýš jeden aktivní certifikát na účet a prostředí – drží i při souběžném importu (Д-4) */
    uniqueIndex("certs_active_uq").on(t.accountId, t.environment).where(sql`${t.revokedAt} is null`),
  ],
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
    /** vlastník, který vratku schválil PINem na pokladně (R1.7) */
    approvedBy: uuid("approved_by").references(() => staff.id, { onDelete: "set null" }),
    /** id schválení vratky (jti) – každé schválení se dá použít jen jednou (R5.5) */
    approvalJti: uuid("approval_jti"),
    /** částky datové zprávy (haléře): celk_trzba, urceno_cerp_zuct, cerp_zuct */
    evidencedTotal: bigint("evidenced_total", { mode: "number" }).notNull(),
    prepaymentAmount: bigint("prepayment_amount", { mode: "number" }).notNull().default(0),
    redeemedAmount: bigint("redeemed_amount", { mode: "number" }).notNull().default(0),
    status: saleStatus("status").notNull().default("queued"),
    /** mock | playground | production – bez výchozí hodnoty: režim vždy určuje pokladna (Д-9) */
    mode: varchar("mode", { length: 16 }).notNull(),
    /** potvrzovací kód Finanční správy (POK) */
    confirmationCode: varchar("confirmation_code", { length: 39 }),
    /** uuid_zpravy posledního pokusu (každý pokus má nové) */
    lastMessageUuid: uuid("last_message_uuid"),
    firstSentAt: timestamp("first_sent_at", { withTimezone: true }),
    warnings: jsonb("warnings").$type<{ code: number; text: string }[]>(),
    /** integer: smallint by přetekl po ~341 dnech opakování po 15 min (A Дрібне 9) */
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** kdy nejdřív zkusit další odeslání (backoff) */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    /** token aktuálního „zabrání“ k odeslání – výsledek zapíše jen ten, kdo tržbu zabral (R1.4) */
    claimToken: uuid("claim_token"),
    /** proč tržbu teď nelze odeslat (certifikát, EIČ, klíč…) – zůstává ve frontě, nezahazuje se (R1.3) */
    blockedReason: varchar("blocked_reason", { length: 32 }),
    /** snímek dat zprávy z prvního pokusu – opakování posílá přesně tato data (Р4) */
    eetData: jsonb("eet_data"),
    /** vlastník zrušeného účtu označil neodeslanou ostrou tržbu „Evidováno jinak“ (R6.4, Б7) – účet ji už nedrží */
    settledElsewhereAt: timestamp("settled_elsewhere_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sales_device_seq_uq").on(t.deviceId, t.sequence),
    index("sales_account_sold_idx").on(t.accountId, t.soldAt),
    index("sales_pending_idx").on(t.status, t.nextAttemptAt),
    /** na jednu tržbu nejvýš jedna vratka – drží i při souběhu (R1.7) */
    uniqueIndex("sales_refund_of_uq").on(t.refundOf).where(sql`${t.refundOf} is not null`),
    uniqueIndex("sales_approval_jti_uq").on(t.approvalJti).where(sql`${t.approvalJti} is not null`),
  ],
);

/** Audit každého pokusu o odeslání tržby (Р4): co odešlo a co Finanční správa odpověděla. */
export const saleAttempts = pgTable(
  "sale_attempts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    environment: varchar("environment", { length: 16 }).notNull(),
    messageUuid: uuid("message_uuid"),
    firstAttempt: boolean("first_attempt").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull().defaultNow(),
    /** confirmed | rejected | retry | blocked | invalid | stale | rebuilt | in_flight (před POST, Д-2) */
    result: varchar("result", { length: 16 }).notNull(),
    code: varchar("code", { length: 32 }),
    message: text("message"),
    pok: varchar("pok", { length: 39 }),
    /** dat_prij z odpovědi FS */
    receivedAt: timestamp("received_at", { withTimezone: true }),
    httpStatus: smallint("http_status"),
    requestSha256: varchar("request_sha256", { length: 64 }),
    /** syrová podepsaná odpověď FS (max. 64 kB) */
    responseBody: text("response_body"),
  },
  (t) => [index("sale_attempts_sale").on(t.saleId, t.attempt)],
);

/**
 * Karanténa tržeb (Р2): tržba, kterou server nemohl přijmout (datum, jednotka, konflikt…),
 * se neztratí – uloží se celá, jak ji poslala pokladna, a čeká na rozhodnutí vlastníka.
 */
/**
 * Pojistka prostředí FS (R5.4): když neověřitelné odpovědi chodí od více účtů najednou, odesílání do daného
 * prostředí stojí. Jednou za `probe_at` projde jedna zkušební tržba; potvrzená pojistku zruší.
 * Řádek existuje jen po dobu pozastavení.
 */
export const fsBreaker = pgTable("fs_breaker", {
  environment: varchar("environment", { length: 16 }).primaryKey(),
  pausedAt: timestamp("paused_at", { withTimezone: true }).notNull().defaultNow(),
  probeAt: timestamp("probe_at", { withTimezone: true }).notNull(),
  invalidCount: integer("invalid_count").notNull(),
  accountCount: integer("account_count").notNull(),
});

export const saleQuarantine = pgTable(
  "sale_quarantine",
  {
    /** id tržby z pokladny */
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    payload: jsonb("payload").notNull(),
    reasonCode: varchar("reason_code", { length: 32 }).notNull(),
    reason: text("reason").notNull(),
    attempts: smallint("attempts").notNull().default(1),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** ingested = tržba přijata | dismissed = vlastník vyřídil ručně */
    resolution: varchar("resolution", { length: 16 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    note: text("note"),
  },
  (t) => [index("sale_quarantine_open").on(t.accountId, t.resolvedAt)],
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
    /** datum posledního ověření subjektu v ARES (enrich); null = údaje jen z RES ČSÚ */
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
    // stránkování velkých krajů (Praha) bez řazení celého kraje
    index("firms_listable_region_name")
      .on(t.regionCode, t.name)
      .where(sql`${t.noindex} = false and ${t.dissolvedAt} is null`),
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
  /** objection = námitka dle čl. 21 GDPR | correction = oprava údajů */
  kind: varchar("kind", { length: 16 }).notNull().default("objection"),
  ico: varchar("ico", { length: 8 }),
  icp: varchar("icp", { length: 12 }),
  name: text("name").notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("new"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  /** potvrzení e-mailem (DOI) – u právnických osob teprve pak noindex (R3.5); v DB jen hash tokenu */
  confirmTokenHash: varchar("confirm_token_hash", { length: 64 }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  /** zahrnuto do denního přehledu provozovateli */
  digestedAt: timestamp("digested_at", { withTimezone: true }),
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
    /** pozvánka: v DB jen SHA-256 tokenu a platnost (R3.4) */
    inviteTokenHash: varchar("invite_token_hash", { length: 64 }),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
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

/* ────────────────────────────── Hotovost: pohyby a uzávěrky ────────────────────────────── */

/** Vklady a výběry hotovosti (nejsou tržby, neevidují se). ID vzniká v zařízení → idempotentní synchronizace. */
export const cashMovements = pgTable(
  "cash_movements",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    registerId: varchar("register_id", { length: 20 }).notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    type: varchar("type", { length: 16 }).notNull(), // deposit | withdrawal
    amount: bigint("amount", { mode: "number" }).notNull(),
    note: text("note"),
    staffId: uuid("staff_id"),
    staffName: text("staff_name"),
    createdAt: createdAt(),
  },
  (t) => [index("cash_movements_account_at").on(t.accountId, t.at)],
);

/** Denní uzávěrky (Z-report) jednotlivých pokladen, jak je obsluha potvrdila v zařízení. */
export const closings = pgTable(
  "closings",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    registerId: varchar("register_id", { length: 20 }).notNull(),
    number: integer("number").notNull(),
    periodFrom: timestamp("period_from", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
    openingCash: bigint("opening_cash", { mode: "number" }).notNull(),
    expectedCash: bigint("expected_cash", { mode: "number" }).notNull(),
    countedCash: bigint("counted_cash", { mode: "number" }).notNull(),
    difference: bigint("difference", { mode: "number" }).notNull(),
    cashOut: bigint("cash_out", { mode: "number" }).notNull().default(0),
    closingCash: bigint("closing_cash", { mode: "number" }).notNull(),
    /** kompletní ClosingTotals z @ez/fiscal-core */
    totals: jsonb("totals").notNull(),
    denominations: jsonb("denominations").$type<Record<string, number>>(),
    note: text("note"),
    staffId: uuid("staff_id"),
    staffName: text("staff_name"),
    mode: varchar("mode", { length: 16 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("closings_account_closed").on(t.accountId, t.closedAt), index("closings_device_closed").on(t.deviceId, t.closedAt)],
);

/* ────────────────────────────── Monitor dostupnosti FS ────────────────────────────── */

/** Výsledky pravidelného měření dostupnosti rozhraní EET (veřejná stránka /stav-eet a upozornění). */
export const fsProbes = pgTable(
  "fs_probes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    environment: varchar("environment", { length: 16 }).notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    /** up | slow | down */
    status: varchar("status", { length: 8 }).notNull(),
    latencyMs: integer("latency_ms"),
    httpStatus: smallint("http_status"),
    error: text("error"),
  },
  (t) => [index("fs_probes_env_time").on(t.environment, t.checkedAt)],
);

/* ────────────────────────────── Anketa ────────────────────────────── */

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    poll: varchar("poll", { length: 32 }).notNull(),
    choice: varchar("choice", { length: 16 }).notNull(),
    /** HMAC anonymního ID z cookie – jeden hlas na prohlížeč, bez osobních údajů */
    voterHash: varchar("voter_hash", { length: 64 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("poll_votes_uq").on(t.poll, t.voterHash), index("poll_votes_poll_choice").on(t.poll, t.choice)],
);
