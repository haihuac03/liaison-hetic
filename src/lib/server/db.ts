import { AsyncLocalStorage } from "node:async_hooks";
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient, type InValue, type Transaction } from "@libsql/client";

const directory = process.env.DATA_DIR || path.join(process.cwd(), "data");
const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
const onVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
if (onVercel && (!tursoUrl || tursoUrl.startsWith("file:"))) {
  throw new Error("TURSO_DATABASE_URL doit pointer vers une base Turso en production.");
}
if (onVercel && !tursoToken) {
  throw new Error("TURSO_AUTH_TOKEN est requis pour la base Turso en production.");
}

if (!tursoUrl || tursoUrl.startsWith("file:")) {
  mkdirSync(directory, { recursive: true });
  try { chmodSync(directory, 0o700); } catch { /* Permissions are best-effort on unsupported filesystems. */ }
}

const databaseUrl = tursoUrl || `file:${path.join(directory, "liaison.sqlite")}`;
const localDatabaseFile = databaseUrl.startsWith("file:")
  ? decodeURIComponent(new URL(databaseUrl).pathname)
  : null;
if (localDatabaseFile) {
  mkdirSync(path.dirname(localDatabaseFile), { recursive: true });
  const legacyBackup = path.join(directory, "liaison.pre-ticket-workflow.sqlite");
  if (!existsSync(/*turbopackIgnore: true*/ localDatabaseFile) && existsSync(/*turbopackIgnore: true*/ legacyBackup)) copyFileSync(legacyBackup, localDatabaseFile);
  try { chmodSync(localDatabaseFile, 0o600); } catch { /* best-effort */ }
}

const client = createClient({
  url: databaseUrl,
  authToken: tursoToken || undefined,
  timeout: 5000,
  intMode: "number",
});
const transactionStorage = new AsyncLocalStorage<Transaction>();
let writeQueue = Promise.resolve();

type QueryExecutor = Pick<Transaction, "execute" | "executeMultiple">;

function executor(): QueryExecutor {
  return transactionStorage.getStore() || client;
}

function parameters(values: unknown[]): InValue[] {
  const args = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  return args.map((value) => value === undefined ? null : value) as InValue[];
}

async function execute(sql: string, values: unknown[]) {
  return executor().execute({ sql, args: parameters(values) });
}

export const db = {
  prepare(sql: string) {
    return {
      get: async <T = Record<string, unknown>>(...values: unknown[]): Promise<T | undefined> => {
        const result = await execute(sql, values);
        return result.rows[0] as T | undefined;
      },
      all: async <T = Record<string, unknown>>(...values: unknown[]): Promise<T[]> => {
        const result = await execute(sql, values);
        return result.rows as T[];
      },
      run: async (...values: unknown[]) => {
        const result = await execute(sql, values);
        return {
          changes: result.rowsAffected,
          rowsAffected: result.rowsAffected,
          lastInsertRowid: Number(result.lastInsertRowid || 0),
        };
      },
    };
  },
  async exec(sql: string): Promise<void> {
    await executor().executeMultiple(sql);
  },
  async close(): Promise<void> {
    client.close();
  },
};

export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  if (transactionStorage.getStore()) return work();
  let release!: () => void;
  const previous = writeQueue;
  writeQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const current = await client.transaction("write");
    try {
      const result = await transactionStorage.run(current, work);
      await current.commit();
      return result;
    } catch (error) {
      try { await current.rollback(); } catch { /* Preserve the original failure. */ }
      throw error;
    } finally {
      current.close();
    }
  } finally {
    release();
  }
}

function backupLocalDatabase(fileName: string) {
  if (!localDatabaseFile) return;
  const destination = path.join(/*turbopackIgnore: true*/ directory, fileName);
  if (existsSync(/*turbopackIgnore: true*/ destination)) return;
  if (!existsSync(/*turbopackIgnore: true*/ localDatabaseFile)) throw new Error("La base SQLite locale est introuvable pour la sauvegarde.");
  try { chmodSync(localDatabaseFile, 0o600); } catch { /* best-effort */ }
  copyFileSync(localDatabaseFile, destination);
  try { chmodSync(destination, 0o600); } catch { /* best-effort */ }
}

async function localBackup(fileName: string) {
  if (!localDatabaseFile || existsSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ directory, fileName))) return;
  await db.exec("PRAGMA wal_checkpoint(FULL)");
  backupLocalDatabase(fileName);
}

export async function schemaVersion(): Promise<number> {
  const meta = await db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get<{ value: string }>();
  if (meta) return Number(meta.value);
  if (!localDatabaseFile) return 0;
  const row = await db.prepare("PRAGMA user_version").get<{ user_version: number }>();
  return Number(row?.user_version ?? 0);
}

async function setSchemaVersion(version: number): Promise<void> {
  await db.prepare("INSERT INTO app_meta(key,value) VALUES('schema_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(version));
  if (localDatabaseFile) await db.exec(`PRAGMA user_version=${version}`);
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return columns.some((item) => item.name === column);
}

async function initialize() {
  if (localDatabaseFile) {
    await db.exec("PRAGMA journal_mode=WAL");
    await db.exec("PRAGMA busy_timeout=5000");
  }
  await db.exec("PRAGMA foreign_keys=ON");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','tenant')));
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS properties(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), tenant_id TEXT REFERENCES users(id), address TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS invitations(code TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES properties(id), expires INTEGER NOT NULL, used_at INTEGER);
    CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES properties(id), creator_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ouvert', created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), message_id TEXT REFERENCES messages(id), name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, disk_name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), ticket_id TEXT NOT NULL REFERENCES tickets(id), text TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
  `);

  const version = await schemaVersion();
  if (version > 3) throw new Error(`Schéma SQLite ${version} plus récent que cette application.`);

  if (version < 1) {
    await localBackup("liaison.pre-ticket-workflow.sqlite");
    await transaction(async () => {
      if (await schemaVersion() >= 1) return;
      if (!await hasColumn("tickets", "version")) await db.exec("ALTER TABLE tickets ADD COLUMN version INTEGER NOT NULL DEFAULT 1;");
      if (!await hasColumn("tickets", "updated_at")) await db.exec("ALTER TABLE tickets ADD COLUMN updated_at INTEGER;");
      await db.exec(`
        CREATE TABLE IF NOT EXISTS ticket_parties(
          ticket_id TEXT PRIMARY KEY REFERENCES tickets(id),
          owner_id TEXT NOT NULL REFERENCES users(id),
          tenant_id TEXT NOT NULL REFERENCES users(id),
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ticket_events(
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id TEXT NOT NULL REFERENCES tickets(id),
          actor_id TEXT NOT NULL REFERENCES users(id),
          actor_role TEXT NOT NULL,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS interventions(
          id TEXT PRIMARY KEY,
          ticket_id TEXT NOT NULL REFERENCES tickets(id),
          proposed_by TEXT NOT NULL REFERENCES users(id),
          artisan_name TEXT NOT NULL,
          details TEXT NOT NULL,
          scheduled_start INTEGER NOT NULL,
          scheduled_end INTEGER NOT NULL,
          price_cents INTEGER NOT NULL,
          status TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          decision_reason TEXT,
          report TEXT,
          contested_reason TEXT,
          superseded_by TEXT REFERENCES interventions(id),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          accepted_at INTEGER,
          completed_at INTEGER,
          confirmed_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS closure_requests(
          id TEXT PRIMARY KEY,
          ticket_id TEXT NOT NULL REFERENCES tickets(id),
          requester_id TEXT NOT NULL REFERENCES users(id),
          subject TEXT NOT NULL,
          conditions TEXT NOT NULL,
          amount_cents INTEGER,
          file_ids TEXT NOT NULL DEFAULT '[]',
          payload_hash TEXT NOT NULL,
          version INTEGER NOT NULL,
          expected_version INTEGER NOT NULL,
          status TEXT NOT NULL,
          decided_by TEXT REFERENCES users(id),
          decision_reason TEXT,
          created_at INTEGER NOT NULL,
          decided_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS agreements(
          id TEXT PRIMARY KEY,
          ticket_id TEXT NOT NULL REFERENCES tickets(id),
          closure_request_id TEXT NOT NULL UNIQUE REFERENCES closure_requests(id),
          subject TEXT NOT NULL,
          conditions TEXT NOT NULL,
          amount_cents INTEGER,
          file_ids TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          accepted_by TEXT NOT NULL REFERENCES users(id),
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS disputes(
          id TEXT PRIMARY KEY,
          ticket_id TEXT NOT NULL REFERENCES tickets(id),
          opened_by TEXT NOT NULL REFERENCES users(id),
          description TEXT NOT NULL,
          status TEXT NOT NULL,
          withdrawn_by TEXT REFERENCES users(id),
          resolved_by TEXT REFERENCES users(id),
          resolution TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          withdrawn_at INTEGER,
          resolved_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS ticket_events_ticket_seq ON ticket_events(ticket_id, seq);
        CREATE INDEX IF NOT EXISTS interventions_ticket_created ON interventions(ticket_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS interventions_ticket_status ON interventions(ticket_id, status);
        CREATE INDEX IF NOT EXISTS closures_ticket_created ON closure_requests(ticket_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS closures_ticket_status ON closure_requests(ticket_id, status);
        CREATE INDEX IF NOT EXISTS disputes_ticket_created ON disputes(ticket_id, created_at DESC);
        CREATE TRIGGER IF NOT EXISTS ticket_events_no_update BEFORE UPDATE ON ticket_events
        BEGIN SELECT RAISE(ABORT, 'ticket_events est append-only'); END;
        CREATE TRIGGER IF NOT EXISTS ticket_events_no_delete BEFORE DELETE ON ticket_events
        BEGIN SELECT RAISE(ABORT, 'ticket_events est append-only'); END;
      `);
      if (!await hasColumn("files", "intervention_id")) await db.exec("ALTER TABLE files ADD COLUMN intervention_id TEXT REFERENCES interventions(id);");
      await db.exec(`
        CREATE INDEX IF NOT EXISTS files_intervention ON files(intervention_id);
        INSERT OR IGNORE INTO ticket_parties(ticket_id,owner_id,tenant_id,created_at)
          SELECT tickets.id, properties.owner_id, properties.tenant_id, tickets.created_at
          FROM tickets JOIN properties ON properties.id=tickets.property_id
          WHERE properties.tenant_id IS NOT NULL;
        UPDATE tickets SET version=1 WHERE version IS NULL OR version<1;
        UPDATE tickets SET updated_at=MAX(
          tickets.created_at,
          COALESCE((SELECT MAX(messages.created_at) FROM messages WHERE messages.ticket_id=tickets.id),0),
          COALESCE((SELECT MAX(notifications.created_at) FROM notifications WHERE notifications.ticket_id=tickets.id),0)
        ) WHERE tickets.updated_at IS NULL;
        INSERT INTO ticket_events(ticket_id,actor_id,actor_role,type,payload,created_at)
          SELECT tickets.id, tickets.creator_id, users.role, 'ticket.created',
            json_object('title',tickets.title,'status',tickets.status,'migrated',1), tickets.created_at
          FROM tickets JOIN users ON users.id=tickets.creator_id
          WHERE NOT EXISTS (SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id=tickets.id);
      `);
    });
    await setSchemaVersion(1);
  }

  if (version < 2) {
    if (version === 1) await localBackup("liaison.pre-rentals-v2.sqlite");
    await transaction(async () => {
      if (await schemaVersion() >= 2) return;
      await db.exec(`
        DROP INDEX IF EXISTS one_property_per_tenant;
        CREATE TABLE IF NOT EXISTS leases(
          id TEXT PRIMARY KEY,
          property_id TEXT NOT NULL REFERENCES properties(id),
          owner_id TEXT NOT NULL REFERENCES users(id),
          tenant_id TEXT NOT NULL REFERENCES users(id),
          starts_on TEXT NOT NULL,
          ends_on TEXT NULL,
          rent_cents INTEGER NOT NULL,
          charges_cents INTEGER NOT NULL DEFAULT 0,
          deposit_cents INTEGER NOT NULL DEFAULT 0,
          payment_day INTEGER NOT NULL,
          status TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS one_active_lease_per_property
          ON leases(property_id) WHERE status='active';
        CREATE INDEX IF NOT EXISTS leases_owner ON leases(owner_id);
        CREATE INDEX IF NOT EXISTS leases_tenant ON leases(tenant_id);
        CREATE TABLE IF NOT EXISTS rent_periods(
          id TEXT PRIMARY KEY,
          lease_id TEXT NOT NULL REFERENCES leases(id),
          period TEXT NOT NULL,
          due_on TEXT NOT NULL,
          rent_cents INTEGER NOT NULL,
          charges_cents INTEGER NOT NULL,
          total_cents INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('due','paid')),
          paid_at INTEGER NULL,
          created_at INTEGER NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          UNIQUE(lease_id,period)
        );
        CREATE INDEX IF NOT EXISTS rent_periods_lease_period ON rent_periods(lease_id,period);
        CREATE TABLE IF NOT EXISTS property_documents(
          id TEXT PRIMARY KEY,
          property_id TEXT NOT NULL REFERENCES properties(id),
          lease_id TEXT REFERENCES leases(id),
          tenant_id TEXT REFERENCES users(id),
          owner_id TEXT NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL,
          disk_name TEXT NOT NULL,
          uploaded_by TEXT NOT NULL REFERENCES users(id),
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS property_documents_property ON property_documents(property_id,created_at DESC);
        CREATE INDEX IF NOT EXISTS property_documents_lease ON property_documents(lease_id,created_at DESC);
      `);
    });
    await setSchemaVersion(2);
  }

  if (version < 3) {
    if (version === 2) await localBackup("liaison.pre-file-dates-v3.sqlite");
    await transaction(async () => {
      if (await schemaVersion() >= 3) return;
      if (!await hasColumn("files", "created_at")) await db.exec("ALTER TABLE files ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;");
      await db.exec(`
        UPDATE files SET created_at=COALESCE((SELECT tickets.created_at FROM tickets WHERE tickets.id=files.ticket_id),0) WHERE created_at=0;
      `);
    });
    await setSchemaVersion(3);
  }
}

export const ready = initialize();

export const id = () => randomBytes(16).toString("hex");
export const hash = (value: string) => { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`; };
export const verify = (value: string, stored: string) => { const [salt, digest] = stored.split(":"); if (!salt || !digest) return false; const candidate = scryptSync(value, salt, 64); const expected = Buffer.from(digest, "hex"); return candidate.length === expected.length && timingSafeEqual(candidate, expected); };
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function userFromToken(token?: string) {
  if (!token) return null;
  return await db.prepare("SELECT users.id, name, email, role FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?").get<{id:string;name:string;email:string;role:"owner"|"tenant"}>(tokenHash(token), Date.now()) || null;
}
export async function invitation(propertyId: string) {
  await db.prepare("DELETE FROM invitations WHERE property_id=? AND used_at IS NULL").run(propertyId);
  let code = "";
  do { code = String(randomInt(100000, 1000000)); } while (await db.prepare("SELECT code FROM invitations WHERE code=?").get(code));
  await db.prepare("INSERT INTO invitations VALUES(?,?,?,NULL)").run(code, propertyId, Date.now() + 7 * 86400000);
  return code;
}
