# Security upgrade runbook (KITERP)

## Local — after pulling dependency changes

1. Backend: `docker compose build backend && docker compose up -d postgres redis backend`
2. Web: `npm install --prefix frontend && npm install --prefix vendor-web && npm install --prefix storefront-web`
3. Smoke: `http://localhost:8000/health`, `npm run dev`, login on each app
4. Optional: `cd backend && pytest`

## AWS production deploy

**Pre:** RDS snapshot, note current git commit on EC2.

```powershell
docker compose --env-file .env.config -f docker-compose.prod.yml build --no-cache backend frontend vendor-web storefront-web
docker compose --env-file .env.config -f docker-compose.prod.yml up -d
docker compose --env-file .env.config -f docker-compose.prod.yml logs -f backend
```

**Post:** `/health`, login all three frontends, upload/PDF smoke, check logs.

**AWS console:** Apply RDS and ElastiCache maintenance when available.

## Remaining (planned, not in Track A)

- Vite 6+ / Zod 4 (web apps)
- vendor-web: vitest 5.x, jspdf 4.x
- mobile: `expo install --check`, targeted `npm audit fix`
- Pillow 13.x if pip-audit requires after further CVEs