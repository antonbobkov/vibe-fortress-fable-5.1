# T-675 — The wagon's animals graze and wander on arrival

**Closed:** 2026-11-21, in a8f37ed9,ae09d005,d9ed5862,7c8df2b8.

**Source:** the owner's feedback of 2026-11-21 · **Size:** S · **Needs:** — · **Status:** open

## Why

On arrival the chickens, horses and cats stand still by the wagon, where they should graze and explore.

## What to do

Find why tame animals stand still on arrival (no pasture yet, a leash to the wagon, idle behaviour with no target) and give unpastured tame animals an idle wander and grazing near the wagon or the fortress (08 § Tame behavior), without them wandering into danger or off the map. Spec it in 08.

## Done

- [x] A test where the embark animals move and graze in the first day: `test/unit/animals/t675-arrival-wander.test.ts` (Balanced, Farmstead and the Testing preset: every animal but a war dog walks about the wagon, within its ground and off the map's edge, every cow, sheep and goat stands on grass; an amble keeps clear of a hostile it sees). The cause: with no hearth hall the idle anchor fell back to the wagon tile, which 08 read from 10's reader, where no `wagonTile` was; the anchor was -1 and the animals stood where the arrival put them. Spec: 08 § Tame behavior, *Before the hall*.
- [x] The sweep's verdict: run `44975306609` on `ae09d005`, all 80 seeds green, Pooled 20 | 7 | 0 | 1189 | 97.75 | 0 | 0, **Verdict: pass** (master after T-676: 1116.25 living, 112.5 deaths). pp_forge's drift is two tiles wide: its six stones were one short whenever the smelter was built of raw stone first, a race the ambling animals moved. Follow-up: [T-NEW animals after the hall](../../work/T-683-animals-after-the-hall.md).
