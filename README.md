# LIAISON

Application locale de gestion locative pour propriétaires et locataires : plusieurs logements, dossiers partagés, interventions, baux, échéances de loyer et documents.

## Fonctionnalités

- **Portefeuille** - Sélection d'un logement actif et vue isolée de ses dossiers
- **Dossiers** - Création par les deux rôles, historique factuel et pièces jointes
- **Accords** - Demande de clôture et confirmation des deux parties
- **Interventions** - Proposition, acceptation, compte rendu et confirmation
- **Baux** - Conditions du bail et documents partagés par logement
- **Loyers** - Échéances et paiements enregistrés par logement

## Stack technique

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS
- Lucide React
- Composants réutilisables

## Déploiement

- Production : https://liaison-hetic.vercel.app
- Dépôt GitHub : https://github.com/haihuac03/liaison-hetic
- Données relationnelles : Turso
- Pièces jointes : Vercel Blob privé

La procédure de configuration est détaillée dans [docs/VERCEL.md](docs/VERCEL.md).

## Démarrage

```bash
npm install
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

Node.js 24 ou supérieur est requis pour SQLite intégré. Les données persistantes sont enregistrées dans `data/` et ne sont pas versionnées. Pour un déploiement HTTPS, définir `COOKIE_SECURE=true`. `DATA_DIR` permet de choisir un autre dossier de données.

Le packaging Vercel, Turso et Blob est décrit dans [docs/VERCEL.md](docs/VERCEL.md).

## Comptes de démonstration

- Propriétaire : `proprietaire@liaison.demo` / `DemoLiaison2026!`
- Locataire Paris : `locataire1@liaison.demo` / `DemoLiaison2026!`
- Locataire Lyon : `locataire2@liaison.demo` / `DemoLiaison2026!`

La base de présentation contient deux logements, deux baux, trois tickets et des documents réels.

## Comptes et invitations

La création d'un compte se fait depuis `/auth`. Le propriétaire ajoute son logement depuis `/logements` puis partage le code à six chiffres ou le lien d'invitation. Le locataire ouvre `/invitation?code=…` et vérifie l’adresse du logement. Les deux parties peuvent ensuite créer des tickets avec photos ou PDF. Chaque ticket et chaque conversation sont visibles par les deux personnes rattachées au logement.

Le lien d'invitation est valable sept jours et ne peut être utilisé qu'une fois. Le propriétaire peut générer un nouveau code si l'invitation expire. Les fichiers acceptés sont JPG, PNG, WebP et PDF, avec une limite de 10 Mo chacun.

## Logements, baux et loyers

Un propriétaire peut gérer plusieurs logements. Un locataire peut rejoindre plusieurs logements avec des invitations distinctes. Le sélecteur « Logement actif » de la barre supérieure limite les dossiers, conversations, documents, baux et loyers au contexte choisi.

Le propriétaire enregistre le bail d'un logement relié à un locataire : dates, loyer, charges, dépôt et jour de paiement. Les deux parties peuvent ajouter des pièces au bail. Le propriétaire crée les échéances mensuelles et enregistre les paiements ; le locataire consulte l'échéancier et les justificatifs partagés.

## Vérification

```bash
npm test
npm run lint
npx tsc --noEmit
npm audit --omit=dev
```

## Cycle des tickets

Le propriétaire ouvre un dossier sur un logement ayant un locataire rattaché. Le titre et la description sont obligatoires, sans longueur minimale. Le journal du dossier conserve les actions réellement effectuées et leurs auteurs.

Le propriétaire propose une intervention, le locataire accepte ou refuse. Après le compte rendu du propriétaire, le locataire confirme ou conteste la réalisation. Une intervention ne ferme jamais le ticket automatiquement.

Une demande de clôture fige les conditions et les pièces choisies. Son auteur donne son accord ; l’autre partie doit accepter la même version. Les dossiers fermés sont consultables ; une réouverture exige un motif. Un litige peut être signalé par les deux parties.

Les confirmations sont des accords internes enregistrés. Aucun service de signature qualifiée, prélèvement automatique, OCR ou envoi d’e-mail n’est configuré.

La migration SQLite v1 conserve les données existantes et photographie les participants de chaque ticket pour isoler les anciens dossiers lors d’un changement de locataire. La migration v2 ajoute les baux, échéances et documents de logement, et autorise plusieurs logements par locataire. Des sauvegardes SQLite cohérentes précèdent les migrations.
