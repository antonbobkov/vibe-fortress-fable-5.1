# T-506: a sally in `defence_year`, measured and withdrawn

**Task:** T-506 · **Date:** 2026-11-10 · **Branch:** `t506-squad-sally` on master `afb92c48` (T-542) · **Kind:** a script change measured on GitHub, then withdrawn; the measurement columns stay · **Source:** [the T-506 work file](../../docs/archive/tasks/T-506-defence-year-squad-sally.md), [T-504](2026-11-05-t504-raid-morale.md), [T-522](2026-11-07-t522-defence-repel-rate.md)

## The answer

- **The halls are no longer at risk; that part of the problem is gone.** T-504's sally let raids down the gate stair into the halls. Since T-518, a second line stands at the gate stair's foot: four doors, locked under the alert. It stood at the raid on 50 of 64 timelines. Behind it, the north door is only the corridor's end.
- **A sally still has nothing to win, so `defence_year` keeps none.** On most timelines the cage takes the raid's captain on its first steps into the corridor. Morale falls to 48, and the raid breaks (18 § Morale) as soon as it is out of a fight. Its members are still 15 to 32 tiles out and leave the map within the next look. A squad that meets it at 48 keeps it in a fight, so it does not break: it takes heart from each dwarf it fells and loots. Where no trap takes the captain, the raid is steady and kills the soldiers who meet it in the corridor.
- **The work file's "Done" is the second branch:** this report on why a fought defence cannot be had cheaply. The script is master's again, and its comment says why. The seed rows now also record the dwarves each raid killed and whether the second line stood.

## What was run

`measure.yml` suite `defence_seeds` on GitHub: the eight seeds at eight cadences, with the verdict job.

| Run | Commit | Script | Turned back, mean | Raider died, seeds a cadence | Dwarves killed by raids, a cadence | Data |
|---|---|---|---|---|---|---|
| 42903534926 | `bbd3be6a` | master's (no sally on a raid) | **6.50** (pass) | 0.25 | **1.25** | [verdict](../data/2026-11-10-t506-defence-seeds-baseline.md), [rows](../data/2026-11-10-t506-defence-seeds-baseline.jsonl) |
| 42907117894 | `bbfcb19b` | sally on a wavering raid in the corridor or a broken one near the gate, line standing, squad mustered | **6.38** (pass) | 0.38 | **1.63** | [verdict](../data/2026-11-10-t506-defence-seeds-sally.md), [rows](../data/2026-11-10-t506-defence-seeds-sally.jsonl) |
| 42903528990 (cancelled) | `e3738789` | sally on any raid in the corridor, line standing, squad mustered | 9 rows only | | | [rows](../data/2026-11-10-t506-defence-seeds-first-sally.jsonl) |

`ci.yml` run 42907122738 on `bbfcb19b`: all six jobs pass (3,725 tests in four shards, e2e 42). The final commit has master's script and the new columns, and has its own runs (below).

## The two sallies

**On any raid in the corridor** (the plainest sally, now behind the line). On `defence-year-6` at cadence 25 no trap was built. The squad met the whole raid of nine in the corridor: **4 soldiers** were killed and 3 raiders died, and the raid looted. Without the sally the same timeline loses nobody, and the raid loots and leaves. This design was stopped after 9 rows.

**On a wavering or broken raid only.** It went out on 8 of 64 timelines:

- **Broken (`retreat`), 3 timelines** (`-6` at 25 and 30, `-7` at 30): nothing was caught. The raid was off the map before the squad came out, and the endings and deaths were the same as without the sally.
- **Wavering, 5 timelines:**
  - On 4 of them the endings and the deaths were the baseline's.
  - On `defence-year-8` at 20 it made things worse. The cage took the captain (48, wavering), and the squad came out while the raid was still in the corridor. The raid stayed in a fight, killed **3 soldiers and another dwarf**, lost one member and **looted**. Without the sally it broke at the cage, ended `repelled`, and killed one dwarf.

Over the 64 timelines the sally killed 6 raiders against 5 without it, and the raids killed 13 dwarves against 10 (soldiers: 7 against 4). The set rule's mean fell from 6.50 to 6.38, within the noise. Where the sally did not go out, the rows match the baseline exactly.

## Why the cage leaves no fight

- **Arrival.** On `defence-year-2` at cadence 20 the raid of ten and its captain comes in a file. Its captain is 5 tiles from the north door; the others are 15 to 32 tiles behind, near the map's edge.
- **The break.** The cage takes the captain. The raid's `RaidEnded repelled` follows in the same look, and at the next look (20 ticks later) no member is on the map.
- **The rule that decides it.** A leaderless raid below 50 breaks out of a fight (18 § Morale). Fighting it keeps it in. So the squad can win nothing between the cage and the break, and it can lose the break.

## What is left

- **A fought defence where it pays.** A squad wins in the open against a peril-2 raid at Skilled in iron (T-504's arena), not at the gate after the cage. The only untried option of the work file, marksdwarves holding the corridor from behind the fortifications, needs a gallery the fortress can reach from inside. As laid out, the fortifications face the open (`cx + 8`). Whether shots from behind cover keep a raid in a fight is the same rule as above. Not filed: no case here shows it would turn a raid the cage does not.
- **Timelines that still lose** (`looted` on about 1.5 of 8): the captain is caged after other members picked up loot on the surface, or no trap was built (`trapTriggers` 0 to 3). T-522 and T-527 cover these.

## Fun

- **Don't poke a leaderless raid.** Once the captain is in the cage, the raid is wavering and on its way home. Send the squad out and it remembers it is in a fight: it fells three soldiers, takes heart and loots the stockpile it was about to leave.
