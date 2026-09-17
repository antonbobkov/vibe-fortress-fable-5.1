# 20 Trade & Caravans

**Detail level:** W2 · **Owner:** `systems/trade` · **Depends on:** [01-world-generation.md](01-world-generation.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [10-dwarves.md](10-dwarves.md), [18-threats-monsters-and-raids.md](18-threats-monsters-and-raids.md), [16-combat.md](16-combat.md)

## Purpose

Bring the outside world to the depot three times a year, give the fortress a use for its wealth, and let the player's conduct toward each civilization matter.

## Concepts

- **Caravan**: a party of merchants, guards and pack animals from a civilization, arriving on a fixed season.
- **Depot**: the `trade_depot` building where goods are exchanged.
- **Session**: the modal exchange screen, open while a fortress trader stands at the depot with a merchant.
- **Valuation**: what a merchant thinks an item is worth to them: fortress value × civ preference.
- **Margin**: the profit a merchant requires.
- **Reputation**: −100..100 per civilization.
- **Request**: goods the player asks for next year.

## Rules

### Schedule

| Civilization | Season | From | Arrival day |
|---|---|---|---|
| Hillfolk | summer | year 1 | `rng.int(CARAVAN_DAY_MIN, CARAVAN_DAY_MAX)` |
| Wildwood | autumn | year 1 | same |
| Mountainhome | spring | year 2 | same |

No caravan in winter. A civilization with reputation ≤ `CARAVAN_BAN_REP` or under a ban (`CARAVAN_BAN_YEARS` after traders were attacked) does not come. At temper 4, a caravan has `WEATHER_SKIP_PERMILLE` chance to skip a year ("the passes were closed").

### Party

- Merchants: `MERCHANTS_MIN..MERCHANTS_MAX` (species: `dwarf` for Mountainhome, `human` for Hillfolk, `elf` for Wildwood; all `trader:<civ>`).
- Guards: `GUARDS_BASE + peril × GUARDS_PER_PERIL`, armed from the civ's gear table.
- Pack animals: `mule` (Hillfolk, Mountainhome) or `wildwood_bearer` (an elf carrying a pack), one per `PACK_VALUE` marks of goods.
- Goods: generated from `caravan-goods.md` for the civ: a value budget `CARAVAN_VALUE_BASE + renown × CARAVAN_VALUE_PER_RENOWN + reputation × CARAVAN_VALUE_PER_REP`; `REQUEST_SHARE` of the budget is spent on the player's requests first (items that exist in the civ's list), the rest drawn by weight. Each civ's list is fixed by this design in Wave 3; its flavor: Mountainhome brings metal bars, weapons and armor, picks, anvils, animals, seeds of cave crops, ale, crafts; Hillfolk bring food, cloth, leather, livestock (including horses at reputation ≥ 50), seeds of surface crops, cheese, wine; Wildwood bring seeds and rare saplings (yew), herbs (brightleaf), bows and arrows, cloth, exotic fruit, and at reputation ≥ 50 tame forest animals.
- Goods are items carried by pack animals (in their `Container`) until unloaded.

### Movement

1. Spawn at `nearestEdgeTo[civ]`; `CaravanArrived { civ, merchants, guards, animals }` (alert).
2. Find a depot reachable by the caravan's movement class (mules are `walker`; the path must not require stairs for `large` pack animals: mules are size 90, so they are walkers). If none: `CaravanWaiting` (alert: "The caravan waits at the edge for a trade depot") and wait `DEPOT_WAIT_DAYS`; if a depot appears, proceed; else `CaravanDeparted { reason: no_depot }` and reputation −2.
3. Walk to the depot; unload: goods move from pack animals into the depot's container flagged `merchant`; merchants stand inside the depot; guards stand on the tiles around it; animals adjacent. `CaravanAtDepot`.
4. Stay `CARAVAN_STAY_DAYS`, then pack (goods not sold return to the animals, goods bought go too), walk to the edge, despawn: `CaravanDeparted { civ, boughtValue, soldValue }`.
5. If attacked: guards fight (16); merchants flee toward the edge; if any merchant dies the caravan leaves at once with whatever it can carry; goods left in the depot become the fortress's (`CaravanLost { civ }`, reputation −10 if the killer was a fortress creature, −3 if hostiles or wild animals: they hold the fortress a little responsible).
6. Caravan members eat and drink their own supplies (no needs simulated); they never sleep; they are not affected by fortress alerts.

### Moving goods to the depot

`MoveToDepot { itemIds }` (from the stocks panel, the depot panel, or a rectangle selection) creates `haul_to_depot` jobs (labor `hauling`, priority `DEPOT_HAUL_PRIORITY`) per item; items at the depot are `forbidden`-like for other jobs (flag `atDepot`). `RemoveFromDepot` reverses. A depot holds any number of items.

### The session

- `TradeOpen { depotId }` requires the caravan at the depot. It creates a `trade` job for the Broker if one exists (labor `trading`), else for any dwarf with the labor enabled; the job walks the dwarf to the depot; when both the dwarf and a merchant are inside, the session screen opens (modal, the game pauses while it is open).
- The screen: left, merchant goods with *their price* (merchant valuation × `MERCHANT_MARKUP`); right, fortress goods at the depot with *their valuation* of each; the player marks quantities on both sides; totals; the margin line "The merchant wants at least 12% profit"; Offer.
- `TradeOffer { give, take }` is accepted when `Σ valuation(give) ≥ Σ price(take) × (100 + margin) / 100`; else `TradeRefused { shortfall }` and the merchant's line "Not enough. Add {shortfall} marks of goods." Accepted: items change owner (bought goods lose `merchant`, sold goods gain it), `TradeCompleted`, trading skill xp `TRADE_XP × (1 + value / 1000)`, reputation `+ clamp(1, 5, value / 500)`.
- An offer with an empty `take` is a gift: reputation `+ value / 100` (max +10 per caravan), `GiftGiven`.
- Selling items the civ dislikes (Wildwood: any item with material class `wood`, and any `furniture` made of wood): each such item offered gives reputation −2 even if the trade succeeds, and the merchant's line says so once per session. Killing a caravan member gives −50 and a ban.
- The session can be reopened as long as the caravan is at the depot.

### Valuation

`valuation(civ, item) = value(item) × preference(civ, item.category or item.material class) / 100`, where `preference` rows are content: defaults 100; Hillfolk metal 150, food 80, stone crafts 90; Mountainhome crafts 130, gems 140, deepsilver items 300, food 70, drink 120; Wildwood wood 20, cloth 120, herbs 130, animals 150, stone 80.

`margin = max(MARGIN_MIN, MARGIN_BASE − tradingSkill × MARGIN_PER_SKILL − reputation / MARGIN_REP_DIVISOR)` percent.

### Requests

`SetRequests { civ, entries: { itemType, material?, priority: 1..3 }[] }` up to `REQUEST_MAX` entries; stored per civ; used by the next caravan's goods generation (`REQUEST_SHARE` of budget, priority weights 3, 2, 1). The civilizations panel shows the requests and what the last caravan brought.

### Reputation effects

| Reputation | Effect |
|---|---|
| ≤ −50 | No caravan |
| −49..−1 | Margin higher; smaller budget |
| 0..49 | Normal |
| 50..100 | Larger budget; rare goods (horses, yew, forest animals); Mountainhome: immigration size bonus (21) |

Reputation drifts toward 0 by `REP_DRIFT_PER_YEAR` each year (grudges and favors fade).

## State

- `schedule: Record<Civ, { nextArrivalTick, banUntilYear }>`, `activeCaravan: partyId | 0` (one at a time; if two would overlap, the second waits a day at the edge), `reputation` in `fortress`, `requests: Record<Civ, Request[]>`, `depotItems: Set<EntityId>` (fortress items at the depot), `merchantItems: Set<EntityId>`, `session: { depotId, traderId, merchantId, give, take } | null`, `lastBrought: Record<Civ, itemType[]>`.
- Rng stream.

## Interfaces

### Reader

- `trade.activeCaravan()` (civ, state, days remaining), `trade.schedule()` ("Hillfolk: summer", never the day), `trade.isBanned(civ)`
- `trade.reputation(civ)`, `trade.marginPercent(civ)`, `trade.valuation(civ, itemId)`, `trade.price(civ, itemId)`
- `trade.depotItems()`, `trade.merchantItems()`, `trade.requests(civ)`, `trade.lastBrought(civ)`
- `trade.sessionOpen()`

### Commands

`MoveToDepot`, `RemoveFromDepot`, `TradeOpen`, `TradeOffer`, `TradeCancel`, `SetRequests`.

### Events consumed

`DayPassed`, `SeasonChanged`, `YearPassed` (drift), `BuildingCompleted` (depot appears), `CreatureDied` (caravan members), `AttackResolved` (attacked), `JobCompleted` (trade job arrival), `WealthChanged` (renown via 18's reader), `RaidArrived` (caravan guards engage automatically through factions).

### Events emitted

`CaravanArrived`, `CaravanWaiting`, `CaravanAtDepot`, `CaravanDeparted`, `CaravanLost`, `TradeCompleted { civ, givenValue, receivedValue }`, `TradeRefused`, `GiftGiven`, `ReputationChanged { civ, delta, reason }`, `CaravanAttacked { civ }`.

### Registrations

Job producer `trade` (`haul_to_depot`, `trade`); panel `civilizations` (reputation per civ with a one-line reason history, schedule, requests editor, last brought); panel `depot` (when a depot is selected: items at depot, move goods, open trade); the modal `trade session` screen; announcements: `CaravanArrived` (alert), `CaravanWaiting` (alert), `CaravanDeparted` (note), `CaravanLost` (alert), `TradeCompleted` (note), `ReputationChanged` with a negative delta (note with reason).

## Player-facing behavior

- Caravans render as `☺` in the civ's color (Mountainhome yellow, Hillfolk tan, Wildwood green), guards as the same with a shield glyph in the inspector, mules as `m`.
- The trade session screen is the one place with a two-column table and quantity fields; keyboard: arrows and +/−, Tab between columns, Enter to offer; mouse: click rows, drag quantities.
- Hints: "Build a trade depot before summer", "The Wildwood pay poorly for wood and remember who sells it", "Ask for what you need: requests shape next year's caravan".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `CARAVAN_DAY_MIN` / `CARAVAN_DAY_MAX` | 5 / 18 | Arrival day within the season |
| `CARAVAN_BAN_REP` | −50 | |
| `CARAVAN_BAN_YEARS` | 2 | |
| `WEATHER_SKIP_PERMILLE` | 150 | At temper 4 |
| `MERCHANTS_MIN` / `MERCHANTS_MAX` | 2 / 3 | |
| `GUARDS_BASE` / `GUARDS_PER_PERIL` | 2 / 1 | |
| `PACK_VALUE` | 800 | Marks of goods per pack animal |
| `CARAVAN_VALUE_BASE` | 2500 | |
| `CARAVAN_VALUE_PER_RENOWN` | 150 | |
| `CARAVAN_VALUE_PER_REP` | 20 | |
| `REQUEST_SHARE` | 30 | Percent |
| `REQUEST_MAX` | 8 | |
| `DEPOT_WAIT_DAYS` | 3 | |
| `CARAVAN_STAY_DAYS` | 5 | |
| `DEPOT_HAUL_PRIORITY` | 3 | |
| `MERCHANT_MARKUP` | 120 | Percent |
| `MARGIN_BASE` / `MARGIN_MIN` | 15 / 3 | Percent |
| `MARGIN_PER_SKILL` | 0.5 | Percent per trading skill level |
| `MARGIN_REP_DIVISOR` | 20 | |
| `TRADE_XP` | 15 | |
| `REP_DRIFT_PER_YEAR` | 5 | Toward 0 |

Goods lists and preferences are content.

## Extension points

- Haggling as a mini-interaction: a second offer with a small margin discount.
- Buying information (maps, threat warnings) as a service item.
- Diplomatic envoys and treaties: a party purpose `envoy` with a dialog screen.
- Player-sent trade expeditions: a squad order to leave the map with goods and return next season with a result computed off-map.
