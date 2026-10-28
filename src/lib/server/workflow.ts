import { createHash } from "node:crypto";
import { db, id, transaction } from "./db";

export type SessionUser = {id:string;name:string;email?:string;role:"owner"|"tenant"};
export type TicketRow = {
  id:string; property_id:string; creator_id:string; category:string; title:string; description:string;
  status:string; created_at:number; version:number; updated_at:number; owner_id:string; tenant_id:string;
};

export class WorkflowError extends Error {
  constructor(public status:number, message:string, public code?: string, public version?:number) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function failWorkflow(status:number, message:string, code?:string, version?:number): never {
  throw new WorkflowError(status, message, code, version);
}

const textValue = (value:unknown, field:string, maximum:number) => {
  if (typeof value !== "string" || !value.trim()) failWorkflow(400, `${field} est requis.`);
  const result = value.trim();
  if (result.length > maximum) failWorkflow(400, `${field} est trop long.`);
  return result;
};

const integerValue = (value:unknown, field:string, optional = false) => {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) failWorkflow(400, `${field} doit être un entier positif ou nul.`);
  return parsed;
};

const expectedVersionValue = (value:unknown, required = true) => {
  if ((value === undefined || value === null) && !required) return null;
  const parsed = integerValue(value, "expectedVersion");
  if (parsed === 0) failWorkflow(400, "expectedVersion est invalide.");
  return parsed;
};

const assertWritable = (ticket:TicketRow) => {
  if (ticket.status === "ferme" || ticket.status === "resolu") failWorkflow(409, "Ce ticket est en lecture seule. Utilisez reopen pour le reprendre.");
};

const assertExpectedVersion = (ticket:TicketRow, value:unknown, required = true) => {
  const expected = expectedVersionValue(value, required);
  if (expected !== null && expected !== ticket.version) {
    failWorkflow(409, "Le ticket a été modifié depuis votre dernière lecture.", "VERSION_CONFLICT", ticket.version);
  }
  return expected;
};

const touch = async (ticketId:string, now:number, status?:string) => {
  if (status) await db.prepare("UPDATE tickets SET status=?, version=version+1, updated_at=MAX(updated_at+1,?) WHERE id=?").run(status,now,ticketId);
  else await db.prepare("UPDATE tickets SET version=version+1, updated_at=MAX(updated_at+1,?) WHERE id=?").run(now,ticketId);
};

const emit = async (ticket:TicketRow, user:SessionUser, type:string, payload:Record<string,unknown>, now:number) => {
  await db.prepare("INSERT INTO ticket_events(ticket_id,actor_id,actor_role,type,payload,created_at) VALUES(?,?,?,?,?,?)")
    .run(ticket.id,user.id,user.role,type,JSON.stringify(payload),now);
};

const otherParty = (ticket:TicketRow, userId:string) => ticket.owner_id === userId ? ticket.tenant_id : ticket.owner_id;

const notify = async (ticket:TicketRow, user:SessionUser, message:string, now:number) => {
  const recipient = otherParty(ticket,user.id);
  if (recipient && recipient !== user.id) {
    await db.prepare("INSERT INTO notifications(id,user_id,ticket_id,text,read,created_at) VALUES(?,?,?,?,0,?)")
      .run(id(),recipient,ticket.id,message,now);
  }
};

export async function ticketForUser(userId:string, ticketId:string): Promise<TicketRow> {
  const ticket = await db.prepare(`SELECT tickets.*, ticket_parties.owner_id, ticket_parties.tenant_id
    FROM tickets JOIN ticket_parties ON ticket_parties.ticket_id=tickets.id
    WHERE tickets.id=? AND (ticket_parties.owner_id=? OR ticket_parties.tenant_id=?)`)
    .get(ticketId,userId,userId) as TicketRow | undefined;
  if (!ticket) failWorkflow(404, "Ticket introuvable.");
  return ticket;
}

const interventionRow = async (interventionId:string) => await db.prepare("SELECT * FROM interventions WHERE id=?").get(interventionId) as Record<string,unknown>|undefined;
const closureRow = async (requestId:string) => await db.prepare("SELECT *, requester_id AS requested_by FROM closure_requests WHERE id=?").get(requestId) as Record<string,unknown>|undefined;
const disputeRow = async (disputeId:string) => await db.prepare("SELECT * FROM disputes WHERE id=?").get(disputeId) as Record<string,unknown>|undefined;

const parseFileIds = (value:unknown) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) failWorkflow(400, "fileIds doit être un tableau.");
  if (value.length > 30) failWorkflow(400, "Trop de fichiers dans la demande.");
  const ids = value.map(item => {
    if (typeof item !== "string" || !item.trim()) failWorkflow(400, "fileIds contient un identifiant invalide.");
    return item.trim();
  });
  return Array.from(new Set(ids));
};

const closureSnapshot = (subject:string, conditions:string, amountCents:number|null, fileIds:string[]) => ({
  subject, conditions, amountCents, fileIds: [...fileIds].sort(),
});

const snapshotHash = (snapshot:ReturnType<typeof closureSnapshot>) =>
  createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

const activeIntervention = async (ticketId:string) => await db.prepare(`SELECT * FROM interventions
  WHERE ticket_id=? AND status IN ('proposed','accepted','awaiting_confirmation','contested')
  ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(ticketId) as Record<string,unknown>|undefined;

const pendingClosure = async (ticketId:string) => await db.prepare("SELECT * FROM closure_requests WHERE ticket_id=? AND status='pending' ORDER BY created_at DESC, rowid DESC LIMIT 1")
  .get(ticketId) as Record<string,unknown>|undefined;

const existingOpenDispute = async (ticketId:string) => await db.prepare("SELECT * FROM disputes WHERE ticket_id=? AND status='open' ORDER BY created_at DESC, rowid DESC LIMIT 1")
  .get(ticketId) as Record<string,unknown>|undefined;

const blockDuringClosure = async (ticketId:string) => {
  if (await pendingClosure(ticketId)) failWorkflow(409, "Une demande de clôture est en cours. Décidez de la demande existante avant de poursuivre.");
};

const assertTwoPartyProperty = async (ticket:TicketRow) => {
  const property = await db.prepare("SELECT tenant_id FROM properties WHERE id=?").get(ticket.property_id) as {tenant_id:string|null}|undefined;
  if (!property?.tenant_id) failWorkflow(409, "Le logement doit être relié à un locataire pour ce parcours.");
};

export async function createTicket(user:SessionUser, body:Record<string,unknown>) {
  const property = await db.prepare("SELECT * FROM properties WHERE id=? AND (owner_id=? OR tenant_id=?)")
    .get(String(body.propertyId || ""),user.id,user.id) as {id:string;owner_id:string;tenant_id:string|null}|undefined;
  if (!property) failWorkflow(404, "Logement introuvable.");
  if (!property.tenant_id) failWorkflow(409, "Le logement doit avoir un locataire avant la création d’un ticket.");
  const title = textValue(body.title,"Le titre",200);
  const description = textValue(body.description,"La description",20000);
  const category = String(body.category || "");
  if (!["reparation","desaccord","negociation","contrat","loyer","logement","autre"].includes(category)) failWorkflow(400, "Catégorie invalide.");
  const ticketId = id(), now = Date.now();
  await transaction(async () => {
    await db.prepare(`INSERT INTO tickets(id,property_id,creator_id,category,title,description,status,created_at,version,updated_at)
      VALUES(?,?,?,?,?,?,'ouvert',?,1,?)`).run(ticketId,property.id,user.id,category,title,description,now,now);
    await db.prepare("INSERT INTO ticket_parties(ticket_id,owner_id,tenant_id,created_at) VALUES(?,?,?,?)")
      .run(ticketId,property.owner_id,property.tenant_id,now);
    const ticket = await ticketForUser(user.id,ticketId);
    await emit(ticket,user,"ticket.created",{title,description,category,status:"ouvert"},now);
    await notify(ticket,user,`Nouveau ticket : ${title}`,now);
  });
  return {id:ticketId,version:1,status:"ouvert"};
}

export async function setGenericStatus(user:SessionUser, body:Record<string,unknown>) {
  const ticket = await ticketForUser(user.id,String(body.ticketId || ""));
  const status = String(body.status || "");
  if (!['en_cours','en_attente'].includes(status)) failWorkflow(400, "Ce statut ne peut pas être choisi manuellement.");
  assertWritable(ticket);
  assertExpectedVersion(ticket,body.expectedVersion,false);
  if (ticket.status === "en_litige" || ticket.status === "en_cloture" || await activeIntervention(ticket.id) || await pendingClosure(ticket.id) || await existingOpenDispute(ticket.id)) {
    failWorkflow(409, "Le statut ne peut pas être modifié pendant un workflow en cours.");
  }
  const now = Date.now();
  await transaction(async () => {
    await touch(ticket.id,now,status);
    await emit(ticket,user,"status.changed",{from:ticket.status,to:status},now);
    await notify(ticket,user,`Statut modifié : ${ticket.title}`,now);
  });
  return {ok:true,version:ticket.version + 1,status};
}

export async function addMessage(user:SessionUser, ticket:TicketRow, value:unknown) {
  assertWritable(ticket);
  const text = textValue(value,"Le message",5000);
  const messageId = id(), now = Date.now();
  await transaction(async () => {
    await db.prepare("INSERT INTO messages(id,ticket_id,author_id,body,created_at) VALUES(?,?,?,?,?)")
      .run(messageId,ticket.id,user.id,text,now);
    await touch(ticket.id,now);
    await emit(ticket,user,"message.created",{messageId,text},now);
    await notify(ticket,user,`Nouveau message : ${ticket.title}`,now);
  });
  return {id:messageId,version:ticket.version + 1};
}

export async function addFiles(user:SessionUser, ticket:TicketRow, messageId:string|null, interventionId:string|null, files:{id:string;name:string;mime:string;size:number;diskName:string}[]) {
  const now = Date.now();
  let version = ticket.version;
  await transaction(async () => {
    const current = await ticketForUser(user.id,ticket.id);
    assertWritable(current);
    version = current.version + 1;
    for (const file of files) {
      await db.prepare("INSERT INTO files(id,ticket_id,message_id,name,mime,size,disk_name,intervention_id) VALUES(?,?,?,?,?,?,?,?)")
        .run(file.id,ticket.id,messageId,file.name,file.mime,file.size,file.diskName,interventionId);
    }
    await touch(current.id,now);
    await emit(current,user,"file.uploaded",{fileIds:files.map(file => file.id),messageId,interventionId},now);
  });
  return {version};
}

export async function validateMessageAttachment(ticket:TicketRow, user:SessionUser, messageId:unknown) {
  if (!messageId) return null;
  if (typeof messageId !== "string" || !await db.prepare("SELECT id FROM messages WHERE id=? AND ticket_id=? AND author_id=?").get(messageId,ticket.id,user.id)) {
    failWorkflow(404, "Message introuvable.");
  }
  return messageId;
}

export async function validateInterventionAttachment(ticket:TicketRow, interventionId:unknown) {
  if (!interventionId) return null;
  if (typeof interventionId !== "string" || !await db.prepare("SELECT id FROM interventions WHERE id=? AND ticket_id=?").get(interventionId,ticket.id)) {
    failWorkflow(404, "Intervention introuvable.");
  }
  return interventionId;
}

export async function proposeIntervention(user:SessionUser, body:Record<string,unknown>) {
  const ticket = await ticketForUser(user.id,String(body.ticketId || ""));
  assertWritable(ticket);
  await assertTwoPartyProperty(ticket);
  if (user.role !== "owner" || ticket.owner_id !== user.id) failWorkflow(403, "Seul le propriétaire peut proposer une intervention.");
  await blockDuringClosure(ticket.id);
  const current = await activeIntervention(ticket.id);
  if (current && ["accepted","awaiting_confirmation"].includes(String(current.status))) {
    failWorkflow(409, "Une intervention est déjà engagée sur ce ticket.");
  }
  const artisanName = textValue(body.artisanName,"Le nom de l’artisan",200);
  const details = textValue(body.details,"Le détail de l’intervention",10000);
  const scheduledStart = integerValue(body.scheduledStart,"scheduledStart");
  const scheduledEnd = integerValue(body.scheduledEnd,"scheduledEnd");
  if (!scheduledStart || !scheduledEnd || scheduledEnd < scheduledStart) failWorkflow(400, "La plage horaire de l’intervention est invalide.");
  const priceCents = integerValue(body.priceCents,"priceCents");
  const interventionId = id(), now = Date.now();
  await transaction(async () => {
    await db.prepare(`INSERT INTO interventions(id,ticket_id,proposed_by,artisan_name,details,scheduled_start,scheduled_end,price_cents,status,version,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,'proposed',1,?,?)`)
      .run(interventionId,ticket.id,user.id,artisanName,details,scheduledStart,scheduledEnd,priceCents,now,now);
    if (current && ["proposed","contested"].includes(String(current.status))) {
      await db.prepare("UPDATE interventions SET status='superseded', superseded_by=?, version=version+1, updated_at=? WHERE id=?")
        .run(interventionId,now,current.id);
      await emit(ticket,user,"intervention.superseded",{interventionId:current.id,supersededBy:interventionId},now);
    }
    await touch(ticket.id,now,"en_cours");
    await emit(ticket,user,"intervention.proposed",{interventionId,artisanName,details,scheduledStart,scheduledEnd,priceCents},now);
    await notify(ticket,user,`Nouvelle intervention proposée : ${ticket.title}`,now);
  });
  return {id:interventionId,intervention:await interventionRow(interventionId),version:ticket.version + 1};
}

export async function decideIntervention(user:SessionUser, body:Record<string,unknown>) {
  const intervention = await interventionRow(String(body.interventionId || ""));
  if (!intervention) failWorkflow(404, "Intervention introuvable.");
  const ticket = await ticketForUser(user.id,String(intervention.ticket_id));
  assertWritable(ticket);
  await assertTwoPartyProperty(ticket);
  if (user.role !== "tenant" || ticket.tenant_id !== user.id) failWorkflow(403, "Seul le locataire peut répondre à l’intervention.");
  await blockDuringClosure(ticket.id);
  assertExpectedVersion(ticket,body.expectedVersion);
  if (intervention.status !== "proposed") failWorkflow(409, "Cette proposition d’intervention n’est plus décidable.");
  const decision = String(body.decision || "");
  if (!['accept','refuse'].includes(decision)) failWorkflow(400, "Décision d’intervention invalide.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0,5000) : "";
  const now = Date.now(), status = decision === "accept" ? "accepted" : "refused";
  await transaction(async () => {
    await db.prepare("UPDATE interventions SET status=?, decision_reason=?, version=version+1, updated_at=?, accepted_at=? WHERE id=?")
      .run(status,reason || null,now,decision === "accept" ? now : null,intervention.id);
    await touch(ticket.id,now,"en_cours");
    await emit(ticket,user,decision === "accept" ? "intervention.accepted" : "intervention.refused",{interventionId:intervention.id,reason},now);
    await notify(ticket,user,`Intervention ${decision === "accept" ? "acceptée" : "refusée"} : ${ticket.title}`,now);
  });
  return {ok:true,id:intervention.id,intervention:await interventionRow(String(intervention.id)),version:ticket.version + 1};
}

export async function completeIntervention(user:SessionUser, body:Record<string,unknown>) {
  const intervention = await interventionRow(String(body.interventionId || ""));
  if (!intervention) failWorkflow(404, "Intervention introuvable.");
  const ticket = await ticketForUser(user.id,String(intervention.ticket_id));
  assertWritable(ticket);
  await assertTwoPartyProperty(ticket);
  if (user.role !== "owner" || ticket.owner_id !== user.id) failWorkflow(403, "Seul le propriétaire peut terminer l’intervention.");
  await blockDuringClosure(ticket.id);
  assertExpectedVersion(ticket,body.expectedVersion);
  if (!["accepted","contested"].includes(String(intervention.status))) failWorkflow(409, "L’intervention doit être acceptée ou contestée avant sa clôture.");
  const report = textValue(body.report,"Le compte rendu",10000);
  const now = Date.now();
  await transaction(async () => {
    await db.prepare("UPDATE interventions SET status='awaiting_confirmation', report=?, version=version+1, updated_at=?, completed_at=? WHERE id=?")
      .run(report,now,now,intervention.id);
    await touch(ticket.id,now,"en_attente");
    await emit(ticket,user,"intervention.completed",{interventionId:intervention.id,report},now);
    await notify(ticket,user,`Intervention terminée, confirmation attendue : ${ticket.title}`,now);
  });
  return {ok:true,id:intervention.id,intervention:await interventionRow(String(intervention.id)),version:ticket.version + 1};
}

export async function confirmIntervention(user:SessionUser, body:Record<string,unknown>) {
  const intervention = await interventionRow(String(body.interventionId || ""));
  if (!intervention) failWorkflow(404, "Intervention introuvable.");
  const ticket = await ticketForUser(user.id,String(intervention.ticket_id));
  assertWritable(ticket);
  await assertTwoPartyProperty(ticket);
  if (user.role !== "tenant" || ticket.tenant_id !== user.id) failWorkflow(403, "Seul le locataire peut confirmer l’intervention.");
  await blockDuringClosure(ticket.id);
  assertExpectedVersion(ticket,body.expectedVersion);
  if (intervention.status !== "awaiting_confirmation") failWorkflow(409, "Cette intervention n’attend pas de confirmation.");
  const decision = String(body.decision || "");
  if (!['confirm','contest'].includes(decision)) failWorkflow(400, "Décision de confirmation invalide.");
  const reason = decision === "contest" ? textValue(body.reason,"Le motif de contestation",5000) : (typeof body.reason === "string" ? body.reason.trim().slice(0,5000) : "");
  const now = Date.now(), status = decision === "confirm" ? "confirmed" : "contested";
  await transaction(async () => {
    await db.prepare("UPDATE interventions SET status=?, contested_reason=?, decision_reason=?, version=version+1, updated_at=?, confirmed_at=? WHERE id=?")
      .run(status,decision === "contest" ? reason : null,reason || null,now,decision === "confirm" ? now : null,intervention.id);
    await touch(ticket.id,now,"en_cours");
    await emit(ticket,user,decision === "confirm" ? "intervention.confirmed" : "intervention.contested",{interventionId:intervention.id,reason},now);
    await notify(ticket,user,`Intervention ${decision === "confirm" ? "confirmée" : "contestée"} : ${ticket.title}`,now);
  });
  return {ok:true,id:intervention.id,intervention:await interventionRow(String(intervention.id)),version:ticket.version + 1};
}

export async function requestClosure(user:SessionUser, body:Record<string,unknown>) {
  const ticket = await ticketForUser(user.id,String(body.ticketId || ""));
  assertWritable(ticket);
  await assertTwoPartyProperty(ticket);
  if (await activeIntervention(ticket.id)) failWorkflow(409, "Une intervention doit être confirmée ou refusée avant la clôture.");
  assertExpectedVersion(ticket,body.expectedVersion,false);
  const subject = textValue(body.subject,"L’objet de la clôture",500);
  const conditions = textValue(body.conditions,"Les conditions de la clôture",20000);
  const amountCents = integerValue(body.amountCents,"amountCents",true);
  const fileIds = parseFileIds(body.fileIds);
  for (const fileId of fileIds) {
    if (!await db.prepare("SELECT id FROM files WHERE id=? AND ticket_id=?").get(fileId,ticket.id)) failWorkflow(400, "Un fichier de la clôture n’appartient pas au ticket.");
  }
  const snapshot = closureSnapshot(subject,conditions,amountCents,fileIds);
  const payloadHash = snapshotHash(snapshot);
  const requestId = id(), now = Date.now();
  await transaction(async () => {
    const previous = await pendingClosure(ticket.id);
    if (previous) {
      await db.prepare("UPDATE closure_requests SET status='superseded' WHERE ticket_id=? AND status='pending'").run(ticket.id);
      await emit(ticket,user,"closure.superseded",{requestId:previous.id,supersededBy:requestId},now);
    }
    await db.prepare(`INSERT INTO closure_requests(id,ticket_id,requester_id,subject,conditions,amount_cents,file_ids,payload_hash,version,expected_version,status,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?)`)
      .run(requestId,ticket.id,user.id,subject,conditions,amountCents,JSON.stringify(fileIds),payloadHash,ticket.version,ticket.version,now);
    await touch(ticket.id,now,"en_cloture");
    await emit(ticket,user,"closure.requested",{requestId,subject,conditions,amountCents,fileIds,hash:payloadHash,version:ticket.version},now);
    await notify(ticket,user,`Clôture demandée : ${ticket.title}`,now);
  });
  return {id:requestId,closure:serializeClosure(await closureRow(requestId)),version:ticket.version + 1};
}

export async function decideClosure(user:SessionUser, body:Record<string,unknown>) {
  const request = await closureRow(String(body.requestId || ""));
  if (!request) failWorkflow(404, "Demande de clôture introuvable.");
  const ticket = await ticketForUser(user.id,String(request.ticket_id));
  assertWritable(ticket);
  await assertTwoPartyProperty(ticket);
  if (request.requester_id === user.id) failWorkflow(403, "La partie qui a demandé la clôture ne peut pas décider seule.");
  assertExpectedVersion(ticket,body.expectedVersion);
  if (request.status !== "pending" || ticket.status !== "en_cloture") failWorkflow(409, "Cette demande de clôture n’est plus active.");
  const decision = String(body.decision || "");
  if (!['accept','refuse'].includes(decision)) failWorkflow(400, "Décision de clôture invalide.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0,5000) : "";
  const now = Date.now();
  let agreement:Record<string,unknown>|undefined;
  await transaction(async () => {
    if (decision === "accept") {
      const agreementId = id();
      await db.prepare(`INSERT INTO agreements(id,ticket_id,closure_request_id,subject,conditions,amount_cents,file_ids,payload_hash,accepted_by,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(agreementId,ticket.id,request.id,request.subject,request.conditions,request.amount_cents ?? null,request.file_ids,request.payload_hash,user.id,now);
      await db.prepare("UPDATE closure_requests SET status='accepted', decided_by=?, decision_reason=?, decided_at=? WHERE id=?")
        .run(user.id,reason || null,now,request.id);
      const disputeToResolve = await existingOpenDispute(ticket.id);
      if (disputeToResolve) {
        await db.prepare("UPDATE disputes SET status='resolved', resolved_by=?, resolution='closure_accepted', updated_at=?, resolved_at=? WHERE ticket_id=? AND status='open'")
          .run(user.id,now,now,ticket.id);
      }
      await touch(ticket.id,now,"ferme");
      await emit(ticket,user,"closure.accepted",{requestId:request.id,agreementId,reason},now);
      if (disputeToResolve) await emit(ticket,user,"dispute.resolved",{disputeId:disputeToResolve.id,resolution:"closure_accepted"},now);
      await notify(ticket,user,`Clôture acceptée : ${ticket.title}`,now);
      agreement = await db.prepare("SELECT * FROM agreements WHERE id=?").get(agreementId) as Record<string,unknown>;
    } else {
      await db.prepare("UPDATE closure_requests SET status='refused', decided_by=?, decision_reason=?, decided_at=? WHERE id=?")
        .run(user.id,reason || null,now,request.id);
      await touch(ticket.id,now,"en_cours");
      await emit(ticket,user,"closure.refused",{requestId:request.id,reason},now);
      await notify(ticket,user,`Clôture refusée : ${ticket.title}`,now);
    }
  });
  return {ok:true,id:request.id,closure:serializeClosure(await closureRow(String(request.id))),...(agreement ? {agreement:serializeAgreement(agreement)} : {}),version:ticket.version + 1};
}

export async function openDispute(user:SessionUser, body:Record<string,unknown>) {
  const ticket = await ticketForUser(user.id,String(body.ticketId || ""));
  assertWritable(ticket);
  await assertTwoPartyProperty(ticket);
  await blockDuringClosure(ticket.id);
  if (await existingOpenDispute(ticket.id)) failWorkflow(409, "Un litige est déjà ouvert sur ce ticket.");
  const description = textValue(body.description,"La description du litige",20000);
  const disputeId = id(), now = Date.now();
  await transaction(async () => {
    await db.prepare(`INSERT INTO disputes(id,ticket_id,opened_by,description,status,created_at,updated_at)
      VALUES(?,?,?,?,'open',?,?)`).run(disputeId,ticket.id,user.id,description,now,now);
    await touch(ticket.id,now,"en_litige");
    await emit(ticket,user,"dispute.opened",{disputeId,description},now);
    await notify(ticket,user,`Litige ouvert : ${ticket.title}`,now);
  });
  return {id:disputeId,dispute:await disputeRow(disputeId),version:ticket.version + 1};
}

export async function withdrawDispute(user:SessionUser, body:Record<string,unknown>) {
  const dispute = await disputeRow(String(body.disputeId || ""));
  if (!dispute) failWorkflow(404, "Litige introuvable.");
  const ticket = await ticketForUser(user.id,String(dispute.ticket_id));
  assertWritable(ticket);
  await assertTwoPartyProperty(ticket);
  if (dispute.opened_by !== user.id) failWorkflow(403, "Seul l’auteur du litige peut le retirer.");
  if (dispute.status !== "open") failWorkflow(409, "Ce litige n’est plus ouvert.");
  const now = Date.now();
  await transaction(async () => {
    await db.prepare("UPDATE disputes SET status='withdrawn', withdrawn_by=?, withdrawn_at=?, updated_at=? WHERE id=?")
      .run(user.id,now,now,dispute.id);
    await touch(ticket.id,now,"en_cours");
    await emit(ticket,user,"dispute.withdrawn",{disputeId:dispute.id},now);
    await notify(ticket,user,`Litige retiré : ${ticket.title}`,now);
  });
  return {ok:true,id:dispute.id,dispute:await disputeRow(String(dispute.id)),version:ticket.version + 1};
}

export async function reopenTicket(user:SessionUser, body:Record<string,unknown>) {
  const ticket = await ticketForUser(user.id,String(body.ticketId || ""));
  if (ticket.status !== "ferme" && ticket.status !== "resolu") failWorkflow(409, "Seul un ticket fermé ou historique résolu peut être réouvert.");
  const reason = textValue(body.reason,"Le motif de réouverture",5000);
  const now = Date.now();
  await transaction(async () => {
    await touch(ticket.id,now,"ouvert");
    await emit(ticket,user,"ticket.reopened",{reason,previousStatus:ticket.status},now);
    await notify(ticket,user,`Ticket réouvert : ${ticket.title}`,now);
  });
  return {ok:true,id:ticket.id,version:ticket.version + 1,status:"ouvert"};
}

const parseStoredFileIds = (value:unknown) => {
  try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};

export async function ticketEvents(user:SessionUser, ticketId:string, searchParams:URLSearchParams) {
  await ticketForUser(user.id,ticketId);
  const afterSeqNumber = Number(searchParams.get("afterSeq") || 0);
  const limitNumber = Number(searchParams.get("limit") || 50);
  if (!Number.isSafeInteger(afterSeqNumber) || afterSeqNumber < 0) failWorkflow(400, "afterSeq est invalide.");
  if (!Number.isSafeInteger(limitNumber) || limitNumber < 1 || limitNumber > 200) failWorkflow(400, "limit doit être comprise entre 1 et 200.");
  const rows = await db.prepare(`SELECT ticket_events.seq, ticket_events.ticket_id, ticket_events.actor_id, ticket_events.actor_role,
      ticket_events.type, ticket_events.payload, ticket_events.created_at, users.name AS actor_name
    FROM ticket_events JOIN users ON users.id=ticket_events.actor_id
    WHERE ticket_events.ticket_id=? AND ticket_events.seq>? ORDER BY ticket_events.seq LIMIT ?`)
    .all(ticketId,afterSeqNumber,limitNumber + 1) as Record<string,unknown>[];
  const hasMore = rows.length > limitNumber;
  const events: Record<string,unknown>[] = rows.slice(0,limitNumber).map(row => {
    let payload:unknown = {};
    try { payload = JSON.parse(String(row.payload)); } catch { payload = {}; }
    return {...row,payload};
  });
  const nextAfterSeq = events.length ? Number(events[events.length - 1].seq) : afterSeqNumber;
  return {events,items:events,afterSeq:afterSeqNumber,limit:limitNumber,nextAfterSeq,hasMore};
}

export async function buildState(user:SessionUser, propertyId?: string) {
  return await transaction(async () => {
  const currentDay = new Date().toISOString().slice(0, 10);
  await db.prepare("UPDATE leases SET status='ended',version=version+1,updated_at=? WHERE status='active' AND ends_on IS NOT NULL AND ends_on< ?")
    .run(Date.now(), currentDay);
  if (propertyId) {
    const allowed = await db.prepare("SELECT id FROM properties WHERE id=? AND (owner_id=? OR tenant_id=?)")
      .get(propertyId,user.id,user.id);
    if (!allowed) failWorkflow(404, "Logement introuvable.");
  }
  const properties = await db.prepare(`SELECT properties.id,address,owner_id,tenant_id,owner.name AS owner_name,tenant.name AS tenant_name
    FROM properties JOIN users owner ON owner.id=properties.owner_id LEFT JOIN users tenant ON tenant.id=properties.tenant_id
    WHERE owner_id=? OR tenant_id=? ORDER BY properties.rowid DESC`).all(user.id,user.id);
  const tickets = await db.prepare(`SELECT tickets.*, properties.address,
      ticket_parties.owner_id, ticket_parties.tenant_id,
      creator.name AS creator_name, creator.role AS creator_role,
      owner.name AS owner_name, tenant.name AS tenant_name
    FROM tickets
    JOIN ticket_parties ON ticket_parties.ticket_id=tickets.id
    JOIN properties ON properties.id=tickets.property_id
    JOIN users creator ON creator.id=tickets.creator_id
    JOIN users owner ON owner.id=ticket_parties.owner_id
    JOIN users tenant ON tenant.id=ticket_parties.tenant_id
    WHERE (ticket_parties.owner_id=? OR ticket_parties.tenant_id=?)
      ${propertyId ? "AND tickets.property_id=?" : ""}
    ORDER BY tickets.created_at DESC`).all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id]));
  const messages = await db.prepare(`SELECT messages.id, messages.ticket_id, messages.author_id, messages.body AS text,
      messages.created_at, users.name AS author_name, users.role AS author_role
    FROM messages JOIN users ON users.id=messages.author_id
    JOIN tickets ON tickets.id=messages.ticket_id
    JOIN ticket_parties ON ticket_parties.ticket_id=messages.ticket_id
    WHERE (ticket_parties.owner_id=? OR ticket_parties.tenant_id=?)
      ${propertyId ? "AND tickets.property_id=?" : ""}
    ORDER BY messages.created_at`).all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id]));
  const files = await db.prepare(`SELECT files.id,files.ticket_id,files.message_id,files.intervention_id,files.name,files.mime,files.size,files.created_at
    FROM files JOIN tickets ON tickets.id=files.ticket_id
    JOIN ticket_parties ON ticket_parties.ticket_id=files.ticket_id
    WHERE (ticket_parties.owner_id=? OR ticket_parties.tenant_id=?)
      ${propertyId ? "AND tickets.property_id=?" : ""}`).all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id]));
  const interventions = await db.prepare(`SELECT interventions.* FROM interventions
    JOIN tickets ON tickets.id=interventions.ticket_id
    JOIN ticket_parties ON ticket_parties.ticket_id=interventions.ticket_id
    WHERE (ticket_parties.owner_id=? OR ticket_parties.tenant_id=?)
      ${propertyId ? "AND tickets.property_id=?" : ""}
    ORDER BY interventions.created_at`).all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id]));
  const closures = (await db.prepare(`SELECT closure_requests.*, closure_requests.requester_id AS requested_by,
      closure_requests.created_at AS requested_at FROM closure_requests
    JOIN tickets ON tickets.id=closure_requests.ticket_id
    JOIN ticket_parties ON ticket_parties.ticket_id=closure_requests.ticket_id
    WHERE (ticket_parties.owner_id=? OR ticket_parties.tenant_id=?)
      ${propertyId ? "AND tickets.property_id=?" : ""}
    ORDER BY closure_requests.created_at`).all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id])) as Record<string,unknown>[])
    .map(row => ({...row,file_ids:parseStoredFileIds(row.file_ids),hash:row.payload_hash}));
  const agreements = (await db.prepare(`SELECT agreements.*, closure_requests.requester_id AS requested_by,
      closure_requests.created_at AS requested_at, agreements.created_at AS accepted_at,
      requester.name AS requester_name,
      acceptor.name AS accepted_by_name
    FROM agreements
    JOIN closure_requests ON closure_requests.id=agreements.closure_request_id
    JOIN users requester ON requester.id=closure_requests.requester_id
    JOIN users acceptor ON acceptor.id=agreements.accepted_by
    JOIN tickets ON tickets.id=agreements.ticket_id
    JOIN ticket_parties ON ticket_parties.ticket_id=agreements.ticket_id
    WHERE (ticket_parties.owner_id=? OR ticket_parties.tenant_id=?)
      ${propertyId ? "AND tickets.property_id=?" : ""}
    ORDER BY agreements.created_at`).all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id])) as Record<string,unknown>[])
    .map(row => ({...row,file_ids:parseStoredFileIds(row.file_ids),hash:row.payload_hash}));
  const disputes = await db.prepare(`SELECT disputes.* FROM disputes
    JOIN tickets ON tickets.id=disputes.ticket_id
    JOIN ticket_parties ON ticket_parties.ticket_id=disputes.ticket_id
    WHERE (ticket_parties.owner_id=? OR ticket_parties.tenant_id=?)
      ${propertyId ? "AND tickets.property_id=?" : ""}
    ORDER BY disputes.created_at`).all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id]));
  const notifications = await db.prepare(`SELECT notifications.id, notifications.ticket_id, notifications.text AS title,
      CASE WHEN notifications.text LIKE 'Nouveau message%' THEN 'message'
        WHEN notifications.text LIKE '%fichier%' OR notifications.text LIKE '%document%' THEN 'document'
        ELSE 'ticket' END AS event_type,
      notifications.read, notifications.created_at FROM notifications
    JOIN tickets ON tickets.id=notifications.ticket_id
    WHERE notifications.user_id=? ${propertyId ? "AND tickets.property_id=?" : ""}
    ORDER BY notifications.created_at DESC`).all(...(propertyId ? [user.id,propertyId] : [user.id]));
  const invitations = user.role === "owner" ? await db.prepare(`SELECT code,property_id,expires,used_at FROM invitations
    WHERE property_id IN (SELECT id FROM properties WHERE owner_id=?) ${propertyId ? "AND property_id=?" : ""}`)
    .all(...(propertyId ? [user.id,propertyId] : [user.id])) : [];
  const leases = await db.prepare(`SELECT * FROM leases WHERE (owner_id=? OR tenant_id=?)
    ${propertyId ? "AND property_id=?" : ""} ORDER BY created_at DESC`)
    .all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id]));
  const rentPeriods = await db.prepare(`SELECT rent_periods.* FROM rent_periods JOIN leases ON leases.id=rent_periods.lease_id
    WHERE (leases.owner_id=? OR leases.tenant_id=?)
    ${propertyId ? "AND leases.property_id=?" : ""} ORDER BY rent_periods.period DESC, rent_periods.created_at DESC`)
    .all(...(propertyId ? [user.id,user.id,propertyId] : [user.id,user.id]));
  const propertyDocuments = await db.prepare(`SELECT property_documents.id, property_documents.property_id,
      property_documents.lease_id, property_documents.name, property_documents.mime,
      property_documents.size, property_documents.uploaded_by, property_documents.created_at
    FROM property_documents
    LEFT JOIN leases ON leases.id=property_documents.lease_id
    WHERE ((leases.id IS NOT NULL AND (leases.owner_id=? OR leases.tenant_id=?))
      OR (leases.id IS NULL AND (property_documents.owner_id=? OR property_documents.tenant_id=?)))
      ${propertyId ? "AND property_documents.property_id=?" : ""}
    ORDER BY property_documents.created_at DESC`)
    .all(...(propertyId ? [user.id,user.id,user.id,user.id,propertyId] : [user.id,user.id,user.id,user.id]));
  return {user,properties,activePropertyId:propertyId || null,tickets,messages,files,notifications,invitations,
    interventions,closures,agreements,disputes,leases,rent_periods:rentPeriods,property_documents:propertyDocuments};
  });
}

export function serializeClosure(row:Record<string,unknown>|undefined) {
  return row ? {...row,file_ids:parseStoredFileIds(row.file_ids),hash:row.payload_hash,requested_at:row.created_at} : row;
}

export function serializeAgreement(row:Record<string,unknown>|undefined) {
  return row ? {...row,file_ids:parseStoredFileIds(row.file_ids),hash:row.payload_hash} : row;
}
