# T-601: the three-year script fights a sprung ambush with a strong squad

**Task:** T-601 · **Date:** 2026-11-18 · **Code:** `5d7b145a` on branch `t601-script-fights-ambushes` (master `cf7818da` and the change) · **Source:** [the T-601 work file](../../docs/work/T-601-script-fights-ambushes.md), [T-600's ambush arena](../audits/2026-11-18-t600-ambush-arena.md), [T-593's census](2026-11-18-t593-peril4-ambushes.md)

## The change

`test/scenarios/three_years_fortress.ts` weighs its squad against two bars from T-600's arena whenever a sprung ambush is outside:

- **The full squad:** five soldiers in a steel helm, body armour and greaves with a steel weapon and a steel shield, at Proficient (10) in the weapon's skill, and two marksdwarves at Proficient with a crossbow and bolts. It fights an ambush of up to 10.
- **The soldiers alone:** the same five soldiers without the marksdwarves. They fight an ambush of up to 6.
- Both bars need at least two units of cloth in stock for the medics' bandages.

A squad that clears a bar musters at the gatehouse stair until five of its soldiers in steel stand there, as a hunt in metal does. Then only its soldiers in steel and its marksdwarves set out, each sent after every ambush member outdoors, the nearest first. A squad that clears no bar does what it did before: it stands down from an ambush larger than its armed soldiers (T-575) and meets a smaller one at the gate stair. The journal's ambush census (`three_years_ambush`) now notes each ambush's first answer and the squad it found. The sweep's verdict prints the strongest squad each fortress fielded (checked once a day) and the answers.

## The sweep (Measure run 44335803229, all 80 seed jobs passed)

| | Alive at year 1 | Peril-0 grown | Peril-0 with need deaths | Living at year 3 | Dwarf deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| **Pooled** | 19.5 | 7 | 0 | 1087 | 112.5 | 1 | 4.75 |
| Reference | 19.5 | 7 | 0 | 1010.5 | 137 | 1.75 | 6.25 |

**Verdict: pass.** No bound was exceeded. The pooled row is master's (`cf7818da`: 1087 living and 112.5 deaths), as it should be when no fortress clears a bar. The reference does not move.

## How far the fortresses come

**No fortress of the 80 timelines cleared either bar.** No squad had a soldier in steel at Proficient, and none had a marksdwarf.

| Peril | Fortress-timelines | Squad of five armed in metal (iron) | Day it was first so (median, range) | Sprung ambushes by first answer |
|---|---|---|---|---|
| 0 | 28 | 0 | — | none sprang |
| 2 | 28 | 23 | 205 (155 to 324) | 63 met at the gate, 36 stood down |
| 4 | 24 | 17 | 231 (164 to 319) | 143 stood down, 6 fought in the halls (T-596), 2 alongside another threat |

- **Metal.** The strongest squads' soldiers armed in metal wore iron body armour, 219 of 220. One soldier, in `p4-2` at shift 100, wore steel. The forge makes the squad's helms and greaves after its kit, so five soldiers in iron helm, mail shirt and greaves come in year 2 or 3.
- **Skill.** No soldier armed in metal rose above level 0 in its weapon's skill in any timeline, against the bars' 10. The script's squad never trains. It works civilian labors and learns only in fights, and it stands down from almost every peril-4 ambush. T-600's arena fielded the script's squad at Novice, which flatters it.
- **Marksdwarves.** None. The script sells the wagon's crossbow and bolts.

So the bars are three steps away from the script's squad: steel kits, training to Proficient, and two crossbows. That is the follow-up, `docs/work/T-NEW-script-builds-strong-squad.md`. It is not cheap: a training squad does no civilian work, and five steel kits take some 40 bars from a steel stock that reaches year 3 thin. It also has to look at what the arena did not have. Doors on `lock_on_alert` lock behind a squad that has gone out, and the medics reach the wounded outside only once the alert is down.

## Other gates on `5d7b145a`

- `ci.yml` run 44335810199: all six jobs passed; `npm test` 4,179 passed over four shards; e2e: 45 passed.
- The instrument, run 44335819420: pooled median 12.81, worst 9.88, sum 153.38, wildlife-free 9.13 (reference 12.94, 9.63, 151.88, 9.38); verdict pass.
- `defence_seeds`, run 44335825619: a mean of 6.50 of 8 seeds turned every raid back, and a soldier killed on 6.13; verdict pass.
- `defence_year`, run 44335830875: passed.
