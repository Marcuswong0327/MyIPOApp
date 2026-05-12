# MyIPOApp Setup Guide

Copy-paste setup commands for a fresh laptop (Windows + PowerShell), plus daily commands.

## 1) One-time setup after `git clone`

From repo root:

```powershell
cd C:\path\to\MyIPOApp
npm install
```

### 1.1 Expo app

Create root env if needed (client-safe values only):

```powershell
copy .env.example .env
```

If no root `.env.example` exists yet, create `.env` manually for Expo public values only.

### 1.2 API service

```powershell
cd services/api
npm install
copy .env.example .env
```

Fill `services/api/.env`:

- `SUPABASE_URL=https://<project>.supabase.co`
- `DATABASE_URL=postgresql://...`
- Optional: `SUPABASE_JWT_SECRET` only for legacy HS256 token fallback

### 1.3 Python indexer

```powershell
cd ..\..\jobs\indexer
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

Fill `jobs/indexer/.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `IPO_ID`
- `STORAGE_OBJECT_PATH`

## 2) Daily development commands

Open separate terminals.

### Terminal A: Expo app

```powershell
cd C:\path\to\MyIPOApp
npm start
```

Then press:

- `a` to open Android
- `r` to reload

### Terminal B: API service

```powershell
cd C:\path\to\MyIPOApp\services\api
npm start
```

Health check:

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/healthz" -Method Get
```

### Terminal C: Indexer (when re-indexing PDF)

```powershell
cd C:\path\to\MyIPOApp\jobs\indexer
.\.venv\Scripts\Activate.ps1
python indexer.py
```

## 3) Supabase SQL files to run

- `supabase/migrations/20260513120000_init_ipo_rag.sql` (if not already applied)
- `supabase/seed_dev_ipo.sql`
- `supabase/storage_prospectus_bucket.sql`

## 4) Common fixes

### Python venv is broken (`No module named pip` / permission denied)

```powershell
cd C:\path\to\MyIPOApp\jobs\indexer
deactivate 2>$null
Remove-Item -Recurse -Force .venv
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m ensurepip --upgrade
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### PowerShell blocks venv activation

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### `DATABASE_URL` password has `@`

URL-encode special chars in password:

- `@` -> `%40`
- `#` -> `%23`
- `/` -> `%2F`

Example:

```env
DATABASE_URL="postgresql://postgres:my%40pass@db.xxx.supabase.co:5432/postgres"
```

## 5) Security reminders

- Never commit `.env` files.
- Never put `service_role` in Expo/mobile code.
- Rotate secrets if they were pasted in chat/screenshots/history.
