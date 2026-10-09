# T-185 — A thief that finds nothing to steal leaves empty-handed

**Source:** T-115 and its report, [`../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../reports/audits/2026-10-09-bug-hunt-spec-reading.md) (bug 21, G12, G13) · **Size:** S · **Needs:** T-169 · **Status:** open

## Why

Two faults of the thief's goal.

- **Nothing to steal.** When no loose, unforbidden, reachable item and no small tame animal can be reached, the thief's goal is its own tile. Standing on its goal counts as having stolen: the party retreats with `outcome: 'looted'` and an empty loot list, and `RaidEnded { outcome: 'looted' }` raises the alert for a raid that "escaped with loot". The fortress gets no `raid_repelled` thought.
- **An animal can never be stolen.** 18 § Party AI lets a thief target a small tame animal. 18 § Stealth lets "any fortress creature within `SPOT_RADIUS`" spot a thief. The animal is a fortress creature, so it spots the thief that comes for it. The rule is dead text.

## Reproduction

[`thief.probe.ts`](../../reports/data/2026-10-09-bug-hunt-thief.probe.ts.txt). Case A: an empty flat-test map and one thief: `RaidEnded { outcome: 'looted' }`, no `ThiefEscaped`. Case B: a tame cat at (24, 15) as the only quarry, five seeds: `ThiefSpotted` and `withdrew` five times, the cat untouched.

Read: `src/systems/threats/ai.ts:583–587` and `:976–983`; `ai.ts:39–58` (every conscious fortress creature is a spotter).

## What to do

**Decisions.**

1. **A thief with no goal waits, then leaves.** 18 § Party AI, goal selection: a thief party with nothing it can steal stays hidden where it arrived and looks again at each threats tick; after `THIEF_WAIT_DAYS` (new, 1) it retreats, and the outcome is `withdrew`. T-169 computes the outcome from what happened (`looted` only if a member left with loot), so with T-169 done the outcome needs no code here; this task adds the wait and removes "arrived at the goal" as a proof of theft when `goalEntity` is 0.
2. **Livestock do not raise the alarm.** 18 § Stealth: a stealthed creature is spotted by a dwarf, by a dog or other animal trained for war or hunting, or by a trap. An untrained tame animal spots nothing. This is a change to the spec, recommended because the other reading leaves a rule of the same document without effect, and because a hen that guards the coop is not what "dogs `SPOT_RADIUS_DOG`" was written for. The spotter list is read from the species' `trainable` field and the animal's training, not from the id `dog` (`ai.ts:55`, C24 of the report).
3. **A stolen animal comes back if its thief dies on the map.** The animal is put on the thief's death tile (`pickUpLoot` removed its `Position`, `ai.ts:371–380`; nothing restores it today). Unreachable before decision 2, reachable after it.

Amend 18 §§ Party AI, Stealth and the constants table. Tests, `describe('T-185 …')`: case A ends `withdrew` after a day; case B ends with `ThiefEscaped { animalId }` when no dwarf or dog is near, and with `ThiefSpotted` when a dog is within `SPOT_RADIUS_DOG`; a thief killed while carrying the cat leaves the cat alive on its tile.

## Done

- The tests pass; `th_thief` still passes.
