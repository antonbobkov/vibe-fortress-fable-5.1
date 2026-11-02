# T-485 — A fearsome axe makes a squad worse in the open

**Closed:** 2026-11-02, in HEAD.

**Source:** [enchant arena](../../../reports/audits/2026-11-02-t472-enchant-arena.md) (T-472) · **Size:** S · **Needs:** — · **Status:** open

## What was found

Six Novice soldiers in full iron kit hold a peril-2 raid of ten in the open in 20 of 24 fights with plain axes and in 16 of 24 with fearsome axes. A fearsome hit sends a raider running (25 § Enchantments in combat, `flee`) about 3 times a fight, and the squad swings 61 times a fight against 75, deals 282 damage against 346, and kills 7.8 raiders against 9.1. Every other common weapon enchantment helps the squad a little. Dread puts the same `flee` effect on up to four raiders, so a dread caster may cost a squad in the same way; that was not measured.

## What to do

1. Find where the swings go: follow one fearsome fight (`t366-squad-open-<i>` with the T-472 probe, `reports/data/2026-11-02-t472-enchant-arena.probe.ts.txt`) and record what a soldier does while its target is under a `flee` effect (chasing it 12 tiles, standing, retargeting).
2. Decide the rule in 16 § Targeting: the most conservative fix that keeps the effect's meaning (a frightened raider is out of the fight for a while), for example a soldier on duty drops a target under a `flee` effect for the nearest other hostile, as it does for one that leaves perception.
3. Re-run the fearsome and plain arenas and a dread caster arena; write a new dated report and update the "Enchanted squad" row of `docs/balance-status.md`.

## Done

- The cause is named in the report, with the fight followed.
- A fearsome squad does no worse than a plain one in the open arena, or the spec says why it should.

## Closed by decision (2026-11-02)

The owner: "That seems like a fun game mechanic, keep it. Not all the enchantments have to be a strict improvement." No rule change. 25 records the trade-off, and the look line now ends "A fleeing foe is hard to catch."
