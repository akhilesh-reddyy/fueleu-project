-- =============================================================================
-- FuelEU Maritime — Seed Data
-- Five routes from the assignment brief, verbatim.
-- R001 is set as baseline (is_baseline = TRUE) for year 2024.
--
-- CB pre-calculation reference (not stored here; computed by application):
--   Target 2025 = 89.3368 gCO₂e/MJ
--   Energy (MJ) = fuel_consumption × 41 000
--   CB (gCO₂e)  = (89.3368 − ghg_intensity) × energy_mj
--
--   R001: (89.3368 − 91.0)  × (5000 × 41000) = −340,440,000  → DEFICIT
--   R002: (89.3368 − 88.0)  × (4800 × 41000) = +263,433,600  → SURPLUS
--   R003: (89.3368 − 93.5)  × (5100 × 41000) = −869,738,400  → DEFICIT
--   R004: (89.3368 − 89.2)  × (4900 × 41000) = +27,496,880   → SURPLUS
--   R005: (89.3368 − 90.5)  × (4950 × 41000) = −235,489,200  → DEFICIT
-- =============================================================================

INSERT INTO routes (
  route_id,
  vessel_type,
  fuel_type,
  year,
  ghg_intensity,
  fuel_consumption,
  distance,
  total_emissions,
  is_baseline
) VALUES
  -- R001 – Container / HFO / 2024 – set as the 2024 baseline
  ('R001', 'Container',   'HFO', 2024, 91.0, 5000, 12000, 4500, TRUE),

  -- R002 – BulkCarrier / LNG / 2024 – below target → surplus
  ('R002', 'BulkCarrier', 'LNG', 2024, 88.0, 4800, 11500, 4200, FALSE),

  -- R003 – Tanker / MGO / 2024 – furthest above target → large deficit
  ('R003', 'Tanker',      'MGO', 2024, 93.5, 5100, 12500, 4700, FALSE),

  -- R004 – RoRo / HFO / 2025 – just below target → small surplus
  ('R004', 'RoRo',        'HFO', 2025, 89.2, 4900, 11800, 4300, FALSE),

  -- R005 – Container / LNG / 2025 – above target → deficit
  ('R005', 'Container',   'LNG', 2025, 90.5, 4950, 11900, 4400, FALSE);
