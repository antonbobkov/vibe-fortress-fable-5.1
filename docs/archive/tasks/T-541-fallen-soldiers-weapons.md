# T-541: A fallen soldier's spear is not picked up again for weeks

**Closed:** 2026-11-10, in 5851bd64,b9ce135e.

**Source:** [T-539](T-539-wolves-hold-the-hearth-alert.md) ([the report](../../../reports/audits/2026-11-10-t539-wolves-and-the-hearth-alert.md)) · **Size:** S · **Needs:** — · **Status:** done

## Why

On `three-years-p2-6` at shift 150 (T-538's script), three soldiers died to wolves between day 28 and day 36. The recruit who replaced them had no weapon until at least day 76. Their spears lay where they fell, on the surface. The squad counted as unarmed for 40 days and hunted nothing, while the wolves stayed.

## What to do

Find out why: were the spears never hauled to a stockpile because of the alerts, or did 16's re-equip check (`REEQUIP_CHECK_DAYS`) never find them? Then decide whether a rule or the script should change: a player would have the gear brought in and the recruit armed.

## Done

- The cause is named, and fixed with a test if it is a rule; or a note says why the wait is right.

## Outcome

The cause was a rule. A dead dwarf's kit stayed on its corpse until a coffin took it or the body rotted: a dwarf's corpse is never stripped, and the three-year script builds no coffin. The spears were never on the ground, so no hauling or re-equip check could reach them. On `three-years-p2-6` at shift 150 the spear was still on its corpse 30 days after the death, and the recruit had none. Giving dwarf corpses a `strip_corpse` job did not help: the job stayed open for weeks behind the fortress's other work. A player would see the same fault.

Now a dwarf falls out of its kit (13 § Forbid, dump, melt, claim): everything it carried that is not clothing drops on its tile, unowned, and the squad's next look claims it. The corpse keeps its clothing for burial. On the same seed and shift the recruit had the spear the next day. Sweep run 42856498520 passes (pooled 20/7/0.25/922/154.25, against T-539's 19.75/7/0.25/936.75/150.75). One seed job failed a witness: p2-5 at shift 150 had no gate walls, with 5 living, against 7 before. The timeline is the same until the first death on day 58, and differs after it. Instrument run 42856504115 passes (12.56/6.25/8.75/143.88/7.25). CI run 42856510341 passes ([the deaths by killer](../../../reports/data/2026-11-10-t541-deaths-by-killer.txt)).
