# T-174 — A work order's material filter is the same after a load

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
