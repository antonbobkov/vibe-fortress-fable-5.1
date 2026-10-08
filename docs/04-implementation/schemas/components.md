# Schemas: Core Types and Components

**Owner:** implementation · **Depends on:** [`../../01-architecture/data-model.md`](../../01-architecture/data-model.md), [`../../01-architecture/module-interfaces.md`](../../01-architecture/module-interfaces.md)

TypeScript-style definitions. `Fixed` is an integer scaled by 1000. `TileIndex` and `EntityId` are numbers. `Id<T>` is a string content id; `Idx<T>` is its dense registry index. Arrays marked `sorted` are kept in ascending order.

```ts
// ---------- core scalars ----------
type Fixed = number;                 // integer, scale 1000
type TileIndex = number;             // (z*H + y)*W + x
type EntityId = number;              // bits 0-23 index, 24-31 generation
type ChunkIndex = number;
type Tick = number;
type Permille = number;              // 0..1000
type Percent = number;               // 0..100 integer
type Season = 0 | 1 | 2 | 3;         // spring, summer, autumn, winter
type Edge = 'n' | 'e' | 's' | 'w';
type Civ = 'mountainhome' | 'hillfolk' | 'wildwood' | 'gloam';
type Faction = 'fortress' | 'wild' | 'deep' | `hostile:${Civ}` | `trader:${Civ}`;
type MovementClass = 'walker' | 'small' | 'large' | 'aquatic' | 'amphibious';
type BodySlot = 'head' | 'torso' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg';
type DamageType = 'edge' | 'blunt' | 'pierce';
type WoundType = 'cut' | 'puncture' | 'bruise' | 'fracture' | 'burn' | 'frost' | 'wasting';
type Severity = 'light' | 'serious' | 'grievous';
type Quality = 0 | 1 | 2 | 3 | 4 | 5;  // poor, common, fine, superior, exceptional, masterwork
type RoomTier = 0 | 1 | 2 | 3 | 4 | 5;  // bare, modest, decent, fine, grand, royal
type MoodTier = 0 | 1 | 2 | 3 | 4;      // miserable, unhappy, fine, content, ecstatic
type Alert = 'calm' | 'watchful' | 'hearth';
type Priority = 1|2|3|4|5|6|7|8|9;

// ---------- Map3D ----------
const enum TileKind { Open=0, Wall=1, Floor=2, Ramp=3, StairsUp=4, StairsDown=5, StairsUpDown=6,
                      Fortification=7, Tree=8, Sapling=9, Shrub=10, Boulder=11 }
const enum Designation { None=0, Dig=1, Channel=2, StairsUp=3, StairsDown=4, StairsUpDown=5, Ramp=6,
                         Smooth=7, Engrave=8, Remove=9, Chop=10, Gather=11, Harvest=12 }
const enum TileFlag { Discovered=1<<0, Constructed=1<<1, Smoothed=1<<2, Engraved=1<<3, Mud=1<<4,
                      Snow=1<<5, Grass=1<<6, Ash=1<<7, Burning=1<<8, Outdoor=1<<9, Lit=1<<10,
                      Restricted=1<<11, Web=1<<12, Wet=1<<13 }
// fluid byte: bits 0-2 level, bit 3 type (0 water 1 magma), bit 4 settled, bit 5 source, bit 6 frozen, bit 7 reserved
interface Map3D {
  w: number; h: number; d: number;
  kind: Uint8Array; material: Uint16Array; fluid: Uint8Array;
  designation: Uint8Array;           // low nibble Designation, high nibble priority
  flags: Uint16Array; tempOverride: Int8Array;
  buildingAt: Map<TileIndex, EntityId>;
  chunks: ChunkRecord[];
}
interface ChunkRecord { dirtyRender: boolean; dirtyPath: boolean; activeFluidCount: number;
                        entities: EntityId[] /* sorted */; }

// ---------- entities ----------
type Kind = 'creature' | 'item' | 'building' | 'zone' | 'stockpile' | 'squad' | 'party' | 'projectile' | 'crop' | 'room';

interface Position { x: number; y: number; z: number }              // SoA: Int16Array x, y; Int8Array z
interface Motion { pathId: number; stepIndex: number; progress: Fixed; speed: Fixed;
                   movementClass: MovementClass /* SoA Uint8 code, decoded on get */; repathCount: number; waitUntil: Tick }
interface Creature { species: Idx<SpeciesDef>; name: string; sex: 0|1; ageTicks: number;
                     faction: Faction; sizeClass: number /* species.size */; bodyPlan: Idx<BodyPlanDef> }
interface Wound { type: WoundType; severity: Severity; bleed: Fixed; pain: number; healRemaining: number;
                  bandaged: boolean; sutured: boolean; splinted: boolean; cleaned: boolean; dressed: boolean;
                  infected: boolean; infectedSince: Tick; createdTick: Tick }
interface BodyPart { hp: number; maxHp: number; wounds: Wound[]; destroyed: boolean }
interface Body { parts: BodyPart[]; /* length 6, BodySlot order */ blood: number; maxBlood: number;
                 pain: number; conscious: boolean; permanent: string[]; diagnosed: boolean }
interface Attributes { str: number; agi: number; tou: number; end: number; wil: number; wit: number; cha: number }
interface Skills { level: Uint8Array; xp: Uint16Array; lastRaised: Idx<SkillDef> }
interface Needs { hunger: number; thirst: number; rest: number; social: number; comfort: number; purpose: number; joy: number }
interface Personality { traits: [Idx<TraitDef>, Idx<TraitDef>, Idx<TraitDef>] }
interface Schedule { sleepStartHour: number; sleepHours: number }
interface Relationships { friends: EntityId[]; grudges: { id: EntityId; untilTick: Tick }[];
                          talkCount: [EntityId, number][]; spouse: EntityId; pets: EntityId[] }
interface Title { title: 'none' | 'thane' | 'warden' | 'broker' | 'chief_medic' } // caches first held role; 10's saved per-role holders are authoritative
interface Brain { behavior: 'flee' | 'retreat' | 'patient' | 'need' | 'duty' | 'work' | 'social' | 'idle';
                  behaviorUntil: Tick /* idle wait or cornered civilian combat deadline */; targetTile: TileIndex; activity: string; lastMistTick: Tick;
                  lastOutdoorThoughtHour: number; daysUnderground: number }
interface Labors { enabled: Uint8Array /* bitset over labor indices */ }
interface Worker { jobId: number; phase: number; carrying: EntityId; toolId: EntityId }
interface ActiveThought { thought: Idx<ThoughtDef>; startTick: Tick; baseValue: number }
interface Mood { value: number; tier: MoodTier; thoughts: ActiveThought[]; sulkCounterDays: number }
interface Equipment { weapon: EntityId; shield: EntityId; armor: Record<'head'|'body'|'arms'|'legs'|'feet', EntityId>;
                      clothing: Record<'body'|'legs'|'feet'|'over', EntityId>; quiver: EntityId }
interface Soldier { squadId: EntityId; onDuty: boolean; stance: 'hold' | 'pursue'; targetId: EntityId;
                    cooldownUntil: Tick; lastShiftTick: Tick }
interface Patient { hospitalZoneId: EntityId; bedId: EntityId; needs: string[] /* job kinds */; admittedTick: Tick }
const enum ItemFlag { Forbidden=1, Dump=2, Melt=4, Reserved=8, Owned=16, AtDepot=32, Merchant=64, Installed=128 }
interface Item { type: Idx<ItemTypeDef>; material: Idx<MaterialDef>; quality: Quality; wear: number; count: number;
                 containerId: EntityId; ownerId: EntityId; flags: number; crafterId: EntityId;
                 rotStart: Tick; rotStage: 0|1|2|3; reservedBy: number /* jobId */; carriedBy: EntityId }
interface Container { contents: EntityId[]; capacity: number; classId: 'barrel'|'bag'|'bin'|'chest'|'bucket'|'cage'|'wagon' }
interface Corpse { species: Idx<SpeciesDef>; diedTick: Tick; wornItems: EntityId[]; dwarfName: string | null; juvenile?: boolean }
interface Building { type: Idx<BuildingDef>; material: Idx<MaterialDef>; state: 'planned'|'constructing'|'built';
                     origin: TileIndex; footprint: TileIndex[]; orientation: 0|1|2|3; itemId: EntityId;
                     mode: string; /* door mode, hatch mode, trap mode */ linkedIds: EntityId[]; ownerId: EntityId;
                     settings: Record<string, unknown>; toggled: boolean /* bridge raised, floodgate open, lever on */ }
interface WorkOrder { recipe: Idx<RecipeDef>; remaining: number; mode: 'once'|'maintain'; threshold: number;
                      priority: Priority; materialFilter: Idx<MaterialDef> | string | null }
interface Workshop { orders: WorkOrder[]; currentJobId: number; suspended: boolean; assignedWorker: EntityId;
                     magmaPowered: boolean; lastBlockedReason: string | null }
interface Zone { type: Idx<ZoneTypeDef>; tiles: TileIndex[] /* sorted */; settings: Record<string, unknown> }
interface StockpileFilter { categories: string[]; materialClasses: string[] | 'any'; minQuality: Quality; maxQuality: Quality; allowRot: boolean }
interface Stockpile { filter: StockpileFilter; containersWanted: { barrel: number; bag: number; bin: number };
                      priority: Priority; linkedSources: EntityId[] }
interface Room { zoneId: EntityId; score: number; tier: RoomTier; ownerId: EntityId; enclosed: boolean; requirementsMet: boolean }
interface Squad { name: string; leaderId: EntityId; members: EntityId[]; mode: 'off'|'train'|'active';
                  station: TileIndex | null; patrol: TileIndex[] | null;
                  equipment: { weaponClass: string | 'any'; armor: 'metal'|'leather'|'any'; ranged: boolean };
                  orders: SquadOrder[]; barracksZoneId: EntityId }
type SquadOrder = { kind: 'kill'; targetId: EntityId } | { kind: 'station'; tile: TileIndex }
                | { kind: 'patrol'; tiles: TileIndex[] } | { kind: 'follow'; dwarfId: EntityId };
interface Party { civ: Civ | 'deep' | 'none'; purpose: 'thief'|'bandits'|'ambush'|'raid'|'siege'|'restless'|'caravan';
                  members: EntityId[]; leaderId: EntityId; state: string; goalTile: TileIndex; goalEntity: EntityId;
                  arrivedTick: Tick; stateSince: Tick; loot: EntityId[]; edge: Edge; size: number }
interface Hostile { partyId: EntityId; role: string; behaviorState: string; stealthed: boolean; spotted: boolean;
                    breakingDoorId: EntityId; breakingSince: Tick }
interface Tame { pastureId: EntityId; condition: number; trained: 'none'|'war'|'hunting'; assignedTo: EntityId;
                 pregnantUntil: Tick; lastProductTick: Record<string, Tick>; juvenileUntil: Tick; slaughter: boolean;
                 petOf: EntityId; noBreed: boolean }
interface Wild { state: string; homeChunk: ChunkIndex; stateUntil: Tick; hungry: boolean; lastThinkTick: Tick; arrivedTick: Tick }
interface Projectile { itemId: EntityId; from: TileIndex; to: TileIndex; progress: Fixed; shooterId: EntityId;
                       targetId: EntityId; hitRoll: number; damage: number; damageType: DamageType; line: TileIndex[] }
interface Crop { plotZoneId: EntityId; plant: Idx<PlantDef>; stage: 0|1|2|3; growth: number; tile: TileIndex }
interface Merchant { partyId: EntityId; goods: EntityId[] }
```

## Component ownership table

| Component | Owner | Written also by |
|---|---|---|
| `Kind`, `Position` | core | spawn API, movement helper |
| `Motion` | 22 | brains set `speed` through `pathing.setSpeed` |
| `Creature` | spawner | 10 (name, age), 21 |
| `Body`, `Patient` | 17 | — |
| `Attributes`, `Skills`, `Needs`, `Personality`, `Schedule`, `Relationships`, `Title`, `Brain` | 10 | 02 and 21 at creation through the spawn API |
| `Labors`, `Worker` | 11 | — |
| `Mood` | 15 | — |
| `Equipment`, `Soldier`, `Squad`, `Projectile` | 16 | 09 sets the hunter's quiver through 16's API |
| `Item`, `Container`, `Corpse`, `Stockpile` | 13 | flags through the item API |
| `Building`, `Zone`, `Room` | 14 | `toggled` and `mode` through 14's commands and `MechanismTriggered` |
| `Workshop` | 12 | — |
| `Party`, `Hostile` | 18 (caravan parties: 20) | — |
| `Tame`, `Wild` | 08 | — |
| `Crop` | 07 | — |
| `Merchant` | 20 | — |

## Fortress state

```ts
interface FortressState {
  name: string; embarkTick: Tick; regionId: number;
  wealthCached: number; populationCached: number; hallSpiritCached: number;
  alert: Alert; deepPressure: number; deepLevel: number;
  reputation: Record<Civ, number>; populationCap: number;
  milestones: { id: string; tick: Tick }[];
  hintsShown: string[]; deepsilverConfirmed: boolean;
}
```

## Calendar

```ts
interface CalendarState { tick: Tick }   // everything else is derived:
// hour = floor(tick / TICKS_PER_HOUR) % HOURS_PER_DAY
// dayIndex = floor(tick / TICKS_PER_DAY); dayOfYear = dayIndex % DAYS_PER_YEAR + 1
// season = floor((dayOfYear - 1) / DAYS_PER_SEASON); dayOfSeason = (dayOfYear - 1) % DAYS_PER_SEASON + 1
// year = floor(dayIndex / DAYS_PER_YEAR) + 1
```
