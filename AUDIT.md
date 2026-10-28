# Audit fonctionnel de LIAISON

## Base de démonstration

- Propriétaire : `proprietaire@liaison.demo` / `DemoLiaison2026!`
- Locataire Paris : `locataire1@liaison.demo` / `DemoLiaison2026!`
- Locataire Lyon : `locataire2@liaison.demo` / `DemoLiaison2026!`

Trois comptes, deux logements, deux baux, trois tickets, trois échéances et des documents sont disponibles. Le propriétaire possède Paris et Lyon ; chaque locataire ne voit que son logement.

## Parcours persistants et utilisables

- Authentification propriétaire/locataire, sessions HttpOnly, invitations par code ou lien.
- Plusieurs logements par propriétaire et par locataire, avec sélection persistante du logement actif.
- Isolation des dossiers, messages, fichiers, interventions, accords, litiges et notifications par parties du logement.
- Création de tickets par les deux rôles, historique factuel, pièces jointes et réouverture motivée.
- Propositions d'intervention, décision du locataire, compte rendu, confirmation ou contestation.
- Fermeture bilatérale sur une version figée des conditions, refus et résolution de litige.
- Bail réel par logement : dates, loyer, charges, dépôt, échéance et documents.
- Échéancier de loyer et enregistrement manuel des paiements par le propriétaire.
- Documents de logement et de ticket contrôlés côté serveur, stockés dans SQLite et sur disque.
- Notifications filtrées par logement actif, avec marquage lu réellement enregistré.

## Fonctions volontairement limitées

- L'assistant fournit des réponses générales prédéfinies. Il n'analyse pas les PDF et ne produit pas de conseil juridique personnalisé.
- Les paiements sont saisis manuellement : aucun prélèvement SEPA ni rapprochement bancaire.
- Les quittances sont des fichiers déposés ; aucun PDF de quittance n'est généré automatiquement.
- Le carnet de contacts complémentaires et les préférences d'affichage restent locaux à l'appareil, isolés par compte et logement.
- Aucun service de signature qualifiée, d'e-mail transactionnel, de réinitialisation de mot de passe, de 2FA ou de révocation de sessions distantes n'est configuré.

## Nettoyages réalisés

- Retrait du faux scanner, de l'analyse simulée de documents et des certifications eIDAS fictives.
- Retrait des liens vers les anciens tickets de démonstration et des montants/noms codés en dur dans Contrat, Loyer, Paramètres et Aide.
- Retrait de la progression en pourcentage dans Conversations, du protocole fictif et des actions sans API.
- Suppression de composants de démonstration inutilisés.
- Filtrage des pages et compteurs selon le logement actif.
- Identifiants raccourcis à l'affichage pour éviter le débordement mobile.
- Modales avec focus captif, fermeture par Échap, restauration du focus et verrouillage du défilement.
- Navigation mobile défilante, titres de page, lien d'évitement et libellés de rôle accessibles.

## Sécurité et exploitation

- Next.js 16.4.3 et React 19.3.1 ; `npm audit --omit=dev` ne signale aucune vulnérabilité.
- Contrôles d'origine, limitation de tentatives sur connexion/inscription/invitations, cookies HttpOnly.
- En-têtes CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` et `Permissions-Policy`.
- Répertoire `data/` et fichiers SQLite restreints aux permissions du compte local.
- Migrations additives SQLite v1 à v3 avec sauvegardes successives.

## Validation

```bash
npm test
npm run lint
npx tsc --noEmit
npm audit --omit=dev
npm run build
```

Le lint passe sans erreur et conserve quelques avertissements non bloquants sur les aperçus d'images dynamiques et les dépendances de hooks historiques.
