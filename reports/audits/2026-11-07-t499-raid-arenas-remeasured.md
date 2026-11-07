# Measurement: the raid arenas on today's rules

**Task:** T-499 · **Date:** 2026-11-07 · **Commit examined:** master `ad591b0f` (with T-483's careless shooters, T-504's raid morale, T-477's ward of 4 and T-498's held shooter stepping aside) · **Kind:** re-measurement; no rule, constant or content value was changed · **Source:** [the T-499 work file](../../docs/work/T-499-raid-arenas-after-held-shot.md), [the careless-shooter arena](2026-11-04-t483-careless-shooter-arena.md), [the held-shot arena](2026-11-04-t483-held-shot-arena.md)

## The answer

- **The arenas filed before raid morale moved a lot; the ones filed after it did not.** The enchantment and draught arenas (run on T-472's and T-474's commits, before the held shot and before morale) lose about half their wins: six Novice soldiers in full iron kit with nothing extra now turn the raid of ten back in **11** of 24 fights, not 20. Every arena filed with T-504's morale in it (ward, Daze, the morale arena, the caster and marksdwarf arenas of T-498) comes back the same, fight for fight, except where T-498's step for a marksdwarf changed its fights.
- **Why the six lose more.** A raid now takes heart from each soldier it fells (18 § Morale) and its archers no longer shoot through their own warriors on every shot, so fewer raiders fall before the squad does. The plain six's figures are now T-477's `open-six` exactly (same seeds, same setup): 4.71 soldiers dead at the end, 5.42 a day later, 6.17 raiders dead.
- **Enchantments still help a little, and some more than before.** Against the plain 11/24: sundering **19**, embers **18**, keen 14, rime 12, fearsome 12; stout helm, mail and greaves **22**. Fearsome no longer makes the squad worse in the open (12 against 11; 3.3 flights a fight). Stout armour remains the best single item: 2,111 blood a fight against 3,107, 3.21 soldiers dead a day later against 5.42.
- **Draughts.** Mending **19**/24 (was 24), quickness **18** (21), stoutness **14** (18), stoutness then quickness 14 (each drinks stoutness; its blood, 3,182, is within a percent of stoutness's 3,206, no longer equal, because the quickness draughts in stock shift entity ids). Mending is still the best draught by wins and blood (2,656); stoutness now wins three fights more than none but loses more blood and soldiers.
- **Combat pace.** Three Novices in full kit against the raid of ten in the open: down **24/24** (21–23 before), the raid losing 2.17 of 11 by the next day. Ambush of four: repelled 24/24, 0.88 dead a day later. Behind the locked gate the raid withdraws 24/24 without a blow.
- **Casters.** Ambush of four, soldiers dead a day later: none 0.88, ember staff **0.71**, frost staff **0.83**, wand of embers **0.67** (0.58, 0.75 and 0.58 in the T-470 arena, before careless shooters and morale). The ember rows equal T-498's after rows field for field.
- **Marksdwarves and wards.** T-498's marksdwarf rows come back equal. In the ward arena only the rows with a marksdwarf moved: one axedwarf and a Proficient marksdwarf beside five Novices now turn the raid back in **35** of 48 (32), a marksdwarf alone in place of the sixth in 11 of 24 (9). Ward 36/48, two more axedwarves 36/48, five alone 3/24, one more 11/24, Daze 44/48: all equal.
- **Raid morale arena.** Equal for every Skilled and Proficient row; three Novices lose the loot in **23** of 24 (22; the trial that timed out now ends looted); six Novices with two Novice marksdwarves repelled 17/24 (16).

No figure misses its model in [balance.md § Combat pace](../../docs/03-content/balance.md#combat-pace): magic and stones still trail steel, a stout set of armour still does about what a ward does, and Novices in the open lose to a raid of ten. No new row is filed.

## What was run

Each probe filed with its arena, unchanged, on master `ad591b0f`, through the real tick loop, the same seeds, 24 trials a row (48 for the ward arena's rows that had 48), each until one side is down or the party ends, then a day with no medic (the morale arena runs to the end of the party, at most six days). Data in `reports/data/2026-11-07-t499-*.jsonl`; summarised by kind with [`2026-11-07-t499-summary.mjs.txt`](../data/2026-11-07-t499-summary.mjs.txt) (the morale arena with [T-504's summary](../data/2026-11-05-t504-arena-summary.mjs.txt)).

| Arena | Probe | Rows | Data |
|---|---|---|---|
| Combat pace, caster, marksdwarf | [careless-shooter probe](../data/2026-11-04-t483-careless-arena.probe.ts.txt) | its ten default rows, `ambush-frost`, `ambush-wand` | `…-t499-careless-arena.jsonl` |
| Combat pace gate | [combat pace tune probe](../data/2026-10-21-combat-pace-tune.probe.ts.txt) | `open-full`, `gate-full`, `ambush-full` | `…-t499-combat-pace-squads.jsonl` |
| Warded squad, Daze | [T-477 balance probe](../data/2026-11-05-t477-balance-arena.probe.ts.txt) | its eleven rows | `…-t499-balance-arena.jsonl` |
| Enchanted squad | [enchant probe](../data/2026-11-02-t472-enchant-arena.probe.ts.txt) | its nine rows | `…-t499-enchant-arena.jsonl` |
| Squad draughts | [draught probe](../data/2026-11-02-t474-draught-arena.probe.ts.txt) | its five rows | `…-t499-draught-arena.jsonl` |
| Squad against a raid, morale | [morale probe](../data/2026-11-05-t504-morale-arena.probe.ts.txt) | its eight rows | `…-t499-morale-arena.jsonl` |

Compared line for line with the filed data, by row and seed: the careless-shooter rows equal T-498's after file 240 of 240; the ward arena 300 of 360 (the 60 that differ are the `-marks` and `-sixmarks` rows and one `ambush-ward` fight); the morale arena 166 of 192 (the `-m2` rows and three `n3` fights); the enchant arena 52 of 216 (the two ambush rows only); the draught arena 4 of 120.

## Enchanted squad, open raid of ten (24 a row)

| Figure, before (`5d1681b4`) → now | plain | ember | keen | sunder | rime | fearsome | stout armour |
|---|---|---|---|---|---|---|---|
| Repelled | 20 → **11** | 21 → **18** | 19 → 14 | 22 → **19** | 21 → **12** | 16 → 12 | 24 → **22** |
| Soldier blood lost a fight | 3,043 → 3,107 | 2,880 → 2,848 | 2,958 → 3,045 | 2,832 → 3,051 | 3,029 → 3,074 | 3,058 → 3,152 | 2,253 → 2,111 |
| Soldiers dead a day later (of 6) | 5.17 → 5.42 | 4.83 → 4.75 | — → 5.33 | — → 5.33 | — → 5.38 | — → 5.54 | 3.54 → 3.21 |
| Raiders dead a day later (of 11) | 9.96 → 7.33 | 10.21 → 9.08 | — → 8.13 | — → 9.67 | — → 7.67 | — → 7.63 | — → 10.42 |

Rime slows 20.2 raiders a fight (21.7); fearsome makes 3.3 flee (3.0) and the soldiers swing 67 times a fight against 79 plain. Ambush of four: soldier blood 342 plain, 176 with embers, equal to before.

## Squad draughts, open raid of ten (24 a row)

| Figure, before (`8e585308`) → now | none | mending | quickness | stoutness | stoutness, quickness |
|---|---|---|---|---|---|
| Repelled | 20 → **11** | 24 → **19** | 21 → **18** | 18 → **14** | 18 → 14 |
| Soldier blood lost a fight | 3,043 → 3,107 | 2,597 → 2,656 | 2,933 → 2,783 | 3,064 → 3,206 | 3,064 → 3,182 |
| Soldiers dead a day later (of 6) | 5.17 → 5.42 | 4.21 → 4.46 | 4.92 → 4.67 | 5.21 → 5.63 | 5.21 → 5.58 |
| Draughts drunk a fight | — | 3.79 → 4.13 | 6 → 6 | 6 → 6 | 6 → 6 (all stoutness) |

## Ward arena, open raid of ten (five Novice soldiers and, in place of a sixth)

| Variant | Repelled | Dead a day later | Change |
|---|---|---|---|
| nobody | 3/24 | 5.00 of 5 | equal |
| one axedwarf | 11/24 | 5.42 of 6 | equal |
| two axedwarves | 36/48 | 5.69 of 7 | equal |
| axedwarf and Proficient marksdwarf | **35/48** | 5.81 of 7 | was 32/48 |
| Proficient marksdwarf | **11/24** | 5.54 of 6 | was 9/24 |
| ward caster (ward 5) | 36/48 | 4.71 of 6 | equal |
| Daze caster, kill order on the captain | 44/48 | 3.27 of 6 | equal |

Ambush of four: dead a day later 0.63 alone, 0.50 with two more, 0.04 warded; one warded fight of 24 now ends `looted` where it ended `repelled`.

## Combat pace and casters

| Figure | `ambush` | `-ember` | `-frost` | `-wand` | `-xbow` | `-xbow2` | `open` | `open-ember` | `open-xbow` | `gate` |
|---|---|---|---|---|---|---|---|---|---|---|
| Outcome (24) | repelled 24 | repelled 24 | repelled 24 | repelled 24 | repelled 24 | repelled 24 | down 24 | down 22 | down 22 | withdrew 24 |
| Soldiers dead a day later (of 3) | 0.88 | 0.71 | 0.83 | 0.67 | 0.54 | 0.88 | 3.00 | 2.96 | 2.96 | 0 |
| Raiders dead a day later | 4.00 | 4.00 | 4.00 | 4.00 | 4.00 | 4.00 | 2.17 | 3.13 | 3.92 | — |
| Shots a fight | — | 5.3 | — | — | 9.1 | 10.4 | — | 10.1 | 12.6 | — |
| Hits on their own side / fights | — | 0 | 0 | 0 | 0 | 8 / 6 | — | 0 | 2 / 2 | — |

Raider archers hit their own party in 18 of 24 open fights (34 hits for 359), as T-483 measured.
