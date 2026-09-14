# 🔐 SUITE — Sécurité multi-tenant (plan d'exécution)

> Rédigé le 2026-09-14 après les commits `06335b5` → `8e085a8` (routes sans auth, démo cantonnée
> au tenant sandbox, générateur d'école, sanitisation du thème). Ce document liste ce qui reste
> **ouvert**, avec l'analyse faite et les étapes concrètes, pour être exécuté tel quel.

## Rappel de l'architecture (état actuel)

| Couche | Décision | Où |
|---|---|---|
| Base ciblée (`prod` / `sandbox`) | `middleware.js` → en-tête `x-tenant-db` (réécrit, non forgeable) | `middleware.js` |
| Mode démo (compte factice + `mock_role`) | accordé **uniquement** si `x-tenant-db === 'sandbox'` | `app/api/lib/tenant.js`, `authWithFallback.js` |
| Identité + rôle | `getAuthAndRole` → `requireFamilyScope` (`staffOnly`, `adminOnly`) | `utils/roles.js`, `app/api/lib/familyScope.js` |
| École courante | **cookie `x-school-key`, lu tel quel** par 43 routes | `grep -rl "x-school-key" app/api` |

Le dernier point est le cœur des trois chantiers ci-dessous.

---

## Chantier A — Cloisonnement par `schoolKey` côté serveur (priorité 1)

### Constat
- 43 fichiers sous `app/api` lisent `cookies().get('x-school-key')` (ou l'en-tête) et l'utilisent
  directement comme filtre Mongo. Le cookie est posé côté client (`LandingPage.jsx`,
  `SandboxRoleSelector.jsx`, `POST /api/sandbox/create`).
- Deux valeurs par défaut coexistent : `'ecole_st_martin'` (38 occurrences) et `'demo_master'`
  (6 : `bootstrap`, `ecole`, `extract-*`, `generate-game`, `viescolaire/dashboard`). Un même
  utilisateur sans cookie voit donc des écoles différentes selon la route.
- Conséquence : un compte connecté sur le tenant **prod** (admin de sa propre école `school_xxx`)
  peut poser `x-school-key=school_autre` et lire/écrire les données d'une autre école. Les gardes
  de rôle (`adminOnly`, `staffOnly`, `familyScope`) ne regardent pas l'école.

### Cible
Une seule fonction serveur décide de l'école courante :

```js
// app/api/lib/schoolScope.js (à créer)
export async function resolveSchoolKey(auth) {
  // 1. Tenant sandbox : le cookie fait foi (démo anonyme, écoles sandbox_*), défaut 'demo_master'.
  // 2. Tenant prod   : User.findOne({ clerkId: auth.userId }).schoolKey fait foi.
  //    - super-admin (NEXT_PUBLIC_EMAIL_ADMIN) : peut surcharger via le cookie (support multi-écoles).
  //    - sinon : le cookie est IGNORÉ ; si User.schoolKey absent → 'ecole_st_martin'.
}
```

et `requireFamilyScope` l'expose : `{ auth, allowedStudentIds, isStaff, schoolKey }`.

### Étapes
1. Créer `app/api/lib/schoolScope.js` (fonction ci-dessus, + `SANDBOX_DEFAULT_KEY = 'demo_master'`,
   `PROD_DEFAULT_KEY = 'ecole_st_martin'`).
2. Dans `familyScope.js`, appeler `resolveSchoolKey(auth)` dans `requireFamilyScope` et renvoyer
   `schoolKey`. Un seul `User.findOne` : fusionner avec celui de `resolveFamilyScope`
   (sélectionner `schoolKey roleData.childrenRefs roleData.eleveRef` en une requête).
3. Migrer les 43 routes, par lots, en remplaçant la lecture du cookie par `scope.schoolKey` :
   - Lot 1 (déjà sur `requireFamilyScope`) : `school_ai/{carnet,incidents,socle,orientation,stage,
     inclusive_devices,dnb,conseil,generate}`, `salles`, `notes`.
   - Lot 2 (sur `withAuth` / `checkRole`) : `school_ai/{classes,eleves,enseignants,bootstrap,ecole,
     extract-*,generate-game,admin/migrate,viescolaire/dashboard}`, `classes/[id]/*`,
     `students/[id]/*`, `schedules/teacher/[id]`, `points/award`, `gallery`.
   - Lot 3 (social) : `articles`, `events`, `appointments`, `global/feed`, `groups/[id]/*`,
     `conversations/[id]/messages`.
   Pour `withAuth`, ajouter `ctx.schoolKey` (appeler `resolveSchoolKey` dans le HOF) pour éviter
   de réécrire chaque handler.
4. `middleware.js` : la ligne `else if (schoolKey === 'ecole_st_martin') tenantDb = 'prod'` route un
   **anonyme** vers la prod sur simple cookie. À conserver seulement si le site public de l'école
   historique doit lire la prod sans compte (page d'accueil, articles) ; sinon supprimer. Vérifier
   `app/page.jsx` / `Home.jsx` avant de trancher.
5. Vérification : build vert + scénario Playwright « admin école A pose le cookie de l'école B →
   `GET /api/school_ai/eleves` renvoie les élèves de A ». Voir `tests/e2e` pour le harnais existant
   (cookies `mock_role`, mode `NEXT_PUBLIC_MODE=test`).

### Gotchas
- `dbConnect()` doit être appelé avant `resolveSchoolKey` (lecture `User`).
- `User` est lu dans le tenant courant : en sandbox, les comptes convertis (`sync-user`) y vivent ;
  en prod, les comptes approuvés (`approve-school`). Ne pas chercher un User prod depuis la sandbox.
- Les 6 routes à défaut `demo_master` sont celles que la démo anonyme utilise : garder ce défaut
  **en sandbox uniquement**.

---

## Chantier B — Routage sandbox des comptes connectés (priorité 2, dépend de A)

### Constat
- `middleware.js` route un compte Clerk vers **prod** sauf si cookie/en-tête `x-school-key`
  commence par `sandbox_` ou en-tête `x-tenant-mode: sandbox`.
- Rien côté client n'envoie la clé `sandbox_*` d'un compte converti : `sync-user` la stocke dans
  `User.schoolKey` (et le rôle dans Clerk `publicMetadata.role`), mais le middleware (edge, sans
  Mongo) ne la voit pas. Un propriétaire de bac à sable qui efface ses cookies retombe sur la prod
  avec son rôle `admin` lu en base (fixé par A : il n'aura alors accès qu'à `ecole_st_martin` par
  défaut, ce qui reste faux fonctionnellement).

### Cible
Le middleware connaît le tenant d'un compte connecté **sans requête Mongo**.

### Étapes (option retenue : Clerk `publicMetadata`)
1. `sync-user` et `approve-school` : écrire aussi `publicMetadata.schoolKey` (à côté de `role`).
   Script one-shot pour les comptes existants (`User.find({}, 'clerkId schoolKey')` →
   `clerkClient().users.updateUserMetadata`).
2. Clerk Dashboard → *Sessions → Customize session token* : ajouter
   `{ "metadata": "{{user.public_metadata}}" }` pour que `auth().sessionClaims.metadata.schoolKey`
   soit disponible dans le middleware (c'est déjà le chemin lu par `checkRole` pour `role`).
3. `middleware.js` : après `const authObj = await auth()`, si
   `authObj.sessionClaims?.metadata?.schoolKey?.startsWith('sandbox_')` → `tenantDb = 'sandbox'`,
   et poser `x-school-key` dans les en-têtes transmis (le serveur lira cette valeur, pas le cookie,
   grâce à A).
4. `SandboxRoleSelector.quitSandbox` et `LogSignIn` : ne plus effacer `x-school-key` pour un compte
   connecté (le rattachement devient serveur).
5. Alternative sans Clerk : `sync-user` pose un cookie `x-school-key` **httpOnly** dans sa réponse.
   Plus simple, mais le cookie reste contrôlable par l'utilisateur → n'est acceptable qu'après A.

---

## Chantier C — Purge des sandboxes (priorité 3, prêt)

- Route : `GET /api/cron/cleanup-sandboxes` (Bearer `CRON_SECRET`, refus 503 si absent).
- `vercel.json` déclare le cron quotidien à 03:00 UTC (fait le 2026-09-14). Vercel envoie
  automatiquement `Authorization: Bearer $CRON_SECRET` si la variable est définie sur le projet.
- Reste : définir `CRON_SECRET` sur Vercel (`vercel env add CRON_SECRET production`) et en local
  (`.env`) ; vérifier après le premier run que `purged` est cohérent (Institution `isReal:false`,
  `ownerClerkId:null`, `createdAt < 48 h`, clé `sandbox_*`).
- Extension possible : purger aussi `Post/Group/Event/Article/...` par `schoolKey` (la route ne
  couvre que Eleve/Teacher/Classe/Note/Schedule/Subject/SchoolSettings/Institution, ce que le
  générateur crée).

---

## Divers relevés en chemin (non bloquants)

- `authWithFallback` étape 2 décode un JWT **sans vérifier sa signature** (`atob` du payload) quand
  `auth()` échoue. Inoffensif tant que `x-clerk-auth-status` est exigé (posé par Clerk), mais à
  supprimer : Clerk gère déjà le cas.
- `LogSignIn.jsx` contient une table de rôles par préfixe d'e-mail (`hi.cyril`, `prof`…) qui ne
  sert plus (variable `myRole` jamais utilisée) : à retirer.
- Deux clés par défaut (`ecole_st_martin` / `demo_master`) : unifier dans `schoolScope.js` (A.1).
- `TODOs/etape8_audit.md` et `walkthrough.md` décrivent des états périmés : à archiver dans
  `TODOs/DONE` une fois A et B livrés.
