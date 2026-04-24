# Suite de tests unitaires — CNGIRI Platform

> **47 suites · 662 tests · ~4 s d'exécution**
> **Couverture lignes : 90.19 %** · Statements : 89.28 % · Functions : 87.84 % · Branches : 82.03 %
> Stack : Jest 30, mocks pg + modèles + dépendances binaires (pdfkit, docx, openai). Aucune DB réelle requise.

## Table des matières

1. [Lancer les tests](#lancer-les-tests)
2. [Organisation](#organisation)
3. [Aspects fonctionnels couverts](#aspects-fonctionnels-couverts)
4. [Couverture par fichier](#couverture-par-fichier)
5. [Niveau 1 — Utils & middlewares](#niveau-1--utils-et-middlewares)
6. [Niveau 2 — Modèles](#niveau-2--modèles)
7. [Niveau 3 — Contrôleurs](#niveau-3--contrôleurs)
8. [Patterns & conventions](#patterns-et-conventions)
9. [Mocks des dépendances binaires](#mocks-des-dépendances-binaires)
10. [Ce qui n'est PAS couvert](#ce-qui-nest-pas-couvert)
11. [Étendre la suite](#étendre-la-suite)

---

## Lancer les tests

```bash
npm test                 # toute la suite
npm run test:coverage    # + rapport HTML dans coverage/
npm run test:watch       # mode watch
```

## Organisation

```
tests/
├── setup.js                            # env vars + silence console
├── TESTS.md                            # ce fichier
├── helpers/
│   ├── db.js                           # factory mock pour src/config/db
│   └── http.js                         # mockReq / mockRes / mockNext
└── unit/
    ├── utils/                          # 3 fichiers
    ├── middlewares/                    # 3 fichiers
    ├── models/                         # 17 fichiers (dont .extra pour branches complémentaires)
    └── controllers/                    # 22 fichiers
```

Chaque fichier `*.test.js` miroite un fichier `src/`. Les modèles mockent `src/config/db` ; les contrôleurs mockent les modèles qu'ils importent.

## Aspects fonctionnels couverts

Cette section décrit **ce que la suite protège réellement** du point de vue produit et sécurité — au-delà du simple pourcentage de lignes.

### 🔐 Authentification & identité

- **Login classique** : rejet credentials vides (400), user inconnu ou désactivé (401), mauvais mot de passe (401), émission d'un **JWT vérifié cryptographiquement** dans le test, **suppression du `password_hash`** de la réponse, mise à jour de `last_login`.
- **Middleware `protect`** : rejet si header `Authorization` absent, token forgé, user supprimé depuis la création du token, compte désactivé a posteriori. Attachement de `req.user` avec structure jointe.
- **Clés API** : format strict `cngiri_` + 32 chars base64url, **hash SHA-256 déterministe** stocké en base (la clé claire n'est montrée qu'à la création), rejet si clé révoquée / expirée / user désactivé. Rate-limiting IP + rate-limiting par clé couverts.
- **Changement de mot de passe** : vérif de l'ancien mot de passe (401 sinon), validation du nouveau (règles : ≥ 8 chars, maj, min, chiffre — **pas** de caractère spécial obligatoire).
- **Logout** : idempotent côté serveur.

### 🛡️ Autorisation & contrôle d'accès

La matrice d'accès aux projets est testée pour **les 7 rôles** (`admin`, `superviseur`, `directeur`, `utilisateur`, `commandement_territorial`, `lecteur`, `auditeur`) :

| Rôle | Projets visibles |
|---|---|
| admin, superviseur | tous |
| lecteur/auditeur global (sans structure) | tous |
| lecteur/auditeur scopé | via `project_structures` |
| utilisateur, directeur | via `project_structures` (DPGI + structures assignées) |
| commandement_territorial | via localities/sites dans son territoire (region/departement/arrondissement) |

- **Redaction financière pour le rôle `lecteur`** : `budget` mis à null, `funding[]` vidé. Testé sur `getAllProjects` et `getProjectById`.
- **Garde-fou `commandement_territorial` incomplet** (sans level/value) → 403 sur **les 7 endpoints dashboard** (sinon fuite globale).
- **PV (procès-verbaux)** : seul le commandement territorial complet peut créer/modifier ; visibility SQL dynamique testée par rôle ; `_replaceRefs` **rejette les IDs hors territoire de l'auteur** (403).
- **Observations** : **seul le superviseur peut créer**. Admin peut modérer (authorId = null dans l'UPDATE). Les superviseurs ne peuvent modifier que leurs propres observations.
- **Mesures** : seuls assigné, chef de projet ou admin peuvent modifier le statut. Seul chef de projet ou admin peut assigner un utilisateur ou réassigner.
- **Commentaires** : auteur ou admin pour supprimer ; `canUserModify` testé.
- **Géométries** : **404 (pas 403)** si on tente d'accéder à une géométrie d'un autre projet — évite les attaques par traversée d'ID.

### ✅ Validation des entrées

- **Emails** : regex covering cases invalides (`@@`, sans TLD).
- **Mots de passe** : 4 règles explicites vérifiées.
- **Usernames** : ≥ 3 chars, `[a-zA-Z0-9_]`.
- **Dates** : 4 formats acceptés (`YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `DD/MM/YY` avec logique 2-digit year > 50 → 19xx).
- **Pourcentages** : 0-100 uniquement, refus de strings.
- **Statuts projet** : whitelist stricte (`demarrage/en_cours/termine/retard/annule`).
- **Priorités** : `normale/haute/urgente` (ou `info/importante/urgente` pour PV et observations).
- **Types de projet** : `renforcement_resilience/structurant`.
- **Niveaux de vulnérabilité** : `normal/elevee/tres_elevee` avec `_validateVulnerabilityLevel` et `_validateVulnerability`.
- **Codes structure** : majuscules + chiffres uniquement (`^[A-Z0-9]+$`).
- **Coordonnées géographiques** : linestring ≥ 2 points, polygon anneau ≥ 4 points, points numériques finis.
- **Sanitize XSS** : retrait de `<` et `>`, trim.
- **Validation partielle (PATCH)** : `validateProjectDataForUpdate` n'exige aucun champ ; autorise `null` sur dates pour clear ; accepte `project_type=""` pour reset.

### 🧨 Anti-injection SQL

Un attaquant ne peut pas injecter de SQL via les paramètres de territoire :

- `ProjectModel.findByTerritory(level, value)` : `level` **whitelist** `region/departement/arrondissement`, rejet sinon.
- `ProjectModel.getStatsByTerritory` : idem.
- `DashboardModel._territorySubquery` + toutes les variantes `*ByTerritory` : idem.
- `DecoupageModel.getAllByLevel(level)` : idem.
- `PvModel._replaceRefs` : idem côté auteur.

Chaque cas a un test qui passe `pays` et vérifie le throw `Invalid territorial level`.

### 💾 Transactions PostgreSQL

Toutes les méthodes faisant plusieurs écritures sont testées pour **BEGIN → opérations → COMMIT** et **BEGIN → opérations → ROLLBACK + release** :

- `ProjectModel.updateLocalities/Sites/Measures/Stakeholders/Funding` (batch updates)
- `ProjectStructure.assignMultipleStructures` (DELETE + INSERT multiples)
- `PvModel.create / update` (INSERT PV + _replaceRefs)
- `GeometryModel.importGeoJSON` (INSERT N features avec rollback global)
- `SeedController.resetDatabase / populateDatabase` (11 DELETEs + séquences)

Pour chaque : vérification que le `client.release()` est appelé même en cas d'erreur (pas de fuite de connexion).

### 📊 Règles métier CNGIRI

- **Soft delete des projets** : `delete` marque `deleted_at = CURRENT_TIMESTAMP` (réversible via `restore`) ; `hardDelete` fait un vrai DELETE. Les listes (`findAll`, `findByTerritory`) excluent systématiquement `deleted_at IS NOT NULL`.
- **`is_pcs` (Plan Communal de Sauvegarde)** : réservé aux projets portés par la structure **DPGI**. Si le projet n'a pas `structure.code = 'DPGI'`, `is_pcs` est forcé à `false` côté `addSite` et `updateSites`.
- **Auto-linking structures ↔ projets** : à la création d'une mesure avec `structure_id`, insertion automatique dans `project_structures` (avec `ON CONFLICT DO NOTHING`). `updateMeasures` déduplique via `Set` pour éviter les INSERTs redondants.
- **Mesures auto-liées lors de réassignation** : `reassignMeasure` filtre sur `project_id` (anti-cross-project) et auto-lie la nouvelle structure au projet.
- **Notifications automatiques** : changement de statut d'une mesure → tous les watchers (admin, directeur de la structure, chef de projet, assigné), en excluant l'auteur du changement. Commentaire sur une mesure → notif à l'assigné si ≠ auteur.
- **Cap anti-DoS sur import GeoJSON** : 500 features maximum par requête (413 Payload Too Large sinon).
- **Clé API** : rate limiters pré-auth (par IP, 300 req/min) et post-auth (par clé, 100 req/min).
- **Priorisation des mesures "mes mesures"** : tri par urgence (non-exécutées d'abord), priorité projet, échéance, puis création.

### 🌐 API publique v1 (`/api/v1`)

L'API externe (authentifiée par clé API) est totalement couverte :
- Listes de projets avec filtres et mode `detail=full/minimal`
- Détail projet avec redaction selon rôle
- Statistiques agrégées (counts par statut/priorité/structure + moyenne)
- Structures (DTO minimal exposé)
- Observations du Ministre
- PV du Commandement Territorial
- **Spec OpenAPI 3.0.3 auto-générée** (paths, securitySchemes ApiKeyAuth) vérifiée valide

### 🤖 Chat IA (`/api/chat`)

Le chat avec tools OpenAI est couvert via mocks complets :
- Les **7 tools** exposés au LLM sont tous testés : `list_projects`, `get_project`, `get_stats`, `list_structures`, `list_observations`, `list_pv`, `get_pv`.
- Cas d'erreur pour chaque tool (404, accès refusé, JSON args invalides, tool inconnu, exception).
- **Boucle max 5 itérations** pour éviter les boucles infinies tool-call → 500 si pas de réponse finale.
- Les mêmes règles de visibilité par rôle que le reste de l'app s'appliquent (commandement → `findByTerritory`, utilisateur → `getProjectsByStructure`, admin → `findAll`).

### 📄 Génération de rapports

Le pipeline `reports` (OpenAI → Markdown → PDF/DOCX) est couvert à **95.51 %** :
- Validation format (pdf/docx uniquement)
- Dispatching par rôle pour la sélection des projets
- Filtres optionnels (status, priority, structure_id)
- Erreurs OpenAI : clé absente (500), 401 clé invalide, 429 rate limit, timeout base → 503
- Helpers `renderMarkdownToPdf` et `markdownToDocxElements` exercés via AST mocké couvrant heading (depth 1-5), paragraph, list ordered/unordered, table, hr, blockquote, space
- Les erreurs sur les données annexes (observations, PV) ne bloquent **pas** la génération (best effort)

### 🗺️ Géocoding & découpage administratif

- `forwardGeocode` (Nominatim OSM) : rejet si q < 3, gestion erreur réseau, gestion HTTP non-ok
- `reverseGeocode` : rejet lat/lon invalides, fallback si Nominatim échoue, match par noms via `DecoupageModel.matchByNames`
- `matchByNames` : match exact **insensible à la casse et aux accents** (`thies` matche `Thiès`), match par inclusion en fallback, `null` partout si aucun match
- Normalisation : `_normalize` retire accents + lowercase + trim
- Hiérarchie administrative respectée : chaque niveau enfant est cherché dans le pool filtré par les parents

### 🔄 Gestion d'erreurs transverse

Le middleware `errorHandler` traduit les erreurs bas niveau en réponses HTTP propres :

| Origine | Code HTTP | Message utilisateur |
|---|---|---|
| PG `23505` (unique violation) | 409 | Cette valeur existe déjà |
| PG `23503` (FK violation) | 400 | Référence invalide |
| PG `23502` (NOT NULL) | 400 | Champ requis manquant |
| PG `22P02` (type invalide) | 400 | Format de données invalide |
| `JsonWebTokenError` | 401 | Token invalide |
| `TokenExpiredError` | 401 | Token expiré |
| `ValidationError` | 400 | (message original) |
| `err.statusCode` | (honoré tel quel) | (message original) |
| autre | 500 | (message original) |

### 📁 Uploads de fichiers

- Rejet si pas de fichier (400)
- Insertion en base avec toutes les métadonnées (filename, original, path, mime, size, entity_type/id, user)
- **Trim du label**, label vide → null
- Suppression : 404 si introuvable, unlink physique si fichier existe sur disque, unlink silencieux sinon

---

## Couverture par fichier

### Utils (94 %)
| Fichier | Stmts | Branches |
|---|---|---|
| `validators.js` | 91.58 | 84.67 |
| `dateHelpers.js` | 96.82 | 93.33 |
| `projectAccess.js` | **100** | **100** |

### Middlewares (90 %)
| Fichier | Stmts | Branches |
|---|---|---|
| `auth.js` | **100** | 91.30 |
| `errorHandler.js` | 87.17 | 76.19 |
| `apiKey.js` | 80.00 | 75.00 |

### Models (90 %)
| Fichier | Stmts |
|---|---|
| `config.model.js` | **100** |
| `form.model.js` | **100** |
| `measureComment.model.js` | **100** |
| `notification.model.js` | **100** |
| `observation.model.js` | **100** |
| `project.model.js` | 93.36 |
| `projectStructure.model.js` | 92.85 |
| `dashboard.model.js` | 92.00 |
| `structure.model.js` | 92.00 |
| `user.model.js` | 89.65 |
| `apiKey.model.js` | 88.63 |
| `decoupage.model.js` | 87.50 |
| `geometry.model.js` | 85.31 |
| `pv.model.js` | 84.94 |

### Controllers (variable)
| Fichier | Stmts |
|---|---|
| `measures.controller.js` | 96.15 |
| `reports.controller.js` | **95.51** |
| `auth.controller.js` | 93.87 |
| `dashboard.controller.js` | 92.39 |
| `chat.controller.js` | 90.83 |
| `measureComments.controller.js` | 88.88 |
| `submissions.controller.js` | 88.23 |
| `users.controller.js` | 88.23 |
| `uploads.controller.js` | 88.57 |
| `export.controller.js` | 88.17 |
| `decoupage.controller.js` | 88.14 |
| `observations.controller.js` | 87.50 |
| `v1.controller.js` | 87.38 |
| `projects.controller.js` | 87.06 |
| `apiKeys.controller.js` | 85.71 |
| `notifications.controller.js` | 85.29 |
| `config.controller.js` | 81.81 |
| `structures.controller.js` | 81.25 |
| `pv.controller.js` | 80.88 |
| `forms.controller.js` | 79.06 |
| `geometries.controller.js` | 87.09 |
| `seed.controller.js` | 68.65 |

---

## Niveau 1 — Utils et middlewares

**125 tests.** Logique pure et protection transverse.

### `utils/validators.test.js`
- **isValidEmail** : formats valides, `@@`, sans TLD, vide
- **validatePassword** : longueur min 8, majuscule, minuscule, chiffre ; le spécial n'est **PAS** obligatoire
- **validateUsername** : ≥ 3 caractères, `[a-zA-Z0-9_]`
- **isValidRole** : les 7 rôles (`admin`, `utilisateur`, `directeur`, `superviseur`, `commandement_territorial`, `lecteur`, `auditeur`)
- **isValidProjectStatus** : 5 statuts valides
- **isValidPercentage** : 0-100, refus strings/null
- **validateProjectData** (création) : titre requis, structure requise, statut/priorité/type/dates
- **validateProjectDataForUpdate** (PATCH) : objet vide valide, `null` autorisé sur dates, `project_type=""` accepté (reset)
- **validateUserData** : création exige role, update non ; email invalide détecté
- **validateStructureData** : code en majuscules uniquement
- **sanitizeString** : retire `<` `>`, trim, passthrough non-strings

### `utils/dateHelpers.test.js`
- **toSQLDate** : 4 formats (`YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `DD/MM/YY` avec logique 2-digit year), fallback ISO, null pour invalide
- **formatDate** : les 4 formats de sortie
- **isValidDate**, **getCurrentSQLDate**, **daysDifference** (valeur absolue)
- **isPastDate / isFutureDate**

### `utils/projectAccess.test.js`
Matrice `canUserAccessProject` × 7 rôles :
- admin/superviseur → accès total
- lecteur/auditeur global (sans structure) → accès total
- lecteur/auditeur scopé → délègue à `ProjectStructure.userHasAccessToProject`
- utilisateur/directeur sans structure → refus
- utilisateur/directeur avec structure → délègue
- commandement_territorial : level invalide → refus ; requête SQL avec niveau valide ; refus si aucune correspondance
- rôle inconnu → refus

### `middlewares/auth.test.js`
- **protect** : pas de header → 401 ; token invalide → 401 ; user inconnu → 401 ; compte désactivé → 401 ; happy path attache `req.user` et appelle `next()`
- **authorize** : 401 sans user, 403 mauvais rôle, passe sinon
- **checkStructureAccess** : admin passe toujours, mismatch → 403

### `middlewares/errorHandler.test.js`
- `notFound` : 404 + délègue au next
- Mapping codes PostgreSQL : `23505` → 409, `23503/23502/22P02` → 400
- `JsonWebTokenError` / `TokenExpiredError` → 401
- `ValidationError` → 400 avec message
- `err.statusCode` honoré
- Défaut : 500 si `res.statusCode === 200`
- Payload : `success: false`

### `middlewares/apiKey.test.js`
- `verifyApiKey` : 401 si absente, 401 si invalide, accepte `?api_key=`, propage erreurs au next

---

## Niveau 2 — Modèles

**220+ tests.** Modèles avec `pg` mocké via `helpers/db.js`. Tous les chemins SQL (transactions, anti-injection, soft delete, filtres dynamiques) sont exercés.

### `models/user.model.test.js`
- `findAll/findById/findByUsername/findByStructure` : params et SQL
- `create` : **bcrypt réellement appelé** (hash vérifié avec `compare`)
- Optionnels normalisés en NULL
- `updatePassword` hashe
- `comparePassword` true/false
- `usernameExists / emailExists` true/false
- `delete / updateLastLogin`

### `models/apiKey.model.test.js`
- `create` : key_hash (sha256 hex 64 chars), key_prefix (14 chars), clair retourné une seule fois
- `verify` : null si sans préfixe, si introuvable, si révoquée, si user désactivé, si expirée ; happy path retourne user + `_apiKeyId`
- Hash sha256 déterministe vérifié avec `crypto`
- `revoke / delete` : clause `user_id` ajoutée si userId fourni

### `models/structure.model.test.js`
- `findAll/findById/findByCode`, `create/update` (normalisation des optionnels)
- `codeExists` : clause `id != $2` si `excludeId`

### `models/notification.model.test.js`
- `create` : null si args manquants, defaults body/linkUrl à null
- `listForUser` : limit par défaut 30, **clampé à [1, 100]**, clause `is_read = false` si `onlyUnread`
- `unreadCount` / `markRead` / `markAllRead` / `remove`

### `models/projectStructure.model.test.js`
- `getStructuresByProject / getProjectsByStructure` (exclut `deleted_at`)
- `assignStructure` : `ON CONFLICT DO NOTHING`
- `userHasAccessToProject` : true/false selon count
- `assignMultipleStructures` : **transaction BEGIN/DELETE/INSERT/COMMIT**, pas d'INSERT si liste vide, **ROLLBACK** en cas d'erreur

### `models/project.model.test.js` + `project.extra.test.js`
- `findAll` : filtres `structure_id`, `status`, `q` combinés ; `q` ignoré si vide
- `findByTerritory` : **anti-injection SQL** (reject niveau hors liste blanche)
- `findById` : agrège localités, sites, mesures (+commentaires), stakeholders, financing, structures assignées
- `create` : defaults (`demarrage`, `progress=0`, `priority=normale`), conversion dates FR → SQL
- `update` : conversion dates FR → SQL
- `_validateVulnerabilityLevel` : defaults, valides, throw 400 sinon
- `addSite` : `is_pcs` **uniquement si structure = DPGI** (sinon forcé à false)
- Soft delete : `delete` → UPDATE `deleted_at` ; `restore` → `deleted_at = NULL` ; `hardDelete` → vrai DELETE
- `isProjectManager` : true/false/false(projet inexistant)
- `getStatsByTerritory` : rejette niveau invalide
- **Batch updates (transactions)** :
  - `updateLocalities` : BEGIN + DELETE + INSERTs + COMMIT ; ROLLBACK si erreur
  - `updateSites` : non-DPGI force `is_pcs=false`
  - `updateMeasures` : **auto-lie les structures aux `project_structures`** (déduppé via Set)
  - `updateStakeholders` / `updateFunding` (force currency=FCFA)
- `updateProgress / assignUserToMeasure / updateMeasureStatus`
- `reassignMeasure` : null si mesure absente du projet, auto-lie nouvelle structure
- `addStakeholder / addFinancing / addLocality / addMeasure` (avec auto-assign structure)
- `addComment / deleteComment` (propriétaire uniquement)
- `getStats` : avec/sans structureId (filtre via project_structures)
- `findDeleted`

### `models/dashboard.model.test.js` + `dashboard.extra.test.js`
- `getMetrics` : avec/sans structureId
- `getMapData` : filtre lat/lng non-null + projets non supprimés
- `getRecentProjects` / `getLateProjects` / `getProgressByMonth`
- `_territorySubquery` : **anti-injection** (reject `pays`)
- `getMetricsByTerritory` : rejette niveau invalide
- `getBudgetStats` : exclut soft-deleted
- **6 variantes territoriales** (`getRecentProjectsByTerritory`, `getMapDataByTerritory`, `getProjectsByStructureByTerritory`, `getLateProjectsByTerritory`, `getMeasureTypesByTerritory`, `getBudgetStatsByTerritory`) : toutes testées pour niveau invalide + happy path
- `getMeasureTypes` : filtre `type IS NOT NULL`

### `models/geometry.model.test.js`
- `_validateKind` : `linestring` / `polygon` uniquement (400 sinon)
- `_validateUsage` : défaut `autre`, rejet invalide
- `_validateVulnerability` : défaut `normal`
- `_validateCoordinates` :
  - tableau vide rejeté
  - linestring < 2 points rejeté
  - polygon anneau < 4 points rejeté
  - points non numériques rejetés
- `create` : validation + `JSON.stringify` des coordonnées, nom par défaut
- `update` (**PATCH-safe**) : idempotent si objet vide, UPDATE seulement les champs présents, `null` écrit NULL (différent d'absent), validation avant SQL
- `importGeoJSON` :
  - rejet non-FeatureCollection (400)
  - **cap à 500 features (413)**
  - skip features invalides, importe le reste
  - ROLLBACK si INSERT échoue

### `models/decoupage.model.test.js`
- `getRegions` / `getDepartements` / `getArrondissements` / `getCommunes`
- `getAllByLevel` : **anti-injection** (reject `country`)
- `search` : params ILIKE `%x%` + rank `x%`
- `getAll` : pagination (offset, totalPages, filtres)
- `create` : `ON CONFLICT DO NOTHING`
- `_normalize` : accents retirés, casse, espaces
- `matchByNames` : match exact (case + accent-insensitive), match par inclusion, null partout si rien

### `models/form.model.test.js` + `form.extra.test.js`
- `findAll` : `is_active = true` seulement
- `findByStructure` : inclut aussi les globaux (`structure_id IS NULL`)
- `create / submitResponse` : optionnels à null
- `delete` : **soft delete** (`is_active = false`)
- `findById`, `update` (COALESCE), `getSubmissionById`

### `models/pv.model.test.js` + `pv.extra.test.js`
- **Visibilité SQL par rôle** (generation dynamique) :
  - admin → pas de clause visibilité, seul param = user.id
  - utilisateur avec structure → `author_id = $1` + EXISTS via `project_structures`
  - commandement_territorial → ajoute `territorial_level` et `territorial_value`
  - lecteur global → pas de clause
- Hydratation relations (projects/measures/sites/localities/attachments) si PVs trouvés
- `findByIdForUser` : null si non visible, hydratation
- `delete` : n'autorise que l'auteur (`author_id = $2`)
- `create` (transaction) : BEGIN + INSERT + COMMIT ; **ROLLBACK** si INSERT échoue
- `update` : null si pas l'auteur (rowCount=0) + ROLLBACK ; commit si refs fournies
- `_replaceRefs` (**scope territorial**) :
  - rejette IDs hors territoire (403)
  - rejette level invalide
  - admin (sans territory) accepte IDs entiers positifs, filtre les invalides (`'abc'`, `-1`, `0`)
- `getPickable` : rejette level invalide, admin sans projets → structure vide, avec projets → charge sites/localities/measures/structures
- `getUnreadCount` / `markAsRead` / `markAllAsRead`

### `models/observation.model.test.js`
- `findAll` : sans résultat pas de chargement uploads ; chargement des uploads attachés ; filtres `project_id`, `priority`, `scope=global/project`
- `findById` → null si introuvable
- `create` : defaults priority=info
- `update` : clause `author_id` ajoutée si authorId fourni ; admin (null) sans clause
- `delete` : clause auteur si fourni
- `getUnreadCount`, `markAllAsRead` (UPSERT)

### `models/measureComment.model.test.js`
- `create` : INSERT basique sans `ON CONFLICT` (historique)
- `getByMeasureId` : ordre DESC
- `delete`
- `canUserModify` : false si introuvable, true si auteur, false si autre user

### `models/config.model.test.js`
- `getByCategory` filtre is_active=true
- `create` : `ON CONFLICT DO NOTHING`, sort_order défaut 0
- `update` avec COALESCE
- `delete` retourne true/false selon rowCount

---

## Niveau 3 — Contrôleurs

**320+ tests.** Chaque endpoint testé pour : validation, codes HTTP d'erreur, dispatching par rôle, happy path.

### `controllers/auth.controller.test.js`
- **login** : 400 credentials manquants, 401 user inconnu / désactivé / mauvais password, 200 avec **token JWT vérifié** et **password_hash supprimé de la réponse**
- **getMe** : 404/200
- **changePassword** : 400 champs/nouveau password, 401 current incorrect, 200 succès
- **logout**

### `controllers/users.controller.test.js`
- `getAllUsers` : admin voit tout, **utilisateur filtré par sa structure**
- `getUserById`, `createUser` (400/409/201), `updateUser`, `deleteUser`, `getUsersByStructure`

### `controllers/structures.controller.test.js`
- CRUD + `codeExists` avec `excludeId`

### `controllers/notifications.controller.test.js`
- `list` : parse `?unread=1` + `limit`
- `markRead / remove` : **400 si id non numérique**
- `markAllRead`

### `controllers/projects.controller.test.js` + `projects.extra.test.js`
**Dispatching par rôle dans `getAllProjects`** :
- admin / superviseur → `findAll`
- lecteur global → `findAll`
- **lecteur scopé → `getProjectsByStructure` + redact `budget` et `funding`**
- utilisateur → `getProjectsByStructure` sans redaction
- commandement_territorial → `findByTerritory`

Autres :
- `getProjectById` : 404 / 403 pas d'accès / **redaction financière pour lecteur**
- `createProject` : **utilisateur : sa structure forcée**, auto-assign structure principale
- `updateProject` (batch) : 404, 403, 400 validation, appelle `updateLocalities/Sites/Measures/Stakeholders/Funding` si batch fourni
- `updateProgress` : 400 bornes, 404/200
- `deleteProject` : 404 / 403 structure différente / 200 admin soft-delete
- `restoreProject / hardDeleteProject`
- `getStats` : commandement → `getStatsByTerritory`, utilisateur → sa structure, admin → query
- **addLocality / addSite / addMeasure / addStakeholder / addFinancing** (201)
- `listDeleted`
- **Project-Structure Mapping** : `getProjectStructures`, `assignStructuresToProject` (400 si pas tableau), `removeStructureFromProject`, `getAllMappings`
- **`assignUserToMeasure`** : 400/404/403 (ni chef ni admin), notif à l'assigné si ≠ auteur, pas de notif si self-assign
- **`reassignMeasure`** : 403, 404 si mesure absente, admin peut sans être chef
- **`updateMeasureStatus`** : 400/404/403, notif aux watchers (async)
- **Project comments** : `getComments`, `addComment` (trim), `deleteComment`

### `controllers/dashboard.controller.test.js`
- **Garde-fou `commandement_territorial` incomplet** (sans level/value) → 403 sur les 7 endpoints
- `getMetrics` : dispatching admin / utilisateur / commandement
- `getProjectsByStructure`, `getMapData`, `getRecentProjects` (limit), `getLateProjects` : admin + territorial
- `getChartData` : lance 3 queries en parallèle (admin et commandement)
- `getMapGeometries` (SQL dynamique) :
  - utilisateur sans structure → liste vide sans requête DB
  - utilisateur avec structure → filtre `project_structures`
  - admin → pas de filtre
  - commandement level invalide → liste vide
  - **commandement valide** → filtre EXISTS localities/sites
  - **lecteur scopé** / **directeur** → project_structures

### `controllers/geometries.controller.test.js`
- `list` : 400 projectId invalide, 403 sans accès, 200
- `create` : 403 sans accès, 201
- `update / remove` : **404 si la géométrie appartient à un autre projet** (anti-traversée)
- `importGeoJSON` : 400 projectId invalide, 201 avec `count` + `skipped_count`

### `controllers/decoupage.controller.test.js`
- `getDepartements / Arrondissements / Communes` : 400 query param manquant, happy paths
- `getRegions` / `getAllByLevel` / `getAll` (pagination) / `getStats`
- `search` : `[]` si q < 2
- `create` : 400 champ manquant, 409 ON CONFLICT, 201
- `update / delete` : 404/200
- `bulkImport` : comptes `created` / `skipped`, erreurs collectées
- **`reverseGeocode`** : 400 lat/lon invalides ; fallback si Nominatim échoue (network ou HTTP non-ok) ; happy path via `matchByNames`
- **`forwardGeocode`** : `[]` si q < 3 ; erreur réseau ; HTTP non-ok ; happy path retourne liste

### `controllers/forms.controller.test.js`
- `getAllForms` : utilisateur → `findByStructure`, admin → `findAll`
- CRUD + 400 si titre/schema manquant, 201 + `created_by` forcé
- `getSubmissions`

### `controllers/pv.controller.test.js`
- `canWrite` (commandement_territorial complet uniquement) : non-writer → 403
- `create` : 400 titre vide, 400 priorité invalide, 201 + **titre trimé** + passage level/value
- `update / remove` : 403/400/404
- `unreadCount / markAllRead / markOneRead / pickable`

### `controllers/export.controller.test.js`
- Test via **`PassThrough` stream** (ExcelJS écrit directement dans `res`)
- Dispatching par rôle : commandement → `findByTerritory`, utilisateur → `getProjectsByStructure`, admin → `findAll({})`
- `findById` appelé pour chaque projet (détails)
- Headers `Content-Type: spreadsheetml` + `Content-Disposition: .xlsx`
- Erreurs propagées au `next()`

### `controllers/reports.controller.test.js`
Tous les helpers privés (markdown → PDF et markdown → DOCX) couverts via mocks complets :
- **Validation** : 400 si format ≠ `pdf`/`docx`, 400 si aucun projet après filtres
- **Dispatching par rôle** (commandement/utilisateur/admin)
- **`structure_id` converti en `int`**
- **503 si erreur `timeout exceeded when trying to connect`** (base surchargée)
- **Happy path PDF/DOCX** : exécute complètement `renderMarkdownToPdf` + `markdownToDocxElements` via AST mocké couvrant heading (depth 1-5), paragraph, list ordered/unordered, table, hr, blockquote, space
- **Erreurs OpenAI** : pas de clé (500), 401 (message explicite), 429 (quota), timeout réseau
- **Observations/PV qui échouent** sont silencés (best effort, non bloquant)

### `controllers/v1.controller.test.js`
**API publique avec clé API** :
- `listProjects` : 5 rôles (admin → `findAll`, commandement → `findByTerritory`, utilisateur → `getProjectsByStructure`)
- Filtres `status / priority / project_type / structure` (case-insensitive)
- `detail=full` charge via `findById`, filtre les null
- `getProject` : 404 `not_found`, 403 `forbidden`, 200 full DTO
- `getStats` : agrégation par statut/priorité/structure, `avg_progress` arrondi, 0 si vide
- `listStructures` : DTO minimal id/code/name/description
- `listObservations` / `getObservation` : filtres + DTO
- `listPvs` / `getPv` : DTO + relations
- **`openapi`** : spec OpenAPI 3.0.3 valide (paths, securitySchemes ApiKeyAuth)

### `controllers/observations.controller.test.js`
- **Seul le superviseur peut écrire** (admin ne peut que modérer)
- `list / getOne` (404)
- `create` : 400 titre/contenu vides, 400 priorité invalide, 201 + **trim** + defaults
- `update` : 403 si ni superviseur ni admin, 400 priorité, **admin → authorId=null (modère)**, superviseur → son id, 404
- `remove` : 403/404/200, admin avec authorId=null
- `unreadCount / markRead`

### `controllers/measures.controller.test.js`
- `listMine` : SQL avec userId, ORDER BY priorité/échéance, filtre `?status`, `?overdue=1|true`
- `myStats` : **PG strings converties en nombres**, rows vide → objet vide

### `controllers/measureComments.controller.test.js`
- `createComment` : 400 si vide, 201 + **notifie l'assigné** si ≠ auteur, pas de notif si self, erreur notif silenced (best effort)
- `getCommentsByMeasure`
- `deleteComment` : 403 si ni auteur ni admin, admin passe même si `canModify=false`, auteur peut

### `controllers/uploads.controller.test.js`
- `uploadFile` : 400 sans fichier, 201 avec trim du label, label vide → null
- `getFileById` : 404/200
- `getByEntity` : passe `entity_type/entity_id`
- `deleteFile` : 404, supprime fichier physique (`fs.unlinkSync`), ne unlink pas si inexistant

### `controllers/apiKeys.controller.test.js`
- `list` : **admin → listAll**, user → listByUser scopé
- `create` : 201, `expires_at` optionnel → null
- `revoke / remove` : **admin → userId=null** (peut révoquer toute clé), user → scopé ; 404 si rien

### `controllers/config.controller.test.js`
- `getByCategory / getAll` / `create` (400 champ manquant, 201)
- `update / delete` (404/200)

### `controllers/submissions.controller.test.js`
- `submitForm` : 400 si form_id ou data manquants, 201 + `submitted_by_user_id` forcé
- `getSubmissionById` : 404/200

### `controllers/chat.controller.test.js`
LLM chat avec 7 tools exposés :
- **Validation** : 400 messages absents/vides, 500 pas d'`OPENAI_API_KEY`
- **Happy path sans tool** : retourne le content du LLM
- **500 si 5 itérations sans réponse finale** (boucle max anti-infinie)
- **Exécution de chaque tool** : `list_projects`, `get_project` (404, accès refusé, happy path), `get_stats`, `list_structures`, `list_observations`, `list_pv`, `get_pv` (404, happy path), tool inconnu, tool qui throw
- `list_projects` : JSON arguments invalides → args = {}
- **Dispatching par rôle dans `getProjectsForUser`** : commandement → `findByTerritory`, utilisateur → `getProjectsByStructure`, admin → `findAll`
- Erreur OpenAI → `next(err)`

### `controllers/seed.controller.test.js` (admin)
- `resetDatabase` : BEGIN + 11 DELETE + setval sequences + COMMIT ; ROLLBACK + next() en cas d'erreur
- `populateDatabase` : BEGIN en première requête, COMMIT ou ROLLBACK
- `resetAndPopulate` : chaîne reset puis populate (≥ 2 BEGIN)

---

## Patterns et conventions

### Mock de `db`
```js
jest.mock('../../src/config/db', () => require('../helpers/db').createDbMock());
const db = require('../../src/config/db');
// Dans le test :
db.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
// Transactions :
const client = db.__client;
client.query.mockResolvedValueOnce({ rows: [] });
```

### Mock de modèle (depuis un contrôleur)
```js
jest.mock('../../src/models/user.model', () => ({
    findById: jest.fn(),
    create: jest.fn(),
}));
const UserModel = require('../../src/models/user.model');
UserModel.findById.mockResolvedValue({ id: 1 });
```

### Simulation req/res/next
```js
const { mockReq, mockRes, mockNext } = require('../../helpers/http');
const res = mockRes();
await ctrl.action(mockReq({ user: { id: 1 }, body: {...} }), res, mockNext());
expect(res.statusCode).toBe(200);
expect(res.body.data).toEqual(...);
```

### Nommage
- `foo.test.js` : tests principaux
- `foo.extra.test.js` : tests de couverture complémentaire (ajoutés post-initial pour pousser la couverture sans gonfler le fichier principal)

---

## Mocks des dépendances binaires

### OpenAI
```js
const mockCompletionsCreate = jest.fn();
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCompletionsCreate } }
})));
mockCompletionsCreate.mockResolvedValue({
    choices: [{ message: { content: 'Réponse', tool_calls: null } }]
});
```

### marked (ESM, incompatible Jest/CommonJS)
```js
jest.mock('marked', () => ({
    marked: {
        lexer: jest.fn(() => [
            { type: 'heading', depth: 1, text: 'Titre' },
            { type: 'paragraph', text: 'Texte' },
            { type: 'list', ordered: false, items: [{ text: 'Item' }] },
            { type: 'table', header: [{ text: 'Col' }], rows: [[{ text: 'A' }]] },
            { type: 'hr' }, { type: 'blockquote', text: 'X' }, { type: 'space' },
        ])
    }
}));
```

### PDFKit
Fake `PDFDocument` basé sur `EventEmitter` avec API fluent minimale (fontSize, text, moveTo, rect, fill, addPage, bufferedPageRange, switchToPage, widthOfString, heightOfString). Émission `data`/`end` à l'appel de `.end()` pour que `new Promise((resolve) => doc.on('end', resolve))` résolve.

### docx
Stubs pour `Document`, `Paragraph`, `TextRun`, `Table`, `TableRow`, `TableCell` + `Packer.toBuffer` qui renvoie un `Buffer`.

### fetch (Node global, pour Nominatim)
```js
global.fetch = jest.fn();
global.fetch.mockResolvedValue({ ok: true, json: async () => ({...}) });
// Ou simulation d'échec :
global.fetch.mockRejectedValue(new Error('network down'));
```

### fs (pour uploads)
```js
jest.mock('fs', () => ({ existsSync: jest.fn(), unlinkSync: jest.fn() }));
```

### Streams (pour ExcelJS)
```js
const { PassThrough } = require('stream');
const stream = new PassThrough();
stream.statusCode = 200;
stream.headers = {};
stream.setHeader = (k, v) => { stream.headers[k.toLowerCase()] = v; };
stream.resume();
```

---

## Ce qui n'est PAS couvert

- **Intégration HTTP (Supertest + vraie DB)** : non inclus. Surface plus large, fragile sans Postgres de test. Recommandé comme étape suivante.
- **Rendu binaire effectif** : on exerce les helpers PDF/DOCX/XLSX via mocks — on ne vérifie pas que le Buffer produit est un PDF/DOCX/XLSX **valide**. Les tests garantissent que les branches sont exécutées, pas que le document ouvre sans erreur dans Word/Acrobat.
- **Tests de performance** : aucun benchmark, aucun test de concurrence (ex : `mapWithConcurrency`).
- **Tests end-to-end front** : la couverture se limite au backend Node/Express.

## Étendre la suite

1. **Nouveau contrôleur** : copier [unit/controllers/users.controller.test.js](unit/controllers/users.controller.test.js) pour un CRUD, ou [unit/controllers/notifications.controller.test.js](unit/controllers/notifications.controller.test.js) pour des endpoints simples.
2. **Nouveau modèle** : copier [unit/models/user.model.test.js](unit/models/user.model.test.js).
3. Adapter les `jest.mock(...)` des dépendances.
4. Utiliser les helpers `mockReq/mockRes/mockNext` et `createDbMock()`.
5. Pour chaque endpoint : tester au minimum **validation → erreur modèle → happy path**.
6. Pour une méthode de modèle : tester **SQL généré (clauses conditionnelles) → paramètres → résultat**.
7. Viser ≥ 80 % par fichier, 90 % pour la logique critique (auth, accès, transactions).

### Règles de sélection des tests
- **Priorité 1** : logique métier avec branches (visibilité par rôle, soft-delete, transactions, anti-injection)
- **Priorité 2** : validations d'entrée (400) et codes d'erreur (401/403/404/409)
- **Priorité 3** : happy paths
- **Priorité 4** : messages d'erreur précis (peu de valeur anti-régression)

Ne pas tester :
- Le contenu exact des SQL sélectionnés (se contenter de matcher les mots-clés significatifs : `deleted_at`, `ON CONFLICT`, etc.)
- Les appels bcrypt/crypto en profondeur (utiliser les vraies fonctions, vérifier hash/compare)
- Les libs tierces (ExcelJS, PDFKit, marked) — les mocker.
