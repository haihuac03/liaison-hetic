import { db, id, transaction } from "./db";
import { WorkflowError, failWorkflow, type SessionUser } from "./workflow";

export type LeaseRow = {
  id: string;
  property_id: string;
  owner_id: string;
  tenant_id: string;
  starts_on: string;
  ends_on: string | null;
  rent_cents: number;
  charges_cents: number;
  deposit_cents: number;
  payment_day: number;
  status: string;
  version: number;
  created_at: number;
  updated_at: number;
};

export type RentPeriodRow = {
  id: string;
  lease_id: string;
  period: string;
  due_on: string;
  rent_cents: number;
  charges_cents: number;
  total_cents: number;
  status: "due" | "paid";
  paid_at: number | null;
  created_at: number;
  version: number;
};

export type PropertyDocumentRow = {
  id: string;
  property_id: string;
  lease_id: string | null;
  tenant_id: string | null;
  owner_id: string;
  name: string;
  mime: string;
  size: number;
  disk_name: string;
  uploaded_by: string;
  created_at: number;
};

export type PropertyUploadContext = {
  propertyId: string;
  leaseId: string | null;
  ownerId: string;
  tenantId: string | null;
};

type PropertyRow = { id: string; owner_id: string; tenant_id: string | null; address: string };

const text = (value: unknown, field: string, maximum = 200) => {
  if (typeof value !== "string" || !value.trim()) failWorkflow(400, `${field} est requis.`);
  const result = value.trim();
  if (result.length > maximum) failWorkflow(400, `${field} est trop long.`);
  return result;
};

const integer = (value: unknown, field: string, minimum: number, maximum: number, defaultValue?: number) => {
  if ((value === undefined || value === null || value === "") && defaultValue !== undefined) return defaultValue;
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    failWorkflow(400, `${field} doit être un entier entre ${minimum} et ${maximum}.`);
  }
  return parsed;
};

const dateValue = (value: unknown, field: string, optional = false) => {
  if ((value === undefined || value === null || value === "") && optional) return null;
  if (typeof value !== "string") failWorkflow(400, `${field} doit être une date au format YYYY-MM-DD.`);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) failWorkflow(400, `${field} doit être une date au format YYYY-MM-DD.`);
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    failWorkflow(400, `${field} n’est pas une date valide.`);
  }
  return value;
};

const periodValue = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    failWorkflow(400, "period doit être au format YYYY-MM.");
  }
  return value;
};

const expectedVersion = (value: unknown) => {
  if (value === undefined || value === null) return null;
  return integer(value, "expectedVersion", 1, Number.MAX_SAFE_INTEGER);
};

const dueOnFor = (period: string, paymentDay: number) => {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(Math.min(paymentDay, lastDay)).padStart(2, "0")}`;
};

const today = () => new Date().toISOString().slice(0, 10);

const leaseById = async (leaseId: string) => await db.prepare("SELECT * FROM leases WHERE id=?").get(leaseId) as LeaseRow | undefined;
const rentPeriodById = async (periodId: string) => await db.prepare("SELECT * FROM rent_periods WHERE id=?").get(periodId) as RentPeriodRow | undefined;

const ownerProperty = async (user: SessionUser, propertyId: string) => {
  if (user.role !== "owner") failWorkflow(403, "Réservé aux propriétaires.");
  const property = await db.prepare("SELECT * FROM properties WHERE id=? AND owner_id=?").get(propertyId, user.id) as PropertyRow | undefined;
  if (!property) failWorkflow(404, "Logement introuvable.");
  return property;
};

export async function saveLease(user: SessionUser, body: Record<string, unknown>) {
  const property = await ownerProperty(user, text(body.propertyId, "propertyId", 200));
  if (!property.tenant_id) failWorkflow(409, "Le logement doit être relié à un locataire pour créer un bail.");
  const startsOn = dateValue(body.startsOn, "startsOn")!;
  const endsOn = dateValue(body.endsOn, "endsOn", true);
  if (endsOn && endsOn < startsOn) failWorkflow(400, "endsOn doit être postérieur à startsOn.");
  const rentCents = integer(body.rentCents, "rentCents", 0, Number.MAX_SAFE_INTEGER);
  const chargesCents = integer(body.chargesCents, "chargesCents", 0, Number.MAX_SAFE_INTEGER, 0);
  const depositCents = integer(body.depositCents, "depositCents", 0, Number.MAX_SAFE_INTEGER, 0);
  const paymentDay = integer(body.paymentDay, "paymentDay", 1, 31);
  const requestedVersion = expectedVersion(body.expectedVersion);
  const now = Date.now();
  const status = endsOn && endsOn < today() ? "ended" : "active";

  try {
    return await transaction(async () => {
      const active = await db.prepare("SELECT * FROM leases WHERE property_id=? AND status='active'").get(property.id) as LeaseRow | undefined;
      if (active) {
        if (requestedVersion === null) failWorkflow(400, "expectedVersion est requis pour modifier le bail actif.");
        if (active.version !== requestedVersion) {
          failWorkflow(409, "Le bail a été modifié depuis votre dernière lecture.", "VERSION_CONFLICT", active.version);
        }
        if (active.tenant_id !== property.tenant_id) {
          failWorkflow(409, "Le bail actif appartient encore à l’ancien locataire. Il doit être clôturé avant de créer un nouveau bail.");
        }
        await db.prepare(`UPDATE leases SET owner_id=?,tenant_id=?,starts_on=?,ends_on=?,rent_cents=?,charges_cents=?,
            deposit_cents=?,payment_day=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=?`)
          .run(property.owner_id,property.tenant_id,startsOn,endsOn,rentCents,chargesCents,depositCents,paymentDay,status,now,active.id,requestedVersion);
        return await db.prepare("SELECT * FROM leases WHERE id=?").get(active.id) as LeaseRow;
      }

      const leaseId = id();
      await db.prepare(`INSERT INTO leases(id,property_id,owner_id,tenant_id,starts_on,ends_on,rent_cents,charges_cents,
          deposit_cents,payment_day,status,version,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?)`)
        .run(leaseId,property.id,property.owner_id,property.tenant_id,startsOn,endsOn,rentCents,chargesCents,depositCents,paymentDay,status,now,now);
      return await db.prepare("SELECT * FROM leases WHERE id=?").get(leaseId) as LeaseRow;
    });
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    if (error instanceof Error && /UNIQUE constraint failed: leases\.property_id/.test(error.message)) {
      failWorkflow(409, "Un bail actif existe déjà pour ce logement.");
    }
    throw error;
  }
}

export async function createRentPeriod(user: SessionUser, body: Record<string, unknown>) {
  if (user.role !== "owner") failWorkflow(403, "Réservé aux propriétaires.");
  const leaseId = text(body.leaseId, "leaseId", 200);
  const lease = await db.prepare("SELECT * FROM leases WHERE id=? AND owner_id=?").get(leaseId, user.id) as LeaseRow | undefined;
  if (!lease) failWorkflow(404, "Bail introuvable.");
  const period = periodValue(body.period);
  const dueOn = dateValue(body.dueOn, "dueOn", true) || dueOnFor(period, lease.payment_day);
  if (!dueOn.startsWith(`${period}-`)) failWorkflow(400, "La date d’échéance doit appartenir au mois demandé.");
  if (period < lease.starts_on.slice(0, 7) || (lease.ends_on && period > lease.ends_on.slice(0, 7))) {
    failWorkflow(400, "La période doit être comprise dans les dates du bail.");
  }
  const rentCents = lease.rent_cents;
  const chargesCents = lease.charges_cents;
  const totalCents = rentCents + chargesCents;
  if (!Number.isSafeInteger(totalCents)) failWorkflow(400, "Les montants du bail sont invalides.");
  const now = Date.now();

  try {
    return await transaction(async () => {
      const existing = await db.prepare("SELECT * FROM rent_periods WHERE lease_id=? AND period=?").get(lease.id,period);
      if (existing) failWorkflow(409, "Une période de loyer existe déjà pour ce bail.");
      const periodId = id();
      await db.prepare(`INSERT INTO rent_periods(id,lease_id,period,due_on,rent_cents,charges_cents,total_cents,status,paid_at,created_at,version)
        VALUES(?,?,?,?,?,?,?,'due',NULL,?,1)`)
        .run(periodId,lease.id,period,dueOn,rentCents,chargesCents,totalCents,now);
      return (await rentPeriodById(periodId))!;
    });
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    if (error instanceof Error && /UNIQUE constraint failed: rent_periods\.lease_id/.test(error.message)) {
      failWorkflow(409, "Une période de loyer existe déjà pour ce bail.");
    }
    throw error;
  }
}

export async function payRentPeriod(user: SessionUser, body: Record<string, unknown>) {
  if (user.role !== "owner") failWorkflow(403, "Réservé aux propriétaires.");
  const periodId = text(body.periodId, "periodId", 200);
  const paidOn = body.paidOn !== undefined && body.paidOn !== null && body.paidOn !== "" ? dateValue(body.paidOn, "paidOn") : null;
  return await transaction(async () => {
    const row = await db.prepare(`SELECT rent_periods.* FROM rent_periods JOIN leases ON leases.id=rent_periods.lease_id
      WHERE rent_periods.id=? AND leases.owner_id=?`).get(periodId,user.id) as RentPeriodRow | undefined;
    if (!row) failWorkflow(404, "Période de loyer introuvable.");
    if (row.status === "paid") return row;
    const now = paidOn ? Date.parse(`${paidOn}T12:00:00Z`) : Date.now();
    await db.prepare("UPDATE rent_periods SET status='paid',paid_at=?,version=version+1 WHERE id=? AND status='due'").run(now,row.id);
    return (await rentPeriodById(row.id))!;
  });
}

export async function propertyUploadContext(user: SessionUser, propertyIdValue: unknown, leaseIdValue: unknown): Promise<PropertyUploadContext> {
  const propertyId = text(propertyIdValue, "propertyId", 200);
  const property = await db.prepare("SELECT * FROM properties WHERE id=?").get(propertyId) as PropertyRow | undefined;
  if (!property) failWorkflow(404, "Logement introuvable.");
  const isOwner = user.role === "owner" && property.owner_id === user.id;
  const isCurrentTenant = user.role === "tenant" && property.tenant_id === user.id;
  if (!isOwner && !isCurrentTenant) failWorkflow(404, "Logement introuvable.");

  const leaseId = leaseIdValue === undefined || leaseIdValue === null || leaseIdValue === ""
    ? null
    : text(leaseIdValue, "leaseId", 200);
  if (!leaseId) {
    return { propertyId: property.id, leaseId: null, ownerId: property.owner_id, tenantId: property.tenant_id };
  }

  const lease = await leaseById(leaseId);
  if (!lease || lease.property_id !== property.id) failWorkflow(404, "Bail introuvable.");
  const isLeaseOwner = user.role === "owner" && lease.owner_id === user.id;
  const isLeaseTenant = user.role === "tenant" && lease.tenant_id === user.id && property.tenant_id === user.id;
  if (!isLeaseOwner && !isLeaseTenant) failWorkflow(404, "Bail introuvable.");
  return { propertyId: property.id, leaseId: lease.id, ownerId: lease.owner_id, tenantId: lease.tenant_id };
}

export async function insertPropertyDocuments(
  user: SessionUser,
  context: PropertyUploadContext,
  files: { id: string; diskName: string; name: string; mime: string; size: number }[],
) {
  return await transaction(async () => {
    const current = await propertyUploadContext(user, context.propertyId, context.leaseId);
    const now = Date.now();
    const rows: PropertyDocumentRow[] = [];
    const insert = await db.prepare(`INSERT INTO property_documents(id,property_id,lease_id,tenant_id,owner_id,name,mime,size,disk_name,uploaded_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    for (const file of files) {
      await insert.run(file.id,current.propertyId,current.leaseId,current.tenantId,current.ownerId,file.name,file.mime,file.size,file.diskName,user.id,now);
      rows.push(await db.prepare(`SELECT id, property_id, lease_id, name, mime, size, uploaded_by, created_at
        FROM property_documents WHERE id=?`).get(file.id) as PropertyDocumentRow);
    }
    return rows;
  });
}

export async function leaseDocumentForUser(user: SessionUser, documentId: string) {
  const document = await db.prepare("SELECT * FROM property_documents WHERE id=?").get(documentId) as PropertyDocumentRow | undefined;
  if (!document) failWorkflow(404, "Document introuvable.");
  if (document.lease_id) {
    const lease = await leaseById(document.lease_id);
    if (!lease || (lease.owner_id !== user.id && lease.tenant_id !== user.id)) failWorkflow(404, "Document introuvable.");
  } else if (document.owner_id !== user.id && document.tenant_id !== user.id) {
    failWorkflow(404, "Document introuvable.");
  }
  return document;
}
