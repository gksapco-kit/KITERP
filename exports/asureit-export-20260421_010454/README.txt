KITERP Database Export
=======================
Exported at : 2026-04-21 01:05:04
Database    : kiterp
Tables      : 162 (public schema)
Postgres    : psql (PostgreSQL) 15.17
Dump format : Plain SQL (UTF-8, --clean --if-exists)

Files in this bundle
--------------------
  database.sql    Full schema + all data (run psql to restore)
  uploads/        Vendor-uploaded files (logos, attachments, etc.)
  import-db.ps1   One-command restore script for Windows + Docker
  README.txt      This file

Quick restore (Windows + Docker Desktop)
-----------------------------------------
  1. Install Docker Desktop and start it.
  2. Clone/copy the KITERP project to your machine.
  3. Extract this zip anywhere, then run:

       .\import-db.ps1 -ExportDir "C:\path\to\this-folder"

  4. When prompted type 'yes' to confirm the restore.
  5. After import:   docker compose up -d
     - Vendor app  : http://localhost:3001
     - Storefront  : http://localhost:3002
     - API docs    : http://localhost:8000/docs

Manual restore (if import-db.ps1 is unavailable)
-------------------------------------------------
  docker compose up -d postgres
  docker cp database.sql kiterp-postgres:/tmp/restore.sql
  docker exec kiterp-postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS kiterp; CREATE DATABASE kiterp OWNER postgres;"
  docker exec kiterp-postgres psql -U postgres -d kiterp -f /tmp/restore.sql
  docker compose up -d
