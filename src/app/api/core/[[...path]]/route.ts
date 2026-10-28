import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db, hash, id, invitation, tokenHash, userFromToken, verify, transaction, ready } from "@/lib/server/db";
import {
  WorkflowError, addFiles, addMessage, buildState, completeIntervention, confirmIntervention,
  createTicket, decideClosure, decideIntervention, openDispute, proposeIntervention,
  reopenTicket, requestClosure, setGenericStatus, ticketEvents, ticketForUser,
  validateInterventionAttachment, validateMessageAttachment, withdrawDispute,
} from "@/lib/server/workflow";
import {
  createRentPeriod, insertPropertyDocuments, leaseDocumentForUser, payRentPeriod,
  propertyUploadContext, saveLease,
} from "@/lib/server/leases";
import { readStoredFile, removeStoredFile, storeFile } from "@/lib/server/storage";
import { documentMimeFor, DOCUMENT_MAX_BYTES } from "@/lib/document-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const session = async (req: NextRequest) => await userFromToken(req.cookies.get("liaison_session")?.value);
const json = async (req: NextRequest) => { try { const value = await req.json(); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } };
const rateBuckets = new Map<string, { count: number; reset: number }>();
function rateLimited(req: NextRequest, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [key, bucket] of rateBuckets) if (bucket.reset <= now) rateBuckets.delete(key);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${scope}:${ip}`;
  const current = rateBuckets.get(key);
  if (!current || current.reset <= now) {
    rateBuckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}
const validFileSignature = (mime: string, bytes: Buffer) =>
  mime === "application/pdf" ? bytes.subarray(0,5).toString() === "%PDF-"
    : mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === "image/png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : mime === "image/webp" && bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP";
async function setSession(response: NextResponse, userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
  await db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(tokenHash(token), userId, Date.now() + 30 * 86400000);
  response.cookies.set("liaison_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 30 * 86400 });
  return response;
}
async function propertyFor(userId: string, propertyId: string) {
  return await db.prepare("SELECT * FROM properties WHERE id=? AND (owner_id=? OR tenant_id=?)").get(propertyId, userId, userId) as {id:string;owner_id:string;tenant_id:string|null;address:string}|undefined;
}
async function dispatch(req: NextRequest, parts: string[]) {
  const action = parts[0] || "";
  const body = (req.method === "POST" || req.method === "PATCH") && action !== "upload" && action !== "lease-upload" ? await json(req) : {};
  if (action === "signup" && req.method === "POST") {
    if (rateLimited(req, "signup", 5, 60 * 60 * 1000)) return fail("Trop de tentatives. Réessayez plus tard.", 429);
    const {name,email,password,role} = body;
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 120 || typeof email !== "string" || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== "string" || password.length < 8 || password.length > 256 || !["owner","tenant"].includes(role)) return fail("Nom, e-mail, rôle et mot de passe de 8 caractères minimum requis.");
    const userId = id();
    try { await db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(userId,name.trim(),email.trim().toLowerCase(),hash(password),role); } catch { return fail("Cette adresse e-mail est déjà utilisée.",409); }
    return await setSession(NextResponse.json({ok:true}),userId);
  }
  if (action === "login" && req.method === "POST") {
    if (rateLimited(req, "login", 8, 15 * 60 * 1000)) return fail("Trop de tentatives. Réessayez dans quelques minutes.", 429);
    if (typeof body.email !== "string" || typeof body.password !== "string" || body.password.length > 256) return fail("Identifiants incorrects.",401);
    const user = await db.prepare("SELECT * FROM users WHERE email=?").get(String(body.email || "").trim().toLowerCase()) as {id:string;password:string}|undefined;
    if (!user || !verify(String(body.password || ""),user.password)) return fail("Identifiants incorrects.",401);
    return await setSession(NextResponse.json({ok:true}),user.id);
  }
  if (action === "logout" && req.method === "POST") {
    const token = req.cookies.get("liaison_session")?.value;
    if (token) await db.prepare("DELETE FROM sessions WHERE token=?").run(tokenHash(token));
    const response = NextResponse.json({ok:true}); response.cookies.delete("liaison_session"); return response;
  }
  if (action === "invitation" && (req.method === "POST" || req.method === "GET")) {
    if (rateLimited(req, "invitation", 30, 60 * 1000)) return fail("Trop de tentatives. Réessayez dans une minute.", 429);
    const code = String(body.code || parts[1] || req.nextUrl.searchParams.get("code") || "");
    const result = await lookupInvite(code);
    if (result instanceof NextResponse) return result;
    return NextResponse.json({address:result.address,expires:result.expires});
  }
  const user = await session(req);
  if (!user) return fail("Connectez-vous pour continuer.",401);
  if (action === "state" && req.method === "GET") {
    const propertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
    return NextResponse.json(await buildState(user,propertyId));
  }
  if (action === "property" && req.method === "POST") {
    if (user.role !== "owner") return fail("Réservé aux propriétaires.",403);
    const address = String(body.address || "").trim(); if (address.length < 5 || address.length > 500) return fail("Indiquez l’adresse du logement.");
    const propertyId = id();
    const code = await transaction(async () => {
      await db.prepare("INSERT INTO properties(id,owner_id,address) VALUES(?,?,?)").run(propertyId,user.id,address);
      return await invitation(propertyId);
    }); return NextResponse.json({propertyId,...await inviteDetails(req,code)});
  }
  if (action === "renew" && req.method === "POST") {
    const property = await propertyFor(user.id,String(body.propertyId || "")); if (!property || property.owner_id !== user.id) return fail("Logement introuvable.",404);
    if (property.tenant_id) return fail("Ce logement a déjà un locataire.",409);
    return NextResponse.json(await inviteDetails(req,await transaction(async () => await invitation(property.id))));
  }
  if (action === "join" && req.method === "POST") {
    if (rateLimited(req, "join", 10, 15 * 60 * 1000)) return fail("Trop de tentatives. Réessayez plus tard.", 429);
    if (user.role !== "tenant") return fail("Réservé aux locataires.",403);
    const code = String(body.code || ""); if (!/^\d{6}$/.test(code)) return fail("Saisissez un code à 6 chiffres.");
    const invite = await lookupInvite(code);
    if (invite instanceof NextResponse) return invite;
    try {
      await transaction(async () => {
        const claimed = await db.prepare("UPDATE invitations SET used_at=? WHERE code=? AND used_at IS NULL AND expires>?").run(Date.now(),code,Date.now());
        if (!claimed.changes) throw new Error("Invitation unavailable");
        const linked = await db.prepare("UPDATE properties SET tenant_id=? WHERE id=? AND tenant_id IS NULL").run(user.id,invite.property_id);
        if (!linked.changes) throw new Error("Property occupied");
      });
    } catch { return fail("Ce code est déjà utilisé ou le logement n’est plus disponible.",409); }
    return NextResponse.json({address:invite.address});
  }
  if (action === "lease" && req.method === "POST" && parts[1] === "save") {
    return NextResponse.json(await saveLease(user,body));
  }
  if (action === "rent" && req.method === "POST" && parts[1] === "period") {
    return NextResponse.json(await createRentPeriod(user,body));
  }
  if (action === "rent" && req.method === "POST" && parts[1] === "pay") {
    return NextResponse.json(await payRentPeriod(user,body));
  }
  if (action === "lease-upload" && req.method === "GET") {
    return NextResponse.json({
      direct: Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) && Boolean(process.env.BLOB_WEBHOOK_PUBLIC_KEY),
    });
  }
  if (action === "lease-upload" && req.method === "POST") {
    const form = await req.formData();
    const items = form.getAll("files");
    if (items.length < 1 || items.length > 5) return fail("Joignez entre 1 et 5 fichiers.");
    const uploadContext = await propertyUploadContext(user,form.get("propertyId"),form.get("leaseId"));
    const validFiles: {item:File;mime:string}[] = [];
    for (const item of items) {
      if (!(item instanceof File) || item.size === 0 || item.size > DOCUMENT_MAX_BYTES) return fail("Formats acceptés : JPG, PNG, WebP, PDF ; 10 Mo maximum par fichier.");
      const mime = documentMimeFor(item.name,item.type);
      if (!mime) return fail("Formats acceptés : JPG, PNG, WebP, PDF ; 10 Mo maximum par fichier.");
      validFiles.push({item,mime});
    }
    const prepared: {id:string;diskName:string;name:string;mime:string;size:number;item:File}[] = [];
    try {
      for (const {item,mime} of validFiles) {
        const bytes = Buffer.from(await item.arrayBuffer());
        if (!validFileSignature(mime,bytes)) throw new Error("INVALID_FILE");
        const fileId = id(), diskName = id();
        await storeFile(diskName,bytes,mime);
        prepared.push({id:fileId,diskName,name:item.name.slice(0,200),mime,size:item.size,item});
      }
      const documents = await insertPropertyDocuments(user,uploadContext,prepared.map(({item,...file}) => file));
      return NextResponse.json({files:documents.map(document => document.id),documents});
    } catch (error) {
      await Promise.all(prepared.map(({diskName}) => removeStoredFile(diskName)));
      if (error instanceof Error && error.message === "INVALID_FILE") return fail("Le contenu du fichier ne correspond pas à son format.");
      throw error;
    }
  }
  if (action === "lease-upload-complete" && req.method === "POST") {
    const entries = (body as {files?:unknown}).files;
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 5) return fail("Joignez entre 1 et 5 fichiers.");
    const prepared: {id:string;diskName:string;name:string;mime:string;size:number}[] = [];
    try {
      const uploadContext = await propertyUploadContext(user,(body as {propertyId?:unknown}).propertyId,(body as {leaseId?:unknown}).leaseId);
      for (const entry of entries) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new WorkflowError(400, "Métadonnées du document invalides.");
        const file = entry as Record<string,unknown>;
        const name = typeof file.name === "string" ? file.name.trim().slice(0,200) : "";
        const diskName = typeof file.diskName === "string" ? file.diskName : "";
        const size = typeof file.size === "number" ? file.size : NaN;
        const mime = documentMimeFor(name,typeof file.mime === "string" ? file.mime : null);
        if (!name || !/^[a-f0-9]{32}$/i.test(diskName) || !Number.isSafeInteger(size) || size < 1 || size > DOCUMENT_MAX_BYTES || !mime) {
          throw new WorkflowError(400, "Métadonnées du document invalides.");
        }
        const duplicate = await db.prepare("SELECT id FROM property_documents WHERE disk_name=?").get(diskName);
        if (duplicate) throw new WorkflowError(409, "Ce document a déjà été enregistré.");
        let bytes: Buffer;
        try { bytes = await readStoredFile(diskName); }
        catch { throw new WorkflowError(404, "Le document envoyé est introuvable."); }
        if (bytes.length !== size || !validFileSignature(mime,bytes)) throw new WorkflowError(400, "Le contenu du fichier ne correspond pas à son format.");
        prepared.push({id:id(),diskName,name,mime,size});
      }
      const documents = await insertPropertyDocuments(user,uploadContext,prepared);
      return NextResponse.json({files:documents.map(document => document.id),documents});
    } catch (error) {
      await Promise.all(prepared.map(({diskName}) => removeStoredFile(diskName)));
      throw error;
    }
  }
  if (action === "lease-file" && req.method === "GET") {
    const document = await leaseDocumentForUser(user,parts[1] || "");
    let bytes: Buffer;
    try { bytes = await readStoredFile(document.disk_name); }
    catch { return fail("Fichier introuvable.",404); }
    return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":document.mime,"Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(document.name)}`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}});
  }
  if (action === "ticket" && req.method === "POST") {
    return NextResponse.json(await createTicket(user,body));
  }
  if (action === "status" && req.method === "POST") {
    return NextResponse.json(await setGenericStatus(user,body));
  }
  if (action === "message" && req.method === "POST") {
    const ticket = await ticketForUser(user.id,String(body.ticketId || ""));
    return NextResponse.json(await addMessage(user,ticket,body.text));
  }
  if (action === "upload" && req.method === "POST") {
    const ticket=await ticketForUser(user.id,parts[1] || "");
    if(ticket.status === "ferme" || ticket.status === "resolu") return fail("Ce ticket est en lecture seule. Utilisez reopen pour le reprendre.",409);
    const form=await req.formData(); const items=form.getAll("files"); if(items.length<1 || items.length>5) return fail("Joignez entre 1 et 5 fichiers.");
    const validFiles: {item:File;mime:string}[] = [];
    for (const item of items) {
      if (!(item instanceof File) || item.size === 0 || item.size > DOCUMENT_MAX_BYTES) return fail("Formats acceptés : JPG, PNG, WebP, PDF ; 10 Mo maximum par fichier.");
      const mime = documentMimeFor(item.name,item.type);
      if (!mime) return fail("Formats acceptés : JPG, PNG, WebP, PDF ; 10 Mo maximum par fichier.");
      validFiles.push({item,mime});
    }
    const messageId = await validateMessageAttachment(ticket,user,form.get("messageId"));
    const interventionId = await validateInterventionAttachment(ticket,form.get("interventionId"));
    const prepared: {fileId:string;diskName:string;item:File;mime:string}[] = [];
    try {
      for (const {item,mime} of validFiles) {
        const bytes = Buffer.from(await item.arrayBuffer());
        if (!validFileSignature(mime,bytes)) throw new Error("INVALID_FILE");
        const fileId=id(), diskName=id();
        prepared.push({fileId,diskName,item,mime});
        await storeFile(diskName,bytes,mime);
      }
      await addFiles(user,ticket,messageId,interventionId,prepared.map(({fileId,diskName,item,mime}) => ({id:fileId,diskName,name:item.name.slice(0,200),mime,size:item.size})));
    } catch (error) {
      await Promise.all(prepared.map(({diskName}) => removeStoredFile(diskName)));
      if (error instanceof Error && error.message === "INVALID_FILE") return fail("Le contenu du fichier ne correspond pas à son format.");
      throw error;
    }
    const saved = prepared.map(({fileId}) => fileId);
    return NextResponse.json({files:saved});
  }
  if (action === "file" && req.method === "GET") {
    const file=await db.prepare("SELECT * FROM files WHERE id=?").get(parts[1] || "") as {ticket_id:string;disk_name:string;mime:string;name:string}|undefined;
    if(!file) return fail("Fichier introuvable.",404);
    try { await ticketForUser(user.id,file.ticket_id); } catch { return fail("Fichier introuvable.",404); }
    let bytes: Buffer; try { bytes=await readStoredFile(file.disk_name); } catch { return fail("Fichier introuvable.",404); } return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":file.mime,"Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}});
  }
  if (action === "events" && req.method === "GET") return NextResponse.json(await ticketEvents(user,parts[1] || "",req.nextUrl.searchParams));
  if (action === "intervention" && req.method === "POST") {
    if (parts[1] === "propose") return NextResponse.json(await proposeIntervention(user,body));
    if (parts[1] === "decide") return NextResponse.json(await decideIntervention(user,body));
    if (parts[1] === "complete") return NextResponse.json(await completeIntervention(user,body));
    if (parts[1] === "confirm") return NextResponse.json(await confirmIntervention(user,body));
  }
  if (action === "closure" && req.method === "POST") {
    if (parts[1] === "request") return NextResponse.json(await requestClosure(user,body));
    if (parts[1] === "decide") return NextResponse.json(await decideClosure(user,body));
  }
  if (action === "dispute" && req.method === "POST") {
    if (parts[1] === "open") return NextResponse.json(await openDispute(user,body));
    if (parts[1] === "withdraw") return NextResponse.json(await withdrawDispute(user,body));
  }
  if (action === "reopen" && req.method === "POST") return NextResponse.json(await reopenTicket(user,body));
  if (action === "read" && req.method === "POST") { await db.prepare("UPDATE notifications SET read=1 WHERE id=? AND user_id=?").run(String(body.id || ""),user.id); return NextResponse.json({ok:true}); }
  return fail("Route introuvable.",404);
}
function requestOrigin(req: NextRequest) {
  return process.env.APP_ORIGIN || `${req.nextUrl.protocol}//${req.headers.get("host") || req.nextUrl.host}`;
}
async function inviteDetails(req: NextRequest, code: string) {
  const row = await db.prepare("SELECT expires FROM invitations WHERE code=?").get(code) as {expires:number};
  return {code,expires:row.expires,link:`${requestOrigin(req)}/invitation?code=${code}`};
}
async function lookupInvite(code: string) {
  if (!/^\d{6}$/.test(code)) return fail("Saisissez un code à 6 chiffres.");
  const invite = await db.prepare("SELECT invitations.*, properties.address, properties.tenant_id FROM invitations JOIN properties ON properties.id=invitations.property_id WHERE code=?").get(code) as {property_id:string;address:string;tenant_id:string|null;expires:number;used_at:number|null}|undefined;
  if (!invite) return fail("Code invalide.",404);
  if (invite.used_at || invite.tenant_id) return fail("Ce code a déjà été utilisé.",409);
  if (invite.expires <= Date.now()) return fail("Ce code a expiré. Demandez-en un nouveau.",410);
  return invite;
}
async function handler(req: NextRequest, context: {params: Promise<{path?:string[]}>}) {
  // Cookie-authenticated mutations must originate from this application.
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && ((origin && origin !== requestOrigin(req)) || req.headers.get("sec-fetch-site") === "cross-site")) return fail("Origine non autorisée.",403);
  try {
    await ready;
    const { path = [] } = await context.params;
    const response = req.method === "POST" && !["upload", "lease-upload"].includes(path[0] || "")
      ? await transaction(() => dispatch(req,path))
      : await dispatch(req,path);
    response.headers.set("Cache-Control","private, no-store");
    return response;
  } catch (error) {
    if (error instanceof WorkflowError) {
      return NextResponse.json({error:error.message,code:error.code,...(error.version === undefined ? {} : {version:error.version})},{status:error.status});
    }
    console.error("Core API failure", error instanceof Error ? error.message : "Unknown error");
    return fail("Une erreur serveur est survenue. Réessayez.",500);
  }
}
export const GET=handler; export const POST=handler;
