# F-13 — A locked gate makes a raid loiter and leave; animals never park on doors (M)

**Needs:** — · **Blocks:** the T-M8-06 peril re-measure · **Spec touched:** `18-threats-monsters-and-raids.md`, `08-animals-and-domestication.md`

## Why

[`reports/M8-mood-diagnosis.md`](../../../reports/audits/M8-mood-diagnosis.md) § 11 measured a three-year fortress with a gate (two doors with `lock_on_alert`, `19` § The airlock) and a squad of three. At peril 2 and peril 4, all 13 seeds survived every fight with no combat deaths, and then all 13 starved in year 1.

**1. A raid locked out of the fortress never leaves.** `18` § Party AI says:

- approach: "when any member sees a fortress creature within perception, the party enters `engage`";
- engage: "after `ENGAGE_IDLE_TICKS` with no target in perception, back to `approach`";
- loiter: "when the goal is unreachable and **no targets are visible** … after `LOITER_DAYS_RAID` (2) … days the party retreats".

A party outside a locked gate that can see a fortress creature it cannot reach therefore cycles between approach and engage forever. It never enters loiter, so its two-day timer never runs. The fortress alert stays on `hearth`. `10` § Behavior ranks `retreat` above a critical need, so civilians shelter until they starve.

The intent of `18` (a party with an unreachable goal waits and leaves), `19` (the airlock) and `balance.md` ("the first raid arrives after the player has had time to build a gate") is clearly that **a locked gate buys safety**. The rules as written make it a death trap.

**2. A tame animal can block a door for good.** `22` § Movement makes any creature on a door tile block every other mover ("occupied by a blocking creature (hostile to the mover, or any creature if the tile is a door)"). A pet following its dwarf loosely (`08` § Pets) can stop on a door tile and stay there. A dwarf on the other side then waits and repaths onto the same door again and again. The fortress only worked around it by setting its doors to `no_pets`, which a player cannot be expected to know.

**Owner decision (2026-10-03):** fix both rules. Keep the `10` behaviour order (retreat above critical needs) unchanged. Once a locked-out raid leaves after `LOITER_DAYS_RAID`, a retreat lasts about two days, and at `HUNGER_PER_HOUR` 1 that is harmless.

## Decisions

1. **Decision F-13a — only a reachable creature starts a fight.** A party enters `engage` only when a member sees, within perception, a fortress creature that the party **can reach by path** (22 connectivity, `reachable`). Seeing only creatures it cannot reach does not count as "a target visible" for approach, engage or loiter. Archers still shoot at anything in range and line of sight while loitering, as `18` already says.
2. **Decision F-13b — door breaking happens in loiter too.** A party that loiters at a locked door because its goal is unreachable has members with `breaksDoors` break that door exactly as `18` § Engage describes (`DoorBreakAttempt` each tick; 14 removes it after `DOOR_BREAK_TICKS`). When the door is removed and the goal becomes reachable, the party returns to `approach` and the loiter timer is discarded. Without this, F-13a would stop door-breakers from ever reaching a door.
3. **Decision F-13c — "stands at the nearest reachable tile" means arrived.** The leader counts as arrived for loiter when it is on the goal tile or Chebyshev-adjacent to it on the same level, or when its walk to that tile has been blocked for `REPATH_LIMIT` attempts. The loiter timer starts then.
4. **Decision F-13d — animals step off doors.** A tame animal (pets, followers, wanderers, grazers) never ends a move or idles on a door tile. When its own movement would stop on one, it continues to the nearest walkable non-door tile beside the door, on the side it was heading to. Hostile creatures are unchanged (they block doors as `22` says, by design). Dwarves are unchanged too; a dwarf passing through a door does not stop on it in the first place.
5. **Decision F-13e — nothing else changes.** `22`'s door-blocking rule, `10`'s behaviour order, `LOITER_DAYS_RAID`, `LOITER_DAYS_SIEGE`, `ENGAGE_IDLE_TICKS`, `RETREAT_LOSS_PERCENT`, every threat schedule, party size and combat number stay as they are.

## Spec amendments

### `docs/02-systems/18-threats-monsters-and-raids.md` § Party AI, the Approach bullet

Old:

```
- **Approach**: the leader paths to the goal; members follow the leader within `FOLLOW_RADIUS`, using the leader's path (22 shared path) to save pathfinding; when any member sees a fortress creature within perception, the party enters `engage`.
```

New:

```
- **Approach**: the leader paths to the goal; members follow the leader within `FOLLOW_RADIUS`, using the leader's path (22 shared path) to save pathfinding; when any member sees a fortress creature within perception that the party can reach by path, the party enters `engage`. Creatures it can see but not reach (behind a locked door, across a moat) do not start a fight.
```

### the Engage bullet, its last clause

Old:

```
after `ENGAGE_IDLE_TICKS` with no target in perception, back to `approach`.
```

New:

```
after `ENGAGE_IDLE_TICKS` with no reachable target in perception, back to `approach`.
```

### the Loiter bullet

Old:

```
- **Loiter**: when the goal is unreachable and no targets are visible: the party stands at the nearest reachable tile, archers shoot at anything visible, members pick up unattended items within `LOOT_RADIUS` (one per member), and after `LOITER_DAYS_RAID` (2) or `LOITER_DAYS_SIEGE` (5) days the party retreats.
```

New:

```
- **Loiter**: when the goal is unreachable and no reachable target is visible: the party stands at the nearest reachable tile (arrived when on it or adjacent to it, or when the walk there stays blocked), archers shoot at anything in range and line of sight, melee members with `breaksDoors` adjacent to a locked door break it as in engage, members pick up unattended items within `LOOT_RADIUS` (one per member), and after `LOITER_DAYS_RAID` (2) or `LOITER_DAYS_SIEGE` (5) days the party retreats. If a broken door makes the goal reachable, the party returns to `approach`.
```

### `docs/02-systems/08-animals-and-domestication.md` § Tame behavior, the first bullet

Old:

```
- Tame animals are `idle`/`wander` near their pasture (grazers) or near the hearth hall and meeting areas (others), or follow their assigned dwarf (war and hunting dogs, pets).
```

New:

```
- Tame animals are `idle`/`wander` near their pasture (grazers) or near the hearth hall and meeting areas (others), or follow their assigned dwarf (war and hunting dogs, pets). A tame animal never stops on a door tile: when its movement would end on one, it continues to the nearest walkable non-door tile beside it, on the side it was heading to (22 makes any creature on a door block the door).
```

Check the bullet text against the file before replacing it. If it differs, apply the same added sentence to the bullet that describes tame-animal idling and following, and say so in the commit body.

## Code

- `src/systems/threats/ai.ts`: the approach-to-engage test, the engage idle test and the loiter entry use **reachable** fortress targets (cheap connectivity check, the same `reachable` the goal selection already uses; never a full path search per member per tick). Loiter runs door breaking for `breaksDoors` members and returns to approach when the goal becomes reachable. Arrival per F-13c.
- `src/systems/animals/` (tame movement and following): F-13d.
- Constants stay where they are; add none unless the spec names one.

## Tests

Tagged `F-13`:

- Unit, threats: a raid party outside a locked door, with a dwarf visible across a channel of open tiles on the same level, in line of sight but unreachable. It enters `loiter`, never `engage`, and after `LOITER_DAYS_RAID` days retreats with `RaidEnded { outcome: withdrew }`.
- Unit, threats: the same party with a reachable dwarf visible enters `engage` (the old behaviour is kept where it should be).
- Unit, threats: a `breaksDoors` party loitering at a locked door breaks it, returns to `approach`, and its loiter timer does not fire afterwards.
- Unit, animals: a pet whose owner walks through a doorway and stops two tiles beyond ends on a non-door tile. A dwarf walking the other way through that door is never blocked by it.
- Scenario: the existing defence and raid scenarios (`df_*`, `th_*` in `acceptance-tests.md`) stay green. If one asserts the old cycling behaviour, that is a contradiction to report, not an assertion to delete.

## Golden files

Threat and animal behaviour change, so `test/golden/world-hashes.json` may change. Regenerate in the same commit with a `golden:` paragraph saying "world hashes: F-13 changes raid loitering and tame-animal stopping on doors".

## Done

- The rules changed and the four spec amendments applied.
- The tests above exist, are tagged `F-13`, and pass.
- `npm run lint`, `npm run typecheck`, `npm run content:check`, `npm test`, `npm run test:e2e` green.
- `PROGRESS.md` ticked, a `DECISIONS.md` D- row, goldens regenerated in the same commit.
