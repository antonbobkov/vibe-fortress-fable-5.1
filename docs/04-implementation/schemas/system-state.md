# Schemas: System State

**Owner:** implementation · **Depends on:** [components.md](components.md), the `State` sections of every document in [`../../02-systems/`](../../02-systems/README.md)

What each system's `serialize()` returns. Every state object carries `stateVersion: number` (starts at 1). Rng streams are `{ s: [number, number, number, number] }`. Sorted sets are plain sorted arrays.

```ts
interface WorldgenState { stateVersion: 1; world: WorldMap }
interface WorldMap { size: number; seed: string; regions: RegionRecord[]; civHomes: Record<Civ, number>; rivers: { id: number; regions: number[]; class: string }[] }
interface RegionRecord { id: number; elevation: number; tempC: number; rain: number; biome: Id<BiomeDef>; geology: string; volcano: boolean;
  river: { inflow: Edge[]; outflow: Edge | null; class: 'brook'|'river'|'major' } | null; lake: boolean; deepness: number;
  wealth: number; peril: number; temper: number; traits: Id<RegionTraitDef>[]; civDistance: Record<Civ, number>; nearestEdgeTo: Record<Civ, Edge>; name: string }

interface EmbarkState { stateVersion: 1; spec: LocalMapSpec }   // the session state is not part of the world
interface LocalMapSpec { seed: string; regionId: number; biome: Id<BiomeDef>; elevation: number; relief: 0|1|2|3; soilDepth: number; geology: string;
  wealth: number; peril: number; temper: number; deepness: number; traits: Id<RegionTraitDef>[]; volcano: boolean;
  river: { inflowEdges: Edge[]; outflowEdge: Edge | null; class: string } | null; lake: boolean; civEdges: Record<Civ, Edge>; arrivalEdge: Edge }

interface TerrainState { stateVersion: 1; designations: { tile: TileIndex; kind: Designation; priority: Priority; progress: Fixed }[];
  engravings: [TileIndex, { quality: Quality; engraverId: EntityId; motif: number }][]; forbiddenTiles: TileIndex[];
  cavernBreached: [boolean, boolean, boolean]; veinsFound: TileIndex[] /* sorted vein keys */; layerStack: { material: Idx<MaterialDef>; thickness: number }[]; rng: RngState; bigDigCounter: number;
  pendingTerrain?: { changed: TileIndex[]; discovered: TileIndex[]; litDirty: number[] /* z levels */ } }
// pendingTerrain arrays are sorted and unique; absent means no deferred batch. Serialization and loading do not flush terrain work.

interface FluidsState { stateVersion: 1; active: Uint32Array /* tile indices, all chunks concatenated */; activeChunkOffsets: Uint32Array;
  idleCounter: Uint8Array /* parallel to active */; waterSources: TileIndex[]; magmaSources: TileIndex[]; sinks: TileIndex[]; outdoorWaterTiles: TileIndex[];
  frozenOriginalKind: [TileIndex, TileKind][]; frozenOriginalMaterial?: [TileIndex, number][]; frozenIceKind?: [TileIndex, TileKind][];
  freezePending: boolean; mistTiles: [TileIndex, Tick][]; mistNow?: Tick; equalizeCounts?: [TileIndex, number][]; stepParity: 0|1; spreadRotation: 0|1|2|3; rng: RngState }

interface MaterialsState { stateVersion: 1; burning: [TileIndex, { remainingTicks: number; spreadCooldown: number }][]; warmSprings: TileIndex[];
  magmaSourceChunks: ChunkIndex[]; magmaSignatures: [ChunkIndex, number][]; started: boolean; pendingChunks: ChunkIndex[];
  forced: [TileIndex, number][]; pendingIgnite: TileIndex[]; itemBurn: [EntityId, number][]; rng: RngState }

interface WeatherState { stateVersion: 1; state: string; stateEndsTick: Tick; surfaceTempCached: number; growthModifierCached: Percent;
  snowCoveredChunks: ChunkIndex[]; wetChunks: [ChunkIndex, Tick][]; started: boolean; forced: string | null;
  rainHours: number; isDaylightCached: boolean; rng: RngState }

interface PlantsState { stateVersion: 1; cropAtTile: [TileIndex, EntityId][]; plotIndex: EntityId[]; saplings: [TileIndex, Tick][];
  shrubTimers: [TileIndex, Tick][]; bareSoil: TileIndex[]; ashTiles: [TileIndex, Tick][]; needsSeedsAnnounced: [EntityId, Season][]; rng: RngState }

interface AnimalsState { stateVersion: 1; breedingCaps: [Idx<SpeciesDef>, number][]; speciesCounts: [Idx<SpeciesDef>, { wild: number; tame: number }][];
  nestBoxes: EntityId[]; caged: [EntityId /* cage item */, EntityId /* creature, kept as a dormant entity */][]; initializedCaverns?: number[]; rng: RngState }

interface ForagingState { stateVersion: 1; huntable: Idx<SpeciesDef>[]; hunterAssignments: [EntityId, EntityId][];
  waterBodies: { id: number; version: number; tileCount: number; fishPool: Fixed; kind: 'river'|'lake'|'cavern' }[]; bodyOfTile: [TileIndex, number][];
  bodiesStale: boolean; version: number; nextBodyId: number; nextFishTick: [EntityId, Tick][]; dailyDue: boolean; rng: RngState }

interface ActivityPlan { need: string; phase: 'travel'|'seat'|'use'; itemId: EntityId; partner: EntityId; target: TileIndex; until: Tick;
  ownBed: boolean; atTable: boolean; roomTier: number; startedRest: number; hall?: true /* a hall errand taken at LEISURE_MARK; its `partner` is the talk partner found from the seat */ }
interface DwarvesState { stateVersion: 1; titles: Record<'thane'|'warden'|'broker'|'chief_medic', EntityId>; populationCached: number; children: EntityId[];
  wagonTile: TileIndex; interruptFlags: EntityId[]; hungerMaxSince: [EntityId, Tick][]; thirstMaxSince: [EntityId, Tick][];
  starvingAnnounced: [EntityId, number][]; activities?: [EntityId, ActivityPlan][]; idleAnnounced?: EntityId[]; sawMasterworks?: [EntityId, EntityId][];
  needRetryUntil?: [EntityId, NeedName, Tick][]; shutOut?: EntityId[]; shelterCheckPending?: boolean; threatened?: [EntityId, { hostileId: EntityId; tick: Tick; tile?: TileIndex; caught?: true }][];
  talks?: [EntityId, EntityId, Tick][] /* talks in passing: lower id, higher id, end tick; absent means none */; hearthTicks?: [EntityId, number][] /* ticks eaten, drunk and sat in the hearth hall toward the next hearth visit; absent means none */; hallRetryUntil?: [EntityId, Tick][] /* no hall errand before this tick; absent means none */; rng: RngState }
// A rest activity's itemId holds its chosen bed during travel/use; 0 means floor sleep. Patient.bedId is the corresponding hospital hold.
// A stay for a talk in passing is an ActivityPlan with need 'social', phase 'use', partner 0 and until = the talk's end tick.

interface JobsState { stateVersion: 1; jobs: Job[]; nextJobId: number; laborPriorities: Uint8Array; standingOrders: Record<string, boolean>;
  assignQueue: EntityId[]; blockedRetryCursor: number }
interface Job { id: number; key: string; type: Idx<JobTypeDef>; producer: string; priority: Priority;
  target: { kind: 'tile'|'entity'|'building'|'zone'|'pair'; ref: number; ref2?: number }; workTile: TileIndex | 'adjacent' | 'at';
  inputs: { filter: ItemFilter; count: number; wholeItem?: true /* reserve the whole stack, retained on save */; reserved: EntityId[]; delivered: EntityId[] }[]; tool: 'pick'|'axe'|'ranged'|'bucket'|null;
  state: 'open'|'claimed'|'fetching'|'travelling'|'working'|'completing'|'blocked'|'cancelled'|'done';
  blockedReason: string | null; failedWalk?: true /* wait for a reachability trigger */; retryTick: Tick; workerId: EntityId; progress: Fixed; createdTick: Tick; claimedTick: Tick; data: Record<string, unknown> }
// Job.data.inputsInvalidated?: true remembers a destroyed input already pruned from the lists, until the next delivered-input validation; absent means no pending invalidation.
interface ItemFilter { itemId?: EntityId; type?: Idx<ItemTypeDef>; types?: Idx<ItemTypeDef>[]; category?: string; tag?: string; materialClass?: MaterialClass; materialId?: Idx<MaterialDef>;
  minQuality?: Quality; edible?: boolean; drinkable?: boolean; emptyContainer?: string; unoccupied?: boolean; excludeIds?: EntityId[] }

interface WorkshopsState { stateVersion: 1; globalOrders: WorkOrder[]; nextOrderSerial?: number /* absent means 0; never reuse a removed serial */; professionCache: [EntityId, string][]; rng: RngState }

interface ItemsState { stateVersion: 1; wantsHauling: EntityId[]; noHome: EntityId[]; slotReservations: [string, number][];
  rotQueue: { bucketTick: Tick; items: EntityId[] }[]; miasmaTiles: [TileIndex, Tick][]; counts: [Idx<ItemTypeDef>, StockCount][];
  wealthCached: number; wealthLastEmitted: number; stockpileTiles: [TileIndex, EntityId][]; explicitPriority: EntityId[]; // ascending ids whose haul priority the player set
  dirtyTypes: number[]; fullStockpiles: EntityId[]; buildingWealth: number;
  pendingDeaths: { id: EntityId; species: number; tile: TileIndex; name: string | null; wornItems: EntityId[]; foreign?: boolean }[]; rng: RngState }
interface StockCount { total: number; available: number; byClass: [MaterialClass, number][]; byQuality: number[] }

interface BuildingsState { stateVersion: 1; zoneAt: [TileIndex, EntityId][]; hearthId: EntityId; depots: EntityId[]; coffins: EntityId[];
  dirtyRooms: EntityId[]; pendingToggles: { id: EntityId; on: boolean; atTick: Tick }[]; pendingJobs: EntityId[]; magmaTouched?: TileIndex[]; lampLight?: { tile: TileIndex; count: number; baseLit: boolean }[]; rng: RngState }   // pendingJobs: buildings waiting for their build or deconstruct job; magmaTouched: tiles `MagmaContact` named, for 14's next tick

interface MoraleState { stateVersion: 1; hallSpirit: number; hallSpiritTier: MoodTier; rng: RngState; hourlyDue: boolean /* pending initial or hourly recomputation */ }

interface CombatState { stateVersion: 1; alert: Alert; engagements: [EntityId, Tick][]; targets: [EntityId, EntityId][]; nextSquadName: number; unreachableSince?: [EntityId, Tick][]; threatThrottles?: [EntityId, Tick][]; rng: RngState }   // unreachableSince: when each creature's approach to its target first failed (16 § Targeting)

interface HealthState { stateVersion: 1; wounded: EntityId[]; hospitals: EntityId[]; patientJobs: [EntityId, string[]][]; pendingTreatments?: [EntityId, string[]][]; rng: RngState }   // failed still-needed wound treatment kinds, independent of Patient; targets sorted by id, unique kinds sorted lexically; omitted when empty, absent in older saves means no pending requests

interface ThreatsState { stateVersion: 1; schedule: [string, { nextTick: Tick; earliestTick: Tick; pendingSpawnTick: Tick }][]; renown: Fixed;
  deepsilverTiles: TileIndex[]; cavernSpawnCounts: [Idx<SpeciesDef>, number][]; webs: [TileIndex, EntityId][]; namedCaptains: [string, EntityId][]; rng: RngState }

interface DefenseState { stateVersion: 1; traps: [EntityId, { kind: string; mode: 'enemies'|'all'; state: 'armed'|'spent'|'jammed'; loaded: EntityId[] }][];
  trapTiles: [TileIndex, EntityId][]; plates: [EntityId, { lastState: boolean; lastEdgeTick: Tick }][]; chains: [EntityId, EntityId][]; rng: RngState }

interface TradeState { stateVersion: 1; schedule: Record<Civ, { nextArrivalTick: Tick; banUntilYear: number }>; activeCaravan: EntityId;
  requests: Record<Civ, { item: Idx<ItemTypeDef>; material: Idx<MaterialDef> | 0; priority: 1|2|3 }[]>; depotItems: EntityId[]; merchantItems: EntityId[];
  session: { depotId: EntityId; traderId: EntityId; merchantId: EntityId; give: [EntityId, number][]; take: [EntityId, number][] } | null;
  lastBrought: Record<Civ, Idx<ItemTypeDef>[]>; reputationLog: { civ: Civ; delta: number; reason: string; tick: Tick }[]; rng: RngState }

interface ImmigrationState { stateVersion: 1; wavesSoFar: number; guaranteedDone: [boolean, boolean]; lastWave: { tick: Tick; count: number } | null;
  deferredUntilTick: Tick; lastSkipReason: string | null; rng: RngState }

interface PathingState { stateVersion: 1; pathfinder: unknown; movement: unknown; pendingConnectivity?: PendingConnectivityState }   // pathfinder: every unreleased request with its path, each in-progress search, the queue order, the next request id, the path cache in LRU order; movement: the walks in progress. Labels and spatial buckets are rebuilt on load, with a pending connectivity snapshot restored when present; Motion components are saved with entities
interface PendingConnectivityState { dirty: ChunkIndex[]; classes: { cls: MovementClass; chunks: { chunk: ChunkIndex; local: number[]; count: number; portals: number[] }[] }[] }   // dirty chunks and their 26 neighbours, sorted by chunk; local labels in row-major tile order; portals as flat tile pairs
interface CoreState { map: Map3D; entities: EntityStoreState; calendar: CalendarState; fortress: FortressState; rngSeed: string; commandLog: CommandLogEntry[] }
interface EntityStoreState { slots: { generation: number; alive: boolean; kind: Kind }[]; components: Record<string, [number /* index */, unknown][]>; positionX: Int16Array; positionY: Int16Array; positionZ: Int8Array }
interface CommandLogEntry { tick: Tick; command: Command; ok: boolean; reason?: string }
interface UiState { camX: number; camY: number; z: number; zoom: number; panel: string | null; overlays: string[]; deepFound?: boolean; hintUnreachableSince?: [number, Tick][]; workshopIdleNotes?: number[]; logTail: { tick: Tick; severity: string; text: string; focus?: number; category?: string }[] }
```

The optional UI unreachable-job clocks and missing-input workshop-note suppression ids default to empty for older saves. They are presentation state, omitted when empty; clocks are keyed by job id and notes by workshop id.

## Rebuild-on-load rules

After `deserialize`, before the first tick, each system rebuilds derived structures that are not saved:

| System | Rebuilt |
|---|---|
| 04 | per-chunk `activeFluidCount` from `active` |
| 05 | property typed arrays from the registry |
| 11 | `byKey`, `byWorker`, `byTarget` maps from `jobs` |
| 12 | recipe registry (content + generated + registered sets) |
| 13 | `itemsAtTile` (from the spatial index), `counts` are saved but verified against entities in a debug build |
| 14 | `buildingAt` in `Map3D` is saved; room caches from `Room` components |
| 22 | connectivity labels and spatial buckets. When `pendingConnectivity` is present, restore its local labels, counts and portals over the rebuilt labels, reconstruct global labels and retain its dirty chunks until the normal tick pass. The requests, in-progress searches, walks and path cache are saved and restored afterwards, so that a loaded game continues exactly (`22` § State, `simulation-core.md` § Determinism) |
| 23/24 | atlases, cell buffers |
