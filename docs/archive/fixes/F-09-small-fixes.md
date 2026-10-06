# F-09 — Small fixes: announcement text, partial todo scenarios, dead seam, test tiers, gate checklist, perf fixture (M)

**Needs:** F-01 (for the scenario timings) · **Spec touched:** `05-plan/00-agent-workflow.md`, `05-plan/01-testing-strategy.md`, `05-plan/M6-steel-and-blood.md` (T-M6-18), `05-plan/M4-life.md` (none; historical)

Each part is independent. One commit per part is fine: `F-09a: announcement text`, and so on.

## F-09a — Five announcements print raw keys

These registered keys have no row in `src/ui/strings.ts` or `strings.json`, so the log shows the key itself:

- `announce.mood_tier`
- `announce.sulk`
- `announce.sulk_break`
- `announce.thought`
- `announce.fish_pool_depleted`

The committed `reports/screenshots/farm-plot-and-orders.png` shows `announce.mood_tier x3`. The only test (`test/unit/ui/fortress.test.ts:278`) checks severity, not text. In addition, the `{dwarf}` placeholder is filled only from `finderId` or `minerId`, but these events name their dwarf in `id`.

**Decisions.**

1. Placeholders (`src/ui/announcements.ts` `params`):
   - `dwarf` comes from the first of `finderId`, `minerId` and `id` that names an entity with a `Creature` component that has a name (a non-creature `id` gives nothing);
   - a new placeholder `thought` is the `text` of the `thoughts.json` row named by `thoughtId`.
2. The sulk note is split by kind. Change 15's registration of `SulkHappened` (note) to `{ severity: 'note', stringKey: 'announce.sulk', keyField: 'kind', oneOf: { field: 'kind', values: ['day_off', 'argue', 'weep'] } }`.
3. Text rows added to `src/ui/strings.ts`, in the understated style of D-065:

| Key | Text |
|---|---|
| `announce.mood_tier` | `{dwarf} is miserable.` |
| `announce.sulk.day_off` | `{dwarf} is taking the day off.` |
| `announce.sulk.argue` | `{dwarf} has picked a quarrel.` |
| `announce.sulk.weep` | `{dwarf} is weeping at the hearth.` |
| `announce.sulk_break` | `{dwarf} has broken a piece of furniture in a temper.` |
| `announce.thought` | `{dwarf}: "{thought}"` |
| `announce.fish_pool_depleted` | `A fishing spot has been fished out.` |

**Test** (`test/unit/ui/announcements-text.test.ts`, "F-09a: every registered announcement has text"):

- Build a `HeadlessGame` with the standard systems.
- For every announcement registration, compute the keys it can produce: the `stringKey` itself, or `stringKey.<value>` for each `oneOf` value when `keyField` is set. The season registration uses 0–3.
- Assert `strings.get(key, {}) !== key` for each.

This test would have caught all five.

Then re-take `reports/screenshots/farm-plot-and-orders.png` through the e2e run that produces it, and check it by eye.

## F-09b — Scenarios parked whole as `todo` for one bad assertion

`tr_dig_room` is entirely `todo` (C-004) because of its 2,000-tick limit. That also switched off "a miner digs a 3×3 room in granite" and the only live check of the ~30% stone-drop rate. C-005 and C-008 kept their valid parts running. (C-003, C-006, C-007, C-008 and C-002 are resolved by F-08, F-02 and F-03.)

**Decision.** `tr_dig_room` runs as a real scenario with a functional bound: the room completes within **3,000 ticks** (C-004 measured 2,274 with needs), and the 100 compact runs each complete within 4,000 ticks with a drop rate of 20–40%. The 2,000-tick expectation stays, as `it.todo('C-004: …2,000 ticks…')` in `test/unit/terrain/producer.test.ts`, for T-M8-06 (the owner deferred it). The same pattern is the rule from now on.

**Spec amendment** (`docs/05-plan/00-agent-workflow.md` § Ambiguity protocol, step 4): append

> Mark as `it.todo` only the assertion that the contradiction makes impossible; keep every other assertion of the test running (with a functional bound where the contradicted one was a timing).

## F-09c — The dead milestone seam

`ACTIVE_RECIPE_WORKSHOPS` and `recipeActive` (`src/systems/workshops/constants.ts`, D-128) now pass every recipe row, and `operate.ts:288` special-cases `'smelter'` because of them.

**Change:**

- Delete both, and every call of `recipeActive`.
- `produce` skips a workshop only when `recipesForType(type)` is empty.
- Replace the unit test "M5 rows loaded but inactive" (`remaining-recipes.test.ts`) with "every recipe row is active in its workshop type".

If F-07 is done first, some of these lines are already gone.

## F-09d — Test wall time

`npm test` took 455 s at the M5 gate and runs before every commit. All 83 scenarios run from one file, `test/scenarios/index.test.ts`, and so in a single Vitest worker.

**Decision.** Split the index into one file per milestone:

- `test/scenarios/m0.test.ts` … `m8.test.ts`, each running the scenarios whose `milestone` equals its number, with the same `currentMilestone()` skip rule;
- keep `index.test.ts` only for the "every scenario file exports a scenario whose id matches its file name" check;
- Vitest then runs the milestone files in parallel.

Record the before and after wall time of `npm test` on the same machine in the commit body. Do not change what runs.

## F-09e — Gate report checklist

The M4 and M5 gate reports contain unchecked claims:

- "immigration is M5" (it is T-M7-04);
- the year-one audit described as balance findings (F-04);
- system 11 and 12 timings from a fixture that has no jobs;
- a committed screenshot showing a raw string key.

**Spec amendment** (`docs/05-plan/00-agent-workflow.md` § The milestone gate): append

> Before committing the gate report, check: (1) every screenshot it commits has been looked at and shows no raw string keys or visual errors; (2) every statement about another milestone's tasks matches `PROGRESS.md`; (3) the year-one section reports the `year_one` scenario's output; (4) every performance number names what its fixture exercises, and a system the fixture does not exercise is reported as "not exercised", not as a timing.

## F-09f — The perf fixture that M6 saves

The reference fortress drives 20 dwarves with an external random-walk script (`walkRandomly`), bypassing their brains. It has no jobs, hauling, workshops or needs. `WorkshopOperator.produce` re-evaluates every order of every idle workshop on every tick, and no measurement covers it.

**Spec amendment** (`docs/05-plan/M6-steel-and-blood.md`, T-M6-18 Gate M6, "Produces"): add

> The saved reference fortress (`01-testing-strategy.md` § Performance smoke) is a played fortress, not a scripted one: 20 dwarves on their own brains; at least six workshops with `maintain` orders and their inputs stocked; two stockpiles being hauled to; a farm; the disturbed lake of `fixes/F-03` (`fl_settle`); and a squad. The gate reports the per-system average against each system's allocation in `performance-budget.md`. A system over its allocation is a gate failure.

## F-09g — `dw_needs` tests the spec's drink path

`dw_needs` stocks 70 loose ale on a stockpile tile. The spec's drink source is "alcohol in a barrel in a stockpile", and D-120's "loose alcohol as a last resort" was added so this fixture could pass.

**Change:**

- `dw_needs` spawns four empty `barrel`s of `pine` on the stockpile tile, sets its filter to `drink`, and spawns the 70 ale inside them (`w.spawnItem('drink', 'ale', { containerId: barrel }, n)`, 20, 20, 20 and 10, as `it_containers` does). The expectations are unchanged.
- D-120 has no unit test of its own today. Add one to `test/unit/dwarves/activities.test.ts`: "D-120: loose alcohol is drunk only when no stocked barrel, well or water exists". One thirsty dwarf and a loose `drink` stack: it drinks the loose stack. Then add a barrel of ale on a `drink` stockpile and make it thirsty again: it drinks from the barrel.

## Done

- Each part committed with its test. Suite green. Spec amendments applied verbatim.
- `DECISIONS.md` rows for F-09a (the texts), F-09b (the partial-todo rule) and F-09d (the split).
