# Contrat backend (Author Studio)

Ce document fige le contrat entre le front Author Studio et son backend.
Aujourd'hui le backend est Supabase (auth GoTrue + table `author_profiles` + RPC),
partiellement masque derriere des API routes Next (BFF). Ce contrat est la
reference pour reimplementer un backend maison sans toucher au front.

Statut: la sauvegarde cloud des projets a ete supprimee (2026-07). Les projets
se sauvegardent en local via Export/Import ZIP. Le backend ne gere plus que:
comptes, sessions, roles plateforme et administration des utilisateurs.

## Vocabulaire domaine

- `AuthorUser`: utilisateur connecte (`id`, `email`).
- `PlatformRole`: `admin | author | reader`.
- `PlatformProfile`: profil plateforme (`userId`, `email`, `displayName`, `platformRole`, `createdAt`).

## Matrice des roles

| Operation                          | reader | author | admin |
| ---------------------------------- | ------ | ------ | ----- |
| Se connecter / se deconnecter      | oui    | oui    | oui   |
| Voir son profil / son role         | oui    | oui    | oui   |
| Changer son mot de passe           | oui    | oui    | oui   |
| Supprimer son propre compte        | oui    | oui    | oui (sauf dernier admin) |
| Utiliser les outils de creation    | non    | oui    | oui   |
| Lister tous les profils            | non    | non    | oui   |
| Creer un utilisateur               | non    | non    | oui   |
| Supprimer un utilisateur           | non    | non    | oui   |
| Changer le role d'un utilisateur   | non    | non    | oui   |

Le front applique en plus: `canEdit = platformRole in (admin, author)`.
Un compte `reader` voit le studio mais ne peut pas editer (bandeau explicatif).

## Operations

### Auth (cote client, actuellement Supabase GoTrue)

| Operation           | Entrees               | Sortie                   | Regles |
| ------------------- | --------------------- | ------------------------ | ------ |
| signIn              | email, password       | session (user + tokens)  | compte existant uniquement |
| signUp              | email, password       | session ou "confirme ton email" | autorise seulement si `NEXT_PUBLIC_ENABLE_SELF_SIGNUP` = true; role initial `reader` |
| signOut             | -                     | -                        | best-effort |
| getSession          | -                     | session courante ou null | rafraichissement auto des tokens |
| onSessionChange     | callback              | abonnement               | evenements: connexion, deconnexion, refresh token |
| changePassword      | newPassword (>= 8)    | ok / erreur              | efface le flag `must_change_password` des metadata |
| requestPasswordReset | email                | ok (toujours)            | envoie un email avec lien vers `/reinitialisation`; reponse neutre que le compte existe ou non (anti-enumeration) |
| getAccessToken      | -                     | JWT                      | utilise pour authentifier les appels BFF |

Transport du token vers le BFF: header `x-supabase-access-token` (historique).
Cible pour le backend maison: `Authorization: Bearer <token>`.

### Profil (cote client)

| Operation      | Entrees | Sortie        | Regles |
| -------------- | ------- | ------------- | ------ |
| getMyRole      | userId  | PlatformRole  | lecture `author_profiles.platform_role` (RLS: select self uniquement). En cas d'erreur reseau transitoire, le front conserve le dernier role connu au lieu de retrograder en `reader`. |

### Admin

| Operation             | Implementation actuelle          | Entrees                          | Sortie |
| --------------------- | -------------------------------- | -------------------------------- | ------ |
| listProfiles          | RPC `platform_list_profiles`     | -                                | PlatformProfile[] (tries par createdAt asc) |
| setProfileRole        | RPC `platform_set_profile_role`  | targetUserId, nextRole           | boolean (false = refus, voir regles) |
| createUser            | BFF `POST /api/admin/create-user`| email, password, role, displayName? | { ok, userId, email, role } |
| deleteUser            | BFF `POST /api/admin/delete-user`| userId                           | { ok } |

### Compte

| Operation       | Implementation actuelle           | Entrees | Sortie |
| --------------- | --------------------------------- | ------- | ------ |
| deleteMyAccount | BFF `POST /api/account/delete`    | -       | { ok } |

## Regles metier (source: routes BFF + SQL Supabase)

Ces regles vivent aujourd'hui dans les API routes, les RPC `security definer`,
les policies RLS et les triggers. Un backend maison DOIT les reimplementer.

1. **Bootstrap admin**: le premier compte cree sur une instance vierge recoit
   automatiquement le role `admin` (trigger `handle_new_auth_user`).
2. **Provisioning profil**: a chaque creation de compte auth, un profil
   `author_profiles` est cree/mis a jour automatiquement. `display_name` par
   defaut: metadata `display_name`, sinon partie locale de l'email, sinon "Auteur".
3. **Self-signup**: role initial `reader`, jamais plus (policy RLS force
   `platform_role = 'reader'` a l'insertion par l'utilisateur).
   Attention: `NEXT_PUBLIC_ENABLE_SELF_SIGNUP` ne bloque que l'interface.
   Le blocage reel se fait cote fournisseur d'auth (dashboard Supabase:
   Authentication > Providers > Email > Enable sign ups). Le backend maison
   devra appliquer ce flag cote serveur.
4. **Email**: l'email du profil est un miroir de `auth.users`; il ne peut pas
   etre modifie par l'utilisateur (trigger `guard_author_profiles_sensitive_fields`).
5. **Changement de role**: reserve aux admins (trigger + RPC). Retrograder le
   dernier admin est refuse.
6. **Dernier admin**: il est impossible de supprimer le dernier compte admin,
   que ce soit via l'admin (`delete-user`) ou en supprimant son propre compte
   (`account/delete`). Reponse: 409.
7. **Auto-suppression via admin interdite**: un admin ne peut pas se supprimer
   via `delete-user` (409); il doit passer par `account/delete`.
8. **Unicite email**: creation refusee (409) si un profil existe deja pour l'email.
9. **Mot de passe**: minimum 8 caracteres (creation admin et changement).
10. **Mot de passe provisoire**: un compte cree par un admin a
    `must_change_password = true` dans les metadata (email pre-confirme).
    Le flag est efface au premier changement de mot de passe.
11. **Verification admin cote serveur**: chaque route BFF verifie le token,
    recharge le profil du demandeur avec la cle service et exige `admin`
    (jamais de confiance dans le client).
12. **RLS profils**: un utilisateur ne peut lire que son propre profil; le
    listing complet passe par la RPC `platform_list_profiles` (security definer).
13. **Reinitialisation mot de passe**: la demande repond toujours succes
    (anti-enumeration). Le lien recu par email ouvre une session de
    recuperation sur `/reinitialisation`, ou l'utilisateur saisit son nouveau
    mot de passe (>= 8). La validite/expiration du lien est geree par le
    fournisseur d'auth. Config Supabase requise: ajouter
    `https://<domaine>/reinitialisation` dans Authentication > URL
    Configuration > Redirect URLs.

## Erreurs

Enveloppe JSON: `{ "error": string }` avec code HTTP.

| Code | Sens                                    | Exemples |
| ---- | --------------------------------------- | -------- |
| 400  | payload invalide                        | email invalide, mot de passe < 8, role inconnu |
| 401  | token manquant ou session invalide      | header absent, JWT expire |
| 403  | droits insuffisants                     | demandeur non admin |
| 409  | conflit avec une regle metier           | email deja pris, dernier admin, auto-suppression |
| 429  | trop de requetes (rate limit)           | rafale depuis une meme IP sur les routes BFF |
| 500  | erreur serveur / configuration          | env manquante, erreur DB |

Note 429: l'implementation actuelle est un compteur en memoire par instance
serverless (best-effort, 30 req/min/IP). Le backend maison devra fournir un
rate limiting partage (store commun ou middleware d'infra).

Les RPC `platform_*` ne levent pas d'erreur HTTP: elles retournent `false` en
cas de refus (droits, dernier admin, cible inexistante, role invalide).

## Configuration (env)

| Variable | Role |
| -------- | ---- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de l'instance Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cle publique (client + verification token BFF) |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | cle service (BFF uniquement, jamais exposee au client) |
| `NEXT_PUBLIC_ENABLE_SELF_SIGNUP` | active l'inscription libre (defaut: false) |
| `ENABLE_HTTP_BASIC` + `BETA_HTTP_BASIC_USER/PASS` | verrou HTTP Basic global en production (phase beta, middleware) |

## Cible backend maison

Le front consomme le backend uniquement via les ports TypeScript de
`src/lib/backend/` (interfaces `AuthPort`, `AdminPort`, ...) et via les routes
BFF `/api/*`. Remplacer Supabase =

1. Reimplementer les routes BFF (ou les faire pointer vers le nouveau serveur)
   en respectant les operations, regles et erreurs ci-dessus.
2. Fournir un adaptateur `AuthPort` pour le nouveau systeme d'auth (JWT/OIDC
   recommande: signIn/signOut/refresh/changePassword suffisent).
3. Rejouer les regles metier 1 a 12 cote serveur.

Toute evolution du contrat (nouvelle operation, nouveau champ, nouvelle regle)
doit etre reportee dans ce document.
