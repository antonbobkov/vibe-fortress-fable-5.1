# 21 Immigration

**Owner:** `systems/immigration` · **Depends on:** [15-happiness-and-morale.md](15-happiness-and-morale.md), [13-items-and-storage.md](13-items-and-storage.md), [10-dwarves.md](10-dwarves.md), [20-trade-and-caravans.md](20-trade-and-caravans.md), [02-embark-and-loadout.md](02-embark-and-loadout.md)

## Purpose

Grow the fortress as a reward for keeping it happy and prosperous, in waves the player can anticipate and cap.

## Concepts

- **Wave**: a group of immigrants arriving together.
- **Eligibility**: the conditions checked at each season change.
- **Guaranteed waves**: the two small waves of year 1 that arrive regardless of mood, so a rough start does not strand the player at seven dwarves.
- **Population cap**: the player's limit.

## Rules

### Evaluation

On every `SeasonChanged` (the first evaluation is the change to summer of year 1):

1. If the fortress has no living dwarves, nothing happens (the game is ending).
2. If a battle is on the map, defer to the next day and re-check daily until clear (immigrants do not walk into a battle). A battle is an active raid or siege, or an ambush that has sprung (18 § Stealth); a hidden ambush, which nobody knows of, defers nothing.
3. Guaranteed waves: at summer year 1 and autumn year 1, if `population < cap`, a wave of `GUARANTEED_SIZE_MIN..GUARANTEED_SIZE_MAX` arrives. These are "the cousins": their announcement says so.
4. Otherwise, eligible if all hold: `hallSpirit ≥ IMMIGRATION_SPIRIT_MIN`; `population < cap`; `wealth ≥ WEALTH_PER_WAVE × wavesSoFar` (each wave asks a little more renown than the last); not winter at temper ≥ 2 (the passes are closed). When eligible, a wave arrives with probability `IMMIGRATION_PERMILLE + reputation(mountainhome) × REP_PERMILLE_PER_POINT`.
5. `ImmigrationSkipped { reason }` is emitted when not eligible, so the panel can say why ("Hall spirit is Fine; immigrants come when it is Content").

### Wave size

```
size = IMMIGRANT_BASE + floor(wealth / WEALTH_PER_IMMIGRANT) + (hallSpiritTierIndex − FINE_INDEX) × SPIRIT_SIZE_STEP + floor(reputation(mountainhome) / REP_PER_IMMIGRANT)
size = clamp(IMMIGRANT_BASE, min(WAVE_MAX, cap − population), size)
```

with `hallSpiritTierIndex` 0..4 for Miserable..Ecstatic and `FINE_INDEX = 2`. A winter wave (temper 0–1) is halved.

### Composition

1. Compute the fortress's *coverage*: for each key profession in the list (`miner`, `farmer`, `woodcutter_carpenter`, `mason`, `brewer`, `cook`, `smith`, `soldier`, `medic`, `hunter`, `mechanic`, `weaver`), coverage is true if any adult dwarf has the profession's skill at ≥ `COVERAGE_SKILL`. Coverage is evaluated once, when the wave is planned. Each profession's skill and related secondary skill are authored skill ids: `miner` mining and pick, `farmer` farming and herbalism, `woodcutter_carpenter` woodcutting and carpentry, `mason` masonry and building, `brewer` brewing and farming, `cook` cooking and butchery, `smith` weaponsmithing and smelting, `soldier` axe and armor_use, `medic` medicine and herbalism, `hunter` hunting and crossbow, `mechanic` mechanics and building, `weaver` weaving and clothesmaking.
2. Each immigrant's primary profession is drawn with weight `1 + (covered ? 0 : UNCOVERED_WEIGHT)`; with `PEASANT_PERMILLE` the immigrant is a `Settler` with no skills instead.
3. Skills: primary skill `rng.int(PRIMARY_MIN, PRIMARY_MAX)`, a related secondary skill `rng.int(1, 3)`. Attributes and personality rolled as in 02. Age `rng.int(EMBARK_AGE_MIN, EMBARK_AGE_MAX)`.
4. Families: with `FAMILY_PERMILLE` an immigrant comes with a spouse (another adult drawn the same way, the two are friends from the start and `spouse` in relationships) and `rng.int(0, CHILDREN_MAX)` children (age `rng.int(3, ADULT_AGE_YEARS − 1)`, children under the ordinary child rules of 10); family members count toward `size`. The wave plan keeps each child's parent by index.
5. Pets: with `PET_PERMILLE` a family brings a `dog` or `cat` (tame, pet of one member).
6. Equipment: clothing in all three slots; a tool for the profession (`pick` for a miner, `axe` for a woodcutter or carpenter, `crossbow` with `AMMO_FETCH` bolts for a hunter) if the fortress has fewer than `TOOL_STOCK_MIN` of that tool, made of the first compatible material in registry order; nothing else.
7. Names from the names table; no duplicates with living dwarves.

### Arrival

- Spawn at `nearestEdgeTo.mountainhome`, one every `ARRIVAL_INTERVAL_TICKS`, with needs at 30, all labors enabled, no bedroom (14 auto-assigns daily).
- `ImmigrantsArrived { ids, count, children, guaranteed }` (alert) is emitted once, after the last member of the wave has arrived: "Six dwarves have come to join the hall, two of them children." Everyone gets `immigrants_arrived`.
- New dwarves walk to the hearth hall (or the wagon) and then behave normally. Before each staggered arrival, validate the saved entry as a currently walkable entry tile connected to the hearth hall, or the wagon when there is no hall. Without either anchor, use the lowest-id living resident's tile. An isolated edge floor is not an entry, even if its terrain is otherwise walkable. Keep a valid planned tile; otherwise choose qualifying tiles on the same civilization edge in coordinate order with the ordinary arrival spread, checking every edge tile if no spread candidate qualifies.
- A wave still arriving stops while a battle is on the map: from `RaidArrived` or `AmbushSprung` until `RaidEnded` leaves no battle, and the rest of it arrives after. An ambush that springs on the wave's first arrivals holds the others at the edge.
- If that edge has no qualifying entry, keep the same planned wave queued and retry after `ARRIVAL_INTERVAL_TICKS`. Do not spawn at an unreachable fallback or redraw the wave. A season evaluation that occurs while a wave is still pending waits and rechecks daily after that wave finishes. The saved next member and next-arrival tick preserve that wait and its continuation across load; recheck connectivity before spawning each remaining member.

### Population cap

`SetPopulationCap { n }` clamps to `20..200`; the population panel changes the cap by one per key press or click; default `POPULATION_CAP_DEFAULT`. A cap at or below the current population stops immigration (the panel says "Immigration paused by cap").

## State

- `wavesSoFar`, `guaranteedDone: [boolean, boolean]`, `lastWave: { tick, count }`, `deferredUntilTick`, `lastSkipReason`, the pending wave (its plan, the members already arrived and the tick of the next arrival) and whether a battle holds it, which are saved so that the remaining arrivals resume after a load.
- Rng stream.

## Interfaces

### Reader

- `immigration.cap()`, `immigration.wavesSoFar()`, `immigration.lastWave()`
- `immigration.eligibility()` — `{ eligible, reasons: string[] }` computed from current readers for the panel
- `immigration.nextEvaluation()` — the next season name
- `immigration.lastSkipReason()` — why the last wave was skipped, or null

### Commands

`SetPopulationCap { n }`.

### Events consumed

`SeasonChanged`, `DayPassed` (deferred checks), `RaidArrived`, `AmbushSprung`, `RaidEnded`.

### Events emitted

`ImmigrantsArrived`, `ImmigrationSkipped { reason }`.

### Registrations

Panel `population` (population, cap editor, hall spirit, eligibility reasons, last wave, next evaluation); announcements: `ImmigrantsArrived` (alert), `ImmigrationSkipped` (note, once per season).

## Player-facing behavior

- The population panel is the explanation of why immigrants do or do not come.
- Hints: "Immigrants come at the turn of the season when hall spirit is Content", "Set a population cap in the population panel".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `IMMIGRATION_SPIRIT_MIN` | 55 | upper Fine tier; a well-kept fortress settles here (balance.md) |
| `IMMIGRATION_PERMILLE` | 700 | Per eligible season (*unmeasured*) |
| `REP_PERMILLE_PER_POINT` | 2 | *unmeasured* |
| `WEALTH_PER_WAVE` | 2000 | Marks per prior wave |
| `GUARANTEED_SIZE_MIN` / `GUARANTEED_SIZE_MAX` | 2 / 4 | |
| `IMMIGRANT_BASE` | 2 | |
| `WEALTH_PER_IMMIGRANT` | 3000 | |
| `SPIRIT_SIZE_STEP` | 2 | |
| `REP_PER_IMMIGRANT` | 25 | *unmeasured* |
| `WAVE_MAX` | 12 | |
| `COVERAGE_SKILL` | 5 | *unmeasured* |
| `UNCOVERED_WEIGHT` | 2 | *unmeasured* |
| `PEASANT_PERMILLE` | 200 | *unmeasured* |
| `PRIMARY_MIN` / `PRIMARY_MAX` | 2 / 7 | *unmeasured* |
| `FAMILY_PERMILLE` | 300 | *unmeasured* |
| `CHILDREN_MAX` | 2 | *unmeasured* |
| `PET_PERMILLE` | 150 | *unmeasured* |
| `TOOL_STOCK_MIN` | 2 | *unmeasured* |
| `ARRIVAL_INTERVAL_TICKS` | 20 | *unmeasured* |

## Extension points

- Named immigrants with histories (a relative of a dead dwarf): a hook on the legend record.
- Refugees after a fallen neighbor: a wave kind with different composition.
- Emigration when miserable: not planned (pillar 2); if added, it would be a wave with negative size and a warning season ahead.
