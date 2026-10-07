# Save Format

**Owner:** implementation (`core/serialize.ts`, `app/save-manager.ts`) · **Depends on:** [`../01-architecture/persistence.md`](../01-architecture/persistence.md), [schemas/system-state.md](schemas/system-state.md)

## Container

All integers little-endian.

```
offset  size   field
0       4      magic "DHLM"
4       4      formatVersion (uint32) = 1
8       4      headerLength (uint32)
12      n      header: UTF-8 JSON (see below), uncompressed
12+n    4      bodyLength (uint32) of the compressed body
16+n    m      body: deflate-raw of the section stream (or raw if header.compressed == false)
```

Section stream:

```
sectionCount (uint32)
repeat: nameLength (uint16), name (UTF-8), kind (uint8: 0 JSON, 1 typed array), byteLength (uint32), bytes
```

Typed array section names carry the element type after a colon: `map.kind:u8`, `map.material:u16`, `map.flags:u16`, `map.tempOverride:i8`, `entities.positionX:i16`, `entities.positionZ:i8`, `fluids.active:u32`, `skills.level:u8` (component typed arrays are serialized inside their JSON component tables as base64 strings to keep the entity section one JSON blob; only the large per-map arrays are raw sections).

## Header JSON

```json
{
  "formatVersion": 1, "gameVersion": "1.0.0", "seed": "…", "fortress": "Emberhall",
  "calendar": { "tick": 123456, "year": 2, "season": 1, "day": 12 },
  "contentHash": "sha256-…", "compressed": true,
  "population": 23, "wealth": 18450, "playTimeSeconds": 5400,
  "thumbnail": { "cols": 48, "rows": 27, "cells": "…base64 of glyph,fg,bg triples…" },
  "kind": "manual" | "auto" | "snapshot" | "final"
}
```

## Sections (in order)

| Name | Kind | Contents |
|---|---|---|
| `world` | JSON | `WorldMap`, chosen `regionId`, `mapSize { w, h, d }`, `arrival`, `LocalMapSpec` |
| `map.kind` … `map.tempOverride` | typed | the six grids |
| `map.buildingAt` | JSON | `[tile, entityId][]` |
| `map.chunkFluidCounts` | typed `u16` | per chunk |
| `entities` | JSON | `EntityStoreState` (`alive`, `generation`, `free` list in pop order, `positionX/Y/Z` with `positionZ = -1` for slots without `Position`, component tables `[slot, value]` by name; typed arrays base64) |
| `fortress` | JSON | `FortressState` |
| `calendar` | JSON | `{ tick, isDaylight }` |
| `rng` | JSON | `{ streamId: [s0,s1,s2,s3] }` for every stream |
| `systems` | JSON | `{ id: { stateVersion, state } }` for every system; typed arrays inside are base64 with a `"$type"` marker |
| `commandLog` | JSON | current season's entries |
| `queues` | JSON | pending `{ events, commands }` |
| `ui` | JSON | `UiState` |

## Serialization helpers

```
serializeValue(v): typed array → { "$type": "u8"|"u16"|"i8"|"i16"|"u32"|"i32", "$b64": base64 }; Map → sorted [k, v][] ; Set → sorted array; plain objects and arrays recursively
deserializeValue: inverse; `$type` objects become typed arrays
```

Entity ids are written as numbers with generation. Content references are written as string ids: every component field typed `Idx<…>` is converted through `registry.idOf` on save and `registry.indexOf` on load. The set of component id fields is parsed by `scripts/parse-id-fields.mjs` directly from `schemas/components.md` (handling nested records and `Foo[]` arrays) into `src/core/id-fields.ts` (enforced by unit tests). Only component fields are converted (system states and map grids retain their numeric indices). In component id fields, index 0 is serialized as `null`. On load, if an `orString` field (such as `WorkOrder.materialFilter`) holds a string that does not match an id in its table, it remains a plain string. The referenced content string ids collected from these component fields supply the set checked by the content soft match on load (D-026, D-080).

## Load procedure

1. Read magic and versions; refuse if `formatVersion > supported`.
2. Parse header; check `contentHash`; on mismatch run the soft match over referenced content ids (`checkContent(header, content, referencedIds)`); if any is missing from the registry, fail with the sorted list.
3. Inflate the body; parse sections into a map by name.
4. Construct `Map3D` from `world.mapSize`; restore the six grids, `map.buildingAt`, and `map.chunkFluidCounts`.
5. Construct `HeadlessGame` / `World` with the seed, map, and spec, with deferred labels (`deferLabels: true`).
6. Restore entities (`EntityStore` slots, generations, `free` list, component tables).
7. Restore `fortress` state and `calendar` (`tick` and `isDaylight`).
8. Restore RNG stream states.
9. For each system in order, call `deserialize(state)` with migration from `stateVersion` to current. (System 03 restores `pendingMoves` and `producerCurrent`; 11 restores `ticked` and reconnects producers and 13 if set). Restore `game.arrival`.
10. Rebuild-on-load:
    - Rebuild spatial buckets (`game.spatial.rebuild()`) from restored entity positions.
    - Run full map relabel / connectivity rebuild (`game.pathing.connectivity.rebuildAll()`). Chunks dirtied between ticks arise only from out-of-tick edits (tests' direct setup), never normal ticks, so the full relabel precisely matches running labels.
    - Restore 22's pathfinder requests, searches, and walks (`pathfinder.loadState`, `movement.loadState`).
    - Restore `commandLog` and pending `queues` (`events` and `commands`).
11. Restore `UiState`; start paused.

## Migration

Each system keeps `migrations: Record<number, (old) => new>`; `deserialize` applies them in sequence from the saved `stateVersion`. Core migrations live in `core/serialize.ts`. A migration never reads other systems' state. Fixture saves for every published `formatVersion` are kept in the test suite and loaded in CI.

## Snapshots and ids

Save ids: `manual-<unixMs>`, `auto-<year>-<season>`, `snapshot-<n>` (n = 0..3 rolling, written on `SeasonChanged` after the autosave), `final-<fortressSlug>`. The Load screen groups by kind. Deleting the four `snapshot-*` entries happens only by rolling; the player deletes manual saves explicitly.

## Export file

`<fortress-slug>-y<year>-<season>.deepholm` is the container above, unchanged. Import validates and stores it as `manual-<unixMs>`.

## Size estimate

Standard map: grids 3.5 MB raw; entities at year 3 ≈ 2.5 MB JSON; systems ≈ 0.5 MB; deflated total ≈ 1.5 MB.
