-- APOLLO full normalized PostgreSQL schema
-- Source model: local JSON fields currently persisted by main.js/personnel:* handlers.

BEGIN;

-- ---------------------------------------------------------------------------
-- Utility trigger: maintain updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apollo_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Core table: personnel (one row per applicant)
-- Keep id as text to preserve existing JSON IDs (e.g. seed-demo-001).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personnel (
  id text PRIMARY KEY,

  -- Name / identity
  full_name text,
  name_last text,
  name_first text,
  name_middle text,

  -- Section I
  present_job text,
  business_address text,
  home_address text,
  date_of_birth text,
  place_of_birth text,
  change_in_name text,
  nicknames text,
  nationality text,
  tax_id text,
  tel_no text,
  mobile text,
  email text,
  passport_nr text,
  passport_expiry text,

  -- Section II
  sex text,
  age text,
  height text,
  weight text,
  build text,
  complexion text,
  color_eyes text,
  color_hair text,
  scar_marks text,
  health_state text,
  recent_illness text,
  blood_type text,

  -- Section III
  marital_status text,
  spouse_name text,
  marriage_date_place text,
  spouse_dob text,
  spouse_place_birth text,
  spouse_occupation text,
  spouse_contact text,
  spouse_citizenship text,

  -- Section IV
  father_name text,
  father_dob_place text,
  father_address text,
  father_occupation text,
  father_citizenship text,
  mother_name text,
  mother_dob_place text,
  mother_address text,
  mother_occupation text,
  mother_citizenship text,
  siblings_name text,
  siblings_dob text,
  siblings_citizenship text,
  siblings_address text,
  siblings_occupation text,
  siblings_employer_address text,
  step_parent_full_name text,
  step_parent_dob text,
  step_parent_address text,
  step_parent_occupation text,
  step_parent_citizenship text,
  father_in_law_full_name text,
  father_in_law_dob text,
  father_in_law_address text,
  father_in_law_occupation text,
  father_in_law_citizenship text,
  mother_in_law_full_name text,
  mother_in_law_dob text,
  mother_in_law_address text,
  mother_in_law_occupation text,
  mother_in_law_citizenship text,

  -- Section V
  elem_location text,
  elem_attendance text,
  elem_graduated text,
  hs_location text,
  hs_attendance text,
  hs_graduated text,
  college_location text,
  college_attendance text,
  college_graduated text,
  pg_location text,
  pg_course_attendance text,
  pg_graduated text,
  other_schools text,
  civil_service_eligibility text,

  -- Sections VII/IX/X/XIII + certification
  dismissed_resign text,
  salary_dependent text,
  sal_filed text,
  income_tax_filed text,
  arrest_record text,
  family_arrest text,
  admin_case text,
  pd1081 text,
  liquor_drugs text,
  hobbies text,
  lie_detector text,
  signed_at_cert text,
  signed_date_cert text,
  sworn_day text,
  sworn_month text,
  sworn_place text,
  residence_cert_nr2 text,
  residence_cert_issued_on2 text,
  residence_cert_issued_at2 text,
  administering_officer2 text,
  handwritten_entry_data_url text,
  left_thumb_mark_data_url text,
  right_thumb_mark_data_url text,
  signature_data_url text,

  -- Images (compatibility now + future URL migration)
  photo_data_url text,
  photo_url text,
  photo_thumb_url text,
  photo_mime_type text,
  photo_size_bytes integer,
  photo_uploaded_at timestamptz,

  -- Control / audit
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz
);

DROP TRIGGER IF EXISTS trg_personnel_updated_at ON personnel;
CREATE TRIGGER trg_personnel_updated_at
BEFORE UPDATE ON personnel
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

-- ---------------------------------------------------------------------------
-- Child/row tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personnel_children (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name text,
  dob text,
  citizenship_address text,
  father_mother text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_children_updated_at ON personnel_children;
CREATE TRIGGER trg_personnel_children_updated_at
BEFORE UPDATE ON personnel_children
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_places_of_residence (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  inclusive_dates text,
  address text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_places_of_residence_updated_at ON personnel_places_of_residence;
CREATE TRIGGER trg_personnel_places_of_residence_updated_at
BEFORE UPDATE ON personnel_places_of_residence
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_employment_history (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  inclusive_date text,
  type text,
  employer_address text,
  reason_for_leaving text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_employment_history_updated_at ON personnel_employment_history;
CREATE TRIGGER trg_personnel_employment_history_updated_at
BEFORE UPDATE ON personnel_employment_history
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_seminars_training (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  inclusive_date text,
  name text,
  conducted_by text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_seminars_training_updated_at ON personnel_seminars_training;
CREATE TRIGGER trg_personnel_seminars_training_updated_at
BEFORE UPDATE ON personnel_seminars_training
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_foreign_countries (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  date_of_visit text,
  country text,
  purpose text,
  address_abroad text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_foreign_countries_updated_at ON personnel_foreign_countries;
CREATE TRIGGER trg_personnel_foreign_countries_updated_at
BEFORE UPDATE ON personnel_foreign_countries
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_banks_credit (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name text,
  address text,
  nature_of_account text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_banks_credit_updated_at ON personnel_banks_credit;
CREATE TRIGGER trg_personnel_banks_credit_updated_at
BEFORE UPDATE ON personnel_banks_credit
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_credit_references (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name text,
  address text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_credit_references_updated_at ON personnel_credit_references;
CREATE TRIGGER trg_personnel_credit_references_updated_at
BEFORE UPDATE ON personnel_credit_references
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_character_refs (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name text,
  address text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_character_refs_updated_at ON personnel_character_refs;
CREATE TRIGGER trg_personnel_character_refs_updated_at
BEFORE UPDATE ON personnel_character_refs
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_neighbors (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  name text,
  address text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_neighbors_updated_at ON personnel_neighbors;
CREATE TRIGGER trg_personnel_neighbors_updated_at
BEFORE UPDATE ON personnel_neighbors
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_organizations (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  organization text,
  address text,
  membership_date text,
  position_held text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_organizations_updated_at ON personnel_organizations;
CREATE TRIGGER trg_personnel_organizations_updated_at
BEFORE UPDATE ON personnel_organizations
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

CREATE TABLE IF NOT EXISTS personnel_languages (
  id bigserial PRIMARY KEY,
  personnel_id text NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  language_dialect text,
  speak text,
  read text,
  write text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_personnel_languages_updated_at ON personnel_languages;
CREATE TRIGGER trg_personnel_languages_updated_at
BEFORE UPDATE ON personnel_languages
FOR EACH ROW EXECUTE FUNCTION apollo_set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth/RBAC tables (admin login + role-based restrictions)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_roles (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_user_roles (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- NOTE: seed admin user separately (so you can set a real password).

-- ---------------------------------------------------------------------------
-- Indexes: roster/search and FK-heavy lookups
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_personnel_updated_at_desc ON personnel (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_personnel_name_last_first ON personnel (name_last, name_first);
CREATE INDEX IF NOT EXISTS idx_personnel_mobile ON personnel (mobile);
CREATE INDEX IF NOT EXISTS idx_personnel_email ON personnel (email);
CREATE INDEX IF NOT EXISTS idx_personnel_present_job ON personnel (present_job);
CREATE INDEX IF NOT EXISTS idx_personnel_deleted_at ON personnel (deleted_at);

CREATE INDEX IF NOT EXISTS idx_children_personnel_id ON personnel_children (personnel_id);
CREATE INDEX IF NOT EXISTS idx_residence_personnel_id ON personnel_places_of_residence (personnel_id);
CREATE INDEX IF NOT EXISTS idx_employment_personnel_id ON personnel_employment_history (personnel_id);
CREATE INDEX IF NOT EXISTS idx_employment_personnel_date ON personnel_employment_history (personnel_id, inclusive_date);
CREATE INDEX IF NOT EXISTS idx_seminars_personnel_id ON personnel_seminars_training (personnel_id);
CREATE INDEX IF NOT EXISTS idx_seminars_personnel_date ON personnel_seminars_training (personnel_id, inclusive_date);
CREATE INDEX IF NOT EXISTS idx_foreign_personnel_id ON personnel_foreign_countries (personnel_id);
CREATE INDEX IF NOT EXISTS idx_banks_personnel_id ON personnel_banks_credit (personnel_id);
CREATE INDEX IF NOT EXISTS idx_credit_refs_personnel_id ON personnel_credit_references (personnel_id);
CREATE INDEX IF NOT EXISTS idx_character_refs_personnel_id ON personnel_character_refs (personnel_id);
CREATE INDEX IF NOT EXISTS idx_neighbors_personnel_id ON personnel_neighbors (personnel_id);
CREATE INDEX IF NOT EXISTS idx_orgs_personnel_id ON personnel_organizations (personnel_id);
CREATE INDEX IF NOT EXISTS idx_languages_personnel_id ON personnel_languages (personnel_id);

COMMIT;
