# Measurement: an enchanted squad in the combat-pace arena, and unenchanted combat unchanged

**Task:** T-472 · **Date:** 2026-11-02 · **Commit examined:** master `5d1681b4` with the T-472 branch on it · **Kind:** measurement; no constant, formula or content value was changed by it · **Source:** [the T-472 work file](../../docs/work/T-472-runecraft-enchants-in-combat.md), [the T-473 ward arena](2026-11-02-t473-ward-arena.md)

## The answer

- **A common enchantment helps a squad a little; steel still decides.** Against a peril-2 raid of ten in the open, six Novice soldiers in full iron kit hold in **20 of 24** fights and lose **3,043** blood a fight between them (the dead at their whole 612). With every axe of embers they hold in 21 and lose **2,880**; keen axes 19 and 2,958; sundering axes **22** and **2,832**; axes of rime 21 and 3,029. Stout helms, mail and greaves do the most: **24 of 24**, **2,253** blood, 3.54 of 6 soldiers dead a day later against 5.17. That is about what a ward does for five soldiers and a caster (24 of 24, 2,156, [ward arena](2026-11-02-t473-ward-arena.md)).
- **What each enchantment does a fight.** An axe of embers lands its ember on every hit that wounds, **5.0** a hit through the raiders' leather and mail (8 at the common tier), so the squad deals 486 a fight against 346. A keen axe does **18.2** a hit against 16.1, a sundering one **18.7**. Rime slows a raider **21.7** times a fight. Stout armour cuts a raider's hit on a soldier from **4.6** to **3.3**.
- **Fearsome axes make the squad worse in the open.** A raider is sent running on **3.0** hits a fight (a quarter of the hits, three quarters of those not resisted); the squad holds in **16 of 24** fights, deals 282 a fight, and swings 61 times against 75. The soldiers swing a fifth less while raiders run and come back; the run does not say where the time goes. Recorded, not changed: the rule is the design's, and the raid's retreat count does not move.
- **Against the peril-2 ambush of four** every squad holds in 24 of 24; axes of embers cut the soldiers' blood loss from **342** to **176** and the dead a day later from 0.54 to 0.33.
- **Unenchanted combat is unchanged, draw for draw.** `pp_defence` on its seed gives a record equal in every field to the T-470 one (`2026-11-02-t470-pp-defence-after.json`): end tick 30,440, the same 22 combat events byte for byte, 11,724 events in all, and the same state in all 21 rng streams. The six arena digests pinned in `t470-no-channel-equivalence.test.ts` still match. And the `-plain` arena below gives the T-473 `open-six` figures exactly (20 repelled, 4 squads down, 3,043 blood, 5.17 dead, 9.08 raiders dead, 106.6 raider hits for 494).

## What was run

`reports/data/2026-11-02-t472-enchant-arena.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test): the squad arenas of [the T-470 caster arena](2026-11-02-t470-caster-arena.md) and [the T-473 ward arena](2026-11-02-t473-ward-arena.md), on the same seeds (`t366-squad-<arena>-<i>`), through the real tick loop. Each trial runs until one side is down or the party leaves (at most 4,800 ticks), then a day with no medic. One heavy run at a time, nothing else running on the machine. Data: `…-t472-enchant-arena.jsonl`.

| Arena | Trials | Set-up |
|---|---:|---|
| `open-plain` | 24 | six Novice soldiers (axe, shield, dodge, armour use 2) in an iron helm, mail shirt and greaves with an iron axe and shield, at a station; three civilians eight tiles behind; a peril-2 raid of ten by `arriveParty` and 18's spawns. The T-473 `open-six` arena |
| `open-ember`, `-keen`, `-rime`, `-fearsome`, `-sunder` | 24 each | the same, every axe of that enchantment at the common tier |
| `open-stout` | 24 | plain axes; helm, mail shirt and greaves stout (+2 armour each) |
| `ambush-plain`, `ambush-ember` | 24 each | the same squads against a peril-2 ambush of four |

| Figure | plain | ember | keen | rime | fearsome | sunder | stout | ambush plain | ambush ember |
|---|---|---|---|---|---|---|---|---|---|
| Outcome (repelled / squad down) | 20 / 4 | 21 / 3 | 19 / 5 | 21 / 3 | 16 / 8 | 22 / 2 | 24 / 0 | 24 / 0 | 24 / 0 |
| Blood lost by the six (the dead at 612) | 3,043 | 2,880 | 2,958 | 3,029 | 3,058 | 2,832 | 2,253 | 342 | 176 |
| Soldiers dead a day later (of 6) | 5.17 | 4.83 | 5.00 | 5.08 | 5.25 | 4.63 | 3.54 | 0.54 | 0.33 |
| Raiders dead (of 11 or 4) | 9.08 | 9.67 | 9.08 | 9.38 | 7.79 | 9.46 | 11.00 | 4.00 | 4.00 |
| Soldier swings / hits, a fight | 74.5 / 21.5 | 70.2 / 23.2 | 72.0 / 22.0 | 75.2 / 22.2 | 61.3 / 17.5 | 72.0 / 21.4 | 83.6 / 25.3 | 24.7 / 13.0 | 17.8 / 9.7 |
| Damage a soldier's hit | 16.1 | 15.9 + 5.0 ember | 18.2 | 16.3 | 16.1 | 18.7 | 16.2 | 20.9 | 20.8 + 7.5 ember |
| Damage to raiders, a fight | 346 | 486 | 401 | 361 | 282 | 400 | 411 | 271 | 275 |
| Slows / flights put on raiders, a fight | — | — | — | 21.7 / — | — / 3.0 | — | — | — | — |
| Raider hits on soldiers / damage, a fight | 106.6 / 494 | 91.0 / 438 | 99.3 / 469 | 105.4 / 493 | 103.6 / 484 | 92.5 / 427 | 103.9 / 338 | 8.5 / 25 | 4.2 / 12 |
| Civilians dead a day later (of 3) | 1.17 | 0.79 | 1.21 | 1.17 | 1.42 | 0.67 | 0.17 | 1.50 | 2.58 |

The ember's 8 meets leather (0.6) and mail (0.4) on most raiders, so 5.0 gets through a hit on average; in the ambush, where more hits land on bare parts, 7.5. Civilians die more often in the ambush with ember axes (2.58 against 1.50 of 3); the squad's soldiers lose less, and the run does not say why the ambushers reached the civilians more often.

### Unenchanted combat

`pp_defence` was run by the T-470 probe (copied as `reports/data/2026-11-02-t472-pp-defence.probe.ts.txt`, writing `…-t472-pp-defence.json`) and compared with `…-t470-pp-defence-after.json`: equal as JSON. Every seam reads `Item.enchant` first: `to_hit`, `damage_percent`, `armor_percent` and `armor` add 0 or are not applied, `throughEnchantedArmor` returns the damage unchanged without an enchanted covering piece, and `applyEnchantOnHit`, the only code that draws (`flee`, on stream 25), is not reached without an enchanted weapon or ammunition.

## What this does not measure

- Enchanted ammunition, `sure`, `blaze`, `adamant`, `emberward`, `rimeward` and `glowing` in a squad fight: their rules are pinned by tests (`test/unit/runecraft/t472-enchants-in-combat.test.ts`), not measured for balance. The Gloam raid strikes with steel, so the fire and frost wards have nothing to stop here.
- Masterwork settings: every enchantment above is at the common tier.
- An enchanted squad against the trollkin or the wyrm, or behind a fortification.
