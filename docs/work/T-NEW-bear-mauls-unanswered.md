# T-NEW — The three-year script leaves a bear by the fortress until it mauls

**Source:** [T-543](T-543-sweep-deaths-drift.md) ([the report](../../reports/audits/2026-11-10-t543-sweep-deaths-drift.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

Since T-538 a struck bear fights instead of fleeing, and since T-540 a dwarf passing a sleeping bear may wake it. The sweep's bear kills went from 1.5 a sweep to 8.25 (eight shifts of master before and after). The script raises the alert for a bear only near the gate, and since T-539 it hunts no aggressive animal. So a bear stays near the fortress until it leaves the map.

On master `6e6a6ec3`, a probe (run 42903590270, 24 timelines) found 17 bear deaths:

- Twelve followed the bear's first blow with no alert up.
- Nine of those twelve died within 300 ticks of it.
- Some bears kill again on later days: `three-years-p4-4` at shift 0 lost two dwarves to one bear on days 126 and 128, and in the sweep (run 42872065870) `three-years-p2-7` at shift 100 lost five to one bear between days 250 and 268.

Answering the maul is too late for its victim. What a player would do is deal with the bear before it mauls.

## What to do

1. Try a player's answer to a bear seen near where dwarves work: hunt it with the mustered squad (T-539's muster, all three armed members together), or keep workers out of its reach with a burrow or traffic rule if the game has one.
2. Measure each answer with the probe on `t543-probe` and with the pooled sweep. Keep an answer only if the sweep's deaths fall and no other figure worsens past its bound.
3. Do not make bears weaker.

## Done

- The script's answer to a bear is chosen on the sweep's evidence, written in testing-strategy.md's paragraph on the three-year script, and pinned with a unit test. Or a note says why sheltering stays best.
