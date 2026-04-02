# Reflection on AI-Agent-Assisted Development

## What I Learned Using AI Agents

The most important insight from this project was that AI agents are exceptional at **structure** and poor at **invariants**. When I asked Claude to design the hexagonal folder layout and port interfaces, the output was architecturally sound on the first pass — the dependency arrows pointed inward, the use-cases were thin, and the port interfaces lived in the right layer. But when I asked it to implement the Pool greedy algorithm, it silently used `=== 0` guards throughout, which fail on floating-point sums like `(89.3368 − 88.0) × 4800 × 41000`. The algorithm looked correct to casual review; only a deliberate edge-case test (`1/3 × 1e9` arithmetic) caught the drift.

This asymmetry is consistent: agents reason well about *relationships* between components (what calls what, what depends on what) but require careful review for *numerical precision* (formula constants, tolerance comparisons, Decimal vs float boundaries).

A second lesson: **prompt scope determines output quality**. The first architecture prompt asked for "hexagonal folder structure + explanation." The agent delivered a textbook hexagonal layout. Later prompts that asked to "build the banking tab" produced working but generic code. The best outputs came from narrow prompts with explicit constraints: "implement `Pool.create()` with exactly these three invariants, logic inside the entity, no service layer."

## Efficiency Gains vs Manual Coding

Time estimate without AI assistance for this project: **~40 hours** (domain layer: 8h, use-cases + ports: 8h, HTTP adapters: 4h, schema + migrations: 2h, tests: 8h, frontend components: 8h, UI tabs: 8h, documentation: 4h).

Time with AI assistance: **~14 hours** — primarily spent on review, correction, and integration (wiring the composition root, fixing floating-point guards, aligning field names between schema and domain, reviewing all test stubs). The agent generated approximately 2,800 lines of code that I would estimate would have taken 30+ manual hours; my review and correction work was approximately 10 hours.

The productivity multiplier was highest for:
- **Boilerplate-heavy files** (mappers, stub repositories, DTO interfaces) — near-instant generation with minor corrections
- **Test scaffolding** (the 82-assertion test suite) — generated in two prompts vs an estimated 8h manual effort
- **CSS/styling work** (the glassmorphism cards, Framer Motion spring configs, Tailwind token definitions) — the agent has excellent taste when given design direction

The multiplier was lowest for:
- **Composition root** (wiring DI) — required manual assembly; the agent's output was a starting point, not a solution
- **Database constraints** (partial indexes, generated columns, three-way CHECK) — correct but required cross-checking against PostgreSQL documentation

## Improvements I Would Make Next Time

**1. Write invariants first, then prompt for implementation.** I would give the agent a list of typed invariants as a TypeScript interface or test skeleton before asking it to implement the entity. This constrains the solution space and catches floating-point issues earlier.

**2. Use a `tasks.md` file as the agent's memory.** Cursor's task-based workflow forces the agent to tick off requirements as it completes them. Without this, the agent drifts in long sessions — it starts skipping validation guards or reintroducing business logic into use-cases.

**3. Separate generation from review passes.** I would run a dedicated "architecture review" prompt after each major component, giving the agent the generated code and asking: "Does this violate hexagonal architecture? Does core import from adapters anywhere?" This structured self-review catches dependency violations that wouldn't surface until the composition root is wired.

**4. Prompt for the composition root explicitly and early.** The DI wiring file (`server.ts`) is where all architectural decisions must hold simultaneously — if the domain layer was accidentally coupled to Prisma, the composition root is where it becomes apparent. Generating this file early would have surfaced the `IRouteRepository` placement error sooner.

**5. Test the agent's output against the spec, not against itself.** After each generated module, I would run the assignment checklist against the code rather than asking the agent "does this look right?" — the agent tends to confirm its own output rather than critique it against external requirements.
