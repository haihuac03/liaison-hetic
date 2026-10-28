const originSetting = process.env.APP_ORIGIN?.trim();

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!originSetting) {
  fail("APP_ORIGIN est requis pour joindre l'application distante.");
} else if (!process.argv.includes("--confirm")) {
  fail("Ajoutez --confirm pour créer les comptes et le jeu de données de démonstration.");
} else {
  let origin;
  try {
    origin = new URL(originSetting);
  } catch {
    fail("APP_ORIGIN doit être une URL absolue.");
  }

  if (origin) {
    if (!["http:", "https:"].includes(origin.protocol) || originSetting !== origin.origin) {
      fail("APP_ORIGIN doit être une origine HTTP(S), sans chemin, requête ni slash final.");
    } else {
      process.env.DEMO_BASE_URL = origin.origin;
      console.log(`Création du jeu de démonstration sur ${origin.origin}.`);
      await import("./seed-demo.cjs");
    }
  }
}
