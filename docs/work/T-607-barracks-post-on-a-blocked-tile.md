# T-607 — A training soldier's barracks post can be a tile nobody can stand on

**Source:** T-603 (the three-year script's strong squad; `test/perf/t603_probe.test.ts` on `three-years-p4-1`) · **Size:** S · **Needs:** — · **Status:** open

## Why

16 § Squads says a squad gathering at its barracks takes the zone's tiles as a station takes its posts: through tiles a walker can stand on. `fixedPost` in `src/systems/combat/squads.ts` gives a training member `barracks.tiles[memberIndex % tiles.length]`, whatever stands there. An archery target has to stand on a barracks tile for the range to work (`stepTraining` looks for it among the barracks' tiles), and it blocks its tile (`passable: false`). A member whose post is the target's tile walks toward it, never stands on a barracks tile, is never "present", and never trains. In T-603's probe one of the two marksdwarves stayed at crossbow 0 for 140 days while the other rose to 5. The script now keeps the target off the zone's first tiles, which works around it; a player cannot see why one soldier never trains.

## What to do

Give a training member (and a squad gathering at its barracks) the zone's tiles that a walker can stand on, in the zone's order, as `stationPosts` does for a station; with none, no post. Spec: 16 § Squads already says it. Test: a barracks whose first tile holds an archery target; every member is present and trains.

## Also

16 § Training says `WARDEN_TRAINING_BONUS_PERCENT` is 10; 10's tuning table (which owns it) says 25. One of the two is wrong; fix the sentence in 16 to name the constant without a value.
