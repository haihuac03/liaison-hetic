# Déploiement Vercel

L'application utilise Turso pour les données relationnelles et un store Vercel Blob privé pour les pièces jointes. Le système de fichiers de Vercel est éphémère: le repli local de `src/lib/server/storage.ts` sert uniquement au développement sur une machine.

## Ressources

1. Créer une base Turso et récupérer son URL `libsql://` ainsi qu'un jeton d'accès.
2. Créer un store Vercel Blob avec un accès privé et utiliser la connexion de stockage Vercel, qui fournit `BLOB_STORE_ID` et l’authentification OIDC.
3. Définir les variables dans les environnements Vercel concernés. Le jeton Turso est un secret à conserver dans Vercel et ne doivent jamais être préfixés par `NEXT_PUBLIC_` ni ajoutés au dépôt.

| Variable | Production | Usage |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Obligatoire | URL distante de la base, en `libsql://` |
| `TURSO_AUTH_TOKEN` | Obligatoire | Secret d'écriture vers Turso |
| `BLOB_STORE_ID` | Fourni par `vercel storage connect` | Store Blob privé via OIDC |
| `BLOB_READ_WRITE_TOKEN` | Alternative | Jeton Blob hors Vercel |
| `APP_ORIGIN` | Obligatoire | Origine HTTPS canonique, sans slash final |
| `COOKIE_SECURE` | `true` | Cookies de session uniquement en HTTPS |

Le fichier [`.env.example`](../.env.example) contient seulement des emplacements vides. Les vrais fichiers `.env` sont ignorés par Git et exclus de l'envoi Vercel.

## Migration et données

Appliquer le schéma Turso depuis une session où les variables Turso sont disponibles. Le fichier `.env.example` ne contient aucun secret; il ne sera pas chargé automatiquement. Pour utiliser un fichier local ignoré par Git:

```bash
cp .env.example .env.local
code .env.local # renseigner uniquement les deux variables Turso
node --env-file=.env.local scripts/db-migrate-cloud.mjs
```

Le même script est disponible avec `npm run db:migrate:cloud` lorsque les variables sont déjà exportées ou chargées par l'environnement d'exécution.

Le script attend le schéma version 3 et vérifie les tables principales. Il peut être relancé: les migrations de l'application sont idempotentes.

Pour une base de démonstration neuve, déployer d'abord l'application, puis lancer explicitement le seed via son API publique. La commande ci-dessous suppose que `APP_ORIGIN` est exporté:

```bash
npm run db:seed:cloud -- --confirm
```

Ce seed utilise `APP_ORIGIN` et crée les comptes de démonstration documentés dans le README. Il ne doit pas être lancé sur une base contenant déjà ces comptes.

Les métadonnées des documents existants peuvent être transférées avec la base Turso, mais les octets correspondants doivent aussi être envoyés dans le store Blob sous `liaison/{diskName}`. Le stockage local de `data/uploads` ne doit pas être considéré comme persistant après un déploiement.

## Vérification avant déploiement

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Next.js est détecté automatiquement par Vercel; aucun `vercel.json` n'est nécessaire pour ce projet. Le déploiement lui-même reste une étape séparée.
