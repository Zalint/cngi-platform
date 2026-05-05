# Cartographie CNGIRI — État, architecture, cahier des charges SIG

> Document de transmission destiné au développeur SIG du CNGIRI.
> Décrit ce qui est en place côté plateforme, ce qu'il reste à faire côté SIG,
> et comment les deux se branchent.

---

## 1. Pourquoi ce document

La plateforme CNGIRI est aujourd'hui une application web complète (suivi de
projets, mesures, observations, PV, sites, géométries) qui s'appuie sur des
**fonds de carte tiers** (OpenStreetMap, CARTO, Esri). Ces fonds suffisent
pour démarrer mais posent trois problèmes :

1. **Souveraineté** — les données utilisateur (adresses IP, zones consultées)
   transitent par des serveurs hors Sénégal.
2. **Disponibilité** — les fournisseurs OSM publics interdisent l'usage
   "lourd" et peuvent blacklister par IP.
3. **Couches métier absentes** — les données SIG du CNGIRI (réseau ONAS,
   zones inondables historiques, bâti vulnérable PCS, etc.) ne sont **pas
   encore exposées** sur la carte de la plateforme.

L'objectif des prochains chantiers est de **basculer vers une infrastructure
cartographique souveraine** qui réutilise au maximum la base SIG existante
du CNGIRI (PostGIS / QGIS / etc.).

---

## 2. Ce qui est déjà fait (Phase 1, côté plateforme)

✅ **La plateforme est prête à pluguer n'importe quel serveur de tuiles ou
service WMS sans redéploiement.**

### 2.1 Architecture côté front

La carte Leaflet (tableau de bord, page projet) charge ses fonds de carte
**dynamiquement** depuis la table `app_config`, catégorie `map_layers`.
Chaque fond a une ligne avec :

| Champ | Type | Description |
|---|---|---|
| `value` | text | Identifiant court (ex: `osm`, `tiles_cngiri`) |
| `label` | text | Nom affiché dans le sélecteur de fond |
| `is_active` | bool | Visible dans le sélecteur si `true` |
| `sort_order` | int | Position dans le sélecteur |
| `metadata` | jsonb | Config technique (voir ci-dessous) |

Le champ `metadata` accepte :

```json
{
  "kind": "xyz | wms",
  "url": "https://...",
  "attribution": "© Source des données",
  "options": { "maxZoom": 19, "subdomains": "abcd" },
  "api_key": "optionnelle",
  "overlay_url": "https://... (optionnel, pour superposer une 2e couche)",
  "overlay_attribution": "..."
}
```

- **`kind: "xyz"`** : tuiles bitmap classiques avec template `{z}/{x}/{y}` —
  c'est le format servi par TileServer GL, MapTiler, etc.
- **`kind: "wms"`** : Web Map Service (norme OGC) — typiquement servi par
  GeoServer ou MapServer.
- **`{apikey}`** dans l'URL est remplacé à l'exécution par la valeur de
  `api_key`, ce qui permet d'utiliser un service avec clé sans la coder en
  dur.

### 2.2 Comment l'admin ajoute un fond

`Administration → Configuration → Fonds de carte` :

1. Clic sur **+ Ajouter un fond de carte**
2. Saisir un identifiant et un libellé
3. Choisir le type (`xyz` ou `wms`)
4. Coller l'URL, l'attribution, et éventuellement la clé API
5. Activer la case à gauche
6. Recharger la page → le nouveau fond est dans le sélecteur

**Pas de redéploiement nécessaire.**

### 2.3 Endpoint API utilisé

```
GET /api/config/category/map_layers
Authorization: Bearer <jwt>

Response:
{
  "success": true,
  "data": [
    { "value": "osm", "label": "Plan (OSM standard)", "is_active": true,
      "sort_order": 1, "metadata": { "kind": "xyz", "url": "...", ... } },
    ...
  ]
}
```

---

## 3. Architecture cible

```
┌──────────────────────────────────────────────────────────────┐
│  Navigateur utilisateur                                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Application CNGIRI (cngiri.com)                        │  │
│  │  + Leaflet + UI projets/mesures/observations            │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │
        ┌──────────────┴───────────────┐
        │                              │
        ▼                              ▼
┌─────────────────┐           ┌────────────────────┐
│ Tuiles de fond  │           │ Couches métier     │
│ (XYZ)           │           │ (WMS / WMTS)       │
│                 │           │                    │
│ tiles.cngiri.com│           │ geo.cngiri.com     │
│ TileServer GL   │           │ GeoServer          │
│ + OSM Sénégal   │           │ + PostGIS CNGIRI   │
└─────────────────┘           └─────────┬──────────┘
                                        │
                                        ▼
                              ┌────────────────────┐
                              │ Base SIG existante │
                              │ (PostGIS, fichiers │
                              │  shapefile, etc.)  │
                              └────────────────────┘
```

**Phase 2** = monter `tiles.cngiri.com` (fond OSM Sénégal souverain).
**Phase 3** = monter `geo.cngiri.com` (couches métier réutilisant la base SIG).

---

## 4. Phase 2 — Serveur de tuiles maison

**Objectif** : avoir un fond de carte servi depuis l'infra CNGIRI, sans
dépendance OSM/CARTO/Esri.

### 4.1 Stack recommandée

| Brique | Outil | Pourquoi |
|---|---|---|
| Données OSM Sénégal | Extrait Geofabrik mensuel | https://download.geofabrik.de/africa/senegal.html (~70 Mo .osm.pbf) |
| Génération tuiles | **`tilemaker`** (open source) | Plus rapide et plus simple que Mapnik. Sortie : fichier `.mbtiles` |
| Serveur de tuiles | **TileServer GL** (Docker) | Sert les tuiles vectorielles + raster, gère les styles, HTTPS |
| Style de carte | **OpenMapTiles** (libre) | Style par défaut, customisable aux couleurs CNGIRI |
| Hébergement | VPS 4 Go RAM + 50 Go SSD | Scaleway / Hetzner / OVH — ~15-25 €/mois |

### 4.2 Étapes

1. **Provisionner un VPS** Ubuntu 22.04 LTS, ouvrir 80/443.
2. **Installer Docker + Docker Compose**.
3. **Télécharger l'extrait OSM Sénégal** :
   ```bash
   wget https://download.geofabrik.de/africa/senegal-latest.osm.pbf
   ```
4. **Générer les tuiles vectorielles** avec tilemaker (~30 min) :
   ```bash
   tilemaker --input senegal-latest.osm.pbf --output senegal.mbtiles \
             --config config-openmaptiles.json --process process-openmaptiles.lua
   ```
5. **Lancer TileServer GL** pointant sur `senegal.mbtiles` :
   ```yaml
   # docker-compose.yml
   services:
     tileserver:
       image: maptiler/tileserver-gl
       ports: ["8080:80"]
       volumes: ["./data:/data"]
       command: --public_url https://tiles.cngiri.com/
   ```
6. **Reverse proxy nginx** avec HTTPS (Let's Encrypt) pour servir
   `https://tiles.cngiri.com/styles/cngiri-light/{z}/{x}/{y}.png`.
7. **Cron mensuel** pour rafraîchir l'extrait Geofabrik (les routes
   évoluent, OSM est mis à jour quotidiennement).

### 4.3 Personnalisation (optionnel, mais valorisant)

- **Style "CNGIRI"** : forker le style OpenMapTiles, adapter les couleurs
  (eau, bâti, voirie) aux codes graphiques de la plateforme.
- **Surfacer les zones à risque** : si la base SIG contient un calque
  "zones inondables historiques", on peut l'inclure directement dans le
  fond de carte (rendu rouge translucide) plutôt qu'en couche WMS séparée.

### 4.4 Critères de validation Phase 2

| Critère | Comment vérifier |
|---|---|
| HTTPS valide | `curl -I https://tiles.cngiri.com/health` → 200 |
| Couverture Sénégal | Affichage correct à Dakar, Saint-Louis, Tambacounda, Ziguinchor, Matam |
| Latence | `< 200 ms` par tuile depuis Dakar (95e percentile) |
| Disponibilité zoom | Zoom 7 (vue pays) à zoom 18 (rue) sans tuile manquante |
| Attribution | `© OpenStreetMap contributors` visible dans le footer du fond |
| Mise à jour automatique | Cron mensuel vérifié, log accessible |

### 4.5 Branchement plateforme

Une fois le serveur prêt, l'admin CNGIRI :
1. Va dans `Configuration → Fonds de carte`
2. Ajoute un fond avec :
   - Identifiant : `tiles_cngiri`
   - Type : `xyz`
   - URL : `https://tiles.cngiri.com/styles/cngiri-light/{z}/{x}/{y}.png`
   - Attribution : `© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · CNGIRI`
3. Met `sort_order: 0` pour qu'il apparaisse en premier
4. Désactive (case à gauche) les anciens fonds OSM/CARTO/Esri

→ La plateforme bascule automatiquement, sans redéploiement.

---

## 5. Phase 3 — Couches métier WMS depuis la base SIG existante

**Objectif** : afficher les **données SIG propriétaires du CNGIRI** comme
couches superposables à la carte.

### 5.1 Liste des couches candidates

À confirmer avec le métier, mais voici ce qui ressort :

| Couche | Source probable | Géométrie | Cas d'usage utilisateur |
|---|---|---|---|
| **Réseau d'assainissement ONAS** | PostGIS ONAS / shapefiles existants | LineString | Voir le réseau pour planifier les nouveaux travaux |
| **Zones inondables historiques** | DPGI (archive) | Polygon | Visualiser le risque sur les sites de projet |
| **Bâti vulnérable PCS** | DPGI | Point/Polygon | Cibler les interventions prioritaires |
| **Cours d'eau et bassins versants** | Open data + DPGI | LineString/Polygon | Comprendre le drainage naturel |
| **Découpage administratif détaillé** | ANSD/IGN Sénégal | Polygon | Filtre territoire au pixel près |
| **Sites historiques d'inondations** | Archive DPGI | Point/Polygon + horodaté | Patterns récurrents par saison |

### 5.2 Stack recommandée

| Brique | Outil | Pourquoi |
|---|---|---|
| Stockage des géométries | **PostGIS** | Si déjà en place côté SIG : on réutilise. Sinon, importer les shapefiles avec `shp2pgsql`. |
| Serveur WMS/WMTS | **GeoServer** | Standard de l'industrie, REST API, gestion des styles SLD, authentification. Déployable en Docker. |
| Authentification | Token bearer ou IP whitelist | Pour que seul `cngiri.com` puisse interroger. |
| Mise en cache | **GeoWebCache** (intégré GeoServer) | Pré-tuilage des couches lourdes. |

### 5.3 Architecture proposée

```
                    ┌───────────────────────┐
                    │ PostGIS CNGIRI        │
                    │ (existant)            │
                    │                       │
                    │ schémas :             │
                    │  - onas (réseau)      │
                    │  - dpgi (zones, PCS)  │
                    │  - public (admin)     │
                    └──────────┬────────────┘
                               │
                               ▼
                    ┌───────────────────────┐
                    │ GeoServer             │
                    │ geo.cngiri.com        │
                    │                       │
                    │ Workspace : cngiri    │
                    │ Layers :              │
                    │  - cngiri:reseau_onas │
                    │  - cngiri:zones_inond │
                    │  - cngiri:pcs_bati    │
                    │  - cngiri:hydro       │
                    └───────────────────────┘
```

### 5.4 Pour chaque couche, livrables attendus

1. **Source de données** : nom de la table PostGIS (ou import à faire) +
   définition du SRID (projection). On vise WGS84 (EPSG:4326) ou Pseudo
   Mercator (EPSG:3857) pour compat Leaflet.
2. **Style SLD** : couleurs, épaisseur, étiquettes. À calibrer avec le
   métier (ex: réseau ONAS bleu cyan trait 2px, zones inondables rouge
   translucide 30 %).
3. **URL d'accès** :
   ```
   https://geo.cngiri.com/wms?
       service=WMS&version=1.3.0&request=GetMap&
       layers=cngiri:reseau_onas&
       bbox={bbox}&width={width}&height={height}&
       crs=EPSG:3857&format=image/png&transparent=true
   ```
4. **Authentification** : token statique partagé entre la plateforme et
   GeoServer (header `Authorization`), ou règle de filtrage par IP source.

### 5.5 Branchement plateforme

Pour chaque couche, l'admin :

1. Va dans `Configuration → Fonds de carte`
2. Ajoute une entrée avec :
   - Identifiant : `wms_reseau_onas`
   - Type : `wms`
   - URL : `https://geo.cngiri.com/wms`
   - Options : `{ "layers": "cngiri:reseau_onas", "transparent": true, "format": "image/png" }`
   - Attribution : `© ONAS / CNGIRI`
3. Active la couche.

> **Note de roadmap plateforme** : un panneau dédié « Couches métier »
> distinct du sélecteur de fond sera ajouté côté front pour permettre
> à l'utilisateur de combiner plusieurs couches superposées (réseau ONAS
> ET zones inondables) sur le même fond. Pour l'instant elles sont
> traitées comme des « fonds » alternatifs.

### 5.6 Permissions par rôle

Certaines couches sont sensibles (le PCS contient des informations sur la
vulnérabilité des bâtiments, donc peut-être pas à diffuser largement).

La plateforme prévoit (à venir, Phase 3 plateforme) un champ
`metadata.roles_allowed` qui restreint l'affichage du fond à certains
rôles. Exemple :

```json
{
  "kind": "wms",
  "url": "https://geo.cngiri.com/wms",
  "options": { "layers": "cngiri:pcs_bati" },
  "roles_allowed": ["admin", "directeur:DPGI"]
}
```

Le front filtre le sélecteur en fonction du rôle de l'utilisateur connecté.

### 5.7 Critères de validation Phase 3

| Critère | Comment vérifier |
|---|---|
| Authentification | Requête WMS sans token → 401 ou 403 |
| Performance | `< 500 ms` par tuile WMS, GeoWebCache activé |
| Couverture | Couche complète sur tout le territoire couvert |
| Style cohérent | Couleurs et épaisseurs validées par le métier |
| Test plateforme | L'admin ajoute la couche dans `app_config`, recharge la carte → la couche apparaît correctement |

---

## 6. Estimation effort

### Côté dev SIG

| Tâche | Estimation |
|---|---|
| **Phase 2** : monter TileServer GL avec OSM Sénégal | 3-5 j |
| **Phase 3** : exposer une première couche WMS (ex: réseau ONAS) | 2-3 j |
| **Phase 3 (suite)** : ajouter chaque couche supplémentaire | 0,5-1 j par couche |
| Documentation / tests / mise en production | 1 j |

### Côté plateforme

| Tâche | Estimation |
|---|---|
| Phase 1 (URLs configurables, support WMS, doc admin) | ✅ Fait |
| Permissions par rôle sur les couches (Phase 3 backend) | 1 j |
| Panneau « Couches métier » distinct du sélecteur de fond | 1-2 j |

---

## 7. Précisions à valider avec le dev SIG

1. **État de la base PostGIS existante** : schémas, tables, SRID, qualité
   des données.
2. **Disponibilité d'une infra (VPS, Docker)** ou besoin d'en provisionner
   une.
3. **Politique de mise à jour** : qui actualise les données ONAS/DPGI et
   à quelle fréquence ?
4. **Couches à prioriser** : laquelle apporte le plus de valeur métier
   immédiate ? (probable : zones inondables historiques pour le contexte
   risque, réseau ONAS pour la planification)
5. **Authentification** : token partagé, mTLS, IP whitelist ? À aligner
   avec le service info CNGIRI.

---

## 8. Annexes

### 8.1 Format JSON exact d'une entrée `app_config` map_layers

```json
{
  "category": "map_layers",
  "value": "tiles_cngiri",
  "label": "Plan Sénégal (CNGIRI)",
  "sort_order": 0,
  "is_active": true,
  "metadata": {
    "kind": "xyz",
    "url": "https://tiles.cngiri.com/styles/cngiri-light/{z}/{x}/{y}.png",
    "attribution": "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors · CNGIRI",
    "options": { "maxZoom": 19 }
  }
}
```

### 8.2 Format JSON exact d'une couche WMS

```json
{
  "category": "map_layers",
  "value": "wms_reseau_onas",
  "label": "Réseau ONAS",
  "sort_order": 10,
  "is_active": true,
  "metadata": {
    "kind": "wms",
    "url": "https://geo.cngiri.com/wms",
    "options": {
      "layers": "cngiri:reseau_onas",
      "format": "image/png",
      "transparent": true,
      "version": "1.3.0"
    },
    "attribution": "© ONAS / CNGIRI"
  }
}
```

### 8.3 Liens utiles

- TileServer GL : https://tileserver.readthedocs.io/
- tilemaker : https://github.com/systemed/tilemaker
- OpenMapTiles : https://openmaptiles.org/
- GeoServer : https://geoserver.org/
- Geofabrik (extraits OSM) : https://download.geofabrik.de/africa/senegal.html
- Norme WMS (OGC) : https://www.ogc.org/standards/wms

---

*Document maintenu par l'équipe plateforme. Mettre à jour à chaque évolution
de l'API config ou de l'architecture cartographique.*
