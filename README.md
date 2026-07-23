# LNovel Author Studio

Studio web pour créer des light novels pilotés par les données :

- graphe de blocs narratifs ;
- variables, conditions et effets ;
- création et gestion des médias ;
- prévisualisation du parcours ;
- export ZIP compatible avec Story Player ;
- sauvegarde des projets et médias dans Cadarium Cloud ;
- gestion des comptes et rôles.

## Prérequis

- Node.js 22 ou supérieur ;
- backend Cadarium local opérationnel.

## Installation

```bash
npm install
```

Copier `.env.example` dans `.env.local`, puis utiliser :

```bash
NEXT_PUBLIC_ENABLE_SELF_SIGNUP=true
NEXT_PUBLIC_BACKEND_MODE=cadarium
NEXT_PUBLIC_CADARIUM_API_URL=/api/cadarium
CADARIUM_API_URL=http://localhost:3001
```

`NEXT_PUBLIC_CADARIUM_API_URL` désigne le proxy Next utilisé par le navigateur. `CADARIUM_API_URL` désigne l’adresse privée du backend appelée par le serveur Next.

## Lancement local

Démarrer PostgreSQL et MinIO depuis le dossier `backend`, puis lancer l’API Cadarium :

```bash
cd ../backend
docker compose up -d
npm run dev
```

Dans un second terminal, lancer le Studio :

```bash
cd ../author-studio
npm run dev
```

Ouvrir `http://localhost:3000`.

Le premier compte créé devient administrateur. Les comptes suivants sont lecteurs par défaut et peuvent recevoir le rôle auteur depuis l’administration.

## Cadarium Cloud

Une sauvegarde Cadarium Cloud enregistre :

- le document complet du projet dans PostgreSQL ;
- les médias privés dans MinIO ;
- la révision du projet pour empêcher les écrasements concurrents.

Chaque auteur ne voit que ses propres projets. Export ZIP reste disponible comme copie locale et format de livraison à Story Player.

## Contrat JSON

Le format exporté est documenté dans `docs/story-json-contract.md`.

## Vérification

```bash
npm run lint
npm test
npm run build
```

Le parcours réel d’inscription Cadarium peut être vérifié avec :

```bash
npx playwright test --config=playwright.cadarium.config.ts
```

## Pages légales

Les pages `/confidentialite` et `/mentions-legales` utilisent les variables `LEGAL_*` définies dans `.env.example`.

## Déploiement

Le Studio et le backend Cadarium doivent utiliser HTTPS. `CADARIUM_API_URL` reste une variable serveur et ne doit contenir aucun secret. Les secrets PostgreSQL, MinIO et de signature restent exclusivement dans la configuration du backend.
