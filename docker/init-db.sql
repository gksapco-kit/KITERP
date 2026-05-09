-- ============================================
-- KITERP - Database Initialization Script
-- Runs on first container creation only
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create database if not exists (Postgres image creates POSTGRES_DB already)
-- This is a safety net for additional setups
SELECT 'KITERP database initialized' AS status;
