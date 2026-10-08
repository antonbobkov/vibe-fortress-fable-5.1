# T-166 — A meal reserved by a dwarf who dies is released

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) (bug 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

A dwarf reserves the meal or drink it walks to (`reservedBy` = the dwarf's id). If the dwarf dies on the way, the unit stays reserved for ever. In the peril-4 long run `easy_meal`, `fine_meal`, `plant_food` and then their `rotten` remains were held this way.

## Reproduction

[`death.probe.ts`](../../reports/data/2026-10-08-bug-hunt-death.probe.ts.txt) and [`death2.probe.ts`](../../reports/data/2026-10-08-bug-hunt-death2.probe.ts.txt): `item.reserved-by-missing-job [drink] … reservedBy=<dead id>, no such job and no such living creature`, 5 ticks after the death and 26 days later.

## What to do

**Decision.** A reservation is held by a living holder. On `CreatureDied`, 10 releases the eater's reservation through `items.release`, with one `ItemReleased`. The cause was not established by the audit: find where 10 reserves for a need errand and release on every way that errand ends (death, unconsciousness, a flight, the item rotting).

1. Amend 13 § Forbid… (`reserved`: "held by a job, or by a dwarf walking to eat or drink it; released when the holder dies or abandons the errand") and 10 § Needs.
2. Tests, `describe('T-166 …')`: a dwarf killed on the way to a meal leaves it available.

## Done

- The tests pass.
- `item.reserved-by-missing-job` is absent from the long runs.
