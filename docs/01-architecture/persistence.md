# Persistence

**Owner:** architecture (`app/save-manager.ts`, `core/serialize.ts`, `platform/storage.ts`) · **Depends on:** [simulation-core.md](simulation-core.md), [data-model.md](data-model.md), [content-pipeline.md](content-pipeline.md)

## What is saved

A save is the complete state needed to continue the simulation deterministically:

| Section | Contents | Producer |
|---|---|---|
| `header` | format version, game version, world seed, fortress name, calendar, content hash, thumbnail (a 48×27 cell ASCII snapshot of the surface), play time | app |
| `world` | the world map (regions), chosen region id, `mapSize { w, h, d }`, `arrival` position, and `LocalMapSpec` | 01 |
| `map` | every `Map3D` grid, chunk fluid counts | core |
| `entities` | the entity store: alive slots with generations, `free` slot list (in pop order), `positionZ` (-1 if no `Position`), every component table `[slot, value]` | core |
| `fortress` | fortress-level state | core |
| `calendar` | tick, `isDaylight`, and derived fields | core |
| `rng` | every stream's state | core |
| `systems` | one entry per system: `id`, `stateVersion`, `serialize()` output | each system |
| `commandLog` | commands of the current season with tick and result | core |
| `queues` | pending `events` and `commands` submitted between ticks or after drain | core |
| `ui` | viewport position, z-level, zoom, open panel, overlay toggles, hints shown | app |

Content is not saved; it is identified by hash.

When commands have dirtied connectivity before the next connectivity pass, the pathing state also saves the current local labels, component counts and outgoing portals of those chunks and their 26 neighbours, together with the dirty chunk set. Loading rebuilds the other derived state, restores this pending snapshot and reconstructs its global labels before restoring requests and walks. The dirty chunks are refreshed by the normal tick pass, so the first resumed system tick sees the same queries as an uninterrupted game. A clean save omits this optional snapshot; older saves retain the ordinary rebuild-on-load procedure.

## Container format

A save is a single binary blob:

```
magic "DHLM"  (4 bytes)
formatVersion (uint32)
headerLength  (uint32)
header JSON   (UTF-8)
bodyLength    (uint32)
body:         sectionCount (uint32), then per section: nameLength, name, kind (0 = JSON, 1 = typed array), byteLength, bytes
```

Typed arrays are written raw with their element type in the section name (`map.kind:u8`). The body is compressed with `CompressionStream('deflate-raw')` when available. The header stays uncompressed so the load screen can list saves without inflating them. The byte-level layout is in [`../04-implementation/save-format.md`](../04-implementation/save-format.md).

## Serialization rules

- `serialize()` returns plain data: numbers, strings, booleans, arrays, plain objects, and typed arrays. No class instances, no `Map` or `Set` (convert to sorted arrays), no functions.
- Entity ids are stored as-is (with generation). Content is stored by string id. Tile positions as tile indices.
- Every system state carries `stateVersion`; the system's `deserialize` migrates older versions forward. Migrations are additive and tested with fixture saves.
- `deserialize` must not call readers of other systems; cross-system caches are rebuilt on the first `tick` (systems keep a `needsRebuild` flag).

## Storage

`platform/storage.ts` wraps IndexedDB with three object stores:

- `saves` — key: save id; value: the blob plus a header copy for listing.
- `legends` — key: fortress id; value: the legend record (see 24 UI).
- `settings` — key: `settings`; value: player settings and keymap overrides.

Save ids: `manual-<unixMs>`, `auto-<year>-<season>`, `snapshot-<n>`, `final-<fortressSlug>`.

## Autosave and snapshots

- `F5` writes a manual save; `F9`, after confirmation, loads the newest manual save.
- `SeasonChanged` records an autosave request; `InProcessHost.afterTick` takes it after the tick ends as `auto-<year>-<season>`. Rotation keeps the four newest by tick and deletes older autosaves.
- A manual save is never deleted automatically.
- The Load screen lists manual saves and autosaves separately, with the header thumbnail, date, population and wealth.
- Saving runs synchronously on the simulation (the world is paused for the duration of `serialize`, which is under `1 s` by budget) and asynchronously for compression and storage.

## Export and import

- Export writes the blob as a file `<fortress-slug>-y<year>-<season>.deepholm` through a Blob download.
- Import reads a file, validates magic and version, checks the content hash (soft match rules in `content-pipeline.md`), and stores it as a manual save.

## Legends

When a fortress ends (all dwarves dead, or retired), the app writes a legend record: name, seed, region, years, peak population, deepest z, final wealth, milestones with dates, the last 50 announcements of severity alert or danger, and the cause of end. The save is kept as `final-<fortress>` and can be loaded read-only (viewing only; commands are rejected).

## Determinism and saves

Loading bootstraps readers, services and registrations without creating initial populations or their map side effects. Saved entities and system state supply those populations. The restored map retains its saved Web flags, including authentic spider webs; newly carved cavern floors do not acquire webs from a temporary initialization pass.

The save/load determinism test in `simulation-core.md` is the contract: loading a save and running N ticks produces the same world hash as running N ticks without saving. Anything that breaks this is a bug in `serialize`/`deserialize`, usually an unsaved cache or an iteration-order dependency.

## Failure handling

- Storage quota exceeded: the app keeps the game running, shows a danger-severity announcement, and offers export.
- Corrupt save: the load screen marks it unreadable with the failing section; other saves are unaffected.
- Version too new: refused with a message naming the required game version.
