// Node 24+: node scripts/test-core.cjs. No Next/SWC server required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'liaison-core-'));
process.env.DATA_DIR = directory;
process.env.TURSO_DATABASE_URL = 'file:' + path.join(directory, 'liaison.sqlite');

// Build the supplied pre-workflow backup, without a live liaison.sqlite, so
// startup proves that migration imports the copy rather than the production DB.
const backupPath = path.join(directory, 'liaison.pre-ticket-workflow.sqlite');
const legacy = new DatabaseSync(backupPath);
legacy.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','tenant')));
CREATE TABLE sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE TABLE properties(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), tenant_id TEXT REFERENCES users(id), address TEXT NOT NULL);
CREATE TABLE invitations(code TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES properties(id), expires INTEGER NOT NULL, used_at INTEGER);
CREATE TABLE tickets(id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES properties(id), creator_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ouvert', created_at INTEGER NOT NULL);
CREATE TABLE messages(id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE files(id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), message_id TEXT REFERENCES messages(id), name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, disk_name TEXT NOT NULL);
CREATE TABLE notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), ticket_id TEXT NOT NULL REFERENCES tickets(id), text TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
INSERT INTO users VALUES('legacy-owner','Legacy Owner','legacy-owner@example.com','unused','owner'),('legacy-tenant','Legacy Tenant','legacy-tenant@example.com','unused','tenant');
INSERT INTO properties VALUES('legacy-property','legacy-owner','legacy-tenant','1 rue du Backup');
INSERT INTO tickets VALUES('legacy-ticket','legacy-property','legacy-tenant','reparation','x','y','ouvert',1000);
INSERT INTO messages VALUES('legacy-message','legacy-ticket','legacy-tenant','historique',1100);`);
legacy.close();
const modules = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  modules.set(filename, mod);
  const nativeRequire = mod.require.bind(mod);
  mod.require = name => {
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(filename), name);
      const local = ['.ts', '.tsx'].map(ext => base + ext).find(file => fs.existsSync(file));
      if (local) return load(local);
    }
    return nativeRequire(name);
  };
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } });
  mod._compile(result.outputText, filename);
  return mod.exports;
}
const database = load('src/lib/server/db.ts');
const api = load('src/app/api/core/[[...path]]/route.ts');
const { mapCoreState, uploadAttachments } = load('src/lib/client/core.tsx');
const cookies = {};
async function call(who, action, body, expected = 200, extraHeaders = {}) {
  const headers = { cookie: cookies[who] || '', ...extraHeaders };
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const method = body === undefined ? 'GET' : 'POST';
  const [pathname] = action.split('?');
  const response = await api[method](new NextRequest(`http://localhost/api/core/${action}`, { method, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) }), { params: Promise.resolve({ path: pathname.split('/') }) });
  const cookie = response.headers.get('set-cookie');
  if (cookie) cookies[who] = cookie.split(';')[0];
  const value = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.arrayBuffer();
  assert.equal(response.status, expected, `${action}: ${JSON.stringify(value)}`);
  return value;
}

const rows = (snapshot, key) => {
  assert.ok(Array.isArray(snapshot[key]), `state.${key} must be an array`);
  return snapshot[key];
};
const ticketValue = (snapshot, ticketId) => {
  const ticket = rows(snapshot, 'tickets').find(item => item.id === ticketId);
  assert.ok(ticket, `ticket ${ticketId} missing from state`);
  return ticket;
};
const ticketVersion = (snapshot, ticketId) => {
  const value = ticketValue(snapshot, ticketId).version;
  assert.equal(typeof value, 'number', `ticket ${ticketId} must expose a numeric version`);
  return value;
};
const ticketIdOf = row => row.ticketId ?? row.ticket_id;
const rowId = (row, name) => row.id ?? row[`${name}Id`] ?? row[`${name}_id`];
const rowState = row => String(row.status ?? row.state ?? '');
const ticketRows = (snapshot, key, ticketId) => rows(snapshot, key).filter(row => ticketIdOf(row) === ticketId);
const newRow = (before, after, key, ticketId) => {
  const previous = new Set(ticketRows(before, key, ticketId).map(row => rowId(row, key.slice(0, -1))));
  const added = ticketRows(after, key, ticketId).filter(row => !previous.has(rowId(row, key.slice(0, -1))));
  assert.equal(added.length, 1, `${key}: exactly one new row expected`);
  return added[0];
};
const futureStart = () => Date.now() + 24 * 60 * 60 * 1000;

async function createTicket(who, propertyId, title) {
  const result = await call(who, 'ticket', {
    propertyId,
    title,
    description: `Description suffisamment longue pour ${title}`,
    category: 'reparation',
  });
  return result.id;
}

async function proposeIntervention(who, ticketId, artisanName, details) {
  const before = await call(who, 'state');
  const start = futureStart();
  await call(who, 'intervention/propose', {
    ticketId,
    artisanName,
    details,
    scheduledStart: start,
    scheduledEnd: start + 60 * 60 * 1000,
    priceCents: 0,
  });
  const after = await call(who, 'state');
  return {row: newRow(before, after, 'interventions', ticketId), snapshot: after};
}

async function requestClosure(who, ticketId, subject, conditions, extra = {}) {
  const before = await call(who, 'state');
  await call(who, 'closure/request', {ticketId, subject, conditions, ...extra});
  const after = await call(who, 'state');
  return {row: newRow(before, after, 'closures', ticketId), snapshot: after};
}

function eventList(payload) {
  const value = Array.isArray(payload) ? payload : payload.events ?? payload.items;
  assert.ok(Array.isArray(value), 'events response must contain an array');
  return value;
}
async function run() {
  await database.ready;
  assert.ok(fs.existsSync(backupPath), 'migration must preserve a pre-workflow backup');
  assert.equal((await database.db.prepare('PRAGMA user_version').get()).user_version, 3);
  assert.ok(await database.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leases'").get());
  assert.ok(await database.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rent_periods'").get());
  const migratedColumns = (await database.db.prepare('PRAGMA table_info(tickets)').all()).map(column => column.name);
  assert.ok(migratedColumns.includes('version'), 'the migrated tickets table must include version');
  const backup = new DatabaseSync(backupPath, {readOnly: true});
  const backupColumns = backup.prepare('PRAGMA table_info(tickets)').all().map(column => column.name);
  const backupTicket = backup.prepare('SELECT title,description FROM tickets WHERE id=?').get('legacy-ticket');
  backup.close();
  assert.ok(!backupColumns.includes('version'), 'the backup must retain the pre-workflow schema');
  assert.deepEqual({...backupTicket}, {title:'x',description:'y'});
  const importedTicket = await database.db.prepare('SELECT id,title,description,version FROM tickets WHERE id=?').get('legacy-ticket');
  assert.deepEqual({...importedTicket}, {id:'legacy-ticket',title:'x',description:'y',version:1});
  const importedParties = await database.db.prepare('SELECT owner_id,tenant_id FROM ticket_parties WHERE ticket_id=?').get('legacy-ticket');
  assert.deepEqual({...importedParties}, {owner_id:'legacy-owner',tenant_id:'legacy-tenant'});
  const importedEvents = await database.db.prepare('SELECT type FROM ticket_events WHERE ticket_id=?').all('legacy-ticket');
  assert.deepEqual(importedEvents.map(event => event.type), ['ticket.created']);

  await call('anonymous', 'state', undefined, 401);
  for (const [name, role] of [['owner','owner'], ['tenant','tenant'], ['outsider','tenant']]) {
    await call(name, 'signup', {name, role, email: `${name}@example.com`, password: 'password-1234'});
  }
  const arrayParams = await database.db.prepare('SELECT email FROM users WHERE email IN (?,?)')
    .all(['owner@example.com', 'tenant@example.com']);
  assert.equal(arrayParams.length, 2, 'query parameters may be supplied as an array');

  // Behind a local reverse proxy Next may parse nextUrl with localhost while
  // the browser sends the public Host header. Origin checks and invite links
  // must use that forwarded Host (unless APP_ORIGIN explicitly overrides it).
  const localOrigin = 'http://127.0.0.1:3000';
  const localHeaders = {host: '127.0.0.1:3000', origin: localOrigin};
  const previousAppOrigin = process.env.APP_ORIGIN;
  delete process.env.APP_ORIGIN;
  try {
    await call('origin-login', 'login', {email: 'owner@example.com', password: 'password-1234'}, 200, localHeaders);
    await call('origin-evil', 'login', {email: 'owner@example.com', password: 'password-1234'}, 403, {
      host: '127.0.0.1:3000',
      origin: 'https://evil.example',
    });
    const localProperty = await call('owner', 'property', {address: '9 rue du Proxy'}, 200, localHeaders);
    assert.equal(localProperty.link, `${localOrigin}/invitation?code=${localProperty.code}`);
    await call('anonymous', `invitation/${localProperty.code}`, undefined, 200, {host: '127.0.0.1:3000'});
  } finally {
    if (previousAppOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousAppOrigin;
  }
  const property = await call('owner', 'property', {address: '12 rue de Paris'});
  assert.match(property.code, /^\d{6}$/);
  assert.match(property.link, /\/invitation\?code=\d{6}$/);
  assert.ok(property.expires > Date.now());
  await call('anonymous', `invitation/${property.code}`);
  await call('tenant', 'join', {code: property.code});
  await call('outsider', 'join', {code: property.code}, 409);
  const ticket = await call('tenant', 'ticket', {propertyId: property.propertyId, title: 'Fuite cuisine', description: 'Une fuite sous le lavabo cuisine', category: 'reparation'});
  await call('outsider', 'message', {ticketId: ticket.id, text: 'Intrusion'}, 404);
  const reply = await call('owner', 'message', {ticketId: ticket.id, text: 'Je contacte un plombier.'});
  await call('owner', 'status', {ticketId: ticket.id, status: 'en_cours'});
  // Distinct times make the activity mapping assertion independent of machine speed.
  await database.db.prepare('UPDATE messages SET created_at=created_at+60000 WHERE id=?').run(reply.id);
  const form = new FormData();
  form.set('messageId', reply.id);
  form.append('files', new File(['%PDF-1.4\n test'], 'preuve.pdf', {type:'application/pdf'}));
  const upload = await call('owner', `upload/${ticket.id}`, form);
  await call('tenant', `file/${upload.files[0]}`);
  await call('outsider', `file/${upload.files[0]}`, undefined, 404);
  const invalid = new FormData();
  invalid.append('files', new File(['bad'], 'wrong.png', {type:'image/png'}));
  await call('tenant', `upload/${ticket.id}`, invalid, 400);
  const ownerState = await call('owner', 'state');
  assert.equal(ownerState.tickets[0].status, 'en_cours');
  assert.equal(ownerState.properties[0].owner_name, 'owner');
  assert.equal(ownerState.properties[0].tenant_name, 'tenant');
  assert.equal(ownerState.messages[0].text, 'Je contacte un plombier.');
  assert.match(ownerState.notifications[0].title, /Nouveau ticket/);
  const mapped = mapCoreState(ownerState);
  assert.equal(mapped.tickets[0].messages[0].author, 'thomas');
  assert.equal(mapped.tickets[0].messages[0].authorName, 'tenant');
  assert.equal(mapped.tickets[0].messages[1].author, 'claire');
  assert.equal(mapped.tickets[0].messages[1].attachments[0].kind, 'file');
  assert.notEqual(mapped.tickets[0].updatedAt, mapped.tickets[0].createdAt);
  assert.equal(mapped.documents[0].ticketId, ticket.id);
  assert.ok(mapped.notifications[0].title);
  assert.equal((await call('outsider','state')).tickets.length, 0);
  await call('owner','read',{id:ownerState.notifications[0].id});
  assert.equal((await call('owner','state')).notifications[0].read, 1);
  const second = await call('owner','property',{address:'25 avenue de Lyon'});
  const renewed = await call('owner','renew',{propertyId:second.propertyId});
  await call('anonymous',`invitation/${second.code}`,undefined,404);
  await database.db.prepare('UPDATE invitations SET expires=0 WHERE code=?').run(renewed.code);
  await call('anonymous',`invitation/${renewed.code}`,undefined,410);
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response('not found',{status:404});
    await assert.rejects(uploadAttachments(ticket.id,[{src:'blob:missing',alt:'missing'}]), /Impossible de lire/);
  } finally { global.fetch = originalFetch; }

  await call('tenant', 'ticket', {
    propertyId: property.propertyId,
    title: '',
    description: 'x',
    category: 'reparation',
  }, 400);
  const oneCharacterTicket = await call('tenant', 'ticket', {
    propertyId: property.propertyId,
    title: 'x',
    description: 'y',
    category: 'reparation',
  });
  assert.ok(oneCharacterTicket.id);
  assert.ok(ticketValue(await call('tenant', 'state'), oneCharacterTicket.id));
  const ownerTicket = await call('owner', 'ticket', {
    propertyId: property.propertyId,
    title: 'x',
    description: 'y',
    category: 'reparation',
  });
  assert.ok(ownerTicket.id, 'both attached roles can create a ticket');
  const ownerId = (await call('owner', 'state')).user.id;
  const tenantId = (await call('tenant', 'state')).user.id;

  // Interventions: non-empty values are accepted at one character, while
  // ownership, conflicts and each transition are enforced by the API.
  const interventionTicket = await createTicket('tenant', property.propertyId, 'Robinet intervention');
  const interventionStart = futureStart();
  await call('owner', 'intervention/propose', {
    ticketId: interventionTicket,
    artisanName: '   ',
    details: 'x',
    scheduledStart: interventionStart,
    scheduledEnd: interventionStart + 60 * 60 * 1000,
    priceCents: 0,
  }, 400);
  await call('outsider', 'intervention/propose', {
    ticketId: interventionTicket,
    artisanName: 'a',
    details: 'x',
    scheduledStart: interventionStart,
    scheduledEnd: interventionStart + 60 * 60 * 1000,
    priceCents: 0,
  }, 404);

  const proposed = await proposeIntervention('owner', interventionTicket, 'a', 'x');
  const proposedId = rowId(proposed.row, 'intervention');
  assert.ok(proposedId);
  assert.equal(proposed.row.proposed_by, ownerId);
  assert.match(rowState(proposed.row), /propos|attente|ouvert/);
  let version = ticketVersion(proposed.snapshot, interventionTicket);
  await call('owner', 'intervention/decide', {
    interventionId: proposedId,
    decision: 'accept',
    reason: 'x',
    expectedVersion: version,
  }, 403);
  await call('outsider', 'intervention/decide', {
    interventionId: proposedId,
    decision: 'accept',
    reason: 'x',
    expectedVersion: version,
  }, 404);
  await call('tenant', 'intervention/decide', {
    interventionId: proposedId,
    decision: 'refuse',
    reason: 'x',
    expectedVersion: version,
  });
  let current = await call('tenant', 'state');
  assert.match(rowState(ticketRows(current, 'interventions', interventionTicket).find(row => rowId(row, 'intervention') === proposedId)), /refus/);
  assert.notEqual(ticketValue(current, interventionTicket).status, 'ferme');
  const beforeReplacement = ticketVersion(current, interventionTicket);

  const replacement = await proposeIntervention('owner', interventionTicket, 'b', 'y');
  const replacementId = rowId(replacement.row, 'intervention');
  current = await call('tenant', 'state');
  await call('tenant', 'intervention/decide', {
    interventionId: replacementId,
    decision: 'accept',
    reason: 'x',
    expectedVersion: beforeReplacement,
  }, 409);
  await call('tenant', 'intervention/decide', {
    interventionId: proposedId,
    decision: 'accept',
    reason: 'x',
    expectedVersion: ticketVersion(current, interventionTicket),
  }, 409);
  version = ticketVersion(current, interventionTicket);
  await call('tenant', 'intervention/decide', {
    interventionId: replacementId,
    decision: 'accept',
    reason: 'x',
    expectedVersion: version,
  });
  current = await call('owner', 'state');
  version = ticketVersion(current, interventionTicket);
  await call('owner', 'intervention/complete', {
    interventionId: replacementId,
    report: 'x',
    expectedVersion: version,
  });
  current = await call('tenant', 'state');
  version = ticketVersion(current, interventionTicket);
  await call('tenant', 'intervention/confirm', {
    interventionId: replacementId,
    decision: 'confirm',
    reason: 'x',
    expectedVersion: version,
  });
  current = await call('tenant', 'state');
  assert.match(rowState(ticketRows(current, 'interventions', interventionTicket).find(row => rowId(row, 'intervention') === replacementId)), /confirm|termin/);

  const contestedTicket = await createTicket('tenant', property.propertyId, 'Intervention contestee');
  const contested = await proposeIntervention('owner', contestedTicket, 'c', 'z');
  const contestedId = rowId(contested.row, 'intervention');
  current = await call('tenant', 'state');
  version = ticketVersion(current, contestedTicket);
  await call('tenant', 'intervention/decide', {
    interventionId: contestedId,
    decision: 'accept',
    reason: 'x',
    expectedVersion: version,
  });
  current = await call('owner', 'state');
  version = ticketVersion(current, contestedTicket);
  await call('owner', 'intervention/complete', {
    interventionId: contestedId,
    report: 'x',
    expectedVersion: version,
  });
  current = await call('tenant', 'state');
  version = ticketVersion(current, contestedTicket);
  await call('tenant', 'intervention/confirm', {
    interventionId: contestedId,
    decision: 'contest',
    reason: 'x',
    expectedVersion: version,
  });
  current = await call('tenant', 'state');
  assert.match(rowState(ticketRows(current, 'interventions', contestedTicket).find(row => rowId(row, 'intervention') === contestedId)), /contest/);
  assert.notEqual(ticketValue(current, contestedTicket).status, 'ferme');

  // A ticket whose property has no tenant cannot enter a two-party workflow.
  const unlinkedTicket = await createTicket('tenant', property.propertyId, 'Dossier sans locataire');
  await database.db.prepare('UPDATE properties SET tenant_id=NULL WHERE id=?').run(property.propertyId);
  current = await call('owner', 'state');
  assert.ok(ticketValue(current, unlinkedTicket));
  await call('owner', 'ticket', {
    propertyId: property.propertyId,
    title: 'x',
    description: 'y',
    category: 'reparation',
  }, 409);
  await database.db.prepare('UPDATE properties SET tenant_id=? WHERE id=?').run((await call('tenant', 'state')).user.id, property.propertyId);

  // Closure requests need valid files from the same dossier. The request is
  // the first agreement and remains open until the other party accepts it.
  const closureTicket = await createTicket('tenant', property.propertyId, 'Cloture avec pieces');
  const closureFileForm = new FormData();
  closureFileForm.append('files', new File(['%PDF-1.4\nclosure'], 'accord.pdf', {type:'application/pdf'}));
  const closureUpload = await call('tenant', `upload/${closureTicket}`, closureFileForm);
  current = await call('tenant', 'state');
  const closureVersion = ticketVersion(current, closureTicket);
  await call('tenant', 'closure/request', {
    ticketId: closureTicket,
    subject: 'x',
    conditions: 'x',
    fileIds: ['does-not-exist'],
    expectedVersion: closureVersion,
  }, 400);
  await call('tenant', 'closure/request', {
    ticketId: closureTicket,
    subject: 'x',
    conditions: 'x',
    fileIds: [upload.files[0]],
    expectedVersion: closureVersion,
  }, 400);
  const refusedClosure = await requestClosure('tenant', closureTicket, 'x', 'x', {
    fileIds: closureUpload.files,
    expectedVersion: closureVersion,
  });
  assert.equal(refusedClosure.row.requester_id, tenantId);
  assert.notEqual(ticketValue(refusedClosure.snapshot, closureTicket).status, 'ferme');
  current = await call('owner', 'state');
  await call('owner', 'closure/decide', {
    requestId: rowId(refusedClosure.row, 'closure'),
    decision: 'refuse',
    reason: 'x',
    expectedVersion: ticketVersion(current, closureTicket),
  });
  current = await call('tenant', 'state');
  assert.match(rowState(ticketRows(current, 'closures', closureTicket).find(row => rowId(row, 'closure') === rowId(refusedClosure.row, 'closure'))), /refus/);
  assert.notEqual(ticketValue(current, closureTicket).status, 'ferme');

  const replacementTicket = await createTicket('tenant', property.propertyId, 'Conditions remplacees');
  const oldClosure = await requestClosure('tenant', replacementTicket, 'ancienne', 'ancienne');
  const newClosure = await requestClosure('owner', replacementTicket, 'x', 'x');
  current = await call('tenant', 'state');
  assert.notEqual(ticketValue(current, replacementTicket).status, 'ferme');
  version = ticketVersion(current, replacementTicket);
  await call('owner', 'closure/decide', {
    requestId: rowId(oldClosure.row, 'closure'),
    decision: 'accept',
    expectedVersion: version,
  }, 409);
  await call('tenant', 'closure/decide', {
    requestId: rowId(newClosure.row, 'closure'),
    decision: 'accept',
    expectedVersion: version,
  });
  current = await call('tenant', 'state');
  assert.equal(ticketValue(current, replacementTicket).status, 'ferme');
  assert.ok(Array.isArray(current.agreements));
  assert.ok(ticketRows(current, 'agreements', replacementTicket).length >= 1);

  const closedMessageCount = current.messages.filter(row => row.ticket_id === replacementTicket).length;
  const closedClosureIds = ticketRows(current, 'closures', replacementTicket).map(row => rowId(row, 'closure'));
  await call('tenant', 'message', {ticketId: replacementTicket, text: 'Ceci doit etre refuse'}, 409);
  const closedUpload = new FormData();
  closedUpload.append('files', new File(['%PDF-1.4\nclosed'], 'closed.pdf', {type:'application/pdf'}));
  await call('tenant', `upload/${replacementTicket}`, closedUpload, 409);
  await call('owner', 'status', {ticketId: replacementTicket, status: 'en_cours'}, 409);
  await call('owner', 'intervention/propose', {
    ticketId: replacementTicket,
    artisanName: 'x',
    details: 'x',
    scheduledStart: futureStart(),
    scheduledEnd: futureStart() + 60 * 60 * 1000,
    priceCents: 0,
  }, 409);
  await call('tenant', 'closure/request', {ticketId: replacementTicket, subject: 'x', conditions: 'x'}, 409);
  await call('tenant', 'dispute/open', {ticketId: replacementTicket, description: 'x'}, 409);
  await call('tenant', 'reopen', {ticketId: replacementTicket, reason: '   '}, 400);
  await call('tenant', 'reopen', {ticketId: replacementTicket, reason: 'x'});
  current = await call('tenant', 'state');
  assert.ok(['ouvert', 'en_cours'].includes(ticketValue(current, replacementTicket).status));
  assert.equal(current.messages.filter(row => row.ticket_id === replacementTicket).length, closedMessageCount);
  assert.deepEqual(ticketRows(current, 'closures', replacementTicket).map(row => rowId(row, 'closure')).filter(id => closedClosureIds.includes(id)), closedClosureIds);

  // Disputes preserve the author's withdrawal and become resolved by the
  // agreement that closes their ticket.
  const disputeTicket = await createTicket('tenant', property.propertyId, 'Litige du dossier');
  await call('tenant', 'dispute/open', {ticketId: disputeTicket, description: '   '}, 400);
  let beforeDispute = await call('tenant', 'state');
  await call('tenant', 'dispute/open', {ticketId: disputeTicket, description: 'x'});
  current = await call('tenant', 'state');
  const dispute = newRow(beforeDispute, current, 'disputes', disputeTicket);
  const disputeId = rowId(dispute, 'dispute');
  await call('owner', 'dispute/withdraw', {disputeId}, 403);
  await call('outsider', 'dispute/withdraw', {disputeId}, 404);
  await call('tenant', 'dispute/withdraw', {disputeId});
  current = await call('tenant', 'state');
  assert.match(rowState(ticketRows(current, 'disputes', disputeTicket).find(row => rowId(row, 'dispute') === disputeId)), /retir|withdraw/);

  beforeDispute = current;
  await call('owner', 'dispute/open', {ticketId: disputeTicket, description: 'Litige porte par le bailleur'});
  current = await call('owner', 'state');
  const resolvedDispute = newRow(beforeDispute, current, 'disputes', disputeTicket);
  const closureForDispute = await requestClosure('tenant', disputeTicket, 'Resolution', 'Conditions acceptees');
  current = await call('owner', 'state');
  await call('owner', 'closure/decide', {
    requestId: rowId(closureForDispute.row, 'closure'),
    decision: 'accept',
    expectedVersion: ticketVersion(current, disputeTicket),
  });
  current = await call('owner', 'state');
  assert.equal(ticketValue(current, disputeTicket).status, 'ferme');
  assert.match(rowState(ticketRows(current, 'disputes', disputeTicket).find(row => rowId(row, 'dispute') === rowId(resolvedDispute, 'dispute'))), /resol|accord/);

  // A tenant change affects new access only: the departing tenant keeps the
  // dossiers they already owned, while the incoming tenant starts empty.
  const oldTenantState = await call('tenant', 'state');
  const incomingTenantState = await call('outsider', 'state');
  const oldTicketIds = oldTenantState.tickets.map(item => item.id).sort();
  assert.ok(oldTicketIds.includes(replacementTicket));
  await database.db.prepare('UPDATE properties SET tenant_id=? WHERE id=?').run(incomingTenantState.user.id, property.propertyId);
  const incomingBeforeTickets = await call('outsider', 'state');
  assert.deepEqual(incomingBeforeTickets.tickets, []);
  assert.deepEqual(incomingBeforeTickets.interventions, []);
  assert.deepEqual(incomingBeforeTickets.closures, []);
  assert.deepEqual(incomingBeforeTickets.disputes, []);
  const departingAfterChange = await call('tenant', 'state');
  assert.deepEqual(departingAfterChange.tickets.map(item => item.id).sort(), oldTicketIds);
  assert.ok(departingAfterChange.closures.some(row => ticketIdOf(row) === replacementTicket));
  const incomingTicket = await createTicket('outsider', property.propertyId, 'Nouveau locataire');
  const incomingAfterCreate = await call('outsider', 'state');
  assert.deepEqual(incomingAfterCreate.tickets.map(item => item.id), [incomingTicket]);
  assert.equal((await call('tenant', 'state')).tickets.some(item => item.id === incomingTicket), false);
  const ownerAfterChange = await call('owner', 'state');
  assert.ok(ownerAfterChange.tickets.some(item => item.id === incomingTicket));
  assert.ok(ownerAfterChange.tickets.some(item => item.id === replacementTicket));
  await call('outsider', 'message', {ticketId: replacementTicket, text: 'Ancien dossier'}, 404);
  await call('tenant', 'message', {ticketId: incomingTicket, text: 'Nouveau dossier'}, 404);
  await call('tenant', 'message', {ticketId: replacementTicket, text: 'Historique conserve'});

  // Event logs are scoped, paginated and append-only. Earlier rows are byte
  // for byte the same after a later mutation.
  await call('outsider', `events/${replacementTicket}`, undefined, 404);
  let eventPayload = await call('tenant', `events/${replacementTicket}`);
  let events = eventList(eventPayload).slice().sort((a, b) => (a.seq ?? a.sequence) - (b.seq ?? b.sequence));
  assert.ok(events.length >= 2);
  const sequence = row => row.seq ?? row.sequence;
  assert.ok(events.every((row, index) => index === 0 || sequence(row) > sequence(events[index - 1])));
  const prefix = structuredClone(events.slice(0, 2));
  const limited = eventList(await call('tenant', `events/${replacementTicket}?limit=2`))
    .slice().sort((a, b) => sequence(a) - sequence(b));
  assert.ok(limited.length <= 2);
  const after = sequence(limited[limited.length - 1]);
  const tail = eventList(await call('tenant', `events/${replacementTicket}?afterSeq=${after}&limit=2`));
  assert.ok(tail.every(row => sequence(row) > after));
  await call('owner', 'message', {ticketId: replacementTicket, text: 'Evenement ajoute'});
  eventPayload = await call('tenant', `events/${replacementTicket}`);
  events = eventList(eventPayload).slice().sort((a, b) => (a.seq ?? a.sequence) - (b.seq ?? b.sequence));
  assert.deepEqual(events.slice(0, 2), prefix);
  await assert.rejects(() => database.db.prepare('UPDATE ticket_events SET type=? WHERE seq=?').run('tampered', sequence(events[0])), /append-only/);
  await assert.rejects(() => database.db.prepare('DELETE FROM ticket_events WHERE seq=?').run(sequence(events[0])), /append-only/);

  // Multiple properties stay isolated for each owner and tenant. The optional
  // state scope is used by the client property switcher.
  for (const [name, role] of [['ownerB','owner'], ['tenantB','tenant']]) {
    await call(name, 'signup', {name, role, email: `${name}@example.com`, password: 'password-1234'});
  }
  const firstProperty = await call('ownerB', 'property', {address: '1 rue du Premier'});
  const secondProperty = await call('ownerB', 'property', {address: '2 rue du Second'});
  await call('tenantB', 'join', {code: firstProperty.code});
  await call('tenantB', 'join', {code: secondProperty.code});
  const tenantMultiState = await call('tenantB', 'state');
  assert.deepEqual(tenantMultiState.properties.map(property => property.id).sort(), [firstProperty.propertyId, secondProperty.propertyId].sort());
  assert.equal(await database.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='one_property_per_tenant'").get(), undefined);

  const firstTicket = await call('tenantB', 'ticket', {propertyId: firstProperty.propertyId, title: 'Dossier premier', description: 'Premier logement', category: 'reparation'});
  const secondTicket = await call('tenantB', 'ticket', {propertyId: secondProperty.propertyId, title: 'Dossier second', description: 'Second logement', category: 'logement'});
  const scopedFirst = await call('tenantB', `state?propertyId=${encodeURIComponent(firstProperty.propertyId)}`);
  assert.deepEqual(scopedFirst.tickets.map(ticket => ticket.id), [firstTicket.id]);
  await call('owner', `state?propertyId=${encodeURIComponent(firstProperty.propertyId)}`, undefined, 404);
  const scopedSecond = await call('ownerB', `state?propertyId=${encodeURIComponent(secondProperty.propertyId)}`);
  assert.deepEqual(scopedSecond.tickets.map(ticket => ticket.id), [secondTicket.id]);

  const firstLease = await call('ownerB', 'lease/save', {
    propertyId: firstProperty.propertyId, startsOn: '2026-11-01', rentCents: 100000,
    chargesCents: 12000, depositCents: 200000, paymentDay: 5,
  });
  const secondLease = await call('ownerB', 'lease/save', {
    propertyId: secondProperty.propertyId, startsOn: '2026-12-01', rentCents: 180000,
    chargesCents: 15000, depositCents: 360000, paymentDay: 10,
  });
  assert.equal(firstLease.rent_cents, 100000);
  assert.equal(secondLease.rent_cents, 180000);
  await call('tenantB', 'lease/save', {propertyId: firstProperty.propertyId, startsOn: '2026-11-01', rentCents: 1, paymentDay: 1}, 403);
  const firstPeriod = await call('ownerB', 'rent/period', {leaseId: firstLease.id, period: '2026-11'});
  const secondPeriod = await call('ownerB', 'rent/period', {leaseId: secondLease.id, period: '2026-12'});
  assert.equal(firstPeriod.total_cents, 112000);
  assert.equal(secondPeriod.total_cents, 195000);
  await call('tenantB', 'rent/period', {leaseId: firstLease.id, period: '2027-01'}, 403);
  await call('tenantB', 'rent/pay', {periodId: firstPeriod.id}, 403);
  const paidFirstPeriod = await call('ownerB', 'rent/pay', {periodId: firstPeriod.id});
  assert.equal(paidFirstPeriod.status, 'paid');
  await call('owner', 'lease/save', {propertyId: secondProperty.propertyId, startsOn: '2027-01-01', rentCents: 1, paymentDay: 1}, 404);

  const leaseFile = new FormData();
  leaseFile.set('propertyId', secondProperty.propertyId);
  leaseFile.set('leaseId', secondLease.id);
  leaseFile.append('files', new File(['%PDF-1.4\n bail'], 'bail.pdf', {type: 'application/pdf'}));
  const leaseUpload = await call('tenantB', 'lease-upload', leaseFile);
  assert.equal(leaseUpload.documents.length, 1);
  assert.equal(leaseUpload.documents[0].disk_name, undefined);
  await call('tenantB', `lease-file/${leaseUpload.documents[0].id}`);
  await call('outsider', `lease-file/${leaseUpload.documents[0].id}`, undefined, 404);
  const scopedFirstWithLease = await call('ownerB', `state?propertyId=${encodeURIComponent(firstProperty.propertyId)}`);
  const scopedSecondWithLease = await call('ownerB', `state?propertyId=${encodeURIComponent(secondProperty.propertyId)}`);
  assert.deepEqual(scopedFirstWithLease.leases.map(lease => lease.id), [firstLease.id]);
  assert.deepEqual(scopedSecondWithLease.leases.map(lease => lease.id), [secondLease.id]);
  assert.deepEqual(scopedFirstWithLease.rent_periods.map(period => period.id), [firstPeriod.id]);
  assert.deepEqual(scopedSecondWithLease.property_documents.map(document => document.id), [leaseUpload.documents[0].id]);
  assert.equal(scopedFirstWithLease.property_documents.length, 0);

  const concurrentTicket = await call('outsider', 'ticket', {
    propertyId: property.propertyId,
    title: 'Mise à jour concurrente',
    description: 'Deux requêtes utilisent la même version attendue.',
    category: 'reparation',
  });
  const concurrentVersion = ticketVersion(await call('outsider', 'state'), concurrentTicket.id);
  const concurrentStatus = () => api.POST(new NextRequest('http://localhost/api/core/status', {
    method: 'POST',
    headers: { cookie: cookies.outsider, 'content-type': 'application/json' },
    body: JSON.stringify({ ticketId: concurrentTicket.id, status: 'en_cours', expectedVersion: concurrentVersion }),
  }), { params: Promise.resolve({ path: ['status'] }) });
  const concurrentResponses = await Promise.all([concurrentStatus(), concurrentStatus()]);
  assert.deepEqual(concurrentResponses.map(response => response.status).sort(), [200, 409]);

  await call('owner','logout',{});
  await call('owner','state',undefined,401);
  await call('owner','login',{email:'owner@example.com',password:'password-1234'});
  console.log('PASS: auth, invitations, tickets, workflows, multi-property isolation, leases, rents and events');
}
run().catch(error => {console.error(error);process.exitCode=1;}).finally(async () => {await database.db.close();fs.rmSync(directory,{recursive:true,force:true});});
