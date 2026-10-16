# T-338 — CreatureDied fires twice for a dead pasture animal

**Closed:** 2026-10-16.

> **Closed as not reproduced (orchestrator, 2026-10-16).** The simulation agent ran pp_pasture without the T-335 fix and a unit starvation test: exactly one CreatureDied per starved grazer (6 for 6). Reopen as a new task with a trace if it is seen again.

**Source:** T-330, seen in the pasture player path ([`../../test/scenarios/pp_pasture.scenario.ts`](../../../test/scenarios/pp_pasture.scenario.ts)), not traced · **Size:** S · **Needs:** — · **Status:** open (diagnosis first)

## Why

While T-330 ran `pp_pasture` with its `todo` removed, every tame grazer that starved produced two `CreatureDied` events. Every subscriber (announcements, grief, health, the kill record) may then act twice.

## What to do

- Reproduce with a unit test: one tame grazer starves; count `CreatureDied` events for it. Find the two emitters or the double path (file:line).
- Fix so that a creature dies once; if other death causes (bleeding, hunger, combat) share the path, cover them in the test.
- Gates as for any simulation change, including the annual instrument.

## Done

- One `CreatureDied` per death, pinned by the test; the cause is in the commit body.
