# T-576: the three-year script sees an ambush only once it springs

## What a player knows

18 § Stealth and § Events: every member of an ambush arrives hidden, no `RaidArrived` announces it, and the threats panel lists no party all of whose members are hidden (`visibleThreatParties`). The schedule preview says only from when ambushes are possible. The first a player learns of one is its first sighting, by a dwarf, a trained animal or a trap: `AmbushSprung`, a danger announcement that pauses the game, at the same tick (spotting runs on every member's step, `SPOT_RADIUS` 6 with line of sight, more in candle light). The announcement is not late; the spring and the sighting are one event. So the script now answers an ambush from `AmbushSprung` (the party's saved `ambushSprung`), as it answers a thief only once it is spotted. Before, it raised the alert on the tick the hidden party arrived.

## The probe

`test/perf/t576_ambush_probe.test.ts` replays T-575's 36 saves of peril-4 ambushes (seeds p4-1 to p4-6 at shift 0, each saved the tick its ambush arrived) for four days on this branch's code, and notes each dead dwarf: where it stood when the ambush sprang, how long after the spring it died, of what, and where. Local diagnosis only.

| Code and answer | Sprang | Dwarves dead | Soldiers |
|---|---|---|---|
| Master, answered on arrival | 13 | 13 | 1 |
| Answered on the spring | 36 | 56 | 12 |
| ... and wants and the bedtime wait for a held bandage | 36 | 56 | 12 |
| ... a bandage of `BANDAGE_TICKS` (50) | 36 | 43 | 8 |
| ... and a patient's priority-1 job not held for an absent medic (this change) | 36 | 42 | 7 |
| ... and the script answering on the tick of the announcement, not up to 20 later | 36 | 42 | 10 |
| This change, answered on arrival | 13 | 13 | 1 |

Answered on the spring, 49 of the 56 bled out and 7 were killed outright. Most of the victims were 12 to 25 tiles from the gate when the ambush sprang, 4 to 15 from the nearest Gloam, at work in the woods and fields. Gloam are faster than a dwarf (165 to 180 against 150), and a hit from a party member does not stop a fleeing civilian (10 § Behavior selection), so they ran home wounded and bled out on the stairs and in the halls, 150 to 700 ticks after the spring. A trace of each bleeding dwarf's `stop_bleeding` job showed why the halls did not save them:

- **The bandage took a treatment's time.** `stop_bleeding` worked `TREAT_TICKS` (200 ticks, four hours, skill-scaled); a grievous cut puts a dwarf down in about 300. Ten of the 27 traced to the end died with a medic beside them still working the bandage. It is first aid now: `BANDAGE_TICKS`, 50 (17).
- **A medic went to bed with the cloth in hand.** Under the alert a sheltering medic whose rest crosses its critical mark goes to bed (a critical need wins, 10 step 4), and its non-interruptible bandage stayed claimed for `JOB_HOLD_TICKS` (600) while the patient bled out. Seven of the 27. A patient's job at `PATIENT_SUMMON_PRIORITY` is now given back at once when its worker is seen away (11 § Job steps), and another medic takes it. Making the scheduled sleep and the wants wait for a held priority-1 job changed nothing: every one of these medics was at a critical rest, after a day at work and hours sheltering.
- Answering on the tick of the announcement rather than at the script's next look, up to 20 ticks later, changed nothing: the dwarves near the ambush flee it at once on their own (16 § Fleeing), and the alert reaches the far ones in time either way. It was not kept.

What remains is the ambush itself: dwarves caught far out by faster Gloam. Lighting the gate (T-563's candles add `CANDLE_SPOT_BONUS` 2 to a spotter on a lit tile) would reach only the dwarves near the gate, and the victims were far from it; war dogs, which spot at 10, follow one dwarf each and need a kennel and a trainer the script does not have. Neither was tried.

## Where the dwarves were

At the spring the probe noted every dwarf on an outdoor tile and what it was doing: most were crafting at the surface workshops (0 to 25 tiles from the gate), eating or drinking outdoors, or hauling. That is the exposure an honest answer has to remove, and it is a change to how the fortress works, filed as [T-NEW](../../docs/work/T-NEW-ambush-surface-work.md).

## The sweeps

Rows exactly as the verdict jobs print them (shift, alive at year 1, peril-0 grown, peril-0 with need deaths, living at year 3, dwarf deaths, extinct, need deaths).

| Code | Run | Living | Deaths | Extinct | Need deaths | Verdict |
|---|---|---|---|---|---|---|
| Master `df4d8df2` (before) | 44055026603 | 1038.5 | 104.75 | 0.75 | 1 | pass |
| The bandage and the lifeline alone, the script answering on arrival (`t576-medical-only`) | 44082430807 | 1062 | 98.25 | 0.25 | 0.25 | pass |
| The script answering on the spring alone, on `cfcda8af` (`9dc911cc`) | 44049557903 | 956.5 | 150.75 | 0.75 | 0.25 | blocked |
| This change (`8172471c`) | 44055904735 | 922.5 | 165 | 1.5 | 0.5 | blocked |
| This change, shifts 200 to 350 | 44084201333 | 973.25 | 139.25 | 0.5 | 0 | not judged |

Over the eight shifts this change pools to 947.88 living and 152.13 deaths. The journal's census over shifts 0 to 150: 108 ambushes sprang on master and killed 174 dwarves; 250 sprang and killed 439 with this change (411 with the script's change alone, on the older base). The medical rules are worth some six deaths a sweep on their own and do not hold back what the honest answer costs; answering on the spring costs some 45 to 60 deaths a sweep, about twice T-575's estimate, at both perils (peril 2: 76 to 162 in the census; peril 4: 98 to 277).

The instrument (run 44055916930) passes, pooled | 12.94 | 9.63 | 11 | 153.38 | 9.5 | 0 | 0 | 0 |; `defence_seeds` (run 44055928554) passes, 6.00 raids turned back of 8 and a soldier killed in 6.88; `ci.yml` (run 44055940912) is green, 4,077 tests and e2e 45 passed.
