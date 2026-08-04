# Déploiement Railway (Docker) — Fulani Backend

Strapi 5 tourne dans une image Docker. PostgreSQL est le **plugin managé Railway** (pas dans le même conteneur).

## Prérequis

- Compte [Railway](https://railway.app)
- Repo GitHub avec ce projet
- Docker Desktop (optionnel, pour tester en local)

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `Dockerfile` | Build multi-stage production |
| `.dockerignore` | Contexte de build léger |
| `railway.toml` | Builder Docker + healthcheck `/_health` |
| `docker-compose.yml` | Test local uniquement |

## Déploiement Railway

1. **New Project** → **Deploy from GitHub repo** → sélectionne `fulani-backend`.
2. Railway détecte le `Dockerfile` via `railway.toml`.
3. **Add Plugin / Database** → **PostgreSQL**.
4. Sur le service Strapi, onglet **Variables**, ajoute :

### Variables obligatoires

```bash
NODE_ENV=production
HOST=::
# PORT est injecté par Railway — ne le force pas sauf besoin

DATABASE_CLIENT=postgres
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false

# Génère de NOUVELLES valeurs (ne réutilise pas le .env local)
APP_KEYS=key1,key2,key3,key4
API_TOKEN_SALT=...
ADMIN_JWT_SECRET=...
JWT_SECRET=...
TRANSFER_TOKEN_SALT=...
ENCRYPTION_KEY=...
MASTER_KEY=...

PUBLIC_URL=https://<ton-service>.up.railway.app
FRONTEND_URL=https://<ton-front>
CORS_ORIGIN=https://<ton-front>
IS_PROXIED=true
```

> **Healthcheck Railway** : `HOST` doit être `::` (pas `0.0.0.0`), sinon le probe v2 reste en « service unavailable ».
Astuce : après le premier deploy, copie l’URL publique du service dans `PUBLIC_URL`, puis redéploie.

### Variables optionnelles

```bash
GA4_MEASUREMENT_ID=
GA4_PROPERTY_ID=
GA4_API_SECRET=
META_PIXEL_ID=
META_CAPI_TOKEN=
```

5. **Generate Domain** (Settings → Networking) pour obtenir l’URL HTTPS.
6. Ouvre `https://<domaine>/admin` et crée le premier compte admin (premier boot = DB vide).

## Lier Postgres correctement

Dans les variables du service Strapi, référence la variable du service Postgres :

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Le nom `Postgres` doit correspondre au nom du service PostgreSQL dans ton projet Railway.

## Test local Docker (avant push)

```bash
docker compose up --build
```

- API : http://localhost:1337  
- Admin : http://localhost:1337/admin  
- Postgres local compose : port `5433`

Arrêt :

```bash
docker compose down
```

## Après le premier boot

- Configurer permissions Public / Authenticated si besoin (bootstrap catalogue le fait aussi au démarrage).
- Importer le catalogue (CSV admin ou script) — la DB Railway est vide au départ.
- Brancher le front sur `PUBLIC_URL` (ex. `NEXT_PUBLIC_STRAPI_URL`).

## Générer des secrets

Sous PowerShell :

```powershell
# 4 APP_KEYS
1..4 | ForEach-Object { [Convert]::ToBase64String((1..16 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]) }
# Autres salts / secrets
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Ou :

```bash
openssl rand -base64 32
```

## Dépannage

| Symptôme | Piste |
|----------|--------|
| Healthcheck `/_health` → service unavailable | Mettre `HOST=::` (Railway IPv6). Vérifier aussi les logs runtime (DB / secrets manquants) |
| Build Docker échoue (`npm ci` / `sharp`) | Image **Node 22** Debian slim ; vérifier que le dernier `Dockerfile` est bien poussé (chemin `/opt/app`, pas `/opt`) ; `.dockerignore` doit exclure `node_modules` |
| Crash DB / SSL | `DATABASE_SSL=true` + `DATABASE_SSL_REJECT_UNAUTHORIZED=false` |
| Admin / assets en `localhost` | `PUBLIC_URL` = URL Railway HTTPS |
| CORS front bloqué | `FRONTEND_URL` / `CORS_ORIGIN` = origine exacte du front |
| Healthcheck fail | Attendre le start-period (60s+) ; logs Railway |

## Hors scope actuel

- Migration dump local → Railway
- Volume persistant médias / Cloudinary
- Redis / BullMQ
