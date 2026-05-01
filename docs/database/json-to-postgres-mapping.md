# APOLLO JSON -> PostgreSQL Mapping and Import Order

This maps JSON records to the PostgreSQL schema in `config/apollo-postgres-schema.sql`.

## 1) Source shape

Each JSON record currently contains:

- Scalar fields (personal/contact/education/etc.) in camelCase.
- Array sections:
  - `children`
  - `placesOfResidence`
  - `employmentHistory`
  - `seminarsTraining`
  - `foreignCountries`
  - `banksCredit`
  - `creditReferences`
  - `characterRefs`
  - `neighbors`
  - `organizations`
  - `languages`

## 2) Core mapping rules

- `record.id` -> `personnel.id` (preserve as-is, do not re-generate).
- CamelCase scalar keys map to snake_case columns.
- Missing/empty fields map to `NULL` (except `id`, `version`, timestamps).
- Keep `updatedAt` from JSON when available; otherwise set `NOW()`.
- Keep `photoDataUrl` for compatibility in `photo_data_url`.

## 3) Scalar field mapping (personnel table)

Representative examples:

| JSON key | PostgreSQL column |
|---|---|
| `fullName` | `full_name` |
| `nameLast` | `name_last` |
| `nameFirst` | `name_first` |
| `nameMiddle` | `name_middle` |
| `presentJob` | `present_job` |
| `businessAddress` | `business_address` |
| `homeAddress` | `home_address` |
| `dateOfBirth` | `date_of_birth` |
| `placeOfBirth` | `place_of_birth` |
| `changeInName` | `change_in_name` |
| `taxId` | `tax_id` |
| `telNo` | `tel_no` |
| `passportNr` | `passport_nr` |
| `passportExpiry` | `passport_expiry` |
| `colorEyes` | `color_eyes` |
| `colorHair` | `color_hair` |
| `scarMarks` | `scar_marks` |
| `healthState` | `health_state` |
| `recentIllness` | `recent_illness` |
| `bloodType` | `blood_type` |
| `maritalStatus` | `marital_status` |
| `spouseName` | `spouse_name` |
| `marriageDatePlace` | `marriage_date_place` |
| `spouseDob` | `spouse_dob` |
| `spousePlaceBirth` | `spouse_place_birth` |
| `spouseContact` | `spouse_contact` |
| `spouseCitizenship` | `spouse_citizenship` |
| `fatherDobPlace` | `father_dob_place` |
| `fatherInLawFullName` | `father_in_law_full_name` |
| `motherInLawFullName` | `mother_in_law_full_name` |
| `elemLocation` | `elem_location` |
| `elemAttendance` | `elem_attendance` |
| `elemGraduated` | `elem_graduated` |
| `collegeLocation` | `college_location` |
| `pgCourseAttendance` | `pg_course_attendance` |
| `civilServiceEligibility` | `civil_service_eligibility` |
| `dismissedResign` | `dismissed_resign` |
| `salaryDependent` | `salary_dependent` |
| `salFiled` | `sal_filed` |
| `incomeTaxFiled` | `income_tax_filed` |
| `arrestRecord` | `arrest_record` |
| `familyArrest` | `family_arrest` |
| `adminCase` | `admin_case` |
| `liquorDrugs` | `liquor_drugs` |
| `lieDetector` | `lie_detector` |
| `signedAtCert` | `signed_at_cert` |
| `signedDateCert` | `signed_date_cert` |
| `swornDay` | `sworn_day` |
| `swornMonth` | `sworn_month` |
| `swornPlace` | `sworn_place` |
| `residenceCertNr2` | `residence_cert_nr2` |
| `residenceCertIssuedOn2` | `residence_cert_issued_on2` |
| `residenceCertIssuedAt2` | `residence_cert_issued_at2` |
| `administeringOfficer2` | `administering_officer2` |
| `photoDataUrl` | `photo_data_url` |
| `updatedAt` | `updated_at` |

Any scalar not listed follows the same camelCase -> snake_case convention.

## 4) Array mapping

| JSON array | Target table | Child field mapping |
|---|---|---|
| `children` | `personnel_children` | `name`, `dob`, `citizenshipAddress`->`citizenship_address`, `fatherMother`->`father_mother` |
| `placesOfResidence` | `personnel_places_of_residence` | `inclusiveDates`->`inclusive_dates`, `address` |
| `employmentHistory` | `personnel_employment_history` | `inclusiveDate`->`inclusive_date`, `type`, `employerAddress`->`employer_address`, `reasonForLeaving`->`reason_for_leaving` |
| `seminarsTraining` | `personnel_seminars_training` | `inclusiveDate`->`inclusive_date`, `name`, `conductedBy`->`conducted_by`, `remarks` |
| `foreignCountries` | `personnel_foreign_countries` | `dateOfVisit`->`date_of_visit`, `country`, `purpose`, `addressAbroad`->`address_abroad` |
| `banksCredit` | `personnel_banks_credit` | `name`, `address`, `natureOfAccount`->`nature_of_account` |
| `creditReferences` | `personnel_credit_references` | `name`, `address` |
| `characterRefs` | `personnel_character_refs` | `name`, `address` |
| `neighbors` | `personnel_neighbors` | `name`, `address` |
| `organizations` | `personnel_organizations` | `organization`, `address`, `membershipDate`->`membership_date`, `positionHeld`->`position_held` |
| `languages` | `personnel_languages` | `languageDialect`->`language_dialect`, `speak`, `read`, `write` |

## 5) Import order (idempotent)

1. Upsert into `personnel` (parent row).
2. For each child table:
   - delete existing rows for `personnel_id` (simple/idempotent strategy), then
   - insert all rows from JSON array.

Alternative for very large datasets: upsert child rows with natural keys + hash, but delete+insert is acceptable for APOLLO migration.

## 6) Reconciliation checks

Run after import:

```sql
-- Parent counts
SELECT COUNT(*) AS personnel_count FROM personnel WHERE deleted_at IS NULL;

-- Child counts by table
SELECT 'children' AS t, COUNT(*) FROM personnel_children
UNION ALL SELECT 'residence', COUNT(*) FROM personnel_places_of_residence
UNION ALL SELECT 'employment', COUNT(*) FROM personnel_employment_history
UNION ALL SELECT 'seminars', COUNT(*) FROM personnel_seminars_training
UNION ALL SELECT 'foreign', COUNT(*) FROM personnel_foreign_countries
UNION ALL SELECT 'banks', COUNT(*) FROM personnel_banks_credit
UNION ALL SELECT 'credit_refs', COUNT(*) FROM personnel_credit_references
UNION ALL SELECT 'character_refs', COUNT(*) FROM personnel_character_refs
UNION ALL SELECT 'neighbors', COUNT(*) FROM personnel_neighbors
UNION ALL SELECT 'organizations', COUNT(*) FROM personnel_organizations
UNION ALL SELECT 'languages', COUNT(*) FROM personnel_languages;
```

Spot-check record parity:

```sql
SELECT id, full_name, mobile, email, updated_at
FROM personnel
ORDER BY updated_at DESC
LIMIT 20;
```

## 7) Import quality gates

- `personnel` row count must equal JSON record count.
- No `NULL` in `personnel.id`.
- FK orphan count must be zero in all child tables.
- Failed row log should include: source ID, table, reason, payload snippet.
