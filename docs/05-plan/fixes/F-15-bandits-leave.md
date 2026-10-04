# F-15 — Bandits who reach their stockpile steal and leave; a failed walk means unreachable (S)

**Needs:** F-13, the door-lock fix (cc4c070), the T-M8-01 merge · **Blocks:** the T-M8-06 peril re-measure · **Spec touched:** `18-threats-monsters-and-raids.md`

## Why

[`reports/M8-mood-diagnosis.md`](../../../reports/M8-mood-diagnosis.md) § 14 re-measured perils 2 and 4 after F-13 and the door-lock fix. Raids, ambushes and sieges now loiter at a locked gate and leave. Of the 13 parties still active when a fortress died, **11 were bandits** standing on an outdoor stockpile.

`18` § Party AI says "bandits target the nearest stockpile", and § Creatures says Hillfolk bandits are "melee, steals". It never says what bandits do on arrival. In `src/systems/threats/ai.ts`, a party whose reachable goal tile is reached stays in `approach` with nothing left to do. It never loots and never enters `loiter`, so it never leaves. The fortress alert stays on `hearth`, and the sheltered civilians starve.

§ 13 also found a defensive gap. A leader whose `walkTo` returns `unreachable` stays in `approach`, because loiter is entered only when `goalUnreachable` was set at goal selection. With the door-lock fix the connectivity labels agree with movement, so this no longer fires in the measured runs. It remains a way for a party to hang whenever the labels and the path search disagree for any reason.

**Decision (2026-10-03, parent under the owner's standing instruction to use judgment):** fill the gap with the reading `18` already implies. Bandits steal from the stockpile and go, using the existing `looted` outcome. Then close the defensive gap by reading "if no path exists" (§ Goal selection) as including a walk that the path search reports unreachable.

## Decisions

1. **Decision F-15a — bandits steal and leave.** When the bandit party's leader arrives at its stockpile goal (on the tile or adjacent, as F-13c defines arrival), each living member picks up one unattended item within `LOOT_RADIUS` of itself, preferring items on stockpile tiles, highest value first, ties by id, one item per member, as § Loiter's looting already does. The party then retreats with `RaidEnded { outcome: looted }` if any member carries loot. If there is nothing to take, the party enters `loiter`, which loots anything that appears and withdraws after `LOITER_DAYS_RAID`.
2. **Decision F-15b — a failed walk is an unreachable goal.** If the leader's walk to `goalTile` returns `unreachable` while the party is in `approach`, set `goalUnreachable = true`, choose the reachable tile nearest the goal (22 `nearestReachable`) as the new goal tile, and continue. On arrival the party loiters, as F-13 describes. This changes nothing when the labels and the path search agree.
3. **Decision F-15c — nothing else changes.** Thieves, ambushes, raids and sieges keep their goal rules. `LOOT_RADIUS`, `LOITER_DAYS_RAID`, `RETREAT_LOSS_PERCENT` and every schedule and size stay as they are. Fighting is unchanged: bandits that see a reachable fortress creature on the way still `engage` (F-13a).

## Spec amendments

### `docs/02-systems/18-threats-monsters-and-raids.md` § Party AI, the Goal selection bullet

Old:

```
bandits target the nearest stockpile;
```

New:

```
bandits target the nearest reachable stockpile and, on arriving, each take one unattended item within `LOOT_RADIUS` (stockpile items first, most valuable first) and retreat with their loot, or loiter if there is nothing to take;
```

### the same bullet, its last clause

Old:

```
if no path exists, the target is the reachable tile nearest to the hearth (22 `nearestReachable`).
```

New:

```
if no path exists (including a walk the path search reports unreachable), the target is the reachable tile nearest to the goal (22 `nearestReachable`) and the party loiters on arriving there.
```

Check each "Old" string against the file before replacing. If the wording differs, apply the same change to the clause that says it and note that in the commit body.

## Code

- `src/systems/threats/ai.ts`: F-15a in the bandits' arrival handling, and F-15b in the leader's walk handling. Reuse the existing loot pickup (`pickUpLoot`) and `LOOT_RADIUS` search. Do not add a whole-map item scan; use the items spatial or kind index that T-M8-01 introduced for unattended loot.

## Tests

Tagged `F-15`:

- Unit, threats: a bandit party reaches an outdoor stockpile holding items. Each member takes one item, the party retreats, `RaidEnded { outcome: looted }` fires, and the members despawn at the edge.
- Unit, threats: the same party at an empty stockpile loiters and, after `LOITER_DAYS_RAID`, withdraws with `RaidEnded { outcome: withdrew }`.
- Unit, threats: a raid whose labels say reachable but whose walk returns `unreachable` (force it with a stub, or build a case the movement helper reports unreachable) ends up loitering at the nearest reachable tile and leaves after `LOITER_DAYS_RAID`.
- The F-13 tests and every `th_*` / `df_*` scenario stay green.

## Golden files

Regenerate the world hashes if they move, with a `golden:` paragraph saying "world hashes: F-15 makes bandits steal and leave".

## Done

- The two amendments applied, the code changed, the tests above tagged `F-15` and passing.
- `npm run lint`, `npm run typecheck`, `npm run content:check`, `npm test`, `npm run test:perf` (the per-system budgets must still hold) green.
- `PROGRESS.md` ticked, a `DECISIONS.md` D- row stating it was the parent's decision under the owner's standing instruction.
