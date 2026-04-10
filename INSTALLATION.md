# Guide d'Installation Rapide - CNGI Platform

## Installation en 5 minutes ⚡

### Étape 1 : Installation de Node.js et PostgreSQL

#### Windows
1. Télécharger et installer **Node.js** : https://nodejs.org/ (version LTS)
2. Télécharger et installer **PostgreSQL** : https://www.postgresql.org/download/windows/
   - Pendant l'installation, noter le mot de passe du super-utilisateur `postgres`

#### Linux (Ubuntu/Debian)
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install postgresql postgresql-contrib
```

#### macOS
```bash
# Avec Homebrew
brew install node
brew install postgresql
```

### Étape 2 : Préparer le projet

```bash
# 1. Aller dans le dossier du projet
cd C:\ASBB\MHA\POC\CNGI

# 2. Installer les dépendances
npm install
```

### Étape 3 : Configuration de la base de données

#### A. Créer la base de données

**Windows (PowerShell):**
```powershell
# Se connecter à PostgreSQL
psql -U postgres

# Dans psql, exécuter:
CREATE DATABASE cngi_db;
\q
```

**Linux/macOS:**
```bash
sudo -u postgres psql
CREATE DATABASE cngi_db;
\q
```

#### B. Configurer les variables d'environnement

Créer un fichier `.env` à la racine avec ce contenu :

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cngi_db
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe_postgres

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=cngi_secret_key_2024_change_me_in_production
JWT_EXPIRES_IN=24h

# Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

**⚠️ Important** : Remplacer `votre_mot_de_passe_postgres` par votre mot de passe PostgreSQL réel.

### Étape 4 : Initialiser la base de données

```bash
# Créer les tables
psql -U postgres -d cngi_db -f db/schema.sql

# Insérer les données initiales
node db/seed.js
```

**Ou avec npm:**
```bash
npm run db:schema
npm run db:seed
```

### Étape 5 : Démarrer l'application

```bash
npm run dev
```

L'application sera accessible sur : **http://localhost:3000**

## ✅ Vérification de l'installation

1. Ouvrir **http://localhost:3000** dans votre navigateur
2. Vous devriez voir la page de connexion
3. Se connecter avec :
   - Username: `admin`
   - Password: `mha@2024`

## 🎉 Succès !

Si vous voyez le tableau de bord, l'installation est réussie !

## ❌ Dépannage

### Erreur : "Cannot connect to database"

**Solution :**
- Vérifier que PostgreSQL est démarré
- Vérifier les identifiants dans le fichier `.env`
- Windows : Ouvrir Services et vérifier que "postgresql" est en cours d'exécution

### Erreur : "Port 3000 already in use"

**Solution :**
- Changer le PORT dans `.env` (ex: PORT=3001)
- Ou arrêter le processus utilisant le port 3000

### Erreur : "psql command not found"

**Solution :**
- Ajouter PostgreSQL au PATH système
- Windows : Ajouter `C:\Program Files\PostgreSQL\XX\bin` au PATH
- Ou utiliser le chemin complet : `"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres`

### Base de données : Accès refusé

**Solution :**
```bash
# Modifier pg_hba.conf pour autoriser l'accès local
# Chemin Windows: C:\Program Files\PostgreSQL\XX\data\pg_hba.conf
# Changer "scram-sha-256" en "trust" pour la ligne localhost
# Redémarrer PostgreSQL
```

## 📞 Besoin d'aide ?

En cas de problème persistant :

1. Vérifier les logs dans la console
2. Vérifier que Node.js et PostgreSQL sont bien installés :
   ```bash
   node --version
   npm --version
   psql --version
   ```

## 🚀 Prochaines étapes

Une fois l'installation réussie :

1. Explorer les différentes pages de l'application
2. Créer un nouveau projet
3. Tester les différents rôles (admin, utilisateur, directeur)
4. Consulter le fichier README.md pour les fonctionnalités avancées

---

**Installation réussie ? Bon développement ! 💪**

