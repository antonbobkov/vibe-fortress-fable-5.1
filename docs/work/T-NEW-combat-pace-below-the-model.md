# T-NEW — Combat pace is far below the balance model

**Source:** T-366, [the combat-pace measurement](../../reports/audits/2026-10-21-combat-pace.md) · **Size:** L · **Needs:** — · **Status:** open

## Why

`balance.md` § Combat pace states the design's intended pace: a Novice dwarf in iron mail with an axe and a shield beats two unarmoured copper-sword goblins with a hospital visit, and a squad of three in mail meets a raid of ten at peril 2. Measured at `a5cd51c`:

- The mailed dwarf is down in 48 of 60 duels. A mail shirt covers the torso and arms; 41% of hits land on the bare head and legs as serious cuts (bleed 3 a health tick until bandaged), and two of them take a dwarf below 40% blood within about 300 ticks.
- With a helm and greaves it wins 32 of 60: every wound is light, but the fight lasts 380 ticks (its kills come by bleeding, at the 9.5th and 16.6th swing, because its hits are spread over six parts) and eight light cuts, each bleeding until `CLOT_TICKS`, take a median 328 blood.
- A squad of three loses to the content raid of ten (skill 6, captain 10) in 21 to 24 of 24 trials in every variant: full kit, skill 6, raiders at half the skill per tier. A locked gate turns the raid away in 24 of 24.

In the three-year fortress the consequence is that every party of the peril-2 and peril-4 sweeps ends `withdrew` or `looted`, none `repelled`: the fortress survives behind its gate and its squad never repels a party.

## Decisions

1. **The model's intent stands; the game moves.** The target is the duel with a full iron kit (helm, mail shirt, greaves, axe, shield) at Novice skill against two unarmoured copper-sword goblins at skill 2: the dwarf wins at least 48 of 60 and is conscious at the end of at least 40 of 60. The squad target is restated, not tuned: three soldiers do not meet eleven raiders in the open, and `balance.md` already says the gate does; the tune is judged on the duel and on whether a squad of three in full kit beats an ambush of four at peril 2 (the size the sweeps measured) in most trials.
2. **The lever is the light wound's bleeding over a long fight, tried first, because it is what downs the full-kit dwarf**: light cuts bleed 1 a health tick for `CLOT_TICKS` (300). Try, in this order, stopping at the first that meets decision 1: a light cut bleeding for half as long (`CLOT_TICKS` 150); then a light cut that does not bleed while armour reduced the hit (content wound table, edge and pierce through mail or plate). `CLOT_TICKS` was set with the wild animals of October: whichever change is taken re-runs the annual wildlife instrument, and its guarded figures must hold.
3. **The kit is the player's lever, and the model says so.** The balance model's soldier wears helm and greaves; `balance.md` § Combat pace states that a mail shirt alone leaves the head and legs bare. This is a spec edit of the tune task, with the remeasured figures.
4. Hit location, the melee formulas, the raid party sizes and `HOSTILE_SKILL_PER_TIER` do not move in this task: halving the raiders' skill changed nothing measurable.

## Done

- The duel arena of the measurement (`reports/data/2026-10-21-combat-pace.probe.ts.txt`, `duel2full` and a four-raider ambush against a squad of three in full kit) meets decision 1, with before and after rows in a new dated report; the annual wildlife instrument passes its guards; `balance.md` § Combat pace and `balance-status.md` carry the new figures.
