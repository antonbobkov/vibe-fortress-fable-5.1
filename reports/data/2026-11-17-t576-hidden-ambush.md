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

## The sweep

(Figures below.)
