-- =============================================================================
-- FuelEU Maritime — PostgreSQL Schema
-- Field names mirror the assignment spec (snake_case of camelCase identifiers)
-- (EU) 2023/1805, Annex IV + Articles 20–21
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

CREATE TYPE vessel_type_enum AS ENUM (
  'Container', 'BulkCarrier', 'Tanker', 'RoRo', 'Cruise', 'Ferry'
);

CREATE TYPE fuel_type_enum AS ENUM (
  'HFO', 'LNG', 'MGO', 'VLSFO', 'Methanol', 'Ammonia', 'Hydrogen'
);

CREATE TYPE bank_status_enum AS ENUM (
  'banked', 'partially_applied', 'fully_applied'
);

-- ---------------------------------------------------------------------------
-- Shared trigger function: auto-bump updated_at on every UPDATE
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLE: routes
--
-- Column            Assignment field    Unit / notes
-- -------           ----------------    ------------
-- route_id          routeId             e.g. 'R001'
-- vessel_type       vesselType          enum
-- fuel_type         fuelType            enum
-- year              year                2024 – 2050
-- ghg_intensity     ghgIntensity        gCO₂e/MJ
-- fuel_consumption  fuelConsumption     metric tonnes
-- distance          distance            kilometres
-- total_emissions   totalEmissions      metric tonnes CO₂e
-- is_baseline       isBaseline          at most one TRUE per year
-- =============================================================================

CREATE TABLE routes (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id         VARCHAR(20)      NOT NULL,
  vessel_type      vessel_type_enum NOT NULL,
  fuel_type        fuel_type_enum   NOT NULL,
  year             SMALLINT         NOT NULL,
  ghg_intensity    NUMERIC(8,4)     NOT NULL,
  fuel_consumption NUMERIC(10,2)    NOT NULL,
  distance         NUMERIC(10,2)    NOT NULL,
  total_emissions  NUMERIC(10,2)    NOT NULL,
  is_baseline      BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT routes_route_id_unique       UNIQUE  (route_id),
  CONSTRAINT routes_year_valid            CHECK   (year BETWEEN 2024 AND 2050),
  CONSTRAINT routes_ghg_intensity_pos     CHECK   (ghg_intensity > 0),
  CONSTRAINT routes_fuel_consumption_pos  CHECK   (fuel_consumption > 0),
  CONSTRAINT routes_distance_pos          CHECK   (distance > 0),
  CONSTRAINT routes_total_emissions_nn    CHECK   (total_emissions >= 0)
);

-- Partial unique index: only one row with is_baseline = TRUE per year.
-- Non-baseline rows are unconstrained by this index.
CREATE UNIQUE INDEX routes_one_baseline_per_year
  ON routes (year)
  WHERE is_baseline = TRUE;

-- Indexes for GET /routes filter params
CREATE INDEX routes_year_idx        ON routes (year);
CREATE INDEX routes_vessel_type_idx ON routes (vessel_type);
CREATE INDEX routes_fuel_type_idx   ON routes (fuel_type);

CREATE TRIGGER routes_updated_at
  BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TABLE: ship_compliance
--
-- One CB snapshot per (ship_id, year). Written by ComputeComplianceBalance
-- use-case; upserted on every GET /compliance/cb call.
--
-- cb_gco2eq = (TargetIntensity − ActualIntensity) × EnergyInScope
--   > 0  →  surplus
--   < 0  →  deficit
-- =============================================================================

CREATE TABLE ship_compliance (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id     VARCHAR(100)   NOT NULL,
  year        SMALLINT       NOT NULL,
  route_id    UUID           NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  cb_gco2eq   NUMERIC(20,4)  NOT NULL,
  is_surplus  BOOLEAN        GENERATED ALWAYS AS (cb_gco2eq > 0) STORED,
  computed_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT ship_compliance_year_valid        CHECK (year BETWEEN 2024 AND 2050),
  CONSTRAINT ship_compliance_ship_year_unique  UNIQUE (ship_id, year)
);

CREATE INDEX ship_compliance_ship_idx    ON ship_compliance (ship_id);
CREATE INDEX ship_compliance_year_idx    ON ship_compliance (year);
CREATE INDEX ship_compliance_surplus_idx ON ship_compliance (is_surplus);

-- =============================================================================
-- TABLE: bank_entries
--
-- Article 20 — each time a ship banks its surplus CB, a row is created here.
-- applied_gco2eq accumulates as POST /banking/apply drains the balance.
-- status drives the lifecycle: banked → partially_applied → fully_applied.
-- =============================================================================

CREATE TABLE bank_entries (
  id             UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id        VARCHAR(100)     NOT NULL,
  year           SMALLINT         NOT NULL,
  amount_gco2eq  NUMERIC(20,4)    NOT NULL,   -- original banked amount; always > 0
  applied_gco2eq NUMERIC(20,4)    NOT NULL DEFAULT 0,
  status         bank_status_enum NOT NULL DEFAULT 'banked',
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_entries_year_valid          CHECK (year BETWEEN 2024 AND 2050),
  CONSTRAINT bank_entries_amount_pos          CHECK (amount_gco2eq > 0),
  CONSTRAINT bank_entries_applied_nn          CHECK (applied_gco2eq >= 0),
  CONSTRAINT bank_entries_applied_lte_amount  CHECK (applied_gco2eq <= amount_gco2eq),

  -- status must stay in sync with applied_gco2eq
  CONSTRAINT bank_entries_status_consistent CHECK (
    (status = 'banked'            AND applied_gco2eq = 0)
    OR (status = 'partially_applied' AND applied_gco2eq > 0
                                     AND applied_gco2eq < amount_gco2eq)
    OR (status = 'fully_applied'     AND applied_gco2eq = amount_gco2eq)
  )
);

-- Partial index: ApplyBankedCompliance use-case queries only open entries
CREATE INDEX bank_entries_open_idx
  ON bank_entries (ship_id, year)
  WHERE status <> 'fully_applied';

CREATE TRIGGER bank_entries_updated_at
  BEFORE UPDATE ON bank_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TABLE: pools
--
-- Article 21 — header record for a compliance pool.
-- pool_sum stores ∑ cb_after; must be ≥ 0 (collective deficit forbidden).
-- Pools are write-once; no UPDATE path exists in the application layer.
-- =============================================================================

CREATE TABLE pools (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  year       SMALLINT      NOT NULL,
  pool_sum   NUMERIC(20,4) NOT NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pools_year_valid       CHECK (year BETWEEN 2024 AND 2050),
  CONSTRAINT pools_sum_non_negative CHECK (pool_sum >= 0)
);

CREATE INDEX pools_year_idx ON pools (year);

-- =============================================================================
-- TABLE: pool_members
--
-- Per-member allocation record within a pool. Sealed at pool creation.
-- Both Article 21 member rules are encoded as CHECK constraints, duplicating
-- the domain-layer invariants as a database-level safety net.
-- =============================================================================

CREATE TABLE pool_members (
  id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id   UUID          NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  ship_id   VARCHAR(100)  NOT NULL,
  cb_before NUMERIC(20,4) NOT NULL,   -- adjusted CB entering the pool
  cb_after  NUMERIC(20,4) NOT NULL,   -- CB after greedy allocation
  transfer  NUMERIC(20,4) NOT NULL,   -- cb_after − cb_before

  -- Arithmetic self-consistency (0.001 tolerance covers float rounding)
  CONSTRAINT pool_members_transfer_consistent
    CHECK (ABS(transfer - (cb_after - cb_before)) < 0.001),

  -- Article 21, rule 1: deficit ship must not exit worse than it entered
  CONSTRAINT pool_members_deficit_not_worse
    CHECK (cb_before >= 0 OR cb_after >= cb_before),

  -- Article 21, rule 2: surplus ship must not exit with a negative CB
  CONSTRAINT pool_members_surplus_not_negative
    CHECK (cb_before <= 0 OR cb_after >= 0),

  CONSTRAINT pool_members_pool_ship_unique UNIQUE (pool_id, ship_id)
);

CREATE INDEX pool_members_pool_idx ON pool_members (pool_id);
CREATE INDEX pool_members_ship_idx ON pool_members (ship_id);
