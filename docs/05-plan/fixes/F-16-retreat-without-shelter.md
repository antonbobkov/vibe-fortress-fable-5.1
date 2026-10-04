# F-16 — A civilian with no reachable shelter does not freeze (S)

**Needs:** F-13, F-15 · **Spec touched:** `10-dwarves.md`

## Why

[`reports/M8-mood-diagnosis.md`](../../../reports/M8-mood-diagnosis.md) § 15.4 traced the last peril-2 extinction (`three-years-p2-1`, day 144). A civilian was outdoors near the map edge when the `hearth` alert sounded. `10` § Behavior step 2 says "path to the hearth hall, or the nearest indoor tile behind a door if the hall is unreachable; stay until the alert ends". Both were unreachable, because the gate had already locked, so `retreatTile` returned −1. The brain still chose `retreat` with `targetTile −1`, and the dwarf stood frozen on the surface for 15 days.

A raid of eight stayed in `engage` against her the whole time without killing her. The alert never lifted, and the ten civilians sheltering inside starved. `10` does not say what a civilian does when no shelter is reachable.

**Decision (2026-10-03, parent under the owner's standing instruction to use judgment):** a civilian with no reachable shelter is not in `retreat`. Behaviour selection continues down the list. `flee` (step 1) still takes them away from any hostile within `THREAT_RADIUS`, and otherwise they act normally. They count as not sheltered. Freezing in place helps nobody and is the worst outcome.

## Decisions

1. **Decision F-16a.** Step 2 applies only when a retreat target exists (`19` `retreatTile(id) ≥ 0`). Otherwise the brain evaluates steps 3–9 as usual. Re-evaluate on every `AlertChanged` and when a door's state changes (`BuildingStateChanged`) or connectivity is rebuilt. `19-defense-and-traps.md` line 77 already calls `retreatTile` when a retreat tile becomes unreachable, so use the same hook for the opposite direction. A dwarf that later finds a door open then retreats. Keep this cheap: re-check only the shut-out civilians, not every dwarf every tick.
2. **Decision F-16b — never a target of −1.** No behaviour may set `targetTile` to −1 and then wait on it. If any other behaviour can produce −1, treat it the same way: fall through and do not freeze. List any you find in the commit body.
3. **Decision F-16c — nothing else changes.** `flee`, the airlock rules, the behaviour order and every constant stay as they are.

## Spec amendment

### `docs/02-systems/10-dwarves.md` § Behavior selection, step 2

Old:

```
2. `retreat`: fortress alert is `hearth` and the dwarf is a civilian: path to the hearth hall, or the nearest indoor tile behind a door if the hall is unreachable; stay until the alert ends.
```

New:

```
2. `retreat`: fortress alert is `hearth` and the dwarf is a civilian: path to the hearth hall, or the nearest indoor tile behind a door if the hall is unreachable; stay until the alert ends. A civilian for whom neither is reachable (shut out by a locked gate) skips this step until one becomes reachable; `flee` still protects them.
```

## Tests

Tagged `F-16`:

- Unit, dwarves: under `hearth` alert, a civilian with no reachable hall or indoor tile does not take `retreat`. Its behaviour is the next applicable one, never a `targetTile` of −1. When a door to the hall becomes passable again, it retreats.
- Unit, dwarves: a civilian under `hearth` alert with a hostile within `THREAT_RADIUS` and no shelter flees.
- Regression: the `three-years-p2-1` situation (reduce it to a scenario or unit setup if you can) no longer leaves a dwarf frozen with `targetTile −1`.

## Done

- The amendment applied, the code changed, the tests tagged `F-16` and passing; lint, typecheck, content:check and npm test green; `PROGRESS.md` ticked; a DECISIONS D- row stating it was the parent's decision.
