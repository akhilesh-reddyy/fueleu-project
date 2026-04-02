# AI Agent Workflow Log

## Agents Used

| Agent | Role |
|-------|------|
| **Claude Sonnet** (claude.ai) | Primary agent — architecture design, domain modeling, use-case implementation, HTTP adapters, frontend components, test authoring, review |
| **GitHub Copilot** | Inline completions — boilerplate repetition (mapper functions, DTO shapes, Tailwind class strings) |
| **Cursor Agent** | Refactoring runs — renaming snake_case ↔ camelCase across mapper files, extracting shared helpers |

---

## Prompts & Outputs

### Example 1 — Initial architecture design

**Prompt (to Claude):**
```
You are a senior software architect.
Design a full-stack FuelEU Maritime compliance system using hexagonal architecture.
Tech stack: Node.js + TypeScript + PostgreSQL / React + TypeScript + Tailwind
Requirements: Clear separation: core, ports, adapters
Output: Folder structure + short explanation of each layer
```

**Generated output (abbreviated):**
```
backend/src/
  core/
    domain/       # Pure entities — Route, ComplianceBalance, BankEntry, Pool
    application/  # Use-cases + port interfaces
  adapters/
    inbound/http/ # Express controllers
    outbound/postgres/ # Repository implementations
  infrastructure/ # Server bootstrap, Prisma client
```

The agent correctly placed port interfaces (`IRouteRepository`, `IBankRepository`) in the `application/` layer — co-located with the use-cases that depend on them — rather than in the `adapters/` layer, which would have reversed the dependency arrows.

---

### Example 2 — Domain entity with formula

**Prompt:**
```
Design domain entities for FuelEU Maritime.
ComplianceBalance must:
  - CB = (Target - Actual) * Energy
  - Energy = fuelConsumption * 41000
Logic inside entities (NOT services). Enforce invariants.
```

**Generated (key excerpt):**
```typescript
private static compute(route: Route): number {
  const energy = route.energyInScope();                      // fuelConsumption × 41 000
  const delta  = FUEL_EU.TARGET_GHG_INTENSITY - route.ghgIntensity;
  return delta * energy;
}
```

**Correction applied:** The agent initially placed `TARGET_GHG_INTENSITY` as a magic number `89.3368` inline. Corrected by extracting to a `FUEL_EU` constants object so the value has a single source of truth referenced by both `Route.isCompliant()` and `ComplianceBalance.compute()`.

---

### Example 3 — Pool greedy allocation

**Prompt:**
```
Pool.create() must:
- sum >= 0 (pre-condition)
- deficit not worse (post-condition)
- surplus not negative (post-condition)
- greedy allocation: sort desc by CB, transfer surplus to deficits
All rules enforced inside the entity.
```

**Generated algorithm:**
```typescript
const working = inputs
  .map(m => ({ shipId: m.shipId, cbBefore: m.adjustedCb, cbAfter: m.adjustedCb }))
  .sort((a, b) => b.cbAfter - a.cbAfter);

for (let i = 0; i < working.length; i++) {
  const donor = working[i];
  if (donor.cbAfter <= 1e-9) break;
  for (let j = working.length - 1; j > i; j--) {
    const recipient = working[j];
    if (recipient.cbAfter >= -1e-9) continue;
    const transfer = Math.min(Math.abs(recipient.cbAfter), donor.cbAfter);
    donor.cbAfter     -= transfer;
    recipient.cbAfter += transfer;
    if (donor.cbAfter <= 1e-9) break;
  }
}
```

**Correction applied:** The agent used `== 0` for the surplus exhaustion guard. Changed to `<= 1e-9` throughout to handle floating-point drift (e.g., `1/3 × 1e9` arithmetic).

---

### Example 4 — Integration test strategy

**Prompt:**
```
Write integration tests using Jest + Supertest.
Use in-memory stub repositories (no database).
Test: routes, banking, pools endpoints.
Stubs must implement the same port interfaces as Postgres adapters.
```

**Key insight from generated output:**
The agent correctly built `StubRouteRepository implements IRouteRepository` — using the same interface the production Postgres adapter uses. This proved that use-cases work correctly against any conforming adapter, validating the hexagonal boundary.

**Correction applied:** Initial stubs used `Map<string, RouteProps>` (plain objects). Corrected to `Map<string, Route>` (domain entities) to ensure the mapper translation layer is exercised in tests.

---

### Example 5 — Premium frontend refactor

**Prompt:**
```
Refactor the current UI. Improve ONLY design and interaction quality.
Enhance: visual depth, buttons, cards, typography, spacing, animations.
Make it feel like Stripe/Linear quality.
Return: Card.tsx, Button.tsx, RoutesPage.tsx
```

**Generated:**
- Three-layer box-shadow on `Card` (base + bloom + inner highlight)
- Spring physics on `Button` via `whileHover` + `whileTap`
- `GhgSpark` inline bar encoding 4 data signals in 56px
- `AnimatePresence mode="wait"` on page transitions

**Correction applied:** Initial `Button` used CSS `transition` for box-shadow glow. Replaced with `whileHover={{ boxShadow: ... }}` in Framer Motion so the glow animates with spring physics, synchronised with the `y` translation.

---

## Validation / Corrections

| Issue | How detected | Fix applied |
|-------|-------------|-------------|
| CB formula had magic number `89.3368` inline | Code review | Extracted to `FUEL_EU.TARGET_GHG_INTENSITY` constant |
| Pool `apply()` loop used `== 0` guard | Floating-point edge case test | Changed to `<= 1e-9` tolerance |
| `IRouteRepository` placed in `adapters/` folder | Architecture review | Moved to `application/` — core defines what it needs |
| `ComplianceBalance.applyBanked()` lacked surplus guard | Domain test | Added `if (!this.isDeficit()) throw DomainError(...)` |
| Integration stubs stored `RouteProps` not `Route` entities | Test failure | Changed to store `Route` instances |
| Frontend `Card` used `box-shadow` CSS var incorrectly | Dark mode test | Replaced with hardcoded rgba values for cross-theme safety |
| `routes_one_baseline_per_year` needed partial index not UNIQUE | DB schema review | Changed to `CREATE UNIQUE INDEX ... WHERE is_baseline = TRUE` |

---

## Observations

### Where the agent saved significant time

- **Boilerplate elimination:** All five mapper objects (`RouteMapper`, `ComplianceMapper`, `BankEntryMapper`, `PoolMapper`) were generated in one pass with correct snake_case ↔ camelCase translation. Manual authoring would have taken 30+ minutes.
- **Test scaffolding:** The 40-assertion unit test suite covering all domain invariants was generated in a single prompt. The `StubRepository` pattern emerged from the agent's understanding of the hexagonal architecture without explicit instruction.
- **Frontend component structure:** The compound `Tabs` component (`Tabs` + `TabList` + `TabTrigger` + `TabPanel`) with `layoutId` shared-layout animation was generated with the correct architecture on the first pass.
- **SQL constraints:** The three-way consistency CHECK constraint on `bank_entries.status` was generated correctly, encoding the `banked → partially_applied → fully_applied` lifecycle in pure SQL.

### Where the agent failed or hallucinated

- **Floating-point guards:** Generated `=== 0` comparisons for CB arithmetic throughout. All had to be changed to `<= 1e-9` tolerance. The agent was not aware of IEEE 754 accumulation when summing many `(Target − Actual) × LHV` products.
- **Dark mode colors:** Generated `text-gray-400` and `border-gray-700` Tailwind classes that map to hardcoded hex values, which don't adapt to dark mode properly in the custom design system. Had to replace with CSS variables.
- **Dependency direction:** In early iterations the agent placed `IRouteRepository` inside `adapters/outbound/postgres/` — which would have made `core` import from `adapters`. Required explicit correction with architecture explanation.
- **Recharts animation:** Agent generated `isAnimationActive={false}` on all bars to avoid re-render flicker. Correct fix was `animationBegin={80}` stagger on the second bar group, not disabling animation entirely.

### How tools were combined effectively

1. **Claude** authored the domain layer and use-cases (complex reasoning required).
2. **Copilot** completed repetitive DTO field mappings (pattern recognition from existing fields).
3. **Cursor** performed the bulk rename of `fuelConsumptionTonnes` → `fuelConsumption` across 6 files after the schema alignment task required field name changes.
4. **Claude** reviewed the complete output for architecture violations before final packaging.

---

## Best Practices Followed

- Used Claude for architecture decisions — it reasons about dependency direction correctly when prompted with hexagonal constraints.
- Kept prompts narrow and specific; broad "build everything" prompts produced weaker architecture than focused "build the Pool entity with these exact invariants" prompts.
- Always reviewed generated code against the assignment spec line-by-line before accepting.
- Used Cursor's multi-file refactor for mechanical changes (field renames, import path updates) rather than prompting Claude for each file individually.
- Treated agent output as a first draft, not a final answer — every file went through at least one manual review pass.
