-- ============================================================
-- PHS Supabase Schema
-- Run this in Supabase SQL Editor to create all tables.
-- Mirrors the Ubuntu PostgreSQL schema exactly.
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Personnel (main table) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personnel (
  id                          text PRIMARY KEY,
  version                     integer NOT NULL DEFAULT 1,
  deleted_at                  timestamptz,
  updated_at                  timestamptz NOT NULL DEFAULT NOW(),
  created_at                  timestamptz NOT NULL DEFAULT NOW(),

  -- Identity
  full_name                   text,
  name_last                   text,
  name_first                  text,
  name_middle                 text,
  organization                text,
  present_job                 text,
  business_address            text,
  home_address                text,
  date_of_birth               text,
  place_of_birth              text,
  change_in_name              text,
  nicknames                   text,
  nationality                 text,
  tax_id                      text,
  tel_no                      text,
  mobile                      text,
  email                       text,
  passport_nr                 text,
  passport_expiry             text,

  -- Physical
  sex                         text,
  age                         text,
  height                      text,
  weight                      text,
  build                       text,
  complexion                  text,
  color_eyes                  text,
  color_hair                  text,
  scar_marks                  text,
  health_state                text,
  recent_illness              text,
  blood_type                  text,

  -- Family
  marital_status              text,
  spouse_name                 text,
  marriage_date_place         text,
  spouse_dob                  text,
  spouse_place_birth          text,
  spouse_occupation           text,
  spouse_contact              text,
  spouse_citizenship          text,
  father_name                 text,
  father_dob_place            text,
  father_address              text,
  father_occupation           text,
  father_citizenship          text,
  mother_name                 text,
  mother_dob_place            text,
  mother_address              text,
  mother_occupation           text,
  mother_citizenship          text,
  siblings_name               text,
  siblings_dob                text,
  siblings_citizenship        text,
  siblings_address            text,
  siblings_occupation         text,
  siblings_employer_address   text,
  step_parent_full_name       text,
  step_parent_dob             text,
  step_parent_address         text,
  step_parent_occupation      text,
  step_parent_citizenship     text,
  father_in_law_full_name     text,
  father_in_law_dob           text,
  father_in_law_address       text,
  father_in_law_occupation    text,
  father_in_law_citizenship   text,
  mother_in_law_full_name     text,
  mother_in_law_dob           text,
  mother_in_law_address       text,
  mother_in_law_occupation    text,
  mother_in_law_citizenship   text,

  -- Education
  elem_location               text,
  elem_attendance             text,
  elem_graduated              text,
  hs_location                 text,
  hs_attendance               text,
  hs_graduated                text,
  college_location            text,
  college_attendance          text,
  college_graduated           text,
  pg_location                 text,
  pg_course_attendance        text,
  pg_graduated                text,
  other_schools               text,
  civil_service_eligibility   text,

  -- Background checks
  dismissed_resign            text,
  salary_dependent            text,
  sal_filed                   text,
  income_tax_filed            text,
  arrest_record               text,
  family_arrest               text,
  admin_case                  text,
  pd1081                      text,
  liquor_drugs                text,
  hobbies                     text,
  lie_detector                text,

  -- Certification
  signed_at_cert              text,
  signed_date_cert            text,
  sworn_day                   text,
  sworn_month                 text,
  sworn_place                 text,
  residence_cert_nr2          text,
  residence_cert_issued_on2   text,
  residence_cert_issued_at2   text,
  administering_officer2      text,

  -- Media (base64)
  signature_data_url          text,
  handwritten_entry_data_url  text,
  left_thumb_mark_data_url    text,
  right_thumb_mark_data_url   text,
  photo_data_url              text
);

-- ── Child Tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS personnel_children (
  id                  serial PRIMARY KEY,
  personnel_id        text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name                text,
  dob                 text,
  citizenship_address text,
  father_mother       text
);

CREATE TABLE IF NOT EXISTS personnel_places_of_residence (
  id              serial PRIMARY KEY,
  personnel_id    text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  inclusive_dates text,
  address         text
);

CREATE TABLE IF NOT EXISTS personnel_employment_history (
  id                  serial PRIMARY KEY,
  personnel_id        text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  inclusive_date      text,
  type                text,
  employer_address    text,
  reason_for_leaving  text
);

CREATE TABLE IF NOT EXISTS personnel_seminars_training (
  id              serial PRIMARY KEY,
  personnel_id    text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  inclusive_date  text,
  name            text,
  conducted_by    text,
  remarks         text
);

CREATE TABLE IF NOT EXISTS personnel_foreign_countries (
  id              serial PRIMARY KEY,
  personnel_id    text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  date_of_visit   text,
  country         text,
  purpose         text,
  address_abroad  text
);

CREATE TABLE IF NOT EXISTS personnel_banks_credit (
  id                  serial PRIMARY KEY,
  personnel_id        text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name                text,
  address             text,
  nature_of_account   text
);

CREATE TABLE IF NOT EXISTS personnel_credit_references (
  id              serial PRIMARY KEY,
  personnel_id    text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name            text,
  address         text
);

CREATE TABLE IF NOT EXISTS personnel_character_refs (
  id              serial PRIMARY KEY,
  personnel_id    text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name            text,
  address         text
);

CREATE TABLE IF NOT EXISTS personnel_neighbors (
  id              serial PRIMARY KEY,
  personnel_id    text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name            text,
  address         text
);

CREATE TABLE IF NOT EXISTS personnel_organizations (
  id              serial PRIMARY KEY,
  personnel_id    text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  organization    text,
  address         text,
  membership_date text,
  position_held   text
);

CREATE TABLE IF NOT EXISTS personnel_languages (
  id                  serial PRIMARY KEY,
  personnel_id        text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  language_dialect    text,
  speak               text,
  read                text,
  write               text
);

-- ── Cards ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cards (
  id          serial PRIMARY KEY,
  card_uid    text UNIQUE NOT NULL,
  status      text NOT NULL DEFAULT 'available',
  personnel_id text NULL,
  created_by  text NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personnel_card_registrations (
  personnel_id  text PRIMARY KEY REFERENCES personnel(id) ON DELETE CASCADE,
  card_uid      text UNIQUE NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ── Auth ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'user',
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_user_totp (
  user_id       uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  totp_secret   text,
  totp_enabled  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending',
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_user_status
  ON auth_challenges (user_id, status);

-- ── Audit Logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text NOT NULL,
  record_id   text,
  action      text NOT NULL,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid REFERENCES app_users(id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at DESC);

-- ── Row Level Security (RLS) ─────────────────────────────────────────────────
-- All tables locked down — only service_role key can access.

ALTER TABLE personnel                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_children            ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_places_of_residence ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_employment_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_seminars_training   ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_foreign_countries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_banks_credit        ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_credit_references   ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_character_refs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_neighbors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_languages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_card_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user_totp                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges               ENABLE ROW LEVEL SECURITY;

-- No public access policies — service_role bypasses RLS automatically.
-- This means only the backend (using service_role key) can read/write.
