# T-648 — A workshop order is runnable on goods out of reach

**Source:** [T-642's measurement](../../reports/data/2026-11-19-t642-iron-for-steel.md) (`three-years-p4-6` at shift 50) · **Size:** M · **Needs:** — · **Status:** open

## Why

A work order is runnable when every input filter matches enough available items (12 § Operation, 13 `countAvailable`), wherever they lie. In `three-years-p4-6` at shift 50, 16 charcoal lay on the surface stockpile from day 140 on, out of reach from the workshop hall below whenever the gate was locked, while no other fuel stood below. The smelter's first order, the steel alloy, counted that charcoal as fuel, so it was always runnable: its job was created, found no fuel within reach and waited `blocked: missing_input`, holding the smelter (at each fortnightly look from day 168 to 210, and from 280 to 308, in one run), while the coal ore its next order would have smelted without fuel lay within reach. The three-year script now orders the coal first when the fuel under a roof is short (T-642), but a player's workshop would stall the same way.

## What to do

Decide in 12 how a workshop treats an order whose inputs exist but none within reach of its worker: skip it for the next runnable order (as a workshop skips an order whose inputs are missing), and look at it again after a while, or keep the blocked job and say why in the workshop panel. Measure the choice on the three-year sweep and the job-wait probes.

Spec: 12 § Operation, 11 § Blocking and retry, 13 § Searching.

## Done

A scenario with an order's inputs on the far side of a locked door: the workshop works its next order meanwhile and the first once the door opens; the sweep's verdict.

- [x] **The rule** (12 § Operation 1–3): before a workshop starts an order that is runnable by the counts, it searches for the inputs from its work tile as the claim will (`findItems`, a walker). If an input does not reach, the workshop skips the order for its next runnable one and remembers the recipe and the item types out of reach (`Workshop.outOfReach`, saved) for `OUT_OF_REACH_RETRY_TICKS` (100, as the board's blocked retry). A `BuildingStateChanged` (a door, hatch or bridge) makes it forget them all. A current job blocked `missing_input` whose order is still runnable is looked at every `ORDER_AHEAD_TICKS` and let go (`out_of_reach`) when its inputs are out of reach. An idle workshop reports `WorkshopBlocked { out_of_reach, input }`. The Orders row reads "charcoal out of reach", the Workshop panel "Skipped: charcoal out of reach. Tried again later, or when a door opens.", and Add order "· charcoal out of reach". Spec also: 11 § Blocking and retry, 13 § Searching, the components schema, the event catalog, panels.md.
- [x] **Scenario** `ws_out_of_reach` (acceptance-tests.md § 12): the steel's charcoal is in a pen behind a locked door. The smelter smelts the lignite instead, says "out of reach", is still skipping after the retry, and starts the steel the tick after the door opens. `test/unit/workshops/t648-order-out-of-reach.test.ts`: a door locked after the job was made (`JobCancelled { out_of_reach }`), the panels' words, and the memory through save/load and its renewal.
- [x] **Sweep** (measure.yml run 44680250921 on `04f44dd0`): Pooled 19.75 | 7 | 0 | 1019.25 | 117.75 | 1 | 11.5; **Verdict: pass**. 80 of 81 jobs passed. Seed p2-7 at shift 0 failed `dwarf.frozen-2d`: a soldier with a training sword and a badger could do each other no harm (T-647's cause, recorded there), not this rule. An earlier try with a 600-tick retry (run 44671575568 on `d88ddc6f`, every job green) gave Pooled 19.5 | 7 | 0 | 1006.75 | 133.5 | 1 | 5.25, also a pass. The probe showed the mason in `three-years-p4-2` (shift 150) skipping its stone orders for 600 ticks in the first week, where a blocked job had retried every 100, so the retry is now 100.
- [x] **Probe** (`t642_iron_probe`, `[t648skips]`), `three-years-p4-6` at shift 50, days 126–336: 30 steel bars smelted, against T-642's 25. The smelter skipped one order, a lignite smelt whose ore was out of reach, for 600 ticks, and never its alloy, since T-642's script now orders the coal first.
