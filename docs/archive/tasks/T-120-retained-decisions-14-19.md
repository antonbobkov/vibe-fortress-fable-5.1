# T-120 — Resolve retained systems 14–19 decision/code mismatches

Closed by `T-120: resolve room assignment, building dimensions and training`.

**Source:** T-106 triage (rows left in the log because the code and the row differ, and spec text that could not be written without a source change) · **Size:** M · **Needs:** — · **Status:** open

## Scope

T-106 verified the decision rows of systems 14–19 against the implementation. The rows below remain in [the decision log](../../decisions.md) because the code disagrees with them. This file reports the mismatches; it does not choose a rule or authorize a simulation change. Obtain the owner's resolution before implementation.

| Row | Decision | Code evidence |
|---|---|---|
| D-075 | Auto-assignment gives an unowned bedroom to a titled dwarf first, then to the dwarf with the lowest mood (15's mood; `MOOD_BASELINE` only as the stand-in until 15 exists). | `src/systems/buildings/index.ts:157-158` still supplies `mood: () => MOOD_BASELINE` to the room store, so every dwarf ties at 55 and `src/systems/buildings/rooms.ts:454` falls through to the lowest id. 15's `MoraleReader.mood(id)` exists (`src/systems/morale/index.ts:66`). |
| D-170 (T-M6-13) | `PlaceBuilding` accepts optional integer `width` and `height` only for a variable drawbridge, bounded by `BRIDGE_MAX`. | `src/systems/buildings/build.ts:387-388` reads `width` and `height` for every type, and `:391` builds the footprint from them; only the bridge branch at `:389-390` validates them, so a command can give any placeable type a larger footprint. |
| D-249 | A squad's barracks is the barracks zone whose `squad` setting names it, one zone per squad; assigning another zone moves the squad's training there. The row records that re-assigning a squad that has already trained does not move it. | `src/systems/combat/training.ts:43-49` returns the squad's cached `barracksZoneId` before it looks at any zone setting, and `:129-132` caches the first barracks a squad used, so a later `SetZoneSetting { key: 'squad' }` (written by `src/ui/panels/military.ts:264-266`) changes nothing for a squad that has trained. |

## Spec text that needs a generated file regenerated

These are decisions the code follows and the specification should say. Writing them needs an edit to a generated artifact under `src/`, which T-106 may not change.

- `docs/03-content/buildings-and-furniture.md` § Constructions gives `fortification` the placement `floor, or converts a wall`. The code places it on a floor only (`src/systems/buildings/constructions.ts:43`, rule `floor`), and no wall conversion exists (D-073 in `docs/archive/decisions-archive.md`). Changing the cell changes `src/content/buildings.json` (`npm run content:export`).
- `docs/04-implementation/command-catalog.md` and `event-catalog.md` list field names that `src/core/command-types.ts` and `event-types.ts` mirror and `test/unit/events-commands.test.ts:223,236` compare: `PlaceBuilding` and `CreateZone` give `type` where the code reads `buildingType` and `zoneType` (`src/systems/buildings/build.ts:365`, `zones.ts:210`); `ZoneChanged` lists `type` where the event carries `zoneType` and `tiles` (`zones.ts:294`); `BuildingPlaced`, `BuildingCompleted` and `BuildingRemoved` list `id, type` where they carry `buildingType` and `tiles` or `value` (`build.ts:421,523,742`); `CreatureDied` lists `id, cause, killerId` where it also carries `tile, species, name, faction, ageTicks, wornItems` (`src/systems/health/tick.ts:68-79`). The system documents and the catalogs' notes now state the real names; the field cells themselves wait for a regenerate of the two `*-types.ts` files.

## Resolution and verification

Obtain the owner's resolution for each row before changing anything. Never resolve a row by silently deleting it, loosening a test, or changing unrelated simulation rules. If behavior or hashes change, regenerate only the predicted named goldens and include the required `golden:` paragraph. Fold each resolved rule into the specification and delete only its exact decision-log row. Run [the required checks](../../process/agent-workflow.md) before each commit; the normal task closure rules apply once every row is resolved.

## Resolutions (parent, 2026-10-07, under the owner's standing instruction to use judgement)

| Item | Resolution |
|---|---|
| D-075 | **The rule stands; fix the code.** Bedroom auto-assignment prefers the dwarf with the lowest mood, as the row and `14` say. `buildings/index.ts` passes a constant mood of 55, so the tie-break never uses mood. Pass the real mood through the morale reader. Add a regression test with two unhoused dwarves of different mood. |
| D-170 (T-M6-13) | **The rule stands; fix the code.** `width` and `height` in a placement apply only to a building type whose footprint is variable (the drawbridge). For any other type the command is rejected with a reason that names the building. Add a test for each side. |
| D-249 | **The rule stands; fix the code.** A squad trains in the barracks its zone setting names. The cached `barracksZoneId` in `combat/training.ts` is refreshed when the zone setting changes, and a squad that has already trained moves to the newly assigned barracks. Add a regression test. Remove the "still trains at …" line from the military panel once this holds. |
| Catalog field cells | **Regenerate.** The command and event catalogs' field cells are brought to the real names (`buildingType`, `zoneType`, `ZoneChanged.tiles`, the `Building*` and `CreatureDied` fields) together with `src/core/command-types.ts` and `event-types.ts`, through the export scripts, so the compared files stay in step. |
| `fortification` placement | **The code stands.** A fortification is placed on a floor. Carving one out of an existing wall is not implemented, and nothing else in the spec depends on it. Change the content table's placement cell to "floor" and regenerate `src/content/buildings.json`. |

Do the three fixes first, each with its test; then the two regenerations. World hashes may move for D-075 and D-249: regenerate the named goldens with a `golden:` paragraph.
