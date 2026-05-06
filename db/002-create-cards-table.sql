-- Migration: create cards registry and optional personnel->user link
-- Run this on the Postgres server for the application's database

-- Lightweight migration: create cards table only.
-- This avoids needing permissions to alter existing tables (app_users/personnel).

CREATE TABLE IF NOT EXISTS cards (
  id serial PRIMARY KEY,
  card_uid text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'available', -- available|assigned
  personnel_id text NULL,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- NOTE: `personnel_id` is intentionally left as plain text to avoid requiring
-- a foreign-key reference during this migration. After this runs, an admin or
-- DBA can add stronger constraints when appropriate.

