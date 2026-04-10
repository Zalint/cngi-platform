# 🚀 Démarrage Rapide - CNGI Platform

## ⚡ Installation Express (5 minutes)

### 1. Prérequis installés ?
- ✅ Node.js (v14+)
- ✅ PostgreSQL (v12+)

### 2. Installation

```bash
# Dans le dossier du projet
cd C:\ASBB\MHA\POC\CNGI

# Installer les dépendances
npm install

# Créer la base de données
psql -U postgres -c "CREATE DATABASE cngi_db;"

# Créer le fichier .env (copier depuis env.example et modifier)
# Modifier DB_PASSWORD avec votre mot de passe PostgreSQL

# Initialiser la base
psql -U postgres -d cngi_db -f db/schema.sql
node db/seed.js

# Démarrer !
npm run dev
```

### 3. Accéder à l'application

Ouvrir : **http://localhost:3000**

**Connexion :**
- Admin : `admin` / `mha@2024`
- Utilisateur : `user_dpgi` / `mha@2024`

## 📦 Ce qui a été développé

### ✅ Backend complet
- ✅ Serveur Node.js + Express
- ✅ Base de données PostgreSQL
- ✅ Authentification JWT
- ✅ 8 contrôleurs (Auth, Users, Structures, Projects, Forms, Submissions, Dashboard, Uploads)
- ✅ 6 models avec toutes les relations
- ✅ 8 routes API complètes
- ✅ Middlewares (Auth, ErrorHandler)
- ✅ Utilitaires (Dates, Validators)
- ✅ Gestion des uploads de fichiers

### ✅ Frontend complet (SPA)
- ✅ Routeur SPA avec hash routing
- ✅ 5 pages fonctionnelles :
  - Login avec authentification
  - Dashboard avec métriques et graphiques
  - Liste des projets avec filtres
  - Détail de projet complet
  - Page d'administration (Users & Structures)
  - Page Formulaires
- ✅ Composants réutilisables (Navbar)
- ✅ Client API complet
- ✅ Gestion de l'authentification
- ✅ Design moderne et responsive
- ✅ Formatage des dates

### ✅ Base de données
- ✅ Schéma complet (11 tables)
- ✅ Relations et contraintes
- ✅ Triggers et vues
- ✅ Seed avec données de test
- ✅ 6 comptes utilisateurs par défaut
- ✅ 6 projets d'exemple

## 🎯 Fonctionnalités principales

### Gestion des projets
- ✅ Création, modification, suppression
- ✅ Suivi de l'avancement (%)
- ✅ Localités et sites
- ✅ Mesures et actions
- ✅ Parties prenantes
- ✅ Financement
- ✅ Statuts et échéances

### Gestion des utilisateurs
- ✅ 3 rôles (Admin, Utilisateur, Directeur)
- ✅ Attribution aux structures
- ✅ Gestion des permissions

### Tableaux de bord
- ✅ Métriques en temps réel
- ✅ Graphiques par structure
- ✅ Projets récents
- ✅ Projets en retard

### Administration
- ✅ Gestion des utilisateurs
- ✅ Gestion des structures
- ✅ Interface admin dédiée

## 📁 Structure complète

```
CNGI/
├── db/                     ✅ Base de données
│   ├── schema.sql         ✅ 11 tables
│   └── seed.js            ✅ Données initiales
├── public/                ✅ Frontend SPA
│   ├── index.html         ✅
│   ├── css/main.css       ✅ 700+ lignes
│   └── js/
│       ├── app.js         ✅ Routeur
│       ├── utils/         ✅ API, Auth, Dates
│       ├── components/    ✅ Navbar
│       └── pages/         ✅ 6 pages
├── src/                   ✅ Backend
│   ├── server.js          ✅
│   ├── app.js             ✅
│   ├── config/db.js       ✅
│   ├── middlewares/       ✅ 2 fichiers
│   ├── models/            ✅ 5 modèles
│   ├── controllers/       ✅ 8 contrôleurs
│   ├── routes/            ✅ 8 routes
│   └── utils/             ✅ Helpers
├── uploads/               ✅ Stockage fichiers
├── .gitignore             ✅
├── package.json           ✅
├── env.example            ✅
├── README.md              ✅ Documentation complète
├── INSTALLATION.md        ✅ Guide installation
└── QUICK_START.md         ✅ Ce fichier
```

## 🔗 API Endpoints disponibles

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

### Users (Admin)
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Structures (Admin)
- `GET /api/structures`
- `POST /api/structures`
- `PUT /api/structures/:id`
- `DELETE /api/structures/:id`
- `GET /api/structures/stats`

### Projects
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `PATCH /api/projects/:id/progress`
- `DELETE /api/projects/:id`
- + 5 endpoints pour sous-ressources

### Dashboard
- `GET /api/dashboard/metrics`
- `GET /api/dashboard/projects-by-structure`
- `GET /api/dashboard/map-data`
- `GET /api/dashboard/recent-projects`
- `GET /api/dashboard/late-projects`
- `GET /api/dashboard/chart-data`

### Forms
- `GET /api/forms`
- `POST /api/forms` (Admin)
- `GET /api/forms/:id`
- `PUT /api/forms/:id` (Admin)
- `DELETE /api/forms/:id` (Admin)

### Uploads
- `POST /api/uploads`
- `GET /api/uploads/:id`
- `DELETE /api/uploads/:id`

## 🎨 Formats de dates supportés

- **Entrée** : YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD/MM/YY
- **Sortie** : DD/MM/YYYY (par défaut)
- Conversion automatique

## 👥 Comptes de test

| Rôle | Username | Password | Accès |
|------|----------|----------|-------|
| Admin | admin | mha@2024 | Tout |
| Directeur | directeur | mha@2024 | Dashboard (lecture) |
| Utilisateur | user_dpgi | mha@2024 | DPGI |
| Utilisateur | user_onas | mha@2024 | ONAS |
| Utilisateur | user_bnsp | mha@2024 | BNSP |
| Utilisateur | user_cetud | mha@2024 | CETUD |

## 🎯 Tester l'application

1. Se connecter avec `admin` / `mha@2024`
2. Aller dans **Projets** → voir les 6 projets d'exemple
3. Cliquer sur un projet → voir tous les détails
4. Aller dans **Administration** → voir users et structures
5. Aller dans **Dashboard** → voir les statistiques
6. Tester avec un compte utilisateur → accès limité à sa structure

## 📊 Données de démonstration

Après le seed :
- ✅ 6 structures (DPGI, ONAS, BNSP, CETUD, AGEROUTE, DPC)
- ✅ 6 utilisateurs
- ✅ 6 projets avec détails complets
- ✅ 4 sites avec coordonnées
- ✅ 5 mesures
- ✅ 3 parties prenantes
- ✅ 2 financements
- ✅ 1 formulaire dynamique

## 🔥 Prêt à utiliser !

Tout est fonctionnel et prêt pour :
- ✅ Développement
- ✅ Tests
- ✅ Démonstration
- ✅ Production (après configuration sécurité)

## 📖 Documentation

- **README.md** : Documentation complète
- **INSTALLATION.md** : Guide d'installation détaillé
- **QUICK_START.md** : Ce fichier

## 🚀 Commandes utiles

```bash
# Développement
npm run dev              # Démarrer avec nodemon

# Production
npm start                # Démarrer le serveur

# Base de données
npm run db:schema        # Créer les tables
npm run db:seed          # Insérer les données

# Réinitialiser complètement
psql -U postgres -d cngi_db -f db/schema.sql
node db/seed.js
```

## 🎉 Statut : 100% Terminé

✅ **Tous les TODO complétés !**

- ✅ Configuration projet
- ✅ Base de données
- ✅ Backend config
- ✅ Middlewares
- ✅ Models
- ✅ Controllers
- ✅ Routes API
- ✅ Frontend base
- ✅ Pages frontend
- ✅ Composants
- ✅ Utilitaires
- ✅ Documentation

---

**Bon développement ! 🚀**

