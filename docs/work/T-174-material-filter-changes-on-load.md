# T-174 — A work order's material filter is the same after a load

## Progress - 2026-10-09

Parked under the owner's no-long-fixture-tuning rule; no T-174 commit was made. Implementation and regressions are saved in stash `314f28f7bb82508ca0b51db925342e48d1ed0050` (`T-174 parked: canonical material filters; baseline full-year e2e blocker`). All tracked full-year fixture experiments were reverted.

The canonical material-filter implementation passed lint, typecheck, content:check, strings:check, interface:check and docs:check; npm test passed 223 files / 2,037 tests (643.51 s). Focused tests passed 44 tests; the final baseline regression run failed 16 of the 19 new material-filter cases, and the new picker regression also failed before the fix. No goldens moved.

The full e2e suite passed 19 tests and failed the full-year population assertion. The unchanged fixture failed again with the fix, and also failed in a full-suite comparison with the three changed source files restored to HEAD (19 passed / 1 failed); a separate isolated baseline run passed. Thus the failure is not established as caused by T-174. Experiments exceeded the permitted time and did not yield a sufficient minimal correction.

Diagnostic scratch observations at tick 42,000 (day 35): brewing job 198 had full effort and delivered ingredients, but its reserved barrel contained seven items, leaving insufficient room for the recipe output; brewing stopped and thirst reached 100 before deaths around days 46-48. This is a suspected independent reservation problem, not an established T-174 cause or an accepted fix. Do not add farms, capacity, or timing changes to this fixture.

Next: after master lands its T-140 movement change and fixture-tier migration, resume the stash and rerun the original e2e fixture. If the blocker persists, leave T-174 open and pursue the fixture or reservation issue through its owning task.

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) (bug 15) · **Size:** S · **Needs:** — · **Status:** open

## Why

A work order whose `materialFilter` was given as a material id (`'iron'`, which is what the orders panel sends) is loaded as the registry index (`96`). The order behaves the same, and the world hash of the loaded game differs from the unsaved game from that moment. Every played fortress with a forge order is affected: in the three-year runs every load after the forge orders exist differs from the unsaved game by exactly this field. `core_save_roundtrip` and the save round-trip property do not see it, because their orders carry no such filter.

## Reproduction

[`save.probe.ts`](../../reports/data/2026-10-08-bug-hunt-save.probe.ts.txt): `materialFilter "iron": … in play ["iron"]; after a load [96]; hash f5c3f2c09d92b625 -> 4f66efe98cb25c84 (DIFFERENT); a second load equals the first`. A class name (`'metal'`) and an index survive unchanged.

## What to do

**Decision.** The world holds one form. `AddWorkOrder` and `EditWorkOrder` normalise `materialFilter` when the command is applied: a string that is a material id becomes its registry index; any other string must be a material class, else `bad_setting`; `null` stays. The save format does not change (`id-fields.ts` already writes the id and reads the index).

1. Amend 12 § Work orders and `command-catalog.md` (`AddWorkOrder` validation).
2. Implement in `src/systems/workshops/orders.ts`.
3. Tests, `describe('T-174 …')`: the probe as a unit test; add a material-filtered order to `prepareM5GeneratorWorld` so that the round-trip property covers it.

## Done

- The tests pass.
- In the long runs every fork reports "first load equals the unsaved game" (apart from T-131's web flags, if that is still open).
- Goldens: hashes of runs that place a filtered order by id move. Say so in the commit.
