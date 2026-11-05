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
                  lastOutdoorThoughtHour: number; daysUnderground: number;
                  fireFlight?: Tick /* last tick in danger from fire or fleeing it; absent before the first flight and in older saves */ }
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
                 rotStart: Tick; rotStage: 0|1|2|3; reservedBy: number /* jobId or eating/drinking dwarfId */; carriedBy: EntityId;
                 stone?: Idx<MaterialDef> /* the gem set in a channel (25); absent: none */;
                 enchant?: ItemEnchant /* the stone set in a weapon, armor piece or ammunition (25); absent: none */ }
interface ItemEnchant { id: Idx<EnchantDef>; tier: Quality /* the setting's quality roll; scales the row's numbers */ }
interface Container { contents: EntityId[]; capacity: number; classId: 'barrel'|'bag'|'bin'|'chest'|'bucket'|'cage'|'wagon' }
interface Corpse { species: Idx<SpeciesDef>; diedTick: Tick; wornItems: EntityId[]; dwarfName: string | null; juvenile?: boolean }
interface Building { type: Idx<BuildingDef>; material: Idx<MaterialDef>; state: 'planned'|'constructing'|'built';
                     origin: TileIndex; footprint: TileIndex[]; orientation: 0|1|2|3; itemId: EntityId;
                     mode: string; /* door mode, hatch mode, trap mode */ linkedIds: EntityId[]; ownerId: EntityId;
                     settings: Record<string, unknown>; toggled: boolean /* bridge raised, floodgate open, lever on */ }
interface WorkOrder { serial?: number /* stable global identity */; recipe: Idx<RecipeDef>; remaining: number; mode: 'once'|'maintain'; threshold: number;
                      priority: Priority; materialFilter: Idx<MaterialDef> | string | null;
                      targetType?: Idx<ItemTypeDef> /* a transform recipe's input 0 narrowed to one type; absent: any */ }
interface Workshop { orders: WorkOrder[]; currentJobId: number; suspended: boolean; assignedWorker: EntityId;
                     magmaPowered: boolean; lastBlockedReason: string | null }
interface Zone { type: Idx<ZoneTypeDef>; tiles: TileIndex[] /* sorted */; settings: Record<string, unknown> }
interface StockpileFilter { categories: string[]; materialClasses: string[] | 'any'; minQuality: Quality; maxQuality: Quality; allowRot: boolean }
interface Stockpile { filter: StockpileFilter; containersWanted: { barrel: number; bag: number; bin: number };
                      priority: Priority; linkedSources: EntityId[] }
interface Room { zoneId: EntityId; score: number; tier: RoomTier; ownerId: EntityId; enclosed: boolean; requirementsMet: boolean }
interface Squad { name: string; leaderId: EntityId; members: EntityId[]; mode: 'off'|'train'|'active';
                  station: TileIndex | null; patrol: TileIndex[] | null;
                  equipment: { weaponClass: string | 'any'; armor: 'metal'|'leather'|'any'; ranged: boolean;
                               draughts?: string[] /* draught item ids in the order they are drunk (25); absent: none */ };
                  orders: SquadOrder[]; barracksZoneId: EntityId }
type SquadOrder = { kind: 'kill'; targetId: EntityId } | { kind: 'station'; tile: TileIndex }
                | { kind: 'patrol'; tiles: TileIndex[] } | { kind: 'follow'; dwarfId: EntityId };
interface Party { civ: Civ | 'deep' | 'none'; purpose: 'thief'|'bandits'|'ambush'|'raid'|'siege'|'restless'|'caravan';
                  members: EntityId[]; leaderId: EntityId; state: string; goalTile: TileIndex; goalEntity: EntityId;
                  arrivedTick: Tick; stateSince: Tick; loot: EntityId[]; edge: Edge; size: number; escapedLootCount?: number; captainIds?: EntityId[]; animalCarriers?: Record<EntityId, EntityId>; goalIdleSince?: Tick; ambushSprung?: boolean; blowSince?: Tick; stalled?: boolean }
interface Hostile { partyId: EntityId; role: string; behaviorState: string; stealthed: boolean; spotted: boolean;
                    breakingDoorId: EntityId; breakingSince: Tick;
                    retreat?: { stateSince: Tick; goalTile: TileIndex; bestDistance: number; progressSince: Tick } }
interface Tame { pastureId: EntityId; condition: number; trained: 'none'|'war'|'hunting'; assignedTo: EntityId;
                 pregnantUntil: Tick; lastProductTick: Record<string, Tick>; juvenileUntil: Tick; slaughter: boolean;
                 petOf: EntityId; noBreed: boolean }
interface Wild { state: string; homeChunk: ChunkIndex; stateUntil: Tick; hungry: boolean; lastThinkTick: Tick; arrivedTick: Tick; defendFrom?: TileIndex; unseenSince?: Tick; pendingMeal?: EntityId; mealId?: EntityId } // unseenSince: first observed perception loss; pendingMeal: dead creature awaiting CorpseCreated; mealId: corpse being approached/eaten, stateUntil 0 while approaching, then the eating deadline; omitted fields in older saves mean no grace or meal
interface Projectile { itemId: EntityId; from: TileIndex; to: TileIndex; progress: Fixed; shooterId: EntityId;
                       targetId: EntityId; hitRoll: number; damage: number; damageType: DamageType; line: TileIndex[];
                       spell?: Idx<SpellDef> /* a bolt's spell (25); absent: a missile */;
                       spellPower?: number /* the casting channel's power in thousandths */ }
interface Crop { plotZoneId: EntityId; plant: Idx<PlantDef>; stage: 0|1|2|3; growth: number; tile: TileIndex }
interface Merchant { partyId: EntityId; goods: EntityId[] }
interface Rune { current: number /* milli-rune; max and regen are derived, never stored */;
                 vialsToday?: number /* vials drunk today, cleared on DayPassed */; nextDreadTick?: Tick /* Dread waits until this tick */;
                 outAnnounced?: boolean /* RuneSpent announced until regen lifts the rune over its spell's cost */ }   // each absent in older saves means none
interface ActiveEffect { kind: string; value: number; until: Tick; sourceId: EntityId }
interface Spellbound { effects: ActiveEffect[] /* timed effects (25 § Effects); read by comparing until with the tick */;
                       lastDraughtTick?: Tick; lastCalmTick?: Tick /* the last draught and calming draught, kept while their rests last (25 § Draughts) */ }
interface Spellbound { effects: ActiveEffect[] /* timed effects (25 § Effects); read by comparing until with the tick */ }
interface Summoned { summonerId: EntityId /* the caster; 0 for one that came loose or turned */; fadesAt: Tick /* 25 kills it on the first HourPassed at or after this tick */ }
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
| `Tame` | 08 | 25 at a call (a summon's `Tame`) |
| `Wild` | 08 | — |
| `Crop` | 07 | — |
| `Merchant` | 20 | — |
| `Rune`, `Spellbound`, `Summoned` | 25 | — |

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
