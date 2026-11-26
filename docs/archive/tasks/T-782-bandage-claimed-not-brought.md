# T-782 — A medic claims a bleeding dwarf's bandage and has not started it three hours later

**Closed:** 2026-11-26, in 0466bad7.

**Source:** T-778 (its work file, § Measured) · **Size:** S · **Needs:** — · **Status:** open

## Why

With the wagon's linen kept for wounds (12 § Cloth kept for dressings), T-763's probe on `probe-3` (busy, shift 331) still lost a dwarf to a snow leopard's bites on day 5, with five cloth in the wagon. The `stop_bleeding` job was made at hour 105 and claimed the same hour by a medic; it was neither started nor done when the dwarf fell unconscious at hour 108 and bled out, and it was cancelled `target_gone`. A first bandage that takes three hours to come decides a serious cut (17 § Patients and hospitals: `stop_bleeding` is the first aid), so where those hours went matters: fetching the cloth from the wagon, a walk round the leopard, the medic fleeing it, or the medic held by another need.

## What to do

Reproduce with the probe and trace the medic's hours 105–108 (its activity, path, carried item, the job's state and blocked reasons):

```
T763_PROBE=1 T763_DAMAGE=1 T763_SEEDS=probe-3 T763_VARIANTS=busy T763_SHIFTS=331 T763_DAYS=6 npx vitest run -c vitest.perf.config.ts test/perf/t763_first_week_probe.test.ts
```

Decide from what it shows whether it is a fault (a claim held while the medic does something else, a fetch that cannot finish) or the danger of the place (the leopard still there), and fix or record it. A test if the rule changes.

## Measured

The probe now traces the bandage and carry jobs (`T763_TRACE=2`: their events and the medic's distance at the claim; `T763_TRACE=1`: also each tenth of an hour the job's state, the patient's and the medic's tiles and doings, the bleeding wounds, and every blow). On `probe-3` busy +331, hours 105–109 (50 ticks an hour):

| Tick | The patient (88,24, on the surface) | The medic |
|---|---|---|
| 5289 | A snow leopard's first bite: one serious cut. The dwarf, caught (the leopard runs 240 to its 150), fights back where it stands (`idle`/Fighting) | Working at 52,6 |
| 5290 | `stop_bleeding` made and claimed at once (priority 1 calls the nearest medic off its work) | 36 tiles away (Chebyshev); the wagon's linen is reserved |
| 5290–5370 | Still fighting: a new cut every 12 to 14 ticks (once 38), blood 567 → 463 | Walks 10 tiles west to the wagon on snow (about 8 ticks a tile), takes the cloth at 43,2 |
| 5370–5472 | Still fighting: about a dozen cuts in all, one of them grievous; unconscious off and on from 5415, blood → 0 | Walks back east with the cloth, 11 tiles on, about 34 to go: some five hours more |
| 5472 | Bleeds out; the job is cancelled `target_gone` | Drops it at 54,5 |

So the three hours were two walks, not a hold: the job was `fetching` from the claim, the medic never left it for a need, never fled, never stood. The dressing was ten tiles one way and the patient thirty-six the other, at a snow walker's pace, and the patient was still in the leopard's fight the whole time, so a bandage at hour 106 would have stopped one cut of twelve.

Over sixteen busy timelines of eight days (`probe-5`, `probe-3`, `probe-1`, `probe-14`, shifts 0, 17, 331, 613) this is the only `stop_bleeding` made: no other dwarf was cut deeply enough to need one.

## Decision

**The danger of the place; no rule changes.** The medic did what 17 asks of it, at once and without a pause. The only ways to make this bandage come in time would be to let first aid skip the dressing (17 says there is none without one), to make the medic walk faster than a dwarf, or to send the bleeding dwarf to the dressing while a leopard holds it; none of those is a fault's fix. 17 § Patients and hospitals now says that nothing hurries first aid: the medic fetches the dressing and walks at its own pace, through snow as slowly as anyone, and a dwarf still fighting what cut it bleeds from each new wound while the medic comes. No test, since no rule moved; the probe's trace is kept for the next such question.

Logged as a fun trade-off (docs/fun-features.md): the lone duel with the snow leopard far out on the snow, the medic halfway there with the wagon's linen.

## Done

- [x] The medic's three hours explained in this file. (§ Measured: the walk to the wagon for the cloth, then the walk toward a patient 36 tiles out on snow, while a snow leopard kept cutting it.)
- [x] A fix with a test, or the reason none is needed, in 17 or 11. (17 § Patients and hospitals: nothing hurries first aid.)
