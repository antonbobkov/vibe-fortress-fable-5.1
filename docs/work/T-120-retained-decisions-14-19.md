# T-120 — Resolve retained systems 14–19 decision/code mismatches

**Source:** T-106 triage (rows left in the log because the code and the row differ, and spec text that could not be written without a source change) · **Size:** M · **Needs:** — · **Status:** open

## Scope

T-106 verified the decision rows of systems 14–19 against the implementation. The rows below remain in [the decision log](../05-plan/DECISIONS.md) because the code disagrees with them. This file reports the mismatches; it does not choose a rule or authorize a simulation change. Obtain the owner's resolution before implementation.

| Row | Decision | Code evidence |
|---|---|---|
| D-075 | Auto-assignment gives an unowned bedroom to a titled dwarf first, then to the dwarf with the lowest mood (15's mood; `MOOD_BASELINE` only as the stand-in until 15 exists). | `src/systems/buildings/index.ts:157-158` still supplies `mood: () => MOOD_BASELINE` to the room store, so every dwarf ties at 55 and `src/systems/buildings/rooms.ts:454` falls through to the lowest id. 15's `MoraleReader.mood(id)` exists (`src/systems/morale/index.ts:66`). |
| D-170 (T-M6-13) | `PlaceBuilding` accepts optional integer `width` and `height` only for a variable drawbridge, bounded by `BRIDGE_MAX`. | `src/systems/buildings/build.ts:387-388` reads `width` and `height` for every type, and `:391` builds the footprint from them; only the bridge branch at `:389-390` validates them, so a command can give any placeable type a larger footprint. |

## Spec text that needs a generated file regenerated

These are decisions the code follows and the specification should say. Writing them needs an edit to a generated artifact under `src/`, which T-106 may not change.

- `docs/03-content/buildings-and-furniture.md` § Constructions gives `fortification` the placement `floor, or converts a wall`. The code places it on a floor only (`src/systems/buildings/constructions.ts:43`, rule `floor`), and no wall conversion exists (D-073 in `docs/archive/decisions-archive.md`). Changing the cell changes `src/content/buildings.json` (`npm run content:export`).
- `docs/04-implementation/command-catalog.md` and `event-catalog.md` list field names that `src/core/command-types.ts` and `event-types.ts` mirror and `test/unit/catalogs.test.ts` compares: `PlaceBuilding` and `CreateZone` give `type` where the code reads `buildingType` and `zoneType` (`src/systems/buildings/build.ts:365`, `zones.ts:210`); `ZoneChanged` lists `type` where the event carries `zoneType` and `tiles` (`zones.ts:294`); `BuildingPlaced`, `BuildingCompleted` and `BuildingRemoved` list `id, type` where they carry `buildingType` and `tiles` or `value` (`build.ts:421,523,742`); `CreatureDied` lists `id, cause, killerId` where it also carries `tile, species, name, faction, ageTicks, wornItems` (`src/systems/health/tick.ts:68-79`). The system documents and the catalogs' notes now state the real names; the field cells themselves wait for a regenerate of the two `*-types.ts` files.

## Resolution and verification

Obtain the owner's resolution for each row before changing anything. Never resolve a row by silently deleting it, loosening a test, or changing unrelated simulation rules. If behavior or hashes change, regenerate only the predicted named goldens and include the required `golden:` paragraph. Fold each resolved rule into the specification and delete only its exact decision-log row. Run [the required checks](../process/agent-workflow.md) before each commit; the normal task closure rules apply once every row is resolved.
