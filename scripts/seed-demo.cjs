/* Seed a presentation-ready LIAISON database through the public API. */
const base = process.env.DEMO_BASE_URL || 'http://127.0.0.1:3000';
const cookies = {};
const accounts = {
  owner: { name: 'Camille Bernard', email: 'proprietaire@liaison.demo', password: 'DemoLiaison2026!', role: 'owner' },
  tenant1: { name: 'Thomas Leroy', email: 'locataire1@liaison.demo', password: 'DemoLiaison2026!', role: 'tenant' },
  tenant2: { name: 'Sarah Kim', email: 'locataire2@liaison.demo', password: 'DemoLiaison2026!', role: 'tenant' },
};

async function request(who, action, body) {
  const headers = { cookie: cookies[who] || '', origin: base };
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const response = await fetch(`${base}/api/core/${action}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const cookie = response.headers.get('set-cookie');
  if (cookie) cookies[who] = cookie.split(';')[0];
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${action}: ${response.status} ${payload.error || ''}`);
  return payload;
}

function pdf(name, text) {
  return new File([`%PDF-1.4\n% ${text}\n%%EOF`], name, { type: 'application/pdf' });
}

async function uploadDocuments(who, propertyId, leaseId, files) {
  const form = new FormData();
  form.set('propertyId', propertyId);
  if (leaseId) form.set('leaseId', leaseId);
  files.forEach((file) => form.append('files', file, file.name));
  return request(who, 'lease-upload', form);
}

async function currentVersion(who, ticketId) {
  const state = await request(who, 'state');
  return state.tickets.find((ticket) => ticket.id === ticketId)?.version;
}

(async () => {
  for (const [who, account] of Object.entries(accounts)) await request(who, 'signup', account);

  const lyon = await request('owner', 'property', { address: '8 avenue Victor Hugo, 69006 Lyon — T3' });
  const paris = await request('owner', 'property', { address: '12 rue des Lilas, 75011 Paris — Appartement 3B' });
  await request('tenant2', 'join', { code: lyon.code });
  await request('tenant1', 'join', { code: paris.code });

  const lyonLease = await request('owner', 'lease/save', { propertyId: lyon.propertyId, startsOn: '2026-10-01', rentCents: 95000, chargesCents: 8000, depositCents: 190000, paymentDay: 10 });
  const parisLease = await request('owner', 'lease/save', { propertyId: paris.propertyId, startsOn: '2026-09-01', rentCents: 120000, chargesCents: 10000, depositCents: 240000, paymentDay: 5 });
  const parisSeptember = await request('owner', 'rent/period', { leaseId: parisLease.id, period: '2026-09' });
  await request('owner', 'rent/pay', { periodId: parisSeptember.id });
  await request('owner', 'rent/period', { leaseId: parisLease.id, period: '2026-10' });
  await request('owner', 'rent/period', { leaseId: lyonLease.id, period: '2026-10' });

  await uploadDocuments('owner', paris.propertyId, parisLease.id, [pdf('Bail_Paris_2026.pdf', 'Bail Paris')]);
  await uploadDocuments('owner', lyon.propertyId, lyonLease.id, [pdf('Bail_Lyon_2026.pdf', 'Bail Lyon')]);

  const parisTicket = await request('tenant1', 'ticket', { propertyId: paris.propertyId, title: 'Fuite sous le lavabo', description: 'Une goutte régulière apparaît sous le raccord du lavabo depuis deux jours. Une bassine protège le meuble.', category: 'reparation' });
  const attachment = new FormData();
  attachment.append('files', pdf('Constat_fuite.pdf', 'Photo du siphon et constat de la fuite'), 'Constat_fuite.pdf');
  await request('tenant1', `upload/${parisTicket.id}`, attachment);
  const intervention = await request('owner', 'intervention/propose', { ticketId: parisTicket.id, artisanName: 'Plomberie Dupont', details: 'Contrôle du siphon et remplacement du joint défectueux.', scheduledStart: Date.parse('2026-11-02T09:00:00+01:00'), scheduledEnd: Date.parse('2026-11-02T10:30:00+01:00'), priceCents: 14500 });
  await request('tenant1', 'intervention/decide', { interventionId: intervention.id, decision: 'accept', expectedVersion: await currentVersion('tenant1', parisTicket.id) });
  await request('owner', 'intervention/complete', { interventionId: intervention.id, report: 'Siphon et joint remplacés. Contrôle d’étanchéité réalisé sans nouvelle fuite.', expectedVersion: await currentVersion('owner', parisTicket.id) });

  await request('tenant2', 'ticket', { propertyId: lyon.propertyId, title: 'Volet roulant bloqué', description: 'Le volet roulant de la chambre reste bloqué à mi-hauteur et ne remonte plus.', category: 'reparation' });
  await request('owner', 'ticket', { propertyId: paris.propertyId, title: 'Entretien annuel de la chaudière', description: 'Planifier le contrôle annuel et transmettre l’attestation au locataire.', category: 'logement' });

  console.log(JSON.stringify({
    accounts: Object.fromEntries(Object.entries(accounts).map(([key, value]) => [key, { email: value.email, password: value.password }])),
    properties: { paris: paris.propertyId, lyon: lyon.propertyId },
    tickets: { paris: parisTicket.id },
  }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
