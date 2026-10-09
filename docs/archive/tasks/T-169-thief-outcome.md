# T-169 — A thief that escapes with loot ends its raid as looted

Closed by `T-169: derive raid outcomes from actual loot escapes`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 10) · **Size:** S · **Needs:** — · **Status:** open

## Why

A thief party whose member left the map with an item ended as `withdrew`. The `RaidEnded` announcement is an alert only for `looted`, so the player gets a note.

## Reproduction

[`gear.probe.ts`](../../../reports/data/2026-10-08-bug-hunt-gear.probe.ts.txt), tick 25,431: `ThiefEscaped { itemId: 16777408 }` and `RaidEnded { outcome: 'withdrew' }`. The party probe (`raid.probe.ts`, the standard script phase) shows five thief parties ending `withdrew` in 110 days.

## What to do

**Decision.** The outcome is computed when the party ends, from what happened: `looted` if any member left the map with loot (count `ThiefEscaped`), else `wiped`, `repelled` or `withdrew` as 18 defines them. A thief spotted after it has stolen keeps `looted`. The cause was not established: `ai.ts:841` and `index.ts:459` set `withdrew` on spotting, and `despawnMember` empties `P.loot` before it reads it; check both.

Tests, `describe('T-169 …')`: a thief that steals and leaves ends `looted`; a thief spotted before it steals ends `withdrew`.

## Done

- The tests pass.
