const databaseUrl = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!databaseUrl || databaseUrl.startsWith("file:")) {
  fail("TURSO_DATABASE_URL doit désigner la base Turso distante.");
} else if (!authToken) {
  fail("TURSO_AUTH_TOKEN est requis pour appliquer les migrations Turso.");
} else if (!/^(libsql|https?):\/\//i.test(databaseUrl)) {
  fail("TURSO_DATABASE_URL doit utiliser le protocole libsql:, https: ou http:.");
} else {
  let database;
  try {
    const databaseModule = await import("../src/lib/server/db.ts");
    database = databaseModule.db;
    await databaseModule.ready;
    const version = await database.prepare("PRAGMA user_version").get();
    if (Number(version?.user_version) !== 3) {
      throw new Error("La version de schéma obtenue n'est pas la version attendue (3).");
    }
    const tables = await database.prepare(`
      SELECT COUNT(*) AS count FROM sqlite_master
      WHERE type='table' AND name IN ('users','tickets','leases','property_documents')
    `).get();
    if (Number(tables?.count) !== 4) {
      throw new Error("Les tables principales n'ont pas toutes été créées.");
    }
    console.log("Migrations Turso appliquées: schéma version 3.");
  } catch (error) {
    fail(`Échec des migrations Turso: ${error instanceof Error ? error.message : "erreur inconnue"}`);
  } finally {
    await database?.close?.();
  }
}
