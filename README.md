# LNovel Author Studio

Studio web pour creer des light novels data-driven:
- graphe de blocs (`title`, `cinematic`, `dialogue`, `gameplay`)
- variables et effets `+/-`
- preview de parcours
- export `story.json + assets` en ZIP
- sauvegarde cloud Supabase (projets, droits, logs)
- partage collaborateurs par email
- maintenance assets (nettoyage refs locales + purge cloud orphelins)

## Prerequis

- Node.js 20+
- Un projet Supabase

## Installation

```bash
npm install
```

Copie `.env.example` en `.env.local` puis renseigne:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# ou (nouveau nom Supabase):
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_ENABLE_SELF_SIGNUP=false
ENABLE_HTTP_BASIC=false
BETA_HTTP_BASIC_USER=...
BETA_HTTP_BASIC_PASS=...
SUPABASE_SERVICE_ROLE_KEY=...
# ou (nouveau nom Supabase):
# SUPABASE_SECRET_KEY=...
```

## Backend Cadarium local

Pour utiliser le backend Cadarium local sans modifier le déploiement Vercel:

```bash
NEXT_PUBLIC_BACKEND_MODE=cadarium
NEXT_PUBLIC_CADARIUM_API_URL=http://localhost:3001
```

Sans `NEXT_PUBLIC_BACKEND_MODE=cadarium`, le Studio conserve l'adaptateur Supabase. Le mode Cadarium couvre la connexion, l'inscription locale, la restauration de session, les rôles, l'administration des comptes, le changement de mot de passe et les projets cloud. Une sauvegarde cloud transfère le document et tous ses médias privés avant de confirmer la réussite. La réinitialisation par email reste désactivée tant qu'un service d'envoi n'est pas configuré.

## Setup Supabase

Mode actuel recommande pour MVP sans sauvegarde cloud:

- utiliser Supabase uniquement pour l'authentification et `author_profiles`;
- ne pas creer les tables projet ni le bucket Storage;
- executer uniquement `supabase/migrations/20260629_auth_profiles_only.sql`
  sur un nouveau projet Supabase;
- les projets se sauvegardent via `Export ZIP` et se reprennent via `Import ZIP`.

La premiere personne inscrite apres cette migration devient `admin`. Les comptes suivants
sont `reader` par defaut et peuvent etre passes `author` depuis l'administration.

Ancien mode cloud complet (desactive dans l'application actuelle):

Execute les migrations SQL dans cet ordre:

- `supabase/migrations/20260224_author_studio.sql`
- puis `supabase/migrations/20260224_fix_rls_stack_depth.sql`
- puis `supabase/migrations/20260224_storage_assets.sql`
  (bucket Storage `author-assets` + policies assets)
- puis `supabase/migrations/20260224_harden_security_locking.sql`
  (durcissement profils + verrou cloud atomique + indexes)
- puis `supabase/migrations/20260225_platform_roles_admin.sql`
- puis `supabase/migrations/20260227_security_reader_hardening.sql`
  (lecteur par defaut + verrouillage des champs sensibles + hardening ecriture)

Important: si tu vois l'erreur `stack depth limit exceeded`, c'est que le patch
RLS ci-dessus n'a pas ete applique (ou pas sur le bon projet Supabase).

Cette migration cree:
- `author_projects` (payload JSON du projet)
- `author_project_access` (droits `owner|write|read`)
- `author_project_logs` (journal cloud)
- `author_profiles` (annuaire auteur)
- RLS + policies (lecture/ecriture selon droits)
- bucket Supabase Storage `author-assets` (medias image/video/audio)
- fonctions RPC securisees:
  - `project_member_profiles`
  - `project_resolve_user_by_email`
  - `acquire_project_lock`
  - `release_project_lock`

## Lancer

```bash
npm run dev
```

Puis ouvre `http://localhost:3000`.

## Workflow cloud actuel

1. Connexion via l'encart Supabase Cloud : entre ton email + mot de passe, clique `Se connecter` (ou `Creer un compte` si tu n'as pas encore de compte).
2. `Creer + sauvegarder` pour creer un projet cloud ; les assets sont uploades dans Storage et la liste des projets apparait automatiquement.
3. Clique sur `Ouvrir` dans la liste `Mes projets cloud` pour recharger un projet existant sans copier d'UUID.
4. Prends un verrou cloud avant edition (`Prendre verrou cloud`), puis libere-le en fin de session.
5. Partage via email du collaborateur et niveau `read|write`.
6. Protection anti ecrasement: sauvegarde refusee si une revision cloud plus recente existe.
7. Maintenance assets:
   - `Nettoyer refs locales` retire les references non utilisees du payload local.
   - `Nettoyer assets cloud` supprime dans Storage les fichiers non references par le projet.

Note migration assets: les projets sauvegardes avant cette version peuvent avoir des
assets sans `storagePath`. Reimporte ces fichiers une fois puis sauvegarde cloud.

## Contrat JSON

Le format exporte est documente ici:

- `docs/story-json-contract.md`

## RGPD / Legal (minimum)

- Politique de confidentialite (modele): `docs/legal/politique-confidentialite.md`
- Mentions legales (modele): `docs/legal/mentions-legales.md`
- Pages web publiques:
  - `/confidentialite`
  - `/mentions-legales`
Les pages publiques lisent des valeurs `LEGAL_*` (voir `.env.example`) pour personnaliser les informations legales.

## Verification

```bash
npm run lint
npm run test
npm run build
```

## Deploiement Vercel (hygiene)

- Le fichier `.vercelignore` exclut `supabase/`, `docs/` et `.github/` du bundle de build.
- Les scripts SQL restent en local/repo pour la traçabilité infra, sans etre deployes dans l'artefact Vercel.
- Auth HTTP Basic optionnelle en production:
  - `ENABLE_HTTP_BASIC=true` active le prompt HTTP Basic.
  - `ENABLE_HTTP_BASIC=false` desactive ce prompt (auth Supabase uniquement).
