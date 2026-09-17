# Save Format

**Detail level:** W4 · **Owner:** implementation (`core/serialize.ts`, `app/save-manager.ts`) · **Depends on:** [`../01-architecture/persistence.md`](../01-architecture/persistence.md), [schemas/system-state.md](schemas/system-state.md)

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
| `world` | JSON | `WorldMap`, chosen `regionId`, `LocalMapSpec` |
| `map.kind` … `map.tempOverride` | typed | the six grids |
| `map.buildingAt` | JSON | `[tile, entityId][]` |
| `map.chunkFluidCounts` | typed `u16` | per chunk |
| `entities` | JSON | `EntityStoreState` (component tables keyed by component name; typed arrays base64) |
| `fortress` | JSON | `FortressState` |
| `calendar` | JSON | `{ tick }` |
| `rng` | JSON | `{ streamId: [s0,s1,s2,s3] }` for every stream |
| `systems` | JSON | `{ id: { stateVersion, state } }` for every system; typed arrays inside are base64 with a `"$type"` marker |
| `commandLog` | JSON | current season's entries |
| `ui` | JSON | `UiState` |

## Serialization helpers

```
serializeValue(v): typed array → { "$type": "u8"|"u16"|"i8"|"i16"|"u32"|"i32", "$b64": base64 }; Map → sorted [k, v][] ; Set → sorted array; plain objects and arrays recursively
deserializeValue: inverse; `$type` objects become typed arrays
```

Entity ids are written as numbers with generation. Content references are written as string ids: every component field typed `Idx<…>` is converted through `registry.idOf` on save and `registry.indexOf` on load (a table of which fields are indices is generated from the component schemas).

## Load procedure

1. Read magic and versions; refuse if `formatVersion > supported`.
2. Parse header; check `contentHash`; on mismatch run the soft match (collect every string id in the save; if any is missing from the registry, fail with the list).
3. Inflate the body; parse sections into a map by name.
4. Construct `World` with the seed; `deserialize` core sections; construct systems; for each system in order call `deserialize(state)` with migration from `stateVersion` to current.
5. Run rebuild-on-load per `schemas/system-state.md`.
6. Restore `UiState`; start paused.

## Migration

Each system keeps `migrations: Record<number, (old) => new>`; `deserialize` applies them in sequence from the saved `stateVersion`. Core migrations live in `core/serialize.ts`. A migration never reads other systems' state. Fixture saves for every published `formatVersion` are kept in the test suite and loaded in CI.

## Snapshots and ids

Save ids: `manual-<unixMs>`, `auto-<year>-<season>`, `snapshot-<n>` (n = 0..3 rolling, written on `SeasonChanged` after the autosave), `final-<fortressSlug>`. The Load screen groups by kind. Deleting the four `snapshot-*` entries happens only by rolling; the player deletes manual saves explicitly.

## Export file

`<fortress-slug>-y<year>-<season>.deepholm` is the container above, unchanged. Import validates and stores it as `manual-<unixMs>`.

## Size estimate

Standard map: grids 3.5 MB raw; entities at year 3 ≈ 2.5 MB JSON; systems ≈ 0.5 MB; deflated total ≈ 1.5 MB.
