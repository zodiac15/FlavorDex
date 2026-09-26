# Container deployment

Build production images separately from the repository root:

```bash
docker build -t flavordex-backend:release ./backend
docker build -t flavordex-frontend:release ./frontend
```

Set `API_URL` on the frontend container at runtime to the public HTTPS API URL users' browsers can reach. The same image can then run in multiple environments without rebuilding.

## Backend configuration

Provide these variables to the backend container through the deployment platform's secret manager or a protected environment file:

```env
DATABASE_URL=postgresql+asyncpg://flavordex_app:URL_ENCODED_PASSWORD@db.internal:5432/flavordex
SECRET_KEY=<random value with at least 32 bytes>
CORS_ORIGINS=https://app.example.com
SQL_ECHO=false
```

Keep the PostgreSQL host private. Allow database traffic only from the backend host. Do not expose port `5432` publicly.

Run migrations once for each release, before starting or updating API containers:

```bash
docker run --rm \
  --env-file /etc/flavordex/backend.env \
  --entrypoint alembic \
  flavordex-backend:release \
  -c backend/alembic.ini upgrade head
```

Back up the database before migrations. Current data with duplicate recipe-ingredient links can prevent the uniqueness migration from completing; clean or otherwise remediate those records first.

Start the backend behind an HTTPS reverse proxy or load balancer. Do not expose its container port directly to the public internet.

## Frontend configuration

Set `API_URL` on the frontend container:

```env
API_URL=https://api.example.com
```

The backend URL must be reachable from users' browsers, not only from the frontend container. Run the frontend behind an HTTPS reverse proxy or load balancer. The public site origin must match the backend's `CORS_ORIGINS` value exactly, including scheme and port.

## Operations

- Run one backend replica with SQLite only for development. Use PostgreSQL for production and multiple replicas.
- Keep PostgreSQL data in a persistent Docker volume and schedule tested backups.
- Pin image tags to release versions; avoid deploying mutable `latest` tags.
- Store secrets outside image layers and source control.
- Configure firewall rules so only HTTPS reaches public services. Restrict database access to backend hosts.
