# Free Demo Deployment Guide

Deploy KITERP fully online for free using:
- **Render.com** → FastAPI backend (free web service)
- **Vercel** → 3 React frontends (admin, vendor, storefront)
- **Supabase** → PostgreSQL (free 500 MB)
- **MongoDB Atlas** → MongoDB (free 512 MB M0 cluster)
- **Upstash** → Redis (free 10k commands/day)

No credit card required for any of these.

---

## Step 1 — Database Setup

### 1a. PostgreSQL — Supabase
1. Sign up at https://supabase.com
2. Create a new project (choose a region close to you)
3. Go to **Settings → Database → Connection string (URI)**
4. Copy the URI — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
   ```
5. Keep this handy for Step 3.

### 1b. MongoDB — Atlas
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a **Free (M0)** cluster
3. Create a database user (Settings → Database Access)
4. Go to **Network Access → Add IP Address → Allow from anywhere** (`0.0.0.0/0`)
5. Click **Connect → Drivers** and copy the URI:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/kiterp?retryWrites=true&w=majority
   ```

### 1c. Redis — Upstash
1. Sign up at https://upstash.com
2. Create a new Redis database (free tier)
3. Copy the **Redis URL** (starts with `rediss://`)

---

## Step 2 — Push Code to GitHub

If you haven't already:
```bash
git init
git add .
git commit -m "initial commit"
# Create a repo on github.com then:
git remote add origin https://github.com/YOUR_USERNAME/kiterp.git
git push -u origin main
```

---

## Step 3 — Deploy Backend on Render.com

1. Sign up at https://render.com
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `kiterp-api`
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: Free
5. Add **Environment Variables** (click "Add Environment Variable" for each):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres` |
   | `MONGODB_URL` | `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/kiterp?retryWrites=true&w=majority` |
   | `MONGODB_DB_NAME` | `kiterp` |
   | `REDIS_URL` | `rediss://default:password@xxx.upstash.io:6379` |
   | `JWT_SECRET_KEY` | (click "Generate" or use a random 32-char string) |
   | `JWT_ALGORITHM` | `HS256` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
   | `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
   | `ENVIRONMENT` | `production` |
   | `DEBUG` | `false` |
   | `ALLOWED_ORIGINS` | `*` |
   | `PYTHONPATH` | `/app` |

6. Click **Create Web Service**
7. Wait ~5 min for the first build
8. Your API will be at: `https://kiterp-api.onrender.com`

### Run Database Migrations
After the service is running, go to **Render Dashboard → Shell** and run:
```bash
alembic upgrade head
```

---

## Step 4 — Deploy Frontends on Vercel

Sign up at https://vercel.com (free, connects to GitHub)

### 4a. Admin Panel (frontend/)
1. Click **Add New Project** → Import your GitHub repo
2. Set **Root Directory**: `frontend`
3. **Framework**: Vite
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://kiterp-api.onrender.com/api/v1` |
7. Click **Deploy**
8. (Optional) Go to **Settings → Domains** to set a custom subdomain like `admin.yourapp.vercel.app`

### 4b. Central Application (vendor-web/)
1. Click **Add New Project** → Import same GitHub repo
2. Set **Root Directory**: `vendor-web`
3. Same build settings as above
4. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://kiterp-api.onrender.com/api/v1` |
5. Deploy

### 4c. Storefront (storefront-web/)
1. Click **Add New Project** → Import same repo
2. **Root Directory**: `storefront-web`
3. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://kiterp-api.onrender.com/api/v1` |
4. Deploy

---

## Step 5 — Create Super Admin

Once the backend is live, create the first admin user via Render Shell:
```bash
python -c "
import asyncio
from app.database import get_db_context
from app.models.user import User
from app.core.security import get_password_hash

async def create_admin():
    async with get_db_context() as db:
        user = User(
            email='admin@kiterp.com',
            full_name='Super Admin',
            hashed_password=get_password_hash('Admin@1234'),
            is_active=True,
            is_superuser=True,
        )
        db.add(user)
        await db.commit()
        print('Admin created!')

asyncio.run(create_admin())
"
```

Or use the API docs at `https://kiterp-api.onrender.com/docs` to call `POST /api/v1/auth/register` then manually set `is_superuser=true` in Supabase SQL editor:
```sql
UPDATE users SET is_superuser = true WHERE email = 'admin@kiterp.com';
```

---

## Final URLs Summary

| App | URL |
|-----|-----|
| API | `https://kiterp-api.onrender.com` |
| API Docs | `https://kiterp-api.onrender.com/docs` |
| Admin Panel | `https://kiterp-admin.vercel.app` |
| Central Application | `https://kiterp-vendor.vercel.app` |
| Storefront | `https://kiterp-store.vercel.app` |

---

## Important Free Tier Limits

| Service | Limit | Impact |
|---------|-------|--------|
| Render free | Sleeps after 15 min inactivity | First request takes ~30s to wake up |
| Supabase | 500 MB DB, 2 GB bandwidth | Fine for demo |
| MongoDB Atlas | 512 MB storage | Fine for demo |
| Upstash Redis | 10,000 cmds/day | Fine for demo |
| Vercel | 100 GB bandwidth/month | Fine for demo |

### Tip — Keep Render Awake
Use a free cron ping service like https://cron-job.org to ping your health endpoint every 10 minutes:
```
https://kiterp-api.onrender.com/health
```
This prevents the backend from sleeping.

---

## Optional — Custom Free Domain

Get a free domain from:
- **Freenom** (`.tk`, `.ml`, `.ga` domains) → https://freenom.com
- **js.org** → for JS projects (GitHub-based)

Then point it to your Vercel app in Vercel → Settings → Domains.
