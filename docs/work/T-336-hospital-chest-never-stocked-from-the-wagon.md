# T-336 — A hospital chest built after its zone is never stocked

**Source:** T-330, the hospital player path ([`../../test/scenarios/pp_hospital.scenario.ts`](../../test/scenarios/pp_hospital.scenario.ts)) · **Size:** S · **Needs:** — · **Status:** open

## The fault

An item that no stockpile can take goes to `noHome` (`src/systems/items/hauling.ts:248-252`), and `noHome` is looked at again only when a stockpile's filter, containers, priority, links or tiles change, or when a full stockpile gains space (`hauling.ts:142-145`, `:221-231`; 13 § The "wants hauling" set says the same). Cloth and thread want a bin in a general stockpile, so they wait for one; their other home is a hospital's chest. A player zones the hospital, then places the bed and the chest, and the chest is built a day later, after its carpenter has made it. When the cloth was first looked at the hospital had no chest, so the cloth went to `noHome`. The chest's completion gives the hospital a slot, but it is none of the changes that bring `noHome` back, so the cloth stays in the wagon and the hospital chest stays empty.

## Trace

Seed `pp-hospital`, the compact 48 × 48 forest Serene Vale of `test/scenarios/player-path.ts`, the Balanced embark: a 14 × 8 stockpile set to everything, a carpenter with an order for a chest, and a 5 × 4 hospital zone with a bed and a chest placed in it on day 0.

- Day 1 (tick 1,540): the chest is built (item 50331698).
- Days 2 to 28: the wagon's cloth (item 16777273, 5 units) is still in the wagon, in `noHome`, not in the wants set. `bestFor` for it returns the hospital chest's slot every day; no haul job is ever made. The chest is empty, so a wounded dwarf would be treated from nothing.

With a 6 × 4 stockpile the same run fills the stockpile; on day 13 a slot frees, `noHome` is looked at again, and the cloth goes to the chest. That is the only way it got there.

## Decision

A built container that gives a stockpile or hospital a slot (a hospital's chest finished, a container hauled in) brings `noHome` back to the wants set, as a filter change does. Spec: add the case to 13 § The "wants hauling" set ("re-examined when any stockpile filter changes, a stockpile is created, or a stockpile gains a slot").

## Done

- `pp_hospital` passes and its `todo` is removed; a unit test in which the chest is built after the cloth was first looked at, named T-336, fails without the change.
