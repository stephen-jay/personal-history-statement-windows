-- Migration: Add TOTP auth state and create challenges table
-- Run this on the Postgres server for the application's database

BEGIN;

-- 1. Create TOTP table to avoid altering app_users directly
CREATE TABLE IF NOT EXISTS app_user_totp (
  user_id uuid PRIMARY KEY,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 2. Create login challenges table to track multi-step auth and throttling
CREATE TABLE IF NOT EXISTS auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, verified, failed, expired
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Index for cleaning up expired challenges or finding active ones
CREATE INDEX IF NOT EXISTS idx_auth_challenges_user_status ON auth_challenges (user_id, status);

COMMIT;

