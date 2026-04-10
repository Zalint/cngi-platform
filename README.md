# CNGI - Plateforme de Suivi des Actions

Plateforme web pour la **Cellule Nationale de Gestion des Inondations** (CNGI) du Sénégal, permettant le suivi et la gestion des projets de prévention et de gestion des inondations.

## 🚀 Fonctionnalités

### Gestion des utilisateurs
- 3 rôles : **Administrateur**, **Utilisateur**, **Directeur**
- Authentification sécurisée avec JWT
- Gestion des permissions par rôle

### Gestion des projets
- Création et suivi des projets/actions
- Suivi de l'avancement (pourcentage de progression)
- Gestion des localités et sites d'intervention
- Mesures et actions spécifiques
- Parties prenantes et financement
- Statuts : En cours, Terminé, En retard, Annulé

### Formulaires dynamiques
- Création de formulaires configurables
- Attribution aux structures
- Soumission et historique

### Tableaux de bord
- Vue d'ensemble des projets et statistiques
- Graphiques et métriques
- Projets par structure
- Projets en retard

### Structures
- Gestion des directions (DPGI, ONAS, BNSP, CETUD, etc.)
- Statistiques par structure
- Attribution des utilisateurs

## 🛠️ Stack Technique

### Backend
- **Node.js** + **Express.js**
- **PostgreSQL** (Base de données)
- **JWT** (Authentification)
- **Bcrypt** (Hash des mots de passe)
- **Multer** (Upload de fichiers)

### Frontend
- **Vanilla JavaScript** (SPA - Single Page Application)
- **HTML5** + **CSS3**
- Client-side routing
- Design moderne et responsive

## 📋 Prérequis

- **Node.js** >= 14.x
- **PostgreSQL** >= 12.x
- **npm** ou **yarn**

## ⚙️ Installation

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd CNGI
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration de la base de données

Créer une base de données PostgreSQL :

```bash
psql -U postgres
CREATE DATABASE cngi_db;
\q
```

### 4. Configuration de l'environnement

Créer un fichier `.env` à la racine du projet (copier depuis `env.example`) :

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cngi_db
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=votre_secret_jwt_tres_securise_a_changer
JWT_EXPIRES_IN=24h

# Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

### 5. Créer le schéma de la base de données

```bash
npm run db:schema
```

Ou manuellement :
```bash
psql -U postgres -d cngi_db -f db/schema.sql
```

### 6. Insérer les données initiales

```bash
npm run db:seed
```

## 🚀 Démarrage

### Mode développement

```bash
npm run dev
```

L'application sera accessible sur : **http://localhost:3000**

### Mode production

```bash
npm start
```

## 👥 Comptes par défaut

Après l'exécution du seed, les comptes suivants sont disponibles :

| Rôle | Username | Mot de passe | Structure |
|------|----------|--------------|-----------|
| **Administrateur** | admin | mha@2024 | - |
| **Directeur** | directeur | mha@2024 | - |
| **Utilisateur** | user_dpgi | mha@2024 | DPGI |
| **Utilisateur** | user_onas | mha@2024 | ONAS |
| **Utilisateur** | user_bnsp | mha@2024 | BNSP |
| **Utilisateur** | user_cetud | mha@2024 | CETUD |

## 📁 Structure du projet

```
CNGI/
├── db/
│   ├── schema.sql          # Schéma de la base de données
│   └── seed.js             # Données initiales
├── public/
│   ├── index.html          # Point d'entrée frontend
│   ├── css/
│   │   └── main.css        # Styles principaux
│   └── js/
│       ├── app.js          # Routeur SPA
│       ├── utils/          # Utilitaires (API, Auth, Dates)
│       ├── components/     # Composants (Navbar, etc.)
│       └── pages/          # Pages (Dashboard, Projects, etc.)
├── src/
│   ├── server.js           # Point d'entrée backend
│   ├── app.js              # Configuration Express
│   ├── config/
│   │   └── db.js           # Configuration PostgreSQL
│   ├── middlewares/
│   │   ├── auth.js         # Authentification JWT
│   │   └── errorHandler.js # Gestion des erreurs
│   ├── models/             # Modèles de données
│   ├── controllers/        # Logique métier
│   ├── routes/             # Routes API
│   └── utils/              # Helpers (dates, validation)
├── uploads/                # Fichiers uploadés
├── .env                    # Variables d'environnement
├── .gitignore
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Informations utilisateur
- `POST /api/auth/change-password` - Changer mot de passe

### Utilisateurs (Admin)
- `GET /api/users` - Liste des utilisateurs
- `POST /api/users` - Créer un utilisateur
- `GET /api/users/:id` - Détails d'un utilisateur
- `PUT /api/users/:id` - Modifier un utilisateur
- `DELETE /api/users/:id` - Supprimer un utilisateur

### Structures (Admin)
- `GET /api/structures` - Liste des structures
- `POST /api/structures` - Créer une structure
- `GET /api/structures/:id` - Détails d'une structure
- `PUT /api/structures/:id` - Modifier une structure
- `DELETE /api/structures/:id` - Supprimer une structure
- `GET /api/structures/stats` - Statistiques des structures

### Projets
- `GET /api/projects` - Liste des projets
- `POST /api/projects` - Créer un projet
- `GET /api/projects/:id` - Détails d'un projet
- `PUT /api/projects/:id` - Modifier un projet
- `PATCH /api/projects/:id/progress` - Mettre à jour l'avancement
- `DELETE /api/projects/:id` - Supprimer un projet
- `POST /api/projects/:id/localities` - Ajouter une localité
- `POST /api/projects/:id/sites` - Ajouter un site
- `POST /api/projects/:id/measures` - Ajouter une mesure
- `POST /api/projects/:id/stakeholders` - Ajouter une partie prenante
- `POST /api/projects/:id/financing` - Ajouter un financement

### Dashboard
- `GET /api/dashboard/metrics` - Métriques principales
- `GET /api/dashboard/projects-by-structure` - Projets par structure
- `GET /api/dashboard/map-data` - Données pour la carte
- `GET /api/dashboard/recent-projects` - Projets récents
- `GET /api/dashboard/late-projects` - Projets en retard
- `GET /api/dashboard/chart-data` - Données pour graphiques

### Formulaires
- `GET /api/forms` - Liste des formulaires
- `POST /api/forms` - Créer un formulaire (Admin)
- `GET /api/forms/:id` - Détails d'un formulaire
- `PUT /api/forms/:id` - Modifier un formulaire (Admin)
- `DELETE /api/forms/:id` - Supprimer un formulaire (Admin)
- `GET /api/forms/:id/submissions` - Soumissions d'un formulaire

### Uploads
- `POST /api/uploads` - Upload un fichier
- `GET /api/uploads/:id` - Informations d'un fichier
- `DELETE /api/uploads/:id` - Supprimer un fichier

## 🎨 Gestion des dates

Le système supporte plusieurs formats de dates :
- **Stockage** : `YYYY-MM-DD` (format SQL)
- **Affichage** : `DD/MM/YYYY`, `DD-MM-YYYY`, `DD/MM/YY`

Les fonctions de conversion sont disponibles dans `src/utils/dateHelpers.js` (backend) et `public/js/utils/dateFormatter.js` (frontend).

## 🔐 Sécurité

- Authentification JWT avec expiration configurable
- Mots de passe hashés avec bcrypt (10 rounds)
- Protection CSRF
- Validation des données côté serveur
- Contrôle d'accès basé sur les rôles (RBAC)
- Validation des types de fichiers uploadés

## 🧪 Tests

Pour tester l'application :

1. Démarrer le serveur : `npm run dev`
2. Ouvrir le navigateur sur `http://localhost:3000`
3. Se connecter avec l'un des comptes par défaut
4. Tester les différentes fonctionnalités selon le rôle

## 📝 À faire (Améliorations futures)

- [ ] Système de notifications en temps réel
- [ ] Export PDF des rapports
- [ ] Intégration de carte interactive (Leaflet/MapLibre)
- [ ] Graphiques avancés (Chart.js/D3.js)
- [ ] Historique des modifications
- [ ] Recherche avancée et filtres
- [ ] API de reporting
- [ ] Tests automatisés (Jest/Mocha)
- [ ] Interface mobile dédiée

## 🤝 Contribution

Pour contribuer au projet :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push sur la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est développé pour la **CNGI (Cellule Nationale de Gestion des Inondations)** du Sénégal.

## 👨‍💻 Support

Pour toute question ou problème :
- Créer une issue sur le repository
- Contacter l'équipe de développement

---

**Développé avec ❤️ pour la CNGI - Sénégal**

